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
| C4 | Reorder, hide, add (with rules and validation). **Done** (page organiser, Book view edit mode; per-month overrides and `book.json` save included, so C6 and C7 keep only the method layouts and block-based pages) | Rules above enforced with clear messages |
| C4b | Page grid: predefined rows and columns; blocks span several of each (see 'Page grid' below). Block size options (height in lines or mm) land first in the Tier 2 planning PR | Every block keeps its own `data-zone`; `layout.json` maps it to its cell rectangle; overflow check runs per block |
| C5a | Block-based pages, first part. **Done:** Notes, blank and Collection pages are editable as blocks (own fixed grids, `layout` in `book.json`, edit hash routes `#page/<id>/edit`) | Same block library and grid as the day page; scan zones untouched; default books byte-identical |
| C5b | Block-based pages, the rest | Month, week, review, back-matter pages editable as blocks; `sendto` on block pages |
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
| S1 | Spread days: a day can cover one page or a whole two-page spread (section 12); after H1 merges. **Built** (see 'S1 as built' in section 12) | 1 agent |
| SC | Scan options: Send-to as a block, scanning border toggle, configurable matrix code, per-book code ids (section 13); after H1 merges | 1 agent |
| X | X4-hosted editor: edit right from the device's hotspot, no internet; cloud sync goes through the phone (section 14); after C4a and G1 | 1–2 agents |
| E1 | View versus edit: the editor UI (palette, options, panels) shows only while editing a page, not while viewing it (section 16); small, can go now | 1 agent |
| L1 | Library and series: custom titles for every book, several books per project, series, Library → Series → Book → Spread → Page navigation (section 16); after H1 merges | 1–2 agents |
| P1 | Account profile with saved locations that feed new books (section 17); pairs with Phase F units 2 and 3 | 1 agent |
| PACKS | Pack ecosystem: many pack types, artist packs (themes, graphics, icons, fonts), block packs, registry and pack manager (section 20); builds on the F2 content-pack unit | 5–6 agents in slices |
| GUIDE | Step-by-step guide section on the site with many screenshots and cropped, annotated button shots (section 21) | 1–2 agents |
| DOCS | Public research docs on the site, de-personalised, with search and filters, and a crowdsourcing flow (contribution guide, issue forms, doc lint, credits) (section 21) | 2–3 agents |
| I18N | Languages: translated UI and printed books, RTL and other scripts, X4 language packs (section 18); string extraction first | 3–4 agents |
| A11Y | Accessibility options: editor, printed books, X4, site (section 15); audit first, then units; every new unit follows the checklist | 2–3 agents |
| X4NET | X4 joins Wi-Fi, serves the editor on any network, and syncs with the Studio when the user starts it (section 19); supersedes the phone-as-courier route in section 14 as the primary path | 2–3 agents |

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
2. **Content packs (done, PK0 and PK1 of section 20):** support, clinic, trans and transit as packs with a manifest (region, who verified it, date verified); a
   `generic` pack with placeholders; the build refuses to print a pack with no verification note on crisis pages.
3. **Onboarding and docs (done):** `npm run init` (`journal/init.mjs`), `journal/GUIDE.md` and `journal/PACKS.md`; `npm run init` (asks a few questions, writes the profile), a generic sample book built in one
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

