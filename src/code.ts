// Glyph list, Figma side. Select a text layer and run the plugin: Figma Friend reads the
// installed font file, and the layer's text is replaced with every character the font maps,
// one group per paragraph with an empty line between groups. The layer keeps its own
// settings (font, size, colour and so on). Works the same in Figma Design and Figma Slides.
import type { Charset, FontRef, ToMain, ToUI } from "./types";

const KEY = "figmaFriendKey";

const post = (m: ToUI) => figma.ui.postMessage(m);

// ---------- messages at the bottom of the screen ----------

let shown: NotificationHandler | undefined;
let closing = false;

function say(text: string, options: NotificationOptions = {}) {
  const old = shown;
  shown = figma.notify(text, options);
  old?.cancel();
}

function working(text: string) {
  if (closing) return;
  say(text, {
    timeout: Infinity,
    button: { text: "Cancel", action: () => { closing = true; figma.closePlugin("Glyph list cancelled"); return true; } },
  });
}

/** Ends the run with a short message; the plugin closes once the message has gone. */
function finish(message: string, error = false) {
  if (closing) return;
  closing = true;
  say(message, { error, timeout: error ? 10000 : 4000, onDequeue: () => figma.closePlugin() });
}

// ---------- the text ----------

/** Every group on its own paragraph, characters separated by spaces, an empty line between groups. */
function glyphText(cs: Charset): { text: string; count: number } {
  // Spaces can't be seen, so they're left out.
  const groups = (cs.groups ?? []).filter((g) => g.label !== "Spaces");
  // Combining accents need something to sit on, or they pile onto the character before.
  const base = groups.some((g) => g.codepoints.includes(0x25cc)) ? "◌" : " ";
  const text = groups
    .map((g) => g.codepoints.map((cp) => (g.label === "Combining accents" ? base : "") + String.fromCodePoint(cp)).join(" "))
    .join("\n\n");
  return { text, count: groups.reduce((n, g) => n + g.codepoints.length, 0) };
}

/** The font a layer is set in: its first character's. */
function fontOf(t: TextNode): FontName {
  return t.characters.length ? (t.getRangeFontName(0, 1) as FontName) : (t.fontName as FontName);
}

// ---------- running ----------

let reply: ((m: ToMain) => void) | undefined;

figma.showUI(__html__, { visible: false });
figma.ui.onmessage = async (m: ToMain) => {
  if (m.type === "set-key") await figma.clientStorage.setAsync(KEY, m.key);
  else if (m.type === "status") working(m.text);
  else reply?.(m);
};

async function run() {
  const layers = figma.currentPage.selection.filter((n): n is TextNode => n.type === "TEXT");
  if (!layers.length) return finish("Select the text layer to fill with the glyph list", true);
  working("Listing glyphs");

  const fonts: FontRef[] = layers.map((t) => {
    const f = fontOf(t);
    return { family: f.family, style: f.style };
  });
  const key = ((await figma.clientStorage.getAsync(KEY)) as string | undefined) ?? null;
  const answer = await new Promise<ToMain>((resolve) => {
    reply = resolve;
    post({ type: "list", key, fonts });
  });
  if (answer.type === "stop") return finish(answer.message, true);
  if (answer.type !== "charsets") return;

  const problems: string[] = [];
  let done = 0, count = 0;
  for (let i = 0; i < layers.length; i++) {
    const t = layers[i], cs = answer.charsets[i];
    if (!cs?.ok) { problems.push(cs?.error ?? `${fonts[i].family} ${fonts[i].style}: no answer`); continue; }
    // Every font in the layer must be loaded before its text can change.
    const segs = t.characters.length ? t.getStyledTextSegments(["fontName"]).map((s) => s.fontName) : [t.fontName as FontName];
    await Promise.all(segs.map((f) => figma.loadFontAsync(f)));
    const g = glyphText(cs);
    // Setting the text keeps the layer's settings: the new text takes the first character's style.
    t.characters = g.text;
    done++;
    count = g.count;
  }
  if (!done) return finish(problems.join(". "), true);
  const msg = done === 1 ? `${count} characters listed` : `${done} glyph lists made`;
  finish(problems.length ? `${msg}. Not listed: ${problems.join(". ")}` : msg, problems.length > 0);
}

run().catch((e) => finish(`Glyph list failed: ${e instanceof Error ? e.message : String(e)}`, true));
