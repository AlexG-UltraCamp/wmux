import { describe, it, expect } from 'vitest';
import { REVIEW_GUIDE_MARKER, formatReviewGuide, parseReviewGuide, type ReviewGuideStep } from '../prReviewGuide';

const steps: ReviewGuideStep[] = [
  { target: 'criteria', hint: 'Is this what was asked?', items: ['(1) tests pass', '(2) no new deps'] },
  { target: 'evidence', hint: 'Proof on this commit?', items: ['(1) `out/test.log` (sha256 abc)', 'gate `npm test` exited 0 on `deadbeef`'] },
  { target: 'files', hint: 'Diff last.', items: [] },
];

describe('review order guide', () => {
  it('round-trips through the PR body markdown', () => {
    const body = `Intro\n\n${formatReviewGuide(steps)}\n\n### Done criteria\n- ✅ (1) tests pass`;
    expect(parseReviewGuide(body)).toEqual(steps);
  });

  it('reads as an ordered list on GitHub', () => {
    const md = formatReviewGuide(steps);
    expect(md).toContain('### Review order\n1. **Done criteria** — Is this what was asked?\n   - (1) tests pass');
    expect(md).toContain('3. **Changed files** — Diff last.');
  });

  it('needs the marker: a hand-written heading is not a guide', () => {
    expect(parseReviewGuide('### Review order\n1. **Evidence** — x')).toBeNull();
    expect(parseReviewGuide('')).toBeNull();
    expect(parseReviewGuide(undefined)).toBeNull();
  });

  it('skips unknown steps, tolerates CRLF, caps sizes', () => {
    const many = Array.from({ length: 50 }, (_, i) => `   - item ${i}`).join('\r\n');
    const body = `${REVIEW_GUIDE_MARKER}\r\n### Review order\r\n1. **Something else** — x\r\n   - ignored\r\n2. **Evidence** — y\r\n${many}\r\n3. **Changed files**\r\n`;
    const g = parseReviewGuide(body)!;
    expect(g.map((s) => s.target)).toEqual(['evidence', 'files']);
    expect(g[0].items).toHaveLength(20);
    expect(g[1]).toEqual({ target: 'files', hint: '', items: [] });
  });
});
