# Keeping Watch for the Xteink X4

Companion firmware for the Keeping Watch paper journals. The paper book stays the record; the X4 does
the three things paper can't:

- **Today on the sleep screen.** E-ink holds an image with no power, so the X4 sleeps showing today's
  page (moon, sunrise/sunset, Spokane season, events, routines, today's care, "on this day"). It wakes
  itself at 12:31 a.m. to draw the new day, then goes straight back to sleep.
- **Button check-ins.** Meds (AM/PM, as-needed with the time), meals, snack, shower, teeth, did something I enjoy,
  texted someone, mood, anxiety, spoons, sleep. One press per box, saved to the SD card.
  **This month** adds them up into the numbers your Keeper's "Closing" page asks for.
- **Support, one long-press away.** Hold **Back** for about a second on any screen: text-first crisis
  numbers, then your safety plan and the "can you text with me" message.

Plus a **Wi-Fi page** (Menu → Wi-Fi sync): the X4 makes its own hotspot, shows a QR code to join, and
serves a page at 192.168.4.1 to set the clock from your phone, download your books (PDF/EPUB) and
check-in logs (download this month's when you close it), edit your safety plan, and upload new month packs. Nothing goes to the internet.

## Buttons

| Screen | Back | Confirm | Left / Right | Up / Down |
| --- | --- | --- | --- | --- |
| Today | Menu (or back to today) | Check in | previous / next day | Menu |
| Check in | Done | tick, log the time, or fill a habit dot | − / + for scales, counts and dots | move |
| Menu | close | open | | move |
| This month | back | | previous / next month | |
| Support | back | safety plan | pages | pages |

Power: press to sleep now. Idle for 90 s: sleeps by itself. **Hold Back 1.2 s anywhere: Support.**

## SD card

```
/kw/2026-10.txt … 2027-09.txt   day packs (made by tools/export_pack.py from the journal build)
/kw/checkins.txt                your own check-ins from the day page layout (optional)
/kw/support.txt                 Support screen (from the journal's support/trans/clinic content)
/kw/me.txt                      your safety plan (edit on the Wi-Fi page; missing = empty)
/kw/log/2026-10.csv …           check-ins, one line per tap: 2026-10-14T13:05,med_am,1
/kw/library/*.pdf, *.epub       your journals, downloadable from the Wi-Fi page
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
  The redraw is scheduled for 12:31 a.m. to absorb that; set the clock from the Wi-Fi page now and then.
- **After a flat battery** the time falls back to the last saved time and the Today screen says
  "Clock not set" until you set it.
