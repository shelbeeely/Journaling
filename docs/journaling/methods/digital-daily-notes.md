# Digital daily notes

Daily notes in software: Obsidian Daily Notes and Periodic Notes, Logseq journals, Day One (templates, On
This Day), Notion templates, Apple's Journal app, and plain text (todo.txt, Org mode). Covers sync,
privacy, encryption, export formats and paper-to-digital workflows, and what a paper-first system like
Keeping Watch should borrow.

Checked: 2026-09-28. Points marked **(uncertain)** could not be confirmed from a primary source.

---

## 1. At a glance

| | |
|---|---|
| **Creator** | No single creator. Key tools: Obsidian (Dynalist Inc., 2020), Periodic Notes plugin (Liam Cain), Logseq (open source, AGPL), Day One (Bloom Built, 2011; Automattic since 2021 **(uncertain)**), Notion, Apple Journal (Apple, 2023), todo.txt (Gina Trapani), Org mode (Carsten Dominik, Emacs). |
| **Year** | Plain-text diaries go back decades; Org mode 2003 **(uncertain)**; Day One 2011; Obsidian 2020; Logseq 2020; Apple Journal 11 Dec 2023. |
| **Type** | Journal and system (a note per day, created from a template, linked to other notes). |
| **Time per day** | 2–15 min. A template makes the start near zero. |
| **Time per week** | 10–20 min for a weekly note or review; more if you tinker with plugins. |
| **Cost** | Free (Obsidian, Logseq, Apple Journal, plain text, Notion free tier). Paid sync/premium: Obsidian Sync, Day One Premium, Notion plans (prices change; not checked). |
| **Formats and sizes** | Markdown files (Obsidian, Logseq), Org files, plain text, app databases (Day One, Notion, Apple Journal). Phone, tablet, desktop, web. |
| **Best for** | People who type faster than they write; people who want search, links and "on this day" resurfacing; people who journal in small bursts from a phone. |
| **Not ideal for** | People who need screen-free time, people who get lost in customising, anyone for whom the phone is the problem. |
| **Learning curve** | Low (Apple Journal, Day One). Medium (Obsidian, Notion). High (Logseq queries, Org mode, plugin stacks). |
| **Supplies** | A device, the app, optionally a sync service and a backup drive. |
| **Official sites** | obsidian.md, logseq.com, dayoneapp.com, notion.com, apple.com (Journal), github.com/todotxt, orgmode.org. |
| **Evidence level** | Some studies on technology-mediated reflection and reminiscence (Echo, Pensieve, MoodAdaptor). No trials of any specific app. |

## 2. Summary

A digital daily note is one page per day, made automatically from a template, stored in an app or as a
file named by date. Obsidian and Logseq keep them as Markdown files on your own disk and link them to
everything else; Day One and Apple Journal keep them in encrypted databases with photos, places and "On
This Day" memories; Notion makes each day a database row; plain-text users keep one file or one outline
per day. The best ideas worth taking back to paper are small: a fixed template so the page starts itself,
dates as the backbone, tags you can count, a weekly and monthly note that sums the days, and gentle
resurfacing of past entries. The research on "technology-mediated reflection" suggests that looking back at
your own entries can lift mood, especially when you reflect rather than only record, but the effect
depends on mood and memory valence. For Keeping Watch, paper stays first; the digital side is a thin,
private layer for tallies, resurfacing and archive.

## 3. History and origin

### Who and what

- **Plain-text diaries**: programmers kept `journal.txt` files long before apps. todo.txt (Gina Trapani,
  around 2006 **(uncertain)**) set rules for one task per line with priorities, `+projects`, `@contexts`
  and `key:value` metadata.
- **Org mode** (Emacs) added capture templates and the "date tree": years, then months or ISO weeks, then
  days, generated for you.
- **Day One** (2011) made the phone journal app mainstream: photos, location, weather, reminders and later
  "On This Day." It now has end-to-end encryption on by default for new journals (after version 4.2).
- **Obsidian** (2020) popularised Markdown "vaults." Its core Daily notes plugin "opens a note based on
  today's date, or creates it if it doesn't exist." Liam Cain's Periodic Notes plugin extended this to
  weeks and months (and later quarters and years **(uncertain)**).
- **Logseq** (2020) made the daily journal the home page: every day at midnight a new journal page appears,
  optionally with your default template.
- **Notion** templates and repeating database templates (daily, weekly, monthly, yearly) turned daily
  notes into database rows with properties.
- **Apple Journal** (iOS 17.2, 11 December 2023) added on-device "Journaling Suggestions" built from photos,
  workouts, places and people, plus reflection prompts.

### Timeline

| Year | Event |
|---|---|
| ~2003 | Org mode begins **(uncertain)**. |
| ~2006 | todo.txt format **(uncertain)**. |
| 2010 | Pensieve study (Cornell) on emailed memory triggers for everyday reminiscence. |
| 2011 | Day One launches **(uncertain on month)**. |
| 2013 | Echo study (Isaacs et al., CHI) on technology-mediated reflection. |
| 2016 | MoodAdaptor study (Konrad et al.) on mood-congruent vs incongruent reflection. |
| 2020 | Obsidian and Logseq public releases. |
| 2022 | Logseq blog: automated daily template (25 Apr). |
| 2023 | Steph Ango, "File over app" (1 Jul). Apple Journal (11 Dec). |
| 2024–2026 | Logseq DB version in beta ("data loss is possible"); Day One E2EE default; Apple Journal widens (iPad/Mac **(uncertain)**). |
| 2026 | LaughAnchor preprint (Sep): resurfacing everyday moments indexed by laughter. |

