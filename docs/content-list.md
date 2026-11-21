# Website content list

Every placeholder picture, video and bracketed gap on the public website, with the size to
deliver. Measured on the built site at 1440px (desktop) and 390px (phone) on 2026-11-16.

All imagery on the site is currently drawn placeholder art from 9 scenes in
`src/content/media.ts`, repeated across 102 desktop slots. To swap in real media, set `src`
(and `poster` for video) on an entry there; pages reference ids and need no changes. New
shots need new entries in that file.

## How sizes were worked out

- **Slot**: the largest size the picture is shown at on any screen (CSS pixels).
- **Deliver**: at least 2× the slot for sharp screens, rounded to a standard format. Every
  slot crops to fill (`object-cover`), so keep the subject centred with some margin.
- **Video**: H.264 MP4, muted, 6–15 s seamless loop, under ~4 MB, plus a poster frame (JPG
  or WebP) at the same size. Stills: JPG or WebP, under ~400 KB.

## Summary

| Page | Videos | Stills | Total |
|---|---:|---:|---:|
| Home | 12 | 25 | 37 |
| Product | 1 | 27 | 28 |
| Solutions (Tourism) | 0 | 13 | 13 |
| Showcase | 13 | 0 | 13 |
| About | 0 | 3 | 3 |
| **All pages** | **26** | **68** | **94** |

**94 slots in total.** Many small thumbnails can reuse frames from the bigger shots, so a
practical shoot is about **35–40 distinct shots**. Plan for: 12–14 short vertical clips,
about 15 landscape hero-quality stills or clips, and 4 interiors or food and drink.
Showcase needs **13 real finished videos** with the customers' permission.

## Home (`/`)

| Section | Pieces | Type | Shape | Slot (largest) | Deliver |
|---|---:|---|---|---|---|
| Hero arc (12 tiles; the centre tile plays) | 12 | Video + poster | Portrait 3:4 | 538 × 550 | 1080 × 1440 |
| Prompt wall, small cards | 14 | Still | Portrait 3:4 | 174 × 230 | 720 × 960 |
| Prompt wall, featured card (rotates) | 4 | Still (video optional) | Portrait 3:4 | 340 × 450 | 1080 × 1440 |
| Bento: Autopilot phone screen | 1 | Still | Tall 9:19.5 | 194 × 394 | 600 × 1300 |
| Bento: Studio preview | 1 | Still | Landscape 16:9 | 332 × 187 | 1280 × 720 |
| Bento: library search tile | 1 | Still | Square | 308 × 300 | 800 × 800 |
| Bento: batch versions stack | 3 | Still | Portrait 4:5 | 92 × 112 | 400 × 500 |
| Tourism panel | 1 | Still | Landscape 5:4 | 690 × 560 | 1600 × 1300 |

## Product (`/product`)

| Section | Pieces | Type | Shape | Slot (largest) | Deliver |
|---|---:|---|---|---|---|
| Hero editor: main preview | 1 | Still | Landscape 3:2 | 622 × 415 | 1600 × 1067 |
| Hero editor: clip thumbnails | 4 | Still | Wide 2:1 | 181 × 87 | 480 × 240 |
| Autopilot phones: footage grid | 6 | Still | Square | 52 × 52 | 200 × 200 |
| Autopilot phones: option cards | 2 | Still | Wide 2:1 | 164 × 80 | 400 × 200 |
| Brand intelligence orbit | 10 | Still | Landscape 3:2 | 92 × 60 | 240 × 160 |
| Media library results | 4 | Still | Landscape 4:3 | 288 × 216 | 800 × 600 |
| Export: one shot shown in 4 shapes | 1 | Still (or video) | Shoot 16:9, safe for 9:16 | 256 × 195 | 1920 × 1080 with a centred subject |

## Solutions: Tourism (`/solutions/tourism`)

| Section | Pieces | Type | Shape | Slot (largest) | Deliver |
|---|---:|---|---|---|---|
| Hero image | 1 | Still | Square | 675 × 669 | 1400 × 1400 |
| Hero thumbnails | 3 | Still | Portrait 3:4 | 80 × 108 | 240 × 320 |
| Find your fit: one per segment (tours, accommodation, attractions, hospitality, destinations) | 5 | Still | Landscape 5:3 | 726 × 440 | 1600 × 970 |
| Seasons (peak, shoulder, winter, events) | 4 | Still | Landscape 4:3 | 286 × 220 | 800 × 600 |

## Showcase (`/showcase`)

| Section | Pieces | Type | Shape | Slot (largest) | Deliver |
|---|---:|---|---|---|---|
| Gallery (masonry, 308px columns) | 12 | Finished video + poster | Native shape: 9:16, 4:5, 1:1 or 16:9 | 308 × 240–460 | Video as published; poster 640px wide |
| Featured story | 1 | Video + poster | Landscape 4:3 | 690 × 520 | 1600 × 1200 |

These are currently invented samples, labelled as such on the page. Real entries need the
business's name, industry, format, length and whether it was made in Autopilot or Studio.

## About (`/about`)

| Section | Pieces | Type | Shape | Slot (largest) | Deliver |
|---|---:|---|---|---|---|
| Gallery, wide | 1 | Still | Landscape 5:4 | 582 × 460 | 1600 × 1260 |
| Gallery, narrow | 1 | Still | Portrait 2:3 | 291 × 460 | 800 × 1260 |
| Gallery, medium | 1 | Still | Portrait 4:5 | 379 × 460 | 1000 × 1260 |

## Copy and details still bracketed

| Where | Gap |
|---|---|
| Every page (footer) | `[NEWSLETTER PROVIDER]`: mailing-list service for sign-ups |
| Footer | `[LINKEDIN URL]` (Instagram links to theoutsidein.nz for now) |
| Showcase | `[CUSTOMER VIDEOS]`; featured story `[Customer]`, story text, `[N]` clips, `[N]` videos, `[T]` time |
| Demo | `[BOOKING PROVIDER]`: Cal.com chosen; booking link still needed |
| Site-wide | Confirm the name "Reeldeal" |

## Not yet on the site

- **Social share images:** none yet. When added, 1200 × 630 per page (7 pages).
- **Privacy and Terms:** linked from the footer but not built (`/privacy`, `/terms`).
- **More industries and Agencies:** `/solutions/agencies` and `/solutions` are linked but not built.
