import React, { useMemo, useRef, useState } from 'react';
import { Download, Upload, FileSpreadsheet, PackagePlus, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import DaDialog from '../../ui/DaDialog';
import { ToolbarButton, TonePill } from '../../ui/ToolbarControls';
import { useAuth } from '../../../auth';
import {
    ANCIEN_STOCK_REASON, analyzeAddFile, analyzeUpdateFile, detectFileKind, downloadAddTemplate,
    exportStockForUpdate, readAllSheets,
} from '../../../lib/inventory/stockImport';

const MUTED = 'var(--df-muted)';
const th = { padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--df-text-2)', borderBottom: '1px solid var(--df-border)', background: 'var(--df-surface)', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 };
const td = { padding: '7px 10px', fontSize: 13, color: 'var(--df-text)', borderBottom: '1px solid var(--df-border-soft)', verticalAlign: 'top' };
const fmt = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 }));

// Les avertissements qui méritent une décision : ligne décochée par défaut.
const UNCHECK_BY_DEFAULT = /^Doublon/;

function Card({ icon, title, children, actions }) {
    return (
        <div style={{ flex: 1, minWidth: 280, border: '1px solid var(--df-border)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--df-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--df-selected)', color: 'var(--df-primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
                <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--df-text)' }}>{title}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--df-text-2)', lineHeight: 1.55, flex: 1 }}>{children}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>
        </div>
    );
}

function Status({ line }) {
    if (line.errors.length) return <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: 'var(--df-danger-text)', fontWeight: 600, fontSize: 12 }}><XCircle size={14} /> Erreur</span>;
    if (line.warnings.length) return <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: 'var(--df-x-B45309)', fontWeight: 600, fontSize: 12 }}><AlertTriangle size={14} /> À vérifier</span>;
    return <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: 'var(--df-x-15803D)', fontWeight: 600, fontSize: 12 }}><CheckCircle2 size={14} /> OK</span>;
}

function Messages({ line }) {
    if (!line.errors.length && !line.warnings.length) return null;
    return (
        <div style={{ marginTop: 3, fontSize: 12, lineHeight: 1.45 }}>
            {line.errors.map(m => <div key={m} style={{ color: 'var(--df-danger-text)' }}>{m}</div>)}
            {line.warnings.map(m => <div key={m} style={{ color: 'var(--df-x-B45309)' }}>{m}</div>)}
        </div>
    );
}

/**
 * Import Excel de l'inventaire : ajout d'ancien stock (modèle) ou mise à jour (export).
 * @param {Array} inventory     articles du stock (entrées, non regroupées)
 * @param {Array} exportItems   entrées à exporter (ce qui est affiché à l'écran)
 * @param {Array} zones         emplacements de l'entrepôt (warehouse_zones)
 */
