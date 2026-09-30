# Journalwright Studio

Design and publish physical journals and planners.

- **Book canvas.** Open on the whole book, then zoom to a spread and to a single day. Every page is where it prints.
- **Block editor.** At the day level, arrange the page from building blocks (check-ins, notes, time blocks, scales, sketch boxes) at print size.
- **Print-ready PDFs.** Interiors and covers for Amazon KDP (5.5×8.5 and 8.5×11), with an overflow check on every page and no Type 3 fonts.
- **Optional e-ink companion.** Firmware for the Xteink X4 shows today, takes button check-ins and stays offline.

The first book made with it is Shelbee's year-long journal, *Keeping Watch* (Oct 2026 to Sep 2027). Her book is one profile and one set
of content packs; the studio itself holds nothing personal.

No account is needed to design and print: your work saves in your browser, and you can export it, import it and build PDFs locally.

Website, live editor demo (`/editor/`, sample data only) and docs (`/docs/`): published to GitHub Pages by the Editor workflow, source in [`site/`](site/).

Versions, branches and history for a book (accounts optional): [studio/README.md](studio/README.md). Guests keep versions in the browser; nothing needs a server.

## Quick start

Needs Node 20+ (22 in CI), Python 3 with pillow, and Chromium.

    cd journal && npm ci && npx playwright-core install chromium && pip install pillow

A generic sample book from `profile.example.json` and the sample calendar `test.ics` (one month, about 70 pages, into `journal/out-sample/`):

    KW_PROFILE=content/profile.example.json KW_OUT=out-sample node render.mjs month 2026-10 test.ics

The editor, built from the same sample (open `journal/editor/dist/site/index.html`):

    KW_PROFILE=content/profile.example.json KW_OUT=out-sample node editor/build.mjs

To make your own, run `cd journal && npm run init` (asks a few questions, writes `content/profile.json`, builds a sample book): [journal/GUIDE.md](journal/GUIDE.md).
By hand: copy `journal/content/profile.example.json` to `journal/content/profile.json` and edit it
([journal/README.md](journal/README.md#profile-contentprofilejson) lists every field). The committed `profile.json` is Shelbee's.

## Map

| Path | What is there |
| --- | --- |
| `journal/` | The engine: renderer (`render.mjs`), day page block library (`daypage.mjs`), Keeper, covers, EPUBs, checks, `build-all.sh` |
| `journal/editor/` | The block editor and book canvas. Builds three things: the working site (saves in the browser, commits with a token), a Claude Artifact, and the public demo |
| `journal/content/` | The profile, content packs (support, clinic, trans, seasons), the book plan and method layouts |
| `x4/` | ESP32-C3 firmware for the X4, a host preview, and the SD-card tools |
| `site/` | The product website: plain HTML, CSS and JS, sample page images, a docs builder and a link checker |
| `docs/journaling/` | [BUILD-PLAN.md](docs/journaling/BUILD-PLAN.md) and the [methods library](docs/journaling/methods/) (44 docs) |
| `.github/workflows/` | CI: books, firmware, editor and site (GitHub Pages), STA schedules |

## How it fits together: three layers

| Layer | Holds | Changes when |
| --- | --- | --- |
| **Engine** | Renderer, block library, editor, checks, firmware. Nothing personal | The product improves |
| **Profile** | `content/profile.json`: name, book title, edition, place, time zone, day start, trim, module switches, and which content packs to use | You make a new book |
| **Content packs** | Regional support lists, clinic and crisis pages, seasons, optional transit feeds, as data | You move, or a phone number changes |

Crisis and support numbers are never filled in for someone else. The `generic` pack ships two verified national lines and a placeholder; a pack of your own needs a dated source for every number ([journal/PACKS.md](journal/PACKS.md)).

## Docs

- [Methods library](docs/journaling/methods/): 44 short research docs (bullet journal, time blocking, spoon theory, safety planning and more). Every block comes from these.
- [BUILD-PLAN.md](docs/journaling/BUILD-PLAN.md): the plan and the reasoning, phase by phase.
- [journal/README.md](journal/README.md): building books, settings, profile fields, KDP notes.
- [x4/README.md](x4/README.md): the e-ink companion, its screens and the Wi-Fi page.
- [SETUP.md](SETUP.md): repository, secrets, Pages and the first CI run.
- [HANDOFF.md](HANDOFF.md): what is done, what is next, and Shelbee's own build.
- [CLAUDE.md](CLAUDE.md): rules for working on this repo with Claude Code.

## Privacy

- Calendars are never committed and never uploaded unencrypted. Personal builds leave CI only inside a password-protected archive.
- The site, the editor demo, the sample pages and the X4 sample card use generic sample data only.
- KDP proofs stay private. The Keeper holds password hints, never recovery codes, and never gets scan codes.
- The X4 sends nothing anywhere except over its own hotspot.

## Roadmap

| Area | Status |
| --- | --- |
| Block editor, book canvas, KDP output, profiles | Ready |
| Content packs (support, clinic, transit, holidays, seasons as data with a verification note), `npm run init`, guides | Ready |
| Onboarding: `npm run init`, guides for your own journal and your own pack | Next |
| Book scopes (quarter, season, year, undated) and automatic volumes past 110 pages | Coming |
| Versioning: history, branches, forks, change proposals, releases | Coming |
| Accounts, only for saving versions and sharing (designing and printing stay free of one) | Coming |
| X4 hardware bring-up | In progress |

Details and order: [BUILD-PLAN.md](docs/journaling/BUILD-PLAN.md).

## License and credits

License: to be chosen before the first public release. Credits: to be added (research sources are listed in the methods docs;
X4 firmware builds on the FreeInk SDK).
