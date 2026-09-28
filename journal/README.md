# Keeping Watch — journal generator

Monthly journals (Oct 2026 – Sep 2027) for Amazon KDP, plus a yearly Keeper book and Xteink X4 EPUBs.

## Prerequisites
| Tool | Why |
| --- | --- |
| Node 20+ (CI uses 22) | every `.mjs` script |
| Chromium | renders the PDFs: `npx playwright-core install --with-deps chromium` (Linux; `--with-deps` adds system libraries), or point `CHROMIUM_PATH` at one you have (see browser.mjs) |
| Python 3 + pillow | `epub.py`, the X4 SD card |
| poppler-utils | `pdffonts`, for the Type 3 check |
| p7zip | only if you package books into a password 7z |

    npm ci
    npx playwright-core install --with-deps chromium
    pip install pillow

## Build everything
    ./build-all.sh                                   # sample (test.ics), all months, both sizes
    ICS=private/main.ics,private/birthdays.ics ./build-all.sh

## Build the Keeper first (yearly, stays home, no scan codes)
It writes out/keeper/index.json, which the monthly books use to point their "Closing the month" page at the right Keeper handoff spread.

    node keeper.mjs && node cover.mjs keeper   # -> out/keeper/

## Build a monthly book
    node render.mjs month 2026-10 private/main.ics,private/birthdays.ics   # 5.5x8.5 -> out/m2026-10/
    SIZE=letter node render.mjs month 2026-10 private/main.ics,...        # 8.5x11  -> out/m2026-10-letter/
    HARDCOVER=1 node render.mjs month 2026-10 ...                           # pads to >= 76 pages for KDP hardcover
    node cover.mjs month 2026-10          # (SIZE=letter for the big one) wrap cover sized to the page count
    python3 epub.py m2026-10              # X4 / CrossPoint EPUB
    node check.mjs m2026-10               # overflow check: must print "[] 0"

## Settings
| Variable | Read by | Default | What |
| --- | --- | --- | --- |
| `ICS` | build-all.sh | `test.ics` | Comma-separated calendars passed to render.mjs |
| `MONTHS` | build-all.sh | all 12, `2026-10` … `2027-09` | Space-separated `YYYY-MM` list |
| `SIZES` | build-all.sh | `small letter` | `small` = 5.5×8.5 (+ EPUB), `letter` = 8.5×11 |
| `SIZE=letter` | render.mjs, cover.mjs | unset (5.5×8.5) | 8.5×11 book in `out/m<YYYY-MM>-letter/`. build-all.sh sets it from `SIZES` |
| `HARDCOVER=1` | render.mjs (passed through by build-all.sh) | unset (paperback) | Pads with Notes pages to an even count ≥ 76 |
| `CHROMIUM_PATH` | browser.mjs (every script that renders) | Playwright's own Chromium | Use a Chromium you already have |

## Outputs
`out/m<YYYY-MM>/` (5.5×8.5) and `out/m<YYYY-MM>-letter/` (8.5×11):

| File | What |
| --- | --- |
| `keeping-watch-<YYYY-MM>-interior-5.5x8.5.pdf` (`-8.5x11.pdf` in letter) | Interior for KDP. `HARDCOVER=1` names it `-interior-hardcover-<size>.pdf` |
| `keeping-watch-<YYYY-MM>-cover.pdf` (`-8.5x11-cover.pdf` in letter) | Paperback wrap cover, spine sized from pages.txt |
| `keeping-watch-<YYYY-MM>-x4.epub` | X4 / CrossPoint EPUB (small folder only) |
| `journal.html` | The interior as HTML: open it to debug a page |
| `cover.html` | The cover as HTML |
| `layout.json` | Scan-zone map for every page: `type`, `date` (day pages) or `from`/`to` (month and week pages), `section` (front, month, week, back), `code`, `code_format`, and zones in mm from the frame's inner edge. Repeated zone names get `_2`, `_3`. Pages with no labelled block get one `content` zone |
| `pages.txt` | Page count (cover.mjs reads it for the spine). `HARDCOVER=1` writes `pages-hardcover.txt` instead |
| `data.json` | Everything computed for the month (days, moon, sun, events). epub.py and the X4 pack read it |

HARDCOVER=1 covers are named `keeping-watch-<YYYY-MM>-hardcover-cover.pdf` (5.5×8.5 only: KDP has no 8.5×11 hardcover).

