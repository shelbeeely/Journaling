// The step-by-step guide: ONE source for the words, the screenshots and the callouts.
//   site/tools/make-guide-shots.mjs  reads SHOTS: drives the editor demo, finds every selector, draws numbered rings, crops, writes site/img/guide/*.webp
//   site/tools/build-guide.mjs       reads CHAPTERS + SHOTS: writes the page (site/guide/) with the same numbers as the rings
// If the editor changes and a selector below stops matching, the shot script fails and so does CI: the guide cannot go stale silently.
// Generic data only: profile.example.json (Northlight) and journal/test.ics. Never put a personal name, place or title in here.
//
// A shot:  build 'demo' (the public demo), 'app' (the working editor, guest mode: versions live in the browser) or 'studio' (see below)
//          vp [w,h]  hash  setup [[op, ...]]  callouts [{sel, name, does, at?}]  crop {pad?, sels?} | null (whole viewport)
//          themes ['light','dark']  scale (1 or 2)  maxW  alt (what the picture shows; the marks are added to it)
// Setup ops: ['click', sel] ['eval', js] ['wait', ms] ['fill', sel, text] ['select', sel, value] ['hide', sel] ['key', key]
//   build 'studio' = the working editor served by a real Studio server with one public sample project and one release; text '@studio-password' and value '@studio-project' fill in its made-up sign-in

const BOOK = '#book', BOOKEDIT = '#book/edit', DAY = '#day/2026-10-14', DAYEDIT = '#day/2026-10-14/edit';
const lvl = (l) => `.nv-lv [data-nav-level="${l}"]`;
const openGrid = [['click', '#lay-g'], ['wait', 5000]];
const openCare = [['eval', "openIds.add('care'); drawList()"], ['wait', 400]]; // the Care block may start open: this opens it without toggling
const openScan = [['eval', "document.querySelector('#scan-t').click()"], ['wait', 500]];

