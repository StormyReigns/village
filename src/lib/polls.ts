// Chat polls (docs/chat.md, Matt 2026-11-21): "Design A or Design B?" in the Workshop chat. The
// question is the message's words; the poll holds 2 to 4 choices (a short label, a picture if the
// asker added one) and when it ends. Votes are named, one each, and can be changed or taken back
// while the poll is open. The database checks all of this too (20261202000000_chat_polls.sql).

export interface PollOption { label: string; image?: { path: string; w: number; h: number } }
export interface Poll { options: PollOption[]; endsAt: string }
/** One person's vote: which choice (0 to 3), who, and their name to show. */
export interface PollVote { choice: number; by: string; name: string }

export const MAX_CHOICES = 4;
export const MAX_LABEL = 80;
/** How long a poll runs, picked by the asker. */
export const LENGTHS = [{ label: '1 hour', hours: 1 }, { label: '1 day', hours: 24 }, { label: '3 days', hours: 72 }] as const;
export const DEFAULT_HOURS = 24;

/** A poll as the database stores it, or null if it isn't one. */
export function toPoll(raw: unknown): Poll | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { options?: unknown; ends_at?: unknown };
  if (!Array.isArray(r.options) || typeof r.ends_at !== 'string') return null;
  const options = r.options.flatMap((o): PollOption[] => {
    if (!o || typeof o !== 'object' || typeof (o as PollOption).label !== 'string') return [];
    const { label, image } = o as PollOption;
    return [image && typeof image.path === 'string' ? { label, image: { path: image.path, w: Number(image.w) || 0, h: Number(image.h) || 0 } } : { label }];
  });
  return options.length >= 2 ? { options, endsAt: r.ends_at } : null;
}

/** The poll as it's sent: labels tidied, empty choices left out, and when it ends. */
export function pollToSend(options: PollOption[], hours: number, now = Date.now()) {
  return {
    options: options.map((o) => ({ ...o, label: o.label.trim() })).filter((o) => o.label),
    ends_at: new Date(now + hours * 3600e3).toISOString(),
  };
}

/** What stops a poll being posted, in plain words, or null when it's ready. */
export function pollProblem(question: string, options: PollOption[]): string | null {
  const named = options.filter((o) => o.label.trim());
  if (!question.trim()) return 'Type the question in the box first.';
  if (named.length < 2) return 'A poll needs at least two choices.';
  if (options.some((o) => !o.label.trim() && o.image)) return 'Give each picture a short name.';
  if (named.some((o) => o.label.trim().length > MAX_LABEL)) return `Keep each choice under ${MAX_LABEL} letters.`;
  return null;
}

export const isOpen = (poll: Poll, now = Date.now()) => new Date(poll.endsAt).getTime() > now;

/** "ends in 21h", "ends in 40m", "ends in under a minute". */
export function endsIn(poll: Poll, now = Date.now()) {
  const mins = Math.ceil((new Date(poll.endsAt).getTime() - now) / 60000);
  if (mins <= 1) return 'ends in under a minute';
  if (mins < 60) return `ends in ${mins}m`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `ends in ${hours}h` : `ends in ${Math.round(hours / 24)} days`;
}

/** Counts per choice, who picked each (in the order they voted), the total, and the leaders. */
export function tally(poll: Poll, votes: PollVote[]) {
  const counts = poll.options.map(() => 0);
  const names: string[][] = poll.options.map(() => []);
  for (const v of votes) {
    if (v.choice < 0 || v.choice >= counts.length) continue;
    counts[v.choice] += 1;
    names[v.choice].push(v.name);
  }
  const total = counts.reduce((a, b) => a + b, 0);
  const top = Math.max(...counts);
  const leaders = total ? counts.flatMap((c, i) => (c === top ? [i] : [])) : [];
  return { counts, names, total, leaders };
}

/** The line under an ended poll: who won, a tie, or nobody voted. */
export function result(poll: Poll, votes: PollVote[]) {
  const { counts, total, leaders } = tally(poll, votes);
  if (!total) return 'Ended · no votes';
  const of = `${counts[leaders[0]]} of ${total} ${total === 1 ? 'vote' : 'votes'}`;
  if (leaders.length > 1) return `Ended · tied: ${leaders.map((i) => poll.options[i].label).join(' and ')} (${counts[leaders[0]]} each)`;
  return `Ended · ${poll.options[leaders[0]].label} won · ${of}`;
}

/** "You, Theo, Kai" or "You, Theo and 3 more", for under a choice. */
export function voterLine(names: string[], max = 3) {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max - 1).join(', ')} and ${names.length - max + 1} more`;
}
