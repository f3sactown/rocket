"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  canPromptInstall,
  deviceKind,
  isInstalled,
  promptInstall,
  subscribeInstall,
  type Device,
} from "@/lib/install";
import { enablePush, pushSupport, sendTestPush } from "@/lib/push";
import { useAuth } from "./auth-provider";
import { ShareIcon } from "./icons";

/** Set on this device once its setup is finished or skipped. */
export const DEVICE_SETUP_KEY = "rocket-device-setup";
/** Fired to open the setup again (from Settings). */
export const DEVICE_SETUP_EVENT = "rocket-device-setup";

const noSubscribe = () => () => {};

function setupDone(): boolean {
  try {
    return localStorage.getItem(DEVICE_SETUP_KEY) !== null;
  } catch {
    return true;
  }
}

function markDone() {
  try {
    localStorage.setItem(DEVICE_SETUP_KEY, new Date().toISOString());
  } catch {
    // Not remembered; it shows again next time.
  }
}

/** Opens the device setup again, e.g. from Settings. */
export function openDeviceSetup() {
  try {
    localStorage.removeItem(DEVICE_SETUP_KEY);
  } catch {
    // Opens anyway.
  }
  window.dispatchEvent(new Event(DEVICE_SETUP_EVENT));
}

type Step = "install" | "notifications";

/**
 * The first time someone signs in on a device: step by step, install Rocket as an app, then turn
 * on notifications. Each step can be skipped; once finished or skipped it doesn't come back on
 * this device (Settings → Notifications can run it again). On iPhone, notifications need Rocket
 * opened from the Home Screen, which keeps its own storage, so the setup picks up there.
 */
export function DeviceSetup() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("install");

  useEffect(() => {
    const show = () => {
      // Already running as an app: straight to notifications.
      setStep(isInstalled() ? "notifications" : "install");
      setOpen(!setupDone());
    };
    // After the launch animation, not over it.
    const timer = setTimeout(show, 1500);
    window.addEventListener(DEVICE_SETUP_EVENT, show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(DEVICE_SETUP_EVENT, show);
    };
  }, []);

  if (!open || !user || user.needsProfile) return null;

  const finish = () => {
    markDone();
    setOpen(false);
  };
  const total = isInstalled() ? 1 : 2;
  const number = step === "install" ? 1 : total;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-setup-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-3xl border border-line-strong bg-surface-raised p-5 shadow-2xl">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs text-muted">
            Set up this device · Step {number} of {total}
          </span>
          {step === "install" ? (
            <InstallStep
              onNext={() => setStep("notifications")}
              onFinish={finish}
            />
          ) : (
            <NotificationsStep onFinish={finish} />
          )}
        </div>
        <button
          type="button"
          onClick={finish}
          className="link self-center text-sm"
        >
          Skip setup
        </button>
      </div>
    </div>
  );
}

const button =
  "rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/60 disabled:opacity-50";

function Steps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink-soft marker:text-accent">
      {children}
    </ol>
  );
}

