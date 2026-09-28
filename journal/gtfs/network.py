# Compact STA schedules for the monthly books -> gtfs/network.json
#   1. Network summary: every route, first–last bus and typical gap, weekday / Saturday / Sunday.
#   2. Hour grids for chosen routes: minutes past each hour at the first timepoint, both directions.
# Each book uses real sample dates inside its own month (2nd Wednesday, 2nd Saturday, 2nd Sunday),
# so EWU session/break schedules and service changes are right for that month.
# Refresh: curl -L -o gtfs/sta.zip https://www.spokanetransit.com/gtfs && unzip -o gtfs/sta.zip -d gtfs && python3 gtfs/network.py
import csv, collections, json, os, datetime as dt, statistics
os.chdir(os.path.dirname(os.path.abspath(__file__)))
R = lambda f: csv.DictReader(open(f, encoding='utf-8-sig'))
GRID_ROUTES = None  # None = hour grids for every route; the book packs as many as its page budget allows
routes = {r['route_id']: r for r in R('routes.txt')}
feed = next(R('feed_info.txt'))
cal = {r['service_id']: r for r in R('calendar.txt')}
cdates = collections.defaultdict(dict)
for r in R('calendar_dates.txt'): cdates[r['service_id']][r['date']] = r['exception_type']
trips = {r['trip_id']: r for r in R('trips.txt')}
stops = {r['stop_id']: r['stop_name'] for r in R('stops.txt')}
first, tpoints = {}, collections.defaultdict(list)
for r in R('stop_times.txt'):
    t = r['trip_id']; seq = int(r['stop_sequence'])
    h, m, _ = map(int, r['departure_time'].strip().split(':')); mins = h * 60 + m
    if t not in first or seq < first[t][0]: first[t] = (seq, mins, r['stop_id'])
    if r['timepoint'] == '1': tpoints[t].append((seq, mins, r['stop_id']))
WD = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
FS, FE = feed['feed_start_date'], feed['feed_end_date']

def active(sid, d):
    k = d.strftime('%Y%m%d'); ex = cdates[sid].get(k)
    if ex == '1': return True
    if ex == '2': return False
    c = cal.get(sid)
    return bool(c) and c['start_date'] <= k <= c['end_date'] and c[WD[d.weekday()]] == '1'

def sample(y, m, wd):  # 2nd <weekday> of the month; if outside the feed, the same weekday in the feed's last full week
    d = dt.date(y, m, 1); d += dt.timedelta((wd - d.weekday()) % 7 + 7)
    k = d.strftime('%Y%m%d')
    if FS <= k <= FE: return d, False
    e = dt.datetime.strptime(FE, '%Y%m%d').date() - dt.timedelta(7)
    return e + dt.timedelta((wd - e.weekday()) % 7), True

def fmt(mins):
    h, m = divmod(mins % 1440, 60)
    return f"{(h % 12) or 12}:{m:02d}{'a' if h < 12 else 'p'}"

def by_route(d):
    out = collections.defaultdict(list)
    for t in trips.values():
        if active(t['service_id'], d) and t['trip_id'] in first: out[t['route_id']].append(t)
    return out

def summary(ts):
    if not ts: return None
    deps = sorted(first[t['trip_id']][1] for t in ts)
    gaps = []
    for dirn in ('0', '1'):
        x = sorted(first[t['trip_id']][1] for t in ts if t['direction_id'] == dirn and 7 * 60 <= first[t['trip_id']][1] <= 18 * 60)
        gaps += [b - a for a, b in zip(x, x[1:]) if b > a]
    g = round(statistics.median(gaps)) if gaps else None
    if g: g = min([7.5, 10, 15, 20, 30, 45, 60, 90, 120], key=lambda v: abs(v - g))
    return {'span': f'{fmt(deps[0])}–{fmt(deps[-1])}', 'every': g, 'trips': len(ts)}

def grid(ts):
    dirs = {}
    for dirn in ('0', '1'):
        x = [t for t in ts if t['direction_id'] == dirn]
        if not x: continue
        # label by the most common first timepoint and headsign
        norm = lambda sid: stops[sid].split(' Bay ')[0]
        cnt = collections.Counter(n for t in x for n in {norm(p[2]) for p in tpoints[t['trip_id']]})
        order = collections.defaultdict(list)
        for t in x:
            for i, p in enumerate(sorted(tpoints[t['trip_id']])): order[norm(p[2])].append(i)
        lastc = collections.Counter(norm(sorted(tpoints[t['trip_id']])[-1][2]) for t in x if tpoints[t['trip_id']])
        common = [n for n, c in cnt.items() if c >= 0.8 * len(x) and lastc[n] < 0.5 * len(x)] or [cnt.most_common(1)[0][0]]
        PREFER = ['Plaza', 'K Street Station', 'Eagle Station', 'West Plains TC']  # stops riders actually board at
        pref = [p for p in PREFER if p in common] or common
        org = min(pref, key=lambda n: statistics.mean(order[n]))  # the first boarding stop along the trip
        head = collections.Counter(t['trip_headsign'] for t in x).most_common(1)[0][0]
        hours = collections.defaultdict(list); partial = 0
        for t in x:
            hit = next((p for p in sorted(tpoints[t['trip_id']]) if norm(p[2]) == org), None)
            if hit: mins, mark = hit[1], ''
            else: mins, mark = sorted(tpoints[t['trip_id']] or [first[t['trip_id']]])[0][1], '*'; partial += 1
            hours[(mins // 60) % 24].append((mins % 60, mark))
        hours = {h: [f'{m:02d}{k}' for m, k in sorted(v)] for h, v in hours.items()}
        # typical run time first -> last timepoint
        runs = []
        for t in x:
            tp = sorted(tpoints[t['trip_id']]); k = next((p for p in tp if norm(p[2]) == org), None)
            if k and tp[-1] is not k: runs.append(tp[-1][1] - k[1])
        dirs[dirn] = {'from': org, 'to': head, 'hours': hours, 'partial': partial,
                      'run': [min(runs), max(runs)] if runs else None,
                      'last_stop': collections.Counter(norm(sorted(tpoints[t['trip_id']])[-1][2]) for t in x if tpoints[t['trip_id']]).most_common(1)[0][0] if runs else None}
    return dirs

out = {'feed_version': feed['feed_version'], 'valid_from': FS, 'valid_to': FE, 'months': {}}
months = [(2026, m) for m in (10, 11, 12)] + [(2027, m) for m in range(1, 10)]
for y, m in months:
    entry = {'samples': {}, 'summary': {}, 'grids': {}, 'stale': False}
    for label, wd in (('weekday', 2), ('saturday', 5), ('sunday', 6)):
        d, stale = sample(y, m, wd); entry['samples'][label] = d.isoformat(); entry['stale'] |= stale
        br = by_route(d)
        for rid, ts in br.items():
            entry['summary'].setdefault(rid, {})[label] = summary(ts)
            if GRID_ROUTES is None or rid in GRID_ROUTES: entry['grids'].setdefault(rid, {})[label] = grid(ts)
    out['months'][f'{y}-{m:02d}'] = entry
out['routes'] = {k: {'n': v['route_short_name'], 'name': v['route_long_name']} for k, v in routes.items()}
hol = sorted({k for sid, dd in cdates.items() for k, e in dd.items() if e == '1' and cal.get(sid) and all(cal[sid][w] == '0' for w in WD) and 'holiday' not in sid} )
json.dump(out, open('network.json', 'w'), indent=0)
e = out['months']['2026-10']
print('routes in Oct summary:', len(e['summary']), e['samples'])
print({k: e['summary'][k] for k in ('1', '6', '66', '68')})