export const SHOTS = {
  // ---------- 1. Open the editor ----------
  'open-demo': { build: 'demo', vp: [1280, 760], hash: BOOK, alt: 'The editor demo opened on the whole sample book. A banner at the top says the data is sample data.',
    callouts: [
      { sel: '#demo', name: 'Demo banner', does: 'Says this copy is sample data. Nothing you do here is saved anywhere. Your own copy has no banner.' },
      { sel: '#crumbs', name: 'Where you are', does: 'The breadcrumb: Library, then the book. Press a name to go back up to it.' },
      { sel: '.nv-lv', name: 'Zoom level', does: 'Five buttons: Library, Series, Book, Spread and Day. Each zooms one step in or out.' },
      { sel: '#edit', name: 'Edit', does: 'Turns on editing for this level. Nothing changes until you press it.' }] },
  'levels': { build: 'demo', vp: [1280, 760], hash: BOOK, scale: 2, crop: { pad: 22 }, alt: 'The five zoom buttons next to each other: Library, Series, Book, Spread and Day.',
    callouts: [
      { sel: lvl('library'), name: 'Library', does: 'Every book on your shelves.' },
      { sel: lvl('series'), name: 'Series', does: 'A set of books that share defaults, such as four seasons. Greyed out when this book is on its own.' },
      { sel: lvl('book'), name: 'Book', does: 'All pages of the book, laid out as spreads.' },
      { sel: lvl('spread'), name: 'Spread', does: 'Two facing pages at reading size.' },
      { sel: lvl('day'), name: 'Day', does: 'One day page. This is where you build the page from blocks.' }] },

  // ---------- 2. Profile and trim ----------
  'book-settings-btn': { build: 'demo', vp: [1280, 760], hash: BOOKEDIT, scale: 2, crop: { pad: 24 }, alt: 'The toolbar above the book canvas in edit mode, with the Book settings button.',
    callouts: [
      { sel: '#bk-set', name: 'Book settings', does: 'Opens the sheet with the title, length, first month, edition and cover.' },
      { sel: '#og-toggle', name: 'Pages', does: 'Shows or hides the page list (chapter {{ch:book}}).' }] },
  'book-settings': { build: 'demo', vp: [1280, 900], hash: BOOKEDIT, setup: [['click', '#bk-set'], ['wait', 600]], crop: { pad: 18 }, alt: 'The Book settings sheet with its first fields filled in for the sample book.',
    callouts: [
      { sel: '#bs-title', at: 'tr', name: 'Title', does: 'Printed on the cover and the title page, and used in file names.' },
      { sel: '#bs-scope', at: 'tr', name: 'Length', does: 'What one book covers: a month, a season, a year, or undated. Long books split into volumes past 110 pages.' },
      { sel: '#bs-start', at: 'tr', name: 'First month', does: 'The month the book starts. An undated book skips it.' },
      { sel: '#bs-ed', at: 'tr', name: 'Edition', does: 'Part of every scan code. Two books that cover the same months need different editions.' }] },
  'trim': { build: 'demo', vp: [1280, 760], hash: DAYEDIT, scale: 2, crop: { pad: 22 }, alt: 'The page-size switch in the top bar: 5.5 by 8.5 inches is selected, 8.5 by 11 is next to it.',
    callouts: [
      { sel: '#sz-s', name: '5.5×8.5', does: 'The small trim: a paperback you can carry. The preview and the print both use it.' },
      { sel: '#sz-l', name: '8.5×11', does: 'The big trim: more room to write. Every block is re-fitted to the page.' }] },

  // ---------- 3. Day page from blocks ----------
  'day-view': { build: 'demo', vp: [1280, 900], hash: DAY, alt: 'A day page in view mode: only the page, read-only, with an Edit button at the top right.',
    callouts: [
      { sel: '#edit', name: 'Edit', does: 'Switches this page to edit mode. Press E on a keyboard.' },
      { sel: '#paper', name: 'The page', does: 'The day page at print size. Every block you add or move shows up here as you do it.' }] },
  'day-edit': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, themes: ['light', 'dark'], maxW: 1300, alt: 'The day page in edit mode: the block palette on the left, the list of blocks on the page in the middle and the live page preview on the right.',
    callouts: [
      { sel: 'aside.pal', name: 'Add blocks', does: 'Every block you can use, in groups. Drag one, or press its + button.' },
      { sel: '#list', name: 'On the page', does: 'The blocks on this page, top to bottom. Drag the grip to reorder; use the switch to hide one.' },
      { sel: '#paper', name: 'Live preview', does: 'The real page. It redraws after every change.' },
      { sel: '#meter', name: 'Writing space', does: 'How much blank room is left for writing. Blocks take it away, so watch this number.' },
      { sel: '#done', name: 'Done', does: 'Leaves edit mode. Escape does the same.' }] },
  'add-block': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, scale: 2, crop: { pad: 18, sels: ['#pal li[data-key="t:checks"]'] }, alt: 'One tile of the palette, Checkboxes, with its plus button.',
    callouts: [
      { sel: '#pal li[data-key="t:checks"] .n', at: 'l', name: 'The block', does: 'Drag the tile onto the list or straight onto the page to place it where you drop it.' },
      { sel: '#pal [data-add="t:checks"]', name: '+ button', does: 'Adds the block at the end of the list. This is the way to do it from a keyboard or a phone.' }] },
  'block-row': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, scale: 2, setup: [['wait', 200]], crop: { pad: 20, sels: ['#list > li[data-uid="notes"]'] }, alt: 'One block in the list, Holidays and notes, with its grip, remove button and on/off switch.',
    callouts: [
      { sel: '#list > li[data-uid="notes"] .grip', name: 'Grip', does: 'Drag to reorder. With a keyboard, focus it and press Up or Down.' },
      { sel: '#list > li[data-uid="notes"] .del', name: 'Remove', does: 'Takes the block off this page. Undo brings it back.' },
      { sel: '#list > li[data-uid="notes"] .sw', name: 'On/off switch', does: 'Hides the block without losing its settings. Turn it on again later.' }] },
  'block-options': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, setup: openCare, scale: 2, crop: { pad: 20, sels: ['#list > li[data-uid="care"]'] }, alt: 'The Care check-in block opened to show its options: each row inside it has its own switch.',
    callouts: [
      { sel: '#list > li[data-uid="care"] .txt', name: 'Block name', does: 'Press the name to open its options. Press it again to close them.' },
      { sel: '#list > li[data-uid="care"] ul .sw >> nth=0', name: 'Option switch', does: 'Many blocks hold smaller parts. Each part switches on or off alone.' }] },
  'method-menu': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, setup: [['click', '#menubtn'], ['wait', 300]], scale: 2, crop: { pad: 20, sels: ['#menu'] }, alt: 'The More menu open, listing Start from a method, Download, Copy, Import and Reset.',
    callouts: [
      { sel: '#menubtn', name: 'More', does: 'Opens the menu of things that act on the whole layout.' },
      { sel: '#m-method', name: 'Start from a method', does: 'Pick a ready-made arrangement, such as a bullet journal or time blocking, and edit it from there.' },
      { sel: '#m-reset', name: 'Reset', does: 'Goes back to the original page. Undo brings your changes back.' }] },
  'undo': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, setup: [['click', '#pal [data-add="t:checks"]'], ['wait', 500]], scale: 2, crop: { pad: 22 }, alt: 'The Undo and Done buttons in the top bar. Undo is active after a change.',
    callouts: [
      { sel: '#done', name: 'Done', does: 'Finishes editing.' },
      { sel: '#undo', name: 'Undo', does: 'Takes back the last change. Press it again to keep going back. Ctrl+Z does the same.' }] },

  // ---------- 4. The grid ----------
  'grid-toggle': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, scale: 2, crop: { pad: 22 }, alt: 'The Flow and Grid switch in the top bar.',
    callouts: [
      { sel: '#lay-f', name: 'Flow', does: 'Blocks stack in order and the writing space takes what is left. Easiest, and the default.' },
      { sel: '#lay-g', name: 'Grid', does: 'You place each block yourself on a grid of 4 columns by 24 rows.' }] },
  'grid-page': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, setup: openGrid, maxW: 1300, alt: 'Grid mode: the page preview with its rows and columns drawn over it, and the block list showing where each block sits.',
    callouts: [
      { sel: '#paper', name: 'The grid', does: 'Dotted lines show the columns and the numbers down the side count rows. A row is one tight line (5.6 mm).' },
      { sel: '#actual', name: 'Actual size', does: 'Shows the page at true printed size, so you can judge whether a line is big enough to write on.' }] },
  'grid-steppers': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, setup: [...openGrid, ...openCare], scale: 2, crop: { pad: 20, sels: ['#list > li[data-uid="care"] .place'] }, alt: 'The four steppers that place a block on the grid: Column, Row, Wide and Tall.',
    callouts: [
      { sel: '#list > li[data-uid="care"] .place .step >> nth=0', name: 'Column', does: 'Which column the block starts in. The buttons move it left and right.' },
      { sel: '#list > li[data-uid="care"] .place .step >> nth=1', name: 'Row', does: 'Which row it starts in. The buttons move it up and down.' },
      { sel: '#list > li[data-uid="care"] .place .step >> nth=2', name: 'Wide', does: 'How many columns it covers.' },
      { sel: '#list > li[data-uid="care"] .place .step >> nth=3', name: 'Tall', does: 'How many rows it covers. A block never goes smaller than its content, and a move that would break a rule is refused with the reason.' }] },

  // ---------- 5. Book view ----------
  'book-view': { build: 'demo', vp: [1280, 860], hash: BOOK, maxW: 1200, alt: 'The Book view: every page of the sample book in facing spreads, with zoom, jump and legend controls above.',
    callouts: [
      { sel: '#bk-view', name: 'The canvas', does: 'Every page where it prints. Press a page to zoom in on it, then press it again to open it. Drag to move around.' },
      { sel: '#bk-zl', name: 'Zoom', does: 'The current zoom. The minus and plus buttons beside it change it; so do pinch and the + and - keys.' },
      { sel: '#bk-go', name: 'Jump', does: 'Type a page number or a page id such as day.2026-10-14, then press Enter.' }] },
  'book-bar': { build: 'demo', vp: [700, 700], hash: BOOK, scale: 2, crop: { pad: 20, sels: ['#bk-out', '#bk-leg'] }, alt: 'The toolbar above the Book canvas: zoom out, zoom level, zoom in, a page jump box, and a legend button.',
    callouts: [
      { sel: '#bk-out', name: 'Zoom out', does: 'See more pages at once.' },
      { sel: '#bk-in', name: 'Zoom in', does: 'See one spread at reading size.' },
      { sel: '#bk-jump button[type="submit"]', name: 'Go', does: 'Goes to the page you typed in the box.' },
      { sel: '#bk-leg', name: 'Legend', does: 'Explains the colours and marks on the canvas.' }] },
  'spread-view': { build: 'demo', vp: [1280, 900], hash: '#spread/12', maxW: 1200, alt: 'The Spread view: two facing pages at reading size.',
    callouts: [{ sel: lvl('spread'), name: 'Spread', does: 'You are here: two facing pages, side by side, as they sit in the printed book.' }] },
  'org-open': { build: 'demo', vp: [1440, 960], hash: BOOKEDIT, maxW: 1200, alt: 'The Book view in edit mode: the page canvas with a Pages panel on the right.',
    callouts: [
      { sel: '#og-toggle', name: 'Pages', does: 'Shows or hides the page list on the right: a numbered list you can reorder.' },
      { sel: '#og-undo', name: 'Undo', does: 'Takes back the last page change.' },
      { sel: '#og-redo', name: 'Redo', does: 'Puts back what you undid.' },
      { sel: '#org', name: 'Pages panel', does: 'The page count and the KDP range check, which months a change applies to, and the pages front to back.' }] },
  'org-select': { build: 'demo', vp: [1440, 960], hash: BOOKEDIT, setup: [['click', '.bpg[data-n="14"]'], ['wait', 800]], scale: 2, crop: { pad: 24 }, alt: 'The toolbar for a selected page: Earlier, Later, Move to and Hide.',
    callouts: [
      { sel: '#os-earlier', name: 'Earlier', does: 'Moves the page one place towards the front. Alt+Left does the same.' },
      { sel: '#os-later', name: 'Later', does: 'Moves it one place towards the back. Alt+Right does the same.' },
      { sel: '#os-moveto', name: 'Move to', does: 'Asks where to put the page, for a longer move.' },
      { sel: '#os-eye', name: 'Hide', does: 'Leaves the page out of the printed book without deleting it. Press again to bring it back.' }] },
  'org-pick': { build: 'demo', vp: [1440, 960], hash: BOOKEDIT, setup: [['click', '.bpg[data-n="14"]'], ['wait', 800]], maxW: 1200, alt: 'Page 14 selected on the canvas with a thick outline, and its toolbar under the canvas.',
    callouts: [
      { sel: '.bpg[data-n="14"]', name: 'A selected page', does: 'Press a page once to select it. It gets an outline and the toolbar below it lists what you can do.' },
      { sel: '#org-sel', name: 'Page toolbar', does: 'The actions for the selected page.' }] },

  // ---------- 6. Scan options ----------
  'scan-open': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, setup: [['eval', "document.querySelector('#scan').scrollIntoView({block:'center'})"], ['wait', 300]], scale: 2, crop: { pad: 16, sels: ['#scan'] }, alt: 'The Scan settings button under the block list, closed.',
    callouts: [{ sel: '#scan-t', name: 'Scan settings', does: 'Opens the scan marks for every day page: the border, the code, where it sits and how big it is. The header (date, title, tags) always stays at the top.' }] },
  'scan-sheet': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, setup: [...openScan, ['eval', "document.querySelector('#scan').scrollIntoView({block:'start'})"], ['wait', 300]], crop: { pad: 18, sels: ['#scan'] }, scale: 2, alt: 'The Scan settings open: switches for the scanning border and the page code, and choices for the code position, size and type.',
    callouts: [
      { sel: '[data-sc="frame"]', name: 'Scanning border', does: 'The black frame the scanner uses to find the page edges. Keep it on if you will scan.' },
      { sel: '[data-sc="on"]', name: 'Page code', does: 'The small square code that says which page this is. Switch it off if you will never scan.' },
      { sel: '[data-sc="position:right"]', name: 'Code position', does: 'Bottom right, bottom left, outer edge or by the spine. The send-to strip stays where it is.' },
      { sel: '[data-sc="format:data_matrix"]', name: 'Code type', does: 'Data Matrix is smaller and more tolerant of printing. QR is easier for a phone camera.' }] },

  // ---------- 7. Save and versions ----------
  'save-menu': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, setup: [['click', '#menubtn'], ['wait', 300]], scale: 2, crop: { pad: 20, sels: ['#menu'] }, alt: 'The More menu with Download, Copy and Import.',
    callouts: [
      { sel: '#m-dl', name: 'Download', does: 'Saves daypage.json: your layout, as a file. Keep it, or send it to someone.' },
      { sel: '#m-copy', name: 'Copy', does: 'Copies the same layout as text to paste anywhere.' },
      { sel: '#m-import', name: 'Import', does: 'Loads a layout file you saved earlier or got from someone else.' }] },
  'ver-open': { build: 'app', vp: [1400, 900], hash: DAYEDIT, scale: 2, crop: { pad: 22 }, alt: 'The Versions button in the top bar of the working editor.',
    callouts: [{ sel: '#v-ver', name: 'Versions', does: 'Opens the history drawer. Not in the public demo, which saves nothing.' }] },
  'ver-save': { build: 'app', vp: [1400, 900], hash: DAYEDIT, setup: [['click', '#v-ver'], ['wait', 600]], crop: { pad: 18, sels: ['#versions'] }, scale: 1, alt: 'The Versions drawer before any version is saved: a box for a message and a Save version button.',
    callouts: [
      { sel: '#vs-msg', name: 'What changed', does: 'A few words for future you, such as Added habit boxes.' },
      { sel: '#vs-savebtn', name: 'Save version', does: 'Keeps the page as it is now. Do this before you try something risky.' }] },
  'ver-log': { build: 'app', vp: [1400, 900], hash: DAYEDIT, themes: ['light', 'dark'],
    setup: [['click', '#v-ver'], ['wait', 500], ['fill', '#vs-msg', 'The original page'], ['click', '#vs-savebtn'], ['wait', 500], ['click', '#vs-close'], ['wait', 300],
      ['click', '#pal [data-add="t:checks"]'], ['wait', 400], ['click', '#v-ver'], ['wait', 500], ['fill', '#vs-msg', 'Added checkboxes'], ['click', '#vs-savebtn'], ['wait', 500],
      ['click', '#vs-log [data-cmp]:not([data-cmp="draft"]) >> nth=0'], ['wait', 1200]],
    maxW: 1200, alt: 'The Versions drawer with two saved versions, the newer one compared with the older: a list of what changed, and the changed blocks marked on the page.',
    callouts: [
      { sel: '#vs-log', name: 'History', does: 'Every saved version, newest first.' },
      { sel: '#vs-log [data-cmp]:not([data-cmp="draft"]) >> nth=0', name: 'Compare', does: 'Shows what changed against the version before it, and marks the changed blocks on the page.' },
      { sel: '#vs-log [data-restore] >> nth=0', name: 'Restore', does: 'Brings an older version back as a new one. Nothing is lost: the newer versions stay in the history.' }] },

  // ---------- G2: Library and Series ----------
  'lib-shelf': { build: 'demo', vp: [1280, 720], hash: '#library', maxW: 1200, alt: 'The Library view: a shelf of covers. One cover is a single book, Northlight. The other two are stacks of covers, each a series of books.',
    callouts: [
      { sel: '.sh-item[data-id="northlight"] .sh-card', name: 'A single book', does: 'A book on its own. Press it to open it.' },
      { sel: '.sh-item[data-id="seasons"] .sh-card', name: 'A series', does: 'A stack of covers: books that belong together. The line under it says how many books it holds. Press it to see them in order.' },
      { sel: '#edit', name: 'Edit', does: 'Switches the shelf to edit mode, where the controls in the next pictures appear. Press E on a keyboard.' }] },
  'lib-edit': { build: 'demo', vp: [1280, 700], hash: '#library/edit', scale: 2, crop: { pad: 20 }, alt: 'The toolbar above the shelves in edit mode: zoom buttons, then New book, New series, Undo, Export and Import.',
    callouts: [
      { sel: '#sh-new-book', name: 'New book', does: 'Opens the Book settings sheet for a new book. Nothing is added until you press Save.' },
      { sel: '#sh-new-series', name: 'New series', does: 'Opens the Series settings sheet for a new, empty series.' },
      { sel: '#sh-undo', name: 'Undo', does: 'Takes back the last change to the library, up to 40 steps. It is greyed out until there is something to undo.' },
      { sel: '#sh-export', name: 'Export', does: 'Saves the whole library as a file, library.json.' },
      { sel: '#sh-import', name: 'Import', does: 'Reads a library file and, after a question, replaces the library with it.' }] },
  'lib-card': { build: 'demo', vp: [1280, 700], hash: '#library/edit', scale: 2, crop: { pad: 20 }, alt: 'The four buttons under one cover in edit mode: a grip, Earlier, Later and Settings.',
    callouts: [
      { sel: '.sh-item[data-id="northlight"] [data-act="grip"]', name: 'Grip', does: 'Drag the cover to a new place on the shelf.' },
      { sel: '.sh-item[data-id="northlight"] [data-act="earlier"]', name: 'Earlier', does: 'Moves it one place to the left. This is the keyboard and phone way to reorder.' },
      { sel: '.sh-item[data-id="northlight"] [data-act="later"]', name: 'Later', does: 'Moves it one place to the right.' },
      { sel: '.sh-item[data-id="northlight"] [data-act="settings"]', name: 'Settings', does: 'Opens the settings sheet for this book (or series).' }] },
  'series-sheet': { build: 'demo', vp: [1280, 1000], hash: '#library/edit', setup: [['click', '.sh-item[data-id="seasons"] [data-act="settings"]'], ['wait', 700]], crop: { pad: 18, sels: ['#lib-sheet'] }, alt: 'The Series settings sheet for the sample series Season journals: title, subtitle, its three books in order, and the defaults every book takes.',
    callouts: [
      { sel: '#ss-title', at: 'tr', name: 'Title', does: 'The series name, shown on the shelf. Required.' },
      { sel: '#ss-order', at: 'tr', name: 'Books, in order', does: 'The order is the numbering: Book 1 of 3, Book 2 of 3. Use the arrows or drag the grip.' },
      { sel: '#ss-scope', at: 'tr', name: 'Length default', does: 'What one book covers (a month, a season, a year, undated). Every book in the series takes it unless its own settings say otherwise.' },
      { sel: '#ss-ed', at: 'tr', name: 'Edition default', does: 'The edition number every book takes by default. It is part of every scan code.' }] },
  'book-sheet': { build: 'demo', vp: [1280, 1000], hash: '#series/seasons/edit', setup: [['click', '.sh-item[data-id="autumn-2026"] [data-act="settings"]'], ['wait', 700]], crop: { pad: 18, sels: ['#lib-sheet'] }, alt: 'The Book settings sheet for the book Autumn, in the series Season journals: title, subtitle, spine title, series and length.',
    callouts: [
      { sel: '#bs-title', at: 'tr', name: 'Title', does: 'This book\'s own title: the cover, the title page and the file names use it. Required.' },
      { sel: '#bs-sub', at: 'tr', name: 'Subtitle', does: 'The line under the title. Optional.' },
      { sel: '#bs-spine', at: 'tr', name: 'Spine title', does: 'A shorter title for the spine (40 characters at most). Leave it empty to use the title.' },
      { sel: '#bs-series', at: 'tr', name: 'Series', does: 'Which series the book belongs to, or none.' },
      { sel: '#bs-scope', at: 'tr', name: 'Length', does: 'Says "Same as the series (Season)" until you choose a length of its own. A choice here wins over the series.' }] },
  'series-books': { build: 'demo', vp: [1280, 720], hash: '#series/seasons/edit', setup: [['click', '.sh-item[data-id="autumn-2026"] [data-act="settings"]'], ['wait', 600], ['fill', '#bs-title', 'Lakeside autumn'], ['click', '#ls-save'], ['wait', 900], ['hide', '#lib-snack']], maxW: 1200, alt: 'The Series view in edit mode: three covers in order. The first has a new title, Lakeside autumn, and still says Book 1 of 3 in Season journals.',
    callouts: [
      { sel: '.sh-item[data-id="autumn-2026"] .sh-card', name: 'Renamed book', does: 'The cover is the real title page. It shows the new title and the series line, "Book 1 of 3 in Season journals".' },
      { sel: '.sh-item[data-id="winter-2026"] .sh-card', name: 'Next book', does: 'Books are numbered by their place in the series.' },
      { sel: '#sh-undo', name: 'Undo', does: 'Takes the rename back.' }] },

  // ---------- G2: days that cover a spread ----------
  'span-box': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, scale: 2, crop: { pad: 20, sels: ['#spanbox'] }, alt: 'The This day covers box at the top of the block list, with One page chosen.',
    callouts: [
      { sel: '#spanbox .og-radio >> nth=0', name: 'One page', does: 'The usual day page. This is the default.' },
      { sel: '#spanbox .og-radio >> nth=1', name: 'A spread', does: 'This one day gets a left page and a right page on a two-page canvas.' },
      { sel: '#spanbox label.sp-ck:has(#span-wd)', name: 'Every weekday', does: 'Makes every day that falls on this weekday a spread. The label names the weekday of the day you are on.' },
      { sel: '#spanbox label.sp-ck:has(#span-all)', name: 'Every day', does: 'Makes every day page in the book a spread.' },
      { sel: '#span-note', name: 'Page count', does: 'What the choice does to the book: Notes pages added by themselves, the page total and whether it is inside the KDP range.' }] },
  'span-canvas': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, setup: [['click', '#spanbox input[name="span"][value="spread"]'], ['wait', 1000]], maxW: 1300, alt: 'A day that is a spread: the page preview shows a left page and a right page side by side with a dashed fold between them, and the box beside the list says the book is 74 pages.',
    callouts: [
      { sel: '#paper', name: 'Two-page canvas', does: 'A left page and a right page, each with its own date, title and tags, SEND TO strip and page code. The right page\'s date says "cont.".' },
      { sel: '#paper >> text="Fold"', name: 'Fold', does: 'The fold sits after column 4. A block stays wholly on one page: nothing crosses it.' },
      { sel: '#span-note .kdpl', name: 'KDP note', does: 'The page count after the change and whether it is inside the KDP range: 24 to 110 for a paperback.' }] },
  'span-phone': { build: 'demo', vp: [390, 844], hash: DAYEDIT, setup: [['click', '#spanbox input[name="span"][value="spread"]'], ['wait', 900]], scale: 2, maxW: 780, alt: 'A spread day on a phone, 390 pixels wide: the preview shows one page at a time, with a Left page and Right page switch above it.',
    callouts: [
      { sel: '#sidepick', name: 'Left page, Right page', does: 'On a narrow screen the editor shows one page of the spread at a time. This switch picks which.' },
      { sel: '#sheet-t', name: 'Sheet handle', does: 'Collapses or opens the blocks sheet.' }] },

  // ---------- G2: Notes, blank and Collection pages as block pages ----------
  'og-add': { build: 'demo', vp: [1440, 960], hash: BOOKEDIT, setup: [['eval', "document.querySelector('#og-where').scrollIntoView({block:'center'})"], ['wait', 400]], crop: { pad: 18, sels: ['#og-where'] }, alt: 'The bottom of the Pages panel: a Put it menu and the two buttons Add a Notes page and Add a Collection page.',
    callouts: [
      { sel: '#og-where', name: 'Where', does: 'Where the new page goes: before any page of the book.' },
      { sel: '[data-act="add"][data-type="notes"]', name: 'Add a Notes page', does: 'Adds a Notes page: the date, title and tags header over a dot grid. You can rename it and fill it with blocks.' },
      { sel: '[data-act="add"][data-type="collection"]', name: 'Add a Collection page', does: 'Adds a Collection page: a title over ruled lines, for a list you keep adding to.' }] },
  'og-new-page': { build: 'demo', vp: [1440, 960], hash: BOOKEDIT, setup: [['click', '[data-act="add"][data-type="collection"]'], ['wait', 800]], scale: 2, crop: { pad: 22, sels: ['#org-sel'] }, alt: 'The toolbar for a page you added: Earlier, Later, Move to, Edit blocks, Duplicate, Remove and a Title box.',
    callouts: [
      { sel: '#os-edit', name: 'Edit blocks', does: 'Opens this page in the day page editor so you can build it from blocks.' },
      { sel: '#os-dup', name: 'Duplicate', does: 'Makes a copy of the page, blocks and all, right after it.' },
      { sel: '#os-del', name: 'Remove', does: 'Takes the page out of the book. Pages that came with the book can only be hidden.' },
      { sel: '#os-title', name: 'Title', does: 'The name printed in the title box of the page. 40 characters at most.' }] },
  'blockpage': { build: 'demo', vp: [1440, 960], hash: BOOKEDIT, setup: [['click', '[data-act="add"][data-type="collection"]'], ['wait', 700], ['click', '#os-edit'], ['wait', 1200]], maxW: 1200, alt: 'A Collection page open in the block editor: the palette on the left, one block (Writing space) in the middle list, and the page preview on the right with the header at the top.',
    callouts: [
      { sel: 'aside.pal', name: 'Add blocks', does: 'The same palette as the day page, minus the blocks that read a day (moon, events, the rotating prompt) and SEND TO.' },
      { sel: '#day-note', name: 'The page\'s own grid', does: 'Says which page this is and its grid: 4 columns by 24 rows. Changes are saved into the book.' },
      { sel: '#list', name: 'On the page', does: 'The page\'s blocks, top to bottom. A Collection page starts with only a Writing space.' },
      { sel: '#paper', name: 'Live preview', does: 'The page as it prints. The header and the page code are fixed.' }] },
  'blank-page': { build: 'demo', vp: [1440, 960], hash: '#page/blank/edit', maxW: 1200, alt: 'The blank page (page 2 of the sample book) open in the block editor: the preview has no header, only the scan frame, the SEND TO strip and the page code.',
    callouts: [
      { sel: '#day-note', name: 'Blank page grid', does: 'A blank page has no header, so its grid is 4 columns by 27 rows.' },
      { sel: '#paper', name: 'Preview', does: 'Empty until you add blocks. The frame, SEND TO strip and page code stay.' }] },

  // ---------- G2: puzzles ----------
  'pz-palette': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, scale: 2, crop: { pad: 20, sels: ['#pal li[data-key="t:wordsearch"]', '#pal li[data-key="t:crossword"]'] }, alt: 'The Puzzles group in the block palette: a Word search tile and a Crossword tile, each with a plus button.',
    callouts: [
      { sel: '#pal [data-add="t:wordsearch"]', name: 'Word search +', does: 'Adds a Word search block at the end of the list.' },
      { sel: '#pal [data-add="t:crossword"]', name: 'Crossword +', does: 'Adds a Crossword block at the end of the list.' }] },
  'pz-options': { build: 'demo', vp: [1600, 1200], hash: BOOKEDIT, setup: [['click', '[data-act="add"][data-type="collection"]'], ['wait', 700], ['click', '#os-edit'], ['wait', 1200], ['click', '#pal [data-add="t:wordsearch"]'], ['wait', 800], ['eval', "openIds.add(document.querySelector('#list > li[data-uid^=wordsearch]').dataset.uid); drawList()"], ['wait', 600]],
    crop: { pad: 20, sels: ['#list > li[data-uid^="wordsearch"]'] }, alt: 'A Word search block opened in the list to show its options: title, grid size, difficulty, where the words come from, a seed, and switches for answers and large print.',
    callouts: [
      { sel: '#list > li[data-uid^="wordsearch"] .opt:has([data-num$="/size"])', name: 'Grid size', does: 'Squares per side. Bigger grids hold more words and need more of the page.' },
      { sel: '#list > li[data-uid^="wordsearch"] .opt:has([data-choice$="/difficulty"])', name: 'Difficulty', does: 'Easy hides words across and down only, medium adds diagonals, hard adds backwards words.' },
      { sel: '#list > li[data-uid^="wordsearch"] .opt:has([data-choice$="/source"])', name: 'Words from', does: 'Built-in lists, your own puzzles pack (the print build reads it), or words you type.' },
      { sel: '#list > li[data-uid^="wordsearch"] .opt:has([data-text$="/seed"])', name: 'Seed', does: 'The same seed on the same page gives the same puzzle on every reprint. Type something else for a different one.' },
      { sel: '#list > li[data-uid^="wordsearch"] [data-bool$="/answers"]', name: 'Show answers', does: 'Prints the solution into the puzzle. Leave it off for a puzzle to solve.' }] },
  'pz-ws': { build: 'demo', vp: [1600, 1200], hash: BOOKEDIT, setup: [['click', '[data-act="add"][data-type="collection"]'], ['wait', 700], ['click', '#os-edit'], ['wait', 1200], ['click', '#pal [data-add="t:wordsearch"]'], ['wait', 1000], ['hide', '#meter']],
    scale: 2, crop: { pad: 18, sels: ['#paper'] }, alt: 'A Collection page with a word search on it: a ten by ten grid of letters with the words to find listed to its right, and ruled writing lines below.',
    callouts: [
      { sel: '#paper .pzg >> nth=0', at: 'bl', name: 'Letter grid', does: 'The words are hidden across and down. Each is in the list beside the grid.' },
      { sel: '#paper .pzr', at: 'tr', name: 'Puzzle block', does: 'The whole block: the title line, the grid and the word list. The grid is drawn as shapes and text, so it prints sharp.' }] },
  'pz-cw': { build: 'demo', vp: [1600, 1200], hash: BOOKEDIT, setup: [['click', '[data-act="add"][data-type="collection"]'], ['wait', 700], ['click', '#os-edit'], ['wait', 1200], ['click', '#pal [data-add="t:crossword"]'], ['wait', 1000], ['hide', '#meter']],
    scale: 2, crop: { pad: 18, sels: ['#paper'] }, alt: 'A Collection page with a crossword on it: a grid of numbered squares with the Across and Down clues listed to its right.',
    callouts: [
      { sel: '#paper .pzg >> nth=0', at: 'bl', name: 'Crossword grid', does: 'Numbered squares. The answers are blank unless you switch on Show answers.' },
      { sel: '#paper .pzr', at: 'tr', name: 'Clues', does: 'Across and Down clues, numbered like the grid. The clues are plain text next to the grid.' }] },

  // ---------- G2: accessibility ----------
  'a11y-gear': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, scale: 2, crop: { pad: 22 }, alt: 'The Settings button in the top bar, next to the 5.5 by 8.5 and 8.5 by 11 switch.',
    callouts: [{ sel: '#v-set', name: 'Settings', does: 'Opens the Settings sheet, where the print options for the whole book live.' }] },
  'a11y-print': { build: 'demo', vp: [1280, 800], hash: DAYEDIT, setup: [['click', '#v-set'], ['wait', 600]], scale: 2, crop: { pad: 18, sels: ['#settings'] }, alt: 'The Settings sheet, Printed book section: two switches, Large print and High-contrast ink, both off, each with a line saying what it does.',
    callouts: [
      { sel: '#settings [data-set="large"]', name: 'Large print', does: 'About 40% bigger type (nothing under 8.5 pt), taller check boxes and rows, darker 1.5 pt rules and the writing space ruled at 8.5 mm.' },
      { sel: '#settings [data-set="contrast"]', name: 'High-contrast ink', does: 'Grey text, rules, dots and grids print black, and rules are 2 pt. Nothing gets lighter.' },
      { sel: '#settings .acts button', name: 'Done', does: 'Closes the sheet. The choice is already kept.' }] },
  'a11y-effect': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, setup: [['click', '#v-set'], ['wait', 500], ['click', '#settings [data-set="large"]'], ['click', '#settings [data-set="contrast"]'], ['wait', 500], ['click', '#settings .acts button'], ['wait', 900], ['hide', '#meter']], scale: 2, crop: { pad: 14, sels: ['#paper'] }, alt: 'The busy sample day page with large print and high-contrast ink switched on: bigger type, black rules, and fewer blocks fit.',
    callouts: [{ sel: '#paper', name: 'The page', does: 'The preview changes as soon as you switch an option on. Compare it with the page in chapter {{ch:day}}.' }] },
  'a11y-focus': { build: 'demo', vp: [1600, 1000], hash: DAYEDIT, setup: [['key', 'Tab'], ['eval', "document.querySelector('#list > li .grip').focus()"], ['wait', 400]], scale: 2, crop: { pad: 24, sels: ['#list > li >> nth=0'] }, alt: 'The first block in the list with the keyboard focus on its grip: a thick outline marks where you are.',
    callouts: [{ sel: '#list > li >> nth=0 >> .grip', name: 'Focused grip', does: 'Tab moves through every control in order and a visible outline shows where you are. On a grip, Up and Down arrows move the block.' }] },

  // ---------- G2: releases ----------
  'rel-drawer': { build: 'studio', vp: [1400, 1000], hash: DAYEDIT,
    setup: [['click', '#v-ver'], ['wait', 700], ['fill', '#vs-user', 'sam'], ['fill', '#vs-pass', '@studio-password'], ['click', '#vs-conn button[type="submit"]'], ['wait', 1500], ['select', '#vs-proj', '@studio-project'], ['wait', 2000],
      ['eval', "document.querySelector('#vl').scrollIntoView({block:'start'})"], ['wait', 400]],
    crop: { pad: 18, sels: ['#vl'] }, alt: 'The Releases section of the Versions drawer, signed in as the project owner: the list holds one release, v0.9, and below it are a name box, a notes box and the Release button.',
    callouts: [
      { sel: '#vl-list [data-rel="v0.9"]', name: 'Download', does: 'Saves this release as a file, release-v0.9.json: the frozen snapshot and its manifest.' },
      { sel: '#vl-name', name: 'Release name', does: 'A name you choose, such as v1.0. A name that already exists is refused.' },
      { sel: '#vl-notes', name: 'Notes', does: 'What is in this release. Shown in the list.' },
      { sel: '#vl-form button[type="submit"]', name: 'Release', does: 'Freezes the latest saved version of the book under that name. It never changes afterwards.' }] },

  // ---------- G2: troubleshooting ----------
  'trouble-toofull': { build: 'demo', vp: [1600, 1200], hash: BOOKEDIT, setup: [['click', '[data-act="add"][data-type="collection"]'], ['wait', 700], ['click', '#os-edit'], ['wait', 1200], ['click', '#pal [data-add="t:wordsearch"]'], ['wait', 600], ['click', '#pal [data-add="t:crossword"]'], ['wait', 1000]],
    crop: { pad: 20, sels: ['#paper', '#meter'] }, alt: 'A Collection page with a word search and a crossword on it. A red warning above the page preview says Too full: the page overflows.',
    callouts: [
      { sel: '#meter .warn', name: 'Too full', does: 'The page overflows: something does not fit. Switch a block off, shorten it, or make a puzzle smaller.' }] },
  'trouble-kdp': { build: 'demo', vp: [1440, 960], hash: BOOKEDIT, setup: [['eval', "for (let i = 0; i < 40; i++) { const b = document.querySelector('[data-act=add][data-type=notes]'); if (b) b.click(); }"], ['wait', 1500]],
    maxW: 1200, alt: 'The Book view after 40 Notes pages were added to the sample book: the Pages panel shows 112 pages in red and says it is over the 110-page limit.',
    callouts: [
      { sel: '#og-body .kdp.bad', name: 'Over the limit', does: 'Says how many pages the book has, that 110 is the most for one printed book, and into how many volumes the plan would split it.' },
      { sel: '#bk-msg', at: 'tr', name: 'What just happened', does: 'The last change, in words, for example "Added Notes page 40 as page 112".' }] },
  'trouble-jump': { build: 'demo', vp: [1280, 760], hash: BOOK, setup: [['fill', '#bk-go', '999'], ['key', 'Enter'], ['wait', 500]], scale: 2, crop: { pad: 20, sels: ['#bk-go'] }, alt: 'The jump box above the Book canvas with 999 typed in, and the message under it saying there is no page 999 and the book has pages 1 to 72.',
    callouts: [
      { sel: '#bk-go', name: 'Jump box', does: 'A page number is only accepted inside the book.' },
      { sel: '#bk-msg', at: 'tr', name: 'Message', does: 'Says what is wrong and what the range is. Nothing moved.' }] },

  // ---------- phone ----------
  'phone-edit': { build: 'demo', vp: [390, 844], hash: DAYEDIT, scale: 2, maxW: 780, alt: 'The editor on a phone, 390 pixels wide: the page preview fills the screen and the blocks sit in a sheet at the bottom.',
    callouts: [
      { sel: '#sheet-t', name: 'Sheet handle', does: 'Collapses or opens the blocks sheet, so you can see the whole page.' },
      { sel: '.tabs [data-tab="add"]', name: '+ Add', does: 'Switches the sheet from your blocks to the palette of blocks to add.' }] },
};