### Cultural context

Personal knowledge management ("second brain," "tools for thought") made daily notes a hub: you write in
today's note and link out. Day One and Apple Journal took the opposite path: private, pretty, memory-first,
with little linking. Both camps moved toward privacy: local files or end-to-end encryption.

### Key quotes

- Obsidian help: daily notes "opens a note based on today's date, or creates it if it doesn't exist."
- Logseq (Tienson Qin, 2022): "Every day at midnight you'll get a new Journals page with the template
  already populated."
- Steph Ango (2023): "In the fullness of time, the files you create are more important than the tools you
  use to create them."
- Day One on E2EE: "If the key is lost, encrypted journal stored in the Day One Sync cannot be decrypted."
- Apple (2023): suggestions are generated on device; you choose what goes into an entry.

## 4. Philosophy and principles

- **The page starts itself.** A template removes the blank-page cost.
- **Dates are the backbone.** File names like `2026-10-01.md` sort, link and survive any app.
- **Link, don't file.** Put things in today's note; link to people and projects; let backlinks gather them.
- **Resurface.** On This Day and random-entry features bring the past back without effort.
- **Own your files** (Obsidian, Logseq, plain text) vs **trust the vault** (Day One, Apple Journal).
- **Problem solved:** capture is fast and searchable; nothing gets lost; patterns become visible.

## 5. Core components

| Component | What it does | Tools |
|---|---|---|
| Daily note | One page per date | all |
| Template | Pre-filled headings, prompts, checkboxes | Obsidian Templates, Logseq default template, Day One templates, Notion database templates |
| Periodic notes | Weekly, monthly, quarterly, yearly pages | Periodic Notes plugin, Org datetree, Notion repeating templates |
| Tags and properties | Countable labels, key:value fields | `#tag`, YAML properties, Notion properties, todo.txt `key:value` |
| Links and backlinks | Connect days to topics | Obsidian, Logseq, Notion |
| Queries | Collect all entries with a tag | Logseq queries, Obsidian Dataview (community), Notion views |
| Calendar view | Pick a date, see the note | Obsidian Calendar plugin, Day One, Apple Journal |
| On This Day | Show entries from this date in past years | Day One; plugins elsewhere |
| Suggestions / prompts | Ideas to write about | Apple Journaling Suggestions, Day One prompts, templates |
| Sync | Copy across devices | Obsidian Sync, iCloud, Day One Sync, Logseq sync, Notion cloud |
| Encryption | Protect entries | Day One E2EE, Obsidian Sync E2EE, Apple iCloud E2EE (with passcode + 2FA) |
| Export | Get entries out | Markdown, JSON, PDF, CSV, plain text |

### 5.1 Obsidian Daily notes

Settings: date format (default `YYYY-MM-DD`; nested paths like `YYYY/MMMM/YYYY-MMM-DD` work), new file
location, template file location, open on startup. Open today's note from the ribbon calendar icon, the
command palette or a hotkey. A date property in any note becomes a link to that day's note.

### 5.2 Obsidian Templates

Variables `{{title}}`, `{{date}}`, `{{time}}`, with Moment.js formats (`{{date:dddd D MMMM}}`). Edit
templates in Source mode so properties don't mangle variables.

### 5.3 Periodic Notes (community plugin)

By Liam Cain, MIT licence. Daily, weekly and monthly notes each with folder, template and file-name format;
commands to jump to the next and previous note; took weekly notes over from his Calendar plugin.
Maintenance status in 2026: **(uncertain)**.

### 5.4 Logseq journals

An outliner: every line is a block. The Journals page shows today on top and earlier days below. A default
template is set in `config.edn` with `:default-templates {:journals "Your template"}`. Files are Markdown or
Org on your disk; the newer DB version (beta) stores in SQLite and warns "data loss is possible."

### 5.5 Day One

Templates hold fixed text, formatting, checklists and prompts; no dynamic date variables; default template
per journal on iOS, macOS and web. On This Day on iOS, macOS and Android, with optional reminder
notifications per journal. E2EE default for new journals; the key stays on device (optionally iCloud
Keychain). Exports: PDF, JSON (zip with media), plain text/Markdown (single file), CSV (mobile). JSON and
text exports are **not** encrypted.

### 5.6 Notion

Thousands of free journaling templates in the marketplace (2,656 listed when checked). Database templates
can repeat daily, weekly, monthly or yearly; daily ones cannot nest other templates.

### 5.7 Apple Journal

iOS 17.2 (Dec 2023). Text, photos, video, audio, locations; bookmarks and filters; reflection prompts
("gratitude, kindness, purpose"); Journaling Suggestions from on-device data (workouts, media, contacts,
photos, locations, State of Mind mood logs), each category switchable in Settings. Entries encrypted when
the phone is locked; end-to-end encrypted in iCloud with passcode and two-factor.

