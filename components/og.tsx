import { ImageResponse } from 'next/og';

/**
 * Social preview cards — the image a link shows when it is shared.
 *
 * Every page gets one: the root `app/opengraph-image.tsx` covers the site, and
 * project, Passport™, article and service pages draw their own with the item's
 * title. Where an item has photography of its own — a featured image, or an
 * editor-set Open Graph image — the page's metadata names that instead, and
 * Next.js leaves the generated card out (an `openGraph.images` set at the same
 * level wins over the file). See docs/decisions.md §2.18.
 *
 * Drawn with the renderer's built-in sans rather than Geist: fetching a font
 * at build time would break the offline build the root layout protects.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

const INK = '#1c1c1c';
const INK_DEEP = '#141414';
const ORANGE = '#ff6600';
const ORANGE_ON_DARK = '#ff9955';
const ZINC_200 = '#e4e4e7';
const ZINC_400 = '#a1a1aa';
const LINE_ON_DARK = 'rgba(255, 255, 255, 0.18)';

interface CardContent {
  /** Small capitals above the title: what kind of page this is. */
  eyebrow: string;
  title: string;
  /** One line under the title — a location, a status, a date. */
  detail?: string | null;
}

/** Long titles step down so three lines still fit above the footer. */
function titleSize(title: string): number {
  if (title.length > 90) return 52;
  if (title.length > 55) return 60;
  return 72;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function ogCard({ eyebrow, title, detail }: CardContent): ImageResponse {
  const shown = clip(title, 100);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          backgroundColor: INK,
          // Site lines: the plan grid the brand uses as texture.
          backgroundImage: `linear-gradient(${LINE_ON_DARK} 1px, transparent 1px), linear-gradient(90deg, ${LINE_ON_DARK} 1px, transparent 1px)`,
          backgroundSize: '90px 90px',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 22, height: 22, backgroundColor: ORANGE }} />
          <div style={{ display: 'flex', fontSize: 30, letterSpacing: '-0.01em' }}>CoBuilt</div>
          <div
            style={{
              display: 'flex',
              fontSize: 16,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: ZINC_400,
            }}
          >
            Investment Partners
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            padding: '40px 44px',
            backgroundColor: INK_DEEP,
            borderLeft: `6px solid ${ORANGE}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: ORANGE_ON_DARK,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: titleSize(shown),
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {shown}
          </div>
          {detail ? (
            <div style={{ display: 'flex', fontSize: 24, color: ZINC_200 }}>{clip(detail, 80)}</div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 20,
            color: ZINC_400,
          }}
        >
          <div style={{ display: 'flex' }}>Building Trust Through Every Brick</div>
          <div style={{ display: 'flex' }}>Every project documented · Project Passport™</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
