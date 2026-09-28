# Build a compact Route 6 (Cheney) timetable from STA static GTFS -> route6.json
# Usage: python3 gtfs/build.py   (download first: curl -L -o gtfs/sta.zip https://www.spokanetransit.com/gtfs && unzip -o gtfs/sta.zip -d gtfs)
import csv, collections, json, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
R = csv.DictReader
trips = {r['trip_id']: r for r in R(open('trips.txt')) if r['route_id'] == '6'}
st = collections.defaultdict(list)
for r in R(open('stop_times.txt')):
    if r['trip_id'] in trips: st[r['trip_id']].append(r)
stops = {r['stop_id']: r['stop_name'] for r in R(open('stops.txt'))}
feed = next(R(open('feed_info.txt')))
cal = {r['service_id']: r for r in R(open('calendar.txt'))}
cdates = collections.defaultdict(list)
for r in R(open('calendar_dates.txt')): cdates[r['service_id']].append((r['date'], r['exception_type']))
KEY = {'0': [('Plaza', 'Plaza'), ('West Plains TC', 'West Plains TC'), ('Eagle Station', 'EWU Eagle Stn'), ('K Street Station', 'Cheney K St')],
       '1': [('K Street Station', 'Cheney K St'), ('Eagle Station', 'EWU Eagle Stn'), ('West Plains TC', 'West Plains TC'), ('Plaza', 'Plaza')]}
def fmt(t):
    h, m, _ = map(int, t.strip().split(':')); h %= 24
    return f"{(h % 12) or 12}:{m:02d}{'a' if h < 12 else 'p'}", h * 60 + m
def kind(svc):
    c = cal.get(svc)
    if c and c['monday'] == '1': return 'weekday'
    if c and c['saturday'] == '1': return 'saturday'
    if c and c['sunday'] == '1': return 'sunday'
    # 672.6.1 / 672.8.1 add the same extra trips on every non-holiday weekday (checked Sep 2026 feed); 672.0.4 = holiday = Sunday times
    return {'672.8.1': 'weekday', '672.6.1': 'weekday_dup', '672.0.4': 'holiday'}.get(svc, 'other')
out = {'feed_version': feed['feed_version'], 'valid_from': feed['feed_start_date'], 'valid_to': feed['feed_end_date'], 'dirs': {}}
for d, cols in KEY.items():
    rows = collections.defaultdict(list)
    for t in trips.values():
        if t['direction_id'] != d: continue
        seq = sorted(st[t['trip_id']], key=lambda r: int(r['stop_sequence']))
        cells, sortk = [], None
        for pref, _ in cols:
            hit = next((r for r in seq if stops[r['stop_id']].startswith(pref)), None)
            if hit: s, k = fmt(hit['departure_time']); cells.append(s); sortk = k if sortk is None else sortk
            else: cells.append('')
        rows[kind(t['service_id'])].append((sortk, cells))
    out['dirs'][d] = {'head': [c[1] for c in cols], 'to': 'Cheney' if d == '0' else 'Spokane',
                      'rows': {k: [c for _, c in sorted(v, key=lambda x: (x[0] if x[0] >= 180 else x[0] + 1440))] for k, v in rows.items() if k in ('weekday', 'saturday', 'sunday')}}
# service exceptions (holiday schedules) by date
def iso(s): return f'{s[:4]}-{s[4:6]}-{s[6:]}'
out['holiday_service'] = [iso(x) for x, e in cdates['672.0.4'] if e == '1']
out['ewu_class_days'] = sorted(iso(x) for x, e in cdates['672.8.1'] if e == '1')
json.dump(out, open('route6.json', 'w'), indent=1)
for d in out['dirs'].values(): print(d['to'], {k: len(v) for k, v in d['rows'].items()})
print(out['holiday_service'], len(out['ewu_class_days']))
