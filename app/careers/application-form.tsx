'use client';

import { useRef, useState } from 'react';
import { field, fieldLabel, input } from '../../components/sections';
import { btnOutline } from '../../components/ui';
import { formatFileSize } from '../../components/documents';
import { CV_ACCEPT, MAX_CV_BYTES } from '@/lib/careers';
import Turnstile from '../contact/turnstile';

/**
 * The job application form — `POST /api/careers/apply` (docs/decisions.md
 * §2.28). One form for a vacancy (`vacancy` set) and for a speculative
 * application (`vacancy` null).
 *
 * It follows the contact form (app/contact/contact-form.tsx) — labels above
 * fields, 16px text on phones, the NDPA consent, the honeypot, Turnstile when
 * a site key is set, and a success state that replaces the form — and adds
 * what a longer form with a file needs to meet WCAG 2.2 AA:
 *
 * - Every problem is reported at once, in a summary that takes focus and
 *   links to each field, and beside the field itself, tied to it with
 *   `aria-describedby` and marked `aria-invalid` (3.3.1, 3.3.3). The rules
 *   are the API's, so the server's 422 lands in the same places.
 * - Nothing is cleared on an error, the CV included (3.3.7 in spirit).
 * - The upload reports its progress, because a 4 MB CV on a slow phone
 *   connection takes long enough to look stuck, and the outcome is announced
 *   (4.1.3). On success focus moves to the confirmation.
 *
 * It is sent as multipart/form-data with XMLHttpRequest rather than `fetch`,
 * which cannot report upload progress.
 */

type Field = 'name' | 'email' | 'phone' | 'coverNote' | 'cv' | 'consent' | 'turnstileToken';

type Errors = Partial<Record<Field, string>>;

/** The order errors are listed in: the order of the fields on the page. */
const FIELD_ORDER: Field[] = ['name', 'email', 'phone', 'coverNote', 'cv', 'consent', 'turnstileToken'];

const LABELS: Record<Field, string> = {
  name: 'Full name',
  email: 'Email address',
  phone: 'Phone',
  coverNote: 'Cover note',
  cv: 'CV',
  consent: 'Consent',
  turnstileToken: 'Anti-spam check',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9][0-9\s\-()]{5,19}$/;
const MAX_NOTE = 4000;

type State = { step: 'idle' } | { step: 'sending'; fraction: number } | { step: 'done' } | { step: 'failed'; message: string };

interface ApiFailurePayload {
  error?: { message?: string; details?: Array<{ field?: string; message?: string }> };
}

function cvProblem(file: File | null): string | undefined {
  if (!file) return 'Attach your CV, as a PDF or a Word (.docx) document.';
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'pdf' && extension !== 'docx') return 'The CV must be a PDF or a Word (.docx) document.';
  if (file.size === 0) return 'The CV file is empty. Choose the file again.';
  if (file.size > MAX_CV_BYTES) return `The CV must be ${MAX_CV_BYTES / 1024 / 1024} MB or smaller. This one is ${formatFileSize(file.size)}.`;
  return undefined;
}

/**
 * A 5xx carries no message a reader can act on, so it is replaced; a 4xx
 * without a field (a closed vacancy, a refused check) is shown as worded.
 */
function describeFailure(status: number, payload: ApiFailurePayload | null): string {
  if (status === 0) return 'No connection to the server. Check your network and send again; nothing has been lost.';
  if (status === 429) return 'Too many applications from this connection. Wait an hour, then try again, or email us.';
  if (status === 413) return payload?.error?.message ?? 'The CV is too large. Attach one of 4 MB or less.';
  if (status >= 500) return 'Applications cannot be received right now. Try again shortly, or email your CV to us.';
  return payload?.error?.message ?? 'The application was not accepted. Check it and send again.';
}

function send(
  body: FormData,
  onProgress: (fraction: number) => void,
): Promise<{ status: number; payload: ApiFailurePayload | null }> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/careers/apply');
    request.responseType = 'text';
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      let payload: ApiFailurePayload | null = null;
      try {
        payload = JSON.parse(request.responseText) as ApiFailurePayload;
      } catch {
        payload = null;
      }
      resolve({ status: request.status, payload });
    };
    request.onerror = () => resolve({ status: 0, payload: null });
    request.ontimeout = () => resolve({ status: 0, payload: null });
    request.send(body);
  });
}

