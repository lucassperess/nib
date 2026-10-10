# Nib

Nib is a Windows x64 desktop companion for saving media from links. It runs a pinned [Cobalt API](https://github.com/imputnet/cobalt) process locally. Nib owns the queue, file handling, history, interface, and animated character. No VPS, account with Nib, or separate Node installation is required for the packaged app.

The repository is private for now but organized for eventual publication. A license for Nib's original code and artwork has not been chosen. Do not redistribute a build before reviewing Cobalt's AGPL obligations and the rights to the supplied artwork. Nib does not use Cobalt's web frontend or branding.

## First use

1. Install a validated release from this private repository's [Releases](https://github.com/lucassperess/nib/releases) on Windows x64. The app starts its local engine automatically.
2. Follow Nib's three-step tour, or skip it. **Settings → Help → Replay the tour** opens it again without resetting preferences.
3. On Home, paste or drop a supported link and choose Video or Audio.
4. Follow the task in Downloads. If a link contains multiple items, choose the ones to save.
5. Open finished files from History. Only completed tasks enter History; queued, failed, and canceled tasks remain in Downloads.

Settings lets you choose the download folder, quality, audio format, language, and reduced motion. The interface and in-app help support English and Brazilian Portuguese. **System language** chooses Portuguese for a Portuguese Windows locale and English otherwise. Settings also offers manual release checking and an exportable diagnostic report.

Spotify, playlists, and bulk automation are outside the current scope. Format and availability depend on the site's response through Cobalt. Account cookies can help with media that your account may access, but cannot guarantee restricted content. Nib does not bypass DRM.

## Architecture

| Part | Responsibility |
| --- | --- |
| Electron main process | Starts and stops Cobalt, validates window commands, controls downloads and FFmpeg, stores preferences and tasks. |
| Sandboxed Svelte renderer | Renders the three scenes, Settings, tour, help, localized messages, and task progress. It has no Node or filesystem access. |
| Preload bridge | Exposes a small set of typed commands and events to the renderer. The API key is never passed through it. |
| Cobalt API | Resolves supported media links on a random port bound to `127.0.0.1`, with a random local API key. |
| SQLite | Stores task metadata, history, tutorial version, and preferences in the user's profile. Media is stored in the chosen download folder. |

The renderer loads an initial queue and one page of History. Transfer progress arrives as task updates, while History is requested in pages of up to 100 items. A successful transfer enters a visible **Saving the file** stage, then uses an asynchronous exclusive copy into its final name. Existing files are never overwritten automatically. Interrupted tasks are queued for a fresh attempt after restart.

The Cobalt dependencies are resolved and materialized during `prepare:cobalt` at build time. Electron Builder copies the materialized `node_modules` through a separate `extraResources` entry; this is intentional because its general resource copy ignores that directory. The packaged engine executes from read-only application resources. Runtime key and cookie files live in the user profile and are removed on normal shutdown and at the next startup after a crash.

## Development and build

Install Node.js 24, pnpm 11, and Git on Windows x64:

```powershell
git clone --recurse-submodules <private-repository-url>
cd Nib
pnpm install
pnpm prepare:cobalt
pnpm dev
```

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before packaging. `pnpm dist:win` prepares the bundle and creates a Windows installer under `release/`. Close any running unpacked build before rebuilding it. The release process must verify the installer on a clean Windows x64 environment without Node or pnpm, including one real video and one real audio download, before publishing a 0.2 preview.

`prepare:cobalt` verifies the pinned upstream revision, deploys the API into an ignored bundle, applies two Windows/runtime compatibility changes only to that bundle, materializes dependencies, and copies the Node executable. The upstream submodule remains unchanged. Do not commit `.bundle/`, `.runtime/`, `release/`, local databases, or session files.

## Privacy and security

- Queue, History, settings, and downloaded media stay on the user's computer. Nib contacts the linked service to resolve and download media.
- Imported account cookies are encrypted with Windows protection at rest. They are materialized for the local Cobalt process during use; only import cookies for an account you control.
- The engine listens only on `127.0.0.1` and requires a generated local key. The renderer does not receive that key.
- The Electron renderer uses sandbox and context isolation. Navigation and new windows are blocked; release links open through a fixed external URL.
- **Export diagnostics** is user-initiated. Its JSON contains app/OS version, engine state, startup time, task counts, and error-code counts. It excludes complete URLs, cookies, the local key, media titles, and personal file paths. Review the file before sharing it.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| Local engine does not start | Use **Try starting it again**. If it repeats, export diagnostics and check that security software has not quarantined the bundled Node/Cobalt files. |
| Link cannot be read | Try the direct post or media URL. Some sites change behavior or limit particular content. |
| Session required or expired | Import a fresh cookie in Settings for an account that can view the content, then retry. |
| Download fails or stalls | Retry from Downloads and check the connection. A restarted app resolves a fresh media link and starts an interrupted transfer again. |
| File cannot be saved | Select a writable folder in Settings and check free disk space. |
| Conversion fails | Try another output format. The original file remains untouched. |

Known limits: Nib cannot promise every service, quality, or restricted item; resumable transfer is limited to the current session; after restart an interrupted task starts again; releases are checked manually; and the first sprite atlas should be reviewed before any public distribution.

## Cobalt attribution

Cobalt is included as a Git submodule in `vendor/cobalt` at `a636575b09de1fc55d9b8cd98cac88f5f2f16b42` (v11.7.1). Its API is licensed under AGPL-3.0; see `vendor/cobalt/api/LICENSE`. The deployed bundle changes `@imput/version-info` to fixed metadata because the deployment is outside the upstream Git checkout, and changes `FileWatcher.fromFileProtocol` to use Node's `fileURLToPath` on Windows. The source submodule remains unmodified.

Nib's visual assets live in `assets/`. The backgrounds and wordmark were supplied for this project. The first sprite atlas was generated from the supplied Nib character reference.
