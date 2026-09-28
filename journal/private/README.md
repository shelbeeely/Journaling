Put your calendar exports here (`main.ics`, `birthdays.ics`, …). Everything in this folder except this file is
ignored by git. In GitHub Actions the calendars come from the `ICS_URLS` secret instead (see SETUP.md).

**Never commit or share these files.** They hold your real events. Don't attach them to issues, chats or PRs.

## Export your calendars
| Calendar | How |
| --- | --- |
| Google, one calendar (live link) | Settings → under "Settings for my calendars" click the calendar → **Integrate calendar** → copy **Secret address in iCal format**. Then `curl -L -o private/main.ics '<secret address>'`. The same link goes in the `ICS_URLS` secret. |
| Google, everything | Settings → **Import & export** → Export. You get a .zip with one .ics per calendar. Unzip it into `private/` |
| Google, one calendar (file) | Hover the calendar under "My calendars" → ⋮ → **Settings and sharing** → **Export calendar** |
| Apple Calendar (Mac) | Select the calendar in the sidebar → **File → Export → Export…** → save the .ics here |
| Anything else | Look for "Export" or "iCal/ICS". Any standard .ics file works |

Treat the secret address like a password. Anyone with it can read your calendar. If it leaks, reset it on the same
Integrate calendar screen.

## Use them
Name the files whatever you like. `ICS=` takes a comma-separated list, with no spaces. Run these from `journal/`:

    ICS=private/main.ics,private/birthdays.ics ./build-all.sh
    node render.mjs month 2027-10 private/main.ics,private/birthdays.ics
