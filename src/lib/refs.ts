// "#" references in chat messages (docs/chat.md): typing #esh and picking Eshmel puts a
// small code in the message that names his thread by its key, never his name, so a rename
// doesn't break it. The game is part of the code, so it works from Town Hall later too:
//   <#fortunes-weave:card:1b2c…>
// The message shows it as a tag, #Eshmel, that opens his thread.

export interface Ref { game: string; key: string }
export type Part = { text: string } | { ref: Ref };

const TOKEN = /<#([a-z0-9-]+):((?:card|draft|block|entry):[^>\s]+)>/g;

export const refToken = (r: Ref) => `<#${r.game}:${r.key}>`;

/** A message's text with its references picked out, in order. */
export function splitRefs(body: string): Part[] {
  const parts: Part[] = [];
  let at = 0;
  for (const m of body.matchAll(TOKEN)) {
    if (m.index > at) parts.push({ text: body.slice(at, m.index) });
    parts.push({ ref: { game: m[1], key: m[2] } });
    at = m.index + m[0].length;
  }
  if (at < body.length) parts.push({ text: body.slice(at) });
  return parts;
}

export const refsIn = (body: string): Ref[] => splitRefs(body).flatMap((p) => ('ref' in p ? [p.ref] : []));

/** The message as plain words, each reference written as #Name. */
export const plainRefs = (body: string, label: (r: Ref) => string) =>
  splitRefs(body).map((p) => ('ref' in p ? `#${label(p.ref)}` : p.text)).join('');

/** The "#esh" being typed just before the cursor, if any: where it starts and what's after the #. */
export function typedHash(text: string, caret: number): { start: number; query: string } | null {
  const m = /(^|\s)#([^\s#<>]*)$/.exec(text.slice(0, caret));
  return m ? { start: m.index + m[1].length, query: m[2] } : null;
}

/** Swaps the "#esh" being typed for "#Eshmel " and says where the cursor goes. */
export function insertPick(text: string, start: number, caret: number, label: string) {
  const put = `#${label} `;
  return { text: text.slice(0, start) + put + text.slice(caret), caret: start + put.length };
}

/** On sending: each picked "#Eshmel" still in the text becomes his code. */
export function encodeRefs(text: string, picked: { label: string; ref: Ref }[]) {
  let out = text;
  for (const p of [...picked].sort((a, b) => b.label.length - a.label.length)) {
    out = out.split(`#${p.label}`).join(refToken(p.ref));
  }
  return out;
}
