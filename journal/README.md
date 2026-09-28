# Keeping Watch — journal generator

Monthly journals (Oct 2026 – Sep 2027) for Amazon KDP, plus a yearly Keeper book and Xteink X4 EPUBs.

## Setup
    npm ci && npx playwright-core install chromium   # Node 20+; or set CHROMIUM_PATH (see browser.mjs)
    pip install pillow          # for epub.py

## Build everything
    ./build-all.sh                                   # sample (test.ics), all months, both sizes
    ICS=private/main.ics,private/birthdays.ics ./build-all.sh

## Build a monthly book
    node render.mjs month 2026-10 private/main.ics,private/birthdays.ics   # 5.5x8.5 -> out/m2026-10/
    SIZE=letter node render.mjs month 2026-10 private/main.ics,...        # 8.5x11  -> out/m2026-10-letter/
    HARDCOVER=1 node render.mjs month 2026-10 ...                           # pads to >= 76 pages for KDP hardcover
    node cover.mjs month 2026-10          # (SIZE=letter for the big one) wrap cover sized to the page count
    python3 epub.py m2026-10              # X4 / CrossPoint EPUB
    node check.mjs m2026-10               # overflow check: must print "[] 0"

Outputs: interior PDF, cover PDF, EPUB, layout.json (scan-zone map, mm from the frame's inner edge), pages.txt, data.json.

## Build the Keeper first (yearly, stays home, no scan codes)
It writes out/keeper/index.json, which the monthly books use to point their "Closing the month" page at the right Keeper handoff spread.
    node keeper.mjs && node cover.mjs keeper   # -> out/keeper/

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
STA's feed ends 2027-01-16. Before printing later books:
    curl -L -o gtfs/sta.zip https://www.spokanetransit.com/gtfs && unzip -o gtfs/sta.zip -d gtfs
    python3 gtfs/network.py && python3 gtfs/build.py

The raw GTFS .txt files are left out of the project zip (download them with the command above).
Your calendar files (private/*.ics) are also left out; put them back in private/ to print events.

## Privacy
Printed books show your calendar events: keep KDP proofs private (never a public listing).
The Keeper holds hints and recovery codes: never scan it.

## Day page editor
`daypage.mjs` is the block library: order, on/off and options for every day page block. `content/daypage.json`
(written by the editor) overrides the default; with no file the page is the original layout.

    node render.mjs month 2026-10 test.ics   # the editor borrows the page CSS from a sample build
    node editor/build.mjs                    # -> editor/dist/site/ (GitHub Pages) + editor/dist/artifact.html
    node editor/test.mjs                     # smoke test + screenshots in editor/dist/test/

The Pages editor saves in the browser and commits `journal/content/daypage.json` with a fine-grained token.
The Artifact editor saves to its store at `layouts/day`; copy that `layout` object into `content/daypage.json`.
The DATE/TITLE/TAGS header and the scan frame, strip and page code are fixed. The X4 firmware is unaffected.
