// Review order guide: a short, ordered list of where a reviewer should look in
// a PR — what "done" meant first, then the proof, then the diff. Moa writes it
// into the body of every evidence PR (main/deck/moaGoalDelivery.ts); the Git
// page reads it back and lets the reviewer step through it, mark each step
// checked, and highlights Approve once every step is.
//
// The section is plain markdown so it reads fine on GitHub, behind a marker
// comment so a hand-written "Review order" heading is never mistaken for one.

export const REVIEW_GUIDE_MARKER = '<!-- wmux:review-guide v1 -->';

/** Where a step sends the reviewer on the Git page. */
export type ReviewGuideTarget = 'criteria' | 'evidence' | 'files';

export interface ReviewGuideStep {
  readonly target: ReviewGuideTarget;
  /** What to check at this step (one line). */
  readonly hint: string;
  /** The things to look at: criteria, evidence files, gate results. */
  readonly items: readonly string[];
}

const TITLE: Record<ReviewGuideTarget, string> = {
  criteria: 'Done criteria',
  evidence: 'Evidence',
  files: 'Changed files',
};
const TARGET_OF = new Map(Object.entries(TITLE).map(([k, v]) => [v.toLowerCase(), k as ReviewGuideTarget]));

const MAX_STEPS = 10;
const MAX_ITEMS = 20;
const MAX_TEXT = 300;

const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s);

/** The markdown section, marker first. */
export function formatReviewGuide(steps: readonly ReviewGuideStep[]): string {
  const out = [REVIEW_GUIDE_MARKER, '### Review order'];
  steps.forEach((s, i) => {
    out.push(`${i + 1}. **${TITLE[s.target]}** — ${s.hint.replace(/\s+/g, ' ').trim()}`);
    for (const item of s.items) out.push(`   - ${item.replace(/\s+/g, ' ').trim()}`);
  });
  return out.join('\n');
}

/** The guide in a PR body, or null when the body has none. Unknown steps are
 *  skipped; sizes are capped (the body is the PR author's text). */
export function parseReviewGuide(body: string | undefined | null): ReviewGuideStep[] | null {
  if (!body) return null;
  const at = body.indexOf(REVIEW_GUIDE_MARKER);
  if (at < 0) return null;
  const lines = body.slice(at + REVIEW_GUIDE_MARKER.length).replace(/\r\n/g, '\n').split('\n');
  const steps: { target: ReviewGuideTarget; hint: string; items: string[] }[] = [];
  let started = false;
  let cur: { target: ReviewGuideTarget; hint: string; items: string[] } | null = null;
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      if (!started && /^###\s+Review order\s*$/i.test(line)) { started = true; continue; }
      if (started) break;
      continue;
    }
    if (!started) continue;
    const step = /^\d+\.\s+\*\*(.+?)\*\*(?:\s+[—-]\s+(.*))?\s*$/.exec(line);
    if (step) {
      const target = TARGET_OF.get(step[1].trim().toLowerCase());
      cur = null;
      if (target && steps.length < MAX_STEPS) {
        cur = { target, hint: clip((step[2] ?? '').trim()), items: [] };
        steps.push(cur);
      }
      continue;
    }
    const item = /^\s+[-*]\s+(.*\S)\s*$/.exec(line);
    if (item && cur && cur.items.length < MAX_ITEMS) cur.items.push(clip(item[1]));
  }
  return steps.length ? steps : null;
}
