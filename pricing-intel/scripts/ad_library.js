/*
 * Meta Ad Library check: active paid ads that mention Rotorua venues.
 *
 * Usage:
 *   node pricing-intel/scripts/ad_library.js OUT_DIR
 *
 * Reads pricing-intel/config/ad_library.json, searches the public Ad Library
 * (no login; https://www.facebook.com/ads/library/) for each term, keeps ads
 * whose text mentions Rotorua, and writes:
 *   OUT_DIR/ad_library_raw.json  every kept ad, as read
 *   OUT_DIR/11_ad_library.json   observation rows for ingest.py (price_type
 *                                "promotion", price only if the ad states one
 *                                next to an item word; otherwise null)
 * The observation file is reviewed by a person before it is ingested.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'ad_library.json'), 'utf8'));
const OUT = process.argv[2];
if (!OUT) { console.error('usage: node ad_library.js OUT_DIR'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const isoDate = (s) => { const m = /([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/.exec(s || ''); return m ? `${m[3]}-${MONTHS[m[1]]}-${m[2].padStart(2, '0')}` : null; };

function parseAds(text) {
  // Each ad block starts at "Library ID:"; the advertiser name is followed by "Sponsored".
  return text.split('Library ID: ').slice(1).map((blk) => {
    const id = (/^(\d+)/.exec(blk) || [])[1];
    const since = (/Started running on ([A-Z][a-z]{2} \d{1,2}, \d{4})/.exec(blk) || [])[1];
    const sp = blk.indexOf(' Sponsored ');
    const head = sp >= 0 ? blk.slice(0, sp) : '';
    const advertiser = head.split('See ad details').pop().trim();
    let body = sp >= 0 ? blk.slice(sp + 11) : blk;
    body = body.split(/ (System status|Ad Library API|Library ID)/)[0].replace(/​/g, '').trim().slice(0, 700);
    return { id, since: isoDate(since), advertiser, text: body };
  }).filter((a) => a.id && a.advertiser);
}

(async () => {
  const browser = await chromium.launch();
  const ads = new Map();
  const log = [];
  for (const q of CFG.searches) {
    const url = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=' + CFG.country +
      '&q=' + encodeURIComponent(q) + '&search_type=keyword_unordered';
    const page = await browser.newPage({ locale: 'en-NZ' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(5000);
      for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 4000); await page.waitForTimeout(1200); }
      const text = (await page.innerText('body')).replace(/\s+/g, ' ');
      const found = parseAds(text);
      let kept = 0;
      for (const a of found) {
        if (!CFG.keep_if_text_mentions.some((w) => a.text.toLowerCase().includes(w.toLowerCase()))) continue;
        if (!ads.has(a.id)) { ads.set(a.id, { ...a, matched: [q] }); kept++; } else ads.get(a.id).matched.push(q);
      }
      log.push({ q, found: found.length, kept, none: text.includes('No ads match') });
    } catch (e) {
      log.push({ q, error: String(e).slice(0, 120) });
    }
    await page.close();
  }
  await browser.close();

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const list = [...ads.values()];
  fs.writeFileSync(path.join(OUT, 'ad_library_raw.json'), JSON.stringify({ checked: now, log, ads: list }, null, 1));

  const rows = list.map((a) => {
    const map = CFG.advertisers[a.advertiser] || {};
    const channel = CFG.channel_advertisers.some((c) => a.advertiser.toLowerCase().includes(c.toLowerCase()));
    return {
      business: a.advertiser, business_website: null,
      venue_name: map.venue || a.advertiser, area: null, region: 'Rotorua',
      venue_type: map.venue_type || 'other', item_category: 'other', normalised_item: 'other',
      item_name_as_listed: 'Paid ad: ' + a.text.slice(0, 90),
      size_or_serving: null, price_nzd: null, price_type: 'promotion',
      happy_hour_days: null, happy_hour_times: null,
      conditions: a.text, standard_price_if_shown: null, surcharges: null, gst_treatment: 'not_stated',
      source_url: 'https://www.facebook.com/ads/library/?id=' + a.id, source_type: 'paid_ad',
      menu_date_or_last_updated: a.since ? 'ad running since ' + a.since : null,
      verified_at_utc: now, evidence_quote: a.text.slice(0, 300), confidence: 'A',
      notes: (channel ? 'Third-party channel ad. ' : '') + 'Active paid ad in Meta Ad Library (NZ), matched searches: ' + a.matched.join(', ') + '.',
    };
  });
  fs.writeFileSync(path.join(OUT, '11_ad_library.json'), JSON.stringify(rows, null, 1));
  console.log(JSON.stringify({ searches: log.length, errors: log.filter((l) => l.error).length, ads_kept: list.length }));
  for (const a of list) console.log(`- ${a.id} | ${a.advertiser} | since ${a.since} | ${a.text.slice(0, 140)}`);
})();
