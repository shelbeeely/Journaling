// The step-by-step guide: ONE source for the words, the screenshots and the callouts.
//   site/tools/make-guide-shots.mjs  reads SHOTS: drives the editor demo, finds every selector, draws numbered rings, crops, writes site/img/guide/*.webp
//   site/tools/build-guide.mjs       reads CHAPTERS + SHOTS: writes the page (site/guide/) with the same numbers as the rings
// If the editor changes and a selector below stops matching, the shot script fails and so does CI: the guide cannot go stale silently.
// Generic data only: profile.example.json (Northlight) and journal/test.ics. Never put a personal name, place or title in here.
//
// A shot:  build 'demo' (the public demo) or 'app' (the working editor, guest mode: versions live in the browser)
//          vp [w,h]  hash  setup [[op, ...]]  callouts [{sel, name, does, at?}]  crop {pad?, sels?} | null (whole viewport)
//          themes ['light','dark']  scale (1 or 2)  maxW  alt (what the picture shows; the marks are added to it)
// Setup ops: ['click', sel] ['eval', js] ['wait', ms] ['fill', sel, text] ['hide', sel] ['key', key]

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
      { sel: '#og-toggle', name: 'Pages', does: 'Shows or hides the page list (chapter 5).' }] },
  'book-settings': { build: 'demo', vp: [1280, 900], hash: BOOKEDIT, setup: [['click', '#bk-set'], ['wait', 600]], crop: { pad: 18 }, alt: 'The Book settings sheet with its first fields filled in for the sample book.',
    callouts: [
      { sel: '#bs-title', name: 'Title', does: 'Printed on the cover and the title page, and used in file names.' },
      { sel: '#bs-scope', name: 'Length', does: 'What one book covers: a month, a season, a year, or undated. Long books split into volumes past 110 pages.' },
      { sel: '#bs-start', name: 'First month', does: 'The month the book starts. An undated book skips it.' },
      { sel: '#bs-ed', name: 'Edition', does: 'Part of every scan code. Two books that cover the same months need different editions.' }] },
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
      { sel: '#pal li[data-key="t:checks"] .n', name: 'The block', does: 'Drag the tile onto the list or straight onto the page to place it where you drop it.' },
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

  // ---------- phone ----------
  'phone-edit': { build: 'demo', vp: [390, 844], hash: DAYEDIT, scale: 2, maxW: 780, alt: 'The editor on a phone, 390 pixels wide: the page preview fills the screen and the blocks sit in a sheet at the bottom.',
    callouts: [
      { sel: '#sheet-t', name: 'Sheet handle', does: 'Collapses or opens the blocks sheet, so you can see the whole page.' },
      { sel: '.tabs [data-tab="add"]', name: '+ Add', does: 'Switches the sheet from your blocks to the palette of blocks to add.' }] },
};

// Chapters. A part is one of: {p} paragraph (HTML) {shot} {ref: id of an image from site/img/shots, with its own alt} {code} {note} {ul: [..]} {steps: [..]}
export const CHAPTERS = [
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
      { p: 'A <b>profile</b> is one small file, <code>journal/content/profile.json</code>: your name, the book title, where you live (for the sun and moon), your time zone, when your day starts and which trim to print. Nothing personal lives in the code. To start your own, copy the generic example and edit it:' },
      { code: 'cp journal/content/profile.example.json journal/content/profile.json', label: 'Make your profile' },
      { code: '{\n "person": { "name": "Sam" },\n "book": { "title": "Northlight", "start": "2026-10", "edition": 1 },\n "location": { "place": "Lakemont, MN", "timezone": "America/Chicago" },\n "day_start_hour": 5,\n "trim": "small"\n}', label: 'The main fields (the example file has more)' },
      { p: 'The editor shows the same facts as a sheet you can change without editing a file. Switch to edit mode on the Book view, then open Book settings.' },
      { shot: 'book-settings-btn' },
      { shot: 'book-settings' },
      { p: '<b>Trim</b> is the printed page size. KDP in the US offers 5.5 by 8.5 inches and 8.5 by 11 inches (A5 is not offered). A paperback needs 24 to 110 pages. A hardcover needs at least 75 pages. The top bar switches the preview between the two. The print follows the same choice.' },
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
      { shot: 'phone-edit' } ] },

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
      { p: 'If you sign in to a Studio server (<a href="https://github.com/shelbeeely/Journaling/blob/main/studio/README.md">studio/README.md</a>), the same drawer also gives you branches, forks and proposals, so more than one person can work on a book. Private pages, calendars and profile secrets are never put in a version.' } ] },

  { id: 'print', title: 'Export a KDP-ready PDF', time: '10 min',
    lead: 'The build writes an interior and a cover that pass the checks Amazon KDP asks for. The editor does not print: the build does.',
    parts: [
      { p: 'Build one month with the sample calendar. For your own book, replace <code>test.ics</code> with your calendar files (they stay on your computer and are never committed).' },
      { code: 'cd journal\nnode render.mjs month 2026-10 test.ics          # 5.5x8.5 interior, into out/m2026-10/\nSIZE=letter node render.mjs month 2026-10 test.ics   # 8.5x11, into out/m2026-10-letter/\nnode cover.mjs month 2026-10                      # the wrap-around cover, sized to the page count', label: 'Build the interior and the cover' },
      { p: 'Or build every month and both sizes at once with <code>./build-all.sh</code>.' },
      { ref: 'cover-month' },
      { p: '<b>Check before you upload.</b> These are the same checks the project runs on every build:' },
      { code: 'node check.mjs m2026-10               # must print [] 0: no page overflows\npdffonts out/m2026-10/*interior*.pdf | grep "Type 3"   # must print nothing: KDP rejects Type 3 fonts\npdfinfo out/m2026-10/*interior*.pdf | grep Pages        # even; paperback 24 to 110, hardcover 75 or more', label: 'The three checks' },
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
        { id: 'x4-wifi', alt: 'The X4 Wi-Fi screen: Hotspot (its own network, no internet), On my Wi-Fi, Join a network and Saved networks. The note says the X4 makes its own network and nothing reaches the internet.', cap: 'Wi-Fi: its own hotspot.' }] },
      { p: 'Settings are on the device: text size, contrast and button layout. To move files, open Wi-Fi and choose Hotspot. The X4 makes its own network. Join it from a phone to set the clock, download your logs and upload new books.' },
      { p: 'The build makes an X4 EPUB for each month (<code>python3 epub.py m2026-10</code>) and the SD-card files. Setup and the firmware build are in <a href="https://github.com/shelbeeely/Journaling/blob/main/x4/README.md">x4/README.md</a>.' } ] },
];
