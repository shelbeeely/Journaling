# Review: front matter, back matter and the Keeper

Findings only. No code or content changed.

**Overlap with PR #31 (`docs/review/books-and-x4.md`, S1–S23):** F-06 = S3, F-08 = S19, F-17 = S21. Those are kept here as cross-references only, and S3/S19/S21 should be treated as the owner. F-07 adds to S3 ("good-spoon" is undefined on paper). F-01, F-02, F-03–F-05, F-09–F-16 and F-18 are new. S2 (log backup step) also belongs on the Closing page and the Keeper handoff, which I reviewed and agree with.

## 1. Scope
- **Books:** all 12 monthly books (Oct 2026 – Sep 2027), 5.5×8.5 and 8.5×11, plus the Keeper (50 pages). Built from `test.ics` with `./build-all.sh` on `origin/main` (1006bf7). All 24 books pass `check.mjs` with `[] 0`, and no PDF has a Type 3 font.
- **Pages:**
  - Front matter: pp. 1–8.
  - Back matter: Looking back through Lineage, plus the Notes padding.
  - Keeper: all 50 pages.
- **How I checked:**
  - Rendered pages at 40–60 dpi as contact sheets and zoomed to 100–110 dpi where it mattered. October is the reference month. The other months were checked by extracting text from every back-matter page (script), because the page types are identical across months.
  - Letter size: looked at the bus grids and checked that its cross-refs match the small size.
- **X4:**
  - Ran `x4/host/preview.sh` and looked at the This month, Support, Safety plan and Sync screens.
  - Ran one extra host run with a fully filled `me.txt` (7 sections, 1–2 lines each).
- **Numbers:** spot-checked 6 support numbers against the official sites (see F-15).

## 2. Findings

Page numbers are for the 5.5×8.5 October book unless noted. "All" means every month and both sizes.

