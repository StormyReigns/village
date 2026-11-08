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

// ---------------------------------------------------------------- Write-up
// The creative version of a guide (Matt, 2026-11-08): a short article of sections, kept as the
// "Write-up" text. A section starts at a "## Heading" line ("##" alone for one without a
// heading); the text before the first one is a section without a heading. Inside a section,
// a "[spoiler]" line covers it until tapped and a "[picture:…]" line is its picture (the same
// bucket and rules as a step's). Everything else is its words; a blank line starts a new
// paragraph.

export const WRITEUP = 'Write-up';

export interface WriteSection { heading: string; text: string; spoiler: boolean; picture?: string }

const HEADING = /^##(?:\s+(.*))?$/;
const SPOILER_LINE = /^\[spoiler\]$/i;
const PICTURE_LINE = /^\[picture:([^\]\s]*)\]$/;

/** A guide's "Write-up" text as sections. Empty sections are skipped. */
export function parseWriteup(text: string | undefined): WriteSection[] {
  const out: WriteSection[] = [];
  let cur: WriteSection & { lines: string[] } = { heading: '', text: '', spoiler: false, lines: [] };
  const close = () => {
    const words = cur.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (cur.heading || words || cur.picture) out.push({ heading: cur.heading, text: words, spoiler: cur.spoiler, picture: cur.picture });
  };
  for (const raw of (text ?? '').split('\n')) {
    // Marks count only at the very start of a line, so words nudged by a space stay words.
    const line = raw.trimEnd();
    const h = HEADING.exec(line);
    if (h) { close(); cur = { heading: (h[1] ?? '').trim(), text: '', spoiler: false, lines: [] }; continue; }
    if (SPOILER_LINE.test(line)) { cur.spoiler = true; continue; }
    const pic = PICTURE_LINE.exec(line);
    if (pic) { if (isPicturePath(pic[1])) cur.picture = pic[1]; continue; }
    cur.lines.push(line.trim());
  }
  close();
  return out;
}

/** Sections back as the "Write-up" text. Empty sections are dropped. */
export function writeupText(sections: WriteSection[]): string {
  const kept = sections.map((s) => ({ ...s, heading: s.heading.replace(/\s*\n\s*/g, ' ').trim(), text: s.text.replace(/\n{3,}/g, '\n\n').trim() }))
    .filter((s) => s.heading || s.text || (s.picture && isPicturePath(s.picture)));
  return kept.map((s, i) => [
    s.heading ? `## ${s.heading}` : i > 0 ? '##' : '',
    s.spoiler ? '[spoiler]' : '',
    // A line of the words that looks like a mark would be read as one, so it's nudged.
    s.text.split('\n').map((l) => (HEADING.test(l.trim()) || SPOILER_LINE.test(l.trim()) || PICTURE_LINE.test(l.trim()) ? ` ${l}` : l)).join('\n'),
    s.picture && isPicturePath(s.picture) ? `[picture:${s.picture}]` : '',
  ].filter(Boolean).join('\n')).join('\n');
}

/** A section's paragraphs. */
export const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** A section as plain words, for search, share cards and "What changes". */
export function sectionWords(s: WriteSection) {
  return [s.spoiler ? '(spoiler)' : '', s.heading && `${s.heading}:`, s.text.replace(/\s*\n\s*/g, ' '), s.picture ? '(picture)' : ''].filter(Boolean).join(' ');
}

/** Switching a guide to a write-up keeps every step: plain steps become paragraphs, and a
 *  step with a picture or a spoiler becomes its own section, so it keeps them. */
export function stepsToWriteup(text: string | undefined): string {
  const out: WriteSection[] = [];
  for (const s of parseSteps(text)) {
    const last = out[out.length - 1];
    if (!s.spoiler && !s.picture && last && !last.spoiler && !last.picture) last.text += `\n\n${s.text}`;
    else out.push({ heading: '', text: s.text, spoiler: s.spoiler, picture: s.picture });
  }
  return writeupText(out);
}

/** Switching a write-up to steps keeps every paragraph: each becomes a step (the section's
 *  heading leads its first one), the picture goes on the section's last step, and a spoiler
 *  section's steps are spoilers. */
export function writeupToSteps(text: string | undefined): string {
  const steps: Step[] = [];
  for (const s of parseWriteup(text)) {
    const ps = paragraphs(s.text);
    const lines = ps.length ? ps : [''];
    lines.forEach((p, i) => steps.push({
      text: i === 0 && s.heading ? (p ? `${s.heading}: ${p}` : s.heading) : p,
      spoiler: s.spoiler,
      picture: i === lines.length - 1 ? s.picture : undefined,
    }));
  }
  return stepsText(steps);
}
