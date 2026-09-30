# Make your own journal

From a fresh clone to your first PDF in about ten minutes, then how to make it yours. Nothing in this guide needs an account, and nothing
leaves your computer.

## 1. Ten minutes to a first PDF

You need Node 20 or newer (22 is what CI uses), Python 3 with `pillow`, and Chromium.

    git clone <this repository> && cd Journaling/journal
    npm ci && npx playwright-core install chromium && pip install pillow
    npm run init

`npm run init` asks a few questions (every one has a default: press Enter to take it):

| Question | What it changes |
| --- | --- |
| Name, book title, subtitle | The title page, cover, spine, file names |
| Where you are (a city from a short list, or type a place, latitude, longitude, time zone) | Sunrise and sunset, the moon, the seasons, the time zone on every clock time |
| The hour your day starts | Where the paper day begins (5 means 2 a.m. still belongs to yesterday) |
| Trim: small (5.5x8.5) or letter (8.5x11) | The page size |
| Modules | The moon and sky pages, spoons, therapy blocks, and (if your pack has them) trans support and bus pages |
| Content pack | The Support page. `generic` is the start; see section 4 |
| Book scope and first month | One month per book, a quarter, a season, half a year, a year, your own dates, or an undated book |

It writes `content/profile.json` (it never overwrites one without asking), makes your **book id** (8 characters that keep your scan codes
apart from every other book), builds a sample book from `test.ics`, runs the overflow check on it and tells you where the PDF is. The sample
uses a made-up calendar. Open it: every page is the same shape as your real one will be.

Without a keyboard (a script, a scratch folder), every question is a flag:

    npm run init -- --yes --name Sam --title "Northlight" --city chicago --modules sky,spoons --scope month --start 2026-10
    node init.mjs --help          # all flags; --city list shows the built-in places

`content/profile.json` holds your name and place. If your copy of the repository is public, add it to `.gitignore` (and run
`git rm --cached journal/content/profile.json` if git already tracks it). Calendars in `private/` are ignored already.

## 2. Your calendar

Export your calendars as `.ics` files into `journal/private/` (git-ignored; never commit or upload them unencrypted), then:

    node render.mjs month 2026-10 private/main.ics,private/birthdays.ics     # one month
    ICS=private/main.ics,private/birthdays.ics ./build-all.sh                 # every month, covers, EPUBs, all the checks

For a book that is not one calendar month: `node render.mjs plan private/main.ics` shows how your scope is cut into volumes and page counts;
`node render.mjs book private/main.ics` builds them. Every build ends with the overflow check (`[] 0` means every page fits); a page
that does not fit stops the build and names the block.

## 3. Make it yours

- **The day page.** Open the editor (`node editor/build.mjs`, then `editor/dist/site/index.html`). Drag blocks from the palette, reorder, switch off, see a
  live preview at both trims. It saves `content/daypage.json`; the default layout is used until you save one. The editor also has the whole-book
  canvas (which pages, in which order) and, above it, a library for several books and series.
- **Modules.** `modules` in the profile switch whole areas on and off. A module that is off leaves its pages out and every reference to them too.
- **Scan codes.** Each page carries a small code that says which book and page it is, so a scan can be filed by page. The frame, the header boxes
  and the code are fixed; the editor's Scan settings move, resize or hide the code, or turn the border off.
- **Covers.** The cover and the spine come from your title and page count (`node cover.mjs month 2026-10`; the library sets a style per book).
- **Your own prompts, facts and words.** `content/year.mjs` and friends hold the weekly prompts, daily facts and seasonal words. They ship in English.
- **More pages.** The block library is one file, `daypage.mjs`; page types are `pages.mjs`. Each block lists the research it comes from in `docs/journaling/methods/`.

Everything else the profile can say is in the Profile section of [README.md](README.md).

## 4. Support pages, and numbers you can trust

The Support and safety pages are the part of a journal you most need to be right. So:

- The engine never fills in a phone number for you. `packs/generic` has two United States lines (988, and the Crisis Text Line) with a dated
  source each, and a placeholder that prints **"Add your local numbers here"**.
- To add your own, make a content pack: `node packs-cli.mjs new support mine`, write your numbers, and give each one a verification note
  (who checked, when, against which organisation's own page). The build refuses to print an item without one. Details: [PACKS.md](PACKS.md).
- Re-check every number before each print run. Numbers and hours change. The pack records the date you last checked.
- The safety plan page has its own two lines (`crisis.lines` in the profile). They are United States lines by default: change them if you are elsewhere.

## 5. Printing on Amazon KDP

[KDP.md](KDP.md) has the full walk-through (covers, spine, proofs, hardcover). What matters when you make your own:

- **Trims are 5.5x8.5 and 8.5x11.** (A5 is not offered on KDP in the US.) Paperback interiors are 24 to 110 pages; a hardcover needs 76 or more.
- **Scan codes are per design, not per copy.** Every copy printed from one upload carries the same codes, and that is the point: a code says
  "book 3, page 41", not "copy 12". Two different books never share a code because your book id is part of it. Change the design (a new edition)
  and the edition digit changes every code.
- **Volumes are one upload each.** When your scope is longer than a printable book, the build splits it into the fewest volumes that fit,
  and each volume is its own KDP title with its own interior, cover and proof. `node render.mjs plan` tells you how many before you print.
- **Undated books need no yearly re-upload.** An undated book (day 1, day 2, ...) carries no dates, sun times or calendar events, so
  it never goes out of date: upload it once and reprint it. A dated book is for one year and needs the new edition (NEW-EDITION.md) next year.
- **No Type 3 fonts, and lines of at least 0.75 pt.** The build and CI check both; print one proof per trim before you order copies.
- Keep the **manifest** (`out/<book>/manifest.json`) with every proof and print run: it maps each printed code back to its page, and records
  which content packs and versions the book used.

## 6. Stay current

- `git pull` brings engine changes. `node test-packs.mjs && node test-profile.mjs` tell you your packs and profile still work.
- Before each print run: re-check support numbers, refresh a transit feed if you use one, order a proof.
- Your work can be versioned and shared through the Studio (`studio/README.md`). Personal content (your calendar, your location,
  support and contact packs) never goes into a shared project; a public pack is listed by name and hash only.