// Chapters. A part is one of: {p} paragraph (HTML) {shot} {ref: id of an image from site/img/shots, with its own alt} {code} {note} {ul: [..]} {steps: [..]}
const BASE = [
  { id: 'open', title: 'Open the editor', time: '1 min',
    lead: 'The editor is a web page. You can try it with sample data first, then open your own copy.',
    parts: [
      { p: 'There are three ways in. Pick one:' },
      { ul: [
        '<b>Try the demo.</b> <a href="../editor/">Open the editor demo</a>. It has a sample book called Northlight. Nothing you do is saved anywhere, so you cannot break it.',
        '<b>Your own copy on the web.</b> If you set up the project\'s site (see <a href="https://github.com/shelbeeely/Journaling/blob/main/SETUP.md">SETUP.md</a>), your working editor is at <code>/app/</code> on that site. It saves in your browser and can commit to your repository.',
        '<b>On your computer.</b> It is one file with no server. Needs Node 20 or newer.' ] },
      { code: 'cd journal && npm ci\nKW_PROFILE=content/profile.example.json KW_OUT=out-sample node render.mjs month 2026-10 test.ics\nKW_PROFILE=content/profile.example.json KW_OUT=out-sample node editor/build.mjs\n# then open journal/editor/dist/site/index.html in your browser', label: 'Build the editor yourself' },
      { shot: 'open-demo' },
      { p: 'The editor has five zoom levels. You move between them with one row of buttons, and you can always tell where you are from the breadcrumb.' },
      { shot: 'levels' },
      { note: 'Keyboard: <kbd>L</kbd> Library, <kbd>0</kbd> Book, <kbd>1</kbd> Spread, <kbd>2</kbd> Day, <kbd>E</kbd> edit, <kbd>Esc</kbd> done.' } ] },

  { id: 'profile', title: 'Choose a profile and a trim', time: '3 min',
    lead: 'The profile is who and where the book is for. The trim is the paper size. Both are set once and every page follows them.',
    parts: [
      { p: 'A <b>profile</b> is one small file, <code>journal/content/profile.json</code>: your name, the book title, where you live (for the sun and moon), your time zone, when your day starts and which trim to print. Nothing personal lives in the code. To start your own, the quickest way is the setup command in chapter {{ch:start}}, which asks the questions and writes the file. Or copy the generic example and edit it:' },
      { code: 'cp journal/content/profile.example.json journal/content/profile.json', label: 'Make your profile' },
      { code: '{\n "person": { "name": "Sam" },\n "book": { "title": "Northlight", "start": "2026-10", "edition": 1 },\n "location": { "place": "Lakemont, MN", "timezone": "America/Chicago" },\n "day_start_hour": 5,\n "trim": "small"\n}', label: 'The main fields (the example file has more)' },
      { p: 'The editor shows the same facts as a sheet you can change without editing a file. Switch to edit mode on the Book view, then open Book settings.' },
      { shot: 'book-settings-btn' },
      { shot: 'book-settings' },
      { p: '<b>Trim</b> is the printed page size. KDP in the US offers 5.5 by 8.5 inches and 8.5 by 11 inches (A5 is not offered). A paperback needs 24 to 110 pages. A hardcover needs at least 75 pages on KDP, and this tool builds at least 76 so the count stays even. The top bar switches the preview between the two. The print follows the same choice.' },
      { shot: 'trim' } ] },

  { id: 'day', title: 'Build a day page from blocks', time: '5 min',
    lead: 'A day page is a stack of blocks. You choose the blocks, the order and the options. The preview is the real page.',
    parts: [
      { p: 'Open a day: press the <b>Day</b> button, or press a page twice in the Book view. A day page opens read-only, so you cannot change it by accident.' },
      { shot: 'day-view' },
      { p: 'Press <b>Edit</b>. The screen splits into three areas.' },
      { shot: 'day-edit' },
      { p: 'The header (date, title and tags) shows a small padlock. It is fixed on purpose, so the scanner and the app can always find it.' },
      { h3: 'Add a block' },
      { shot: 'add-block' },
      { h3: 'Reorder, hide and remove' },
      { shot: 'block-row' },
      { h3: 'Set a block\'s options' },
      { p: 'Each block lists its own choices: how many lines, how tall, which rows, which words. The block\'s name or the small arrow opens them.' },
      { shot: 'block-options' },
      { h3: 'Start from a method' },
      { p: 'You do not have to start with a blank list. The editor has ready-made arrangements built from the methods library (bullet journal, time blocking, a care check-in and others). The result is just blocks, so you can change any of it.' },
      { shot: 'method-menu' },
      { h3: 'Changed your mind' },
      { shot: 'undo' },
      { h3: 'On a phone' },
      { p: 'On a narrow screen the preview comes first and the blocks live in a sheet at the bottom. Everything above works the same, with large touch targets.' },
      { shot: 'phone-edit' },
      { p: 'The same blocks build more than the day page. A day can cover a whole spread (chapter {{ch:spreads}}), Notes, blank and Collection pages are made of blocks (chapter {{ch:blocks}}), and the Puzzles group adds a word search and a crossword (chapter {{ch:puzzles}}).' } ] },

  { id: 'grid', title: 'Size blocks on the grid', time: '4 min',
    lead: 'Flow mode stacks blocks for you. Grid mode lets you put each one exactly where you want it and choose its size.',
    parts: [
      { p: 'Use <b>Flow</b> first. Switch to <b>Grid</b> when you want two blocks side by side, a tall sketch box, or a narrow column of check-ins next to a wide writing area.' },
      { shot: 'grid-toggle' },
      { p: 'The page is a grid of <b>4 columns by 24 rows</b>. Blocks snap to it, so nothing overlaps and nothing hangs off the edge.' },
      { shot: 'grid-page' },
      { p: 'Open a block in the list. In Grid mode it has four steppers.' },
      { shot: 'grid-steppers' },
      { p: 'Drag works too: grab a block on the preview and drop it where you want it. The writing-space number at the top tells you what is left. If a change would push a block off the page, the editor says why and does not apply it.' } ] },

  { id: 'book', title: 'Organise pages in the Book view', time: '5 min',
    lead: 'The Book view shows the whole book. Use it to find a page, to see the order, and to move, hide or add pages.',
    parts: [
      { p: 'Press <b>Book</b> in the zoom row. Every page is drawn where it prints, in facing spreads. Page 1 sits alone on the right, like a real book.' },
      { shot: 'book-view' },
      { shot: 'book-bar' },
      { p: 'Press <b>Spread</b> for two facing pages at reading size. Press <b>Day</b> to edit a day page.' },
      { shot: 'spread-view' },
      { h3: 'Move, hide, add and remove pages' },
      { p: 'Press <b>Edit</b> on the Book view. A Pages panel opens with the page count and a check against the KDP limits.' },
      { shot: 'org-open' },
      { p: 'Press a page to select it. A toolbar appears under the canvas.' },
      { shot: 'org-pick' },
      { shot: 'org-select' },
      { note: 'A page that other pages point to cannot be removed without a warning, because a printed link would point at nothing. The editor tells you which pages are affected, and Undo brings it back.' },
      { p: 'The panel also asks <b>which months a change applies to</b>: all of them, or one. Use <i>Only</i> when one month needs an extra page and the others do not.' } ] },

  { id: 'scan', title: 'Set scan options', time: '2 min',
    lead: 'Every page carries a small code so a scan can tell which page it is. These are the choices that go with it.',
    parts: [
      { p: 'The <b>date, title and tags</b> header, the <b>9 pt frame</b>, the <b>send-to strip</b> and the <b>page code</b> are the scan zones. You can move the code and switch it off, but the zones themselves stay put so a scan always knows where to look.' },
      { ref: 'page-day' },
      { shot: 'scan-open' },
      { shot: 'scan-sheet' },
      { note: 'Personal pages that hold password hints, such as the Keeper in the full project, never get scan codes.' } ] },

  { id: 'save', title: 'Save, share and keep versions', time: '4 min',
    lead: 'Your work is kept in your browser. Download it when you want a copy, and save a version when you want to be able to go back.',
    parts: [
      { p: 'The editor saves a draft in your browser as you work. A <b>download</b> is a copy you can keep, email or load on another computer.' },
      { shot: 'save-menu' },
      { p: 'A <b>version</b> is a named snapshot with a message. Use them like save points. They work with no account: until you sign in to a Studio server, they live in your browser.' },
      { shot: 'ver-open' },
      { shot: 'ver-save' },
      { p: 'Save a second version after you change something, then compare the two.' },
      { shot: 'ver-log' },
      { p: 'If you sign in to a Studio server (<a href="https://github.com/shelbeeely/Journaling/blob/main/studio/README.md">studio/README.md</a>), the same drawer also gives you branches, forks and proposals, so more than one person can work on a book. Private pages, calendars and profile secrets are never put in a version. A named, frozen copy of a version is a <b>release</b> (chapter {{ch:releases}}).' } ] },

  { id: 'print', title: 'Export a KDP-ready PDF', time: '10 min',
    lead: 'The build writes an interior and a cover that pass the checks Amazon KDP asks for. The editor does not print: the build does.',
    parts: [
      { p: 'Build one month with the sample calendar. For your own book, replace <code>test.ics</code> with your calendar files (they stay on your computer and are never committed).' },
      { code: 'cd journal\nnode render.mjs month 2026-10 test.ics          # 5.5x8.5 interior, into out/m2026-10/\nSIZE=letter node render.mjs month 2026-10 test.ics   # 8.5x11, into out/m2026-10-letter/\nnode cover.mjs month 2026-10                      # the wrap-around cover, sized to the page count', label: 'Build the interior and the cover' },
      { p: 'Or build every month and both sizes at once with <code>./build-all.sh</code>.' },
      { ref: 'cover-month' },
      { p: '<b>Check before you upload.</b> These are the same checks the project runs on every build:' },
      { code: 'node check.mjs m2026-10               # must print [] 0: no page overflows\npdffonts out/m2026-10/*interior*.pdf | grep "Type 3"   # must print nothing: KDP rejects Type 3 fonts\npdfinfo out/m2026-10/*interior*.pdf | grep Pages        # even; paperback 24 to 110, hardcover 76 or more', label: 'The three checks' },
      { ul: [
        '<b>Overflow:</b> <code>[] 0</code> means every page fits. Anything else lists the page numbers that spill.',
        '<b>Fonts:</b> no Type 3 fonts. Emoji and odd glyphs are drawn as shapes, so there should be none.',
        '<b>Pages:</b> an even count in the KDP range. The Pages panel in the Book view shows this too.' ] },
      { p: 'Then, on KDP:' },
      { steps: [
        'Sign in at kdp.amazon.com, press <b>Create</b>, then <b>Paperback</b>.',
        'Fill in the details. Choose <b>black and white interior, white paper</b>, the trim you built, and <b>no bleed</b>.',
        'Upload the interior PDF as the manuscript and the cover PDF as the cover.',
        'Open the previewer and look at every page before you order a proof.' ] },
      { note: 'Keep proofs private: order one, never publish a book that prints your own calendar. One KDP title per design and per size. <a href="https://github.com/shelbeeely/Journaling/blob/main/journal/KDP.md">journal/KDP.md</a> has the full walkthrough, including hardcover and the cover-width formula.' } ] },

  { id: 'x4', title: 'Optional: the X4 e-ink companion', time: 'optional',
    lead: 'A small e-ink device that shows today and takes button check-ins, with no phone, no feed and no notifications.',
    parts: [
      { p: 'The Xteink X4 runs the project\'s firmware. It shows today on its sleep screen, takes check-ins with its buttons, has a focus timer, and keeps everything on its SD card. Nothing leaves the device except over its own Wi-Fi hotspot, or an explicit sync you start on the device.' },
      { p: 'Four of its screens, in the order you meet them:' },
      { refs: [
        { id: 'x4-checkin', alt: 'The X4 Check in screen: spoons left shown as a row of pins, sleep hours, anxiety as four circles, and tick boxes for self-care and little wins. The Tick button at the bottom ticks the highlighted row.', cap: 'Check in: Tick marks the highlighted row.' },
        { id: 'x4-focus', alt: 'The X4 Focus screen: a large time of 1:35 p.m., the line Focus until 1:35p, round 1 of 4, and the footer showing battery and that the screen is silent and wakes itself.', cap: 'Focus: a quiet timer.' },
        { id: 'x4-settings', alt: 'The X4 Settings screen: rows for text size, contrast, buttons, sleep after, cleaning the screen and the hold time for Support. The Change button at the bottom changes the highlighted row.', cap: 'Settings: text size and contrast.' },
        { id: 'x4-wifi', alt: 'The X4 Wi-Fi screen with the radio off: five rows, Hotspot (its own network, no internet), On my Wi-Fi, Join a network, Saved networks and Sync with Studio (send check-ins, on demand). The line under the rows says the hotspot is its own network, no internet, and nothing is sent anywhere.', cap: 'Wi-Fi: five rows, and the radio is off until you pick one.' }] },
      { p: 'Settings are on the device: text size, contrast and button layout. To move files, open Wi-Fi and choose Hotspot. The X4 makes its own network. Join it from a phone to set the clock, download your logs and upload new books. The radio is off until you pick a row, and it goes off again when you leave the screen. <b>Sync with Studio</b> sends your check-in log to your own Studio account, only when you press Send. It needs the separate <code>x4-tls</code> firmware build: the default image shows the row, says so, and sends nothing. Sync is built but untested on real hardware.' },
      { p: 'The build makes an X4 EPUB for each month (<code>python3 epub.py m2026-10</code>) and the SD-card files. Setup and the firmware build are in <a href="https://github.com/shelbeeely/Journaling/blob/main/x4/README.md">x4/README.md</a>.' },
      { note: 'Where it stands. The firmware compiles and every screen above renders in a computer-side preview. Bring-up on a real device (buttons, screen refresh, battery, the Wi-Fi join, a real sync) is still open work, so treat the X4 as optional and unproven on hardware.' } ] },
];

