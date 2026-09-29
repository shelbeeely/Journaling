# Journalwright Studio: versions and collaboration (Phase G1)

Projects, named versions (commits), branches and autosaved drafts for journal books. The editor's **Versions** view is the way people
see history: nobody needs Git. Single-user builds keep working untouched; existing files import into a project and export back into the
current print pipeline.

G1 is the core: accounts, permissions, immutable history, restore, import/export, the API and the editor's Versions view.
Forks, proposals, merges, releases and component adoption are G2/G3 (the schema already has room for them, see the end).

## Run it locally (one command)

    cd studio && npm start          # Node 22.13+; nothing to install (SQLite is built in)

Opens the API and, if the editor is built (`cd journal && node render.mjs month 2026-10 test.ics && node editor/build.mjs`), the editor
too, at <http://127.0.0.1:8787/>. Open the **Versions** view, create an account, then **New project from this page**.

    npm test                        # 39 tests: history, immutability, conflicts, privacy, permissions, print

Settings (environment): `STUDIO_DB` (default `studio/data/studio.db`), `PORT` (8787), `HOST` (127.0.0.1), `STUDIO_STATIC` (folder to serve),
`STUDIO_CORS` (comma list of origins when the editor is hosted elsewhere, e.g. the GitHub Pages site), `STUDIO_REGISTRATION=closed`.
The editor on GitHub Pages can also connect: type the server address into the Versions sign-in card (and set `STUDIO_CORS`).
A Claude Artifact usually cannot call an outside server, so there the Versions view only shows the sign-in card.

## Migration path from the single-user files

    node bin/studio.mjs user add shelbee                                   # password from STUDIO_PASSWORD or prompted
    node bin/studio.mjs import ../journal --user shelbee                   # content/book.json + daypage.json + safe profile fields -> a private project
    node bin/studio.mjs export --user shelbee --project keeping-watch      # a commit -> journal/content/book.json + daypage.json (--ref <branch|commit>, --out <dir>)

The build pipeline is unchanged: `render.mjs` still reads `content/book.json` and `content/daypage.json`. Export writes those two files and
nothing else (never `profile.json`, the packs or the calendars). A missing `daypage.json` imports as the default layout, exactly as the
renderer reads it. Round trip proof (`test/print.test.mjs`): import the default project, export it, render both sizes: every page's HTML,
the page order, ids and scan codes are byte-identical, and `journal/check-identical.mjs` agrees (it now also treats a `daypage.json` that
says exactly the default layout as "not custom").

## What a project snapshot contains (the forkable publication source)

    meta        title, subtitle, slug, description
    print       trim, edition, first month, day-start hour, hardcover, module switches
    book        content/book.json: the page structure, stable page ids
    day         content/daypage.json: block layout, stable block uids
    assets      [{name, hash, mime, size}]: images and fonts, bytes stored by hash
    components  reusable pages [{id, name, version, page}] (reserved for G3, empty in G1)

**Never** in a snapshot: private pages, filled-in personal data, account settings, profile secrets (person, place, coordinates, crisis lines,
file paths), calendars (.ics, `ICS_URLS`), the support/trans/clinic packs, passwords, tokens, recovery codes. Two layers (`src/snapshot.mjs`):

1. **Allowlist serializer.** Only the fields above are copied, each validated (the book by `journal/book.mjs`, the day by `daypage.mjs`
   `normalize`, blocks cut down to their declared options). Unknown top-level parts and meta/print fields are refused with a message.
2. **Scanner.** Anything submitted (and the result) is scanned at any depth: forbidden keys (`password`, `token`, `ics`, `person`,
   `location`, `support`, `clinic`, `profile`, `account`, `entries`, ... whatever the spelling), forbidden paths (`private/`, `.ics`,
   `content/support.json`, `.env`, keys) and forbidden values (calendar data, private keys, GitHub tokens, email addresses). A hit is a
   422 that names where. Commit messages and asset names are scanned too; SVG assets with scripts are refused.

