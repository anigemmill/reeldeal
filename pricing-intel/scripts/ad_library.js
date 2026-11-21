/*
 * Meta Ad Library check: active paid ads from Rotorua food, drink and visitor businesses.
 *
 * Usage:
 *   node pricing-intel/scripts/ad_library.js OUT_DIR
 *
 * Uses Meta's public Ad Library (no login): https://www.facebook.com/ads/library/
 * Three passes, because keyword search alone misses ads:
 *   1. keyword searches (finds new advertisers)
 *   2. each known advertiser's page of active ads (config advertisers[].page_id)
 *   3. every ad seen in an earlier check (data/ad_library_seen.json), looked up by ID,
 *      so ads still running are kept and ended ads drop out
 * Writes:
 *   OUT_DIR/ad_library_raw.json  every candidate ad with why it was kept or dropped
 *   OUT_DIR/11_ad_library.json   observation rows (price_type "promotion", price null;
 *                                dollar amounts listed in notes for a reviewer)
 * A person reviews 11_ad_library.json, adds priced rows for any explicit deal, then ingests it.
 * After ingest, update data/ad_library_seen.json with `--record OUT_DIR`.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'ad_library.json'), 'utf8'));
const SEEN_PATH = path.join(ROOT, 'data', 'ad_library_seen.json');
const SEEN = fs.existsSync(SEEN_PATH) ? JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8')) : {};

if (process.argv[2] === '--record') {
  // Add the reviewed, ingested ads to the seen list.
  const rows = JSON.parse(fs.readFileSync(path.join(process.argv[3], '11_ad_library.json'), 'utf8'));
  for (const r of rows) { const id = (/id=(\d+)/.exec(r.source_url) || [])[1]; if (id) SEEN[id] = { advertiser: r.business, first_seen: SEEN[id]?.first_seen || r.verified_at_utc.slice(0, 10) }; }
  fs.writeFileSync(SEEN_PATH, JSON.stringify(SEEN, null, 1));
  console.log(`recorded ${Object.keys(SEEN).length} ads in ${SEEN_PATH}`);
  process.exit(0);
}
const OUT = process.argv[2];
if (!OUT) { console.error('usage: node ad_library.js OUT_DIR | --record OUT_DIR'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const isoDate = (s) => { const m = /([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/.exec(s || ''); return m ? `${m[3]}-${MONTHS[m[1]]}-${m[2].padStart(2, '0')}` : null; };
const lc = (s) => (s || '').toLowerCase();
const has = (text, words) => words.some((w) => lc(text).includes(lc(w)));
const ADV = CFG.advertisers;

function parseAds(text) {
  return text.split('Library ID: ').slice(1).map((blk) => {
    const id = (/^(\d+)/.exec(blk) || [])[1];
    const since = (/Started running on ([A-Z][a-z]{2} \d{1,2}, \d{4})/.exec(blk) || [])[1];
    const sp = blk.indexOf(' Sponsored ');
    const advertiser = sp >= 0 ? blk.slice(0, sp).split(/See (?:ad|summary) details/).pop().trim() : '';
    let body = sp >= 0 ? blk.slice(sp + 11) : '';
    body = body.split(/ (System status|Ad Library API|Library ID)/)[0].replace(/​/g, '').replace(/\s+/g, ' ').trim().slice(0, 900);
    return { id, since: isoDate(since), advertiser, text: body };
  }).filter((a) => a.id && a.advertiser);
}

async function readPage(browser, url, scrolls = 6) {
  const page = await browser.newPage({ locale: 'en-NZ' });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);
    for (let i = 0; i < scrolls; i++) { await page.mouse.wheel(0, 4000); await page.waitForTimeout(1200); }
    return (await page.innerText('body')).replace(/\s+/g, ' ');
  } finally { await page.close(); }
}

function judge(a) {
  const known = ADV[a.advertiser];
  if (has(a.text, CFG.exclude_words)) return 'dropped: recruitment or franchise ad';
  if (!known && !has(a.text, CFG.keep_if_text_mentions)) return 'dropped: does not mention Rotorua';
  if (known && known.all_ads) return 'kept: known food or drink venue';
  if (has(a.text, CFG.food_drink_words)) return 'kept: mentions food or drink';
  return 'dropped: no food or drink in the ad';
}

(async () => {
  const browser = await chromium.launch();
  const ads = new Map();
  const log = [];
  const add = (a, how) => { if (!ads.has(a.id)) ads.set(a.id, { ...a, found_by: [how] }); else ads.get(a.id).found_by.push(how); };
  const base = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=' + CFG.country;

  for (const q of CFG.searches) {
    try { const f = parseAds(await readPage(browser, base + '&q=' + encodeURIComponent(q) + '&search_type=keyword_unordered')); f.forEach((a) => add(a, 'search: ' + q)); log.push({ pass: 'keyword', q, found: f.length }); }
    catch (e) { log.push({ pass: 'keyword', q, error: String(e).slice(0, 120) }); }
  }
  for (const [name, a] of Object.entries(ADV)) {
    if (!a.page_id) continue;
    try { const f = parseAds(await readPage(browser, base + '&view_all_page_id=' + a.page_id + '&search_type=page', 10)); f.forEach((x) => add(x, 'advertiser page')); log.push({ pass: 'page', q: name, found: f.length }); }
    catch (e) { log.push({ pass: 'page', q: name, error: String(e).slice(0, 120) }); }
  }
  for (const [id, s] of Object.entries(SEEN)) {
    if (ads.has(id)) continue;
    try {
      const t = await readPage(browser, 'https://www.facebook.com/ads/library/?id=' + id, 0);
      const active = /Close\s*(?:This ad is from a URL link\s*)?Active\b/.test(t.replace(/​/g, ''));
      const f = parseAds(t).filter((x) => x.id === id);
      if (active && f.length) add(f[0], 'earlier ad, still active');
      log.push({ pass: 'by_id', q: `${id} (${s.advertiser})`, active, gone: t.includes("isn't in the Ad Library") });
    } catch (e) { log.push({ pass: 'by_id', q: id, error: String(e).slice(0, 120) }); }
  }
  await browser.close();

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const all = [...ads.values()].map((a) => ({ ...a, verdict: judge(a) }));
  fs.writeFileSync(path.join(OUT, 'ad_library_raw.json'), JSON.stringify({ checked: now, log, ads: all }, null, 1));

  // One row per distinct creative: Meta often runs the same text as several ads.
  const kept = all.filter((a) => a.verdict.startsWith('kept'));
  const byCreative = new Map();
  for (const a of kept) { const k = a.advertiser + '|' + a.text.slice(0, 160); const c = byCreative.get(k); if (!c || (a.since || '') < (c.since || '')) byCreative.set(k, { ...a, copies: (c?.copies || 0) + 1 }); else c.copies++; }

  const rows = [...byCreative.values()].map((a) => {
    const known = ADV[a.advertiser] || {};
    const channel = has(a.advertiser, CFG.channel_advertisers);
    const dollars = [...new Set((a.text.match(/\$\s?\d+(?:\.\d{2})?/g) || []))];
    return {
      business: a.advertiser, business_website: null, venue_name: known.venue || a.advertiser, area: null, region: 'Rotorua',
      venue_type: known.venue_type || 'other', item_category: 'other', normalised_item: 'other',
      item_name_as_listed: 'Paid ad: ' + a.text.slice(0, 90), size_or_serving: null, price_nzd: null, price_type: 'promotion',
      happy_hour_days: null, happy_hour_times: null, conditions: a.text, standard_price_if_shown: null, surcharges: null,
      gst_treatment: 'not_stated', source_url: 'https://www.facebook.com/ads/library/?id=' + a.id, source_type: 'paid_ad',
      menu_date_or_last_updated: a.since ? 'ad running since ' + a.since : null, verified_at_utc: now,
      evidence_quote: a.text.slice(0, 300), confidence: 'A',
      notes: [channel ? 'Third-party channel ad.' : '', `Active paid ad in Meta Ad Library (NZ); found by ${[...new Set(a.found_by)].join('; ')}.`,
        a.copies > 1 ? `Same text runs as ${a.copies} ads.` : '', dollars.length ? `Dollar amounts in ad: ${dollars.join(', ')} (review).` : ''].filter(Boolean).join(' '),
    };
  });
  fs.writeFileSync(path.join(OUT, '11_ad_library.json'), JSON.stringify(rows, null, 1));
  const summary = { checked: now, keyword_searches: log.filter((l) => l.pass === 'keyword').length, advertiser_pages: log.filter((l) => l.pass === 'page').length,
    earlier_ads_rechecked: log.filter((l) => l.pass === 'by_id').length, errors: log.filter((l) => l.error).length, ads_seen: all.length, ads_kept: kept.length, rows: rows.length };
  console.log(JSON.stringify(summary));
  for (const r of rows) console.log(`- ${r.business} | ${r.menu_date_or_last_updated} | ${r.conditions.slice(0, 120)}`);
})();
