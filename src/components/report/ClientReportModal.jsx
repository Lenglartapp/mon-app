import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { ArrowUp, ArrowDown, X, Download, ChevronDown, Check, Save, ArrowLeft, Trash2 } from 'lucide-react';
import DaDialog from '../ui/DaDialog';
import { ChoicePill } from '../ui/DaForm';
import { ToolbarButton } from '../ui/ToolbarControls';
import FitPanel from '../ui/FitPanel';
import ClientReportDocument from './ClientReportDocument';
import { useAuth } from '../../auth';
import { printReport, reportFileName, PRINT_CSS } from '../../lib/reports/exportPdf';
import { compressAndUpload } from '../../lib/utils/imageUpload';
import {
    listReports, getReport, createReport, updateReportComment, deleteReport, nextReportNumber,
    getReportSettings, saveReportSettings, isMissingTable,
} from '../../lib/reports/clientReportsDb';
import {
    GROUP_FIELDS, fieldLabel, POSE_STATUSES, DEFAULT_STATUS_LABELS,
    groupRows, filterRows, distinctValues, FILTER_FIELDS, filterValue,
} from '../../lib/reports/clientReport';

// Module « Rapport client » (Suivi de projet) : réglages à gauche, aperçu éditable à droite,
// PDF par l'impression du navigateur, historique des rapports émis (numérotés par projet).
// En base : client_reports (rapports figés) et client_report_settings (libellés de statuts
// communs à tous les projets, photo de couverture de chaque projet).

// Champs figés dans un rapport archivé (ce qui sert au rendu, rien d'autre).
const SNAP_FIELDS = ['id', 'zone', 'piece', 'fenetre', 'produit', 'statut_pose', 'photos_sur_site', 'commentaire_client'];
const snapRow = (r) => Object.fromEntries(SNAP_FIELDS.map((k) => [k, r[k] ?? null]));

