# Write a content pack

A pack is a folder of data that a book reads: a region's support numbers, a transit feed, a list of holidays, a table of seasons. The engine holds
nothing regional; a pack does. Packs are data, never code: nothing in a pack runs.

    journal/packs/
      kinds.mjs        the registry: every kind of pack, one entry each
      pack.mjs         the manifest schema and the loader every reader goes through
      generic/         ships with the engine
      _template/       one starter folder per kind (what `packs-cli new` copies)
      <your-pack>/     pack.json + your files

## 1. Quick start

    cd journal
    node packs-cli.mjs new support my-town        # copies packs/_template/support/ to packs/my-town/
    # edit packs/my-town/support.json
    node packs-cli.mjs seal my-town               # records the sha256 of each file in pack.json
    node packs-cli.mjs check my-town              # every check; fix what it reports
    # then in content/profile.json:   "paths": { "support": "my-town", ... }

A pack can live outside the repository: `--dir ~/my-packs/town` and name that folder in the profile (`"support": "/home/me/my-packs/town"`), or set
`KW_PACKS=/home/me/my-packs` so packs there are found by id. Pack folders are sealed: change a file, run `seal` again (the build stops with that
instruction if a file no longer matches its hash, so a reprint always uses exactly what you checked).

## 2. The manifest: `pack.json` (schema 1)

    {
     "schema": 1,
     "id": "my-town",                              lowercase words joined by dashes; the folder name must match
     "title": "My town",
     "version": "1.0.0",                           semantic version; change it when the content changes
     "kind": "region",                             see section 3
     "author": { "name": "Sam", "url": "" },
     "license": { "spdx": "CC0-1.0", "attribution": "", "commercialPrintOk": true },
     "engine": ">=1.0.0 <2.0.0",                   the engine versions it works with
     "region": "US-MN",                            optional
     "languages": ["en"],
     "verified": [ { "kind": "transit", "who": "...", "date": "2026-09-28", "source": "https://..." } ],
     "files": [ { "path": "support.json", "sha256": "..." } ]     written by `seal`
    }

- **Licence.** Every pack states one: an SPDX id (`CC0-1.0`, `CC-BY-4.0`) or `LicenseRef-...` for your own terms, the credit line to print, and
  whether the pack may appear in a book that is sold (`commercialPrintOk`). A profile with `book.for_sale: true` refuses a pack with `false`.
- **Verification records.** `verified` holds `{item or kind, who, date, source}` records. An `item` record covers one item by id; a `kind` record covers
  everything of that kind that has no note of its own. Items can also carry their own note (next section), which is better for phone numbers.
- **Files.** `seal` lists every file in the folder except `pack.json`. The build and `check` fail if a listed file is missing or changed.
- **Size limits** are per kind (a support pack may be 200 KB a file; a transit feed 8 MB). `check` reports them.
- **Privacy class.** `personal` (contacts and support numbers: never in a Studio snapshot or a fork) or `public`. The kind sets it; a pack may add
  `"privacy": "personal"` to make itself more private, never less.

## 3. Kinds

| Kind | Holds | File | Class |
| --- | --- | --- | --- |
| `support` | Support and crisis resources | `support.json` | personal |
| `trans-support` | Trans and LGBTQ+ resources | `trans.json` | personal |
| `clinic` | Your clinic's contacts | `clinic.json` | personal |
| `transit` | A transit agency's schedules | `gtfs/network.json` | public |
| `holidays` | Extra holidays and observances | `holidays.json` | public |
| `seasons-history` | The 72 micro-seasons and the research behind them | `seasons.json` | public |
| `region` | A bundle of any of the above for one place | the files above | personal |

`node packs-cli.mjs kinds` prints each kind's data format, how the build uses it and its print rules. A `region` pack is the usual shape: one folder with
the parts you have. In the profile each key reads the part of its own kind: `paths.support`, `paths.trans`, `paths.clinic`, `paths.transit`,
`paths.seasons`, `paths.holidays` (a value is a pack id or a folder; use `null` for none).

### Support, trans support and clinic

    { "sections": [ { "title": "Right now, any hour", "items": [
        { "id": "my-line", "name": "My regional crisis line", "text": "Call <b>555-0100</b>, 24/7.", "chips": "CALL TEXT",
          "verified": { "who": "Sam", "date": "2026-09-28", "source": "https://the-organisation.example/contact" } } ] } ] }

