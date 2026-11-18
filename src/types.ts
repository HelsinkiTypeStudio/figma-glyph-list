// Messages between the Figma side (code.ts) and the plugin's hidden window (ui.ts).

export interface FontRef {
  family: string;
  style: string;
}

/** Figma Friend's answer to POST /fonts/charset (see its Resources/fontwork.py). */
export interface Charset {
  ok: boolean;
  error?: string;
  path?: string;
  familyName?: string;
  styleName?: string;
  version?: string;
  /** When the font file was last saved, in seconds since 1970. */
  modified?: number;
  totalGlyphs?: number;
  mappedGlyphs?: number;
  /** Glyphs without a Unicode value, such as alternates: they can't be typed, so they are only counted. */
  unmappedGlyphs?: number;
  /** Invisible codepoints the font maps (controls, private use), left out. */
  skipped?: number[];
  groups?: { label: string; codepoints: number[] }[];
}

export type ToUI =
  | { type: "list"; key: string | null; fonts: FontRef[] };

export type ToMain =
  | { type: "set-key"; key: string | null }
  | { type: "status"; text: string }
  | { type: "stop"; message: string }
  | { type: "charsets"; charsets: Charset[] };
