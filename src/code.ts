// Glyph list, Figma side. Select text set in a font and run the plugin: Figma Friend reads
// the installed font file and the plugin lays out every character it maps, grouped and
// counted, in that font. In Figma Design the list goes next to your selection; in Figma
// Slides it goes on new slides after the current one. Nothing else in the file changes.
import type { Charset, FontRef, ToMain, ToUI } from "./types";

const KEY = "figmaFriendKey";
const MAX_FONTS = 8;

/** Labels and notes are set in Inter, which every Figma file has, so they read even when the font is half drawn. */
const LABEL: FontName = { family: "Inter", style: "Regular" };
const LABEL_BOLD: FontName = { family: "Inter", style: "Semi Bold" };
const GREY: SolidPaint = { type: "SOLID", color: { r: 0.45, g: 0.45, b: 0.45 } };

const DESIGN_WIDTH = 1440;
const SLIDE_MARGIN = 96;
const GLYPH_SIZE = 40;

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
  say(message, { error, timeout: error ? 10000 : 5000, onDequeue: () => figma.closePlugin() });
}

// ---------- which fonts ----------

/** Every font used by the selected text, including text inside selected frames and slides. */
function selectedFonts(): FontRef[] {
  const seen = new Map<string, FontRef>();
  const texts: TextNode[] = [];
  for (const n of figma.currentPage.selection) {
    if (n.type === "TEXT") texts.push(n);
    else if ("findAllWithCriteria" in n) texts.push(...n.findAllWithCriteria({ types: ["TEXT"] }));
  }
  for (const t of texts) {
    for (const seg of t.getStyledTextSegments(["fontName"])) {
      const f = seg.fontName;
      const k = `${f.family}\u0000${f.style}`;
      if (!seen.has(k)) seen.set(k, { family: f.family, style: f.style });
    }
  }
  return [...seen.values()];
}

// ---------- building the list ----------

function hex(cp: number): string {
  return "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
}

function fileName(path: string): string {
  return path.split("/").pop() || path;
}

