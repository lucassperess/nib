# Design direction

The three primary scenes are **Home**, **Downloads**, and **History**. Settings and Help are secondary. Home makes the link field, Video/Audio choice, and local file conversion easy to find. Downloads shows live tasks, errors, actions, and reliable progress. History contains completed results only.

Nib's illustrated nocturnal purple environments, large pixel wordmark, and sprite mascot come from the project's supplied design assets. The mascot lives in each scene, reacts to hover, and speaks in short phrases tied to real task states. Its speech never replaces the task status, progress, or error action. Reduced motion limits animation without hiding information.

Scene navigation briefly blacks out the current background and reveals the next. The UI should remain readable over detailed backgrounds, work at the minimum 920 × 620 window size, and preserve keyboard access. New labels and mascot lines must exist in both `pt-BR` and `en` catalogs.

See [ASSET_LICENSE.md](../ASSET_LICENSE.md) before reusing the artwork. Earlier research and wireframe decisions are in [archive](archive/README.md); they are historical context, not the current product specification.
