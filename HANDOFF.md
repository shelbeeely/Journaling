# Handoff: where things stand (late Sep 2026)

## Shelbee's build (moved here from the old README)
The product is **Journalwright Studio**; *Keeping Watch* is Shelbee's own book (her profile). Her year is Oct 2026 to Sep 2027:
12 monthly books for Amazon KDP (5.5x8.5 and 8.5x11), the yearly Keeper, X4 EPUBs and the day page editor, plus the X4 firmware.
- Setup takes about 20 minutes: [SETUP.md](SETUP.md).
- Her books, from her calendars (never committed; they live in `journal/private/`):

      cd journal && npm ci && npx playwright-core install chromium && pip install pillow
      ICS=private/main.ics,private/birthdays.ics ./build-all.sh
      ./build-all.sh                                   # sample books from test.ics (check-identical must stay 24/24)
      node editor/build.mjs && open editor/dist/site/index.html
- Firmware: `cd x4/host && ./preview.sh` (every screen as PNG), then
  `git clone https://github.com/Free-Ink/freeink-sdk ../../freeink-sdk && cd .. && pio run -e x4`.
- CI: Books, Firmware, Editor (tests + the site on Pages) and STA schedules (monthly PR).

## Site and Pages (added with the README and website unit)
- `site/` is the product website (plain HTML/CSS/JS). `site/build.sh` assembles it and runs `site/check-links.mjs`; every picture comes from
  `site/tools/make-screens.mjs` (generic profile + `test.ics`: sample pages via pdftoppm, editor screenshots via Playwright, X4 screens from `x4/host`; writes `site/img/shots/*.webp` + `manifest.json`; `--only=pages,x4,editor,versions`; rerun it when the editor UI changes, the images are committed); `site/tools/build-docs.mjs` writes a titles-only `/docs/` index (BUILD-PLAN, docs/review and the method texts hold personal decisions and are never published; `site/build.sh` fails if Spokane, Keeping Watch or Shelbee appear in the site).
- **Guide (`/guide/`)**: `site/tools/guide-content.mjs` holds the chapters and every screenshot's selectors and callout text; `site/tools/make-guide-shots.mjs` drives the demo, rings the controls and writes `site/img/guide/*.webp` (rerun it and commit when the editor UI changes); `--check` runs in the Editor workflow and FAILS if a selector is gone or an image is missing; `site/tools/build-guide.mjs` writes the page from `site/guide/` (called by `site/build.sh`). BUILD-PLAN section 21 slice G1; chapters 1 to 9 are in, G2 adds the rest.
- The Editor workflow publishes one Pages site (per BUILD-PLAN section 12, nothing else deploys to the root): `/` the website, `/editor/` a demo of
  the editor (generic profile, sample data, never saves anywhere, banner says so; `MODE 'demo'` in `journal/editor/template.html`), `/docs/`,
  and `/app/` the working editor that saves in the browser and commits with a token.
  **The working editor moved from the site root to `/app/`.** Update any bookmark. If `EDITOR_PAGES_REPO` is set, the whole site goes to that repo.
- The demo is built by `KW_PROFILE=content/profile.example.json KW_OUT=out-demo EDITOR_DIST=editor/dist-demo/ node editor/build.mjs`.
- The site has "What you can do today" (shipped features with screenshots and inline SVG diagrams), "See it in action" (4 worked examples with demo links such as `editor/#day/2026-10-14/edit`) and a Roadmap of unfinished items only. When a roadmap item ships: move it up into a feature block, add a screenshot to `make-screens.mjs`, and drop it from the roadmap and the README table. The X4 home screen is never shown (its title is in firmware, not generic). The Versions drawer is hidden in the demo, so it is shot from the working build in guest mode.
- Before a public launch: fill in credits. Licences are chosen (2026-10-06): code MIT, docs and guide CC0 1.0, x4-tls image GPL-2.0 via wolfSSL (see `LICENSING.md`). The owner kept the name "Journalwright Studio" and skipped a name check: add nothing about trademarks.