function date(seconds: number): string {
  const d = new Date(seconds * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function text(chars: string, font: FontName, size: number, grey = false): TextNode {
  const t = figma.createText();
  t.fontName = font;
  t.fontSize = size;
  t.characters = chars;
  if (grey) t.fills = [GREY];
  return t;
}

/** Adds a text layer to an auto layout frame, as wide as the frame, as tall as its text. */
function add(frame: FrameNode, t: TextNode): TextNode {
  frame.appendChild(t);
  t.layoutSizingHorizontal = "FILL";
  t.textAutoResize = "HEIGHT";
  return t;
}

function column(name: string, width: number, padding: number): FrameNode {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = "VERTICAL";
  f.itemSpacing = 12;
  f.paddingLeft = f.paddingRight = f.paddingTop = f.paddingBottom = padding;
  f.resize(width, 100);
  f.primaryAxisSizingMode = "AUTO";
  f.counterAxisSizingMode = "FIXED";
  return f;
}

interface Block {
  /** Adds the block to a frame and returns the layers added. */
  addTo(frame: FrameNode): SceneNode[];
}

/** One heading, plus one block per group of characters. */
function blocks(font: FontName, cs: Charset): { title: string; header: Block; groups: Block[] } {
  const groups = cs.groups ?? [];
  const listed = groups.reduce((n, g) => n + g.codepoints.length, 0);
  // Combining accents need something to sit on, or they pile onto the character before.
  const hasCircle = groups.some((g) => g.codepoints.includes(0x25cc));
  const base = hasCircle ? "◌" : " ";

  const title = `${font.family} ${font.style}`;
  const notes = [
    [fileName(cs.path ?? ""), cs.version, cs.modified ? `saved ${date(cs.modified)}` : ""].filter(Boolean).join("  ·  "),
    `${listed} characters.` +
      (cs.unmappedGlyphs ? ` ${cs.unmappedGlyphs} more glyph${cs.unmappedGlyphs === 1 ? " has" : "s have"} no Unicode value (alternates and the like) and can't be shown here.` : "") +
      (cs.skipped?.length ? ` ${cs.skipped.length} invisible character${cs.skipped.length === 1 ? "" : "s"} left out: ${cs.skipped.map(hex).join(" ")}.` : ""),
  ];
  const header: Block = {
    addTo: (f) => [add(f, text(title, LABEL_BOLD, 24)), add(f, text(notes.join("\n"), LABEL, 12, true))],
  };

  const out: Block[] = groups.map((g) => ({
    addTo: (f) => {
      const label = add(f, text(`${g.label}  ${g.codepoints.length}`, LABEL_BOLD, 12, true));
      if (g.label === "Spaces") {
        // Spaces can't be seen, so they are listed by their codes.
        return [label, add(f, text(g.codepoints.map(hex).join("  "), LABEL, 16))];
      }
      const chars = g.codepoints.map((cp) => (g.label === "Combining accents" ? base : "") + String.fromCodePoint(cp)).join(" ");
      const glyphs = add(f, text(chars, font, GLYPH_SIZE));
      glyphs.lineHeight = { unit: "PERCENT", value: 150 };
      return [label, glyphs];
    },
  }));
  return { title, header, groups: out };
}

/** Space above every group but the first, so labels sit with their characters. */
function gap(f: FrameNode, height: number) {
  const s = figma.createFrame();
  s.name = "Space";
  s.fills = [];
  s.resize(1, height);
  f.appendChild(s);
}

// ---------- Figma Design: one frame next to the selection ----------

function topLevel(n: BaseNode): SceneNode | null {
  let cur: BaseNode | null = n;
  while (cur && cur.parent && cur.parent.type !== "PAGE") cur = cur.parent;
  return cur && cur.type !== "PAGE" && cur.type !== "DOCUMENT" ? (cur as SceneNode) : null;
}

function buildDesign(lists: { font: FontName; cs: Charset }[]): SceneNode[] {
  const tops = figma.currentPage.selection.map(topLevel).filter((n): n is SceneNode => !!n);
  let x = Math.max(...tops.map((n) => n.x + n.width)) + 200;
  const y = Math.min(...tops.map((n) => n.y));
  const made: SceneNode[] = [];
  for (const { font, cs } of lists) {
    const b = blocks(font, cs);
    const f = column(`Glyph list: ${b.title}`, DESIGN_WIDTH, 80);
    f.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    figma.currentPage.appendChild(f);
    b.header.addTo(f);
    for (const g of b.groups) { gap(f, 24); g.addTo(f); }
    f.x = x;
    f.y = y;
    x += DESIGN_WIDTH + 100;
    made.push(f);
  }
  return made;
}

// ---------- Figma Slides: new slides after the current one ----------

function slideOf(n: BaseNode | undefined): SlideNode | null {
  let cur: BaseNode | null = n ?? null;
  while (cur && cur.type !== "SLIDE") cur = cur.parent;
  return cur as SlideNode | null;
}

function buildSlides(lists: { font: FontName; cs: Charset }[]): SceneNode[] {
  const grid = figma.getSlideGrid();
  const current = slideOf(figma.currentPage.selection[0]);
  let row = grid.length - 1, col = (grid[row]?.length ?? 0) - 1;
  for (let r = 0; r < grid.length; r++) {
    const c = grid[r].findIndex((s) => s.id === current?.id);
    if (c >= 0) { row = r; col = c; }
  }
  if (row < 0) row = 0;

  const made: SlideNode[] = [];
  const newSlide = (name: string): { slide: SlideNode; frame: FrameNode } => {
    col++;
    const slide = figma.createSlide(row, col);
    slide.name = name;
    const frame = column(name, slide.width - 2 * SLIDE_MARGIN, 0);
    frame.fills = [];
    slide.appendChild(frame);
    frame.x = frame.y = SLIDE_MARGIN;
    made.push(slide);
    return { slide, frame };
  };

  for (const { font, cs } of lists) {
    const b = blocks(font, cs);
    let { slide, frame } = newSlide(`Glyph list: ${b.title}`);
    b.header.addTo(frame);
    const room = () => slide.height - 2 * SLIDE_MARGIN;
    for (const g of b.groups) {
      gap(frame, 24);
      const added = g.addTo(frame);
      // A group that doesn't fit starts a new slide (unless it's alone and simply too long).
      if (frame.height > room() && frame.children.length > added.length + 3) {
        frame.children[frame.children.length - added.length - 1].remove();   // the gap above it
        added.forEach((n) => n.remove());
        ({ slide, frame } = newSlide(`Glyph list: ${b.title}, continued`));
        add(frame, text(`${b.title}, continued`, LABEL_BOLD, 24));
        gap(frame, 24);
        g.addTo(frame);
      }
    }
  }
  return made;
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
  const fonts = selectedFonts();
  if (!fonts.length) return finish("Select a text layer set in the font you want listed", true);
  if (fonts.length > MAX_FONTS) return finish(`The selection has ${fonts.length} fonts. Select text in at most ${MAX_FONTS}.`, true);
  working("Listing glyphs");

  const key = ((await figma.clientStorage.getAsync(KEY)) as string | undefined) ?? null;
  const answer = await new Promise<ToMain>((resolve) => {
    reply = resolve;
    post({ type: "list", key, fonts });
  });
  if (answer.type === "stop") return finish(answer.message, true);
  if (answer.type !== "charsets") return;

  const lists: { font: FontName; cs: Charset }[] = [];
  const problems: string[] = [];
  for (let i = 0; i < fonts.length; i++) {
    const cs = answer.charsets[i];
    if (!cs?.ok) { problems.push(cs?.error ?? `${fonts[i].family} ${fonts[i].style}: no answer`); continue; }
    lists.push({ font: fonts[i], cs });
  }
  if (!lists.length) return finish(problems.join(". "), true);

  working("Laying out the glyphs");
  await Promise.all([LABEL, LABEL_BOLD, ...lists.map((l) => l.font)].map((f) => figma.loadFontAsync(f)));
  const made = figma.editorType === "slides" ? buildSlides(lists) : buildDesign(lists);
  figma.currentPage.selection = made;
  figma.viewport.scrollAndZoomIntoView(made);

  const count = lists.reduce((n, l) => n + (l.cs.groups ?? []).reduce((k, g) => k + g.codepoints.length, 0), 0);
  const done = lists.length === 1 ? `${count} characters listed` : `${lists.length} glyph lists made`;
  finish(problems.length ? `${done}. Not listed: ${problems.join(". ")}` : done, problems.length > 0);
}

run().catch((e) => finish(`Glyph list failed: ${e instanceof Error ? e.message : String(e)}`, true));
