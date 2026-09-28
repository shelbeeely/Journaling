// Carl's Jr pay periods. 2026 rows are copied from the posted "2026 Pay Periods" sheet (photo, Sept 2026).
// 2027 rows are PROJECTED by continuing the same pattern (14-day Tuesday–Monday periods, paid the Tuesday 8 days after they end).
// Replace them with the real 2027 sheet when it is posted.
const OFFICIAL = [
  ['P9 Weeks 3 & 4', '2026-09-22', '2026-10-05', '2026-10-13'],
  ['P10 Weeks 1 & 2', '2026-10-06', '2026-10-19', '2026-10-27'],
  ['P10 Weeks 3 & 4', '2026-10-20', '2026-11-02', '2026-11-10'],
  ['P11 Weeks 1 & 2', '2026-11-03', '2026-11-16', '2026-11-24'],
  ['P11 Weeks 3 & 4', '2026-11-17', '2026-11-30', '2026-12-08'],
  ['P12 Weeks 1 & 2', '2026-12-01', '2026-12-14', '2026-12-22'],
  ['P12 Weeks 3 & 4', '2026-12-15', '2026-12-28', '2027-01-05'],
];
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const addDays = (s, n) => iso(Date.parse(s + 'T00:00:00Z') + n * 864e5);
export function payEvents() {
  const rows = OFFICIAL.map(([name, s, e, p]) => ({ name, start: s, end: e, pay: p, projected: false }));
  let s = addDays(rows[rows.length - 1].end, 1);
  while (s < '2027-10-10') { const e = addDays(s, 13); rows.push({ name: 'Pay period', start: s, end: e, pay: addDays(e, 8), projected: true }); s = addDays(e, 1); }
  const byDate = {};
  const put = (d, text) => (byDate[d] ||= []).push(text);
  for (const r of rows) {
    const tag = r.projected ? ' (projected)' : '';
    put(r.start, `Pay period starts${r.projected ? '' : ': ' + r.name}${tag}`);
    put(r.end, `Pay period ends${tag}`);
    put(r.pay, `Payday${tag}`);
  }
  return byDate;
}
