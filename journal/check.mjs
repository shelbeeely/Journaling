import { launch } from './browser.mjs';
import { pageProblems } from './pageoverflow.mjs';
const b = await launch();
const p = await b.newPage();
await p.goto('file://' + process.cwd() + `/${process.env.KW_OUT || 'out'}/${process.argv[2] || 'v1'}/journal.html`, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const res = await p.evaluate(pageProblems);
console.log(JSON.stringify(res.slice(0, 20)), res.length);
if (res.length) process.exitCode = 1; // CI fails on any overflow
await b.close();
