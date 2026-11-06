import type { Metadata } from 'next';
import { canonical } from '@/lib/seo';
import CtaBand from '../../components/CtaBand';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import { fileFacts } from '../../components/documents';
import {
  bodyCopy,
  cardBody,
  cardTitle,
  sectionHead,
  sectionLight,
  sectionMuted,
  titleMd,
  uppercaseLink,
} from '../../components/sections';
import { btnOutline, container, eyebrow } from '../../components/ui';
import type { DocumentCategory } from '@/lib/documentCategories';
import { loadResources, type PublicDocument } from './load-resources';

/**
 * Resources — `/resources`.
 *
 * The client's Resources section in one page: the download centre (company
 * profile, capability statement, brochures, project profiles and anything
 * else published at `/admin/downloads`), the way to the FAQs, and the
 * policies — the site's four legal pages, plus any policy published as a
 * document. The footer's "Downloads" entry is this page.
 *
 * Every download link goes through `/api/documents/[id]/download`, which
 * counts the download and redirects to the file (docs/decisions.md §2.25).
 * Each file says its type and size before it is fetched.
 *
 * Read on the server and regenerated at most once a minute, like the landing
 * page; with no database the download centre renders empty and says so.
 */

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Resources and downloads',
  description:
    'Download the CoBuilt Investment Partners company profile, capability statement, brochures and project profiles, read the FAQs, and find our policies.',
  alternates: canonical('/resources'),
};

/** The download centre's groups, in the order the page shows them. Policies have their own section. */
const GROUPS: Array<{ category: Exclude<DocumentCategory, 'policy'>; title: string; id: string }> = [
  { category: 'company_profile', title: 'Company profile', id: 'company-profile' },
  { category: 'capability_statement', title: 'Capability statement', id: 'capability-statement' },
  { category: 'brochure', title: 'Brochures', id: 'brochures' },
  { category: 'project_profile', title: 'Project profiles', id: 'project-profiles' },
  { category: 'other', title: 'Other documents', id: 'other-documents' },
];

const POLICIES: Array<{ title: string; href: string; body: string }> = [
  {
    title: 'Privacy Policy',
    href: '/privacy',
    body: 'What we collect, why, how long we keep it, and your rights under the Nigeria Data Protection Act.',
  },
  {
    title: 'Terms & Conditions',
    href: '/terms',
    body: 'The terms on which this website and its content are offered, including the regulatory position on investment.',
  },
  {
    title: 'Cookie Policy',
    href: '/cookies',
    body: 'The cookies the site sets, what each category does, and how to change your choice.',
  },
  {
    title: 'Accessibility Statement',
    href: '/accessibility',
    body: 'The standard the site is built to, WCAG 2.2 AA, what is known not to meet it, and how to tell us.',
  },
];