## Done
- **Monthly books** for Oct 2026 – Sep 2027, in 5.5×8.5 and 8.5×11 (74–86 pages each), with 0 overflow and no Type 3 fonts.
  - Busy days degrade instead of spilling: month cells and week rows cap at a few lines with "+N more". `node test-busy.mjs` (CI) checks it.
  - Front matter: key and icon key, care plan, quick contacts, month theme.
  - Each month: calendar, sky, tracker and moon pages, week spreads, day pages, weekly review, exchange pages.
  - Back matter: Looking back, Closing the month (points at the Keeper handoff page), Support, Trans support,
    Safety plan, STA buses (summary + hour grids, 4-page budget), Lineage.
  - Unify Spokane clinic box.
- **Profile** (`journal/content/profile.json`): names, branding, location, timezone, day start, trim and module switches live in
  one file; a generic `profile.example.json` builds a clean book (`node test-profile.mjs`, CI). The firmware keeps its own `DAY_STARTS_HOUR`; the pack carries the profile's value.
- **Content packs and onboarding (Phase F units 2 and 3, PK0 and PK1)**: `journal/packs/` holds the pack core (`pack.mjs`: pack.json schema 1, sha256 per file, engine range, licence; `kinds.mjs`: the kind registry, one entry per kind with its privacy class, validator and how the build uses it) and the packs: `generic` (two verified national lines and a placeholder) and `spokane-wa` (Shelbee's support, trans, clinic, STA feed and seasons, moved out of `content/`, `gtfs/`, `research/` and `spokane.mjs`). Every reader goes through `readContent()` / `packFile()` in `profile.mjs`; `epub.py` and `x4/tools/export_pack.py` ask `packs-cli.mjs resolve`. **The verification rule:** a support, trans or clinic item needs a `verified` note (who, date, source) or is a `placeholder`; `verified:false` + `checkBeforePrinting:true` prints with a warning (Shelbee's 7 unverified items from `docs/review/support-verification.md`); anything else stops the build. After editing a pack file run `node packs-cli.mjs seal <id>` (the STA workflow does). `npm run init` (`journal/init.mjs`) asks a few questions, writes the profile, builds a sample book; guides: `journal/GUIDE.md`, `journal/PACKS.md`. The Studio snapshot lists public packs by id + hash (`meta.packs`) and refuses personal ones. Tests: `test-packs.mjs` (CI), `studio/test/packs.test.mjs`. Not done: Credits page, the editor's Packs manager (PK5), look and block packs (PK2, PK3).
- **Keeper** (50 pages, no scan codes): accounts (hints only), where recovery codes are kept, contacts, monthly handoff spreads.
- **Day page editor**, layout v2, with 28 block types + 8 presets, in 5 groups:
  - From your day
  - Check-ins: care grid, spoons, checkboxes, scales, words to circle, sensory load, sleep times, blanks, weather and air
  - Writing: lined notes, small good things, two columns, top priorities, sketch box
  - Planning: time blocks, work shift, bus plan, spending, reach out
  - Layout: dividers, space

  How it works:
  - Drag from the palette onto the list or straight onto the page. Reorder, switch off, remove and undo.
  - Live preview at both sizes, with a writing-space meter.
  - Two builds: GitHub Pages (commits `content/daypage.json`) and a Claude Artifact.
- **X4 firmware:** compiles (RAM 53 KB, flash 1.47 MB), and every screen renders in the host preview.
  - Today on the sleep screen, with a 4:31 a.m. redraw (the day starts at 4 a.m.).
  - Button check-ins (spoons left, sleep, anxiety, care ticks) and month stats for the Keeper.
  - Hold Back for Support.
  - Wi-Fi hotspot page: set the clock, download books and logs, edit the safety plan, upload packs.
  - Books library on the SD card.
- **CI:** Books (encrypted when personal), Firmware (image + previews + tag releases), Editor (tests + Pages),
  STA schedules (monthly PR).

