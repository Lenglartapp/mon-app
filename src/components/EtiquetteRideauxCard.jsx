// src/components/EtiquetteRideauxCard.jsx
import React, { useState } from "react";

// ─── Champs disponibles sur l'étiquette (ordre + sections) ───────────────────
export const ETIQUETTE_RIDEAUX_FIELDS = [
  // Confection
  { key: "type_confection",      label: "Type confection",    section: "Confection" },
  { key: "paire_ou_un_seul_pan", label: "Paire / Pan",        section: "Confection" },
  { key: "ampleur",              label: "Ampleur",            section: "Confection" },
  { key: "hauteur_renfort_tete", label: "H. Renfort tête",    section: "Confection" },
  { key: "poids",                label: "Poids",              section: "Confection" },
  { key: "onglets",              label: "Onglets",            section: "Confection" },
  { key: "bride",                label: "Bride",              section: "Confection" },
  { key: "type_crochets",        label: "Crochets",           section: "Confection" },
  { key: "point_chausson",       label: "Pt. chausson",       section: "Confection" },
  { key: "etiquette_lavage",     label: "Étiq. lavage",       section: "Confection" },
  { key: "etiquette_lenglart",   label: "Étiq. Lenglart",     section: "Confection" },
  // Ourlets & Bas
  { key: "_ob",                  label: "OB tissu / doublure",section: "Ourlets & Bas" },
  { key: "_oc",                  label: "OC & fin. champs",   section: "Ourlets & Bas" },
  { key: "finition_bas",         label: "Finition bas",       section: "Ourlets & Bas" },
  { key: "doublure_finition_bas",label: "Doubl. fin. bas",    section: "Ourlets & Bas" },
  { key: "_retours",             label: "Retours",            section: "Ourlets & Bas" },
  // Dimensions
  { key: "nombre_les",           label: "Nb lés",             section: "Dimensions" },
  { key: "largeur_finie",        label: "L. Finie",           section: "Dimensions" },
  { key: "hauteur_finie_gauche", label: "H. Finie G",         section: "Dimensions" },
  { key: "hauteur_finie_droite", label: "H. Finie D",         section: "Dimensions" },
  { key: "hspf_gauche",          label: "HSPF G",             section: "Dimensions" },
  { key: "hspf_droite",          label: "HSPF D",             section: "Dimensions" },
  { key: "nombre_glisseur",      label: "Nb glisseurs",       section: "Dimensions" },
  { key: "statut_cotes",         label: "Statut côtes",       section: "Dimensions" },
  { key: "hauteur_coupe",        label: "H. Coupe T1",        section: "Dimensions" },
  { key: "hauteur_coupe_motif",  label: "H. Coupe motif",     section: "Dimensions" },
  { key: "hauteur_coupe_doublure",label:"H. Coupe doubl.",    section: "Dimensions" },
  // Matériaux
  { key: "tissu_deco1",          label: "Tissu 1",            section: "Matériaux" },
  { key: "tissu_deco2",          label: "Tissu 2",            section: "Matériaux" },
  { key: "doublure",             label: "Doublure",           section: "Matériaux" },
  { key: "inter_doublure",       label: "Interdoublure",      section: "Matériaux" },
  { key: "passementerie1",       label: "Pass. 1",            section: "Matériaux" },
  { key: "passementerie2",       label: "Pass. 2",            section: "Matériaux" },
];

