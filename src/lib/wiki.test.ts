// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiCandidates, askOf, choose, classify, inBatches, linksUrl, readLinks, readSiteinfo, encodeTitle, knownWikiHost, pageUrl, queryUrl, readAnswer, titleFromUrl, titlesFor, toTitle, wikiFixOf, wikiOf, type GameWiki } from './wiki.ts';

const FE: GameWiki = { name: 'Fire Emblem Wiki', api: 'https://fireemblemwiki.org/w/api.php', article: 'https://fireemblemwiki.org/wiki/$1', bracket: "Fortune's Weave" };

test('a saved wiki is checked like the database checks it', () => {
  assert.deepEqual(wikiOf(FE), FE);
  assert.deepEqual(wikiOf({ name: 'Zelda Wiki', api: 'https://zeldawiki.wiki/w/api.php', article: 'https://zeldawiki.wiki/wiki/$1' }),
    { name: 'Zelda Wiki', api: 'https://zeldawiki.wiki/w/api.php', article: 'https://zeldawiki.wiki/wiki/$1' });
  for (const bad of [
    null, 'x', {},
    { ...FE, api: 'http://fireemblemwiki.org/w/api.php' },
    { ...FE, api: 'https://127.0.0.1/w/api.php', article: 'https://127.0.0.1/wiki/$1' },
    { ...FE, api: 'https://localhost/api.php', article: 'https://localhost/wiki/$1' },
    { ...FE, api: 'https://fireemblemwiki.org/w/index.php' },
    { ...FE, api: 'https://user@fireemblemwiki.org/w/api.php' },
    { ...FE, article: 'https://evil.example.com/wiki/$1' },
    { ...FE, article: 'https://fireemblemwiki.org/wiki/' },
    { ...FE, bracket: 'a|b' },
    { ...FE, name: 'X' },
  ]) assert.equal(wikiOf(bad), null, JSON.stringify(bad));
});

test('our server only asks wiki sites we know', () => {
  for (const ok of ['https://fireemblemwiki.org/w/api.php', 'https://zeldawiki.wiki/w/api.php', 'https://fireemblem.fandom.com/api.php',
    'https://terraria.wiki.gg/api.php', 'https://eldenring.wiki.fextralife.com/api.php', 'https://x.miraheze.org/w/api.php', 'https://bulbapedia.bulbagarden.net/w/api.php']) {
    assert.equal(knownWikiHost(ok), true, ok);
  }
  for (const bad of ['https://fandom.com/api.php', 'https://evilfandom.com/api.php', 'https://fandom.com.evil.io/api.php',
    'https://fireemblemwiki.org.evil.io/w/api.php', 'https://internal.example.com/api.php', 'http://fireemblemwiki.org/w/api.php', 'not a url']) {
    assert.equal(knownWikiHost(bad), false, bad);
  }
});

test('names become page names the way MediaWiki tidies them', () => {
  assert.equal(toTitle('  hong   hua '), 'Hong hua');
  assert.equal(toTitle('Sword_of Judgment'), 'Sword of Judgment');
  assert.equal(toTitle('Theodora'), 'Theodora');
  for (const bad of ['', '   ', 'A|B', 'A#b', '[x]', '{y}', 'a<b', ':Talk', 'x'.repeat(256)]) assert.equal(toTitle(bad), null, bad);
});

test('addresses look like the wiki\'s own links', () => {
  assert.equal(encodeTitle("Theodora (Fortune's Weave)"), "Theodora_(Fortune's_Weave)");
  assert.equal(encodeTitle('Fire Emblem: Fortune\'s Weave'), "Fire_Emblem:_Fortune's_Weave");
  assert.equal(encodeTitle('Lúcio & Co?'), 'L%C3%BAcio_%26_Co%3F');
  assert.equal(encodeTitle('Pokémon Red/Blue'), 'Pok%C3%A9mon_Red/Blue');
  assert.equal(encodeTitle('100% #1'), '100%25_%231');
  assert.equal(pageUrl(FE, 'Princess Zelda'), 'https://fireemblemwiki.org/wiki/Princess_Zelda');
});

test('the question asks only the saved wiki, at most 50 names', () => {
  const u = new URL(queryUrl(FE, Array.from({ length: 60 }, (_, i) => `N${i}`)));
  assert.equal(u.origin + u.pathname, FE.api);
  assert.equal(u.searchParams.get('titles')!.split('|').length, 50);
  assert.equal(u.searchParams.get('redirects'), '1');
});

