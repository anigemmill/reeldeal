"""Ingest a research run into the append-only observation store.

Usage:
    python3 -I pricing-intel/scripts/ingest.py RUN_ID RAW_DIR

RAW_DIR holds the JSON arrays written by the research step (one file per
segment, named NN_segment.json). Raw files are copied to data/raw/RUN_ID/
as evidence. Rows are appended to data/observations.csv; existing rows are
never edited or removed. A run can only be ingested once.
"""
import csv
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OBS = DATA / "observations.csv"
RUNS = DATA / "runs.csv"

# Segment tells us where a venue sits relative to the client.
SEGMENTS = {
    "01_te_puia": ("client", "Client (Te Puia)"),
    "02_attractions": ("direct", "Rotorua attractions"),
    "03_town_cafes": ("indirect", "Rotorua town cafés"),
    "04_happy_hours": ("indirect", "Rotorua bars and hotels"),
    "05_regional": ("benchmark", "Regional and national benchmarks"),
    "06_eat_streat": ("indirect", "Eat Streat and central Rotorua"),
    "07_restaurants_a": ("indirect", "Rotorua restaurants"),
    "07_restaurants_b": ("indirect", "Rotorua restaurants"),
    "08_bars": ("indirect", "Rotorua bars and hotels"),
}

FIELDS = [
    "observation_id", "run_id", "segment", "competitor_class",
    "business", "business_website", "venue_name", "area", "region", "venue_type",
    "item_category", "item_name_as_listed", "normalised_item", "size_or_serving",
    "price_nzd", "price_type", "happy_hour_days", "happy_hour_times", "conditions",
    "standard_price_if_shown", "surcharges", "gst_treatment",
    "source_url", "source_type", "menu_date_or_last_updated", "verified_at_utc",
    "evidence_quote", "confidence", "notes",
]

VALID_CONF = {"A", "B", "C"}


def obs_id(row):
    key = "|".join(str(row.get(k) or "") for k in (
        "venue_name", "item_name_as_listed", "size_or_serving", "price_type",
        "price_nzd", "source_url", "verified_at_utc"))
    return hashlib.sha1(key.encode()).hexdigest()[:12]


def clean(row, run_id, seg_key):
    out = {k: row.get(k) for k in FIELDS}
    out["run_id"] = run_id
    out["segment"] = SEGMENTS[seg_key][1]
    cls = SEGMENTS[seg_key][0]
    notes = (row.get("notes") or "").lower()
    if cls == "benchmark":
        cls = "national_premium_benchmark" if "national_premium" in notes else "regional_benchmark"
    # A visitor attraction's café or bar is a direct competitor whichever list found it.
    if cls == "indirect" and str(row.get("venue_type") or "").startswith("attraction"):
        cls = "direct"
    out["competitor_class"] = cls
    p = row.get("price_nzd")
    out["price_nzd"] = "" if p in (None, "") else round(float(p), 2)
    sp = row.get("standard_price_if_shown")
    out["standard_price_if_shown"] = "" if sp in (None, "") else round(float(sp), 2)
    if out.get("confidence") not in VALID_CONF:
        out["confidence"] = "C"
    if not out.get("source_url"):
        raise ValueError(f"row without source_url rejected: {row}")
    out["observation_id"] = obs_id(out)
    return out


def main(run_id, raw_dir):
    raw_dir = Path(raw_dir)
    if RUNS.exists() and any(r["run_id"] == run_id for r in csv.DictReader(RUNS.open())):
        sys.exit(f"run {run_id} already ingested; observations are append-only")
    dest = DATA / "raw" / run_id
    dest.mkdir(parents=True, exist_ok=True)
    rows, counts = [], {}
    for f in sorted(raw_dir.glob("*.json")):
        seg = f.stem
        if seg not in SEGMENTS:
            print(f"skip unknown segment file {f.name}")
            continue
        shutil.copy2(f, dest / f.name)
        data = json.loads(f.read_text())
        for r in data:
            rows.append(clean(r, run_id, seg))
        counts[seg] = len(data)
    new_file = not OBS.exists()
    with OBS.open("a", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        if new_file:
            w.writeheader()
        w.writerows(rows)
    new_runs = not RUNS.exists()
    with RUNS.open("a", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["run_id", "ingested_at_utc", "rows", "segments"])
        if new_runs:
            w.writeheader()
        w.writerow({"run_id": run_id,
                    "ingested_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "rows": len(rows), "segments": json.dumps(counts)})
    print(f"ingested {len(rows)} rows into {OBS.relative_to(ROOT.parent)}: {counts}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
