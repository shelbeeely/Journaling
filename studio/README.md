# Journalwright Studio: versions and collaboration (Phases G1 and G2)

Projects, named versions (commits), branches and autosaved drafts for journal books. The editor's **Versions** view is the way people
see history: nobody needs Git. Single-user builds keep working untouched; existing files import into a project and export back into the
current print pipeline.

G1 is the core: accounts, permissions, immutable history, restore, import/export, the API and the editor's Versions drawer.
**G2 (this document, from "Forks, proposals and merges") adds forks, change proposals, three-way merges and the conflict resolver.**
Releases and reusable-page adoption are G3 (the schema already has room for them, see the end).

## Run it locally (one command)

    cd studio && npm start          # Node 22.13+; nothing to install (SQLite is built in)

Opens the API and, if the editor is built (`cd journal && node render.mjs month 2026-10 test.ics && node editor/build.mjs`), the editor
too, at <http://127.0.0.1:8787/>. Tap **Versions** in the editor's header, create an account, then **Move it to my account** (or pick **New project on my account**).

    npm test                        # history, immutability, conflicts, privacy, permissions, print, forks, proposals, merges

Settings (environment): `STUDIO_DB` (default `studio/data/studio.db`), `PORT` (8787), `HOST` (127.0.0.1), `STUDIO_STATIC` (folder to serve),
`STUDIO_CORS` (comma list of origins when the editor is hosted elsewhere, e.g. the GitHub Pages site), `STUDIO_REGISTRATION=closed`.
The editor on GitHub Pages can also connect: type the server address into the Versions sign-in card (and set `STUDIO_CORS`).
A Claude Artifact usually cannot call an outside server, so there the Versions drawer keeps versions in the browser only (guest mode).

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

**Library (L1a, additive).** `meta.library` holds the whole library: `books`, `series`, `layouts` (each a `book` page structure and a `day`
layout), `defaultBook` (see `journal/library.mjs`, `journal/README.md` "Library"). It rides inside `meta` on purpose: no schema change, no new
object kind, and a snapshot without it hashes exactly as before. Rules: the serializer copies allowlisted book, series and layout fields only
(the scanner has already refused person, location, packs, calendars and paths by name); a `meta` sent without `library` keeps the stored one
(`library: null` drops it); the diff reports it apart from meta, by book, series and layout id (`diff.library`, `summary.library`).
**Migration:** an existing project is a library of one book without writing anything (`libraryOf(snapshot)`); `node bin/studio.mjs library init
--user u --project p` saves it as a commit. **Export for a book:** `export --book <id>` writes `content/library.json` (layouts inline, that
book as `defaultBook`) next to the project's own `book.json` and `daypage.json`; `KW_BOOK=<id>` builds any other. For G2: merging treats
`meta.library` as one value (a same-field conflict is reported, never lost); per-book and per-series merging by id is a follow-up.

**Never** in a snapshot: private pages, filled-in personal data, account settings, profile secrets (person, place, coordinates, crisis lines,
file paths), calendars (.ics, `ICS_URLS`), the support/trans/clinic packs and any other personal pack, passwords, tokens, recovery codes.
Content packs (`journal/packs/`, PACKS.md) travel **by reference only**, and only public ones: `meta.packs` is a list of `{id, kind, version, sha256}`
(additive, like the library: a snapshot without it hashes as before). A pack's files never appear in a snapshot; a personal pack (its kind's privacy class
in `journal/packs/kinds.mjs`: support, trans-support, clinic, and region bundles) is refused as a reference too, so forks and proposals never carry one. Two layers (`src/snapshot.mjs`):

1. **Allowlist serializer.** Only the fields above are copied, each validated (the book by `journal/book.mjs`, the day by `daypage.mjs`
   `normalize`, blocks cut down to their declared options). Unknown top-level parts and meta/print fields are refused with a message.
2. **Scanner.** Anything submitted (and the result) is scanned at any depth: forbidden keys (`password`, `token`, `ics`, `person`,
   `location`, `support`, `clinic`, `profile`, `account`, `entries`, ... whatever the spelling), forbidden paths (`private/`, `.ics`,
   `content/support.json`, `.env`, keys) and forbidden values (calendar data, private keys, GitHub tokens, email addresses). A hit is a
   422 that names where. Commit messages and asset names are scanned too; SVG assets with scripts are refused.

From a profile only `book.title/subtitle/slug/edition/start`, `trim`, `day_start_hour` and the module switches cross (`publishableProfile`).

