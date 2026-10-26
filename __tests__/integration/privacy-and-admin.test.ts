import { ZodError } from 'zod';
import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { bearerFor, callRoute } from '../setup/helpers';
import { pool, query, queryOne } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { createAdmin } from '@/lib/auth/bootstrap';
import * as conversations from '@/lib/repositories/conversations';
import exportRoute from '../../pages/api/admin/data-subjects/export';
import eraseRoute from '../../pages/api/admin/data-subjects/erase';
import registerRoute from '../../pages/api/auth/register';

describeWithDatabase('data subject requests, message retention and admin bootstrap', () => {
  let admin: { id: string; email: string };

  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();
    admin = (await queryOne<{ id: string; email: string }>(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ('privacy-admin@test.local', 'x', 'Privacy Admin', 'admin') RETURNING id, email`,
    ))!;
  });

  afterAll(async () => {
    await pool.end();
  });

  const asAdmin = () => ({
    authorization: `Bearer ${bearerFor({ userId: admin.id, email: admin.email, role: 'admin' })}`,
  });

  async function seedSubject(): Promise<void> {
    await query(
      `INSERT INTO form_submissions (form_type, name, email, phone, message, ip_address, user_agent, retain_until)
       VALUES ('inquiry', 'Ada Obi', 'ada@example.com', '0801 234 5678', 'About Ocean Ridge', '102.89.1.7', 'UA', NOW() + INTERVAL '90 days'),
              ('investment', 'Ada Obi', 'other@example.com', '+234 801 234 5678', 'Investing', NULL, NULL, NOW() + INTERVAL '2 years'),
              ('inquiry', 'Someone Else', 'else@example.com', '0802 000 0000', 'Unrelated', NULL, NULL, NOW() + INTERVAL '90 days')`,
    );
    await query(
      `INSERT INTO newsletter_subscribers (email, confirmation_token_hash) VALUES ('ada@example.com', 'h1'), ('else@example.com', 'h2')`,
    );
    await query(
      `INSERT INTO chat_events (provider, event_type, contact_email, content)
       VALUES ('chatwoot', 'message_created', 'ADA@example.com', 'Hello'),
              ('chatwoot', 'message_created', 'else@example.com', 'Hi')`,
    );
    await query(
      `INSERT INTO whatsapp_messages (phone, content, direction)
       VALUES ('2348012345678', 'Hi from WhatsApp', 'inbound'), ('2348020000000', 'Other', 'inbound')`,
    );
  }

  describe('POST /api/admin/data-subjects/export', () => {
    it('finds records by email and by phone in local or international form', async () => {
      await seedSubject();

      const { status, body } = await callRoute(exportRoute, {
        method: 'POST',
        headers: asAdmin(),
        body: { email: 'ada@example.com', phone: '0801 234 5678' },
      });

      expect(status).toBe(200);
      expect(body.formSubmissions).toHaveLength(2);
      expect(body.formSubmissions[0]).toHaveProperty('ip_address');
      expect(body.newsletter).toHaveLength(1);
      expect(body.chatEvents).toHaveLength(1);
      expect(body.whatsappMessages).toHaveLength(1);
      expect(body.account).toBeNull();
    });

    it('records the export in the audit log without the raw identifiers', async () => {
      await seedSubject();
      await callRoute(exportRoute, {
        method: 'POST',
        headers: asAdmin(),
        body: { email: 'ada@example.com' },
      });

      const entry = await queryOne<{ changes: Record<string, unknown> }>(
        `SELECT changes FROM audit_log WHERE action = 'data_subject.exported'`,
      );
      expect(JSON.stringify(entry!.changes)).not.toContain('ada@example.com');
      expect(entry!.changes.formSubmissions).toBe(1);
    });

    it('requires the privacy:manage permission', async () => {
      const { status } = await callRoute(exportRoute, {
        method: 'POST',
        as: 'editor',
        body: { email: 'ada@example.com' },
      });
      expect(status).toBe(403);
    });

    it('rejects a request with neither email nor phone', async () => {
      const { status, body } = await callRoute(exportRoute, {
        method: 'POST',
        headers: asAdmin(),
        body: {},
      });
      expect(status).toBe(422);
      expect(body.error.details[0].field).toBe('email');
    });
  });

  describe('POST /api/admin/data-subjects/erase', () => {
    it("erases one person's records and leaves everyone else's", async () => {
      await seedSubject();

      const { status, body } = await callRoute(eraseRoute, {
        method: 'POST',
        headers: asAdmin(),
        body: { email: 'ada@example.com', phone: '08012345678' },
      });

      expect(status).toBe(200);
      expect(body).toMatchObject({
        submissionsAnonymised: 2,
        newsletterRemoved: 1,
        chatEventsDeleted: 1,
        whatsappMessagesDeleted: 1,
        accountId: null,
      });

      const remaining = await query<{ email: string | null }>(
        `SELECT email FROM form_submissions WHERE anonymised_at IS NULL`,
      );
      expect(remaining.rows.map((r) => r.email)).toEqual(['else@example.com']);

      const counts = await queryOne<Record<string, string>>(
        `SELECT (SELECT count(*) FROM newsletter_subscribers)::text AS newsletter,
                (SELECT count(*) FROM chat_events)::text AS chat,
                (SELECT count(*) FROM whatsapp_messages)::text AS whatsapp,
                (SELECT count(*) FROM form_submissions)::text AS forms`,
      );
      expect(counts).toEqual({ newsletter: '1', chat: '1', whatsapp: '1', forms: '3' });
    });

    it('reports, but does not close, a staff account under the same email', async () => {
      const { status, body } = await callRoute(eraseRoute, {
        method: 'POST',
        headers: asAdmin(),
        body: { email: admin.email },
      });

      expect(status).toBe(200);
      expect(body.accountId).toBe(admin.id);
      const stillThere = await queryOne(
        `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [admin.id],
      );
      expect(stillThere).not.toBeNull();
    });
  });

  describe('message retention', () => {
    it('deletes WhatsApp and chat messages older than the retention period', async () => {
      await query(
        `INSERT INTO whatsapp_messages (phone, content, direction, received_at)
         VALUES ('2348011111111', 'old', 'inbound', NOW() - INTERVAL '91 days'),
                ('2348011111111', 'new', 'inbound', NOW() - INTERVAL '89 days')`,
      );
      await query(
        `INSERT INTO chat_events (provider, event_type, content, received_at)
         VALUES ('chatwoot', 'message_created', 'old', NOW() - INTERVAL '91 days'),
                ('chatwoot', 'message_created', 'new', NOW())`,
      );

      expect(await conversations.purgeExpired()).toEqual({ whatsapp: 1, chat: 1 });

      const left = await query<{ content: string }>(
        `SELECT content FROM whatsapp_messages UNION ALL SELECT content FROM chat_events`,
      );
      expect(left.rows.map((r) => r.content)).toEqual(['new', 'new']);
    });
  });

  describe('admin bootstrap', () => {
    it('creates an admin with a generated password that works', async () => {
      const result = await createAdmin({ email: 'First@CoBuilt.test', fullName: 'First Admin' });

      expect(result.status).toBe('created');
      if (result.status !== 'created') return;
      expect(result.email).toBe('first@cobuilt.test');
      expect(result.generatedPassword).toHaveLength(24);

      const row = await queryOne<{ role: string; password_hash: string }>(
        `SELECT role, password_hash FROM users WHERE id = $1`,
        [result.userId],
      );
      expect(row!.role).toBe('admin');
      expect(await verifyPassword(result.generatedPassword!, row!.password_hash)).toBe(true);
    });

    it('uses a supplied password and leaves an existing account untouched', async () => {
      const first = await createAdmin({
        email: 'second@cobuilt.test',
        fullName: 'Second Admin',
        password: 'a-long-enough-passphrase',
      });
      expect(first).toMatchObject({ status: 'created', generatedPassword: null });

      const again = await createAdmin({ email: 'second@cobuilt.test', fullName: 'Someone' });
      expect(again).toEqual({ status: 'exists', email: 'second@cobuilt.test' });
    });

    it('enforces the password policy', async () => {
      await expect(
        createAdmin({ email: 'x@cobuilt.test', fullName: 'Short', password: 'short' }),
      ).rejects.toBeInstanceOf(ZodError);
    });
  });

  describe('POST /api/auth/register', () => {
    const body = {
      email: 'new@cobuilt.test',
      password: 'a-long-enough-passphrase',
      fullName: 'New Person',
    };

    it('refuses anonymous callers', async () => {
      const { status } = await callRoute(registerRoute, { method: 'POST', body });
      expect(status).toBe(401);
    });

    it('refuses non-admins', async () => {
      const { status } = await callRoute(registerRoute, { method: 'POST', as: 'editor', body });
      expect(status).toBe(403);
    });

    it('lets an admin create an account', async () => {
      const { status, body: created } = await callRoute(registerRoute, {
        method: 'POST',
        headers: asAdmin(),
        body,
      });
      expect(status).toBe(201);
      expect(created.user.role).toBe('viewer');
    });
  });
});
