# Portfolio — Home

Built from Figma `Hire V2.0` → node `13284:12692`.

```
index.html
styles.css
download-assets.sh
images/            ← you create this
```

## 1. Get the images in

Fastest path — grab the Figma exports as a safety net:

```bash
bash download-assets.sh
```

Then replace them with proper exports. **Export each frame at 2x**, keep the
filenames below exactly as-is, and drop them in `images/`:

| File | Source frame | Export at |
| --- | --- | --- |
| `avatar.png` | nav avatar | 2x (60 × 60) |
| `hero-portrait.png` | hero circle | 2x (710 × 712) |
| `project-01…19.png` | one per card | 2x |
| `icon-social-1.svg`, `icon-social-2.svg` | nav icons | SVG |

Card frames are 1280×800, 1320×859 or 1320×1408 in the design, so 2x means
2560×1600, 2640×1718 and 2640×2816 respectively. Anything less will look soft
on a retina screen, since the card renders 1320px wide at a 1440px viewport.

Converting to WebP is worth it (roughly 70% smaller at the same quality) —
just find-and-replace `.png` → `.webp` in `index.html` afterwards.

## 2. Two things to delete before shipping

1. **The fallback script** at the bottom of `index.html`. It points missing
   local images at their Figma URLs so the page previews before you've
   downloaded anything. Those URLs expire ~7 days after 2026-08-26.
2. **The Google Fonts `<link>`** in `<head>`, once you self-host Inter Tight.
   The `@font-face` block is already written at the top of `styles.css` —
   uncomment it and put `InterTight-SemiBold.woff2` in `fonts/`.
   SemiBold (600) is the only weight the page uses.

## Where things live

Every measurement is a token in `:root` at the top of `styles.css`:

- `--track: -0.01em` — every tracking value in the Figma file is exactly -1%
  of its font size, so it's one token, not four.
- `--lh-tight: 1.1` (headings) and `--lh-flat: 1` (labels) are the only two
  line heights on the page.
- `--pad-page`, `--pad-hero`, `--pad-card`, `--gap-work` — change one, it
  changes everywhere.

Project sizing is ratio-based, not fixed pixels. Each `.shot` is `flex: 1`
inside a 40px-padded card, so it lands at exactly 1320px wide at a 1440px
viewport, and `aspect-ratio` gives the exact design height from there
(825px / 859px / 1408px). It stays exact at 1440 and scales cleanly below it.

Breakpoints: 1180px (hero shrinks), 900px (type steps down), 720px (hero
stacks — portrait, heading, quote).
