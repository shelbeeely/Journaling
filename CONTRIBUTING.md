# Contributing

Journalwright Studio is a system for designing and publishing physical journals and planners. The public research docs (the methods library, published at `/docs/` on the site) are written so that anyone can correct, extend and add to them. You do not need to write code, and you can start from a browser.

## Licence (placeholder, not yet decided)

> **Licence to be confirmed.** The docs have no licence chosen yet. **CC BY-SA 4.0 is proposed** (credit the authors, share changes under the same licence), **pending the owner's confirmation**. Until that is confirmed, treat contributions as offered for inclusion under the licence the owner picks, and do not copy text in from anywhere that does not allow it. This section will be replaced when the decision is made. Code and other files in the repository are not covered by this note.

## Ways to help

| I want to | Do this |
|---|---|
| Suggest a method that is missing | [Open the "Suggest a method" form](https://github.com/shelbeeely/Journaling/issues/new?template=suggest-a-method.yml) |
| Fix a wrong or out-of-date fact | [Open the "Correct a fact" form](https://github.com/shelbeeely/Journaling/issues/new?template=correct-a-fact.yml) |
| Add or replace a source | [Open the "Add or replace a source" form](https://github.com/shelbeeely/Journaling/issues/new?template=add-a-source.yml) |
| Edit a doc myself | Use "Improve this page" at the top of any doc on the site, or edit the file in `docs/journaling/methods/` and open a pull request |
| Write a new doc | Copy [`docs/journaling/methods/TEMPLATE.md`](docs/journaling/methods/TEMPLATE.md) and open a pull request |

No GitHub account? Tell us through whoever shared the site with you; a form for signed-in and guest users is planned.

## Writing a doc

1. Copy `docs/journaling/methods/TEMPLATE.md` to `docs/journaling/methods/<slug>.md`. The slug is lowercase words joined by hyphens and must match the file name.
2. Fill in the front matter: `title`, `slug`, `category`, `evidenceLevel`, `lastReviewed`, `status` and `contributors`. The allowed values are listed in the template. Use `status: draft` for a new doc; a reviewer sets `reviewed`.
3. Keep all 28 numbered sections, in order. If one truly has nothing, say "Not applicable" and why.
4. Run the lint: `node site/tools/lint-docs.mjs`. To see the site: `site/build.sh` (needs the editor setup in `SETUP.md`), or just `node site/tools/build-docs.mjs site/_out` to build the docs alone.

### Standards

- **Every claim has a source**, and you opened the source yourself. List it in section 28 with title, author or publisher, date and URL, and say when you checked ("All checked 2026-09-28.").
- **Health claims** come from peer-reviewed or clinical sources. Say what the study actually found and in whom. No medical advice and no treatment instructions.
- **Evidence level is honest.** `strong` needs several controlled trials or systematic reviews. `some` is a few studies or good evidence for a close relative. `anecdotal` is practitioner reports. `none` means no research on the method itself. Say why in section 16.
- **Sensitive topics** (self-harm, suicide, eating disorders, medication, trauma): careful, plain framing; point to professional help and crisis lines; no instructions for harm, dosing or restriction.
- **Accessibility section is required** (section 19): concrete adaptations for vision, motor, cognitive, sensory, energy and time limits.
- **No personal content.** No real names of private people, no personal health details, no home locations, no calendars or account details. Examples use invented sample content. The lint and the site build fail on personal strings.
- **Your own words.** Do not paste text from books, articles or other sites. Short quotes with a citation are fine.
- **Calm, plain writing.** Short sentences, no hype, no medical or productivity promises.

## Review

A reviewer checks, in this order: the sources open and say what the doc says; the evidence level is honest; health claims cite peer-reviewed or clinical sources; there is no personal data; the accessibility section is real; nothing is copied. Then they set `status: reviewed` and update `lastReviewed`. CI must be green (the doc lint and the site build).

## Corrections

If a doc is wrong, fix it or open the "Correct a fact" form. The visible "Last reviewed" date on each doc changes only when a person has re-checked the sources. The git history of the file is its change log.

## The contributors page

Credit in `contributors` is given with your consent. The Contributors page on the site (`/docs/contributors/`) is generated from that front matter. Ask to be renamed or removed at any time.

## Conduct

Be kind and specific. Disagree about sources, not people. Do not post anyone's personal information, and do not ask for medical advice in issues.

## Code contributions

Read `CLAUDE.md`, `README.md` and `HANDOFF.md` first; the checks listed there apply (`cd journal && ./build-all.sh`, the editor tests, `site/build.sh`). Privacy rules matter most: no calendars, private pages or profile secrets in commits.
