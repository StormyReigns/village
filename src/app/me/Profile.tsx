'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Inbox, LogOut, Moon } from 'lucide-react';
import { useGames } from '@/components/GamesProvider';
import { Avatar } from '@/components/Avatar';
import { ProfileForm } from '@/components/ProfileDialog';
import { SignInPrompt } from '@/components/SignInPrompt';
import { Tip } from '@/components/Tip';
import { PicturePicker } from '@/components/profile/PicturePicker';
import { GameBadges, TitleChip, draftHref, titleOf, useStanding } from '@/components/profile/standing';
import { signOut, useVillager } from '@/components/useVillager';
import { browserClient } from '@/lib/supabase/browser';
import { ROLE, TENURE, pips, standing, type Step } from '@/lib/ranks';

const STATUS: Record<string, string> = {
  checking: 'Being checked', open: 'Open for votes', approved: 'Approved', preview: 'In Preview', stable: 'In the app', declined: 'Declined', removed: 'Removed',
};

/** A part of the profile: a flat white panel (only pieces get the brand's shape). */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface rounded-2xl p-5 sm:p-6">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** One ladder (tenure or role): every step, where you are, and how far to the next. */
function Ladder({ ladder, value, unit, tint, extra }: { ladder: Step[]; value: number; unit: string; tint: string; extra?: React.ReactNode }) {
  const { now, next, progress } = standing(ladder, value);
  return (
    <div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {ladder.map((s) => {
          const reached = value >= s.at, here = s === now;
          return (
            <li key={s.name}>
              <Tip text={s.note} tint={tint} className="w-full">
                <span style={here ? { background: `var(--${tint})` } : undefined}
                  className={'flex w-full flex-col rounded-xl px-3 py-2 ' + (here ? 'text-white' : reached ? 'bg-card ring-1 ring-line' : 'bg-card-2 opacity-70')}>
                  <span className="font-bold">{s.name}</span>
                  <span className={'text-xs ' + (here ? 'text-white/85' : 'text-muted')}>{s.at === 0 ? 'Start' : `${s.at} ${unit}`}</span>
                </span>
              </Tip>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-card-2 ring-1 ring-line">
          <span className="block h-full rounded-full" style={{ width: `${progress * 100}%`, background: `var(--${tint})` }} />
        </span>
        <span className="text-muted">
          {next ? <>{value} {unit} so far · {next.at - value} more for <b className="text-ink">{next.name}</b></> : <>{value} {unit}. The top of the ladder.</>}
        </span>
        {extra}
      </div>
    </div>
  );
}

export function Profile() {
  const games = useGames();
  const me = useVillager();
  const [data, setData] = useStanding(me?.id);

  if (me === undefined) return <div className="mt-6 h-64 animate-pulse rounded-2xl bg-card" />;
  if (me === null) {
    return (
      <section className="surface mt-6 rounded-2xl p-8 text-center">
        <h1 className="font-display text-3xl">Your village profile</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">Sign in to choose your name, see your title and badges, and keep track of what you&apos;ve added.</p>
        <div className="mt-5"><SignInPrompt>Sign in</SignInPrompt></div>
      </section>
    );
  }

  const { harvests, role } = titleOf(data);
  const weeks = data?.weeks ?? 0;

  const setHidePlanted = async (hide: boolean) => {
    setData((d) => (d ? { ...d, hidePlanted: hide } : d));
    await browserClient()?.from('profiles').update({ hide_planted: hide }).eq('id', me.id);
  };

  return (
    <div className="mt-4 grid gap-7">
      {/* Who you are */}
      <section className="surface flex flex-wrap items-center gap-4 rounded-2xl p-5 sm:p-6">
        <Avatar name={me.displayName} url={me.avatarUrl} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl leading-tight">{me.displayName}</h1>
          <p className="text-muted">@{me.username}</p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
            <Link href={`/u/${me.username}`} className="inline-flex items-center gap-1 underline hover:text-ink">How others see you <ArrowUpRight size={14} aria-hidden="true" /></Link>
            <Link href="/inbox" className="inline-flex items-center gap-1 underline hover:text-ink"><Inbox size={14} aria-hidden="true" /> Your inbox</Link>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <TitleChip data={data} tip="Your title: how long you've been around, then what you've built" />
            {me.isFounder && (
              <Tip text="Matt, who started the village. He earns his title like everyone else" tint="sun">
                <span className="rounded-full bg-sun-soft px-2.5 py-1 text-xs font-bold text-sun">Founder</span>
              </Tip>
            )}
          </p>
        </div>
      </section>

      <Section title="Your picture and name">
        <PicturePicker me={me} />
        <div className="mt-6"><ProfileForm villager={me} /></div>
      </Section>

      <Section title="Your title">
        <p className="text-sm text-muted">
          A title has two parts: how long you&apos;ve been around, and what you&apos;ve built. They move on their own, so something is always
          growing. Nothing ever goes down for taking a break.
        </p>
        <h3 className="mt-5 font-bold">Tenure: active weeks</h3>
        <p className="text-sm text-muted">A week counts when you chat, vote or post a Draft in it.</p>
        <div className="mt-2"><Ladder ladder={TENURE} value={weeks} unit="weeks" tint="sky" /></div>
        <h3 className="mt-6 font-bold">Role: harvests</h3>
        <p className="text-sm text-muted">A harvest is one of your Drafts reaching the app.</p>
        <div className="mt-2">
          <Ladder ladder={ROLE} value={harvests} unit="harvests" tint="leaf"
            extra={pips(role, harvests).length > 0 && (
              <Tip text="Pips fill on the way to your next role" tint="leaf">
                <span className="flex gap-1">{pips(role, harvests).map((p) => (
                  <span key={p.at} className={'size-2.5 rounded-full ring-1 ring-leaf ' + (p.filled ? 'bg-leaf' : 'bg-card')} />
                ))}</span>
              </Tip>
            )} />
        </div>
      </Section>

      <Section title="Badges">
        <p className="text-sm text-muted">One badge per game. It&apos;s gray once something of yours reaches the Workshop, colored once something reaches the app, and glows while it&apos;s live there now.</p>
        <div className="mt-4"><GameBadges data={data} planted={!data?.hidePlanted} /></div>
      </Section>

      <Section title="What you've added">
        {!data ? <p className="text-sm text-muted">Loading…</p> : data.drafts.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet. Open any game&apos;s app and tap &ldquo;Suggest a fix&rdquo; on something, or say hello in a Workshop.</p>
        ) : (
          <>
            <p className="text-sm text-muted">{harvests} in the app · {data.drafts.length} Drafts in all · {data.votes} votes cast</p>
            <ul className="mt-3 grid gap-1.5">
              {data.drafts.slice(0, 12).map((d) => (
                <li key={d.id}>
                  <Link href={draftHref(d, data)} className="flex items-center gap-3 rounded-2xl bg-card-2 px-3 py-2 ring-1 ring-line hover:ring-ink">
                    <span className="min-w-0 flex-1 truncate font-bold">{d.title}</span>
                    <span className="shrink-0 text-xs text-muted">{games.find((g) => g.id === d.game_id)?.shortTitle}</span>
                    <span className={'shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ' + (d.status === 'stable' ? 'bg-leaf-soft text-leaf' : d.status === 'declined' ? 'bg-berry-soft text-berry' : 'bg-sky-soft text-sky')}>
                      {STATUS[d.status] ?? d.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="Settings">
        <div className="grid gap-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={Boolean(data?.hidePlanted)} onChange={(e) => setHidePlanted(e.target.checked)} className="mt-1 size-4 accent-[var(--color-teal)]" />
            <span><span className="font-bold">Hide my Planted count.</span> <span className="text-muted">Others won&apos;t see how many of your Drafts are still waiting.</span></span>
          </label>
          <p className="flex items-start gap-3 text-sm">
            <Moon size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
            <span><span className="font-bold">Appearance: light.</span> <span className="text-muted">A dark mode is coming once the village is closer to finished.</span></span>
          </p>
          <button onClick={() => signOut()} className="btn-quiet inline-flex items-center gap-2 justify-self-start rounded-full px-4 py-2 text-sm font-bold">
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      </Section>

      <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Village square
      </Link>
    </div>
  );
}
