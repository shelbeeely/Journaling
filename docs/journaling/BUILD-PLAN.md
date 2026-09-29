# Build plan: book canvas, unique pages, blocks from the research, X4 companion

Status: proposal for Shelbee to pick and cut. Nothing here is built yet. Written 2026-09-28 from the 43 method docs
(`docs/journaling/methods/`), the four book reviews (`docs/review/`) and the merged fixes (#41–#49).

Ground rules (from CLAUDE.md, unchanged): calm and low-stimulation, black and white, every block has a `data-zone`,
no Type 3 fonts, default layout must not drift, the X4 is always a companion to a book, no notifications on the X4,
and features are added only when Shelbee says yes.

## 1. Where things stand

- Merged and verified on `main`: all 24 books (12 months × 2 sizes) pass the overflow check, 1,848 scan codes are
  unique and decode from the PDF, Exchange/Reply face each other, buses follow the STA feed dates, X4 check-ins can
  no longer land on the wrong day, and the SD card copy can't overwrite the safety plan or delete the log.
- Not done: the care split between paper and X4 (section 4), MW6 (events and notes run together in week rows), busy-day
  overflow on month/week pages, crisis numbers not confirmed on official sites, STA feed refresh, sample X4 card facts.

## 2. Unique pages and codes (do first)

What is true today, measured on the merged build:

| Check | Result |
|---|---|
| Scan codes unique inside a book, and across sizes | Yes: 1,848 distinct across 24 books; build fails if not (`check-codes.mjs`) |
| Each code decodes from the finished PDF | Yes: sampled at 200 dpi, all pass |
| Pages whose printed content is identical to another page in the same book | **85 pages in 25 groups**: 3 blank Notes pages, 4 "Reply" pages, 2 empty "Words to keep" pages per book, and more |
| Pages identical across books | 233 pages in 23 groups (front matter: Key, Quick contacts, Anatomy…). Intended, but not declared |

So the code is unique but the *page* often isn't recognisable without scanning it. The plan makes both unique:

1. **Every page gets a unique id** in `layout.json`, stable when pages move (`reply.w03`, `notes.2`, `day.2026-10-14`).
2. **Every page prints its own identity**: Reply says which week it answers, Notes pages are numbered ("Notes 2"),
   empty "Words to keep" pages carry their week. Nothing prints identically twice in a book.
3. **Shared pages are declared**: front matter that is meant to repeat (Key, Anatomy) is marked `shared` and checked
   to be byte-identical across books, so it can't drift silently.
4. **Build check**: no two pages in a book share (id, printed label, date); duplicates outside `shared` fail the build.
5. **Print manifest**: each build writes `manifest.json` (code → page id → zones, plus the build stamp that is already
   printed on the title page). Keep the manifest with each proof or print run, so an old printed book still decodes
   after the layout changes.
6. **Codes stay generated at build time from the final page order**, so moving pages on the canvas can never leave a
   stale code. Data Matrix 16×16 is full at 15 characters; if a layout revision is wanted in the code it needs the
   18×18 symbol (measure first), otherwise the manifest carries it.

## 3. Book canvas (the page editor grows from days to the whole book)

What you asked for: see all pages, organise them, on a pan/zoom canvas of spreads. Also: reorder/hide, add pages, edit
any page's blocks, per-month versions, unique scan codes.

Design:
- New `content/book.json` says which pages a book has and in what order; `render.mjs` follows it. Today's fixed
  sequence becomes the default, and the first milestone must produce byte-identical books.
- **Pages become pure functions** (data + options → HTML) shared by print and editor, the way `daypage.mjs` already is.
  This is the biggest job: month calendar, sky, tracker, moon, week left/right, review, exchange, support, safety, bus,
  lineage all move out of `render.mjs`.
- **Protected pages** can be moved but not hidden: Safety plan, Support, Closing the month.
- **Automatic, never hand-set**: recto/verso alignment, even page count (≥ 24, hardcover ≥ 76), `{{P_x}}` cross-references,
  scan codes, the Keeper handoff page number.
- **Per-month versions**: `book.json` has a default plus optional overrides per month (`2027-02`).
- The Keeper is never given scan codes.

Canvas UI (editor):
- Spreads laid out as the book opens (left verso, right recto), live page thumbnails, pinch/scroll zoom from the whole
  book down to one page, drag to reorder, tap to edit, hide toggle, "add page" palette, undo, phone friendly.
- Tapping a day page opens the current day-page block editor; tapping a block-based page opens the same block editor
  for that page.

Milestones (each mergeable on its own):

| # | Milestone | Output |
|---|---|---|
| C1 | Pages as shared functions | Same books, byte-identical; editor can render any page |
| C2 | `book.json` + renderer follows it | Same books, byte-identical |
| C3 | Read-only canvas | Spreads, zoom, jump to page, page ids shown |
| C4 | Reorder, hide, add (with rules and validation) | Rules above enforced with clear messages |
| C4b | Page grid: predefined rows and columns; blocks span several of each (see 'Page grid' below). Block size options (height in lines or mm) land first in the Tier 2 planning PR | Every block keeps its own `data-zone`; `layout.json` maps it to its cell rectangle; overflow check runs per block |
| C5 | Block-based pages | Month, week, review, notes, back-matter pages editable as blocks |
| C6 | Per-month overrides + book-level "Start from a method" | Whole-book layouts |
| C7 | Save/load (commit `book.json` next to `daypage.json`), tests, docs | Editor works end to end |

### Page grid (C4b, added 2026-09-29)
Blocks sit on a predefined grid and can span several columns and rows. Rows and columns are fixed by the page, not free-drawn.
- **Grid per page type (fixed, not user-set):** every page type declares one fixed number of columns and rows per trim in a `GRIDS` table. Nobody picks the counts; blocks only choose where they sit and how far they span. Proposed starting points (the C4b agent measures and confirms): day page = 4 columns, and rows one tight line high (5.6 mm) so rulings and rows align, the count set by the usable height per trim (small and letter differ); month, week, review, notes and back-matter pages each get their own fixed grid. Both trims keep the same column count, so a layout carries across sizes; row counts differ because the page heights differ, and spans are stored in rows so they convert by height.
- **Placement:** each block gets `{col, row, colSpan, rowSpan}`. Today's layout is the default: one column, blocks stacked in order, Writing space taking the remaining rows. It must reproduce the current pages byte-identically.
- **Rules (validated with clear messages):** no overlaps; a block has a minimum span (its content must fit: lines, ruled rows, bubbles); locked blocks (DATE/TITLE/TAGS header, SEND TO strip, page code, 9pt frame) never move; spans stay inside the page and its safe margins.
- **Scan zones:** the zone for a block is its grid rectangle; `layout.json` records it (repeats get `_2`, `_3`); a spanning block has one zone.
- **Checks:** `check.mjs` runs per cell, so overflow inside a spanning block is caught; the editor overflow meter shows it live.
- **X4:** unaffected; exported check-in blocks export the same way wherever they sit.
- **Editor:** snap-to-grid drag and resize handles, span shown as a highlighted rectangle, keyboard moves (arrows, shift for span), undo, 44px targets on a phone.
- **Stacking on mobile:** the editor previews the grid at true size; on a phone it scrolls the page, not the block list.
- **Why grid, not free size:** predefined tracks keep scan zones, ruling and the overflow check predictable.

## 4. Paper and X4 as one system: the split ("both, clearly split")

Rule: every item lives in exactly one place, and both sides say where. Proposed split for approval:

| Item | Paper | X4 | Why |
|---|---|---|---|
| Meds (morning, evening, as-needed) | ✔ | — | Safety-critical; no battery needed |
| Mood (−3..+3) | ✔ dot with the numbers printed | — | One dot fits the paper tracker |
| Meals | ✔ | — | Quick to tick at hand |
| Water | ✔ | — | Same |
| Spoons left | — | ✔ | Counts as "left", matches the Keeper's good-spoon-day |
| Sleep hours | — | ✔ | A number for the month totals |
| Anxiety 0–3 | — | ✔ | Number for totals |
| Shower, teeth, joy, texted, snack | — | ✔ | Tick with one button |
| Custom check-ins (editor blocks) | prints the block | ✔ exports | Already built |
| Routines, shift times, events, writing | ✔ | shows only | Paper is the record |
| Safety plan | ✔ **source of truth** | copy + "last reviewed" + "if this differs, trust the book" | Your decision |
| Month totals for the Keeper | paper tracker (mood, meds, meals) | This month (spoons, sleep, anxiety, care ticks) | Closing page says which box comes from where |

What this fixes: spoons counting opposite ways (D4), care order differing (D5), mood scale without numbers (D6), logging
the same thing four times (S5), routines that look tickable on the X4 (S13), the paper tracker duplicating the X4 (MW12/13).
Paper gets about 26 mm back on the day page when the X4 items leave the care block. **This is the one product decision
still needed before building it.**

## 5. Blocks from the research (43 docs merged and de-duplicated)

Everything in the docs' section 25c is folded into the tiers below. "Preset" means no new code: a ready-made
configuration of an existing block that also exports to the X4 if it is checks / scale / habits / fields.

### Tier 0: platform (unblocks the rest)
| Item | Why |
|---|---|
| Zero-based scale (`zero` option) + X4 export 0..N−1 | DBT, CBT, sensory, pain 0–10, mood −3..+3 all need it (today a 0–10 pain scale reads 1–11) |
| `choice` check-in kind on the X4 (pick one of N) | Injection-site rotation, weather, skills, "what kind of day" |
| `count` with a maximum, `tally` | Focus rounds, pages, drinks |
| Manifest + page ids (section 2) | Identity |

### Tier 1: presets and options on existing blocks (low risk, high value)
Rituals (morning / start / shut down / evening), Today's 3, Supports (headphones, hood, dark room, alone time),
Masking scale, Overload dots, Pain 0–10, Mood signed, Felt like me, HRT & body care, Voice minutes, Cycle & dose,
Deposits done, Sharpen the saw, One Q2 thing, Inbox cleared, Weekly review dots, Shutdown, Deep blocks, Focus rounds
(count), Places, Something new, Made something, Good today, Device-free hour, Outside & light.
Options: Top priorities up to 6 + "guess / took" + carried column; Time blocks `actual`/plan columns, 0–24 range,
re-plan columns; Lined notes pitch + paper; Writing space bold lines, secret line, 3.7 mm grid; Small good things
"because"; Sensory load + temperature + movement; Habit dots "tiny" legend; Sketch box corners + caption;
Divider with sun/moon icon; checks/scale "scan-ready" (OMR) size.

### Tier 2: new day-page blocks, recommended first (most value for shift work, ND, low spoons)
| Block | From | Notes |
|---|---|---|
| Time line 24 h (plan / actual, night shading from sunrise–sunset) | Jibun, time logging, time-block | Built for shift work |
| Brain dump · Later · Done list · Wall of Awful | ADHD | Low-shame; none exported |
| Time stamps ("between tasks") | Interstitial | Also a "resume with" line |
| Focus rounds (boxes, interruption marks) | Pomodoro | Named "Focus rounds" (Pomodoro® is a trademark); count exports |
| Feelings 0–5, Skills 0–7, Urge + acted | DBT | Opt-in "therapy" pack, with 988 and Trans Lifeline, "use with a therapist" |
| Thought record (3/5/7 column) | CBT | Same pack |
| Injection site rotation | HRT | Needs the `choice` kind |
| Energy accounts / Energy types | Spoons, autistic energy accounting | Ties to the care split |
| Body signals · Overload · Special interest | Sensory | Paper only except Overload dots |
| Keep (words to keep + source + moved) | Commonplace | Feeds the commonplace pages |
| Week at a glance strip | Dutch door | No cutting: a strip on every day |
| A month ago today | Digital notes | Paper only; X4 later |
| Rotating prompt (weekly exchange prompt, tagged and passable) | Prompts | Deterministic, same on reprint |
| Day pixel / Low and high | Year in Pixels | Feeds the Keeper's pixel page |

### Tier 3: new day-page blocks, later
Matrix (Eisenhower), Next-by-context + Waiting for (GTD), Carried over, Need/Should/Want, Months ahead strip (BuJo),
Project board, Dot columns (Alastair), Rest plan, Wins, Not-to-do, Theme line, Where I am, Two gratitudes, Focus line,
Habit plan, Write-it-out (expressive), Dialogue/Stepping stones/Daily log (Progoff, with a
privacy note), Prepare/Mine-not-mine/Let it go (Stoic), Cornell notes, Pen test, Print-clearly boxes, Clip box
(scan crop), Icons to circle, Sticker spots, Pattern to colour, Glue strip, Paste-a-scrap, Today's journey, Daily line,
Mini calendar, Time axis, One line, Last year today, Question of the day, Body map, As-needed doses.

### Tier 4: whole pages (need the canvas)
Future log (next 6 months), Collections + index (BuJo), Commonplace pages + A–Z index, Year in Pixels (Keeper), Habit
plan, weekly review variants, Pen test (proof sheet already exists), Notes pages numbered.

### Method layouts (one click, on top of today's five)
ADHD day, Dutch door day, Stoic day, Progoff day, Time log day, Euphoria & HRT, Sensory & energy, Focus rounds,
Between tasks, Cornell day, Large-print day, Scan-first day. Each is a list of blocks already in the tiers above.

## 6. X4 firmware

| Feature | Notes |
|---|---|
| **Focus timer (Pomodoro-style)** | Menu → Focus. Default 25/5 (long break after 4); presets 15/5, 45/10; adjustable; the research says 20–35 is the real range. Silent and visual: draws "Focus until 2:35p · round 2 of 4" once, deep-sleeps with a timer wake, then draws "Break until 2:40p". No sound, no per-minute refresh. One button marks an interruption; finished rounds log to the CSV and appear in This month as a count (no streaks). Pairs with the paper Focus rounds block and the `count` bridge. |
| Zero-based scales and `choice` items | Tier 0 |
| Care split (section 4) | Built-ins re-labelled; "left" wording; care order matches paper |
| "This date last month" on the sleep screen | Opt-in, from her own logs |
| Stale-day marker, low-battery page drawn once, page the check-in list, large text | From the e-ink research |
| Theme word from the Wi-Fi page on the sleep screen | Theme System |
| Safety plan pointer and "last reviewed" | Paper is the source of truth |

Never: notifications, alarms, feeds, streaks, badges, AI, cloud.

## 7. Open fixes still to do (small)
MW6 events/notes running together in week rows; month/week busy-day overflow; refresh the sample X4 card and its facts;
add the log-backup line to the Keeper's checklist; confirm crisis numbers on official sites (Frontier, Trans-Wa,
Unify, Trevor, NAMI, Spectrum, Planned Parenthood, eating-disorders line, NAMI text, Ingersoll, Point of Pride);
confirm meteor dates with the International Meteor Organization; refresh the STA feed and the `gtfs` workflow;
run with the real calendar secrets; order one private KDP proof per size with the proof test sheet.

