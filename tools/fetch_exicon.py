#!/usr/bin/env python3
"""Download the F3 Codex Exicon and save it as source/exicon-export.csv.

Usage:  python3 tools/fetch_exicon.py [--html saved-page.html] [--out source/exicon-export.csv]

https://codex.f3nation.com/exicon is a Next.js page that embeds every entry in its
HTML (the React Server Components payload pushed through `self.__next_f`). This
script pulls the `initialEntries` list out of that payload and writes the same
ID,Name,Description,Aliases CSV that the site's Export button produces, ready for
tools/build_library.py. Pass --html to read a saved copy of the page instead of
downloading it.

It exits with an error (and writes nothing) if the page layout changed or the
entry count looks wrong, so a scheduled run never commits a broken library.
"""
import argparse
import csv
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "https://codex.f3nation.com/exicon"
MIN_ENTRIES = 500          # the Exicon has ~1000 entries; far fewer means the page changed
MAX_DROP = 0.2             # refuse to lose more than 20% of the entries already in the CSV


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; rocket-exicon-refresh; +https://rocket.f3sactown.com)",
        "Accept": "text/html",
    })
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read().decode("utf-8")


def flight_payload(page: str) -> str:
    """Join the strings the page pushes into self.__next_f (the RSC flight stream)."""
    chunks = re.findall(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', page)
    if not chunks:
        sys.exit("No Next.js data found in the page: the Exicon layout has changed.")
    return "".join(json.loads(c) for c in chunks)


def text_rows(stream: str) -> dict:
    """Collect the stream's text rows (`<hex id>:T<hex byte length>,<text>`); long
    descriptions are stored there and referenced as "$<hex id>"."""
    # Rows are newline-terminated, except text rows, which run for exactly their
    # byte length and are followed directly by the next row.
    data, rows, i = stream.encode("utf-8"), {}, 0
    row = re.compile(rb"([0-9a-f]*):(T([0-9a-f]+),)?")
    while i < len(data):
        m = row.match(data, i)
        if m and m.group(2):
            start = m.end()
            rows[m.group(1).decode()] = data[start:start + int(m.group(3), 16)].decode("utf-8")
            i = start + int(m.group(3), 16)
        else:
            nl = data.find(b"\n", i)
            i = len(data) if nl < 0 else nl + 1
    return rows


def resolve(value, rows: dict) -> str:
    if not isinstance(value, str):
        return ""
    if value.startswith("$$"):
        return value[1:]
    if re.fullmatch(r"\$[0-9a-f]+", value):
        if value[1:] not in rows:
            sys.exit(f"Description reference {value} not found in the page.")
        return rows[value[1:]]
    return value


def extract(page: str) -> list:
    stream = flight_payload(page)
    key = '"initialEntries":'
    at = stream.find(key)
    if at < 0:
        sys.exit("No initialEntries list in the page: the Exicon layout has changed.")
    entries, _ = json.JSONDecoder().raw_decode(stream, at + len(key))
    rows = text_rows(stream)
    out = []
    for e in entries:
        if not isinstance(e, dict) or not e.get("name"):
            continue
        out.append({
            "ID": e.get("id", ""),
            "Name": e["name"],
            "Description": resolve(e.get("description"), rows),
            "Aliases": "; ".join(a.get("name", "") for a in e.get("aliases") or [] if isinstance(a, dict)),
        })
    return out


def existing_count(path: Path) -> int:
    if not path.exists():
        return 0
    with open(path, encoding="utf-8", newline="") as f:
        return sum(1 for _ in csv.DictReader(f, escapechar="\\"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", help="read a saved copy of the Exicon page instead of downloading it")
    ap.add_argument("--out", default=str(ROOT / "source" / "exicon-export.csv"))
    args = ap.parse_args()

    page = Path(args.html).read_text(encoding="utf-8") if args.html else fetch(URL)
    entries = extract(page)
    out = Path(args.out)
    before = existing_count(out)
    if len(entries) < MIN_ENTRIES:
        sys.exit(f"Only {len(entries)} entries found (expected at least {MIN_ENTRIES}); not writing.")
    if before and len(entries) < before * (1 - MAX_DROP):
        sys.exit(f"Entry count fell from {before} to {len(entries)}; not writing.")
    if sum(1 for e in entries if e["Description"].strip()) < len(entries) * 0.9:
        sys.exit("Most entries have no description: the Exicon layout has changed; not writing.")

    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["ID", "Name", "Description", "Aliases"],
                           quoting=csv.QUOTE_ALL, doublequote=False, escapechar="\\")
        w.writeheader()
        w.writerows(entries)
    print(f"Wrote {len(entries)} entries to {out} (was {before})")


if __name__ == "__main__":
    main()
