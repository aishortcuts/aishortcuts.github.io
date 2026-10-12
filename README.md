# aishortcuts.github.io

Static website for [AI Shortcuts](https://github.com/gemkids275/AIShortcuts). Plain HTML and CSS, no build step, served by GitHub Pages from `main`.

- `index.html` (English) and `vi/index.html` (Vietnamese)
- Download buttons are updated automatically: when a release is published in [AIShortcuts](https://github.com/gemkids275/AIShortcuts), its workflow runs `.github/scripts/update_site_downloads.py` and pushes the new links here (`win-v<N>` for Windows/Linux, `mac-v<X.Y>` for macOS). Do not edit those links by hand.
- Keep `sitemap.xml` and the `hreflang` links in sync when adding pages.