## 8. Suggested order

| Phase | Work | Runs in parallel |
|---|---|---|
| A | Page identity (section 2) · X4 bridge v2 (Tier 0) · Tier 1 presets/options · small fixes (section 7) · care split (section 4) | yes, 4–5 agents |
| B | Canvas C1 → C2 (sequential, byte-identical) | 1–2 agents |
| C | Canvas C3 → C7 · Tier 2 blocks · Focus timer | yes, 6–8 agents |
| D | Tier 3 blocks · Tier 4 pages · more method layouts | as slots allow |
| E | Docs: index of the 43 docs with a ranked backlog and the doc template (unit 14) | 1 agent |
| F | Make it reusable by others: profile + content packs (section 9), starts after canvas C2 merges | 2–3 agents |
| G | Versioning and collaboration for Journalwright Studio: projects, commits, branches, forks, proposals, merges, releases, reusable pages (section 10); vertical slice first | G1 core, then G2 (forks, proposals, merges), G3 (releases, components) |
| H | Other book scopes: quarter, season, half-year, year, custom range, undated planner; auto-split into volumes past the paperback page limit (section 11); after the page grid and G1 land | 1–2 agents |
| C4a | Editor navigation: the Book view is the default; zooming in goes book → spread → day; day view is the day-page editor (section 12) | 1 agent |
| S1 | Spread days: a day can cover one page or a whole two-page spread (section 12); after H1 merges | 1 agent |
| SC | Scan options: Send-to as a block, scanning border toggle, configurable matrix code, per-book code ids (section 13); after H1 merges | 1 agent |
| X | X4-hosted editor: edit right from the device's hotspot, no internet; cloud sync goes through the phone (section 14); after C4a and G1 | 1–2 agents |
| A11Y | Accessibility options: editor, printed books, X4, site (section 15); audit first, then units; every new unit follows the checklist | 2–3 agents |

