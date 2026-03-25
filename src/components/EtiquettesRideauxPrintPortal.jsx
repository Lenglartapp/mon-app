// src/components/EtiquettesRideauxPrintPortal.jsx
// Portal d'impression : 4 étiquettes rideaux par page A4, empilées verticalement
// Format physique : 190mm × 65mm par étiquette
import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { DEFAULT_HEADER_COLOR, getHeaderStyles } from "../lib/etiquetteColors.js";

const v = (row, key, fallback = "—") => {
  const val = row?.[key];
  if (val == null || val === "") return fallback;
  return String(val);
};

// Cellule print
function PCell({ label, value, span = 1, accent = false }) {
  return (
    <div style={{
      gridColumn: `span ${span}`,
      borderRight: "0.4pt solid #CBD5E1",
      borderBottom: "0.4pt solid #CBD5E1",
      padding: "3pt 4pt",
      display: "flex",
      flexDirection: "column",
      gap: 0,
      overflow: "hidden",
      minWidth: 0,
    }}>
      <span style={{
        fontSize: "4.5pt",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "#9CA3AF",
        lineHeight: 1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: "7pt",
        fontWeight: 700,
        color: accent ? "#92742A" : "#111827",
        lineHeight: 1.15,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {value}
      </span>
    </div>
  );
}

function PRow({ children, cols, bg = "white" }) {
  const count = cols || React.Children.count(children);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${count}, 1fr)`,
      background: bg,
      borderLeft: "0.4pt solid #CBD5E1",
    }}>
      {children}
    </div>
  );
}

function PSectionTitle({ children }) {
  return (
    <div style={{
      fontSize: "4pt",
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#6B7280",
      background: "#F3F4F6",
      padding: "2.5pt 4pt",
      borderLeft: "0.4pt solid #CBD5E1",
      borderRight: "0.4pt solid #CBD5E1",
      borderBottom: "0.4pt solid #CBD5E1",
    }}>
      {children}
    </div>
  );
}

function PrintLabel({ row, projectName, index, total }) {
  const hiddenFields = Array.isArray(row?.etiquette_hidden_fields) ? row.etiquette_hidden_fields : [];
  const show = (key) => !hiddenFields.includes(key);

  const zone = v(row, "zone", "Zone ?");
  const piece = v(row, "piece", "Pièce ?");
  const heuresConf = v(row, "heures_confection", "—");
  const statutCotes = v(row, "statut_cotes", "—");
  const schemaArr = Array.isArray(row?.schema) ? row.schema : [];
  const schemaImg = schemaArr[0]?.url || (typeof row?.schema === 'string' ? row.schema : null)
    || (Array.isArray(row?.schema_principe) ? row.schema_principe[0]?.url : null);

  const hdr = getHeaderStyles(row?.etiquette_header_color || DEFAULT_HEADER_COLOR);
  const isStatutWarn = statutCotes && !["Définitive", "Validé par chef de projet"].includes(statutCotes);

  return (
    <div style={{
      width: "200mm",
      height: "90mm",
      border: "0.5pt solid #9CA3AF",
      fontFamily: "system-ui, -apple-system, Arial, sans-serif",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "white",
      boxSizing: "border-box",
    }}>

      {/* HEADER PLEINE LARGEUR */}
      <div style={{
        background: hdr.bg,
        padding: "3pt 6pt",
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        alignItems: "center",
        gap: "4pt",
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: "6pt", fontWeight: 800, color: hdr.textMuted, letterSpacing: "0.04em", textTransform: "uppercase", lineHeight: 1.2 }}>
            {projectName || "Projet"}
          </div>
          <div style={{ fontSize: "8pt", fontWeight: 700, color: hdr.textMain, marginTop: "1pt" }}>
            {zone} — {piece}
          </div>
          <div style={{ fontSize: "7pt", fontWeight: 600, color: hdr.textMuted, marginTop: "1pt" }}>
            {v(row, "produit")}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "4pt", color: hdr.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>H. Conf.</div>
          <div style={{ fontSize: "9pt", fontWeight: 700, color: hdr.textMain }}>{heuresConf}h</div>
        </div>
        <div style={{
          fontSize: "6pt", fontWeight: 600, color: hdr.badgeText,
          background: hdr.badgeBg, borderRadius: "2pt",
          padding: "2pt 4pt", whiteSpace: "nowrap",
        }}>
          {(index ?? 0) + 1}/{total}
        </div>
      </div>

      {/* CORPS : colonne gauche + colonne droite */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 46mm",
        flex: 1,
        overflow: "hidden",
        borderTop: "none",
      }}>

      {/* COLONNE GAUCHE */}
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Confection */}
        <PSectionTitle>Confection</PSectionTitle>
        <PRow cols={4}>
          {show("type_confection")      && <PCell label="Type conf." value={v(row, "type_confection")} span={2} />}
          {show("paire_ou_un_seul_pan") && <PCell label="Paire/Pan" value={v(row, "paire_ou_un_seul_pan")} span={2} />}
        </PRow>
        <PRow cols={6} bg="#F9FAFB">
          {show("ampleur")              && <PCell label="Ampleur" value={v(row, "ampleur")} />}
          {show("hauteur_renfort_tete") && <PCell label="H. Renfort" value={v(row, "hauteur_renfort_tete")} />}
          {show("poids")                && <PCell label="Poids" value={v(row, "poids")} />}
          {show("onglets")              && <PCell label="Onglets" value={v(row, "onglets")} />}
          {show("bride")                && <PCell label="Bride" value={v(row, "bride")} />}
          {show("point_chausson")       && <PCell label="Pt. chausson" value={v(row, "point_chausson")} />}
        </PRow>
        <PRow cols={6}>
          {show("type_crochets")      && <PCell label="Crochets" value={v(row, "type_crochets")} span={2} />}
          {show("etiquette_lavage")   && <PCell label="Étiq. lavage" value={v(row, "etiquette_lavage")} span={2} />}
          {show("etiquette_lenglart") && <PCell label="Étiq. Lenglart" value={v(row, "etiquette_lenglart")} span={2} />}
        </PRow>

        {/* Ourlets & Bas */}
        <PSectionTitle>Ourlets & Bas</PSectionTitle>
        <PRow cols={3}>
          {show("piquage_ourlets_du_bas") && <PCell label="OB Tissu" value={v(row, "piquage_ourlets_du_bas")} />}
          {show("piquage_ourlet")         && <PCell label="Piquage ourlet" value={v(row, "piquage_ourlet")} />}
          {show("finition_bas")           && <PCell label="Cassant / Rasant" value={v(row, "finition_bas")} />}
        </PRow>
        <PRow cols={3} bg="#F9FAFB">
          {show("piquage_ourlets_bas_doublure") && <PCell label="OB Doublure" value={v(row, "piquage_ourlets_bas_doublure")} />}
          {show("deduction_doublure")           && <PCell label="Déd. Doublure" value={v(row, "deduction_doublure")} />}
          {show("doublure_finition_bas")        && <PCell label="Doubl. fin. bas" value={v(row, "doublure_finition_bas")} />}
        </PRow>
        <PRow cols={3}>
          {show("v_ourlets_de_cotes") && <PCell label="Ourlets de côté" value={v(row, "v_ourlets_de_cotes")} />}
          {show("finition_champs")    && <PCell label="Finition chant" value={v(row, "finition_champs")} />}
        </PRow>

        {/* Dimensions */}
        <PSectionTitle>Dimensions</PSectionTitle>
        <PRow cols={4}>
          {show("nombre_les")    && <PCell label="Nb lés" value={v(row, "nombre_les")} />}
          {show("largeur_finie") && <PCell label="L. Finie" value={v(row, "largeur_finie")} />}
          {show("retour_gauche") && <PCell label="Retour G" value={v(row, "retour_gauche")} />}
          {show("retour_droit")  && <PCell label="Retour D" value={v(row, "retour_droit")} />}
        </PRow>
        <PRow cols={3} bg="#F9FAFB">
          {show("hauteur_finie_gauche") && <PCell label="H. Fin. G" value={v(row, "hauteur_finie_gauche")} />}
          {show("hauteur_finie_milieu") && <PCell label="H. Fin. M" value={v(row, "hauteur_finie_milieu")} />}
          {show("hauteur_finie_droite") && <PCell label="H. Fin. D" value={v(row, "hauteur_finie_droite")} />}
        </PRow>
        <PRow cols={4}>
          {show("nombre_glisseur")     && <PCell label="Nb glisseurs" value={v(row, "nombre_glisseur")} />}
          {show("statut_cotes")        && <PCell label="Statut côtes" value={statutCotes} accent={isStatutWarn} />}
          {show("hauteur_coupe")       && <PCell label="H. Coupe T1" value={v(row, "hauteur_coupe")} />}
          {show("hauteur_coupe_motif") && <PCell label="H. Coupe motif" value={v(row, "hauteur_coupe_motif")} />}
        </PRow>
        <PRow cols={3} bg="#F9FAFB">
          {show("hauteur_coupe_doublure") && <PCell label="H. Coupe doubl." value={v(row, "hauteur_coupe_doublure")} />}
        </PRow>

        {/* Mécanisme */}
        <PSectionTitle>Mécanisme</PSectionTitle>
        <PRow cols={3}>
          {show("type_mecanisme")  && <PCell label="Type Méca" value={v(row, "type_mecanisme")} />}
          {show("modele_mecanisme")&& <PCell label="Modèle Méca" value={v(row, "modele_mecanisme")} />}
          {show("type_croisement") && <PCell label="Type Croisement" value={v(row, "type_croisement")} />}
        </PRow>

        {/* Matériaux */}
        <PSectionTitle>Matériaux</PSectionTitle>
        <PRow cols={6}>
          {show("tissu_deco1") && <PCell label="Tissu 1" value={v(row, "tissu_deco1")} span={2} accent />}
          {show("tissu_deco2") && <PCell label="Tissu 2" value={v(row, "tissu_deco2")} span={2} accent />}
          {show("doublure")    && <PCell label="Doublure" value={v(row, "doublure")} span={2} accent />}
        </PRow>
        <PRow cols={6} bg="#F9FAFB">
          {show("inter_doublure")  && <PCell label="Interdoublure" value={v(row, "inter_doublure")} span={2} />}
          {show("passementerie1")  && <PCell label="Pass. 1" value={[v(row, "passementerie1"), v(row, "application_passementerie1")].filter(x => x !== "—").join(" — ") || "—"} span={2} />}
          {show("passementerie2")  && <PCell label="Pass. 2" value={[v(row, "passementerie2"), v(row, "application_passementerie2")].filter(x => x !== "—").join(" — ") || "—"} span={2} />}
        </PRow>
      </div>

      {/* COLONNE DROITE : croquis + commentaire */}
      <div style={{
        borderLeft: "0.5pt solid #9CA3AF",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Croquis */}
        <div style={{
          flex: 2,
          borderBottom: "0.4pt solid #CBD5E1",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}>
          <div style={{
            fontSize: "4pt", fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "#6B7280",
            background: "#F3F4F6", padding: "1.5pt 4pt",
            borderBottom: "0.4pt solid #CBD5E1",
          }}>
            Croquis atelier
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3pt", minHeight: 0 }}>
            {schemaImg ? (
              <img src={schemaImg} alt="Croquis" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : (
              <div style={{ fontSize: "5pt", color: "#D1D5DB", fontStyle: "italic", textAlign: "center" }}>—</div>
            )}
          </div>
        </div>

        {/* Commentaire */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{
            fontSize: "4pt", fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "#6B7280",
            background: "#F3F4F6", padding: "1.5pt 4pt",
            borderBottom: "0.4pt solid #CBD5E1",
          }}>
            Commentaires atelier
          </div>
          <div style={{
            flex: 1,
            padding: "3pt 4pt",
            fontSize: "6pt",
            color: "#374151",
            lineHeight: 1.4,
            wordBreak: "break-word",
            overflow: "hidden",
          }}>
            {v(row, "commentaire_confection", "")}
          </div>
        </div>
      </div>

      </div>{/* fin grille corps */}
    </div>
  );
}

// Tiret de découpe entre étiquettes
function DecoupeTrait() {
  return (
    <div style={{
      width: "200mm",
      height: "3mm",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: "4pt",
      padding: "0 2mm",
      boxSizing: "border-box",
    }}>
      <span style={{ fontSize: "7pt", color: "#CBD5E1" }}>✂</span>
      <div style={{
        flex: 1,
        borderTop: "0.5pt dashed #CBD5E1",
      }} />
    </div>
  );
}

// Page A4 : 4 étiquettes + traits de découpe
function PrintPage({ labels, projectName, totalCount, startIndex }) {
  return (
    <div style={{
      width: "210mm",
      minHeight: "297mm",
      background: "white",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: "3mm 5mm",
      boxSizing: "border-box",
      pageBreakAfter: "always",
    }}>
      {labels.map((row, i) => (
        <React.Fragment key={row.id || i}>
          <PrintLabel
            row={row}
            projectName={projectName}
            index={startIndex + i}
            total={totalCount}
          />
          {i < labels.length - 1 && <DecoupeTrait />}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function EtiquettesRideauxPrintPortal({ rows, projectName, onClose }) {
  // Découper en pages de 3
  const pages = [];
  for (let i = 0; i < rows.length; i += 3) {
    pages.push({ labels: rows.slice(i, i + 3), startIndex: i });
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
      onClose?.();
    }, 600);
    return () => clearTimeout(timer);
  }, [onClose]);

  const portal = document.getElementById("etq-rideaux-print-root");
  if (!portal) return null;

  return ReactDOM.createPortal(
    <>
      <style>{`
        @media print {
          #etq-rideaux-print-root {
            display: block !important;
            position: fixed;
            top: 0; left: 0;
            width: 210mm;
            background: white;
            z-index: 99999;
          }
          @page { size: A4 portrait; margin: 0; }
        }
        #etq-rideaux-print-root { display: none; }
      `}</style>
      {pages.map((page, pi) => (
        <PrintPage
          key={pi}
          labels={page.labels}
          projectName={projectName}
          totalCount={rows.length}
          startIndex={page.startIndex}
        />
      ))}
    </>,
    portal
  );
}