From a profile only `book.title/subtitle/slug/edition/start`, `trim`, `day_start_hour` and the module switches cross (`publishableProfile`).

## Data model

    users ──< memberships >── projects ──< branches ──> commits ──> objects (tree) ──> objects (meta, print, book, day, assets, components)
      │            role: owner|editor|viewer     │  visibility private|public            ▲ parents[] (0, 1, or 2 in G2) ──┘ (self)
      │                                          │  allow_reuse (G2)                      │
      ├──< sessions (token hash)                 ├──< project_commits >── commits         │ commits/objects are global and immutable
      ├──< drafts (user + branch)  base ──> commits, rev (optimistic concurrency), snapshot
      │                                          ├──< assets (project + sha256, bytes, access-checked)
      │                                          ├──< components ──< component_versions ──> objects   (G3, unused)
      │                                          └── source_project_id, source_commit_id             (G2, unused)

- **objects**: content-addressed. `hash = sha256(kind + canonical JSON)`. A commit's *tree* lists its six parts, so a commit that only
  changes the day layout shares every other object with its parent. Rows are never updated or deleted (SQL triggers refuse it).
- **commits**: `id = sha256(canonical {tree, parents, author{id,name}, message, timestamp})`. Immutable (triggers). `parents` is an array.
  Reading a snapshot re-hashes every object, so tampering is detected (`GET .../commits/:id/verify`).
- **project_commits**: which commits a project holds (a fork will share commit ids; G2).
- **branches**: name to head commit, per project. **drafts**: one per user and branch, separate from history; `base` is the commit it started
  from, `rev` counts saves. **assets**: per project, addressed by sha256, read only through checked routes.
- Stable ids are kept end to end: page ids (`book`) and block uids (`day`) survive every commit, so diffs and (in G2) merges work by id.

Migrations live in `migrations/NNN_name.sql`, applied in order and recorded in `schema_migrations` on every start.

## Rules the server enforces

| Rule | How |
| --- | --- |
| No silent overwrite | `POST /commits` needs `expectedHead`. If the branch moved: **409 `head_moved`**, nothing written, reply names the new head |
| Drafts | `PUT` needs the `rev` you last saw (**409 `draft_conflict`**); promoting needs the branch still at the draft's `base` (**409 `head_moved`**); a conflict never deletes the draft |
| History is never rewritten | Restore = a new commit with an old commit's content. Branch delete leaves the commits |
| Transactions | Every write is one `BEGIN IMMEDIATE` transaction (a failed commit stores nothing) |
| Access, checked in `src/repo.mjs` on every call | Private project: non-members get **404** on everything (existence is not revealed), including assets. Public: anyone reads; writes need a role (**403**, or **401** signed out). viewer reads; editor commits, branches, drafts, uploads; owner also changes settings, members, deletes. The last owner cannot leave |
| Accounts | Local. `scrypt` (N=16384) per-user salt; random 256-bit session tokens, stored only as sha256, 30 days; login throttled after 8 failures; no third-party service |