| id | severity | book · page · size | what's wrong | evidence | proposed fix | touches |
|---|---|---|---|---|---|---|
| F-01 | **blocker** | X4 · My safety plan screen | Filled-in safety plan sections are **silently dropped**. `drawPlan()` stops drawing once `y > HINT_Y-200` and has no second page, and each section is capped at 3 lines. | Host run with all 7 sections filled at 1–2 lines each: only 1–5 show. **6 "Making my space safer" and 7 "What matters to me" are missing**, with no "more" hint. The sample card only looks fine because 4 of its sections are empty. | Paginate like Support (Left/Right = pages, "1 / 2"), or move the "when talking is too hard" box to its own page. Never truncate without a page indicator. | X4 |
| F-02 | **blocker** | Oct · p. 76 Bus times, Route 6 · 5.5×8.5 (every month has the same grid) | Minutes in the WKDY column overflow into SAT. "00\* 08 38" runs into "36" on the 5a row, and "08 23 38" touches "36" on 6a. | Seen at 110 dpi. The letter size is fine. `check.mjs` doesn't catch it, because the text overflows a table cell, not the page. | Let busy cells wrap to 2 lines, or cap the minutes per cell and move extras to a footnote. Add a cell-overflow check (`scrollWidth > clientWidth` on `.hg td`) to `check.mjs`. | print |
| F-03 | **blocker** (for printing) | Feb–Sep 2027 · STA at a glance + 4 grid pages · all sizes | 8 of 12 books print January 2027 times. The feed ends 2027-01-16, so these books sample 1/13, 1/9 and 1/10 and are marked stale. | `network.json`: months 2027-02 … 2027-09 have `stale: true`, with samples from January. The pages say "May have changed: check spokanetransit.com." | Known item (HANDOFF "Next" #2). Refresh the GTFS before printing each of these books. If no newer feed exists at print time, consider dropping the 4 grid pages and keeping only the summary and the warning. | print |
| F-04 | should fix | Jan 2027 · pp. 76–81 · all sizes | January isn't flagged stale, but the feed ends on Jan 16. Jan 17–31 (winter service change, EWU quarter start) print as if certain. | `network.json` 2027-01 has `stale: false`, and the note reads "STA schedule 9/20/26–1/16/27" with no warning. | Mark a month stale when `valid_to` falls before the month's last day, and print "valid to Jan 16". | print |
| F-05 | should fix | All · Support (verso, p. 70) backs Closing (recto, p. 69); Trans (p. 71) and Safety plan (p. 72) share a leaf | "To remove this page, cut along the inside edge" on Support also cuts out **Closing the month**, which is the Keeper handoff page. Cutting Trans or Safety plan takes the other one with it. | Page parity in all 24 books (script): Closing is always a recto and Support the verso behind it. | Put a Notes page or Lineage behind Support, or order the back as Support + Trans (one leaf) and Safety plan + Notes (one leaf), with the cut note only on leaf-safe pages. Or drop the cut note: Support and Safety are already on the X4. | print |
| F-06 (= S3) | should fix | Keeper handoff pp. 24–47, Year at a glance p. 48; monthly Closing page (p. 69); X4 This month | The **stats don't match** across the three places. Paper asks for Avg mood, Avg sleep, Showers, Meds taken, Good-spoon days and **Work hours**. X4 shows those, but **"Meds, both doses"** and **"Enjoyed something"** instead of Work hours. | X4 `04-month-half.png` shows "Meds, both doses 4 days" and "Enjoyed something 9 days". Paper shows "MEDS TAKEN ___ days" and "WORK HOURS ___ h". The X4 has no work check-in, so it can never fill Work hours. | Pick one list of 6 and use it on all three. Suggestion: keep Work hours on paper (it comes from the week spread's `work ____–____`), and add "Enjoyed" as a 7th Keeper field, or swap it in. Label meds the same on both: "Meds, both doses" or "any dose" (the X4 already computes `medsAny`). | both |
| F-07 | should fix | Closing p. 69, Keeper p. 24, month tracker p. 12 | **"Good-spoon days" is undefined on paper.** The X4 means "4+ spoons *left*". Paper spoons are crossed off as *used*, from 12, and the tracker Spoons column is an empty box. | X4 unit "4+ left". Key p. 4: "cross one out per spoon spent". | Print the rule on the Closing page and in the Keeper ("4+ spoons left at bedtime"), and say what to write in the tracker's Spoons box (spoons left). | both |
| F-08 (= S19) | should fix | Every book · Safety plan p. 72, Quick contacts p. 7, Care plan meds p. 6 | **Filled in again 12 times.** Every month prints a blank safety plan, med list and contacts, so the plan she needs on a hard day is only as good as this month's copy. The X4 `me.txt` persists, which makes two diverging copies. | Same pages in all 24 books. The Keeper has no safety plan page. | Decide the source of truth (see §5). Suggestion: the X4 `me.txt` is the master, the printed page says "Copy from your X4 (Menu → My safety plan) or last month's book", and the Keeper gets one master safety plan page. | both |
| F-09 | should fix | Key p. 4 (all) | The key explains **"Energy 1 empty … 5 full"**, but the default day page has no energy scale. It only appears if a custom Scale block labelled Energy is added. | Day page p. 16: care grid, mood, anxiety and spoons, but no energy. | Remove the Energy line, or print it only when the layout has a Scale block, taking the label from the block. | print |
| F-10 | nice | Key, continued p. 5 (all) | The icon key doesn't cover every icon on the day page. The anxiety row's left end (calm, drawn as a dash) and the mood row's right end (happy face) aren't in the key. | Day page p. 16 has `— ○○○○ ~` and `☹ ○○○○○○○ ☺`. The key shows only the low face and the anx wave. | Change the key rows to "☹ … ☺ Mood −3…+3" and "— … ~ Anxiety 0–3". | print |
| F-11 | nice | All · p. 2 | The blank verso after the title carries the full scan frame, send-to strip and page code: a wasted page that invites scanning of nothing. | Contact sheet p. 2. | Make it a Notes page, or move the Key there so the front matter is one page shorter. | print |
| F-12 | nice | Sep 2027 · Closing p. 67 | It says "before starting **October**", but there is no Book 13. Step 4 correctly switches to "Fill in the Keeper's Year at a glance". | Text of p. 67. | For Book 12, write "before starting next year's books" and add the Keeper page ("Year at a glance, p. 48"). | print |
| F-13 | nice | Keeper handoff left pages (p. 24 etc.) | About 30% of each Closing page in the Keeper is empty below "One line to remember". | Page 24 at 100 dpi. | Add 2 lines to Highs/Lows or Health, or add the "Enjoyed" stat from F-06. | print |
| F-14 | nice | Keeper p. 49 Support | One glyph ("→" in "dbsalliance.org → support groups") falls back to LiberationSerif, a system font. It isn't Type 3, but the embedded font depends on the build machine. | `pdffonts` p. 49: `LiberationSerif`. | Use "›" or "then", or an SVG arrow like the monthly books use. | print |
| F-15 | should fix | Support + Trans pages (all), Keeper pp. 49–50, X4 Support | **Spot-check of 6 entries.** Five are still right: 988, Crisis Text Line (HOME → 741741), FBH crisis line 1-877-266-1818 (24/7), Trans Lifeline (877) 565-8860 Mon–Fri 10–6 PT (CALL only: its site says text chat is "preparing"), WA Warm Line 877-500-9276 daily 2–9 pm with 20 minutes once a day, and Unify 509-326-4343, M–F 7:45–7, pharmacy 509-323-8757. | Official sites fetched today (translifeline.org, fbhwa.org, crisistextline.org, crisisconnections.org, thetrevorproject.org). Unify via its YVFWC location page and listings. | **Trans-Wa:** "planned to restart Oct 2026" goes stale in the later books. A current listing also gives the email as **services@**transwa.org, while the book says info@. **FBH walk-in** "during business hours" is really M–F 7:30–4:30, and saying so on a crisis page saves a wasted trip. Re-check before each print run. | both |
| F-16 | should fix | Keeper p. 19 "Email & the big ones", pp. 20–21 Recovery codes | **Small risk of full credentials.** The recovery-code block has an "Account" field, and p. 19 has "Login" next to it. For Apple, a *recovery key* can reset the password on its own, so login + key in one lost book is a takeover. The "Password manager" card also asks for a **Hint**, while rule 2 says never write the master password. | Keeper pp. 19–21. | Label the account field "Which account (no login)". Add a line: "Apple recovery key or password-manager emergency kit: store elsewhere, not here." Change the password manager card's "Hint" to "Where the emergency kit is". | print |
| F-17 (= S21) | nice | X4 `me.txt` starter (export_pack.py) | The header comment says "hold Down on the menu → Sync", but the menu item is now "Wi-Fi sync". | `export_pack.py` line 155 vs `app.cpp` MENU. | Change it to "Menu → Wi-Fi sync". | X4 |
| F-18 | nice | Anatomy p. 3 | "At the back" lists Support, Safety plan, Bus times and Lineage. It leaves out **Closing the month** (the page that links to the Keeper) and Trans support. | p. 3 text. | Add "Closing p. {{P_CLOSING}}" first, since it's the monthly ritual. | print |