### 5.8 Plain text

- **todo.txt:** `(A) 2026-10-01 Call dentist +health @phone due:2026-10-02`; done lines start with `x`.
- **Org mode:** capture to `file+olp+datetree`, which builds `* 2026` / `** 2026-10 October` / `*** 2026-10-01
  Thursday`; `:tree-type week` uses ISO weeks, `month` drops days.
- **One file per day:** `journal/2026/2026-10-01.md`, readable forever.

## 6. Setting it up

### First setup (Obsidian example, 15 min)

1. Make a vault folder, e.g. `Journal/`.
2. Turn on core plugins Daily notes and Templates.
3. Make `Templates/Daily.md` (see 9.1). Set Daily notes → template to it; date format `YYYY-MM-DD`; folder
   `Days/YYYY` if you like years.
4. Turn on "Open on startup."
5. Decide sync: none, Obsidian Sync with end-to-end encryption, or a folder sync you control. Decide backup:
   a weekly copy of the vault folder.
6. Optional: Periodic Notes for weekly and monthly notes.

### First setup (Day One or Apple Journal, 5 min)

1. Make one journal. Turn on lock (Face ID / passcode).
2. In Day One, make one template and set it as the journal's default. In Apple Journal, choose which
   suggestion categories you allow (turn off contacts and locations if they feel invasive).
3. Pick one reminder time, or none.

### First day

Open today's note, fill the template in under five minutes, add one tag. Close.

### First week

- Day 3: cut any template heading you skipped twice.
- Day 7: make a weekly note: count tags, copy three lines worth keeping, one line for next week.

## 7. Daily practice

| Step | Time | What |
|---|---|---|
| 1 | 0 s | Open today's note (hotkey, widget or startup). |
| 2 | 1 min | Check-in fields: mood, sleep, meds. |
| 3 | 1–3 min | Top 3 / plan, or skip. |
| 4 | any | Quick bullets through the day (from phone). |
| 5 | 2–5 min | Evening: went well, was hard, tomorrow. Add tags. |
| 6 | 10 s | Glance at "On this day" if it's there. Don't reply to the past; just read. |

**Prompts:** "What happened?" "What did I feel?" "What helped?" "What do I want to remember?" "What's next?"

## 8. Rhythms

- **Weekly:** weekly note from template: list the week's notes, count tags (queries or by hand), three
  highlights, next week's focus. Back up.
- **Monthly:** monthly note: totals (mood average, sleep, meds), best moments linked, what to change. Export
  a PDF or zip of the month for your archive.
- **Quarterly:** prune tags and templates; check the backup actually opens.
- **Yearly:** yearly note; export everything to an open format (Markdown/JSON/PDF) and store in two places;
  review On This Day entries for the year.
- **Archiving:** files by year folder; Day One journals by year if large.

## 9. Page anatomy

### 9.1 Obsidian daily note template (Markdown)

```markdown
---
date: {{date}}
mood:
sleep:
meds:
tags: [day]
---
# {{date:dddd D MMMM YYYY}}

## Plan
- [ ]
- [ ]

## Log
-

## Went well / Was hard / Tomorrow
- well:
- hard:
- next:

## On this day
![[{{date:YYYY-MM-DD}} minus one year]]   <- illustration only; real resurfacing needs a plugin
```

### 9.2 Logseq journal page (outliner)

```
Oct 1st, 2026
 • mood:: 3
 • [[Clinic]] 10:00, bus 33
 • TODO call dentist
 • Went well
    • coworker coffee
 • Was hard
    • rain, bus late
 • #good #shift
```

### 9.3 Day One entry with template

```
+----------------------------------------+
| Thu, Oct 1, 2026  8:05 PM   Spokane 7C  |  metadata row (auto)
|----------------------------------------|
| Morning                                 |
| [x] meds  [ ] water                     |
| Evening                                 |
| Went well: ...                          |
| Was hard:  ...                          |
| [photo]                                 |
|----------------------------------------|
| #good #shift        On This Day: 2 (i)  |
+----------------------------------------+
```

### 9.4 Org mode date tree

```
* 2026
** 2026-10 October
*** 2026-10-01 Thursday
    - clinic 10:00
    - mood 3 :good:shift:
*** 2026-10-02 Friday
```

### 9.5 Notion daily database

```
| Date       | Mood | Sleep | Meds | Tags        | Page     |
|------------|------|-------|------|-------------|----------|
| 2026-10-01 | 3    | 6.5   | ✓    | good, shift | (open)   |
| 2026-10-02 | 4    | 7.0   | ✓    | rest        | (open)   |
```

Proportions do not apply to screens the way they do to paper; what matters is the order: date first,
quick fields next, free text last, tags at the end.

## 10. Worked examples

### 10.1 A day (Obsidian)