export default function StockImportDialog({ onClose, inventory = [], exportItems = [], zones = [], onImport, onUpdate }) {
    const { currentUser } = useAuth();
    const operator = currentUser?.name || currentUser?.email || 'Import Excel';
    const fileRef = useRef(null);
    const [step, setStep] = useState('choose'); // choose | preview | done
    const [kind, setKind] = useState(null); // add | update
    const [fileName, setFileName] = useState('');
    const [analysis, setAnalysis] = useState(null); // { lines, fatal }
    const [checked, setChecked] = useState(new Set());
    const [onlyIssues, setOnlyIssues] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [info, setInfo] = useState(null);
    const [result, setResult] = useState(null);
    const zoneCodes = useMemo(() => zones.map(z => z.code).filter(Boolean), [zones]);

    const pickFile = (k) => { setKind(k); setError(null); setInfo(null); fileRef.current?.click(); };

    const onFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setBusy(true);
        setError(null);
        try {
            // Toutes les feuilles : une feuille de comptage peut en avoir une par allée.
            const sheets = (await readAllSheets(file)).filter(sh => detectFileKind(sh.rows));
            const rows = sheets[0]?.rows || [];
            const detected = detectFileKind(rows);
            let k = kind;
            if (detected && detected !== kind) {
                k = detected;
                // Message seulement si l'utilisateur s'est trompé de bouton
                if (kind)
                setInfo(detected === 'add'
                    ? 'Ce fichier est un modèle d’ajout d’ancien stock : il est traité comme tel.'
                    : 'Ce fichier est un export du stock : il est traité comme une mise à jour.');
            }
            let res;
            if (k === 'add') {
                res = analyzeAddFile(rows, { zones: zoneCodes, inventory });
                res.lines.forEach(l => { l.key = String(l.row); });
            } else {
                const parts = sheets.filter(sh => detectFileKind(sh.rows) === 'update')
                    .map(sh => ({ sh, r: analyzeUpdateFile(sh.rows, { inventory, zones: zoneCodes }) }));
                const multi = parts.length > 1;
                res = { fatal: parts.find(p => p.r.fatal)?.r.fatal || null, lines: parts.flatMap(({ sh, r }) => r.lines.map(l => ({ ...l, key: `${sh.name}#${l.row}`, where: multi ? `${sh.name} · ${l.row}` : String(l.row) }))) };
                if (!parts.length) res = { fatal: 'Aucune feuille de mise à jour reconnue dans ce fichier.', lines: [] };
            }
            if (res.fatal && !res.lines.length) { setError(res.fatal); return; }
            if (k === 'update' && !res.lines.length) { setError('Aucun changement dans ce fichier : remplissez les colonnes jaunes (nouvelle quantité / nouvel emplacement).'); return; }
            setKind(k);
            setFileName(file.name);
            setAnalysis(res);
            setChecked(new Set(res.lines.filter(l => !l.errors.length && !l.warnings.some(w => UNCHECK_BY_DEFAULT.test(w))).map(l => l.key)));
            setOnlyIssues(false);
            setStep('preview');
            if (res.fatal) setError(res.fatal);
        } catch (err) {
            setError(`Fichier illisible : ${err.message || err}`);
        } finally {
            setBusy(false);
        }
    };

    const lines = analysis?.lines || [];
    const counts = {
        ok: lines.filter(l => !l.errors.length && !l.warnings.length).length,
        warn: lines.filter(l => !l.errors.length && l.warnings.length).length,
        err: lines.filter(l => l.errors.length).length,
    };
    const shown = onlyIssues ? lines.filter(l => l.errors.length || l.warnings.length) : lines;
    const selectable = lines.filter(l => !l.errors.length);
    const nChecked = selectable.filter(l => checked.has(l.key)).length;
    const toggle = (key) => setChecked(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
    const toggleAll = () => setChecked(nChecked === selectable.length ? new Set() : new Set(selectable.map(l => l.key)));

    const apply = async () => {
        const chosen = lines.filter(l => !l.errors.length && checked.has(l.key));
        if (!chosen.length) return;
        setBusy(true);
        try {
            const res = kind === 'add'
                ? await onImport(chosen.map(l => ({ ...l.data, _row: l.row, reason: `${ANCIEN_STOCK_REASON} — ${fileName}` })), operator)
                : await onUpdate(chosen, operator);
            setResult({ ...res, total: chosen.length });
            setStep('done');
        } catch (err) {
            setError(err.message || String(err));
        } finally {
            setBusy(false);
        }
    };

    const title = step === 'choose' ? 'Importer dans le stock'
        : kind === 'add' ? 'Ajouter de l’ancien stock' : 'Mettre à jour le stock';

    const footer = step === 'preview' ? (
        <>
            <ToolbarButton onClick={() => { setStep('choose'); setAnalysis(null); setError(null); setInfo(null); }}>Retour</ToolbarButton>
            <span style={{ flex: 1 }} />
            <ToolbarButton primary disabled={busy || !nChecked} onClick={apply}>
                {busy ? 'Enregistrement…' : kind === 'add' ? `Importer ${nChecked} article${nChecked > 1 ? 's' : ''}` : `Appliquer ${nChecked} changement${nChecked > 1 ? 's' : ''}`}
            </ToolbarButton>
        </>
    ) : step === 'done' ? (
        <><span style={{ flex: 1 }} /><ToolbarButton primary onClick={onClose}>Fermer</ToolbarButton></>
    ) : null;

    return (
        <DaDialog
            open
            onClose={busy ? undefined : onClose}
            title={title}
            subtitle={step === 'preview' ? `${fileName} — vérifiez avant d’appliquer : rien n’est enregistré tant que vous n’avez pas validé.` : 'Stock de l’atelier en Excel : ajout en lot ou mise à jour.'}
            maxWidth={step === 'choose' ? 'md' : 'lg'}
            height={step === 'preview' ? '86vh' : undefined}
            footer={footer}
        >
            <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={onFile} />
            {error && <div role="alert" style={{ background: 'var(--df-danger-bg)', border: '1px solid #FCA5A5', color: 'var(--df-danger-text)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}
            {info && step === 'preview' && <div style={{ background: 'var(--df-selected)', border: '1px solid var(--df-x-C7D7F2)', color: 'var(--df-primary-text)', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 14 }}>{info}</div>}

            {step === 'choose' && (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <Card
                        icon={<PackagePlus size={18} />}
                        title="Ajouter de l’ancien stock"
                        actions={<>
                            <ToolbarButton icon={<Download size={15} />} onClick={() => downloadAddTemplate(zones)}>Télécharger le modèle</ToolbarButton>
                            <ToolbarButton primary icon={<Upload size={15} />} disabled={busy} onClick={() => pickFile('add')}>{busy && kind === 'add' ? 'Lecture…' : 'Importer le fichier rempli'}</ToolbarButton>
                        </>}
                    >
                        Pour rentrer en une fois des articles déjà dans l’atelier, <b>non rattachés à un dossier</b> (stock libre).
                        <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                            <li>Téléchargez le modèle (listes déroulantes et mode d’emploi inclus).</li>
                            <li>Une ligne par article : catégorie, fournisseur, référence, coloris, laize, quantité, unité, emplacement.</li>
                            <li>Importez-le : un aperçu signale les erreurs avant de créer quoi que ce soit.</li>
                        </ol>
                    </Card>
                    <Card
                        icon={<RefreshCw size={18} />}
                        title="Mettre à jour le stock existant"
                        actions={<>
                            <ToolbarButton icon={<FileSpreadsheet size={15} />} onClick={() => exportStockForUpdate(exportItems)}>Exporter le stock ({exportItems.length})</ToolbarButton>
                            <ToolbarButton primary icon={<Upload size={15} />} disabled={busy} onClick={() => pickFile('update')}>{busy && kind === 'update' ? 'Lecture…' : 'Importer le fichier modifié'}</ToolbarButton>
                        </>}
                    >
                        Inventaire, déstockage ou rangement : exportez le stock affiché, remplissez les <b>colonnes jaunes</b>
                        (nouvelle quantité, nouvel emplacement) <b>seulement</b> pour ce qui change, puis réimportez.
                        <div style={{ marginTop: 8, color: MUTED }}>Case vide = pas de changement · quantité plus haute = ajustement d’inventaire · si le stock a bougé entre-temps, seul l’écart saisi est appliqué.</div>
                    </Card>
                </div>
            )}

            {step === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <TonePill tone={1}>{counts.ok} prête{counts.ok > 1 ? 's' : ''}</TonePill>
                        {counts.warn > 0 && <span style={{ background: 'var(--df-amber-bg)', color: 'var(--df-warn-text)', borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{counts.warn} à vérifier</span>}
                        {counts.err > 0 && <span style={{ background: 'var(--df-danger-border)', color: 'var(--df-danger-text)', borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{counts.err} en erreur (non importée{counts.err > 1 ? 's' : ''})</span>}
                        <span style={{ flex: 1 }} />
                        {(counts.warn > 0 || counts.err > 0) && (
                            <label style={{ fontSize: 13, color: 'var(--df-text-2)', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Seulement les lignes à vérifier
                            </label>
                        )}
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--df-border)', borderRadius: 8 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...th, width: 34 }}><input type="checkbox" checked={!!selectable.length && nChecked === selectable.length} onChange={toggleAll} title="Tout cocher / décocher" /></th>
                                    <th style={{ ...th, width: 54 }}>Ligne</th>
                                    {kind === 'add' ? <>
                                        <th style={th}>Catégorie</th><th style={th}>Fournisseur</th><th style={th}>Référence</th><th style={th}>Coloris</th>
                                        <th style={{ ...th, textAlign: 'right' }}>Laize</th><th style={{ ...th, textAlign: 'right' }}>Quantité</th><th style={th}>Emplacement</th>
                                    </> : <>
                                        <th style={th}>Article</th><th style={th}>Affectation</th><th style={{ ...th, textAlign: 'right' }}>Quantité</th><th style={th}>Emplacement</th>
                                    </>}
                                    <th style={{ ...th, width: 280 }}>Contrôle</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map(l => {
                                    const bad = l.errors.length > 0;
                                    const rowStyle = bad ? { background: 'var(--df-danger-bg)' } : !checked.has(l.key) ? { opacity: 0.55 } : undefined;
                                    return (
                                        <tr key={l.key} style={rowStyle}>
                                            <td style={td}><input type="checkbox" disabled={bad} checked={!bad && checked.has(l.key)} onChange={() => toggle(l.key)} /></td>
                                            <td style={{ ...td, color: MUTED, whiteSpace: 'nowrap' }}>{l.where || l.row}</td>
                                            {kind === 'add' ? <>
                                                <td style={td}>{l.data.category}</td>
                                                <td style={td}>{l.data.fournisseur || <span style={{ color: 'var(--df-border-strong)' }}>—</span>}</td>
                                                <td style={td}>{l.data.ref || <span style={{ color: 'var(--df-border-strong)' }}>—</span>}</td>
                                                <td style={td}>{l.data.coloris || <span style={{ color: 'var(--df-border-strong)' }}>—</span>}</td>
                                                <td style={{ ...td, textAlign: 'right' }}>{fmt(l.data.laize)}</td>
                                                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    {fmt(l.data.qty)} {l.data.unit || ''}
                                                    {l.data.pieces?.length > 0 && <div style={{ fontSize: 11, color: MUTED }}>{l.data.pieces.length} pièce{l.data.pieces.length > 1 ? 's' : ''}</div>}
                                                </td>
                                                <td style={td}>{l.data.location || <span style={{ color: 'var(--df-border-strong)' }}>—</span>}</td>
                                            </> : <>
                                                <td style={td}>
                                                    {[l.item.fournisseur, l.item.ref || l.item.product, l.item.coloris].filter(Boolean).join(' · ') || l.item.product || l.item.id}
                                                </td>
                                                <td style={{ ...td, color: l.item.project ? 'var(--df-text)' : MUTED }}>{l.item.project || 'Stock libre'}</td>
                                                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    {l.delta ? <>
                                                        {fmt(l.item.qty)} → <b>{fmt(l.newQty)}</b> {l.item.unit || ''}
                                                        <div style={{ fontSize: 11, color: l.delta < 0 ? 'var(--df-danger-text)' : 'var(--df-x-15803D)' }}>{l.delta > 0 ? '+' : ''}{fmt(l.delta)} ({l.delta < 0 ? 'sortie' : 'ajustement +'})</div>
                                                    </> : <span style={{ color: MUTED }}>{fmt(l.item.qty)} {l.item.unit || ''}</span>}
                                                </td>
                                                <td style={td}>
                                                    {l.locChanged ? <>{l.item.location || '—'} → <b>{l.newLocation}</b></> : <span style={{ color: MUTED }}>{l.item.location || '—'}</span>}
                                                </td>
                                            </>}
                                            <td style={td}><Status line={l} /><Messages line={l} /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {step === 'done' && result && (
                <div style={{ fontSize: 14, color: 'var(--df-text-2)', lineHeight: 1.6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, color: 'var(--df-text)', marginBottom: 8 }}>
                        {result.failed?.length ? <AlertTriangle size={20} color="var(--df-x-B45309)" /> : <CheckCircle2 size={20} color="var(--df-x-15803D)" />}
                        {kind === 'add'
                            ? `${result.done} article${result.done > 1 ? 's' : ''} ajouté${result.done > 1 ? 's' : ''} au stock (stock libre).`
                            : `${result.done} changement${result.done > 1 ? 's' : ''} appliqué${result.done > 1 ? 's' : ''}.`}
                    </div>
                    {kind === 'add' && <div style={{ color: MUTED }}>Chaque article figure au journal avec le motif « {ANCIEN_STOCK_REASON} ».</div>}
                    {result.failed?.length > 0 && (
                        <div style={{ marginTop: 12, background: 'var(--df-danger-bg)', border: '1px solid #FCA5A5', color: 'var(--df-danger-text)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                            {result.failed.length} échec{result.failed.length > 1 ? 's' : ''} :
                            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                                {result.failed.slice(0, 20).map((f, i) => (
                                    <li key={i}>{f.line ? `Ligne ${f.line.where || f.line.row}` : f.from ? `Lignes ${f.from} à ${f.to}` : 'Enregistrement'} — {f.error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </DaDialog>
    );
}