const SECTIONS = ["Confection", "Ourlets & Bas", "Dimensions", "Matériaux"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const v = (row, key, fallback = "—") => {
  const val = row?.[key];
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
    const keys = ETIQUETTE_RIDEAUX_FIELDS
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
        const fields = ETIQUETTE_RIDEAUX_FIELDS.filter(f => f.section === section);
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
export default function EtiquetteRideauxCard({ row, projectName, index, total, onEdit, onRowChange }) {
  const [customizing, setCustomizing] = useState(false);

  const hiddenFields = Array.isArray(row?.etiquette_hidden_fields) ? row.etiquette_hidden_fields : [];
  const show = (key) => !hiddenFields.includes(key);

  const zone = v(row, "zone", "Zone ?");
  const piece = v(row, "piece", "Pièce ?");
  const produit = v(row, "produit", "—");
  const heuresConf = v(row, "heures_confection", "—");
  const statutCotes = v(row, "statut_cotes", "—");

  const schemaArr = Array.isArray(row?.schema) ? row.schema : [];
  const schemaImg = schemaArr[0]?.url
    || (typeof row?.schema === "string" ? row.schema : null)
    || (Array.isArray(row?.schema_principe) ? row.schema_principe[0]?.url : null);

  const ob = [
    row?.piquage_ourlets_du_bas ? `OB : ${row.piquage_ourlets_du_bas}` : null,
    row?.piquage_ourlets_bas_doublure ? `OB doubl. : ${row.piquage_ourlets_bas_doublure}` : null,
  ].filter(Boolean).join(" — ") || "—";

  const oc = [
    row?.v_ourlets_de_cotes ? `OC : ${row.v_ourlets_de_cotes}` : null,
    row?.finition_champs ? `Fin. : ${row.finition_champs}` : null,
  ].filter(Boolean).join(" — ") || "—";

  const retours = [
    row?.retour_gauche ? `G : ${row.retour_gauche}` : null,
    row?.retour_droit ? `D : ${row.retour_droit}` : null,
    row?.type_retours || null,
  ].filter(Boolean).join(" / ") || "—";

  const isStatutWarn = statutCotes && !["Définitive", "Validé par chef de projet"].includes(statutCotes);
  const hiddenCount = hiddenFields.length;

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
        background: "#1F2937", padding: "10px 16px",
        display: "grid", gridTemplateColumns: "1fr auto auto",
        alignItems: "center", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {projectName || "Projet"}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#92742A", marginTop: 2 }}>
            {zone} — {piece}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{produit}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>H. Conf.</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB" }}>{heuresConf}h</div>
        </div>
        {total != null && (
          <div style={{
            fontSize: 12, fontWeight: 600, color: "#9CA3AF",
            background: "#374151", borderRadius: 6, padding: "5px 10px", whiteSpace: "nowrap",
          }}>
            n° {(index ?? 0) + 1}/{total}
          </div>
        )}
      </div>

      {/* BODY */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px" }}>

        {/* COLONNE GAUCHE */}
        <div>

          {/* Confection */}
          <SectionTitle>Confection</SectionTitle>
          <Row cols={3}>
            {show("type_confection")      && <Cell label="Type confection" value={v(row, "type_confection")} />}
            {show("paire_ou_un_seul_pan") && <Cell label="Paire / Pan" value={v(row, "paire_ou_un_seul_pan")} />}
            {show("ampleur")              && <Cell label="Ampleur" value={v(row, "ampleur")} />}
          </Row>
          {(show("hauteur_renfort_tete") || show("poids") || show("onglets") || show("bride") || show("type_crochets") || show("point_chausson")) && (
            <Row cols={6} bg="#F9FAFB">
              {show("hauteur_renfort_tete") && <Cell label="H. Renfort tête" value={v(row, "hauteur_renfort_tete")} />}
              {show("poids")               && <Cell label="Poids" value={v(row, "poids")} />}
              {show("onglets")             && <Cell label="Onglets" value={v(row, "onglets")} />}
              {show("bride")               && <Cell label="Bride" value={v(row, "bride")} />}
              {show("type_crochets")       && <Cell label="Crochets" value={v(row, "type_crochets")} />}
              {show("point_chausson")      && <Cell label="Pt. chausson" value={v(row, "point_chausson")} />}
            </Row>
          )}
          {(show("etiquette_lavage") || show("etiquette_lenglart")) && (
            <Row cols={3}>
              {show("etiquette_lavage")   && <Cell label="Étiq. lavage" value={v(row, "etiquette_lavage")} />}
              {show("etiquette_lenglart") && <Cell label="Étiq. Lenglart" value={v(row, "etiquette_lenglart")} />}
            </Row>
          )}

          {/* Ourlets & Bas */}
          <SectionTitle>Ourlets & Bas</SectionTitle>
          {(show("_ob") || show("finition_bas")) && (
            <Row cols={3}>
              {show("_ob")          && <Cell label="OB tissu / doublure" value={ob} span={2} />}
              {show("finition_bas") && <Cell label="Finition bas" value={v(row, "finition_bas")} />}
            </Row>
          )}
          {(show("_oc") || show("doublure_finition_bas")) && (
            <Row cols={3} bg="#F9FAFB">
              {show("_oc")                  && <Cell label="OC & fin. champs" value={oc} span={2} />}
              {show("doublure_finition_bas") && <Cell label="Doubl. fin. bas" value={v(row, "doublure_finition_bas")} />}
            </Row>
          )}
          {show("_retours") && (
            <Row cols={3}>
              <Cell label="Retours" value={retours} span={3} accent />
            </Row>
          )}

          {/* Dimensions */}
          <SectionTitle>Dimensions</SectionTitle>
          {(show("nombre_les") || show("largeur_finie") || show("hauteur_finie_gauche") || show("hauteur_finie_droite")) && (
            <Row cols={4}>
              {show("nombre_les")           && <Cell label="Nb lés" value={v(row, "nombre_les")} />}
              {show("largeur_finie")        && <Cell label="L. Finie" value={v(row, "largeur_finie")} />}
              {show("hauteur_finie_gauche") && <Cell label="H. Finie G" value={v(row, "hauteur_finie_gauche")} />}
              {show("hauteur_finie_droite") && <Cell label="H. Finie D" value={v(row, "hauteur_finie_droite")} />}
            </Row>
          )}
          {(show("hspf_gauche") || show("hspf_droite") || show("nombre_glisseur") || show("statut_cotes")) && (
            <Row cols={4} bg="#F9FAFB">
              {show("hspf_gauche")    && <Cell label="HSPF G" value={v(row, "hspf_gauche")} />}
              {show("hspf_droite")    && <Cell label="HSPF D" value={v(row, "hspf_droite")} />}
              {show("nombre_glisseur")&& <Cell label="Nb glisseurs" value={v(row, "nombre_glisseur")} />}
              {show("statut_cotes")   && <Cell label="Statut côtes" value={statutCotes} accent={isStatutWarn} />}
            </Row>
          )}
          {(show("hauteur_coupe") || show("hauteur_coupe_motif") || show("hauteur_coupe_doublure")) && (
            <Row cols={3}>
              {show("hauteur_coupe")          && <Cell label="H. Coupe T1" value={v(row, "hauteur_coupe")} />}
              {show("hauteur_coupe_motif")    && <Cell label="H. Coupe motif" value={v(row, "hauteur_coupe_motif")} />}
              {show("hauteur_coupe_doublure") && <Cell label="H. Coupe doubl." value={v(row, "hauteur_coupe_doublure")} />}
            </Row>
          )}

          {/* Matériaux */}
          <SectionTitle>Matériaux</SectionTitle>
          {(show("tissu_deco1") || show("tissu_deco2") || show("doublure")) && (
            <Row cols={3}>
              {show("tissu_deco1") && <Cell label="Tissu 1" value={v(row, "tissu_deco1")} accent />}
              {show("tissu_deco2") && <Cell label="Tissu 2" value={v(row, "tissu_deco2")} accent />}
              {show("doublure")    && <Cell label="Doublure" value={v(row, "doublure")} accent />}
            </Row>
          )}
          {(show("inter_doublure") || show("passementerie1") || show("passementerie2")) && (
            <Row cols={3} bg="#F9FAFB">
              {show("inter_doublure")  && <Cell label="Interdoublure" value={v(row, "inter_doublure")} />}
              {show("passementerie1")  && <Cell label="Pass. 1" value={[v(row, "passementerie1"), v(row, "application_passementerie1")].filter(x => x !== "—").join(" — ") || "—"} />}
              {show("passementerie2")  && <Cell label="Pass. 2" value={[v(row, "passementerie2"), v(row, "application_passementerie2")].filter(x => x !== "—").join(" — ") || "—"} />}
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
              Croquis atelier
            </div>
            <div style={{ flex: 1, padding: 8, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 100 }}>
              {schemaImg ? (
                <img src={schemaImg} alt="Croquis" style={{ maxWidth: "100%", maxHeight: 160, objectFit: "contain" }} />
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
