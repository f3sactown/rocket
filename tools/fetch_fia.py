#!/usr/bin/env python3
"""Download the FiA Lexicon/Exicon Google Sheet and save it as source/fia-lexicon.csv.

Usage:  python3 tools/fetch_fia.py [--csv downloaded.csv] [--out source/fia-lexicon.csv]

The sheet ("FiA Lexicon/Exicon 2026", tab "Lexicon") is shared as "anyone with the
link can view", so its CSV export downloads without signing in. It has
Name, Category, Description columns; tools/build_library.py turns the exercise and
routine rows into library entries with the FiA badge (TERM rows are left out).
Pass --csv to read a CSV you downloaded yourself (File > Download > CSV).

It exits with an error (and writes nothing) if the sheet's columns changed or the
row count looks wrong, so a scheduled run never commits a broken library.
"""
import argparse
import csv
import io
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHEET_ID = "1-aBi3UGOwhGChtKEFdVjikbqfcCWP35mcoKqqxqKssI"
GID = "1132183543"  # the "Lexicon" tab
URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}"
MIN_ROWS = 100      # the sheet has ~380 rows; far fewer means something changed
MAX_DROP = 0.2      # refuse to lose more than 20% of the rows already saved


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "rocket-fia-refresh (+https://rocket.f3sactown.com)"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read().decode("utf-8-sig")


def read_rows(text: str) -> list:
    reader = csv.DictReader(io.StringIO(text))
    cols = [c.strip().lower() for c in reader.fieldnames or []]
    if not {"name", "category", "description"} <= set(cols):
        sys.exit(f"Unexpected columns {reader.fieldnames}: the FiA sheet layout has changed.")
    rows = []
    for r in reader:
        r = {k.strip().lower(): (v or "").strip() for k, v in r.items() if k}
        if r.get("name"):
            rows.append({"Name": r["name"], "Category": r["category"], "Description": r["description"]})
    return rows


def existing_count(path: Path) -> int:
    if not path.exists():
        return 0
    with open(path, encoding="utf-8", newline="") as f:
        return sum(1 for _ in csv.DictReader(f))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", help="read a CSV export you downloaded instead of downloading it")
    ap.add_argument("--out", default=str(ROOT / "source" / "fia-lexicon.csv"))
    args = ap.parse_args()

    text = Path(args.csv).read_text(encoding="utf-8-sig") if args.csv else fetch(URL)
    rows = read_rows(text)
    out = Path(args.out)
    before = existing_count(out)
    if len(rows) < MIN_ROWS:
        sys.exit(f"Only {len(rows)} rows found (expected at least {MIN_ROWS}); not writing.")
    if before and len(rows) < before * (1 - MAX_DROP):
        sys.exit(f"Row count fell from {before} to {len(rows)}; not writing.")

    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["Name", "Category", "Description"], quoting=csv.QUOTE_ALL)
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows to {out} (was {before})")


if __name__ == "__main__":
    main()
