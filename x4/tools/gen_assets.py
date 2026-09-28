#!/usr/bin/env python3
"""Generate 1-bit bitmap fonts and icons for the Keeping Watch X4 firmware.

Output: src/gen/assets.h (fonts + icons as const arrays, shared by the device and host builds).
Fonts are rasterized once here (threshold at 50%), so the device never runs a font engine and
the host preview is pixel-identical to the panel.
"""
import os, io, textwrap
from PIL import Image, ImageDraw, ImageFont
import cairosvg

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'gen', 'assets.cpp')
HDR = os.path.join(HERE, '..', 'src', 'gen', 'assets.h')
LORA = '/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf'
LORA_I = '/usr/share/fonts/truetype/google-fonts/Lora-Italic-Variable.ttf'
DEJAVU = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
DEJAVU_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

TEXT = ''.join(chr(c) for c in range(32, 127)) + '°–—·…’‘“”•×→←−é'
GLYPHS = '☉☽☿♀♂♃♄♅♆♇♈♉♊♋♌♍♎♏♐♑♒♓℞☀★✓◀▶'

# name, ttf, size(px), variation weight or None, charset
FONTS = [
    ('F_UI_S', f'{HERE}/Inter-500.ttf', 17, None, TEXT),      # labels, captions
    ('F_UI', f'{HERE}/Inter-500.ttf', 21, None, TEXT),        # list rows, buttons
    ('F_UI_B', f'{HERE}/Inter-700.ttf', 21, None, TEXT),      # emphasis
    ('F_UI_XL', f'{HERE}/Inter-700.ttf', 40, None, TEXT),     # big numbers
    ('F_BODY', LORA, 22, 400, TEXT),                          # reading text
    ('F_BODY_I', LORA_I, 22, 400, TEXT),                      # seasons, quotes
    ('F_TITLE', LORA, 38, 600, TEXT),                         # screen titles
    ('F_HUGE', LORA, 96, 600, TEXT),                          # the date numeral
    ('F_SYM', DEJAVU, 22, None, GLYPHS),                      # astro glyphs
    ('F_SYM_L', DEJAVU, 34, None, GLYPHS),
]

def load(path, size, wght):
    f = ImageFont.truetype(path, size)
    if wght:
        try:
            f.set_variation_by_axes([wght])
        except Exception:
            pass
    return f

def render_font(name, path, size, wght, chars):
    f = load(path, size, wght)
    asc, desc = f.getmetrics()
    glyphs, blob = [], bytearray()
    for ch in sorted(set(chars), key=ord):
        try:
            box = f.getbbox(ch)
        except Exception:
            continue
        adv = round(f.getlength(ch))
        x0, y0, x1, y1 = box
        w, h = max(0, x1 - x0), max(0, y1 - y0)
        off = len(blob)
        if w and h:
            im = Image.new('L', (w, h), 0)
            ImageDraw.Draw(im).text((-x0, -y0), ch, font=f, fill=255)
            bw = (w + 7) // 8
            for yy in range(h):
                row = bytearray(bw)
                for xx in range(w):
                    if im.getpixel((xx, yy)) >= 128:
                        row[xx >> 3] |= 0x80 >> (xx & 7)
                blob += row
        glyphs.append((ord(ch), off, w, h, adv, x0, y0 - asc))
    return asc, desc, glyphs, blob

