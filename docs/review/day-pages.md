# Review: day pages, paper and X4

Reviewer area: the default day page across all 12 months and both sizes, and how it pairs with the X4.
Findings only. No code or content was changed. Ids `S#` point to `docs/review/books-and-x4.md` (PR #31); they are cross-referenced, not repeated.

## 1. Scope

- **Built:** `./build-all.sh` from `test.ics`, all 12 months, both sizes. 24/24 books `[] 0`. Then one extra Oct build from a synthetic busy-day calendar (not committed).
- **Checked in code, every day (365 days, `data.json`):**
  - Dates, weekday name and weekday index against a calendar. All correct, 2026-10-01 to 2027-09-30, no gaps or repeats.
  - Moon: phase advance per day (9–16 deg), lit % against the phase angle, 37 quarter events, 13 new moons. No anomalies.
  - Sun: rise/set jumps. Only two, on the DST days (below). Shortest day 8h25m (Dec 17), longest 15h59m (Jun 17).
  - Micro-seasons: 72 distinct, runs of 4–6 days, no sequence errors, 72 change days.
  - Holidays: 23, dates checked by hand (Thanksgiving Nov 26, MLK Jan 18, Easter Mar 28, Juneteenth observed Jun 18, July 4 observed Jul 5, Labor Day Sep 6). All right.
  - "On this day": 365 of 365 present, none repeated, longest 113 characters (two lines).
  - Weeks: 53 weeks, each owned by exactly one book. 53 pioneers, 53 prompts, 53 Japanese words: none missing, none repeated. A week that spans two books gets the same word and prompt in both.
  - `layout.json`, both sizes: page codes unique within each book; every day page has the same zone set.
- **Looked at (PNG, 60 dpi contact sheets, plus 90–220 dpi zooms):** 2 normal days per month (3rd, 16th), the busiest day per month, and the edge days: Oct 6 (routine), Oct 31, Nov 1 (DST end), Nov 17, Dec 14, Dec 31, Jan 1 (New Year), Feb 6, Feb 28, Mar 14 (DST start), Sep 6, Sep 30. Both sizes for all of them.
- **X4:** `host/preview.sh` on the sample card: sleep/Today screen and Check in list, read against `data.cpp`, `app.cpp` and `export_pack.py`.
- **Not covered:** her real calendars (busy days, shifts, birthdays). The busy-day experiment below shows what real data will do.

## 2. Findings

Severity: **blocker** = wrong data, overflow, unreadable; **should fix** = confusing, wasted space, mismatch with X4; **nice** = polish.

| id | sev | where | what's wrong | evidence | proposed fix | touches |
|---|---|---|---|---|---|---|
| D1 | blocker | Events and routines on every day page (and the X4 pack) | Times sort as text, so days are out of order. | `data.mjs:98` uses `a.time.localeCompare(b.time)` on strings like `10:00a`, `8:30a`. Test day Oct 14 printed: Alex birthday, 10:00a, 12:30p, 3:00p, 5:00p, 7:00p, **8:30a**. Routines: 1p, 2p, 3p, **8a, 9p**. Test data has one event a day, so the default build never shows it. Real calendars will. The X4 pack copies the order, so both are wrong the same way. | Sort on a 24-hour minutes value (keep the display string). Diff the default build after. | both |
| D2 | blocker | Busy day, small book p. 40 (Oct 14, synthetic) | A day with 7 events and 5 routines fails `check.mjs`, and the fact runs into the SEND TO strip. | Build returned `[{"n":40,"over":false,"out":2}] 1`. Screenshot: the "On this day" line overlaps the bubbles. Writing space fell from 58 mm to 30 mm; Action items grew to 39.5 mm (5 routines + 1 blank). With real calendars this will fail CI. | Cap the events line (show 4, then "+3 more"), cap pre-filled routines and let the blank line count go to 0, and let the fact drop to one line or hide when tight. Decide a minimum writing space. | print |
| D3 | should fix | Holidays, moon phases, pay dates, eclipses under the sky line, all days | This line has no `data-zone`, so the scanner map does not know it exists. | `parts.notes` (`render.mjs:421`, class `sky2l`) has no `data-zone`; no page in `layout.json` lists a `notes` zone. CLAUDE.md: every block needs one. On event-free days the line still takes 3–7 mm. | Add `data-zone="notes"` (repeat rule `_2`). | print |
| D4 | should fix | Spoons, paper vs X4 | The two count in opposite directions. | Paper key: "Spoons: cross off as you use them" (12 spoons, the crossed ones are spent). X4: "Spoons left", filled = left, default 12. The X4 "Good-spoon days" total is "4+ left". A day started on the X4 and finished on paper reads backwards. | Pick one direction for both. Suggest "used" on both (paper already works that way): rename the X4 item "Spoons used" and flip its total. | both |
| D5 | should fix | Care check-in order, paper vs X4 | The order differs, so it can't be done by muscle memory. | Paper reading order: meds, meals (+snack), shower/teeth/joy/text, **sleep + work**, mood, anxiety, spoons. X4: meds, meals, snack, shower/teeth/joy/text, mood, anxiety, spoons, **sleep** (last, and below the fold on the first screen). Items, icons and scales otherwise match: 7-step mood −3..+3, anxiety 0–3, 3 meals + snack. | Move sleep before mood on the X4, or paper after spoons. Work is paper-only (S4). | X4 (or print) |
| D6 | should fix | Mood scale on paper | The 7 bubbles have no numbers and no marked middle, but the X4 and Keeper speak in −3..+3. | Zoom of the care block: face, 7 empty circles, face. X4 Today prints "Mood +3". | Mark the middle circle (a dot inside), or print −3 0 +3 small under the ends. | print |
| D7 | should fix | Which is the record? | Nothing on the page says. The care block is fully drawn, and so is the X4 list, so she can log twice (S5 counts four copies). | The page key and the X4 README both say "the paper stays the record". The X4 This month totals only see the X4. | See section 3: split the work, and give the care block an on/off decision. | both |
| D8 | should fix | Writing space, all pages | The writing space is about a third of the frame. | Small: 55–62 mm of 194 mm (28–32%) on quiet days, 50–52 mm on event/holiday days (Oct 31, Nov 17), 30 mm on the busy test day. Letter: 71–81 of 253 mm. The care block alone is 26 mm (14%), Action items 21 mm, Review 15 mm. | If the X4 records care (section 3), the editor can switch the care block off: about 26 mm back (+45% writing). Otherwise leave as is. Ask Shelbee. | print |
| D9 | should fix | Review row icons | Went well / Was hard / Tomorrow are three tiny icons with no words, and "was hard" is a cloud. | Zoom: check, cloud, arrow over three thin lines. The cloud is also the weather icon in the editor's Weather block and is the same shape as the "hard" icon in `IC` (`hard` and `cloud` are the same path). | Give "hard" its own icon (not a cloud), and print a 6 pt word under each icon, or the first time only in the key. | print |
| D10 | should fix | Spoon icon | The 12 spoons look like map pins or lollipops. | Zoom: circle on a stick, 12 in a row; same on the X4. It is the icon for a key concept in the book. | Make the bowl an open oval with a slight taper and handle end, or add the word "spoons" once. | both |
| D11 | should fix | Small type | Sun times, season and fact are 7 pt italic. On B&W print at 5.5 in wide that is hard for tired eyes. | Sky line and fact at 7 pt (`render.mjs` `.sky1`, `.fact`). The X4 shows the same items at about 3x that size. | Keep the 7 pt on paper only if the X4 is the place she reads them (section 3). Otherwise 7.5–8 pt. | print |
| D12 | should fix | Pay notes | 78 of 365 days carry a pay note; 58 say "(projected)". | `pay` notes: 20 "starts", 19 "ends", 19 "Payday" (all "(projected)" from 2027) plus 6 with "P11 Weeks 3 & 4". On Nov 17 the header line wraps to two lines because of it. | Print only "Payday" on paper; keep start/end on the month calendar (it already has them). | print |
| D13 | should fix | Facts that may not suit a low-stimulation day | Three deaths, a crash, a seizure episode, one 4chan mention. | 2026-10-01 "(2003: 4chan launches.)", 10-27 "ARPANET suffers its first major crash", 11-17 "Herman Hollerith dies", 11-27 "Ada Lovelace dies at 36", 12-16 "'Pokémon Shock': over 600 kids… seizures". The Dec 16 fact is a photosensitivity trigger for some readers. | Replace those five. Ask which topics she wants avoided. | print, X4 |
| D14 | should fix | Today vs the page, routines | Routines are shown differently: paper Action items pre-filled boxes; X4 draws an empty box (S13). | Oct 6: "9:00a Weekly thing" is a ticked-to-do on paper; on the X4 it's an untickable box. | See S13. | X4 |
| D15 | nice | "Small good things" | The page brief lists it, but it is off in `DEFAULT_LAYOUT` (`['good', { on: false }]`). | `daypage.mjs:190`. | Either say so in the page key or turn it on. Ask. | print |
| D16 | nice | X4 Today vs paper sky | Paper prints moon %, sign or ingress time (`→ ♓ 1:19p`), sun times and micro-season. X4 prints the same plus the day length, and writes "Moon enters …" where the paper has an arrow glyph. Both use `data.json`, so the values match. The season change time (`newseason=`) is on neither (S22). | 41 of 72 season changes happen after noon; the old season prints that day and the new one the next. | Fine. Optionally print "new season 9:45p" on change days. | both |
| D17 | nice | Moon-sign arrow | `→ ♓ 1:19p` appears on 160 of 365 days and is cryptic. | The key explains it once. | Keep; consider dropping the arrow on paper. | print |
| D18 | nice | Holidays list | Two dates that matter to her book are missing: Trans Day of Remembrance (Nov 20) and Trans Day of Visibility (Mar 31). No Pride, no Hanukkah, no Election Day either. | `holidays.mjs`, 23 entries. | Ask. TDOR is a heavy day for the calm rule. | print, X4 |
| D19 | nice | Dot grid | Paper dots (#999, r 1.2) are very faint at 60 dpi, and the dashed 4 mm grid (#d6d6d6) is fainter. On a cheap B&W print the grid may vanish. | Contact sheets. | Proof one book on KDP before deciding; go darker (#777) for grid. | print |
| D20 | nice | Scan codes | Small and letter share `KW1|YYMM|NNN` with different zones (968 shared codes) (S14). Codes are unique per page within each book; the Keeper has none (correct). | `layout.json`, all 24 books. | See S14. | print |

## 3. Paper and X4 pairing notes

**What matches (checked):** every fact the two share is the same, because both come from the same `data.json`: date and weekday, planet, moon %, sign, sunrise/sunset, micro-season, holidays and notes, one-off events, routines, "On this day". The 12 items on the paper care block and the 15 X4 built-ins share icons (same SVG paths), boxes, and scales (mood 7 steps, anxiety 4 steps, 3 meals + snack, 12 spoons). Exceptions: D4 (spoon direction), D5 (order), D1 (order of events), S4 (work), S12 (editor options don't reach the X4).

**What differs on purpose:** the X4 adds day length and a big moon; it caps the list (3 notes, 5 with events, 6 lines; S23); it holds a stamp list for as-needed doses (paper has one blank).

**Who keeps the record?** Today both do, and only the X4 feeds This month. Suggested split (ask Shelbee to choose):

| Option | Paper | X4 |
|---|---|---|
| A: X4 is the check-in record | Care block off by default (or a slim "did I check in?" tick). Paper keeps sky, events, writing, action items, review, "On this day". | Meds, meals, self-care, mood, anxiety, spoons, sleep. This month feeds the Keeper. |
| B: paper is the record | Care block stays. | X4 shows and sets nothing that paper has, only Today and Support. Loses the totals. |
| C: choose per day | Care block stays, small box "logged on X4" she ticks. | As now. |

A gives the most writing space (+26 mm), removes double entry (S5) and matches how This month already works. Its cost: on a shift day with no X4 at hand she needs a quick catch-up (the X4 can log the past day with ◀; that works for the day before). Fix S8 first.

## 4. What's working well (keep)

- 365 of 365 days correct on every checked field, including both DST days (sunrise jumps once each, and the day-length arithmetic is right), Feb 28, Dec 31/Jan 1 and Sep 30 2027.
- Facts, words, pioneers and prompts: full coverage, no repeats.
- All 24 builds pass `check.mjs`; zone set is identical on every day page; codes are unique per page.
- The page itself is calm: one column, thin lines, icons over words, generous white space, the frame and SEND TO strip do not collide with content on ordinary days.
- Same icon set on paper and X4 is a real strength for the pairing.

## 5. Open questions for Shelbee

1. Which option in section 3: A (X4 records care), B or C?
2. Spoons: count what you have left, or what you've used?
3. If A: turn the care block off in the default layout, or leave it for days without the X4?
4. Facts about deaths, crashes and seizures: replace them?
5. Add Trans Day of Remembrance and Visibility to the holiday list?
6. Should "Small good things" be on by default?