## API (JSON; `Authorization: Bearer <token>`)

    GET  /api/health                              POST /api/auth/register {username, password, displayName}
    GET  /api/me                                  POST /api/auth/login {username, password} -> {token, user}    POST /api/auth/logout

    GET  /api/projects[?public=1]                 POST /api/projects {name, description, visibility, allowReuse, snapshot?, message?}
    GET|PATCH|DELETE /api/projects/:id            (PATCH: name, description, visibility, allowReuse: owner)
    GET  /api/projects/:id/members                PUT|DELETE /api/projects/:id/members/:username {role}

    GET  /api/projects/:id/head[?branch=]         -> {commit, snapshot}
    GET  /api/projects/:id/commits/:idOrPrefix    -> {commit, snapshot}       GET .../commits/:id/verify -> {ok}
    POST /api/projects/:id/commits {branch, expectedHead, message, snapshot}  (partial snapshot: parts left out are kept) -> 201 | 200 unchanged | 409
    GET  /api/projects/:id/log[?branch=&limit=]   GET .../diff?from=<branch|commit>&to=<branch|commit>
    POST /api/projects/:id/restore {commit, branch, expectedHead, message?}   -> a new commit

    GET|POST /api/projects/:id/branches {name, from?}     GET|DELETE .../branches/:name    (GET = switch: that branch's head + snapshot)
    GET|PUT|DELETE /api/projects/:id/drafts/:branch       PUT {base?, rev, snapshot}
    POST /api/projects/:id/drafts/:branch/promote {message, expectedHead?}    -> a commit, draft removed
    GET|POST /api/projects/:id/assets                     POST: raw bytes, Content-Type, X-Asset-Name        GET .../assets/:sha256

The diff (`src/diff.mjs`, also inlined into the editor) reports `added`, `removed`, `moved`, `changed[{key,before,after}]` for **book pages by
page id** (including the month/week lists and per-month overrides) and **day blocks by uid** (care rows by row id), plus meta, print, assets
and components. Moves are minimal (only the items that changed order).

## The editor's Versions view

`journal/editor/template.html` (site build and Artifact build; with no server it is a sign-in card and the editor is exactly as before):
history cards (author, message, time, short hash), **Compare** (two real day pages drawn by the print renderers with changed blocks marked
New / Changed / Moved / Removed, a list of the changes in words, book page changes with thumbnails), **Restore** (as a new version),
branch create and switch, **Save version** with a message, and a state line: *Saved as a version* / *Draft autosaved 9:00 AM* / *Branch
moved: your draft is kept*. When the branch moved under you: see what they changed, keep yours as a new branch, or start from theirs.
Edits autosave to the draft after a second; nothing becomes history until you save a version. 44px targets, light and dark, no sideways
scroll at 390px. The editor edits the day layout; the book structure travels with each commit unchanged (the Book view is still read-only).

## Tests (`npm test`, sample data only)

| File | Proves |
| --- | --- |
| `snapshot.test.mjs` | allowlist and scanner (keys, paths, values, nesting), profile safe fields, hashing |
| `repo.test.mjs` | ancestry and hashing, immutability (SQL), tamper detection, 409 conflicts, rollback, restore, branches, drafts, diff by id, assets |
| `api.test.mjs` | auth, throttle, full HTTP session, non-member 404 on every route, roles, public read, asset access, CORS |
| `print.test.mjs` | import/export, byte-identical books and `check-identical.mjs`, edit in editor state, commit, export, render, `check.mjs` "[] 0" |
| `ui.test.mjs` | the Versions view in a browser: sign in, draft, save, conflict, compare, restore, branch, book compare, phone, dark; screens in `journal/editor/dist/test/studio-*.png` |

`print.test.mjs` and `ui.test.mjs` need `npm ci` in `journal/` and Chromium (and, for the UI test, the built editor); they skip otherwise.
CI runs everything in the Books workflow (before the Build step).

## Limitations (G1)

- No email, password reset or invitations: an owner adds a member by username; a lost password needs a database edit.
- Sessions and the login throttle: tokens live in the browser's storage; the throttle is per process.
- The editor edits the day layout only; book structure changes come from `content/book.json` (import) or the API until the Book view can edit.
- Assets can be stored, listed, served and committed, but the editor has no image picker yet.
- Objects of deleted projects and abandoned drafts are not garbage collected.
- One SQLite file, one process: fine for a person or a small team, not a hosted multi-tenant service. No rate limits beyond login.
- Serve it behind HTTPS if it leaves your machine (tokens are bearer tokens). Never a default to any one host.

## Designed for G2/G3 (not built)

`commits.parents` is an array (merges have two); `projects.source_project_id/source_commit_id` and `commits.source_*` record a fork's origin;
`allow_reuse` is the creator's consent switch; `project_commits` lets a fork share history; `components` + `component_versions` hold
reusable pages with numbered versions; stable page/block ids are what a three-way merge and a proposal diff key on; `objects` can hold
release manifests. Nothing reads these columns yet.
