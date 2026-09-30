// Module switches: the one list, used by the profile, the library (series and book overrides) and the studio.
// Off = the module's pages and blocks are left out of the book (never a dangling page reference).
export const MODULES = {
  bus: 'Bus schedule pages (needs a transit feed: paths.transit and the transit section)',
  sky: 'Moon and sky: the sky & seasons and moon pages, and the day page moon/sun/season line',
  trans_support: 'The trans support directory page (needs paths.trans)',
  therapy: 'Therapy pack day-page blocks (feelings, skills, urge, thought record)',
  spoons: 'Spoon counting: spoons and energy account blocks, the spoon notes and the Good-spoon box',
  pay_periods: 'Pay period and payday marks (needs your own pay sheet in payperiods.mjs)',
};
// Day-page block types each module owns (daypage.mjs TYPES). Off = those blocks are switched off in the layout.
export const MODULE_BLOCKS = {
  sky: ['sky'],
  spoons: ['spoons', 'accounts'],
  therapy: ['feelings', 'skills', 'urge', 'thought'],
};
