// The plugin's hidden window. Figma plugins can only reach the network from here, so this
// asks Figma Friend, the menu bar app on your Mac, for the characters in each font.
import type { Charset, FontRef, ToMain, ToUI } from "./types";

const BASE = "http://localhost:7337";
const send = (m: ToMain) => parent.postMessage({ pluginMessage: m }, "*");

let key: string | null = null;

function headers(json = false): Record<string, string> {
  const h: Record<string, string> = {};
  if (key) h["X-Helper-Key"] = key;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function status(): Promise<"ok" | "unpaired" | "offline"> {
  try {
    const r = await fetch(`${BASE}/ping`, { headers: headers() });
    return (await r.json()).paired ? "ok" : "unpaired";
  } catch {
    return "offline";
  }
}

/** Asks Figma Friend for a key. It shows an Allow dialog first. */
async function pair(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/pair`, {
      method: "POST", headers: headers(true), body: JSON.stringify({ plugin: "Glyph list" }),
    });
    if (!r.ok) return false;
    key = (await r.json()).key;
    send({ type: "set-key", key });
    return true;
  } catch {
    return false;
  }
}

/** Why Figma Friend can't be used, or null when it's ready. */
async function check(): Promise<string | null> {
  let s = await status();
  if (s === "offline") return "Figma Friend isn't running. Open it from Applications and try again.";
  if (s === "unpaired") {
    send({ type: "status", text: "Click Allow in Figma Friend's window" });
    if (!(await pair())) return "Figma Friend didn't allow this plugin.";
    s = await status();
  }
  return s === "ok" ? null : "Figma Friend didn't accept this plugin's key. Try again.";
}

async function charset(font: FontRef): Promise<Charset> {
  try {
    const r = await fetch(`${BASE}/fonts/charset`, { method: "POST", headers: headers(true), body: JSON.stringify(font) });
    if (r.status === 404) return { ok: false, error: "Figma Friend is too old for glyph lists. Update it and try again." };
    if (r.status === 401) { key = null; send({ type: "set-key", key: null }); return { ok: false, error: "Figma Friend doesn't know this plugin any more. Try again." }; }
    const j = (await r.json()) as Charset;
    if (!j.ok && j.error === "not installed") j.error = `${font.family} ${font.style} isn't installed on this Mac`;
    return j;
  } catch (e) {
    return { ok: false, error: `Figma Friend didn't answer (${(e as Error).message})` };
  }
}

window.onmessage = async (ev: MessageEvent) => {
  const m = ev.data.pluginMessage as ToUI | undefined;
  if (!m || m.type !== "list") return;
  key = m.key;
  const problem = await check();
  if (problem) return send({ type: "stop", message: problem });
  send({ type: "status", text: "Reading the font" + (m.fonts.length > 1 ? "s" : "") });
  const charsets: Charset[] = [];
  for (const f of m.fonts) charsets.push(await charset(f));
  send({ type: "charsets", charsets });
};
