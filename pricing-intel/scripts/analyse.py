"""Analyse one run: market stats, client position, happy hours, changes.

Usage:
    python3 -I pricing-intel/scripts/analyse.py RUN_ID

Writes reports/RUN_ID/{summary.json, item_stats.csv, client_position.csv,
happy_hours.csv, changes.csv, comparability.csv, competitor_matrix.xlsx}.

Rules (see README):
- Market statistics use only standard prices with confidence A or B.
- One price per venue per item: the lowest standard price listed for that
  item (normally the regular size), so a venue with three sizes does not
  count three times.
- Happy-hour, promotion and package prices are never mixed into standard
  price statistics.
"""
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OBS = ROOT / "data" / "observations.csv"

CLIENT = "client"
ROTORUA = ["direct", "indirect"]
MARKETS = {
    "Rotorua (all)": lambda d: d["competitor_class"].isin(ROTORUA),
    "Rotorua attractions": lambda d: d["competitor_class"] == "direct",
    "Rotorua town": lambda d: d["competitor_class"] == "indirect",
    "Regional + national": lambda d: d["competitor_class"].str.endswith("benchmark"),
}
# Comparability weights (0-100). Shown in the report.
WEIGHTS = {"same_item": 40, "serving_size": 25, "venue_context": 20, "evidence_quality": 15}
MIN_CHANGE_ABS, MIN_CHANGE_PCT = 0.50, 0.03


def load():
    df = pd.read_csv(OBS, dtype=str, keep_default_na=False)
    for c in ("price_nzd", "standard_price_if_shown"):
        df[c] = pd.to_numeric(df[c].replace("", None), errors="coerce")
    return df


def per_venue(d):
    """One price per venue per item: lowest standard price listed."""
    return (d.groupby(["venue_name", "normalised_item"], as_index=False)
             .agg(price=("price_nzd", "min"), competitor_class=("competitor_class", "first"),
                  venue_type=("venue_type", "first"), region=("region", "first"),
                  confidence=("confidence", "min"), size=("size_or_serving", "first"),
                  source_url=("source_url", "first")))


def item_stats(std_ab):
    pv = per_venue(std_ab[std_ab["competitor_class"] != CLIENT])
    out = []
    for mkt, f in MARKETS.items():
        sub = pv[f(pv)]
        for item, g in sub.groupby("normalised_item"):
            p = g["price"]
            out.append({"market": mkt, "item": item, "venues": len(g),
                        "min": p.min(), "p25": p.quantile(.25), "median": p.median(),
                        "p75": p.quantile(.75), "max": p.max()})
    return pd.DataFrame(out).round(2), pv


def client_position(std_ab, pv):
    cl = per_venue(std_ab[std_ab["competitor_class"] == CLIENT])
    rows = []
    for _, r in cl.iterrows():
        comp = pv[(pv["normalised_item"] == r["normalised_item"]) & pv["competitor_class"].isin(ROTORUA)]
        if comp.empty:
            rows.append({"item": r["normalised_item"], "venue": r["venue_name"], "client_price": r["price"],
                         "rotorua_venues": 0})
            continue
        med = comp["price"].median()
        att = comp[comp["competitor_class"] == "direct"]["price"]
        rows.append({
            "item": r["normalised_item"], "venue": r["venue_name"], "client_price": r["price"],
            "rotorua_venues": len(comp), "rotorua_median": round(med, 2),
            "diff_nzd": round(r["price"] - med, 2), "diff_pct": round((r["price"] / med - 1) * 100, 1),
            "share_of_rotorua_venues_cheaper_pct": round((comp["price"] < r["price"]).mean() * 100),
            "attractions_venues": len(att),
            "attractions_median": round(att.median(), 2) if len(att) else None,
            "rotorua_min": comp["price"].min(), "rotorua_max": comp["price"].max(),
        })
    return pd.DataFrame(rows)


