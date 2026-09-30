import os
"""Build an EPUB 3 companion for the Xteink X4 (CrossPoint reader, 480x800 e-ink).
Reads out/m<YYYY-MM>/data.json (from render.mjs). Plain HTML only: no tables, no astro glyph fonts, English only.
Usage: python3 epub.py m<YYYY-MM>   (e.g. m2026-10; run `node render.mjs month 2026-10 ...` first)"""
import json, zipfile, io, uuid, datetime, html, sys, re, calendar
from PIL import Image, ImageDraw

ARG = sys.argv[1] if len(sys.argv) > 1 else ''
if not re.fullmatch(r'm\d{4}-\d{2}', ARG):
    sys.exit('Usage: python3 epub.py m<YYYY-MM>   (e.g. m2026-10)')
OUT = f"{os.environ.get('KW_OUT') or 'out'}/{ARG}"
# content/profile.json (or KW_PROFILE): title, place, modules and content paths (see profile.mjs; the node build has already validated it)
PROFILE = json.load(open(os.environ.get('KW_PROFILE') or 'content/profile.json'))
# A library book (KW_BOOK, KW_LIBRARY or content/library.json) lays its own title, plan and modules over the profile: ask the node side,
# which resolves it in one place (library.mjs), instead of repeating the rules here.
if os.environ.get('KW_BOOK') or os.environ.get('KW_LIBRARY') or (not os.environ.get('KW_PROFILE') and os.path.exists('content/library.json')):
    import subprocess
    PROFILE = json.loads(subprocess.run(['node', 'library-cli.mjs', 'effective'], check=True, capture_output=True, text=True).stdout)
BOOK, LOC, MODS, PATHS, TRANSIT = PROFILE['book'], PROFILE['location'], PROFILE['modules'], PROFILE.get('paths', {}), PROFILE.get('transit') or {}
TITLE, SLUG = BOOK['title'], BOOK['slug']
def content(key):  # a profile content path, parsed; None when the profile has none or the file is absent
    p = PATHS.get(key)
    return json.load(open(p)) if p and os.path.exists(p) else None
D = json.load(open(f'{OUT}/data.json'))
VOL = D['volume']
MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
e = html.escape
# EPUB identifier: keep this exact seed (e.g. "keeping-watch-volm2026-10-Oct 2026") so readers don't see an existing book as new.
BOOK_ID = 'urn:uuid:' + str(uuid.uuid5(uuid.NAMESPACE_URL, f'{SLUG}-vol{ARG}-' + VOL['short']))

def moon_png(deg, size=96):
    """Grayscale moon icon, 8 bits, e-ink friendly (lit white, dark black, thin ring)."""
    import math
    img = Image.new('L', (size, size), 255)
    px = img.load()
    c = (size - 1) / 2; r = size / 2 - 3
    k = math.cos(math.radians(deg))  # terminator x-scale: 1 new, -1 full
    waxing = deg < 180
    for y in range(size):
        for x in range(size):
            dx, dy = x - c, y - c
            if dx * dx + dy * dy > r * r: continue
            half = math.sqrt(max(r * r - dy * dy, 0))
            t = k * half  # terminator position
            lit = (dx > t) if waxing else (dx < -t)
            px[x, y] = 255 if lit else 40
    d = ImageDraw.Draw(img); d.ellipse([c - r, c - r, c + r, c + r], outline=0, width=2)
    b = io.BytesIO(); img.save(b, 'PNG'); return b.getvalue()

PHASES = [0, 45, 90, 135, 180, 225, 270, 315]
def phase_img(deg): return f'moon{min(range(8), key=lambda i: min(abs(PHASES[i]-deg), 360-abs(PHASES[i]-deg)))}.png'

CSS = """body{font-family:serif;margin:0 .4em;line-height:1.35}
h1{font-size:1.5em;margin:.3em 0}h2{font-size:1.25em;margin:.2em 0 .1em;border-bottom:2px solid #000}
h3{font-size:1em;margin:.6em 0 .1em;text-transform:uppercase;letter-spacing:.05em}
p{margin:.25em 0}.dim{color:#333;font-size:.9em}.jp{font-size:1.15em}
.moon{width:3em;height:3em;float:right;margin:0 0 .2em .4em}
.row{margin:.15em 0}.lbl{font-weight:bold}
ul{margin:.2em 0 .2em 1.1em;padding:0}li{margin:.1em 0}
.fact{border-top:1px dotted #000;padding-top:.2em;margin-top:.3em}.day{page-break-before:always}.box{border:1px solid #000;padding:.3em .4em;margin:.4em 0}"""

