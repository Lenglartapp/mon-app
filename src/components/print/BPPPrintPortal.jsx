import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * Impression du BPP (Bon de Préparation) en tableau, format A3 paysage.
 *
 * sections : [{ title, columns: [{ key, label }], rows: [...] }]
 * Fidèle à l'écran : on reçoit déjà les colonnes visibles et les lignes filtrées
 * (calculées côté parent à partir de la vue BPP + recherche en cours).
 */

// Formate une valeur de cellule pour l'impression (texte simple uniquement)
const fmtCell = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Oui' : '';
  if (typeof v === 'object') return ''; // photos / objets → ignorés dans un tableau
  return String(v);
};

export default function BPPPrintPortal({ sections = [], projectName, manager, onClose }) {
  const printable = (sections || []).filter(s => s.rows?.length > 0 && s.columns?.length > 0);
  const hasContent = printable.length > 0;

  useEffect(() => {
    if (!hasContent) { onClose?.(); return undefined; }
    const timer = setTimeout(() => {
      window.print();
      onClose?.();
    }, 600);
    return () => clearTimeout(timer);
  }, [hasContent, onClose]);

  if (!hasContent) return null;

  return ReactDOM.createPortal(
    <div id="bpp-print-root">
      <style>{`
        @media print {
          body > *:not(#bpp-print-root) { display: none !important; }
          #bpp-print-root {
            display: block !important;
            position: absolute;
            top: 0; left: 0;
            width: 100%;
            background: white;
          }
          @page { size: A3 landscape; margin: 8mm; }
          .bpp-section { break-inside: auto; }
          .bpp-section + .bpp-section { margin-top: 10mm; break-before: page; }
          .bpp-table thead { display: table-header-group; }
          .bpp-table tr { break-inside: avoid; }
        }
        #bpp-print-root { display: none; }
      `}</style>

      <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', padding: '0' }}>
        {printable.map((section, si) => (
          <div className="bpp-section" key={si}>
            <h2 style={{ fontSize: '13pt', fontWeight: 700, margin: '0 0 2mm' }}>
              {section.title}
              <span style={{ fontSize: '9pt', fontWeight: 400, marginLeft: 8 }}>
                ({section.rows.length} ligne{section.rows.length > 1 ? 's' : ''})
              </span>
            </h2>

            <table className="bpp-table" style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'auto',
              fontSize: '8pt',
            }}>
              <thead>
                {/* Bandeau identité projet — répété en haut de CHAQUE page (thead) */}
                <tr>
                  <th colSpan={section.columns.length} style={{
                    border: '0.5pt solid #1E2447',
                    background: '#1E2447',
                    color: '#fff',
                    padding: '4pt 6pt',
                    fontSize: '10pt',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>BPP — Projet :</strong> {projectName || '—'}</span>
                      <span><strong>Chargé d'affaires :</strong> {manager || '—'}</span>
                    </div>
                  </th>
                </tr>
                <tr>
                  {section.columns.map(col => (
                    <th key={col.key} style={{
                      border: '0.5pt solid #000',
                      padding: '2pt 3pt',
                      background: '#E5E7EB',
                      textAlign: 'left',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, ri) => (
                  <tr key={row.id || ri} style={{ background: ri % 2 ? '#F5F5F5' : '#fff' }}>
                    {section.columns.map(col => (
                      <td key={col.key} style={{
                        border: '0.5pt solid #999',
                        padding: '2pt 3pt',
                        verticalAlign: 'top',
                      }}>
                        {fmtCell(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}
