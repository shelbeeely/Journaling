#!/usr/bin/env python3
"""Export the paper journal's generated data into SD-card packs for the X4 firmware.

Reads journal/out/m<YYYY-MM>/data.json (written by render.mjs) plus content/support.json,
trans.json and clinic.json, and writes:
  sd/kw/<YYYY-MM>.txt   one section per day ("@YYYY-MM-DD"), key=value lines, UTF-8
  sd/kw/support.txt     the Support screen (sections "#", entries "name|detail|how")
  sd/kw/checkins.txt    custom check-ins from content/daypage.json ("@group", "key|label|kind|lo|hi|def")
Every file's first line ends "built YYYY-MM-DD" (the journal build date); each day has "page=N" (printed page).
Usage: python3 tools/export_pack.py <journal dir> <sd dir> [YYYY-MM ...]   (default: every built month)
"""
import json, os, sys, glob, re, math

J, SD = sys.argv[1], sys.argv[2]
months = sys.argv[3:] or sorted(os.path.basename(p)[1:] for p in glob.glob(f'{J}/out/m20??-??') if os.path.isdir(p))
os.makedirs(f'{SD}/kw/log', exist_ok=True)
strip = lambda s: re.sub(r'<[^>]+>', '', s).replace('&amp;', '&').replace('\n', ' ').strip()

# Custom check-ins: the day page editor's own blocks, so what's on paper is also on the X4.
# Mirrors journal/daypage.mjs TYPES (defaults and clamps). Built-ins (care, spoons, sleeptimes) are already on the device.
CHECKIN_MAX = 16  # the firmware has 32 slots; the built-ins use 15
CHECKIN_TYPES = {  # type: (kind, hi, default title, title max, default labels, labels max)
    'checks': ('toggle', 1, 'Habits', 24, ['Stretch', 'Outside', 'Read'], 8),
    'habits': ('dots', 2, 'Habits', 24, ['Stretch', 'Outside', 'Read', 'Water'], 8),
    'fields': ('count', 99, 'Outside', 18, ['Minutes outside', 'Steps'], 6),
    'scale': ('scale', None, 'Energy', 18, None, 0),  # one item, 1..steps
}

def slugify(label):  # key part: lowercase, runs outside [a-z0-9] -> _, max 24, never empty
    return re.sub(r'[^a-z0-9]+', '_', label.lower()).strip('_')[:24].strip('_') or 'item'

def clean(v): return ' '.join(str(v).replace('|', ' ').split())  # no pipes or newlines inside a field

def opt_text(b, k, d, mx):
    v = b.get(k)
    return d if v is None else str(v)[:mx]

def opt_list(b, k, d, mx):
    v = b.get(k)
    v = v if isinstance(v, list) else v.split(',') if isinstance(v, str) else d
    return [x for x in (str(x).strip()[:24] for x in v) if x][:mx]

def opt_num(b, k, lo, hi, d):
    try: return min(hi, max(lo, math.floor(float(b.get(k)) + 0.5)))  # JS Math.round
    except (TypeError, ValueError, OverflowError): return d  # NaN, Infinity too

