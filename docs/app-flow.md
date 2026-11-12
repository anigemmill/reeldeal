# App flow — editing and processing

Design files in `design/app/`. All screens share `AppNav` (left sidebar) except Studio, which is
full-screen focus mode.

```
Library → Clip detail → Generate → Storyboard → Studio (optional) → Render and export
```

| Screen | File | What it does | Key states |
|---|---|---|---|
| Library | `A-Library.dc.html` | Upload footage, watch processing, browse and filter analysed clips | Uploading → Analysing → Ready; per-file and batch progress; AI picks filter |
| Clip detail | `A-Clip.dc.html` | AI analysis of one clip | Detected moments (click to seek), scene strip, score and quality meters, tags, "good for" |
| Generate | `A-Generate.dc.html` | AI builds storyboards from a brief | 6 stages, progress ring, activity log, footage being picked; ends with "Review 3 storyboards" |
| Storyboard | `A-Storyboard.dc.html` | Compare options, swap shots, edit on-screen text, choose formats | Credits update as formats are toggled; free preview |
| Studio | `A-Studio.dc.html` | Dark editor | Play/pause playhead, aspect switch, clip select → Inspector, Assistant chat, Versions |
| Render and export | `A-Render.dc.html` | Cloud render queue, history, export settings, review link | Rendering → Ready; queued formats; free re-render after platform failure |

Earlier Autopilot (mobile) screens and the theme settings screen are in `design/explorations/`.
They still represent the intended Autopilot mobile flow, restyled to Crossroads Blue when built.

## Credit rules surfaced in the UI
- Storyboard previews: free
- Render: 1 credit per standard video up to 60s (see `config/pricing.json` for the full table)
- Each extra aspect ratio or creative variation: +1 credit
- Minor revisions: up to three included
- Failed render on our side: free
- Always show the credit cost before an action that spends credits

## Sidebar usage meters
Videos left, media analysis hours, storage. Values come from the user's plan (`config/pricing.json`)
and usage records.
