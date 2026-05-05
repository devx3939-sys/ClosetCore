export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="inline-block"
    >
      <rect width="64" height="64" rx="14" fill="currentColor" />
      <g
        fill="none"
        stroke="#faf7f2"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 24 L32 14 L48 24 L48 50 L16 50 Z" />
        <path d="M28 14 C28 18 36 18 36 14" />
      </g>
    </svg>
  );
}
