# Self-hosted Fonts

These woff2 files are the **latin subset** of nine OFL-licensed families
(Plus Jakarta Sans, Inter, Outfit, Playfair Display, Lora, Merriweather,
Cinzel, JetBrains Mono, Fira Code), downloaded from the official Google
Fonts CSS API (fonts.googleapis.com / fonts.gstatic.com) so AetherMind
never needs a runtime network connection for typography.

Each family is licensed under the SIL Open Font License 1.1:
https://openfontlicense.org

Re-fetch with the same query used by the app: see the @import removed from
src/styles/base.css (display=swap) - the exact face list is in
src/styles/fonts.css and src/utils/exportHtml.ts.
