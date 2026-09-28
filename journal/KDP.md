# Getting the books onto KDP

Paperback first, hardcover later. Every book stays a **private draft**: you order proofs, you never publish.
The monthly books print your calendar. The Keeper holds password hints and where recovery codes are kept (never the codes themselves).

## 1. Build and check

    cd journal
    ICS=private/main.ics,private/birthdays.ics MONTHS=2026-10 ./build-all.sh   # one month, both sizes, + the Keeper

Or one piece at a time (each cover reads its interior's page count: `pages.txt`, or `pages-hardcover.txt` for hardcover):

    node render.mjs month 2026-10 private/main.ics,private/birthdays.ics && node cover.mjs month 2026-10
    SIZE=letter node render.mjs month 2026-10 private/main.ics,private/birthdays.ics && SIZE=letter node cover.mjs month 2026-10
    node keeper.mjs && node cover.mjs keeper

From CI: Actions → **Books** → latest run → `keeping-watch-books.7z` (password protected). See `SETUP.md`.

## 2. Which file goes where

| Book | KDP trim | Interior (Manuscript) | Cover |
| --- | --- | --- | --- |
| Monthly, small | 5.5 × 8.5 in | `out/m2026-10/keeping-watch-2026-10-interior-5.5x8.5.pdf` | `out/m2026-10/keeping-watch-2026-10-cover.pdf` |
| Monthly, big | 8.5 × 11 in | `out/m2026-10-letter/keeping-watch-2026-10-interior-8.5x11.pdf` | `out/m2026-10-letter/keeping-watch-2026-10-8.5x11-cover.pdf` |
| Keeper | 5.5 × 8.5 in | `out/keeper/keeper-interior-5.5x8.5.pdf` | `out/keeper/keeping-watch-keeper-cover.pdf` |

Swap `2026-10` for the month. One KDP title per book and size.

## 3. Check before you upload

| Check | Command | Pass |
| --- | --- | --- |
| No overflow | `node check.mjs m2026-10` (and `m2026-10-letter`) | prints `[] 0` |
| No Type 3 fonts | `pdffonts <file>.pdf \| grep "Type 3"` | no output |
| Page count | `pdfinfo <interior>.pdf \| grep Pages` | even; paperback 24–110 (project rule), hardcover 75+ |
| Cover width | `pdfinfo <cover>.pdf \| grep "Page size"` | width ÷ 72 = 2 × trim width + 0.25 + pages × 0.002252 |
| Cover height | same | height ÷ 72 = trim height + 0.25 |

Example, October sample (80 pages): spine 80 × 0.002252 = 0.180 in.
Small cover 2 × 5.5 + 0.25 + 0.180 = **11.43 × 8.75 in** (822.96 × 630 pt).
Big cover 2 × 8.5 + 0.25 + 0.180 = **17.43 × 11.25 in**. The build prints these sizes too.

Double-check the spine in KDP's [cover calculator](https://kdp.amazon.com/cover-calculator)
(paperback, black & white, white paper, your trim, your page count). Download its template if anything looks off.

## 4. Paperback: create the draft

1. [kdp.amazon.com](https://kdp.amazon.com) → **Bookshelf** → **+ Create** → **Paperback**.
2. **Details**: language, title (e.g. *Keeping Watch: October 2026*), author, description, keywords, categories.
   None of this is public while it's a draft.
3. **Content** → ISBN: **Get a free KDP ISBN**. It's tied to this title; it doesn't publish anything.
4. **Print options**:

   | Setting | Pick |
   | --- | --- |
   | Ink and paper | **Black & white interior with white paper** (the spine formula assumes this) |
   | Trim size | **5.5 × 8.5 in** or **8.5 × 11 in** (Keeper: 5.5 × 8.5) |
   | Bleed | **No bleed** (the interior has white margins; nothing prints to the edge) |
   | Cover finish | Matte or glossy: your call |

5. **Manuscript**: upload the interior PDF.
6. **Book cover**: **Upload a cover you already have (print-ready PDF only)** → the cover PDF.
   It's one PDF: back + spine + front, with 0.125 in bleed on every outside edge.
7. **Launch Previewer**. Look at every page. Then **Approve**. Warnings about margins mean something moved: stop and fix.
8. **Pricing tab: stop here.** Don't click **Publish Your Paperback Book**. Click **Save as Draft**.

## 5. Order private proofs

1. **Bookshelf** → the draft's **…** menu → **Request printed proofs**.
2. Pick quantity (up to 5 per request) and marketplace (amazon.com).
3. KDP emails a checkout link within about 4 hours. Pay within 24 hours or it drops out of the cart.

Proofs print **"Not for Resale"** and carry a proof barcode instead of the ISBN. Nobody else can buy or see them.
Order one proof per size before buying more (see `HANDOFF.md`).

**Keep the manifest with each proof.** `out/<book>/manifest.json` (in the Books workflow artifact next to the PDF) maps every printed page code to its page id, section and zones, and records the build. A printed book decodes through the manifest of the build it came from, even after the layout changes.

**Never publish these books.** A live listing would sell your calendar to anyone. The Keeper is the same: draft
and proof only. It has no scan codes, and it never should.

## 6. Hardcover (later)

KDP hardcover is a case laminate: printed cover on 2 mm board, matte or glossy.

| | Paperback | Hardcover |
| --- | --- | --- |
| 5.5 × 8.5 in | yes | **yes** |
| 8.5 × 11 in | yes | **no** (KDP's big hardcover is 8.25 × 11) |
| Pages (B&W, white) | 24–828 (5.5×8.5), 24–590 (8.5×11) | 75–550 (the cover calculator starts at 76) |

So hardcover is the **small book only**. `cover.mjs` stops with an error for any other trim.
The Keeper stays paperback.

Build with `HARDCOVER=1` on **both** the interior and the cover (the interior pads to an even 76+ pages with Notes pages):

    HARDCOVER=1 node render.mjs month 2026-10 private/main.ics,private/birthdays.ics
    HARDCOVER=1 node cover.mjs month 2026-10
    node check.mjs m2026-10

or `HARDCOVER=1 SIZES=small ./build-all.sh`.

| Upload | File |
| --- | --- |
| Interior | `out/m2026-10/keeping-watch-2026-10-interior-hardcover-5.5x8.5.pdf` |
| Cover | `out/m2026-10/keeping-watch-2026-10-hardcover-cover.pdf` |

The hardcover files sit in the same folder as the paperback ones. Each keeps its own page count (`pages.txt` and
`pages-hardcover.txt`), so you can build them in any order.

The hardcover cover isn't the paperback cover: it wraps 0.591 in (15 mm) around the board and has a 0.394 in
(10 mm) hinge beside the spine. (KDP's help page prints the wrap as "0.51", but its calculator uses 15 mm.) Check its size in the [cover calculator](https://kdp.amazon.com/cover-calculator) set to **Hardcover**.

KDP steps: **+ Create** → **Hardcover**, then the same as the paperback (own free ISBN, B&W white, 5.5 × 8.5, no bleed,
upload, Previewer, **Save as Draft**, **Request printed proofs**). Never publish.

## 7. KDP rules this project follows

- No tear-out pages: KDP can't perforate.
- Spine text only at 79+ pages. `cover.mjs` adds spine text only when the spine is 0.25 in or wider (111+ pages).
- Spine text keeps 0.0625 in clear of each spine edge.
- KDP puts its barcode (2 × 1.2 in) at the bottom right of the back cover. Keep that corner clear.
- No-bleed margins: outside, top and bottom ≥ 0.25 in; inside ≥ 0.375 in (24–150 pages).
  Monthly books use 0.3 in outside and 0.5 in inside (×1.294 on the big book). The Keeper uses 0.45 in and 0.6 in.

## 8. Print weights and the proof test sheet

KDP asks for lines of at least **0.75 pt (0.01 in, 0.3 mm)** and, for grey backgrounds on black-ink books, a fill of
at least **10%**. It says nothing about dots, so those are judged on a proof. Rulings are drawn by `drawRulings()`
(`rulings.mjs`, SPECS table); the screen CSS in `daypage.mjs` / `render.mjs` mirrors it.

| Ruling | Before | Now |
| --- | --- | --- |
| Body lines, block lines, writing lines, priority/bullet rules | 0.75 pt, `#999` (40%) | **1 pt**, `#a0a0a0` (37%) (the print build draws these as vectors, because Chromium snaps a CSS `1pt` border down to 0.75 pt) |
| 4 mm grid | 0.28 pt dashes 0.2/0.3 mm, `#d6d6d6` (16%) | **0.75 pt** dashes 0.6/0.4 mm, `#c8c8c8` (22%) |
| Body dot grid (5.6 mm) | 0.6 mm dot, `#999` | **0.71 mm** dot, `#808080` (50%) |
| Month dots (5 mm) | 0.6 mm dot, `#dcdcdc` (14%) | **0.8 mm** dot, `#c8c8c8` (22%) |
| Small dots (4.3 mm) | 0.5 mm dot, `#555` | **0.7 mm** dot, `#606060` |
| Genko cross guide | 0.5 px `#ddd` | 1 px (0.75 pt) `#ccc` |

Lines stay a quiet mid-grey, so they read as guides, not ink. Other 1 px borders (tables, boxes) are exactly
0.75 pt and stay as they are.

**8.5 x 11.** The page is laid out at 6.57 x 8.5 in and zoomed 1.294x, so every weight scales with it: 0.75 pt
becomes 0.97 pt, 1 pt becomes 1.29 pt, a 0.71 mm dot becomes 0.92 mm. Greys don't change. All weights stay at or
above the minimum on both sizes.

**Proof test sheet.** `node proof-test.mjs` (also run by `build-all.sh`) writes
`out/proof/keeping-watch-proof-test-5.5x8.5.pdf` and `...-8.5x11.pdf`: one sheet, two pages (front and back).
Front: every ruling at its real weight, a line-weight ladder (0.25 to 1.5 pt), grey tones, dot sizes and tones, grid
weights. Back: pen test areas (fine liner, ballpoint, gel, pencil), a 5 cm / 1 in ruler and a 5 mm / 1 in square to
check scale, the page code at real size (scan it: it reads `KW2|T|TEST|S001`), and a dashed line at KDP's minimum margin.
The black frame and code strip sit where they do in the books. It has no calendar data.

It is not a book (KDP needs 24+ pages), so **order it with the first proof**: append it to the proof manuscript with
`pdfunite <interior>.pdf out/proof/keeping-watch-proof-test-5.5x8.5.pdf proof-manuscript.pdf` and upload that to the
private draft (proof only; never the published manuscript). The page count stays even. On the proof, check: dashes
and dots even and unbroken, 1 pt lines solid, 0.25 pt line missing or broken (expected), pens don't feather, ruler
reads true (1 in = 25.4 mm; on 8.5 x 11 the 1 in square is 1.294 in), nothing crosses the dashed margin line, the
code scans. If dots vanish or the grid breaks up, raise the tone one step (or the dot size to 0.8 mm) and re-proof.

## Sources (checked 2026-09-28)

- Trim sizes, page counts, margins: https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6
- Print options (ink, paper, finish, hardcover sizes): https://kdp.amazon.com/en_US/help/topic/G201834180
- Paperback submission guidelines (line weight 0.75 pt, grey fill 10%): https://kdp.amazon.com/en_US/help/topic/G201857950
- Paperback cover (spine formula, bleed, spine text): https://kdp.amazon.com/en_US/help/topic/G201953020
- Hardcover cover (wrap, hinge, safe area): https://kdp.amazon.com/en_US/help/topic/GDTKFJPNQCBTMRV6
- Hardcover build (case laminate): https://kdp.amazon.com/en_US/help/topic/GKZVNAAFYWVKZWL8
- Proof copies: https://kdp.amazon.com/en_US/help/topic/G7BBN68RYX5UMDZF
- Ordering proofs: https://kdp.amazon.com/en_US/help/topic/GVEG4YA9G2T7N6DR
- Cover calculator: https://kdp.amazon.com/cover-calculator
