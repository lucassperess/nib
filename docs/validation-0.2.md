# Nib 0.2 validation

## Local Windows x64 results

- `pnpm typecheck`, `pnpm test` (4 tests), and `pnpm build` passed.
- The unpacked 0.2 app started Cobalt from packaged resources, with the sandboxed preload and bridge active.
- A profile created by 0.1 kept its four completed History entries and download preferences. Finishing the 0.2 tour stored `tutorialSeenVersion: 1`; switching to Portuguese stored `locale: pt-BR` and immediately translated the scenes and help.
- The three tour steps, History type filter, and English/Portuguese Settings were checked in the packaged interface.
- Real YouTube video (744,413 bytes) and audio (309,288 bytes) downloads completed and their files existed in the selected download folder.
- A separate fresh 0.2 profile, launched with a minimal Windows-only `PATH`, passed the built-in smoke check: Cobalt ready, sandboxed bridge ready, and real video and audio downloads completed. That run measured 18.6 seconds from process start to local engine readiness.

| Measure | 0.1 | 0.2 | Method |
| --- | ---: | ---: | --- |
| Warm local engine readiness | 8.0 s | 5.2 s | Start the packaged app against the existing profile, poll for Cobalt's first loopback HTTP 200 response, stop the app. One run per version on the same PC. |
| Windows installer size | 265,999,134 B | 162,117,995 B | File size of locally built NSIS installers. |
| Cobalt runtime size | — | 128,564,942 B | Files under packaged `resources/cobalt`, including materialized dependencies. |

The timing is an exploratory comparison, not a benchmark: system cache, network and CPU load were uncontrolled. The 18.6-second fresh-profile smoke result includes a new local database and first engine start. More repeated measurements should be taken before claiming a stable startup improvement.

## Release gate

The [manual Windows installer smoke run](https://github.com/lucassperess/nib/actions/runs/38247305630) passed on commit `652758d`. It installed the package into an empty directory, launched Nib with no external Node or pnpm on `PATH`, confirmed the sandboxed bridge, and saved a real Streamable video (41,600,053 bytes) and its audio (710,072 bytes). The engine was ready after 2,486 ms on that runner. The report recorded no fallback attempts. The test used a fresh user profile and did not require a media account.

The automatic push trigger was disabled after repeated packaging failures caused unnecessary GitHub failure emails. Future installer runs require manual dispatch. Authenticated services and interrupted transfers still require separate service-specific follow-up evidence; the successful 41.6 MB video covers a moderate file, not a multi-gigabyte transfer.

The private [v0.2.0 preview](https://github.com/lucassperess/nib/releases/tag/v0.2.0) uses the installer from that successful run, built from commit `652758d34100ad09acd87366742f9039f04c310e`. The published asset is 161,249,598 bytes and has SHA-256 `7111C8B3B98C88CC6F0E701A37312A3B823331F49AA4FC41B698E089E782D53C`.
