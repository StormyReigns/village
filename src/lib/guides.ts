// The steps of a guide (Block 3, docs/blocks/guides.md). A guide's steps are kept as they
// always have been: one step per line of its "Steps" text, so Drafts, history and the guides
// already live work unchanged. Two marks ride along on a line:
//   ||Beat the boss with Fabio||       a spoiler step, covered until the player taps it
//   Go up the stairs [picture:path]    a picture, kept in the guide-pictures bucket

export const STEPS = 'Steps';
export const TIP = 'Tip';
export const WATCH_OUT = 'Watch out';
/** Where guide pictures live (supabase/migrations/20261106000000_guide_pictures.sql). */
export const GUIDE_PICTURES = 'guide-pictures';

export interface Step { text: string; spoiler: boolean; picture?: string }

const PICTURE = /\s*\[picture:([^\]\s]*)\]/;

/**
 * Whether a picture mark names one of our own uploads: game/person/uuid.ext in the
 * guide-pictures bucket, nothing else. Never a web address, never "..", so a step can't
 * point players at a picture somewhere else.
 */
export const isPicturePath = (path: string) =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:webp|jpg|gif|png)$/.test(path);

/** One line as a step. A picture mark that isn't one of our uploads is dropped. */
export function parseStep(line: string): Step {
  let text = line.trim();
  const pic = PICTURE.exec(text);
  if (pic) text = (text.slice(0, pic.index) + text.slice(pic.index + pic[0].length)).trim();
  const spoiler = text.length > 4 && text.startsWith('||') && text.endsWith('||');
  if (spoiler) text = text.slice(2, -2).trim();
  return { text, spoiler, picture: pic && isPicturePath(pic[1]) ? pic[1] : undefined };
}

/** A guide's "Steps" text as steps. Blank lines are skipped. */
export const parseSteps = (text: string | undefined): Step[] => (text ?? '').split('\n').filter((l) => l.trim()).map(parseStep);

/** A step back as one line. Line breaks inside a step become spaces, so it stays one step. */
export function stepLine(s: Step): string {
  const text = s.text.replace(/\s*\n\s*/g, ' ').trim();
  if (!text && !s.picture) return '';
  const body = s.spoiler && text ? `||${text}||` : text;
  return [body, s.picture && isPicturePath(s.picture) ? `[picture:${s.picture}]` : ''].filter(Boolean).join(' ');
}

/** Steps back as the "Steps" text. Empty steps are dropped. */
export const stepsText = (steps: Step[]) => steps.map(stepLine).filter(Boolean).join('\n');

/** How many steps a guide has, for its row in the list. */
export const stepCount = (text: string | undefined) => parseSteps(text).length;

/** A step as plain words, for search and for "What changes" (marks spelled out). */
export function stepWords(s: Step) {
  return [s.spoiler ? `(spoiler) ${s.text}` : s.text, s.picture ? '(picture)' : ''].filter(Boolean).join(' ');
}
