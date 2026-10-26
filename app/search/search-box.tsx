'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The search field with its suggestions dropdown — `/api/search/autocomplete`.
 *
 * The ARIA 1.2 combobox pattern: focus stays in the field, the arrow keys move
 * a highlighted suggestion that `aria-activedescendant` announces, Enter on a
 * highlighted suggestion goes straight to it, and Enter on none submits the
 * search as typed. Escape closes the list; a second Escape is the field's own
 * (a search input clears itself).
 *
 * Suggestions are an aid, never a gate: a slow, failed or empty lookup just
 * shows no list, and the form submits exactly as it did without one.
 */

type SuggestionType = 'project' | 'news' | 'faq';

interface Suggestion {
  id: string;
  type: SuggestionType;
  title: string;
  url: string;
}

const TYPE_LABEL: Record<SuggestionType, string> = { project: 'Project', news: 'Media', faq: 'FAQ' };

/** The API's own minimum; below it the request would only be rejected. */
const MIN_CHARS = 2;
/** Long enough that a word typed at speed is one request, short enough to feel immediate. */
const DEBOUNCE_MS = 180;
const LIMIT = 6;

/** Only this site's own pages: a suggestion URL is followed without a click on a real link. */
function isLocalPath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

/** The title with the typed text emphasised, case-insensitively, at its first match. */
function Highlighted({ title, term }: { title: string; term: string }) {
  const at = title.toLowerCase().indexOf(term.toLowerCase());
  if (!term || at === -1) return <>{title}</>;
  return (
    <>
      {title.slice(0, at)}
      <mark className="bg-transparent font-semibold text-inherit">
        {title.slice(at, at + term.length)}
      </mark>
      {title.slice(at + term.length)}
    </>
  );
}

interface SearchBoxProps {
  id: string;
  className: string;
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBox({ id, className, value, onChange }: SearchBoxProps) {
  const router = useRouter();
  const listId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Set when the value changed because of typing, so a value set from outside
  // — the URL changing, a suggestion being chosen — does not pop the list open.
  const typed = useRef(false);

  const term = value.trim();

  useEffect(() => {
    if (!typed.current || term.length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: term, limit: String(LIMIT) });
      fetch(`/api/search/autocomplete?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(String(response.status));
          return (await response.json()) as { results: Suggestion[] };
        })
        .then((payload) => {
          const usable = payload.results.filter((item) => isLocalPath(item.url));
          setSuggestions(usable);
          setActive(-1);
          setOpen(usable.length > 0);
        })
        .catch(() => {
          // Aborted by the next keystroke, or the lookup failed: either way
          // there is nothing to suggest, and the search itself still works.
          if (!controller.signal.aborted) setOpen(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  function choose(suggestion: Suggestion): void {
    typed.current = false;
    setOpen(false);
    router.push(suggestion.url);
  }

  const showing = open && suggestions.length > 0;
  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <div className="relative w-full">
      <input
        id={id}
        className={className}
        type="search"
        name="q"
        placeholder="Project, article or question"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showing}
        aria-controls={listId}
        {...(showing && active >= 0 ? { 'aria-activedescendant': optionId(active) } : {})}
        value={value}
        maxLength={200}
        onChange={(event) => {
          typed.current = true;
          onChange(event.target.value);
        }}
        onFocus={() => {
          if (suggestions.length > 0 && typed.current) setOpen(true);
        }}
        // A click on a suggestion lands before this (it prevents mouse-down
        // blur), so closing here only ever covers tabbing or clicking away.
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!showing) {
              if (suggestions.length > 0) setOpen(true);
              return;
            }
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            // Wraps through "none highlighted", so the typed text is reachable again.
            setActive((current) => {
              const next = current + step;
              if (next >= suggestions.length) return -1;
              if (next < -1) return suggestions.length - 1;
              return next;
            });
          } else if (event.key === 'Enter' && showing && active >= 0) {
            event.preventDefault();
            choose(suggestions[active]!);
          } else if (event.key === 'Enter') {
            // The form submits the typed search; the list has done its job.
            typed.current = false;
            setOpen(false);
          } else if (event.key === 'Escape' && showing) {
            event.preventDefault();
            setOpen(false);
            setActive(-1);
          }
        }}
      />

      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        className={`absolute inset-x-0 top-full z-20 -mt-px flex-col border border-ink bg-white shadow-[0_12px_24px_-12px_rgb(20_20_20/0.35)] ${
          showing ? 'flex' : 'hidden'
        }`}
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={`${suggestion.type}-${suggestion.id}`}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            className={`flex min-h-12 cursor-pointer items-center gap-3 border-t border-line px-3.5 py-2 first:border-t-0 ${
              index === active ? 'bg-zinc-100' : 'hover:bg-zinc-50'
            }`}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActive(index)}
            onClick={() => choose(suggestion)}
          >
            <span className="w-14 flex-none text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-rust">
              {TYPE_LABEL[suggestion.type] ?? 'Page'}
            </span>
            <span className="min-w-0 truncate text-[0.938rem] text-ink">
              <Highlighted title={suggestion.title} term={term} />
            </span>
          </li>
        ))}
      </ul>

      <p className="sr-only" role="status" aria-live="polite">
        {showing
          ? `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}. Use the arrow keys to choose one.`
          : ''}
      </p>
    </div>
  );
}
