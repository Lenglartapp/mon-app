// Notes au format mini-markdown (**gras**, *italique*, __souligné__, « - » puces,
// « 1. » numéros) <-> HTML de la zone d'édition. Aucun HTML n'est stocké : le texte
// reste lisible partout où les notes sont recopiées, et tout est échappé à l'affichage.

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inlineToHtml = (line) =>
  escapeHtml(line)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>");

export function notesToHtml(text) {
  const lines = String(text || "").split("\n");
  let html = "";
  let list = null; // 'ul' | 'ol'
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const line of lines) {
    const ul = line.match(/^\s*[-•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const kind = ul ? "ul" : ol ? "ol" : null;
    if (kind) {
      if (list !== kind) { close(); html += `<${kind}>`; list = kind; }
      html += `<li>${inlineToHtml((ul || ol)[1])}</li>`;
    } else {
      close();
      html += `<div>${line ? inlineToHtml(line) : "<br>"}</div>`;
    }
  }
  close();
  return html;
}

function inlineFromNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\u00a0/g, " ");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "\n";
  const inner = Array.from(node.childNodes).map(inlineFromNode).join("");
  if (!inner.trim()) return inner;
  const st = node.style || {};
  if (tag === "b" || tag === "strong" || Number(st.fontWeight) >= 600 || st.fontWeight === "bold") return `**${inner}**`;
  if (tag === "i" || tag === "em" || st.fontStyle === "italic") return `*${inner}*`;
  if (tag === "u" || /underline/.test(st.textDecoration || "")) return `__${inner}__`;
  return inner;
}

export function htmlToNotes(root) {
  const out = [];
  let buf = "";
  const flush = () => { out.push(buf); buf = ""; };
  for (const node of Array.from(root.childNodes)) {
    const tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : null;
    if (tag === "ul" || tag === "ol") {
      if (buf) flush();
      Array.from(node.children).forEach((li, i) => {
        out.push(`${tag === "ol" ? `${i + 1}.` : "-"} ${inlineFromNode(li).replace(/\n+$/, "")}`);
      });
    } else if (tag === "div" || tag === "p") {
      if (buf) flush();
      const t = inlineFromNode(node);
      out.push(t === "\n" ? "" : t.replace(/\n$/, ""));
    } else {
      buf += inlineFromNode(node);
    }
  }
  if (buf) flush();
  return out.join("\n").replace(/\s+$/, "");
}

