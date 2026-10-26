import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '../components/og';

/**
 * The site's default link preview. Every page without a card of its own
 * inherits this one; see components/og.tsx.
 */

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'CoBuilt Investment Partners — Building Trust Through Every Brick';

export default function Image() {
  return ogCard({
    eyebrow: 'Real estate development · Nigeria',
    title: 'Planned, managed and delivered — with every project documented.',
  });
}
