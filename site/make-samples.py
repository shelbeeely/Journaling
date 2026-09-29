#!/usr/bin/env python3
"""Renders the site's sample pages (site/img/) from the GENERIC sample book: content/profile.example.json + journal/test.ics.
Nothing personal is ever used. Run from anywhere:  python3 site/make-samples.py"""
import os, subprocess
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = os.path.join(root, 'journal')
env = {**os.environ, 'KW_PROFILE': 'content/profile.example.json', 'KW_OUT': 'out-demo', 'SIZE': 'small'}
subprocess.run(['node', 'render.mjs', 'month', '2026-10', 'test.ics'], cwd=J, env=env, check=True)
subprocess.run(['node', 'cover.mjs', 'month', '2026-10'], cwd=J, env=env, check=True)
d = os.path.join(J, 'out-demo/m2026-10')
img = os.path.join(root, 'site/img')
os.makedirs(img, exist_ok=True)
pdf = os.path.join(d, 'northlight-2026-10-interior-5.5x8.5.pdf')
for name, page in [('title', 1), ('month', 10), ('tracker', 12), ('week', 14), ('day', 16)]:
    subprocess.run(['pdftoppm', '-r', '100', '-png', '-f', str(page), '-l', str(page), '-singlefile', pdf, os.path.join(img, 'sample-' + name)], check=True)
subprocess.run(['pdftoppm', '-r', '70', '-png', '-singlefile', os.path.join(d, 'northlight-2026-10-cover.pdf'), os.path.join(img, 'sample-cover')], check=True)
