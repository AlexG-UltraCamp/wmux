import { describe, it, expect } from 'vitest';
import { claudeCandidates, resolveClaudeExecutableWith, type ResolveClaudeEnv } from '../resolveClaudeExecutable';

function posix(files: string[], env: Record<string, string> = {}, platform: NodeJS.Platform = 'linux'): ResolveClaudeEnv {
  const set = new Set(files);
  return { platform, env, homedir: '/home/u', isFile: (p) => set.has(p) };
}

describe('resolveClaudeExecutable', () => {
  it('finds claude on PATH (npm global / any install the terminal would run)', () => {
    const r = posix(['/opt/node/bin/claude'], { PATH: '/usr/bin:/opt/node/bin' });
    expect(resolveClaudeExecutableWith(r)).toBe('/opt/node/bin/claude');
  });

  it('prefers the PATH hit over the native-installer location', () => {
    const r = posix(['/opt/node/bin/claude', '/home/u/.local/bin/claude'], { PATH: '/opt/node/bin' });
    expect(resolveClaudeExecutableWith(r)).toBe('/opt/node/bin/claude');
  });

  it('falls back to ~/.local/bin when PATH misses it (GUI launch, minimal PATH)', () => {
    const r = posix(['/home/u/.local/bin/claude'], { PATH: '/usr/bin' });
    expect(resolveClaudeExecutableWith(r)).toBe('/home/u/.local/bin/claude');
  });

  it('checks Homebrew locations on macOS even with an empty PATH', () => {
    expect(resolveClaudeExecutableWith(posix(['/opt/homebrew/bin/claude'], {}, 'darwin'))).toBe('/opt/homebrew/bin/claude');
    expect(resolveClaudeExecutableWith(posix(['/usr/local/bin/claude'], {}, 'darwin'))).toBe('/usr/local/bin/claude');
  });

  it('checks the npm global prefix from npm_config_prefix', () => {
    const r = posix(['/srv/npm/bin/claude'], { npm_config_prefix: '/srv/npm' });
    expect(resolveClaudeExecutableWith(r)).toBe('/srv/npm/bin/claude');
  });

  it('returns null when nothing exists', () => {
    expect(resolveClaudeExecutableWith(posix([], { PATH: '/usr/bin' }))).toBeNull();
  });

  it('keeps scanning past a path whose check throws', () => {
    const r: ResolveClaudeEnv = { platform: 'linux', env: { PATH: '/a:/b' }, homedir: '/home/u',
      isFile: (p) => { if (p === '/a/claude') throw new Error('EACCES'); return p === '/b/claude'; } };
    expect(resolveClaudeExecutableWith(r)).toBe('/b/claude');
  });

  it('never picks a claude planted in the current folder via empty or relative PATH entries', () => {
    const planted = ['claude', './claude', 'node_modules/.bin/claude', '/home/u/.local/bin/claude'];
    const r = posix(planted, { PATH: ':.:node_modules/.bin::/usr/bin' });
    expect(resolveClaudeExecutableWith(r)).toBe('/home/u/.local/bin/claude');
    expect(claudeCandidates(r).every((c) => c.startsWith('/'))).toBe(true);
  });

  describe('Windows', () => {
    const win = (files: string[], env: Record<string, string>): ResolveClaudeEnv => {
      const set = new Set(files.map((f) => f.toLowerCase()));
      return { platform: 'win32', env, homedir: 'C:\\Users\\u', isFile: (p) => set.has(p.toLowerCase()) };
    };

    it('respects PATHEXT and finds claude.exe on PATH', () => {
      const r = win(['C:\\tools\\claude.exe'], { PATH: 'C:\\Windows;C:\\tools', PATHEXT: '.COM;.EXE;.BAT;.CMD' });
      expect(resolveClaudeExecutableWith(r)).toBe('C:\\tools\\claude.exe');
    });

    it('skips an unspawnable claude.cmd shim and uses the npm package entrypoint', () => {
      const appData = 'C:\\Users\\u\\AppData\\Roaming';
      const cli = `${appData}\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js`;
      const r = win([`${appData}\\npm\\claude.cmd`, cli], { PATH: `${appData}\\npm`, PATHEXT: '.EXE;.CMD', APPDATA: appData });
      expect(resolveClaudeExecutableWith(r)).toBe(cli);
    });

    it('does not search the cwd first and ignores relative / drive-relative entries', () => {
      const r = win(['claude.exe', '.\\claude.exe', 'tools\\claude.exe', '\\x\\claude.exe'], { PATH: ';.;tools;\\x', PATHEXT: '.EXE' });
      expect(resolveClaudeExecutableWith(r)).toBeNull();
      expect(claudeCandidates(r).filter((c) => !/^[A-Za-z]:\\/.test(c))).toEqual([]);
    });

    it('never lists .cmd or .bat candidates', () => {
      const c = claudeCandidates(win([], { PATH: 'C:\\x', PATHEXT: '.EXE;.BAT;.CMD' }));
      expect(c.some((p) => /\.(cmd|bat)$/i.test(p))).toBe(false);
      expect(c).toContain('C:\\Users\\u\\.local\\bin\\claude.exe');
    });
  });
});
