import { GAMES } from '@/data/games';
import { MarketDayButton } from '@/components/HowItWorks';
import { GameBrowser } from '@/components/GameBrowser';
import { AccountButton } from '@/components/AccountButton';
import Image from 'next/image';
import Link from 'next/link';
import { LogoMark, Wordmark } from '@/components/Logo';
import { withCovers } from '@/lib/pictures';
import { Suspense } from 'react';
import type { EntryHit } from '@/components/GameBrowser';
import { getApp } from '@/lib/app-data';
import { sharePath } from '@/data/pages/links';

export default function VillageSquare() {
  return (
    <>
    {/* The village square's header is the banner itself: the logo and your account along
        the top, one line on the sky, and the players on their hill. The ink bar is for the
        other screens. */}
    <header className="relative isolate overflow-hidden">
      <Image src="/village/banner.jpg" alt="Players from many kinds of games sit together on a hill, looking out over a castle, a lake and a city"
        fill priority sizes="100vw" className="-z-10 object-cover object-[50%_80%]" />
      <div className="mx-auto flex h-[250px] w-full max-w-6xl flex-col px-4 pt-3 sm:h-[300px] sm:px-6 lg:h-[340px]">
        <div className="flex items-center gap-3">
          {/* The wordmark sits on a solid chip so it reads on the busy sky; the logo is
              bigger than the chip and spills over its lower edge (the negative margins keep
              the chip's own height), and the wordmark tucks over it in a white glow. */}
          <Link href="/" aria-label="Village square" className="flex items-start rounded-2xl bg-card py-1.5 pl-1 pr-4 shadow-sm">
            <LogoMark height={110} className="-mb-[34px] -ml-2 -mt-1 h-[80px] w-[88px] drop-shadow-[0_4px_6px_rgb(0_0_0/0.25)] sm:-mb-[58px] sm:-mt-1.5 sm:h-[110px] sm:w-[121px]" />
            <Wordmark className="relative -ml-3 text-[30px] text-ink [text-shadow:0_0_3px_white,0_0_6px_white,0_0_10px_white] sm:text-[34px]" />
          </Link>
          <div className="ml-auto flex items-center gap-1 rounded-full bg-ink/85 p-1">
            <MarketDayButton className="hidden text-signal sm:inline-flex" />
            <AccountButton quiet dark />
          </div>
        </div>
        <h1 className="mx-auto mt-9 max-w-2xl text-balance text-center font-display text-2xl leading-tight text-ink [text-shadow:0_0_18px_rgb(255_255_255/0.8)] sm:mt-8 sm:text-4xl">
          Companion apps, built by the people who play
        </h1>
      </div>
    </header>
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5 sm:px-6">

      <Suspense fallback={<GameBrowser games={withCovers(GAMES)} />}>
        <SearchableBrowser />
      </Suspense>

      {/* Town Hall and "Your games" come back here once they have something to show. */}

      <footer className="mt-12 text-center text-sm text-muted">
        Unofficial fan project. Not affiliated with Nintendo, Intelligent Systems, or any game publisher.
      </footer>
    </main>
    </>
  );
}

// The home search also looks inside every game's app. Spoilers stay out.
async function SearchableBrowser() {
  const lists = await Promise.all(GAMES.map(async (g) => (await getApp(g.id)).flatMap((p) =>
    p.blocks.flatMap((b) => b.entries.filter((e) => !e.spoiler).map((e): EntryHit => ({
      key: `${g.id}.${b.id}.${e.id}`, game: g.shortTitle, name: e.name,
      where: p.title === b.title ? p.title : `${p.title} · ${b.title}`,
      href: sharePath(g.id, p, b, e),
      text: [e.description, ...e.sections.map((x) => x.text), ...Object.values(e.categories)].join(' '),
    }))),
  )));
  return <GameBrowser games={withCovers(GAMES)} entries={lists.flat()} />;
}
