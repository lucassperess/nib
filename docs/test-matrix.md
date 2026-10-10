# Validation matrix

Checked on Windows x64 on 2026-10-09 and 2026-10-10. The sample link used for both formats was the public short YouTube video `https://www.youtube.com/watch?v=jNQXAC9IVRw`.

| Flow | Result | Evidence / limit |
| --- | --- | --- |
| Local Cobalt start and HTTP response | Works | API bound to `127.0.0.1`; authenticated local request returned a media response. |
| Video download | Works in development and packaged app | Saved `Me at the zoo - jawed (240p, h264).mp4`; FFmpeg decoded the development download without errors. The packaged app saved a second, distinct file without overwriting the first. |
| Audio download | Works in development and installed app | Saved `Me at the zoo - jawed.m4a`; the installed app saved another copy with a distinct name. |
| Picker with two items | Works in automated integration test | Fake Cobalt picker returned two items; each selected item completed into a distinct file. Live multi-item source remains to be checked. |
| Completed-only History | Works in development and packaged app | Video and audio moved from Downloads into History. The packaged app reopened the existing history and added a new completed video. |
| Encrypted imported sessions | Implementation present; live service test pending | Vault uses Electron safeStorage. No personal credentials were imported for testing. |
| Windows installer | Works on development machine | `Nib Setup 0.1.0.exe` installed silently with exit code 0. The installed app launched its bundled local Cobalt and completed an audio download. A separate clean Windows machine remains to be checked. |

Authenticated service cases must be tested with a session supplied by the user. Record each service as `works`, `limited` or `does not work`, including the URL class, expected result, actual result and date. Do not store raw session values in this document.
