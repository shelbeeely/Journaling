// A generic sample library (Northlight: the generic profile's book, plus two series) for the public demo and the tests.
// Nothing personal: invented titles only. journal/library.mjs validates it (the editor test checks that it does).
export const SAMPLE_LIBRARY = {
  version: 1,
  books: [
    { id: 'northlight', title: 'Northlight', subtitle: 'A sky and season journal', start: '2026-10', edition: 1 },
    { id: 'autumn-2026', title: 'Autumn', subtitle: 'A season journal', seriesId: 'seasons', start: '2026-09' },
    { id: 'winter-2026', title: 'Winter', subtitle: 'A season journal', seriesId: 'seasons', start: '2026-12' },
    { id: 'spring-2027', title: 'Spring', subtitle: 'A season journal', seriesId: 'seasons', start: '2027-03' },
    { id: 'practice-one', title: 'Practice book one', subtitle: 'Undated pages', seriesId: 'practice', plan: { scope: 'undated', undated: { days: 60 } } },
    { id: 'practice-two', title: 'Practice book two', subtitle: 'Undated pages', seriesId: 'practice', plan: { scope: 'undated', undated: { days: 60 } } },
  ],
  series: [
    { id: 'seasons', title: 'Season journals', subtitle: 'One book for each season', order: ['autumn-2026', 'winter-2026', 'spring-2027'], defaults: { plan: { scope: 'season' } }, show: ['cover', 'titlepage'] },
    { id: 'practice', title: 'Undated practice books', subtitle: 'Start any day', order: ['practice-one', 'practice-two'] },
  ],
  layouts: [],
  defaultBook: 'northlight',
};
