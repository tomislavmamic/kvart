import type { CSSProperties } from "react";

const PUTANJE = {
  play: "m7 4 12 8-12 8Z",
  pause: "M8 5v14M16 5v14",
  settings: "M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6",
  close: "m6 6 12 12M18 6 6 18",
  check: "m5 12 4 4L19 6",
  minus: "M5 12h14",
  arrow: "M12 20V4m-6 6 6-6 6 6",
  back: "m14 6-6 6 6 6",
  locate: "M12 3v3m0 12v3M3 12h3m12 0h3M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  chevron: "m6 9 6 6 6-6",
} as const;

export function SimIkona({ ime, style }: { ime: keyof typeof PUTANJE; style?: CSSProperties }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      <path d={PUTANJE[ime]} />
    </svg>
  );
}