## Data model

    users ──< memberships >── projects ──< branches ──> commits ──> objects (tree) ──> objects (meta, print, book, day, assets, components)
      │            role: owner|editor|viewer     │  visibility private|public            ▲ parents[] (0, 1, or 2 for a merge) ──┘ (self)
      │                                          │  allow_reuse, license, credit          │
      ├──< sessions (token hash)                 ├──< project_commits >── commits         │ commits/objects are global and immutable
      ├──< drafts (user + branch)  base ──> commits, rev (optimistic concurrency), snapshot
      │                                          ├──< assets (project + sha256, bytes, access-checked)
      │                                          ├──< components ──< component_versions ──> objects   (G3, unused)
      │                                          ├── source_project_id, source_commit_id, attribution   (a fork)
      │                                          └──< proposals ──< proposal_events, proposal_accepts   (G2)

- **objects**: content-addressed. `hash = sha256(kind + canonical JSON)`. A commit's *tree* lists its six parts, so a commit that only
  changes the day layout shares every other object with its parent. Rows are never updated or deleted (SQL triggers refuse it).
- **commits**: `id = sha256(canonical {tree, parents, author{id,name}, message, timestamp})`. Immutable (triggers). `parents` is an array.
  Reading a snapshot re-hashes every object, so tampering is detected (`GET .../commits/:id/verify`).
- **project_commits**: which commits a project holds (a fork shares commit ids with its source).
- **branches**: name to head commit, per project. **drafts**: one per user and branch, separate from history; `base` is the commit it started
  from, `rev` counts saves. **assets**: per project, addressed by sha256, read only through checked routes.
- Stable ids are kept end to end: page ids (`book`) and block uids (`day`) survive every commit, so diffs and (in G2) merges work by id.

G2 adds (migration `002_collab.sql`): `projects.license`, `projects.credit`, `projects.attribution` (JSON, written once when a project is forked,
never updated), `proposals`, `proposal_events` (the discussion and audit trail, append-only: an SQL trigger refuses updates) and
`proposal_accepts` (which changes were accepted one by one). Nothing else changed: a fork is an ordinary project whose
`source_project_id` / `source_commit_id` are set.

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

    G2  GET|POST /api/projects/:id/forks                  POST {name?, visibility?, allowReuse?, commit?} -> 201 the fork (with attribution)
        GET|POST /api/projects/:id/proposals[?status=]    POST {sourceProject?, sourceBranch, targetBranch?, title, description?}
        GET  .../proposals/:n                             the proposal, its discussion, the accepted keys, and proposal.can (what you may do)
        GET  .../proposals/:n/compare                     base/ours/theirs commits and snapshots, changes[], diff, merge preview {clean, conflicts}
        POST .../proposals/:n/comments {body}             POST .../reviews {state: approved|changes_requested|comment, body}
        POST .../proposals/:n/status {status: closed|open}
        POST .../proposals/:n/accept {items, expectedHeads, resolutions?}     one new commit, one parent
        POST .../proposals/:n/merge  {expectedHeads, resolutions?, message?}  a merge commit, two parents
        POST /api/projects/:id/merge/preview {into?, from: {project?, ref}}   POST /api/projects/:id/merge {into?, from, expectedHeads, resolutions?}

    N2  GET|POST /api/devices                             POST {name, server?} -> 201 {device, token, syncTxt}: the token is in this answer ONLY
        POST /api/devices/:id/revoke                      GET .../:id/audit   GET .../:id/logs (months, sizes)   GET .../:id/logs/:YYYY-MM (the CSV, owner only)
        DELETE /api/devices/:id/logs[?month=YYYY-MM]      delete what a device sent
        GET  /api/device/info                             device token: its name and the month logs it has sent {month, size}
        POST /api/device/log/:YYYY-MM                     device token, header X-Offset: bytes, body: text (at most 16 KB): appends at EXACTLY the stored size, else 409 {details.size}

The diff (`src/diff.mjs`, also inlined into the editor) reports `added`, `removed`, `moved`, `changed[{key,before,after}]` for **book pages by
page id** (including the month/week lists and per-month overrides) and **day blocks by uid** (care rows by row id), plus meta, print, assets
and components. Moves are minimal (only the items that changed order).

## X4 device sync (N2): device tokens and the private check-in log

