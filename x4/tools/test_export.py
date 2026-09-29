#!/usr/bin/env python3
"""Export test for the bridge v2 kinds (scale zero/signed, choice, count max, the 16-item cap).

Builds a throwaway journal folder with a layout that uses every new option, runs export_pack.py on it and checks
checkins.txt line by line. Run by host/preview.sh (CI) and by hand:  python3 x4/tools/test_export.py
"""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REAL = os.path.join(HERE, '..', '..', 'journal', 'content')
fails = []

def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

def export(blocks):
    """Returns (checkins.txt lines, printed warnings) for a layout made of `blocks`."""
    with tempfile.TemporaryDirectory() as tmp:
        content = os.path.join(tmp, 'j', 'content'); os.makedirs(content)
        for f in ('clinic.json', 'support.json', 'trans.json'): os.symlink(os.path.abspath(os.path.join(REAL, f)), os.path.join(content, f))
        json.dump({'v': 2, 'blocks': blocks}, open(os.path.join(content, 'daypage.json'), 'w'))
        sd = os.path.join(tmp, 'sd')
        env = dict(os.environ, KW_NO_LIBRARY='1')
        r = subprocess.run([sys.executable, os.path.join(HERE, 'export_pack.py'), os.path.join(tmp, 'j'), sd], capture_output=True, text=True, env=env)
        if r.returncode: print(r.stdout, r.stderr); fails.append('export_pack.py failed'); return [], ''
        lines = open(os.path.join(sd, 'kw-update', 'checkins.txt'), encoding='utf-8').read().splitlines()
        return lines[1:], r.stdout

def blk(type, uid, **o): return dict(type=type, uid=uid, on=True, **o)

# --- scale: plain, zero, signed (odd and even steps), 11 steps ---
L, _ = export([
    blk('scale', 'plain', title='Energy', steps=5),
    blk('scale', 'pain', title='Pain', steps=11, zero=True),
    blk('scale', 'mood', title='Mood', steps=7, signed=True),
    blk('scale', 'mood6', title='Mood6', steps=6, signed=True),
    blk('scale', 'both', title='Both', steps=5, zero=True, signed=True),
    blk('scale', 'zero4', title='Zero4', steps=4, zero=True),
    blk('scale', 'big', title='Big', steps=99, zero=True),  # clamped to 11
])
check('c_plain|Energy|scale|1|5|3' in L, 'plain scale is 1..steps, default in the middle (unchanged)')
check('c_pain|Pain|scale|0|10|5' in L, 'zero scale with 11 steps is 0..10')
check('c_mood|Mood|scale|-3|3|0' in L, 'signed scale with 7 steps is -3..3, default 0')
check('c_mood6|Mood6|scale|-2|2|0' in L, 'signed with an even step count rounds down to odd (5 bubbles, -2..2)')
check('c_both|Both|scale|-2|2|0' in L, 'signed wins over zero')
check('c_zero4|Zero4|scale|0|3|1' in L, 'zero scale with 4 steps is 0..3')
check('c_big|Big|scale|0|10|5' in L, 'steps clamp at 11')

# --- old layouts (no new options) export exactly as before ---
L, _ = export([blk('scale', 's', title='Energy', steps=5), blk('checks', 'k', title='Wins', labels=['Bed', 'Water']),
               blk('habits', 'h', title='Habits', labels=['Stretch']), blk('fields', 'f', title='Out', labels=['Minutes'])])
check(L == ['@Energy', 'c_s|Energy|scale|1|5|3', '@Wins', 'c_k_bed|Bed|toggle|0|1|0', 'c_k_water|Water|toggle|0|1|0',
            '@Habits', 'c_h_stretch|Stretch|dots|0|2|0', '@Out', 'c_f_minutes|Minutes|count|0|99|0'], 'a layout without the new options exports as before')
check(all(l.count('|') == 5 for l in L if '|' in l), 'old kinds keep six columns')

# --- choice from words (x4 on/off, limits, escaping) ---
L, out = export([blk('words', 'off', title='Feeling', words=['calm', 'tired'])])
check(L == [], 'words without x4 stay on paper only')
L, out = export([blk('words', 'kind', title='Kind of day', x4=True, words=['calm', 'tired', 'foggy'])])
check(L == ['@Kind of day', 'c_kind|Kind of day|choice|0|2|0|calm;tired;foggy'], 'words with x4 become one choice item, options joined by ;')
L, out = export([blk('words', 'w', title='Feeling', x4=True,
                     words=['calm', 'tired', 'anxious', 'content', 'flat', 'overwhelmed', 'hopeful', 'irritable', 'proud', 'lonely'])])
