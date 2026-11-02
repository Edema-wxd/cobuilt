import { env } from '@/lib/env';
import { isTurnstileEnabled, turnstileSiteKey, verifyTurnstile } from '@/lib/turnstile';
import { DEFAULT_CONTACT_SETTINGS, hoursText, telHref, whatsappHref } from '@/lib/contactDetails';
import { contactSettingsBody, readContactSettings } from '@/lib/schemas/settings';
import { inquiryBody } from '@/lib/schemas/forms';
import { enquiryTypeLabel } from '@/lib/enquiryTypes';
import { inquiryNotification } from '@/lib/mail/templates';
import { ADDRESS_LINES, EMAIL, OFFICE_LOCATION, PHONE, PHONE_HREF, WHATSAPP_HREF } from '../../components/site';

/**
 * The contact page's pieces that need no database (docs/decisions.md §2.25):
 * Cloudflare Turnstile verification against a mocked siteverify, the contact
 * details' fallback and link builders, the enquiry type, and the staff email.
 */

/** The keys are read when each call is made, so a test can switch Turnstile on and off. */
const mutableEnv = env;

function siteverify(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('Turnstile', () => {
  const fetchSpy = jest.spyOn(global, 'fetch');

  afterEach(() => {
    fetchSpy.mockReset();
    delete mutableEnv.TURNSTILE_SECRET_KEY;
    delete mutableEnv.TURNSTILE_SITE_KEY;
    delete mutableEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  });

  afterAll(() => fetchSpy.mockRestore());

  it('is off, with no site key, until the keys are set', () => {
    expect(isTurnstileEnabled()).toBe(false);
    expect(turnstileSiteKey()).toBeNull();

    mutableEnv.TURNSTILE_SECRET_KEY = 'secret';
    mutableEnv.TURNSTILE_SITE_KEY = 'server-site-key';
    expect(isTurnstileEnabled()).toBe(true);
    expect(turnstileSiteKey()).toBe('server-site-key');
    mutableEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'public-site-key';
    expect(turnstileSiteKey()).toBe('public-site-key');
  });

  it('sends the secret, the token and the visitor IP to siteverify', async () => {
    mutableEnv.TURNSTILE_SECRET_KEY = 'secret';
    fetchSpy.mockResolvedValueOnce(siteverify({ success: true, action: 'contact' }));

    await expect(verifyTurnstile('token-1', '102.89.44.10')).resolves.toEqual({ ok: true });

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const sent = new URLSearchParams(init!.body as URLSearchParams);
    expect(Object.fromEntries(sent)).toEqual({ secret: 'secret', response: 'token-1', remoteip: '102.89.44.10' });
  });

  it('accepts Cloudflare’s test keys, which name no action', async () => {
    fetchSpy.mockResolvedValueOnce(siteverify({ success: true }));
    await expect(verifyTurnstile('XXXX.DUMMY.TOKEN.XXXX', null)).resolves.toEqual({ ok: true });
  });

  it('refuses a token Cloudflare rejects, or one minted for another form', async () => {
    fetchSpy.mockResolvedValueOnce(siteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] }));
    await expect(verifyTurnstile('used', null)).resolves.toEqual({
      ok: false,
      reason: 'rejected',
      errorCodes: ['timeout-or-duplicate'],
    });

    fetchSpy.mockResolvedValueOnce(siteverify({ success: true, action: 'newsletter' }));
    await expect(verifyTurnstile('elsewhere', null)).resolves.toMatchObject({ ok: false, reason: 'rejected' });
  });

  it('reports Cloudflare unreachable, or answering with an error, as unavailable', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(verifyTurnstile('token', null)).resolves.toEqual({ ok: false, reason: 'unavailable' });

    fetchSpy.mockResolvedValueOnce(siteverify({}, 500));
    await expect(verifyTurnstile('token', null)).resolves.toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('contact details', () => {
  it('fall back to exactly the details written into the site', () => {
    expect(DEFAULT_CONTACT_SETTINGS).toEqual({
      addressLines: ADDRESS_LINES.slice(0, 2),
      phones: [{ label: 'Office', number: PHONE }],
      emails: [{ label: 'General enquiries', address: EMAIL }],
      whatsapp: PHONE,
      hours: [{ days: 'Monday to Friday', hours: '08:00–17:00 WAT' }],
      location: OFFICE_LOCATION,
    });
    // The fallback is a valid document, and builds the same links the header uses.
    expect(contactSettingsBody.parse(DEFAULT_CONTACT_SETTINGS)).toEqual(DEFAULT_CONTACT_SETTINGS);
    expect(telHref(PHONE)).toBe(PHONE_HREF);
    expect(whatsappHref(DEFAULT_CONTACT_SETTINGS.whatsapp!)).toBe(WHATSAPP_HREF);
  });

  it('describe the hours in one line', () => {
    expect(
      hoursText([
        { days: 'Monday to Friday', hours: '08:00–17:00 WAT' },
        { days: 'Saturday', hours: 'by appointment' },
      ]),
    ).toBe('Monday to Friday, 08:00–17:00 WAT; Saturday, by appointment');
  });

  it('read a stored document field by field, falling back where one no longer validates', () => {
    const read = readContactSettings(
      { phones: [{ label: 'Sales', number: '+234 801 234 5678' }], emails: 'not a list', location: { lat: 200, lng: 3 } },
      DEFAULT_CONTACT_SETTINGS,
    );
    expect(read.phones).toEqual([{ label: 'Sales', number: '+234 801 234 5678' }]);
    expect(read.emails).toEqual(DEFAULT_CONTACT_SETTINGS.emails);
    expect(read.location).toEqual(DEFAULT_CONTACT_SETTINGS.location);
    expect(readContactSettings(null, DEFAULT_CONTACT_SETTINGS)).toEqual(DEFAULT_CONTACT_SETTINGS);
  });
});

describe('enquiry type', () => {
  const base = {
    name: 'Adaeze Okafor',
    email: 'adaeze@example.com',
    message: 'We hold land in Lekki and want to discuss a joint venture.',
    consent: true,
  };

  it('defaults to a general enquiry and refuses an unknown type', () => {
    expect(inquiryBody.parse(base).enquiryType).toBe('general');
    expect(inquiryBody.parse({ ...base, enquiryType: 'partnership' }).enquiryType).toBe('partnership');
    expect(inquiryBody.safeParse({ ...base, enquiryType: 'investment' }).success).toBe(false);
    expect(enquiryTypeLabel(undefined)).toBe('General enquiry');
  });

  it('leads the staff email', () => {
    const message = inquiryNotification({
      submissionId: '00000000-0000-4000-8000-000000000001',
      name: 'Adaeze Okafor',
      email: 'adaeze@example.com',
      enquiryType: 'Partnership or joint venture',
      message: 'Joint venture.',
    });
    expect(message.subject).toBe('Partnership or joint venture: new website enquiry from Adaeze Okafor');
    expect(message.text).toContain('Type:    Partnership or joint venture');
    expect(message.html).toContain('Partnership or joint venture');

    // A job queued before the field existed still renders.
    expect(
      inquiryNotification({ submissionId: 'x', name: 'A', email: 'a@example.com', message: 'Hello there.' }).subject,
    ).toBe('New website enquiry from A');
  });
});