// ---------- G2 chapters (BUILD-PLAN section 21). Each says what is built and what is not. {{ch:id}} becomes that chapter's number. ----------
const REPO = 'https://github.com/shelbeeely/Journaling/blob/main/';

const START = { id: 'start', title: 'Start your own book and add packs', time: '10 min',
  lead: 'One command asks a few questions, writes your profile and builds a sample book. Packs are the folders that hold regional facts, such as support numbers.',
  parts: [
    { p: 'This chapter is the command line. The editor has no screen for it, so there are no pictures to press: every step is a command and what it prints. You need Node 20 or newer (CI uses 22), Python 3 with <code>pillow</code>, and Chromium.' },
    { code: 'git clone <this repository> && cd Journaling/journal\nnpm ci && npx playwright-core install chromium && pip install pillow\nnpm run init', label: 'From a fresh clone to your first sample PDF' },
    { p: '<code>npm run init</code> asks the questions below. Every one has a default: press <kbd>Enter</kbd> to take it.' },
    { ul: [
      '<b>Name, book title, subtitle.</b> Used on the title page, the cover, the spine and in file names.',
      '<b>Where you are.</b> Pick a city from a short list, or type a place with its latitude, longitude and time zone. It sets sunrise and sunset, the moon, the seasons and the time zone on every clock time.',
      '<b>The hour your day starts.</b> A whole number from 0 to 8. With 5, 2 a.m. still belongs to yesterday.',
      '<b>Trim.</b> <code>small</code> (5.5 by 8.5) or <code>letter</code> (8.5 by 11).',
      '<b>Modules.</b> The moon and sky pages, spoons, therapy blocks and, if your pack has them, trans support and bus pages.',
      '<b>Content pack.</b> Which pack fills the Support page. <code>generic</code> is the start.',
      '<b>Book scope and first month.</b> One month per book, a quarter, a season, half a year, a year, your own dates, or an undated book.' ] },
    { p: 'When it finishes it has written <code>content/profile.json</code> (it never overwrites one without asking), made your <b>book id</b> and built a sample book from the made-up calendar <code>test.ics</code>. The id is eight characters, different for every book, and it keeps your scan codes apart from every other book\'s. The end of a run looks like this (shortened):' },
    { code: 'Wrote content/profile.json (book id 92W8QJHR: it keeps your scan codes apart from every other book\'s).\nBuilding a sample book from test.ics (about a minute)...\nbook 2026-10: 2026-10-01 -> 2026-10-31, 5 weeks, 72 pages\nOverflow check: [] 0 (every page fits)\nSample book: out-sample/m2026-10/northlight-2026-10-interior-5.5x8.5.pdf (in this folder)', label: 'What init prints' },
    { p: 'Open that PDF. Every page is the same shape as your real one will be. Then init lists what to do next: put your own calendar in <code>private/</code> (it is git-ignored and never uploaded), build with <code>node render.mjs month 2026-10 private/your.ics</code>, and open the editor.' },
    { h3: 'Without a keyboard' },
    { p: 'Every question is also a flag, so init runs in a script or a scratch folder. <code>--yes</code> takes the default for anything you did not give and never asks.' },
    { code: 'npm run init -- --yes --name Sam --title "Northlight" --city chicago --modules sky,spoons --scope month --start 2026-10\nnode init.mjs --help          # every flag; --city list shows the built-in places', label: 'Flags instead of questions' },
    { note: 'If a profile already exists, init stops with "Not overwriting ... Use --profile &lt;another file&gt; to write a new one beside it, or --force to replace it. Nothing was written." Your profile holds your name and place. If your copy of the repository is public, add <code>content/profile.json</code> to <code>.gitignore</code>.' },
    { h3: 'Packs' },
    { p: 'A <b>pack</b> is a folder of data that a book reads: a region\'s support numbers, a transit feed, extra holidays, a table of seasons, word lists for puzzles. The engine holds nothing regional, a pack does, and a pack is only data: nothing in it runs. The one that ships for general use is <code>generic</code>. It has two United States lines, each with a dated source, and a placeholder that prints "Add your local numbers here". The engine never fills in a phone number for you.' },
    { p: 'The kinds of pack, each with one data file:' },
    { ul: [
      '<code>support</code>, <code>trans-support</code> and <code>clinic</code>: support, trans and clinic contacts. These are <b>personal</b>: they never go into a Studio version, fork or proposal.',
      '<code>transit</code>: a transit agency\'s schedules. <code>holidays</code>: extra observances. <code>seasons-history</code>: the 72 micro-seasons. <code>puzzles</code>: word lists for the puzzle blocks (chapter {{ch:puzzles}}). These are public.',
      '<code>region</code>: a bundle of any of the above for one place.' ] },
    { p: 'Make one from a starter, seal it, check it, then name it in your profile:' },
    { code: 'node packs-cli.mjs new support my-town        # copies packs/_template/support/ to packs/my-town/\n# edit packs/my-town/support.json\nnode packs-cli.mjs seal my-town               # records the sha256 of each file in pack.json\nnode packs-cli.mjs check my-town              # every check; fix what it reports\n# then in content/profile.json:   "paths": { "support": "my-town" }', label: 'Make a pack' },
    { p: '<b>Sealing</b> matters: <code>seal</code> records a hash for each file, and the build stops if a file no longer matches, so a reprint uses exactly what you checked. Change a file, run <code>seal</code> again. <code>node packs-cli.mjs kinds</code> prints every kind\'s data format and how the build uses it.' },
    { p: '<b>The verification rule.</b> The build refuses to print support, trans support or clinic pages when any item has no verification note: <code>"verified": {"who", "date", "source"}</code>, with the date as YYYY-MM-DD and the source the organisation\'s own page. An item can instead be a placeholder, or say it is unchecked on purpose (<code>"verified": false</code> with <code>"checkBeforePrinting": true</code>), in which case the build prints it and warns you every time. Re-check every number before each print run: numbers and hours change.' },
    { note: 'There is no packs screen in the editor yet: a pack is a folder you edit and a command you run. Other pack kinds in the plan (themes, fonts, icons, block packs, language and prompt packs, starter kits) are not built. A Credits page for packs is not built either; each build writes <code>manifest.json</code> with the pack id, version, hash and credit instead. Full details: <a href="' + REPO + 'journal/PACKS.md">journal/PACKS.md</a> and <a href="' + REPO + 'journal/GUIDE.md">journal/GUIDE.md</a>.' } ] };

