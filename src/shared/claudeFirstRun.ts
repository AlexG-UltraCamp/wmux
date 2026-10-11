// Claude Code's one-time first-run setup (the theme picker, then sign-in and
// the security notes) is an interactive TUI flow that fires no hook. When it
// blocks Moa's brain, the chat used to show the raw terminal screen ("Dark
// mode / Light mode / ... Syntax theme: ..."), which means nothing to someone
// who never opened a terminal. This recognises that screen from the excerpt
// the brain already captures, so the chat can say what to do instead.
//
// It is not pre-completed for the user: Claude Code has no supported
// non-interactive way to finish onboarding, and choosing a theme or signing
// in on the user's behalf by editing ~/.claude.json would be guessing at a
// private file format.

const MARKERS: RegExp[] = [
  /choose the text style/i,
  /syntax theme:/i,
  /light mode \(colorblind-friendly\)|dark mode \(colorblind-friendly\)/i,
  /select login method/i,
  /claude account with subscription/i,
  /anthropic console account/i,
  /security notes:/i,
  /use claude code's terminal setup\?/i,
];

/** True when a captured terminal excerpt is Claude Code's first-run setup. */
export function isClaudeFirstRunScreen(excerpt: string | undefined | null): boolean {
  if (!excerpt) return false;
  return MARKERS.some((re) => re.test(excerpt));
}
