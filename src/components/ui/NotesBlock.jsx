import React from "react";
import { createPortal } from "react-dom";
import { Bold, Italic, Underline, List, ListOrdered, Maximize2, X } from "lucide-react";
import { notesToHtml, htmlToNotes } from "../../lib/utils/notesMarkdown";

// Bloc « Notes » discret façon Notion : éditable sur place, mise en forme riche
// (gras, italique, souligné, listes) et bouton d'agrandissement en bas à droite.
//
// Stockage : texte brut avec un mini-markdown (**gras**, *italique*, __souligné__,
// « - » puces, « 1. » numéros). Les notes restent lisibles partout où elles sont
// recopiées (dossier projet, liste des chiffrages…) et aucun HTML n'est stocké.

/** Zone contentEditable contrôlée « à la sortie » : on ne réécrit pas le HTML pendant la frappe. */
const RichArea = React.forwardRef(function RichArea({ value, editable, onCommit, placeholder, style }, ref) {
  const elRef = React.useRef(null);
  React.useImperativeHandle(ref, () => elRef.current);

  React.useEffect(() => {
    const el = elRef.current;
    if (el && document.activeElement !== el) el.innerHTML = notesToHtml(value);
  }, [value]);

  return (
    <div
      ref={elRef}
      className="df-notes-area"
      contentEditable={editable}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onBlur={() => {
        const next = htmlToNotes(elRef.current);
        if (next !== (value || "")) onCommit(next);
      }}
      style={{ outline: "none", fontSize: 13.5, lineHeight: 1.55, color: "#37352F", wordBreak: "break-word", ...style }}
    />
  );
});

const TOOLS = [
  { cmd: "bold", icon: Bold, title: "Gras (⌘B)" },
  { cmd: "italic", icon: Italic, title: "Italique (⌘I)" },
  { cmd: "underline", icon: Underline, title: "Souligné (⌘U)" },
  { cmd: "insertUnorderedList", icon: List, title: "Liste à puces" },
  { cmd: "insertOrderedList", icon: ListOrdered, title: "Liste numérotée" },
];

function Toolbar() {
  return (
    <div style={{ display: "flex", gap: 2, padding: 4, borderBottom: "1px solid #E0DED9" }}>
      {TOOLS.map(({ cmd, icon, title }) => (
        <button
          key={cmd}
          title={title}
          // mousedown + preventDefault : garde la sélection dans la zone d'édition
          onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd); }}
          style={{ width: 30, height: 28, display: "grid", placeItems: "center", border: "none", borderRadius: 5, background: "transparent", color: "#37352F", cursor: "pointer" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#EFEFED"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {React.createElement(icon, { size: 15 })}
        </button>
      ))}
    </div>
  );
}

function ExpandedEditor({ value, editable, onCommit, onClose }) {
  const areaRef = React.useRef(null);
  const latest = React.useRef({});
  latest.current = { value, editable, onCommit, onClose };

  React.useEffect(() => {
    // Échap ferme sans passer par un blur : on enregistre avant de démonter.
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      const { value: v, editable: ed, onCommit: commit, onClose: close } = latest.current;
      if (ed && areaRef.current) {
        const next = htmlToNotes(areaRef.current);
        if (next !== (v || "")) commit(next);
      }
      close();
    };
    window.addEventListener("keydown", onKey);
    areaRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,15,15,0.35)", zIndex: 1300, display: "grid", placeItems: "center", padding: 24 }}
    >
      <div style={{ width: "min(760px, 100%)", maxHeight: "80vh", display: "flex", flexDirection: "column", background: "white", borderRadius: 10, boxShadow: "0 16px 48px rgba(15,15,15,0.2)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 8px" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#37352F" }}>Notes</span>
          <button onClick={onClose} title="Fermer (Échap)" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#9B9A97", display: "grid", placeItems: "center", padding: 4, borderRadius: 5 }}>
            <X size={16} />
          </button>
        </div>
        {editable && <Toolbar />}
        <div style={{ overflowY: "auto", padding: "14px 20px 24px", minHeight: 260 }}>
          <RichArea ref={areaRef} value={value} editable={editable} onCommit={onCommit} placeholder="Écrire une note…" style={{ fontSize: 15, minHeight: 220 }} />
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * @param {string}   value    notes (mini-markdown)
 * @param {Function} onSave   (text) => void, appelé à la sortie du champ si modifié
 * @param {boolean}  editable
 * @param {boolean}  fill     occupe toute la hauteur du parent (positionné)
 */
export default function NotesBlock({ value, onSave, editable = true, fill = false }) {
  const [expanded, setExpanded] = React.useState(false);
  const [hover, setHover] = React.useState(false);

  return (
    <>
      <style>{`
        .df-notes-area:empty::before { content: attr(data-placeholder); color: #A8A7A3; pointer-events: none; }
        .df-notes-area ul, .df-notes-area ol { margin: 2px 0; padding-left: 22px; }
      `}</style>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: fill ? "absolute" : "relative", inset: fill ? 0 : undefined,
          display: "flex", flexDirection: "column", minHeight: 0,
          background: "#F4F4F4", borderRadius: 8, padding: "10px 14px 8px",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 500, color: "#9B9A97", marginBottom: 4 }}>Notes</div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 22 }}>
          <RichArea value={value} editable={editable} onCommit={onSave} placeholder={editable ? "Ajouter une note…" : "Aucune note"} />
        </div>
        <button
          onClick={() => setExpanded(true)}
          title="Agrandir et mettre en forme"
          style={{
            position: "absolute", right: 6, bottom: 6, width: 26, height: 26, display: "grid", placeItems: "center",
            border: "none", borderRadius: 5, background: hover ? "#EAEAE8" : "transparent", color: "#9B9A97",
            cursor: "pointer", opacity: hover ? 1 : 0.6, transition: "opacity .15s, background .15s",
          }}
        >
          <Maximize2 size={14} />
        </button>
      </div>
      {expanded && <ExpandedEditor value={value} editable={editable} onCommit={onSave} onClose={() => setExpanded(false)} />}
    </>
  );
}
