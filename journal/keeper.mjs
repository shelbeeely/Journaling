// The Keeper: a yearly reference book that stays home (5.5 x 8.5 in, KDP paperback).
// Important info, contacts, birthdays, password HINTS, where 2FA recovery codes are kept (never the codes), devices, and support numbers.
// No scan markers on purpose: these pages should never be photographed or sent to an app.
// Usage: node keeper.mjs [label]      -> out/keeper/keeper-interior-5.5x8.5.pdf + pages.txt
import fs from 'node:fs';
import { launch } from './browser.mjs';
import { handoffHtml, HANDOFF_BOXES, GOOD_SPOON_NOTE } from './handoff.mjs';

const LABEL = process.argv[2] || 'Oct 2026 – Sep 2027';
const OUT = 'out/keeper'; fs.mkdirSync(OUT, { recursive: true });
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const CLINIC = J('content/clinic.json'), SUPPORT = J('content/support.json'), TRANS = J('content/trans.json');
const W_IN = 5.5, H_IN = 8.5, INSIDE = 0.6, OUTSIDE = 0.45, TOP = 0.5, BOTTOM = 0.55;
const pages = [];
const add = (html, cls = '') => pages.push({ html, cls });
const blank = (n) => Array(n).fill(0);
const chip = (t) => (t || '').split(' ').filter(Boolean).map((x) => `<span class="chip${x === 'TEXT' ? ' tx' : ''}">${x}</span>`).join('');
const field = (label, w = '') => `<div class="f ${w}"><span>${label}</span><i></i></div>`;
const lines = (n) => `<div class="lns">${'<div class="ln"></div>'.repeat(n)}</div>`;
const row = (...f) => `<div class="fr">${f.join('')}</div>`;

// ---- front matter ----
add(`<div class="title"><div class="kick">KEEPING WATCH</div><h1>The Keeper</h1><p class="sub">${LABEL}</p>
<p class="lead">The reference book that stays home: the people, numbers and accounts you need, all in one place.</p>
<div class="found"><b>If found, please return to</b>${field('Name')}${field('Text')}${field('Email')}</div></div>`, 'titlep');
add(`<div class="blankpage"></div>`);
add(`<h2>How to keep this book safe</h2>
<ol class="rules">
<li><b>Write hints, not passwords.</b> A hint only makes sense to you, like “first cat + usual 4 + !”. If this book is lost, a stranger still can’t log in.</li>
<li><b>Never write your password manager’s master password</b> or your phone passcode here.</li>
<li><b>Never write recovery codes or keys here either.</b> Write only <i>where</i> they are (a safe, a password manager’s emergency kit). An Apple recovery key, or a login plus a code, could take over an account if this book is lost.</li>
<li><b>Keep this book at home.</b> The monthly journals travel and get shared; this one doesn’t.</li>
<li><b>Don’t scan or photograph these pages.</b> They have no scan code on purpose.</li>
<li><b>Account numbers:</b> write only the last 4 digits. The full number is on your card or statement.</li>
</ol>
<h3>My hint system</h3><p class="small">Pick a few building blocks only you know, and write hints using them. Example: <i>A</i> = a place, <i>B</i> = a year, <i>C</i> = a symbol you always use. Hint “A2 + B + C” means “second place + the year + your symbol”.</p>
<div class="hs">${['A', 'B', 'C', 'D'].map((k) => `<div><b>${k}</b><i></i></div>`).join('')}</div>
<p class="small">Write what each letter <i>stands for</i>, not the actual words (for example “A = streets I’ve lived on”).</p>`);