def page(title, body):
    return f'''<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head><meta charset="utf-8"/><title>{e(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>{body}</body></html>'''

def ruby(k, r): return f'<ruby>{k}<rt>{r}</rt></ruby>'
def dur(m): return f'{m//60}h {m%60:02d}m'

def day_html(d):
    jp = d['jp']; mo = d['moon']; su = d['sun']
    moon_line = ' · '.join(f"enters {i['sign']} {i['time']}" for i in mo['ingress']) or f"in {mo.get('phaseSign', mo['sign'])}"
    notes = [n['text'] for n in d['notes']]
    for c in jp['koChange']:
        notes.insert(0, f"New {LOC['city']} season {c['time']}: {c['en']}")
    ev = ''.join(f"<li>{'☐ ' if x.get('routine') else ''}{e(x['time'] + ' ' if x['time'] else '')}{e(x['title'])}</li>" for x in d['events'])
    return f'''<div class="day" id="d{d['date']}">
<img class="moon" src="{phase_img(mo['phaseDeg'])}" alt="{e(mo['phase'])}"/>
<h2>{d['weekdayName']}, {MONTHS[d['m']-1]} {d['d']}</h2>
<p class="dim">{PLANET_DAY[d['weekday']]} day</p>
<p class="row"><span class="lbl">Moon</span> {e(mo['phase'])}, {mo['lit']}% lit · {e(moon_line)}</p>
<p class="row"><span class="lbl">Sun</span> in {su['sign']} · rise {su['rise']} · set {su['set']} · {dur(su['lengthMin'])} of light</p>
<p class="row"><span class="lbl">Season</span> {e(jp['ko']['en'])}{f' <span class="dim">— {e(jp["ko"]["note"])}</span>' if jp['ko'].get('note') else ''}</p>
{f'<p class="row"><span class="lbl">Retrograde</span> {", ".join(d["retro"])}</p>' if d['retro'] else ''}
{f'<h3>Sky notes</h3><ul>{"".join(f"<li>{e(n)}</li>" for n in notes)}</ul>' if notes else ''}
{f'<h3>Events</h3><ul>{ev}</ul>' if ev else ''}
{f'<p class="fact"><span class="lbl">On this day</span> <i>{e(d["fact"])}</i></p>' if d.get('fact') else ''}
<div class="box"><p class="lbl">Check-in (write it in the paper book)</p><p>On paper: meds, meals, water, mood −3…+3. On the X4: spoons left, sleep, anxiety, care ticks.</p><p class="lbl">Tonight</p><p>What went well? What was hard? What will I do tomorrow?</p></div>
</div>'''

def pio_html(W):
    p = W.get('pioneer')
    if not p: return ''
    name, years, what, fact = p
    return f"<div class='box'><p class='lbl'>Pioneer of the week</p><p><b>{e(name)}</b> <span class='dim'>{years}</span></p><p>{e(what)}</p><p><i>Useless knowledge: {e(fact)}</i></p></div>"

VOL_MONTHS = [M['m'] for M in D['months']]
def week_month(W):
    # A week belongs to the month of its Thursday (ISO rule); edge weeks fall back to a month inside this book.
    thu = [d for d in W['days'] if d['weekday'] == 4]
    for d in thu + [W['days'][0], W['days'][-1]]:
        if d['m'] in VOL_MONTHS: return d['m']

PLANET_DAY = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']

files = {}  # name -> (content, media-type)
spine = []
nav = []

intro = page(TITLE, f'''<h1>{e(TITLE)}</h1>
<p>Companion almanac for the paper journal,  {e(VOL["label"])}. Sky data for {e(D['config']['place'])}, {e(re.sub(r' Time$', ' time', LOC['timezone_name']))}.</p>
<h2>How to use it</h2><ul><li>Open a week from the contents (each day is listed under its week): each day has its moon, sunrise and sunset, micro-season and events.</li><li>Write in the paper book; use this for reference away from it.</li></ul>
<p class="dim">Astrology is included as a reflection prompt, not a forecast. Astronomy is calculated with astronomy-engine. Daily facts: Computer History Museum “This Day in History” and Wikipedia date pages.</p>''')
files['intro.xhtml'] = (intro, 'application/xhtml+xml'); spine.append('intro.xhtml')

