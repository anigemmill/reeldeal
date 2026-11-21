# Pricing intelligence

Competitor pricing research for tourism and hospitality operators, run by Claude on request.
First client: **Te Puia, Rotorua**: café items and happy-hour drinks against Rotorua, the region and national benchmarks.

This folder is separate from the Reeldeal app. Nothing here is imported by the Next.js code.

## How a run works

1. **Collect.** Claude researches public sources (official sites and PDF menus first) and writes one JSON array per segment:
   `01_te_puia`, `02_attractions`, `03_town_cafes`, `04_happy_hours`, `05_regional`.
2. **Ingest.** `python3 -I pricing-intel/scripts/ingest.py RUN_ID RAW_DIR`
   copies the raw files to `data/raw/RUN_ID/` as evidence and appends rows to `data/observations.csv`.
3. **Analyse.** `python3 -I pricing-intel/scripts/analyse.py RUN_ID`
   writes `reports/RUN_ID/` (CSV files plus `competitor_matrix.xlsx`).
4. **Dashboard.** `python3 -I pricing-intel/scripts/export_dashboard.py RUN_ID` writes `dashboard/data.json`.
   Claude republishes `dashboard/index.html` with it to the same link:
   https://claude.ai/artifact/NC8B8BA3NYm9XPicq4FU5R

### Paid ads (Meta Ad Library)

Every run also checks Meta's public Ad Library (no login) for active ads from Rotorua food, drink and visitor businesses:

1. `node pricing-intel/scripts/ad_library.js OUT_DIR` runs three passes: keyword searches from `config/ad_library.json`,
   each known advertiser's page of active ads, and every ad in `data/ad_library_seen.json` looked up by ID.
   Keyword search is unreliable for automated visitors, so empty searches are retried and the ID pass is the safety net.
2. A person reviews `OUT_DIR/11_ad_library.json`: drops ads that aren't food, drink or hospitality, and adds priced rows
   for explicit deals, with the price quoted from the ad. `--rebuild OUT_DIR` re-applies the filter without searching again.
3. Ingest it like any other segment, then `node pricing-intel/scripts/ad_library.js --record OUT_DIR` adds the ads to the seen list.

The dashboard shows only ads from the latest check, so ads that stop running drop out. Ordinary Facebook and Instagram
posts need a login and are not collected.

To run again, ask Claude: "run the Te Puia pricing check". Each run gets a new `RUN_ID` (the date), and the changes table compares it with the previous run.

## Rules

- **Nothing invented.** Every price has a source URL, the time it was checked and a short quote copied from the source. Search-engine summaries are not evidence.
- **Add-only history.** Observations are never edited or deleted. A new run appends rows.
- **Confidence grades.**
  - **A:** official source, current or dated within about 6 months.
  - **B:** official source, undated.
  - **C:** third-party, or older than about 6 months.
  Only A and B prices are used in medians. C prices are shown for context only.
- **Like with like.** Happy-hour, promotional and package prices never enter standard-price statistics. Each venue counts once per item, at its lowest listed standard price (normally the regular size).
- **GST.** NZ consumer menu prices are GST-inclusive. All comparisons are GST-inclusive.
- **Respect access limits.** No logins, paywalls or bot-protection workarounds. A site that refuses is recorded as a gap.
- **Change alerts.** A change is flagged only when both prices are grade A or B and the move is at least $0.50 and at least 3%.
- **Closed venues.** A check that finds a venue closed records one row whose notes start with `CLOSED:`; the dashboard then shows only that note for the venue.
- **Human approval.** Recommendations are proposals. Nothing changes a live price.

## Comparability score (0–100)

| Factor | Weight | How it scores |
|---|---|---|
| Same item type | 40 | Always 40 within an item comparison |
| Serving size | 25 | Same stated size 25; size differs or only one is stated 10; neither stated 5 |
| Venue context | 20 | Same venue type 20; one is an attraction venue 10; otherwise 6 |
| Evidence quality | 15 | A 15, B 10, C 0 |

## Revenue modelling

Until Te Puia supplies volumes and costs, the model shows only a **break-even grid**: how much volume a price rise of 5, 10 or 15% can lose before contribution falls, at a range of assumed margins. The formula is retention = m / (m + p). No price elasticity is assumed.

## Files

| Path | What it holds |
|---|---|
| `data/observations.csv` | Every price observation, all runs |
| `data/runs.csv` | One row per run |
| `data/raw/RUN_ID/` | The raw research files for that run |
| `reports/RUN_ID/` | Analysis outputs and the Excel workbook |
| `scripts/` | Ingest, analysis and dashboard export code |
| `dashboard/` | The dashboard page and its data file |
