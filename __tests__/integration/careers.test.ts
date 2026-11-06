import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import { zipSync, strToU8 } from 'fflate';
import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { bearerFor, callRoute, type ApiHandler } from '../setup/helpers';
import { pool, query, queryOne } from '@/lib/db';
import { env } from '@/lib/env';
import * as cache from '@/lib/cache';
import * as rateLimit from '@/lib/rateLimit';
import { enqueueEmail } from '@/lib/queues';
import { MAX_CV_BYTES, isOpen, lagosToday, salaryText } from '@/lib/careers';
import { applicationFields, createVacancyBody, updateVacancyBody } from '@/lib/schemas/careers';
import { attachmentDisposition, checkCv, safeFileName } from '@/lib/storage/cvFiles';
import * as vacancies from '@/lib/repositories/vacancies';
import * as jobApplications from '@/lib/repositories/jobApplications';
import * as templates from '@/lib/mail/templates';
import { runMaintenance } from '@/lib/queues/processors';
import publicList from '../../pages/api/vacancies/index';
import publicItem from '../../pages/api/vacancies/[slug]';
import apply from '../../pages/api/careers/apply';
import adminVacancies from '../../pages/api/admin/careers/vacancies/index';
import adminVacancy from '../../pages/api/admin/careers/vacancies/[vacancyId]';
import adminReorder from '../../pages/api/admin/careers/vacancies/reorder';
import adminApplications from '../../pages/api/admin/careers/applications/index';
import adminApplication from '../../pages/api/admin/careers/applications/[applicationId]/index';
import adminCv from '../../pages/api/admin/careers/applications/[applicationId]/cv';
import exportRoute from '../../pages/api/admin/data-subjects/export';
import eraseRoute from '../../pages/api/admin/data-subjects/erase';
import { loadOpenVacancies, loadVacancy } from '../../app/careers/load-careers';
import { jobPosting, serialiseJsonLd } from '../../app/careers/[slug]/job-posting';

/**
 * Careers (docs/decisions.md §2.28): vacancies, the application form with its
 * CV, the inbox and its permissions, the CV download, and the privacy duties
 * — subject access and erasure, and the retention purge. Mail is mocked (the
 * queue is what is asserted), as is Cloudflare's siteverify; the multipart
 * body and the CV checks run for real.
 */

jest.mock('@/lib/queues', () => ({ enqueueEmail: jest.fn(() => Promise.resolve()) }));
// The nightly purge is run for real; the search rebuild beside it is not under test.
jest.mock('@/lib/search', () => ({
  indexProject: jest.fn(),
  indexNews: jest.fn(),
  removeDocument: jest.fn(),
  reindexAll: jest.fn(() => Promise.resolve(0)),
}));

/** The account the test bearer tokens carry (setup/helpers.ts), so audit rows can reference it. */
const ACTOR_ID = '00000000-0000-4000-8000-000000000001';
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
const MISSING = '00000000-0000-4000-8000-00000000dead';
const mutableEnv = env;

/** A minimal file that starts as a PDF does. */
const pdfBytes = (size = 2048) => {
  const bytes = Buffer.alloc(size, 0x20);
  Buffer.from('%PDF-1.7\n').copy(bytes);
  return bytes;
};

/** A minimal Word document: a ZIP holding the two parts every .docx has. */
const docxBytes = () =>
  Buffer.from(
    zipSync({
      '[Content_Types].xml': strToU8('<Types/>'),
      'word/document.xml': strToU8('<w:document/>'),
    }),
  );

const daysFromToday = (days: number) => {
  const today = lagosToday();
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

interface Sent {
  status: number;
  body: any;
  headers: Record<string, unknown>;
}

/** Drives a route with a raw body, as the application route reads one. */
async function callRaw(
  handler: ApiHandler,
  input: { body: Buffer; headers: Record<string, string> },
): Promise<Sent> {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method: 'POST',
    url: '/api/careers/apply',
    headers: input.headers,
  });
  // The route reads the body as a stream, as Node delivers it.
  (req as unknown as { [Symbol.asyncIterator]: () => Iterator<Buffer> })[Symbol.asyncIterator] = function* stream() {
    yield input.body;
  };
  await handler(req, res);
  const raw = (res as any)._getData();
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }
  return { status: (res as any)._getStatusCode(), body, headers: (res as any).getHeaders() };
}

/** Sends the application form as a browser would: multipart, with a CV. */
async function sendApplication(
  fields: Record<string, string | undefined>,
  cv: { name: string; bytes: Buffer; type?: string } | null = { name: 'Ada Obi CV.pdf', bytes: pdfBytes() },
  headers: Record<string, string> = {},
): Promise<Sent> {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) if (value !== undefined) form.set(name, value);
  if (cv) form.set('cv', new File([new Uint8Array(cv.bytes)], cv.name, { type: cv.type ?? 'application/pdf' }));

  const request = new Request('http://localhost/api/careers/apply', { method: 'POST', body: form });
  const body = Buffer.from(await request.arrayBuffer());
  return callRaw(apply, {
    body,
    headers: {
      'content-type': request.headers.get('content-type')!,
      'content-length': String(body.length),
      'user-agent': BROWSER,
      'x-forwarded-for': '102.89.44.10',
      ...headers,
    },
  });
}

