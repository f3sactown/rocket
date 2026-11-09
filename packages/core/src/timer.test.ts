import { describe, expect, it } from "vitest";
import {
  beepAt,
  formatTimer,
  parseTimer,
  timerLabel,
  timerPhases,
} from "./timer";

describe("timers", () => {
  it("formats times as m:ss", () => {
    expect(formatTimer(600)).toBe("10:00");
    expect(formatTimer(45)).toBe("0:45");
  });

  it("describes each kind", () => {
    expect(timerLabel({ type: "countdown", seconds: 300 })).toBe(
      "Countdown · 5:00",
    );
    expect(
      timerLabel({ type: "intervals", work: 20, rest: 10, rounds: 8 }),
    ).toBe("Tabata · 8 × 0:20 on / 0:10 off");
    expect(timerLabel({ type: "emom", every: 60, rounds: 10 })).toBe(
      "EMOM · 10 × 1:00",
    );
  });

  it("splits intervals into work and rest, with no rest after the last round", () => {
    const phases = timerPhases({
      type: "intervals",
      work: 20,
      rest: 10,
      rounds: 2,
    });
    expect(phases.map((p) => [p.label, p.seconds])).toEqual([
      ["Round 1 of 2 · Work", 20],
      ["Round 1 of 2 · Rest", 10],
      ["Round 2 of 2 · Work", 20],
    ]);
  });

  it("calls intervals Tabata and reads the old Tabata timer as one", () => {
    expect(
      timerLabel({ type: "intervals", work: 20, rest: 10, rounds: 8 }),
    ).toBe("Tabata · 8 × 0:20 on / 0:10 off");
    expect(parseTimer({ type: "tabata", rounds: 6 })).toEqual({
      type: "intervals",
      work: 20,
      rest: 10,
      rounds: 6,
    });
    expect(parseTimer({ type: "tabata" })).toBeUndefined();
  });

  it("beeps at 3, 2, 1 and a long one at 0", () => {
    expect([5, 4, 3, 2, 1, 0].map(beepAt)).toEqual([
      null,
      null,
      "tick",
      "tick",
      "tick",
      "end",
    ]);
  });

  it("reads stored timers and drops broken ones", () => {
    expect(parseTimer({ type: "emom", every: 60, rounds: 5 })).toEqual({
      type: "emom",
      every: 60,
      rounds: 5,
    });
    expect(parseTimer({ type: "countdown" })).toBeUndefined();
    expect(parseTimer("nope")).toBeUndefined();
  });
});
