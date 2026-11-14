"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  normalizeSettings,
  type NotificationSettings,
} from "../../../../supabase/functions/_shared/reminders";
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushSupport,
  sendTestPush,
} from "@/lib/push";
import { createClient } from "@/lib/supabase/client";

const noSubscribe = () => () => {};

/** The time zone this device is in, which reminder times are counted in. */
const timeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";

/**
 * Settings → Notifications: turning push notifications on for this device, and which ones come
 * when (saved to the account, so every device follows them).
 */
export function PushSettings({ userId }: { userId: string }) {
  const support = useSyncExternalStore(
    noSubscribe,
    pushSupport,
    () => "unsupported" as const,
  );
  const [device, setDevice] = useState<"loading" | "on" | "off">("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    currentSubscription()
      .then((s) => setDevice(s ? "on" : "off"))
      .catch(() => setDevice("off"));
    createClient()
      .from("notification_settings")
      .select("settings")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setSettings(normalizeSettings(data?.settings)));
  }, [userId]);

  /** Saves the settings a moment after the last change. */
  function change(next: NotificationSettings) {
    setSettings(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { error } = await createClient()
        .from("notification_settings")
        .upsert({
          user_id: userId,
          settings: next as never,
          time_zone: timeZone(),
          updated_at: new Date().toISOString(),
        });
      setMessage(error ? { text: error.message, error: true } : null);
    }, 500);
  }

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      const error = await enablePush();
      if (error) setMessage({ text: error, error: true });
      else {
        setDevice("on");
        // Save the settings (and this device's time zone) so reminders know when to come.
        if (settings) change(settings);
        setMessage({
          text: "Notifications are on for this device.",
          error: false,
        });
      }
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true });
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    await disablePush().catch(() => {});
    setDevice("off");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    const error = await sendTestPush();
    setMessage(
      error
        ? { text: error, error: true }
        : { text: "Sent. It should appear in a few seconds.", error: false },
    );
    setBusy(false);
  }

  const button =
    "rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/60 disabled:opacity-50";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="label">This device</span>
        {support === "needs-home-screen" ? (
          <p className="text-sm text-ink-soft">
            On iPhone and iPad, add Rocket to your Home Screen first: tap Share,
            then <strong className="text-ink">Add to Home Screen</strong>. Open
            Rocket from there and turn notifications on here.
          </p>
        ) : support === "unsupported" ? (
          <p className="text-sm text-ink-soft">
            This browser can&apos;t show notifications.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {device === "on" ? (
              <>
                <span className="status text-sm">On</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={test}
                  className={button}
                >
                  Send a test
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={turnOff}
                  className="link text-sm"
                >
                  Turn off
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy || device === "loading"}
                onClick={turnOn}
                className={button}
              >
                {busy ? "Turning on…" : "Turn on notifications"}
              </button>
            )}
          </div>
        )}
        {message && (
          <p
            className={`text-sm ${message.error ? "text-accent" : "text-ink-soft"}`}
          >
            {message.text}
          </p>
        )}
      </div>

      {settings && (
        <div className="flex flex-col divide-y divide-line">
          <Row
            label="The day before your workout"
            hint="For workouts you're Q of."
            on={settings.dayBefore.on}
            onToggle={(on) =>
              change({ ...settings, dayBefore: { ...settings.dayBefore, on } })
            }
          >
            at{" "}
            <input
              type="time"
              aria-label="Time for the day-before reminder"
              value={settings.dayBefore.time}
              onChange={(e) =>
                e.target.value &&
                change({
                  ...settings,
                  dayBefore: { ...settings.dayBefore, time: e.target.value },
                })
              }
              className="input w-32 px-2 py-1 text-sm"
            />
          </Row>
          <Row
            label="Before your workout starts"
            hint="Needs a start time on the workout, like 5:15am."
            on={settings.morningOf.on}
            onToggle={(on) =>
              change({ ...settings, morningOf: { ...settings.morningOf, on } })
            }
          >
            <Count
              label="Minutes before the workout"
              value={settings.morningOf.minutes}
              min={5}
              max={240}
              onChange={(minutes) =>
                change({
                  ...settings,
                  morningOf: { ...settings.morningOf, minutes },
                })
              }
            />{" "}
            minutes before
          </Row>
          <Row
            label="Write the backblast"
            hint="After the workout ends, if its backblast isn't finished. A workout with only a start time counts as 45 minutes long."
            on={settings.backblast.on}
            onToggle={(on) =>
              change({ ...settings, backblast: { ...settings.backblast, on } })
            }
          >
            <Count
              label="Minutes after the workout"
              value={settings.backblast.minutes}
              min={0}
              max={720}
              onChange={(minutes) =>
                change({
                  ...settings,
                  backblast: { ...settings.backblast, minutes },
                })
              }
            />{" "}
            minutes after
          </Row>
          {settings.drafts.map((nudge, i) => (
            <Row
              key={i}
              label={
                [
                  "Finish a draft",
                  "Second draft reminder",
                  "Third draft reminder",
                ][i]!
              }
              hint={
                i === 0 ? "A workout or backblast still in drafts." : undefined
              }
              on={nudge.on}
              onToggle={(on) =>
                change({
                  ...settings,
                  drafts: settings.drafts.map((n, j) =>
                    j === i ? { ...n, on } : n,
                  ),
                })
              }
            >
              <Count
                label={`Days after starting, reminder ${i + 1}`}
                value={nudge.days}
                min={1}
                max={30}
                onChange={(days) =>
                  change({
                    ...settings,
                    drafts: settings.drafts.map((n, j) =>
                      j === i ? { ...n, days } : n,
                    ),
                  })
                }
              />{" "}
              days after it&apos;s started
            </Row>
          ))}
          <Row
            label="Likes and reuses of your workouts"
            on={settings.social.on}
            onToggle={(on) => change({ ...settings, social: { on } })}
          />
          <Row
            label="A new PAX in your region joins Rocket"
            on={settings.newPax.on}
            onToggle={(on) => change({ ...settings, newPax: { on } })}
          />
        </div>
      )}
    </div>
  );
}

/** One kind of notification: its switch, and its timing beneath when it's on. */
function Row({
  label,
  hint,
  on,
  onToggle,
  children,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-sm text-ink">{label}</span>
          {hint && <span className="text-xs text-muted">{hint}</span>}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          onClick={() => onToggle(!on)}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
            on ? "border-accent/60 bg-accent" : "border-line-strong bg-panel"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5.5 rounded-full bg-white shadow transition-[left] ${
              on ? "left-[calc(100%-1.5rem)]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      {on && children && (
        <span className="flex items-center gap-1.5 text-sm text-ink-soft">
          {children}
        </span>
      )}
    </div>
  );
}

/** A whole number in a range, kept as typed and saved once it's valid. */
function Count({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const valid = (t: string) =>
    /^\d{1,3}$/.test(t.trim()) && Number(t) >= min && Number(t) <= max;
  return (
    <input
      inputMode="numeric"
      aria-label={label}
      aria-invalid={!valid(text)}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        if (valid(e.target.value)) onChange(Number(e.target.value));
      }}
      onBlur={() => setText(String(value))}
      className="input w-16 px-2 py-1 text-center text-sm"
    />
  );
}
