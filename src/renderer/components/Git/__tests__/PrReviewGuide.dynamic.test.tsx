// @vitest-environment jsdom
//
// The review order guide on the PR detail pane: read from the PR body, walked
// with Next to where each step's proof lives, each step checked, Approve
// highlighted only once all are — and a new head starts the walk over.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GitDetail } from '../GitDetail';
import { resetReviewGuideChecks } from '../PrReviewGuide';
import { useStore } from '../../../stores';
import type { PrSummary } from '../../../../shared/prSurface';
import type { PrReviewHead } from '../../../../shared/prReview';
import type { ReviewGuideStep } from '../../../../shared/prReviewGuide';

const A = 'a'.repeat(40);
const pr: PrSummary = {
  number: 7, title: 'Moa: fix a', state: 'open', author: 'moa', headRefName: 'wtask/fix-a', updatedAt: 'u',
  url: 'https://github.com/o/r/pull/7', reviewDecision: '', checks: null, mergeable: '',
};
const head: PrReviewHead = {
  number: 7, title: 'Moa: fix a', url: pr.url, state: 'OPEN', isDraft: false, headRefOid: A,
  headRefName: 'wtask/fix-a', baseRefName: 'main', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN',
};
const guide: ReviewGuideStep[] = [
  { target: 'criteria', hint: 'Is this what was asked?', items: ['(1) a.txt says fixed'] },
  { target: 'evidence', hint: 'Proof on this commit?', items: ['gate `npm test` exited 0'] },
  { target: 'files', hint: 'Diff last.', items: [] },
];

let container: HTMLDivElement;
let root: Root;
let scrolled: string[];

function bridge(reviewGuide?: ReviewGuideStep[]) {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    github: {
      prList: vi.fn(),
      prDetail: vi.fn(async () => ({ ok: true, detail: { number: 7, comments: [], ...(reviewGuide ? { reviewGuide } : {}) } })),
      prChecks: vi.fn(async () => ({ ok: true, value: { head, checks: [] } })),
      prFiles: vi.fn(async () => ({ ok: true, value: { headRefOid: A, files: [], truncated: false } })),
      prThreads: vi.fn(async () => ({ ok: true, value: { threads: [], truncated: false } })),
      prSubmitReview: vi.fn(async () => ({ ok: true })), prMerge: vi.fn(async () => ({ ok: true })),
      prRunLog: vi.fn(), prRerunFailed: vi.fn(),
    },
  };
}

beforeEach(() => {
  resetReviewGuideChecks();
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.hasAttribute('data-pr-checks') ? 'checks' : this.hasAttribute('data-pr-files') ? 'files' : `step${this.getAttribute('data-guide-step')}`);
  } as never;
  act(() => useStore.setState({ appRoute: 'git' }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };
const q = (sel: string) => container.querySelector(sel) as HTMLElement | null;
const click = (el: HTMLElement | null) => act(() => { el!.click(); });
const render = async () => { act(() => root.render(createElement(GitDetail, { kind: 'pr', repoPath: '/r', repoLabel: 'r', pr }))); await flush(); };

describe('PR review order guide', () => {
  it('is absent when the PR body has no guide', async () => {
    bridge();
    await render();
    expect(q('[data-pr-guide]')).toBeNull();
    expect(q('[data-pr-approve-ready]')).toBeNull();
  });

  it('steps with Next to each location, and highlights Approve once every step is checked', async () => {
    bridge(guide);
    await render();
    expect(q('[data-pr-guide]')).not.toBeNull();
    expect(q('[data-guide-step="0"]')!.getAttribute('aria-current')).toBe('step');
    expect(q('[data-guide-step="0"]')!.textContent).toContain('(1) a.txt says fixed');

    click(q('[data-guide-next]'));
    expect(q('[data-guide-step="1"]')!.getAttribute('aria-current')).toBe('step');
    click(q('[data-guide-next]'));
    click(q('[data-guide-next]'));
    expect(scrolled).toEqual(['checks', 'files', 'step0']);

    const approve = () => q('[data-pr-review-event="APPROVE"]')!;
    click(q('[data-guide-check="0"]'));
    expect(approve().hasAttribute('data-pr-approve-ready')).toBe(false);
    expect(q('[data-guide-done]')).toBeNull();
    // The code step is optional: what was asked + proof is enough.
    click(q('[data-guide-check="1"]'));
    expect(approve().hasAttribute('data-pr-approve-ready')).toBe(true);
    expect(approve().className).toContain('wmux-git-approve-ready');
    expect(q('[data-guide-done]')).not.toBeNull();
    expect(q('[data-guide-progress]')!.textContent).toContain('2');

    click(q('[data-guide-check="1"]'));
    expect(approve().hasAttribute('data-pr-approve-ready')).toBe(false);
  });

  it('keeps the checks when the pane is opened again for the same head', async () => {
    bridge(guide);
    await render();
    for (const i of [0, 1]) click(q(`[data-guide-check="${i}"]`));
    act(() => root.unmount());
    root = createRoot(container);
    await render();
    expect(q('[data-pr-approve-ready]')).not.toBeNull();
  });
});
