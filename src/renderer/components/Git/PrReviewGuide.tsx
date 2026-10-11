// The review order guide Moa writes into an evidence PR's body
// (shared/prReviewGuide.ts), as a stepper on the PR detail pane: the reviewer
// walks it with Next (which scrolls to where that step's proof lives on this
// page), marks each step checked, and once every step is, Approve is
// highlighted. Checks are kept for the session per PR and head, so a new
// commit starts the walk over.
import { useState } from 'react';
import { useT } from '../../hooks/useT';
import { FOCUS_RING } from '../focusRing';
import type { ReviewGuideStep, ReviewGuideTarget } from '../../../shared/prReviewGuide';

const checkedBy = new Map<string, ReadonlySet<number>>();

/** Tests only. */
export function resetReviewGuideChecks(): void {
  checkedBy.clear();
}

export function guideKey(repoPath: string, number: number, head: string): string {
  return `${repoPath}\0${number}\0${head}`;
}

/** Where a step's proof sits on the detail pane, besides the step itself. */
const TARGET_SELECTOR: Record<ReviewGuideTarget, string | null> = {
  criteria: null,
  evidence: '[data-pr-checks]',
  files: '[data-pr-files]',
};

export function allGuideChecked(key: string, steps: readonly ReviewGuideStep[]): boolean {
  const c = checkedBy.get(key);
  return !!c && steps.every((s, i) => s.target === 'files' || c.has(i));
}

export function PrReviewGuide({ steps, guide, onChange }: {
  steps: readonly ReviewGuideStep[];
  /** guideKey() of the PR and the head being reviewed. */
  guide: string;
  /** Checks changed (the parent re-reads allGuideChecked). */
  onChange: () => void;
}): React.ReactElement {
  const t = useT();
  const [current, setCurrent] = useState(0);
  const [, bump] = useState(0);
  const checked = checkedBy.get(guide) ?? new Set<number>();
  const done = steps.filter((_, i) => checked.has(i)).length;

  const go = (i: number, from: HTMLElement) => {
    setCurrent(i);
    const pane = from.closest('[data-pr-detail]');
    const sel = TARGET_SELECTOR[steps[i].target];
    const el = (sel && pane?.querySelector(sel)) || pane?.querySelector(`[data-guide-step="${i}"]`);
    (el as HTMLElement | null)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  };
  const toggle = (i: number) => {
    const next = new Set(checked);
    if (next.has(i)) next.delete(i); else next.add(i);
    checkedBy.set(guide, next);
    bump((n) => n + 1);
    onChange();
  };

  return (
    <section className="wmux-git-section" aria-label={t('git.guide.title')} data-pr-guide>
      <h3 className="wmux-git-section-title">{t('git.guide.title')}</h3>
      <ol className="wmux-git-guide">
        {steps.map((s, i) => (
          <li
            key={i}
            className={i === current ? 'wmux-git-guide-step wmux-git-guide-current' : 'wmux-git-guide-step'}
            aria-current={i === current ? 'step' : undefined}
            data-guide-step={i}
            data-guide-target={s.target}
          >
            <label className="wmux-git-field">
              <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} data-guide-check={i} />
              <span className="font-medium">{t(`git.guide.step.${s.target}`)}</span>
              {checked.has(i) && <span className="wmux-git-note" data-guide-checked={i}>{t('git.guide.checked')}</span>}
            </label>
            {s.hint && <div className="wmux-git-note">{s.hint}</div>}
            {i === current && s.items.length > 0 && (
              <ul className="wmux-git-guide-items">
                {s.items.map((item, j) => <li key={j}><code>{item}</code></li>)}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <div className="wmux-git-review-actions">
        <span className="wmux-git-note" data-guide-progress>{t('git.guide.progress', { done, total: steps.length })}</span>
        <button
          type="button"
          className={`wmux-git-button ${FOCUS_RING}`}
          onClick={(e) => go((current + 1) % steps.length, e.currentTarget)}
          data-guide-next
        >
          {t('git.guide.next')}
        </button>
      </div>
      {allGuideChecked(guide, steps) && <div className="wmux-git-note" role="status" data-guide-done>{t('git.guide.allChecked')}</div>}
    </section>
  );
}
