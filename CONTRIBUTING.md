# Contributing to Nib

Nib is a Windows x64 desktop project. Please open an issue before large changes so the intended behavior can be agreed on first. Small bug fixes can go directly into a pull request.

1. Read the [development guide](docs/DEVELOPMENT.md) and create a branch from `main`.
2. Keep the UI in English and Brazilian Portuguese, including accessible labels and mascot messages.
3. Keep media, downloads, History, and account sessions local. Do not add a hosted service or telemetry without discussing it first.
4. Run `pnpm typecheck`, `pnpm test`, and `pnpm build`. Explain any live service tests in the PR without posting private links or cookies.
5. Do not submit third-party screenshots, account credentials, downloaded media, or generated installers to Git.

Code contributions are under the repository's MIT license. Artwork under `assets/` remains subject to [ASSET_LICENSE.md](ASSET_LICENSE.md). Report security issues privately as described in [SECURITY.md](SECURITY.md).
