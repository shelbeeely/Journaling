#!/usr/bin/env python3
"""Export the paper journal's generated data into SD-card packs for the X4 firmware.

Reads journal/out/m<YYYY-MM>/data.json (written by render.mjs) plus content/support.json,
trans.json and clinic.json, and writes:
  sd/kw/<YYYY-MM>.txt   one section per day ("@YYYY-MM-DD"), key=value lines, UTF-8
  sd/kw/support.txt     the Support screen (sections "#", entries "name|detail|how")
Usage: python3 tools/export_pack.py <journal dir> <sd dir> [YYYY-MM ...]   (default: every built month)
"""
import json, os, sys, glob, re

J, SD = sys.argv[1], sys.argv[2]
months = sys.argv[3:] or sorted(os.path.basename(p)[1:] for p in glob.glob(f'{J}/out/m20??-??') if os.path.isdir(p))
os.makedirs(f'{SD}/kw/log', exist_ok=True)
strip = lambda s: re.sub(r'<[^>]+>', '', s).replace('&amp;', '&').replace('\n', ' ').strip()
PLANET = {0: ('☉', 'Sun'), 1: ('☽', 'Moon'), 2: ('♂', 'Mars'), 3: ('☿', 'Mercury'), 4: ('♃', 'Jupiter'), 5: ('♀', 'Venus'), 6: ('♄', 'Saturn')}

def dur(m): return f'{m // 60}h {m % 60:02d}m'

for mid in months:
    D = json.load(open(f'{J}/out/m{mid}/data.json'))
    week_of = {}
    for W in D['weeks']:
        for d in W['days']:
            week_of[d['date']] = W
    out = [f'# Keeping Watch day pack {mid} · generated from the paper journal build']
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
            if src.endswith(('.pdf', '.epub')): shutil.copy(src, lib)
    for src in glob.glob(f'{J}/out/keeper/*.pdf') + glob.glob(f'{J}/out/keeping-watch-support-pages.pdf'):
        shutil.copy(src, lib)
    print('library', len(os.listdir(lib)), 'files', sum(os.path.getsize(os.path.join(lib, f)) for f in os.listdir(lib)) // (1024 * 1024), 'MB')

# Support screen
C = json.load(open(f'{J}/content/clinic.json'))
lines = ['# Support · checked Sep 2026']
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
