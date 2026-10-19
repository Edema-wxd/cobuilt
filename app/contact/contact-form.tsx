'use client';

import { useState } from 'react';
import { field, fieldLabel, input } from '../../components/sections';
import { btnOutline } from '../../components/ui';

/**
 * The enquiry form — `POST /api/forms/inquiry`.
 *
 * A different endpoint, and a different thing, from the landing page's
 * newsletter form: this one reaches a person. "Contact" in the nav used to
 * point at the newsletter band, which is why this page exists
 * (docs/design-handover.md §3.6).
 *
 * Shaped to `inquiryBody` in src/lib/schemas/forms.ts: name, email, optional
 * phone, optional subject, a message of at least ten characters, an explicit
 * NDPA consent, and the honeypot the server scores. The field rules below are
 * the schema's own minimums, so a submission the API would reject is caught
 * before the round trip.
 */

const SUBJECTS = [
  'New project or development',
  'Partnership or joint venture',
  'Supplier or contractor',
  'A question about a project record',
  'Media enquiry',
  'Careers',
  'Something else',
] as const;

type FormState = 'idle' | 'sending' | 'done' | 'error';

interface ApiResponse {
  message?: string;
  error?: {
    message?: string;
    details?: Array<{ field?: string; message?: string }>;
  };
}

/**
 * A 5xx carries no message a reader can act on — and outside production it
 * carries the driver's own error — so it is replaced here. A 4xx is the
 * reader's to fix, so the field message is shown as the API worded it.
 */
function describeFailure(status: number, payload: ApiResponse | null): string {
  if (status === 429) return 'Too many attempts. Wait a minute, then try again.';
  if (status >= 500) return 'The form is unavailable right now. Try again shortly, or call us.';
  return (
    payload?.error?.details?.[0]?.message ??
    payload?.error?.message ??
    'Those details were not accepted. Check them and try again.'
  );
}

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [body, setBody] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [message, setMessage] = useState('');

  async function send(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setState('sending');
    setMessage('');

    try {
      const response = await fetch('/api/forms/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          subject,
          message: body,
          consent: true,
          website,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok) {
        setState('error');
        setMessage(describeFailure(response.status, payload));
        return;
      }

      setState('done');
      setMessage(
        'Your enquiry is with us. You will get a confirmation email, and a reply from a person within one working day.',
      );
      setName('');
      setEmail('');
      setPhone('');
      setBody('');
    } catch {
      setState('error');
      setMessage('No connection to the server. Check your network and try again.');
    }
  }

  // The success state replaces the form rather than sitting under it: the
  // enquiry is sent, and leaving the filled fields there invites a duplicate.
  if (state === 'done') {
    return (
      <div className="flex flex-col gap-4 border border-zinc-300 bg-white p-5 sm:p-8">
        <p className="text-[0.719rem] font-bold uppercase tracking-[0.16em] text-ink">
          Enquiry received
        </p>
        <p className="text-[0.969rem] leading-[1.75] text-zinc-700" role="status">
          {message}
        </p>
        <p className="text-[0.844rem] leading-[1.7] text-zinc-600">
          If it is urgent, call the office on the number beside this form — Monday to Friday,
          08:00–17:00 WAT.
        </p>
        <button
          className={`${btnOutline} self-start`}
          type="button"
          onClick={() => {
            setState('idle');
            setMessage('');
          }}
        >
          Send another enquiry
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4 border border-zinc-300 bg-white p-5 sm:p-8"
      onSubmit={(event) => {
        void send(event);
      }}
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className={field}>
          <label className={fieldLabel} htmlFor="contact-name">
            Full name
          </label>
          <input
            id="contact-name"
            className={`${input} placeholder:text-zinc-500`}
            type="text"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={255}
            placeholder="Enter your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={field}>
          <label className={fieldLabel} htmlFor="contact-email">
            Email address
          </label>
          <input
            id="contact-email"
            className={`${input} placeholder:text-zinc-500`}
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className={field}>
          <label className={fieldLabel} htmlFor="contact-phone">
            Phone <span className="font-normal normal-case text-zinc-500">(optional)</span>
          </label>
          <input
            id="contact-phone"
            className={`${input} placeholder:text-zinc-500`}
            type="tel"
            name="phone"
            autoComplete="tel"
            placeholder="+234…"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className={field}>
          <label className={fieldLabel} htmlFor="contact-subject">
            What is this about
          </label>
          <select
            id="contact-subject"
            className={`${input} select-chevron cursor-pointer pr-10`}
            name="subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          >
            {SUBJECTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={field}>
        <label className={fieldLabel} htmlFor="contact-message">
          Your enquiry
        </label>
        <textarea
          id="contact-message"
          className={`${input} min-h-40 py-3 placeholder:text-zinc-500`}
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          placeholder="The site, the brief, or the question. Detail helps us route it to the right person."
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <p className="text-[0.719rem] text-zinc-600">
          {body.length < 10
            ? 'At least ten characters.'
            : `${body.length.toLocaleString('en-GB')} of 5,000 characters.`}
        </p>
      </div>

      {/* Honeypot: scored server-side, never shown to a reader. */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <div className="flex items-start gap-2.75 pt-0.5">
        <input
          className="mt-px size-5 flex-none cursor-pointer accent-orange sm:mt-0.5 sm:size-[17px]"
          id="contact-consent"
          type="checkbox"
          required
        />
        <label
          className="text-[0.781rem] leading-[1.6] text-zinc-700 [&_a]:text-rust [&_a]:underline"
          htmlFor="contact-consent"
        >
          I consent to CoBuilt processing my details in line with the{' '}
          <a href="/privacy">Privacy Policy</a> (NDPA), so that someone can reply to this enquiry.
        </label>
      </div>

      {/* Charcoal, not white: white on #FF6600 is 2.94:1. */}
      <button
        className="inline-flex min-h-12.5 w-full cursor-pointer items-center justify-center border border-transparent bg-orange px-7 text-center text-[0.719rem] font-semibold tracking-[0.16em] text-ink uppercase transition-colors duration-150 enabled:hover:bg-orange-lift disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={state === 'sending'}
      >
        {state === 'sending' ? 'Sending…' : 'Send enquiry'}
      </button>

      {message ? (
        <p
          className={`text-center text-[0.719rem] font-medium ${state === 'error' ? 'text-msg-bad' : 'text-msg-ok'}`}
          role="status"
        >
          {message}
        </p>
      ) : (
        <p className="text-center text-[0.719rem] text-zinc-600">
          Protected against automated submissions. We reply within one working day.
        </p>
      )}
    </form>
  );
}