`chips` are any of TEXT CALL CHAT EMAIL VISIT ONLINE. A little HTML (`<b>`, `&amp;`) is allowed in `text`. A clinic file is
`{ name, address, checked, lines: [...] }` with the same items.

### Transit

`gtfs/network.json` is a compact summary of an agency's GTFS feed (`feed_version`, `valid_from` and `valid_to` as `YYYYMMDD`, `months`, `routes`). The
build prints schedules only inside those dates and says so on the page when a month is only partly covered. Build it from the agency's own feed
with a script of your own and keep it in `gtfs/`; `check` warns when the feed has ended. Profile `transit` names the agency, its site and app.

### Holidays

    { "observances": [ { "month": 11, "day": 20, "name": "A fixed date" }, { "month": 11, "nth": { "weekday": 4, "n": 4 }, "name": "4th Thursday" } ] }

`weekday` is 0 (Sunday) to 6; `n` is 1 to 5, or -1 for the last. They are added to the built-in US list.

### Seasons

`seasons.json`: `{ "seasons": { "1": [name, note], ... "72": [name, note] }, "history": "research/file.json" }`, one entry for each of the 72 micro-seasons,
keyed by where the sun is (so they repeat every year). `history` is optional: the research behind the table, each season with a `source_url`.

## 4. Verification: the rule for support pages

Support numbers are the one place a wrong answer can hurt. The build **refuses to print** a pack's support, trans support or clinic pages when any
item has none of:

1. a **verification note**: `"verified": { "who", "date" (YYYY-MM-DD), "source" }`. Check the organisation's own page or call them. Never a
   third-party listing. Write down who did it and when.
2. `"placeholder": true`: the item is a stand-in. The page prints its text, or "Add your local numbers here." if it has none.
3. `"verified": false` together with `"checkBeforePrinting": true` (and `"check": "hours"` to say what): your own decision to print something you could not confirm.
   The build prints it, and warns with a list of every such item each time. Use it only for a book that is yours alone, and call before you print.

Anything else stops the build with the list of items and what each needs. Nothing is ever filled in for you, in any region.
`node packs-cli.mjs check <pack>` runs the same rule, so you find out before a build does.

## 5. Checks and tests

`check` runs, in order: the manifest (schema, id, version, licence, engine range), file hashes, size limits, the privacy class, and then the kind's
own validator and print rules. It exits 1 on any error. `node test-packs.mjs` (CI) tests the registry, the manifest, the hashes, the
verification rule, and builds the `generic` pack.

## 6. Packs and sharing

- Every build writes `manifest.json` with the pack id, version, hash, licence and credit for each pack used, so a reprint is reproducible and the credits are there (a Credits page is not built yet).
- A Studio snapshot (versions, forks, proposals) may list a **public** pack by reference only: `{id, kind, version, sha256}` in `meta.packs`. A **personal** pack is
  refused, as a reference or as content, and a pack's files never travel. Whoever builds the book supplies their own packs.

## 7. Add a pack kind

A kind is one entry in `packs/kinds.mjs`. To add one:

1. Add an entry to `KINDS` with:
   - `title`, `privacy` (`public` or `personal`), `file` (its data file, relative to the pack), `limits` (`maxFileBytes`, `maxTotalBytes`);
   - `schema`, `consumedBy` and `print`: one plain sentence each (they are what `packs-cli kinds` prints and what this page is built from);
   - `validate(data, ctx)` returning `{ errors, warnings }`; `gate(data, ctx)` returning `{ refuse, warn }` only if the kind needs a print gate (crisis data does);
   - `consume(data, ctx)` returning what the build reads.
2. Add a profile key: `PROFILE_KEYS` in `kinds.mjs` (the key in `paths`), and in `profile.mjs` nothing else: `readContent(key)` and `packFile(key)` already read through the loader.
3. Add the code that uses it (for regional data: the page builder or data module that reads `readContent(key)`).
4. Add a starter folder `packs/_template/<kind>/` with a `pack.json` and a passing data file. `node test-packs.mjs` fails until every kind has one that passes `check`.
5. Decide its privacy class honestly: anything that names a person, a home, a contact or a support line is `personal`, which keeps it out of every
   Studio snapshot and fork (`studio/src/snapshot.mjs` reads the class from this registry).
6. Add a row to the table in section 3.

Planned kinds (themes, fonts, icon and graphics packs, declarative block packs, language and prompt packs, starter kits) are in BUILD-PLAN section 20; they
use the same manifest and the same registry.
