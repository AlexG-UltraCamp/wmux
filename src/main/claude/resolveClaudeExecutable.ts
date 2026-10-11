import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// One answer to "where is the user's claude?", shared by Moa (the deck
// adapters) and the first-run wizard's "Claude Code detected" row so the two
// can never disagree.
//
// Order: PATH first (what the user's own terminal would run), then the
// install locations a GUI-launched app often misses on PATH (macOS apps
// started from Finder get a minimal PATH, so Homebrew and ~/.local/bin are
// checked explicitly).
//
// Windows: a `claude.cmd` npm shim is NOT spawnable (Node 20+ EINVAL without
// shell:true), so .cmd/.bat hits from PATHEXT are skipped and the npm
// package's real entrypoint (bin/claude.exe, or cli.js run via node) is used.

export interface ResolveClaudeEnv {
  platform: NodeJS.Platform;
  env: Record<string, string | undefined>;
  homedir: string;
  /** True when `p` is an existing regular file (or symlink to one). */
  isFile: (p: string) => boolean;
}

const UNSPAWNABLE_EXTS = new Set(['.cmd', '.bat']);

function pathDirs(r: ResolveClaudeEnv): string[] {
  const raw = r.env.PATH ?? r.env.Path ?? r.env.path ?? '';
  const sep = r.platform === 'win32' ? ';' : ':';
  const p = r.platform === 'win32' ? path.win32 : path.posix;
  // Only absolute entries: an empty entry or '.' means "the current folder",
  // which would let a `claude` planted in an opened repo run instead of the
  // user's install (Windows also searches cwd first; we never do).
  return raw
    .split(sep)
    .map((d) => d.trim().replace(/^"(.*)"$/, '$1'))
    .filter((d) => d.length > 0 && p.isAbsolute(d) && !(r.platform === 'win32' && /^[\\/](?![\\/])/.test(d)));
}

function pathExts(r: ResolveClaudeEnv): string[] {
  const raw = r.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD';
  return raw
    .split(';')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.startsWith('.') && !UNSPAWNABLE_EXTS.has(e));
}

/** Every candidate path, in priority order. Pure; exported for tests. */
export function claudeCandidates(r: ResolveClaudeEnv): string[] {
  const p = r.platform === 'win32' ? path.win32 : path.posix;
  const out: string[] = [];
  const win = r.platform === 'win32';
  for (const dir of pathDirs(r)) {
    if (win) for (const ext of pathExts(r)) out.push(p.join(dir, `claude${ext}`));
    else out.push(p.join(dir, 'claude'));
  }
  // Native installer (self-updating).
  out.push(p.join(r.homedir, '.local', 'bin', win ? 'claude.exe' : 'claude'));
  if (win) {
    const appData = r.env.APPDATA;
    if (appData) {
      const pkg = p.join(appData, 'npm', 'node_modules', '@anthropic-ai', 'claude-code');
      out.push(p.join(pkg, 'bin', 'claude.exe'), p.join(pkg, 'cli.js'));
    }
  } else {
    // npm global prefix: explicit config, then the common user-level prefix.
    const prefix = r.env.npm_config_prefix ?? r.env.NPM_CONFIG_PREFIX;
    if (prefix) out.push(p.join(prefix, 'bin', 'claude'));
    out.push(p.join(r.homedir, '.npm-global', 'bin', 'claude'));
    // Homebrew (Apple silicon, Intel / Linuxbrew-style).
    out.push('/opt/homebrew/bin/claude', '/usr/local/bin/claude');
    out.push('/home/linuxbrew/.linuxbrew/bin/claude');
  }
  return [...new Set(out)];
}

export function resolveClaudeExecutableWith(r: ResolveClaudeEnv): string | null {
  const p = r.platform === 'win32' ? path.win32 : path.posix;
  for (const c of claudeCandidates(r)) {
    if (!p.isAbsolute(c)) continue;
    try {
      if (r.isFile(c)) return c;
    } catch {
      /* inaccessible path — keep scanning */
    }
  }
  return null;
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

let lastLogged: string | null | undefined;

export function resolveClaudeExecutable(): string | null {
  const found = resolveClaudeExecutableWith({
    platform: process.platform,
    env: process.env,
    homedir: os.homedir(),
    isFile,
  });
  if (found !== lastLogged) {
    lastLogged = found;
    console.log(`[claude] executable: ${found ?? 'not found'}`);
  }
  return found;
}
