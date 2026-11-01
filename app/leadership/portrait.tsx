import type { PublicLeader } from './load-leadership';

/**
 * A leader's portrait, or the slot that says one is awaited.
 *
 * Without a photograph the slot keeps the launch design's honesty: it names
 * what goes there rather than holding a stock face. The image is a real
 * `<img>` with alt text, not a CSS background, because a portrait is content.
 */
export default function Portrait({
  leader,
  className,
}: {
  leader: Pick<PublicLeader, 'fullName' | 'roleTitle' | 'photoUrl' | 'photoAlt'>;
  /** Sets the frame's size; the photograph fills it. */
  className: string;
}) {
  if (!leader.photoUrl) {
    return (
      <div className={`flex items-start bg-line p-3.5 text-[0.719rem] text-zinc-600 ${className}`}>
        {leader.roleTitle ?? leader.fullName} — approved portrait
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-line ${className}`}>
      <img
        className="size-full object-cover object-top"
        src={leader.photoUrl}
        alt={leader.photoAlt ?? `Portrait of ${leader.fullName}`}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
