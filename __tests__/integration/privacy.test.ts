import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { bearerFor, callRoute } from '../setup/helpers';
import { pool, query, queryOne } from '@/lib/db';
import * as conversations from '@/lib/repositories/conversations';
import exportRoute from '../../pages/api/admin/data-subjects/export';
import eraseRoute from '../../pages/api/admin/data-subjects/erase';

describeWithDatabase('data protection', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  let admin: { id: string; email: string };

  beforeEach(async () => {
    await truncateAll();
    admin = (await queryOne<{ id: string; email: string }>(
      `INSERT INTO users (email, full_name, role)
       VALUES ('privacy-admin@test.local', 'Privacy Admin', 'admin') RETURNING id, email`,
    ))!;
  });

  const asAdmin = () => ({
    authorization: `Bearer ${bearerFor({ userId: admin.id, email: admin.email, role: 'admin' })}`,
  });

  async function seedSubject(): Promise<void> {
    await query(
      `INSERT INTO form_submissions (form_type, name, email, phone, message, ip_address, user_agent, retain_until)
       VALUES ('inquiry', 'Ada Obi', 'ada@example.com', '0801 234 5678', 'About a project', '102.89.1.7', 'UA', NOW() + INTERVAL '90 days'),
              ('investment', 'Ada Obi', 'other@example.com', '+234 801 234 5678', 'Investing', NULL, NULL, NOW() + INTERVAL '2 years'),
              ('inquiry', 'Someone Else', 'else@example.com', '0802 000 0000', 'Unrelated', NULL, NULL, NOW() + INTERVAL '90 days')`,
    );
    await query(
      `INSERT INTO newsletter_subscribers (email, confirmation_token_hash)
       VALUES ('ada@example.com', 'h1'), ('else@example.com', 'h2')`,
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

  afterAll(async () => {
    await pool.end();
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
});
