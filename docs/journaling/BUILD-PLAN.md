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
| C5 | Block-based pages | Month, week, review, notes, back-matter pages editable as blocks |
| C6 | Per-month overrides + book-level "Start from a method" | Whole-book layouts |
| C7 | Save/load (commit `book.json` next to `daypage.json`), tests, docs | Editor works end to end |

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

Every unit follows the same proof as the fixes: reproduce, fix, rebuild all 12 months at both sizes with the checks
(overflow, spreads, scan codes, fonts), look at the pages, editor and X4 previews, Firmware CI green, PR.
