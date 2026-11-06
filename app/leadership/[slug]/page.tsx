import type { Metadata } from 'next';
import ArticleBody from '../../../components/ArticleBody';
import JsonLd from '../../../components/JsonLd';
import CtaBand from '../../../components/CtaBand';
import PageHero from '../../../components/PageHero';
import SiteLayout from '../../../components/SiteLayout';
import { bodyCopy, sectionLight, titleSm } from '../../../components/sections';
import { btnOutline, container, eyebrow } from '../../../components/ui';
import { canonical } from '@/lib/seo';
import { person } from '@/lib/structuredData';
import { redirectOrNotFound } from '../../redirect-or-not-found';
import { SOCIAL_LABEL, TIER_LABEL } from '../leadership-shared';
import { loadLeader } from '../load-leadership';
import Portrait from '../portrait';

/**
 * Leader profile — `/leadership/[slug]`.
 *
 * The full executive profile behind a card on /leadership and a name in the
 * homepage spotlight: portrait, role, the professional biography,
 * qualifications and areas of expertise. Server-rendered for its own title,
 * description and share image, and a real 404 for an unknown or unpublished
 * leader. With no database it says the profile could not be loaded rather
 * than failing — the posture of the news and project pages.
 */

// Regenerated at most once a minute, like /leadership.
export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadLeader(slug);

  if (result.kind !== 'found') {
    // `absolute` because this is already the full title, so the root layout's
    // template must not append the house name a second time.
    return { title: { absolute: 'Leadership — CoBuilt Investment Partners' } };
  }

  const { leader } = result;
  const description =
    leader.summary ??
    `${leader.fullName}${leader.roleTitle ? `, ${leader.roleTitle}` : ''} — leadership of CoBuilt Investment Partners.`;

  return {
    title: leader.fullName,
    description,
    alternates: canonical(`/leadership/${leader.slug}`),
    openGraph: {
      type: 'profile',
      title: leader.fullName,
      description,
      ...(leader.photoUrl ? { images: [leader.photoUrl] } : {}),
    },
  };
}

const factLabel = 'text-[0.656rem] font-semibold tracking-[0.18em] text-zinc-600 uppercase';
const factItem = 'text-[0.906rem] leading-[1.6] text-zinc-700';

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const result = await loadLeader(slug);

  if (result.kind === 'not-found') return redirectOrNotFound(`/leadership/${slug}`);

  if (result.kind === 'unavailable') {
    return (
      <SiteLayout current="/leadership">
        <main>
          <PageHero
            eyebrow="Leadership"
            title="This profile couldn’t be loaded"
            standfirst="The profile store did not answer. This is on our side, not yours — try again shortly, or return to the leadership page."
            trail={[
              { label: 'Home', href: '/' },
              { label: 'Leadership', href: '/leadership' },
              { label: 'Profile' },
            ]}
          />
          <section className="bg-white py-13 sm:py-18">
            <div className={`${container} flex flex-col items-start gap-5`}>
              <a className={btnOutline} href="/leadership">
                Back to leadership
              </a>
            </div>
          </section>
        </main>
      </SiteLayout>
    );
  }

  const { leader } = result;
  const social = (Object.keys(SOCIAL_LABEL) as Array<keyof typeof SOCIAL_LABEL>)
    .map((network) => ({ network, url: leader.socialLinks[network] }))
    .filter((link): link is { network: keyof typeof SOCIAL_LABEL; url: string } => Boolean(link.url));

  return (
    <SiteLayout current="/leadership">
      <main>
        <JsonLd
          data={person({
            path: `/leadership/${leader.slug}`,
            name: leader.fullName,
            jobTitle: leader.roleTitle,
            description: leader.summary,
            image: leader.photoUrl,
            expertise: leader.expertise,
            qualifications: leader.qualifications,
            sameAs: social.map((link) => link.url),
          })}
        />
        <PageHero
          eyebrow={TIER_LABEL[leader.tier]}
          title={leader.fullName}
          {...(leader.summary ? { standfirst: leader.summary } : {})}
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Leadership', href: '/leadership' },
            { label: leader.fullName },
          ]}
          {...(leader.roleTitle ? { meta: leader.roleTitle } : {})}
        />

        <section className={sectionLight}>
          <div
            className={`${container} grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-16`}
          >
            <aside className="flex flex-col gap-6">
              <Portrait leader={leader} className="aspect-[4/5] w-full max-w-88" />

              {leader.expertise.length > 0 ? (
                <div className="flex flex-col gap-2.5 border-t border-line pt-4">
                  <h2 className={factLabel}>Areas of expertise</h2>
                  <ul className="flex flex-col gap-2">
                    {leader.expertise.map((item) => (
                      <li key={item} className={factItem}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {leader.qualifications.length > 0 ? (
                <div className="flex flex-col gap-2.5 border-t border-line pt-4">
                  <h2 className={factLabel}>Qualifications</h2>
                  <ul className="flex flex-col gap-2">
                    {leader.qualifications.map((item) => (
                      <li key={item} className={factItem}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {social.length > 0 ? (
                <div className="flex flex-col gap-1 border-t border-line pt-4">
                  <h2 className={factLabel}>Elsewhere</h2>
                  <ul className="flex flex-wrap gap-x-5">
                    {social.map(({ network, url }) => (
                      <li key={network}>
                        <a
                          className="inline-flex min-h-target items-center text-[0.906rem] text-rust underline hover:text-rust-hover"
                          href={url}
                          rel="noopener noreferrer me"
                          target="_blank"
                        >
                          {SOCIAL_LABEL[network]}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </aside>

            <div className="flex min-w-0 flex-col gap-7">
              {leader.quote ? (
                <blockquote className="border-l-3 border-orange pl-5 text-[1.1875rem] leading-[1.6] text-ink italic">
                  “{leader.quote}”
                </blockquote>
              ) : null}

              <div className="flex flex-col gap-3">
                <p className={eyebrow}>Professional biography</p>
                <h2 className={titleSm}>
                  {leader.roleTitle ? `${leader.roleTitle}, CoBuilt` : 'Background'}
                </h2>
              </div>

              {/* ArticleBody centres each block on a 760px measure; here they sit left in the column. */}
              <div className="[&>div>*]:mx-0">
                {leader.bio ? (
                  <ArticleBody content={leader.bio} />
                ) : (
                  <p className={bodyCopy}>
                    The full biography is published here once it is approved.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2.5 pt-2 sm:flex-row sm:gap-3">
                <a className={btnOutline} href="/leadership">
                  All leadership
                </a>
                <a className={btnOutline} href="/leadership#philosophy">
                  Leadership philosophy
                </a>
              </div>
            </div>
          </div>
        </section>

        <CtaBand
          eyebrow="Speak to the team"
          title="Bring us a question the record should answer"
          body="Clients, partners, suppliers and journalists all reach the same desk. Tell us which you are and we will route it to the person who can answer."
        />
      </main>
    </SiteLayout>
  );
}
