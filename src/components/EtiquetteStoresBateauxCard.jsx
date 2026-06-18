// src/components/EtiquetteStoresBateauxCard.jsx
import React, { useState } from "react";
import { DEFAULT_HEADER_COLOR, getHeaderStyles } from "../lib/etiquetteColors.js";
import { STORES_BATEAUX_GETTERS } from "../lib/schemas/production/stores_bateaux.js";

// ─── Champs disponibles sur l'étiquette (ordre + sections) ───────────────────
export const ETIQUETTE_STORES_BATEAUX_FIELDS = [
  // Dimensions
  { key: "largeur",             label: "Largeur",              section: "Dimensions" },
  { key: "largeur_finie",       label: "L. Finie",             section: "Dimensions" },
  { key: "ourlet_de_cote",      label: "Ourlet côté",          section: "Dimensions" },
  { key: "hauteur_finie",       label: "H. Finie",             section: "Dimensions" },
  { key: "statut_cotes",        label: "Statut côtes",         section: "Dimensions" },
  // Coupes & Finitions
  { key: "hauteur_coupe",           label: "H. Coupe",              section: "Coupes & Finitions" },
  { key: "hauteur_coupe_motif",     label: "H. Coupe motif",        section: "Coupes & Finitions" },
  { key: "hauteur_coupe_doublure",  label: "H. Coupe doubl.",       section: "Coupes & Finitions" },
  { key: "picage_bas",              label: "Picage bas",            section: "Coupes & Finitions" },
  { key: "finition_chant_et_retour",label: "Fin. chant & retour",   section: "Coupes & Finitions" },
  // Matériaux
  { key: "toile_finition_1",    label: "Tissu 1",              section: "Matériaux" },
  { key: "doublure",            label: "Doublure",             section: "Matériaux" },
  { key: "etiquette_lavage",    label: "Étiq. lavage",         section: "Matériaux" },
  // Mécanisme
  { key: "mecanisme_store",          label: "Mécanisme",            section: "Mécanisme" },
  { key: "type_commande",            label: "Type commande",        section: "Mécanisme" },
  { key: "cote_manoeuvre",           label: "Côté manœuvre",        section: "Mécanisme" },
  { key: "methode_manoeuvre",        label: "Méthode manœuvre",     section: "Mécanisme" },
  { key: "nombre_anneaux_largeur",   label: "Nb anneaux",           section: "Mécanisme" },
  { key: "deportation_premier_anneau",label: "Déport 1er anneau",   section: "Mécanisme" },
  { key: "valeur_velcro",            label: "Valeur velcro",        section: "Mécanisme" },
  { key: "type_pose",                label: "Type pose",            section: "Mécanisme" },
  // Intervalles & Barre
  { key: "nombre_intervalles",       label: "Nb intervalles",       section: "Intervalles & Barre" },
  { key: "valeur_intervalle",        label: "Val. intervalle",      section: "Intervalles & Barre" },
  { key: "longueur_barre_de_charge", label: "Long. barre ch.",      section: "Intervalles & Barre" },
  { key: "longueur_tigette",         label: "Long. tigette",        section: "Intervalles & Barre" },
];