const LIBRARY = { id: 'library', title: 'Library, series and your own titles', time: '6 min',
  lead: 'Two levels sit above the Book: the Library, where all your books live, and a Series, a set of books that share defaults and a number order.',
  parts: [
    { p: 'Press <b>Library</b> in the zoom row (or <kbd>L</kbd>). You see a shelf of covers. A <b>series</b> is drawn as a stack. A book on its own is a single cover. The covers are the real title page of each book.' },
    { shot: 'lib-shelf' },
    { p: 'Press a cover to open it. A series opens to its books in order, as Book 1, Book 2 and so on. A library with only one book skips the shelf and opens straight to the book; the Library button still shows the shelf. A book that is on its own has no Series level above it.' },
    { h3: 'Edit the shelf' },
    { p: 'Press <b>Edit</b>. The toolbar gains the buttons below, and every cover gets its own controls.' },
    { shot: 'lib-edit' },
    { shot: 'lib-card' },
    { h3: 'Give a book its own title' },
    { p: 'Press a book\'s <b>Settings</b> button. A sheet opens at the side (at the bottom on a phone). A book has its own <b>title</b>, <b>subtitle</b> and <b>spine title</b>, so a book in a series does not have to carry the series name. The sheet also holds the series it belongs to, its length, first month, edition, cover style and modules. A setting you leave alone says where it comes from: "Same as the series (Season)" or "Same as the default (1)". Press <b>Save</b>, or Cancel to change nothing.' },
    { shot: 'book-sheet' },
    { p: 'The cover redraws with the new title, and the series line, "Book 1 of 3 in Season journals", comes from the book\'s place in the series.' },
    { shot: 'series-books' },
    { h3: 'Series defaults' },
    { p: 'Press a series\' <b>Settings</b> button. The sheet holds the series title and subtitle, its books in order (use the arrows, or drag the grip; the order is the numbering), and the <b>defaults every book takes</b> unless it sets its own: length, Keeper, closing page, edition, cover style and which modules are on. Two checkboxes put the series line on the cover and on the title page.' },
    { shot: 'series-sheet' },
    { p: '<b>Duplicate</b> makes a copy (a series copy brings a copy of each of its books). <b>Delete</b> always asks first: for a series you choose to keep its books or delete them too. Undo, in the toolbar or in the bar at the bottom, takes a delete back; it holds the last 40 changes.' },
    { h3: 'Where it is kept' },
    { ul: [
      '<b>In your browser.</b> With no account, the library lives in this browser. If the browser blocks storage, the editor says "This browser can\'t keep your library (its storage is blocked). Export it from Edit mode to keep a copy."',
      '<b>In a file.</b> <b>Export</b> saves <code>library.json</code>. <b>Import</b> checks a file and, after a question, replaces the library. Put the file at <code>journal/content/library.json</code> and the build reads it: <code>KW_BOOK=&lt;book id&gt; node render.mjs ...</code> builds one book of the library.',
      '<b>In a Studio project.</b> When you are signed in to one, the library travels with the project\'s versions (chapter {{ch:save}}).',
      '<b>In the demo.</b> It starts from a made-up library and saves nothing.' ] } ] };

