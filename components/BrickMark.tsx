import type { CSSProperties } from 'react';

/**
 * Three courses of running bond, laid bottom course first: "Building Trust
 * Through Every Brick", as a loading mark. Each brick carries its place in
 * the sequence; `.brick` in styles/globals.css turns that into a delay.
 *
 * Orange on the ink ground only, where it is ornament rather than a signal.
 */
const COURSES: Array<Array<{ span: 1 | 2 }>> = [
  [{ span: 2 }, { span: 2 }, { span: 2 }],
  [{ span: 1 }, { span: 2 }, { span: 2 }, { span: 1 }],
  [{ span: 2 }, { span: 2 }, { span: 2 }],
];

interface Props {
  className?: string;
}

export default function BrickMark({ className = '' }: Props) {
  let order = 0;
  const laid = COURSES.map((course) =>
    course.map((brick) => ({ ...brick, order: order++ })),
  ).reverse();

  return (
    <div className={`flex flex-col gap-[3px] ${className}`} aria-hidden="true">
      {/* Rendered top course first; the bottom course carries the lowest delays. */}
      {laid.map((course, row) => (
        <div key={row} className="grid grid-cols-6 gap-[3px]">
          {course.map((brick) => (
            <span
              key={brick.order}
              className={`brick block h-2.5 bg-orange ${brick.span === 2 ? 'col-span-2' : 'col-span-1'}`}
              style={{ '--brick': brick.order } as CSSProperties}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