- **Library and Series in the editor (L1b, `journal/editor/library-ui.*`)**: two levels above the Book (Library shelves, Series), hash routes, breadcrumb, settings sheets, undo, guest storage (localStorage), Studio `meta.library` through the draft. Covers are the real title page. Details: `journal/README.md`, "Library and Series navigation". An exported `library.json` is the file `content/library.json` and `KW_LIBRARY` read.
- **Page organiser (C4, `journal/editor/organiser.*`, `journal/bookedit.mjs`, `journal/bookrules.mjs`)**: in the Book view's edit mode: reorder pages (drag, Alt+Left/Right, Move to…, the list), hide/show with the eye (Safety plan, Support and Closing the month are locked, with the reason), add/duplicate/retitle/remove Notes pages (built-in pages can only be hidden), give one month its own pages (`months` overrides, with Reset), see the page count and the KDP limits, and see what is automatic (alignment Notes, padding, numbers, pointers, codes). The canvas is laid out again live by `flowBook()` (proven equal to `assemble()` by `node test-organiser.mjs`); a change that would leave a `{{P_x}}` pointing at a missing page is warned about first and the book cannot be saved until fixed. Undo/redo, autosave (browser, Artifact store, Studio draft `book` part), `book.json` download, GitHub commit. Rules live in `bookrules.mjs` (shared with `validateBook`). Two pages may not print the same title (check-pages), so added Notes pages get their own. Details: `journal/README.md`, "Page organiser". Not yet: block-based editing of a page's content (C5), real per-month week structure in the sample (the sample is one month).
- **Block pages (C5a, `daypage.mjs` PAGE_KINDS/GRIDS/kindPage, `bookrules.mjs`, `bookedit.mjs` setLayout, `editor/template.html` PGE)**: Notes, blank and the new Collection page are made of the day page's blocks on their own fixed grids (Notes and Collection 4×24 under the fixed DATE/TITLE/TAGS header, blank 4×27 with no header); day-only blocks and `sendto` are not offered. An entry's `layout` in `book.json` holds it; none (or the starting layout) prints as before, so the default books are byte-identical. In the editor: Edit on the page view, "Edit blocks" in the Book's selected-page bar, or `#page/<id>/edit`; saved with the book. Tests: `node test-blockpages.mjs`, editor/test.mjs "Block pages". Not yet: `sendto` and per-page scan settings on these pages; month, week, review and back-matter pages as blocks (C5b). Details: `journal/README.md`, "Block pages".
- **Spread days (S1, `daypage.mjs` GRIDS.spread/half, `bookrules.mjs` dayFormat, `pages.mjs` days, `bookedit.mjs` setDayFormat, `editor/template.html` SPD)**: a day is one page or a whole spread. The `days` entry of `book.json` takes `format`, `weekdays` and `dates`; the spread layout is `spread` in `daypage.json` (8 x 24 canvas, fold after column 4, nothing crosses it). A spread day opens on a left page (Notes padding where needed); each page keeps its own header ("cont." on the right), frame, SEND TO strip and page code (ids `day.DATE` and `day.DATE.cont`). The organiser counts the pages and the KDP limits; the editor has a "This day covers" box and a two-page canvas; Studio snapshots carry `spread`. Default books byte-identical. Not done: a one-page day with a different layout, blocks across the fold, large-print rearrangement of a spread, a Guide chapter. Tests: `node test-spreaddays.mjs`, `studio/test/spread.test.mjs`. See journal/README.md and BUILD-PLAN section 12, "S1 as built".
- **Photo blocks (PH1, `journal/photo.mjs`, `daypage.mjs`, BUILD-PLAN section 23)**: `photoframe`, `photostrip`, `photodaily`, `contactsheet` (palette group Photos): true-size windows for prints glued onto the page, with corner marks inside the print's edge, a glue margin, caption lines, per-trim fit refusals, a gutter keep-out and the editor's does-not-fit note. Paper only: no upload, image, camera, Studio storage or X4. Test: `node test-photoblocks.mjs` (Books CI). **Unverified:** real glue, paper and spine behaviour and the marks' tone on KDP stock need a printed proof (PH3). Not done: ready-made photo pages (PH2), proof page (PH3), Guide chapter (PH4; left out because a chapter needs new screenshots through `make-guide-shots.mjs` and its selectors), month-aware photo a day on Notes pages (PH5). Questions for the owner: BUILD-PLAN 23.8.
- **Languages, editor half (I1, BUILD-PLAN section 18, `journal/i18n/`)**: the editor's words are in `i18n/en.json` (about 1,440 messages, keys by place), looked up with `_t()` from `i18n/i18n.mjs` (variables, plurals, English fallback), static HTML marked with `data-i18n*`, data-table words (block, option, care-row, method and scan names) looked up without changing the tables the print build reads. Pseudo-locales `en-XA` (accented, longer) and `ar-XB` (right to left) are made from en.json; open the editor with `?lang=en-XA`. English is byte-identical (110-state DOM snapshot before and after; default books unchanged, 24/24). `node test-i18n.mjs` (Books and Editor CI) and the pseudo-locale section of `editor/test.mjs` guard it; `i18n/print-strings.md` (generated, `node i18n/print-report.mjs`) lists the printed strings for I3. **Not done:** language switcher and a first real language (I2), `book.language` and printed strings in catalogs, fonts and RTL printing (I3), `Intl` dates, the words that come from shared code (`bookrules.mjs`, `bookedit.mjs`, `library.mjs` messages, page names), the website and guide, X4 language packs (I4).
- **Print accessibility (A11Y-40/41, `journal/a11yprint.mjs`)**: large print and high-contrast ink, off by default (default books byte-identical), set in `profile.json` `print` or the editor Settings panel (`daypage.json` `print`). Page types that cannot hold 1.4x type step down per type; the title page keeps today's type. Not done: dyslexia type, handedness, low clutter, Grid layouts are not auto-adjusted, Book view thumbnails not previewed. Test: `journal/test-a11y-print.mjs`. See journal/README.md.
- **Studio (Phase G1, `studio/`)**: Node + built-in SQLite + a small HTTP API. Local accounts, projects (private/public, `allowReuse`), roles,
  immutable content-hashed commits, snapshots as content-addressed objects, branches, per-user autosaved drafts, restore-as-new-commit,
  structured diff by page id and block uid, import from / export to `content/book.json` + `daypage.json` (byte-identical books), a scanner
  that keeps private data out of a snapshot, and the editor's **Versions** drawer (guests keep local versions in the browser; accounts use a server; public projects readable without an account). `cd studio && npm start`, `npm test`; see `studio/README.md`.
  **G2 (done):** forks (only where the creator allowed reuse; attribution kept; forbidden content never forked), change proposals with visual
  diffs, discussion, review status and accept-selected-changes, three-way merge by page/block id with explicit conflict kinds, and the
  Proposals view + conflict resolver in the Versions drawer. 
  **G3 (done, `studio/src/releases.mjs`):** immutable public-safe releases (manifest with file hashes; list/get/export) and a per-user library of reusable pages and block layouts inserted by copy with attribution and version links. Editor: Releases list in the Versions drawer. Left: release PDFs stored with the release, a library picker UI, an editor for the book structure, an image picker. Details: `studio/README.md`.

