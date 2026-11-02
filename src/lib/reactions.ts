// Chat reactions (docs/chat.md). A reaction is saved as a short piece of text (up to 16
// characters), so any emoji works, and later the Village can add its own reactions under a
// code (say "v:hammer") that the chat draws as a picture. To offer more emoji, add them here.

/** The row that opens beside a message: one tap to react. */
export const QUICK = ['👍', '👎', '❤️', '😂', '🎉', '👀', '🙏', '🤔'];

/** Behind "More": grouped, each with words to search by. */
export const MORE: { group: string; items: [emoji: string, words: string][] }[] = [
  {
    group: 'Feelings',
    items: [
      ['😀', 'grin happy smile'], ['😄', 'laugh happy'], ['😅', 'sweat phew relief'], ['🤣', 'rofl rolling laugh'],
      ['😊', 'blush smile happy'], ['😍', 'love heart eyes'], ['🥰', 'love hearts adore'], ['😎', 'cool sunglasses'],
      ['🤩', 'star struck wow'], ['🥳', 'party celebrate'], ['😮', 'wow surprised oh'], ['😲', 'shocked astonished'],
      ['🤯', 'mind blown'], ['😱', 'scream fear'], ['😬', 'grimace awkward yikes'], ['😏', 'smirk'],
      ['🙃', 'upside down silly'], ['😉', 'wink'], ['😐', 'neutral meh'], ['😑', 'expressionless'],
      ['🙄', 'eye roll'], ['😴', 'sleep tired zzz'], ['🥲', 'smile tear bittersweet'], ['😢', 'cry sad tear'],
      ['😭', 'sob crying'], ['😤', 'huff triumph'], ['😡', 'angry mad'], ['🤬', 'swear rage'],
      ['🥺', 'pleading puppy eyes'], ['🤔', 'thinking hmm'], ['🫡', 'salute yes sir'], ['🤐', 'zipper secret'],
      ['🤫', 'shush quiet secret'], ['🤓', 'nerd glasses'], ['🥴', 'woozy dizzy'], ['💀', 'skull dead dying laughing'],
    ],
  },
  {
    group: 'Hands',
    items: [
      ['👍', 'thumbs up yes agree'], ['👎', 'thumbs down no disagree'], ['👏', 'clap applause'], ['🙌', 'raise hands hooray'],
      ['🙏', 'pray thanks please'], ['👀', 'eyes look watching'], ['💪', 'strong muscle flex'], ['🤝', 'handshake deal'],
      ['👋', 'wave hello bye'], ['✌️', 'peace victory'], ['🤞', 'fingers crossed luck'], ['👌', 'ok perfect'],
      ['🫶', 'heart hands love'], ['🤷', 'shrug dunno'], ['🤦', 'facepalm'], ['☝️', 'point up one'],
    ],
  },
  {
    group: 'Celebrate',
    items: [
      ['🎉', 'party tada celebrate'], ['🎊', 'confetti'], ['🏆', 'trophy win'], ['🥇', 'gold medal first'],
      ['⭐', 'star'], ['🌟', 'glowing star'], ['✨', 'sparkles shiny'], ['🔥', 'fire hot lit'],
      ['💯', 'hundred perfect'], ['🚀', 'rocket launch'], ['👑', 'crown king queen'], ['💎', 'gem diamond'],
    ],
  },
  {
    group: 'Hearts',
    items: [
      ['❤️', 'heart love red'], ['🧡', 'orange heart'], ['💛', 'yellow heart'], ['💚', 'green heart'],
      ['💙', 'blue heart'], ['💜', 'purple heart'], ['🖤', 'black heart'], ['💔', 'broken heart'],
    ],
  },
  {
    group: 'Games and things',
    items: [
      ['🎮', 'game controller play'], ['🕹️', 'joystick arcade'], ['🎲', 'dice luck random'], ['🧩', 'puzzle piece'],
      ['⚔️', 'swords fight battle'], ['🛡️', 'shield defend'], ['🏹', 'bow arrow'], ['🪄', 'magic wand'],
      ['🐉', 'dragon'], ['🗺️', 'map world'], ['🧭', 'compass'], ['🏰', 'castle'],
      ['💰', 'money bag gold'], ['🔨', 'hammer build'], ['🛠️', 'tools fix'], ['📌', 'pin'],
      ['📝', 'memo note write'], ['📚', 'books read'], ['🔍', 'search look find'], ['💡', 'idea bulb'],
      ['⏳', 'hourglass wait'], ['🐛', 'bug'], ['🤖', 'robot'], ['👻', 'ghost boo'],
    ],
  },
  {
    group: 'Symbols',
    items: [
      ['✅', 'check yes done confirm'], ['❌', 'cross no wrong'], ['⚠️', 'warning careful'], ['❓', 'question'],
      ['❗', 'exclamation important'], ['➕', 'plus add'], ['🆗', 'ok'], ['🆕', 'new'],
      ['🔁', 'repeat again'], ['⬆️', 'up'], ['⬇️', 'down'], ['🚫', 'no forbidden'],
    ],
  },
];

/** Emoji whose words match what was typed ("heart", "yes"), or every one. */
export function findReactions(query: string) {
  const q = query.trim().toLowerCase();
  return MORE.flatMap((g) => g.items).filter(([e, words]) => !q || words.includes(q) || e === q).map(([e]) => e);
}