A signed-in user adds a device (their X4). The token (`kwd_<id>_<43 random chars>`) is shown **once**; only its sha256 is stored. It is a different credential from a sign-in: it is
accepted on `/api/device/*` only (a device token reads nothing else, and a session token does not work there), it belongs to one account (another account's device does not exist for you: 404),
it can be revoked at once (a revoked, wrong, malformed or unknown token all get the same `401 device_token`), and it has one scope, `log:write`.
Limits (`src/devices.mjs` LIMITS): 120 requests per 10 minutes per token, 20 wrong tokens per 10 minutes per address (then 429 with `Retry-After`, even for a good token from that address; behind a reverse proxy
every client shares the proxy's address, so that limit is shared), 16 KB per request, 2 MB per month, 16 MB and 36 months per device, 10 active devices per account. The audit trail (`created`, `upload month +bytes`,
`rejected`, `revoked`, `logs_deleted`) holds no log content, token or address.

**The log is private.** Uploads land in `device_logs` (migration 003), apart from `objects` (the snapshot store): never in a project, commit, snapshot, fork, proposal or export, and readable only by the owner, as an
attachment with `Cache-Control: no-store`. `snapshot.mjs` refuses it anyway if anyone tries to put it there: the keys `log`, `logs`, `checkins`, `device(s)`, `deviceLog`, paths such as `kw/log`, `kw/sync`, `sync.txt` and `YYYY-MM.csv`,
a `kwd_` token, and check-in log lines are all forbidden content. The device's side of the protocol and its X4 setup are in `x4/README.md`, "Sync with your Studio". Tests: `test/devices.test.mjs`.
Not built yet: a Studio screen for devices (the API is complete), pairing by a short code shown on the X4, and the X4 reading anything back (down-sync is N3).

## The editor's Versions drawer (guests and accounts)

`journal/editor/versions.{html,css,js}` (inlined by `editor/build.mjs` into the site build and the Artifact build). It is a **drawer opened by
a button in the header**, so it is reachable from every view (Day, Book, and whatever levels the book-first editor adds); it does not
assume any tab.

| Who | What they get |
| --- | --- |
| **Guest** (no account, or no server at all) | The editor as it always was, plus **versions kept in this browser**: save a named version, history, compare, restore (as a new version). Nothing is uploaded. The drawer says "Sign in to save versions" |
| Guest, with a Studio server reachable | Also the **public projects** on it: read their history and compare versions (read only; the guest's own page in the editor is never replaced) |
| **Account** | Server projects: named versions, branches, autosaved drafts, restore, conflicts, private projects, sharing. **Signing in uploads nothing and replaces nothing**: it stays on "This browser" until you pick a project. **Move it to my account** turns this browser's project (and, if you tick it, its saved versions) into an account project in one step |

History cards show author, message, time and short hash. **Compare** draws two real day pages with the print renderers, changed blocks marked
New / Changed / Moved / Removed, lists the changes in words, and (for server projects) lists book-page changes with thumbnails. State line:
*Saved as a version* / *Draft autosaved 9:00 AM* / *Branch moved: your draft is kept*. When the branch moved under you: see what they changed,
keep yours as a new branch, or start from theirs. Edits to a project autosave to your draft after a second; nothing becomes history until
you save a version. 44px targets, light and dark, no sideways scroll at 390px. The editor edits the day layout (flow or grid); the book
structure travels with each commit unchanged (the Book view is still read-only), and this browser's local versions hold the day layout only.

## Forks, proposals and merges (Phase G2)

### Forks

`POST /api/projects/:id/forks {name?, visibility?, allowReuse?, commit?}` makes a copy that has **its own history, branches, drafts, members
and settings** and **credits the original**.

- **Consent.** Only when the creator set `allowReuse` (owners too: it is the project's switch, not a role). The project must be readable by the
  caller (public, or a member of a private one, even a viewer); a private project answers 404 to everyone else. Guests get 401.
- **Records.** `source_project_id` and `source_commit_id` on the fork; the fork's first commits are the source's commits (commits are global
  and immutable, the fork *links* them in `project_commits`), so history is shared up to the fork point and independent after it. That shared
  ancestry is what makes a later merge base exist.
- **Attribution** is stored once in `projects.attribution` and cannot be edited through any route: source project (id, slug, name), forked
  commit, the creator's name, the license and credit text as they were at fork time, every author in the copied history, and a `lineage` list
  when the source is itself a fork. The fork also starts with the source's `license`; the fork's owner may change their own terms, never the attribution.
- **Only the published line.** Only versions reachable from the source's default branch can be forked (`commit` picks an older one). Another
  branch of the source is never linked, listed or readable through the fork.
- **Forbidden content never crosses.** Every version being forked is read again and must be *exactly* a publication source: the G1 scanner
  finds nothing (forbidden keys, paths and values at any depth) and the allowlist serializer would produce the same fields (an unknown
  field such as `diary` is refused too). If any version fails, the fork is refused with `422 not_forkable`, nothing is created, and nothing is
  linked. Test: the source's private branch, and separately its published line, are given personal data directly in the database
  (bypassing the serializer); the fork never receives the branch and is refused for the line. Drafts, members, sessions, settings and
  unreferenced assets are never copied; only the assets the copied versions use are.
- Forks of forks work; deleting the source leaves the fork with its stored attribution.

### Change proposals

A proposal lives in the **target** (upstream) project: source (a fork of it, or another branch of the same project) branch to target branch,
with a title, a description, a number, a status and a discussion.

| Status | Meaning |
| --- | --- |
| `open` | waiting for review |
| `changes_requested` | a reviewer asked for changes: merging and accepting are blocked until the source branch moves (which resets the status to `open`) or a reviewer approves |
| `approved` | approved for the version the reviewer saw; **a new commit on the source branch makes it `open` again** (`stale: true`), so an approval never covers code nobody read |
| `merged` | merged; keeps showing what it changed (from the merge commit's two parents) |
| `closed` | closed by its author or a reviewer; can be reopened |

`GET .../proposals/:n/compare` returns the merge base, the three snapshots (base, this branch, the proposal), the **change list**
(one key per page, per block, per list order and per setting: `block:<uid>`, `page:<scope>/<id>`, `order:<list>`, `meta:<field>`,
`print:<field>`, `asset:<name>`, `component:<id>`), the G1 diff (`diffSnapshots`, by id) and a merge preview with its conflicts. The editor
draws the day page before and after with the real block renderers, marks changed blocks, lists changed book pages with thumbnails, and
shows the same words as the Versions compare view.

**Accept selected changes** (`POST .../accept {items, expectedHeads, resolutions?}`): only the ticked keys are taken from the proposal
(the proposal's version is built from the merge base plus just those changes, then merged into the target like any merge). The result is **one
new commit on the target branch with one parent**; the proposal stays open, the accepted keys are marked, and merging the rest later meets no
conflict for what was accepted.

### Merging

`POST .../proposals/:n/merge`, or `POST /api/projects/:id/merge` for direct merges (another branch of the same project, or syncing a fork
from the project it was forked from; a fork is only ever merged *into* its source through a proposal). Body:
`{expectedHeads: {ours, theirs}, resolutions?, message?}`. The result is a **merge commit with two parents** `[ours, theirs]`. Everything is one
`BEGIN IMMEDIATE` transaction: nothing is written unless the whole merge is resolved, valid and clean.

**Merge base.** From the commit graph (`parents` arrays): the common ancestors of the two heads that are not ancestors of another common
ancestor. Usually one. A criss-cross history has several; they are folded into a *virtual base* by merging them (recursively, depth-limited,
conflicts taken from the first) as Git's recursive strategy does. No common ancestor is `422 no_common_ancestor`. After a merge, the merged-in
tip is the new base, so a second proposal only carries later work.

**Algorithm** (`src/merge.mjs`, a pure function of `(base, ours, theirs, resolutions)`):

1. Split each snapshot into items keyed by their **stable ids**: pages by page id (grouped in their scope: the default book, or a month's own list,
   with the weeks group's month and week lists), blocks by uid, care rows by row id, assets by name, components by id, settings by field.
2. Per item, compare with the base. Changed on one side only: that side wins. Changed on both: **merge field by field** (recursively into
   objects such as flags; lists and scalars are atomic), so a block's title on one side and its line count on the other both survive. Only the
   *same field* changed to two different values is a conflict.
3. Additions and deletions: added on one side, kept; deleted on both, gone; deleted on one and unchanged on the other, gone.
4. **Order** of each list: if only one side reordered the items every side still has, that order wins; if both reordered differently it is a
   `reorder` conflict. Items either side added take the place after the neighbour they had; two adds after the same neighbour: this branch's
   first, then the proposal's.
5. **Grid pages**: the merged page must obey the page-grid rules (`gridProblems`). Problems that neither side already had are a conflict.
6. The result is validated by the same serializer and scanner as every commit; a hand-made resolution with a forbidden field or a bad value
   is refused (422) and nothing is written.

### Conflict kinds

Each conflict has an `id` (stable, e.g. `block:actions`, `page:default/trip`, `meta.title`, `order:blocks`, `component:weekly`,
`layout:day`), a `kind`, a `label`, `base` / `ours` / `theirs` as the items were, `fields` (which fields differ, with their three values),
and what each choice would give: `ifOurs`, `ifTheirs` (`null` = the item is removed). "Ours" is the target branch; "theirs" is the proposal.

| Kind | When | Rule |
| --- | --- | --- |
| `edit_edit` | the same field of the same item, or the same setting, changed to two different values | other fields already merged; choose a side, or a manual value for the whole item |
| `add_add` | the same id added on both sides with different content, or two different blocks of a one-per-page type (Moon and sun, Writing space, ...) | choose one, or a manual item |
| `delete_edit` | deleted on one side, changed on the other | until resolved the *changed* item stays (nothing is lost); choose delete, keep, or a manual edit of the kept item |
| `reorder` | the same list reordered differently on both sides | choose an order (each includes both sides' added items), or a manual order that lists exactly the same items once each |
| `move_edit` | a grid block was moved or resized on one side and edited on the other and the merged page breaks a rule (overflows, overlaps, no room for its content) | choose a side's whole day layout; adjust in the editor afterwards |
| `layout` | two independent moves collide on the grid | as `move_edit` |
| `component` | a reusable component changed (or was added) on both sides | components are atomic; whichever choice, the resolved component gets a version above both sides' (`max + 1`), so adopters can tell it is newer. A component deleted on one side and changed on the other is a `delete_edit` |

Moves and edits that fit together are not conflicts: a block moved on one side and edited on the other merges, as long as the result is a
valid page. A page cannot change lists (each page type belongs to one list), so there is no cross-list move.

**Resolution API.** `resolutions: {"<conflict id>": {"choose": "ours" | "theirs" | "manual", "value": ...}}`, one entry per conflict.
Missing ones: `409 unresolved_conflicts` with the current conflicts in `error.details.conflicts`, nothing written. An entry for a conflict that
does not exist: `422 unknown_resolution`. A bad choice or a manual value of the wrong shape: `422 invalid_resolution`. `expectedHeads` must
equal the two branch tips you looked at, or `409 head_moved` (nothing written, the reply names the new tips). Resolving may reveal a new
conflict (a manual value that breaks the grid): the reply is again a 409 listing it, and your other choices still stand.

### The editor

In the **Versions** drawer of a project on a server: a **Fork** button (on a project that allows reuse; a guest is asked to sign in), a
credit line ("Forked from X by Y · License..."), and a **History | Proposals** switch. Proposals: the list (open count on the tab), **New
proposal** (from a fork to its source, or between branches of one project), the detail with the visual diff, tick boxes to **accept selected
changes**, the discussion (comment, approve, request changes, close, reopen) and, for reviewers, **Merge** or **Resolve conflicts**.

The resolver shows one card per conflict: what differs in words, *this branch* and *the proposal* drawn with the real page renderer
(the block marked and the window cut to it) or as thumbnails, lists and text, then three choices as radio buttons: keep this branch's, take the
proposal's, or **Edit by hand**. By hand uses the editor's own block controls (the same `optControl` steppers, switches and choices, with a
live preview), a text box for a setting, ↑/↓ buttons for an order. Nothing is sent until every card has a choice; the button says how many
are left. Your own page in the editor is never changed by looking at, accepting or merging a proposal; if you have unsaved changes on the
target branch, the branch moving shows the usual "Branch moved: your draft is kept" choices.

### Who may do what

| | Guest | Signed in, not a member | Viewer | Editor | Owner | Proposal's author |
| --- | --- | --- | --- | --- | --- | --- |
| Read a **public** project's proposals, diffs, discussion | yes | yes | yes | yes | yes | yes |
| Read a **private** project's proposals | 404 | 404 | yes | yes | yes | yes |
| Fork (needs `allowReuse` on the source) | 401 | yes (public source) | yes | yes | yes | n/a |
| Create a proposal | 401 | 403 | 403 | yes, from a fork or branch they can edit | yes | n/a |
| Comment | 401 | 403 | yes | yes | yes | yes |
| Review (approve, request changes) | 401 | 403 | 403 | yes | yes | comment only: **cannot approve their own** |
| Accept selected changes, merge | 401 | 403 | 403 | yes | yes | only if also an editor/owner |
| Close / reopen | 401 | 403 | 403 | yes | yes | yes |
| Set allowReuse, license, credit | 401 | 403 | 403 | 403 | yes | n/a |

All of it is checked in `src/repo.mjs` / `src/collab.mjs`, never in the routes or the editor (which only shows what `proposal.can` says).
Approval is not required to merge; a `changes_requested` review blocks it.

## Tests (`npm test`, sample data only)

| File | Proves |
| --- | --- |
| `snapshot.test.mjs` | allowlist and scanner (keys, paths, values, nesting), profile safe fields, hashing |
| `repo.test.mjs` | ancestry and hashing, immutability (SQL), tamper detection, 409 conflicts, rollback, restore, branches, drafts, diff by id, assets |
| `api.test.mjs` | auth, throttle, full HTTP session, non-member 404 on every route, roles, public read, asset access, CORS |
| `guest.test.mjs` | no account: every read of a public project works, every write is 401, a private project is 404 |
| `print.test.mjs` | import/export, byte-identical books and `check-identical.mjs`, edit in editor state, commit, export, render, `check.mjs` "[] 0" |
| `merge.test.mjs` | the commit graph (merge base on branchy, criss-cross and long histories), ~25 independent-merge cases, every conflict kind with its base/ours/theirs and each resolution, selected-change lists and acceptance |
| `collab.test.mjs` | fork consent and permissions, attribution, independent history, forbidden content never forked (planted in a private branch, in the published line, and as an unknown field), proposals (who may propose, comment, review, close; guests read only; private hides), review status and stale approvals, merge commits with two parents, all-or-nothing resolution, expected-head concurrency, accepting selected changes, direct merges, a full HTTP run |
| `collab-ui.test.mjs` | fork, propose, review, accept some, resolve conflicts and merge in a browser: guests read only, keyboard use, focus kept while controls redraw, 44px targets and accessible names, no sideways scroll at 390px, light and dark; screens in `journal/editor/dist/test/collab-*.png` |
| `print.test.mjs` | (adds) fork, edit both sides, resolve a conflict, merge, export the merge commit, render both trims, `check.mjs` "[] 0" |
| `ui.test.mjs` | the Versions drawer in a browser: guest (local versions, public project read-only, no writes), sign-in changes nothing, move to account, draft, save, conflict, compare, restore, branch, book compare, phone, dark; screens in `journal/editor/dist/test/studio-*.png` |

`print.test.mjs` and `ui.test.mjs` need `npm ci` in `journal/` and Chromium (and, for the UI test, the built editor); they skip otherwise.
CI runs everything in the Books workflow (before the Build step).

## Limitations

- No email, password reset or invitations: an owner adds a member by username; a lost password needs a database edit.
- Sessions and the login throttle: tokens live in the browser's storage; the throttle is per process.
- The editor edits the day layout only; book structure changes come from `content/book.json` (import) or the API until the Book view can edit.
- Assets can be stored, listed, served and committed, but the editor has no image picker yet.
- Objects of deleted projects and abandoned drafts are not garbage collected.
- One SQLite file, one process: fine for a person or a small team, not a hosted multi-tenant service. No rate limits beyond login.
- The published editor site holds no project data (sample data only); the Versions drawer shows only what your own server returns to you after you sign in.
- Login hashing (scrypt) runs on the request thread: fine for a few people, not for a crowd.
- Serve it behind HTTPS if it leaves your machine (tokens are bearer tokens). Never a default to any one host.
- **G2:** Merges are by id and by field; a block's content is never merged inside a text value (two people editing the same title differently
  is a conflict, not a text merge). Reorders are all-or-nothing per list (both sides reordering the same list differently is one conflict
  even if they moved different items). The virtual base for criss-cross histories is best-effort (depth 4).
- **G2:** A proposal's source content is visible to everyone who can read the target project (that is what proposing means); it is scanned
  when proposed and again when merged. Deleting a fork closes its open proposals.
- **G2:** No notifications and no email: a reviewer sees proposals when they open the project. No suggested-change comments inside a page, no
  per-field acceptance (the unit is a page, a block, an order or a setting), no protected branches or required approvals.
- **G2:** The Book view is still read-only, so book conflicts are resolved with the resolver's controls (shown/hidden, page options), not by
  rearranging pages in the Book view. A guest's "fork" of a public project is not built (guests read); forking needs an account.
- Manual resolutions of a grid conflict are limited to choosing a side's whole layout; adjust it in the editor afterwards.

## Designed for G3 (not built)

`components` + `component_versions` hold reusable pages with numbered versions (G2's merge already treats snapshot components as atomic and
bumps their version on a resolved conflict); `objects` can hold release manifests. Nothing reads the component tables yet.
