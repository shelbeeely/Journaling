# Support and safety facts: verification (checked 2026-09-28)

Scope: every entry in `journal/content/support.json`, `trans.json`, `clinic.json`, and the safety plan page (`safetyPage()` in `journal/render.mjs`).
Sources: the organisation's own pages only (fetched directly), plus the organisation's own domain returned by a search restricted to that domain.
No third-party listings, no cached copies, no Grokipedia.

Status key: **verified** (official page read today) / **changed** (book was wrong or stale, fixed in this PR) /
**partly** (official source seen only as a search snippet from the org's own domain; page itself blocked to this sandbox) /
**UNVERIFIED** (could not reach an official source: call or check before printing).

Why some pages could not be read: fbhwa.org, namispokane.org and transwa.org sit behind a bot captcha (HTTP 202 "sgcaptcha"),
plannedparenthood.org, gonzaga.edu and yvfwc.com return 403 to the sandbox, instagram.com returns 429. Nothing was bypassed.

## Crisis and safety plan (paper p. "My safety plan", support.json "Right now")

| Entry | What the book says | Source | Status |
|---|---|---|---|
| 988 | Call or text 988, chat 988lifeline.org, 24/7, free | https://988lifeline.org/ (call 988, text 988, chat at chat.988lifeline.org, 24/7/365, free) | verified |
| Crisis Text Line | Text HOME to 741741; web chat, WhatsApp; 24/7 | https://www.crisistextline.org/ | verified |
| Frontier crisis line | 1-877-266-1818, 24/7, Spokane + 5 nearby counties, mobile crisis | fbhwa.org "24/7 Regional Crisis Line" (search of fbhwa.org: 24/7 line for Spokane, Adams, Ferry, Lincoln, Pend Oreille, Stevens; 1.877.266.1818). Page itself captcha-blocked | partly (number and counties match; "can send a mobile crisis team" not seen) |
| Frontier walk-in | 107 S Division St, Mon–Fri 7:30 am–4:30 pm | fbhwa.org search snippet confirmed walk-in access and the address; hours only seen on third-party listings | **UNVERIFIED: hours** (call 1-877-266-1818 or check fbhwa.org before printing) |
| Safety plan step 5 | 988; HOME to 741741; Frontier 1-877-266-1818; Trans Lifeline (877) 565-8860 weekdays 10–6 PT | same as rows above and below | matches the verified numbers |
| Trans Lifeline | (877) 565-8860, Mon–Fri 10 am–6 pm PT; no police without consent | https://translifeline.org/hotline/ (same number, 10 AM–6 PM Pacific, Mon–Fri, will not contact emergency services without explicit request) | verified |
| WA Warm Line | 877-500-9276, daily 2–9 pm, up to 20 min, once a day | Crisis Connections (the operator) https://www.crisisconnections.org/wa-warm-line/ : 877-500-9276, 2pm–9pm 7 days, up to 20 minutes, once per day. The NAMI national warmline directory (Mar 2026) lists 9am–10pm; that is a third-party summary, the operator's page wins | verified (re-checked) |
| Trevor Project | Text START to 678-678, call 1-866-488-7386, chat, 24/7, LGBTQ+ young people | https://www.thetrevorproject.org/get-help/ | verified |

## Eating disorders and groups (support.json)

| Entry | What the book says | Source | Status |
|---|---|---|---|
| National Alliance for Eating Disorders, phone and hours | (866) 662-1235, Mon–Fri 6 am–4 pm PT, therapists | https://www.allianceforeatingdisorders.com/ (866-662-1235; 9:00 am–7:00 pm EST Mon–Fri = 6–4 PT; licensed therapists) | verified |
| NAAFED email | referrals@allianceforeatingdisorders.com | https://www.allianceforeatingdisorders.com/contact/ lists only info@allianceforeatingdisorders.com | **changed** to info@ |
| NAMI Spokane groups | "2nd & 4th Tue 6:30–8, in person or online; young adults 1st Tue 5:30" | https://namispokane.org/get-involved/event-calendar/ : 2nd Tue in person, 4th Tue virtual, 6:30–8:00 pm; Young Adult Connection (18–35) 1st Tue 5:30–7:00 pm in person | **changed** (which Tuesday is which; young adult end time) |
| NAMI Spokane contact | text (509) 209-3905, call (509) 838-5515, help@namispokane.org | search of namispokane.org (office hours Mon–Thu 8:30–4:30, Fri 8:30–3:00); page captcha-blocked | partly |
| DBSA | Online peer groups incl. LGBTQ+ groups | https://www.dbsalliance.org/support/chapters-and-support-groups/online-support-groups/ : groups moving to ShareWell (LGBTQ+ Community moves week of Oct 18; all by Nov 1), free, no paid plan needed | **changed** (added ShareWell, singular LGBTQ+ group) |
| Spectrum Center Spokane | "LGBTQ+ community center with support groups" | https://spectrumcenterspokane.org/support-groups : groups are for 2SLGBTQIA+ youth 13–17 and parents/caregivers; adult group "sunsetting December 2025". Address 1514 N Monroe St confirmed. Page's example dates are Nov–Dec 2025, so the page itself may be out of date | **changed** (adult reader would have gone looking for a group that no longer runs) |

## Trans resources (trans.json)

| Entry | What the book says | Source | Status |
|---|---|---|---|
| Trans Lifeline | as above | translifeline.org | verified |
| Spectrum gender doula | "gender doula program" | https://spectrumcenterspokane.org/gender-doula : free, one-on-one, registration required, may be a waitlist, 1 intake + 5 sessions | **changed** (wording: free, sign-up, waitlist) |
| Ingersoll Gender Center | Seattle trans peer groups, provider database, info@ingersollgendercenter.org | https://ingersollgendercenter.org/ (weekly trans peer support group, healthcare provider database, info@ingersollgendercenter.org, 911 E Pike St, Seattle) | verified |
| Planned Parenthood Spokane | Hormones by informed consent (18+), no therapist letter; 123 E Indiana Ave Bldg A, Mon–Fri 8–6; telehealth video/phone/messaging; (866) 904-7721 | plannedparenthood.org search: informed consent, no therapist letter, 123 E. Indiana Ave Building A, (866) 904-7721, telehealth offered. Hours and "18+", and the video/phone/messaging list not shown (hours load by script) | **UNVERIFIED: hours Mon–Fri 8–6, age 18+, telehealth modes** (call (866) 904-7721 first) |
| WA driver's license | M/F/X with a signed form; no note; free by mail if photo stays the same | https://dol.wa.gov/driver-licenses-and-permits/update-driver-license-information/change-your-gender-designation : in person (verbally confirm) or by mail with a Gender Designation Request form; new card free if only gender changes; no medical documentation asked | **changed** (the "photo stays the same" condition is not on the DOL page) |
| WA birth certificate | Adults: M/F/X, notarized form; amend free; copies $25 | https://doh.wa.gov/licenses-permits-and-certificates/vital-records/sex-designation-change-birth-certificate (form DOH 422-143, sign before a notary, no fee to amend, $25 per certified copy) | verified |
| Court name change | Can cost over $300; ask for a fee waiver; gender-related changes can be sealed | Fee waiver rule GR 34 confirmed (courts.wa.gov). The "over $300" figure and sealing were not found on an official page | **UNVERIFIED: "$300" and sealing** |
| Gonzaga Law ID clinic | Free monthly help, notary included, dates on Instagram @zaglawcivilrights | gonzaga.edu search: monthly clinic, free, notary present, announcements on Facebook and Instagram. Handle not shown; Instagram blocked | partly; **UNVERIFIED: the @zaglawcivilrights handle** |
| Trans-Wa | Clinics paused spring 2026, restart Oct 2026; email first; services@transwa.org | transwa.org search (as of April 2026 Name/ID services paused for staff capacity, plan to resume virtual and in-person in October 2026; services@transwa.org). Snippet is from May 2026; page captcha-blocked. Today is Sep 28: re-check that they did restart | partly (recheck in October) |
| Federal IDs | "rules changed in 2025; ask a clinic first" | https://lgbtq.wa.gov/changing-your-identification-documents : federal marker ban being challenged, injunction in place at time of writing | verified (hedged wording still right) |
| Point of Pride | Free femme shapewear; funds for HRT, hair removal, Thrive Fund (wigs, voice training, more) | https://pointofpride.org/ (HRT Access Fund, Electrolysis Support Fund, Thrive Fund incl. wigs and vocal training, free femme shapewear) | verified |

## My clinic (clinic.json, Unify Community Health, Mission)

Unify's own site (yvfwc.com) returns 403 here and unifychc.org does not exist. Only search snippets from yvfwc.com / mychart.yvfwc.org were available.

| Entry | What the book says | Source | Status |
|---|---|---|---|
| Medical | 509-326-4343, can text; after hours call/text same number | yvfwc.com snippet: "For after-hours medical care, call or text (509) 326-4343" | partly |
| Hours | Medical Mon–Fri 7:45 am–7 pm, closed weekends | yvfwc.com brochure title: "Regular Hours Medical Monday - Friday 7:45 AM - 7 PM" | partly (Mission brochure text itself not readable) |
| Pharmacy | 509-323-8757, Mon–Fri 8 am–7 pm, walk-in or mail | number seen only on third-party listings | **UNVERIFIED: number, hours, mail delivery** |
| MyChart | mychart.yvfwc.org | https://mychart.yvfwc.org/MyChart/Authentication/Login (official) | verified |
| Counseling on site; Unify NE 4001 N Cook St, medical + dental | | yvfwc.com has a "Unify Community Health – Cook St" page, contents not readable | **UNVERIFIED: counseling, NE address, dental** |

## Meteor showers (journal/data.mjs, Apr–Sep 2027)

Source: IMO 2027 Meteor Shower Calendar, https://www.imo.net/ShCal27s.pdf (linked from https://www.imo.net/resources/calendar/).
Dates are UT converted to Spokane (PDT); the day-page/sky-list date is the first date of the night.

| Shower | IMO peak | Moon | Book before | Book now |
|---|---|---|---|---|
| Lyrids | Apr 23 01:40 UT = Apr 22 6:40 pm PDT | Full Apr 20, "just three days after Full Moon", worst conditions | Apr 21 | **Apr 22**, "peak night Apr 22–23; bright moon" |
| Eta Aquariids | May 6 09h UT (2 am PDT, best before dawn) | no moonlight interference | May 5 "approx." | May 5 "peak before dawn May 6" (date kept, wording exact) |
| Southern Delta Aquariids | Jul 31 (no time) | no moonlight interference | Jul 30 | **Jul 31**, "peak around Jul 31" |
| Perseids | Aug 13 in table; trail encounters Aug 12 23:46 UT and Aug 13 07h UT | Moon midway first quarter (Aug 9) and full (Aug 17); "moon-free period quite short" | Aug 12 "bright moon" | Aug 12, "peak night Aug 12–13; bright moon" |

Also seen in the same file, not changed: Quadrantids peak Jan 4, 2027 (book keys Jan 3, night of Jan 3–4; consistent with the first-date-of-night rule).
Oct–Dec 2026 showers were not part of this check (IMO 2026 calendar was not fetched).

## STA feed

Downloaded https://www.spokanetransit.com/gtfs on 2026-09-28: feed_version "SEPT 2026v3_20260914", valid 2026-09-20 to 2027-01-16.
Identical to the committed `journal/gtfs/network.json` and `route6.json`, so nothing was regenerated and bus coverage is unchanged
(Oct–Dec full, Jan partial, Feb+ none).
