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
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushSupport,
  sendTestPush,
} from "@/lib/push";
import { useAuth } from "./auth-provider";
import { ShareIcon } from "./icons";
import { Switch } from "./switch";

/** Set on this device once its setup is finished or skipped. */
export const DEVICE_SETUP_KEY = "rocket-device-setup";
/** Fired to open the setup again (from Settings). */
export const DEVICE_SETUP_EVENT = "rocket-device-setup";

const noSubscribe = () => () => {};

/** "Remind me later" is kept as this, then when to ask again (ms). */
const LATER = "later:";
/** How long "Remind me later" waits before asking again. */
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;

function setupDone(): boolean {
  try {
    const kept = localStorage.getItem(DEVICE_SETUP_KEY);
    if (kept === null) return false;
    // Put off: out of the way until it's time to ask again.
    if (kept.startsWith(LATER))
      return Date.now() < Number(kept.slice(LATER.length));
    return true;
  } catch {
    return true;
  }
}

/** Fired when this device's setup is finished or skipped (the app tour waits for it). */
export const DEVICE_SETUP_DONE_EVENT = "rocket-device-setup-done";

function markDone(remindLater = false) {
  try {
    localStorage.setItem(
      DEVICE_SETUP_KEY,
      remindLater
        ? `${LATER}${Date.now() + REMIND_AFTER_MS}`
        : new Date().toISOString(),
    );
  } catch {
    // Not remembered; it shows again next time.
  }
  window.dispatchEvent(new Event(DEVICE_SETUP_DONE_EVENT));
}

/** Whether this device's setup is out of the way (finished, skipped, or not stored). */
export function deviceSetupFinished(): boolean {
  return setupDone();
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
 * this device (Settings → Notifications can run it again). "Remind me later" puts it off for a
 * day: it opens again the first time Rocket opens after that. On iPhone, notifications need Rocket
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

  const finish = (remindLater = false) => {
    markDone(remindLater);
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
              onFinish={() => finish()}
            />
          ) : (
            <NotificationsStep onFinish={() => finish()} />
          )}
        </div>
        <div className="flex flex-col items-center gap-1 border-t border-line pt-3">
          <span className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            <button
              type="button"
              onClick={() => finish(true)}
              className="link text-sm"
            >
              Remind me later
            </button>
            <button
              type="button"
              onClick={() => finish()}
              className="link text-sm"
            >
              Skip setup
            </button>
          </span>
          <span className="text-center text-xs text-muted">
            Later asks again tomorrow. Either way, it&apos;s in Settings.
          </span>
        </div>
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
  return (
    <>
      <h2 id="device-setup-title" className="text-lg font-semibold text-ink">
        Install Rocket
      </h2>
      <p className="text-sm text-ink-soft">
        Rocket works best as an app: its own icon, full screen, and
        notifications for your workouts.
      </p>
      <InstallInstructions setup onInstalled={onNext} />
      <div className="flex flex-wrap items-center gap-2">
        {device === "ios" ? (
          <button type="button" onClick={onFinish} className={button}>
            Done, I&apos;ve added it
          </button>
        ) : (
          <button type="button" onClick={onNext} className={button}>
            Next
          </button>
        )}
      </div>
    </>
  );
}

/**
 * How to install Rocket on this device: the browser's own Install button where it offers one,
 * otherwise the steps for this kind of device.
 */