const SPREADS = { id: 'spreads', title: 'Days that cover a spread', time: '5 min',
  lead: 'A day can cover one page, or a whole spread: a left page and a right page treated as one canvas.',
  parts: [
    { p: 'Open a day and press <b>Edit</b> (chapter {{ch:day}}). At the top of the block list is a box called <b>This day covers</b>.' },
    { shot: 'span-box' },
    { steps: [
      'Press <b>A spread: a left and a right page</b> to make this one day a spread.',
      'Or tick <b>Every Wednesday is a spread</b> (it names the weekday of the day you are on) to make every day on that weekday a spread, or <b>Every day is a spread</b> for all of them. The most specific choice wins.',
      'Read the note under the choices. It says how many Notes pages were added by themselves and gives the new page count with the KDP check.' ] },
    { p: 'The preview becomes a <b>two-page canvas</b>: 8 columns by 24 rows, with the fold after column 4. The two pages are always laid out together, so a spread is always on the grid and the Flow and Grid switch is not shown. Drag a block anywhere on either page, or use its steppers; <b>a block stays wholly on one page and nothing crosses the fold</b>. A move that would break a rule is refused and the editor says why.' },
    { shot: 'span-canvas' },
    { h3: 'What it does to the book' },
    { ul: [
      '<b>It opens on a left page.</b> A spread day always starts on a left-hand page, so when the page before ended on the left, a Notes page is added to pad it. Page counts, hardcover padding, volumes and the 110-page limit follow. The KDP note under the choices says whether you are still in range: 24 to 110 pages for a paperback.',
      '<b>Each page keeps the scan zones.</b> Both pages have their own DATE, TITLE and TAGS header (the right page\'s date says "cont."), frame, SEND TO strip and page code. The right page\'s id is <code>day.DATE.cont</code>.',
      '<b>Your layout is saved</b> with your day layout (<code>daypage.json</code>, as <code>spread</code>) only when it differs from the starting spread: the day on the left and a ruled page on the right. Which days are spreads is saved in the book (<code>book.json</code>), and the Pages panel in the Book view shows it on the Day pages row.',
      '<b>An undated book</b> honours "every day" only; there are no weekdays or dates to pick.' ] },
    { h3: 'On a phone' },
    { p: 'The canvas shows one page at a time, with a <b>Left page</b> and <b>Right page</b> switch above it.' },
    { shot: 'span-phone' },
    { note: 'Not built yet: a one-page day with a different layout from the others, a block that runs across the fold, and rearranging a spread for large print. While you are on a spread day, the print Settings switches are disabled with the line "Open a one-page day to change these: they apply to every day page, spreads included."' } ] };