check(L[1].count(';') == 7 and L[1].endswith('irritable') and L[1].startswith('c_w|Feeling|choice|0|7|0|calm;'), 'more than 8 words: the first 8 go to the X4')
check('WARNING' in out and '"Feeling" has 10 words' in out, 'more than 8 words warns')
check('overwhelmed' in L[1] and 'is cut to' not in out, 'an 11-character word is kept whole')
L, out = export([blk('words', 'w', title='T', x4=True, words=['a;b', 'c|d', 'e,f', 'averyveryverylongword', 'a b'])])
opts = L[1].split('|')[6].split(';')
check(all(not any(c in o for c in ';|,') and len(o) <= 12 for o in opts), 'options have no separators and at most 12 characters')
check('is cut to' in out, 'a word over 12 characters warns that it is cut')
L, out = export([blk('words', 'w', title='T', x4=True, words=['same', 'same', 'other'])])
check(L[1] == 'c_w|T|choice|0|1|0|same;other' and 'twice' in out, 'duplicate words are kept once')
L, out = export([blk('words', 'w', title='T', x4=True, words=['only'])])
check(L == [] and 'fewer than 2' in out, 'a single word is not a choice: skipped with a warning')

# --- count max ---
L, _ = export([blk('fields', 'f', title='Focus', labels=['Rounds', 'Pages'], max=10)])
check('c_f_rounds|Rounds|count|0|10|0' in L and 'c_f_pages|Pages|count|0|10|0' in L, 'fields max becomes the count hi')
L, _ = export([blk('fields', 'f', title='Focus', labels=['Rounds'], max=999)])
check('c_f_rounds|Rounds|count|0|999|0' in L, 'fields max 999')
L, _ = export([blk('fields', 'f', title='Focus', labels=['Rounds'], max=7)])
check('c_f_rounds|Rounds|count|0|99|0' in L, 'a max that is not one of the choices falls back to 99')

# --- the 16-item cap, in layout order, names what was dropped ---
many = [blk('checks', 'c1', title='A', labels=[f'box{i}' for i in range(1, 9)]), blk('habits', 'c2', title='B', labels=[f'dot{i}' for i in range(1, 9)]),
        blk('scale', 'c3', title='Late scale'), blk('words', 'c4', title='Late words', x4=True, words=['a', 'b'])]
L, out = export(many)
check(sum(1 for l in L if '|' in l) == 16, 'at most 16 custom items')
check('WARNING 2 item(s) dropped (Late scale, Late words)' in out, 'the cap warning names what was dropped')
check(not any('Late' in l for l in L), 'items past the cap are not written')

# --- Tier 2 care blocks: injection sites (choice), therapy pack (opt-in x4), overload dots, paper-only blocks ---
L, out = export([blk('sites', 'inj', title='Injection site')])
check(L == ['@Injection site', 'c_inj|Injection site|choice|0|3|0|L thigh;R thigh;L belly;R belly'], 'injection sites default to four sites and export as a choice with the site words')
L, out = export([blk('sites', 'inj', title='Site', labels=['L thigh', 'R thigh', 'L glute', 'R glute', 'L arm', 'R arm'], time=True)])
check(L == ['@Site', 'c_inj|Site|choice|0|5|0|L thigh;R thigh;L glute;R glute;L arm;R arm'], 'six injection sites: choice 0..5, the time blank stays on paper')
L, out = export([blk('sites', 'inj', labels=['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'])])
check(L[1].count(';') == 7 and L[1].endswith('H'), 'more than 8 sites: the first 8 (the editor caps the list at 8 too)')
L, out = export([blk('sites', 'inj', labels=['only'])])
check(L == [] and 'fewer than 2' in out, 'a single site is not a choice: skipped with a warning')
L, out = export([dict(type='sites', uid='inj', on=False)])
check(L == [], 'a switched-off sites block is not exported')
L, _ = export([blk('feelings', 'fe'), blk('skills', 'sk'), blk('urge', 'ur'), blk('thought', 'th', cols=5), blk('bodysig', 'bs'), blk('lines', 'sp', title='Into today')])
check(L == [], 'therapy blocks stay off the X4 until "Also on X4" is on; thought record, body signals and special interest are paper only')
L, _ = export([blk('feelings', 'fe', title='Feelings', x4=True)])
check(L == ['@Feelings', 'c_fe_sad|Sad|scale|0|5|0', 'c_fe_shame|Shame|scale|0|5|0', 'c_fe_anger|Anger|scale|0|5|0', 'c_fe_fear|Fear|scale|0|5|0', 'c_fe_joy|Joy|scale|0|5|0'],
      'feelings with x4: one 0..5 scale per feeling (six bubbles, 0..5)')