Cross-refs: every `{{P_x}}` is resolved (no "?") in all 24 books, and each one points at the right page. The table below lists only the Support, Safety plan, Bus times and Lineage refs, as page numbers. Theme is p. 8 everywhere, and the Care plan refs match the anatomy page.

| Book | Support | Safety plan | Bus times | Lineage | Keeper handoff |
|---|---|---|---|---|---|
| Oct, Dec, Mar, Apr, Jun, Jul | 70 | 72 | 74 | 80 | 24, 28, 34, 36, 40, 42 |
| Nov, Aug | 74 | 76 | 78 | 84 | 26, 44 |
| Jan | 72 | 74 | 76 | 82 | 30 |
| Feb | 64 | 66 | 68 | 74 | 32 |
| May | 76 | 78 | 80 | 86 | 38 |
| Sep | 68 | 70 | 72 | 78 | 46 |

Each book's Closing page, the Keeper spread and the X4 footer ("Copy these to your Keeper, page 24") all give the same page. Every handoff spread starts on a left page.

## 3. Paper ↔ X4 pairing notes
- **Support screen vs Support/Trans pages.**
  - Same entries, same order: support.json, then trans.json, then the clinic. The X4 pages 1 of 7 match the printed Support page top to bottom.
  - Trans Lifeline appears twice on the X4, once under Peer and once under Trans. Paper does the same, which is fine.
  - The X4 badges only TEXT, which is right for a hard moment. The printed intro ("press 3 ended July 2025") isn't on the X4, which is fine too.
- **Safety plan.**
  - Paper has 7 questions plus the text script.
  - The X4 has the same 7 as shorter headings plus the same script, word for word.
  - F-01 must be fixed before the X4 copy can be trusted.
  - Recommendation: the X4 `me.txt` is the source of truth, because it persists across books, can be edited from the phone, and is one long-press away. Paper is the backup, copied from it (F-08).
  - Paper question 5 carries the FBH number. The X4 "Professionals" heading doesn't, but that number is on X4 Support page 1 anyway.
- **Month stats → Keeper.**
  - The page link works end to end: `index.json`, then `keeper=` in the pack, then the X4 footer.
  - The stat labels don't match (F-06, F-07). Once they do, the Closing page's step 1 could read "copy from X4 → This month, or total the tracker".
  - The X4 can't supply Work hours.
- **Calm check.** None of these screens adds noise. The Month screen's dot calendar is a nice pre-Keeper glance.

## 4. What's working well (keep)
- **Keeper:**
  - No scan codes anywhere. I checked that `keeper.html` has no Data Matrix or send-to strip, and every page carries "PRIVATE · DO NOT SCAN".
  - The hints-only rules on p. 3 are clear. Every password column says "Hint", and account numbers are last-4 only.
  - The handoff spreads are well structured: Closing on the left and Into next month on the right, with the Book column pre-filled in grey and a "Clinic & support still right" tick.
- **Monthly books:**
  - The Closing page is concise and time-boxed ("About 15 minutes") and names the Keeper page.
  - The Care plan clinic box and the Keeper Health page share one source (`clinic.json`), and so do Support and Trans (JSON shared by print, Keeper, EPUB and X4). Keep that single-source design.
  - The bus summary's "no service" cells and the shaded repeat rows read well in black and white. The stale warning is loud and honest.
  - Lineage's "Skip anything, any day. A blank box is data too." suits the calm brief.

## 5. Open questions for Shelbee
1. **Which safety plan is the master:** the X4 (typed and persistent), the Keeper (add a page), or each month's book? My suggestion is the X4, with paper as the backup.
2. **Month stats:** keep Work hours (paper only) or swap it for "Enjoyed something" (the X4 has it)? And do meds count when both doses are taken, or any dose?
3. **Cut-out pages:** do you actually cut Support or Safety plan out to carry them? If not, drop the cut note and F-05 goes away.
4. **Bus pages for Feb–Sep:** reprint once STA publishes the next feed, or print only the summary until then?
5. Should Quick contacts and the Care plan meds stay as per-month pages, or become "copy from Keeper" with fewer lines?