# Icons: the same monoline set the paper journal prints (render.mjs IC), so the device matches the book.
IC = {
  'pill': '<rect x="1.3" y="4" width="9.4" height="4" rx="2" transform="rotate(-35 6 6)"/><path d="M6 3.1 L6 8.9" transform="rotate(-35 6 6)"/>',
  'am': '<circle cx="6" cy="6" r="2.3"/><path d="M6 .8V2.2M6 9.8v1.4M.8 6h1.4M9.8 6h1.4M2.3 2.3l1 1M8.7 8.7l1 1M2.3 9.7l1-1M8.7 3.3l1-1"/>',
  'pm': '<path d="M8.6 1.6A4.6 4.6 0 1 0 10.4 8 3.7 3.7 0 0 1 8.6 1.6Z"/>',
  'prn': '<circle cx="6" cy="6" r="4.6"/><path d="M6 3.4V6l1.8 1.2"/>',
  'meal': '<circle cx="6.6" cy="6.4" r="3.4"/><path d="M1.4 1.4v3.4M.6 1.4v2.4a.8.8 0 0 0 1.6 0V1.4M1.4 4.8v5.8"/>',
  'snack': '<path d="M6 3.6c-1.4-1-4-.6-4 2.2 0 2.4 1.6 4.6 3 4.6.5 0 .7-.3 1-.3s.5.3 1 .3c1.4 0 3-2.2 3-4.6 0-2.8-2.6-3.2-4-2.2Z"/><path d="M6 3.6c0-1.2.6-2 1.6-2.4"/>',
  'shower': '<path d="M2 11V3.2A2 2 0 0 1 4 1.2h1.4a2 2 0 0 1 2 2V4"/><path d="M5.2 4h4.4"/><path d="M5.8 6v.4M7.4 6v.4M9 6v.4M5.4 8v.4M7.2 8v.4M9.2 8v.4"/>',
  'teeth': '<path d="M3.2 1.6c-1.4 0-2 1.2-2 2.6 0 2 .8 3 1.2 5.4.2 1 .5 1.4.9 1.4.7 0 .8-2.6 1.4-3.2.3-.3.3-.3.6 0 .6.6.7 3.2 1.4 3.2.4 0 .7-.4.9-1.4.4-2.4 1.2-3.4 1.2-5.4 0-1.4-.6-2.6-2-2.6-1 0-1.4.6-2.3.6s-1.3-.6-2.3-.6Z" transform="translate(.8 0)"/>',
  'joy': '<path d="M6 1.2 7.2 4.8 10.8 6 7.2 7.2 6 10.8 4.8 7.2 1.2 6 4.8 4.8Z"/>',
  'text': '<path d="M1.4 2.2h9.2v6H5.4L2.8 10.4V8.2H1.4Z"/><path d="M3.6 4.6h4.8M3.6 6.2h3"/>',
  'sleep': '<path d="M1 10V3.4M1 7.6h10V10M1 6.2h2.6a1.2 1.2 0 0 0 0-2.4H1"/><path d="M5 6.2V5a1.2 1.2 0 0 1 1.2-1.2H9.8A1.2 1.2 0 0 1 11 5v2.6"/>',
  'work': '<rect x="1" y="3.6" width="10" height="7" rx="1"/><path d="M4 3.6V2.2h4v1.4M1 6.8h10"/>',
  'spoon': '<ellipse cx="6" cy="3.2" rx="2.1" ry="2.5"/><path d="M6 5.7V11"/>',
  'low': '<circle cx="6" cy="6" r="4.8"/><path d="M4.1 8.2c1.1-1 2.7-1 3.8 0"/><path d="M4.3 4.6v.4M7.7 4.6v.4"/>',
  'high': '<circle cx="6" cy="6" r="4.8"/><path d="M3.9 6.8c1.1 1.3 3.1 1.3 4.2 0"/><path d="M4.3 4.3v.4M7.7 4.3v.4"/>',
  'mid': '<circle cx="6" cy="6" r="4.8"/><path d="M4.2 7.6h3.6"/><path d="M4.3 4.4v.4M7.7 4.4v.4"/>',
  'anx': '<path d="M.8 6c1-2 1.8-2 2.6 0s1.6 2 2.6 0 1.6-2 2.6 0 1.6 2 2.6 0"/>',
  'calm': '<path d="M.8 6h10.4"/>',
  'check': '<path d="M1.8 6.4 4.6 9.2 10.2 2.8"/>',
  'heart': '<path d="M6 10.2 1.6 5.8A2.6 2.6 0 0 1 6 2.6a2.6 2.6 0 0 1 4.4 3.2Z"/>',
  'wifi': '<path d="M1 4.6a7.2 7.2 0 0 1 10 0M2.8 6.6a4.6 4.6 0 0 1 6.4 0M4.6 8.6a2 2 0 0 1 2.8 0"/><circle cx="6" cy="10.2" r=".5"/>',
  'cal': '<rect x="1.2" y="2.2" width="9.6" height="8.6" rx="1"/><path d="M1.2 5h9.6M4 1v2.4M8 1v2.4"/>',
  'chart': '<path d="M1.4 10.6h9.2M3 9V6.4M6 9V3M9 9V5"/>',
  'gear': '<circle cx="6" cy="6" r="1.8"/><path d="M6 1v1.6M6 9.4V11M1 6h1.6M9.4 6H11M2.5 2.5l1.1 1.1M8.4 8.4l1.1 1.1M2.5 9.5l1.1-1.1M8.4 3.6l1.1-1.1"/>',
  'sunrise': '<path d="M1 9.6h10M3 9.6a3 3 0 0 1 6 0M6 1.6v3M4.4 3.2 6 1.6l1.6 1.6"/>',
  'sunset': '<path d="M1 9.6h10M3 9.6a3 3 0 0 1 6 0M6 1.6v3M4.4 3 6 4.6 7.6 3"/>',
  'leaf': '<path d="M2 10C2 5 5 2 10.4 1.6 10 7 7 10 2 10ZM2 10 7 5"/>',
  'star': '<path d="M6 1.2 7.4 4.4l3.4.3-2.6 2.2.8 3.3L6 8.4 3 10.2l.8-3.3L1.2 4.7l3.4-.3Z"/>',
  'person': '<circle cx="6" cy="3.4" r="2"/><path d="M2 11a4 4 0 0 1 8 0"/>',
  'back': '<path d="M7.4 2.4 3.8 6l3.6 3.6"/>',
  'next': '<path d="M1.4 6h8.4M6.8 3l3 3-3 3"/>',
  'bolt': '<path d="M6.8 1 2.6 6.8h3l-.6 4.2 4.4-6H6.4Z"/>',
}