```markdown
---
date: 2026-10-01
mood: 3
sleep: 6.5
meds: both
tags: [day, shift, clinic]
---
# Thursday 1 October 2026
## Plan
- [x] clinic 10:00 (bus 33, leave 9:20)
- [ ] call dentist → tomorrow
## Log
- 13:40 first frost watch posted for tonight
- 22:10 home, feet cold
## Went well / Was hard / Tomorrow
- well: coworker saved me a coffee
- hard: bus 20 min late in rain
- next: call dentist at 9:05
```

### 10.2 A week (weekly note)

```markdown
# 2026-W40
Days: [[2026-09-28]] … [[2026-10-04]]
Mood avg 3.1 · sleep avg 6.6 · meds both 6/7
Tags: shift ×4, rest ×2, outside ×5, texted ×2
Keep: "coworker saved me a coffee" · "first real frost" · "J said yes to Saturday"
Next week: dentist; one slow morning.
```

### 10.3 A month (monthly note)

```markdown
# October 2026
Logged 27/31 days.  Mood 3.1.  Sleep 6.4 h.  Meds both 24, any 29.
Good-spoon days 11.  Did something I enjoy 14.  Texted someone 12.
Best days: [[2026-10-10]] (river walk), [[2026-10-24]] (bookshop)
Change for November: bus earlier on clinic days; lights on at 5 pm.
On this day last year: first time I wore the green coat out.
```

## 11. Variations and offshoots

| Variant | Who | How it differs |
|---|---|---|
| Obsidian Daily notes | Obsidian team | Core, simple, file per day. |
| Periodic Notes | Liam Cain | Adds week/month notes and navigation. |
| Journals-first outliner | Logseq | Daily page as home; blocks; queries. |
| Interstitial journaling | community (Tony Stubblebine popularised, **uncertain**) | Timestamped line whenever you switch tasks. |
| Memory journal | Day One, Apple Journal | Photos, places, On This Day; little linking. |
| Database journal | Notion | Properties per day; views and charts. |
| Plain-text diary | todo.txt users, Org mode | One file or date tree; no app lock-in. |
| One-line-a-day digital | many apps | A single line; resurfaced yearly. |
| Paper-first hybrid | Keeping Watch, BuJo users who scan | Write on paper; scan or tally into digital. |

## 12. Community practice

- **What people do:** Obsidian users share daily templates on the forum and Reddit; many start with 10
  headings and end with 3. Logseq users live in the journal and rarely make pages. Day One users lean on
  photos and On This Day. Notion users build dashboards, then often move to something simpler.
- **Common customisations:** mood and sleep properties; habit checkboxes; "yesterday / tomorrow" links;
  embedding tasks due today; a weekly review template; tag lists for moods.
- **Aesthetic camp:** Notion dashboards with covers and icons; themed Obsidian vaults.
- **Minimalist camp:** plain Markdown, no plugins, one line a day.
- **Common complaint:** plugin stacks break after updates; sync conflicts; the tool becomes the hobby.

## 13. Official products and formats

| Product | Formats | Price model | Platforms |
|---|---|---|---|
| Obsidian | Markdown files | Free; optional paid Sync/Publish | Win, Mac, Linux, iOS, Android |
| Periodic Notes | plugin | Free, MIT | Obsidian |
| Logseq | Markdown/Org (file version); SQLite (DB beta) | Free, AGPL-3.0 | desktop, mobile, web |
| Day One | app database; export PDF/JSON/TXT/MD/CSV | Free tier + Premium | iOS, Mac, Android, Web, Windows |
| Notion | cloud database; export Markdown/CSV/PDF **(uncertain on current export set)** | Free + paid | all |
| Apple Journal | app database; print/export entries | Free with iOS | iPhone (others **uncertain**) |
| todo.txt | plain text | Free | anything |
| Org mode | plain text `.org` | Free | Emacs (and mobile apps) |

Release cycles: continuous app updates; Apple features arrive with yearly iOS releases.

## 14. Tools and supplies

- A phone for capture, a computer for weekly and monthly notes.
- A keyboard (Bluetooth) if typing on a tablet.
- Backup: an external drive or a second folder; test restore yearly.
- For hybrid: a phone scanner app or the Keeping Watch scan pipeline; a pen and the monthly book.
- Not needed: stickers, stamps, rulers.

## 15. Digital and hybrid versions

This doc is itself the digital version. Hybrid (paper → digital) patterns:

| Pattern | How | Kept | Lost |
|---|---|---|---|
| Scan-and-file | Photograph each page into the day note | handwriting, drawings | search (unless OCR) |
| Tally transfer | Copy only numbers (mood, sleep) into properties | trends, charts | the story |
| Keeping Watch codes | Data Matrix page code + data-zones map each block | per-block crops, dates | nothing if the scan is good |
| Weekly digest | Type 3 lines from the paper week | highlights | detail |
| Device tallies | X4 check-ins CSV (`2026-10-14T13:05,med_am,1`) | numbers without typing | anything not a button |

**E-ink:** see [`e-ink-templates.md`](e-ink-templates.md). Kobo Advanced notebooks and Kindle Scribe can
convert handwriting to text you paste into daily notes.

**Paper vs digital:** digital gains search, links, resurfacing and backup; it loses the screen-free ritual,
the object on the shelf, and privacy that doesn't depend on a password.

### Sync, privacy and encryption

