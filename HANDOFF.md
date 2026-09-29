# Handoff: where things stand (late Sep 2026)

## Shelbee's build (moved here from the old README)
The product is **Journalwright Studio**; *Keeping Watch* is Shelbee's own book (her profile). Her year is Oct 2026 to Sep 2027:
12 monthly books for Amazon KDP (5.5x8.5 and 8.5x11), the yearly Keeper, X4 EPUBs and the day page editor, plus the X4 firmware.
- Setup takes about 20 minutes: [SETUP.md](SETUP.md).
- Her books, from her calendars (never committed; they live in `journal/private/`):

      cd journal && npm ci && npx playwright-core install chromium && pip install pillow
      ICS=private/main.ics,private/birthdays.ics ./build-all.sh
      ./build-all.sh                                   # sample books from test.ics (check-identical must stay 24/24)
      node editor/build.mjs && open editor/dist/site/index.html
- Firmware: `cd x4/host && ./preview.sh` (every screen as PNG), then
  `git clone https://github.com/Free-Ink/freeink-sdk ../../freeink-sdk && cd .. && pio run -e x4`.
- CI: Books, Firmware, Editor (tests + the site on Pages) and STA schedules (monthly PR).

## Site and Pages (added with the README and website unit)
- `site/` is the product website (plain HTML/CSS/JS). `site/build.sh` assembles it and runs `site/check-links.mjs`; sample page images come from
  `site/make-samples.py` (generic profile + `test.ics`); `site/tools/build-docs.mjs` turns the methods library and BUILD-PLAN into `/docs/`.
- The Editor workflow publishes one Pages site (per BUILD-PLAN section 12, nothing else deploys to the root): `/` the website, `/editor/` a demo of
  the editor (generic profile, sample data, never saves anywhere, banner says so; `MODE 'demo'` in `journal/editor/template.html`), `/docs/`,
  and `/app/` the working editor that saves in the browser and commits with a token.
  **The working editor moved from the site root to `/app/`.** Update any bookmark. If `EDITOR_PAGES_REPO` is set, the whole site goes to that repo.
- The demo is built by `KW_PROFILE=content/profile.example.json KW_OUT=out-demo EDITOR_DIST=editor/dist-demo/ node editor/build.mjs`.
- The site's editor section describes the book-first zoom (book, spread, day) and has no editor screenshots, so it will not go stale.
- Roadmap rows for book scopes, versioning and accounts say "Coming" on the site and in the README; change them when those land on main.
- Before a public launch: pick the license, check trademark and domain for the name, fill in credits.

## Done
- **Monthly books** for Oct 2026 – Sep 2027, in 5.5×8.5 and 8.5×11 (74–86 pages each), with 0 overflow and no Type 3 fonts.
  - Busy days degrade instead of spilling: month cells and week rows cap at a few lines with "+N more". `node test-busy.mjs` (CI) checks it.
  - Front matter: key and icon key, care plan, quick contacts, month theme.
  - Each month: calendar, sky, tracker and moon pages, week spreads, day pages, weekly review, exchange pages.
  - Back matter: Looking back, Closing the month (points at the Keeper handoff page), Support, Trans support,
    Safety plan, STA buses (summary + hour grids, 4-page budget), Lineage.
  - Unify Spokane clinic box.
- **Profile** (`journal/content/profile.json`): names, branding, location, timezone, day start, trim and module switches live in
  one file; a generic `profile.example.json` builds a clean book (`node test-profile.mjs`, CI). Content packs are still Shelbee's files
  named by the profile's `paths` (Phase F unit 2). The firmware keeps its own `DAY_STARTS_HOUR`; the pack carries the profile's value.
- **Keeper** (50 pages, no scan codes): accounts (hints only), where recovery codes are kept, contacts, monthly handoff spreads.
- **Day page editor**, layout v2, with 28 block types + 8 presets, in 5 groups:
  - From your day
  - Check-ins: care grid, spoons, checkboxes, scales, words to circle, sensory load, sleep times, blanks, weather and air
  - Writing: lined notes, small good things, two columns, top priorities, sketch box
  - Planning: time blocks, work shift, bus plan, spending, reach out
  - Layout: dividers, space

  How it works:
  - Drag from the palette onto the list or straight onto the page. Reorder, switch off, remove and undo.
  - Live preview at both sizes, with a writing-space meter.
  - Two builds: GitHub Pages (commits `content/daypage.json`) and a Claude Artifact.
- **X4 firmware:** compiles (RAM 53 KB, flash 1.47 MB), and every screen renders in the host preview.
  - Today on the sleep screen, with a 4:31 a.m. redraw (the day starts at 4 a.m.).
  - Button check-ins (spoons left, sleep, anxiety, care ticks) and month stats for the Keeper.
  - Hold Back for Support.
  - Wi-Fi hotspot page: set the clock, download books and logs, edit the safety plan, upload packs.
  - Books library on the SD card.
- **CI:** Books (encrypted when personal), Firmware (image + previews + tag releases), Editor (tests + Pages),
  STA schedules (monthly PR).

## Next, in order
1. **First CI run.** Push, add the secrets (SETUP.md) and get all four workflows green. Likely snags:
   - Playwright system deps
   - `pio` platform download
   - esptool `merge_bin` paths
   - Pages permissions
2. **STA feed.** The books use a feed ending 2027-01-16, and spokanetransit.com/gtfs now serves a Sep 2026 upload.
   Run the STA schedules workflow and see whether its end date is later. Check that `GRID_PRIORITY` routes still exist, then rebuild.
3. **Editor follow-ups:**
   - a week-spread editor using the same block approach
   - per-month layouts (`content/daypage-2027-01.json` overriding the year default)
   - a guard in `render.mjs` that fails the build when a custom layout overflows, pointing at the block
   - a "print test page" button that renders one real day to PDF
4. **X4 hardware bring-up** (x4/CLAUDE.md "Open work"):
   - buttons and holds
   - refresh quality
   - deep-sleep current
   - timer-wake drift over a few nights
   - web upload speed
   - after that: dual boot with CrossPoint and a Closing-the-month walkthrough
5. **X4 ↔ editor:** optionally let custom Checkboxes/Scale blocks become X4 check-in items. Ask Shelbee first.
6. **Each edition:** re-check the phone numbers in `content/support.json`, `trans.json` and `clinic.json`.
   Refresh the 2027 pay periods once they're confirmed. Order one KDP proof per size before buying copies.

## Decisions (don't undo without asking)
- **Paperback first**, hardcover later (`HARDCOVER=1` pads to 76+). No tear-out pages: KDP can't perforate.
- **Two books:** the monthly book goes out with her, and the Keeper stays home (monthly handoff = the dual system).
- **Day page care row:** "Did something I enjoy" replaced "Went outside", because she's outside daily for work.
- **The care split (approved 2026-09-28, built in the `claude/care-split` PR):** paper = meds, meals, water, mood (dots numbered −3…+3,
  middle marked), work shift, routines, events, writing, safety plan (source of truth). X4 = spoons *left*, sleep, anxiety, shower, teeth,
  joy, texted, snack; custom check-ins on both. The day page's default layout changed on purpose (see the PR). The six month-end boxes
  (Avg mood, Meds taken, Avg meals, Work hours from the paper tracker; Avg sleep, Good-spoon days from X4 This month) are defined once in
  `journal/handoff.mjs` and printed identically on the Closing page and the Keeper. Old X4 logs keep their keys and still read.
- **Firmware** holds the battery latch through deep sleep. That means weeks per charge rather than months, in exchange
  for keeping the clock and the midnight redraw.
