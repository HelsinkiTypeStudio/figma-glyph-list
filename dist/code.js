"use strict";
(() => {
  // src/code.ts
  var KEY = "figmaFriendKey";
  var post = (m) => figma.ui.postMessage(m);
  var shown;
  var closing = false;
  function say(text, options = {}) {
    const old = shown;
    shown = figma.notify(text, options);
    old == null ? void 0 : old.cancel();
  }
  function working(text) {
    if (closing) return;
    say(text, {
      timeout: Infinity,
      button: { text: "Cancel", action: () => {
        closing = true;
        figma.closePlugin("Glyph list cancelled");
        return true;
      } }
    });
  }
  function finish(message, error = false) {
    if (closing) return;
    closing = true;
    say(message, { error, timeout: error ? 1e4 : 4e3, onDequeue: () => figma.closePlugin() });
  }
  function glyphText(cs) {
    var _a;
    const groups = ((_a = cs.groups) != null ? _a : []).filter((g) => g.label !== "Spaces");
    const base = groups.some((g) => g.codepoints.includes(9676)) ? "\u25CC" : "\xA0";
    const text = groups.map((g) => g.codepoints.map((cp) => (g.label === "Combining accents" ? base : "") + String.fromCodePoint(cp)).join(" ")).join("\n\n");
    return { text, count: groups.reduce((n, g) => n + g.codepoints.length, 0) };
  }
  function fontOf(t) {
    return t.characters.length ? t.getRangeFontName(0, 1) : t.fontName;
  }
  var reply;
  figma.showUI(__html__, { visible: false });
  figma.ui.onmessage = async (m) => {
    if (m.type === "set-key") await figma.clientStorage.setAsync(KEY, m.key);
    else if (m.type === "status") working(m.text);
    else reply == null ? void 0 : reply(m);
  };
  async function run() {
    var _a, _b;
    const layers = figma.currentPage.selection.filter((n) => n.type === "TEXT");
    if (!layers.length) return finish("Select the text layer to fill with the glyph list", true);
    working("Listing glyphs");
    const fonts = layers.map((t) => {
      const f = fontOf(t);
      return { family: f.family, style: f.style };
    });
    const key = (_a = await figma.clientStorage.getAsync(KEY)) != null ? _a : null;
    const answer = await new Promise((resolve) => {
      reply = resolve;
      post({ type: "list", key, fonts });
    });
    if (answer.type === "stop") return finish(answer.message, true);
    if (answer.type !== "charsets") return;
    const problems = [];
    let done = 0, count = 0;
    for (let i = 0; i < layers.length; i++) {
      const t = layers[i], cs = answer.charsets[i];
      if (!(cs == null ? void 0 : cs.ok)) {
        problems.push((_b = cs == null ? void 0 : cs.error) != null ? _b : `${fonts[i].family} ${fonts[i].style}: no answer`);
        continue;
      }
      const segs = t.characters.length ? t.getStyledTextSegments(["fontName"]).map((s) => s.fontName) : [t.fontName];
      await Promise.all(segs.map((f) => figma.loadFontAsync(f)));
      const g = glyphText(cs);
      t.characters = g.text;
      done++;
      count = g.count;
    }
    if (!done) return finish(problems.join(". "), true);
    const msg = done === 1 ? `${count} characters listed` : `${done} glyph lists made`;
    finish(problems.length ? `${msg}. Not listed: ${problems.join(". ")}` : msg, problems.length > 0);
  }
  run().catch((e) => finish(`Glyph list failed: ${e instanceof Error ? e.message : String(e)}`, true));
})();
