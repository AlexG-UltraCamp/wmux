// wmux × Claude Code mod: the turn end classic hooks never fire.
//
// The classic bridge (integrations/claude, or `wmux setup-hooks`) stays the
// signal path for every turn edge it covers. One it cannot: an interrupted
// turn (Esc / Ctrl+C) fires no Stop (measured on Claude Code 2.1.296), so a
// hook-governed pane stays "running" until the next prompt. The engine's own
// `turn.complete` does fire there, with `reason: 'aborted'`, so this mod
// replays the missing Stop through the SAME bridge script: one wire format
// and one daemon path. `wmux_turn_reason` tells the daemon the turn was
// interrupted, which settles the pane without a "work finished" alarm.
//
// Deliberately not done here: observing the classic hooks (`classic.*`) or
// adding a system prompt section (`prompt.compose`). A Team organization
// seats Claude Code's default security plugin outermost, and it bypasses a
// user plugin's hooks on those events, so neither can be relied on.

import type { EngineInterface, Register } from 'claude-code'

/** Hard cap on the bridge run so a hung child never piles up. */
const BRIDGE_TIMEOUT_MS = 10_000

async function bridgePath($: EngineInterface): Promise<string | undefined> {
  const override = await $.env.get('WMUX_BRIDGE_PATH')
  if (override) return override
  // `wmux setup-hooks` (and the app's first-run hook install) copies the
  // bridge here so it survives app updates.
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
  return home ? `${home}/.wmux/hooks/wmux-bridge.mjs` : undefined
}

async function replayInterruptedStop($: EngineInterface, answer: string): Promise<void> {
  // Outside a wmux pane there is nobody to tell; the bridge would drop it.
  if (!(await $.env.get('WMUX_PTY_ID'))) return
  const bridge = await bridgePath($)
  if (!bridge || !(await $.fs.exists(bridge))) return
  const payload = {
    hook_event_name: 'Stop',
    session_id: await $.session.id(),
    cwd: await $.session.cwd(),
    last_assistant_message: answer,
    wmux_source: 'mod',
    wmux_turn_reason: 'aborted',
  }
  await $.process.run(['node', bridge, 'Stop'], {
    stdin: JSON.stringify(payload),
    timeoutMs: BRIDGE_TIMEOUT_MS,
  })
}

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    // Subagent runs end with SubagentStop; only the main loop's interrupt is a gap.
    if (e.agentId === undefined && e.reason === 'aborted') {
      // Not awaited: the turn's end must never wait on wmux.
      replayInterruptedStop($, e.answer).catch(err =>
        $.ui.log(`wmux: Stop replay failed: ${String(err)}`, { to: 'debug' }),
      )
    }
    return done
  })
}
