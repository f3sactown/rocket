"use client";

import { useState } from "react";
import { EyeIcon } from "./icons";

/** A password field with an eye button to show or hide what's typed. Hidden to start. */
export function PasswordInput(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">,
) {
  const [shown, setShown] = useState(false);
  return (
    <span className="relative flex">
      <input
        {...props}
        type={shown ? "text" : "password"}
        className={`${props.className ?? "input"} w-full pr-11`}
      />
      <button
        type="button"
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        onClick={() => setShown(!shown)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition-colors hover:text-ink"
      >
        <EyeIcon open={!shown} />
      </button>
    </span>
  );
}