const BLOCKS = { id: 'blocks', title: 'Notes, blank and Collection pages from blocks', time: '5 min',
  lead: 'A Notes, blank or Collection page is built from the same blocks as a day page, on a grid of its own.',
  parts: [
    { p: 'Three page types are made of blocks. <b>Notes</b> and <b>Collection</b> pages keep the DATE, TITLE and TAGS header at the top and have 4 columns by 24 rows. A <b>blank</b> page has no header, so its grid is 4 columns by 27 rows. Blocks that read a day (the moon and sun, holidays, events, the daily fact, the rotating prompt, the 24-hour line, the week strip) and the SEND TO block are day-page only, so they are not offered. The scan frame, the SEND TO strip and the page code are the page\'s own and never move.' },
    { h3: 'Add a page' },
    { steps: [
      'Open the <b>Book</b> view and press <b>Edit</b>, then open the <b>Pages</b> panel.',
      'Scroll to the bottom of the panel. Under <b>Where</b>, choose the page the new one goes before.',
      'Press <b>Add a Notes page</b> or <b>Add a Collection page</b>. The page is added and selected.' ] },
    { shot: 'og-add' },
    { p: 'A selected page you added gets a toolbar under the canvas with <b>Edit blocks</b>, <b>Duplicate</b>, <b>Remove</b> and a <b>Title</b> box. Pages that came with the book cannot be removed, only hidden; the Notes pages the book adds by itself to keep spreads facing have no controls at all.' },
    { shot: 'og-new-page' },
    { h3: 'Edit its blocks' },
    { p: 'Press <b>Edit blocks</b>. The page opens in the day page editor: palette, option panels, Flow and Grid, Undo and the writing-space meter all work as in chapter {{ch:day}}. You can also open any Notes, blank or Collection page by pressing <b>Edit</b> on its page view, or with the address <code>#page/&lt;page id&gt;/edit</code>. A Notes or Collection page must keep its Writing space block; a blank page may have none.' },
    { shot: 'blockpage' },
    { p: 'Every change is saved into the book, the same place the page organiser saves to. The preview uses sample data. The blank page that comes with the sample book works the same way:' },
    { shot: 'blank-page' },
    { note: 'Not built yet: a SEND TO block or scan settings for these pages, and the month, week, review and back-matter pages as blocks. Those pages stay as they are. A page you leave unedited prints exactly as before.' } ] };

const PUZZLES = { id: 'puzzles', title: 'Puzzles: word search and crossword', time: '4 min',
  lead: 'Two blocks that draw a puzzle on the page, for paper only.',
  parts: [
    { p: 'The <b>Puzzles</b> group in the palette has a <b>Word search</b> and a <b>Crossword</b>. They work on day pages and on the block pages of chapter {{ch:blocks}}.' },
    { shot: 'pz-palette' },
    { p: 'Press the <b>+</b> of one. The block joins the list; press its name to open its options.' },
    { shot: 'pz-options' },
    { ul: [
      '<b>Grid size</b> (word search) or <b>Largest grid</b> (crossword). Bigger grids need more of the page.',
      '<b>Difficulty.</b> Word search: easy hides words across and down, medium adds diagonals, hard adds backwards words. Crossword: fewer short words, more words, or most and longer words.',
      '<b>Words from.</b> Built-in lists (garden, kitchen, sky and calm), your own puzzles pack, or your own words. For your own words, type them separated by commas; for a crossword write each as <code>word=clue</code> with no commas. With too few usable words the block falls back to a built-in list instead of printing an empty puzzle.',
      '<b>Seed.</b> The puzzle is made from the page, the block and the seed, so the same page prints the same puzzle every time you reprint. Type a different seed for a different puzzle.',
      '<b>Show answers</b> prints the solution. <b>Large print</b> makes the cells and letters bigger.' ] },
    { shot: 'pz-ws' },
    { shot: 'pz-cw' },
    { p: 'The grids are drawn as shapes and real text, so they print sharp and pass the font check. Each grid has a text description for screen readers and the word list or the clues are ordinary text.' },
    { note: 'Two limits to know. <b>The editor preview always uses the built-in lists</b>: your own puzzles pack (<code>paths.puzzles</code> in the profile, chapter {{ch:start}}) is read by the print build only, so choose it, then check the real PDF. And a puzzle needs room: both on one page overflow it (chapter {{ch:trouble}}). Not built yet: a separate answer-key page at the back, whole-page and spread puzzles, and other alphabets than A to Z. There is no puzzle solving on the X4.' } ] };

const ACCESS = { id: 'access', title: 'Accessibility options', time: '5 min',
  lead: 'Two print options for the whole book, and what the editor itself does for keyboards, screen readers and low vision.',
  parts: [
    { h3: 'Print: large print and high-contrast ink' },
    { p: 'Both are off by default, and with both off the book prints exactly as before. Open the <b>Settings</b> button in the top bar.' },
    { shot: 'a11y-gear' },
    { shot: 'a11y-print' },
    { ul: [
      '<b>Large print.</b> Small type about 40% bigger (nothing under 8.5 pt, headings less, page titles not at all), taller check boxes, mood marks and rows, 1.5 pt rules, and the writing space ruled at 8.5 mm instead of dots. To make room the day page keeps two action lines and leaves out the "On this day" line. The mood scale has 5 steps, water 6 boxes, meals 3.',
      '<b>High-contrast ink.</b> Light and mid greys (text, rules, dots, grids, borders) print black or near black, and rules are 2 pt. Fills stay, and nothing is lighter than before.',
      '<b>It never moves the scan zones:</b> the DATE, TITLE and TAGS header, the border, the SEND TO strip and the page code stay as they are. Both work on 5.5 by 8.5 and on 8.5 by 11, and the choice is stored with your layout (<code>daypage.json</code>, <code>print</code>) or in the profile (<code>print</code>).' ] },
    { p: 'The preview changes as soon as you switch one on.' },
    { shot: 'a11y-effect' },
    { note: 'Read this before you rely on it. Large print makes the page fuller, and the preview uses a busy sample day, so it may say "Too full" even though a real day has less on it. The print build is what counts: a page type whose content cannot hold the bigger type steps down in small steps until every page fits (the build says so, for example "large print: support 1x"), so nothing is clipped and page counts do not change. A Grid layout stays as you placed it, and <code>check.mjs</code> names a block that does not fit. If your profile already has an option on, the switch is locked and says "On in profile.json: change it there." Not built yet: dyslexia-friendly type, handedness, low-clutter pages, a Grid layout that adjusts itself, and large-print thumbnails in the Book view.' },
    { h3: 'In the editor' },
    { ul: [
      '<b>Keyboard.</b> Every control can be reached with Tab and shows an outline where you are. A block\'s grip moves it with the Up and Down arrows. <kbd>E</kbd> edits, <kbd>Esc</kbd> goes up a level or finishes editing, <kbd>Alt</kbd>+<kbd>Up</kbd> and <kbd>Alt</kbd>+<kbd>Down</kbd> change level, <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes.',
      '<b>Screen readers.</b> Controls have names. Changing level announces "Now at: ..." and moves focus to the current crumb. A warning such as "Too full" is announced once when it appears. The puzzle grids carry a text description.',
      '<b>Touch.</b> Controls are 44 pixels or more, with one known exception below. At 390 pixels wide the page does not scroll sideways.',
      '<b>Colour and motion.</b> Light and dark follow your device. A "more contrast" setting on the device strengthens the colours. If you asked for reduced motion, level changes and drag animations are instant.',
      '<b>Language.</b> The editor is in English only today. Its words are all in one catalog, ready for translation, but there is no language switcher yet.' ] },
    { shot: 'a11y-focus' },
    { p: 'The project checks the editor with an automated test (<code>journal/editor/test-a11y.mjs</code>: axe, target sizes, reflow, focus, announcements, reduced motion). It lists three <b>known gaps</b>: the Blocks, + Add and Preview tabs on a phone do not move with the arrow keys; a block moved by keyboard in Grid mode is not announced; and one-row blocks in Grid mode are 21 pixels tall (the grid cell is the layout), though the steppers and the keyboard do the same job.' },
    { p: 'The X4 has its own text size and contrast settings (chapter {{ch:x4}}).' } ] };