# STA bus coverage of this month from the feed's dates (same rule as data.mjs busCoverage): full / partial / none
def bus_coverage():
    if not MODS['bus'] or not PATHS.get('transit') or not os.path.exists(f"{PATHS['transit']}/network.json"): return 'none'
    N = json.load(open(f"{PATHS['transit']}/network.json"))
    mid = f"{VOL['year']}-{VOL['month']:02d}"
    if mid not in N.get('months', {}): return 'none'
    iso = lambda x: f"{x[:4]}-{x[4:6]}-{x[6:]}"
    first = f"{mid}-01"; last = f"{mid}-{calendar.monthrange(VOL['year'], VOL['month'])[1]:02d}"
    a, b = iso(N['valid_from']), iso(N['valid_to'])
    if last < a or first > b: return 'none'
    return 'full' if first >= a and last <= b else 'partial'
BUS_COV = bus_coverage()

# Support resources + safety plan prompts (content/support.json, shared with the paper book)
if content('support') is not None:
    SUP = content('support')
    body = "<h1>Support</h1><p class='dim'>[TEXT] means you can text instead of talking. Emergency: 911. Checked Sep 2026; numbers and hours can change.</p>"
    for h, items in SUP:
        body += f"<h2>{h}</h2><ul>" + ''.join(f"<li><b>{n}</b> [{c.replace(' ', '] [')}]<br/>{d}</li>" for n, d, c in items) + "</ul>"
    if content('clinic') is not None:
        C = content('clinic')
        body = body.replace("<h2>", f"<h2>My clinic</h2><p><b>{C['name']}</b><br/>{C['address']}</p><ul>" + ''.join(f"<li><b>{k}</b>{(' [' + c.replace(' ', '] [') + ']') if c else ''}<br/>{d}</li>" for k, d, c in C['lines']) + "</ul><h2>", 1)
    if MODS['trans_support'] and content('trans') is not None:
        body += "<h1>Trans support</h1>"
        for h, items in content('trans'):
            body += f"<h2>{h}</h2><ul>" + ''.join(f"<li><b>{n}</b>{(' [' + c.replace(' ', '] [') + ']') if c else ''}<br/>{d}</li>" for n, d, c in items) + "</ul>"
    body += "<h2>My safety plan</h2><p>Fill in the paper page on a good day. Work down the list until you feel safer:</p><ol><li>Signs a hard time is starting</li><li>Things I can do on my own</li><li>People or places that take my mind off it</li><li>People I can text for help</li><li>Professionals: therapist, prescriber, 988, crisis line 1-877-266-1818</li><li>Making my space safer</li><li>What matters to me</li></ol><p><b>A text I can send when talking is too hard:</b> “Hey, I’m having a hard time. I’m not up for a call. Can you text with me for a bit?”</p>"
    if MODS['bus'] and BUS_COV == 'none': body += f"<p><b>Bus times:</b> {TRANSIT['site']} or the {TRANSIT['app']}</p>"
    body = body.replace('&amp;', '&').replace('&', '&amp;').replace('&amp;amp;', '&amp;')
    files['support.xhtml'] = (page('Support', body), 'application/xhtml+xml'); spine.append('support.xhtml')

