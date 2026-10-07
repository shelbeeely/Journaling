# Support pack fact-check, October 2026

Checked 2026-10-06 against `journal/packs/spokane-wa/` (`support.json`, `trans.json`, `clinic.json`). Read-only review: the pack was **not** edited, nothing was marked verified, and no phone number was called.

## How to read this

- Verdicts: **matches**, **differs**, **could not confirm**.
- Method limit: the organisations' own sites (fbhwa.org, transwa.org, plannedparenthood.org, yvfwc.com, gonzaga.edu, spokanecounty.gov) returned 403 or a captcha to direct fetches from this environment. Every "official source" finding below is therefore the text of the organisation's own page as returned in a web-search result for that page, not a page I could open and read in full. Treat each as a strong lead, and re-open the page in a browser before marking anything verified.
- Third-party listings (WA 211, detox.com, etc.) were seen but are not used as evidence.
- Crisis lines are listed only for what the organisation's own page states. They already carry a `verified` note from 2026-09-28 and were not re-checked here, except Frontier.

## support.json

| Item | Pack says | Official source says | Source (checked 2026-10-06) | Verdict |
|---|---|---|---|---|
| Frontier crisis line | 1-877-266-1818, 24/7; Spokane and 5 nearby counties; can send a mobile crisis team | 24/7 regional crisis line, 1.877.266.1818, for Spokane, Adams, Ferry, Lincoln, Pend Oreille and Stevens counties; triage clinicians dispatch mobile teams or Designated Crisis Responders | https://fbhwa.org/programs/crisis-response/24-7-regional-behavioral-health-crisis-line | matches (also resolves the mobile-team part of the earlier "partly" note) |
| Frontier walk-in ("Walk in") | Frontier Behavioral Health, 107 S Division St, Mon-Fri 7:30 am-4:30 pm | Frontier's Access to Care office is at **131 S Division St** with walk-ins Mon-Fri 7:30 am-4:30 pm. 107 S Division St is listed as Frontier's mailing address and outpatient site (Mary Higgins), with no walk-in hours seen. | https://fbhwa.org/about/contact/ , https://fbhwa.org/about/referrals | **differs** (hours match, address appears wrong) |
| Trans Lifeline | (877) 565-8860, Mon-Fri 10-6 PT | Not re-checked; already verified 2026-09-28 | https://translifeline.org/hotline/ | not re-checked |
| 988, Crisis Text Line, WA Warm Line, Trevor Project, NAEDA | see pack | Not re-checked; already carry `verified` | n/a | not re-checked |
| NAMI Spokane | Text (509) 209-3905, call (509) 838-5515, help@namispokane.org | Same phone, text and help@ address on NAMI's contact page. Group times not re-checked. | https://namispokane.org/contact/ | matches (contacts only; closes the "partly" note for numbers) |
| Spectrum Center Spokane | 1514 N Monroe St; youth 13-17 and caregiver groups; adult group ended Dec 2025 | Address matches. The support-groups page text lists **four** groups: youth 13-17, adults 18+, QTBIPOC adults 18+, parents/caregivers. Gender doula is free, registration required. | https://www.spectrumcenterspokane.org/support-groups , /gender-doula | **differs** on the adult group (the snippet may be stale; the pack note already says the page has 2025 dates) |

## trans.json

| Item | Pack says | Official source says | Source (checked 2026-10-06) | Verdict |
|---|---|---|---|---|
| Planned Parenthood hours | 123 E Indiana Ave, Bldg A, Mon-Fri 8-6 | Planned Parenthood's own page text could not be read. Mon-Fri 8-6 appeared only in third-party listings. | https://www.plannedparenthood.org/health-center/washington/spokane/99207/spokane-health-center-2794-91850 (403) | could not confirm |
| Planned Parenthood hormones, age | Informed consent (18+), no therapist letter | Informed-consent model, no therapist letter; hormone care for 18 and older | https://www.plannedparenthood.org/planned-parenthood-greater-washington-north-idaho/our-services/transgender-and-gender-affirming-health-care , https://www.plannedparenthood.org/planned-parenthood-great-northwest-hawaii-alaska-indiana-kentuck/patients/health-care-services/hrt-hormone-therapy-for-trans-and-non-binary-patients | matches |
| Planned Parenthood telehealth and phone | Telehealth by video, phone or messaging; (866) 904-7721 | Telehealth offered for Washington residents; "To schedule a telehealth appointment, call 866.904.7721". "Video, phone or messaging" as three modes was not seen. | https://www.plannedparenthood.org/health-center/washington/spokane/99207/spokane-health-center-2794-91850/gender-affirming-care | matches for number and telehealth; modes could not confirm |
| Court name-change fee | "Can cost over $300; ask for a fee waiver. Gender-related changes can be sealed." | Spokane County: filing fee **$287** (includes one certified copy), plus a 3.5% card service fee. A search summary of the county pages also gave $290 for Superior Court and $287 for District Court, so the exact figure needs a look at the county fee page. Adults normally file in District Court; file in Superior Court if you want the change **sealed** for gender expression or identity. Fee waiver: GR 34 motion, Superior Court Ex Parte, Courtroom 202, Mon/Wed/Fri. If the filing fee is waived, the court orders the auditor's related fees waived too. | https://www.spokanecounty.gov/3074/Name-Change-Forms , https://www.spokanecounty.gov/DocumentCenter/View/52736/Sealed-Adult-Name-Change-Packet (rev. 03/12/2026) , https://www.courts.wa.gov/court_rules/pdf/GR/GA_GR_34_00_00.pdf , https://www.washingtonlawhelp.org/en/ask-court-fee-waiver | **differs** on "over $300" (about $287-290, near $300 only with card fee and extra copies); sealing and fee waiver match |
| Gonzaga Law ID clinic | Free monthly help, name and gender marker, notary included; Instagram @zaglawcivilrights | Gonzaga's page: monthly clinic, free, notarization included; dates announced on Facebook and Instagram. The handle itself did not appear in what I could read. | https://www.gonzaga.edu/school-of-law/clinic-centers/center-for-civil-human-rights/name-and-gender-change-id-clinic | clinic details match; **handle could not confirm** |
| Trans-Wa | Clinics paused spring 2026, planned to restart Oct 2026; email first; services@transwa.org | Name & ID page: services paused as of April 2026 for staff capacity, plans to resume virtual appointments and in-person clinics in October 2026. services@transwa.org is the address for requesting gender-affirming-letter appointments; info@transwa.org is the general address. | https://transwa.org/nidc/ , https://transwa.org/services/ | matches on pause and plan. Whether clinics **actually restarted** could not confirm (page text is dated April 2026). services@ is the GAL address, not clearly the name/ID one. |
| Trans Lifeline, driver's license, birth certificate, federal IDs, Ingersoll, Point of Pride | see pack | Not re-checked; already carry `verified` | n/a | not re-checked |

