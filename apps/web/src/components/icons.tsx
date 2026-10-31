export function PlusIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="btn-icon size-4"
      fill="currentColor"
      aria-hidden
    >
      <path d="M7 1h2v6h6v2H9v6H7V9H1V7h6z" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="btn-icon size-4"
      fill="currentColor"
      aria-hidden
    >
      <path d="M3 1.5v13L14 8z" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="btn-icon size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <rect x="5" y="5" width="9" height="9" rx="2" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
    </svg>
  );
}

export function SaveIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M2.5 3.5a1 1 0 0 1 1-1h7.6l2.4 2.4v7.6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />
      <path d="M5 2.5v3h5v-3M5 13.5V9.5h6v4" />
    </svg>
  );
}

export function TemplatesIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="2.5" y="5" width="11" height="8.5" rx="1.5" />
      <path d="M4.5 3h7M6 1.5h4" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v1.8M8 12.7v1.8M14.5 8h-1.8M3.3 8H1.5M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3M12.6 12.6l-1.3-1.3M4.7 4.7 3.4 3.4" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="btn-icon size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5z" />
    </svg>
  );
}

export function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />
    </svg>
  );
}