// ---- important info ----
add(`<h2>About me</h2>
${row(field('Name'), field('Pronouns', 'sm'))}${row(field('Birthday', 'sm'), field('Blood type', 'sm'))}
${row(field('Address'))}${row(field('Phone'), field('Email'))}
<h3>Emergency contacts</h3>
${blank(3).map(() => `<div class="card">${row(field('Name'), field('Relation', 'sm'))}${row(field('Phone'), `<span class="tick"><i></i> text is best</span>`)}</div>`).join('')}
<h3>Communication</h3>
<div class="card"><p class="small">What helps when you contact me or help me in a hard moment:</p>${lines(3)}</div>`);
add(`<h2>Health</h2>
<div class="card"><b>${CLINIC.name}</b><br><span class="small">${CLINIC.address}</span>
${CLINIC.lines.map(([k, d, c]) => `<div class="sup"><div class="sn"><b>${k}</b>${chip(c)}</div><div class="small">${d}</div></div>`).join('')}
${row(field('My provider'), field('Counselor'))}</div>
<h3>Insurance</h3><div class="card">${row(field('Plan'))}${row(field('Member ID'), field('Group #', 'sm'))}${row(field('Member services phone'))}</div>
<h3>Allergies &amp; reactions</h3>${lines(2)}
<h3>Other providers</h3>${blank(2).map(() => `<div class="card">${row(field('Name / type'))}${row(field('Phone'), field('Portal', 'sm'))}</div>`).join('')}`);
add(`<h2>Home &amp; work</h2>
<h3>Home</h3><div class="card">${row(field('Landlord / manager'))}${row(field('Phone'), field('Rent due', 'sm'))}${row(field('Maintenance request'))}</div>
<h3>Utilities &amp; services</h3>
<table class="t"><tr><th>Service</th><th>Company</th><th>Support phone</th><th>Acct (last 4)</th></tr>${['Power', 'Water / trash', 'Internet', 'Phone', 'Bank', 'Card', '', ''].map((s) => `<tr><td>${s}</td><td></td><td></td><td></td></tr>`).join('')}</table>
<h3>Work</h3><div class="card">${row(field('Employer'))}${row(field('Store phone'), field('Manager', 'sm'))}${row(field('Scheduling app'), field('Pay schedule', 'sm'))}</div>`);

// ---- contacts ----
const contact = () => `<div class="ct">${row(field('Name'), field('Pronouns', 'xs'))}${row(field('Phone'), `<span class="tick"><i></i> text</span>`)}${row(field('Email'), field('Birthday', 'xs'))}${row(field('Notes'))}</div>`;
for (let p = 0; p < 6; p++) add(`<h2>Contacts${p ? '' : ''}</h2><div class="cts">${blank(5).map(contact).join('')}</div>`);
add(`<h2>Birthdays</h2><div class="bd">${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m) => `<div><b>${m}</b>${lines(3)}</div>`).join('')}</div>`);

// ---- passwords (hints) ----
const acct = (n) => `<table class="t pw"><tr><th>Site / app</th><th>Login (user or email)</th><th>Hint</th><th>2FA</th><th>Changed</th></tr>${blank(n).map(() => '<tr><td></td><td></td><td></td><td class="c"><i></i></td><td></td></tr>').join('')}</table>`;
add(`<h2>Accounts · hints only</h2><p class="small">Hint, never the password. Tick 2FA when it’s on; note where its backup codes are kept on the Recovery codes pages.</p>${acct(17)}`);
for (let p = 0; p < 4; p++) add(`<h2>Accounts · hints only</h2>${acct(19)}`);
add(`<h2>Email &amp; the big ones</h2><p class="small">If someone gets your email, they can reset everything else. Make these the strongest, with 2FA on.</p>
${['Main email', 'Apple / Google account', 'Password manager', 'Bank', 'Phone carrier'].map((a) => `<div class="card"><b class="cl">${a}</b>${row(field('Account (no login)'))}${row(field(a === 'Password manager' ? 'Where the emergency kit is' : 'Hint'), field('2FA method', 'sm'))}${row(field('Recovery email / phone'))}</div>`).join('')}`);

// ---- recovery codes ----
const codes = () => `<div class="rc">${row(field('Account (no login)'), field('Made', 'xs'))}${row(field('Where the codes or key are kept'))}${row(field('Codes left', 'xs'), field('Last checked', 'xs'))}</div>`;
for (let p = 0; p < 2; p++) add(`<h2>Recovery codes · where they are</h2><p class="small">Write <b>where</b> the backup codes or recovery key are kept, never the codes themselves. Update “codes left” when you use one; make new ones when a few are left.</p>${blank(6).map(codes).join('')}`);

// ---- devices & wifi ----
add(`<h2>Devices &amp; Wi-Fi</h2>
<h3>Wi-Fi</h3>${blank(2).map(() => `<div class="card">${row(field('Network name'))}${row(field('Password hint'))}</div>`).join('')}
<h3>Devices</h3><table class="t"><tr><th>Device</th><th>Model</th><th>Serial</th><th>Bought</th></tr>${blank(8).map(() => '<tr><td></td><td></td><td></td><td></td></tr>').join('')}</table>
<h3>Router / home server</h3><div class="card">${row(field('Admin address'))}${row(field('Login hint'))}</div>`);

