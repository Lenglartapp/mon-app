// src/components/EtiquettesStoresBateauxPrintPortal.jsx
// Portal d'impression : 3 étiquettes stores bateaux/velum par page A4
import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { DEFAULT_HEADER_COLOR, getHeaderStyles } from "../lib/etiquetteColors.js";

const v = (row, key, fallback = "—") => {
  const val = row?.[key];
  if (val == null || val === "") return fallback;
  return String(val);
};

function PCell({ label, value, span = 1, accent = false }) {
  return (
    <div style={{
      gridColumn: `span ${span}`,
      borderRight: "0.4pt solid #CBD5E1",
      borderBottom: "0.4pt solid #CBD5E1",
      padding: "5pt 4pt",
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
      padding: "3.5pt 4pt",
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
  const isStatutWarn = statutCotes && !["Définitive", "Validé par chef de projet"].includes(statutCotes);

  const hdr = getHeaderStyles(row?.etiquette_header_color || DEFAULT_HEADER_COLOR);

  const croquis = Array.isArray(row?.croquis_intervalle)
    ? row.croquis_intervalle[0]?.url || null
    : null;

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
      }}>

        {/* COLONNE GAUCHE */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Dimensions */}
          <PSectionTitle>Dimensions</PSectionTitle>
          <PRow cols={5}>
            {show("largeur")        && <PCell label="Largeur" value={v(row, "largeur")} />}
            {show("largeur_finie")  && <PCell label="L. Finie" value={v(row, "largeur_finie")} />}
            {show("ourlet_de_cote") && <PCell label="Ourlet côté" value={v(row, "ourlet_de_cote")} />}
            {show("hauteur_finie")  && <PCell label="H. Finie" value={v(row, "hauteur_finie")} />}
            {show("statut_cotes")   && <PCell label="Statut côtes" value={statutCotes} accent={isStatutWarn} />}
          </PRow>

          {/* Coupes & Finitions */}
          <PSectionTitle>Coupes & Finitions</PSectionTitle>
          <PRow cols={5}>
            {show("hauteur_coupe")            && <PCell label="H. Coupe" value={v(row, "hauteur_coupe")} />}
            {show("hauteur_coupe_motif")      && <PCell label="H. Coupe motif" value={v(row, "hauteur_coupe_motif")} />}
            {show("hauteur_coupe_doublure")   && <PCell label="H. Coupe doubl." value={v(row, "hauteur_coupe_doublure")} />}
            {show("picage_bas")               && <PCell label="Picage bas" value={v(row, "picage_bas")} />}
            {show("finition_chant_et_retour") && <PCell label="Fin. chant & ret." value={v(row, "finition_chant_et_retour")} />}
          </PRow>

          {/* Matériaux */}
          <PSectionTitle>Matériaux</PSectionTitle>
          <PRow cols={3}>
            {show("toile_finition_1") && <PCell label="Tissu 1" value={v(row, "toile_finition_1")} accent />}
            {show("doublure")         && <PCell label="Doublure" value={v(row, "doublure")} accent />}
            {show("etiquette_lavage") && <PCell label="Étiq. lavage" value={v(row, "etiquette_lavage")} />}
          </PRow>

          {/* Mécanisme */}
          <PSectionTitle>Mécanisme</PSectionTitle>
          <PRow cols={6}>
            {show("mecanisme_store")            && <PCell label="Mécanisme" value={v(row, "mecanisme_store")} span={2} accent />}
            {show("type_commande")              && <PCell label="Type cmd." value={v(row, "type_commande")} span={2} />}
            {show("cote_manoeuvre")             && <PCell label="Côté man." value={v(row, "cote_manoeuvre")} />}
            {show("methode_manoeuvre")          && <PCell label="Méthode" value={v(row, "methode_manoeuvre")} />}
          </PRow>
          <PRow cols={6} bg="#F9FAFB">
            {show("nombre_anneaux_largeur")     && <PCell label="Nb anneaux" value={v(row, "nombre_anneaux_largeur")} />}
            {show("deportation_premier_anneau") && <PCell label="Déport 1er" value={v(row, "deportation_premier_anneau")} />}
            {show("valeur_velcro")              && <PCell label="Velcro" value={v(row, "valeur_velcro")} />}
            {show("type_pose")                  && <PCell label="Pose" value={v(row, "type_pose")} span={3} />}
          </PRow>

          {/* Intervalles & Barre */}
          <PSectionTitle>Intervalles & Barre</PSectionTitle>
          <PRow cols={4}>
            {show("nombre_intervalles")       && <PCell label="Nb intervalles" value={v(row, "nombre_intervalles")} />}
            {show("valeur_intervalle")        && <PCell label="Val. intervalle" value={v(row, "valeur_intervalle")} />}
            {show("longueur_barre_de_charge") && <PCell label="Long. barre ch." value={v(row, "longueur_barre_de_charge")} />}
            {show("longueur_tigette")         && <PCell label="Long. tigette" value={v(row, "longueur_tigette")} />}
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
          <div style={{ flex: 1, borderBottom: "0.4pt solid #CBD5E1", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{
              fontSize: "4pt", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#6B7280",
              background: "#F3F4F6", padding: "1.5pt 4pt",
              borderBottom: "0.4pt solid #CBD5E1",
            }}>
              Croquis intervalles
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3pt" }}>
              {croquis ? (
                <img src={croquis} alt="Croquis" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : (
                <div style={{ fontSize: "5pt", color: "#D1D5DB", fontStyle: "italic", textAlign: "center" }}>—</div>
              )}
            </div>
          </div>
          {/* Commentaire */}
          <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{
              fontSize: "4pt", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#6B7280",
              background: "#F3F4F6", padding: "1.5pt 4pt",
              borderBottom: "0.4pt solid #CBD5E1",
            }}>
              Commentaires atelier
            </div>
            <div style={{ padding: "3pt 4pt", fontSize: "8pt", color: "#374151", lineHeight: 1.4, wordBreak: "break-word", minHeight: "16mm" }}>
              {v(row, "commentaire_confection", "")}
            </div>
          </div>
        </div>

      </div>{/* fin grille corps */}
    </div>
  );
}

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
      <div style={{ flex: 1, borderTop: "0.5pt dashed #CBD5E1" }} />
    </div>
  );
}

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

export default function EtiquettesStoresBateauxPrintPortal({ rows, projectName, onClose }) {
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

  const portal = document.getElementById("etq-stores-bateaux-print-root");
  if (!portal) return null;

  return ReactDOM.createPortal(
    <>
      <style>{`
        @media print {
          #etq-stores-bateaux-print-root {
            display: block !important;
            position: fixed;
            top: 0; left: 0;
            width: 210mm;
            background: white;
            z-index: 99999;
          }
          @page { size: A4 portrait; margin: 0; }
        }
        #etq-stores-bateaux-print-root { display: none; }
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