def checkins(path):
    lines = ['# Custom check-ins from the day page layout']
    if not os.path.exists(path): return lines, 0
    try: L = json.load(open(path, encoding='utf-8'))
    except ValueError as e: sys.exit(f'export_pack: {path} is not valid JSON ({e}). Fix or delete it, then rerun.')
    if not isinstance(L, dict) or L.get('v') != 2 or not isinstance(L.get('blocks'), list):
        print(f'checkins: {path} is not a v2 layout (open and save it in the editor); no custom check-ins')
        return lines, 0
    items, dropped, uids, keys = 0, 0, set(), set()
    for b in L['blocks']:
        if not isinstance(b, dict) or b.get('type') not in CHECKIN_TYPES or not b.get('on', True): continue
        t = b['type']; kind, hi, dtitle, tmax, dlabels, lmax = CHECKIN_TYPES[t]
        uid = b.get('uid') if isinstance(b.get('uid'), str) and re.fullmatch(r'[\w-]{1,40}', b.get('uid')) else t
        uid = re.sub(r'[^a-z0-9_]', '_', uid.lower()); base, n = uid, 2
        while uid in uids: uid, n = f'{base}_{n}', n + 1
        uids.add(uid)
        title = clean(opt_text(b, 'title', dtitle, tmax)) or dtitle
        if t == 'scale':
            steps = opt_num(b, 'steps', 3, 10, 5)
            rows = [(None, title, kind, 1, steps, (1 + steps) // 2)]  # one item, keyed c_<uid>
        else:
            rows, slugs = [], set()
            for x in opt_list(b, 'labels', dlabels, lmax):
                label = clean(x)
                if not label: continue
                slug = slugify(label); base_s, n = slug, 2
                while slug in slugs: slug, n = f'{base_s}_{n}', n + 1
                slugs.add(slug)
                rows.append((slug, label, kind, 0, hi, 0))
        out = []
        for slug, label, k, lo, h, d in rows:  # keys follow the label, so deleting one leaves the others (except same-slug labels, numbered in order)
            if items >= CHECKIN_MAX: dropped += 1; continue
            key = f'c_{uid}' if slug is None else f'c_{uid}_{slug}'; base_k, n = key, 2
            while key in keys: key, n = f'{base_k}_{n}', n + 1  # e.g. scale uid "a_b" vs checks uid "a" + label "b"
            keys.add(key)
            out.append(f'{key}|{label}|{k}|{lo}|{h}|{d}'); items += 1
        if out: lines += [f'@{title}'] + out
    if dropped: print(f'checkins: WARNING {dropped} item(s) dropped; the X4 holds at most {CHECKIN_MAX} custom check-ins')
    return lines, items

# Build stamp: the journal build's own date (data.json "generated"), the same day the book's title page prints
# ("Built 2026-09-28"). Written into the first line of every pack, support.txt and checkins.txt so the X4
# can show which build is on the card, and so a clock set before it can be caught.
def built_stamp():
    for mid in months:
        try: return json.load(open(f'{J}/out/m{mid}/data.json'))['generated'][:10]
        except (FileNotFoundError, KeyError, ValueError): pass
    import datetime; return datetime.date.today().isoformat()
BUILT = built_stamp()

ck, n = checkins(f'{J}/content/daypage.json')
ck[0] += f' · built {BUILT}'
open(f'{SD}/kw/checkins.txt', 'w', encoding='utf-8').write('\n'.join(ck) + '\n')
print('checkins', n, 'items')

# Changing custom check-ins mid-month leaves that month's earlier lines under keys that no longer exist.
# The X4 keeps them in the log and says how many it sees; warn here so it is a choice, never a surprise.
live = {'med_am', 'med_pm', 'prn', 'prn_undo', 'meal1', 'meal2', 'meal3', 'snack', 'shower', 'teeth', 'joy', 'texted',
        'mood', 'anxiety', 'spoons', 'sleep'} | {l.split('|')[0] for l in ck if '|' in l}
old_keys = set()
for lp in glob.glob(f'{SD}/kw/log/*.csv'):
    for ln in open(lp, encoding='utf-8', errors='replace'):
        f = ln.rstrip('\n').split(',')
        if len(f) >= 3 and not ln.startswith('#') and f[1] not in live: old_keys.add(f[1])
if old_keys: print(f'checkins: WARNING the log on this card has {len(old_keys)} key(s) no longer in the layout ({", ".join(sorted(old_keys)[:4])}). '
                   'Their entries stay in the CSV and the X4 shows a count, but they are not in Check in or This month. Change custom check-ins at the start of a month.')

PLANET = {0: ('☉', 'Sun'), 1: ('☽', 'Moon'), 2: ('♂', 'Mars'), 3: ('☿', 'Mercury'), 4: ('♃', 'Jupiter'), 5: ('♀', 'Venus'), 6: ('♄', 'Saturn')}

def dur(m): return f'{m // 60}h {m % 60:02d}m'

for mid in months:
    D = json.load(open(f'{J}/out/m{mid}/data.json'))
    week_of = {}
    for W in D['weeks']:
        for d in W['days']:
            week_of[d['date']] = W
    # Printed page of each day in the paper book (layout.json; identical in both trims), so Today can say "book p. 26".
    page_of = {}
    try:
        for pg in json.load(open(f'{J}/out/m{mid}/layout.json'))['pages']:
            if pg.get('date') and pg.get('type') == 'dayp': page_of[pg['date']] = pg['page']
    except FileNotFoundError:
        print(f'pack {mid}: no layout.json, so no page numbers on Today')
    stamp = D.get('generated', BUILT)[:10]
    out = [f'# Keeping Watch day pack {mid} · generated from the paper journal build · built {stamp}']
    try:
        kp = json.load(open(f'{J}/out/keeper/index.json'))['handoff_page'].get(mid)
        if kp: out.append(f'keeper={kp}')
    except FileNotFoundError:
        pass
    for d in D['days']:
        if d['date'][:7] != mid: continue
        mo, su, jp = d['moon'], d['sun'], d['jp']
        g, pn = PLANET[d['weekday']]
        out.append(f"@{d['date']}")
        out.append(f"wd={d['weekdayName']}")
        if d['date'] in page_of: out.append(f"page={page_of[d['date']]}")
        out.append(f"planet={g} {pn}")
        out.append(f"moon={mo['phaseDeg']}|{mo['lit']}|{mo['phase']}|{mo['glyph']} {mo['sign']}")
        for i in mo['ingress']: out.append(f"moonin={D['glyphs'][i['sign']]} {i['sign']} {i['time']}")
        out.append(f"sun={su['rise']}|{su['set']}|{dur(su['lengthMin'])}|{su['glyph']} {su['sign']}")
        out.append(f"season={jp['ko']['en']}|{jp['ko'].get('note', '')}")
        for c in jp['koChange']: out.append(f"newseason={c['time']}")
        for n in d['notes']:
            kind = n.get('kind', '')
            out.append(f"note={'!' if kind == 'holiday' else ''}{strip(n['text'])}")
        for e in d['events']:
            out.append(f"{'rt' if e.get('routine') else 'ev'}={(e['time'] + ' ') if e['time'] else ''}{strip(e['title'])}")
        if d.get('fact'): out.append(f"fact={strip(d['fact'])}")
        W = week_of.get(d['date'])
        if W:
            P = W.get('pioneer')
            if P: out.append('pioneer=' + '|'.join(strip(x) for x in (list(P) + ['', '', '', ''])[:4]))
            if W.get('prompt'): out.append(f"prompt={strip(W['prompt'])}")
    open(f'{SD}/kw/{mid}.txt', 'w').write('\n'.join(out) + '\n')
    print('pack', mid, sum(1 for l in out if l.startswith('@')), 'days', os.path.getsize(f'{SD}/kw/{mid}.txt') // 1024, 'KB')

# Library: the books themselves, so the X4's web page can hand them to any phone or computer
import shutil
if not os.environ.get('KW_NO_LIBRARY'):  # previews and CI sample cards skip the 57 MB of books
    lib = f'{SD}/kw/library'; os.makedirs(lib, exist_ok=True)
    for mid in months:
        for src in glob.glob(f'{J}/out/m{mid}/keeping-watch-*') + glob.glob(f'{J}/out/m{mid}-letter/keeping-watch-*'):
            if src.endswith(('.pdf', '.epub')) and not src.endswith('-cover.pdf'): shutil.copy(src, lib)  # covers are for KDP, not for reading
    for src in glob.glob(f'{J}/out/keeper/*.pdf') + glob.glob(f'{J}/out/keeping-watch-support-pages.pdf'):
        if not src.endswith('-cover.pdf'): shutil.copy(src, lib)
    print('library', len(os.listdir(lib)), 'files', sum(os.path.getsize(os.path.join(lib, f)) for f in os.listdir(lib)) // (1024 * 1024), 'MB')

# Support screen
C = json.load(open(f'{J}/content/clinic.json'))
lines = [f'# Support · checked Sep 2026 · built {BUILT}']
for fname in ('support.json', 'trans.json'):
    for h, items in json.load(open(f'{J}/content/{fname}')):
        lines.append(f'#{strip(h)}')
        for n, dsc, c in items: lines.append(f'{strip(n)}|{strip(dsc)}|{c}')
lines.append('#My clinic')
lines.append(f"{strip(C['name'])}|{strip(C['address'])}|VISIT")
for k, dsc, c in C['lines']: lines.append(f'{strip(k)}|{strip(dsc)}|{c}')
open(f'{SD}/kw/support.txt', 'w').write('\n'.join(lines) + '\n')
if not os.path.exists(f'{SD}/kw/me.txt'):
    open(f'{SD}/kw/me.txt', 'w').write('''# Your safety plan and people. Edit here or from the Wi-Fi page (hold Down on the menu → Sync).
#Signs a hard time is starting
#Things I can do on my own
#People or places that help
#People I can text
#Professionals
#Making my space safer
#What matters to me
''')
print('support', len(lines), 'lines')
