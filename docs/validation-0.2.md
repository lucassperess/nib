# Nib 0.2 validation

## Local Windows x64 results

- `pnpm typecheck`, `pnpm test` (7 tests), and `pnpm build` passed. The tests include network failure, transfer pause/resume, cancellation during writing, and picker selection.
- The unpacked 0.2 app started Cobalt from packaged resources, with the sandboxed preload and bridge active.
- A profile created by 0.1 kept its four completed History entries and download preferences. Finishing the 0.2 tour stored `tutorialSeenVersion: 1`; switching to Portuguese stored `locale: pt-BR` and immediately translated the scenes and help.
- The three tour steps, History type filter, and English/Portuguese Settings were checked in the packaged interface.
- Real YouTube video (744,413 bytes) and audio (309,288 bytes) downloads completed and their files existed in the selected download folder.
- A separate fresh 0.2 profile, launched with a minimal Windows-only `PATH`, passed the built-in smoke check: Cobalt ready, sandboxed bridge ready, and real video and audio downloads completed. That run measured 18.6 seconds from process start to local engine readiness.

| Measure | 0.1 | 0.2 | Method |
| --- | ---: | ---: | --- |
| Warm local engine readiness | 8.0 s | 5.2 s | Start the packaged app against the existing profile, poll for Cobalt's first loopback HTTP 200 response, stop the app. One run per version on the same PC. |
| Windows installer size | 265,999,134 B | 161,249,681 B | The 0.1 local installer and final 0.2 installer built by the clean Windows runner. |
| Cobalt runtime size | — | 128,564,942 B | Files under packaged `resources/cobalt`, including materialized dependencies. |

The timing is an exploratory comparison, not a benchmark: system cache, network and CPU load were uncontrolled. The 18.6-second fresh-profile smoke result includes a new local database and first engine start. More repeated measurements should be taken before claiming a stable startup improvement.

## Release gate

The [final manual Windows installer smoke run](https://github.com/lucassperess/nib/actions/runs/38249296672) passed on commit `bbc4a66`. It installed the package into an empty directory, launched Nib with no external Node or pnpm on `PATH`, confirmed the sandboxed bridge, and saved a real Streamable video (41,600,053 bytes) and its audio (710,072 bytes). The engine was ready after 2,189 ms on that runner. The report recorded no fallback attempts. The test used a fresh user profile and did not require a media account.

The automatic push trigger was disabled after repeated packaging failures caused unnecessary GitHub failure emails. Future installer runs require manual dispatch. Authenticated services and interrupted transfers still require separate service-specific follow-up evidence; the successful 41.6 MB video covers a moderate file, not a multi-gigabyte transfer.

The private [v0.2.0 preview](https://github.com/lucassperess/nib/releases/tag/v0.2.0) uses the installer from that successful run, built from commit `bbc4a661fb6f4df0bd2ba5e33433eee72ea1fddf`. The published asset is 161,249,681 bytes and has SHA-256 `1D2EFDDF3B25A759833CD8E61342D8445BAEEAAB016E88AB25D4A961300241F5`.

## Local 0.2.1 candidate

The local `Nib Setup 0.2.1.exe` installs into a separate directory and starts with a fresh profile. Its sandboxed bridge reported version 0.2.1 and the engine became ready. The packaged app then completed a real Streamable video (41,600,053 bytes) and audio (710,072 bytes) with no fallback attempts. The fresh-profile startup took 39,126 ms on this PC. SHA-256: `EFEC17DBECC63839C2D15BAFFB2F329A390BCE186C0933465315E97AA83416B8`.

This candidate adds removal of failed and canceled entries from Downloads and rejects empty Cobalt media streams before FFmpeg. The specific YouTube video reported by the user still receives empty streams from the pinned Cobalt runtime; this candidate improves the error message but does not restore that download.
