# Nib 0.1.0 preview

First Windows x64 preview of Nib. The installer includes the local Cobalt API, Node runtime and FFmpeg; no VPS, Node or pnpm installation is needed for normal use.

## Included

- Home with link input and video/audio choice; Downloads with queue, pause/resume, retry, cancel and a secondary file converter; completed-only History with search and media filters; Settings with destination, quality, reduced motion and encrypted cookie import.
- Three illustrated scenes from the supplied Nib designs, short scene transitions and a sprite atlas driven by real task states.
- Cobalt v11.7.1 pinned as a submodule. The original Cobalt code is not modified; Windows compatibility adjustments are applied to the local deployment bundle.

## Verified on Windows x64

- The installer completed on the development machine, and the installed app started its bundled engine.
- Public YouTube sample video and audio downloads completed in the installed/portable builds. Results appeared in History and used distinct filenames when a matching file already existed.
- Automated integration tests covered a two-item picker response and concurrent downloads to the same filename. Type checking and tests passed.

## Still to verify

- Installation and startup on a separate clean Windows x64 machine.
- Live multi-item posts and authenticated Instagram, YouTube and X cases. No account cookies were imported for this preview.
- Full coverage of Cobalt processing variants, source-specific failures and larger files.
- Additional sprite frames and final motion polish. The current atlas is a first implementation, not final character animation.

The repository and release are private. Review Cobalt's AGPL obligations and artwork rights before any public distribution. Spotify, playlists and batch automation are outside this preview.