test("the game's own page comes first, then the plain name", () => {
  assert.deepEqual(titlesFor('Maria', FE), ["Maria (Fortune's Weave)", 'Maria']);
  assert.deepEqual(titlesFor("Maria (Fortune's Weave)", FE), ["Maria (Fortune's Weave)"]);
  assert.deepEqual(titlesFor('Saria', { ...FE, bracket: undefined }), ['Saria']);
  assert.deepEqual(titlesFor('a|b', FE), []);
});

// Shaped like the wiki's real answers (2026-11-10).
const answer = {
  query: {
    normalized: [{ from: 'Fire_Emblem', to: 'Fire Emblem' }],
    redirects: [{ from: 'Ursula', to: 'Ursula (disambiguation)' }, { from: 'Zelda', to: 'Princess Zelda' }],
    pages: [
      { title: "Maria (Fortune's Weave)", pageid: 1 },
      { title: 'Maria', pageid: 2 },
      { title: "Theodora (Fortune's Weave)", missing: true },
      { title: 'Theodora', pageid: 3 },
      { title: "Fire (Fortune's Weave)", missing: true },
      { title: 'Fire', pageid: 4, pageprops: { disambiguation: '' } },
      { title: "Ursula (Fortune's Weave)", missing: true },
      { title: 'Ursula (disambiguation)', pageid: 5 },
      { title: 'Princess Zelda', pageid: 6 },
      { title: "Glass Wheel (Fortune's Weave)", missing: true },
      { title: 'Glass Wheel', missing: true },
    ],
  },
};
const asked = ["Maria (Fortune's Weave)", 'Maria', "Theodora (Fortune's Weave)", 'Theodora', "Fire (Fortune's Weave)", 'Fire', "Ursula (Fortune's Weave)", 'Ursula', 'Zelda', "Glass Wheel (Fortune's Weave)", 'Glass Wheel'];

test("reading the wiki's answer", () => {
  const f = readAnswer(answer, asked);
  assert.deepEqual(f.get('Zelda'), { title: 'Princess Zelda', exists: true, which: false, redirected: true });
  assert.deepEqual(f.get('Ursula'), { title: 'Ursula (disambiguation)', exists: true, which: true, redirected: true });
  assert.equal(f.get('Fire')?.which, true);
  assert.equal(f.get('Glass Wheel')?.exists, false);
  assert.equal(readAnswer({ error: { code: 'x' } }, asked).size, 0);
  assert.equal(readAnswer(null, asked).size, 0);
});

test('choosing the link', () => {
  const f = readAnswer(answer, asked);
  const pick = (name: string) => choose(FE, titlesFor(name, FE), f);
  assert.deepEqual(pick('Maria'), { ok: true, name: 'Fire Emblem Wiki', url: "https://fireemblemwiki.org/wiki/Maria_(Fortune's_Weave)", title: "Maria (Fortune's Weave)" });
  assert.equal((pick('Theodora') as { url: string }).url, 'https://fireemblemwiki.org/wiki/Theodora');
  assert.deepEqual(pick('Fire'), { ok: false, reason: 'which' });
  assert.deepEqual(pick('Ursula'), { ok: false, reason: 'which' });
  assert.deepEqual(pick('Glass Wheel'), { ok: false, reason: 'missing' });
  assert.deepEqual(choose(FE, ['Zelda'], f), { ok: true, name: 'Fire Emblem Wiki', url: 'https://fireemblemwiki.org/wiki/Princess_Zelda', title: 'Princess Zelda' });
});

test("a browser's question is only for a known wiki, about at most two proper page names", () => {
  assert.deepEqual(askOf({ wiki: FE, titles: ["Maria (Fortune's Weave)", 'Maria'] }), { wiki: FE, titles: ["Maria (Fortune's Weave)", 'Maria'] });
  for (const bad of [
    null, {}, { wiki: FE }, { wiki: FE, titles: [] },
    { wiki: FE, titles: ['a', 'b', 'c'] },
    { wiki: FE, titles: ['A|B'] },
    { wiki: FE, titles: ['lowercase first'] },
    { wiki: { ...FE, api: 'https://internal.example.com/api.php', article: 'https://internal.example.com/wiki/$1' }, titles: ['Maria'] },
  ]) assert.equal(askOf(bad), null, JSON.stringify(bad));
  const u = new URL(queryUrl(FE, ['Maria'], true));
  assert.equal(u.searchParams.get('origin'), '*');
  assert.equal(new URL(queryUrl(FE, ['Maria'])).searchParams.get('origin'), null);
});

