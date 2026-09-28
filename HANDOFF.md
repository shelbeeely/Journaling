# Handoff: where things stand (late Sep 2026)

## Done
- **Monthly books** for Oct 2026 – Sep 2027, in 5.5×8.5 and 8.5×11 (74–86 pages each), with 0 overflow and no Type 3 fonts.
  - Front matter: key and icon key, care plan, quick contacts, month theme.
  - Each month: calendar, sky, tracker and moon pages, week spreads, day pages, weekly review, exchange pages.
  - Back matter: Looking back, Closing the month (points at the Keeper handoff page), Support, Trans support,
    Safety plan, STA buses (summary + hour grids, 4-page budget), Lineage.
  - Unify Spokane clinic box.
- **Keeper** (50 pages, no scan codes): accounts (hints only), recovery codes, contacts, monthly handoff spreads.
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
  - Today on the sleep screen, with a 12:31 a.m. redraw.
  - Button check-ins and month stats for the Keeper.
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
   - after that: dual boot with CrossPoint, a Closing-the-month walkthrough, and tickable routines
5. **X4 ↔ editor:** optionally let custom Checkboxes/Scale blocks become X4 check-in items. Ask Shelbee first.
6. **Each edition:** re-check the phone numbers in `content/support.json`, `trans.json` and `clinic.json`.
   Refresh the 2027 pay periods once they're confirmed. Order one KDP proof per size before buying copies.

## Decisions (don't undo without asking)
- **Paperback first**, hardcover later (`HARDCOVER=1` pads to 76+). No tear-out pages: KDP can't perforate.
- **Two books:** the monthly book goes out with her, and the Keeper stays home (monthly handoff = the dual system).
- **Day page care row:** "Did something I enjoy" replaced "Went outside", because she's outside daily for work.
- **Firmware** holds the battery latch through deep sleep. That means weeks per charge rather than months, in exchange
  for keeping the clock and the midnight redraw.
