// "#" references and "@" mentions in chat messages (docs/chat.md). Typing #esh and picking
// Eshmel puts a small code in the message that names his thread by its key, never his name,
// so a rename doesn't break it; the game is part of the code, so it works from Town Hall too:
//   <#fortunes-weave:card:1b2c…>
// Typing @an and picking Ana does the same for a person, by their account id:
//   <@5f3a…>
// The message shows them as #Eshmel (opens his thread) and @Ana.

export interface Ref { game: string; key: string }
export type Part = { text: string } | { ref: Ref } | { mention: string };

const TOKEN = /<#([a-z0-9-]+):((?:card|draft|block|entry):[^>\s]+)>|<@([0-9a-f-]{36})>/g;

export const refToken = (r: Ref) => `<#${r.game}:${r.key}>`;
export const mentionToken = (id: string) => `<@${id}>`;

/** A message's text with its references and mentions picked out, in order. */
export function splitRefs(body: string): Part[] {
  const parts: Part[] = [];
  let at = 0;
  for (const m of body.matchAll(TOKEN)) {
    if (m.index > at) parts.push({ text: body.slice(at, m.index) });
    parts.push(m[3] ? { mention: m[3] } : { ref: { game: m[1], key: m[2] } });
    at = m.index + m[0].length;
  }
  if (at < body.length) parts.push({ text: body.slice(at) });
  return parts;
}

export const refsIn = (body: string): Ref[] => splitRefs(body).flatMap((p) => ('ref' in p ? [p.ref] : []));
export const mentionsIn = (body: string): string[] => splitRefs(body).flatMap((p) => ('mention' in p ? [p.mention] : []));

/** The message as plain words, each reference written as #Name and each mention as @Name. */
export const plainRefs = (body: string, label: (r: Ref) => string, person: (id: string) => string = () => 'someone') =>
  splitRefs(body).map((p) => ('ref' in p ? `#${label(p.ref)}` : 'mention' in p ? `@${person(p.mention)}` : p.text)).join('');

/** The "#esh" or "@an" being typed just before the cursor, if any: which mark, where it starts, what follows. */
export function typedMark(text: string, caret: number): { mark: '#' | '@'; start: number; query: string } | null {
  const m = /(^|\s)([#@])([^\s#@<>]*)$/.exec(text.slice(0, caret));
  return m ? { mark: m[2] as '#' | '@', start: m.index + m[1].length, query: m[3] } : null;
}

/** Swaps the "#esh" being typed for "#Eshmel " (or "@an" for "@Ana ") and says where the cursor goes. */
export function insertPick(text: string, start: number, caret: number, label: string, mark: '#' | '@' = '#') {
  const put = `${mark}${label} `;
  return { text: text.slice(0, start) + put + text.slice(caret), caret: start + put.length };
}

/** On sending: each picked "#Eshmel" or "@Ana" still in the text becomes its code. */
export function encodeRefs(text: string, picked: { label: string; mark: '#' | '@'; token: string }[]) {
  let out = text;
  for (const p of [...picked].sort((a, b) => b.label.length - a.label.length)) {
    out = out.split(`${p.mark}${p.label}`).join(p.token);
  }
  return out;
}
