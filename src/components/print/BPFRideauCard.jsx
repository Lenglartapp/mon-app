import React from 'react';

// Helper for display
const val = (v, suffix = '') => (v ? `${v}${suffix}` : '');
const bool = (v) => (v ? 'OUI' : 'NON');

export default function BPFRideauCard({ row, project, index, total }) {
    // Styles
    const S = {
        container: {
            width: '100%',
            height: '74mm', // Precise 1/4 A4
            boxSizing: 'border-box',
            border: '2px solid #000',
            marginBottom: '0', // No margin if we use precise sizing
            display: 'flex',
            flexDirection: 'column',
            fontSize: '8pt', // Base font size
            fontFamily: 'Arial, sans-serif',
            // pageBreakInside: 'avoid' handled by container
            overflow: 'hidden'
        },
        header: {
            backgroundColor: '#FFFF00', // Yellow
            borderBottom: '1px solid #000',
            display: 'flex', justifyContent: 'space-between', padding: '2px 4px',
            fontWeight: 'bold', fontSize: '10pt', height: '5mm', alignItems: 'center'
        },
        table: {
            width: '100%',
            height: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed'
        },
        td: {
            border: '1px solid #000',
            padding: '2px', // Compact padding
            textAlign: 'center',
            verticalAlign: 'middle',
            boxSizing: 'border-box'
        },
        redLabel: { color: 'red', fontWeight: 'bold' },
        blackVal: { color: 'black', fontWeight: 'bold' },
        bigVal: { fontSize: '14pt', fontWeight: '800' }
    };

    const getTissuInfo = (num) => {
        const name = row[`tissu_deco${num}`] || row[`tissu_${num}`];
        const ml = row[`ml_tissu_deco${num}`] || row[`ml_tissu_${num}`] || row[`ml_tissu${num}`];
        if (!name) return null;
        return { name, ml, coupe: row.hauteur_coupe || '-' };
    };
    const t1 = getTissuInfo(1);
    const t2 = getTissuInfo(2);

    return (
        <div style={S.container}>
            <div style={S.header}>
                <span>{project?.name || "PROJET"}</span>
                <span style={{ fontSize: '9pt' }}>n° {index + 1}/{total}</span>
            </div>

            <table style={S.table}>
                <colgroup>
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '25%' }} />
                </colgroup>
                <tbody>
                    {/* ROW 1 */}
                    <tr style={{ height: '25%' }}>
                        {/* Zone / Pièce */}
                        <td style={S.td}>
                            <div style={S.redLabel}>Zone</div>
                            <div style={S.blackVal}>{row.zone}</div>
                            <div style={S.redLabel}>Pièce</div>
                            <div style={S.blackVal}>{row.piece}</div>
                        </td>
                        {/* OB/OC */}
                        <td style={S.td}>
                            <div style={{ fontSize: '7pt' }}>"OB" : {row.piquage_ourlets_du_bas || row.ourlet_bas || '-'}</div>
                            <div style={{ fontSize: '7pt' }}>"OC" : {row.v_ourlets_de_cotes || row.ourlet_cote || '-'}</div>
                            <div style={{ fontSize: '7pt', marginTop: 2 }}>Onglet: {bool(row.onglets === 'Oui')} - Poids: {bool(row.poids === 'Oui')}</div>
                            <div style={{ fontSize: '7pt' }}>Entretien: {bool(row.etiquette_lavage === 'Oui')}</div>
                        </td>
                        {/* Type Pose */}
                        <td style={S.td}>
                            <div style={S.redLabel}>Type de pose</div>
                            <div>{row.type_pose || '-'}</div>
                            <div style={{ color: 'green', fontWeight: 'bold' }}>{row.type_confection}</div>
                            <div style={{ fontSize: '7pt' }}>Tête: {row.renfort_tetes || '-'} / {row.hauteur_tetes || '-'}</div>
                            <div style={{ fontSize: '7pt' }}>Crochets: {row.type_crochets || '-'}</div>
                        </td>
                        {/* Croquis (Rowspan 2) */}
                        <td style={S.td} rowSpan={2}>
                            {row.croquis ? (
                                <img src={row.croquis} alt="Croquis" style={{ maxWidth: '100%', maxHeight: '35mm' }} />
                            ) : (
                                <span style={{ color: '#ccc' }}>Croquis atelier</span>
                            )}
                        </td>
                    </tr>

                    {/* ROW 2 */}
                    <tr style={{ height: '10%' }}>
                        <td style={S.td}>
                            {row.paire_ou_un_seul_pan}
                            {row.doublure && <span style={{ color: 'red', fontWeight: 'bold', marginLeft: 4 }}>+ Doublé</span>}
                        </td>
                        <td style={S.td}>
                            <strong>Quantité : {row.quantite || 1}</strong>
                        </td>
                        <td style={S.td}>
                            Nb Lés : {row.nombre_les || '-'}
                        </td>
                        {/* Col 4 occupied by rowspan */}
                    </tr>

                    {/* ROW 3 */}
                    <tr style={{ height: '35%' }}>
                        <td style={S.td}>
                            <div style={{ fontSize: '8pt' }}>"Hauteur finie"</div>
                            <div style={S.bigVal}>{val(row.hauteur_finie)}</div>
                            <div style={{ height: 4 }}></div>
                            <div style={{ fontSize: '8pt' }}>"Largeur finie"</div>
                            <div style={S.bigVal}>{val(row.largeur_finie)}</div>
                        </td>
                        <td style={S.td}>
                            <div style={{ fontSize: '12pt', fontWeight: 'bold' }}>Hauteur finie</div>
                            <div style={{ height: 10 }}></div>
                            <div style={{ fontSize: '12pt', fontWeight: 'bold' }}>Largeur finie</div>
                        </td>
                        <td style={S.td}>
                            <div style={{ fontSize: '7pt' }}>Fin. Bas: {row.finition_bas || '-'}</div>
                            <div style={{ fontSize: '7pt' }}>Dbl -4cm: {row.doublure_finition_bas || '-'}</div>
                            <div style={{ marginTop: 2 }}>Ampleur: {row.ampleur}</div>
                            <div style={{ ...S.redLabel, fontSize: '7pt', marginTop: 2 }}>
                                Retours: {row.retour_gauche || 0} / {row.retour_droit || 0}
                            </div>
                        </td>
                        <td style={S.td} rowSpan={2}>
                            <div style={{ fontSize: '7pt', color: '#666', marginBottom: 2 }}>Commentaires atelier</div>
                            <div style={{ fontSize: '8pt', textAlign: 'left', whiteSpace: 'pre-wrap' }}>
                                {(() => {
                                    const val = row.comments || row.notes || row.description;
                                    if (!val) return "";
                                    if (typeof val === 'string') return val;
                                    if (Array.isArray(val)) {
                                        // If array of messages, take the last one's text
                                        const last = val[val.length - 1];
                                        return last?.text || JSON.stringify(val);
                                    }
                                    if (typeof val === 'object') {
                                        return val.text || JSON.stringify(val);
                                    }
                                    return String(val);
                                })()}
                            </div>
                        </td>
                    </tr>

                    {/* ROW 4 */}
                    <tr style={{ height: '30%' }}>
                        <td style={{ ...S.td, width: '25%' }}>
                            {t1 && <div style={S.redLabel}>{t1.name}</div>}
                            {t2 && <div style={S.redLabel}>{t2.name}</div>}
                        </td>
                        <td style={{ ...S.td, width: '50%' }} colSpan={2}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', borderBottom: '1px solid #eee' }}>
                                <span>H. Coupe: {t1 ? t1.coupe : '-'}</span>
                                {t1 && <span style={{ color: 'green', fontWeight: 'bold' }}>ML : {t1.ml}</span>}
                            </div>
                            {t2 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                                    <span>H. Coupe 2: {t2.coupe || '-'}</span>
                                    <span style={{ color: 'green', fontWeight: 'bold' }}>ML : {t2.ml}</span>
                                </div>
                            )}
                        </td>
                        {/* Col 4 occupied by rowspan */}
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
