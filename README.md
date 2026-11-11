# Glyph list

A Figma plugin that lays out every character of an installed font, grouped and counted, for proofing. It reads the font file on your Mac at the moment you run it, so the list always shows the build you just exported.

It works in Figma Design and Figma Slides, and needs [Figma Friend](https://github.com/HelsinkiTypeStudio/font-helper) running.

## Using it

1. Select a text layer set in the font you want listed. You can also select a frame or a slide: every font in it gets its own list (up to 8).
2. Choose **Plugins → Glyph list**.

In Figma Design the list appears as a frame to the right of your selection. In Figma Slides it goes on a new slide after the current one, continuing on more slides if it doesn't fit.

Each list shows:

- the font file, its version and when it was saved,
- every character the font maps, in groups: uppercase, other uppercase letters (Ø, Æ, Þ), accented uppercase, the same for lowercase, other letters, figures, fractions, punctuation, currency, math, symbols, accents and combining accents,
- spaces by their codes, since they can't be seen,
- how many glyphs have no Unicode value. Alternates such as .ss01 can't be typed into a text layer, so they are counted but not shown.

Combining accents sit on a dotted circle (◌), or on a no-break space if the font has no dotted circle, so they don't pile onto their neighbours. Labels and notes are set in Inter, so they stay readable while a font is still incomplete.

The first time, Figma Friend asks whether to allow the plugin.

## Install

```sh
git clone https://github.com/HelsinkiTypeStudio/figma-glyph-list.git
cd figma-glyph-list
npm install
npm run build
```

Then in the Figma desktop app: **Plugins → Development → Import plugin from manifest…** and pick `manifest.json`.

## Development

```sh
npm run watch       # rebuilds on save
npm run typecheck
```

## Licence

MIT
