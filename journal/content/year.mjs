// Year-long content for the 12 monthly books (Oct 2026 – Sep 2027), indexed by global week
// (week 0 = Mon Sep 28 2026). Facts are keyed by 'MM-DD'.
import { FACTS as FACTS_Q4 } from '../facts.mjs';
import { PIONEERS as PIONEERS_Q4 } from '../pioneers.mjs';
import { WORDS as WORDS_Q4 } from '../japanese.mjs';
import { FACTS_2027, PIONEERS_2027 } from './year-research.mjs';

export const FACTS = { ...FACTS_Q4, ...FACTS_2027 };

// [kanji, kana, romaji, meaning] — seasonal words for Jan–Sep 2027 (weeks 14–51)
export const WORDS = [
  ...WORDS_Q4,
  ['新年', 'しんねん', 'shinnen', 'new year'],
  ['目標', 'もくひょう', 'mokuhyō', 'goal'],
  ['寒い', 'さむい', 'samui', 'cold (weather)'],
  ['温かい', 'あたたかい', 'atatakai', 'warm (to the touch)'],
  ['節分', 'せつぶん', 'setsubun', 'eve of spring (Feb 3)'],
  ['梅', 'うめ', 'ume', 'plum blossom'],
  ['光', 'ひかり', 'hikari', 'light'],
  ['雪解け', 'ゆきどけ', 'yukidoke', 'snowmelt'],
  ['春', 'はる', 'haru', 'spring'],
  ['雨', 'あめ', 'ame', 'rain'],
  ['芽', 'め', 'me', 'sprout, bud'],
  ['桜', 'さくら', 'sakura', 'cherry blossom'],
  ['花見', 'はなみ', 'hanami', 'flower viewing'],
  ['始める', 'はじめる', 'hajimeru', 'to begin'],
  ['風', 'かぜ', 'kaze', 'wind'],
  ['鳥', 'とり', 'tori', 'bird'],
  ['緑', 'みどり', 'midori', 'green'],
  ['散歩', 'さんぽ', 'sanpo', 'a walk, a stroll'],
  ['夢', 'ゆめ', 'yume', 'dream'],
  ['笑顔', 'えがお', 'egao', 'smiling face'],
  ['梅雨', 'つゆ', 'tsuyu', 'rainy season'],
  ['紫陽花', 'あじさい', 'ajisai', 'hydrangea'],
  ['蛍', 'ほたる', 'hotaru', 'firefly'],
  ['夏', 'なつ', 'natsu', 'summer'],
  ['海', 'うみ', 'umi', 'sea'],
  ['空', 'そら', 'sora', 'sky'],
  ['七夕', 'たなばた', 'tanabata', 'star festival (Jul 7)'],
  ['暑い', 'あつい', 'atsui', 'hot (weather)'],
  ['花火', 'はなび', 'hanabi', 'fireworks'],
  ['風鈴', 'ふうりん', 'fūrin', 'wind chime'],
  ['休み', 'やすみ', 'yasumi', 'a break, day off'],
  ['お盆', 'おぼん', 'obon', 'Obon festival (mid-August)'],
  ['星空', 'ほしぞら', 'hoshizora', 'starry sky'],
  ['虫', 'むし', 'mushi', 'insect, bug'],
  ['秋', 'あき', 'aki', 'autumn'],
  ['本', 'ほん', 'hon', 'book'],
  ['実り', 'みのり', 'minori', 'harvest, ripening'],
  ['一年', 'いちねん', 'ichinen', 'one year'],
  ['続く', 'つづく', 'tsuzuku', 'to continue'],
];

export const PROMPTS = [
  'Something small you noticed this week.', 'What made you laugh?', 'A song that fits this week.', 'Ask me one question.',
  'Describe the sky the last time you looked up.', 'What are you looking forward to?', 'A thing you want to remember from this month.',
  'What drained your spoons, and what refilled them?', 'Draw something. Anything.', 'A small win nobody saw.', 'What are you grateful for right now?',
  'What would make next week gentler?', 'What do you want to leave behind in 2026?', 'One hope for the new year.',
  // weeks 14–51
  'What is one thing you want to learn this year?', 'Describe your perfect lazy day.', 'What is the coziest thing you own?',
  'Tell me about a smell that brings back a memory.', 'Recommend me something: a show, a song, a snack.', 'What are you proud of this month?',
  'What would you name a houseplant?', 'Describe the view out the nearest window.', 'What is a tiny rule you live by?',
  'What made you feel understood lately?', 'Draw your week as weather.', 'What is something you changed your mind about?',
  'Which season are you right now, and why?', 'What would you put in a time capsule?', 'Tell me a fact you love.',
  'Where would you go if you had a free day and a bus pass?', 'What does a good morning look like?', 'What is on your mind that you haven’t said out loud?',
  'List three things that felt easy this week.', 'What is your comfort show or movie?', 'If you could build any gadget, what would it do?',
  'What sound calms you down?', 'Describe a place you felt safe.', 'Ask me something you have always wondered.',
  'What is the best thing you heard recently?', 'What would summer-you tell winter-you?', 'Make a wish for the stars.',
  'What are you trying to be gentler about?', 'Draw something from outside.', 'What is a song you could replay forever?',
  'What did you do for fun as a kid?', 'Who is someone you are thankful for, and why?', 'Describe the night sky this week.',
  'What is a small adventure you could take this month?', 'What have you been collecting lately (things, ideas, feelings)?', 'What is a book or story that stuck with you?',
  'What grew this year, in you or around you?', 'Looking back at a year of these pages: what surprised you?',
  'What do you want to carry into the next year of pages?',
];

// Pioneers by global week (52). Vol 1's 14 stay in weeks 0–13; weeks 14–51 are filled by pioneerOrder() in render.
export const PIONEERS = [...PIONEERS_Q4, ...PIONEERS_2027];
