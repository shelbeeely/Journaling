# Setup

**Fastest route:** unzip this, open the folder in Claude Code, and paste:

> Read CLAUDE.md and HANDOFF.md. Create a private GitHub repo called keeping-watch, push this, walk me through the
> secrets in SETUP.md, then get all four workflows green.


## 1. Make the repository (private)
Your books print your calendar, clinic and pay periods, so keep the repo **private**.
Easiest: open this folder in Claude Code and say *"create a private GitHub repo called keeping-watch and push this"*
(it uses `gh`). Or on github.com: New repository → Private → then upload this folder's contents.

## 2. Secrets (Settings → Secrets and variables → Actions)
| Name | Kind | What |
| --- | --- | --- |
| `ICS_URLS` | secret | Your calendars' private iCal links, comma-separated. Google Calendar: Settings → your calendar → Integrate calendar → **Secret address in iCal format**. |
| `BOOKS_PASSWORD` | secret | Password for the books archive. With `ICS_URLS` set, the Books workflow refuses to upload anything unencrypted. |
| `EDITOR_PAGES_REPO` | variable | Only for option B below, e.g. `you/keeping-watch-editor` |
| `EDITOR_PAGES_TOKEN` | secret | Only for option B: fine-grained token, **Contents: read and write** on that public repo |

Without `ICS_URLS` the books build from `test.ics` (sample events) and upload as a plain zip.

## 3. The editor site (pick one)
- **A. GitHub Pro (or a public repo):** Settings → Pages → Source: **GitHub Actions**. The site appears at
  `https://<you>.github.io/keeping-watch/` after the Editor workflow runs.
- **B. Private repo on a free plan:** make an empty **public** repo (e.g. `keeping-watch-editor`), set Pages there to
  deploy from the `gh-pages` branch, and add `EDITOR_PAGES_REPO` + `EDITOR_PAGES_TOKEN` above.

The site only ever holds a generic sample day and your layout, never calendar data.

## 4. Let the editor save to the repo
Create a **fine-grained token** (github.com → Settings → Developer settings → Fine-grained tokens):
repository access = only `keeping-watch`, permissions = **Contents: Read and write**. In the editor: More → Save to GitHub,
enter `you/keeping-watch` and the token. Saving commits `journal/content/daypage.json`, and the Books workflow rebuilds.
Tick "Remember" only on your own devices.

## 5. Bus refresh PRs
Settings → Actions → General → Workflow permissions → tick **Allow GitHub Actions to create and approve pull requests**.

## Getting the books
Actions → **Books** → the latest run → Artifacts → `keeping-watch-books`. Inside: `keeping-watch-books.7z`
(open with your password: 7-Zip on Windows, Keka on Mac, or an app like iZip or ZArchiver on a phone). It contains:
- every interior and cover PDF
- the EPUBs
- `layout.json` scan maps
- `sd-card/`: copy its `kw` folder to the X4's SD card

Run it by hand (Run workflow) to build only some months, one size, or hardcover padding.

## Firmware
Actions → **Firmware** builds `keeping-watch-x4-merged.bin` (flash at 0x0 with a browser flasher) and PNG previews of
every screen. Push a tag `x4-v0.1.0` to attach the image to a release. **Flashing replaces CrossPoint** (see x4/README.md).