## Next, in order
1. **First CI run.** Push, add the secrets (SETUP.md) and get all four workflows green. Likely snags:
   - Playwright system deps
   - `pio` platform download
   - esptool `merge_bin` paths
   - Pages permissions
2. **STA feed** (now `journal/packs/spokane-wa/gtfs/`; the workflow reseals the pack). The books use a feed ending 2027-01-16, and spokanetransit.com/gtfs now serves a Sep 2026 upload.
   Run the STA schedules workflow and see whether its end date is later. Check that `GRID_PRIORITY` routes still exist, then rebuild.
3. **Editor follow-ups:**
   - a week-spread editor using the same block approach
   - per-month layouts (`content/daypage-2027-01.json` overriding the year default)
   - a guard in `render.mjs` that fails the build when a custom layout overflows, pointing at the block
   - a "print test page" button that renders one real day to PDF
3b. **Languages, next (BUILD-PLAN section 18):** I2 = language switcher (browser default, saved in the profile) and Spanish, French or German in the editor and website, which starts by moving the shared-code words (rule messages, page names, `Intl` dates) into the catalog. Ask Shelbee which language first.
4. **X4 hardware bring-up** (x4/CLAUDE.md "Open work"):
   - buttons and holds
   - refresh quality
   - deep-sleep current
   - timer-wake drift over a few nights
   - web upload speed
   - after that: dual boot with CrossPoint and a Closing-the-month walkthrough