| Tool | Local files | Sync | E2EE | Lost-key outcome |
|---|---|---|---|---|
| Obsidian | yes, unencrypted on disk | Obsidian Sync or your own | yes (Sync, AES-256, scrypt) | "encrypted and unusable forever" |
| Logseq | yes | own sync or git | depends | depends |
| Day One | app database | Day One Sync | yes, default for new journals | cannot be decrypted |
| Apple Journal | on device | iCloud | yes with passcode + 2FA | Apple account recovery rules |
| Notion | no (cloud) | built in | no **(as far as we found)** | n/a |
| Plain text | yes | anything | whatever you add (e.g. encrypted disk) | yours |

Notes: exports are usually **unencrypted** (Day One says so). Obsidian Sync E2EE still exposes metadata
(timestamps, device, encrypted path mapping).

### Export formats worth knowing

- **Markdown**: best for longevity.
- **JSON**: best for re-import and scripts (Day One zip includes media folders).
- **CSV**: best for numbers (Day One mobile; X4 logs already use it).
- **PDF**: best for printing and reading, worst for reuse.

## 16. Evidence and research

| Study | Sample | Finding | Limits |
|---|---|---|---|
| Peesapati et al. 2010, Pensieve (CHI) | 91 users, 5 months, 11,000+ emailed triggers, 700+ entries | People valued spontaneous reminders to reminisce; shorter, general triggers drew more responses, as did their own photos; photo responses held more metadata than storytelling. | Self-selected users; email-era; mood effects modest. |
| Isaacs et al. 2013, Echo (CHI) | 44 users, 12,000+ recordings and reflections | Technology-mediated reflection improved well-being on four measures; two mechanisms identified from entries. | Opened only via citation (ACM page blocked); summary from the 2016 paper and search record. |
| Konrad, Tucker, Crane, Whittaker 2016, MoodAdaptor (*Psychology of Well-Being*) | 128 people, 1 month, randomised | Reflecting on positive memories in a bad mood lifted mood right away but sometimes "kill-joy thinking" tainted the memory; negative memories in a good mood lowered mood but showed distancing and redemption; no overall well-being change. | Fewer reflections than earlier studies (9.43 vs 53.42 average); pre-written memory pools. |
| Fang et al. 2026, LaughAnchor (arXiv preprint) | 12 people, 3 weeks | Resurfacing laughter-indexed moments supported reconstruction and "rediscovery"; user control mattered. | Tiny, not peer reviewed. |
| Umejima et al. 2021 | 48 students | Paper notes led to faster writing and stronger retrieval activation than tablet or phone. | Small, one task. |
| Morehead et al. 2019 | replication, includes eWriter | No consistent longhand vs laptop vs eWriter differences. | Classroom notes, not journaling. |

**Claimed vs supported:**

- "Looking back at old entries makes you feel better": some support, conditional on mood and valence.
- "Reminders to reflect help": supported (Pensieve), with the caveat that reminders are notifications.
- "Typed journaling is as good as handwriting": not settled.
- "Tags and dashboards reveal patterns that help": plausible; no trials.

## 17. Benefits

