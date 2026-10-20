import type { BlockDef } from '@/lib/blocks';
import { titleField } from '@/lib/blocks';
import { BlockIcon } from './Icon';

export type CardContent = Record<string, string>;

/**
 * A card exactly as it appears in a game app. The Workshop uses the same component for
 * Draft previews, so what people vote on is what ships.
 * `before` (optional) is the Stable version: changed fields show what was there.
 */
export function CardPreview({ block, content, before, label }: {
  block: BlockDef;
  content: CardContent;
  before?: CardContent;
  label?: string;
}) {
  const tf = titleField(block);
  const title = content[tf.key]?.trim() || <span className="text-muted">{tf.label} goes here</span>;
  return (
    <article className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-line">
      <div className="mb-2 flex items-center gap-2 text-sm text-muted">
        <span className="grid size-7 place-items-center rounded-full bg-leaf-soft text-leaf">
          <BlockIcon name={block.icon} size={15} />
        </span>
        {label ?? block.title}
      </div>
      <h3 className="font-display text-xl leading-tight">{title}</h3>
      <dl className="mt-3 grid gap-2">
        {block.fields.filter((f) => f !== tf).map((f) => {
          const now = content[f.key]?.trim() ?? '';
          const was = before?.[f.key]?.trim() ?? '';
          if (!now && !was) return null;
          const changed = before !== undefined && now !== was;
          return (
            <div key={f.key} className={'rounded-2xl px-3 py-2 ' + (changed ? 'bg-leaf-soft' : 'bg-card-2')}>
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">{f.label}</dt>
              <dd className="mt-0.5">
                {changed && was && <span className="mr-2 text-berry line-through decoration-2">{was}</span>}
                {f.type === 'list'
                  ? <ul className="list-disc pl-5">{now.split('\n').filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}</ul>
                  : <span className="whitespace-pre-line">{now}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </article>
  );
}
