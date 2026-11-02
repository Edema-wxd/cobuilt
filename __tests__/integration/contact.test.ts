import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { bearerFor, callRoute } from '../setup/helpers';
import { pool, query, queryOne } from '@/lib/db';
import { env } from '@/lib/env';
import { enqueueEmail } from '@/lib/queues';
import { DEFAULT_CONTACT_SETTINGS } from '@/lib/contactDetails';
import type { ContactSettings } from '@/lib/schemas/settings';
import inquiry from '../../pages/api/forms/inquiry';
import adminForms from '../../pages/api/admin/forms/index';
import contactSettings from '../../pages/api/admin/settings/contact';
import { loadContactSettings } from '../../app/contact/load-contact';

/**
 * The contact page's server side (docs/decisions.md §2.25): the enquiry type
 * stored and shown, Cloudflare Turnstile on the inquiry route (siteverify
 * mocked; inert without keys), and the contact details managed in the
 * console.
 */

jest.mock('@/lib/queues', () => ({ enqueueEmail: jest.fn(() => Promise.resolve()) }));

/** The keys are read when each call is made, so a test can switch Turnstile on and off. */
const mutableEnv = env;
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

const enquiry = (overrides: Record<string, unknown> = {}) => ({
  name: 'Adaeze Okafor',
  email: 'adaeze@example.com',
  message: 'We hold land in Lekki and would like to discuss a joint venture.',
  consent: true,
  ...overrides,
});

const send = (body: object) =>
  callRoute(inquiry, { method: 'POST', body, headers: { 'user-agent': BROWSER, 'x-forwarded-for': '102.89.44.10' } });

