# Rocketbook and Scan Systems (paper that talks to a phone)

A reference for "smart paper": notebooks and pens that turn handwriting into files. Rocketbook, Moleskine Smart Writing, Neo smartpen, Livescribe, Whitelines Link, the Evernote Moleskine, and plain phone scanners (Apple Notes, Microsoft Lens, OneDrive). How each one finds the page, reads marks and handles handwriting, where OCR falls down, the design rules for scan-friendly pages, and how Keeping Watch's own scan system compares.

Checked against sources on 2026-09-28. Where a detail couldn't be confirmed from a primary source, it's marked **(unconfirmed)**. Keeping Watch numbers come from `journal/render.mjs` on `main` at that date.

---

## 1. At a glance

| | |
|---|---|
| **Creator** | Many. Rocketbook: Joe Lemay and Jake Epstein (2014). Livescribe: Jim Marggraff (2007) on Anoto dot paper. Neo smartpen: NeoLAB Convergence (Ncode). Moleskine Smart Writing: Moleskine with Ncode. Whitelines: Sweden, later with Leuchtturm1917. Evernote Smart Notebook: Evernote + Moleskine (2012) |
| **Year** | Digital pens from about 2000 (Anoto); smartpens 2008 on; camera-scan notebooks 2012 on |
| **Type** | System: paper + marks + an app that captures, routes and reads pages |
| **Time per day** | Seconds to a minute per page to scan; smartpens sync as you write |
| **Time per week** | 5–15 minutes to tidy titles, tags and folders |
| **Cost** | $0 (phone scanner + any paper) · about $20–40 (Rocketbook, Whitelines) · about $100–200 (smartpen + dotted notebooks) **(prices vary; unconfirmed)** |
| **Formats and sizes** | Letter, A4, A5, executive, pocket; loose filler paper; planners |
| **Best for** | People who think on paper but need to search, share or back up. People with one "inbox" app |
| **Not ideal for** | Private journals (cloud routing, OCR servers). People who hate phones at the desk. People on a tight budget (smartpens, refills, batteries) |
| **Learning curve** | Low for phone scanning; medium for symbol routing and titles; medium–high for smartpens (pairing, syncing) |
| **Supplies** | The paper, a compatible pen (FriXion for Rocketbook; the smartpen for Ncode/Anoto), a phone, the app, good light |
| **Official site** | getrocketbook.com · moleskine.com · neosmartpen.com · livescribe.com · anoto.com |
| **Evidence level** | **None** for the systems themselves. **Standards-grade** engineering for the codes (ISO/IEC Data Matrix, QR). **Some studies** on handwriting versus typing (mixed) |

---

## 2. Summary

Scan systems let paper stay paper while a phone does the filing. They all solve the same three problems: **find the page** (corner markers, a frame, a QR or Data Matrix code, or a hidden dot pattern), **know what the page is** (a code that names the notebook and page), and **know what you want** (symbols you tick to route a scan, a title between `##` marks, checkboxes that become a list). Rocketbook, founded in 2014 and bought by BIC in 2020 for about $40 million, made this mainstream with seven symbols at the bottom of every page, a QR code and erasable pages. Smartpens (Livescribe on Anoto paper, Neo and Moleskine on Ncode) skip the camera: a tiny infrared camera in the pen reads a near-invisible dot pattern and records every stroke. Plain phone scanners (Apple Notes, Microsoft Lens, now retiring, and OneDrive) work on any paper by finding its edges. Handwriting recognition is good for neat print and short titles, weaker for cursive, crowded pages and non-English text, and it usually runs in someone's cloud. Keeping Watch already has its own system: a 9 pt black frame with a 0.5 in quiet zone, a SEND TO strip of seven hand-fillable bubbles with shapes chosen to stay distinct when blurry, a 16 × 16 Data Matrix page code, and a `layout.json` map of every block's zone. This doc sets out what the commercial systems teach and what to add (reading filled bubbles as check-in data, comb fields for clean OCR) and what to leave alone (cloud routing, smartpens, QR).

---

## 3. History and origin

### Who created it

- **Anoto (Sweden).** A digital pen company, formerly C Technologies, whose pens read "a non-repeating dot pattern printed on the paper" to know "which page is being written on, and where on the page the pen is". It licensed the pattern to Livescribe, Logitech, Nokia and HP and holds "more than 300 international patents". [Anoto, Wikipedia]
- **Livescribe.** Founded in January 2007 by Jim Marggraff, who had made LeapFrog's FLY Pentop computer. Its smartpen "records what it writes... and synchronizes those notes with any audio it has recorded"; you tap your notes to replay the audio. Anoto bought it in November 2015 for $15 million. [Livescribe, Wikipedia]
- **NeoLAB Convergence (Korea).** Makes the Neo smartpen and the **Ncode** pattern, which packs position data into a 2 × 2 mm square and can label "more than 377.9 billion sheets of paper (based on A4 size)". [NeoLAB, Ncode Technology]
- **Moleskine.** First partnered with Evernote (2012) on a camera-scan notebook, then built the Smart Writing System on Ncode: "a hidden grid embedded within the pages which enables words and drawings to be transformed into digital documents". [Engadget 2012; Moleskine FAQ]
- **Whitelines (Sweden).** Grey paper with white lines, designed so guidelines vanish in copies and scans; the "Link" version added corner codes and an app. Later sold under the Leuchtturm1917 name. [Well-Appointed Desk]
- **Rocketbook (US).** Founded in 2014 by Joe Lemay and Jake Epstein. Grew through crowdfunding and Amazon to "number one in reusable notebooks on Amazon", with $32 million net sales in 2020. BIC announced the purchase on 9 November 2020 and closed it on 15 December 2020, for $40 million up front plus deferred payments. [BIC press release]
- **Phone scanners.** Microsoft Office Lens (later Microsoft Lens) and Apple Notes' document scanner made "any paper is scannable" normal.

### Timeline

| Year | Event |
|---|---|
| 1994 | Denso Wave releases the QR code (inventor Masahiro Hara) |
| 1997 | QR approved as an AIM standard |
| 2000 | QR approved as ISO standard (ISO/IEC 18004); Data Matrix first published as ISO/IEC 16022:2000 |
| c. 2000 | Anoto digital pen and dot pattern **(year unconfirmed)** |
| 2007 | Livescribe founded (January) |
| 2008 | Livescribe Pulse smartpen |
| 2010 | Livescribe Echo |
| Aug 2012 | Evernote Smart Notebook by Moleskine announced; ships 1 October 2012 ($25 pocket, $30 large) |
| 2012 | Livescribe Sky Wi-Fi |
| 2013 | Livescribe 3 |
| 2014 | Rocketbook founded |
| Nov 2015 | Anoto acquires Livescribe ($15M) |
| 2018 | Livescribe Aegir; Moleskine Pen+ Ellipse era **(Ellipse year unconfirmed)** |
| 2020 | Livescribe Symphony; BIC buys Rocketbook (closed 15 Dec) |
| 2024 | ISO/IEC 16022:2024, third edition of the Data Matrix standard |
| 9 Jan 2026 | Microsoft Lens retirement begins; removed from app stores 9 Feb; no new scans after 9 Mar 2026. Microsoft points users to OneDrive's scanner |

