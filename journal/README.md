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
    node test-busy.mjs                    # same check on a synthetic busy calendar (7 events a day, all-day, long titles): every page must fit

## Settings
| Variable | Read by | Default | What |
| --- | --- | --- | --- |
| `ICS` | build-all.sh | `test.ics` | Comma-separated calendars passed to render.mjs |
| `MONTHS` | build-all.sh | all 12, `2026-10` … `2027-09` | Space-separated `YYYY-MM` list |
| `SIZES` | build-all.sh | `small letter` | `small` = 5.5×8.5 (+ EPUB), `letter` = 8.5×11 |
| `SIZE=small\|letter` | render.mjs, cover.mjs | the profile's `trim` | `letter` = 8.5×11 book in `out/m<YYYY-MM>-letter/`. build-all.sh sets it from `SIZES` |
| `HARDCOVER=1` | render.mjs (passed through by build-all.sh) | unset (paperback) | Pads with Notes pages to an even count ≥ 76 |
| `CHROMIUM_PATH` | browser.mjs (every script that renders) | Playwright's own Chromium | Use a Chromium you already have |

## Profile (`content/profile.json`)
Everything about who the journal is for and where lives in one file, so the engine holds nothing personal. The committed
`content/profile.json` is Shelbee's (today's books are built from it and are byte-identical to before the profile existed).
`content/profile.example.json` is a generic person in a made-up city: copy it to `content/profile.json` and edit it to make your own.
A missing or wrong field stops the build with one message listing every problem, for example `location.lat: is required`.
`KW_PROFILE=path` builds with another profile without touching the committed one (`test-profile.mjs` does).

| Field | Used for |
| --- | --- |
| `person.name` | EPUB author |
| `book.title`, `book.subtitle`, `book.slug` | Title page, cover, spine, Keeper, EPUB, editor header; `slug` names the PDFs and EPUBs (`<slug>-2026-10-interior-5.5x8.5.pdf`) |
| `book.edition` | The edition digit in every page code (1-9; see NEW-EDITION.md) |
| `book.start` | First month of the 12-month year (`2026-10`): book numbers ("Book 3 of 12"), the Keeper's month list and label |
| `book.epoch` | Optional Monday that is week 0 (week labels, and which pioneer, word and prompt each week gets). Default: the Monday on or before the 1st of `book.start` |
| `location.*` | `place` (title page, sky data), `city` and `region` (eclipse and support notes), `lat`, `lon`, `elevation` (sunrise, sunset, moon, eclipses), `timezone` (all clock times), `timezone_name` (printed) |
| `day_start_hour` | Hour the paper day starts (Shelbee's 4). Exported into the X4 pack (`checkins.txt`, first line ends `· profile day_start=4 tz=...`). The firmware still compiles in its own `DAY_STARTS_HOUR`; `test-profile.mjs` fails if the two differ |
| `trim` | Default trim, `small` (5.5x8.5) or `letter` (8.5x11). `SIZE=small|letter` overrides it; build-all.sh always sets `SIZE` |
| `modules.*` | Switches, all required: see below |
| `crisis.lines` | The lines printed on the safety plan after "my prescriber;" (default: 988 and the 741741 text line) |
| `transit` | Needed when `modules.bus` is on: `agency`, `site`, `app` (used in the bus page titles and notes), `priority_routes` (routes that get hour grids first), `short_stops` (stop-name abbreviations) |
| `paths.*` | Content files, relative to `journal/`: `support` (required), `trans`, `clinic`, `transit` (feed folder, default `gtfs`), `seasons` (module exporting the 72 micro-seasons; without one, the English names of the Japanese seasons) |

Modules. Switched off, a module's pages are left out of the book when it is laid out (`content/book.json` is untouched; the entries stay
listed and simply build nothing), and every reference to them goes too (no "Bus times p. ?"). The protected pages (Support,
My safety plan, Closing the month) can't be switched off. The moon and sun are still calculated (calendars and the 24 h line use them).