# STA schedules (gtfs/network.json): network summary + hour grids
if BUS_COV != 'none':
    N = json.load(open(f"{PATHS['transit']}/network.json"))
    E = N['months'].get(f"{VOL['year']}-{VOL['month']:02d}")
    if E:
        DAYS = [('weekday', 'Wkdy'), ('saturday', 'Sat'), ('sunday', 'Sun')]
        num = lambda r: int(''.join(c for c in N['routes'][r]['n'] if c.isdigit()) or 0)
        cell = lambda x: f"{x['span']} · {x['every']}" if x and x.get('every') else (x['span'] if x else '—')
        rows = ''.join(f"<tr><td><b>{e(N['routes'][r]['n'])}</b> {e(N['routes'][r]['name'])}</td>" + ''.join(f"<td>{e(cell(E['summary'][r].get(k)))}</td>" for k, _ in DAYS) + '</tr>' for r in sorted(E['summary'], key=num) if r in N['routes'])
        until = datetime.date(int(N['valid_to'][:4]), int(N['valid_to'][4:6]), int(N['valid_to'][6:]))
        VALID = f"<p><b>Schedule valid through {until.strftime('%b')} {until.day} · check {TRANSIT['site']} after</b></p>" if BUS_COV == 'partial' else ''
        body = f"<h1>{TRANSIT['agency']} buses</h1><p class='dim'>First–last bus · minutes between buses at midday. Schedule {N['valid_from'][4:6]}/{N['valid_from'][6:]} – {N['valid_to'][4:6]}/{N['valid_to'][6:]}/{N['valid_to'][:4]}. Holidays run Sunday times.</p>{VALID}<table class='bus'><tr><th>Route</th>{''.join(f'<th>{l}</th>' for _, l in DAYS)}</tr>{rows}</table>"
        for r in TRANSIT.get('priority_routes', []):
            G = E['grids'].get(r)
            if not G: continue
            body += f"<h2>Route {e(N['routes'][r]['n'])} · {e(N['routes'][r]['name'])}</h2>"
            for dirn in ('0', '1'):
                days = [(k, l) for k, l in DAYS if G.get(k) and G[k].get(dirn)]
                if not days: continue
                g0 = G[days[0][0]][dirn]
                hrs = sorted({int(h) for k, _ in days for h in G[k][dirn]['hours']}, key=lambda h: (h + 21) % 24)
                hl = lambda h: f"{(h % 12) or 12}{'a' if h < 12 else 'p'}"
                body += f"<h3>{e(g0['from'])} → {e(g0['to'])}</h3><table class='bus'><tr><th></th>{''.join(f'<th>{l}</th>' for _, l in days)}</tr>" + ''.join(f"<tr><td><b>{hl(h)}</b></td>" + ''.join(f"<td>{' '.join(G[k][dirn]['hours'].get(str(h), []))}</td>" for k, _ in days) + '</tr>' for h in hrs) + '</table>'
        files['bus.xhtml'] = (page(f"{TRANSIT['agency']} buses", body), 'application/xhtml+xml'); spine.append('bus.xhtml')

for M in D['months']:
    name = f"m{M['m']:02d}.xhtml"
    rows = []
    for d in M['days']:
        for n in d['notes']: rows.append(f"<li><b>{d['d']}</b> {e(n['text'])}</li>")
        for s in d['sun']['ingress']: rows.append(f"<li><b>{d['d']}</b> Sun enters {s['sign']} {s['time']}</li>")
        for c in d['jp']['koChange']:
            rows.append(f"<li><b>{d['d']}</b> Season: {e(c['en'])} <span class='dim'>— {e(c.get('note', ''))}</span></li>")
    f, l = M['days'][0], M['days'][-1]
    body = f"<h1>{M['name']} {M['y']}</h1><p>Daylight: {dur(f['sun']['lengthMin'])} on {M['name'][:3]} 1 → {dur(l['sun']['lengthMin'])} on {M['name'][:3]} {l['d']}.</p><h2>Sky &amp; seasons</h2><ul>{''.join(rows)}</ul>"
    files[name] = (page(M['name'], body), 'application/xhtml+xml'); spine.append(name)
    wk_items = []
    for W in D['weeks']:
        if week_month(W) != M['m']:
            continue
        wn = f"w{W['n']:02d}.xhtml"
        f0, l0 = W['days'][0], W['days'][-1]
        wbody = f"<h1>{W.get('label') or 'Week ' + str(W['n'])}</h1><p class='dim'>{MONTHS[f0['m']-1]} {f0['d']} – {MONTHS[l0['m']-1]} {l0['d']}</p>" + pio_html(W) + ''.join(day_html(d) for d in W['days'])
        files[wn] = (page(f"Week {W['n']}", wbody), 'application/xhtml+xml'); spine.append(wn)
        days_nav = ''.join(f"<li><a href='{wn}#d{d['date']}'>{d['weekdayName'][:3]} {MONTHS[d['m']-1][:3]} {d['d']}</a></li>" for d in W['days'])
        wk_items.append(f"<li><a href='{wn}'>Week {W['n']} · {MONTHS[f0['m']-1][:3]} {f0['d']}</a><ol>{days_nav}</ol></li>")
    nav.append(f"<li><a href='{name}'>{M['name']}</a><ol>{''.join(wk_items)}</ol></li>")