Every unit follows the same proof as the fixes: reproduce, fix, rebuild all 12 months at both sizes with the checks
(overflow, spreads, scan codes, fonts), look at the pages, editor and X4 previews, Firmware CI green, PR.

## 9. Phase F: reusable by other people (approved 2026-09-29)

Today the repo mixes the engine with Shelbee's personal content. Split it in three layers.

**Personal content found:** `spokane.mjs`, `gtfs/` (STA buses), `research/spokane-seasons-history.json`, `content/support.json`,
`clinic.json`, `trans.json` (Spokane / Washington resources), `me.txt`, the "Keeping Watch" title and cover branding, and the
X4 sample card in `x4/host/sample/kw/`.

| Layer | Holds | Notes |
|---|---|---|
| Engine | Renderer, block library, canvas editor, checks, firmware | Nothing personal |
| Profile | `profile.json`: name, book title, edition, location (lat/long, timezone, place name for sunrise/sunset and sky pages), day-start hour, trim, which modules are on (bus, moon and sky, trans support, therapy pack, spoons) | One file per person |
| Content packs | Regional support and resource lists, optional transit feeds, as data | `generic` pack ships; Shelbee's becomes `spokane-wa` |

Units:
1. **Profile extraction (done):** move location, names, branding, day start and module switches out of code into `profile.json`; every
   module reads it; Shelbee's profile reproduces today's books byte-identically.