### Cultural context

- **Paper came back.** Tablets didn't kill notebooks; people wanted both. Scan systems sell "the best of physical and digital". [Rocketbook, How it works]
- **Productivity culture.** Destinations like Evernote, Trello, Slack and Todoist reveal the audience: office workers and students who want handwriting to land in their work tools.
- **Sustainability pitch.** Rocketbook's erasable, reusable pages are marketed as saving paper.
- **The cloud question.** Nearly every system routes pages through a company's servers for OCR and delivery. For diaries, that's a privacy trade most marketing doesn't mention.
- **AI replaces single-purpose tools.** Microsoft retired Lens and pointed people to OneDrive and Copilot.

### Key quotes

- Rocketbook co-founders: "There is great synergy between BIC and Rocketbook." [BIC press release]
- BIC CEO Gonzalve Bich: the deal provides "a way to write that can be easily stored and shared." [BIC press release]
- Rocketbook on its symbols: "The seven symbols at the bottom of your Rocketbook pages align with customizable cloud destinations in the app." [Rocketbook, How Rocketbook works]
- Masahiro Hara: "Black and white codes have become so mundane now. I'd like to create more spectacular QR Codes that can stimulate people." [Denso Wave, QR history]
- Microsoft on OneDrive scanning: "OneDrive does not support saving scans locally on your device." [Microsoft, Retirement of Microsoft Lens]

---

## 4. Philosophy and principles

Stated goals across the systems:

1. **Write naturally, file digitally.** Keep the pen; lose the retyping.
2. **Mark intent on the page.** Tick a symbol to route; write `##title##` to name; draw ☐ for a task. The page carries instructions for the software.
3. **Make the page findable.** Fixed markers (codes, corners, frames, dot patterns) let software locate, straighten and identify the page.
4. **One source of truth, many destinations.** Send one page to email, another to a project tool.
5. **Reuse (Rocketbook).** Erase and write again.

The problem it solves: handwritten notes are hard to search, share, back up and act on. Scan systems make paper searchable without asking you to type.

Keeping Watch's own philosophy is narrower: the scan system exists so Shelbee's **own** app can file pages, read check-ins and keep a private archive. Nothing routes to third-party clouds by default.

---

## 5. Core components

| Element | What it does | Examples |
|---|---|---|
| Page finder | Lets the camera locate and straighten the page | Four corner codes (Whitelines Link), dot grid used as reference (Evernote Page Camera), QR (Rocketbook), black frame (Keeping Watch), page edges (Apple Notes, OneDrive) |
| Page ID code | Says which notebook, page, size or version | Rocketbook QR (page size and notebook version), Keeping Watch Data Matrix (`KW2\|edition\|yymm\|size+page`) |
| Position pattern | Tells a pen where it is | Anoto dot pattern, Ncode |
| Routing symbols | Say where the scan goes | Rocketbook's 7 symbols, Whitelines' 3 icons, Keeping Watch's 7 SEND TO bubbles |
| Title field | Names the file | Rocketbook Smart Title (`##Title##`), Keeping Watch TITLE box |
| Tag field | Categorises | Rocketbook Smart Tags bar, Evernote Smart Stickers, Keeping Watch TAGS box |
| List detection | Turns ☐ into a checklist | Rocketbook Smart Lists |
| OCR / handwriting recognition | Turns ink into text | Rocketbook app, Moleskine Notes, Livescribe, Google Cloud Vision, Apple |
| Image clean-up | Crop, flatten, contrast | All camera apps |
| Zone map | Says which region of the page is which block | Keeping Watch `layout.json` with `data-zone` ids |
| Destination connectors | Deliver files | Email, Google Drive, Dropbox, OneNote, OneDrive, Evernote, Trello, Slack, Box, Asana, Todoist |
| Erasable surface | Reuse pages | Rocketbook synthetic pages + FriXion pens |
| Audio sync | Tap writing to hear what was said | Livescribe, Moleskine Pen+ |

### 5.1 Rocketbook

