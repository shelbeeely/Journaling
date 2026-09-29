# Keeping Watch: context for Claude Code

Shelbee's year-long journaling system. Read README.md, then HANDOFF.md (status + backlog), then the folder you touch
(`journal/README.md`, `x4/CLAUDE.md`).

## How Shelbee works
- Concise, scannable replies; offer choices as short options. Direct feedback, no softening.
- Iterative: ship a working version, then improve. Ask before adding features (see Scope).
- Never use Grokipedia as a source. Don't default to Cloudflare for hosting or infra suggestions.

## Layout
- `journal/render.mjs`: builds one monthly book (`month YYYY-MM a.ics,b.ics`; `SIZE=letter`; `HARDCOVER=1`).
  `keeper.mjs` builds the Keeper, `cover.mjs` builds covers, `epub.py` builds X4 EPUBs, and `check.mjs` is the overflow gate.
  `build-all.sh` runs everything.
- `journal/content/profile.json` (+ `profile.mjs`): who and where: names, branding, location, timezone, day start, trim, module
  switches, content paths. Nothing personal lives in code; `profile.example.json` is the generic one. `test-profile.mjs` guards it.
- `journal/daypage.mjs`: the day page **block library**. One source of truth for print and the editor preview.
  Layout v2 = ordered `{uid, type, on, ...options}`; `TYPES` declares each block's options (num/bool/choice/flags/text/list).
  `content/daypage.json` (from the editor) overrides `DEFAULT_LAYOUT`, which reproduces the original page exactly.
- `journal/editor/`: `template.html` + `build.mjs` produce `dist/site/` (GitHub Pages: saves in the browser, commits
  via a fine-grained token) and `dist/artifact.html` (Claude Artifact: saves to the artifact store `layouts/day`).
  `test.mjs` is the smoke test CI runs.
- `studio/`: Journalwright Studio (Phase G): Node + SQLite + HTTP API for projects, commits, branches, drafts, import/export of
  `content/book.json` and `daypage.json`. `npm start`, `npm test`; the editor's Versions drawer talks to it. Never put private pages,
  calendars, profile secrets or packs into a snapshot (`studio/src/snapshot.mjs` refuses them). See `studio/README.md`.
- `x4/`: ESP32-C3 firmware on the FreeInk SDK (pinned in `.github/workflows/firmware.yml`). See `x4/CLAUDE.md`.

## Rules that matter
- **Privacy.** Calendars (`journal/private/*.ics`, `ICS_URLS` secret) never get committed or uploaded unencrypted.
  - Personal book builds leave CI only inside the password 7z.
  - KDP proofs stay private: never a public listing.
  - The Keeper holds password hints and where recovery codes are kept (never the codes), so it never gets scan codes.
  - The editor and the X4 sample card use generic sample data only (`test.ics`).
- **KDP.**
  - Trims are 5.5×8.5 and 8.5×11 (A5 isn't offered on KDP US).
  - No Type 3 fonts: emoji and odd glyphs become SVG, and CI checks with `pdffonts`.
  - Paperback 24–110 pages; hardcover needs 75+ pages.
  - Every page must pass `check.mjs` ("[] 0").
- **Scan zones.** The DATE/TITLE/TAGS header, the 9pt frame, the SEND TO strip and the Data Matrix page code are fixed.
  Every block needs a `data-zone` so `layout.json` maps it (repeats get `_2`, `_3`).
- **Design.** Calm and low-stimulation. Icons over words, generous space, no busy ornament. Mobile-first, accessible
  (44px targets, labels, light and dark mode), no sideways scroll at 390px.
- **Default layout must not drift.** After touching `daypage.mjs` or the render CSS, diff the day pages of a default
  build against the previous build. Only intentional changes are allowed.
- **Firmware scope.** No generative AI, no notifications, feeds or badges. Nothing leaves the device except over its own hotspot.

## Verify before you say it's done
    cd journal && ./build-all.sh                    # or MONTHS=2026-10 SIZES=small ./build-all.sh while iterating
    node render.mjs month 2026-10 test.ics && node editor/build.mjs && node editor/test.mjs
    cd ../x4/host && ./preview.sh && cd .. && pio run -e x4     # firmware must stay [SUCCESS]
Look at the PNGs and screenshots you produce. Don't claim a visual change works without looking.
