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

The private 0.2 preview must remain unpublished until the Windows installer smoke workflow succeeds on a fresh Windows x64 runner. It installs into an empty directory, launches Nib with no external Node or pnpm on `PATH`, checks the sandboxed bridge, and performs real video and audio downloads. Authenticated services, large files, and interrupted transfers require separate service-specific follow-up evidence.