- **Pages:** "paper-like pages" (synthetic in Core, Fusion and similar lines) that take Pilot FriXion or BIC erasable pens and wipe clean with water and a towel. Other pens "will not wipe off the page". [Rocketbook, How it works; FAQ]
- **Symbols:** seven small symbols at the bottom of every page. You draw an X over one to "bypass the destination selection step"; with **Auto-Send** on, the scan goes "as soon as that page is scanned". [Rocketbook, How Rocketbook works]
- **QR code:** helps the app "find" the page during scanning; the data includes page size and notebook version. (From Rocketbook's Help Center as summarised in search results; the Help Center page blocked automated access, so **not directly opened**.)
- **Smart Titles:** write `##Title##`; the app uses the text as the file name. Needs neat, printed (not cursive) writing, keeps your capitals, and "currently supports just English". [Rocketbook, Announcing Smart Titles]
- **Smart Tags, Smart Lists, transcription, Smart Search:** a tag bar at the page bottom; hollow ☐ checkboxes become an interactive list; full-page OCR. [Rocketbook, Filler Paper smart features]
- **Filler paper:** lined, dot-grid or graph, with a Smart Title bar at the top and a Smart Tag bar, seven symbols and a QR at the bottom. [Rocketbook, Filler Paper]
- **Owner:** BIC since December 2020.

### 5.2 Moleskine Smart Writing (Ncode)

- **Parts:** Pen+ smart pen (Bluetooth), a Smart Notebook or Paper Tablet with Ncoded paper, the Moleskine Notes app. [Moleskine FAQ]
- **Features:** handwriting transcription, sketch-to-vector, voice memos synced with notes, time-lapse playback of writing, offline capture with later sync, calendar sync for Smart Planners. [Moleskine FAQ]
- **Limit:** only works on Moleskine smart paper.

### 5.3 Neo smartpen (Ncode)

- **How it finds itself:** "An infrared camera under the Neo Smartpen nib reads the coordinates" of the Ncode pattern. [NeoLAB, Ncode Technology]
- **Pattern:** fits "within 2mm x 2mm squares", designed to avoid moiré and be nearly invisible. [NeoLAB]
- **Printing your own:** needs a PostScript laser printer at 600 DPI or higher; commercial printers add it as one extra spot-colour plate at "almost no additional cost". [NeoLAB] Inkjet printing isn't reliable **(retailer and help pages; not confirmed on the page opened)**.

### 5.4 Livescribe (Anoto)

- **How it works:** the pen reads Anoto's non-repeating dot pattern to know page and position; records audio and links it to strokes. [Livescribe, Wikipedia; Anoto, Wikipedia]
- **Dot pattern:** tiny dots each nudged off a grid in one of four directions; commonly described as about 0.1 mm dots on a ~0.3 mm grid **(unconfirmed from Anoto)**.
- **Models:** Pulse (2008), Echo (2010), Sky Wi-Fi (2012), Livescribe 3 (2013), Aegir (2018), Symphony (2020). Early OLED screens faded after one to three years. [Livescribe, Wikipedia]

### 5.5 Whitelines Link (Leuchtturm1917)

- **Paper:** pale grey pages with white dots or lines; the grey comes from ink covering the whole sheet, which makes a "waxy" surface that water-based inks resist. [Well-Appointed Desk]
- **Markers:** "QR-style icons" in the corners help "align and square pages when scanning". [Well-Appointed Desk] The app captures automatically when it sees all four corners, and three icons at the bottom route to email, Evernote or Dropbox **(retailer descriptions; unconfirmed from the maker)**.
- **Trade-off:** great scans (the white guidelines vanish) but fountain pens skip: the reviewer "would not recommend the Whitelines Link to fountain pen enthusiasts".

### 5.6 Evernote Smart Notebook by Moleskine (2012)

- **Dotted pages** tuned for Evernote's **Page Camera**, which shoots the page, adjusts contrast and corrects skew "using the dot pattern as reference points".
- **Smart Stickers:** stickers the app recognised as tags.
- **Launch:** 1 October 2012; pocket $25, large $30. [Engadget]
- **Status:** discontinued **(unconfirmed date)**; the idea (a ruling that doubles as a fiducial) lives on.

### 5.7 Phone document scanners

- **Apple Notes:** Attachment → Scan Documents; in Auto mode the page is captured automatically; drag corners to adjust; Keep Scan. [Apple Support 108963] (Handwriting search and Live Text exist in iOS but aren't described on that page.)
- **Microsoft Lens:** retiring; stopped being supported from 9 January 2026, left the app stores on 9 February 2026, and makes no new scans after 9 March 2026. Replacement: the OneDrive app's scan button. [Microsoft Support]
- **OneDrive scan:** saves to OneDrive only, not locally. [Microsoft Support]
- **Others:** Google Drive scan, Adobe Scan, Genius Scan and similar. All do edge detection, perspective correction and a B&W filter.

### 5.8 OCR and handwriting recognition

- **Cloud engines:** Google Cloud Vision reads handwriting with `DOCUMENT_TEXT_DETECTION`, "optimized for dense text and documents"; you can hint `en-t-i0-handwrit`, though "an empty value usually yields the best results". It can process in US or EU regions. [Google Cloud Vision docs]
- **Limits that show up in every system:**
  - cursive and joined writing read worse than print (Rocketbook asks for printed, not cursive);
  - titles and short fields work better than long paragraphs;
  - ruled lines, grids and doodles crossing letters cause errors;
  - non-English support lags (Rocketbook Smart Titles: English only);
  - symbols, arrows, emoji and custom bullets are usually dropped or misread;
  - light pencil, shadows, curl near the spine and glare all hurt.
- **Accuracy numbers:** vendors don't publish comparable handwriting accuracy figures; none were found from a primary source **(open question)**.
- **Privacy:** cloud OCR sends the image to a server. For a journal, prefer on-device recognition or none.

### 5.9 Codes: Data Matrix versus QR

| | Data Matrix (ECC 200) | QR code |
|---|---|---|
| Standard | ISO/IEC 16022 (2000; latest 2024, 3rd edition) | ISO/IEC 18004 (ISO since 2000) |
| Origin | International Data Matrix, Inc. (later Siemens, Microscan, Omron) | Denso Wave, Masahiro Hara, 1994; patent not enforced |
| Finder | L-shaped solid border on two sides + alternating "clock track" on the other two | Three large square "eyes" in corners |
| Sizes | 10 × 10 to 144 × 144 modules (plus rectangles) | Version 1 = 21 × 21 up to version 40 = 177 × 177 |
| Error correction | Reed-Solomon; can rebuild data with about 30% damage if the symbol can still be located | Selectable: L ~7%, M ~15%, Q ~25%, H ~30% |
| Quiet zone | 1 module on each side (per the standard) **(standard not opened)** | 4 modules on each side (per the standard) **(standard not opened)** |
| Good at | Tiny codes for short data; industrial part marking | Phone cameras open it natively; URLs |
| Risk | Few phone camera apps read it out of the box | Phones offer to open links; "scan me" invites misuse |

Sources: [Data Matrix, Wikipedia; QR code, Wikipedia; Denso Wave, QR history; Denso Wave, error correction]. ISO pages blocked automated access and weren't opened; figures for quiet zones are the well-known values from those standards.

**Why Data Matrix suits Keeping Watch:** the payload is short (`KW2|1|2610|S001`, 15 characters), which fits a 16 × 16 Data Matrix. The smallest QR is 21 × 21 and needs a wider quiet zone, so a QR would be bigger and busier. A phone's camera also won't pop up "open link?" on a journal page.

### 5.10 Scan-friendly page design rules

Distilled from the systems above and from how scan apps behave (general practice, **not a formal standard** except where marked):

1. **Fiducials:** give the camera strong, unique shapes at known places. Options: four corner codes (Whitelines), a thick frame (Keeping Watch), a code with its own finder (QR, Data Matrix).
2. **Quiet zones:** keep a clear margin around every code and marker (1 module for Data Matrix, 4 for QR, per their standards). Keeping Watch keeps a 0.5 in clear band inside its frame.
3. **Contrast:** machine marks solid black; human guides pale grey. KDP needs lines ≥ 0.75 pt and fills ≥ 10% grey to print reliably. [KDP guidelines]
4. **Size:** codes need modules big enough for a phone at arm's length and for print spread. Keeping Watch's 0.42 in, 16 × 16 code gives modules of about 0.67 mm. **(Adequacy for all phones unconfirmed; test.)**
5. **Distinct shapes:** routing symbols must stay different when blurred. Keeping Watch tested its set (worst pair correlation 0.63, against 0.90 for an older set).
6. **Fill, don't draw:** a filled bubble is easier to detect than an X or tick of unknown size. Rocketbook uses an X; optical mark reading (like school test sheets) uses filled bubbles.
7. **Fixed places:** printed zones (title, tags, send-to, check-ins) at known coordinates, so the app reads them without guessing. This is what `layout.json` does.
8. **Don't let rulings touch markers.** Dots, lines and stickers stay out of the frame, strip and code.
9. **Pale rulings drop out.** Light guides vanish in B&W filters; see the [paper and grids doc](paper-and-grids.md).
10. **Printed box fields ("comb" boxes)** for text you want machine-read: one character per box reads far better than free writing **(standard forms practice)**.

### 5.11 Keeping Watch's scan system

| Part | Detail |
|---|---|
| Frame | 9 pt (3.2 mm) solid black border around every page, inside the trim margins |
| Quiet zone | 0.5 in clear band inside the frame |
| Header | DATE / TITLE / TAGS boxes at the top (fixed) |
| SEND TO strip | Page number, "SEND TO", then seven dashed bubbles, each above a symbol: fire (solid △), water (open ▽), air (three waves), earth (⊕), crescent moon (solid), full moon (solid disc), pentacle. Each bubble has `data-zone="send_to_<name>"` |
| Page code | Data Matrix, 16 × 16 modules, 0.42 in square, at the right of the strip. Payload `KW2\|<edition>\|<yymm>\|<size><page>` (size S, L or H) |
| Zone map | `layout.json` per book: trim size, `border_pt`, `quiet_zone_in`, symbol names, and each page's type, date, code and zones (in mm from the frame's inner edge) |
| Reader | Shelbee's own app; the book's key says the Rocketbook app won't read these markers |
| Exceptions | The Keeper has no scan codes (it holds password hints and recovery codes) |

---

## 6. Setting it up

### Generic (any system)

1. **Pick one inbox.** Decide where scans go (a folder on your phone, a private drive). Fewer destinations is calmer.
2. **Assign symbols.** Write the meaning of each symbol inside the cover (Rocketbook and Keeping Watch both let you choose).
3. **Set OCR options.** Turn on titles only if your writing is neat print; skip full transcription for private pages.
4. **Test scan.** Scan one page in daylight and in lamplight. Check the page is found, straightened and legible.
5. **Test privacy.** Check where the image and text are stored. Turn off auto-upload for anything personal.

### Keeping Watch

1. Open the book's key: note the seven SEND TO shapes.
2. In your scanning app, map each shape to a folder, for example:
   - fire → Action (tasks to copy out);
   - water → Feelings (private archive only);
   - air → Ideas;
   - earth → Body and health log;
   - crescent → Care team (to print or show at appointments);
   - full moon → Keeper handoff (month-end);
   - pentacle → Keep forever.
3. Scan one day page. Check the app reads the page code (book and page) and finds the frame.
4. Keep the frame, strip and code clear of ink and stickers.

### First day

- Fill one bubble, write a title and a tag, scan, and check that it filed where you meant.

### First week

- Scan at the same time each day (e.g., with the evening review) or batch-scan on one day. Note which symbols you never use and drop them.

---

## 7. Daily practice

1. **Write the page** as normal.
2. **Title** in the TITLE box (or `##Title##` on Rocketbook). Print, don't join letters.
3. **Tag** one or two words in TAGS.
4. **Fill a bubble** (Keeping Watch) or X a symbol (Rocketbook) for where it goes. Leave all empty for "don't send".
5. **Scan** (about 20 seconds): flat surface, even light, no shadow, whole page and frame in view.
6. **Check** the result once: page found, code read, title right.
7. **Smartpens:** check the pen is charged and synced.

Order matters: title and route before scanning, so the scan needs no typing afterwards.

---

## 8. Rhythms

- **Weekly (10 minutes):** clear the scan inbox; fix wrong titles; delete duplicates.
- **Monthly:** at month end, scan any pages you skipped; export the month's archive; for Keeping Watch, fill the full moon bubble on pages for the Keeper handoff.
- **Quarterly:** review which destinations you use; retire unused symbols.
- **Yearly:** back up the whole archive off the cloud; check apps still exist (Microsoft Lens is the warning: single-purpose scan apps get retired).
- **Rocketbook:** erase pages after the scan is safely stored.
- **Smartpens:** replace refills; check battery health.

---

## 9. Page anatomy

### 9.1 Rocketbook page (Core, letter)

```
+------------------------------------------+
| ## Title ##                         date |  Smart Title (write ##...##)
|  . . . . . . . . . . . . . . . . . . . . |
|  . . . . . . . . . . . . . . . . . . . . |  dot grid or lines
|  . . . . . . . . . . . . . . . . . . . . |
|  [] list item        (Smart List)        |
|  . . . . . . . . . . . . . . . . . . . . |
|  tags: ______________                    |  Smart Tag bar (Filler Paper)
|  (1)(2)(3)(4)(5)(6)(7)          [QR]     |  7 symbols + QR
+------------------------------------------+
```

### 9.2 Whitelines Link page

```
+[#]------------------------------------[#]+  corner codes (4)
|  grey paper, white lines/dots            |
|  ________________________________        |
|  ________________________________        |
|  ________________________________        |
|                                          |
|                    [mail][EN][DB]        |  3 routing icons
+[#]------------------------------------[#]+
```

### 9.3 Ncode / Anoto page

```
+------------------------------------------+
|  printed ruling (visible)                |
|  :::::::::::::::::::::::::::::::::::::   |  near-invisible dot pattern
|  :::::::::::::::::::::::::::::::::::::   |  everywhere (read by the pen's
|  :::::::::::::::::::::::::::::::::::::   |  infrared camera)
|  [rec] [pause] [stop]   (Livescribe)     |  printed controls you tap
+------------------------------------------+
```

### 9.4 Evernote Smart Notebook page

```
+------------------------------------------+
| .  .  .  .  .  .  .  .  .  .  .  .  .  . |  dots = reference grid
| .  .  .  .  .  .  .  .  .  .  .  .  .  . |  for skew correction
| .  .  .  .  .  .  [sticker]  .  .  .  .  |  Smart Sticker -> tag
+------------------------------------------+
```

### 9.5 Keeping Watch page (5.5 × 8.5)

```
  trim edge
  +--------------------------------------------+
  |  0.3 in margin (0.5 in on the gutter side) |
  |  +======================================+  |  9 pt black frame
  |  ||   0.5 in quiet zone                ||  |
  |  ||   DATE ____  TITLE ________  TAGS _||  |  fixed header
  |  ||                                    ||  |
  |  ||   blocks, each with a data-zone:   ||  |
  |  ||   sky | events | care | spoons     ||  |
  |  ||   body (dots / lines / grid)       ||  |
  |  ||   actions | review | fact          ||  |
  |  ||                                    ||  |
  |  ||  12 SEND TO  o  o  o  o  o  o  o  [DM] | 7 bubbles over symbols
  |  ||              ▲  ▽  ≋  ⊕  ☾  ●  ⛤  0.42in Data Matrix
  |  +======================================+  |
  +--------------------------------------------+
```

---

## 10. Worked examples

### 10.1 A day (Keeping Watch)

Page 12 of the October book, a day page.

```
DATE Tue 6 Oct   TITLE Clinic + short shift   TAGS hrt, work
...
[x] refill pickup      [ ] email Sam
...
SEND TO   ●  o  o  ●  o  o  o       [DM: KW2|1|2610|S012]
          ▲  ▽  ≋  ⊕  ☾  ●  ⛤
```

What the app does:

1. Finds the 9 pt frame; straightens the page.
2. Reads the Data Matrix: book 2026-10, page 12.
3. Looks up page 12 in `layout.json`: a day page for 6 Oct, with zones for header, care, actions, etc.
4. Reads the bubbles: fire (Action) and earth (Body log) filled.
5. Crops the `actions` zone into the Action folder, and the whole page plus the `care` zone into the Body log.
6. Title and tags come from the header zone (on-device OCR if available; otherwise stored as an image).

### 10.2 A week (Rocketbook)

```
Mon  ##Standup## X on symbol 1 (Work email)    -> auto-sent
Tue  ##Grocery## [] milk [] rice  X symbol 3   -> Smart List to Todoist
Wed  sketch, no title, X symbol 5 (Drive)      -> file "Scan 2026-10-07"
Thu  ##Journal## no symbol                      -> stays in app only
Fri  erase Mon–Wed pages after checking cloud copies
```

### 10.3 A month (Keeping Watch archive)

```
Oct book, 64 pages
scanned: 31 day pages, 4 week spreads, 1 month page, Closing the month
bubbles used: fire 18, water 9, earth 22, full moon 5, pentacle 3,
              air 0, crescent 2
Keeper handoff: 5 pages (full moon) printed into the month spread
Decision for Nov: map air to "Bus notes" or ignore it
```

---

## 11. Variations and offshoots

| Variant | Who | How it differs |
|---|---|---|
| Rocketbook Core / Fusion / Filler Paper / Orbit / planners | Rocketbook (BIC) | Erasable synthetic pages; Fusion adds planner pages; Filler Paper is loose-leaf |
| Rocketbook Wave (original) | Rocketbook | Paper pages erased in a microwave **(unconfirmed details)** |
| Moleskine Smart Writing (Pen+ Ellipse, Smart Planner) | Moleskine + NeoLAB | Ncode paper, smart pen, Notes app |
| Neo smartpen (N2, M1, A1 and others) | NeoLAB Convergence | Ncode; print-your-own Ncode pages |
| Livescribe (Pulse → Symphony, Echo 2) | Livescribe / Anoto | Anoto dot paper; audio sync |
| Whitelines Link | Whitelines / Leuchtturm1917 | Grey paper, white guides, corner codes |
| Evernote Smart Notebook | Evernote + Moleskine | Dots as skew reference, Smart Stickers |
| Phone scanners | Apple, Microsoft (Lens retired), Google, Adobe | Any paper; edge detection |
| Optical mark reading (OMR) | Exam sheets, surveys | Filled bubbles at fixed places |
| Keeping Watch | Shelbee | Frame + Data Matrix + filled bubbles + zone map; own app; no cloud by default |

---

## 12. Community practice

- **Rocketbook users** (reviews, Reddit, YouTube) praise erasability and the send-by-symbol trick; common complaints are FriXion ink smearing, ghost marks after erasing, and the pages feeling slick. Many use it for work, not diaries.
- **Smartpen users** love audio sync for lectures and meetings; complaints are battery life, app changes and proprietary paper.
- **Plain scanner users** are the biggest group: any notebook plus Apple Notes, Google Drive or Adobe Scan.
- **Common customisations:**
  - writing symbol meanings on a sticker inside the cover;
  - printing Rocketbook-style or Ncode pages at home;
  - using a single "inbox" symbol and sorting later;
  - adding their own QR stickers to notebooks.
- **Aesthetic camp:** decorated Rocketbook planners, stickers kept clear of the symbol row.
- **Minimalist camp:** one notebook, one scan app, one folder, no OCR.
- **Privacy-minded journalers** often refuse cloud OCR for diaries and scan to local storage only.

---

## 13. Official products and formats

| Product | Format | Paper / surface | Pen | Price range | Where sold | Notes |
|---|---|---|---|---|---|---|
| Rocketbook Core, Fusion, Filler Paper | Letter, executive, mini; lined, dot, graph | Reusable synthetic | Pilot FriXion / BIC erasable | about $20–40 **(unconfirmed)** | getrocketbook.com, Amazon, stores | Owned by BIC since 2020 |
| Moleskine Smart Writing Set (Pen+ Ellipse + Paper Tablet) | Large; dotted/ruled | Ncoded paper | Pen+ smart pen | about $150–200 **(unconfirmed)** | Moleskine, retailers | Moleskine Notes app |
| Neo smartpen + N notebooks | Various | Ncode paper; print-your-own | Neo pens | about $100–200 **(unconfirmed)** | NeoLAB, Amazon | Laser printer 600 DPI for home Ncode |
| Livescribe Symphony / Echo 2 + dot notebooks | Various | Anoto dot paper | Livescribe pens | about $100–200 **(unconfirmed)** | Livescribe, Amazon | Audio sync on Echo |
| Leuchtturm1917 Whitelines Link | Pocket (A6), Medium (A5), Master Slim (A4+) | Grey, coated | Any (fountain pens skip) | about $13 (A6) | Retailers | Corner codes |
| Evernote Smart Notebook | Pocket, Large | Dotted | Any | $25 / $30 (2012) | Discontinued | Page Camera |
| Apple Notes, OneDrive, Google Drive scanners | Any paper | Any | Any | Free | Built in | Microsoft Lens retired 2026 |

---

## 14. Tools and supplies

- **Pens:**
  - Rocketbook: Pilot FriXion or BIC erasable only.
  - Smartpens: the brand's refills.
  - Keeping Watch and plain scanning: dark gel or ballpoint. Fill bubbles with a felt-tip or 0.7 mm gel for a solid mark. Pencil scans grey.
- **Light:** daylight or a lamp from above-front; avoid a single side lamp (shadows).
- **Surface:** matte, darker than the page (helps edge detection).
- **Stand (optional):** a phone stand or document camera for batch scans.
- **Microfiber cloth and water:** for Rocketbook erasing.
- **Stickers:** keep them off frames, strips and codes.
- **Printer:** PostScript colour laser at 600 DPI or more for printing Ncode or Anoto pages at home.

---

## 15. Digital and hybrid versions

- **Apps:** Rocketbook app; Moleskine Notes; Neo Studio; Livescribe+; Whitelines app; Apple Notes; OneDrive; Google Drive; Adobe Scan.
- **E-ink:** reMarkable, Kindle Scribe and Boox skip the scan step: you write on the screen and export PDFs or text. They lose the "real paper" feel and the one-book archive. The Keeping Watch X4 is a reader with buttons, not a writing tablet.
- **Scanning as the hybrid:** the Keeping Watch approach is paper first; the scan adds search, backup and check-in data.
- **Lost compared with paper:** privacy (cloud OCR), permanence (apps get retired), calm (phones at the journal).
- **Gained:** search, backup, sharing with a care team, turning bubbles into data.

---

## 16. Evidence and research

- **The systems themselves:** no studies found on Rocketbook, smartpens or symbol routing for wellbeing or productivity. Evidence: **none**.
- **Handwriting versus typing (note-taking):**
  - Mueller & Oppenheimer (2014), *Psychological Science*: longhand note-takers did better on conceptual questions in lab studies with students. (Journal page blocked automated access.)
  - Morehead, Dunlosky & Rawson (2019), *Educational Psychology Review*: direct replication plus eWriter and no-notes groups; "performance did not consistently differ between any groups"; meta-analysis showed "small (nonsignificant) effects favoring longhand". [ERIC] Limits: lecture recall, students, not journaling.
  - Relevance: smartpens and eWriters were tested in Morehead et al. and did about as well as paper.
- **Codes and OCR:** engineering standards (ISO/IEC 16022, 18004) specify error correction and quiet zones; these are tested and certified, not studied as behaviour.
- **Handwriting OCR accuracy:** no vendor-neutral, published accuracy figures for these consumer apps were found.

| Claim | Status |
|---|---|
| "The best of physical and digital" | Marketing |
| Handwriting helps memory | Mixed; small effects |
| Data Matrix can rebuild data after ~30% damage | Standard property (ECC 200) |
| QR level H recovers ~30% | Standard property |
| Reusable pages save paper | Plausible; no lifecycle study found |

---

## 17. Benefits

- Searchable, backed-up handwriting. **Claimed** (true in use; no outcome studies).
- Less retyping. **Claimed**.
- Routing by symbol saves steps. **Claimed**.
- Codes survive smudges and damage. **Evidenced** (standard error correction).
- Filled bubbles give data without writing. **Claimed** (OMR is long-proven for exams; no journaling studies).
- Audio sync helps lecture review. **Claimed** (Morehead et al. found eWriters roughly equal to paper, not better).
- Scans make it easy to share pages with a care team. **Claimed**.

---

## 18. Pitfalls

| Problem | Fix |
|---|---|
| Scans come out skewed or cropped | Flat surface, whole frame in view, darker background |
| Code won't read | More light, less angle, keep ink off it, check the quiet zone |
| Wrong folder | Write symbol meanings inside the cover; fewer symbols |
| OCR garbles titles | Print in capitals in the title box; keep titles short |
| Cursive not recognised | Print; or store as image and search by tag |
| Pencil too faint | Use ink |
| FriXion smears or ghosts (Rocketbook) | Let ink dry; erase with a damp cloth, not the pen eraser |
| Smartpen battery dead | Charge with your phone at night; keep a normal pen as backup |
| App retired (Microsoft Lens) | Keep scans in open formats (PDF, PNG) in your own storage |
| Privacy leak | Turn off auto-upload; don't route diaries to shared tools |
| Scanning becomes a chore | Batch weekly; scan only pages you'll use |
| Phone at the journal pulls you into apps | Scan later, away from the writing time |

---

## 19. Accessibility and adaptations

- **ADHD:** routing symbols reduce "where does this go" decisions; Auto-Send helps, but too many destinations overwhelm. Use two or three.
- **Autism and sensory needs:** Rocketbook's slick pages and FriXion feel may bother some; phone scanning on real paper avoids that. Calm, predictable filing helps.
- **Chronic illness and low spoons:** filled bubbles instead of writing; batch scans; smartpens remove the scan step but add charging.
- **Depression and anxiety:** don't let the scan pile become guilt; scanning is optional.
- **Trauma:** private pages should never go to cloud OCR; use an "unsent" default and on-device storage.
- **Dyslexia and dysgraphia:** OCR can read back messy notes as text (with errors); comb boxes help recognition; audio sync (Livescribe) helps.
- **Low vision:** scans can be zoomed and read aloud; codes need decent contrast, which Keeping Watch's solid black markers give.
- **Motor or hand pain:** filled bubbles over writing; a phone stand avoids holding the phone steady.
- **Trans and gender-diverse people:** routing health pages (HRT, dysphoria) to a private place; share with a gender clinic only by choice.
- **Shift workers:** scan at the end of a shift in the break room light, or batch on days off.
- **Low income:** free phone scanners and any paper beat smartpens; Keeping Watch pages work with any scan app for the image, even without the custom reader.

---

## 20. Comparison

| | Keeping Watch | Rocketbook | Smartpen (Ncode/Anoto) | Whitelines Link | Phone scanner on plain paper |
|---|---|---|---|---|---|
| Page finder | 9 pt frame + Data Matrix | QR + page | Dot pattern (pen) | 4 corner codes | Page edges |
| Page ID | `KW2\|edition\|yymm\|size+page` | Page size + notebook version | Page address in pattern | **(unconfirmed)** | None |
| Routing | 7 filled bubbles | 7 symbols (X) | App | 3 icons | Manual |
| Zones | `layout.json` per block | Title and tag bars | Whole page strokes | None | None |
| OCR | Own app (on-device preferred) | Cloud app, English titles | App | App | App |
| Privacy | Private by design | Cloud | Cloud / app | Cloud | Depends |
| Paper | KDP 74–90 gsm | Synthetic, erasable | Special dotted paper | Coated grey | Any |
| Cost | Book print cost | ~$20–40 | ~$100–200 | ~$13+ | Free |

See also: [Paper and grids](paper-and-grids.md), [Bullet Journal](bullet-journal.md), [Getting Things Done on paper](getting-things-done-paper.md).

---

## 21. Combining

- **With the [Bullet Journal](bullet-journal.md):** scan the daily log; route tasks (•) with one symbol and notes with another.
- **With [Getting Things Done on paper](getting-things-done-paper.md):** the scan inbox is a GTD inbox; symbols map to contexts.
- **With the [commonplace book](commonplace-book.md):** scan quote pages to a searchable archive; tag by source.
- **With [paper and grids](paper-and-grids.md):** pale rulings drop out; solid markers stay.
- **With a care team:** route symptom and medication pages to one folder to print for appointments.

(Sibling docs are being written in parallel; links may resolve once all research PRs are merged.)

---

## 22. Ready-to-use bank

Symbol maps, headings and scan habits to copy:

1. **Seven-symbol map (calm):** Action · Feelings (private) · Ideas · Body · Care team · Keeper · Keep forever.
2. **Three-symbol map (low spoons):** Do · Keep · Private.
3. **Work map:** Email boss · Shift notes · Timesheet.
4. **Title formula:** "Day word + one noun" (e.g., "Tue clinic").
5. **Tag set:** hrt, work, bus, sleep, pain, joy, money, people.
6. **Scan checklist:** flat · light · whole frame · no fingers · check code.
7. **Weekly scan ritual:** Sunday, 10 minutes, one cup of tea.
8. **"Don't send" default:** leave all bubbles empty unless sure.
9. **Care-team page:** meds, side effects, questions; route to Care team.
10. **Keeper handoff page:** month numbers; route to Keeper.
11. **Idea capture:** one idea per page, route to Ideas.
12. **Smart List habit:** draw ☐ for tasks so any app can find them.
13. **Comb-box title:** print one capital letter per box.
14. **Filled-bubble check-in:** meds ●, meals ●●○, water ●●●○.
15. **Scan log:** date · pages · folder · problems.
16. **Monthly export:** PDF of the month to local storage.
17. **Privacy check:** "Where does this page go? Who can read it?"
18. **Photo-light prompt:** "Is there a shadow across the frame?"
19. **Symbol legend sticker** inside the cover.
20. **Retire a symbol:** if unused for a month, remap it.
21. **Batch day:** scan only on days off.
22. **Offline archive:** folders by month, file name `yyyy-mm-dd_page`.
23. **Appointment pack:** scan pages tagged "hrt" before a clinic visit.

---

## 23. Glossary

- **Fiducial:** a marker placed so a camera can find position and orientation.
- **Finder pattern:** the part of a code that tells a reader where it is (QR's three squares; Data Matrix's L-shaped border).
- **Clock track / timing pattern:** alternating modules that set the grid size in a code.
- **Module:** one square cell of a 2D code.
- **Quiet zone:** the clear margin required around a code or marker.
- **ECC 200:** the Reed-Solomon error-correction version of Data Matrix in use today.
- **Reed-Solomon:** error-correcting code used in Data Matrix and QR.
- **Error correction level (QR):** L, M, Q, H (~7, 15, 25, 30%).
- **Data Matrix:** 2D code, ISO/IEC 16022.
- **QR code:** 2D code, ISO/IEC 18004.
- **Payload:** the data inside a code.
- **OCR:** optical character recognition; turning images of text into text.
- **HWR / ICR:** handwriting recognition / intelligent character recognition.
- **OMR:** optical mark recognition; reading filled bubbles.
- **Comb field:** boxes for one character each.
- **Smart Title / Smart Tag / Smart List:** Rocketbook features for naming, tagging and list detection.
- **Auto-Send:** Rocketbook option to deliver scans instantly to marked destinations.
- **Destination:** where a scan goes (email, cloud folder, app).
- **Ncode:** NeoLAB's position dot pattern.
- **Anoto pattern:** Anoto's non-repeating position dot pattern.
- **Smartpen:** a pen with a camera that records strokes.
- **Pencast:** Livescribe notes with synced audio.
- **Page Camera:** Evernote's 2012 notebook capture feature.
- **Perspective correction / deskew:** straightening a photo of a page.
- **Threshold / B&W filter:** turning a greyscale scan to black and white.
- **Zone map (`layout.json`):** Keeping Watch file giving each block's position on each page.
- **`data-zone`:** the id each Keeping Watch block carries so it appears in the zone map.
- **SEND TO strip:** Keeping Watch's row of seven routing bubbles.
- **Page code:** Keeping Watch's Data Matrix, `KW2|edition|yymm|size+page`.

---

## 24. FAQ

1. **Will the Rocketbook app read Keeping Watch pages?** No. The key says so. Any scanner will capture the image; only Shelbee's app reads the frame, code and bubbles.
2. **Why Data Matrix instead of QR?** Smaller for short data, a smaller quiet zone, and phones don't offer to open it as a link.
3. **Can I scan with Apple Notes?** Yes, for the image. It finds the page edges; it won't read the Data Matrix or bubbles.
4. **What happened to Microsoft Lens?** Retired in early 2026; use OneDrive's scanner (it saves to OneDrive only).
5. **Does OCR read cursive?** Poorly in most consumer apps. Print titles and tags.
6. **Is my journal private if I use Rocketbook?** Scans pass through the app and whatever destinations you pick. Check each service's policy; keep diaries local.
7. **Do smartpens need special paper?** Yes: Ncode or Anoto dot paper. You can print Ncode pages on a 600 DPI PostScript laser printer.
8. **What if ink gets on the page code?** Data Matrix can rebuild data with about 30% damage if the finder border is intact. Keep the L-shaped edge clean.
9. **Why fill a bubble instead of drawing an X?** A filled bubble at a known place is easier to detect reliably (the same idea as exam sheets).
10. **Do I have to scan?** No. The book works without it. Scanning is for backup, search and check-in data.
11. **Why no scan codes in the Keeper?** It holds password hints and recovery codes; it should never be photographed into a cloud by accident.
12. **Can scanned bubbles feed the X4?** Not yet; see section 25.

---

## 25. For Keeping Watch

### a. Printed book

| Idea | Where | Fit | B&W and scan-zone notes | Built? |
|---|---|---|---|---|
| Frame + quiet zone + SEND TO + Data Matrix + zone map | Every page (not the Keeper) | High | Fixed | **Yes** |
| Symbol legend: "you choose what each shape means" plus blank lines to write meanings | Front matter key | High | Text + the 7 SVG symbols | Partly (key explains; no write-in lines) |
| Read Checkboxes, Scale, Habit dots and Fill-in blanks by OMR from `layout.json` zones | Day blocks | High | Bubbles must be solid-fillable, ≥ 7 px, with space between; zones already exist | No (the zones exist; the reader doesn't) |
| Comb boxes for TITLE (e.g., 12 character cells) | Header | Low | Header is fixed; changing it breaks the scan contract | No, and don't without a version bump (`KW2`) |
| A "don't send" default made explicit (empty strip = keep private) | Front matter key | High | Text only | No |
| Scan tips box (light, flat, whole frame) | Front matter | Med | Text only | Partly |
| Test page with a grey ramp and sample code to check your phone | Front matter or back matter | Med | Keep grey ramp outside zones | No |
| Rocketbook-style `##title##` | — | Low | The TITLE box already does this, more cleanly | n/a |
| Erasable/reusable pages | — | None | KDP can't print on synthetic paper | n/a |

### b. X4

| Idea | Where | Fit | RAM, scope and calm notes |
|---|---|---|---|
| Import paper check-ins scanned by Shelbee's app, merged with button check-ins | Wi-Fi page (upload a small `checkins-scan.txt` using the same `c_<uid>_<i>` keys) | Med | Tiny text file; parse line by line into static buffers; only over the device's own hotspot; no cloud |
| Show "paper + buttons" counts in month stats for the Keeper handoff | Month stats screen | Med | Static counters; no badges |
| Show the symbol legend (what each SEND TO shape means) | A screen under Books or Support | Low | 7 small 1-bit icons + text; calm |
| Any scanning or OCR on the device | — | None | No camera; out of scope; no AI |
| Notify when scans are waiting | — | None | Notifications are out of scope |

### c. Proposed editor blocks

| Type | Name | Options | `data-zone` | X4 export kind |
|---|---|---|---|---|
| `checks` (existing, flag) | Checkboxes: OMR-ready | add `omr` (bool): larger 9 px bubbles, 4 px gaps | `checks` | `toggle` (already via bridge) |
| `scale` (existing, flag) | Scale: OMR-ready | add `omr` (bool) | `scale` | `scale` |
| `comb` | Print-clearly boxes | `title` (text), `cells` (num 6–20), `rows` (num 1–3) | `comb` (repeats `comb_2`) | none (text) |
| `clip` | Clip box (the app crops this box as its own image) | `title` (text), `h` (num, tenths of an inch 5–30), `send` (choice: none / one of the 7 symbols) | `clip` | none |
| `legend` | Send-to legend | `n` (num 3–7 lines) | `legend` | none |

Notes:
- `clip` looks like Sketch box but tells the scan app "crop and file this region", optionally to a fixed destination, so a page can send one part (say, a question for the clinic) without sending the rest.
- `legend` belongs on a front-matter or month page rather than every day page; offer it in the editor only if Shelbee wants a per-page reminder.

### d. Proposed method layout

**"Scan-first day"** (one click; everything is bubbles, boxes or short fields):

1. `sky`
2. `events`
3. `care`
4. `checks` (omr on; labels: Meds, Meals, Outside, Rest)
5. `scale` (omr on; title "Energy", 5 steps)
6. `habits` (Stretch, Water, Read)
7. `clip` (title "For the clinic", h 10, send crescent)
8. `body` (style dots)
9. `actions`
10. `review`

### e. Don't adopt

- **QR codes:** bigger, busier, and phones offer to open them.
- **Cloud routing or cloud OCR by default:** diaries stay private; the Privacy rule forbids unencrypted uploads of personal data.
- **Smartpens and Ncode/Anoto paper:** KDP can't print the pattern at the needed precision; pens cost money and need charging.
- **Erasable synthetic pages:** not printable on KDP; erasing loses the archive.
- **Auto-Send:** sending without a check step invites mistakes with private pages.
- **Scan codes in the Keeper:** never.
- **Changing the fixed header, frame, strip or code** without a new code version: breaks old books.
- **Generative AI "summaries" of scans on the X4:** out of firmware scope.

---

## 26. Open questions

- **Minimum module size for phones:** is 0.67 mm per module reliable for older phones and dim light? Needs a test with real prints.
- **Quiet zone around the Data Matrix:** the strip gives white space, but the exact clearance to the nearest symbol should be checked against the 1-module rule on a proof.
- **Rocketbook QR payload:** Rocketbook's Help Center (blocked here) says page size and notebook version; the exact format isn't public.
- **Whitelines Link corner code and icon details** weren't confirmed from the maker.
- **Anoto pattern dimensions** weren't confirmed from Anoto.
- **Handwriting OCR accuracy** figures aren't published comparably by any vendor.
- **Best on-device OCR** for Shelbee's phone, without cloud upload, wasn't settled.
- **Product prices** here are approximate and unconfirmed.

---

## 27. Further reading

- Rocketbook, "How Rocketbook works": the official walk-through of symbols and destinations.
- Rocketbook, "Breaking down 5+ smart features of Filler Paper": titles, tags, lists and the send row.
- NeoLAB, "Ncode Technology": how a pen finds itself on paper.
- Denso Wave, "History of QR Code": a short history from the inventor's company.
- Denso Wave, "Error correction feature": what L, M, Q and H mean.
- Wikipedia, "Data Matrix": readable overview of ECC 200 and sizes.
- Google Cloud, "Detect handwriting in images": what a cloud OCR call looks like.
- The Well-Appointed Desk, Whitelines Link review: what scan-friendly paper costs in pen feel.
- Morehead, Dunlosky & Rawson (2019): pen, eWriter and laptop compared.
- Engadget (2012), "The Evernote Smart Notebook by Moleskine": an early "dots as fiducials" design.

---

## 28. Sources

All opened once on 2026-09-28 unless noted.

1. "How it works". Rocketbook. https://getrocketbook.com/pages/how-it-works (checked 2026-09-28)
2. "How Does Rocketbook Work?". Rocketbook. https://getrocketbook.com/pages/how-rocketbook-works (checked 2026-09-28)
3. "FAQs". Rocketbook. https://getrocketbook.com/pages/faqs (checked 2026-09-28)
4. "Breaking Down 5+ Smart Features of Filler Paper". Rocketbook. https://getrocketbook.com/blogs/news/breaking-down-5-smart-features-of-filler-paper (checked 2026-09-28)
5. "Announcing Smart Titles for the Rocketbook App". Rocketbook. https://getrocketbook.com/blogs/news/announcing-smart-titles (checked 2026-09-28)
6. "BIC: Acquisition of Rocketbook, the leading smart reusable notebook brand in the U.S.". Société BIC via GlobeNewswire, 9 Nov 2020. https://www.globenewswire.com/news-release/2020/11/09/2122398/0/en/BIC-Acquisition-of-Rocketbook-the-leading-smart-reusable-notebook-brand-in-the-U-S.html (checked 2026-09-28)
7. "How does the Smart Writing Set work?". Moleskine. https://www.moleskine.com/en-us/faq/how-does-the-smart-writing-set-work.html (checked 2026-09-28)
8. "Ncode Technology". NeoLAB Convergence (Neo smartpen). https://shop.neosmartpen.com/pages/technology (checked 2026-09-28)
9. "Retirement of Microsoft Lens". Microsoft Support. https://support.microsoft.com/en-us/lens/retirement-of-microsoft-lens (checked 2026-09-28)
10. "How to scan documents on your iPhone or iPad". Apple Support. https://support.apple.com/en-us/108963 (checked 2026-09-28)
11. "Detect handwriting in images". Google Cloud Vision documentation. https://docs.cloud.google.com/vision/docs/handwriting (checked 2026-09-28)
12. "History of QR Code". Denso Wave. https://www.qrcode.com/en/history/ (checked 2026-09-28)
13. "Error correction feature". Denso Wave. https://www.qrcode.com/en/about/error_correction.html (checked 2026-09-28)
14. "Data Matrix". Wikipedia. https://en.wikipedia.org/wiki/Data_Matrix (checked 2026-09-28; its capacity figure for 16 × 16 is wrong and wasn't used)
15. "QR code". Wikipedia. https://en.wikipedia.org/wiki/QR_code (checked 2026-09-28)
16. "Anoto". Wikipedia. https://en.wikipedia.org/wiki/Anoto (checked 2026-09-28)
17. "Livescribe". Wikipedia. https://en.wikipedia.org/wiki/Livescribe (checked 2026-09-28)
18. "The Evernote Smart Notebook by Moleskine: paper sketchbooks and journals get connected". Engadget, 25 Aug 2012. https://www.engadget.com/2012-08-25-evernote-smart-notebook-by-moleskine.html (checked 2026-09-28)
19. "Paper Review: Other Leuchtturm 1917 Notebook Options (Part 1 of 3: Whitelines Link)". The Well-Appointed Desk, 2022. https://www.wellappointeddesk.com/2022/03/paper-review-other-leuchtturm-1917-notebook-options-part-1-of-3-whitelines-link/ (checked 2026-09-28)
20. "Paperback Submission Guidelines". Amazon KDP. https://kdp.amazon.com/en_US/help/topic/G201857950 (checked 2026-09-28)
21. Morehead, K., Dunlosky, J., Rawson, K. A. (2019). "How Much Mightier Is the Pen than the Keyboard for Note-Taking?". *Educational Psychology Review* 31(3), via ERIC. https://eric.ed.gov/?id=EJ1225471 (checked 2026-09-28)

Not opened (blocked automated access), cited by reference only:

- ISO/IEC 16022:2024, *Information technology — Automatic identification and data capture techniques — Data Matrix bar code symbology specification*. ISO.
- ISO/IEC 18004 (current edition; 2024 year unconfirmed), *Information technology — Automatic identification and data capture techniques — QR code bar code symbology specification*. ISO.
- Rocketbook Help Center articles "What's the QR Code for?", "Smart Titles" and "Smart Tags" (rocketbookhelp.zendesk.com).
- Mueller, P. A., Oppenheimer, D. M. (2014). "The Pen Is Mightier Than the Keyboard". *Psychological Science* 25(6). DOI 10.1177/0956797614524581.
