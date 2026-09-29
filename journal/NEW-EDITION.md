# New edition: Oct 2027 – Sep 2028

The first edition (Oct 2026 – Sep 2027) is hard-coded in the places below. Work through the checklists from top to bottom.
Sites are named by file and symbol or string, so search for them rather than going by line numbers.

**Before you change anything**, tag the current edition so it can still be rebuilt:

    git tag edition-2026-27 && git push origin edition-2026-27

What happens if you skip all of this and run `node render.mjs month 2027-10 test.ics`:
- the title page reads "Book 13 of 12"
- weeks are labelled Week 53–57
- `content gaps:` warns about missing pioneers, words and prompts
- the book has no STA bus pages (see the STA feed section)

## 1. Decide: move `EPOCH` or keep it
`content/profile.json` → `book.epoch` (default: the Monday on or before the 1st of `book.start`, Mon Sep 28 2026 for the first edition) is week 0 (`data.mjs` reads it through `profile.mjs` `epochMs()`). Every week gets `gi` = weeks since then.
`gi` indexes `WORDS`, `PROMPTS` and `PIONEERS`, and `render.mjs` prints `` `Week ${W.gi + 1}` ``.
An edition needs 53 entries per list (index 0–52), because its first and last weeks cross into September.

| | Move to `Date.UTC(2027, 8, 27)` (Mon Sep 27 2027). **Recommended** | Keep at Sep 28 2026 |
| --- | --- | --- |
| Week labels | Restart at Week 1 | Continue as Week 53–105 |
| Content lists | Replace or reuse entries 0–52. Each index lands on nearly the same calendar week (1 day earlier), so seasonal words and "Born … this week" notes still line up | Add 53 new entries at 52–104 |
| Old edition | Rebuild it from the `edition-2026-27` tag. On the new code its months have gaps | Still builds from the same code |

If you move it, fix the `content/year.mjs` header ("week 0 = Mon Sep 28 2026").
Under the new `EPOCH`, index 0's pioneer never prints. That week's Thursday (Sep 30 2027) falls in the September book, which already went out with the old edition.

## 2. Code changes
| File | Symbol / string | Change to |
| --- | --- | --- |
| `content/profile.json` | `book.start` `"2026-10"`, `book.edition` `1`, optional `book.epoch` | `"2027-10"`; `2` (single digit, printed in every page code `KW2\|<edition>\|...`); `"2027-09-27"` if you move week 0 (section 1). One place feeds the book numbers ("Book N of 12", `VOL.n < 12` on Closing), the cover numbers, the Keeper's label and month loop (which builds `out/keeper/index.json`), and `EPOCH`. The old per-file edits are gone |
| `build-all.sh` | `MONTHS=${MONTHS:-"2026-10 … 2027-09"}` | `"2027-10 2027-11 2027-12 2028-01 … 2028-09"` |
| `gtfs/network.py` | `months = [(2026, m) for m in (10, 11, 12)] + [(2027, m) for m in range(1, 10)]` | `[(2027, m) …] + [(2028, m) …]` |
| `gtfs/network.py` | debug line `out['months']['2026-10']` | `'2027-10'`, or the script crashes after writing |
| `payperiods.mjs` | projection loop `while (s < '2027-10-10')` | `'2028-10-10'` (and see section 3) |
| `.github/workflows/books.yml` | `months` input description `"2026-10 2026-11"` | Example text only. Update it to match |

Optional, not needed for the books:
- **Editor.** `editor/build.mjs` reads `out/m2026-10/journal.html` and looks for `'2026-10-31 · '`. `.github/workflows/editor.yml` and the `editor/test.mjs` comment build `month 2026-10`.
  It keeps working on 2026-10, which only supplies the page CSS and a sample day. If you move it, move all of these together, plus the verify lines in `/CLAUDE.md`.
- **Sample calendar.** `test.ics` only has Oct 2026 events, so sample builds for the new year have none.
- **X4 previews.** `x4/host/preview.sh` sets `KW_NOW="2026-…"` and uses the `x4/host/sample` packs. The firmware has no edition year: `MIN_VALID` in `hal_x4.cpp` is only a "clock was set" floor.
- **Docs.** "Oct 2026 – Sep 2027" in `/README.md`, `journal/README.md` and `/HANDOFF.md`.

