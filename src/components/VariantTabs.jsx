import React from "react";
import { variantShade } from "../lib/minuteFamily";

// Intercalaires de la famille d'un chiffrage (V1 original, V2… variantes, R1… recalibrages).
// Forme « classeur » : flancs inclinés, haut arrondi, pied évasé qui se fond dans la
// barre du dessous. Couleur en dégradé bleu nuit → bleu clair selon le rang.

// Flanc gauche (le droit est le même, retourné). Étiré en hauteur avec l'onglet.
const CAP_PATH = "M0,32 C5,32 6,30 7.2,27 L11,6 C12,2 14,0 18,0 L18,32 Z";
// Bord extérieur du flanc seul (pour un contour optionnel).
const CAP_EDGE = "M0,32 C5,32 6,30 7.2,27 L11,6 C12,2 14,0 18,0";

function Cap({ side, fill, stroke }) {
  return (
    <svg
      className="vtab-cap"
      viewBox="0 0 18 32"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ transform: side === "right" ? "scaleX(-1)" : undefined }}
    >
      <path d={CAP_PATH} fill={fill} />
      {stroke && <path d={CAP_EDGE} fill="none" stroke={stroke} strokeWidth="1" vectorEffect="non-scaling-stroke" />}
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
  .vtabs.shrink .vtab:not(.on) { height: 26px; }
  .vtabs.shrink .vtab:not(.on) .vtab-body { font-size: 12px; }
  .vtabs.shrink .vtab:not(.on):hover { height: 30px; }
  .vtab-del { display: none; align-items: center; justify-content: center; width: 16px; height: 16px; margin-left: 2px;
    border-radius: 99px; font-size: 13px; line-height: 1; font-weight: 500; opacity: .7; cursor: pointer; }
  .vtab:hover .vtab-del, .vtab.on .vtab-del { display: inline-flex; }
  .vtab-del:hover { opacity: 1; background: rgba(255,255,255,.25); }
`;

// colorFor(index, count, actif) → { bg, fg, stroke? } : remplace le dégradé par défaut (stroke = contour).
// shrink : les intercalaires non sélectionnés sont plus bas, l'actif ressort.
// onDelete(tab) : croix « Supprimer » sur l'intercalaire ; canDelete(tab) → true | texte (raison du refus).
export default function VariantTabs({ tabs, activeId, onOpen, onCreate, onDelete, canDelete, addLabel, addTitle, colorFor, addColor, shrink = false }) {
  const n = tabs.length;
  const add = addColor || { bg: "var(--df-border-2)", fg: "var(--df-text-3)" };
  return (
    <div className={`vtabs${shrink ? " shrink" : ""}`}>
      <style>{CSS}</style>
      {tabs.map((t, i) => {
        const on = t.id === activeId;
        const { bg, fg, stroke } = colorFor ? colorFor(i, n, on) : variantShade(i, n);
        return (
          <button
            key={t.id}
            className={`vtab${on ? " on" : ""}`}
            style={{ zIndex: on ? n + 2 : n - i }}
            title={t.name}
            onClick={() => { if (!on) onOpen(t.id); }}
          >
            <Cap side="left" fill={bg} stroke={stroke} />
            <span className="vtab-body" style={{ background: bg, color: fg, boxShadow: stroke ? `inset 0 1px 0 ${stroke}` : undefined }}>
              {t.code}
              <span className="vtab-name">{t.name}</span>
              {onDelete && (() => {
                const allowed = canDelete ? canDelete(t) : true;
                return (
                  <span
                    className="vtab-del"
                    role="button"
                    aria-label={`Supprimer ${t.code}`}
                    title={allowed === true ? `Supprimer ${t.code}` : allowed}
                    style={allowed === true ? undefined : { opacity: 0.35, cursor: 'not-allowed' }}
                    onClick={(e) => { e.stopPropagation(); if (allowed === true) onDelete(t); }}
                  >×</span>
                );
              })()}
            </span>
            <Cap side="right" fill={bg} stroke={stroke} />
          </button>
        );
      })}
      {onCreate && (
        <button className="vtab add" style={{ zIndex: 0 }} title={addTitle || "Créer une variante"} onClick={onCreate}>
          <Cap side="left" fill={add.bg} stroke={add.stroke} />
          <span className="vtab-body" style={{ background: add.bg, color: add.fg, boxShadow: add.stroke ? `inset 0 1px 0 ${add.stroke}` : undefined }}>
            +{addLabel && <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 5 }}>{addLabel}</span>}
          </span>
          <Cap side="right" fill={add.bg} stroke={add.stroke} />
        </button>
      )}
    </div>
  );
}
