### Fixed

- **Moa finds Claude Code wherever your terminal finds it.** Moa only looked
  in `~/.local/bin` (and the Windows npm folder), so a Claude Code installed
  with npm, Homebrew or any other way on your PATH showed "Claude Code not
  found", and the welcome screen could disagree with Moa about whether Claude
  was installed. wmux now looks on PATH first (only absolute folders, never
  the current folder, so a `claude` file inside an opened project is never
  run), then in `~/.local/bin`, the npm global folder and Homebrew's
  `/opt/homebrew/bin` and `/usr/local/bin`. The welcome screen and Moa use
  the same check, so they always agree.