L, _ = export([blk('feelings', 'fe', title='F', x4=True, labels=['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])])
check(sum(1 for l in L if '|' in l) == 6, 'feelings take at most 6 labels')
L, _ = export([blk('skills', 'sk', title='Skills', x4=True)])
check(L == ['@Skills', 'c_sk|Skills|scale|0|7|0'], 'skills with x4: one 0..7 scale (eight bubbles)')
L, _ = export([blk('urge', 'ur', title='Urges', x4=True, labels=['Urge A', 'Urge B'])])
check(L == ['@Urges', 'c_ur_urge_a|Urge A|scale|0|5|0', 'c_ur_urge_a_acted|Urge A acted|toggle|0|1|0', 'c_ur_urge_b|Urge B|scale|0|5|0', 'c_ur_urge_b_acted|Urge B acted|toggle|0|1|0'],
      'urge with x4: a 0..5 scale and an "acted" tick per urge')
check(all(l.count('|') == 5 for l in L if '|' in l), 'urge lines have six columns')
L, _ = export([blk('habits', 'ov', title='Overload', labels=['Overload'])])
check(L == ['@Overload', 'c_ov_overload|Overload|dots|0|2|0'], 'overload dots export as dots (empty, half, full)')
# the cap counts the new items
L, out = export([blk('feelings', 'fe', x4=True), blk('urge', 'ur', x4=True, labels=['Urge A', 'Urge B']), blk('skills', 'sk', x4=True), blk('checks', 'ck', title='Care', labels=[f'c{i}' for i in range(1, 9)]),
                 blk('sites', 'inj')])
n = sum(1 for l in L if '|' in l)
check(n == 16 and 'WARNING 3 item(s) dropped (c7, c8, Site)' in out and not any('inj' in l for l in L), 'the 16-item cap counts the new blocks in layout order (5 + 4 + 1 feelings, urges, skills, then 6 of 8 checks); the rest, and the sites choice, are named and dropped')

# --- every line a firmware line: key rules ---
L, _ = export([blk('scale', 'a', title='T'), blk('words', 'a', title='U', x4=True, words=['x', 'y'])])
keys = [l.split('|')[0] for l in L if '|' in l]
check(len(keys) == len(set(keys)), 'keys are unique even when two blocks share a uid')

# --- Tier 2: Energy types (one scale per kind) and Focus rounds (one count, key focus_rounds) ---
L, out = export([blk('energy', 'en', title='Energy', labels=['Body', 'Mind', 'People', 'Senses'], steps=3)])
check(L == ['@Energy', 'c_en_body|Body|scale|1|3|2', 'c_en_mind|Mind|scale|1|3|2', 'c_en_people|People|scale|1|3|2', 'c_en_senses|Senses|scale|1|3|2'], 'energy types: one 1..steps scale per kind')
L, _ = export([blk('energy', 'en', labels=['Body'], steps=5)])
check('c_en_body|Body|scale|1|5|3' in L, 'energy types: steps 5 gives 1..5, default in the middle')
L, _ = export([blk('energy', 'en', labels=[], steps=3)])
check(L == [], 'energy types with no kinds exports nothing')
L, out = export([blk('rounds', 'fr', title='Focus rounds', n=3, boxes=4)])
check(L == ['@Focus rounds', 'focus_rounds|Focus rounds|count|0|16|0'], 'focus rounds: one count with the exact key focus_rounds')
L, out = export([blk('rounds', 'a', title='One'), blk('rounds', 'b', title='Two')])
check(sum(1 for l in L if l.startswith('focus_rounds|')) == 1 and 'second Focus rounds block is paper only' in out, 'a second Focus rounds block stays on paper')
L, _ = export([dict(type='rounds', uid='off', on=False)])
check(L == [], 'a Focus rounds block that is switched off exports nothing')
L, _ = export([blk('dump', 'd'), blk('later', 'l'), blk('done', 'n'), blk('wall', 'w'), blk('stamps', 's'), blk('accounts', 'a'), blk('weekstrip', 'k'),
               blk('keep', 'kp'), blk('lookback', 'lb'), blk('prompt', 'p'), blk('pixel', 'px'), blk('range', 'rg'), blk('tl24', 't')])
check(L == [], 'the paper-only Tier 2 blocks export nothing')

print('FAILED: ' + '; '.join(fails) if fails else 'export test: ok')
sys.exit(1 if fails else 0)
