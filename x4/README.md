# Keeping Watch for the Xteink X4

Companion firmware for the Keeping Watch paper journals. The paper book stays the record; the X4 does
the three things paper can't:

- **Today on the sleep screen.** E-ink holds an image with no power, so the X4 sleeps showing today's
  page (moon, sunrise/sunset, Spokane season, events, routines, today's care, "on this day"). It wakes
  itself at 4:31 a.m. to draw the new day (see "The day starts when you wake"), then goes straight back to sleep.
  A quiet "book p. 26" under the date says which page of the paper book is today's.
- **Button check-ins.** The X4's half of the care split: **spoons left**, sleep hours, anxiety 0–3, and the care ticks
  (shower, teeth, did something I enjoy, texted someone, snack), in that order. One press per item, saved to the SD card.
  Meds, meals, water and mood are on paper, so they are not here (Today says "on paper"). Routines, events and notes are
  shown on Today as text only; paper is where they are ticked and written.
  **This month** adds up what the X4 records; the Closing page and the Keeper say which of their six boxes come from it.
- **Focus rounds** (Menu, Focus). Silent work rounds and breaks: no sound, no alarms, no per-minute refresh. See "Focus" below.
- **Support, one long-press away.** Hold **Back** for about a second on any screen: text-first crisis
  numbers, then your safety plan and the "can you text with me" message.

Plus a **Wi-Fi page** (Menu → Wi-Fi, see "Wi-Fi" below): the X4 makes its own hotspot (or joins your own Wi-Fi), shows a QR code to join, and
serves a page at 192.168.4.1 (labelled fields, 44 px buttons, spoken result messages, no external files) to set the clock from your phone, download your books (PDF/EPUB) and
check-in logs (download this month's when you close it), edit your safety plan, and upload new month packs. The hotspot and the page never touch the internet. The only thing that ever leaves the X4 is a **sync you start** (Wi-Fi, Sync with Studio, below), and only on the sync build.

## The day starts when you wake

The paper day is the one you're still living, so the X4 rolls over at **4 a.m., not midnight**. Between
00:00 and 04:00 Today and Check in stay on the day you just lived: a 00:40 "Evening meds" on Nov 1 is filed
under **Oct 31** (in October's log), and the sleep screen only flips to the new day at 4:31 a.m. While it's
"last night" the corner says "last night · ▶ Nov 1" (Today) or "Oct 31 · last night" (Check in). Press
**▶ day** on Today to switch to the new calendar day, **◀ day** to come back. This holds for shift work too:
if you wake at 6 p.m., the day's check-ins simply start when the paper page does.

## The care split (what lives where)

| On paper | On the X4 |
| --- | --- |
| Meds (AM, PM, as-needed), meals, water, mood −3…+3 | Spoons left, sleep hours, anxiety 0–3 |
| Work shift times, routines, events, writing | Shower, teeth, joy, texted, snack (the care ticks) |
| Safety plan: the source of truth | A copy of the plan: if it differs, trust the book |

Your own check-ins (editor blocks) are on both. The Check in list is spoons, sleep, anxiety, then the care ticks, the
order the paper page reads.

**Old logs.** The log keys never change, so nothing is migrated and nothing is lost. `med_am`, `med_pm`, `prn`,
`meal1`-`meal3` and `mood` are still known keys: they are hidden on Check in and Today, but still read, so a log written before
the split loads without "older custom entries" warnings, and This month shows one quiet line ("Earlier X4 entries: mood
+0.2 avg, meds 4 days") when a month holds them. The care-ticks-by-day dots now count only the five care ticks, so an
old month's dots read lower than they did. `host/test_legacy.sh` (run by `preview.sh`) feeds a pre-split log to the real
month-stats code and checks the numbers.

**This month.** Two bold tiles are Keeper boxes and use the exact labels the Closing page and the Keeper print:
**Good-spoon days** (4+ spoons left) and **Avg sleep**. Below them: average spoons left, average anxiety and the days each
care tick was ticked. The other four boxes (Avg mood, Meds taken, Avg meals, Work hours) come from the paper tracker.

## Focus (Menu, Focus)

Pairs with the paper "Focus rounds" block. Defaults are **25 min work / 5 min break, 4 rounds, then a 15 min long break**. Presets
**25/5**, **15/5** and **45/10**; Left/Right on Work (steps of 5, 5-90) and Break (1-30) make it custom. Start draws
"Focus until 2:35p · round 2 of 4" **once**, then the X4 deep-sleeps with a timer wake. At the end it wakes, draws "Break until 2:40p",
sleeps again, and after the long break shows Done. Nothing makes a sound, there is no countdown, no notification. Press power any time to
see where you are: **Interrupted** (Confirm, during work) marks an interruption without touching the timer, **End** (Back) stops the session.

- **Log keys (stable, documented for the paper block and the Keeper):** in the month CSV, `focus_rounds` = work rounds finished that day, `focus_interruptions` = interruption presses. Each line holds the day's running total, last value wins, like every log line (`2026-10-14T13:35,focus_rounds,2`).
  They are separate from any custom check-in you define, and never appear as "older custom entries".
- A round is filed under the day it **started** (4 a.m. rule): a round begun at 3:50 a.m. that ends at 4:15 counts for the day before, even if the wake lands after 4:31. Interruptions are filed under the day of the press.
- **This month** shows one quiet line, "Focus 10 · 3 interrupted": a count, no streaks, no goals, no badges.
- The run is kept in `/kw/focus.txt` (`plan=25,5,15,4` / `run=W,2,<end epoch>,<interruptions>`) because RAM does not survive deep sleep. On every wake the run is walked forward
  from the clock, so a late wake still credits the rounds that finished. If the X4 was off so long that a phase ended more than 2 hours ago (flat battery), nothing is credited and the run is dropped. Done clears itself after 30 minutes.
- While a run is going the X4 wakes only for its phases; the 4:31 a.m. Today redraw resumes when the session ends. Focus needs the clock set (it goes to Clock if not). `host/test_focus.sh` checks the arithmetic, including a wake that lands after the day rolls.

## Wi-Fi (Menu, Wi-Fi)

The Wi-Fi screen has two modes, and the radio is **off until you pick one** (it says "radio off" at the top). Leaving the screen, pressing Power or waiting until it sleeps turns the radio and the web server off and frees their memory. Nothing runs in the background. Hotspot, On my Wi-Fi and Join send nothing to the internet. The one thing that can is **Sync with Studio** (its own section below): it runs only when you press Send, and only on the sync build.

| Row | What it does |
| --- | --- |
| **Hotspot** | Today's way: the X4 makes its own network (a new name and password each time, shown with a QR code). The page is at `192.168.4.1`. No internet needed. |
| **On my Wi-Fi** | The X4 joins a network you saved and serves the same page there. With one saved network it joins at once; with several it opens the list. |
| **Join a network** | Adds a network. The X4 makes its hotspot, you open the page on your phone, pick your network under **Wi-Fi** and type its password **on the phone** (typing on the X4's buttons is painful). The X4 tries it: if it works the network is saved and the X4 moves onto it, if not the reason is shown on both screens and **nothing is saved**. |
| **Sync with Studio** | Sends your check-in log to your own Studio account, only when you press Send. See "Sync with your Studio" below. |
| **Saved networks** | Up to 8. Confirm connects, Forget (Right) asks first and then deletes the network and its password from the card. |

**On your Wi-Fi the screen shows** the address (for example `192.168.1.42`), the name (`keeping-watch.local`, which you choose on the page: letters, digits and hyphens, up to 24; some Android phones do not resolve `.local`, so the address is always shown too), a QR code that opens the page in one scan, and a **PIN**.

- **The PIN** is six digits, shown only on the X4, and **new each time the Wi-Fi screen opens**. Looking at the page needs no PIN. Anything that **changes** something (set the clock, save the plan, upload files, join, forget, rename) and anything **private** (your check-in log, your safety plan, the file list) needs it: type it once on the page and that browser is let in. Five wrong tries lock the page until you leave the screen and open it again.
- **One device at a time.** The hotspot takes one phone. On your Wi-Fi the first device that types the PIN holds the place until it has been quiet for two minutes; another device sees "Another device is using this X4" and cannot take over, even with the right PIN.
- **The hotspot needs no PIN** (its own password and its one-client limit are the gate), so nothing changes for how you use it today.
- Changing networks over the LAN is not allowed from the page: adding a network is a hotspot job, and you switch networks from the X4's own screen.
- If the network vanishes while you are using it the screen says so ("The X4 lost the network") and waits for you. It does not keep retrying in the background.

**Sleep.** The X4 sleeps by itself when nothing has happened for your **Sleep after** setting, but never in less than **15 minutes on the Wi-Fi screen**, like Support, My safety plan and the Clock: typing a password on a phone is slow. A request from the page counts as activity, just like a button press. Power sleeps at once and turns the radio off first.

**Passwords and privacy.**
- Wi-Fi passwords live in **`/kw/net.txt` on the SD card, in plain text**, and the file's first lines say so. **This file contains passwords: do not share the card or the file.** It is never uploaded, never logged (no screen, serial line or answer ever carries one), never sent anywhere, and the page cannot download or replace it. Delete the file, or Forget a network on the screen, to remove them. It also holds the name you chose (`name=`). Format: `name=<name>`, `last=<n>`, and one `net=<ssid><TAB><password>` line per network.
- The radio driver is told not to keep anything of its own (`WiFi.persistent(false)`), so the card file is the only copy.
- The PIN is never in an answer and never written anywhere; the page keeps its access in a cookie that only that device sends (SameSite=Strict, HttpOnly) and that dies when you leave the screen.
- Only the joined network's own access point is contacted (its address, gateway and name service): the Wi-Fi modes have **no call that connects to any other host** (the one exception is Sync with Studio, below), no time-from-internet, no timers and no wake source but the 4:31 a.m. and Focus clock. `host/test_off.sh` proves it: it audits the source, runs every way out of every mode on a simulated network and checks the radio is off, and checks the radio log holds only the allowed calls.
- On your Wi-Fi the page is plain `http` on your own network. Anyone else on that network can see the traffic and the PIN as you type it, and could try the PIN (five tries, then locked). Use it on a network you trust, and prefer the hotspot when you are away from home.

**Memory.** The screen owns the radio and its RAM while it runs. Everything big is static (the answer buffer is one 3 KB array), nothing large is on the 16 KB loop stack, and the web server is created when a mode starts and deleted when it stops. `pio run -e x4-tls` links the SDK's SecureNet (wolfSSL TLS 1.3) so CI can size it for sync; CI prints RAM, flash and the wolfSSL heap peak from a real handshake run on a PC, and fails if less than 32 KB would be left with a TLS session open (`tls/budget.py`). At N1: static RAM +7 KB, flash +69 KB for everything in this section; with TLS linked, another +0.7 KB RAM and +165 KB flash; wolfSSL's own heap peak is 19 to 28 KB. The device prints `[mem]` lines on its USB serial at each stage and `GET /api/info` carries the same three numbers, so the real figure can be read on hardware.

## Sync with your Studio (Wi-Fi, Sync with Studio; BUILD-PLAN section 19, slice N2)

Sends your **check-in log** (`/kw/log/YYYY-MM.csv`, which also holds the Focus counts) to **your own** Journalwright Studio account, so there is a private backup and
the Keeper numbers can be read elsewhere. It is **only** that: never the safety plan, the Wi-Fi file, the packs, the books or the token. Down-sync, the on-device
editor and pairing by short code are later slices (N3); this one is upload only.

**It needs the sync build.** The default image (`pio run -e x4`) has no TLS: the row is there, says so, and sends nothing. `pio run -e x4-tls` is the same firmware
with the SDK's TLS client (wolfSSL, TLS 1.3 with a 1.2 fallback) linked in; that is the image to flash for sync (about +180 KB flash and +1 KB static RAM over the default; the
session's wolfSSL heap peak is 19 to 28 KB; CI keeps at least 32 KB spare).

**Setup, once.**
1. In the Studio (signed in), add a device: `POST /api/devices {name, server}` (see studio/README.md). The answer carries the token **once**, and the text of `sync.txt`.
2. Put `sync.txt` and `studio-ca.pem` (the root certificate of the Studio's server: for a Let's Encrypt site that is ISRG Root X1; for your own CA, that CA) in the card's `kw-update` folder.
   On the next boot the X4 moves them to `/kw`. Use a **DNS name** for the server (`studio.example.com` or `studio.example.com:8443`), not an address: the name is checked.
3. Set the clock (Menu, Clock): the certificate has dates. Join your Wi-Fi once (Wi-Fi, Join a network).

**Using it.** Wi-Fi, Sync with Studio opens a **preview** and sends nothing: the server, the network it would use (Left changes it when you saved several), whether the check-in
log is **ON or OFF** (Right switches it; **off until you switch it on**, because it is health data), and how much is waiting (only bytes added since the last sync). **Send** joins
that network, talks to the Studio, uploads, and leaves the radio off. Back stops it (what already went is kept). It never runs by itself, never on a timer, and never wakes the radio on its own.

**Safety.** Trust is the one certificate you put on the card (nothing is ever sent with verification off). The SDK's own TLS client checks the certificate chain but not the host name,
so `net/hostcheck.cpp` adds it: the `x4-tls` build links with `--wrap=wolfSSL_UseSNI` and every session arms `wolfSSL_check_domain_name` for the host in `sync.txt`. A session where that
cannot be armed is made to fail, and before the token is sent the X4 first asks the Studio's public `/api/health` and refuses unless the check was in force. The token is sent only
to the Studio's `/api/device/*` routes and can be revoked in the Studio at any moment; a lost card means revoke. Uploads go in 3 KB pieces at an exact byte offset, so a dropped connection
or a repeated piece cannot duplicate or reorder lines, and the next sync carries on where the Studio says it is.

**When it fails the screen says why and that nothing was sent:** no `sync.txt` or certificate, clock not set, log switched off, no saved network, the network refused or out of range,
the Studio unreachable, certificate refused (not signed by your `studio-ca.pem`, wrong host name, or expired), not a Studio, token revoked or wrong, asked to slow down, Studio error or full.

Tests: `host/test_sync.sh` (the device's sync code on a simulated Studio with the server's offset rules: chunks, resume, stop, every failure and message, the log-only rule),
`host/test_off.sh` (the only way to reach a host is the marked block in `hal_x4.cpp`, reached only from Send), `tls/hostcheck_test.sh` (real handshakes on a PC: right name passes, other name fails).
**Not tested** without hardware and a live Studio: a real TLS session on the chip, heap and time during a real sync, the real Wi-Fi join, Back during a real transfer.

## Which build am I on?

Every pack, `support.txt` and `checkins.txt` carries the journal build date on its first line
(`... · built 2026-09-28`), and each printed book shows the same date on its title page ("Built 2026-09-28").
This month and the Wi-Fi page show `pack 2026-09-28`. The printed book is fixed; the pack may be newer
and that's fine for events, but if the dates differ and page numbers look off, re-export.

## Settings (Menu, Settings)

Saved on the card in `/kw/settings.txt` (plain `key=value` lines, safe to delete: everything falls back to the defaults) and read before the first
screen is drawn, the sleep screen included. Left/Right or Confirm change the highlighted value; Up/Down move.

| Setting | Choices | What it does |
| --- | --- | --- |
| **Text size** | Normal, Large | Large is about 1.3x on every screen (Inter, 23/28 px captions and rows, 42 px titles, 52 px numbers). Nothing is squeezed: Check in rows are taller (long custom labels take two lines, long scales show their number), **Today** becomes pages (the glance, then the rest of the calendar if there is more than 3 lines, then the season, moon and "on this day"), **This month** is two pages (boxes, then the calendar), Support and My safety plan just page more, and no line is cut with "..." any more. Hint-bar labels break onto two lines. |
| **Contrast** | Normal, Bold | Text and icons are struck twice, and every hairline, frame, ring and dotted rule is at least 2 px thick. 1-bit, so there was never light grey; this removes the thin strokes. Works together with Large. |
| **Buttons** | Standard, Left-handed, Confirm and Back swapped, both | Left-handed swaps Left with Right and Up with Down; the other swaps Confirm and Back. The hint bar labels move to the button that now does each thing. Power and the long presses are never remapped. Every option leaves Back and Confirm reachable, so the Settings screen can always be used to undo it. |
| **Sleep after** | 90 seconds, 5 minutes, 15 minutes | Idle time before it sleeps on Today. Support, My safety plan, the Wi-Fi screen and the Clock always wait at least 15 minutes: nothing is thrown away for reading or typing slowly. Check-ins are saved on each press, so an idle sleep never loses one. |
| **Clean the screen** | Every 4, 8, 16 moves | Every Nth move within a screen is a cleaning (half) refresh instead of a fast partial one. 4 = less ghosting, 16 = fewer flashes. |
| **Hold Back for Support** | 1.2 s, 2.5 s, off | Off means no long press at all: reach Support from Menu. |

The `/kw/settings.txt` keys are `text=normal|large`, `contrast=normal|bold`, `buttons=standard|left|swap|both`, `sleep=90|300|900`, `clean=4|8|16`, `hold=1200|2500|0`.
`host/test_settings.sh` (run by `preview.sh`) checks the file round trip, bad values and the remap tables.

## Buttons

| Screen | Back | Confirm | Left / Right | Up / Down |
| --- | --- | --- | --- | --- |
| Today | Menu (or back to today) | Check in | previous / next day | Menu |
| Check in | Done | tick, log the time, or fill a habit dot | − / + for scales, counts and dots | move |
| Menu | close | open | | move |
| This month | back | | previous / next month | |
| Focus setup | back | next row / Start | less / more | move |
| Focus running | end | Interrupted (work only) | | |
| Wi-Fi (rows) | back | open | | move (Up/Down) |
| Wi-Fi saved networks | back | connect | Right: forget | move (Up/Down) |
| Wi-Fi running | stop (radio off) | | previous / next page (Large text) | |

**This month** opens on the month just finished during the first 3 days of a new month (the Closing page is for that one); ▶ reaches the new month.
| Support | back | safety plan | pages | pages |
| Safety plan | menu | Support | pages (opens on page 1, "1 / 3" top right) | pages |

Power: press to sleep now. Idle for 90 s (Settings: 5 or 15 min): sleeps by itself. **Hold Back 1.2 s anywhere: Support** (Settings: 2.5 s, or off and use Menu, Support).
With **large text** on, Up/Down page through Today and This month (Left/Right still change day and month).

## SD card

```
/kw/2026-10.txt … 2027-09.txt   day packs (made by tools/export_pack.py from the journal build)
/kw/checkins.txt                your own check-ins from the day page layout (optional)
/kw/support.txt                 Support screen (from the journal's support/trans/clinic content)
/kw/me.txt                      your safety plan (edit on the Wi-Fi page; missing = empty)
/kw/log/2026-10.csv …           check-ins, one line per tap: 2026-10-14T13:05,med_am,1
/kw/library/*.pdf, *.epub       your books (not the KDP covers), downloadable from the Wi-Fi page
/kw/focus.txt                   the Focus run in progress and its settings (safe to delete)
/kw/clock.txt                   last known time (used after the battery runs flat)
/kw/net.txt                     saved Wi-Fi networks. CONTAINS WI-FI PASSWORDS IN PLAIN TEXT: never uploaded or logged; do not share the card
/kw/net.tmp                     only exists for an instant while net.txt is saved (safe to delete)
/kw/sync.txt                    Studio sync: server, device TOKEN (a secret, plain text, never uploaded, shown or served), and log=0|1. Do not share the card
/kw/studio-ca.pem               the root certificate of your Studio server: the only certificate the X4 will trust for sync
/kw/sync-state.txt              what the last sync sent, per month (safe to delete: the Studio's own size decides what is resent)
/kw-update/                     the update inbox (below); empty and deleted after each boot
```

**Your safety plan and check-in log exist only on the card.** Back the log up (Wi-Fi page, Check-in log)
each time you close a month.

### Updating the card

`export_pack.py` never writes `/kw`. It writes a `kw-update` folder:

1. Copy the whole **`kw-update`** folder to the card's root. Replacing it is fine.
2. Put the card back and turn the X4 on. It moves `YYYY-MM.txt`, `support.txt`, `checkins.txt` and
   `library/*.pdf|epub` into `/kw`, replacing old copies, then deletes `/kw-update`. A file that fails to move stays for the next boot.
3. `/kw/log/` is never listed. `/kw/me.txt` is never replaced (a `me.txt` in the update is used only when the card has none).
   Anything else in the folder (`me.example.txt`, `.DS_Store`) is thrown away.

Don't copy or replace a `kw` folder by hand: a folder "Replace" (Finder's default) deletes what isn't in the new folder, log included.
The Wi-Fi page also refuses to take `me.txt` as an upload; only its safety-plan box writes the plan, and no upload can reach `log/`.
`host/test_update.sh` (run by `preview.sh`) checks all of this.

### Custom check-ins (`/kw/checkins.txt`)

The Check in list is the 15 built-ins, then up to 16 items of your own, loaded at startup and when
you leave the Wi-Fi page (you can upload a new `checkins.txt` there). `export_pack.py` writes the file from the day page layout (checks, scale,
habits, fields and, when "Pick one on X4" is on, words blocks). One `@` line per group heading, one line per item:

```
# Custom check-ins from the day page layout
@Little wins
c_checks_k3f_bed|Made the bed|toggle|0|1|0
@Pain
c_scale_p2a|Pain today|scale|0|10|5
@Mood
c_scale_m1|Mood|scale|-3|3|0
@Kind of day
c_words_w7|Kind of day|choice|0|3|0|foggy;clear;stormy;still
@Habits
c_habits_h7d_stretch|Stretch|dots|0|2|0
@Notes
c_fields_f4b_rounds|Focus rounds|count|0|8|0
```

Fields: `key|label|kind|lo|hi|default|options`. The last column is only used by `choice`. Kinds:

| Kind | Paper block | Stored | On the X4 |
| --- | --- | --- | --- |
| `toggle` | Checkboxes | 0 or 1 | tick |
| `scale` | Scale | the number on the paper: `1..steps` (plain), `0..steps-1` ("Number from 0"), `-k..+k` ("Signed", 7 steps = -3..+3, default 0). Up to 11 steps, so a 0-10 pain scale is `0|10` | Left/Right; the number is shown ("+2", "-1", "0") |
| `choice` | Words to circle, with "Pick one on X4" | the option's **text**, e.g. `stormy` | Left/Right cycle the words (wrapping); Confirm sets the default, then goes to the next word |
| `count` | Fill-in blanks | 0..`hi` (`hi` is the block's "Highest count on X4": 5 to 999, default 99) | Left/Right; a cap under 99 shows "3 / 10" |
| `dots` | Habit dots | 0 empty, 1 half, 2 full | Confirm cycles |

`choice` takes 2 to 8 options, separated by `;`, at most 12 characters each. The exporter turns `; | ,` inside a word into a space
and keeps the first 8 words and the first 12 characters of each (it warns when it cuts anything). A choice with fewer than 2, more than 8 or repeated options is skipped
on the device. Keys are opaque (up to 64 characters, no spaces or commas) and are what the log stores.
The log line for a choice holds the word, not its position (`2026-10-14T08:40,c_words_w7,stormy`), so reordering the words on the
paper block doesn't scramble your history. If you rename or remove a word, its old entries stay in the CSV and Today counts them under "older custom entries kept".
The loader ignores columns after the seventh and kinds it doesn't know, so a newer `checkins.txt` still loads on older firmware (those items just don't appear). Bad lines,
duplicate keys and items past 16 are skipped (`export_pack.py` says which items it dropped); with no file the list is the built-ins only. Custom
items don't change **This month**. See `host/sample/kw/checkins.txt`; `tools/test_export.py` (run by `host/preview.sh`) checks the export of every kind.

Change custom check-ins at the start of a month. If you change them mid-month, that month's earlier lines
keep their old keys: they stay in the CSV, Today shows "N older custom entries kept in the log", and
`export_pack.py` warns when the log on the card holds keys no longer in the layout. Nothing is deleted.

Make the card contents from the journal project:

    python3 tools/export_pack.py ../journal /path/to/out    # writes /path/to/out/kw-update

## Build and flash

    git clone https://github.com/Free-Ink/freeink-sdk ../freeink-sdk
    pio run -e x4              # build
    pio run -e x4 -t upload    # flash over USB-C
    pio device monitor         # logs

`keeping-watch-x4-merged.bin` is a ready image for a browser flasher (esptool-js, offset 0x0).
**Flashing it replaces whatever is on the X4, CrossPoint included.** The partition table matches
CrossPoint's two app slots, so a later version can live beside CrossPoint instead.

## Previews without a device

    cd host && ./preview.sh     # renders every screen to host/out/*.png from host/sample

The sample card (its log has a few generic `focus_rounds` / `focus_interruptions` lines for This month; `host/sample/kw/2026-10.txt`, `2026-11.txt`, `support.txt`) is generic: it comes from the `test.ics` books via
`export_pack.py` (rebuild the Keeper and both months first so the `keeper=` and `page=` lines are filled). `checkins.txt` and `me.txt` are hand-kept.

The host build compiles the same app, drawing and data code as the device; only `hal_host.cpp`
differs (a folder for the SD card, PNG frames for the panel, scripted buttons).

## Known limits (read before relying on it)

- **Large text** uses Inter for reading text too (the normal set uses Lora, which is only cut at one size). The arrow in `->` style text (U+2192, U+2190) is drawn by the canvas, not a font glyph, so it never shows a missing-glyph box. Bold is drawn by striking each glyph twice; look at it on the panel before trusting the weight.

- **Not yet run on an X4.** It compiles for the ESP32-C3 against FreeInk, and every screen renders in
  the host preview, but buttons, refresh modes, sleep current and the web page need a hardware pass.
- **Battery:** to keep the clock and midnight redraw, it deep-sleeps with the battery latch held on
  instead of CrossPoint's full power-off. Expect weeks per charge, not months.
- **Clock drift:** the C3's sleep timer runs on an internal oscillator and can drift minutes per day.
  The redraw is scheduled for 4:31 a.m. to absorb that; set the clock from the Wi-Fi page now and then.
- **After a flat battery** the time falls back to the last saved time. Check in won't open until the
  clock is set: it goes to the Clock screen with a plain message (also when the date is earlier than
  your books' build date), so nothing is filed under a wrong day.
- **Unlogged is "-".** Today shows a dash for spoons, sleep and anxiety you haven't logged, never a default;
  This month averages and counts only days you logged.
- Today lists up to 6 calendar lines and says "+N more on paper" for the rest.