const applicant = (overrides: Record<string, string | undefined> = {}) => ({
  name: 'Ada Obi',
  email: 'ada@example.com',
  phone: '0801 234 5678',
  coverNote: 'I have run cost control on two residential schemes in Lekki and would like to do it here.',
  consent: 'true',
  ...overrides,
});

const count = async (table: string) => (await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`))!.n;

describeWithDatabase('careers', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();
    jest.clearAllMocks();
    await query(
      `INSERT INTO users (id, email, full_name, role) VALUES ($1, 'admin@cobuilt.test', 'Test Admin', 'admin')`,
      [ACTOR_ID],
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  function make(overrides: Partial<vacancies.CreateVacancyInput> = {}) {
    return vacancies.create({
      title: 'Quantity Surveyor',
      type: 'full_time',
      department: 'Quantity surveying and cost control',
      location: 'Lekki, Lagos',
      workPattern: 'hybrid',
      summary: 'Run cost control on a residential scheme from tender to final account.',
      description: null,
      responsibilities: ['Prepare and agree valuations'],
      requirements: ['RICS or NIQS membership'],
      benefits: [],
      salary: null,
      closingDate: null,
      published: true,
      createdBy: null,
      ...overrides,
    });
  }

  /** An application stored straight through the repository. */
  function store(overrides: Partial<jobApplications.CreateApplicationInput> = {}) {
    const bytes = pdfBytes();
    return jobApplications.create({
      vacancyId: null,
      name: 'Ada Obi',
      email: 'ada@example.com',
      phone: '0801 234 5678',
      coverNote: 'A note.',
      cv: { fileName: 'ada.pdf', contentType: 'application/pdf', sizeBytes: bytes.length, bytes },
      spamScore: 0,
      flaggedAsSpam: false,
      ...overrides,
    });
  }

  const as = (role: 'admin' | 'editor' | 'viewer' | 'investor') => ({
    authorization: `Bearer ${bearerFor({ userId: ACTOR_ID, role })}`,
  });

  describe('rules', () => {
    it('keeps a vacancy open through the whole of its closing day in West Africa Time', () => {
      // 23:30 UTC on 10 December is 00:30 on the 11th in Lagos.
      const lateEvening = new Date('2026-12-10T23:30:00Z');
      expect(lagosToday(lateEvening)).toBe('2026-12-11');
      expect(isOpen('2026-12-10', lateEvening)).toBe(false);
      expect(isOpen('2026-12-11', lateEvening)).toBe(true);
      expect(isOpen(null, lateEvening)).toBe(true);
    });

    it('validates a vacancy, and its salary only when it has one', () => {
      const base = { title: 'QS', type: 'full_time', location: 'Lagos', summary: 'Ten characters at least.' };
      expect(createVacancyBody.parse(base)).toMatchObject({ salary: null, published: false, benefits: [] });
      expect(createVacancyBody.safeParse({ ...base, type: 'temporary' }).success).toBe(false);
      expect(createVacancyBody.safeParse({ ...base, closingDate: '2026-02-31' }).success).toBe(false);
      expect(createVacancyBody.safeParse({ ...base, salary: { min: null, max: null, period: 'month' } }).success).toBe(false);
      expect(createVacancyBody.safeParse({ ...base, salary: { min: 900, max: 100, period: 'month' } }).success).toBe(false);
      expect(createVacancyBody.parse({ ...base, salary: { min: 450_000, max: null, period: 'month' } }).salary).toEqual({
        min: 450_000,
        max: null,
        currency: 'NGN',
        period: 'month',
      });
      expect(updateVacancyBody.safeParse({}).success).toBe(false);
      expect(salaryText(null)).toBeNull();
      expect(salaryText({ min: 450_000, max: 600_000, currency: 'NGN', period: 'month' })).toMatch(/450,000.+600,000 a month$/);
    });

    it('validates the form fields with messages a person can act on', () => {
      const result = applicationFields.safeParse({ name: 'A', email: 'not-an-email', phone: 'call me' });
      expect(result.success).toBe(false);
      const fields = result.error!.issues.map((issue) => issue.path.join('.'));
      expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'phone', 'consent']));
      // A blank optional field is absent, not an error.
      expect(applicationFields.parse({ name: 'Ada Obi', email: 'ADA@Example.com ', phone: '', coverNote: ' ', consent: 'on' })).toMatchObject(
        { email: 'ada@example.com', phone: undefined, coverNote: undefined },
      );
    });
  });

  describe('the CV check', () => {
    it('accepts a PDF and a Word document, by their content, and stores the detected type', () => {
      expect(checkCv({ name: 'cv.PDF', bytes: pdfBytes() })).toMatchObject({
        ok: true,
        cv: { fileName: 'cv.pdf', contentType: 'application/pdf' },
      });
      expect(checkCv({ name: 'cv.docx', bytes: docxBytes() })).toMatchObject({
        ok: true,
        cv: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      });
    });

    it('refuses a file whose content is not what its name says', () => {
      const executable = Buffer.from('MZ\x90\x00 this is not a PDF');
      expect(checkCv({ name: 'cv.pdf', bytes: executable })).toMatchObject({ ok: false, message: /not a readable PDF/ });
      // A ZIP that is not a Word document.
      const zip = Buffer.from(zipSync({ 'payload.js': strToU8('alert(1)') }));
      expect(checkCv({ name: 'cv.docx', bytes: zip })).toMatchObject({ ok: false, message: /not a readable Word/ });
      expect(checkCv({ name: 'cv.doc', bytes: pdfBytes() })).toMatchObject({ ok: false, message: /PDF or a Word/ });
      expect(checkCv({ name: 'cv.exe', bytes: pdfBytes() })).toMatchObject({ ok: false });
    });

    it('refuses an empty file and one over the size limit', () => {
      expect(checkCv({ name: 'cv.pdf', bytes: Buffer.alloc(0) })).toMatchObject({ ok: false, message: /empty/ });
      expect(checkCv({ name: 'cv.pdf', bytes: pdfBytes(MAX_CV_BYTES + 1) })).toMatchObject({ ok: false, message: /4 MB/ });
      expect(checkCv({ name: 'cv.pdf', bytes: pdfBytes(MAX_CV_BYTES) }).ok).toBe(true);
    });

    it('keeps only a safe file name, and quotes it safely for a download', () => {
      expect(safeFileName('C:\\Users\\ada\\My "CV"<final>.PDF', 'pdf')).toBe('My CVfinal.pdf');
      expect(safeFileName('../../etc/passwd.pdf', 'pdf')).toBe('passwd.pdf');
      expect(safeFileName('\u0000.pdf', 'pdf')).toBe('cv.pdf');
      expect(attachmentDisposition('Adaèze (CV).pdf')).toBe(
        `attachment; filename="Ada_ze (CV).pdf"; filename*=UTF-8''Ada%C3%A8ze%20%28CV%29.pdf`,
      );
    });
  });

  describe('vacancies', () => {
    it('creates at the end of the list with a unique slug, dated when first published', async () => {
      const first = await make();
      const second = await make({ published: false });
      expect(second.slug).toBe('quantity-surveyor-2');
      expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
      expect(first.postedAt).not.toBeNull();
      expect(second.postedAt).toBeNull();

      const published = await vacancies.update(second.id, { published: true });
      expect(published!.postedAt).not.toBeNull();
      // Unpublishing and republishing keeps the first date.
      await vacancies.update(second.id, { published: false });
      expect((await vacancies.update(second.id, { published: true }))!.postedAt).toBe(published!.postedAt);
    });

    it('lists only published vacancies that are still open; the page still finds a closed one', async () => {
      await make({ title: 'Open, no date' });
      await make({ title: 'Closes today', closingDate: lagosToday() });
      await make({ title: 'Closed yesterday', closingDate: daysFromToday(-1) });
      await make({ title: 'Draft', published: false });

      expect((await vacancies.listOpen()).map((v) => v.title)).toEqual(['Open, no date', 'Closes today']);
      expect(await vacancies.findPublishedBySlug('closed-yesterday')).toMatchObject({ isOpen: false });
      expect(await vacancies.findPublishedBySlug('draft')).toBeNull();
    });

    it('serves GET /api/vacancies and /api/vacancies/[slug] for open, published vacancies only', async () => {
      await make({ title: 'Site Engineer', salary: { min: 400_000, max: 550_000, currency: 'NGN', period: 'month' } });
      await make({ title: 'Closed', closingDate: daysFromToday(-3) });
      await make({ title: 'Draft', published: false });

      const list = await callRoute(publicList);
      expect(list.status).toBe(200);
      expect(list.headers['cache-control']).toMatch(/s-maxage=60/);
      expect(list.body.results.map((v: { title: string }) => v.title)).toEqual(['Site Engineer']);
      expect(list.body.results[0]).not.toHaveProperty('published');
      expect(list.body.results[0]).not.toHaveProperty('applicationCount');

      const item = await callRoute(publicItem, { query: { slug: 'site-engineer' } });
      expect(item.status).toBe(200);
      expect(item.body.salary).toEqual({ min: 400_000, max: 550_000, currency: 'NGN', period: 'month' });

      expect((await callRoute(publicItem, { query: { slug: 'closed' } })).status).toBe(404);
      expect((await callRoute(publicItem, { query: { slug: 'draft' } })).status).toBe(404);
      expect((await callRoute(publicItem, { query: { slug: 'Not A Slug' } })).status).toBe(422);
    });

    it('gives the pages what they need, and JobPosting markup that is safe and honest', async () => {
      const open = await make({ title: 'Graduate Engineer </script><script>alert(1)</script>', type: 'graduate' });
      await make({ title: 'Old role', closingDate: daysFromToday(-1) });

      const data = await loadOpenVacancies();
      expect(data.kind === 'ready' && data.vacancies.map((v) => v.id)).toEqual([open.id]);
      const closed = await loadVacancy('old-role');
      expect(closed.kind === 'found' && closed.vacancy.isOpen).toBe(false);
      expect((await loadVacancy('nothing-here')).kind).toBe('not-found');

      const posting = jobPosting(open);
      expect(posting).toMatchObject({ '@type': 'JobPosting', employmentType: 'FULL_TIME', directApply: true });
      expect(posting).not.toHaveProperty('baseSalary');
      expect(posting).not.toHaveProperty('validThrough');
      const json = serialiseJsonLd(posting);
      expect(json).not.toContain('</script>');
      expect(JSON.parse(json).title).toBe(open.title);

      const paid = jobPosting({ ...open, salary: { min: 2_000_000, max: null, currency: 'NGN', period: 'year' }, closingDate: '2026-12-11' });
      expect(paid).toMatchObject({
        baseSalary: { currency: 'NGN', value: { value: 2_000_000, unitText: 'YEAR' } },
        validThrough: '2026-12-11T23:59:59+01:00',
      });
    });
  });

  describe('POST /api/careers/apply', () => {
    it('stores an application and its CV, and queues both emails without the CV', async () => {
      const vacancy = await make();
      const response = await sendApplication({ ...applicant(), vacancyId: vacancy.id });
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ success: true });

      const row = await queryOne<Record<string, unknown>>(`SELECT * FROM job_applications`);
      expect(row).toMatchObject({
        vacancy_id: vacancy.id,
        name: 'Ada Obi',
        email: 'ada@example.com',
        cv_file_name: 'Ada Obi CV.pdf',
        cv_content_type: 'application/pdf',
        status: 'new',
        flagged_as_spam: false,
      });
      // Minimal data: no IP address or browser details are kept.
      expect(Object.keys(row!)).not.toContain('ip_address');
      expect(Object.keys(row!)).not.toContain('user_agent');
      const retain = (row!.retain_until as Date).getTime() - (row!.created_at as Date).getTime();
      expect(Math.round(retain / 86_400_000)).toBe(180);

      const cv = await queryOne<{ content: Buffer }>(`SELECT content FROM job_application_cvs`);
      expect(cv!.content.equals(pdfBytes())).toBe(true);

      expect(enqueueEmail).toHaveBeenCalledTimes(2);
      expect(enqueueEmail).toHaveBeenCalledWith({
        type: 'application-confirmation',
        to: 'ada@example.com',
        payload: { name: 'Ada Obi', vacancyTitle: 'Quantity Surveyor' },
      });
      expect(enqueueEmail).toHaveBeenCalledWith({
        type: 'application-notification',
        to: env.ADMIN_EMAIL,
        payload: { applicationId: row!.id, name: 'Ada Obi', vacancyTitle: 'Quantity Surveyor' },
      });
    });

    it('takes a speculative application, and tells every address in CAREERS_EMAIL', async () => {
      mutableEnv.CAREERS_EMAIL = 'hr@cobuilt.test, md@cobuilt.test';
      try {
        const response = await sendApplication(applicant(), { name: 'cv.docx', bytes: docxBytes(), type: '' });
        expect(response.status).toBe(201);
      } finally {
        delete mutableEnv.CAREERS_EMAIL;
      }
      expect(await queryOne(`SELECT vacancy_id, cv_content_type FROM job_applications`)).toEqual({
        vacancy_id: null,
        cv_content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const notified = jest.mocked(enqueueEmail).mock.calls.filter(([job]) => job.type === 'application-notification');
      expect(notified.map(([job]) => job.to)).toEqual(['hr@cobuilt.test', 'md@cobuilt.test']);
    });

    it('reports every problem at once, CV included, and stores nothing', async () => {
      const response = await sendApplication({ name: '', email: 'nope', phone: 'x', consent: undefined }, null);
      expect(response.status).toBe(422);
      expect(response.body.error.details.map((d: { field: string }) => d.field)).toEqual(
        expect.arrayContaining(['name', 'email', 'phone', 'consent', 'cv']),
      );
      expect(await count('job_applications')).toBe(0);
      expect(enqueueEmail).not.toHaveBeenCalled();
    });

    it('checks the CV’s type and size on the server, whatever the browser claims', async () => {
      const disguised = await sendApplication(applicant(), {
        name: 'cv.pdf',
        bytes: Buffer.from('#!/bin/sh\necho owned'),
        type: 'application/pdf',
      });
      expect(disguised.status).toBe(422);
      expect(disguised.body.error.details).toEqual([{ field: 'cv', message: expect.stringMatching(/not a readable PDF/) }]);

      const legacy = await sendApplication(applicant(), { name: 'cv.doc', bytes: pdfBytes(), type: 'application/msword' });
      expect(legacy.status).toBe(422);

      const large = await sendApplication(applicant(), { name: 'cv.pdf', bytes: pdfBytes(MAX_CV_BYTES + 1) });
      expect(large.status).toBe(422);
      expect(large.body.error.details[0]).toMatchObject({ field: 'cv', message: expect.stringMatching(/4 MB/) });
      expect(await count('job_applications')).toBe(0);
    });

    it('refuses an oversized body before reading it, and anything that is not multipart', async () => {
      const declared = await callRaw(apply, {
        body: Buffer.from('x'),
        headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(50 * 1024 * 1024) },
      });
      expect(declared.status).toBe(413);

      // A body that runs past the ceiling with no declared length is cut off too.
      const streamed = await callRaw(apply, {
        body: Buffer.alloc(MAX_CV_BYTES + 128 * 1024),
        headers: { 'content-type': 'multipart/form-data; boundary=x' },
      });
      expect(streamed.status).toBe(413);

      const json = await callRaw(apply, {
        body: Buffer.from(JSON.stringify(applicant())),
        headers: { 'content-type': 'application/json' },
      });
      expect(json.status).toBe(415);
    });

    it('refuses a closed vacancy and a draft one, and stores nothing', async () => {
      const closed = await make({ title: 'Closed role', closingDate: daysFromToday(-1) });
      const draft = await make({ title: 'Draft role', published: false });

      const late = await sendApplication({ ...applicant(), vacancyId: closed.id });
      expect(late.status).toBe(409);
      expect(late.body.error.message).toMatch(/closed on/);
      expect((await sendApplication({ ...applicant(), vacancyId: draft.id })).status).toBe(404);
      expect((await sendApplication({ ...applicant(), vacancyId: MISSING })).status).toBe(404);
      expect(await count('job_applications')).toBe(0);
    });

    it('takes an application on its closing day', async () => {
      const today = await make({ closingDate: lagosToday() });
      expect((await sendApplication({ ...applicant(), vacancyId: today.id })).status).toBe(201);
    });

    it('answers a filled honeypot as a success, and keeps nothing', async () => {
      const response = await sendApplication({ ...applicant(), website: 'https://spam.example' });
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ success: true });
      expect(await count('job_applications')).toBe(0);
      expect(await count('job_application_cvs')).toBe(0);
      expect(enqueueEmail).not.toHaveBeenCalled();
    });

    it('keeps an application scored as spam for review, and emails nobody', async () => {
      const response = await sendApplication(
        applicant({ coverNote: 'Cheap seo services and backlink packages, click here now' }),
        undefined,
        { 'user-agent': '' },
      );
      expect(response.status).toBe(201);
      expect(await queryOne(`SELECT flagged_as_spam FROM job_applications`)).toEqual({ flagged_as_spam: true });
      expect(enqueueEmail).not.toHaveBeenCalled();
    });

    it('is rate limited on its own bucket, before the body is read', async () => {
      const consume = jest
        .spyOn(rateLimit, 'consume')
        .mockResolvedValue({ allowed: false, limit: 5, remaining: 0, resetSeconds: 600 });
      try {
        const response = await sendApplication(applicant());
        expect(response.status).toBe(429);
        expect(response.headers['retry-after']).toBe('600');
        expect(consume).toHaveBeenCalledWith(rateLimit.RATE_LIMITS.application, '102.89.44.10');
      } finally {
        consume.mockRestore();
      }
      expect(await count('job_applications')).toBe(0);
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

      it('is inert without keys', async () => {
        expect((await sendApplication(applicant())).status).toBe(201);
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      describe('with keys configured', () => {
        beforeEach(() => {
          mutableEnv.TURNSTILE_SECRET_KEY = 'secret';
        });

        it('requires a token, and stores nothing without one', async () => {
          const response = await sendApplication(applicant());
          expect(response.status).toBe(422);
          expect(response.body.error.details[0].field).toBe('turnstileToken');
          expect(await count('job_applications')).toBe(0);
        });

        it('accepts a token Cloudflare passes for this form', async () => {
          fetchSpy.mockResolvedValueOnce(verdict({ success: true, action: 'careers' }));
          const response = await sendApplication({ ...applicant(), turnstileToken: 'good' });
          expect(response.status).toBe(201);
          const sent = new URLSearchParams(fetchSpy.mock.calls[0]![1]!.body as URLSearchParams);
          expect(sent.get('response')).toBe('good');
          expect(sent.get('remoteip')).toBe('102.89.44.10');
        });

        it('refuses a token minted for the contact form, or refused outright', async () => {
          fetchSpy.mockResolvedValueOnce(verdict({ success: true, action: 'contact' }));
          expect((await sendApplication({ ...applicant(), turnstileToken: 'from-contact' })).status).toBe(400);
          fetchSpy.mockResolvedValueOnce(verdict({ success: false, 'error-codes': ['invalid-input-response'] }));
          expect((await sendApplication({ ...applicant(), turnstileToken: 'forged' })).status).toBe(400);
          expect(await count('job_applications')).toBe(0);
        });

        it('fails closed when Cloudflare cannot be asked', async () => {
          fetchSpy.mockRejectedValueOnce(new Error('ETIMEDOUT'));
          expect((await sendApplication({ ...applicant(), turnstileToken: 'token' })).status).toBe(503);
          expect(await count('job_applications')).toBe(0);
        });
      });
    });
  });

  describe('admin vacancies API', () => {
    const body = {
      title: 'Site Engineer',
      type: 'full_time',
      location: 'Ikoyi, Lagos',
      summary: 'Supervise the superstructure on a twelve-storey residential block.',
      closingDate: daysFromToday(14),
      published: true,
    };

    it('refuses anyone without careers:write', async () => {
      const vacancy = await make();
      for (const role of ['viewer', 'investor'] as const) {
        expect((await callRoute(adminVacancies, { headers: as(role) })).status).toBe(403);
        expect((await callRoute(adminVacancies, { method: 'POST', headers: as(role), body })).status).toBe(403);
        expect(
          (await callRoute(adminVacancy, { method: 'PATCH', headers: as(role), query: { vacancyId: vacancy.id }, body: { title: 'X' } }))
            .status,
        ).toBe(403);
        expect((await callRoute(adminReorder, { method: 'POST', headers: as(role), body: { ids: [vacancy.id] } })).status).toBe(403);
      }
      expect((await callRoute(adminVacancies)).status).toBe(401);
    });

    it('lets an editor add and publish a vacancy, audited, which then appears publicly', async () => {
      const invalidate = jest.spyOn(cache, 'invalidatePrefix');
      const response = await callRoute(adminVacancies, { method: 'POST', headers: as('editor'), body });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ slug: 'site-engineer', published: true, isOpen: true, applicationCount: 0 });
      expect(invalidate).toHaveBeenCalledWith('vacancies');

      const audit = await queryOne<{ changes: Record<string, unknown> }>(
        `SELECT changes FROM audit_log WHERE action = 'vacancy.created'`,
      );
      expect(audit!.changes).toMatchObject({ title: 'Site Engineer', published: true });
      expect((await callRoute(publicList)).body.results.map((v: { slug: string }) => v.slug)).toEqual(['site-engineer']);
    });

    it('records publication and closing-date changes, and refuses a taken slug', async () => {
      const vacancy = await make({ published: false });
      await make({ title: 'Taken' });

      const updated = await callRoute(adminVacancy, {
        method: 'PATCH',
        headers: as('editor'),
        query: { vacancyId: vacancy.id },
        body: { published: true, closingDate: daysFromToday(-1) },
      });
      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({ published: true, isOpen: false });
      const audit = await queryOne<{ changes: Record<string, unknown> }>(
        `SELECT changes FROM audit_log WHERE action = 'vacancy.updated'`,
      );
      expect(audit!.changes).toMatchObject({ published: true, closingDate: daysFromToday(-1) });

      const clash = await callRoute(adminVacancy, {
        method: 'PATCH',
        headers: as('editor'),
        query: { vacancyId: vacancy.id },
        body: { slug: 'taken' },
      });
      expect(clash.status).toBe(409);
    });

    it('lets only an admin delete, and never a vacancy with applications', async () => {
      const empty = await make({ title: 'Empty' });
      const applied = await make({ title: 'Applied' });
      await store({ vacancyId: applied.id });

      expect((await callRoute(adminVacancy, { method: 'DELETE', headers: as('editor'), query: { vacancyId: empty.id } })).status).toBe(403);
      const refused = await callRoute(adminVacancy, { method: 'DELETE', headers: as('admin'), query: { vacancyId: applied.id } });
      expect(refused.status).toBe(409);
      expect(await vacancies.findById(applied.id)).not.toBeNull();

      expect((await callRoute(adminVacancy, { method: 'DELETE', headers: as('admin'), query: { vacancyId: empty.id } })).status).toBe(204);
      expect(await vacancies.findById(empty.id)).toBeNull();
      expect((await callRoute(adminVacancy, { method: 'DELETE', headers: as('admin'), query: { vacancyId: MISSING } })).status).toBe(404);
    });

    it('counts applications per vacancy, and reorders only a complete list', async () => {
      const a = await make({ title: 'Alpha' });
      const b = await make({ title: 'Beta' });
      await store({ vacancyId: a.id });
      await store({ vacancyId: a.id, flaggedAsSpam: true });
      const reviewing = await store({ vacancyId: a.id });
      await jobApplications.update(reviewing.id, { status: 'reviewing' });

      const list = await callRoute(adminVacancies, { headers: as('editor') });
      expect(list.body.results[0]).toMatchObject({ title: 'Alpha', applicationCount: 3, newApplicationCount: 1 });

      expect((await callRoute(adminReorder, { method: 'POST', headers: as('editor'), body: { ids: [b.id] } })).status).toBe(422);
      const reordered = await callRoute(adminReorder, { method: 'POST', headers: as('editor'), body: { ids: [b.id, a.id] } });
      expect(reordered.status).toBe(200);
      expect(reordered.body.results.map((v: { title: string }) => v.title)).toEqual(['Beta', 'Alpha']);
    });
  });

  describe('admin applications API', () => {
    it('is closed to editors and everyone else without applications:read', async () => {
      const application = await store();
      for (const role of ['editor', 'viewer', 'investor'] as const) {
        expect((await callRoute(adminApplications, { headers: as(role) })).status).toBe(403);
        expect((await callRoute(adminApplication, { headers: as(role), query: { applicationId: application.id } })).status).toBe(403);
        expect((await callRoute(adminCv, { headers: as(role), query: { applicationId: application.id } })).status).toBe(403);
        expect(
          (await callRoute(adminApplication, { method: 'PATCH', headers: as(role), query: { applicationId: application.id }, body: { status: 'hired' } }))
            .status,
        ).toBe(403);
      }
    });

    it('lists with contact details masked, filtered by vacancy, status and spam', async () => {
      const vacancy = await make();
      await store({ vacancyId: vacancy.id, email: 'first@example.com' });
      const shortlisted = await store({ vacancyId: vacancy.id, email: 'second@example.com' });
      await jobApplications.update(shortlisted.id, { status: 'shortlisted' });
      await store({ email: 'speculative@example.com' });
      await store({ email: 'bot@example.com', flaggedAsSpam: true });

      const all = await callRoute(adminApplications, { headers: as('admin') });
      expect(all.status).toBe(200);
      expect(all.body.pagination.total).toBe(4);
      expect(JSON.stringify(all.body)).not.toContain('first@example.com');
      expect(JSON.stringify(all.body)).not.toContain('0801 234 5678');
      expect(all.body.results[0]).not.toHaveProperty('coverNote');

      const forVacancy = await callRoute(adminApplications, { headers: as('admin'), query: { vacancy: vacancy.id } });
      expect(forVacancy.body.pagination.total).toBe(2);
      const speculative = await callRoute(adminApplications, { headers: as('admin'), query: { vacancy: 'speculative', flaggedAsSpam: 'false' } });
      expect(speculative.body.pagination.total).toBe(1);
      const byStatus = await callRoute(adminApplications, { headers: as('admin'), query: { status: 'shortlisted' } });
      expect(byStatus.body.results.map((r: { id: string }) => r.id)).toEqual([shortlisted.id]);
      const spam = await callRoute(adminApplications, { headers: as('admin'), query: { flaggedAsSpam: 'true' } });
      expect(spam.body.pagination.total).toBe(1);
    });

    it('opens an application in full, and audits the opening without copying the person', async () => {
      const application = await store();
      const response = await callRoute(adminApplication, { headers: as('admin'), query: { applicationId: application.id } });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ email: 'ada@example.com', phone: '0801 234 5678', coverNote: 'A note.' });

      const audit = await queryOne<{ entity_id: string; changes: object }>(
        `SELECT entity_id, changes FROM audit_log WHERE action = 'job_application.viewed'`,
      );
      expect(audit!.entity_id).toBe(application.id);
      expect(JSON.stringify(audit!.changes)).not.toMatch(/ada@example\.com|Ada Obi|0801/);
    });

    it('changes status and notes, audited without the notes’ text', async () => {
      const application = await store();
      const response = await callRoute(adminApplication, {
        method: 'PATCH',
        headers: as('admin'),
        query: { applicationId: application.id },
        body: { status: 'shortlisted', staffNotes: 'Strong on final accounts; call Ada on Monday.' },
      });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status: 'shortlisted', staffNotes: 'Strong on final accounts; call Ada on Monday.' });

      const audit = await queryOne<{ changes: Record<string, unknown> }>(
        `SELECT changes FROM audit_log WHERE action = 'job_application.updated'`,
      );
      expect(audit!.changes).toMatchObject({ status: { from: 'new', to: 'shortlisted' }, staffNotesChanged: true });
      expect(JSON.stringify(audit!.changes)).not.toContain('final accounts');

      expect(
        (await callRoute(adminApplication, { method: 'PATCH', headers: as('admin'), query: { applicationId: application.id }, body: { status: 'archived' } }))
          .status,
      ).toBe(422);
    });

    it('downloads the CV only with a token that carries applications:read', async () => {
      const application = await store();

      expect((await callRoute(adminCv, { query: { applicationId: application.id } })).status).toBe(401);
      expect(
        (await callRoute(adminCv, { headers: { authorization: 'Bearer forged' }, query: { applicationId: application.id } })).status,
      ).toBe(401);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: as('admin'),
        query: { applicationId: application.id },
      });
      await adminCv(req, res);
      expect(res._getStatusCode()).toBe(200);
      const headers = res.getHeaders();
      expect(headers['content-type']).toBe('application/pdf');
      expect(headers['content-disposition']).toMatch(/^attachment; filename="ada\.pdf"/);
      expect(headers['cache-control']).toBe('private, no-store');
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect((res as unknown as { _getBuffer: () => Buffer })._getBuffer().equals(pdfBytes())).toBe(true);

      const audit = await queryOne<{ entity_id: string; changes: object }>(
        `SELECT entity_id, changes FROM audit_log WHERE action = 'job_application.cv_downloaded'`,
      );
      expect(audit).toEqual({ entity_id: application.id, changes: {} });
      expect((await callRoute(adminCv, { headers: as('admin'), query: { applicationId: MISSING } })).status).toBe(404);
    });

    it('lets an admin delete an application, with its CV, audited with masked identifiers', async () => {
      const application = await store();
      const response = await callRoute(adminApplication, { method: 'DELETE', headers: as('admin'), query: { applicationId: application.id } });
      expect(response.status).toBe(204);
      expect(await count('job_applications')).toBe(0);
      expect(await count('job_application_cvs')).toBe(0);

      const audit = await queryOne<{ changes: Record<string, unknown> }>(
        `SELECT changes FROM audit_log WHERE action = 'job_application.deleted'`,
      );
      expect(audit!.changes).toMatchObject({ email: 'a*a@example.com', phone: '*******5678' });
    });
  });

  describe('privacy', () => {
    it('includes applications and their CVs in a subject access export', async () => {
      const vacancy = await make();
      await store({ vacancyId: vacancy.id });
      await store({ email: 'someone@example.com', phone: '+234 801 234 5678' }); // the same phone
      await store({ email: 'else@example.com', phone: null });

      const response = await callRoute(exportRoute, { method: 'POST', headers: as('admin'), body: { email: 'ada@example.com', phone: '08012345678' } });
      expect(response.status).toBe(200);
      expect(response.body.jobApplications).toHaveLength(2);
      const [withVacancy] = response.body.jobApplications.filter((a: { vacancy_title: string | null }) => a.vacancy_title);
      expect(withVacancy).toMatchObject({ vacancy_title: 'Quantity Surveyor', cv_file_name: 'ada.pdf' });
      expect(Buffer.from(withVacancy.cv_base64, 'base64').equals(pdfBytes())).toBe(true);

      const audit = await queryOne<{ changes: Record<string, unknown> }>(
        `SELECT changes FROM audit_log WHERE action = 'data_subject.exported'`,
      );
      expect(audit!.changes.jobApplications).toBe(2);
      expect(JSON.stringify(audit!.changes)).not.toContain('ada@example.com');
    });

    it('erases applications and their CVs, and leaves other people’s alone', async () => {
      await store();
      await store({ email: 'else@example.com', phone: null });

      const response = await callRoute(eraseRoute, { method: 'POST', headers: as('admin'), body: { email: 'ADA@example.com' } });
      expect(response.status).toBe(200);
      expect(response.body.jobApplicationsDeleted).toBe(1);
      expect(await count('job_applications')).toBe(1);
      expect(await count('job_application_cvs')).toBe(1);
      expect(await queryOne(`SELECT email FROM job_applications`)).toEqual({ email: 'else@example.com' });
    });

    it('deletes applications past their retention deadline in the nightly purge, CVs with them', async () => {
      const expired = await store({ email: 'old@example.com' });
      await query(`UPDATE job_applications SET retain_until = NOW() - INTERVAL '1 day' WHERE id = $1`, [expired.id]);
      const current = await store();

      expect(await jobApplications.purgeExpired()).toBe(1);
      expect(await jobApplications.findById(expired.id)).toBeNull();
      expect(await jobApplications.findById(current.id)).not.toBeNull();
      expect(await count('job_application_cvs')).toBe(1);

      // The nightly job runs the same purge.
      await query(`UPDATE job_applications SET retain_until = NOW() - INTERVAL '1 minute'`);
      await runMaintenance('purge-expired-data');
      expect(await count('job_applications')).toBe(0);
      expect(await count('job_application_cvs')).toBe(0);
    });

    it('caps a CV in the database too', async () => {
      const application = await store();
      await expect(
        query(`UPDATE job_application_cvs SET content = $1 WHERE application_id = $2`, [
          Buffer.alloc(MAX_CV_BYTES + 1),
          application.id,
        ]),
      ).rejects.toThrow(/job_application_cvs_size/);
    });
  });

  describe('emails', () => {
    it('tells the applicant what happens to their CV, and the staff only where to find it', () => {
      const confirmation = templates.applicationConfirmation({ name: 'Ada <b>Obi</b>', vacancyTitle: 'Quantity Surveyor' });
      expect(confirmation.subject).toBe('We have received your application: Quantity Surveyor');
      expect(confirmation.text).toMatch(/six months and then delete them/);
      expect(confirmation.html).not.toContain('<b>Obi</b>');

      const notification = templates.applicationNotification({ applicationId: MISSING, name: 'Ada Obi', vacancyTitle: null });
      expect(notification.subject).toBe('Speculative application: new application from Ada Obi');
      expect(notification.text).toContain(`/admin/applications?open=${MISSING}`);
      expect(notification.text).not.toMatch(/@|0801/);
    });
  });
});
