# Glyph list

A Figma plugin that fills a text layer with every character of an installed font, grouped, for proofing. It reads the font file on your Mac at the moment you run it, so the list always shows the build you just exported.

It works in Figma Design and Figma Slides, and needs [Figma Friend](https://github.com/HelsinkiTypeStudio/font-helper) running.

## Using it

1. Select a text layer set in the font you want listed. Size, colour, spacing and the rest of its settings stay as they are.
2. Choose **Plugins → Glyph list**.

The layer's text is replaced with every character the font maps, one group per paragraph with an empty line between groups: uppercase, other uppercase letters (Ø, Æ, Þ), accented uppercase, the same for lowercase, other letters, figures, fractions, punctuation, currency, math, symbols, accents and combining accents. Select several text layers to fill them all, each in its own font.

Combining accents sit on a dotted circle (◌), or on a no-break space if the font has no dotted circle, so they don't pile onto their neighbours. Spaces are left out, since they can't be seen. Alternates such as .ss01 have no Unicode value and can't be typed into a text layer, so they aren't listed.

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
