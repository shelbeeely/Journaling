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
- **Support, one long-press away.** Hold **Back** for about a second on any screen: text-first crisis
  numbers, then your safety plan and the "can you text with me" message.

Plus a **Wi-Fi page** (Menu → Wi-Fi sync): the X4 makes its own hotspot, shows a QR code to join, and
serves a page at 192.168.4.1 to set the clock from your phone, download your books (PDF/EPUB) and
check-in logs (download this month's when you close it), edit your safety plan, and upload new month packs. Nothing goes to the internet.

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

## Which build am I on?

Every pack, `support.txt` and `checkins.txt` carries the journal build date on its first line
(`... · built 2026-09-28`), and each printed book shows the same date on its title page ("Built 2026-09-28").
This month and the Wi-Fi page show `pack 2026-09-28`. The printed book is fixed; the pack may be newer
and that's fine for events, but if the dates differ and page numbers look off, re-export.

## Buttons

| Screen | Back | Confirm | Left / Right | Up / Down |
| --- | --- | --- | --- | --- |
| Today | Menu (or back to today) | Check in | previous / next day | Menu |
| Check in | Done | tick, log the time, or fill a habit dot | − / + for scales, counts and dots | move |
| Menu | close | open | | move |
| This month | back | | previous / next month | |

**This month** opens on the month just finished during the first 3 days of a new month (the Closing page is for that one); ▶ reaches the new month.
| Support | back | safety plan | pages | pages |
| Safety plan | menu | Support | pages (opens on page 1, "1 / 3" top right) | pages |

Power: press to sleep now. Idle for 90 s: sleeps by itself. **Hold Back 1.2 s anywhere: Support.**

## SD card

```
/kw/2026-10.txt … 2027-09.txt   day packs (made by tools/export_pack.py from the journal build)
/kw/checkins.txt                your own check-ins from the day page layout (optional)
/kw/support.txt                 Support screen (from the journal's support/trans/clinic content)
/kw/me.txt                      your safety plan (edit on the Wi-Fi page; missing = empty)
/kw/log/2026-10.csv …           check-ins, one line per tap: 2026-10-14T13:05,med_am,1
/kw/library/*.pdf, *.epub       your books (not the KDP covers), downloadable from the Wi-Fi page
/kw/clock.txt                   last known time (used after the battery runs flat)
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
habits and fields blocks). One `@` line per group heading, one line per item:

```
# Custom check-ins from the day page layout
@Little wins
c_checks_k3f_bed|Made the bed|toggle|0|1|0
@Pain
c_scale_p2a|Pain|scale|1|5|3
@Habits
c_habits_h7d_stretch|Stretch|dots|0|2|0
@Notes
c_fields_f4b_water|Glasses of water|count|0|99|0
```

Fields: `key|label|kind|lo|hi|default`. Kinds: `toggle` (tick), `scale` (lo..hi, up to 10 steps),
`count` (0..hi, hi up to 999), `dots` (empty, half, full; Confirm cycles). Keys are opaque (up
to 64 characters, no spaces or commas) and are what the log stores (`2026-10-14T08:40,c_checks_k3f_bed,1`). Bad lines,
duplicate keys and items past 16 are skipped; with no file the list is the built-ins only. Custom
items don't change **This month**. See `host/sample/kw/checkins.txt`.

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

The host build compiles the same app, drawing and data code as the device; only `hal_host.cpp`
differs (a folder for the SD card, PNG frames for the panel, scripted buttons).

## Known limits (read before relying on it)

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
