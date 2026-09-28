# Review: the books and the X4 as one system

Reviewer area: how the monthly book, the Keeper and the X4 work together across a real month.
Findings only. No code or content was changed.

## 1. Scope

- **Built:** `./build-all.sh` from `test.ics`. All 12 months in both sizes plus the Keeper. 24/24 books `[] 0`.
  Books run 74–86 pages.
- **Exported:** `export_pack.py journal /tmp/sd` wrote 12 packs (19–22 KB each), `support.txt`, `checkins.txt`
  (0 items, because there's no `daypage.json`), a starter `me.txt`, and `library/` (62 files, 54 MB).
- **X4:** ran `kw_host` against the real exported Oct/Nov 2026 packs, with a seeded October log (28 logged days).
  - Today on Oct 1, Oct 5 and Oct 31.
  - The 12:31 a.m. sleep redraw on Oct 2.
  - This month on Nov 1 (November first, then ◀ to October).
  - A check-in at 12:40 a.m. on Nov 1.
  - A day with no pack (Dec 1).
  - I also ran `host/preview.sh` on the sample card.
- **Paper looked at (5.5×8.5, 60 dpi):**
  - Oct book pp. 11–17: sky, tracker, moon, week 1 spread, first two day pages.
  - Oct book p. 27 at 100 dpi (a day page).
  - Oct book pp. 68–72: Looking back, Closing, Support, Trans, Safety plan.
  - Keeper pp. 24–25 (the Closing October handoff).
- **Checked in code:**
  - `layout.json` for Oct and Nov in both sizes (page order, codes, zones).
  - The two sizes' `data.json`.
  - `data.cpp`, `app.cpp`, `hal_x4.cpp` upload rules, and `books.yml` packaging.
- **Not covered:** her real calendars. Real data would put shifts, more events per day and birthdays on both paper
  and the X4, and I note below where that matters.

## 2. Findings

Severity: **blocker** = data loss, wrong data or safety; **should fix** = double work, mismatch or confusion;
**nice** = polish.

| id | sev | where | what's wrong | evidence | proposed fix | touches |
|---|---|---|---|---|---|---|
| S1 | blocker | SD card update (README "Copy the `kw` folder to the root") | Copying a fresh export onto the card can wipe her **safety plan** and **check-in logs**. | `export_pack.py` writes a starter `me.txt` into the *output* folder whenever the output has none, so every fresh export carries the blank plan. Copying files over the card replaces the `me.txt` she edited on the Wi-Fi page. A folder "Replace" (e.g. macOS Finder's default) also deletes `/kw/log/*.csv`, the only copy of her check-ins. | Export into `kw-update/` with no `me.txt` and no `log/`. Keep the starter plan only for a first-time card (`--new-card`). README: "copy the files inside, never replace the folder", or use Wi-Fi upload. The firmware could also refuse to overwrite a non-empty `me.txt` from upload. | X4 (tool, docs) |
| S2 | blocker | X4 log is the only copy | Check-ins live only on the SD card, and nothing in the monthly flow backs them up. | Neither the Keeper handoff (p. 24–25) nor the book's Closing page (p. 69) says to download the log. The CSV is reachable only via Wi-Fi sync → download. | Add "Download this month's X4 log (Wi-Fi sync)" to the Closing page step 2 and the Keeper "Keeper updated" checkboxes. | print |
| S3 | should fix | X4 This month vs Keeper p. 24 vs book Closing p. 69 | The X4 totals don't match the boxes they're copied into. | Keeper and book ask for Avg mood, Avg sleep, Showers, **Meds taken**, Good-spoon days, **Work hours**. The X4 shows the first three, then **"Meds, both doses"**, Good-spoon days and **"Enjoyed something"**. The X4 has no work data at all, and "Meds taken" could mean both doses or any dose. | Same six tiles, same order, same labels on all three. Pick one meaning for "Meds taken" (both doses) and print it. Add a work shift item to the X4 (see S4) so Work hours can be totalled, or say on paper "Work hours: from your week spreads". | both |
| S4 | should fix | Day page care row "Sleep & work" / X4 Check in | **Work shift** is on paper (OFF box plus start–end) but not on the X4. For a shift worker it's the one number the Keeper wants that the X4 can't give. | `DEFAULT_ROWS` has `work: {sleep, work}`, while the X4 `ITEMS` has no work item. The week spread also has "work ____–____" per day and a "work hours" habit row, so a shift gets written 2–3 times on paper. | X4: add a "Work" item (off / hours worked as a count, 0–14) and total it on This month. Paper: keep the day page OFF box plus times, and drop the week-spread "work hours" habit row (use the week-left `work ____–____` only). | both |
| S5 | should fix | Mood/sleep/meds/shower/spoons across paper and X4 | The same facts get logged **up to four times**: day page care block, week "Mood line" (p. 15), month tracker (p. 12, with mood dots, sleep, meds, meals, shower, work and spoons per day), and the X4. That's heavy for low-spoon days, and the copies will disagree. | Seen on pp. 12, 15 and 16–17, and in the X4 Check in list. | Make the X4 the source of truth for **numbers** (see the division of labour). On paper, keep the day page boxes (quick ticks when the X4 isn't at hand) and turn the month tracker into a *reading* page: "copy from X4 This month, or skip". Make the weekly Mood line optional (editor). | both |
| S6 | should fix | X4 This month on the 1st | On the day she closes the month, This month opens on the **new, empty** month. | Nov 1 run: every tile "–", with "Copy these to your Keeper, page 26" (November's page). One ◀ gives October with "page 24". | On days 1–7, open on the previous month, or add a "Closing <month>" entry (already open work item 3). | X4 |
| S7 | should fix | X4 This month, 6-row months | The day-30 label/dot overlaps the Keeper footer. | Nov 1 screenshot: "30" sits on "Copy these to your Keeper…". Nov 2026, May 2027 and Aug 2027 need 6 week rows. | Shrink `cellH` to 40 when the month needs 6 rows, or move the footer into the hint bar area. | X4 |
| S8 | should fix | Day boundary (shift work) | A check-in after midnight lands on the **new** day and the new month's file. | At 00:40 on Nov 1, "Evening meds" was written to `log/2026-11.csv` as `2026-11-01T00:40,med_pm,1`. October loses the dose, and so does "Meds, both doses". On paper she'd tick the Oct 31 page she's still living. The sleep screen also flips to the next day at 12:31 a.m. | A "day ends at" setting (default 4:00 a.m.) used for `today()` on Check in and Today. It's cheap and fits late shifts. Until then, README: "press ◀ day first after midnight". | X4 |
| S9 | should fix | X4 Today, "Mood · Anxiety · spoons" | Unlogged values show as real ones. | With mood and spoons logged but not anxiety, the screen reads "Anxiety 0". Untouched spoons read 12 (the default). Paper would be blank. `DayLog::get()` falls back to the default. | Show "–" for any item with no log line (`has(i)`), like the Count rows already do. | X4 |
| S10 | should fix | Pack vs book from different builds | Nothing tells her the X4 and the book disagree. | Neither the book nor the pack carries a build stamp, yet `data.json` has `generated` (it's the only field that differs between the small and letter builds). If she re-runs CI after a calendar change, the X4 shows events the printed book lacks, or the reverse. | Export `built=<generated>` into each pack. Print "Built <date>" small on the title page. Show the pack date on the Wi-Fi page (and the Clock screen). The rule: **the printed book is fixed; the pack may be newer and that's fine for events**. | both |
| S11 | should fix | Custom check-ins and editor changes mid-month | Changing the day page layout mid-month orphans that month's custom log lines. | Keys are `c_<uid>_<slug>`. A new uid or a renamed label gives new keys, and old CSV lines are silently ignored (`itemIndex` −1). Custom items also never reach This month or the Keeper. | Change layouts only at month start (say so in the editor), and have export warn when a key in `/kw/log` no longer exists. | both |
| S12 | should fix | Care row options vs X4 built-ins | Editor care-row settings don't reach the X4. | Paper mood can be 5 steps (`checkin.steps`), and meals 1–4, the water row and turned-off meds boxes are all options. The X4 always has −3…+3, 3 meals, no water, and all meds. The Keeper prints "−3…+3". | Export the `care` row config into `checkins.txt` (hide/show built-ins, meal count, water as a count) and lock mood to 7 steps (the Keeper's scale). | both |
| S13 | should fix | Routines | Routines look tickable on the X4 but aren't. | X4 Today draws routines with an empty checkbox, while paper puts them in Action items as real checkboxes. The X4 can't tick them (open work item 4), so they can only be done on paper. | Until they're tickable on the X4, draw them on the X4 with a clock icon, not a box. Then make paper the place for routines. | X4 |
| S14 | should fix | Scan codes | The page code doesn't say which size, layout or build it came from. | Oct and Nov `layout.json`: the same code (`KW1|2610|026`) is in both sizes with different zone mm (the date zone is x 12.7 in small and 17.5 in letter). A new custom layout also moves zones under the same code. | Add a size letter: `KW1|2610|026|S`. By my count that still fits the 16×16 Data Matrix, but check it. Put a short layout hash in `layout.json`. The app picks the zone map by (yymm, size), not by trusting one file. | print |
| S15 | should fix | Scan join, non-day pages | Only day pages can be joined to dates. | In `layout.json`, week spreads, the tracker, the moon page, the review, the exchange and the closing page are all `type:"page", date:null`. | Give them types (`week_l`, `week_r`, `tracker`, `review`, `closing`…) and a date range (`from`/`to`). | print |
| S16 | should fix | "Where is today's page?" | The X4 can't point at the paper page. | The pack has no page numbers, although `layout.json` has them and they're the same in both sizes (Oct: Oct 5 = p. 26). | Export `page=26` per day, and show "p. 26" small under the date on Today. It makes the paper↔X4 link visible. | X4 (tool) |
| S17 | should fix | Clock after a flat battery | Check-ins can land on the wrong date silently. | `timeValid()` false only changes the sleep footer ("Clock not set"). Check in still saves under the stale date. | On Check in, when the clock isn't set, show a one-line bar "Clock not set: set it first" with Confirm → Clock. | X4 |
| S18 | nice | X4 Today with no pack | The no-pack message shows tofu, and the care strip disappears. | Dec 1 run: "(Menu □ Wi-Fi sync)" is a missing "→" glyph, because `wrap()` is called without `&F_SYM`. Check in still works, but Today hides the care tiles. | Pass `&F_SYM` (or write "Menu, then Wi-Fi sync"). Keep drawing the date plus the care strip without a pack. | X4 |
| S19 | nice | Safety plan: paper vs X4 | Two copies of the plan, and the paper one resets every month. | Every monthly book has a blank "My safety plan" (p. 72), while the X4 has `me.txt` with the same 7 headings. The X4 empty state points to "the safety plan page at the back of your journal". | Treat the X4 `me.txt` as the source of truth, plus one written copy in the Keeper. In monthly books, print "Your plan is on the X4 (hold Back) and in your Keeper. Copy anything new here." above the lines. Export could print `me.txt` onto the page later (private build only). | both |
| S20 | nice | Library on the card | It holds 54 MB of files the X4 can't use. | 62 files, including covers (useless) and EPUBs. This firmware replaces CrossPoint, so EPUBs can't be read on the X4 until dual boot. | Library: interiors of the current size + Keeper only. Skip EPUBs until dual boot lands. | X4 (tool) |
| S21 | nice | Starter `me.txt` text | The header comment gives the wrong path. | It says "(hold Down on the menu → Sync)", but the menu item is **Wi-Fi sync**. | Fix the comment. | X4 (tool) |
| S22 | nice | Pack fields unused | Some pack fields are never shown. | `pioneer`, `prompt` and `newseason` are exported but the X4 never shows them (the paper shows the pioneer on the week spread). The Oct 2 new season at 9:45p is on neither. | Drop them from the pack, or show the prompt on Sunday's Today. Ask first. | X4 |
| S23 | nice | X4 Today caps | Extra events are dropped silently. | Today shows at most 3 notes, 5 notes+events and 6 lines in all. The test data never hits this, but a real shift day (shift, appointment, birthday, pay day, moon phase) can. | Add a "+N more, see p. 26" line when anything is cut. | X4 |

## 3. A month, walked through as Shelbee

Assumes the default day layout, the 5.5×8.5 book in her bag, the Keeper at home and the X4 on the nightstand or in
her bag.

| Moment | Paper | X4 | Double / one place / clash / unclear |
|---|---|---|---|
| **Morning** (before a shift) | Reads nothing yet, or glances at today's page. | The sleep screen already shows today: moon, sun times, season, events, fact. Confirm → Check in → morning meds. | Sky, events and fact are **the same facts** (Oct 5: 26%, 6:54a/6:20p, "Tamaracks turn gold", 2:00p Test appointment on both). Clean. If she also ticks the meds box on paper, that's **double**. |
| **Shift day** | The book goes with her. At break she ticks meals and writes a line. Work times go in the OFF box and times row. | Usually not at hand outside. | **Work exists only on paper** (S4). Meals ticked on paper at work and not on the X4 means This month undercounts: **clash** with no rule for which wins. |
| **Late night after a close** | Writes on the day's page. | Evening meds at 00:40 go to the next day (S8), and at 12:31 a.m. the X4 flips to tomorrow. | **Clash**: paper says Oct 31, the X4 says Nov 1. |
| **Off day** | Longer writing, sketch, words to circle. | Taps meals, shower, teeth, joy and spoons in about 20 seconds. | Fine. The writing is paper-only, which is right. |
| **Hard day** | Maybe nothing. | Hold Back → Support (text-first) → Confirm → safety plan. | Support lists match paper pp. 70–71 (same JSON). Her plan is **in two places** (S19). The X4 is the faster one, which is right. |
| **End of the week** | Week review, mood line, habits grid, exchange. | Nothing weekly. | The Mood line **duplicates** X4 mood (S5). The weekly review is paper-only, which is right. |
| **Closing the month** (last day or 1st) | Book p. 69 asks her to "total the tracker", then copy to the Keeper p. 24. | This month has the totals, but opens on the new month on the 1st (S6). The labels differ (S3), there's no Work hours, the footer overlaps in 6-row months (S7), and nothing says to download the log (S2). | **Unclear**: the paper never mentions the X4, so she may total by hand what the X4 already did. |
| **Keeper handoff** | Keeper pp. 24–25: totals, highs, lows, carry-forward. | Footer: "Copy these to your Keeper, page 24." | That page link is good. The mismatched labels spoil it. |
| **New month** | New book. Carry-forward goes into week 1. | Packs for all 12 months are usually on the card already. A new pack is only needed after a calendar change. Via Wi-Fi: the pack has to be on her phone, which means pulling it out of the password 7z. Via SD: the S1 overwrite risk. | **Unclear hand-off**: no step says whether a re-upload is needed, and nothing shows which build is on the card (S10). |

## 4. Data path, end to end

`render.mjs` writes `out/mYYYY-MM/data.json`. `export_pack.py` turns it into `/kw/YYYY-MM.txt`, and the X4 reads
that with `loadDay()`.

- **Same facts, same date:** yes, for everything I compared (Oct 1, 2, 5 and 31): moon % and sign, ingress time,
  sunrise/set, micro-season, holiday and pay notes, events and routines, and "On this day". Both size builds give the
  same `data.json` apart from `generated`, and the export reads only the small folder.
  - A `SIZES=letter`-only build therefore makes **no pack**. It's worth a warning in `export_pack.py`.
- **Keeper page:** every pack has `keeper=`, which This month uses (Oct → 24, Nov → 26), and it matches the book's
  Closing page and the Keeper.
- **The 1st of a month:** loads the new pack fine, since ◀/▶ across the month edge reads the other file. This month
  is the problem (S6).
- **A day the pack lacks:** a clear message, apart from the tofu, and the care strip is lost (S18). Check in still
  works.
- **Different builds:** undetectable today (S10). Events can differ. Page numbers can't, unless the layout changed.
- **Support:** `support.txt` comes from the same `support.json`, `trans.json` and `clinic.json` as paper pp. 70–71.
  It stays in sync as long as both are rebuilt together.

## 5. Proposed division of labour

| What | Paper (monthly book) | X4 | Source of truth |
|---|---|---|---|
| Sky, season, events, fact, bus times | printed | Today / sleep screen (not bus) | **Build** (`data.json`). Both are copies; the pack may be newer for events |
| Routines | Action item checkboxes | shown, not ticked (until open work item 4) | **Paper** |
| Meds, meals, shower, teeth, joy, texted | quick boxes as a fallback | Check in | **X4**. Paper ticks count only for days with no X4 log |
| Mood, anxiety, spoons, sleep hours | bubbles as a fallback | Check in | **X4** (it does the maths the Keeper needs) |
| Work shift | OFF + times on the day page | add a "Work hours" item (S4) | **Paper** for times, **X4** for the total |
| Month totals | tracker page becomes optional reading | This month | **X4** → copied into the Keeper |
| Writing, reviews, exchange, highs/lows, carry-forward | yes | no | **Paper** |
| Custom editor blocks (checks, scale, habits, fields) | printed | Check in (custom) | **X4** for counts, paper for anything written |
| Safety plan | page in the book (points to the X4) | `me.txt` (hold Back) | **X4 `me.txt`**, with a copy in the Keeper |
| Support numbers | pp. 70–71 | Support | **content JSON**, rebuilt each edition |
| Contacts, hints, recovery codes | Keeper only | never | **Keeper** (never scanned, never on the X4) |
| Scans | page code → `layout.json` | log by date | Join on **date** (plus page code once S14/S15 land). Where a scanned tick and an X4 value disagree, **X4 wins** for numbers and **paper wins** for writing |

## 6. Changes, ranked by value

1. **S1 + S2: stop the card update from destroying data, and back up the log monthly** (X4 tool, docs, print
   Closing/Keeper step). This protects her safety plan and health log.
2. **S3 + S4: one set of six totals everywhere, with Work hours on the X4** (both). It makes the Keeper handoff a
   straight copy.
3. **S5: name the X4 as the tracker of record, and make the paper month tracker and weekly Mood line optional**
   (both). This is the biggest cut in double logging.
4. **S8: "day ends at 4 a.m."** (X4). It fits shift work and fixes month edges.
5. **S6 + S7: This month opens on the month being closed, and no overlap** (X4).
6. **S9 + S17: never show or save a guessed value** (X4).
7. **S10 + S16: build stamp and page number in the pack**, shown on the X4 (tool, X4, print title page).
8. **S14 + S15: size in the page code, and types and dates for every page in `layout.json`** (print).
9. **S11 + S12: editor → X4 parity for care-row options, and a mid-month layout-change warning** (both).
10. **S13, S18–S23: polish** (routines icon, tofu, library size, `me.txt` comment, unused fields, "+N more").

## 7. What's working well (keep)

- **The facts match.** Paper and X4 come from one `data.json`, and they agreed on every field I compared.
- **Keeper page link.** The X4 This month footer names the right Keeper page, and so does the book's Closing page.
- **Support is one hold away** on the X4 and at the back of every book, from the same JSON, text-first on both.
- **Same icons and order** on the paper care block and the X4 Check in: meds, meals, self-care, mood, anxiety,
  spoons.
- **Month-edge browsing** on Today just works across pack files.
- **Wi-Fi upload only accepts known names** (`YYYY-MM.txt`, `support.txt`, `me.txt`, `checkins.txt`, books).
- **The Keeper stays off the scan system and off the X4 data path.** Its PDF in the library is a blank template, so
  nothing leaks.
- **Overflow gate:** 24/24 books pass `[] 0`.

## 8. Open questions for Shelbee

1. When the X4 and a paper tick disagree for the same day, should the X4 win? (Proposed: yes for numbers.)
2. When does your day end on a late shift: midnight, or when you sleep? (That decides the S8 default.)
3. Work: do you want the X4 to log hours worked, or just "worked / off" with hours written on paper?
4. Would you use the month tracker page if the X4 already adds everything up, or should it become optional?
5. Is your real calendar full of shifts as events? If so, the "work ____–____" blanks may be redundant.
6. Should the safety plan in each monthly book be pre-filled from the X4's `me.txt` in private builds?
7. How do you get new packs onto the X4 today: SD card on a computer, or Wi-Fi from your phone?