Possible later improvements (don't change now):
- One edition start constant could feed `bookNo`, the cover number, the Keeper label and loop, `build-all.sh` `MONTHS`, the `network.py` months and `EPOCH`.
- The "Checked Sep 2026" strings could come from the `checked` field in `content/*.json`.

## 3. Content refresh checklist
- [ ] **Facts.** Keyed by `'MM-DD'`, so they carry over.
  - Oct–Dec live in `facts.mjs` `FACTS`, Jan–Sep in `content/year-research.mjs` `FACTS_2027`. Sources are in `research/2027-content.json`.
  - **2028 is a leap year:** add a `'02-29'` fact. None exists yet.
  - Renaming `FACTS_2027` / `PIONEERS_2027` is optional: update the import in `content/year.mjs`.
- [ ] **Pioneers.** Weeks 0–13 are `pioneers.mjs` `PIONEERS`, weeks 14–52 are `year-research.mjs` `PIONEERS_2027`.
  - Keep 53 entries. Pick new people or reuse the list.
  - Re-check the "Born … — this week" lines against the new week dates.
  - The `content/year.mjs` comment about `pioneerOrder()` is stale: that function doesn't exist.
- [ ] **Japanese seasonal words.** Weeks 0–13 are `japanese.mjs` `WORDS`, weeks 14–52 are `content/year.mjs` `WORDS`.
  Check the dated ones, e.g. setsubun "(Feb 3)". `SEKKI` and `KO` come from the sun's position, so they need nothing.
- [ ] **Prompts.** `content/year.mjs` `PROMPTS` (53). Change `'What do you want to leave behind in 2026?'` to 2027.
- [ ] **Spokane micro-seasons.** `spokane.mjs` `SPOKANE` is keyed by the sun's position, not the date, so it carries over. Two lines name 2027 dates:
  - "The Perseid meteor shower peaks August 12–13, 2027 …"
  - "The Spokane County Interstate Fair runs September 10–19, 2027 …"
- [ ] **Holidays.** `holidays.mjs` `holidays(y)` computes them by rule, so there's nothing to update. Add any new federal holiday.
- [ ] **Pay periods.** `payperiods.mjs` `OFFICIAL`: replace the projected rows with the real 2027 and 2028 sheets once they're posted. Fix the header comment ("2027 rows are PROJECTED").
- [ ] **Support numbers.** Call or check every entry in `content/support.json`, `content/trans.json` and `content/clinic.json`, then update the dates:
  - `clinic.json` `"checked": "Sep 2026"`
  - the `trans.json` note "planned to restart Oct 2026"
  - "Checked Sep 2026" in `render.mjs` `supportPage` and `transPage`, plus the comment above them
  - the "988’s LGBTQ+ “press 3” option ended July 2025" note in `supportPage`
  - the Support line "Checked Sep 2026" in `keeper.mjs`
  - the `epub.py` Support body
  - `x4/tools/export_pack.py` `'# Support · checked Sep 2026'`
- [ ] **STA feed.** `gtfs/network.json` covers only the months listed in `network.py`.
  - Bus pages follow the feed's dates (`busCoverage()` in `data.mjs`): a month fully inside `valid_from`–`valid_to` prints them; the month the feed ends in prints them with "Schedule valid through … · check spokanetransit.com after" (and a build warning); later months get **no bus pages and no SUN BUS tags**, only "Bus times: spokanetransit.com or the STA app" on the last back page. Refreshing the feed lights up later months by itself.
  - Run the **STA schedules** workflow, or run it by hand (see `journal/README.md`), after updating `months`.
  - Check that the `render.mjs` `GRID_PRIORITY` routes still exist.
  - `gtfs/build.py` hard-codes service ids `'672.8.1'`, `'672.6.1'` and `'672.0.4'` from the Sep 2026 feed. Re-check them against the new `calendar.txt`.
- [ ] **Clinic and care plan.** Update `content/clinic.json` if anything changed.

## 4. Rebuild and proof checklist
- [ ] Put fresh calendar exports in `private/` (see `private/README.md`), or update the `ICS_URLS` secret.
- [ ] `node render.mjs month 2027-10 test.ics` prints no `content gaps:`. Repeat for 2028-02 to catch `02-29`.
- [ ] `./build-all.sh` (or `ICS=private/main.ics,… ./build-all.sh`) exits 0, and every month prints `[] 0` from `check.mjs`.
- [ ] `check-pages.mjs` (part of `build-all.sh`) passes: every page id and printed label unique in each book, `shared` pages (Key, Support, Safety, Quick contacts, Looking back) identical in all 24 books. Keep each proof's `manifest.json`.
- [ ] Look at the pages:
  - "Book 1 of 12 · October 2027"
  - Week 1 on the first spread
  - the Closing page points at the right Keeper spread
  - bus pages are present
- [ ] February 2028 has 29 day pages. Check the page counts still fit KDP (paperback 24–110, hardcover 75+ with `HARDCOVER=1`).
- [ ] No Type 3 fonts (same check as CI; prints nothing when clean):
  ```
  for f in out/*/*interior*.pdf out/keeper/*.pdf; do pdffonts "$f" | grep -q "Type 3" && echo "Type 3: $f"; done
  ```
- [ ] Default day page didn't drift: diff day pages against the last build (see `/CLAUDE.md`).
- [ ] Order **one private KDP proof per size** before buying copies. See [KDP.md](KDP.md). Never a public listing.
- [ ] Rebuild the X4 SD packs (`python3 ../x4/tools/export_pack.py . out/sd-card`) and copy `kw/` to the card.
