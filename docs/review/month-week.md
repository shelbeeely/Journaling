# Review: month section and week section

## 1. Scope
- **Books:** all 12 monthly books (Oct 2026 – Sep 2027), 5.5×8.5 and 8.5×11. Built from `test.ics` with `./build-all.sh` on `main` @ 1006bf7. Every book passed `check.mjs` (`[] 0`).
- **Pages:** the month calendar, sky & seasons, tracker and moon pages; the week left/right spread, weekly review, and Exchange/Reply.
- **How I looked:**
  - Rendered at 60 dpi (40 dpi for letter), zoomed to 100–120 dpi where needed.
  - Looked closely at Oct, Nov, Dec, Jan, Feb, Aug and Sep 2027 (small), plus Oct and Feb letter.
  - Other months: checked the page order, data and alignment with a script over `journal.html` and `data.json` for all 24 builds.
- **Checked against outside sources:**
  - USNO API: moon phases for the whole edition; sunrise, sunset, moonrise and illumination for Dec 21 2026, Feb 14 2027 and Jun 21 2027.
  - Holiday rules by hand.
  - Eclipse visibility from Spokane with astronomy-engine.
- **X4:** `x4/host/preview.sh` screens (Today, sleep, This month), plus `export_pack.py`, `data.cpp` and `monthStats`.
- **Not covered here:** day pages, front and back matter, bus pages and the Keeper (other reviews).

## 2. Findings

