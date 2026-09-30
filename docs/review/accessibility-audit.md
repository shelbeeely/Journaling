# Accessibility audit (BUILD-PLAN section 15)

Audited 2026-09-29 against `main` at d492bb3, then re-checked after C4a (book-first navigation, #78) merged: the editor now opens on the Book, the Day editor is `#day/<date>`, and there is a read-only Page view (`#page/<id>`). Floor: WCAG 2.2 AA, plus the project rules (44 px targets, calm, light and dark).
WCAG links are the W3C "Understanding" pages under https://www.w3.org/WAI/WCAG22/Understanding/ (slug in brackets).

**What was checked:** the editor (Day, Grid, Book view, Versions drawer, dialogs, More menu; the working editor, the public demo and the Artifact build), the product site, the printed-book type and rule settings that exist today, and the X4 screens and its hotspot web page.
**How:** axe-core 4.13 through Playwright (WCAG 2.0 to 2.2 A/AA + best practice), my own checks (names, contrast of the theme tokens in light, dark and high contrast, target sizes, reflow at 320 and 390 px, focus indicator and focus obscured, reduced motion, forced colors, keyboard-only tasks), a markup review, and looking at screenshots (desktop, 390, 320, forced colors, high contrast).
**Not checked:** a real screen reader (NVDA, VoiceOver, TalkBack), Safari and Firefox, the Claude Artifact host's own page chrome, a physical X4. Treat the screen-reader findings as markup-based until someone listens to them.

## Summary

The editor and the site were already in good shape on structure (labels, `aria-pressed`, native dialogs, live regions, keyboard grid, no sideways scroll). The real gaps were: reordering blocks in Flow mode was drag-only, several contrast and target-size misses, no skip link, and no reduced-motion or forced-colors care. This PR fixes those. What is left is mostly the navigation rewrite (C4a), text size that follows the user's settings, announcements for Grid and Book, print low-vision options, and the X4.

| Area | Findings | Fixed in this PR | Open |
|---|---|---|---|
| Editor (Day, Grid, Book, Versions, demo, Artifact) | 22 | 15 | 7 |
| Product site | 4 | 2 | 2 (info) |
| Printed books | 4 | 0 | 4 |
| X4 (device UI and hotspot page) | 6 | 0 | 6 |

Severity: **High** blocks a task for some users, **Medium** makes it hard, **Low** is friction. Status: **Fixed** (guarded by `journal/editor/test-a11y.mjs`), **Open**, **Info**.

## Findings

### Editor

| ID | Sev | Status | Finding | Where | Reproduce | Fix / proposed fix | WCAG |
|---|---|---|---|---|---|---|---|
| A11Y-01 | High | Fixed | Reordering blocks in Flow mode was drag-only. The handle was a `span`, not focusable, and there was no move-up/down alternative. | `template.html` list rows (`.grip`), care rows | Tab through the block list: the handle never gets focus | Handle is now `role=button tabindex=0`; Up/Down arrows move the block (or care row) one place, focus stays on it, and "X moved to position 2 of 12" goes to a live region. Same for care sub-rows. Grid mode already had arrow keys. | 2.1.1 [keyboard], 2.5.7 [dragging-movements] |
| A11Y-02 | Medium | Fixed | `aria-label="Drag to reorder"` on a bare `span` (axe `aria-prohibited-attr`, 17 nodes); the label was ignored by screen readers and did not say which block. | same | axe on the Day view | Real role, and a label that names the block ("Move Events. Up and Down arrow keys reorder it.") | 4.1.2 [name-role-value] |
| A11Y-03 | High | Fixed | Focus ring in the light theme was 2.5:1 on the page and 2.7:1 on cards. | `--focus: #7aa39b` | Contrast of the token | `--focus: #3f5f5a` (6.2:1). Dark was already 8:1. | 2.4.7 [focus-visible], 1.4.11 [non-text-contrast] |
| A11Y-04 | Medium | Fixed | Targets under 44 px: the palette "+" (30 px, 74 of them), delete/options (34), switches (44 x 26), option chips (32), steppers (36 x 32), text inputs (36), top-bar buttons (36), tabs. All pass WCAG's 24 px but break the project rule. | `.add`, `.icon-btn`, `.sw`, `.chip`, `.step`, inputs, `.btn` | `test-a11y.mjs`, target check | All 44 px minimum. Switch keeps its look (track drawn with `::before`). On phones the row wraps so the name sits under the controls. | 2.5.8 [target-size-minimum]; 2.5.5 [target-size-enhanced] is the 44 px rule |
| A11Y-05 | Medium | Fixed | "Used" palette items were dimmed with `opacity: .5`: text at 3.2:1 (light) and 4.4:1 (dark). | `li.pi.used` | axe `color-contrast`, 8 nodes | Full-opacity muted text, dashed border, "on page" label | 1.4.3 [contrast-minimum] |
| A11Y-06 | Medium | Fixed | Text fields and the off-state of switches had a 1.3:1 border/track, so the control's edge was invisible. | `--line` used as control border | contrast of `--line` on `--bg` | New `--ctl` token (3.6:1 light, 4.1:1 dark) for input borders and switch tracks | 1.4.11 [non-text-contrast] |
| A11Y-07 | Low | Fixed | Book view had no `main` landmark (the Day `main` is hidden there). | `#book` | axe `landmark-one-main` in Book view | `role=main` on `#book` (one visible main at a time) | 1.3.1 [info-and-relationships], 2.4.1 [bypass-blocks] |
| A11Y-08 | Medium | Fixed (part) | 74 palette buttons come before the first block in Tab order, and there was no skip link. | header, `#pal` | Tab from the top: 80+ stops to reach the list | Two skip links (to the block list, to the Book canvas), each shown only in its view. They move focus by script and leave the URL hash alone (the hash is the navigation state since C4a; a plain #list link sent the router back to the Book). Still open: the palette itself needs collapsible groups or a search so it is not 74 stops (see top-10). | 2.4.1 [bypass-blocks], 2.4.3 [focus-order] |
| A11Y-09 | Medium | Fixed | Reduced motion only zeroed transitions. Sortable's slide animation and `scrollIntoView({behavior:'smooth'})` still ran. | CSS end, `select()`, Sortable options | Emulate `prefers-reduced-motion` | CSS kills transitions, animations and smooth scroll; JS uses `ANIM = 0` and instant scrolling. Book camera already checked `reduceMotion()`. | 2.3.3 [animation-from-interactions] (AAA; plan requires it) |
| A11Y-10 | Medium | Fixed | The "Too full" / "Getting tight" warning was visual only, and toasts vanished after 2.6 s (errors included). | `meter()`, `toast()` | Overfill a page with a screen reader on | Warning is announced once when it appears or changes (new `#live` region); toast stays at least 4 s, longer for long text. | 4.1.3 [status-messages], 2.2.1 [timing-adjustable] |
| A11Y-11 | Medium | Open (part) | A block moved in Grid mode by keyboard is not announced. Book level changes were unannounced on the pre-C4a code; C4a now says "Now at: ..." in `#nav-live`, so that half is closed. | Grid `applyPlace` | Grid: focus a box, arrow | Call `announce()` with "Events: column 1, row 4, 4 wide" after a successful move | 4.1.3 |
| A11Y-12 | Medium | Fixed | The More menu has `role=menu` but no keyboard support: no Escape, no arrows, no focus on open. | `#menu` | Enter on More, press Escape | Escape closes and returns to the button; Up/Down/Home/End move; opened by keyboard it lands on the first item. | 2.1.1, 4.1.2 |
| A11Y-13 | Medium | Fixed | Windows forced-colors mode: pressed chips/segments used only a background colour, and the switch track/knob vanished. | pressed states, `.sw` | Emulate `forced-colors: active` | `forced-colors` block: pressed and on states use Highlight/HighlightText; switch drawn with system colours. | 1.4.1 [use-of-color], 1.4.11 |
| A11Y-14 | Low | Fixed | `prefers-contrast: more` was ignored; there is no high-contrast theme. | tokens | Emulate `prefers-contrast: more` | Light and dark high-contrast token sets (all pairs at least 7:1, focus ring black or white, borders full strength). Follows the system now; the Settings panel makes it a choice. | 1.4.6 [contrast-enhanced] (AAA; plan requires it) |
| A11Y-15 | Low | Fixed | The Artifact build's `<html>` is written by the host and has no `lang`. | `dist/artifact.html` | axe `html-has-lang` on the Artifact | The script sets `lang="en"` if none. Pages and demo already had it. | 3.1.1 [language-of-page] |
| A11Y-16 | High | Open | The Blocks / + Add / Preview tabs (phones and narrow windows) are `role=tab` with no `aria-controls`, no `tabpanel`, no arrow-key movement, and the hidden panels are removed with `display:none` only. | `.tabs`, `tab()` | At 390 px focus a tab and press ArrowRight | Tab pattern: roving tabindex, arrows, `aria-controls`, panels with `role=tabpanel` and labels. C4a (#78) left the tabs unchanged; the next navigation change must fix them. | 4.1.2, 2.1.1 |
| A11Y-17 | Medium | Fixed | At 320 px (400% zoom) the sticky header took 275 of 700 px, and at short heights it covered the whole view. | `.top` | 320 x 700; or 1280 x 200 at 400% | Header is static below 360 px width or 520 px height. Pre-existing 390 px still sticky (218 px): **C4a should shrink the header** (single-row toolbar plus overflow menu). | 1.4.10 [reflow], 2.4.11 [focus-not-obscured-minimum] |
| A11Y-18 | Medium | Open | All type is in `px`, so a larger default font size in the browser or OS does nothing (only zoom works). Text as small as 10.5 px (grid labels), 11.5 px (X4 mark), 12 to 12.5 px (hints, status). | whole stylesheet | Set the browser's default font size to 24 px | Convert to `rem` and add a scale variable (see the Settings design). Blocks the "text size 100 to 200 percent" setting. | 1.4.4 [resize-text] |
| A11Y-19 | Low | Fixed | Block hints were cut off with an ellipsis ("micro-sea...") and could not be read in full. | `.hint` | Day view, desktop | Hints wrap. | 1.4.4, 1.4.10 |
| A11Y-20 | Low | Open | Grid mode: one-row blocks are 21 px tall (a grid cell is 5.6 mm), below the 24 px minimum. Keyboard arrows and the four steppers are the alternatives; the box itself is the layout. | `#ov .gb` | Grid, an "Events" box | Give the overlay boxes a minimum hit area larger than the block (an outer invisible target) or select through the list; document the exception. | 2.5.8 |
| A11Y-21 | Medium | Open | Book view: `role=application` on the canvas, pages are not focusable (`[` `]` `Home` `End` select), the SR user gets only `#bk-info`. Pages are groups with good labels but sit inside an application region that turns off browse mode. | `#bk-view`, `.bpg` | Screen reader on Book view | Roving tabindex over pages (`role=listbox` or a grid of spreads) so each page is reachable and named; keep the shortcuts. **C4a.** | 4.1.2, 2.1.1 |
| A11Y-22 | Info | Info | Tapping a block on the preview selects it; keyboard and SR users select through the list instead, which is a full alternative. | `pv.addEventListener('click')` | - | none needed | - |
| A11Y-23 | Low | Open | The drag library (Sortable) and fonts come from CDNs. If the library is blocked the block list renders empty with no message. | `<script src=cdnjs...>` | Block cdnjs | Bundle Sortable into the build (also privacy: no third-party requests) and show an error if it fails. | 4.1.3 |

### Product site (`site/`)

| ID | Sev | Status | Finding | Fix | WCAG |
|---|---|---|---|---|---|
| A11Y-30 | Medium | Fixed | The sample-page gallery scrolls sideways on phones but was not keyboard-focusable (axe `scrollable-region-focusable`). | `tabindex=0` and a label on the list | 2.1.1 |
| A11Y-31 | Low | Fixed | The generated `/docs/` pages had no skip link and the `main` had no id. | Skip link and `id=main` in `site/tools/build-docs.mjs` | 2.4.1 |
| A11Y-32 | Info | Info | `body { overflow-x: hidden }` would hide a real reflow failure. Checked with element positions at 320 and 390: none today. The test checks positions, not scroll width, so it will catch one. | keep the check | 1.4.10 |
| A11Y-33 | Info | Info | Site has no visible high-contrast or text-size controls; it follows the system (dark, reduced motion, forced colors all verified). Reuse the editor Settings state when built. | see Settings design | - |

### Printed books

The plan says the large-print layout "uses the existing Large-print day method layout". **It does not exist on main:** `content/layouts.mjs` has Original, Bullet Journal, Hobonichi, Five Minute and Theme System. The large-print layout is a new build.

| ID | Sev | Status | Finding | Detail | Proposed fix |
|---|---|---|---|---|---|
| A11Y-40 | Medium | Open | Type is small everywhere: `render.mjs` and `daypage.mjs` use 7 pt 53 times, and labels from 5.6 to 9.5 pt; headings 10 to 14 pt; the biggest are page titles (26 to 34 pt). Nothing scales. Large print means 14 pt and up. | counts from the CSS | Per-book type scale variable (small / medium / large / extra large) used by every `pt` size, with `check.mjs` fitting at each size (a large-print day page is a different block set, not a scaled copy). |
| A11Y-41 | Medium | Open | Weak ink for low vision: ruled lines `#a0a0a0`, dot grids and month-page lines `#c8c8c8` (about 1.7:1 on white), and some 6.5 to 7 pt labels in `#777` (4.5:1, the minimum, at a tiny size). Rules are 1 px (0.75 pt, the KDP floor). | `.rule`, `.m .rule`, `.m .dots`, `.xst .tsc`, `.wrow.other` | "High-contrast ink" option: rules at 1.5 px in `#333`, dots `#666`, no text lighter than `#444`. |
| A11Y-42 | Info | Info | What already helps: line spacing per block (5.6, 6.6 or 8.5 mm), and a fixed high-contrast scan zone. Wide spacing is the closest thing to a large-print writing area today. | `PITCH` in `daypage.mjs` | Make 8.5 mm the large-print default. |
| A11Y-43 | Low | Open | Emoji-free by KDP rule, but the printed glyph icons carry meaning without text on some blocks (X4 mark, "SEND TO" symbols). Check each icon has a printed word nearby before a low-clutter mode removes icons. | - | Audit when the low-clutter option is designed. |

### X4 (firmware UI, previews from `x4/host/preview.sh`)

The screens are already high-contrast (1-bit, no grey), every list row has an icon and a word, nothing depends on colour or sound, and there are no notifications. Gaps:

| ID | Sev | Status | Finding | Proposed fix |
|---|---|---|---|---|
| A11Y-50 | High | Open | Type is 17 px for captions and hints (about 5.6 pt at the X4's roughly 220 ppi), 21 px for rows and button labels (6.9 pt), 22 px for body text (7.2 pt). There is no large-text mode. The Support screen is body text at 22 px and its long entries are cut with "...". | Large-text mode: a second font set (about 28 and 34 px) chosen in the menu or on the phone page and saved on the card; fewer rows per screen, pages instead of cut lines. Flash cost: check the partition first (bitmap fonts grow with every size). **Fixed: Settings > Text size > Large (x4/README.md, Settings). Fonts are Inter at 23/28/42/52 px; paging replaces cut lines.** |
| A11Y-51 | Low | Open | The Support screen shows a missing-glyph box where the sample text has "->" (U+2192): the arrow is not in Inter's 17 px set. | Add the glyph to the font set or map it to "to". **Fixed: the arrow is drawn by the canvas, so no missing-glyph box at any size.** |
| A11Y-52 | Medium | Open | No button remap or hold-time setting. Back and Confirm are fixed; Left/Right/Up/Down overlap in most screens (a partial help for one-handed use), but Back-hold and Power-hold are needed for Support and sleep. | Remap table on the card (`kw/buttons.txt`) read at boot, shown in the sync page; a "no long presses" alternative for Support. **Fixed: Settings > Buttons (left-handed, Confirm/Back swapped) and Hold Back (1.2 s, 2.5 s, off). Stored in /kw/settings.txt, not buttons.txt.** |
| A11Y-53 | Medium | Open | The page the X4 serves (`src/net/webpage.h`): the safety-plan textarea and the file input have no label (axe `label`, critical), action buttons are 38 px tall, and the result messages (`.msg`) are not live regions. Language and viewport are set, dark mode works. | Add `<label for>`, 44 px buttons, `role=status` on messages. Firmware CI must stay green; touch only the HTML string. **Fixed: labels, 44 px buttons, live regions, focus styles in webpage.h.** |
| A11Y-54 | Low | Open | Idle sleep after 90 s with Today showing. It never discards a check-in in progress if state is saved on each tick (confirm: `test_focus.sh` covers focus; check the check-in screen). No timeouts punish slowness otherwise. | Verify, then add an "idle time" setting (90 s, 5 min, never while charging). **Fixed: idle time 90 s / 5 min / 15 min; Support, plan and Clock wait at least 15 min.** |
| A11Y-55 | Info | Info | Refresh: Fast (partial) for in-screen moves and Half on screen change; ghosting on real hardware is bring-up item 1 in `x4/CLAUDE.md`. | Include a "full refresh every N screens" setting in the same options file. **Fixed: Settings > Clean the screen (every 4, 8, 16 moves).** |

## What already works

- **Editor:** every icon-only button has a name (axe `button-name` and `label` were clean apart from A11Y-02 and one unlabelled text input); `aria-pressed` on toggles, `aria-expanded` on disclosures, `role=switch` with `aria-checked`; native `dialog` for the Versions drawer, Methods and GitHub (focus trap, Escape, focus returns); live regions on the status, toast, grid problems, Book info and Versions chip; Grid mode has arrow keys, Shift+arrows and four steppers per block as an alternative to dragging; Book view has zoom buttons, level buttons, a labelled jump box with a datalist, and full keyboard shortcuts; light and dark by system preference; the viewport meta does not block zoom; no sideways scroll at 320, 390 or 768 px in Day, Book or Versions (measured on element positions).
- **Site:** skip link, landmarks, one `h1`, alt text that describes the page, `lang`, table region with label and focus, theme toggle with `aria-pressed`, 44 px targets, reduced motion, dark, forced colors, no axe violations at 1280, 390 and 320 px (after A11Y-30).
- **X4:** high-contrast 1-bit screens, icon plus word on every row, no sound, no flashing (partial refresh), the plan and log stay on the card.

## The automated check

`journal/editor/test-a11y.mjs` (CI: Editor workflow, after the editor tests; about 70 s):

| Rule id | What it checks |
|---|---|
| `names`, `landmarks`, `contrast-axe` | axe-core on Day (light, dark, 390), Grid, Book, Versions drawer, GitHub and Methods dialogs, menu open, the demo, the Artifact build and the product site at 1280, 390 and 320; one visible `main`, one `h1`, `lang` |
| `tokens` | 16 colour pairs (text 4.5:1, focus ring, control border, accent 3:1) in light, dark, high-contrast light and high-contrast dark |
| `targets` | every visible control at least 44 px (inline links exempt) in Day with every option open, 390 px in each tab, Grid, Book, Versions, dialogs, demo, site |
| `reflow` | no sideways scroll and no content past the edge at 320 and 390, in every tab and view |
| `focus` | a visible 2 px ring on every stop for 34 Day stops, 8 Book stops and 14 site stops, and the focused control is not covered |
| `motion` | with reduced motion: no transitions or animations, no smooth scroll, Sortable animation 0 |
| `forced-colors` | on/off and pressed/unpressed still differ |
| `keyboard`, `announce`, `tabs-pattern` | skip link, add a block with Enter, reorder with arrows (moves, keeps focus, is announced), switch with Space, options open, More menu, save a version by keyboard and Escape, overflow warning, Grid arrows, Book keys, tab pattern |

It fails on any finding that is not in the `KNOWN` list at the top of the file (ids match this document) and prints a note when a `KNOWN` entry stops occurring, so units delete entries as they fix them. Run `node editor/test-a11y.mjs --report` to list the known ones. Checked against the pre-fix template: 150 findings; with the fixes: 0 new, 4 known lines (A11Y-11 once, A11Y-16, A11Y-20 twice).

Later units: the next navigation unit removes `tabs-pattern`; the grid units remove the rest.

## Settings panel: design note (not built)

A gear button (44 px, labelled "Display settings") in the top bar opens a `dialog` like Versions. One radio or segmented group per setting, all applied at once and saved. Read before first paint where possible (an inline script in the page start; the Artifact build cannot edit `<head>`, so it applies at script start).

| Setting | Values | What it needs in the code |
|---|---|---|
| Text size | 100, 125, 150, 200 percent | Convert `px` to `rem` throughout `template.html`, `versions.css` and `site/style.css` (A11Y-18). `html { font-size: calc(100% * var(--ts)) }`. Breakpoints in `em`, so the layout reflows as text grows; verify at 400% (320 px). The print preview `#pv` and Book pages stay in inches: never scaled. |
| Theme | System, light, dark | CSS already supports `data-theme` on `:root`; add the control and persist. |
| High contrast | System, off, on | Refactor the `prefers-contrast` block into `:root[data-contrast="high"]` plus the media query (same tokens). |
| Reduced motion | System, on, off | One `prefs.motion` read by CSS (`data-motion="reduce"` mirrors the media query), `reduceMotion()` and `ANIM`. |
| Dyslexia-friendly font | Off, Atkinson Hyperlegible, Lexend | Add the family to the Google Fonts request (both open licence). `--ui-font` replaces `Inter` on `body` and controls, not on `#pv` and not the serif headings. Provide a local fallback list. |
| Spacing | Normal, roomy | `data-spacing="roomy"`: line height 1.7, letter spacing .02em, word spacing .08em, paragraph gap. Must survive WCAG 1.4.12's values (line 1.5, letter .12em, word .16em, paragraph 2x) with nothing clipped: add a test that injects those and checks overflow. |
| Target size | 44 px, 56 px | Replace the literal `44px` in about 25 rules with `var(--tap)`; the new accessibility block already lists them. 56 px will need the header to become a single row plus an overflow menu (C4a). |
| Plain-language errors | always on | Keep the message catalogue in one place; every error names what to do next. |
| Time limits | none | Already true; keep toasts at 4 s or more and always in a live region. |

Other needs: one storage key (`jw-a11y`, JSON) shared by the site, demo and app (same origin on GitHub Pages; the Artifact keeps its own); a `test-a11y.mjs` matrix that loads the editor with each setting on (200% text at 320 px, high contrast, roomy, 56 px) and runs the same rules. Print options (text size, large print, high-contrast ink, dyslexia type, handedness, low clutter) are book settings in the profile and the editor's Book options, not display settings, so the preview never lies about the page.

## Top 10 for the follow-up units

1. **Next navigation change:** the tab pattern (A11Y-16), Book page focus (A11Y-21), a smaller header at 390 px (A11Y-17); keep the skip links, one `main` at a time, the `#live` and `#nav-live` regions, and the 44 px rule. Add its own cases to `test-a11y.mjs` and delete the `KNOWN` entries.
2. **Settings panel with rem conversion** (A11Y-18): text size 100 to 200 percent, high contrast, reduced motion, spacing, target size 56, dyslexia font.
3. **Print: large-print and text-size options** (A11Y-40): build the large-print day method (it does not exist), a type-scale variable, `check.mjs` at each size.
4. **Print: high-contrast ink** (A11Y-41): heavier rules and dots, no light grey content.
5. **X4 large-text mode** (A11Y-50), with the missing-glyph fix (A11Y-51).
6. **X4 hotspot page labels, 44 px buttons, live messages** (A11Y-53): a small change to one HTML string.
7. **Palette usability for keyboard and screen reader** (A11Y-08): collapsible groups or a filter so 74 buttons are not 74 Tab stops.
8. **Grid announcements and one-row targets** (A11Y-11, A11Y-20).
9. **Bundle Sortable and fonts locally** and show an error if the library fails (A11Y-23).
10. **X4 button remap and idle and refresh settings** (A11Y-52, A11Y-54, A11Y-55), plus accessibility metadata and a real heading structure in the X4 EPUBs and docs (plan, "Digital outputs").