const SECTIONS = ["Dimensions", "Coupes & Finitions", "Matériaux", "Mécanisme", "Intervalles & Barre"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const v = (row, key, fallback = "—") => {
  let val;
  if (STORES_BATEAUX_GETTERS[key]) {
    val = STORES_BATEAUX_GETTERS[key](row || {});
  } else {
    val = row?.[key];
  }
  if (val == null || val === "") return fallback;
  return String(val);
};

// ─── Sous-composants affichage ────────────────────────────────────────────────
function Cell({ label, value, accent = false, span = 1 }) {
  return (
    <div style={{
      gridColumn: `span ${span}`,
      padding: "5px 10px",
      borderRight: "1px solid #E5E7EB",
      borderBottom: "1px solid #E5E7EB",
      display: "flex", flexDirection: "column", gap: 2, minWidth: 0,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 600, letterSpacing: "0.05em",
        textTransform: "uppercase", color: "#9CA3AF", lineHeight: 1,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 13, fontWeight: 700,
        color: accent ? "#92742A" : "#111827",
        lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {value}
      </span>
    </div>
  );
}

function Row({ children, cols, bg = "white" }) {
  const count = cols || React.Children.count(children);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${count}, 1fr)`,
      background: bg,
      borderLeft: "1px solid #E5E7EB",
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
      textTransform: "uppercase", color: "#6B7280",
      background: "#F3F4F6", padding: "4px 10px",
      borderBottom: "1px solid #E5E7EB",
      borderLeft: "1px solid #E5E7EB",
      borderRight: "1px solid #E5E7EB",
    }}>
      {children}
    </div>
  );
}

// ─── Panneau de personnalisation ─────────────────────────────────────────────
function CustomizePanel({ hiddenFields, onChange, onClose }) {
  const [draft, setDraft] = useState([...hiddenFields]);

  const toggle = (key) => {
    setDraft(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleSection = (section) => {
    const keys = ETIQUETTE_STORES_BATEAUX_FIELDS
      .filter(f => f.section === section)
      .map(f => f.key);
    const allHidden = keys.every(k => draft.includes(k));
    if (allHidden) {
      setDraft(prev => prev.filter(k => !keys.includes(k)));
    } else {
      setDraft(prev => [...new Set([...prev, ...keys])]);
    }
  };

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20,
      background: "rgba(255,255,255,0.97)",
      borderRadius: 10, overflowY: "auto",
      padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", letterSpacing: "0.02em" }}>
          Personnaliser l'étiquette
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setDraft([])}
            style={{
              fontSize: 11, color: "#6B7280", background: "none",
              border: "1px solid #E5E7EB", borderRadius: 5,
              padding: "4px 10px", cursor: "pointer",
            }}
          >
            Tout afficher
          </button>
          <button
            onClick={() => { onChange(draft); onClose(); }}
            style={{
              fontSize: 11, fontWeight: 700, color: "white",
              background: "#1F2937", border: "none",
              borderRadius: 5, padding: "4px 12px", cursor: "pointer",
            }}
          >
            Valider
          </button>
        </div>
      </div>

      {SECTIONS.map(section => {
        const fields = ETIQUETTE_STORES_BATEAUX_FIELDS.filter(f => f.section === section);
        const hiddenCount = fields.filter(f => draft.includes(f.key)).length;
        return (
          <div key={section}>
            <div
              onClick={() => toggleSection(section)}
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "#6B7280",
                marginBottom: 6, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {section}
              {hiddenCount > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 600, color: "#EF4444",
                  background: "#FEF2F2", borderRadius: 3, padding: "1px 5px",
                }}>
                  {hiddenCount} masqué{hiddenCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 5,
            }}>
              {fields.map(f => {
                const hidden = draft.includes(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() => toggle(f.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 9px",
                      border: `1px solid ${hidden ? "#FECACA" : "#D1FAE5"}`,
                      borderRadius: 6,
                      background: hidden ? "#FEF2F2" : "#F0FDF4",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{hidden ? "🚫" : "👁"}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: hidden ? "#9CA3AF" : "#111827",
                      textDecoration: hidden ? "line-through" : "none",
                    }}>
                      {f.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function EtiquetteStoresBateauxCard({ row, projectName, index, total, onEdit, onRowChange }) {
  const [customizing, setCustomizing] = useState(false);

  const hiddenFields = Array.isArray(row?.etiquette_hidden_fields) ? row.etiquette_hidden_fields : [];
  const show = (key) => !hiddenFields.includes(key);

  const zone = v(row, "zone", "Zone ?");
  const piece = v(row, "piece", "Pièce ?");
  const produit = v(row, "produit", "—");
  const statutCotes = v(row, "statut_cotes", "—");

  // Croquis intervalle (type photo = tableau [{id, url, ...}])
  const croquis = Array.isArray(row?.croquis_intervalle)
    ? row.croquis_intervalle[0]?.url || null
    : null;

  const isStatutWarn = statutCotes && !["Définitive", "Validé par chef de projet"].includes(statutCotes);
  const hiddenCount = hiddenFields.length;

  const hdr = getHeaderStyles(row?.etiquette_header_color || DEFAULT_HEADER_COLOR);

  const handleSaveHidden = (newHidden) => {
    if (onRowChange) onRowChange({ ...row, etiquette_hidden_fields: newHidden });
  };

  return (
    <div style={{
      border: "1px solid #D1D5DB", borderRadius: 10,
      overflow: "hidden", position: "relative",
      fontFamily: "system-ui, -apple-system, sans-serif",
      boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
      background: "white",
    }}>

      {/* MODE PERSONNALISATION */}
      {customizing && (
        <CustomizePanel
          hiddenFields={hiddenFields}
          onChange={handleSaveHidden}
          onClose={() => setCustomizing(false)}
        />
      )}

      {/* HEADER */}
      <div style={{
        background: hdr.bg, padding: "10px 16px",
        display: "grid", gridTemplateColumns: "1fr auto auto",
        alignItems: "center", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: hdr.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {projectName || "Projet"}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: hdr.textMain, marginTop: 2 }}>
            {zone} — {piece}
          </div>
          <div style={{ fontSize: 12, color: hdr.textMuted, marginTop: 2 }}>{produit}</div>
        </div>
        {total != null && (
          <div style={{
            fontSize: 12, fontWeight: 600, color: hdr.badgeText,
            background: hdr.badgeBg, borderRadius: 6, padding: "5px 10px", whiteSpace: "nowrap",
          }}>
            n° {(index ?? 0) + 1}/{total}
          </div>
        )}
      </div>

      {/* BODY */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px" }}>

        {/* COLONNE GAUCHE */}
        <div>

          {/* Dimensions */}
          <SectionTitle>Dimensions</SectionTitle>
          {(show("largeur") || show("largeur_finie") || show("ourlet_de_cote") || show("hauteur_finie") || show("statut_cotes")) && (
            <Row cols={5}>
              {show("largeur")        && <Cell label="Largeur" value={v(row, "largeur")} />}
              {show("largeur_finie")  && <Cell label="L. Finie" value={v(row, "largeur_finie")} />}
              {show("ourlet_de_cote") && <Cell label="Ourlet côté" value={v(row, "ourlet_de_cote")} />}
              {show("hauteur_finie")  && <Cell label="H. Finie" value={v(row, "hauteur_finie")} />}
              {show("statut_cotes")   && <Cell label="Statut côtes" value={statutCotes} accent={isStatutWarn} />}
            </Row>
          )}

          {/* Coupes & Finitions */}
          <SectionTitle>Coupes & Finitions</SectionTitle>
          {(show("hauteur_coupe") || show("hauteur_coupe_motif") || show("hauteur_coupe_doublure")) && (
            <Row cols={3}>
              {show("hauteur_coupe")          && <Cell label="H. Coupe" value={v(row, "hauteur_coupe")} />}
              {show("hauteur_coupe_motif")    && <Cell label="H. Coupe motif" value={v(row, "hauteur_coupe_motif")} />}
              {show("hauteur_coupe_doublure") && <Cell label="H. Coupe doubl." value={v(row, "hauteur_coupe_doublure")} />}
            </Row>
          )}
          {(show("picage_bas") || show("finition_chant_et_retour")) && (
            <Row cols={2} bg="#F9FAFB">
              {show("picage_bas")               && <Cell label="Picage bas" value={v(row, "picage_bas")} />}
              {show("finition_chant_et_retour")  && <Cell label="Fin. chant & retour" value={v(row, "finition_chant_et_retour")} />}
            </Row>
          )}

          {/* Matériaux */}
          <SectionTitle>Matériaux</SectionTitle>
          {(show("toile_finition_1") || show("doublure") || show("etiquette_lavage")) && (
            <Row cols={3}>
              {show("toile_finition_1") && <Cell label="Tissu 1" value={v(row, "toile_finition_1")} accent />}
              {show("doublure")         && <Cell label="Doublure" value={v(row, "doublure")} accent />}
              {show("etiquette_lavage") && <Cell label="Étiq. lavage" value={v(row, "etiquette_lavage")} />}
            </Row>
          )}

          {/* Mécanisme */}
          <SectionTitle>Mécanisme</SectionTitle>
          {(show("mecanisme_store") || show("type_commande") || show("cote_manoeuvre") || show("methode_manoeuvre")) && (
            <Row cols={4}>
              {show("mecanisme_store")   && <Cell label="Mécanisme" value={v(row, "mecanisme_store")} span={2} accent />}
              {show("type_commande")     && <Cell label="Type commande" value={v(row, "type_commande")} />}
              {show("cote_manoeuvre")    && <Cell label="Côté manœuvre" value={v(row, "cote_manoeuvre")} />}
            </Row>
          )}
          {(show("methode_manoeuvre") || show("nombre_anneaux_largeur") || show("deportation_premier_anneau") || show("valeur_velcro") || show("type_pose")) && (
            <Row cols={5} bg="#F9FAFB">
              {show("methode_manoeuvre")          && <Cell label="Méthode manœuvre" value={v(row, "methode_manoeuvre")} />}
              {show("nombre_anneaux_largeur")      && <Cell label="Nb anneaux" value={v(row, "nombre_anneaux_largeur")} />}
              {show("deportation_premier_anneau")  && <Cell label="Déport 1er ann." value={v(row, "deportation_premier_anneau")} />}
              {show("valeur_velcro")               && <Cell label="Valeur velcro" value={v(row, "valeur_velcro")} />}
              {show("type_pose")                   && <Cell label="Type pose" value={v(row, "type_pose")} />}
            </Row>
          )}

          {/* Intervalles & Barre */}
          <SectionTitle>Intervalles & Barre</SectionTitle>
          {(show("nombre_intervalles") || show("valeur_intervalle") || show("longueur_barre_de_charge") || show("longueur_tigette")) && (
            <Row cols={4}>
              {show("nombre_intervalles")       && <Cell label="Nb intervalles" value={v(row, "nombre_intervalles")} />}
              {show("valeur_intervalle")        && <Cell label="Val. intervalle" value={v(row, "valeur_intervalle")} />}
              {show("longueur_barre_de_charge") && <Cell label="Long. barre ch." value={v(row, "longueur_barre_de_charge")} />}
              {show("longueur_tigette")         && <Cell label="Long. tigette" value={v(row, "longueur_tigette")} />}
            </Row>
          )}
        </div>

        {/* COLONNE DROITE : croquis + commentaire */}
        <div style={{ borderLeft: "1px solid #E5E7EB", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, borderBottom: "1px solid #E5E7EB", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#6B7280",
              background: "#F3F4F6", padding: "4px 10px",
              borderBottom: "1px solid #E5E7EB",
            }}>
              Croquis intervalles
            </div>
            <div style={{ flex: 1, padding: 8, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 100 }}>
              {croquis ? (
                <img src={croquis} alt="Croquis intervalles" style={{ maxWidth: "100%", maxHeight: 160, objectFit: "contain" }} />
              ) : (
                <div style={{ fontSize: 11, color: "#D1D5DB", fontStyle: "italic", textAlign: "center" }}>aucun croquis</div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#6B7280",
              background: "#F3F4F6", padding: "4px 10px",
              borderBottom: "1px solid #E5E7EB",
            }}>
              Commentaires atelier
            </div>
            <div style={{ padding: "8px 10px", fontSize: 12, color: "#374151", lineHeight: 1.5, minHeight: 50 }}>
              {v(row, "commentaire_confection", "")}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        background: "#F9FAFB", borderTop: "1px solid #E5E7EB",
        padding: "6px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <button
          onClick={() => setCustomizing(true)}
          style={{
            fontSize: 11, fontWeight: 600,
            color: hiddenCount > 0 ? "#92742A" : "#6B7280",
            background: hiddenCount > 0 ? "#FEF3C7" : "white",
            border: `1px solid ${hiddenCount > 0 ? "#FCD34D" : "#E5E7EB"}`,
            borderRadius: 6, padding: "4px 12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          ✏️ Personnaliser
          {hiddenCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: "#92742A", color: "white",
              borderRadius: 10, padding: "1px 6px",
            }}>
              {hiddenCount} masqué{hiddenCount > 1 ? "s" : ""}
            </span>
          )}
        </button>
        {onEdit && (
          <button
            onClick={() => onEdit(row)}
            style={{
              fontSize: 12, fontWeight: 600, color: "#374151",
              background: "white", border: "1px solid #D1D5DB",
              borderRadius: 6, padding: "5px 14px", cursor: "pointer",
            }}
          >
            Modifier
          </button>
        )}
      </div>
    </div>
  );
}