2. **Content packs:** support, clinic, trans and transit as packs with a manifest (region, who verified it, date verified); a
   `generic` pack with placeholders; the build refuses to print a pack with no verification note on crisis pages.
3. **Onboarding and docs:** `npm run init` (asks a few questions, writes the profile), a generic sample book built in one
   command, "Make your own journal" and "Write a content pack" guides, starters from the method layouts.

Rules: crisis and support numbers are never auto-filled for someone else; the firmware stays as is, only its config, sample
card and check-in labels come from the profile; the personal pack stays out of the generic build.

## 10. Journalwright Studio and Phase G: versioning and collaboration (added 2026-09-29)

**Name.** The product is **Journalwright Studio** (Shelbee's pick). "Keeping Watch" stays as Shelbee's own book title (her profile). Check trademark and domain before public launch; the site and README rewrite (below) use the new name.

**Roadmap adds**
- README cleanup and product website (one-page GitHub Pages site with a live editor demo on sample data only).
- Research doc: shadow growth journal (`docs/journaling/methods/shadow-growth-journal.md`, same template and source rules; add to the index).
- Phase G below.

**Phase G: Git-like versioning for journal projects.** The product stays focused on designing and publishing physical journals and planners. The visual editor is the way people see history; nobody needs Git or GitHub.

Foundation: the structured day-page blocks, stable page and block ids, `content/book.json`, `content/daypage.json`, the print renderer, manifests and today's build workflows. Single-user builds keep working; existing files import into a project and export back into the current pipeline.

| Workflow | Requirement |
|---|---|
| Projects and commits | A project holds book structure, reusable pages, block layouts, assets, metadata and print settings. Every commit is an immutable snapshot: author, message, timestamp, parent, content hash. Visual history, comparisons, restore-to-new-commit |
| Branches | Create, edit in the editor, switch. Autosaved drafts are distinct from named commits |
| Forks | Only where the creator enabled reuse. Records source project and commit, keeps attribution, has independent history. Private pages, filled-in personal data, account settings and secrets stay outside the forkable publication source |
| Change proposals | Fork owner proposes upstream; page-level and block-level visual diffs, discussion, review status, accept selected changes |
| Merges | Three-way merge on the common ancestor using stable page and block ids. Independent edits merge automatically; same-item edits are conflicts resolved in the visual editor (either side or manual). Reorders, deletions and component changes handled explicitly |
| Releases | A publisher freezes a validated commit as a numbered print release: exact interior PDF, cover PDF, manifest, print settings, source commit. Later edits and merges never touch released files |
| Reusable pages | Component versions and where they are used; owner reviews and adopts an upstream update into a branch, seeing the effect across the book before committing |

Platform: persistent backend with schema and migrations, authentication, project permissions, APIs, transactional updates and concurrency checks (no silent overwrite), server-side access checks for private projects, forks, proposals, assets and releases. Stack fits the current Node code (Node, SQLite for local setup, content-addressed snapshot store). Never a default to Cloudflare for hosting.

Slices: **G1** data model, migrations, auth and permissions, commits, branches and drafts, history, restore, import and export against the current pipeline, editor history UI. **G2** forks, proposals, three-way merge and conflict UI. **G3** releases, reusable pages, full editor-to-print workflow, docs. Tests: commit ancestry, independent merges, conflicts, fork permissions, component updates, release immutability, editor-to-print.

## 11. Phase H: other book scopes and automatic volumes (added 2026-09-29)

Today one book is one calendar month, and the Keeper holds twelve of them. Phase H makes the book's span a setting.

**Book plan (in `content/profile.json`, editable in the studio):**
- `scope`: `month` (today's default), `quarter`, `season`, `half-year`, `year`, `custom` (start and end date), or `undated` (blank days and weeks, no dates).
- Month pages (calendar, sky, tracker, moon) repeat for each month in the span; week pages run continuously; the Closing page is per month or once at the end (option).
- The Keeper is one of: the twelve-book Keeper (today), a per-book Keeper, or none.

**Volumes (Shelbee's rule): if a book goes past the paperback limit of 110 pages, split it into volumes.**
- The build measures the page count for the chosen trim and binding. Paperback is 24 to 110 pages; hardcover needs 76 or more. Over the limit, it splits the span into the fewest balanced volumes that each fit, cutting on month boundaries where it can and on a week boundary otherwise.
- Volume ids are stable (`v1`, `v2`, ...). Each volume is its own book: its own cover (title plus "Volume N of M" and its date range), its own scan-code space (the edition code gains a volume part), its own manifest, and its own interior PDF. The build reports the split and why.
- Volume boundaries are continuous: no day is dropped or repeated, week numbering and cross-references carry across, and the last page of a volume can point to the first page of the next.
- Hardcover keeps the 76 to 110 rule per volume as well. A book that fits stays a single book.
- The volume plan is deterministic, so a reprint gives the same split, and it is shown in the studio before printing.

**Rules that stay:** the default monthly books stay byte-identical (`check-identical.mjs` 24/24); every page passes `check.mjs`; scan codes stay unique and decodable across volumes; no Type 3 fonts; the Keeper never gets scan codes.

**Slices:** H1 span and volumes in the data and render layers (book plan, per-span month/week pages, page counting, volume split, cover and codes, manifest); H2 the Keeper options, studio UI for the plan and the volume preview, checks, docs.

### Undated books (Theme System style; added 2026-09-29)
The user writes the dates. It works as a general journal, and it is the kind ADHD writers prefer, because a missed week leaves no dated blank pages (see methods/adhd-journaling.md and theme-system-journal.md).
- **Set-up:** `scope: undated` plus a page count (for example 90 day pages, a season's worth), how many week and month pages, and which extras (theme pages, trackers, notes).
- **No printed dates anywhere.** The DATE box in the fixed DATE/TITLE/TAGS header is left blank to write in (it is already a handwritten box, so the scan frame is unchanged). Week pages print "Week of ____" with weekday letters to write the dates under. Month pages are a blank month grid with a month name line and numbered cells (1 to 31) you align yourself.
- **Date-driven blocks switch off or become fill-ins:** sky, moon, sun times, holidays and events, the on-this-day fact, bus, "a month ago today" and the date-picked rotating prompt (it rotates by page number instead), pay marks. Sun times can become blanks ("Rise ____ Set ____"). Blocks that need no date (checks, habits, scales, writing, lines, priorities, time blocks, care, spoons) all work as they do today.
- **Themes:** the season theme page, theme check-in and a "Yearly theme" opener page come with the Theme System layout; the Daily Actions tracker (15 columns of full or half circles) is a Tier 4 page for this scope.
- **Identity and scan codes:** codes and page ids go by page order, never by date (`day.017`, `KW2|<edition>|<book>|<S/L/H><page>`). Every page still has a unique code and a unique printed label, for example "Day 17". The manifest records order instead of dates.
- **Volumes:** the 110-page split applies unchanged (an undated book is just numbered pages).
- **Privacy and profile:** no location or calendar is needed, so an undated book has the smallest private footprint and is the easiest one to share as a template.
- **X4:** the X4 logs by the real date you open it, so it works alongside an undated book. It cannot point to a printed page from the date, so the "book p. N" pointer and page-based prompts are off for undated books; check-ins, Focus and the theme word still work.

## 12. Editor navigation, spread days, site and accounts (decisions, 2026-09-29)

**Editor navigation (C4a).** The Book view is what opens first. It is one continuous zoom, not tabs: whole book (all spreads) → spread (two facing pages, editable in place) → day (one page or one spread's day, in the block editor). Pinch, wheel, buttons and keys move between levels; tapping a page zooms to it; a breadcrumb (Book › Spread 12 › Day Oct 14) and Back always work; the URL hash records the level (`#book`, `#spread/12`, `#day/2026-10-14`) so links and undo behave. The current Day tab goes away as a top-level tab; the day-page editor is the day level. Phone friendly, 44px targets.

**Spread days (S1).** A day may cover a single page (today) or a whole two-page spread. Set per day in `book.json` (`format: page | spread`), with per-weekday defaults (for example weekends as spreads) and per-month overrides.
- A spread day is two consecutive pages that keep their own scan frames, page codes, ids and headers, so every page stays unique and scannable. The date, title and tags header is on the left page; the right page carries the same date with a "continued" label in its printed identity.
- The blocks sit on a two-page grid (2 × 4 columns × 24 rows) with the fold between the pages; in the first version no block crosses the fold, which keeps text out of the gutter and rulings clean.
- Verso/recto alignment stays automatic (a spread day always starts on a verso page); page counts, volumes and the 110-page limit include the extra pages; X4 is unaffected.
- The editor's day level shows the page or the spread at true size.

**Website.** The GitHub Pages site is the product website at the root; the editor demo lives at `/editor/` and docs under `/docs/`. Nothing else deploys to the root.

**Accounts and guest mode (Phase G).** Accounts are for versioning and sharing; everything that only touches the user's own device works without one.
| Without an account (guest) | With an account |
|---|---|
| Open the site, editor demo and sample book; use the block, day and book editors; autosave to this browser; export the project to a file and import it back; build and download print PDFs and the X4 pack from their own data (local build); read public projects and their history; fork to their own browser copy | Save projects to the server; commits, branches, history and restore; forks with attribution; change proposals and reviews; merges; releases; reusable-page updates; private projects and sharing with named people; server-side autosave across devices |
Rules: guests never need an account to design or print; signing in never uploads anything unless the user saves or publishes; private data stays out of forkable publication source; a guest's local project can be imported into an account project in one step.

## 13. Scan options (decisions, 2026-09-29)

This relaxes the old rule that the header, frame, SEND TO strip and page code are fixed. The default book still prints exactly as today (fingerprints stay identical); everything below is opt-in or per-layout.

- **Send-to is a block.** A `sendto` block on the day page (and available on other pages when the page becomes block-based): the symbol strip (fire, water, air, earth, moon, pentacle) with its bubbles, its own `data-zone` `send_to`, options for which symbols, size and paper. It sits in the grid like any block. The default layout keeps it in today's spot.
- **Scanning border toggle.** Per page (and a layout default): frame and corner marks on or off. When off, the code still identifies the page (Shelbee: "code only"), but the frame that lets the scanner straighten and crop is gone, so send-to bubbles and writing-area crops do not work on that page. The editor states what stops working each time it is switched off.
- **Matrix code options.** Position (corner or edge, keeping the quiet zone and a safe minimum size), size, on or off per page (pages that carry it stay unique), format (Data Matrix or QR), content (page id only, or id plus edition and book), and an optional tiny printed label. It never holds private data. The build checks every code still decodes at the chosen size and position.
- **Unique codes across many books.** Uniqueness is scoped by a **book id**, not only by month:
  - `content/profile.json` gets `book.id` (8 base32 characters, 40 bits, generated once at random if missing and written back; an account or project allocates it on the server; guests generate it locally).
  - Existing month books keep the `KW2|edition|yymm|size|page` code byte-identically. New scopes (undated, quarter, year, custom) and every volume use `KW3` = book id + volume + page, in page order and never date-based, so several undated journals by one person never collide.
  - `check-codes.mjs` reads every manifest present, fails on a repeated code or a repeated book id, and decodes samples; the manifest records book id, volume and page. A registry of a person's book ids lives in the project and is checked when a book is created.
  - The 16 by 16 Data Matrix holds 16 alphanumeric characters; a longer configured content moves to the next symbol size and the build says so.
- **Rules that stay:** the Keeper never gets scan codes; private content never goes into a code; every page keeps its printed label; no Type 3 fonts; every page passes `check.mjs`.

## 14. X4-hosted editor (feasibility and plan, 2026-09-29)

**Feasible.** The X4 already runs a hotspot and serves a small page at 192.168.4.1 with upload, download and save calls (`x4/src/net/webpage.h`, Wi-Fi sync). The editor does not need the device to compute anything: the phone's browser runs the editor and renders the pages; the X4 only serves static files from the SD card and stores what the editor saves.

- **Lite editor (first):** day-page blocks and options, the Book/Spread/Day view with thumbnails from a small pre-rendered sample, the "also on X4" check-in blocks. Saving regenerates `/kw/checkins.txt` in the browser (a JS port of `export_pack.py`) and uploads it, so a change to check-ins takes effect on the device at once. It also saves `daypage.json` and `book.json` to `/kw/project/` on the SD card.
- **Full editor (second):** the same editor bundle as the site, pre-compressed (`.gz`), with every script and font inlined or vendored (no CDN, the phone has no internet on the hotspot). Roughly 60 to 80 KB compressed for the app and about 60 KB for the sample pages, streamed from the SD card in small chunks, which the ESP32-C3 handles.
- **Firmware limits to respect:** no PSRAM, so stream files instead of holding them in RAM; static buffers only; one client at a time; nothing large on the 16 KB loop stack; the editor bundle lives on the SD card (placed by the export pack), not in flash.
- **Rule kept: nothing leaves the device except over its own hotspot.** The X4 never calls the cloud. A phone joined to the hotspot has no internet, and an https site cannot fetch from an http device (mixed content), so **the phone is the courier**: edit on the hotspot, then "Export project" downloads a project file; on normal Wi-Fi open the Journalwright Studio site (guest or signed in) and "Import project" (or "Save to my account"). The reverse works too: "Send to X4" downloads the project file, then the device page uploads it over the hotspot. Both are one tap and an explicit user action.
- **What edits change where:** check-in blocks change the X4 immediately; page layout changes affect the printed book only after the next build; the editor says which is which.
- **Firmware scope stays:** no notifications, feeds, badges or AI.
- **Slices:** X1 device side (serve static files from `/kw/editor/`, save endpoints with size and path limits, host tests, RAM numbers from CI) plus the export-pack step that places the lite bundle; X2 lite editor build (offline, vendored), JS check-in export with a parity test against `export_pack.py`, import and export project files; X3 full editor and the Studio import and send-to-X4 flow.

## 15. Accessibility options (2026-09-29)

Accessibility is a requirement on every unit, plus a set of user-facing options. Start with an audit, then units.

**Editor and site (WCAG 2.2 AA as the floor)**
- Fully keyboard operable, visible focus, logical order, no traps; the Book to Spread to Day zoom and the grid have keyboard equivalents for drag and pinch.
- Screen readers: roles and labels on every control, a live region that announces level changes, block moves, overflow warnings and validation errors; icons always have text names.
- Display options in a Settings panel, saved in the browser: text size (100 to 200 percent, layout reflows at 400 percent), high contrast, dark and light, reduced motion (also follows the system setting), a dyslexia-friendly font choice (Atkinson Hyperlegible or Lexend, both open licence), increased spacing, larger targets (44 px default, 56 px option), plain-language errors, no time limits.
- Colour never carries meaning alone; contrast at least 4.5 to 1 (3 to 1 for large text and UI parts); no flashing; `lang` set; alt text on images; the site and demo follow the same rules.

**Printed books (options in the profile and the editor, per book)**
- **Text size:** small, medium, large, extra large; the overflow check enforces fit at each size.
- **Large-print layout:** bigger type (14 pt and up), wider rulings (8.5 mm), fewer blocks per page (uses the existing Large-print day method layout).
- **High contrast ink:** heavier rules and dot grids (still at least 0.75 pt for KDP), darker text, no light gray for content.
- **Dyslexia-friendly type:** an embedded font choice (no Type 3 fonts), looser line and letter spacing.
- **Handedness:** left-handed layout mirrors the send-to strip, tabs and page-code corner; scan zones follow.
- **Low clutter:** a reduced icon set and quieter ornament, for sensory needs.
- **Easy start:** a "one thing per page" mode and undated pages (see Phase H) for people who need forgiving pages.

**X4:** large-text mode, high-contrast (bolder) fonts, button remap for one-handed and left-handed use, adjustable refresh and sleep timing, no timeouts that punish slowness, everything already visual and silent (no reliance on sound).

**Digital outputs:** the X4 EPUBs and the docs get accessibility metadata and a real heading structure.

**Checklist for every unit:** keyboard path, screen reader label, contrast, reflow at 400 percent, reduced motion, phone at 390 px, and a test for each.
