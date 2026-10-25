'use client';

import { useEffect, useState } from 'react';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import CtaBand from '../../components/CtaBand';
import { bodyCopy, titleMd } from '../../components/sections';
import { btnOrange, btnOutline, container, eyebrow } from '../../components/ui';

/**
 * FAQs — `/faqs`.
 *
 * Read from the API in the browser, like the other list pages, so a checkout
 * without a database still renders and says plainly that the list could not be
 * loaded. Each entry is a native `<details>`, which needs no script to open and
 * is keyboard-operable by default; a `#id` fragment from search opens and
 * scrolls to its entry.
 */

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

/** `investment` reads as a database value; this is the same thing in English. */
function categoryLabel(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

export default function FaqList() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [openId, setOpenId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetch('/api/faqs', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as { results: Faq[] };
      })
      .then((payload) => {
        setFaqs(payload.results);
        setState('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState('error');
      });
    return () => controller.abort();
  }, [attempt]);

  // Open and scroll to the entry a `#id` fragment names, once the list exists.
  useEffect(() => {
    if (state !== 'ready') return;
    const id = window.location.hash.slice(1);
    if (!id || !faqs.some((faq) => faq.id === id)) return;
    setOpenId(id);
    document.getElementById(id)?.scrollIntoView();
  }, [state, faqs]);

  const groups = new Map<string, Faq[]>();
  for (const faq of faqs) {
    const name = faq.category ? categoryLabel(faq.category) : 'General';
    groups.set(name, [...(groups.get(name) ?? []), faq]);
  }

  return (
    <SiteLayout>
      <main>
        <PageHero
          eyebrow="FAQs"
          title={
            <>
              Questions we are asked, <em>answered plainly</em>.
            </>
          }
          standfirst="How the Project Passport™ works, how your data is handled, and where CoBuilt stands on investment."
          actions={
            <a className={btnOrange} href="/search?type=faq">
              Search the FAQs
            </a>
          }
        />

        <section className="bg-white py-11 sm:py-14 md:py-18">
          <div className={`${container} flex flex-col gap-11`}>
            {state === 'loading' ? (
              <div className="flex flex-col gap-px border border-line bg-line" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="bg-white p-5.5">
                    <div className="h-4.5 w-3/5 bg-line" />
                  </div>
                ))}
              </div>
            ) : null}

            {state === 'error' ? (
              <div className="flex flex-col items-start gap-4 border border-line bg-zinc-50 p-7 sm:p-10">
                <p className={eyebrow}>Not loaded</p>
                <h2 className={titleMd}>The questions couldn&rsquo;t be loaded</h2>
                <p className={`${bodyCopy} max-w-150`}>
                  This is on our side, not yours. Try again in a moment, or ask us directly.
                </p>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
                  <button
                    type="button"
                    className={btnOrange}
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    Try again
                  </button>
                  <a className={btnOutline} href="/contact">
                    Contact us
                  </a>
                </div>
              </div>
            ) : null}

            {state === 'ready' && faqs.length === 0 ? (
              <div className="flex flex-col items-start gap-4 border border-line bg-zinc-50 p-7 sm:p-10">
                <p className={eyebrow}>Nothing here</p>
                <h2 className={titleMd}>No questions published yet</h2>
                <p className={`${bodyCopy} max-w-150`}>
                  Answers will appear here as they are published. In the meantime, the contact page
                  reaches a person.
                </p>
                <a className={btnOutline} href="/contact">
                  Contact us
                </a>
              </div>
            ) : null}

            {state === 'ready'
              ? [...groups.entries()].map(([name, items]) => (
                  <div key={name} className="flex flex-col gap-4">
                    <h2 className={eyebrow}>{name}</h2>
                    <div className="flex flex-col gap-px border border-line bg-line">
                      {items.map((faq) => (
                        <details
                          key={faq.id}
                          id={faq.id}
                          className="group scroll-mt-24 bg-white"
                          open={openId === faq.id || undefined}
                        >
                          <summary className="flex min-h-target cursor-pointer list-none items-center justify-between gap-4 p-5.5 text-[1.0625rem] leading-[1.4] text-ink hover:text-rust [&::-webkit-details-marker]:hidden">
                            {faq.question}
                            <span
                              className="flex-none text-[1.25rem] leading-none transition-transform group-open:rotate-45"
                              aria-hidden="true"
                            >
                              +
                            </span>
                          </summary>
                          <p className="max-w-170 px-5.5 pb-6 text-[0.969rem] leading-[1.75] text-zinc-700">
                            {faq.answer}
                          </p>
                        </details>
                      ))}
                    </div>
                  </div>
                ))
              : null}
          </div>
        </section>

        <CtaBand
          eyebrow="Still asking"
          title="Cannot find your question?"
          body="Send it through the enquiry form. It is read by a person and answered within one working day."
        />
      </main>
    </SiteLayout>
  );
}
