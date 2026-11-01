import { useId } from "react";

/**
 * The Rocket mascot: a silver rocket with a porthole, a center stripe, and a nose cone and fins
 * in the accent color (the --rocket-* variables). Drawn in a 100×190 box with the nozzle at the bottom; the flame hangs below it when shown.
 */
export function RocketArt({
  label,
  flame = false,
  className,
  flameClassName,
}: {
  /** Text on the body, e.g. "F3". Omit at small sizes. */
  label?: string;
  flame?: boolean;
  className?: string;
  /** Extra classes for the flame group, e.g. to animate it. */
  flameClassName?: string;
}) {
  const id = useId().replace(/:/g, "");
  const body = `rocket-body-${id}`;
  const fire = `rocket-flame-${id}`;

  return (
    <svg
      viewBox="0 0 100 190"
      className={className}
      role="img"
      aria-label="Rocket"
      // The flame can reach below the drawing.
      overflow="visible"
    >
      <defs>
        <linearGradient id={body} x1="0" x2="1">
          <stop offset="0" stopColor="#9aa4ae" />
          <stop offset="0.45" stopColor="#f4f6f8" />
          <stop offset="1" stopColor="#8a949e" />
        </linearGradient>
        <linearGradient id={fire} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" style={{ stopColor: "var(--rocket-light)" }} />
          <stop
            offset="1"
            style={{ stopColor: "var(--rocket-mid)", stopOpacity: 0 }}
          />
        </linearGradient>
      </defs>

      {flame && (
        <g className={flameClassName}>
          <path d="M40 149 Q50 215 60 149 Z" fill={`url(#${fire})`} />
        </g>
      )}

      {/* Fins */}
      <path
        d="M31 112 L12 140 L12 152 L31 140 Z"
        style={{ fill: "var(--rocket-mid)", stroke: "var(--rocket-light)" }}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M69 112 L88 140 L88 152 L69 140 Z"
        style={{ fill: "var(--rocket-mid)", stroke: "var(--rocket-light)" }}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Nozzle */}
      <path d="M41 143 L59 143 L56 151 L44 151 Z" fill="#5d6770" />

      {/* Body */}
      <path
        d="M31 52 L69 52 L69 140 Q69 145 64 145 L36 145 Q31 145 31 140 Z"
        fill={`url(#${body})`}
        stroke="#6f7983"
        strokeWidth="1"
      />

      {/* Nose cone */}
      <path
        d="M50 6 C38 18 31 36 31 53 L69 53 C69 36 62 18 50 6 Z"
        style={{ fill: "var(--rocket-mid)" }}
      />

      {/* Porthole */}
      <circle
        cx="50"
        cy="74"
        r="11"
        fill="#0d1d28"
        style={{ stroke: "var(--rocket-mid)" }}
        strokeWidth="5"
      />
      <circle
        cx="46"
        cy="70"
        r="3.2"
        opacity="0.9"
        style={{ fill: "var(--rocket-light)" }}
      />

      {label && (
        <text
          x="50"
          y="106"
          textAnchor="middle"
          fontFamily="var(--font-geist-sans), system-ui, sans-serif"
          fontWeight="800"
          fontSize={label.length > 2 ? 13 : 15}
          fill="#111418"
        >
          {label}
        </text>
      )}

      {/* Center stripe */}
      <rect
        x="47"
        y="114"
        width="6"
        height="28"
        rx="1"
        style={{ fill: "var(--rocket-dark)" }}
      />
    </svg>
  );
}