const submissionCount = async () =>
  (await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM form_submissions`))!.n;

describeWithDatabase('contact', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();
    jest.mocked(enqueueEmail).mockClear();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('enquiry type', () => {
    it('is stored with the submission and leads the staff email', async () => {
      const response = await send(enquiry({ enquiryType: 'partnership' }));
      expect(response.status).toBe(201);

      const row = await queryOne<{ metadata: Record<string, unknown> }>(
        `SELECT metadata FROM form_submissions WHERE id = $1`,
        [response.body.submissionId],
      );
      expect(row!.metadata.enquiryType).toBe('partnership');

      expect(enqueueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'inquiry-notification',
          payload: expect.objectContaining({ enquiryType: 'Partnership or joint venture' }),
        }),
      );
    });

    it('defaults to general, and refuses an unknown type', async () => {
      const response = await send(enquiry());
      const row = await queryOne<{ metadata: Record<string, unknown> }>(
        `SELECT metadata FROM form_submissions WHERE id = $1`,
        [response.body.submissionId],
      );
      expect(row!.metadata.enquiryType).toBe('general');

      expect((await send(enquiry({ enquiryType: 'investment' }))).status).toBe(422);
    });

    it('is shown in the inbox, and filters it', async () => {
      await send(enquiry({ enquiryType: 'media', email: 'press@example.com' }));
      await send(enquiry({ enquiryType: 'partnership' }));
      // An enquiry stored before the field existed reads as general.
      await query(
        `INSERT INTO form_submissions (form_type, email, message, metadata, retain_until)
         VALUES ('inquiry', 'old@example.com', 'From before the field.', '{}', NOW() + INTERVAL '90 days')`,
      );

      const all = await callRoute(adminForms, { as: 'editor' });
      expect(all.status).toBe(200);
      expect(all.body.results.map((r: { enquiryType: string }) => r.enquiryType).sort()).toEqual([
        'general',
        'media',
        'partnership',
      ]);

      const media = await callRoute(adminForms, { as: 'viewer', query: { enquiryType: 'media' } });
      expect(media.body.results).toHaveLength(1);
      expect(media.body.results[0].email).not.toBe('press@example.com'); // still masked

      const general = await callRoute(adminForms, { as: 'editor', query: { enquiryType: 'general' } });
      expect(general.body.results.map((r: { excerpt: string }) => r.excerpt)).toEqual(['From before the field.']);
    });
  });

  describe('Turnstile', () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const verdict = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

    afterEach(() => {
      fetchSpy.mockReset();
      delete mutableEnv.TURNSTILE_SECRET_KEY;
    });

    afterAll(() => fetchSpy.mockRestore());

    it('is inert without keys: no token needed, and Cloudflare is never asked', async () => {
      expect((await send(enquiry())).status).toBe(201);
      expect((await send(enquiry({ turnstileToken: 'ignored' }))).status).toBe(201);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    describe('with keys configured', () => {
      beforeEach(() => {
        mutableEnv.TURNSTILE_SECRET_KEY = 'secret';
      });

      it('requires a token, and stores nothing without one', async () => {
        const response = await send(enquiry());
        expect(response.status).toBe(422);
        expect(response.body.error.details[0].field).toBe('turnstileToken');
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(await submissionCount()).toBe(0);
      });

      it('accepts a token Cloudflare passes, checked against the visitor’s IP', async () => {
        fetchSpy.mockResolvedValueOnce(verdict({ success: true, action: 'contact' }));

        const response = await send(enquiry({ turnstileToken: 'good-token' }));
        expect(response.status).toBe(201);
        const sent = new URLSearchParams(fetchSpy.mock.calls[0]![1]!.body as URLSearchParams);
        expect(sent.get('response')).toBe('good-token');
        expect(sent.get('secret')).toBe('secret');
        expect(sent.get('remoteip')).toBe('102.89.44.10');
        expect(await submissionCount()).toBe(1);
      });

      it('refuses a token Cloudflare rejects', async () => {
        fetchSpy.mockResolvedValueOnce(verdict({ success: false, 'error-codes': ['invalid-input-response'] }));
        const response = await send(enquiry({ turnstileToken: 'forged' }));
        expect(response.status).toBe(400);
        expect(await submissionCount()).toBe(0);
        expect(enqueueEmail).not.toHaveBeenCalled();
      });

      it('fails closed when Cloudflare cannot be asked', async () => {
        fetchSpy.mockRejectedValueOnce(new Error('ETIMEDOUT'));
        const response = await send(enquiry({ turnstileToken: 'token' }));
        expect(response.status).toBe(503);
        expect(await submissionCount()).toBe(0);
      });
    });
  });

  describe('/api/admin/settings/contact', () => {
    let admin: { id: string; email: string };

    beforeEach(async () => {
      admin = (await queryOne<{ id: string; email: string }>(
        `INSERT INTO users (email, full_name, role) VALUES ('site-admin@test.local', 'Site Admin', 'admin')
         RETURNING id, email`,
      ))!;
    });

    const asAdmin = () => ({
      authorization: `Bearer ${bearerFor({ userId: admin.id, email: admin.email, role: 'admin' })}`,
    });
    const put = (body: object) => callRoute(contactSettings, { method: 'PUT', headers: asAdmin(), body });

    const changed: ContactSettings = {
      addressLines: ['5 Marina Road', 'Lagos Island, Lagos'],
      phones: [
        { label: 'Office', number: '+234 700 262 8458' },
        { label: 'Sales', number: '+234 801 234 5678' },
      ],
      emails: [
        { label: 'General enquiries', address: 'hello@cobuiltpartners.com' },
        { label: 'Press', address: 'press@cobuiltpartners.com' },
      ],
      whatsapp: null,
      hours: [
        { days: 'Monday to Friday', hours: '08:00–17:00 WAT' },
        { days: 'Saturday', hours: 'By appointment' },
      ],
      location: { lat: 6.4541, lng: 3.3947 },
    };

    it('is admin only', async () => {
      expect((await callRoute(contactSettings)).status).toBe(401);
      for (const role of ['editor', 'viewer', 'investor'] as const) {
        expect((await callRoute(contactSettings, { as: role })).status).toBe(403);
        expect((await callRoute(contactSettings, { method: 'PUT', as: role, body: changed })).status).toBe(403);
      }
    });

    it('reads the details as built until someone saves', async () => {
      const { status, body } = await callRoute(contactSettings, { headers: asAdmin() });
      expect(status).toBe(200);
      expect(body).toEqual({ settings: DEFAULT_CONTACT_SETTINGS, updatedAt: null, updatedBy: null });
      expect(await loadContactSettings()).toEqual(DEFAULT_CONTACT_SETTINGS);
    });

    it('saves the whole document, audits the fields that changed, and the page reads it', async () => {
      const { status, body } = await put(changed);
      expect(status).toBe(200);
      expect(body).toMatchObject({ settings: changed, updatedBy: 'Site Admin', revalidated: false });

      const entry = await queryOne<{ action: string; entity_id: string; changes: Record<string, unknown> }>(
        `SELECT action, entity_id, changes FROM audit_log WHERE actor_id = $1`,
        [admin.id],
      );
      expect(entry).toMatchObject({ action: 'settings.updated', entity_id: 'contact' });
      expect(Object.keys(entry!.changes).sort()).toEqual(['addressLines', 'emails', 'hours', 'location', 'phones', 'whatsapp']);

      expect(await loadContactSettings()).toEqual(changed);

      // Saving the same thing again writes no audit entry.
      await put(changed);
      expect((await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM audit_log`))!.n).toBe(1);
    });

    it('refuses a document that would leave the page without a way to reach anyone', async () => {
      for (const body of [
        { ...changed, phones: [] },
        { ...changed, emails: [{ label: 'Press', address: 'not-an-email' }] },
        { ...changed, addressLines: [] },
        { ...changed, location: { lat: 95, lng: 3 } },
        { addressLines: changed.addressLines },
      ]) {
        expect((await put(body)).status).toBe(422);
      }
    });
  });
});
