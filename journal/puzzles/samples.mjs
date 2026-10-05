// The built-in sample word lists for the puzzle blocks: generic, original words with original clues (written for this project, CC0).
// A puzzles pack (packs/kinds.mjs, kind "puzzles") adds more lists of the same shape. Each entry is [WORD, clue]; the clue never contains its word.
// Word search blocks use the words; crossword blocks use the words and the clues.
export const PZ_SAMPLE_LISTS = {
  garden: { title: 'Garden', entries: [
    ['SEED', 'A small promise you bury and water'], ['SOIL', 'What roots hold on to'], ['ROOT', 'The part of a plant nobody sees'], ['LEAF', 'A plant\'s way of catching sunshine'],
    ['BLOOM', 'What a bud works toward'], ['PETAL', 'One soft piece of a flower\'s crown'], ['STEM', 'The plant\'s straw for drinking upward'], ['WEED', 'A plant growing where nobody invited it'],
    ['RAKE', 'Tined tool for gathering fallen leaves'], ['TROWEL', 'A hand-sized shovel'], ['COMPOST', 'Kitchen scraps turning back into soil'], ['MULCH', 'A blanket of bark or straw over the beds'],
    ['HERB', 'Basil or mint, say'], ['VINE', 'A climber that borrows the fence'], ['SHADE', 'Relief from a hot afternoon sun'], ['SPROUT', 'The first green sign from a buried seed'],
    ['TULIP', 'A spring cup of colour on a single stalk'], ['FERN', 'Feathery green plant that never flowers'],
  ] },
  kitchen: { title: 'Kitchen', entries: [
    ['KETTLE', 'Heats the water for tea'], ['TOAST', 'Bread, browned'], ['SOUP', 'Comfort in a bowl, served with a spoon'], ['SPOON', 'Stirs the pot or scoops the sugar'],
    ['WHISK', 'Wire loops for beating eggs'], ['LADLE', 'Deep scoop for serving soup'], ['OVEN', 'Where the bread rises and browns'], ['STEW', 'Slow-cooked and hearty, with chunks'],
    ['BREAD', 'A loaf from flour, water and yeast'], ['BUTTER', 'Churned cream, spread thin'], ['HONEY', 'Golden sweetness made by bees'], ['SPICE', 'Cinnamon or cumin on the rack'],
    ['PEPPER', 'The grinder\'s black speckles'], ['GARLIC', 'A pungent bulb with many cloves'], ['ONION', 'Layers that bring on tears'], ['TEAPOT', 'Holds the brew until it is poured'],
    ['PLATE', 'Flat dish under the dinner'], ['BOWL', 'Round dish for cereal or soup'],
  ] },
  sky: { title: 'Night sky', entries: [
    ['MOON', 'Earth\'s companion, lit by borrowed light'], ['STAR', 'A distant sun, twinkling'], ['COMET', 'Icy visitor with a glowing tail'], ['ORBIT', 'The path a planet travels around its sun'],
    ['PLANET', 'A world that circles a star'], ['AURORA', 'Curtains of green light near the poles'], ['METEOR', 'A streak of light across the dark'], ['CRESCENT', 'A thin, curved sliver of lit moon'],
    ['GALAXY', 'Billions of stars bound by gravity'], ['DUSK', 'The hour as daylight fades'], ['DAWN', 'The first grey-pink light'], ['TIDE', 'The sea\'s slow rise and fall'],
    ['LUNAR', 'Of the moon'], ['SOLAR', 'Of the sun'], ['TWILIGHT', 'Soft light between sunset and dark'], ['COSMOS', 'Everything there is, out to the stars'],
    ['ECLIPSE', 'When one body hides another\'s light'],
  ] },
  calm: { title: 'Calm', entries: [
    ['REST', 'Permission to stop'], ['BREATHE', 'In through the nose, out slowly'], ['QUIET', 'The sound of no sound'], ['SLOW', 'A snail\'s pace, and sometimes the wisest'],
    ['PAUSE', 'A comma in your day'], ['BLANKET', 'Soft weight on the couch'], ['CANDLE', 'A small flame on the table'], ['STRETCH', 'Reach up, then let your shoulders drop'],
    ['SOFT', 'Pleasant to touch, like a worn sweater'], ['WARM', 'Like a mug held in both hands'], ['WALK', 'Gentle exercise, no destination needed'], ['SIGH', 'A long breath out, letting go'],
    ['EASE', 'To make less tight or heavy'], ['PEACE', 'A settled, undisturbed feeling'], ['STILL', 'Not moving at all'], ['DREAM', 'What sleep sometimes paints'],
  ] },
};
export const PZ_SAMPLE_IDS = Object.keys(PZ_SAMPLE_LISTS);
