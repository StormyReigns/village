// A game's own words, explained in a sentence. Players tap the word in an entry to see it.
// Our own wording, based only on what the game's entries already say. Add a word by adding
// a line; matching ignores capital letters.

/** Games whose dates (like 9/2–9/8) are days on the in-game calendar, so we say so. */
export const IN_GAME_DATES = new Set(['fortunes-weave']);

export const GLOSSARY: Record<string, Record<string, string>> = {
  'fortunes-weave': {
    Renown: 'Your standing as a commander. Quests and paralogues pay it out, and recruiting units or buying class licenses asks for a minimum level.',
    Support: 'Your bond with a unit. A gift starts it, and recruiting a unit asks for a certain Support level with them.',
    'Flame Lord': "The lord whose route you're playing. It changes which units can join, and when things happen.",
    Paralogue: 'An optional side chapter, often tied to one unit. Many can only be done during a set window.',
  },
};