4b. **N2 sync (built, unverified on hardware):** `x4-tls` image, Wi-Fi > Sync with Studio, `studio/` device tokens. Needs a first real run: flash `x4-tls`, add a device, copy `sync.txt` and `studio-ca.pem`, Send; read the serial `[mem]` lines. Left: short-code pairing, a Studio devices screen, down-sync (N3).
5. **X4 ↔ editor:** optionally let custom Checkboxes/Scale blocks become X4 check-in items. Ask Shelbee first.
6. **Each edition:** re-check the phone numbers in `journal/packs/spokane-wa/` (`support.json`, `trans.json`, `clinic.json`): the 7 items flagged `checkBeforePrinting` first (call, then give each a `verified` note), then reseal (`node packs-cli.mjs seal spokane-wa`).
   Refresh the 2027 pay periods once they're confirmed. Order one KDP proof per size before buying copies.

## Decisions (don't undo without asking)
- **Licences (2026-10-06):** code MIT (`LICENSE`, holder "Shelbee and Journalwright Studio contributors"); CC0 1.0 only for `docs/journaling/methods/` (legal code in `docs/journaling/methods/LICENSE`), the /docs/ and /guide/ pages and their source, and the CONTRIBUTING docs rules; BUILD-PLAN.md, docs/review/ and other notes are all rights reserved unless a file says otherwise; the x4-tls build is GPL-2.0 as a whole (wolfSSL), glue source stays MIT; each pack.json declares its own licence; docs front matter carries `licence: CC0-1.0` and the doc lint requires it. Site text says "Journalwright Studio contributors", never the owner's name (the privacy gate would fail). `LICENSE` is at the repo root and is not published to the site.
- **Art journal (BUILD-PLAN 22.7, answered 2026-10-06):** both a day-book layer and a practice book, practice book first; black and white; self-ticked "I can" ladders, no gates; no streaks (totals and weeks with a touch); strands: contour, value, composition, perspective, colour, figure, lettering; page behind a dense drawing page stays light (confirm on the proof); guide floor 10 percent black and 0.75 pt (subject to the KDP proof); X4 timer redraws once a minute in v1; reference images paper only (user-loaded X4 reference is LATER and needs a firmware-scope review); scanned sketches physical only (Studio-held scans are LATER and need a privacy plan first); an agent drafts prompts and paths, the owner reviews before merge, all original or openly licensed; name "Drawing practice".
- **Paperback first**, hardcover later (`HARDCOVER=1` pads to 76+). No tear-out pages: KDP can't perforate.
- **Two books:** the monthly book goes out with her, and the Keeper stays home (monthly handoff = the dual system).
- **Day page care row:** "Did something I enjoy" replaced "Went outside", because she's outside daily for work.
- **The care split (approved 2026-09-28, built in the `claude/care-split` PR):** paper = meds, meals, water, mood (dots numbered −3…+3,
  middle marked), work shift, routines, events, writing, safety plan (source of truth). X4 = spoons *left*, sleep, anxiety, shower, teeth,
  joy, texted, snack; custom check-ins on both. The day page's default layout changed on purpose (see the PR). The six month-end boxes
  (Avg mood, Meds taken, Avg meals, Work hours from the paper tracker; Avg sleep, Good-spoon days from X4 This month) are defined once in
  `journal/handoff.mjs` and printed identically on the Closing page and the Keeper. Old X4 logs keep their keys and still read.
- **Firmware** holds the battery latch through deep sleep. That means weeks per charge rather than months, in exchange
  for keeping the clock and the midnight redraw.
