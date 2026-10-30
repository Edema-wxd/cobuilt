import BrickMark from './BrickMark';

/**
 * The brand mark that covers the first page of a visit while it loads, then
 * lifts away. Timing, the skip on later pages and the skip for reduced motion
 * all live in styles/globals.css (`.brand-intro`), so it needs no JavaScript
 * to clear. Decorative: hidden from assistive technology throughout.
 */
export default function BrandIntro() {
  return (
    <div
      className="brand-intro fixed inset-0 z-100 flex flex-col items-center justify-center gap-7 bg-ink"
      aria-hidden="true"
    >
      <img
        className="brand-intro-logo h-auto w-40 sm:w-48"
        src="/images/cobuilt-logo-dark.webp"
        alt=""
        width={650}
        height={220}
      />
      <BrickMark className="w-24" />
    </div>
  );
}