export default async function Resources() {
  const { documents, available } = await loadResources();
  const groups = GROUPS.map((group) => ({
    ...group,
    documents: documents.filter((document) => document.category === group.category),
  })).filter((group) => group.documents.length > 0);
  const policyDocuments = documents.filter((document) => document.category === 'policy');

  return (
    // Not a header item: naming the page keeps the header from marking Home as current.
    <SiteLayout current="/resources">
      <main>
        <PageHero
          eyebrow="Resources"
          title={
            <>
              Documents, answers and <em>policies</em>.
            </>
          }
          standfirst="The company profile, capability statement, brochures and project profiles to download, the questions we are asked most, and the policies the site runs under."
          trail={[{ label: 'Home', href: '/' }, { label: 'Resources' }]}
        />

        <section className={sectionLight} id="downloads" aria-labelledby="downloads-title">
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-10`}>
              <p className={eyebrow}>Download centre</p>
              <h2 className={titleMd} id="downloads-title">
                Take the detail with you
              </h2>
              <p className={bodyCopy}>
                Each file says its type and size before you open it. Project profiles are also on
                each project&rsquo;s own page.
              </p>
            </div>

            {groups.length > 1 ? (
              <nav className="reveal mb-8 sm:mb-10" aria-label="Download categories">
                <ul className="flex flex-wrap gap-x-6 gap-y-1">
                  {groups.map((group) => (
                    <li key={group.id}>
                      <a
                        className={`${uppercaseLink} inline-flex min-h-target items-center text-[0.719rem]`}
                        href={`#${group.id}`}
                      >
                        {group.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            {groups.length === 0 ? (
              <div className="reveal flex max-w-165 flex-col gap-4 border border-zinc-300 bg-zinc-50 p-6 sm:p-8">
                <p className={cardTitle}>
                  {available ? 'Documents are being prepared' : 'The download centre could not be loaded'}
                </p>
                <p className={cardBody}>
                  {available
                    ? 'Nothing is published for download yet. Ask for the company profile or a project profile and we will send it.'
                    : 'Try again in a minute, or ask for the document you need and we will send it.'}
                </p>
                <a className={`${btnOutline} self-start`} href="/contact">
                  Ask for a document
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-10 sm:gap-12">
                {groups.map((group) => (
                  <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="scroll-mt-24">
                    <h3
                      className="border-b border-ink pb-3 text-[0.781rem] font-semibold tracking-[0.16em] text-ink uppercase"
                      id={`${group.id}-title`}
                    >
                      {group.title}
                    </h3>
                    <DocumentList documents={group.documents} />
                  </section>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={sectionMuted} id="faqs" aria-labelledby="faqs-title">
          <div
            className={`${container} grid grid-cols-1 items-end gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:gap-14`}
          >
            <div className={`${sectionHead} max-w-165`}>
              <p className={eyebrow}>Frequently asked questions</p>
              <h2 className={titleMd} id="faqs-title">
                Answers, before you ask
              </h2>
              <p className={bodyCopy}>
                How Project Passport™ works, what happens to your details, and the regulatory
                position on investment — answered plainly, grouped by topic.
              </p>
            </div>
            <a className={`${btnOutline} reveal self-start md:self-end`} href="/faqs">
              Read the FAQs
            </a>
          </div>
        </section>

        <section className={sectionLight} id="policies" aria-labelledby="policies-title">
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-10`}>
              <p className={eyebrow}>Policies</p>
              <h2 className={titleMd} id="policies-title">
                The rules the site runs under
              </h2>
            </div>

            <ul className="reveal grid grid-cols-1 border-t border-l border-zinc-300 sm:grid-cols-2 lg:grid-cols-4">
              {POLICIES.map((policy) => (
                <li key={policy.href} className="flex flex-col gap-3 border-r border-b border-zinc-300 bg-white p-6 sm:p-7.5">
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>{policy.title}</h3>
                  <p className={cardBody}>{policy.body}</p>
                  <a
                    className={`${uppercaseLink} mt-auto inline-flex min-h-target items-center self-start pt-2 text-[0.719rem]`}
                    href={policy.href}
                  >
                    Read it<span className="sr-only"> — {policy.title}</span> →
                  </a>
                </li>
              ))}
            </ul>

            {policyDocuments.length > 0 ? (
              <div className="mt-10 sm:mt-12">
                <h3 className="border-b border-ink pb-3 text-[0.781rem] font-semibold tracking-[0.16em] text-ink uppercase">
                  Policy documents
                </h3>
                <DocumentList documents={policyDocuments} />
              </div>
            ) : null}
          </div>
        </section>

        <CtaBand
          eyebrow="Something not here?"
          title="Ask for the document you need"
          body="Certificates, a project's approvals, a fuller pack for a partner: tell us what you need it for and we will send it, or say why we cannot."
        />
      </main>
    </SiteLayout>
  );
}

/** The file list: type, title, what it is, size, and the counted download link. */
function DocumentList({ documents }: { documents: PublicDocument[] }) {
  return (
    <ul className="reveal-stagger flex flex-col">
      {documents.map((document) => {
        const facts = fileFacts(document.fileType, document.fileSizeBytes);
        return (
          <li
            key={document.id}
            className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4 gap-y-3 border-b border-line py-5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-6"
          >
            <span
              className="flex h-13 items-center justify-center border border-zinc-300 font-mono text-[0.719rem] tracking-[0.06em] text-zinc-700 uppercase sm:h-14"
              aria-hidden="true"
            >
              {document.fileType ? document.fileType.slice(0, 4) : '↗'}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h4 className="text-[1rem] leading-[1.45] font-semibold break-words text-ink">{document.title}</h4>
              {document.description ? <p className={cardBody}>{document.description}</p> : null}
              <p className="font-mono text-[0.75rem] tracking-[0.04em] text-zinc-600">
                {facts}
                {document.project ? (
                  <>
                    {' · '}
                    <a
                      className="text-rust underline underline-offset-2 hover:text-rust-hover"
                      href={`/projects/${document.project.slug}`}
                    >
                      {document.project.title}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
            <a
              className={`${btnOutline} col-span-2 sm:col-span-1`}
              href={document.downloadUrl}
              rel="nofollow"
            >
              Download<span className="sr-only">: {document.title} ({facts})</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