- Fast capture from anywhere. **claimed**
- Full-text search. **claimed (obvious by design)**
- Resurfacing past entries can lift mood. **evidenced (conditional)**
- Reminders increase reflection. **evidenced (Pensieve)**
- Templates lower start-up friction. **claimed**
- Numbers roll up automatically into week/month views. **claimed**
- Backups protect against loss (fire, lost notebook). **claimed**
- Open formats last decades. **claimed (Ango's argument)**

## 18. Pitfalls

| Pitfall | Fix |
|---|---|
| Template bloat (15 headings, most empty) | Delete any heading skipped twice in a week. |
| Phone pulls you into other apps | Write from a widget or lock-screen shortcut; or write on paper and transfer tallies only. |
| Plugin rot after updates | Core features only for the daily note; plugins for weekly extras. |
| Sync conflicts and duplicates | One sync method; never two at once (e.g. iCloud + Obsidian Sync). |
| Lost encryption key | Store the key/password in the Keeper (hints) and a password manager. |
| On This Day brings back something painful | Allow skipping and hiding; never auto-show on the lock screen; let the user choose periods. |
| Streak guilt | Hide streak counts; missed days show as blank, not red. |
| Data trapped in an app | Monthly export to Markdown or JSON. |
| Notification fatigue | One reminder at most, or none. |
| Journaling becomes optimisation | Timebox system tweaks to the monthly review. |

## 19. Accessibility and adaptations

- **ADHD:** templates and hotkeys cut start-up friction; interstitial timestamps help time blindness;
  risk: endless tinkering. Keep one template.
- **Autism and sensory needs:** dark mode, reduced motion, no confetti or streak animations; predictable
  structure; plain text avoids visual clutter.
- **Chronic illness and low spoons:** voice dictation, quick numeric fields, templates with defaults; a
  one-line entry counts.
- **Depression and anxiety:** control resurfacing (skip, hide, only happy tags); avoid mood charts that
  shame; allow "not today."
- **Trauma:** local-only storage, lock, and a way to exclude entries from On This Day; watch Apple
  suggestions from contacts and places.
- **Dyslexia and dysgraphia:** typing, spellcheck and dictation remove handwriting barriers; readable
  fonts; text-to-speech for rereading.
- **Low vision:** system text size, screen readers (Day One and Apple Journal support VoiceOver
  **(uncertain on details)**), high contrast themes.
- **Motor or hand pain:** dictation; big tap targets; fewer fields.
- **Trans and gender-diverse people:** privacy for HRT, dysphoria, name and pronoun notes; E2EE; no cloud
  photos of the body unless encrypted; avoid shared family iCloud.
- **Shift workers:** define the "day" by sleep, not midnight (Obsidian lets you open any date; Logseq
  creates a new page at midnight, which can split a night shift).
- **Low income:** Obsidian, Logseq, plain text and Apple Journal are free; old phones work.

## 20. Comparison

| | Digital daily notes | Paper Bullet Journal | One line a day | E-ink tablet | Keeping Watch |
|---|---|---|---|---|---|
| Start-up friction | very low (template) | low | very low | low | very low (printed) |
| Search | full | index | none | partial | page codes |
| Resurfacing | automatic (On This Day) | manual | built into layout | manual | "On this day" (history), Looking back pages |
| Tallies | automatic with queries | manual | none | manual | X4 month stats |
| Screen-free | no | yes | yes | mostly | yes (paper) |
| Privacy | depends | physical | physical | depends | physical + local |
| Longevity | depends on format | decades | decades | depends | decades + CSV |

## 21. Combining

- **E-ink:** [`e-ink-templates.md`](e-ink-templates.md): e-ink as capture, daily notes as archive.
- **Bullet Journal:** rapid logging symbols work in Markdown (`- [ ]`, `- [x]`, `- [>]`).
- **One line a day / five-year journals:** On This Day is a digital five-year journal.
- **Keeping Watch:** paper page is the entry; X4 CSV and scans can be imported into a private daily-note
  vault if Shelbee ever wants search. The book's Looking back pages are the paper On This Day.

## 22. Ready-to-use bank

**Daily template headings**

1. Plan / Log / Review
2. Went well / Was hard / Tomorrow
3. Body / Mind / People
4. Morning / Evening
5. Today I noticed…
6. Words to keep

**Properties to track (countable)**

7. mood (1–5)
8. anxiety (1–5)
9. sleep (hours)
10. meds (am/pm/both)
11. spoons (start → end)
12. outside (minutes)
13. texted (yes/no)
14. pain (0–5)

**Tags**

15. #good
16. #hard
17. #shift
18. #rest
19. #firsts (first frost, first snow, first time I…)
20. #people
21. #clinic

**Prompts**

22. What do I want future me to remember about today?
23. What did I do for my body?
24. What's one thing that was mine today?
25. What did I learn about what I need?
26. What would make tomorrow 5% easier?

**Weekly / monthly note headings**

27. Numbers (averages and counts)
28. Three to keep
29. What to change
30. On this day, last month / last year

## 23. Glossary

| Term | Meaning |
|---|---|
| Daily note | One note per date, created on demand. |
| Periodic notes | Weekly, monthly, quarterly, yearly notes. |
| Template | Pre-filled text inserted into new notes. |
| Template variable | Placeholder like `{{date}}` filled at insert time. |
| Moment.js format | Date tokens like `YYYY-MM-DD`, `dddd`. |
| Vault | Obsidian's folder of Markdown files. |
| Graph | Logseq/Obsidian's set of linked notes. |
| Block | Logseq's unit: one bullet. |
| Backlink | A list of notes that link to this one. |
| Property / frontmatter | Key:value fields at the top of a note. |
| Query | A saved search that collects matching blocks or notes. |
| Date tree | Org mode outline: year > month (or week) > day. |
| Capture | Org mode's quick-entry feature using templates. |
| todo.txt | Plain-text task format by Gina Trapani. |
| Context / project | todo.txt `@where` and `+what`. |
| On This Day | Showing entries from the same date in past years. |
| Journaling Suggestions | Apple's on-device prompts from your activity. |
| E2EE | End-to-end encryption: only your devices hold the key. |
| Local-first | Data lives on your device; cloud is optional. |
| File over app | Ango's principle: durable files matter more than tools. |
| TMR | Technology-mediated reflection. |
| Interstitial journaling | Timestamped notes between tasks. |

## 24. FAQ

**1. Obsidian, Logseq or Day One?** Obsidian if you want files and links; Logseq if you think in bullets;
Day One or Apple Journal if you want photos, privacy by default and memories.

**2. Are my notes private?** Obsidian and Logseq files sit unencrypted on your disk unless your disk is
encrypted; Obsidian Sync, Day One and Apple Journal (with passcode + 2FA) are end-to-end encrypted in the
cloud. Exports are usually unencrypted.

**3. What if I lose my encryption key?** Day One and Obsidian cannot recover it. Keep a hint in the Keeper
and the key in a password manager.

**4. Does On This Day help or hurt?** Research suggests reflection can lift mood, but positive memories in a
low mood can sting. Let yourself skip.

**5. Can Day One templates insert the date?** No: Day One templates have no dynamic variables. Obsidian's do.

**6. Which export format lasts?** Markdown for text, CSV for numbers, PDF for reading.

**7. Can I combine paper and digital?** Yes: write on paper, move only numbers or highlights. Keeping Watch
already logs numbers on the X4.

**8. Isn't a phone journal distracting?** Often. Widgets and one-tap entry help; paper helps more.

**9. What about Apple's suggestions reading my contacts and locations?** They run on device and each
category can be turned off in Settings → Privacy & Security → Journaling Suggestions.

**10. Is Logseq's new database version safe?** It is beta; Logseq itself warns data loss is possible. Keep
backups.

## 25. For Keeping Watch

### 25a. Printed book

| Idea | Where | Fit | B&W and scan-zone notes | Built? |
|---|---|---|---|---|
| Personal "on this day": a small line "A month ago today:" to fill from last month's page | Day block (new, optional) | med | one line; zone `lookback`; lets paper do what Day One's On This Day does, by hand | no |
| Looking back pages with "this day last month" prompts | Back matter | high | text only | partly (Looking back) |
| Tag strip in the header | Page header | high | TAGS header field exists; add a printed tag key (#good #hard #shift…) in front matter | header yes; key no |
| Countable tags → monthly tally page | Month page | med | tag list × weeks grid, outlined | no |
| Week summary box ("numbers, three to keep, change") | Weekly review | high | matches weekly note template | partly (weekly review) |
| Monthly note mirror: "Numbers / Best days / Change" | Closing the month | high | the X4 provides numbers | partly |
| Template consistency: one default layout, optional presets | Editor | high | already the model | yes |
| Dates as the backbone (ISO date on every page) | Header | high | DATE field + Data Matrix code already | yes |
| Printed "export" (a CSV-like table of the month's numbers) | Keeper handoff | med | copy from X4 "This month" | partly |
| Prompt bank from section 22 | Front or back matter | med | text only | no |

### 25b. X4

| Idea | Where | Fit | RAM, scope and calm notes |
|---|---|---|---|
| Logs stay CSV, one line per change, "last value wins" | Data format | high, **built** | Plain, durable; matches "file over app." |
| Download logs on the Wi-Fi page | Wi-Fi page | high, **built** | Local only; no cloud. |
| Personal On This Day: last month's same date (mood, spoons, care done) | Today screen footer (opt-in) | med | Reads one CSV day; small buffer. Neutral wording, no comparison arrows. Off by default; needs Shelbee's yes. |
| Weekly numbers (7-day mood avg, care done) | This month screen, a second page | med | Reuse `monthStats`; no charts that shout; dots. |
| Tags as check-in toggles (e.g. #good day, #hard day) | Check-in item kinds (toggle) | med | Via the bridge from a `checks` block titled "Tags"; counts roll into month stats only if added there. |
| Template-driven check-ins (`/kw/checkins.txt`) | Check-in kinds | high, **being added** | The digital "template" idea done offline. |
| Export a Markdown month summary (`/kw/log/2026-10.md`) | Wi-Fi page download | med | Generated on request, streamed, no big buffer; lets Shelbee paste into any notes app if she wants. |
| Day boundary set by sleep, not midnight | Setting | med | Shift-worker lesson from Logseq's midnight page; see e-ink doc. |
| Reminders to reflect | none | **don't** | Pensieve shows reminders help, but they are notifications. The sleep screen is the passive reminder. |
| Sync to Day One / Obsidian | none | **don't** | Nothing leaves the device except over its own hotspot on request. |
| Suggestions from activity (Apple style) | none | **don't** | Surveillance-shaped and out of scope. |

### 25c. Proposed editor blocks

| Type | Name | Options | `data-zone` | X4 export kind |
|---|---|---|---|---|
| `lookback` | A month ago today | `title` ("A month ago today"), `n` lines (1–2), `period` choice (month/year) | `lookback` | not exported (text) |
| `tags` (preset of `checks`) | Day tags | labels: good, hard, rest, firsts | `checks` | `toggle` each |
| `fields` preset | Numbers | labels: Sleep hours, Minutes outside | `fields` | `count` 0..99 |
| `keep` (preset of `lines`) | Words to keep | 2 lines (exists) | `lines` | not exported |

`lookback` is the only new type. It prints a light label and one or two lines; the book can pre-fill a
greyed "Oct 1 page" reference so she knows where to look.

### 25d. Proposed method layout: "Daily note"

A one-click layout that mirrors a well-pruned digital daily note:

1. `sky`
2. `events`
3. `care`
4. `fields` Numbers (sleep, outside)
5. `top` Plan (3)
6. `body` Log (lines)
7. `review` Went well · Was hard · Tomorrow
8. `checks` Day tags (good, hard, rest, firsts)
9. `lookback` A month ago today
10. `fact` On this day

Exports: 2 counts + 4 toggles = 6 of 16 slots.

### 25e. Don't adopt

- **Cloud sync or accounts** for journal content: breaks the privacy rule.
- **Activity-based suggestions** (Apple): need data collection the system avoids.
- **Streaks and "You journaled 30 days!"** badges: firmware rule; guilt on bad weeks.
- **AI summaries of the month:** no generative AI.
- **Plugin-style extensibility on the X4:** RAM and calm; one fixed bridge format is enough.
- **Dashboards with many charts** on paper: busy ornament; keep tallies simple.
- **Unencrypted uploads** of any logs or scans.

## 26. Open questions

- Does resurfacing past entries help Shelbee specifically, and which period (last month vs last year)?
- Should "a month ago" draw from paper (by hand) or from the X4 CSV (automatically)? Paper keeps the story;
  the CSV only has numbers.
- Would a Markdown month export from the X4 get used, or is the CSV enough?
- Current Notion export formats and Apple Journal's platform list (not confirmed from primary pages).
- Periodic Notes' maintenance status in 2026.
- Echo (2013) full text could not be opened; figures come from the 2016 follow-up and the search record.

## 27. Further reading

- Obsidian Help, Daily notes and Templates: the cleanest spec for a daily-note system.
- Liam Cain, Periodic Notes README: weekly and monthly notes as first-class pages.
- Tienson Qin, "How to Set Up an Automated Daily Template in Logseq" (2022).
- Day One guides on On This Day, templates, E2EE and export.
- Apple Newsroom, "Apple launches Journal app" (Dec 2023) and the Journaling Suggestions privacy page.
- Steph Ango, "File over app" (2023): why plain files outlast apps.
- todo.txt format spec and Org mode's capture/datetree docs: plain-text daily notes.
- Peesapati et al. 2010 (Pensieve) and Konrad et al. 2016 (MoodAdaptor): what resurfacing does and doesn't do.
- Isaacs et al. 2013, "Echoes from the Past" (CHI): technology-mediated reflection (not opened; ACM blocked).

## 28. Sources

All opened on 2026-09-28.

1. Obsidian Help, "Daily notes." https://obsidian.md/help/plugins/daily-notes
2. Obsidian Help, "Templates." https://obsidian.md/help/plugins/templates
3. Obsidian Help, "Sync security and privacy." https://obsidian.md/help/sync/security
4. Liam Cain, "obsidian-periodic-notes," GitHub. https://github.com/liamcain/obsidian-periodic-notes
5. Logseq, GitHub README. https://github.com/logseq/logseq
6. Tienson Qin, "How to Set Up an Automated Daily Template in Logseq," Logseq blog, 25 Apr 2022.
   https://blog.logseq.com/how-to-set-up-an-automated-daily-template-in-logseq/
7. Logseq docs repo, `config.edn`. https://github.com/logseq/docs/blob/master/logseq/config.edn
8. Day One, "On This Day." https://dayoneapp.com/guides/tips-and-tutorials/on-this-day/
9. Day One, "Templates." https://dayoneapp.com/guides/tips-and-tutorials/templates/
10. Day One, "End-to-End Encryption FAQ." https://dayoneapp.com/guides/day-one-sync/end-to-end-encryption-faq/
11. Day One, "Exporting entries." https://dayoneapp.com/guides/settings/exporting-entries/
12. Apple Newsroom, "Apple launches Journal app, a new app for reflecting on everyday moments," 11 Dec 2023.
    https://www.apple.com/newsroom/2023/12/apple-launches-journal-app-a-new-app-for-reflecting-on-everyday-moments/
13. Apple, "Journaling Suggestions & Privacy." https://www.apple.com/legal/privacy/data/en/journaling-suggestions/
14. Notion, "Journaling templates" marketplace category. https://www.notion.com/templates/category/journaling
15. Notion Help, "Database templates." https://www.notion.com/help/database-templates
16. todo.txt format, GitHub. https://github.com/todotxt/todo.txt
17. Org mode manual, "Capture." https://orgmode.org/manual/Capture.html
18. Org mode manual, "Template elements" (datetree). https://orgmode.org/manual/Template-elements.html
19. Steph Ango, "File over app," 1 Jul 2023. https://stephango.com/file-over-app
20. Konrad A., Tucker S., Crane J., Whittaker S., "Technology and Reflection: Mood and Memory Mechanisms for
    Well-Being," Psychology of Well-Being, 2016 (PMC). https://pmc.ncbi.nlm.nih.gov/articles/PMC4909790/
21. Peesapati S.T. et al., "Pensieve: Supporting Everyday Reminiscence," CHI 2010 (Cornell PDF).
    https://www.cs.cornell.edu/~danco/research/papers/peesapati-pensieve-chi2010.pdf
22. Fang J. et al., "Reconstruction and Reflection of Positive Experiences through Resurfacing
    Laughter-indexed Everyday Moments," arXiv, Sep 2026. https://arxiv.org/abs/2609.12642
23. Umejima K. et al., "Paper Notebooks vs. Mobile Devices," Frontiers in Behavioral Neuroscience, 2021.
    https://www.frontiersin.org/articles/10.3389/fnbeh.2021.634158/full
24. Morehead K., Dunlosky J., Rawson K.A., 2019 (ERIC record). https://eric.ed.gov/?id=EJ1225471
25. Keeping Watch repo: `x4/README.md` (log format), `journal/daypage.mjs` (blocks), bridge format brief.