export default function ApplicationForm({
  vacancy,
  turnstileSiteKey,
  idPrefix = 'apply',
}: {
  /** The vacancy applied for; null for a speculative application. */
  vacancy: { id: string; title: string } | null;
  /** Cloudflare Turnstile's public key; null leaves the CAPTCHA out. */
  turnstileSiteKey: string | null;
  idPrefix?: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [coverNote, setCoverNote] = useState('');
  const [cv, setCv] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<State>({ step: 'idle' });
  const summary = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLHeadingElement>(null);

  const id = (part: string) => `${idPrefix}-${part}`;
  const sending = state.step === 'sending';

  function validate(): Errors {
    const found: Errors = {};
    if (name.trim().length < 2) found.name = 'Enter your full name.';
    if (!email.trim()) found.email = 'Enter your email address.';
    else if (!EMAIL.test(email.trim())) found.email = 'Enter an email address in the form name@example.com.';
    if (phone.trim() && !PHONE.test(phone.trim())) {
      found.phone = 'Enter a phone number using digits, spaces, brackets or hyphens, like +234 801 234 5678.';
    }
    if (coverNote.length > MAX_NOTE) found.coverNote = 'Keep the note to 4,000 characters.';
    const cvError = cvProblem(cv);
    if (cvError) found.cv = cvError;
    if (!consent) found.consent = 'Tick the box to consent, so that we can consider your application.';
    if (turnstileSiteKey && !token) found.turnstileToken = 'Wait for the anti-spam check to finish, then send again.';
    return found;
  }

  /** Shows the errors and moves focus to their summary, so a screen reader hears them all. */
  function report(found: Errors): void {
    setErrors(found);
    setState({ step: 'idle' });
    // After the summary renders.
    requestAnimationFrame(() => summary.current?.focus());
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (sending) return;

    const found = validate();
    if (Object.keys(found).length > 0) {
      report(found);
      return;
    }

    setErrors({});
    setState({ step: 'sending', fraction: 0 });

    const body = new FormData();
    if (vacancy) body.set('vacancyId', vacancy.id);
    body.set('name', name.trim());
    body.set('email', email.trim());
    if (phone.trim()) body.set('phone', phone.trim());
    if (coverNote.trim()) body.set('coverNote', coverNote.trim());
    body.set('consent', 'true');
    body.set('website', website);
    if (token) body.set('turnstileToken', token);
    body.set('cv', cv!, cv!.name);

    const { status, payload } = await send(body, (fraction) => setState({ step: 'sending', fraction }));
    // A token is good for one submission; whatever the outcome, get a fresh one.
    if (turnstileSiteKey) setTurnstileReset((n) => n + 1);

    if (status === 201) {
      setState({ step: 'done' });
      requestAnimationFrame(() => done.current?.focus());
      return;
    }

    // Field problems go beside their fields, as the browser's own check would put them.
    const fieldErrors: Errors = {};
    for (const detail of payload?.error?.details ?? []) {
      const key = detail.field as Field | undefined;
      if (key && FIELD_ORDER.includes(key) && detail.message && !fieldErrors[key]) {
        fieldErrors[key] = detail.message.endsWith('.') ? detail.message : `${detail.message}.`;
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      report(fieldErrors);
      return;
    }

    setState({ step: 'failed', message: describeFailure(status, payload) });
    requestAnimationFrame(() => summary.current?.focus());
  }

  if (state.step === 'done') {
    return (
      <div className="flex flex-col gap-4 border border-zinc-300 bg-white p-5 sm:p-8">
        <h3
          ref={done}
          tabIndex={-1}
          className="text-[0.719rem] font-bold tracking-[0.16em] text-ink uppercase outline-none"
        >
          Application received
        </h3>
        <p className="text-[0.969rem] leading-[1.75] text-zinc-700" role="status">
          {vacancy
            ? `Thank you. Your application for ${vacancy.title} is with our hiring team.`
            : 'Thank you. Your speculative application is with our hiring team.'}{' '}
          A confirmation is on its way to {email.trim()}. We read every application and reply either way.
        </p>
        <p className="text-[0.844rem] leading-[1.7] text-zinc-600 [&_a]:text-rust [&_a]:underline">
          We keep your application and CV for six months, then delete them. The{' '}
          <a href="/privacy">Privacy Policy</a> explains how to see, correct or delete them sooner.
        </p>
        {vacancy ? (
          <a className={`${btnOutline} self-start`} href="/careers">
            See other vacancies
          </a>
        ) : null}
      </div>
    );
  }

  const errorList = FIELD_ORDER.filter((key) => errors[key]);
  const describedBy = (key: Field, ...others: string[]) =>
    [...others, errors[key] ? id(`${key}-error`) : null].filter(Boolean).join(' ') || undefined;
  const invalid = (key: Field) => (errors[key] ? true : undefined);
  const errorText = (key: Field) =>
    errors[key] ? (
      <p id={id(`${key}-error`)} className="text-[0.781rem] leading-[1.5] font-medium text-msg-bad">
        <span className="sr-only">Error: </span>
        {errors[key]}
      </p>
    ) : null;
  const invalidRing = 'aria-invalid:border-2 aria-invalid:border-msg-bad';

  return (
    <form
      className="flex flex-col gap-5 border border-zinc-300 bg-white p-5 sm:p-8"
      noValidate
      aria-labelledby={id('title')}
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <h3 id={id('title')} className="text-[0.781rem] font-semibold tracking-[0.16em] text-ink uppercase">
        {vacancy ? `Apply for ${vacancy.title}` : 'Send a speculative application'}
      </h3>
      <p className="-mt-2 text-[0.844rem] leading-[1.7] text-zinc-600">
        Every field is required unless it says optional.
      </p>

      {errorList.length > 0 || state.step === 'failed' ? (
        <div
          ref={summary}
          tabIndex={-1}
          className="flex flex-col gap-2 border-l-3 border-msg-bad bg-zinc-50 px-4 py-3.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          role="alert"
          aria-labelledby={id('problem')}
        >
          <p id={id('problem')} className="text-[0.844rem] font-semibold text-msg-bad">
            {state.step === 'failed'
              ? 'Your application was not sent'
              : errorList.length === 1
                ? 'There is a problem with your application'
                : `There are ${errorList.length} problems with your application`}
          </p>
          {state.step === 'failed' ? (
            <p className="text-[0.844rem] leading-[1.6] text-zinc-700">{state.message}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {errorList.map((key) => (
                <li key={key}>
                  <a
                    className="text-[0.844rem] leading-[1.6] text-msg-bad underline underline-offset-2"
                    href={`#${id(key === 'turnstileToken' ? 'turnstile' : key)}`}
                    onClick={(event) => {
                      // Focus the field itself, not just scroll to it.
                      const target = document.getElementById(id(key === 'turnstileToken' ? 'turnstile' : key));
                      if (target) {
                        event.preventDefault();
                        target.focus();
                      }
                    }}
                  >
                    {LABELS[key]}: {errors[key]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={field}>
          <label className={fieldLabel} htmlFor={id('name')}>
            Full name
          </label>
          <input
            id={id('name')}
            className={`${input} ${invalidRing}`}
            type="text"
            name="name"
            autoComplete="name"
            maxLength={255}
            required
            aria-invalid={invalid('name')}
            aria-describedby={describedBy('name')}
            value={name}
            disabled={sending}
            onChange={(event) => setName(event.target.value)}
          />
          {errorText('name')}
        </div>
        <div className={field}>
          <label className={fieldLabel} htmlFor={id('email')}>
            Email address
          </label>
          <input
            id={id('email')}
            className={`${input} ${invalidRing}`}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            maxLength={255}
            required
            aria-invalid={invalid('email')}
            aria-describedby={describedBy('email')}
            value={email}
            disabled={sending}
            onChange={(event) => setEmail(event.target.value)}
          />
          {errorText('email')}
        </div>
      </div>

      <div className={`${field} sm:max-w-[calc(50%-0.5rem)]`}>
        <label className={fieldLabel} htmlFor={id('phone')}>
          Phone <span className="font-normal tracking-normal normal-case text-zinc-600">(optional)</span>
        </label>
        <input
          id={id('phone')}
          className={`${input} ${invalidRing}`}
          type="tel"
          name="phone"
          autoComplete="tel"
          maxLength={20}
          aria-invalid={invalid('phone')}
          aria-describedby={describedBy('phone')}
          value={phone}
          disabled={sending}
          onChange={(event) => setPhone(event.target.value)}
        />
        {errorText('phone')}
      </div>

      <div className={field}>
        <label className={fieldLabel} htmlFor={id('coverNote')}>
          Cover note <span className="font-normal tracking-normal normal-case text-zinc-600">(optional)</span>
        </label>
        <p id={id('coverNote-hint')} className="text-[0.781rem] leading-[1.6] text-zinc-600">
          {vacancy
            ? 'Why this role, and a project you delivered and what you would do differently next time.'
            : 'The discipline you work in, and a project you delivered and what you would do differently next time.'}
        </p>
        <textarea
          id={id('coverNote')}
          className={`${input} min-h-36 py-3 ${invalidRing}`}
          name="coverNote"
          rows={6}
          aria-invalid={invalid('coverNote')}
          aria-describedby={describedBy('coverNote', id('coverNote-hint'), id('coverNote-count'))}
          value={coverNote}
          disabled={sending}
          onChange={(event) => setCoverNote(event.target.value)}
        />
        <p id={id('coverNote-count')} className="text-[0.719rem] text-zinc-600">
          {coverNote.length.toLocaleString('en-GB')} of 4,000 characters
        </p>
        {errorText('coverNote')}
      </div>

      <div className={field}>
        <label className={fieldLabel} htmlFor={id('cv')}>
          CV
        </label>
        <p id={id('cv-hint')} className="text-[0.781rem] leading-[1.6] text-zinc-600">
          A PDF or Word (.docx) document, up to 4 MB.
        </p>
        <input
          id={id('cv')}
          className={`min-h-target w-full max-w-full text-[0.875rem] text-ink file:mr-3 file:min-h-target file:cursor-pointer file:border file:border-zinc-400 file:bg-white file:px-4 file:text-[0.688rem] file:font-semibold file:tracking-[0.14em] file:text-ink file:uppercase hover:file:border-ink ${
            errors.cv ? 'outline-2 outline-offset-2 outline-msg-bad' : ''
          }`}
          type="file"
          name="cv"
          accept={CV_ACCEPT}
          required
          aria-invalid={invalid('cv')}
          aria-describedby={describedBy('cv', id('cv-hint'), cv ? id('cv-chosen') : '')}
          disabled={sending}
          onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null;
            setCv(chosen);
            // A newly chosen file is judged afresh, so an old error does not linger.
            setErrors((current) => {
              const next = { ...current };
              const problem = chosen ? cvProblem(chosen) : undefined;
              if (problem) next.cv = problem;
              else delete next.cv;
              return next;
            });
          }}
        />
        {cv ? (
          <p id={id('cv-chosen')} className="font-mono text-[0.75rem] tracking-[0.04em] break-all text-zinc-600">
            {cv.name} · {formatFileSize(cv.size) ?? '0 KB'}
          </p>
        ) : null}
        {errorText('cv')}
      </div>

      {/* Honeypot: scored server-side, never shown to a reader. */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={id('website')}>Website</label>
        <input
          id={id('website')}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2.75">
          <input
            className="mt-px size-5 flex-none cursor-pointer accent-orange sm:mt-0.5 sm:size-[17px]"
            id={id('consent')}
            type="checkbox"
            required
            aria-invalid={invalid('consent')}
            aria-describedby={describedBy('consent')}
            checked={consent}
            disabled={sending}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <label
            className="text-[0.781rem] leading-[1.6] text-zinc-700 [&_a]:text-rust [&_a]:underline"
            htmlFor={id('consent')}
          >
            I consent to CoBuilt processing my application and CV to consider me for{' '}
            {vacancy ? 'this role' : 'roles at CoBuilt'}, and keeping them for six months, in line with the{' '}
            <a href="/privacy">Privacy Policy</a> (NDPA).
          </label>
        </div>
        {errorText('consent')}
      </div>

      {turnstileSiteKey ? (
        <div id={id('turnstile')} tabIndex={-1} className="flex flex-col gap-1.5 outline-none">
          <Turnstile
            siteKey={turnstileSiteKey}
            action="careers"
            resetKey={turnstileReset}
            onToken={(next) => {
              setToken(next);
              if (next) {
                setErrors((current) => {
                  const rest = { ...current };
                  delete rest.turnstileToken;
                  return rest;
                });
              }
            }}
          />
          {errorText('turnstileToken')}
        </div>
      ) : null}

      {/* Charcoal, not white: white on #FF6600 is 2.94:1. */}
      <button
        className="inline-flex min-h-12.5 w-full cursor-pointer items-center justify-center border border-transparent bg-orange px-7 text-center text-[0.719rem] font-semibold tracking-[0.16em] text-ink uppercase transition-colors duration-150 enabled:hover:bg-orange-lift disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={sending}
      >
        {sending ? 'Sending…' : 'Send application'}
      </button>

      {/* Announced once when sending starts; the percentage beside it is not, or it would be read out at every step. */}
      <p className="sr-only" role="status">
        {sending ? 'Sending your application. On a slow connection this can take a minute.' : ''}
      </p>
      <div className="flex flex-col gap-2">
        {state.step === 'sending' ? (
          <>
            <p className="text-center text-[0.719rem] font-medium text-zinc-700" aria-hidden="true">
              {state.fraction < 1
                ? `Uploading your CV: ${Math.round(state.fraction * 100)}%`
                : 'Uploaded. Saving your application…'}
            </p>
            <progress
              className="h-1.5 w-full appearance-none overflow-hidden bg-line [&::-moz-progress-bar]:bg-orange [&::-webkit-progress-bar]:bg-line [&::-webkit-progress-value]:bg-orange"
              max={1}
              value={state.fraction}
              aria-label="Upload progress"
            />
          </>
        ) : (
          <p className="text-center text-[0.719rem] text-zinc-600">
            Protected against automated submissions. Your CV is seen only by our hiring team.
          </p>
        )}
      </div>
    </form>
  );
}