def render_icon(svg_inner, px):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{px}" height="{px}" viewBox="0 0 12 12" fill="none" stroke="#000" stroke-width="{1.15 * 24 / px:.2f}" stroke-linecap="round" stroke-linejoin="round">{svg_inner}</svg>'
    # keep strokes ~2px at 24px and ~2.5px at 36px
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=px, output_height=px, background_color='white')
    im = Image.open(io.BytesIO(png)).convert('L')
    bw = (px + 7) // 8
    out = bytearray()
    for y in range(px):
        row = bytearray(bw)
        for x in range(px):
            if im.getpixel((x, y)) < 150:
                row[x >> 3] |= 0x80 >> (x & 7)
        out += row
    return out

def carr(name, data, ctype='uint8_t'):
    body = ',\n'.join('  ' + ','.join(f'0x{b:02x}' for b in data[i:i + 24]) for i in range(0, len(data), 24))
    return f'static const {ctype} {name}[] = {{\n{body or "  0"}\n}};\n'

lines = ['// GENERATED by tools/gen_assets.py — do not edit.', '#include "assets.h"', '']
hdr = ['// GENERATED by tools/gen_assets.py — do not edit.', '#pragma once', '#include <stdint.h>', '#include "../core/font.h"', '']
for name, path, size, wght, chars in FONTS:
    asc, desc, glyphs, blob = render_font(name, path, size, wght, chars)
    lines.append(carr(f'{name}_bits', blob))
    g = ',\n'.join(f'  {{0x{cp:04x},{off},{w},{h},{adv},{xo},{yo}}}' for cp, off, w, h, adv, xo, yo in glyphs)
    lines.append(f'static const Glyph {name}_glyphs[] = {{\n{g}\n}};')
    lines.append(f'const Font {name} = {{{name}_bits, {name}_glyphs, {len(glyphs)}, {asc}, {desc}, {asc + desc}}};\n')
    hdr.append(f'extern const Font {name};')
names = list(IC)
for px in (24, 36):
    for k in names:
        lines.append(carr(f'ICON{px}_{k}', render_icon(IC[k], px)))
hdr.append('enum IconId { ' + ', '.join(f'IC_{k.upper()}' for k in names) + ', IC_COUNT };')
hdr.append('extern const uint8_t* const ICONS24[];')
hdr.append('extern const uint8_t* const ICONS36[];')
for px in (24, 36):
    lines.append(f'const uint8_t* const ICONS{px}[] = {{ ' + ', '.join(f'ICON{px}_{k}' for k in names) + ' };')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w').write('\n'.join(lines) + '\n')
open(HDR, 'w').write('\n'.join(hdr) + '\n')
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB source')