// ---- monthly handoffs: one spread per book, filled in when you switch journals ----
const MONTHS = [];
for (let i = 0; i < 12; i++) { const d = new Date(Date.UTC(2026, 9 + i, 1)); MONTHS.push({ n: i + 1, id: d.toISOString().slice(0, 7), name: d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }), y: d.getUTCFullYear() }); }
const cbx = (t) => `<div class="cbl"><i></i><span>${t}</span></div>`;
const stat = (l, u = '') => `<div class="st"><span>${l}</span><i></i><em>${u}</em></div>`;
const INDEX = {};
add(`<h2>Monthly handoffs</h2>
<p class="lead">At the end of each month, before you start the next journal, sit down with both books for 15 minutes.</p>
<ol class="rules">
<li><b>Close the month</b> (left page): copy the tracker totals from the monthly book, then the highs, lows and health notes.</li>
<li><b>Update the Keeper</b>: new contacts, birthdays, account hints, where recovery codes are kept.</li>
<li><b>Carry forward</b> (right page): unfinished tasks and people to follow up with. Copy them into week 1 of the new book.</li>
<li><b>Index</b> anything worth finding later: what it is, which book, which page.</li>
<li><b>Revise</b>: note what to change in the next edition of the journal.</li>
</ol>
<p class="small">The old monthly book can then go on the shelf. The Keeper is the thread that runs through all twelve.</p>`);
while (pages.length % 2 === 0) add(`<h2>Notes</h2>${lines(26)}`); // each handoff spread starts on a left page
for (const M of MONTHS) {
  const next = MONTHS[M.n] ? `${MONTHS[M.n].name}` : 'next year';
  INDEX[M.id] = pages.length + 1;
  add(`<div class="hh"><h2>Closing ${M.name} ${M.y}</h2><span>BOOK ${M.n} OF 12</span></div>
  <h3>Totals</h3>${handoffHtml({ caption: (tag, where) => `<p class="src"><b>${tag}</b> · ${where}</p>`, grid: (h) => `<div class="sts">${h}</div>`, cell: stat })}
  <p class="small">${GOOD_SPOON_NOTE}</p>
  <div class="two"><div><h3>Highs</h3>${lines(4)}</div><div><h3>Lows</h3>${lines(4)}</div></div>
  <h3>Health</h3><p class="small">Appointments, med changes, how the meds felt.</p>${lines(3)}
  <h3>Money &amp; work</h3>${lines(2)}
  <h3>One line to remember ${M.name} by</h3>${lines(1)}`, 'hl');
  add(`<div class="hh"><h2>Into ${next}</h2><span>HANDOFF</span></div>
  <h3>Keeper updated</h3><div class="cbs">${cbx('New contacts')}${cbx('Birthdays')}${cbx('Account hints')}${cbx('Recovery code locations')}${cbx('Clinic &amp; support still right')}${cbx('Tracker totals copied')}</div>
  <h3>Carry forward</h3><p class="small">Copy these into week 1 of the new book.</p>${blank(7).map(() => cbx('')).join('')}
  <h3>Follow up with</h3>${lines(2)}
  <h3>Worth finding later</h3><table class="t ix"><tr><th>What</th><th>Book</th><th>Page</th></tr>${blank(4).map(() => `<tr><td></td><td>${M.n}</td><td></td></tr>`).join('')}</table>
  <h3>Change in the next edition</h3>${lines(2)}
  <h3>Intention for ${next}</h3>${lines(1)}`, 'hr');
}
add(`<h2>Year at a glance</h2><p class="small">Copy each month’s totals here to see the whole year.</p>
<table class="t yr"><tr><th>Month</th>${HANDOFF_BOXES.map((b) => `<th>${b.label}</th>`).join('')}</tr>${MONTHS.map((M) => `<tr><td>${M.name.slice(0, 3)} ${String(M.y).slice(2)}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}</table>
<h3>What this year taught me</h3>${lines(6)}`);
fs.writeFileSync(`${OUT}/index.json`, JSON.stringify({ handoff_page: INDEX }, null, 1)); // read by render.mjs for the "Closing the month" page

// ---- support (shared with the monthly books) ----
const dir = (title, data) => `<h2>${title}</h2>${data.map(([h, items]) => `<h3 class="sh">${h}</h3>${items.map(([n, d, c]) => `<div class="sup"><div class="sn"><b>${n}</b>${chip(c)}</div><div class="small">${d}</div></div>`).join('')}`).join('')}`;
add(dir('Support', SUPPORT) + `<p class="small">Emergency: <b>911</b>. Checked Sep 2026; numbers can change.</p>`);
add(dir('Trans support', TRANS));

// ---- notes to an even page count >= 32 ----
while (pages.length < 24 || pages.length % 2) add(`<h2>Notes</h2>${lines(26)}`);

const css = `
@page { size: ${W_IN}in ${H_IN}in; margin: 0; }
* { box-sizing: border-box; } body { margin: 0; font-family: Lora, serif; color: #000; font-size: 8pt; }
.page { width: ${W_IN}in; height: ${H_IN}in; position: relative; overflow: hidden; page-break-after: always; padding: ${TOP}in ${OUTSIDE}in ${BOTTOM}in ${INSIDE}in; }
.page.verso { padding-left: ${OUTSIDE}in; padding-right: ${INSIDE}in; }
.folio { position: absolute; bottom: 0.28in; font: 500 7pt Inter, sans-serif; color: #444; } .recto .folio { right: ${OUTSIDE}in; } .verso .folio { left: ${OUTSIDE}in; }
.priv { position: absolute; bottom: 0.28in; font: 700 7pt Inter, sans-serif; letter-spacing: .08em; color: #444; } .recto .priv { left: ${INSIDE}in; } .verso .priv { right: ${INSIDE}in; }
h1 { font-size: 30pt; margin: 0.1in 0; } h2 { font-size: 15pt; margin: 0 0 0.08in; font-weight: 700; } h3 { font: 700 7.5pt Inter, sans-serif; text-transform: uppercase; letter-spacing: .06em; margin: 0.13in 0 0.04in; }
.small { font-size: 7.5pt; line-height: 1.35; margin: 2px 0; } .lead { font-size: 9.5pt; line-height: 1.45; }
.title { padding-top: 1.4in; } .kick { font: 700 8pt Inter, sans-serif; letter-spacing: .2em; } .sub { font-size: 11pt; margin: 0 0 0.4in; }
.found { margin-top: 1.6in; border: 1px solid #000; padding: 8px 10px; font-size: 8pt; } .found b { display: block; margin-bottom: 4px; }
.rules { padding-left: 1.2em; font-size: 8pt; line-height: 1.45; } .rules li { margin-bottom: 5px; }
.hs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin: 6px 0; } .hs div { display: flex; gap: 6px; align-items: flex-end; } .hs b { font: 700 9pt Inter, sans-serif; } .hs i { flex: 1; border-bottom: 1px solid #000; height: 0.24in; }
.fr { display: flex; gap: 10px; } .f { display: flex; align-items: flex-end; gap: 4px; flex: 1; min-height: 0.27in; } .f.sm { flex: 0.55; } .f.xs { flex: 0.4; }
.f span { font: 500 7pt Inter, sans-serif; text-transform: uppercase; white-space: nowrap; color: #333; } .f i { flex: 1; border-bottom: 1px solid #777; height: 0.18in; }
.card { border: 1px solid #aaa; padding: 3px 7px 5px; margin-bottom: 5px; } .cl { font-size: 8pt; }
.tick { display: flex; align-items: flex-end; gap: 3px; font: 500 7pt Inter, sans-serif; text-transform: uppercase; white-space: nowrap; padding-bottom: 1px; } .tick i { width: 9px; height: 9px; border: 1px solid #000; display: inline-block; }
.ct { border-bottom: 1.5px solid #000; padding: 2px 0 5px; margin-bottom: 4px; }
.t { width: 100%; border-collapse: collapse; font-size: 7.5pt; } .t th { font: 700 7pt Inter, sans-serif; text-transform: uppercase; text-align: left; border-bottom: 1px solid #000; padding: 2px 3px; } .t td { border-bottom: 1px solid #aaa; height: 0.27in; padding: 0 3px; border-left: 1px solid #ddd; } .t td:first-child { border-left: none; }
.pw { table-layout: fixed; } .pw td { height: 0.3in; } .pw th:nth-child(1) { width: 27%; } .pw th:nth-child(2) { width: 29%; } .pw th:nth-child(3) { width: 26%; } .pw th:nth-child(4) { width: 7%; } .pw .c i { display: block; margin: auto; width: 9px; height: 9px; border: 1px solid #000; }
.rc { border: 1px solid #000; padding: 3px 7px 6px; margin-bottom: 8px; } .cg { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 14px; margin-top: 4px; } .cg div { display: flex; align-items: flex-end; gap: 4px; } .cg span { font: 500 7pt Inter, sans-serif; width: 0.14in; text-align: right; } .cg i { flex: 1; border-bottom: 1px solid #777; height: 0.22in; }
.bd { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; } .bd b { font: 700 7.5pt Inter, sans-serif; text-transform: uppercase; }
.ln { height: 0.26in; border-bottom: 1px solid #bbb; }
.sh { border-bottom: 1px solid #000; } .sup { border-bottom: 1px solid #e3e3e3; padding: 1px 0; } .sup .sn { display: flex; gap: 3px; align-items: center; } .sup .sn b { margin-right: auto; font-size: 7.5pt; }
.chip { font: 700 7pt Inter, sans-serif; border: 1px solid #000; padding: 0 2px; line-height: 1.2; } .chip.tx { background: #000; color: #fff; }
.blankpage { height: 100%; }
.src { font-size: 7pt; margin: 8px 0 1px; color: #333; } .hh { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #000; margin-bottom: 4px; } .hh h2 { margin: 0; } .hh span { font: 700 7pt Inter, sans-serif; letter-spacing: .1em; }
.sts { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; } .st { display: flex; align-items: flex-end; gap: 4px; } .st span { font: 500 7pt Inter, sans-serif; text-transform: uppercase; white-space: nowrap; } .st i { flex: 1; border-bottom: 1px solid #777; height: 0.22in; } .st em { font-size: 7pt; color: #555; font-style: normal; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.cbs { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; } .cbl { display: flex; align-items: flex-end; gap: 5px; height: 0.25in; } .cbl i { width: 9px; height: 9px; border: 1px solid #000; flex: none; margin-bottom: 3px; } .cbl span { flex: 1; border-bottom: 1px solid #bbb; font-size: 7.5pt; height: 100%; display: flex; align-items: flex-end; } .cbs .cbl span { border-bottom: none; }
.ix td { height: 0.25in; } .ix th:nth-child(2), .ix th:nth-child(3) { width: 0.5in; } .ix td:nth-child(2) { color: #888; text-align: center; }
.yr td { height: 0.3in; }
`;
const html = `<!doctype html><html><head><meta charset="utf-8">${['lora/400', 'lora/700', 'lora/400-italic', 'inter/500', 'inter/700', 'dejavu-sans/400'].map((f) => `<link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/${f}.css">`).join('')}<style>${css}</style></head><body>
${pages.map((p, i) => { const n = i + 1, side = n % 2 ? 'recto' : 'verso'; return `<div class="page ${side} ${p.cls}">${p.html}${n > 2 ? `<div class="folio">${n}</div><div class="priv">PRIVATE · DO NOT SCAN</div>` : ''}</div>`; }).join('\n')}
</body></html>`;
fs.writeFileSync(`${OUT}/keeper.html`, html);
const b = await launch();
const pg = await b.newPage();
await pg.goto(`file://${process.cwd()}/${OUT}/keeper.html`, { waitUntil: 'networkidle' });
await pg.evaluate(() => document.fonts.ready);
const over = await pg.evaluate(() => [...document.querySelectorAll('.page')].map((p, i) => ({ n: i + 1, over: p.scrollHeight > p.clientHeight + 1 })).filter((x) => x.over));
await pg.pdf({ path: `${OUT}/keeper-interior-5.5x8.5.pdf`, width: `${W_IN}in`, height: `${H_IN}in`, printBackground: true, preferCSSPageSize: true });
await b.close();
fs.writeFileSync(`${OUT}/pages.txt`, String(pages.length));
console.log(`keeper: ${pages.length} pages`, over.length ? 'OVERFLOW ' + JSON.stringify(over) : 'no overflow');