| Module | Off removes |
| --- | --- |
| `bus` | The bus pages, the bus note on the lineage page and the EPUB bus chapter; no transit feed is read |
| `sky` | The month sky & seasons and moon pages, the day page sky line, the title page place line |
| `trans_support` | The Trans support page (book, Keeper, EPUB, X4 support list) |
| `therapy` | Feelings, skills, urge and thought record blocks (day page and X4 check-ins); they stay in `daypage.json` |
| `spoons` | Spoons and energy account blocks, the spoon lines on the Key and lineage pages, the Good-spoon box on Closing and in the Keeper. The X4 still has its built-in spoons counter (firmware is unchanged) |
| `pay_periods` | Pay period and payday marks (`payperiods.mjs` holds one employer's sheet; leave it off for anyone else) |

Content packs (support lists, clinic, trans, transit feeds) are still plain files named by `paths`. The point of the profile is that
nothing else in the engine mentions them. `node test-profile.mjs` builds the generic profile (Lakemont, MN), checks that none of
Shelbee's words are in its book, cover, EPUB or X4 pack, that it passes the overflow gate (`[] 0`), and builds each module off.

## Outputs
`out/m<YYYY-MM>/` (5.5×8.5) and `out/m<YYYY-MM>-letter/` (8.5×11):

| File | What |
| --- | --- |
| `keeping-watch-<YYYY-MM>-interior-5.5x8.5.pdf` (`-8.5x11.pdf` in letter) | Interior for KDP. `HARDCOVER=1` names it `-interior-hardcover-<size>.pdf` |
| `keeping-watch-<YYYY-MM>-cover.pdf` (`-8.5x11-cover.pdf` in letter) | Paperback wrap cover, spine sized from pages.txt |
| `keeping-watch-<YYYY-MM>-x4.epub` | X4 / CrossPoint EPUB (small folder only) |
| `journal.html` | The interior as HTML: open it to debug a page |
| `cover.html` | The cover as HTML |
| `layout.json` | Scan-zone map for every page: `id` (stable page id), `label` (what the page prints to identify itself), `shared`, `type`, `date` (day pages) or `from`/`to` (month and week pages), `section` (front, month, week, back), `code`, `code_format`, and zones in mm from the frame's inner edge. Repeated zone names get `_2`, `_3`. Pages with no labelled block get one `content` zone |
| `manifest.json` | Print manifest: build stamp (`built`, `commit` in CI), book, size, edition, and for every page its `code` → `id` → `section` (+ label, type, date, `shared`, zones). Keep it with each proof or print run: it is how an old printed page decodes after the layout changes |
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

## What lives where (the care split)
Paper and the X4 are one system. Every daily care item lives in exactly one place, and each side says where the other half is.

| | Paper | X4 |
| --- | --- | --- |
| Meds (morning, evening, as-needed), meals, water | yes: the day page care block | not on Check in or Today ("on paper") |
| Mood (dots numbered −3…+3, the middle marked) | yes | not on Check in or Today ("on paper") |
| Work shift times, routines, events, writing | yes: paper is the record | shows routines, events and notes only |
| Spoons **left** (0–12), sleep hours, anxiety 0–3 | off by default (switchable in the editor) | yes: Check in, Today, This month |
| Shower, teeth, joy, texted, snack | off by default (switchable) | yes: the "care ticks" |
| Your own check-ins (editor blocks) | prints the block | also on Check in |
| Safety plan | **source of truth** | a copy; "if this differs, trust the book" |

The day page prints one small line under the care block naming what the X4 keeps ("X4: spoons · sleep · anxiety · care ticks").
The line only lists what is off the page, so switching an X4 row back on in the editor removes it from the line.

## Month totals: the six boxes
`handoff.mjs` is the one definition of the six boxes on the Closing page, the Keeper's handoff spread and (for the two X4 ones) the X4's This month:

| Box | Unit | Comes from |
| --- | --- | --- |
| Avg mood | −3…+3 | paper tracker |
| Meds taken | days, all doses | paper tracker |
| Avg meals | a day, 0–3 | paper tracker |
| Work hours | h | paper tracker |
| Avg sleep | hours | X4 → This month |
| Good-spoon days | 4+ left | X4 → This month |

`check-handoff.mjs` (run by `build-all.sh`) fails the build when a label or unit differs between those pages or from the X4 firmware.
The paper tracker page holds mood dots, meds tick, meals 0–3 and work hours only; it says spoons, sleep, anxiety and care ticks are on the X4.

## X4 SD card
Needs the months built first (it reads `out/m<YYYY-MM>/data.json`).

    python3 ../x4/tools/export_pack.py . out/sd-card 2026-10    # no months = every built month

Writes `out/sd-card/kw-update/`: one day pack per month (`2026-10.txt`), `support.txt`, `checkins.txt`, `library/` (the
book PDFs and EPUBs; `KW_NO_LIBRARY=1` skips it) and `me.example.txt` (a reference safety plan the X4 ignores).
It never writes `me.txt` or `log/`: those live only on the card, and a blank copy would wipe her plan.

It also writes `checkins.txt` from `content/daypage.json`, so your editor blocks show up on the X4 check-in screen:
Checkboxes become ticks, Scale becomes a 1–steps scale, Habits become dots, and Fill-in blanks become counts (0–99).
Spoons left, sleep, anxiety and the care ticks are built in (meds, meals, water and mood stay on paper). The X4 holds **16 custom items** at most; extras are dropped with a warning.

**Update the card:** copy the whole `kw-update` folder to the card's root (Replace is fine), eject, and turn the X4 on.
It moves the files into `/kw` and deletes `/kw-update`. Your safety plan (`/kw/me.txt`) and check-in log (`/kw/log/`)
are never touched. Never copy or replace a `kw` folder. **Closing the month:** download that month's log first
(X4 Menu → Wi-Fi sync → Check-in log). The card holds the only copy.

## Content you edit
| File | What |
| --- | --- |
| content/profile.json | Who and where (see Profile above) |
| content/clinic.json | My clinic box (care plan page + Keeper) |
| content/support.json, content/trans.json | Support and Trans support pages (re-check numbers each edition) |
| content/year.mjs, year-research.mjs, facts.mjs, pioneers.mjs | Daily facts, weekly pioneers, prompts |
| spokane.mjs | 72 Spokane micro-seasons (the profile's `paths.seasons`) |
| holidays.mjs, payperiods.mjs | US holidays; Carl's Jr pay periods (2027 projected) |
| content/profile.json `transit.priority_routes` | Which bus routes get full hour grids |

## Bus schedules (STA)
STA's feed ends 2027-01-16. Books print bus pages by the feed's dates: fully covered months as usual, the month it ends in with a "valid through" label, and later months with no bus pages (just a "spokanetransit.com or the STA app" line on the last back page). To print bus times for later books:

    curl -L -o gtfs/sta.zip https://www.spokanetransit.com/gtfs && unzip -o gtfs/sta.zip -d gtfs
    python3 gtfs/network.py && python3 gtfs/build.py

The raw GTFS .txt files are left out of the project zip (download them with the command above).
Your calendar files (private/*.ics) are also left out; put them back in private/ to print events.

## Privacy
Printed books show your calendar events: keep KDP proofs private (never a public listing).
The Keeper holds hints and where things are kept (never passwords or recovery codes): never scan it.

## Pages as shared functions (book canvas)
Every page of a book is built by `pages.mjs`: pure functions (data + options -> HTML) with no fs or process, so print and the
editor run the same code. `PAGE_TYPES` lists the page types (title, key, month calendar, week left/right, day, review, exchange,
support, safety, bus, lineage ...) and `renderPages(type, ctx)` builds any of them. `context.mjs` loads the data a page needs
(month, year content, STA schedule, directories) into one `ctx`; `book.mjs` lays the pages out (`DEFAULT_BOOK` is today's
sequence) and adds what is never hand-set: recto/verso Notes pages, the even page count (>= 24, hardcover >= 76), `{{P_x}}` page
references. `render.mjs` only adds the frame, scan markers and page codes. The editor build writes
`editor/dist/site/pages-sample.json` (every page type from `test.ics`, no clinic details).

### Book-first navigation (the editor opens on the Book)
The editor opens on the **Book**: the whole book on a pan/zoom canvas, spreads laid out as it opens (title page alone on the
right, then left|right pairs, the last even page alone on the left). Every page is a live thumbnail drawn by `pages.mjs` from the
sample calendar (`test.ics`, never your data; no clinic details), painted lazily near the view. There are no tabs: zoom is one
continuous semantic zoom through three levels.

| Level | What you see | URL hash |
| --- | --- | --- |
| Book | every spread | `#book` |
| Spread | two facing pages, large | `#spread/12` (1-based) |
| Day | the day-page editor (Flow/Grid, palette, options, undo, save, methods) for a day page; a read-only page view for any other page until block pages arrive (C5) | `#day/2026-10-14`, `#page/safety` |

- **Move between levels:** tap a page (book to spread, spread to day; a quick double tap goes straight to the day), zoom in past
  one whole page (wheel, pinch, `+`), the Book / Spread / Day buttons, the breadcrumb (`Book > Spread 12 > Day Oct 14`), Back.
  Out: breadcrumb, Back, `Escape`, a pinch in or ctrl/cmd + wheel over the page at the day level. Plain wheel zooms the canvas
  (it does not scroll); the browser's own zoom is left alone everywhere else.
- **Keys:** `Enter` in, `Escape` out, `Alt+Up` / `Alt+Down` out / in from anywhere, `0` book, `1` spread, `2` day (canvas);
  `+` `-` zoom, arrows pan, `[` `]` previous/next page, `Home` `End`, `g` or `/` jumps.
- **URL:** the hash records the level, so links, reload and the browser's Back and Forward restore it (an unknown or out-of-range
  hash opens the book). Back (the button) uses history when there is some, else goes up one level.
- **Accessibility:** every control is a labelled 44px button; the breadcrumb is a labelled `nav` with `aria-current`; a live region
  says "Now at: ..." on every level change and focus moves to the current crumb; focus is visible; with reduced motion the zoom
  between levels is instant.
- **Jump:** type a page number (`30`, `p30`) or an id (`safety`, `week.03.review`, a date like `2026-10-05`).
- **Legend (i):** lock = protected page (Closing, Support, Safety plan: can move, never hidden); pages a book hides in
  `content/book.json` sit dimmed in a row under the book; the 5.5x8.5 / 8.5x11 switch reflows the same pages.
- **Versions mount:** `#versions-slot` (header, every level) and `#versions-drawer` are empty shells; `KW.drawer.open()` /
  `.close()`, `KW.on(fn)` (level changes) and `KW.go(target)` are the hooks for the Versions panel.
- The day editor edits one layout shared by every day page; its preview is a sample day whatever date you opened.
  Reordering, hiding and adding pages come in later canvas steps. Works in the GitHub Pages site (loads `pages-sample.json`) and
  the Artifact (the sample book is embedded, gzipped).

    node check-identical.mjs          # after build-all.sh: the default books still match identical.json

`identical.json` holds a fingerprint per page HTML of the default books (from `test.ics`). A change that is meant to alter the
default books: rebuild them all, then `node check-identical.mjs --update` and commit the new file with the change.

### The book layout (`content/book.json`)
`book.mjs` `DEFAULT_BOOK` is the page order; `content/book.json` (the committed copy equals the default) overrides it and
`render.mjs` follows it. Validation runs at build time and says what is wrong and where.

    { "version": 1,
      "default": [ {"id": "title", "type": "title", "on": true, "options": {}}, ... ],
      "months": { "2027-02": { "pages": [ ...a whole list for that month's book... ] } } }

- One entry per page type (`PAGE_TYPES` in `pages.mjs`); `on: false` hides it. `notes` entries can be added and repeated (option `title`).
- The `weeks` entry is the journal itself: its `month` list is that month's pages (calendar, sky, tracker, moon), its `week` list is each
  week's pages (left, right, days, review, exchange + reply).
- Safety plan, Support and Closing the month can be moved but never hidden or removed. Each other page type appears once.
- Never hand-set: recto/verso (a Notes page is added where a spread needs one), even page count (>= 24, hardcover >= 76), `{{P_x}}`
  page references (a hidden page's pointer is dropped from How to use it; a pointer that cannot resolve is an error), scan codes, the
  Keeper's handoff page number. Page ids stay `week.03.reply`, `day.2026-10-14` ... whatever the order.
- `node test-book.mjs` checks the rules and the sequence. A book that differs from the default is skipped by `check-identical.mjs`.

## Day page editor
(This is the day level of the editor: open a day page from the Book, or `#day/2026-10-14`.)
`daypage.mjs` is the block library: order, on/off and options for every day page block. `content/daypage.json`
(written by the editor) overrides the default; with no file the page is the original layout.

    node render.mjs month 2026-10 test.ics   # the editor borrows the page CSS from a sample build
    node editor/build.mjs                    # -> editor/dist/site/ (GitHub Pages) + editor/dist/artifact.html
    node editor/test.mjs                     # smoke test + screenshots in editor/dist/test/

The Pages editor saves in the browser and commits `journal/content/daypage.json` with a fine-grained token.
The Artifact editor saves to its store at `layouts/day`; copy that `layout` object into `content/daypage.json`.
The DATE/TITLE/TAGS header and the scan frame, strip and page code are fixed. The X4 firmware is unaffected.

### Presets and options (Tier 1)
Every option is off (or at today's value) by default, so an unchanged layout prints exactly the same page.
Presets are ready-made blocks in the palette. Checkbox, habit, blank and scale presets are also X4 check-ins.

| Group | Presets (palette name: labels) |
|---|---|
| Planning | Rituals: Morning, Start, Shut down, Evening. Today's 3: #1, #2, #3. One Q2 thing. Inbox cleared. Weekly review (dots). Shutdown: Lists captured, Tomorrow's first block, Work closed. Deep blocks (blanks): planned, done. Focus rounds count (blank) |
| Check-ins | Supports: Headphones, Hood, Dark room, Alone time. Masking (4 steps, none to all day). Felt like me (5 steps, not today to so me). Voice minutes (blank). Cycle & dose: Period, Dose day. Deposits done: Rest, Alone time, Outside. Sharpen the saw: Body, Mind, Heart, Spirit. Places (blank). Something new: Something new, Went outside, Talked to someone. Made something: Made something, Went outside. Good today: Warmth, Food, Rest, People, Outside. Device-free hour. Outside & light (dots): Outside, Daylight on face, Moved. One small good thing (blank) |

| Block | Option | Values (default first) |
|---|---|---|
| Top priorities | How many | 3 (1 to 6) |
| | Guess / took columns (`est`) | off, on: two short blanks per line, with a header |
| | Carried column (`carried`) | off, on: a tick box for "carried again" |
| Time blocks | From / To (hour) | 8 / 22; From goes down to 0, To up to 24 |
| | Actual column (`actual`) | off, on: plan and actual side by side |
| | Re-plan columns (`replan`) | 0, 1, 2. Three or more columns switch to one wide list |
| Lined notes, Two columns | Line spacing (`pitch`) | Tight 5.6 mm (today), Standard 6.6 mm, Wide 8.5 mm |
| Writing space | Paper (`style`) | Dot grid, Lines, Bold lines (1.5 pt black at 9/16 in), 4 mm grid, 3.7 mm grid, Blank |
| | Secret line (`secretLine`) | off, on: a faint vertical line 0.9 in from the left |
| Small good things | Label (`label`) | Small good things |
| | "because" (`because`) | off, on: each line gets a "because" half |
| Sensory load | Senses | Sound, Light, Crowds, Touch on; Smell, Social, Temperature, Movement off |
| Habit dots | Legend (`tiny`) | half / full, or tiny / done |
| Sketch box | Tape marks (`corners`) | off, on: four thin corner ticks |
| | Caption (`caption`) | none, up to 30 characters next to the label |
| Divider | Icon (`icon`) | None, Sun, Moon |
| Checkboxes, Scale | Scan-ready (`omr`) | off, on: 12 px marks with wider gaps, easier to read by optical mark reading |

Scan zones do not change: every block keeps its `data-zone`. Print draws all rules and grids as vectors (`rulings.mjs`).

### New blocks (Tier 2, part 1)
Palette only: the default page does not change. Every block starts small (one row, or as few as make sense) so it fits the
default day when added; raise the rows in its options and watch the editor's meter (5.5x8.5 has about 0.4 in to spare on a busy
day, 8.5x11 about 0.7 in). Labels are icons plus a few words; everything prints black and white (night shading is 15 % grey).

| Block (zone) | What it prints | Options (default first) | X4 |
|---|---|---|---|
| Time line 24 h (`tl24`) | 24 boxes, plan row (and actual row), hour labels; hours before sunrise and after sunset shaded from that day's calculated sun times | Starts at 0 (0 to 23: a night shift can start at 18); labels every 3 h (2, 3, 4, 6); actual row off; shade night on | none |
| Brain dump (`dump`) | A box on dots, label inside | Rows 1 (1 to 10); paper dots, lines, blank | none |
| Later (`later`) | Arrow rows to park a thought | Rows 1 (1 to 6) | none |
| Done list (`done`) | Rows to fill in after | Rows 1 (1 to 8); tick boxes on | none |
| Wall of Awful (`wall`) | Circle what is in the way (scary, boring, too big, unclear, tired, stuck), then a way past (tiny step, ask, 5 minutes, not today). Low-shame words; paper only | The two word lists are editable | none |
| Time stamps (`stamps`) | `__:__` and a line per switch; optional "resume with" row (arrow) | Rows 1 (1 to 10); resume off | none |
| Focus rounds (`rounds`) | Task lines with square boxes, one per round; tally spots for interruptions (me / others); never called Pomodoro | Tasks 1 (1 to 5); rounds per task 4 (1 to 7); marks on; length "25 min" | **count** `focus_rounds`, 0..16 |
| Energy types (`energy`) | A row of dots per kind (Body, Mind, People, Senses) | Kinds (up to 6); steps 3 (3 to 5) | **scale** per kind, 1..steps |
| Energy accounts (`accounts`) | Start, pairs of "what / cost", and "left: X4" (the X4 keeps spoons left) | Items 2 (2 to 6); left on X4 on | none |
| Week at a glance (`weekstrip`) | This week Monday to Sunday, today ringed, room to write; the same on every page of the week, no cutting | Height 0.3 in (0.3 to 0.8) | none |
| Keep (`keep`) | Words to keep, a "moved" box, an optional "from" line | Lines 1 (1 to 4); source off; moved on | none |
| A month ago today (`lookback`) | The date a month (or a year) back, generic, and a line | Look back month or year; lines 1 (1 to 2) | none |
| Rotating prompt (`prompt`) | One prompt from a fixed list of 36, picked by date, so a reprint gives the same one; a "pass" box | Changes daily or weekly (Monday to Sunday); lines 1 (1 to 5); pass on | none |
| Day pixel (`pixel`) | An empty square to fill, and 5 or 7 level swatches to circle | Levels 5 (5, 7); low / high words on | none |
| Low and high (`range`) | The lowest and highest point of the day, two rows of dots | Steps 5 (3 to 7); left / right words flat, bright | none |

Blocks that export show the "also on X4" mark in the editor and appear in `checkins.txt` (`x4/tools/test_export.py` covers
them). `focus_rounds` is the key the X4 Focus timer files its count under. A second Focus rounds block stays paper only.
The 24 h line, the look-back date and the prompt read the day's `parts.day` (`{date, rise, set}`) that `render.mjs` passes in;
the editor uses a generic sample day (2026-10-31).

### Size options
Every block that had a fixed height now has a size control. Each starts at today's size, so an unchanged layout prints exactly
the same page (checked byte for byte against the previous block library for the default layout, every old block type and every
preset). The editor's meter follows the new heights; rules and grids print as vectors at every size (`rulings.mjs` already
draws each line spacing, and the row edges and `.lines` rules take any height).

| Block | Option | Values (default first) |
|---|---|---|
| Top priorities, Time blocks, Quick bullets | Line spacing / Row height (`pitch`) | Tight 5.6 mm, Standard 6.6 mm, Wide 8.5 mm |
| Small good things | Line spacing (`pitch`) | Tight 5 mm (0.2 in), Standard 6.6 mm, Wide 8.5 mm; up to 8 lines |
| Went well / Was hard / Tomorrow | Height in lines (`h`) | 2 (1 to 5) |
| Action items | Row height (`h`), lines | Standard 0.24 in, Roomy 0.3, Wide 0.36; 3 lines (1 to 8) |
| Lined notes, Two columns | Lines | 2 or 3 (1 to 12) |
| Quick bullets | Rows | 5 (2 to 14) |
| Time line 24 h | Row height (`h`) | Compact 0.18 in, Standard 0.24, Roomy 0.3 |
| Brain dump, Later, Done list, Time stamps, Focus rounds, Keep, Rotating prompt, A month ago today | Row height (`pitch`), rows | Tight 5.6 mm, Standard 6.6 mm, Wide 8.5 mm; rows up to 8 to 12 |
| Wall of Awful | Lines to write below (`n`), row height | 0 (0 to 4) |
| Checkboxes, Habit dots, Scale, Fill-in blanks, Words, Sensory load, Sleep times, Weather, Bus plan, Spending, Reach out, Work shift, Energy types, Energy accounts, Wall of Awful, Day pixel, Low and high | Roomy spacing (`roomy`) | off, on: more height per row and wider gaps |

Sketch box (`h`), Space (`h`), Spending, Bus plan, Reach out and Work shift (row counts) already had size controls.
### Therapy and body blocks (Tier 2)
Palette-only: none of these is on the default page, so an unchanged layout prints exactly the same. They sit under **Therapy** and **Body** headings in the palette.
The Therapy blocks (diary card and thought record) each print a small "Use with a therapist" line with **988** (call or text) and **Trans Lifeline (877) 565-8860**, the same numbers as the Support page (`THERAPY_NOTE` in `daypage.mjs`; keep it in step with `content/support.json`). They are not advice.

| Group | Block (zone) | Options | X4 (`checkins.txt`) |
|---|---|---|---|
| Therapy | Feelings 0-5 (`feelings`) | Label, up to 6 feelings (Sad, Shame, Anger, Fear, Joy) | Off until "Also on X4": one `scale` 0..5 per feeling |
| | Skills 0-7 (`skills`) | Label, print what 0-7 mean (one line) | Off until "Also on X4": one `scale` 0..7 |
| | Urge + acted (`urge`) | Label, up to 3 urge names of your own (default "Urge") | Off until "Also on X4": a `scale` 0..5 and an "acted" `toggle` per urge |
| | Thought record (`thought`) | 3, 5 or 7 boxes; 1-3 lines per box | Paper only |
| Body | Injection site rotation (`sites`) | Label, up to 8 sites (default L/R thigh, L/R belly), time blank | Always: one `choice` with the site words (12 characters each, 2 or more sites) |
| | Body signals (`bodysig`) | 1-3 times a day; Hungry, Thirsty, Toilet, Tense, Tired on; Hot/cold, Heart off | Paper only |
| | Overload (habit dots preset) | one dot: empty, half (near miss), full | `dots` |
| | Special interest (lines preset "Into today") | 2 lines | Paper only |

Scales here are zero-based (0..5, 0..7), and the X4 stores exactly the printed numbers. The X4 keeps at most 16 custom check-ins: the therapy blocks are opt-in so they do not fill it by surprise, and the editor warns ("X4 holds 16 custom items; you have N") before `export_pack.py` drops the last ones. `x4/tools/test_export.py` covers every case.
On the small page (5.5 x 8.5) all of these fit together with the writing space when the moon line and action items are off (thought record at 3 boxes); each one fits on its own on the default day.


### Page grid (Grid layout switch)
Flow (the default) stacks blocks in order and the writing space takes what is left. **Grid** puts every block on a fixed grid and lets it span rows and columns.
- **Fixed grid, `GRIDS` in `daypage.mjs`.** Day page: 4 columns, rows one tight line high (0.22 in, 5.6 mm), 24 rows on both trims (measured: 590.4 px day area, 65.6 px header, so 524.8 px = 24.85 rows; 0.19 in stays blank above the SEND TO strip). The 8.5x11 book is laid out at the same height and zoomed, so its rows and columns match (a row is 7.2 mm there).
- **Stored as** `{v: 2, grid: true, blocks: [{..., col, row, colSpan, rowSpan}]}` (1-based). The flow layout and the default page are unchanged (placements are ignored without `grid`). X4 export reads only the blocks, so it is the same wherever a block sits (the editor test compares it).
- **Rules** (`gridProblems()`, with messages): no overlap; each block at least its content's minimum (`minSpan()`, measured; the editor test checks every block type and option variant fits its minimum on both trims); inside the 4 columns and 24 rows; the Writing space at least 8 rows by 2 columns. The date/title/tags header, SEND TO strip, page code and frame are not blocks and never move. A grid layout that breaks a rule stops the build and says why.
- **Data blocks** (holidays, events, on this day) keep their cell on days without one. Turning Grid on stacks the blocks at their minimums and switches off blocks from the end of the list until the writing space has its 8 rows (today: On this day); place it beside another block to bring it back.
- **Scan zones:** one zone per block cell (its grid rectangle, `_2`, `_3` for repeats); parts inside a cell (the care rows) are not listed. `check.mjs` also checks each cell (`blk` names the block).
- **Editor:** the Flow / Grid switch, the grid drawn over the preview (Actual size on wide screens), drag to snap, corner handle to resize, arrows to move and Shift + arrows to resize, Column/Row/Wide/Tall steppers per block, undo, and a list of problems. Blocks with room to spare (Lined notes, Two columns, Sketch box, Brain dump, Writing space) fill their cell.

### Page identity
Every page has an `id` in `layout.json`, unique in its book and derived from what the page is, not where it sits:
`title`, `key`, `care_plan`, `month.calendar`, `week.03.left`, `week.03.right`, `week.03.exchange`, `week.03.reply`,
`day.2026-10-14`, `support`, `safety`, `bus.grid.2`, `lineage`. The id is also on the page as `data-page-id`. Only padding pages are
numbered by order (`notes.1`, `notes.2`), and they print it ("Notes 2" in the TITLE box). Exchange and Reply print their week and dates
("Reply · Week 3"); each week's right-hand page prints "Week 3" over its priorities; bus grid pages list their routes.
`shared: true` marks pages meant to repeat in every book (blank, Key, Key continued, Quick contacts, Looking back, Support, Trans support,
Safety plan). Pages that carry page numbers, the month or the calendar (How to use it, Care plan, Where each piece comes from) are not shared.
`node check-pages.mjs` (run by `build-all.sh` and CI) fails when an id repeats, two pages in a book share a printed label and date,
a label isn't printed on its page, two pages in a book print identically, or a shared page differs between books or sizes.
`check-codes.mjs` also checks that each code maps to the right page id in `manifest.json`, and that decoded codes do too.

### Page codes
Every page carries its own Data Matrix: `KW2|<edition>|<yymm>|<size><page>`, e.g. `KW2|1|2610|S026`.
Size is `S` (5.5x8.5), `L` (8.5x11) or `H` (5.5x8.5 hardcover). The code is built at build time from the final page order,
so it always names the page's real position. 15 characters still fit a 16x16 symbol (0.42 in, 0.66 mm modules, same as before).
The edition is one constant, `content/edition.mjs` (single digit; see NEW-EDITION.md).
`node check-codes.mjs` runs at the end of `build-all.sh` and fails on: a repeated code, a code that doesn't match its page,
book, size or edition, a page with no zone map, a symbol bigger than 16x16, or a code that doesn't decode from the PDF
at 200 dpi (`DECODE=all` checks every page, default is a sample, `DECODE=none` skips). The app picks the zone map by
(yymm, size), and the code says which.

## Book plan (scopes, undated books, volumes)
One book is one calendar month by default. The profile's `book` section can change that (`plan.mjs` is the whole rule):

    "book": { ..., "scope": "year", "keeper": "twelve-book", "closing": "month" }

| Setting | Values |
|---|---|
| `scope` | `month` (default: today's twelve monthly books), `quarter` (3 months from `book.start`), `season` (from the 1st of the start month to the day before the next solstice or equinox at least 60 days later: Oct 1 gives Oct 1 - Dec 20), `half-year`, `year`, `custom` (`book.custom: {"start": "2026-10-05", "end": "2027-01-20"}`, at most 1100 days), `undated` |
| `undated` | `{"days": 90, "weeks": 13, "months": 3, "extras": ["theme", "tracker", "notes"], "fillins": true}`; weeks and months default from days |
| `keeper` | `twelve-book` (today), `per-book`, `none` (`build-all.sh` skips the Keeper and the Closing pages stop pointing to it). `per-book` is accepted and treated like `twelve-book` until H2 |
| `closing` | `month` (a Closing page after each month that ends in the volume) or `end` (once at the end of each volume; always for undated) |
| `id` | The book's own scan-code id, 8 characters (0-9 A-Z without I L O U). Made once at the first build that needs it and written into the profile |

    node render.mjs plan [test.ics] [--json]    # show the plan and the volume split, no rendering
    node render.mjs book [test.ics]             # build every volume into out/b-<id>/ (SIZE=letter, HARDCOVER=1 as for months)
    node cover.mjs book year-2026-10-v3         # that volume's cover ("Volume 3 of 9" and its range)

**Month pages repeat for every month in the span**, week pages run continuously (week numbers carry across volumes), and each day, week
and month page id says which one it is (`month.2026-11.calendar`, `week.07.left`, `day.2026-11-09`; undated: `day.017`).
A week belongs to the month its first day is in; a month's pages come before its first week.

**Volumes.** Paperback is 24-110 pages, hardcover 76-110 (shorter volumes are padded with Notes pages). If a book is over 110 pages the
build counts pages with the real page builders and splits the span into the fewest volumes that each fit, as evenly as it can: on month
boundaries when that works, else on the fewest week boundaries. It is deterministic and `plan` prints the split and why. A volume cut
mid-week keeps that week in both volumes (the outside days say "in volume 2"), and no day is dropped or repeated. Each volume has its own folder
(`b-<scope>-<start>-v<N>`), interior PDF, `layout.json`, `manifest.json` (book id, volume N of M, plan), cover and scan codes. At most 35 volumes.

**Undated books.** No printed date anywhere: the DATE box is blank, the day page says "Day 17", weeks say "Week of ____" with a blank
date row under the weekday letters, months are a blank grid (write the weekday the 1st falls on in the first header box) with numbered
cells 1-31. Sky, holidays, events, pay marks and bus are off; the sky line and "On this day" become fill-ins; the rotating prompt goes by
page number. Page ids, labels and codes go by order, and the manifest records the day, week or month number, not dates. The title page
prints a build stamp instead of a date. The X4 pack (`epub.py`) is for the monthly books only.

**Scan codes for these books** are `KW3` + book id (8) + volume (1 character, base 36) + size letter + page (3 digits), 16 characters,
still a 16x16 Data Matrix. Nothing in it is a date. Monthly books keep `KW2|<edition>|<yymm>|<size><page>` exactly. `check-codes.mjs`
checks uniqueness across every book present in `out/` (or `KW_OUT`, and `KW_REGISTRY` folders), and fails when one book id is on two different plans.
`node test-scopes.mjs` (CI) builds every scope and checks all of this.

## More docs
- [KDP.md](KDP.md): uploading to KDP
- [NEW-EDITION.md](NEW-EDITION.md): setting up the next year
- [private/README.md](private/README.md): exporting your calendars