def happy_hours(run):
    hh = run[run["price_type"] == "happy_hour"].copy()
    std = run[(run["price_type"] == "standard") & run["price_nzd"].notna()]
    std_min = std.groupby(["venue_name", "normalised_item"])["price_nzd"].min()
    def base(r):
        if pd.notna(r["standard_price_if_shown"]):
            return r["standard_price_if_shown"], "shown with offer"
        k = (r["venue_name"], r["normalised_item"])
        if k in std_min.index and r["normalised_item"] != "other":
            return std_min[k], "venue's standard menu (same item type; size may differ)"
        return None, None
    b = hh.apply(lambda r: pd.Series(base(r), index=["standard_price", "standard_basis"]), axis=1) \
        if len(hh) else pd.DataFrame(columns=["standard_price", "standard_basis"])
    hh = pd.concat([hh, b], axis=1)
    hh["discount_nzd"] = (hh["standard_price"] - hh["price_nzd"]).round(2)
    hh["discount_pct"] = ((1 - hh["price_nzd"] / hh["standard_price"]) * 100).round(1)
    cols = ["venue_name", "competitor_class", "region", "venue_type", "happy_hour_days", "happy_hour_times",
            "normalised_item", "item_name_as_listed", "size_or_serving", "price_nzd", "standard_price",
            "standard_basis", "discount_nzd", "discount_pct", "conditions", "confidence",
            "menu_date_or_last_updated", "source_url"]
    return hh[cols].sort_values(["competitor_class", "venue_name"])


def size_score(a, b):
    a, b = (a or "").strip().lower(), (b or "").strip().lower()
    if a and b:
        return WEIGHTS["serving_size"] if a == b else WEIGHTS["serving_size"] * 0.4
    return WEIGHTS["serving_size"] * 0.4 if (a or b) else WEIGHTS["serving_size"] * 0.2


def comparability(std, pv):
    cl = per_venue(std[std["competitor_class"] == CLIENT])
    out = []
    for _, c in cl.iterrows():
        for _, r in pv[pv["normalised_item"] == c["normalised_item"]].iterrows():
            ctx = WEIGHTS["venue_context"] if r["venue_type"] == c["venue_type"] else (
                WEIGHTS["venue_context"] * 0.5 if str(r["venue_type"]).startswith("attraction")
                or str(c["venue_type"]).startswith("attraction") else WEIGHTS["venue_context"] * 0.3)
            ev = {"A": 15, "B": 10}.get(r["confidence"], 0)
            s = WEIGHTS["same_item"] + size_score(c["size"], r["size"]) + ctx + ev
            out.append({"item": c["normalised_item"], "client_venue": c["venue_name"],
                        "competitor": r["venue_name"], "competitor_class": r["competitor_class"],
                        "client_size": c["size"], "competitor_size": r["size"],
                        "score": round(s), "competitor_price": r["price"], "client_price": c["price"]})
    return pd.DataFrame(out).sort_values(["item", "score"], ascending=[True, False]) if out else pd.DataFrame()


ALIASES = {"Artisan": "Artisan Cafe & Restaurant"}
OFFER_TYPES = ("happy_hour", "promotion")


def changes(df, run_id):
    """Changes since each venue's previous check, at the level a reader acts on.

    - Price moves: a venue's lowest A/B price for an item type and price type,
      flagged only past both thresholds. Item wording can differ between
      checks, so items are matched by type, never by their listed name.
    - Offers: a venue that now shows a happy hour or promotion it did not
      show before, or no longer shows one it did.
    Venues are compared only on sources both checks read, so a source one
    check could not reach never reads as a change.
    """
    cols = ["venue_name", "normalised_item", "price_type", "previous", "current",
            "change_nzd", "change_pct", "flag", "previous_run"]
    runs = list(dict.fromkeys(df["run_id"]))
    if runs.index(run_id) == 0:
        return pd.DataFrame(columns=cols)
    df = df.assign(venue_name=df["venue_name"].replace(ALIASES))
    idx = runs.index(run_id)
    cur = df[df["run_id"] == run_id]
    rows = []
    for venue, c in cur.groupby("venue_name"):
        earlier = df[(df["venue_name"] == venue) & df["run_id"].isin(runs[:idx])]
        if earlier.empty:
            continue
        prev_run = max(earlier["run_id"], key=runs.index)
        # Compare only sources both checks actually read.
        shared = set(c["source_url"]) & set(earlier[earlier["run_id"] == prev_run]["source_url"])
        if not shared:
            continue
        c = c[c["source_url"].isin(shared)]
        p = earlier[(earlier["run_id"] == prev_run) & earlier["source_url"].isin(shared)]
        good = lambda d: d[d["confidence"].isin(["A", "B"]) & d["price_nzd"].notna()
                           & (d["normalised_item"] != "other") & (d["price_type"] != "combo_package")]
        pc = good(c).groupby(["normalised_item", "price_type"])["price_nzd"].min()
        pp = good(p).groupby(["normalised_item", "price_type"])["price_nzd"].min()
        for k in pc.index.intersection(pp.index):
            a, b = pp[k], pc[k]
            if abs(b - a) >= MIN_CHANGE_ABS and abs(b / a - 1) >= MIN_CHANGE_PCT:
                rows.append({"venue_name": venue, "normalised_item": k[0], "price_type": k[1],
                             "previous": a, "current": b, "change_nzd": round(b - a, 2),
                             "change_pct": round((b / a - 1) * 100, 1),
                             "flag": "increase" if b > a else "decrease", "previous_run": prev_run})
        had = p["price_type"].isin(OFFER_TYPES).any()
        has = c["price_type"].isin(OFFER_TYPES).any()
        if has and not had:
            rows.append({"venue_name": venue, "flag": "new offer", "previous_run": prev_run})
        elif had and not has:
            rows.append({"venue_name": venue, "flag": "offer no longer shown", "previous_run": prev_run})
    return pd.DataFrame(rows, columns=cols)