**S1 as built (decisions made while building it, 2026-10-06).** The plan above is followed; where it was open, the smallest consistent choice was made:
- **Where "format" lives.** On the `days` entry of the weeks group in `book.json`, as that entry's `options`: `format` (`page` | `spread`, the default for every day), `weekdays` (`{"sat": "spread"}`, the per-weekday default) and `dates` (`{"2026-10-14": "spread"}`, one day). Most specific wins: date, then weekday, then format, then `page`. A month with its own page list (`months`, C4) has its own `days` entry, so the per-month override is that and nothing new. An entry with no options is today's book, byte for byte (`check-identical`). Rules and the helper `dayFormat()` are in `bookrules.mjs` (shared by the build, the organiser and the Studio); an undated book honours `format` only (its days have no date or weekday).
- **Formats.** A day is one page (today: the day layout) or a whole spread. "A full page of its own with a different layout" is built as the spread's two pages: each is a full page with a layout of its own (the left and the right differ). A one-page day with a second, different layout would need a layout choice per day, which the plan does not ask for, so it is not built (see Not done).
- **Layout (layout v2).** The spread layout is `spread` in `daypage.json`, one canvas of **8 columns x 24 rows**: the left page's 4 columns then the right page's 4, the fold between 4 and 5. `GRIDS` gets two entries: `spread` (8 x 24, `fold: 4`) and `half` (4 x 24, a day page's own grid). **No block crosses the fold** (the plan's first version): `gridProblems()` refuses it ("crosses the fold ... Keep it on one page"), free-spot search and the editor's keyboard and stepper moves never straddle it, and a block is wholly on the page its columns say. At print each page is an ordinary day-page grid made by `spreadHalf()` (columns 1 to 4 left, 5 to 8 moved to 1 to 4 right), so row heights, minimum spans, the overflow check per cell (`check.mjs`) and `layout.json` zones (one per block, `_2`, `_3` per page) are exactly the day page's. The Writing space block is required once on the spread. `sendto` is not offered on a spread: each page keeps the strip's own SEND TO. The starting spread (no `spread` key, nothing saved) is the default day page on the left and a ruled page on the right; a spread equal to it is not stored, so a day layout that never touched spreads is unchanged.
- **Scan zones, per page.** Each page of a spread keeps its own fixed parts: DATE / TITLE / TAGS header (the right page's DATE says "cont."), the 9 pt frame, the SEND TO strip and its own Data Matrix page code. Ids are `day.2026-10-17` (left) and `day.2026-10-17.cont` (right), labels `2026-10-17` and `2026-10-17 cont.`; both carry the date (`layout.json` also has `spread: "L" | "R"`). Codes stay generated from the final page order, so each page's code is unique (`check-codes`).
- **Alignment, counts, limits.** A spread day always opens on a left-hand page: the page spec asks for it (`align: 'verso'` per page, `book.mjs`), and a Notes padding page is added when the page before ended on the left (Saturday plus Sunday as spreads after five single days costs one Notes page a week). Page counts, hardcover padding, volume splits and the 110-page limit are of the real pages, so every spread day adds a page (a month of nothing but spreads is 114 pages, over the limit, and the organiser and the span box say so).
- **Organiser and editor.** `flowBook()` lays out spread days from the same catalog (`editor/samples.mjs` carries every day of the sample month as a page and as a spread); `setDayFormat()` changes a date, a weekday or all days (a setting that repeats the one below it is dropped; clearing everything gives back the original `book.json`). In the editor, a day's edit mode has a "This day covers" box (One page / A spread, "Every Saturday is a spread", "Every day is a spread", with the page count and the KDP note); a spread day opens on the two-page canvas (both pages at true size on a wide screen, one at a time with a Left page / Right page switch on a phone), with the grid overlay, a fold marker, drag/resize/arrow/stepper moves that stay on one page, undo, and saving in `daypage.json` (`spread`) with the book. The right-hand page opens the same day.
- **Studio.** `serializeDay` carries `spread` through the allowlist (validated with the fold rule); the diff names its blocks, the merge keeps it (a clash on the spread itself keeps ours, like the Grid switch), export writes it into `daypage.json`; the `days` options ride in the book part.
- **X4** is unaffected: check-ins still come from the day layout's blocks (a check-in block on a spread is not exported), and Today names the first page of a spread day.
- **Not done (ask first):** a one-page day with a different layout; blocks that cross the fold (the plan's later version); large print does not rearrange a spread's grid (a page that overflows steps its type down, never clipped; `dayp` pages share the step); a spread-day's own scan settings; sample thumbnails in the Book view use the starting spread; the Guide chapter and site screenshot for this feature.

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

## 16. Library, series, custom titles, and view versus edit (2026-09-29)

**Custom titles.** Every book has its own title, subtitle and cover text, set in the editor (not only in `profile.json`): `book.title`, `book.subtitle`, plus an optional short spine title. Titles flow to the cover, title page, running head where one exists, file names, the manifest and the studio. Volumes of one book print "Volume N of M" under the book's own title.

**Several books.** A project (a local project file, or a studio project) holds many books. Each book has its own scope (month, quarter, year, undated, custom), `book.id` (scan-code namespace, KW2 or KW3), layout, and page list; books can share reusable pages and layouts.

**Series.** A series is a named, ordered group of books (for example "2027 monthly books", "Undated season journals", "Theme System Yr 2") with shared defaults that each book can override: day layout, cover style, profile modules, book plan defaults. A book belongs to at most one series or none. Series order sets numbering ("Book 3 of 12 in the series") and the Keeper can span a series (twelve-book Keeper is one series option). This is separate from volumes: volumes are an automatic split of one book past 110 pages; series membership is chosen by the user. Every book in a series still gets its own book id, so codes stay unique.

**Navigation (extends C4a).** One continuous zoom: **Library** (all series and standalone books, as shelves of covers) → **Series** (its books) → **Book** (whole book, all spreads) → **Spread** → **Page or day**. Editing a series opens on the series (its books), not on a page. The breadcrumb reads `Library › Series › Book › Spread 12 › Day Oct 14`; the URL hash records the level (`#library`, `#series/<id>`, `#book/<id>`, ...); guests keep the library in the browser; signed-in users keep it in the studio. Standalone books skip the series level. Keyboard and screen-reader rules from section 15 apply at every level.

**View versus edit.** At every level the page is shown for viewing first. The editor UI (block palette, options, layout controls, Flow/Grid switch, undo) is visible only while editing a page: an explicit **Edit** action on a page or day enters edit mode and **Done** leaves it. Viewing is clean, uncluttered and read-only; edit mode shows the panels. Series and book settings (title, plan, defaults) have their own settings sheets, not a permanent sidebar. The mode is in the URL hash (`#day/2026-10-14/edit`) and announced to screen readers; reduced-motion and 44px rules hold.

**Studio.** A project's commits snapshot the whole library; forks copy the project (books and series); merges work per book and per series setting using stable ids; releases are per book. Book ids are allocated per book.

**Slices:** E1 view versus edit in the current editor (small); L1a data model (books and series in the project file and `profile`, custom titles through covers, manifests and the studio schema, migration from a single-book profile), L1b Library, Series and Book navigation in the editor plus series defaults and the Keeper option.

## 17. Account profile and location (2026-09-29)

A signed-in user has a profile with one or more **saved locations** (for example Home, Work, Travel). Guests get the same profile stored in the browser. A new book copies its location from the profile's default; a book can pick another saved location or a one-off place; changing the profile does not silently change books that already exist.

**Setting a location (privacy first, no third-party service by default)**
- Pick from a bundled offline gazetteer (cities of about 15,000 people and up, an open dataset with its licence and credit included), or type latitude, longitude and elevation, or press "Use my device location" (browser geolocation, only on tap, computed on the device).
- Fields: place name and short name to print, region and country, latitude, longitude, elevation, IANA timezone (looked up offline from the coordinates and editable), first day of week, units, date format, and the region for content packs.
- Nothing is sent to a server unless the user is signed in and chooses to save the profile; the browser never calls a geocoding service unless the user turns that on, and says so.

**What the location drives when a book is built**
- Sunrise and sunset, day length, moonrise and moonset, twilight, and the night shading on the 24 h time line.
- Timezone, daylight saving changes and where a day starts (the X4 day-start hour stays a separate setting).
- The place name on the title page, cover and sky pages; seasons and their dates for the hemisphere (southern hemisphere flips them); which astronomy events are visible.
- Holidays and observances for the country or region (a data pack, off by default, chosen by the user).
- Optional modules that need a place: transit feeds (a content pack per agency), and the region's support and resources pack. **Crisis and support numbers are never filled in automatically for a region without a pack that names who verified it and when**; without one, the book says how to add local numbers and shows only 988-style national lines that a pack verified.
- Weather is not part of this. No live data leaves the device or the build.

**Where it lives and what is shared**
- The location is personal data. It is never part of the forkable publication source: a shared or forked project keeps only a reference (`location: profile default`), and whoever builds the book supplies their own. The studio's forbidden-content scanner rejects coordinates in a snapshot.
- Printed books naturally show sun times for a place, so the profile explains that before printing a shared or sold book, and offers "approximate place" (rounded to a city or grid cell) for books meant to be shared.
- A profile export and delete-my-data option ships with accounts.

**Slices:** P1a profile schema and gazetteer with the offline timezone lookup, the account and guest profile UI, and the book-creation flow; P1b feed every location-driven calculation from the book's location (verify with a second city and a southern-hemisphere city: sun times, seasons, meteor visibility, timezone), with tests, plus the snapshot scanner rule. Shelbee's Spokane profile must reproduce today's books byte-identically.

## 18. Languages: translated UI and printed books (2026-09-29)

Goal: other people can create journals in their own language, and the printed book (and later the X4) speaks it too. English stays the source language and must stay byte-identical.

**What has to change**
- **Editor and site UI:** message catalogs (one JSON file per language, ICU-style plurals and variables), a language switcher (browser default, saved in the profile), `lang` and `dir` on the page, and the browser's `Intl` for dates, numbers and month and weekday names. Icons over words already cuts the amount of text.
- **Printed pages:** every printed string in `pages.mjs`, `daypage.mjs`, `render.mjs` and the handoff, key, care and Keeper pages moves into the same catalogs (keys such as `page.key.title`), including block labels, option names printed on pages, the rotating prompts, the "facts", and the moon, sky and season wording. The book's language comes from the profile (`book.language`, default `en`), separate from the editor's UI language, so a Spanish speaker can design in Spanish and someone else can print a French book.
- **Calendar and locale:** month and weekday names, first day of the week (Monday, Sunday or Saturday), date order and numerals through `Intl`, still Gregorian first; a secondary calendar line (Hijri, Hebrew, Buddhist, Japanese era) is a later option. Sun, moon and season data come from the book's location, and holidays from a per-region pack.
- **Fonts and scripts:** an OFL font set (Noto families) chosen per script, embedded and subset in the PDF as real fonts, never Type 3 (the existing `pdffonts` gate stays; colour emoji stay converted to SVG). Latin extended, Greek and Cyrillic first; then Arabic and Hebrew (right to left, with shaping through Chromium's HarfBuzz), Devanagari and Thai; CJK last because of font size, with vertical text left out at first.
- **Right to left:** the page layout mirrors (binding side, tab and spine side, the send-to strip, the page-code corner, week start), scan zones follow the mirror, and the check runs on mirrored pages. Numerals and mixed text use proper bidi isolation.
- **Text length:** German and Finnish run 30 percent longer than English. The overflow gate (`check.mjs`) runs per language; labels can abbreviate through a second short-form key; blocks that overflow in a language show up in the editor's overflow meter for that language.
- **Scan codes, ids and manifests:** ASCII only. Codes and page ids are unchanged; only the printed labels are translated, and each language keeps every printed label unique.
- **Support and safety content:** stays region packs written in the pack's own language. No translation of a crisis number or its text without a verified pack.
- **X4:** language packs on the SD card (`/kw/lang/xx.txt`) written by the export pack; fonts for the language on the SD card; the firmware reads strings from the pack and falls back to English. Later slice.

**Translation process (no generative AI in the product)**
- Catalogs live in the repo (`i18n/<lang>.json`), with a plain contribution guide, a translation status table (percent complete per language), and a review step by a native speaker before a language is marked ready. Untranslated keys fall back to English, and a build for a language that is not marked ready warns before printing.
- **Checks:** a lint that fails on new hard-coded printed strings, a **pseudo-locale** (accented and lengthened English) and a **mirrored pseudo-locale** that exercise overflow and RTL in CI, and a fingerprint test that the English default books are byte-identical.

**Slices**
- **I1 (first, no visible change; the editor half is built, 2026-10-06, see "I1 as built" below):** move every printed and UI string into `en` catalogs, the string lookup, `book.language`, `Intl` date and weekday handling, pseudo-locales, the lint. English books byte-identical (24/24).
**I1 as built (2026-10-06): the editor's words, the lookup, the pseudo-locales, the lint.** I1 was cut in two so each half could be checked by itself: this half moves the *editor's* UI words into a catalog; the printed words are listed, not moved. English is untouched: the English editor is the same page, byte for byte in what it shows (a DOM snapshot of 110 editor states, taken before and after, differs only by random ids) and the default books did not change (no print file was edited; `check-identical` still 24/24).
- **Catalog.** `journal/i18n/en.json`: one flat file, about 1,440 messages, keys named for where a string sits (`org.moved_to`, `block.checks.title.label`), never for its text, so rewording English keeps the key. Messages are plain text or HTML with `{name}` variables and `{n, plural, one {# page} other {# pages}}` plurals (`=0` for an exact count). No gender or select yet; add them when a pilot language needs them.
- **Lookup.** `journal/i18n/i18n.mjs` (`createT`, `format`, `parse`, `placeholders`, `pseudo`): dependency-free, inlined into the editor by `editor/build.mjs` and imported by the tests. An untranslated key falls back to English; an unknown key shows as itself and is listed in `KWI18N.missing()`. In the page it is `_t('key', vars)`; `_tx('key', english)` is for words that come from a data table.
- **Static HTML** carries markers: `data-i18n="key"` (one key per text node, `-` to skip one), `data-i18n-html="key"` (a message with `<b>` or `<code>`), `data-i18n-attr="aria-label:key;title:key"`. English runs no code for them (the HTML already says it); any other language swaps them at load. `i18n/htmlscan.mjs` reads them, and the lint checks that every word on the page is marked and that en.json says what the HTML says.
- **Data tables.** Block names and hints, option labels and choices, care rows, page kinds, method layouts and scan choices live in `daypage.mjs`, `content/layouts.mjs` and `scan.mjs`, which the print build reads too. They are looked up, never changed (the printed page keeps its English): `i18n/tables.mjs` makes their keys, `node i18n/sync-tables.mjs` writes them into en.json, the test fails when they drift.
- **Pseudo-locales** (generated from en.json, never stored): `en-XA` (accented, a third longer, in brackets; padding is spaced so it wraps like words) and `ar-XB` (the same text forced right to left, `dir="rtl"`). Open the editor with `?lang=en-XA` or `?lang=ar-XB` (or `localStorage` `kw-lang`). English stays the only language without a switch: the language switcher and a first real language are I2.
- **Checks.** `journal/test-i18n.mjs` (Books and Editor CI): the helper, every locale has every key and the same placeholders, every `_t()` key exists and none is left unused, the table keys follow the tables, no hard-coded English in the editor scripts or HTML (best effort; the few exceptions are in `i18n/allow.json`), the built script parses, the print report is current. `editor/test.mjs` opens the editor in both pseudo-locales: no page errors, no missing key, `lang` and `dir` set, words in aria-labels, toasts and live regions, no sideways scroll at 390 px in the day, grid, book and library views. English accessibility checks run unchanged (`editor/test-a11y.mjs`).
- **Printed words, not moved.** `journal/i18n/print-strings.md` is generated (`node i18n/print-report.mjs`): about 2,000 printed strings in 20 files, grouped by file and by the function or table that holds them. It is the work list for I3; the test keeps it current.
- **Not in this half, still I1 work or later:** `book.language` in the profile and the printed strings in catalogs (I3, with fonts and RTL printing); `Intl` month, weekday and date text (the editor still formats dates in `en-US`); the English words that come from shared code the print build also runs (rule messages in `bookrules.mjs` and `bookedit.mjs`, `library.mjs` problems, `gridProblems()` and `scanNotes()`, page names from `pages.mjs`, `BKE.kdpNote`, weekday names): they show untranslated in the pseudo-locales and are the first things I2 moves; the product website (`site/`) and the guide; commit messages the editor writes ("Day page layout from the editor"); a first real language and its native-speaker review.
- **I2:** editor and site translated with the language switcher and the first pilot languages in Latin script (Spanish, French, German), with printed books in those languages passing every gate.
- **I3:** fonts and scripts, right-to-left printing and mirroring (Arabic and Hebrew pilot), then Devanagari, Thai, and CJK.
- **I4:** X4 language packs.

## 19. X4 on Wi-Fi: editor on any network and sync with the Studio (2026-09-29)

Shelbee's decision: in addition to its own hotspot, the X4 can join a Wi-Fi network, serve the editor there, and sync with her Journalwright Studio account. This changes the old rule ("nothing leaves the device except over its own hotspot"). New rule, written into `CLAUDE.md` and `x4/CLAUDE.md`: **nothing leaves the device except over its own hotspot, or an explicit sync the user starts on the device, over Wi-Fi the user configured, to their own Studio account.** Still no background sync, notifications, feeds, badges, analytics, other cloud or generative AI.

**Feasibility.** The FreeInk SDK already has what this needs (checked in `freeink-sdk/libs/network`): **SecureNet**, a TLS 1.3 client on wolfSSL (used because the mbedTLS bundled with the ESP-IDF package cannot complete some TLS 1.3 handshakes), and **SecureHttpClient** on top of it (GET, POST and PUT with custom headers, chunked and Content-Length bodies, streamed downloads, connection reuse so a whole sync pays for one handshake). It is opt-in in the SDK: the firmware must build with `-DFREEINK_NET_WOLFSSL=1` and add wolfSSL to `lib_deps` (the firmware does neither yet, and the pinned SDK commit must be checked to still carry it). A TLS session needs tens of KB of heap on a chip with no PSRAM and the firmware keeps static buffers, so N1 starts by measuring headroom (CI prints RAM and flash) and runs sync as a separate screen that owns the radio and RAM while it runs, then frees them. Certificates: pin the Studio's CA with `setCACert` (PEM on the SD card) so a wrong server cannot receive data; `setInsecure()` is never used.

**Modes**
- **Hotspot (today):** its own network, at 192.168.4.1, works with no internet. The lite and full editors are served here (section 14).
- **On your Wi-Fi (station):** Menu, Wi-Fi sync, Join a network: scan, choose, enter the password using the phone page on the hotspot (typing passwords on an e-ink button pad is painful); saved networks live on the SD card (`/kw/net.txt`, never uploaded). The device then serves the same editor at `http://<name>.local` (mDNS, name chosen by the user) and its LAN address, and shows the address and a QR code. Only devices on the same network can reach it; a local access PIN, shown on the device, is required for edits; HTTP on the local network is limited to local-only actions.
- **Sync (explicit):** a "Sync now" action on the device. It joins the chosen network, opens TLS to the Studio, does its work, disconnects and sleeps. It never runs on a timer, never wakes the radio by itself, and shows what it is about to send before it sends.

**Pairing and permissions**
- The device pairs with an account once: the device shows a short pairing code; the user enters it in the Studio (signed in) and confirms the device name; the server issues a **device token** scoped to that account and, optionally, to one project. The token is stored on the SD card and can be revoked from the Studio at any time; a lost SD card means revoke.
- Server side: device tokens are a separate credential type with the narrowest scope (read the project's X4 pack and check-in list; write log uploads and edits to the device's own draft), rate-limited, audited, and never able to read other projects or private profile data.

**What syncs, and which way (each category is a separate switch, shown on the device)**
- **Down (Studio to X4):** the X4 pack (checkins list, month packs, support text, theme word, language pack), and edits made in the editor. Default on.
- **Up (X4 to Studio):** edits made in the on-device editor (project draft), default on; **check-in log and Focus counts, default off** because they are health data. When on, they go only to the user's private storage, are never part of a project's forkable source or any snapshot, and can be deleted from the Studio. The Studio's scanner refuses log data in a snapshot.
- Conflicts: the device edits a draft; the Studio merges through the existing versioning (three-way merge with a conflict view in the editor). The device never silently overwrites a newer Studio version: it shows "Studio has newer changes" and lets the user choose.
- Time: sync can set the device clock (as the hotspot page does now) when the user allows it.

**Editor on the device**
- Lite and full editors (section 14) work the same on the hotspot and on Wi-Fi; on Wi-Fi the phone may also have internet, so a signed-in Studio tab and the device editor can both be open, and "Send to X4" and "Import from X4" go through the device token or the phone, whichever the user picks.
- Everything the editor saves to the device is small JSON on the SD card; check-in blocks rewrite `/kw/checkins.txt` at once.

**Slices**
- **N1 firmware networking:** station mode with the saved-network store, join flow via the hotspot page, mDNS name, local PIN, RAM and flash measurement in CI, host tests with a simulated network; the Wi-Fi screen shows mode and address.
- **N2 sync client (built 2026-10-05, upload only):** see `x4/README.md` "Sync with your Studio" and `studio/README.md` "X4 device sync". Done: pinned CA plus an added host name check, device token (hashed, revocable, one account, rate limited), explicit Send from a preview, log off by default, resumable offset uploads, private log storage, tests. Left: pairing by short code (the token is copied in `sync.txt` for now), the Studio screen for devices and revoke, down-sync, categories beyond the log. Original scope: TLS with a pinned key, pairing, device token, sync screen with a preview of what will be sent, categories, resumable small transfers, failure handling; server side in `studio/`: device tokens, endpoints, audit and revoke UI, private log storage, permission tests.
- **N3 editor on the device:** section 14 slices X1 to X3 on top of N1 and N2, with a conflict view for "Studio has newer changes".
- **Checks:** firmware CI green with RAM and flash numbers; no plain-text credentials on the SD card beyond the saved network (marked as such); an "off" test that proves nothing is sent unless Sync is pressed; the log-off default; privacy tests that a snapshot never contains log data.

## 20. Pack ecosystem (2026-09-30)

Shelbee's decision: support many pack types for any need, including packs made by independent artists: custom themes, graphics packs, icon packs, and **block packs**. F2 (content packs) is the first slice; its manifest and loader are built for extension.

**Pack types (a registry, not a fixed list; each kind is one entry in `journal/packs/kinds.mjs`)**
| Group | Kinds |
|---|---|
| Regional content (F2) | support and resources, clinic and care contacts, trans and LGBTQ+ support, transit feeds, holidays and observances, seasons and local history |
| Words and language | language packs (strings, calendar names, first weekday), prompt packs (rotating prompts with sources), fact packs ("on this day" and seasonal facts by region), safety-plan templates (structure and style, no numbers) |
| Method and layout | method layout packs (one-click layouts), page packs (whole pages such as collections, future log, year in pixels), tracker and habit sets, starter kits (a bundle of layouts, blocks, theme and prompts) |
| Look | themes (type scale, rule weights, tones, spacing, paper styles, cover styles, running heads), fonts (open licences, embedded, never Type 3), icon sets, graphics packs (dividers, borders, corner ornaments, stickers, sketch frames, spot art) |
| Blocks | block packs: new day-page and page blocks with options, print rendering, zones and optional X4 export |
| Calendar and sky | secondary-calendar packs (Hijri, Hebrew, Buddhist, Japanese era), moon and sky art |
| X4 | X4 sleep-screen art, check-in sets, language packs for the device |

**One manifest, every kind:** `pack.json` schema 1 with id, title, semver, `kind`, author, licence (SPDX plus attribution text and a `commercial-print-ok` flag), an engine version range, region and languages where relevant, verification records, and a sha256 for every file. Unknown kinds fail with a clear message. Each kind supplies its own data schema, validator, and rules for how the build consumes it, plus a **privacy class**: `public` (may be shared and forked) or `personal` (personal contacts and support numbers: never in a snapshot or a fork).

**Artist packs and print safety.** Print is unforgiving, so packs are checked before they can be used:
- **Graphics and icons:** SVG only, sanitised on install (no scripts, no external references, no embedded raster fonts; text converted to outlines); black and white or grayscale-safe; a minimum stroke weight of 0.75 pt so lines survive KDP; size and complexity limits; a preview sheet is generated and checked by the pack validator.
- **Themes and fonts:** only open-licence or explicitly licensed-for-print fonts, subset and embedded as real fonts (no Type 3; the `pdffonts` gate stays); tones limited to what prints cleanly in black and white; themes cannot move or restyle the fixed scan elements out of their safe rules (frame, code, quiet zone), and they cannot break the overflow check: `check.mjs` runs on a themed book.
- **Licences and credits:** every pack states its licence; the build refuses a pack with no licence or with `commercial-print-ok: false` for a book marked for sale; used packs are credited automatically on a Credits page (attribution text from the manifest), and the manifest of a book lists every pack and version it used.

**Block packs: declarative, not code.** Third-party code would be a security and print-safety risk, so blocks are described in data, not JavaScript: a block declares its name, group, icon, options (num, bool, choice, flags, text, list, like `TYPES`), and a **render description** built from a fixed set of safe primitives (text, ruled lines, dot and grid areas, boxes, bubbles and scales, checkboxes, columns, icons and graphics from installed packs, spacers, the day's date and sun times as inputs), plus its data-zone name, grid minimum span and whether it exports to the X4 (`checks`, `scale`, `habits`, `fields`, `count`, `choice`) with the existing bridge rules. The engine renders it through the same path as built-in blocks, so print, editor preview, zones, grid placement, overflow checks and X4 export all work unchanged. The pack validator renders every option variant at both trims and fails on overflow, on missing zones, on Type 3 fonts, or on blocks that do not fit their declared minimum span.

**Installing and using packs (editor and studio)**
- A Packs manager: browse installed packs by kind, enable per book or per series, see what each pack changes, preview themes and icon sets live, install from a file, a URL or a git repository, update and remove. Packs used by a project are pinned by hash in the project, so a fork or a reprint gets the same look.
- Sources: a bundled core set, the user's own folder, and later a public registry (an index file in a git repository, moderated). Trust levels: built in, verified community, unverified (shown with a warning and limited to the safe primitives above; nothing runs as code).
- Studio: packs are content-addressed assets; snapshots carry references and hashes, and `personal` packs never travel. Forks keep credits and attribution. Proposals and merges treat a pack change like any other change to the project.
- X4: X4 kinds are compiled into the export pack; the device never runs pack code.

**For artists:** a pack builder CLI (`packs-cli new <kind>`, `check`, `preview`, `pack`), a template folder per kind, a preview gallery that shows the pack in a sample book and on the X4 where it applies, plain-language documentation, and a licence chooser in the manifest. Payment and a marketplace are **not** planned yet; that is a separate decision (licences and credits are enforced now so paid distribution could be added later).

**Slices**
- **PK0 core (done):** the manifest and kind registry (`journal/packs/`), common checks, `packs-cli`, privacy classes, packs pinned by id + hash in a snapshot (public only), every pack and version in the book manifest. The Credits page is still to do (the data is in `manifest.json`).
- **PK1 regional content packs (F2) (done):** kinds `support`, `clinic`, `trans-support`, `transit`, `holidays`, `seasons-history` and the `region` bundle; the verification rule; `generic` and `spokane-wa` packs; `packs-cli`.
- **PK2 look packs:** themes, fonts, icon sets, graphics packs, with the SVG sanitiser and print-safety checks.
- **PK3 block packs:** the declarative block format and renderer, validator, X4 export mapping.
- **PK4 words and method packs:** language, prompt, fact, safety-plan template, method layout, page packs, tracker sets, starter kits.
- **PK5 manager and registry:** the editor's Packs manager, install from file, URL or git, studio pinning and credits, the registry index.
- **PK6 artist tooling and docs.**

### Puzzle pages and blocks: crosswords and word searches (added 2026-09-30)
Shelbee asked for crosswords and word searches. They fit the pack system in three places:
- **Generators (engine, not packs):** deterministic puzzle generators in the engine, seeded from the book id, page id and a puzzle seed, so a reprint gives the same puzzle and every page stays unique. **Word search:** grid size (8 to 20), word count, directions (across and down only, diagonals, backwards), filler letters, a hidden word or theme line, an optional bonus word. **Crossword:** a symmetric or free-form grid built from a word and clue list, numbered cells and across and down clue lists, difficulty by word length and crossing count, with a check that every word crosses at least one other and no dead ends. Both print as black-and-white vectors (real fonts, no Type 3), scan-safe (fixed frame and code), and pass `check.mjs` at both trims.
- **Blocks and pages:** a Word search block and a Crossword block for the day page (small puzzle, sits in the grid), and full puzzle pages (a whole page, a spread, or a "puzzle corner" at the back) with an **answer key** on a separate page at the back (or a flipped-over strip), generated from the same seed so the key always matches. Options: size, difficulty, theme, large-print mode (bigger cells and type), one puzzle per page or several, number of puzzles per book, and whether the key is included.
- **Puzzle packs (a pack kind `puzzles`):** word lists with themes (seasons, moon phases, herbs, a city's places, a method's vocabulary), crossword clue sets (word plus clue), difficulty tags, languages (alphabets and right-to-left handled through the language packs), and licences. **Clues must be original or openly licensed**: the validator requires a licence and an author, and the build credits them on the Credits page. No copying of published crossword clues.
- **X4:** paper only (no puzzle solving on the device in scope). The accessibility options apply: large print and high-contrast ink for cells and letters, dyslexia-friendly type, and answer keys for helpers.
- **Slice:** PK-puzzles after PK3 (block packs), or earlier as a built-in pair of generators if Shelbee wants them first; generators and tests (every puzzle valid: all words placed and found, crossword crossings correct, deterministic across runs, unique across a book, fits both trims, key matches) come first.
- **P1 done (2026-10-05):** `journal/puzzles/` (seeded word search and crossword generators, SVG, built-in sample lists), blocks `wordsearch` and `crossword` (size, difficulty, word list source, seed, show answers, large print), pack kind `puzzles` (`packs/puzzles-sample`), `test-puzzles.mjs` in Books CI. Not yet: a separate answer-key page at the back (`pzBlock(..., {answers:true})` draws it from the same seed), full-page and spread puzzles, bonus/hidden word, symmetric crosswords, languages beyond A-Z, the Credits page, X4 (paper only).

## 21. Guide, public research docs and crowdsourcing (2026-09-30)

**The guide (site `/guide/`).** Step-by-step instructions for making a journal, written for someone who has never used the tool, each step with a screenshot and, where a button matters, a **cropped, annotated screenshot** that shows the exact control and says what it does.
- **Structure:** a short path (make a first book in about ten minutes) and deeper chapters: set up (profile and setup command, location, trim), design a day page (view and edit, palette, options, grid, presets), build the book (Book, Spread and Day views, organiser, library and series, book scope, volumes, undated books), scan options and codes, print (build the PDFs, what the checks mean, KDP upload, proofs, one upload per design), the X4 companion (check-ins, focus timer, settings, Wi-Fi and hotspot), accessibility options, versions and sharing (history, compare, restore, branches, forks, proposals), packs (installing and making), and troubleshooting. Each chapter says which features are shipped and which are coming, and stays in step with the roadmap.
- **Screenshots stay true:** every image is produced by a script from the generic demo (`site/tools/make-screens.mjs`) and each cropped shot is defined by a selector and a caption in a manifest: the script finds the control, crops around it, draws a numbered ring or arrow, and writes alt text. If a selector stops existing (the editor changed) the script, and CI, fails, so the guide cannot go stale silently. Light and dark and phone variants where they help. Numbered steps use the same numbers as the callouts on the image.
- **Accessible:** real headings, alt text that says what the button does (not just what it looks like), the steps also work without the images, keyboard and screen-reader friendly, reduced motion, dark mode, printable.
- **Examples and downloads:** sample project files and sample PDFs (generic data) for each chapter, and demo links that open the right view.

**Public research docs (site `/docs/`).** The 44 method docs are rewritten to be non-personal (no author, location, personal health or local services) and published in full:
- **Front matter** on every doc: title, slug, category, evidence level, last reviewed date, status, contributors, licence. The site builds an index with search, filters (category, evidence level, what it is good for, time per day), a comparison table, per-doc table of contents, "what you can build from this" links into the guide and the block library, and an "Improve this page" link.
- **Standards:** claims tied to sources, health claims from peer-reviewed or clinical sources, evidence levels stated plainly, accessibility sections, no medical advice. A doc lint runs in CI: required sections present, every source has a title, URL and date checked, front matter valid, no personal words, no broken links.
- **Licence (decided 2026-10-06):** the methods docs (`docs/journaling/methods/`), the /docs/ and /guide/ pages and the CONTRIBUTING docs rules are CC0 1.0 (public domain dedication), while this plan and `docs/review/` are not (all rights reserved unless a file says otherwise); code is MIT; a built x4-tls image is GPL-2.0 (wolfSSL). See `LICENSING.md`. Every doc carries `licence: CC0-1.0` in its front matter and the doc lint requires it; the site footers state it.

**Crowdsourcing.**
- **Contribution paths:** a `CONTRIBUTING.md` and a code of conduct; GitHub issue forms for *suggest a method*, *correct a fact*, *add or replace a source*, *suggest a translation*, *submit a pack*, *report a problem in the guide*; a pull request template with the checklist; `docs/journaling/TEMPLATE.md` (the 28-section method template) and a one-page writer's guide.
- **Quality and safety:** a review checklist (sources opened and dated, evidence level honest, health claims cited to peer-reviewed or clinical sources, no personal data, accessibility section, no copied text), reviewer roles, a policy for sensitive topics (self-harm, eating disorders, medication: careful framing and pointers to professional help, no instructions), and a correction policy with a visible "last reviewed" date and change log per doc.
- **For people without GitHub:** the site links to the forms and later a Studio form (signed-in or guest) that opens the same review flow; contributors are credited on a Contributors page, with consent.
- **Translations:** method docs and the guide can be translated through the same flow (see section 18) with a status table.
- **Packs:** the same review flow applies to packs (section 20).

**Slices:** G1 guide chapters 1 to 4 and the annotated-screenshot pipeline; G2 remaining chapters; D0 (done by four agents) de-personalise the docs; D1 docs site build (index, search, filters, pages) and lint; D2 crowdsourcing files and forms; D3 contributors page and the Studio route.

## 22. Art journaling and drawing practice (2026-10-05, plan only)

Shelbee asked for art journaling, and for ways to **get better at drawing through journaling**. Two ideas that fit together: **art-journal pages** (somewhere to make things) and **practice** (a gentle structure that builds skill). Nothing here is built yet, and no feature code ships with this section. It extends the `sketch` block, section 20 (packs) and `docs/journaling/methods/art-and-junk-journaling.md` (its section 25 already proposes `pattern`, `gluestrip`, a pocket page and an "Art journal day" layout; this plan includes them).

**Principles**
- **Calm and optional.** No grades, no "bad", no streak loss. A blank day is a normal day.
- **Dry media on thin paper.** KDP paper takes pencil, fineliner, ballpoint and coloured pencil. Not paint, wet markers or heavy glue.
- **Print is black and white.** Colour is something you add by hand. Nothing on a page depends on colour to make sense.
- **No generative AI**, anywhere: prompts, guides and reference art are written or drawn by people.
- **The default day page must not change.** Every new option defaults to today's output (byte-identical, 24/24).

### 22.1 Page and block types

New blocks use the declarative block format (section 20) and the day grid (4 columns, rows 5.6 mm). Each has its own `data-zone` (repeats `_2`, `_3`), a minimum span, and no X4 export unless stated. Where a block already exists, it grows options instead of getting a twin.

| Block (`type`) | What it is | Main options | Zone | Min span (cols x rows) |
|---|---|---|---|---|
| `sketch` (exists) | Frame to draw or tape in | add `guide` (none, thirds, cross, 4 mm grid), `ratio` (free, 1:1, 4:5, 3:2) | `sketch` | 2 x 6 |
| `thumbs` | Thumbnail strip: 3 to 8 small frames, numbered, for composition tries (pick one, draw it big). Also the "same subject, two dates" pair | `n`, `ratio`, `pick` bool (a "chosen" circle under each) | `thumbs` | 4 x 4 |
| `swatch` | Colour swatch and palette: 4 to 12 outlined squares to colour in by hand, a name line under each, optional "mix" row (A + B = ?) | `n`, `names`, `mix`, `shape` (square, circle) | `swatch` | 2 x 4 |
| `refbox` | Reference box: a labelled frame with a source line (where it came from, licence note) and a "what I see" line. For a glued-in photo or a pencilled note, never an image supplied by the studio | `h`, `source`, `note` lines | `refbox` | 2 x 5 |
| `collage` | Mixed-media / collage frame: tape-corner ticks, an optional "glue only here" inner margin, a pocket fold-line option (dotted, 0.75 pt) | `h`, `corners`, `pocket`, `caption` | `collage` | 2 x 6 |
| `doodle` | Margin doodle: a narrow column (1 of 4 grid columns) with a dotted edge and a tiny "margin" label. Lives inside the grid, never outside the safe margin or over the 9pt frame | `rows`, `side` (left, right, or follows handedness) | `doodle` | 1 x 6 |
| `lettering` | Lettering guide lines: baseline, x-height, ascender and descender lines, optional slant guide; one script per guide (Latin first) | `n` rows, `script`, `slant` (0, 10, 15), `pitch` | `lettering` | 3 x 4 |
| `persp` | Perspective grid: one-, two- or three-point, horizon line and vanishing points printed inside the block | `kind` (1, 2, 3), `h`, `density` | `persp` | 3 x 8 |
| `figure` | Figure and proportion guides: a heads-tall ladder (7, 7.5 or 8 heads), head construction (oval, cross, thirds), hand map. Plain line guides, no body-type claims | `kind` (ladder, head, hand), `heads`, `h` | `figure` | 1 x 8 |
| `value` | Shading value scale: 5 or 7 empty boxes to fill from light to dark, ends labelled, optional "squint" row to try the same shapes in 3 values | `steps`, `squint` | `value` | 2 x 3 |
| `blind` | Observational / blind contour: a clear frame, a "no peeking" note, a minutes line; the page version has a big frame and a "what I noticed" line. No guides | `h`, `timed`, `noticed` | `blind` | 2 x 6 |
| `pattern` (planned in the method doc) | Pattern to colour (plaid, grid, circles) as SVG line art, the low-energy option | `kind`, `h` | `pattern` | 2 x 4 |
| `gluestrip` (planned) | Seven small boxes, one per day | `n`, `labels` | `gluestrip` | 4 x 3 |
| `practicelog` | One row per session: date, strand icon, minutes, subject, one line "I noticed". See 22.2 | `n` rows, `strand` icons | `practicelog` | 4 x 4 |

**Whole pages** (built-in pages and page packs, made from these blocks): warm-up (gesture boxes), observational drawing, blind contour, value study, perspective, colour study, composition thumbnails, lettering, pocket, month title, baseline, revisit, practice log and level check. A page can be one page or a spread; no block crosses the fold in the first version (section 12). Pages added through the organiser (C4) follow the normal rules.

### 22.2 Skill building through journaling

**Strands.** Practice is organised by skill, so people pick what they want to work on:
1. **Gesture:** fast, loose marks for movement and the big shape (30 seconds to 2 minutes).
2. **Contour:** slow seeing of the edge; blind and continuous line.
3. **Value:** light to dark, squinting, simple three-value studies.
4. **Perspective:** horizon, vanishing points, boxes in space.
5. **Composition:** thumbnails, focal point, cropping, white space.
6. **Colour:** mixing, limited palettes, warm versus cool, done by hand with coloured pencil (print stays black and white).
7. Optional: **Proportion and figure**, **Lettering**, **Observation** (draw the ordinary).

**Daily prompts.** The existing `prompt` block rotates by date (the same on any reprint). Drawing prompts are a prompt pack with tags: `strand`, `level`, `minutes` (2, 5, 10, 20), `media` (pencil, pen, any), `subject` (object, place, hand, sky, memory). A book shows one prompt a day, or one a week with a strand of the week. Each prompt has a 2-minute low-energy version and, where it makes sense, a "no sight needed" version (by touch, from memory, from a sound). Prompts never use colour as the only instruction.

**Structured practice.** A **practice path** is data: an ordered list of sessions (strand, minutes, prompt, which guide page to use, "what to look for" in a sentence or two, never a score). Paths ship as packs. Starter paths, all original:
- **First 30 days:** 5 to 10 minutes a day, a new strand every few days, one baseline and one revisit.
- **12-week foundations:** two strands a week, one long session a week, a monthly review.
- **One strand deep:** 8 weeks on one strand (for example value).
- **Low-spoons path:** 2-minute sessions only: pattern and contour.

**Levels without gates.** Levels are a ladder, not locks. Each strand has three or four steps written as "I can ..." statements the person ticks themselves (value: "I can make five distinct tones with a pencil", "I can simplify a scene to three values"). The book prints the ladder on a level check page. No exams, badges or points. "Try next" suggestions sit on the weekly review and can be ignored. Levels are named by what you do (Notice, Shape, Form, Space, Story), not by how good you are.

**Practice log.** A `practicelog` block and a log page: date, strand icon, minutes, subject, "I noticed ...". Month-end counts (sessions, minutes, strands touched) come from what the person writes, defined once like the handoff boxes (`handoff.mjs`), and stay blank if nothing was logged.

**Streaks without guilt.** No streak counter that can break. The book shows **totals and gentle rhythms**: sessions this month, weeks with at least one session (one touch counts), total minutes. A missed day, week or month leaves no empty mark: dots fill when you practise and the rest is just space. The wording is "welcome back", never "you missed". The X4 never shows a streak or a badge (22.4). The editor follows the same rule: no red, no loss messaging.

**Before and after.** A **baseline page** near the front: draw six things in a fixed time (a box, your hand, a mug, a simple tree, a face, a value strip), dated, no judgement. A **revisit page** at the back (and optionally the midpoint) repeats the same six in the same layout, with a `{{P_x}}` cross-reference back to the baseline so the two are easy to hold side by side. Page numbers and recto/verso come from the automatic rules. Also a free "same subject, two dates" pair (a `thumbs` strip with two frames). Reflection under both: "What looks different? What do I want to keep?"

**Reflection prompts** (a prompt pack set, original text): "What did I notice that I did not see before?", "Which mark am I proud of?", "What was hard, the seeing or the hand?", "What do I want to try next week?", "What can I leave unfinished?".

**Weekly and monthly review.** Weekly: a small strip (sessions, strand, one favourite, one "try next") using the existing `review` block with drawing wording. Monthly: the log totals, a "favourite page" pointer, an optional baseline comparison, one next step. The protected pages (Safety plan, Support, Closing the month) are unchanged; drawing review is added to them only as blocks the person chooses.

### 22.3 How it fits: blocks, grid, packs, print, scan zones, access, languages

**Blocks and grid.** Everything in 22.1 is a block with options placed by the C4b grid; none is a special case. Method layouts: **Drawing practice day** (sky, `prompt`, `blind` or `sketch`, `practicelog` row, `checks` "Drew today") and **Art journal day** (the method doc's layout, plus the new blocks). Book scopes: a dated year, an **undated drawing practice book** (Phase H: 30 days, 12 weeks or 52 weeks), or a hybrid with drawing pages after each week.

**Packs (section 20).** One entry each in `journal/packs/kinds.mjs`:
| Kind | Group | Holds | Privacy class |
|---|---|---|---|
| `prompts` (extends prompt packs) | Words | Drawing prompts with strand, level, minutes, media, low-energy and no-sight variants, licence per set | public |
| `practice-paths` (the "drawing-practice pack kind") | Method | Paths, level ladders ("I can" statements), baseline and revisit page specs, review wording | public |
| `guides` (guide-line packs) | Look | Perspective, figure, lettering (per script), CJK and other grids, value scales, as SVG under the print rules below | public |
| Block packs | Blocks | Third-party art blocks in the declarative format | public |
| Starter kit | Method | A "Drawing practice" kit: layout, pages, path, prompts, theme | public |

**Print rules** (enforced by the pack validator and `check.mjs`)
- **Fonts:** real embedded fonts only; no Type 3 (`pdffonts` gate). Guide labels are embedded-font text or outlined SVG.
- **Line weights:** every printed stroke (guides, dotted lines, frames) is at least 0.75 pt. No hairlines.
- **Guide tone:** guide lines are no lighter than 10 percent black (our floor, so they survive KDP's halftone) and at least 0.75 pt; the default is 10 to 20 percent so pencil shows over them. The high-contrast option raises it (about 30 percent and 1 pt). Confirm the floor on a KDP proof.
- **Paper:** KDP interior paper is thin (check the current KDP spec at build time). A front-matter line says dry media only, using the usage note already proposed in the method doc. Wet media, heavy glue and paint are unsupported; a show-through test page joins the proof checklist.
- **Bleed:** interiors have no bleed by default and every guide and frame stays inside the safe margin. No full-bleed swatch or colour page is planned. If a book turns bleed on (0.125 in), guides still stay inside the margins and the validator checks it.
- **Gutter:** nothing crosses the fold (as for spread days).
- **Black and white:** colour pages are line art to colour by hand; nothing relies on grey tones to be readable on a low-ink copy.

**Scan zones are untouched.** The DATE/TITLE/TAGS header, the 9pt frame, the SEND TO strip and the Data Matrix page code stay fixed and clear. Art blocks sit inside the grid and cannot overlap them; a collage block prints "keep tape and glue inside the frame". The scan test (collage over a frame edge) from the method doc's open list is done before AJ3 ships. Every new block renders at both trims with its zone in `layout.json`. The Keeper never gets art blocks or scan codes.

**Accessibility (section 15 applies).** Large-print and high-contrast variants raise guide weight and tone and enlarge frames; the low-clutter option drops optional guides and icons. Short sessions are the default; every prompt has a 2-minute option and, where possible, a no-sight option; large-grip tool tips go in the docs; timers never punish slowness; no flashing; nothing depends on sound. The editor keeps 44 px targets, labels on controls, light and dark mode, no sideways scroll at 390 px. Wording never says "bad" or "wrong". Art journaling is not art therapy and the book never claims it is.

**Languages (section 18).** Block labels, prompts, level statements and review wording are catalog strings; prompts and paths are per-language packs, not machine-translated. Strand names are icons first. Guides are script-aware: Latin first; later Cyrillic and Greek (same lines), Arabic (own baseline and proportions, RTL mirroring), Devanagari (headline line), and CJK square or cross grids as guide packs. RTL mirrors the margin doodle and thumbnail order. Longer languages run through the overflow gate.

### 22.4 X4 e-ink companion

Within the firmware scope (no generative AI, no notifications, feeds or badges; nothing leaves the device except over its own hotspot or an explicit sync the user starts):
- **Prompt of the day (small):** one text line on the Today screen, chosen by date from the book's prompt pack and baked into the export pack. No new network use, no feed. Hold a button for the low-energy version.
- **Sketch timer (small to medium):** reuse the focus timer (`src/core/focus.*`) with presets of 2, 5, 10 and 20 minutes and a "gesture set" (1 minute, then 2) for poses the person chooses on paper. E-ink refresh is slow, so v1 redraws once a minute; 30-second gesture timing waits until refresh is measured on hardware. The end is a screen change, no sound. The user starts and stops it; there is no reminder to draw.
- **Check-in:** a "Drew today" toggle (`checks`) and an optional minutes number (`fields`) through the existing bridge and paper block. Month stats can show plain counts (sessions, minutes). Never a streak, badge or loss message.
- **Not supported:** photos or camera, reference images in v1, drawing on the device, AI prompts or art, reminders. A user-loaded reference or sketch on the sleep screen (480x800 1-bit, 48 KB, row by row from SD, loaded over the hotspot) is possible later and optional; it is a question, not a plan.
- **Sync:** logs ride the existing explicit sync to the user's own Studio account (section 19) with stable keys. Firmware must stay `[SUCCESS]`, with RAM and flash measured before and after (AJ9).

### 22.5 Licensing and originality

- **Prompts, paths, level statements, guides and example pages are original** (written for this project) **or openly licensed** (CC0, CC BY, CC BY-SA, usable in print for sale), with author and licence in the pack manifest. The build refuses a pack with no licence and credits packs on the Credits page (section 20).
- **No copied course content.** Do not copy the wording, sequences, exercise sets, diagrams or examples of books, paid courses or video series, and do not use their names or trademarks for exercises. General techniques (gesture, blind contour, value scales, perspective, thirds, a heads-tall ladder) are ideas anyone can teach; our text and our ordering are ours. If an idea comes from a named teacher, credit it in the method doc and keep the wording original.
- **Reference art:** sample content uses generic line art made for the project, or public domain or CC0 images with the source recorded. Users bring their own references on paper; the `refbox` reminds them to check they may copy what they use. Nothing is AI-generated.
- **Docs and evidence:** the method doc (AJ0) says what research does and does not show about practice and about art-making and wellbeing (see the evidence table in the existing doc), makes no outcome promises ("draw like X in 30 days"), and never calls any of it therapy. Sources are dated like section 21.
- **Artist packs:** the section 20 rules apply (SVG sanitiser, 0.75 pt minimum, licences, `commercial-print-ok`).

### 22.6 Slices (small first)

| Slice | Output | Size |
|---|---|---|
| **AJ0** | Docs only: a `drawing-practice` method doc (28-section template, original wording, sources checked), a prompt and path writing guide. The open questions are answered (22.7); an agent drafts, the owner reviews before merge | S |
| **AJ1** | `sketch` options (`guide`, `ratio`) and `thumbs`, defaults unchanged; shared SVG guide primitives (0.75 pt and 10 percent floors, tested at both trims); the front-matter dry-media note | S |
| **AJ2** | `swatch`, `refbox`, `value`, `blind`, `doodle`, with zones, minimum spans and overflow tests | S to M |
| **AJ3** | `pattern`, `gluestrip`, `collage` (pocket fold lines), `lettering`, `figure`, `persp`; the collage scan test | M |
| **AJ4** | Drawing prompt packs: `prompts` gets tags and filters, the `prompt` block gets `strand` and `minutes` options, a starter set of about 60 original prompts with low-energy and no-sight variants | M |
| **AJ5** | `practicelog` block (totals and "weeks with a touch" only, no streaks), month totals in the handoff style, gentle-count wording, weekly and monthly review additions | M |
| **AJ6** | Whole drawing pages in the organiser's "add page" palette | M |
| **AJ7** | Method layouts (Drawing practice day, Art journal day), baseline and revisit pages with cross-references, an undated 30-day and 12-week starter kit. The practice book comes first, then the day-book art layer (answer 1); levels are self-ticked "I can" ladders with no gates (answer 3) | M |
| **AJ8** | Pack kinds `practice-paths` and `guides`, validators, credits, pinning; the first guide pack for a second script | M |
| **AJ9** | X4: prompt of the day, sketch timer presets, "Drew today" and minutes check-ins; RAM and flash measured; host preview screens | M |
| **AJ10** | Translated prompts and paths, RTL and script guides, accessibility audit of the new blocks, a guide chapter and a site feature block with screenshots | M |
| **AJ11** | LATER, each needs its own plan before any build: user-loaded reference image on the X4 sleep screen (firmware-scope review, section 19), Studio-held scanned sketches (privacy plan). A colour interior is not planned (22.7 answer 2) | decide later |

Every slice: default pages byte-identical (24/24), `check.mjs` "[] 0", `pdffonts` shows no Type 3, new blocks render at both trims, `layout.json` maps every new zone, the privacy gate stays green, and no personal strings enter the site or the methods docs.

### 22.7 Questions for Shelbee (all answered 2026-10-06)
1. **Scope:** an art layer in the normal day book, a separate **drawing practice book** (undated, 30 days or 12 weeks), or both? (Suggested: both, practice book first.)
   **Answered 2026-10-06:** both, practice book first.
2. **Colour:** stay black and white (colour by hand with pencils), or plan a colour interior option later? It changes cost and KDP limits.
   **Answered 2026-10-06:** black and white (colour by hand with pencils); no colour interior planned.
3. **Levels:** self-ticked "I can" ladders with no gates (suggested), or only a baseline and revisit?
   **Answered 2026-10-06:** self-ticked "I can" ladders, no gates.
4. **Streaks:** confirm no streak at all, only totals and "weeks with a touch", on paper and on the X4.
   **Answered 2026-10-06:** no streaks; totals and "weeks with a touch" only, on paper and on the X4.
5. **Strand order:** suggested: observation and contour, then value, composition, perspective, colour, then figure and lettering.
   **Answered 2026-10-06:** contour, value, composition, perspective, colour, figure, lettering.
6. **Show-through:** should the page behind a dense drawing page stay light by default? Needs a proof to decide.
   **Answered 2026-10-06:** the page behind a dense drawing page stays light by default; confirm on the proof.
7. **Guide tone:** accept 10 percent black and 0.75 pt as the floor, subject to a KDP proof?
   **Answered 2026-10-06:** accepted: 10 percent black and 0.75 pt floor, subject to the KDP proof.
8. **X4 timer:** is a once-a-minute redraw enough for v1, or does 30-second gesture timing matter enough to wait for hardware measurements?
   **Answered 2026-10-06:** a once-a-minute redraw is enough for v1.
9. **Reference images:** paper only (suggested), or later a user-loaded reference on the X4 sleep screen?
   **Answered 2026-10-06:** paper only for now. A user-loaded X4 reference is a LATER feature and needs its own firmware-scope review (section 19, `x4/CLAUDE.md` rules) before any build.
10. **Scanned sketches:** keep drawings physical only (suggested), or one day let the Studio hold scanned pages for before and after? That needs its own privacy plan.
   **Answered 2026-10-06:** physical only for now. Studio-held scans are a LATER feature and need their own privacy plan before any build.
11. **Authors:** will you write the first prompts and paths, or should an agent draft them for your review? (All must be original or openly licensed.)
   **Answered 2026-10-06:** an agent drafts prompts and paths and the owner reviews before merge; all original or openly licensed.
12. **Name:** "Drawing practice" for the kit and method doc, or something else?
   **Answered 2026-10-06:** "Drawing practice".

## 23. Photo journaling (glue-in) (2026-10-09, slice PH1 built)

Shelbee wants photo journaling where **the photos are pasted onto the printed page by hand**. So the work is blocks that give a print somewhere exact to go, and nothing else. The photo itself never touches the system.

**What this is not (decided, do not add without asking)**
- **No photo upload, no image handling, no camera, no Studio storage.** No block, option, snapshot, pack or page holds a picture. A Studio snapshot only carries the options a block declares (the existing allowlist: `studio/src/snapshot.mjs` copies `TYPES[type].opts` and the grid placement, so a stray `src` or `photo` field is dropped; `test-photoblocks.mjs` proves it).
- **No X4 involvement.** The firmware, the X4 export and the check-in bridge are untouched; these blocks have no X4 items. A reference image on the X4 stays a LATER item with its own review (22.7 answer 9).
- **No generative AI**, as everywhere (section 22 principles). Prompts below are written for this project.
- Calm and low-stimulation: light marks, generous space, nothing printed that a pasted print has to cover except the marks.

### 23.1 The blocks

All four are ordinary blocks of the declarative format (section 20): `{uid, type, on, ...options}` declared in `daypage.mjs` `TYPES` (group **Photos** in the palette, each with an icon), laid out by the page grid, with one `data-zone` each (repeats `_2`, `_3`), a minimum span, and the same `gridProblems` checks as every block. The geometry lives in `journal/photo.mjs` (no imports; the editor inlines it).

| Block (`type`) | What it is | Options | Zone | Smallest span |
|---|---|---|---|---|
| `photoframe` | One true-size window for one print: four light corner marks, a keep-clear glue margin, a "trim your print to this" guide (four tick marks and the words), caption lines | `size` (2x3, 3x3, 3x4, 4x6, Instax mini 2.1x3.4, Instax square 2.4x2.4, Instax wide 3.4x2.1, Polaroid picture 3.1x3.1, custom), `turn` (portrait or landscape), `cw`/`ch` (custom, tenths of an inch, 1.0 to 6.0 in), `cut` (trim marks), `lines` (none, one: what and where, three: what, where, why this one), `who` (a who and when line), `title` | `photoframe` | per size and trim, see 23.3 |
| `photostrip` | 2 to 4 small frames in a row or a column, a date line under each, an optional caption line under the strip | `size` (1x1, 1x1.5, 1.5x1.5, 1.5x2, 2x2, 2x3, Instax mini), `turn`, `n` (2 to 4), `dir` (row or column), `dates`, `lines` (none or one), `title` | `photostrip` | per size and trim |
| `photodaily` | A grid of tiny frames, one per day of the month, each labelled with its date, for a photo-a-day habit. On a day page it counts that month's days and marks today's number; elsewhere it is numbered 1 to 31. It says when the day starts (the profile's `day_start_hour`: "A day starts at 4 a.m.") so a photo taken at 2 a.m. goes in yesterday's frame | `size` (0.5x0.5 or 0.75x0.75), `days` (this page's month, or 28 to 31), `note` (the day-start line), `title` | `photodaily` | per size and trim |
| `contactsheet` | 6 to 12 small numbered frames, each with a pick-one tick box, and a line for the one you kept and why | `size` (0.75x0.75, 1x1, 1x1.5, 1.5x1.5), `turn`, `n` (6 to 12), `pick`, `lines` (none or one), `title` | `contactsheet` | per size and trim |

**Captions are options, not extra blocks.** `photoframe` carries the what, where and why-this-one lines and the who and when line; `photostrip` carries a date under every frame; `contactsheet` carries the numbers, the pick tick and the "which one and why" line; `photodaily` carries the date labels. The caption lines are the book's ordinary ruled lines, so they print and scan like the rest.

**How a frame is drawn (and why it is safe to paste over)**
- The window is the **nominal print size**. The corner marks are drawn **0.04 in inside** its edge, so a print cut to size covers them and **no edge peeks out**, even if the print is a hair small or a hair off.
- Marks are 1 px = **0.75 pt** thick (the floor), mid grey (`#8c8c8c`, about 45 percent black): visible on the page, light enough to leave the print the loudest thing. High contrast turns them black.
- The **keep-clear glue margin** is 0.08 in round a frame (0.06 in round a sheet's frames) and nothing prints in it, so squeezed-out glue never lands on text. The margin is inside the block's cell, so the neighbour block cannot be closer than that.
- The **cut guide** (`cut`): the words "trim your print to this" and a short tick on each side, just outside the print, so you can line a cut print against them.
- **Sizes are physical.** A 3 x 4 in frame is 3 x 4 in on paper at 5.5x8.5 and at 8.5x11. The 8.5x11 page is drawn at 6.57 in wide and zoomed 1.294x, so the code draws a print of W inches as W / 1.294 CSS inches there. `test-photoblocks.mjs` measures it in the page and in the PDF.

### 23.2 Which pages they work on

All four are allowed on every page kind (`allowedIn`): a day page (flow or grid), a Notes page, a Collection page, the blank page, the day spread and its pages. They are not day-only: they read a date only if there is one (`photodaily`'s month label).

What limits where a big print can go is **rows**, because Notes, Collection and day pages keep a Writing space of at least 8 of their 24 rows (it is locked on), a blank page has 27 rows and no Writing space, and each page of a spread has 24 rows (a spread needs a Writing space somewhere, not on every page).

| Page | Rows for the photo block | What fits (standing prints, one caption line) |
|---|---|---|
| Blank page | up to 27 | 5.5x8.5: up to 3x4, Polaroid picture, Instax square or mini. 8.5x11: up to 4x6 |
| Right (or left) page of a spread day | up to 24, with the Writing space on the other page | 5.5x8.5: up to 3x4 (21 rows). 8.5x11: up to 4x6 (24 rows) |
| Notes, Collection or day page (Writing space kept, 16 rows left) | up to 16 | 5.5x8.5: 2x3, 3x3, Polaroid, Instax square with no caption lines, or a strip or sheet. 8.5x11: up to 3x4 with no caption lines |
| Photo a day (0.5 in frames, 31 days) | 22 rows at 5.5x8.5, 13 at 8.5x11 | a blank page or a spread page at 5.5x8.5; any page at 8.5x11 where 16 rows are free |

No block crosses the fold of a spread (the existing rule, section 12): a frame lies wholly on one page. The default pages carry none of these blocks and print as before.

### 23.3 Fit table: print size per trim and per grid

The page is 3.45 in wide inside the scan frame at 5.5x8.5 and 5.85 in at 8.5x11. A grid column is **0.80 / 1.68 / 2.57 / 3.45 in** for 1 / 2 / 3 / 4 columns at 5.5x8.5 and **1.38 / 2.87 / 4.36 / 5.85 in** at 8.5x11 (widths include the gaps). A frame fits when its print plus 0.16 in of glue margin is no wider than its columns. Rows: a grid row is 0.22 in at 5.5x8.5 and 0.285 in at 8.5x11. Smallest columns and rows for a standing frame with one caption line (`photoframe`):

| Print | 5.5x8.5 smallest | 8.5x11 smallest |
|---|---|---|
| 2 x 3 | 3 cols x 17 rows | 2 cols x 14 rows |
| 3 x 3 | 4 x 17 | 3 x 14 |
| 3 x 4 | 4 x 21 | 3 x 17 |
| 4 x 6 | **does not fit** (4.16 in needed, 3.45 in page) | 3 x 24 |
| Instax mini 2.1 x 3.4 | 3 x 19 | 2 x 15 |
| Instax square 2.4 x 2.4 | 3 x 14 | 2 x 12 |
| Instax wide 3.4 x 2.1 (lying) | **does not fit** (3.56 in needed) | 3 x 11 |
| Polaroid picture 3.1 x 3.1 | 4 x 17 | 3 x 14 |
| Custom 1.0 to 6.0 in a side | by the same rule | by the same rule |

Turned on its side, a 3x4 needs 4.16 in across (letter only, 3 cols x 14 rows) and a 4x6 needs 6.16 in (does not fit either trim). Three caption lines add 2 rows; a who-and-when line adds 1.

Strips, sheets and the daily grid, 31 days or a full sheet, smallest rows (4 columns wide), `no` = does not fit that width:

| Block | 5.5x8.5 | 8.5x11 |
|---|---|---|
| Strip, 3 x 1 x 1.5 in in a row | 10 rows | 8 rows |
| Strip, 4 x 1 x 1 in in a row | no (4.52 in needed) | 7 rows |
| Strip, 2 x 2 x 3 in in a row | no | 14 rows |
| Contact sheet, 6 x 1 x 1 in | 14 rows (3 a row) | 12 rows |
| Contact sheet, 12 x 0.75 x 0.75 in | 17 rows (4 a row) | 10 rows |
| Contact sheet, 12 x 1 x 1 in | 26 rows | 17 rows |
| Photo a day, 0.5 x 0.5 in | 22 rows (6 a row) | 13 rows (8 a row) |
| Photo a day, 0.75 x 0.75 in | does not fit a page (38 rows) | 20 rows (7 a row) |

**Refusals.** `gridProblems(layout, size)` refuses any block that does not fit its cells, with a plain reason: *"Photo frame does not fit: a 4 × 6 in print needs 4.16 in across with its glue margin, and 4 columns of the 5.5×8.5 page are 3.45 in wide (the whole page is 3.45 in). Pick a smaller print or turn it, or build the 8.5×11 trim."* The same words show in the editor under the block's options and in its problem list ("does not fit"), and a flow layout stops the build with them. The check is per trim, so a layout that only fits 8.5x11 is a valid `book.json` (validation runs at 8.5x11, the roomier trim) and the 5.5x8.5 build stops with the reason. A 4x6 book is an 8.5x11 book.

### 23.4 Print rules (enforced by the build and `test-photoblocks.mjs`)
- **Strokes at least 0.75 pt** (every mark, tick, caption line and pick box is a 1 px border or more). **Mid grey, not a fill**: nothing a print could not hide.
- **No Type 3 fonts**: the blocks use the page's own embedded fonts only (`pdffonts` is checked on every test build).
- **Scan zones untouched**: the DATE/TITLE/TAGS header, the 9 pt frame, the SEND TO strip and the Data Matrix code are not blocks and never move. A frame sits inside the grid, which is inside the frame's quiet zone, and carries its own `data-zone` so `layout.json` maps it.
- **Gutter keep-out.** A glued print must start at least **0.625 in** from the spine edge (a bound page curves for about half an inch next to the spine, and a print bridging the curve lifts). Every grid cell is already at least 0.925 in (5.5x8.5) or 1.197 in (8.5x11) from the nearest trim edge, because of the margin and the 9 pt frame with its 0.5 in quiet zone; `photo.mjs` states the rule (`GUTTER_KEEP_IN`) and `gridProblems` refuses a block if the page ever moves in (the test also measures every frame on the built pages).
- **Large print and high contrast** never move or resize a frame (physical sizes), the check `"[] 0"` passes on every page with both on, and the marks go black under high contrast.
- **No bleed**: a frame stays inside the safe margin. Nothing is printed outside the grid.

### 23.5 Paper and glue guidance (for the front matter and the Guide; verify on a printed proof)
- **Dry adhesive only**: glue stick, tape runner, photo corners or double-sided tape. No wet glue, no paste, no wet-media scrapbooking: KDP interior paper is thin and wet glue wrinkles it and can show through to the page behind (see the dry-media note in 22).
- **Thickness piles up.** Each pasted print adds paper. Many prints on the same part of every page make the spine side fatter than the other and the book will not close flat. Spread prints around the page, paste at most a few a spread, and keep the 0.625 in gutter clear.
- **Print thin.** Lightweight matte photo paper (or a plain-paper print) behaves better than glossy card. Trim the print to the size on the frame, a hair small rather than large.
- **The page behind**: a print shows through a thin page as a dark patch. Keep what is on the back of a photo page light (no dense drawing page behind it, as in 22.7 answer 6).
- **A photo book is heavier.** KDP paperback is 24 to 110 pages and hardcover needs 75 or more; a book with many prints is thicker than its page count says. Order one proof before buying copies and paste test prints into it.
- None of this has been tested on real KDP paper. A glue-and-paper proof page is slice PH3.

### 23.6 Prompts (original text; the caption lines carry them)
- **Frame:** what / where / why this one. Who / when.
- **Strip:** a date under each frame; one line under the strip: "what changed between these".
- **Contact sheet:** the numbers; pick one; "the one I picked, and why".
- **Photo a day:** the date under each frame; a single "one I would keep" note on the month's page.
- Possible daily prompts for the `prompt` block later (original, short, no outcome promises): "A small thing that was in the light today.", "Something I walked past and finally looked at.", "Hands doing something.", "A place I was today, from where I stood.", "Something that took longer than I thought.", "The meal, from above.", "A colour that kept turning up.", "What was on the table when I sat down."

### 23.7 Slices
| Slice | Output | Size |
|---|---|---|
| **PH1** (this change) | `photoframe`, `photostrip`, `photodaily`, `contactsheet` in `daypage.mjs` with `photo.mjs` geometry; palette group Photos with icons; options, minimum spans and `gridProblems` fit and gutter checks; the editor's does-not-fit note; i18n; `test-photoblocks.mjs` (true size measured in the DOM and the 300 dpi PDF, refusals, the gutter, determinism, every page kind, large print and high contrast) | M |
| **PH2** | Ready-made pages: a "Photo page" (blank page with one frame), a "Photo day" method layout (a strip, a caption, a Writing space), a "Month of photos" page (photo a day plus a contact sheet), a "Photo page" entry in the organiser's add-page menu (the blank page cannot repeat today) | S to M |
| **PH3** | A glue-and-paper proof page in the KDP proof test sheet (`proof-test.mjs`): frames on both sides of a page, one print per adhesive, a show-through patch; the front-matter adhesive note; real marks tone and thickness decided from the proof | S |
| **PH4** | A Guide chapter and a site feature block (annotated screenshots) | S |
| **PH5** | Month-aware photo a day on Notes pages (the book's month), a photo index page (number, page, date), the pocket fold line from AJ3's `collage` for loose prints | M |

### 23.8 Questions for Shelbee
1. **Instax and Polaroid sizes.** I used your numbers as the size of what you paste. Instax mini 2.1 x 3.4 is the whole card (its picture is smaller); Instax square 2.4 x 2.4 is the picture only (the whole card is bigger); "Instax wide 3.4 x 2.1" is the size of a mini card lying down (a real wide card is bigger). Do you want the sizes to mean the picture you cut out, or the whole card?
2. **4x6 and other big prints.** 4x6 only fits the 8.5x11 trim. Is that fine, or do you want a 5.5x8.5 book with a 3.5 x 5 or a 4 x 4 option? (A 4 in wide print needs 4.16 in with its glue margin; the 5.5x8.5 page is 3.45 in.)
3. **Photo a day.** At 5.5x8.5 the biggest frame for 31 days on one page is 0.5 in (about a postage stamp). Is that useful? Alternatives: a spread per month, a 0.75 in frame at 8.5x11, or 7 frames a page and a week at a time.
4. **Mark tone.** Mid grey (about 45 percent black) at 0.75 pt: right? It is the lightest that is likely to survive KDP's halftone; a proof decides.
5. **How many prints?** A rough limit per book (for spine thickness) would let the front matter say so. Do you want a cap, or just advice?
6. **Where do photo pages go?** Today a book can have one blank page, and Notes or Collection pages keep their Writing space. Do you want a repeatable "Photo page" (PH2)?
7. **Hardcover.** More paper, more pasted thickness: any limit?
