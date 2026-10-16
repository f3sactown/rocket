#!/usr/bin/env python3
"""Build data/library.js from the F3 Nation Exicon CSV export and the FiA Lexicon CSV.

Usage:  python3 tools/build_library.py [source/exicon-export.csv]

The Exicon CSV needs columns ID, Name, Description (HTML allowed). The FiA CSV
(source/fia-lexicon.csv, from tools/fetch_fia.py; skipped if missing) needs
Name, Category, Description; its TERM rows are left out. Each entry is converted
to plain text and auto-tagged with emphasis / equipment / tags so the Library
picker can filter it. FiA entries carry "source": "fia" (the app shows them with
the FiA badge); Exicon entries have no source field and count as F3.
Re-run this whenever you get a fresh export and commit the new data/library.js;
the app picks it up on the next load.
"""
import csv
import html
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "source" / "exicon-export.csv"
FIA_SRC = ROOT / "source" / "fia-lexicon.csv"
OUT = ROOT / "data" / "library.js"


def html_to_text(raw: str) -> str:
    s = raw or ""
    s = s.replace('\\"', '"').replace("\\'", "'")
    s = re.sub(r"<\s*br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<\s*li[^>]*>", "\n• ", s, flags=re.I)
    s = re.sub(r"</\s*(p|li|h\d|tr|blockquote|div)\s*>", "\n", s, flags=re.I)
    s = re.sub(r"</\s*t[dh]\s*>", " | ", s, flags=re.I)
    s = re.sub(r"<\s*hr[^>]*>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace(" ", " ")
    lines = [re.sub(r"[ \t]+", " ", ln).strip(" |") for ln in s.split("\n")]
    lines = [ln.replace("•  ", "• ") for ln in lines]
    out, blank = [], False
    for ln in lines:
        if not ln.strip() or ln.strip() == "•":
            blank = bool(out)
            continue
        if blank and out:
            pass  # collapse paragraph breaks to single newline (matches original app)
        out.append(ln.strip())
        blank = False
    return "\n".join(out).strip()


def has(text, terms):
    return any(t in text for t in terms)


def word(text, terms):
    return any(re.search(r"\b" + re.escape(t) + r"\b", text) for t in terms)


def classify(name: str, body: str):
    n = name.lower()
    t = f"{name}\n{body}".lower()
    emphasis, equipment, tags = set(), set(), set()

    # Is this a whole routine (thang) or a single exercise?
    routine_terms = ["partner up", "split into", "stations", "station ", "rotation", "rotate",
                     "relay", "amrap", "emom", "tabata", "dora", "circuit", "rounds",
                     "rinse and repeat", "wash, rinse", "ladder", "deck of cards", "until time",
                     "each round", "repeat until", "pyramid"]
    kind = "thang" if has(t, routine_terms) or len(body) > 650 else "exercise"
    if kind == "thang":
        tags.add("routine")

    if word(t, ["partner", "partners"]):
        tags.add("partner")
    if word(t, ["team", "teams", "squad", "squads"]):
        tags.add("team")
    if has(t, ["game", "competition", "competitive", "winner", "loser", "first team", "race"]):
        tags.add("game")
    if has(t, ["competition", "competitive", "winner", "loser", "race"]):
        tags.add("competitive")
    if has(n, ["warm", "ssh", "side straddle", "imperial walker", "windmill", "arm circle",
               "grass grabber", "abe vigoda", "hillbilly", "mosey"]) or has(t, ["warm-up", "warmup", "warm up", "warm-o-rama"]):
        tags.add("warmup")
    if has(t, ["mary", "on your six", "on your back", "flutter", "lbc", "leg lift", "big boy",
               "dolly", "hello dolly", "rosalita", "box cutter", "freddie mercury", "american hammer",
               "pickle pounder", "low slow flutter"]) and has(t, ["six", "back", "flutter", "lbc", "leg", "dolly", "cutter", "mercury", "hammer", "big boy", "mary"]):
        tags.add("mary")
    if has(t, ["finisher", "to finish", "finish the", "end the workout", "last few minutes"]):
        tags.add("finisher")
    if has(t, ["benchmark", "for time", "record your", "track your", "personal best", "pr "]):
        tags.add("benchmark")

    # Equipment
    if has(t, ["coupon", "cinder", "cmu", "block "]):
        equipment.add("coupon"); emphasis.add("heavy")
    if word(t, ["ruck", "rucks", "rucking", "rucksack"]):
        equipment.add("ruck"); emphasis.add("ruck")
    if word(t, ["sandbag", "sandbags"]):
        equipment.add("sandbag"); emphasis.add("heavy")
    if has(t, ["pull-up bar", "pull up bar", "pullup bar", "monkey bar", "pull-ups", "pull ups", "pullups", "pull-up", "chin-up", "chin up"]):
        equipment.add("pull_up_bar")
    if word(t, ["stairs", "stair", "steps", "bleachers"]):
        equipment.add("stairs")
    if word(t, ["cone", "cones"]):
        equipment.add("cones")
    if has(t, ["field", "goal line", "yard line", "end zone", "track"]):
        equipment.add("field")
    if has(t, ["speaker", "song", "music", "lyrics", "playlist"]) or word(t, ["track"]) and has(t, ["play"]):
        equipment.add("speaker")
    if word(t, ["swing", "swings", "swingset", "swing set"]):
        equipment.add("swing")
    if has(t, ["timer", "seconds on", "seconds off", "tabata", "emom", "interval"]):
        equipment.add("timer")
    if word(t, ["bench", "benches", "picnic table", "wall", "curb"]):
        equipment.add("bench_wall")
    if word(t, ["kettlebell", "kettlebells", "kb", "dumbbell", "dumbbells", "weight", "weights"]):
        equipment.add("weights"); emphasis.add("heavy")

    # Emphasis
    if has(t, ["merkin", "push-up", "push up", "pushup", "press", "dip", "curl", "shoulder", "arm",
               "chest", "tricep", "bicep", "pull-up", "pull up", "row"]):
        emphasis.add("upper")
    if has(t, ["squat", "lunge", "lt. dan", "lt dan", "calf", "calves", "leg", "jump", "glute",
               "quad", "hamstring", "wall sit", "step-up", "step up", "bonnie blair", "monkey humper"]):
        emphasis.add("lower")
    if has(t, ["plank", "hammer", "flutter", "lbc", "big boy", "sit-up", "situp", "sit up", "crunch",
               "abs", "core", "v-up", "leg lift", "dolly", "mountain climber", "freddie mercury", "box cutter"]):
        emphasis.add("core")
    if has(t, ["run", "sprint", "mosey", "jog", "lap", "suicide", "suicides", "100 yard", "yards", "burpee", "jumping jack", "high knees"]):
        emphasis.add("cardio")
    if has(t, ["run ", "run.", "run,", "running", "sprint", "mile", "5k", "track", "jog"]):
        emphasis.add("run")
    if has(t, ["stretch", "mobility", "yoga", "flexibility", "hold for", "range of motion", "foam roll"]):
        emphasis.add("mobility")

    return kind, sorted(emphasis), sorted(equipment), sorted(tags)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def clean_name(raw):
    return re.sub(r"\s+", " ", (raw or "").replace('\\"', '"')).strip()


def f3_items():
    rows = list(csv.DictReader(open(SRC, encoding="utf-8"), escapechar="\\"))
    items, seen = [], set()
    for r in rows:
        name = clean_name(r.get("Name"))
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        body = html_to_text(r.get("Description") or "")
        kind, emphasis, equipment, tags = classify(name, body)
        items.append({
            "id": "x-" + slug(name),
            "name": name,
            "text": body,
            "kind": kind,
            "emphasis": emphasis,
            "equipment": equipment,
            "tags": tags,
        })
    return items


def fia_items():
    """FiA rows: Category says exercise vs routine (thang); TERM rows are glossary, not exercises."""
    if not FIA_SRC.exists():
        return []
    items, seen = [], set()
    for r in csv.DictReader(open(FIA_SRC, encoding="utf-8")):
        name, cat = clean_name(r.get("Name")), (r.get("Category") or "").strip().lower()
        if not name or cat == "term" or name.lower() in seen:
            continue
        seen.add(name.lower())
        body = html_to_text(r.get("Description") or "")
        _, emphasis, equipment, tags = classify(name, body)
        emphasis, tags = set(emphasis), set(tags)
        kind = "thang" if "routine" in cat else "exercise"
        tags.discard("routine")
        if kind == "thang":
            tags.add("routine")
        if cat.startswith("ab"):
            emphasis.add("core")
        if "warm" in cat:
            tags.add("warmup")
        if "partner" in cat:
            tags.add("partner")
        items.append({
            "id": "fia-" + slug(name),
            "name": name,
            "text": body,
            "kind": kind,
            "emphasis": sorted(emphasis),
            "equipment": equipment,
            "tags": sorted(tags),
            "source": "fia",
        })
    return items


def main():
    f3, fia = f3_items(), fia_items()
    items = f3 + fia
    items.sort(key=lambda x: x["name"].lower())
    out = {
        "source": "F3 Nation Exicon (https://codex.f3nation.com/exicon) and FiA Lexicon/Exicon",
        "builtAt": date.today().isoformat(),
        "count": len(items),
        "items": items,
    }
    OUT.write_text("// Generated by tools/build_library.py: do not edit by hand.\nwindow.F3_LIBRARY = "
                   + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"Wrote {len(items)} entries to {OUT} ({len(f3)} F3, {len(fia)} FiA)")


if __name__ == "__main__":
    main()
