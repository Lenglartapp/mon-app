// src/components/EtiquettesStoresBateauxPrintPortal.jsx
// Portal d'impression : 3 étiquettes stores bateaux/velum par page A4 (200 × 90 mm).
// Hors écran (et non masqué) : chaque étiquette se mesure pour ajuster son texte.
import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import StoresBateauxLabel from "./etiquettesStoresBateaux/StoresBateauxLabel.jsx";

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
          <StoresBateauxLabel
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
        #etq-stores-bateaux-print-root {
          position: absolute; left: -100000px; top: 0;
          width: 210mm; background: white;
        }
        @media print {
          #etq-stores-bateaux-print-root { display: block !important; left: 0; z-index: 99999; }
          @page { size: A4 portrait; margin: 0; }
        }
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
