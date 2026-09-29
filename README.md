# Keeping Watch

A year-long journaling system (Oct 2026 – Sep 2027) in three parts that work together:

| Folder | What it makes |
| --- | --- |
| `journal/` | 12 monthly books for Amazon KDP (5.5×8.5 and 8.5×11), the yearly **Keeper**, X4 EPUBs, and the day page editor |
| `studio/` | Journalwright Studio (Phase G1): projects, named versions, branches, drafts and history for journal books; the editor's Versions drawer. Optional: single-user builds don't need it |
| `x4/` | Companion firmware for the Xteink X4 e-ink reader: today on the sleep screen, button check-ins, Support one long-press away |
| `.github/workflows/` | CI that builds the books, the firmware and the editor site, and refreshes STA bus times monthly |

- **Set it up:** [SETUP.md](SETUP.md), about 20 minutes
- **Carry on building:** [HANDOFF.md](HANDOFF.md), what's done and what's next
- **Working with Claude Code:** [CLAUDE.md](CLAUDE.md)
- **Versions, branches and history for a book:** [studio/README.md](studio/README.md)

## Quick start (local)

    cd journal && npm ci && npx playwright-core install chromium && pip install pillow
    ./build-all.sh                                          # sample books from test.ics
    ICS=private/main.ics,private/birthdays.ics ./build-all.sh   # your books
    node editor/build.mjs && open editor/dist/site/index.html   # day page editor

    cd x4/host && ./preview.sh                              # every X4 screen as PNG, no device needed
    git clone https://github.com/Free-Ink/freeink-sdk ../../freeink-sdk && cd .. && pio run -e x4