# sanity: every week included exactly once
assert len([s for s in spine if s.startswith('w')]) == len(D['weeks']), [s for s in spine if s.startswith('w')]

navdoc = f'''<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en"><head><meta charset="utf-8"/><title>Contents</title></head>
<body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol><li><a href="intro.xhtml">About</a></li>{'<li><a href="support.xhtml">Support</a></li>' if 'support.xhtml' in files else ''}{'<li><a href="bus.xhtml">' + str(TRANSIT.get('agency')) + ' buses</a></li>' if 'bus.xhtml' in files else ''}{''.join(nav)}</ol></nav>
<nav epub:type="landmarks" hidden="hidden"><h2>Landmarks</h2><ol><li><a epub:type="toc" href="nav.xhtml#toc">Contents</a></li><li><a epub:type="bodymatter" href="intro.xhtml">Start of the book</a></li></ol></nav></body></html>'''

# EPUB 2 NCX for older readers
pts = []; order = 1
def np(label, src, children=''):
    global order
    o = order; order += 1
    return f'<navPoint id="n{o}" playOrder="{o}"><navLabel><text>{e(label)}</text></navLabel><content src="{src}"/>{children}</navPoint>'
ncx_body = ''.join(np(f'Week {int(x[1:3])}' if x.startswith('w') else ('About' if x == 'intro.xhtml' else 'Support' if x == 'support.xhtml' else f"{TRANSIT.get('agency')} buses" if x == 'bus.xhtml' else MONTHS[int(x[1:3]) - 1]), x) for x in spine)
ncx = f'''<?xml version="1.0" encoding="utf-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="{BOOK_ID}"/></head><docTitle><text>{e(TITLE)}</text></docTitle><navMap>{ncx_body}</navMap></ncx>'''

now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
imgs = {f'moon{i}.png': moon_png(p) for i, p in enumerate(PHASES)}
manifest = ''.join(f'<item id="{n.split(".")[0]}" href="{n}" media-type="{t}"/>' for n, (_, t) in files.items())
manifest += ''.join(f'<item id="{n.split(".")[0]}" href="{n}" media-type="image/png"/>' for n in imgs)
manifest += '<item id="css" href="style.css" media-type="text/css"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'
opf = f'''<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">{BOOK_ID}</dc:identifier><dc:title>{e(TITLE)} — {e(VOL['label'])} Almanac</dc:title><dc:language>en</dc:language><dc:creator>{e(PROFILE['person']['name'])}</dc:creator><meta property="dcterms:modified">{now}</meta>
<meta property="schema:accessMode">textual</meta><meta property="schema:accessMode">visual</meta>
<meta property="schema:accessModeSufficient">textual</meta>
<meta property="schema:accessibilityFeature">structuralNavigation</meta><meta property="schema:accessibilityFeature">tableOfContents</meta><meta property="schema:accessibilityFeature">readingOrder</meta><meta property="schema:accessibilityFeature">alternativeText</meta>
<meta property="schema:accessibilityHazard">none</meta>
<meta property="schema:accessibilitySummary">All text is real text that a reader can resize, with a contents list, one top-level heading per page and days as sub-headings. The moon images have alternative text. The reading order follows the visual order.</meta></metadata>
<manifest>{manifest}</manifest>
<spine toc="ncx"><itemref idref="nav"/>{''.join(f'<itemref idref="{s.split(".")[0]}"/>' for s in spine)}</spine></package>'''

with zipfile.ZipFile(f'{OUT}/{SLUG}-{ARG[1:]}-x4.epub', 'w') as z:
    z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
    z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>', compress_type=zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/content.opf', opf, compress_type=zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/nav.xhtml', navdoc, compress_type=zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/toc.ncx', ncx, compress_type=zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/style.css', CSS, compress_type=zipfile.ZIP_DEFLATED)
    for n, (c, _) in files.items(): z.writestr('OEBPS/' + n, c, compress_type=zipfile.ZIP_DEFLATED)
    for n, b in imgs.items(): z.writestr('OEBPS/' + n, b, compress_type=zipfile.ZIP_DEFLATED)
print('epub ok:', len(spine), 'spine items')