## clinic.json (Unify Community Health, Mission)

| Item | Pack says | Official source says | Source (checked 2026-10-06) | Verdict |
|---|---|---|---|---|
| Medical | 509-326-4343, text OK; after hours same number | 509-326-4343 (SMS capable); after-hours call or text the same number | https://www.yvfwc.com/locations/unify-community-health-mission/ | matches |
| Pharmacy | 509-323-8757, Mon-Fri 8 am-**7** pm; walk-in or mail | Same number. Pharmacy hours Mon-Fri 8 am-**5** pm. On-site pharmacy and mail-delivery prescriptions listed. | same page | **differs** (closing time) |
| Hours | Medical Mon-Fri 7:45 am-7 pm, closed weekends; counseling and therapy on site | Medical Mon-Fri 7:45 am-7 pm, Sat-Sun closed; mental health counseling and therapy listed | same page | matches |
| Address | 120 W Mission Ave, Spokane 99201 | Same | same page | matches |
| Also (Unify NE) | 4001 N Cook St (Northeast Community Center): medical and dental, same medical number | Address 4001 N Cook St, Spokane 99207; phone 509-326-4343; doctor and dental care. Hours shown 7:45 am-7 pm Mon-Fri with other department hours listed; counseling at NE not stated. | https://www.yvfwc.com/locations/unify-community-health-ne/ | matches for address, number, medical, dental; counseling not claimed, none confirmed |

`seasons.json`, `gtfs/` and `research/` contain no phone, hours, fee or handle claims in the support sense and were not reviewed here.

## Recommended edits (for the owner to approve; none made)

1. **Walk in (support.json):** change the address from 107 S Division St to 131 S Division St (Access to Care), keep Mon-Fri 7:30-4:30. Confirm by phone or in a browser first.
2. **Pharmacy (clinic.json):** change "8 am-7 pm" to "8 am-5 pm".
3. **Court name change (trans.json):** replace "over $300" with the county figure, for example "about $290 in Spokane County (check the clerk's page); fee waiver via GR 34", and keep the sealing line, noting sealed changes are filed in Superior Court.
4. **Planned Parenthood (trans.json):** keep 18+, no letter and (866) 904-7721. Change "video, phone or messaging" to "telehealth" unless the three modes are confirmed. Hours and street address still need a browser check on plannedparenthood.org.
5. **Trans-Wa (trans.json):** after Oct 2026 confirm the clinics restarted. Use info@transwa.org if the clinic page gives no name/ID address.
6. **Gonzaga (trans.json):** confirm the Instagram handle by opening Gonzaga Law's page or Instagram; if it cannot be confirmed, say "dates on Gonzaga Law's Facebook and Instagram".
7. **Spectrum Center (support.json):** the site now appears to list an adult 18+ group; confirm and drop "the adult group ended Dec 2025" if so.
8. After approved edits: run `node packs-cli.mjs seal spokane-wa` and add `verified` notes (who, date, source) only for items opened and read on the official page.

## Items I could not confirm, and why

- Planned Parenthood Spokane hours and street address: plannedparenthood.org returned 403; only third-party listings showed them.
- Gonzaga Instagram handle: Gonzaga's page was blocked for direct fetch and the search text did not include the handle.
- Trans-Wa restart status: the live page was captcha-blocked; the latest text I saw is from April 2026.
- Court fee exact figure: county pages blocked; summaries gave $287 and $290.
- Spectrum adult group and Planned Parenthood "messaging": snippet text only, possibly stale or incomplete.