export function InstallInstructions({
  setup = false,
  onInstalled,
}: {
  /** In the device setup, which carries on from the Home Screen on iPhone. */
  setup?: boolean;
  onInstalled?: () => void;
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
  const [installed, setInstalled] = useState(false);

  if (installed)
    return (
      <p className="text-sm text-ink">
        Installed. Open Rocket from your home screen or app list.
      </p>
    );
  if (device === "ios")
    return (
      <Steps>
        <li>
          Open Rocket in <strong className="text-ink">Safari</strong>, then tap{" "}
          <span className="inline-flex translate-y-0.5 text-ink">
            <ShareIcon />
          </span>{" "}
          <strong className="text-ink">Share</strong> at the bottom (or top).
        </li>
        <li>
          Scroll down and tap{" "}
          <strong className="text-ink">Add to Home Screen</strong>, then{" "}
          <strong className="text-ink">Add</strong>.
        </li>
        <li>
          Open <strong className="text-ink">Rocket</strong> from your Home
          Screen and sign in.
          {setup && " Setup continues there to turn on notifications."}
        </li>
      </Steps>
    );
  if (promptable)
    return (
      <button
        type="button"
        onClick={async () => {
          if (await promptInstall()) setInstalled(true);
          onInstalled?.();
        }}
        className={`${button} self-start`}
      >
        Install Rocket
      </button>
    );
  return (
    <Steps>
      {device === "android" ? (
        <>
          <li>
            Open the browser&apos;s menu <strong className="text-ink">⋮</strong>
            .
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
  );
}

/** Settings → Install the app: whether Rocket is installed here, and how to install it. */
export function InstallSettings() {
  const installed = useSyncExternalStore(noSubscribe, isInstalled, () => false);
  if (installed)
    return (
      <p className="text-sm text-ink">
        Rocket is installed: you&apos;re using it as an app on this device.
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">
        As an app, Rocket has its own icon, opens full screen and works with no
        signal. On iPhone and iPad it&apos;s the only way to get notifications.
      </p>
      <InstallInstructions />
    </div>
  );
}

/**
 * What iPhone and iPad allow web apps' notifications, shown on those devices only (on other
 * devices, nothing).
 */
export function IosNotificationNote() {
  const device = useSyncExternalStore<Device>(
    noSubscribe,
    deviceKind,
    () => "computer",
  );
  if (device !== "ios") return null;
  return (
    <div
      role="note"
      className="flex flex-col gap-1.5 rounded-2xl border border-accent/40 bg-accent/5 p-3 text-sm text-ink-soft"
    >
      <strong className="text-ink">
        Notifications on iPhone and iPad have limits
      </strong>
      <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-accent">
        <li>
          They only work in Rocket added to the Home Screen and opened from
          there (iOS 16.4 or later), not in a Safari tab.
        </li>
        <li>
          They&apos;re for that Home Screen app only: remove it and they stop;
          add it again and turn them on again.
        </li>
        <li>
          Focus, Do Not Disturb, Scheduled Summary and Low Power Mode can hold
          them back or delay them.
        </li>
        <li>
          iOS can stop delivering them to an app that isn&apos;t opened for a
          long time. Open Rocket now and then, and use Send a test if
          they&apos;ve gone quiet.
        </li>
      </ul>
    </div>
  );
}

function NotificationsStep({ onFinish }: { onFinish: () => void }) {
  const support = useSyncExternalStore(
    noSubscribe,
    pushSupport,
    () => "unsupported" as const,
  );
  const [state, setState] = useState<"loading" | "off" | "busy" | "on">(
    "loading",
  );
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  useEffect(() => {
    if (support !== "supported") return;
    currentSubscription()
      .then((s) => setState(s ? "on" : "off"))
      .catch(() => setState("off"));
  }, [support]);

  async function toggle(on: boolean) {
    setState("busy");
    setMessage(null);
    try {
      if (!on) {
        await disablePush();
        setState("off");
        return;
      }
      const error = await enablePush();
      if (error) {
        setMessage({ text: error, error: true });
        setState("off");
      } else setState("on");
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true });
      setState(on ? "off" : "on");
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
      <IosNotificationNote />
      {support === "needs-home-screen" ? (
        <>
          <p className="text-sm text-ink-soft">
            Add Rocket to your Home Screen (Share → Add to Home Screen), open it
            from there, and setup continues.
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
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2.5">
            <span className="flex flex-col">
              <span className="text-sm text-ink">
                Notifications on this device
              </span>
              <span className="text-xs text-muted">
                {state === "busy"
                  ? "One moment…"
                  : state === "on"
                    ? "On. Not arriving? Turn them off and on again."
                    : "Off"}
              </span>
            </span>
            <Switch
              label="Notifications on this device"
              on={state === "on"}
              disabled={state === "busy" || state === "loading"}
              onToggle={toggle}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {state === "on" && (
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
            )}
            <button type="button" onClick={onFinish} className={button}>
              {state === "on" ? "Finish" : "Not now"}
            </button>
          </div>
        </>
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
