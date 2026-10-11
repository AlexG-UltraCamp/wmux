import { describe, it, expect } from 'vitest';
import { isClaudeFirstRunScreen } from '../claudeFirstRun';

describe('isClaudeFirstRunScreen', () => {
  it('recognises the theme picker seen while dogfooding', () => {
    const excerpt = '❯ ✔ Dark mode\nLight mode\nDark mode (colorblind-friendly)\nLight mode (colorblind-friendly)\nDark mode (ANSI colors only)\n1 function greet() {\nSyntax theme: Monokai Extended (ctrl+t to disable)';
    expect(isClaudeFirstRunScreen(excerpt)).toBe(true);
  });

  it('recognises the login method screen', () => {
    expect(isClaudeFirstRunScreen('Select login method:\n❯ 1. Claude account with subscription')).toBe(true);
  });

  it('does not flag an ordinary permission dialog or empty text', () => {
    expect(isClaudeFirstRunScreen('Do you want to allow WebFetch to example.com?\n❯ 1. Yes\n2. No')).toBe(false);
    expect(isClaudeFirstRunScreen('Do you trust the files in this folder?')).toBe(false);
    expect(isClaudeFirstRunScreen('')).toBe(false);
    expect(isClaudeFirstRunScreen(undefined)).toBe(false);
  });
});