| id | sev | book · page · size | what's wrong | evidence | proposed fix | touches |
|---|---|---|---|---|---|---|
| MW1 | blocker | Feb 2027 · p10 · both | The calendar collapses to the top ~40% of the page. Cells are ~0.5 in tall, with nothing below them. | Seen on p10 in both sizes. Feb 2027 starts on a Monday, so it has 4 rows. CSS only sets heights for `.rows5`/`.rows6`, and `.m .cal { flex: 0 0 auto }` stops the table from stretching. | Add a `.cal.rows4 td` height (≈1.25 in small, ≈1.6 in letter), or let `.cal` flex to fill. | print |
| MW2 | blocker | moon pages + day/X4 sky · Oct, Dec, Apr, May, Aug | The sign printed for a full or quarter moon is the sign at local **noon**, not at the exact moment. 5 of 50 phases are wrong. | Oct 25 full moon 9:12p prints "in ♈ Aries"; at the moment it's Taurus. Also: Dec 23 Gemini→Cancer, Apr 20 Libra→Scorpio, May 20 Sagittarius→Scorpio, Aug 24 last quarter Taurus→Gemini. | For the moon notes and the moon page, take the sign at `q.time`. Leave the daily noon sign alone. The X4 pack reads the same data, so it gets fixed too. | both |
| MW3 | should fix | Oct, Dec, Apr, May, Jun, Jul · first week · both | Exchange and Reply print on the two sides of **one leaf**, not facing each other. The anatomy page promises "an exchange spread to hand to someone". | Oct p21 is a recto and p22 a verso. The same happens in Dec 23/24, Apr 21/22, May 19/20, Jun 23/24 and Jul 21/22. The other books get a true spread. The cause is that the review is added straight after a partial week's days, with no alignment. | Call `alignToVerso()` before Exchange. Where that adds a pad page, put the review after it, or move the review before the spread. | print |
| MW4 | should fix | Oct 2026 · p14 · both | Week 1 rows Mon–Wed say "in the previous book", but Oct is book 1, so there is no previous book. | Seen on p14. | Say "before this journal starts" (or leave the rows blank) when `VOL.n === 1`. Sep 2027's "in the next book" is fine if a 2027–28 edition follows. | print |
| MW5 | should fix | all · calendar · both | Holiday names and events run past the cell border into the next day. | Oct 12 "Indigenous Peoples' Day / Columbus Day" runs into Oct 13 ("PAYDAY"), and Oct 5 "appointment" runs into Oct 6. Feb 15 "Presidents' Day" and Feb 14 "Valentine's Day" cross the border, and so does Jan 18 "Martin Luther King Jr. Day". `check.mjs` can't catch overflow inside a cell. | Add short names for the calendar only ("Indigenous Peoples'", "MLK Day", "Presidents'"), plus `overflow-wrap:anywhere; overflow:hidden` on `.cal td`. | print |
| MW6 | should fix | all · week left · both | A day's event and its note run together with no space between them. | "2:00p Test appointmentPay period ends" (Oct p24). "New Year's DaySTA: Sunday bus schedule" (Jan p14). | Put a separator or `margin-right` between the inline `.ev`/`.evs` items, or print one per line. | print |
| MW7 | should fix | all · layout.json | Month and week pages have no content zones and no date. Only the send-to strip and page code are mapped. | In Oct `layout.json`, pp10–15 and 20–22 are `type:"page"`, `date:null`, and their zones are only send_to/page_code. The day pages have full zones. | Add `data-zone`s: calendar, sky list, tracker grid, moon new/full, week rows (`day_1`…), habits, mood line, words, review q1–3, carry forward, exchange body. Set the type (`month_cal`, `week_left`, …) and a week/month date. That meets the CLAUDE.md rule "every block needs a data-zone". | print |
| MW8 | should fix | Feb, Jul, Aug 2027 · sky + week + day · both | Eclipses print with no hint that most of them can't be seen from Spokane. | Feb 6 annular and Aug 2 total solar are both "(global)": not visible in Spokane. Feb 20 penumbral lunar: moon at −19° at peak. Jul 18 penumbral lunar: moon at −38°. Only the Aug 17 penumbral lunar is up (+29°). | Check the local moon altitude and mark each one "not visible here". Drop "(global)", or say "not visible from Spokane". | both (pack notes) |
| MW9 | should fix | Apr–Sep 2027 · sky | The meteor list only covers Oct–Jan. There are no Lyrids (~Apr 22), Eta Aquariids (~May 6) or Perseids (~Aug 12–13). April's sky list has no sky events at all. | `METEORS` in `data.mjs` has 6 entries, Oct–Jan only. | Add Lyrids, η-Aquariids, Perseids and Draconids…Geminids (the rest already exist). Optionally add a note on moonlight. | both |
| MW10 | should fix | Feb–Sep 2027 · calendar + week | After the STA feed ends (2027-01-16), holidays with Sunday service get no "SUN BUS" tag. Nothing on the page says so. | `route6.json` has `holiday_service` = Thanksgiving, Christmas and New Year's 2026–27 only. Memorial Day, Jul 5 (observed) and Labor Day show nothing, and the build warns "STA schedule ends" 8×12 times. | Refresh the feed (HANDOFF #2). Until then, fall back to STA's published holiday list, or print "check STA" on federal holidays past `valid_to`. | both |
| MW11 | should fix | all · tracker · both | The tracker has no labels and no instructions. The columns are icon-only (bed, pill, meal, shower, work, spoon), and the footnote that explains them is hidden. | `.m .trk + .small { display:none }` also hides the calendar's moon key. At 60–110 dpi the header icons are ~5 px, and it isn't clear what goes in the sleep or spoons boxes (hours? a tick? a number?). | Print tiny units under the icons ("h", "✓", "0–3", "#"). Show one legend line, or move it into the key page. | print |
| MW12 | should fix | all · tracker vs X4 | The paper tracker duplicates the X4's This month. See pairing notes §3. | Tracker: mood, sleep, meds, meals, shower, work, spoons. X4 logs all of these except work, and This month already totals them. | Ask Shelbee: A) keep it as the offline fallback, B) swap it for what the X4 doesn't track (work hours, pain, custom), or C) cut it to a "copy from X4" box. | both |
| MW13 | should fix | all · week section | Work hours are asked for in 4 places. Mood is asked for in 4 places. | Work: week left "work ____–____" every day, the habits "work hours" row, the tracker Work column, and the day page work shift. Mood: day page, week mood line, tracker, X4. | Pick one home for each. For example: work on the week left only, mood on X4 plus the week mood line, and drop the tracker's mood dots. | print |
| MW14 | should fix | 8.5×11 · month + week · letter | The letter pages reuse the small layout at the same type size, so about a third of each page is empty. | Oct letter p24/25: the bottom third of the week-right page is blank. Feb letter p10: the calendar fills about 40%. The tracker and moon pages have the same problem. | Scale the type and row heights for letter, or give the extra space to the habits and mood rows and the notes. | print |
| MW15 | nice | all · weekly review · both | Each review question gets one faint rule in a 0.46 in box, so it reads as a one-line answer. The carry-forward dots are #DCDCDC, so they may vanish on a B&W office print. | Seen on Oct p20 and Nov p17. | Use 2–3 visible rules per question. The review page has space for them. | print |
| MW16 | nice | Nov (wk 5, wk 10), Jan (wk 14), Sep (wk 53), Dec (wk 14) · both | A week that has only 1–3 days in a book still costs a full spread plus a pad page. Nov spends 2 spreads on 2 single days (Nov 1, Nov 30). | Week 5 in Nov: 6 "previous book" rows and 1 real day. Week 10 in Nov: 1 real day, plus a Notes pad. | A one-page "bridge" week for ≤2 days, or merge those days into the neighbouring spread. | print |
| MW17 | nice | Aug 2027 · p13 | Aug has two new moons (Aug 2 and Aug 31), but the moon page only gives one. | Only the Aug 2 block is printed. | Print the second one as "New moon · Aug 31", or point to the Sep book. | print |
| MW18 | nice | Sep 2027 · end | Week 53 (Sep 27–Oct 3) has no review or Exchange in any book. Prompt 53 is never printed. | 52 of 53 prompts appear, each exactly once. | Either make the next edition's Oct book pick it up (gi continuity), or print week 53's review in Sep. | print |
| MW19 | nice | Oct 2026 · sky p11 | The micro-season "Clocks fall back" starts Oct 28, but clocks change Nov 1. On the sky list it reads like an event on the 28th. | `spokane.mjs` #213. | Rename it (for example "Evenings darken early"). The Nov 1 holiday line already covers DST. | both |
| MW20 | nice | Nov 1–30 · X4 pack | The pack only carries a pioneer when this book "owns" the week. Nov 1 and Nov 30 have no pioneer on the X4, even though it's that pioneer's week. | `data.json` weeks gi 4 and 9 in the Nov book have `pioneer: null`. | In `export_pack.py`, use `PIONEERS[gi]` whatever book owns the week. (The X4 doesn't draw the pioneer or prompt yet; `data.cpp` only parses them.) | X4 |
| MW21 | nice | all · pay labels | Official pay periods print "Pay period starts: P10 Weeks 1 & 2". Projected ones print just "(projected)", with no period name. From Jan the week rows get long. | Seen on Oct p24 and Dec p62. | Use the same short label everywhere: "Pay period starts · P1 wk 1–2 (proj.)". Replace the 2027 rows when the sheet is posted. | both |

**Cross-references (PR #31, whole-system review; not duplicated here):**
- S7: the day-30 label overlaps the Keeper footer in 6-row months. It hits the Nov and May calendars and trackers in this section.
- S3 / S4: the X4 month tiles vs the six boxes on the Closing page. This relates to MW12 and the tracker hand-off below.

## 3. Paper ↔ X4 pairing notes
- **Same numbers.** Sky and moon data on paper and on the X4 match exactly, because both come from `data.json`.
  - Oct 14 on the X4 sleep screen: 17% in Sagittarius, 7:07a–6:02p, 10h 55m. The paper data is the same.
  - The noon-sign bug (MW2) and the eclipse visibility gap (MW8) show up on both.
- **The tracker duplicates the X4.**
  - The X4 already logs mood (−3…+3, same scale as paper), sleep hours, meds AM/PM, 3 meals, shower and spoons.
  - This month totals them and says "Copy these to your Keeper, page N".
  - Filling the paper tracker as well is triple entry: day page care grid, tracker, X4.
  - Only Work has no X4 equivalent.
  - Recommendation (MW12): make the tracker either the fallback for days without the X4, or a monthly "from the X4" summary box plus the columns the X4 lacks.
- **The week review has no X4 counterpart.**
  - The X4 has no week view, so the mood line has to be filled from memory or day pages.
  - Option (ask first): a read-only "This week" screen on the X4 that shows 7 mood values to copy onto the mood line. That's calm, with no badges.
- **The X4 doesn't show the pioneer or prompt.**
  - The X4 parses both but draws neither. That's fine for calm; the paper is the home for both.
  - If they're ever shown, fix MW20 first.
- **Hand-off point.** The only paper↔X4 hand-off in this section is the month tracker → Keeper, and it isn't written on the month pages. A single line on the tracker would make it clear: "X4 → Menu → This month has these totals."

## 4. What's working well (keep)
- **Correct data.**
  - Every weekday is correct in all 12 books (script check).
  - Holidays by rule are correct, including the observed dates: Juneteenth on Fri Jun 18 2027 and Jul 4 on Mon Jul 5 2027. DST, Easter, MLK and Presidents' Day are right too.
  - Moon phase times match USNO to within 1 minute across the edition.
  - Sunrise, sunset, moonrise and illumination match USNO to within 1 minute and 1%.
- **Pay periods.** The 2026 periods follow the posted sheet (Oct 13, Oct 27, Nov 10, Nov 24, Dec 8, Dec 22 and Jan 5 paydays). "PERIOD ENDS" is kept off the calendar to cut noise.
- **No repeats.** Pioneers: all 53 are printed exactly once, in the book that holds the week's Thursday. Every "Born … this week" line lands in the right week. Prompts: 52 of 53 are printed exactly once.
- **Continuous numbering.** Week numbers run across the edition (Week 1 = Sep 28), so the split weeks read naturally.
- **Page layout.**
  - The month section is always calendar + sky on one spread and tracker + moon on the next.
  - Week spreads always open verso/recto.
  - Pad pages are Notes pages rather than blanks.
- **Calm, legible B&W.** The pages use thin rules, no grey fills except the out-of-month cells, and no Type 3 fonts.

## 5. Open questions for Shelbee
1. **Tracker:** A) keep it as the fallback, B) swap it for things the X4 doesn't track, or C) replace it with a "copy from X4" box?
2. **Work hours:** where should they live? The week left, the habits row, the tracker and the day page all ask.
3. **Holidays:** add Election Day (Nov 3 2026), Trans Day of Remembrance (Nov 20) and Trans Day of Visibility (Mar 31)? They'd be observances, not federal holidays.
4. **Letter size:** bigger type, or more writing room?
5. **STA holidays:** can you confirm which holidays run Sunday service in 2027, so the calendar can tag them without a feed?
6. **Short weeks:** is a one-page bridge OK for weeks with ≤2 days in a book?