`out/keeper/`: `keeper-interior-5.5x8.5.pdf`, `keeping-watch-keeper-cover.pdf`, `keeper.html`, `cover.html`,
`pages.txt`, and `index.json` (the Keeper page each month's "Closing the month" points to).

`out/` is git-ignored: never commit it.

## Checking a build
`node check.mjs m2026-10` opens `out/m2026-10/journal.html` and prints up to 20 problem pages, then the total:

    [{"n":34,"over":true,"out":2}] 1

| Field | Meaning |
| --- | --- |
| `n` | Page number |
| `over` | Page content scrolls past the page box |
| `out` | Elements sticking outside the padded content area |

`[] 0` = pass. Anything else exits 1 (build-all.sh and CI fail).

To fix: open `out/<dir>/journal.html` in Chromium, go to page `n`, find the block that spills. Shorten the content
or adjust the layout. For a custom day layout, turn blocks off in the editor.

No Type 3 fonts (KDP rejects them). Same check CI runs:

    for f in out/*/*interior*.pdf out/keeper/*.pdf; do pdffonts "$f" | grep -q "Type 3" && echo "Type 3 in $f"; done

No output = pass.

## X4 SD card
Needs the months built first (it reads `out/m<YYYY-MM>/data.json`).

    python3 ../x4/tools/export_pack.py . out/sd-card 2026-10    # no months = every built month

Writes `out/sd-card/kw-update/`: one day pack per month (`2026-10.txt`), `support.txt`, `checkins.txt`, `library/` (the
book PDFs and EPUBs; `KW_NO_LIBRARY=1` skips it) and `me.example.txt` (a reference safety plan the X4 ignores).
It never writes `me.txt` or `log/`: those live only on the card, and a blank copy would wipe her plan.

It also writes `checkins.txt` from `content/daypage.json`, so your editor blocks show up on the X4 check-in screen:
Checkboxes become ticks, Scale becomes a 1–steps scale, Habits become dots, and Fill-in blanks become counts (0–99).
Care, spoons and sleep are already built in. The X4 holds **16 custom items** at most; extras are dropped with a warning.

**Update the card:** copy the whole `kw-update` folder to the card's root (Replace is fine), eject, and turn the X4 on.
It moves the files into `/kw` and deletes `/kw-update`. Your safety plan (`/kw/me.txt`) and check-in log (`/kw/log/`)
are never touched. Never copy or replace a `kw` folder. **Closing the month:** download that month's log first
(X4 Menu → Wi-Fi sync → Check-in log). The card holds the only copy.

## Content you edit
| File | What |
| --- | --- |
| content/clinic.json | My clinic box (care plan page + Keeper) |
| content/support.json, content/trans.json | Support and Trans support pages (re-check numbers each edition) |
| content/year.mjs, year-research.mjs, facts.mjs, pioneers.mjs | Daily facts, weekly pioneers, prompts |
| spokane.mjs | 72 Spokane micro-seasons |
| holidays.mjs, payperiods.mjs | US holidays; Carl's Jr pay periods (2027 projected) |
| render.mjs `GRID_PRIORITY` | Which bus routes get full hour grids |

## Bus schedules (STA)
STA's feed ends 2027-01-16. Books print bus pages by the feed's dates: fully covered months as usual, the month it ends in with a "valid through" label, and later months with no bus pages (just a "spokanetransit.com or the STA app" line on the last back page). To print bus times for later books:

    curl -L -o gtfs/sta.zip https://www.spokanetransit.com/gtfs && unzip -o gtfs/sta.zip -d gtfs
    python3 gtfs/network.py && python3 gtfs/build.py

The raw GTFS .txt files are left out of the project zip (download them with the command above).
Your calendar files (private/*.ics) are also left out; put them back in private/ to print events.

## Privacy
Printed books show your calendar events: keep KDP proofs private (never a public listing).
The Keeper holds hints and where things are kept (never passwords or recovery codes): never scan it.

## Day page editor
`daypage.mjs` is the block library: order, on/off and options for every day page block. `content/daypage.json`
(written by the editor) overrides the default; with no file the page is the original layout.

    node render.mjs month 2026-10 test.ics   # the editor borrows the page CSS from a sample build
    node editor/build.mjs                    # -> editor/dist/site/ (GitHub Pages) + editor/dist/artifact.html
    node editor/test.mjs                     # smoke test + screenshots in editor/dist/test/

The Pages editor saves in the browser and commits `journal/content/daypage.json` with a fine-grained token.
The Artifact editor saves to its store at `layouts/day`; copy that `layout` object into `content/daypage.json`.
The DATE/TITLE/TAGS header and the scan frame, strip and page code are fixed. The X4 firmware is unaffected.

### Page codes
Every page carries its own Data Matrix: `KW2|<edition>|<yymm>|<size><page>`, e.g. `KW2|1|2610|S026`.
Size is `S` (5.5x8.5), `L` (8.5x11) or `H` (5.5x8.5 hardcover). The code is built at build time from the final page order,
so it always names the page's real position. 15 characters still fit a 16x16 symbol (0.42 in, 0.66 mm modules, same as before).
The edition is one constant, `content/edition.mjs` (single digit; see NEW-EDITION.md).
`node check-codes.mjs` runs at the end of `build-all.sh` and fails on: a repeated code, a code that doesn't match its page,
book, size or edition, a page with no zone map, a symbol bigger than 16x16, or a code that doesn't decode from the PDF
at 200 dpi (`DECODE=all` checks every page, default is a sample, `DECODE=none` skips). The app picks the zone map by
(yymm, size), and the code says which.

## More docs
- [KDP.md](KDP.md): uploading to KDP
- [NEW-EDITION.md](NEW-EDITION.md): setting up the next year
- [private/README.md](private/README.md): exporting your calendars
