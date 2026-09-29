import React from "react";
import { variantShade } from "../lib/minuteFamily";

// Intercalaires de la famille d'un chiffrage (V1 original, V2… variantes, R1… recalibrages).
// Forme « classeur » : flancs inclinés, haut arrondi, pied évasé qui se fond dans la
// barre du dessous. Couleur en dégradé bleu nuit → bleu clair selon le rang.

// Flanc gauche (le droit est le même, retourné). Étiré en hauteur avec l'onglet.
const CAP_PATH = "M0,32 C5,32 6,30 7.2,27 L11,6 C12,2 14,0 18,0 L18,32 Z";

function Cap({ side, fill }) {
  return (
    <svg
      className="vtab-cap"
      viewBox="0 0 18 32"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ transform: side === "right" ? "scaleX(-1)" : undefined }}
    >
      <path d={CAP_PATH} fill={fill} />
    </svg>
  );
}

const CSS = `
  .vtabs { display: flex; align-items: flex-end; padding-left: 6px; min-width: 0; flex-wrap: nowrap; flex-shrink: 0; }
  .vtab { position: relative; display: inline-flex; align-items: stretch; height: 30px; padding: 0; margin: 0 0 0 -8px;
    background: none; border: none; cursor: pointer; font-family: inherit; transition: height .15s ease; }
  .vtab:first-of-type { margin-left: 0; }
  .vtab-cap { width: 18px; height: 100%; flex-shrink: 0; display: block; }
  .vtab-body { display: inline-flex; align-items: center; gap: 7px; padding: 0 4px; border-radius: 0; white-space: nowrap;
    font-size: 13px; font-weight: 700; letter-spacing: .01em; }
  .vtab-name { max-width: 0; overflow: hidden; text-overflow: ellipsis; opacity: 0; font-weight: 500;
    transition: max-width .25s ease, opacity .2s; }
  .vtab:hover { height: 33px; }
  .vtab:hover .vtab-name, .vtab.on .vtab-name { max-width: 320px; opacity: .85; }
  .vtab.on { height: 36px; cursor: default; }
  .vtab.add .vtab-body { font-weight: 600; font-size: 15px; padding: 0 2px; }
`;

export default function VariantTabs({ tabs, activeId, onOpen, onCreate }) {
  const n = tabs.length;
  return (
    <div className="vtabs">
      <style>{CSS}</style>
      {tabs.map((t, i) => {
        const on = t.id === activeId;
        const { bg, fg } = variantShade(i, n);
        return (
          <button
            key={t.id}
            className={`vtab${on ? " on" : ""}`}
            style={{ zIndex: on ? n + 2 : n - i }}
            title={t.name}
            onClick={() => { if (!on) onOpen(t.id); }}
          >
            <Cap side="left" fill={bg} />
            <span className="vtab-body" style={{ background: bg, color: fg }}>
              {t.code}
              <span className="vtab-name">{t.name}</span>
            </span>
            <Cap side="right" fill={bg} />
          </button>
        );
      })}
      {onCreate && (
        <button className="vtab add" style={{ zIndex: 0 }} title="Créer une variante" onClick={onCreate}>
          <Cap side="left" fill="#E5E7EB" />
          <span className="vtab-body" style={{ background: "#E5E7EB", color: "#4B5563" }}>+</span>
          <Cap side="right" fill="#E5E7EB" />
        </button>
      )}
    </div>
  );
}
