// Major US holidays and observances, computed by rule (no lookup table to go stale).
// federal: true for the 11 federal holidays (5 U.S.C. 6103). Weekend federal holidays get an "(observed)" entry.
const nth = (y, m, wd, n) => { const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); return 1 + ((wd - first + 7) % 7) + (n - 1) * 7; };
const last = (y, m, wd) => { const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); const lw = new Date(Date.UTC(y, m - 1, dim)).getUTCDay(); return dim - ((lw - wd + 7) % 7); };
function easter(y) { // Anonymous Gregorian computus
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}
const key = (m, d) => `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function holidays(y) {
  const H = {};
  const put = (m, d, name, federal = false) => { (H[key(m, d)] ||= []).push({ name, federal }); };
  const fed = (m, d, name) => {
    put(m, d, name, true);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (wd === 6) { const o = new Date(Date.UTC(y, m - 1, d - 1)); put(o.getUTCMonth() + 1, o.getUTCDate(), `${name} (observed)`, true); }
    if (wd === 0) { const o = new Date(Date.UTC(y, m - 1, d + 1)); put(o.getUTCMonth() + 1, o.getUTCDate(), `${name} (observed)`, true); }
  };
  fed(1, 1, 'New Year’s Day');
  fed(1, nth(y, 1, 1, 3), 'Martin Luther King Jr. Day');
  put(2, 14, 'Valentine’s Day');
  fed(2, nth(y, 2, 1, 3), 'Presidents’ Day');
  put(3, nth(y, 3, 0, 2), 'Daylight saving time starts (clocks forward)');
  put(3, 17, 'St. Patrick’s Day');
  const [em, ed] = easter(y); put(em, ed, 'Easter');
  put(5, nth(y, 5, 0, 2), 'Mother’s Day');
  fed(5, last(y, 5, 1), 'Memorial Day');
  put(6, nth(y, 6, 0, 3), 'Father’s Day');
  fed(6, 19, 'Juneteenth');
  fed(7, 4, 'Independence Day');
  fed(9, nth(y, 9, 1, 1), 'Labor Day');
  fed(10, nth(y, 10, 1, 2), 'Indigenous Peoples’ Day / Columbus Day');
  put(10, 31, 'Halloween');
  put(11, nth(y, 11, 0, 1), 'Daylight saving time ends (clocks back)');
  fed(11, 11, 'Veterans Day');
  fed(11, nth(y, 11, 4, 4), 'Thanksgiving');
  put(12, 24, 'Christmas Eve');
  fed(12, 25, 'Christmas Day');
  put(12, 31, 'New Year’s Eve');
  return H;
}