def break_even_grid():
    """Volume you can lose after a price rise before contribution falls.

    With contribution margin m (share of the current price) and a price rise
    p, contribution per sale goes from m to m + p, so contribution is unchanged
    when volume retention = m / (m + p). Pure arithmetic: margins here are a
    grid of assumptions until real cost data is supplied.
    """
    rows = []
    for m in (0.4, 0.5, 0.6, 0.7, 0.8):
        for p in (0.05, 0.10, 0.15):
            keep = m / (m + p)
            rows.append({"assumed_margin_pct": int(m * 100), "price_rise_pct": int(p * 100),
                         "break_even_volume_retained_pct": round(keep * 100, 1),
                         "max_volume_loss_pct": round((1 - keep) * 100, 1)})
    return pd.DataFrame(rows)


def main(run_id):
    df = load()
    run = df[df["run_id"] == run_id]
    if run.empty:
        sys.exit(f"no observations for run {run_id}")
    out = ROOT / "reports" / run_id
    out.mkdir(parents=True, exist_ok=True)
    priced = run[run["price_nzd"].notna()]
    std = priced[priced["price_type"] == "standard"]
    std_ab = std[std["confidence"].isin(["A", "B"])]
    stats, pv = item_stats(std_ab)
    pos = client_position(std_ab, pv)
    hh = happy_hours(run)
    comp = comparability(std_ab, pv)
    chg = changes(df, run_id)
    summary = {
        "run_id": run_id,
        "observations": len(run), "priced": len(priced),
        "by_confidence": priced["confidence"].value_counts().to_dict(),
        "by_price_type": priced["price_type"].value_counts().to_dict(),
        "venues": run["venue_name"].nunique(),
        "venues_with_prices": priced["venue_name"].nunique(),
        "venues_by_class": run.groupby("competitor_class")["venue_name"].nunique().to_dict(),
        "happy_hour_venues": hh["venue_name"].nunique(),
        "changes_flagged": int(len(chg)),
        "weights": WEIGHTS,
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2, default=str))
    stats.to_csv(out / "item_stats.csv", index=False)
    pos.to_csv(out / "client_position.csv", index=False)
    hh.to_csv(out / "happy_hours.csv", index=False)
    comp.to_csv(out / "comparability.csv", index=False)
    chg.to_csv(out / "changes.csv", index=False)
    be = break_even_grid()
    be.to_csv(out / "break_even_grid.csv", index=False)
    with pd.ExcelWriter(out / "competitor_matrix.xlsx", engine="openpyxl") as xw:
        pos.to_excel(xw, sheet_name="Te Puia position", index=False)
        stats.to_excel(xw, sheet_name="Market stats", index=False)
        hh.to_excel(xw, sheet_name="Happy hours", index=False)
        comp.to_excel(xw, sheet_name="Comparability", index=False)
        be.to_excel(xw, sheet_name="Break-even grid", index=False)
        run.to_excel(xw, sheet_name="All observations", index=False)
        pd.DataFrame([
            ["Market stats", "Standard prices, confidence A or B only; one price per venue per item (lowest listed)."],
            ["Confidence A", "Official source, current or dated within about 6 months."],
            ["Confidence B", "Official source, undated."],
            ["Confidence C", "Third-party or older than about 6 months. Shown, never used in medians."],
            ["GST", "NZ consumer menu prices are GST-inclusive; all comparisons are GST-inclusive."],
            ["Comparability", json.dumps(WEIGHTS)],
            ["Change alert", f"Both A/B and change >= ${MIN_CHANGE_ABS:.2f} and >= {MIN_CHANGE_PCT:.0%}."],
        ], columns=["Rule", "Detail"]).to_excel(xw, sheet_name="Method", index=False)
    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main(sys.argv[1])
