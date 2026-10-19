import React, { useMemo, useRef, useState } from 'react';
import { Download, UploadCloud, AlertTriangle, CheckCircle2 } from 'lucide-react';
import DaDialog from '../ui/DaDialog';
import { DaField } from '../ui/DaForm';
import MultiSelect from '../ui/MultiSelect';
import { ToolbarButton, TonePill } from '../ui/ToolbarControls';
import { MINUTE_PRODUCTS, REQUIRED_KEYS, analyzeMinuteFile, buildMinuteRows, downloadMinuteTemplate, importableColumns } from '../../lib/import/minuteExcelImport';

const MUTED = '#6B7280';
const STORE_KEY = 'droitfil.minuteImport.v1'; // dernier choix produits / colonnes (par appareil)
const th = { padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#374151', borderBottom: '1px solid #E0DED9', background: '#F4F4F4', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 };
const td = { padding: '7px 10px', fontSize: 13, color: '#111827', borderBottom: '1px solid #E8E6E2', verticalAlign: 'top' };
const stepTitle = { fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 };
const Num = ({ n }) => <span style={{ width: 22, height: 22, borderRadius: 99, background: '#1E2447', color: 'white', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>;

function loadChoice() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch { return null; }
}

/**
 * Import Excel des minutes : 1. produits + colonnes, 2. modèle à télécharger,
 * 3. dépôt du fichier rempli → aperçu → lignes ajoutées à la suite.
 */
export default function MinuteExcelImportDialog({ onClose, catalog = [], ctx, minuteName = '', onImport }) {
    const saved = useMemo(loadChoice, []);
    const [products, setProducts] = useState(saved?.products?.length ? saved.products : ['Rideaux']);
    const [columns, setColumns] = useState(saved?.columns || {}); // { [produit]: [clés] }
    const [step, setStep] = useState('prepare'); // prepare | preview
    const [analysis, setAnalysis] = useState(null);
    const [checked, setChecked] = useState(new Set());
    const [fileName, setFileName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [drag, setDrag] = useState(false);
    const [onlyIssues, setOnlyIssues] = useState(false);
    const fileRef = useRef(null);

    const remember = (p, c) => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ products: p, columns: c })); } catch { /* stockage indisponible */ } };
    const setProductsSaved = (p) => { setProducts(p); remember(p, columns); };
    const setColumnsFor = (key, cols) => { const next = { ...columns, [key]: cols }; setColumns(next); remember(products, next); };

    const download = async () => {
        setBusy(true);
        try {
            await downloadMinuteTemplate(products.map(key => ({ key, columns: columns[key] || [] })), { catalog, minuteName });
        } catch (err) {
            setError(`Modèle impossible à créer : ${err.message || err}`);
        } finally {
            setBusy(false);
        }
    };

    const readFile = async (file) => {
        if (!file) return;
        if (!/\.xlsx$/i.test(file.name)) { setError('Fichier Excel (.xlsx) attendu.'); return; }
        setBusy(true);
        setError(null);
        try {
            const res = await analyzeMinuteFile(file, catalog);
            if (res.fatal) { setError(res.fatal); setAnalysis(res.ignored.length ? res : null); return; }
            setAnalysis(res);
            setFileName(file.name);
            setChecked(new Set(res.lines.map(l => l.key)));
            setOnlyIssues(false);
            setStep('preview');
        } catch (err) {
            setError(`Fichier illisible : ${err.message || err}`);
        } finally {
            setBusy(false);
        }
    };

    const lines = analysis?.lines || [];
    const warnCount = lines.filter(l => l.warnings.length).length;
    const shown = onlyIssues ? lines.filter(l => l.warnings.length) : lines;
    const nChecked = lines.filter(l => checked.has(l.key)).length;
    const byProduct = MINUTE_PRODUCTS.map(p => ({ p, n: lines.filter(l => l.product === p.key && checked.has(l.key)).length })).filter(x => x.n);
    const toggle = (k) => setChecked(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

    const apply = () => {
        const chosen = lines.filter(l => checked.has(l.key));
        if (!chosen.length) return;
        onImport(buildMinuteRows(chosen, ctx));
        onClose();
    };

    const footer = step === 'preview' ? (
        <>
            <ToolbarButton onClick={() => { setStep('prepare'); setError(null); }}>Retour</ToolbarButton>
            <span style={{ flex: 1, fontSize: 13, color: MUTED }}>{byProduct.map(({ p, n }) => `${p.label} : ${n}`).join(' · ')}</span>
            <ToolbarButton primary disabled={!nChecked} onClick={apply}>Ajouter {nChecked} ligne{nChecked > 1 ? 's' : ''}</ToolbarButton>
        </>
    ) : null;

    return (
        <DaDialog
            open
            onClose={onClose}
            title="Importer des lignes depuis Excel"
            subtitle={step === 'preview' ? `${fileName} — vérifiez avant d’ajouter : rien n’est ajouté tant que vous n’avez pas validé.` : 'Choisissez ce que vous voulez importer, téléchargez le modèle, puis déposez-le une fois rempli.'}
            maxWidth={step === 'preview' ? 'lg' : 'md'}
            height={step === 'preview' ? '86vh' : undefined}
            footer={footer}
        >
            {error && <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}

            {step === 'prepare' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* 1. Produits et colonnes */}
                    <div>
                        <p style={stepTitle}><Num n={1} /> Ce que je veux importer</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) 1fr', gap: '12px 16px', alignItems: 'end' }}>
                            <DaField label="Produits">
                                <MultiSelect allLabel="Tous" value={products} onChange={(v) => setProductsSaved(MINUTE_PRODUCTS.map(p => p.key).filter(k => v.includes(k)))}
                                    options={MINUTE_PRODUCTS.map(p => ({ value: p.key, label: p.label }))} />
                            </DaField>
                            <div />
                            {products.map(key => {
                                const product = MINUTE_PRODUCTS.find(p => p.key === key);
                                const cols = importableColumns(product.schema);
                                const chosen = columns[key] || [];
                                return (
                                    <React.Fragment key={key}>
                                        <div style={{ fontSize: 13, color: '#374151', paddingBottom: 10 }}>{product.label}</div>
                                        <DaField label={`Colonnes (${REQUIRED_KEYS.length + chosen.filter(c => !REQUIRED_KEYS.includes(c)).length})`}>
                                            <MultiSelect value={chosen} onChange={(v) => setColumnsFor(key, v)}
                                                options={cols.map(c => ({ value: c.key, label: c.label, locked: REQUIRED_KEYS.includes(c.key) }))} />
                                        </DaField>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                        <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
                            Zone, Pièce et Produit sont toujours inclus. Seules les colonnes à saisir sont proposées : métrages et prix de vente sont calculés par Droitfil. Votre choix est retenu pour la prochaine fois.
                        </div>
                    </div>

                    {/* 2. Modèle */}
                    <div>
                        <p style={stepTitle}><Num n={2} /> Télécharger le modèle</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                            <ToolbarButton primary icon={<Download size={15} />} disabled={busy || !products.length} onClick={download}>Télécharger le modèle Excel</ToolbarButton>
                            <span style={{ fontSize: 12, color: MUTED, flex: 1, minWidth: 220 }}>Un onglet par produit, vos colonnes, des listes déroulantes (choix du tableau et articles de la bibliothèque de ce chiffrage) et un mode d’emploi.</span>
                        </div>
                    </div>

                    {/* 3. Dépôt */}
                    <div>
                        <p style={stepTitle}><Num n={3} /> Déposer le fichier rempli</p>
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => fileRef.current?.click()}
                            onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
                            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                            onDragLeave={() => setDrag(false)}
                            onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files?.[0]); }}
                            style={{
                                border: `1.5px dashed ${drag ? '#1E2447' : '#C9C7C2'}`, background: drag ? '#EEF4FD' : '#FAFAF9', borderRadius: 10,
                                padding: '26px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'center',
                            }}
                        >
                            <UploadCloud size={26} color="#1E2447" />
                            <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{busy ? 'Lecture du fichier…' : 'Glissez le fichier ici, ou cliquez pour le choisir'}</div>
                            <div style={{ fontSize: 12, color: MUTED }}>Fichier .xlsx — un aperçu s’affiche avant d’ajouter les lignes, à la suite de celles du chiffrage.</div>
                        </div>
                        <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ''; }} />
                        {analysis?.ignored?.length > 0 && step === 'prepare' && (
                            <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, color: MUTED }}>{analysis.ignored.slice(0, 8).map(m => <li key={m}>{m}</li>)}</ul>
                        )}
                    </div>
                </div>
            )}

            {step === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <TonePill tone={1}>{lines.length - warnCount} prête{lines.length - warnCount > 1 ? 's' : ''}</TonePill>
                        {warnCount > 0 && <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{warnCount} à vérifier</span>}
                        <span style={{ flex: 1 }} />
                        {warnCount > 0 && (
                            <label style={{ fontSize: 13, color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Seulement les lignes à vérifier
                            </label>
                        )}
                    </div>
                    {analysis.ignored.length > 0 && (
                        <details style={{ fontSize: 12, color: MUTED }}>
                            <summary style={{ cursor: 'pointer' }}>{analysis.ignored.length} élément{analysis.ignored.length > 1 ? 's' : ''} du fichier ignoré{analysis.ignored.length > 1 ? 's' : ''}</summary>
                            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{analysis.ignored.map(m => <li key={m}>{m}</li>)}</ul>
                        </details>
                    )}
                    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #E0DED9', borderRadius: 8 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...th, width: 34 }}>
                                        <input type="checkbox" checked={nChecked === lines.length} onChange={() => setChecked(nChecked === lines.length ? new Set() : new Set(lines.map(l => l.key)))} />
                                    </th>
                                    <th style={th}>Onglet · ligne</th><th style={th}>Produit</th><th style={th}>Zone</th><th style={th}>Pièce</th><th style={th}>Saisi</th><th style={{ ...th, width: 300 }}>Contrôle</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map(l => {
                                    const filled = Object.keys(l.raw).filter(k => !REQUIRED_KEYS.includes(k));
                                    const product = MINUTE_PRODUCTS.find(p => p.key === l.product);
                                    const labels = Object.fromEntries(importableColumns(product.schema).map(c => [c.key, c.label]));
                                    return (
                                        <tr key={l.key} style={checked.has(l.key) ? undefined : { opacity: 0.55 }}>
                                            <td style={td}><input type="checkbox" checked={checked.has(l.key)} onChange={() => toggle(l.key)} /></td>
                                            <td style={{ ...td, color: MUTED, whiteSpace: 'nowrap' }}>{l.sheet} · {l.row}</td>
                                            <td style={td}>{l.raw.produit}</td>
                                            <td style={td}>{l.raw.zone || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                                            <td style={td}>{l.raw.piece || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                                            <td style={{ ...td, color: '#374151', fontSize: 12 }} title={filled.map(k => `${labels[k] || k} : ${l.raw[k]}`).join('\n')}>
                                                {filled.length ? filled.slice(0, 4).map(k => `${labels[k] || k} : ${l.raw[k]}`).join(' · ') + (filled.length > 4 ? ` · +${filled.length - 4}` : '') : <span style={{ color: '#D1D5DB' }}>—</span>}
                                            </td>
                                            <td style={td}>
                                                {l.warnings.length
                                                    ? <><span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: '#B45309', fontWeight: 600, fontSize: 12 }}><AlertTriangle size={14} /> À vérifier</span>
                                                        {l.warnings.map(w => <div key={w} style={{ color: '#B45309', fontSize: 12, marginTop: 2 }}>{w}</div>)}</>
                                                    : <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: '#15803D', fontWeight: 600, fontSize: 12 }}><CheckCircle2 size={14} /> OK</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </DaDialog>
    );
}
