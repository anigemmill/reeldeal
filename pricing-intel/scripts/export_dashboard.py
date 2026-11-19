"""Write the dashboard's data file for one run.

Usage:
    python3 -I pricing-intel/scripts/export_dashboard.py RUN_ID

Writes pricing-intel/dashboard/data.json: every observation in the run with
short field names. The page computes its statistics from these rows with the
same rules as analyse.py (standard prices, A/B confidence, one price per venue).
"""
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAP = {
    "id": "observation_id", "cls": "competitor_class", "seg": "segment", "venue": "venue_name",
    "biz": "business", "area": "area", "region": "region", "vtype": "venue_type",
    "cat": "item_category", "item": "normalised_item", "listed": "item_name_as_listed",
    "size": "size_or_serving", "price": "price_nzd", "ptype": "price_type",
    "hhDays": "happy_hour_days", "hhTimes": "happy_hour_times", "cond": "conditions",
    "std": "standard_price_if_shown", "sur": "surcharges", "url": "source_url",
    "stype": "source_type", "menuDate": "menu_date_or_last_updated", "checked": "verified_at_utc",
    "quote": "evidence_quote", "conf": "confidence", "notes": "notes",
}


def num(v):
    try:
        return round(float(v), 2) if v not in ("", None) else None
    except ValueError:
        return None


# Names one venue was recorded under in different runs.
ALIASES = {"Artisan": "Artisan Cafe & Restaurant"}


def main(run_id):
    """Each venue's rows from the latest run up to RUN_ID that checked it."""
    runs = [r["run_id"] for r in csv.DictReader((ROOT / "data" / "runs.csv").open())]
    runs = runs[: runs.index(run_id) + 1]
    by_venue = {}
    with (ROOT / "data" / "observations.csv").open() as fh:
        for r in csv.DictReader(fh):
            if r["run_id"] not in runs:
                continue
            r["venue_name"] = ALIASES.get(r["venue_name"], r["venue_name"])
            o = {k: (r[v] or None) for k, v in MAP.items()}
            o["price"], o["std"] = num(r["price_nzd"]), num(r["standard_price_if_shown"])
            o["run"] = r["run_id"]
            by_venue.setdefault(o["venue"], {}).setdefault(r["run_id"], []).append(o)
    rows = []
    for per_run in by_venue.values():
        latest = max(per_run, key=runs.index)
        rows.extend(per_run[latest])
    out = {"run": run_id, "runs": runs, "exported": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "rows": rows}
    path = ROOT / "dashboard" / "data.json"
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {len(rows)} rows, {path.stat().st_size // 1024} KB to {path.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main(sys.argv[1])