const RELEASES = { id: 'releases', title: 'Releases and reusable pages', time: '4 min',
  lead: 'A release is a named, frozen copy of a saved version, so a printed book can always be traced back to what it was made from.',
  parts: [
    { p: 'Releases need a <b>Studio server</b> and a project on it (chapter {{ch:save}}). The public demo and a guest\'s browser-only versions have none: until you open a server project the Releases section is not shown. To try it, build the editor (chapter {{ch:open}}), run <code>cd studio &amp;&amp; npm start</code> (Node 22.13 or newer, nothing to install) and open <code>http://127.0.0.1:8787/</code>. Press <b>Versions</b>, create an account, then choose <b>New project on my account</b> (or <b>Move it to my account</b>). You are that project\'s owner.' },
    { shot: 'rel-drawer' },
    { steps: [
      'Save a version of the book first (chapter {{ch:save}}). A release is made from the <b>latest saved version</b>, never from your unsaved draft.',
      'In the <b>Releases</b> section of the Versions drawer, type a <b>Release name</b>, such as v1.0, and optional <b>Notes</b>.',
      'Press <b>Release the latest saved version</b>. A name that already exists is refused with the server\'s reason, and nothing changes.',
      'Press a release\'s <b>download</b> button to save <code>release-NAME.json</code>.' ] },
    { p: 'Only a project\'s <b>owner</b> can make a release. Anyone who can read the project sees the list and can download one, and for a public project that includes people with no account. A release never changes: the server refuses to edit or delete one. It holds the commit, the print settings, public pack references and a manifest with the hash of the two files the build reads (<code>content/book.json</code> and <code>daypage.json</code>), so a later build can be proven to come from exactly that release. Before it is made, the server checks that nothing private is in it, and if it finds something, nothing is written.' },
    { note: 'What a release is not. <b>It does not store a PDF</b>: the Books workflow builds PDFs from the exported files, and the manifest ties a PDF to the release. There is no way to delete or rename a release.' },
    { h3: 'Reusable pages' },
    { p: 'The Studio also keeps a <b>personal library of reusable pages and block layouts</b>, which can be inserted into a book by copy, with attribution and a link to the version they came from. <b>This has no screen in the editor yet.</b> It is only in the server\'s programming interface (<code>/api/library</code> and <code>/api/projects/:id/insert</code>), so there is nothing to press in the Versions drawer. Protected pages, module pages and private content are refused, and inserting a layout into a Grid day layout is refused. Details and the list of limits are in <a href="' + REPO + 'studio/README.md">studio/README.md</a>.' } ] };

const TROUBLE = { id: 'trouble', title: 'When something goes wrong', time: 'as needed',
  lead: 'The messages you can meet, what each one means and what to press. They are the real wording from the editor and the build.',
  parts: [
    { h3: 'A page overflows' },
    { p: 'In the editor, the <b>writing space</b> number at the top of the preview warns in three steps: <b>Getting tight</b>, <b>Too full for busy days</b> and <b>Too full: the page overflows. Switch something off or shorten a block.</b> It reads a busy sample day, so judge by the message, not only the number.' },
    { shot: 'trouble-toofull' },
    { steps: [
      'Switch the block you can live without off with its switch (it keeps its settings), or remove it.',
      'Or shorten a block: fewer lines, a smaller grid, fewer rows.',
      'In Grid mode, if you add a block with no room, the editor says "No room for NAME: added switched off. Free some rows, then switch it on."' ] },
    { p: 'The print build checks every page again. <code>node check.mjs m2026-10</code> prints a list and a count. <code>[] 0</code> means every page fits. Anything else names pages, and the build stops (CI fails). Each entry looks like <code>{"n":41,"over":true,"out":2}</code>:' },
    { ul: [
      '<code>n</code>: the page number, counting from 1 at the front.',
      '<code>over</code>: the page content spills past the page. <code>out</code>: how many elements sit outside the margins.',
      '<code>cell</code>: bus grid or summary cells whose text is wider than the column. <code>clip</code>: month-calendar cells or week rows that clip their text.',
      '<code>blk</code>: the names of Grid blocks that clip their content, for example <code>"blk":["checks"]</code>. That is the block to shorten or move.',
      '<code>scan</code>: parts of the scan strip overlap or spill, for example after a bigger page code.' ] },
    { p: 'A busy calendar does not overflow a page by itself: month cells and week rows cap at a few lines and say "+N more".' },
    { p: 'The X4 has room for 16 custom check-in items. Past that the editor says "X4 holds 16 custom items; you have N. The last M stay on paper."' },
    { h3: 'The 110-page limit' },
    { p: 'The Pages panel in the Book view counts the pages and checks them against KDP: 24 to 110 pages for a paperback, 76 or more for a hardcover in this tool. Past the limit it says so in red, with the volume plan.' },
    { shot: 'trouble-kdp' },
    { ul: [
      '<b>Over:</b> "112 pages is over the 110-page limit for one printed book. The plan would split it into about 2 volumes; take pages out or hide some to keep one book." Hide pages with the eye, remove pages you added, or let it split: <code>node render.mjs plan private/main.ics</code> shows how many volumes you get, and each volume is its own KDP upload.',
      '<b>Under:</b> "N pages is under the 24-page minimum for a paperback." (76 for a hardcover). The build pads with Notes pages by itself so the count is even and reaches the minimum; <code>HARDCOVER=1</code> pads to 76.',
      'A spread day, extra Notes pages and the "Count as a hardcover" switch all change the count. The note under "This day covers" shows it as you go.' ] },
    { h3: 'A page would point to nothing' },
    { p: 'Some pages say "see page N". Page numbers and those pointers follow the pages when they move. If a change would remove a page that another page points to, the editor stops and asks: <b>A page would point to nothing</b>, then "NAME points to NAME, which the book would no longer have." The build refuses such a book, so it cannot be saved or printed until you put that page back. <b>Cancel</b> keeps the book as it was, <b>Apply anyway</b> is for when you mean it, and Undo brings the page back at any time. If a book has already been saved this way, the editor says "Not saved: NAME points to NAME, which isn\'t in the book. Put it back, or undo." and the build says:' },
    { code: 'Page "Closing the month" points to page "support", which this book doesn\'t have. Put that page back or remove the pointer.', label: 'The build\'s message (the page names will differ)' },
    { p: 'In the current page set, a page prints a pointer only when its target exists, and Support, My safety plan and Closing the month cannot be hidden ("Support can be moved but not hidden"), so you should rarely meet this. It guards books you edit by hand and pages added later.' },
    { h3: 'The editor does not load, or the canvas is empty' },
    { p: 'The editor loads its drag-and-drop helper (SortableJS 1.15.2) from <code>cdnjs.cloudflare.com</code>. If your browser cannot reach it, because you are offline or the address is blocked, the page shows its top bar and then <b>nothing is drawn: the Book canvas stays empty and the editor says nothing</b>. Only the browser console says <code>Sortable is not defined</code>. Your saved work is untouched, because the editor never opened it. Get online (or allow that address) and reload. The editor does not carry its own copy yet. The project\'s own screenshot scripts take a local copy through <code>SORTABLE_JS</code>, and that is for testing, not for using the editor.' },
    { shot: 'trouble-jump' },
    { p: 'A jump to a page that is not there is refused in words, as above, and nothing moves.' },
    { h3: 'Common messages' },
    { ul: [
      '<b>"This browser can\'t keep your library (its storage is blocked)"</b> or <b>"This browser can\'t keep versions"</b>: a private window or a privacy setting blocks storage. The editor still works for this visit. Use <b>Export</b> and <b>Download</b> to keep a copy.',
      '<b>"Demo: not saved anywhere"</b>: you are in the public demo. Nothing is saved. Open your own copy (chapter {{ch:open}}).',
      '<b>"That file isn\'t a day page layout."</b>: Import was given a file that is not a <code>daypage.json</code>. <b>"Couldn\'t copy here. Use Download instead."</b>: the browser would not give the editor the clipboard.',
      '<b>"Couldn\'t reach GitHub."</b> or <b>"Couldn\'t save. Try again in a moment"</b>: the working editor could not commit. Check your connection and your token.',
      '<b>"Not autosaved: ..."</b> in the Versions drawer: the draft could not be saved to the Studio server; the reason follows.',
      '<b>"NAME is not a valid profile"</b>, with a list: <code>content/profile.json</code> has a wrong field, for example <code>trim: is required: "small" (5.5x8.5) or "letter" (8.5x11), got "a5"</code>. Each line names the field and what it needs.',
      '<b>"Not printing the Support pages of pack NAME: N items have no verification note"</b>: give each item a <code>verified</code> note (chapter {{ch:start}}). <code>node packs-cli.mjs check NAME</code> finds it earlier.',
      '<b>"support.json: changed since it was sealed"</b>: a pack file changed after <code>seal</code>. Check the change, then run <code>node packs-cli.mjs seal NAME</code>.',
      '<b>"No pack ... Installed packs: ..."</b>: the id or folder you named has no <code>pack.json</code>. For a folder, give the whole path.',
      '<b>"KW_BOOK ... is not a book in the library"</b>: the book id is not in <code>content/library.json</code>; the message lists the ids that are.',
      '<b>"Not overwriting ..."</b> from <code>npm run init</code>: a profile is already there. Use <code>--profile</code> for another file or <code>--force</code> to replace it.' ] },
    { note: 'Still stuck? <a href="https://github.com/shelbeeely/Journaling/issues">Open an issue on GitHub</a> with the exact message and what you pressed. Do not paste your calendar, profile or support numbers into an issue.' } ] };

// The order the guide reads in. {{ch:id}} anywhere in the text or in a callout becomes that chapter's number (build-guide.mjs), so inserting a chapter never leaves a wrong number behind.
const by = Object.fromEntries([...BASE, START, LIBRARY, SPREADS, BLOCKS, PUZZLES, ACCESS, RELEASES, TROUBLE].map((c) => [c.id, c]));
export const CHAPTERS = ['open', 'profile', 'start', 'day', 'grid', 'book', 'library', 'spreads', 'blocks', 'puzzles', 'scan', 'access', 'save', 'releases', 'print', 'x4', 'trouble'].map((id) => by[id]);
