# Nib

Nib is a Windows x64 desktop companion for saving media from links. Its interface, queue, file handling, history, and animated character are original to Nib. Media extraction runs locally through a pinned [yt-dlp](https://github.com/yt-dlp/yt-dlp) executable, with bundled Node.js for site scripts and [FFmpeg](https://ffmpeg.org/) for media processing. There is no VPS or separate runtime installation for users.

![Nib Home, with the link field, Video and Audio choices, and the mascot](docs/screenshots/home.png)

## Baixar e instalar — sem terminal

1. Abra a página de [Releases do Nib](https://github.com/lucassperess/nib/releases/latest).
2. Na seção **Assets**, clique no arquivo do Nib que termina em **.exe** para baixar o instalador. Não escolha **Source code** se você só quer usar o aplicativo.
3. Abra o arquivo baixado, siga o instalador e inicie **Nib** pelo menu Iniciar.
4. Siga o tutorial dentro do app. Na Home, cole um link, escolha **Vídeo** ou **Áudio** e clique em **Baixar**. Acompanhe em **Downloads** e abra o arquivo em **Histórico**.

Guia ilustrado por etapas, problemas comuns e instruções em inglês: [Como baixar e usar o Nib](docs/INSTALL.md). O Nib funciona localmente; você não precisa instalar Node.js, pnpm ou FFmpeg.

## First use

1. Install a validated build from [Releases](https://github.com/lucassperess/nib/releases) on Windows x64.
2. Follow or skip Nib's five-step tour, including local file conversion and private sessions. **Settings → Help → Replay the tour** is always available.
3. Paste or drop a media link on Home and choose Video or Audio. **Convert a file** on Home opens a separate local workflow.
4. Follow the task in Downloads. Select items if a link resolves to multiple media items.
5. Open finished files from History. Failed and canceled tasks stay in Downloads until removed; neither appears in History.

Settings lets you choose a download folder, quality, audio format, language, reduced motion, and import account cookies. The interface and help support English and Brazilian Portuguese. **System language** chooses Portuguese for a Portuguese Windows locale and English otherwise.

If a download fails, use **Retry** or **Remove** in Downloads. You do not need to reinstall Nib for an individual task failure. **Settings → Download engine → Update extractor** can refresh site support in the installed app without changing Nib's UI or database. Wait until active downloads finish before updating. A new Nib installer is needed only for application code or asset updates. Downloaded files and History persist across installs.

Site availability, available qualities, and formats depend on the source. Cookies may help with content accessible to your account but cannot guarantee restricted content. Nib does not bypass DRM. Spotify and bulk playlist downloads are outside the current scope.

## Architecture

| Part | Responsibility |
| --- | --- |
| Electron main process | Runs extraction and download subprocesses, controls files, validates UI commands, and stores local data. |
| Sandboxed Svelte renderer | Renders Home, Downloads, History, Settings, tour, help, and the animated Nib. It has no direct filesystem access. |
| Preload bridge | Exposes typed commands and task events to the renderer. |
| yt-dlp | Extracts media information and downloads media with per-task processes. Its installed executable can be updated independently. |
| FFmpeg | Merges or converts streams when needed. |
| SQLite | Stores task metadata, History, tutorial version, and preferences in the user's profile. Media stays in the chosen download folder. |

At most two tasks run concurrently. Each task uses a temporary directory, then an asynchronous exclusive copy to its final filename. Existing files are never overwritten. Local conversions preserve the original and appear in Downloads while running and History after completion. History contains only completed tasks. Interrupted tasks are queued for a fresh attempt after restart. The renderer receives task changes rather than rebuilding the full History on every progress update. Downloaded bytes and an overall total appear when the extractor reports reliable sizes; otherwise Nib labels the total as unavailable.

## Development and build

Install Node.js 24.14.0, pnpm 11, and Git on Windows x64:

```powershell
git clone https://github.com/lucassperess/nib.git
cd nib
pnpm install
pnpm prepare:tools
pnpm dev
```

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before packaging. `pnpm dist:win` prepares the pinned tools and creates an installer in `release/`. The tool preparation script verifies the SHA-256 of the pinned official yt-dlp binary. A packaged smoke mode checks the sandboxed UI bridge and real video/audio downloads. The manual GitHub Actions workflow also installs the package with no external Node or pnpm on `PATH`.

Do not commit `.runtime/`, `.bundle/`, `release/`, local databases, session files, or downloaded media. See the [development guide](docs/DEVELOPMENT.md), [design guide](docs/DESIGN.md), and [historical notes](docs/archive/README.md).

## Privacy and security

- Queue, History, settings, and media remain on the user's computer. Nib contacts the linked service and, only when requested, the official yt-dlp release source for an extractor update.
- Imported cookie strings are encrypted with Windows protection at rest. For a matching task, Nib writes a temporary Netscape cookie file in its task directory and deletes it afterward. Import cookies only for accounts you control.
- The Electron renderer uses sandbox and context isolation. Navigation and new windows are blocked; the fixed release URL opens externally.
- **Export diagnostics** is user initiated. It contains app/OS version, engine state, startup time, task counts, and error-code counts. It excludes complete URLs, cookies, media titles, and personal paths. Review it before sharing.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| Engine cannot start | Use **Try starting it again**. If it repeats, check whether security software quarantined the bundled tools. |
| Link cannot be read | Try a direct post or media URL. Some sites change their extraction rules; use **Update extractor** in Settings and retry. |
| Session required or expired | Import a fresh cookie string for an account with access, then retry. |
| Download fails or stalls | Retry from Downloads and check the connection. A restarted app resolves the media again. |
| File cannot be saved | Choose a writable folder in Settings and check free disk space. |
| Conversion fails | Try another format. The original file remains untouched. |

The installed extractor is not automatically updated. Some services change often, so a pinned version can stop working until the user requests an update. A task paused during the current session can resume; after app restart, interrupted tasks restart from the beginning.

## Credits

Nib's original code is [MIT licensed](LICENSE). The Nib backgrounds, wordmark, icon, mascot, and sprites are [rights reserved](ASSET_LICENSE.md). Bundled tools have their own terms and source links in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Earlier design research remains in `docs/archive/`; third-party reference screenshots are not part of the current source tree.
