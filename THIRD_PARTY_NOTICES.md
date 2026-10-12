# Third-party components

Nib's original source code is MIT licensed. Its artwork has separate terms in [ASSET_LICENSE.md](ASSET_LICENSE.md). The installer also carries independent third-party programs and libraries:

| Component | Use in Nib | License and source |
| --- | --- | --- |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Extractor executable, run as a separate process | [Unlicense](legal/yt-dlp-LICENSE.txt); [bundled dependency licenses](legal/yt-dlp-THIRD_PARTY_LICENSES.txt); [source](https://github.com/yt-dlp/yt-dlp) |
| [FFmpeg static Windows build](https://www.gyan.dev/ffmpeg/builds/) via [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) | Merge and conversion executable, run as a separate process | [GPL version 3](legal/ffmpeg-GPL-3.0.txt); [build information](legal/ffmpeg-build-README.txt); [FFmpeg source](https://github.com/FFmpeg/FFmpeg/commit/e38092ef93) |
| [Node.js](https://nodejs.org/) | Bundled runtime for site extraction scripts | [Node.js license and bundled notices](legal/node-LICENSE.txt); [source](https://github.com/nodejs/node/tree/v24.14.0) |
| [Electron](https://www.electronjs.org/), [Svelte](https://svelte.dev/), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | Desktop shell, interface, local database | Their licenses accompany the installed packages and remain their own. |

The installer includes these license texts under its `resources/legal` folder. The FFmpeg binary is a GPL build with its own source and license obligations; Nib invokes it as a separate program. Nib's MIT license does not relicense FFmpeg or any other third-party component.