function InstallStep({
  onNext,
  onFinish,
}: {
  onNext: () => void;
  onFinish: () => void;
}) {
  const device = useSyncExternalStore<Device>(
    noSubscribe,
    deviceKind,
    () => "computer",
  );
  const promptable = useSyncExternalStore(
    subscribeInstall,
    canPromptInstall,
    () => false,
  );

  return (
    <>
      <h2 id="device-setup-title" className="text-lg font-semibold text-ink">
        Install Rocket
      </h2>
      <p className="text-sm text-ink-soft">
        Rocket works best as an app: its own icon, full screen, and
        notifications for your workouts.
      </p>
      {device === "ios" ? (
        <>
          <Steps>
            <li>
              Tap{" "}
              <span className="inline-flex translate-y-0.5 text-ink">
                <ShareIcon />
              </span>{" "}
              <strong className="text-ink">Share</strong> at the bottom (or top)
              of Safari.
            </li>
            <li>
              Scroll down and tap{" "}
              <strong className="text-ink">Add to Home Screen</strong>, then{" "}
              <strong className="text-ink">Add</strong>.
            </li>
            <li>
              Open <strong className="text-ink">Rocket</strong> from your Home
              Screen and sign in. Setup continues there to turn on
              notifications.
            </li>
          </Steps>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onFinish} className={button}>
              Done, I&apos;ve added it
            </button>
          </div>
        </>
      ) : promptable ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              await promptInstall();
              onNext();
            }}
            className={button}
          >
            Install Rocket
          </button>
          <button type="button" onClick={onNext} className="link text-sm">
            Not now
          </button>
        </div>
      ) : (
        <>
          <Steps>
            {device === "android" ? (
              <>
                <li>
                  Open the browser&apos;s menu{" "}
                  <strong className="text-ink">⋮</strong>.
                </li>
                <li>
                  Tap <strong className="text-ink">Install app</strong> or{" "}
                  <strong className="text-ink">Add to Home screen</strong>.
                </li>
              </>
            ) : (
              <>
                <li>
                  In Chrome or Edge, click the install icon at the right of the
                  address bar, or open the menu and choose{" "}
                  <strong className="text-ink">Install Rocket</strong>.
                </li>
                <li>
                  In Safari on a Mac, choose File →{" "}
                  <strong className="text-ink">Add to Dock</strong>.
                </li>
              </>
            )}
          </Steps>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onNext} className={button}>
              Next
            </button>
          </div>
        </>
      )}
    </>
  );
}

function NotificationsStep({ onFinish }: { onFinish: () => void }) {
  const support = useSyncExternalStore(
    noSubscribe,
    pushSupport,
    () => "unsupported" as const,
  );
  const [state, setState] = useState<"idle" | "busy" | "on">("idle");
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  async function turnOn() {
    setState("busy");
    setMessage(null);
    try {
      const error = await enablePush();
      if (error) {
        setMessage({ text: error, error: true });
        setState("idle");
      } else setState("on");
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true });
      setState("idle");
    }
  }

  return (
    <>
      <h2 id="device-setup-title" className="text-lg font-semibold text-ink">
        Turn on notifications
      </h2>
      <p className="text-sm text-ink-soft">
        Reminders the day before and the morning of your workouts, a nudge to
        write the backblast, and when PAX like or reuse your workouts. Choose
        which ones, and when, in Settings → Notifications.
      </p>
      {support === "needs-home-screen" ? (
        <>
          <p className="text-sm text-ink-soft">
            On iPhone and iPad, notifications need Rocket opened from your Home
            Screen. Add it there (Share → Add to Home Screen), open it, and
            setup continues.
          </p>
          <button
            type="button"
            onClick={onFinish}
            className={`${button} self-start`}
          >
            Got it
          </button>
        </>
      ) : support === "unsupported" ? (
        <>
          <p className="text-sm text-ink-soft">
            This browser can&apos;t show notifications. Try Chrome, Edge,
            Firefox or Safari.
          </p>
          <button
            type="button"
            onClick={onFinish}
            className={`${button} self-start`}
          >
            Finish
          </button>
        </>
      ) : state === "on" ? (
        <>
          <p className="text-sm text-ink">
            Notifications are on for this device.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                const error = await sendTestPush();
                setMessage(
                  error
                    ? { text: error, error: true }
                    : {
                        text: "Sent. It should appear in a few seconds.",
                        error: false,
                      },
                );
              }}
              className={button}
            >
              Send a test
            </button>
            <button type="button" onClick={onFinish} className={button}>
              Finish
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={state === "busy"}
            onClick={turnOn}
            className={button}
          >
            {state === "busy" ? "Turning on…" : "Turn on notifications"}
          </button>
          <button type="button" onClick={onFinish} className="link text-sm">
            Not now
          </button>
        </div>
      )}
      {message && (
        <p
          className={`text-sm ${message.error ? "text-accent" : "text-ink-soft"}`}
        >
          {message.text}
        </p>
      )}
    </>
  );
}
