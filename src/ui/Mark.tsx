import type { CSSProperties } from 'react';

interface Props {
  d: string;
  color: string;
  size?: number | string;
  strokeWidth?: number;
  style?: CSSProperties;
}

export function Mark({ d, color, size = 22, strokeWidth = 2.8, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={d} />
    </svg>
  );
}
