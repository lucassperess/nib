# Development

## Requirements

Windows x64, Git, Node.js 24.14.0, and pnpm 11. The end user needs none of these tools. The bundled Node license notice is from this pinned build version.

```powershell
git clone https://github.com/lucassperess/nib.git
cd nib
pnpm install --frozen-lockfile
pnpm prepare:tools
pnpm dev
```

`prepare:tools` downloads a pinned official yt-dlp executable and checks its SHA-256. It copies the installed FFmpeg binary and the current Node.js runtime into the ignored `.runtime/` directory. Build the app with `pnpm build`; package with `pnpm dist:win`. The installer appears under ignored `release/`.

Run `pnpm typecheck` and `pnpm test` before proposing a change. The manual [Windows installer smoke workflow](../.github/workflows/windows-smoke.yml) builds and installs the app on a Windows runner with Node and pnpm removed from `PATH` for the runtime check. It downloads a short public video and audio file, runs a local conversion, and writes a smoke report. Trigger it deliberately; it does not run on every push.

## Runtime structure

- `src/main/`: Electron main process, yt-dlp/FFmpeg subprocesses, queue, SQLite, sessions, and filesystem operations.
- `src/preload/`: typed IPC bridge between the sandboxed renderer and main process.
- `src/renderer/`: Svelte scenes, tutorial, localization, status UI, and mascot.
- `src/shared/`: commands and task types shared across processes.
- `assets/`: Nib artwork, licensed separately from the code.
- `docs/archive/`: historical research and validation from earlier engines and UI drafts.

Tasks and preferences live in SQLite under the app's Windows profile; media is written to the selected download directory. The renderer has no filesystem or extractor access. Task errors are stored as language-independent codes and translated in the UI. Cookies are encrypted at rest and materialized only for a matching task.

The release checklist is: typecheck, tests, build, clean Windows installer smoke, manual visual check at normal and minimum window sizes, release notes, and installer upload. Never commit credentials, cookies, downloaded media, `.runtime/`, or `release/`.