const FIELD_PLURAL = { zone: 'zones', piece: 'pièces', fenetre: 'fenêtres', produit: 'produits', statut: 'statuts' };
const FILTER_LABEL = { statut: 'Statut de pose' };
const fmtDateTime = (d) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const sectionTitle = (t) => <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '22px 0 10px' }}>{t}</div>;
const smallBtn = { border: '1px solid #E0DED9', background: 'white', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#374151', padding: 0 };
const checkBox = (on) => (
    <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${on ? '#1E2447' : '#C9C7C2'}`, background: on ? '#1E2447' : 'white' }}>
        {on && <Check size={11} color="white" strokeWidth={3} />}
    </span>
);

// Menu déroulant à cases : tout est coché par défaut ; on décoche ce qu'on exclut.
function CheckMenu({ field, options, excluded, onChange, display = (v) => v }) {
    const [open, setOpen] = useState(false);
    const values = options.map((o) => o.value);
    const off = excluded.filter((v) => values.includes(v));
    const nOn = values.length - off.length;
    const all = field === 'statut' ? 'Tous les statuts' : `Toutes les ${FIELD_PLURAL[field]}`;
    const label = off.length === 0 ? all : `${nOn} ${FIELD_PLURAL[field]} sur ${values.length}`;
    const toggle = (v) => onChange(excluded.includes(v) ? excluded.filter((x) => x !== v) : [...excluded, v]);
    return (
        <div style={{ position: 'relative', marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{FILTER_LABEL[field] || fieldLabel(field)}</div>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                style={{ width: '100%', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', border: '1px solid #E0DED9', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: off.length ? '#1E2447' : '#111827', fontWeight: off.length ? 600 : 400 }}
            >
                {label} <ChevronDown size={14} color="#6B7280" />
            </button>
            {open && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1400 }} onClick={() => setOpen(false)} />
                    <FitPanel style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.12)', border: '1px solid #E0DED9', zIndex: 1401, padding: 4, maxHeight: 320, overflowY: 'auto' }}>
                        <div style={{ display: 'flex', gap: 12, padding: '6px 10px 8px', borderBottom: '1px solid #F0EFEC', marginBottom: 4 }}>
                            <button type="button" onClick={() => onChange(excluded.filter((v) => !values.includes(v)))} style={{ border: 'none', background: 'none', color: '#1E2447', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Tout cocher</button>
                            <button type="button" onClick={() => onChange([...new Set([...excluded, ...values])])} style={{ border: 'none', background: 'none', color: '#6B7280', fontSize: 12, cursor: 'pointer', padding: 0 }}>Tout décocher</button>
                        </div>
                        {options.map((o) => {
                            const on = !excluded.includes(o.value);
                            return (
                                <div key={o.value} onClick={() => toggle(o.value)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#111827', background: on ? 'transparent' : '#FAFAF9' }}>
                                    {checkBox(on)}
                                    <span style={{ flex: 1, color: on ? '#111827' : '#9B9A97' }}>{display(o.value)}</span>
                                    <span style={{ fontSize: 11, color: '#9B9A97' }}>{o.count}</span>
                                </div>
                            );
                        })}
                    </FitPanel>
                </>
            )}
        </div>
    );
}

// Rapport figé rendu pour l'impression (masqué à l'écran), puis « Enregistrer au format PDF ».
function PrintPortal({ doc, onDone }) {
    const ref = React.useRef(null);
    useEffect(() => {
        let alive = true;
        // Laisse la mise en page (mesure → pagination) se stabiliser avant d'imprimer.
        const t = setTimeout(async () => {
            try { await printReport(ref.current, reportFileName(doc.project?.name, doc.date)); }
            catch (e) { console.error('Impression rapport', e); }
            if (alive) onDone();
        }, 300);
        return () => { alive = false; clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return ReactDOM.createPortal(
        <div id="df-report-print" ref={ref}>
            <style>{PRINT_CSS}</style>
            <ClientReportDocument {...doc} editable={false} />
        </div>,
        document.body,
    );
}

const PREVIEW_CSS = `
    .df-report-edit:hover { border-color: #C9D8F5 !important; background: #F7F9FE !important; }
    .df-report-edit:focus { outline: none; border-color: #1E2447 !important; background: white !important; }
    .df-report-preview .df-report-page { margin: 0 auto 18px; box-shadow: 0 1px 3px rgba(17,24,39,.08), 0 8px 24px rgba(17,24,39,.06); }
`;


export default function ClientReportModal({ open, onClose, project, rows = [] }) {
    const { currentUser } = useAuth();
    const [tab, setTab] = useState('edit'); // 'edit' | 'history'
    const [viewing, setViewing] = useState(null); // rapport archivé ouvert
    const [levels, setLevels] = useState(['zone', 'piece']);
    const [excluded, setExcluded] = useState({});
    const [photos, setPhotos] = useState(true);
    const [showProgress, setShowProgress] = useState(true);
    const [photoModes, setPhotoModes] = useState({}); // { rowId: 'all' | 'one' | 'none' }
    const [mainPhotos, setMainPhotos] = useState({}); // { rowId: photoId }
    const [showNext, setShowNext] = useState(false);
    const [annex, setAnnex] = useState(false); // annexe : photos en grand, légendées
    const [statusLabels, setStatusLabels] = useState(DEFAULT_STATUS_LABELS);
    const [texts, setTexts] = useState({});
    const [history, setHistory] = useState([]); // rapports émis (sans contenu)
    const [nextNumber, setNextNumber] = useState(null);
    const [dbError, setDbError] = useState('');
    const [busy, setBusy] = useState(false);
    const [exportDoc, setExportDoc] = useState(null); // rapport en cours d'impression
    // Photo de couverture propre au projet (choisie à la main ; aucune = page de garde blanche).
    const [coverUrl, setCoverUrl] = useState(null);
    const [coverBusy, setCoverBusy] = useState(false);
    const coverInput = React.useRef(null);
    const projectId = project?.id;

    const reportDbError = (e) => setDbError(isMissingTable(e)
        ? "Les tables du rapport client n'existent pas encore en base : lancer la migration 2026-10-11_client_reports.sql."
        : `Erreur base : ${e.message || e}`);
    const reloadHistory = async () => {
        try {
            const [list, n] = await Promise.all([listReports(projectId), nextReportNumber(projectId)]);
            setHistory(list); setNextNumber(n); setDbError('');
        } catch (e) { reportDbError(e); }
    };
    useEffect(() => {
        if (!projectId) return;
        reloadHistory();
        getReportSettings(['global', projectId]).then((st) => {
            if (st.global?.status_labels) setStatusLabels({ ...DEFAULT_STATUS_LABELS, ...st.global.status_labels });
            setCoverUrl(st[projectId]?.cover_url || null);
        }).catch(reportDbError);
    }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const saveCover = async (url) => {
        const prev = coverUrl;
        setCoverUrl(url);
        try { await saveReportSettings(projectId, { cover_url: url }); }
        catch (e) { setCoverUrl(prev); reportDbError(e); }
    };
    const onCoverFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setCoverBusy(true);
        try { saveCover(await compressAndUpload(file, 'reports', { maxPx: 2200, quality: 0.85 })); }
        catch (err) { alert(`La photo n'a pas pu être envoyée : ${err.message}`); }
        finally { setCoverBusy(false); }
    };
    const cover = useMemo(() => ({ pick: () => coverInput.current?.click(), remove: () => saveCover(null), busy: coverBusy }), [coverBusy, coverUrl]); // eslint-disable-line react-hooks/exhaustive-deps
    const [flash, setFlash] = useState('');

    const setText = (key, v) => setTexts((t) => ({ ...t, [key]: v }));
    const setLabel = (s, v) => setStatusLabels((l) => ({ ...l, [s]: v }));
    // Libellés communs à tous les projets : enregistrés quand on quitte le champ.
    const saveLabels = () => saveReportSettings('global', { status_labels: statusLabels }).catch(reportDbError);
    const setFieldExcluded = (f, list) => setExcluded((e) => ({ ...e, [f]: list }));

    const setRowPhoto = (rowId, { mode, main }) => {
        if (mode) setPhotoModes((m) => ({ ...m, [rowId]: mode }));
        if (main != null) { setMainPhotos((m) => ({ ...m, [rowId]: main })); setPhotoModes((m) => ({ ...m, [rowId]: m[rowId] === 'none' ? 'all' : (m[rowId] || 'all') })); }
    };
    const kept = useMemo(() => filterRows(rows, { excluded }), [rows, excluded]);
    const tree = useMemo(() => groupRows(kept, levels), [kept, levels]);
    // Options en cascade : les valeurs encore possibles compte tenu des AUTRES filtres.
    const optionsFor = (f) => {
        const base = filterRows(rows, { excluded }, f);
        const counts = new Map();
        base.forEach((r) => counts.set(filterValue(r, f), (counts.get(filterValue(r, f)) || 0) + 1));
        return distinctValues(base, f).map((v) => ({ value: v, count: counts.get(v) }));
    };
    const settings = { photos, statusLabels, showNext, showProgress, photoModes, mainPhotos, coverUrl, annex };
    const me = currentUser?.name || currentUser?.displayName || '';
    const now = useMemo(() => new Date().toISOString(), []);
    const docProps = { project, rows: kept, tree, levels, settings, texts, setText, setRowPhoto, cover, date: now, reportNumber: nextNumber, author: me };

    const move = (i, d) => setLevels((l) => { const n = [...l]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
    const unused = GROUP_FIELDS.filter((f) => !levels.includes(f.key));

    // Historique (en base) : commentaire libre, suppression, réouverture.
    const setEntryComment = async (id, comment) => {
        setHistory((h) => h.map((e) => (e.id === id ? { ...e, comment } : e)));
        try { await updateReportComment(id, comment); } catch (e) { reportDbError(e); }
    };
    const removeEntry = async (e) => {
        if (!window.confirm(`Supprimer le rapport n° ${e.number} du ${fmtDateTime(e.date)} de l'historique ?`)) return;
        try { await deleteReport(e.id); await reloadHistory(); } catch (err) { reportDbError(err); }
    };
    const loadFull = async (e) => (e.rows ? e : getReport(e.id));

    // Archive le rapport tel qu'il est (lignes figées) avec le numéro suivant du projet.
    const archive = async () => {
        setBusy(true);
        try {
            const entry = await createReport({
                projectId, author: me || '—', levels, settings, texts,
                project: { name: project?.name, location: project?.location, manager: project?.manager },
                rows: kept.map(snapRow),
            });
            await reloadHistory();
            setFlash(`Rapport n° ${entry.number} archivé le ${fmtDateTime(entry.date)}`);
            return entry;
        } catch (e) { reportDbError(e); return null; }
        finally { setBusy(false); }
    };
    const entryDoc = (e) => ({
        project: e.project, rows: e.rows, tree: groupRows(e.rows, e.levels), levels: e.levels,
        settings: e.settings, texts: e.texts, setText: () => {}, date: e.date,
        reportNumber: e.number, author: e.author,
    });
    const downloadEntry = async (e) => {
        try { setExportDoc(entryDoc(await loadFull(e))); } catch (err) { reportDbError(err); }
    };
    const openEntry = async (e) => {
        try { setViewing(await loadFull(e)); } catch (err) { reportDbError(err); }
    };
    const archiveAndPrint = async () => { const entry = await archive(); if (entry) setExportDoc(entryDoc(entry)); };
    const reuse = (e) => {
        setLevels(e.levels); setPhotos(!!e.settings.photos); setShowNext(!!e.settings.showNext);
        setShowProgress(e.settings.showProgress !== false); setAnnex(!!e.settings.annex);
        setPhotoModes(e.settings.photoModes || {}); setMainPhotos(e.settings.mainPhotos || {});
        setTexts(Object.fromEntries(Object.entries(e.texts || {}).filter(([k]) => !k.startsWith('row:'))));
        setViewing(null); setTab('edit');
    };
    useEffect(() => { if (!flash) return undefined; const t = setTimeout(() => setFlash(''), 4000); return () => clearTimeout(t); }, [flash]);

    const tabs = (
        <div style={{ display: 'flex', gap: 6 }}>
            <ChoicePill active={tab === 'edit'} onClick={() => { setTab('edit'); setViewing(null); }}>Nouveau rapport</ChoicePill>
            <ChoicePill active={tab === 'history'} onClick={() => setTab('history')}>Historique ({history.length})</ChoicePill>
        </div>
    );

    const footer = tab === 'edit' ? (
        <>
            <span style={{ fontSize: 12, color: dbError ? '#B42318' : flash ? '#1E2447' : '#6B7280', fontWeight: flash || dbError ? 600 : 400 }}>
                {dbError || flash || `${kept.length} ouvrage${kept.length > 1 ? 's' : ''} · ${tree.length} section${tree.length > 1 ? 's' : ''}`}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <ToolbarButton onClick={onClose}>Fermer</ToolbarButton>
                <ToolbarButton icon={<Save size={16} />} onClick={archive} disabled={!kept.length || busy}>Archiver</ToolbarButton>
                <ToolbarButton primary icon={<Download size={16} />} onClick={archiveAndPrint} disabled={!kept.length || busy || !!exportDoc}>
                    {busy || exportDoc ? 'Préparation…' : 'Archiver et enregistrer en PDF'}
                </ToolbarButton>
            </div>
        </>
    ) : viewing ? (
        <>
            <span style={{ fontSize: 12, color: '#6B7280' }}>Rapport n° {viewing.number} figé du {fmtDateTime(viewing.date)} · {viewing.author}{viewing.comment ? ` · « ${viewing.comment} »` : ''}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <ToolbarButton icon={<ArrowLeft size={16} />} onClick={() => setViewing(null)}>Retour à l'historique</ToolbarButton>
                <ToolbarButton onClick={() => reuse(viewing)}>Repartir de ce rapport</ToolbarButton>
                <ToolbarButton primary icon={<Download size={16} />} onClick={() => downloadEntry(viewing)} disabled={!!exportDoc}>{exportDoc ? 'Préparation…' : 'Enregistrer en PDF'}</ToolbarButton>
            </div>
        </>
    ) : (
        <div style={{ marginLeft: 'auto' }}><ToolbarButton onClick={onClose}>Fermer</ToolbarButton></div>
    );

    return (
        <DaDialog
            open={open}
            // Échap / clic à côté ne ferment pas : on perdrait les textes saisis. Croix ou « Fermer » seulement.
            onClose={(e, reason) => { if (!reason) onClose(); }}
            title="Rapport client"
            subtitle={project?.name || ''}
            tabs={tabs}
            maxWidth="xl"
            height="94vh"
            bodyPadding="0"
            footer={footer}
        >
            <style>{PREVIEW_CSS}</style>
            <input ref={coverInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={onCoverFile} />

            {tab === 'edit' && (
                <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
                    {/* Réglages */}
                    <div style={{ width: 330, flexShrink: 0, borderRight: '1px solid #E8E6E2', overflowY: 'auto', padding: '4px 22px 24px', fontFamily: 'Roboto, system-ui, sans-serif' }}>
                        {sectionTitle('Structure du rapport')}
                        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Regroupements, dans l'ordre. Le 1er niveau fait le sommaire.</div>
                        {levels.map((k, i) => (
                            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: '1px solid #E0DED9', borderRadius: 8, marginBottom: 6, background: 'white' }}>
                                <span style={{ fontSize: 12, color: '#9B9A97', width: 14 }}>{i + 1}</span>
                                <span style={{ flex: 1, fontSize: 13, color: '#111827' }}>{fieldLabel(k)}</span>
                                <button type="button" style={{ ...smallBtn, opacity: i === 0 ? 0.35 : 1 }} disabled={i === 0} onClick={() => move(i, -1)} title="Monter"><ArrowUp size={14} /></button>
                                <button type="button" style={{ ...smallBtn, opacity: i === levels.length - 1 ? 0.35 : 1 }} disabled={i === levels.length - 1} onClick={() => move(i, 1)} title="Descendre"><ArrowDown size={14} /></button>
                                <button type="button" style={{ ...smallBtn, opacity: levels.length === 1 ? 0.35 : 1 }} disabled={levels.length === 1} onClick={() => setLevels((l) => l.filter((x) => x !== k))} title="Retirer"><X size={14} /></button>
                            </div>
                        ))}
                        {unused.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                {unused.map((f) => <ChoicePill key={f.key} onClick={() => setLevels((l) => [...l, f.key])}>+ {f.label}</ChoicePill>)}
                            </div>
                        )}

                        {sectionTitle('Ouvrages inclus')}
                        {FILTER_FIELDS.map((f) => (
                            <CheckMenu key={f} field={f} options={optionsFor(f)} excluded={excluded[f] || []} onChange={(list) => setFieldExcluded(f, list)}
                                display={f === 'statut' ? (v) => (statusLabels[v] && statusLabels[v] !== v ? `${statusLabels[v]} (${v})` : v) : undefined} />
                        ))}

                        {sectionTitle('Affichage')}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <ChoicePill active={photos} onClick={() => setPhotos((v) => !v)}>Photos</ChoicePill>
                            <ChoicePill active={showProgress} onClick={() => setShowProgress((v) => !v)}>Barres d'avancement</ChoicePill>
                            <ChoicePill active={showNext} onClick={() => setShowNext((v) => !v)}>Page « Prochaines étapes »</ChoicePill>
                            <ChoicePill active={annex && photos} onClick={() => setAnnex((v) => !v)}>Annexe photos en grand</ChoicePill>
                        </div>

                        {sectionTitle('Statuts affichés au client (pose)')}
                        {POSE_STATUSES.map((s) => (
                            <div key={s} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ fontSize: 12, color: '#6B7280' }}>{s}</span>
                                <input
                                    value={statusLabels[s] || ''}
                                    onChange={(e) => setLabel(s, e.target.value)}
                                    onBlur={saveLabels}
                                    style={{ height: 32, border: '1px solid #E0DED9', borderRadius: 8, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', color: '#111827' }}
                                />
                            </div>
                        ))}
                        <div style={{ fontSize: 12, color: '#9B9A97', marginTop: 10, lineHeight: 1.5 }}>
                            Dans l'aperçu : cliquez pour écrire l'introduction, une note par section et les commentaires des ouvrages. Sous chaque photo, choisissez « Toutes », « 1 photo » ou « Aucune » ; cliquez une vignette pour en faire la photo principale.
                        </div>
                    </div>

                    {/* Aperçu */}
                    <div className="df-report-preview" style={{ flex: 1, minWidth: 0, overflow: 'auto', background: '#F4F4F4', padding: '24px 20px' }}>
                        {kept.length
                            ? <ClientReportDocument {...docProps} editable />
                            : <div style={{ textAlign: 'center', color: '#6B7280', marginTop: 80 }}>Aucun ouvrage ne correspond aux filtres.</div>}
                    </div>
                </div>
            )}

            {tab === 'history' && !viewing && (
                <div style={{ padding: '20px 28px', fontFamily: 'Roboto, system-ui, sans-serif' }}>
                    {dbError && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#FEF3F2', color: '#B42318', fontSize: 13 }}>{dbError}</div>}
                    {history.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#6B7280', marginTop: 60, fontSize: 14 }}>
                            Aucun rapport archivé pour ce projet.<br />
                            <span style={{ fontSize: 12, color: '#9B9A97' }}>« Archiver » ou « Archiver et enregistrer en PDF » enregistre le rapport ici, daté, tel qu'il a été envoyé.</span>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>
                                    {['N°', 'Date', 'Auteur', 'Commentaire', 'Ouvrages', ''].map((h) => (
                                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#374151', borderBottom: '1px solid #E0DED9', background: '#F4F4F4' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((e) => (
                                    <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => openEntry(e)}>
                                        <td style={{ padding: '12px', borderBottom: '1px solid #E8E6E2', color: '#6B7280' }}>{e.number}</td>
                                        <td style={{ padding: '12px', borderBottom: '1px solid #E8E6E2', fontWeight: 500, color: '#111827' }}>{fmtDateTime(e.date)}</td>
                                        <td style={{ padding: '12px', borderBottom: '1px solid #E8E6E2', color: '#374151' }}>{e.author}</td>
                                        <td style={{ padding: '6px 12px', borderBottom: '1px solid #E8E6E2', minWidth: 240 }} onClick={(ev) => ev.stopPropagation()}>
                                            <input
                                                defaultValue={e.comment || ''}
                                                placeholder="Ajouter un commentaire…"
                                                onBlur={(ev) => { if (ev.target.value !== (e.comment || '')) setEntryComment(e.id, ev.target.value); }}
                                                onKeyDown={(ev) => { if (ev.key === 'Enter') ev.currentTarget.blur(); }}
                                                style={{ width: '100%', height: 32, border: '1px solid transparent', borderRadius: 6, padding: '0 8px', fontSize: 13, fontFamily: 'inherit', color: '#111827', background: 'transparent' }}
                                                onFocus={(ev) => { ev.target.style.borderColor = '#1E2447'; ev.target.style.background = 'white'; }}
                                                onBlurCapture={(ev) => { ev.target.style.borderColor = 'transparent'; ev.target.style.background = 'transparent'; }}
                                            />
                                        </td>
                                        <td style={{ padding: '12px', borderBottom: '1px solid #E8E6E2', color: '#374151' }}>{e.rowCount}</td>
                                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #E8E6E2', textAlign: 'right' }} onClick={(ev) => ev.stopPropagation()}>
                                            <div style={{ display: 'inline-flex', gap: 6 }}>
                                                <ToolbarButton onClick={() => openEntry(e)}>Ouvrir</ToolbarButton>
                                                <ToolbarButton icon={<Download size={15} />} onClick={() => downloadEntry(e)} disabled={!!exportDoc}>PDF</ToolbarButton>
                                                <ToolbarButton icon={<Trash2 size={15} />} onClick={() => removeEntry(e)} title="Supprimer de l'historique" />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {tab === 'history' && viewing && (
                <div className="df-report-preview" style={{ height: '100%', overflow: 'auto', background: '#F4F4F4', padding: '24px 20px' }}>
                    <ClientReportDocument {...entryDoc(viewing)} editable={false} />
                </div>
            )}

            {exportDoc && <PrintPortal doc={exportDoc} onDone={() => setExportDoc(null)} />}
        </DaDialog>
    );
}
