# Nib

Nib is a Windows x64 desktop app for saving media from links. It uses a locally bundled [Cobalt API](https://github.com/imputnet/cobalt) process for media resolution, while the queue, files, history, interface and mascot belong to Nib. No VPS is required.

This repository is private for now, but is organized for a future public release. The license for original Nib code and artwork has not been selected. Do not redistribute the installer before completing a review of Cobalt's AGPL obligations and the rights to the supplied artwork. The Cobalt web frontend and branding are not used.

## First run

1. Install `Nib Setup 0.1.0.exe` from `release/` on Windows x64.
2. Open Nib. The local engine starts automatically and binds only to `127.0.0.1`.
3. On Home, paste a supported link and choose Video or Audio.
4. Watch the task on Downloads. If a link contains multiple items, choose which ones to save.
5. Finished files appear in History. Use **Open** or **Folder** to find them.
6. In Settings, choose the destination folder and quality preferences. Import account cookies only when you need content accessible through your account.

Spotify, playlists and bulk automation are outside this first version. Availability and formats depend on Cobalt's response and each service's current behavior. Only completed files appear in History; unfinished or failed tasks stay in Downloads.

## Development

Install Node.js 24, pnpm 11 and Git on Windows x64, then:

```powershell
git clone --recurse-submodules <private-repository-url>
cd Nib
pnpm install
pnpm prepare:cobalt
pnpm dev
```

`pnpm prepare:cobalt` verifies the pinned upstream commit, deploys the API into an ignored local bundle, applies two Windows/runtime compatibility patches only to that bundle, and copies the current Node executable. Close the running Nib app before rebuilding the bundle. Build the installer with `pnpm dist:win`.

The app stores task metadata, preferences and encrypted imported cookies under the Windows user profile. Media stays in the chosen download folder. Runtime key and cookie files are removed during normal shutdown and on the next startup after an abnormal exit. Do not commit `.bundle/`, `.runtime/`, `release/`, local databases or session files.

## Cobalt attribution

Cobalt is included as a Git submodule in `vendor/cobalt` at `a636575b09de1fc55d9b8cd98cac88f5f2f16b42` (v11.7.1). Its API is licensed under AGPL-3.0; see `vendor/cobalt/api/LICENSE`. The deployed bundle changes `@imput/version-info` to fixed metadata because the deployment is outside the upstream Git checkout, and changes `FileWatcher.fromFileProtocol` to use Node's `fileURLToPath` on Windows. The upstream submodule remains unmodified.

Nib's visual assets are in `assets/`. The backgrounds and wordmark were supplied for this project. The first sprite atlas was generated from the supplied Nib character reference and should be reviewed before any public distribution.