test('a pasted address is read only when it is from the game\'s wiki', () => {
  assert.equal(titleFromUrl(FE, "https://fireemblemwiki.org/wiki/Maria_(Fortune's_Weave)"), "Maria (Fortune's Weave)");
  assert.equal(titleFromUrl(FE, 'https://fireemblemwiki.org/wiki/Maria_%28Fortune%27s_Weave%29#Supports'), "Maria (Fortune's Weave)");
  assert.equal(titleFromUrl(FE, 'https://fireemblemwiki.org/w/index.php?title=Pok%C3%A9mon_Red&action=edit'), 'Pokémon Red');
  assert.equal(titleFromUrl(FE, '  https://FireEmblemWiki.org/wiki/Saria  '), 'Saria');
  for (const bad of ['Maria', 'https://fireemblem.fandom.com/wiki/Maria', 'http://fireemblemwiki.org/wiki/Maria',
    'https://fireemblemwiki.org/', 'https://fireemblemwiki.org/wiki/', 'https://user@fireemblemwiki.org/wiki/Maria', 'https://fireemblemwiki.org/wiki/A%7CB']) {
    assert.equal(titleFromUrl(FE, bad), null, bad);
  }
});

test("an entry's stored fix is checked wherever it's read", () => {
  assert.equal(wikiFixOf("Maria (Fortune's Weave)"), "Maria (Fortune's Weave)");
  assert.equal(wikiFixOf('  saria '), 'Saria');
  assert.equal(wikiFixOf(false), false);
  for (const bad of [undefined, null, true, 0, '', '   ', 'A|B', 'a#b', '<x>', 'x\u0007y', 'x'.repeat(256), ['Maria'], { title: 'Maria' }, 'https://evil.example.com/x|y']) {
    assert.equal(wikiFixOf(bad), undefined, JSON.stringify(bad));
  }
});

test("a moderator's pasted page: only known wiki sites, two usual API spots", () => {
  assert.deepEqual(apiCandidates('https://fireemblemwiki.org/wiki/Marth'), ['https://fireemblemwiki.org/w/api.php', 'https://fireemblemwiki.org/api.php']);
  assert.deepEqual(apiCandidates('https://Terraria.wiki.gg/wiki/Guide'), ['https://terraria.wiki.gg/w/api.php', 'https://terraria.wiki.gg/api.php']);
  for (const bad of ['https://evil.example.com/wiki/X', 'http://fireemblemwiki.org/wiki/Marth', 'https://fireemblemwiki.org:8443/wiki/Marth', 'not a link', 'https://a@fireemblemwiki.org/']) {
    assert.deepEqual(apiCandidates(bad), [], bad);
  }
});

test("a wiki's answer about itself becomes a setting", () => {
  assert.deepEqual(readSiteinfo({ query: { general: { sitename: 'Zelda Wiki', server: '//zeldawiki.wiki', articlepath: '/wiki/$1' } } }, 'https://zeldawiki.wiki/w/api.php'),
    { name: 'Zelda Wiki', api: 'https://zeldawiki.wiki/w/api.php', article: 'https://zeldawiki.wiki/wiki/$1' });
  assert.equal(readSiteinfo({ query: { general: { sitename: 'X Wiki', server: 'https://other.example.com', articlepath: '/wiki/$1' } } }, 'https://zeldawiki.wiki/w/api.php'), null);
  assert.equal(readSiteinfo({ error: 'x' }, 'https://zeldawiki.wiki/w/api.php'), null);
});

test("a which-one page's choices, this game's first", () => {
  const body = { query: { pages: [
    { title: "Ranger (Fortune's Weave)", missing: true }, { title: 'Ranger (Fates)', pageid: 1 }, { title: "Ranger (Fortune's Weave class)", pageid: 2 },
    { title: 'A|B', pageid: 3 }, { title: 'Forest Knight', pageid: 4 }, { title: 'Fire', pageid: 5, pageprops: { disambiguation: '' } }, { title: 'Ursula (disambiguation)', pageid: 6 },
  ] } };
  assert.deepEqual(readLinks(body, FE), ["Ranger (Fortune's Weave class)", 'Forest Knight', 'Ranger (Fates)']);
  assert.equal(new URL(linksUrl(FE, 'Ranger')).searchParams.get('origin'), '*');
});

test("sorting entries for the builders' list", () => {
  const f = readAnswer(answer, asked);
  assert.equal(classify(FE, titlesFor('Maria', FE), f).kind, 'linked');
  assert.deepEqual(classify(FE, titlesFor('Fire', FE), f), { kind: 'which', asked: 'Fire' });
  assert.deepEqual(classify(FE, titlesFor('Ursula', FE), f), { kind: 'which', asked: 'Ursula' });
  assert.deepEqual(classify(FE, titlesFor('Glass Wheel', FE), f), { kind: 'missing' });
  assert.deepEqual(classify(FE, ['Zelda'], f), { kind: 'elsewhere', title: 'Princess Zelda', url: 'https://fireemblemwiki.org/wiki/Princess_Zelda', asked: 'Zelda' });
  assert.deepEqual(inBatches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});
