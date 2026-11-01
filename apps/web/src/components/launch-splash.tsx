"use client";

import { useState } from "react";
import { useTerms } from "./auth-provider";
import { RocketArt } from "./rocket-art";

/**
 * Launch animation shown over the app while it loads: ignition, smoke, liftoff and a fade into the
 * app. It's pure CSS, so it plays from the static HTML before any JavaScript runs and still ends on
 * its own if scripts are slow; tapping skips it.
 */
export function LaunchSplash() {
  const [gone, setGone] = useState(false);
  const terms = useTerms();
  if (gone) return null;

  return (
    <div
      className="splash"
      aria-hidden
      onClick={() => setGone(true)}
      onAnimationEnd={(event) => {
        if (event.animationName === "splash-out") setGone(true);
      }}
    >
      <div className="splash-stars" />
      <div className="splash-glow" />
      <div className="splash-stage">
        <div className="splash-rocket">
          <div className="splash-trail" />
          <div className="splash-shake">
            <RocketArt
              label={terms.org}
              flame
              className="h-[190px] w-[100px]"
              flameClassName="splash-flame"
            />
          </div>
        </div>
        <div className="splash-pad">
          <span className="splash-pad-top" />
          <span className="splash-pad-leg left-[18%]" />
          <span className="splash-pad-leg right-[18%]" />
        </div>
        <div className="splash-smoke">
          {[-34, -18, 0, 18, 34].map((x, i) => (
            <span
              key={x}
              style={
                {
                  "--x": `${x}px`,
                  "--d": `${i % 2 ? 0.08 : 0}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>
      <div className="splash-title">
        <span className="text-2xl font-extrabold tracking-[0.12em] text-white">
          ROCKET
        </span>
        <span className="text-[11px] font-semibold tracking-[0.45em] text-[#8cc8f0]">
          Q PLANNER
        </span>
      </div>
    </div>
  );
}
