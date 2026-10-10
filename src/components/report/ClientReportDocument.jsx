import React, { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    clientStatus, fieldLabel, itemTitle, progressOf, rowPhotos,
} from '../../lib/reports/clientReport';

// Document « Rapport client », découpé en VRAIES pages A4 : chaque bloc (titre, note,
// ouvrage…) est mesuré puis rangé page par page. L'aperçu montre donc exactement les pages
// du PDF, ce qui permet les numéros de page en pied et dans le sommaire.
//
// Pages : garde (sans pied) · synthèse + sommaire (sans pied) · sections (pied : logo + n° page).
// Modes de rendu d'un bloc : 'edit' (aperçu, textes modifiables), 'static' (PDF),
// 'measure' (mesure : comme le PDF, placeholders compris pour réserver la place).

const NAVY = '#1E2447';
const INK = '#111827';
const MUTED = '#6B7280';
const LINE = '#E8E6E2';
const FONT = 'Roboto, system-ui, -apple-system, "Segoe UI", sans-serif';
// Logos (dossier public) : complet « LENGLART — Ateliers d'exception » pour la page de garde,
// monogramme « L » pour le pied de page.
export const LOGO_FULL_URL = '/Logo_lenglart_noir.png';
export const LOGO_ICON_URL = '/logo_l_lenglart.png';

// Géométrie A4 (mm) — 1 mm CSS = 96 / 25.4 px.
const PX_PER_MM = 96 / 25.4;
const PAGE_W = 210;
const PAGE_H = 297;
const PAD_X = 16;
const PAD_TOP = 18;
const PAD_BOTTOM = 24; // réserve du pied de page
const CONTENT_H_PX = (PAGE_H - PAD_TOP - PAD_BOTTOM) * PX_PER_MM;

const ReportCtx = createContext({ showProgress: true, setRowPhoto: () => {}, onImgLoad: () => {}, cover: null });

const STATUS_STYLE = {
    done: { background: NAVY, color: 'white', border: `1px solid ${NAVY}` },
    progress: { background: '#E6EEFB', color: '#1E3A8A', border: '1px solid #C9D8F5' },
    todo: { background: 'white', color: MUTED, border: '1px solid #D9D7D2' },
    none: { background: '#F4F4F4', color: MUTED, border: '1px solid #F4F4F4' },
};

export function StatusPill({ status }) {
    return (
        <span style={{ ...STATUS_STYLE[status.key], display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {status.label}
        </span>
    );
}

// Logo (variant 'full' ou 'icon') ; si le fichier manque, le nom en capitales.
export function Logo({ height = 26, variant = 'full' }) {
    const [failed, setFailed] = useState(false);
    if (failed) return <span style={{ fontSize: height * 0.55, letterSpacing: '0.32em', fontWeight: 500, color: INK }}>LENGLART</span>;
    return <img src={variant === 'icon' ? LOGO_ICON_URL : LOGO_FULL_URL} alt="Lenglart" onError={() => setFailed(true)} style={{ height, width: 'auto', display: 'block' }} />;
}

// Bloc de texte : zone de saisie (aperçu), texte simple (PDF), ou réserve de place (mesure).
function EditableText({ value, onChange, placeholder, mode, style }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        // scrollHeight inclut le padding (2 × 4 px) : la hauteur (content-box) l'en retire, pour
        // occuper exactement la place du texte imprimé — sinon la pagination déborde.
        if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight - 8}px`; }
    }, [value, mode]);
    if (mode === 'static') return value?.trim() ? <div style={{ ...style, whiteSpace: 'pre-wrap' }}>{value}</div> : null;
    if (mode === 'measure') return <div style={{ ...style, whiteSpace: 'pre-wrap' }}>{value?.trim() ? value : placeholder}</div>;
    return (
        <textarea
            ref={ref}
            className="df-report-edit"
            rows={1}
            value={value || ''}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...style, display: 'block', width: '100%', resize: 'none', overflow: 'hidden', font: 'inherit', fontSize: style?.fontSize, color: style?.color, lineHeight: style?.lineHeight, background: 'transparent', border: '1px dashed transparent', borderRadius: 6, padding: '4px 6px', margin: '-5px -7px', boxSizing: 'content-box' }}
        />
    );
}

function ProgressBar({ p, width = '100%' }) {
    if (!useContext(ReportCtx).showProgress) return null;
    const pct = (n) => (p.total ? (n / p.total) * 100 : 0);
    return (
        <div style={{ width, height: 6, borderRadius: 99, background: '#EFEEEA', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${pct(p.done)}%`, background: NAVY }} />
            <div style={{ width: `${pct(p.progress)}%`, background: '#9DB6E8' }} />
        </div>
    );
}
const progressText = (p) => (p.total ? `${p.done} / ${p.total} installé${p.done > 1 ? 's' : ''}` : 'Livraison');
function ProgressText({ p, style, suffix = '' }) {
    if (!useContext(ReportCtx).showProgress) return null;
    return <span style={style}>{progressText(p)}{suffix}</span>;
}

const COVER_BTN = { border: '1px solid #E0DED9', background: 'rgba(255,255,255,0.95)', color: '#111827', borderRadius: 99, fontSize: 11.5, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,.15)' };

const fmtShort = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
// Légende d'une photo : date d'envoi dans Droit-fil (en pratique le jour de la prise de vue) et auteur.
const photoCaption = (p) => [p?.timestamp && `Photo du ${fmtShort(p.timestamp)}`, p?.user].filter(Boolean).join(' · ');
const reportLabel = (n) => (n ? `Rapport n° ${n}` : 'Rapport');

export const DEFAULT_MENTIONS = "Ce rapport a été établi par Lenglart à partir des constats et des photographies réalisés sur site, aux dates indiquées sous chaque photo. Merci de nous faire part par écrit de toute remarque ou réserve dans les 8 jours suivant sa réception.";

const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const H1 = ({ children, number }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: `1px solid ${INK}`, paddingBottom: 8, marginBottom: 14 }}>
        {number && <span style={{ fontSize: 14, color: MUTED }}>{number}</span>}
        <span style={{ fontSize: 24, fontWeight: 300, color: INK }}>{children}</span>
    </div>
);

// --- Page ------------------------------------------------------------------

function Page({ children, footer, number, total, projectName, reportNumber }) {
    return (
        <section className="df-report-page" style={{ position: 'relative', width: `${PAGE_W}mm`, height: `${PAGE_H}mm`, background: 'white', boxSizing: 'border-box', padding: `${PAD_TOP}mm ${PAD_X}mm ${PAD_BOTTOM}mm`, overflow: 'hidden' }}>
            {children}
            {footer && (
                <div style={{ position: 'absolute', left: `${PAD_X}mm`, right: `${PAD_X}mm`, bottom: '9mm', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${LINE}`, paddingTop: '3mm' }}>
                    <Logo variant="icon" height={18} />
                    <span style={{ fontSize: 9.5, color: MUTED }}>{reportLabel(reportNumber)} · {projectName}</span>
                    <span style={{ fontSize: 9.5, color: MUTED }}>{number} / {total}</span>
                </div>
            )}
        </section>
    );
}

function Cover({ project, rows, coverPhoto, date, editing, reportNumber, author }) {
    const { showProgress, cover } = useContext(ReportCtx);
    const p = progressOf(rows);
    const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Logo height={34} />
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Rapport de suivi</div>
                    <div style={{ fontSize: 13, color: INK, marginTop: 3 }}>N° {reportNumber || '—'}</div>
                </div>
            </div>
            <div style={{ height: 1, background: INK, margin: '10px 0 0' }} />
            <div style={{ marginTop: '20mm' }}>
                <div style={{ fontSize: 12, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Projet</div>
                <div style={{ fontSize: 34, fontWeight: 300, color: INK, lineHeight: 1.15, marginTop: 6 }}>{project?.name}</div>
                {project?.location && <div style={{ fontSize: 14, color: MUTED, marginTop: 10 }}>{project.location}</div>}
            </div>
            {/* Photo de couverture choisie pour le projet ; sans photo, l'espace reste blanc. */}
            {coverPhoto ? (
                <div style={{ position: 'relative', marginTop: '12mm', height: '92mm', borderRadius: 4, overflow: 'hidden', background: '#F4F4F4' }}>
                    <img src={coverPhoto} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {editing && cover && (
                        <div style={{ position: 'absolute', right: 8, top: 8, display: 'flex', gap: 6 }}>
                            <button type="button" onClick={cover.pick} style={COVER_BTN}>Changer la photo</button>
                            <button type="button" onClick={cover.remove} style={COVER_BTN}>Retirer</button>
                        </div>
                    )}
                </div>
            ) : editing && cover ? (
                <button type="button" onClick={cover.pick} disabled={cover.busy}
                    style={{ marginTop: '12mm', height: '92mm', width: '100%', border: '1.5px dashed #D9D7D2', borderRadius: 4, background: '#FAFAF9', color: MUTED, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                    {cover.busy ? 'Envoi de la photo…' : '+ Ajouter une photo de couverture (optionnel — sinon la page reste blanche)'}
                </button>
            ) : null}
            <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
                {showProgress ? (
                    <div>
                        <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avancement de la pose</div>
                        <div style={{ fontSize: 30, fontWeight: 300, color: INK, marginTop: 4 }}>{pct} %</div>
                        <div style={{ marginTop: 6 }}><ProgressBar p={p} /></div>
                        <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>{progressText(p)}</div>
                    </div>
                ) : <div />}
                <div>
                    <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date du rapport</div>
                    <div style={{ fontSize: 15, color: INK, marginTop: 8 }}>{fmtDate(date)}</div>
                    {author && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Établi par {author}</div>}
                </div>
                <div>
                    <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Chargé(e) d'affaires</div>
                    <div style={{ fontSize: 15, color: INK, marginTop: 8 }}>{project?.manager || '—'}</div>
                </div>
            </div>
        </div>
    );
}

function ItemBlock({ row, levels, settings, texts, setText, mode }) {
    const { setRowPhoto, onImgLoad } = useContext(ReportCtx);
    const status = clientStatus(row, settings.statusLabels);
    const all = settings.photos ? rowPhotos(row) : [];
    // Choix par ligne : toutes les photos (défaut), une seule, ou aucune ; photo principale au choix.
    const saved = settings.photoModes?.[row.id] || 'all';
    const photoMode = all.length === 1 && saved === 'all' ? 'one' : saved;
    const mainId = settings.mainPhotos?.[row.id];
    const ordered = mainId && all.some((p) => String(p.id) === String(mainId))
        ? [all.find((p) => String(p.id) === String(mainId)), ...all.filter((p) => String(p.id) !== String(mainId))]
        : all;
    const photos = photoMode === 'none' ? [] : photoMode === 'one' ? ordered.slice(0, 1) : ordered;
    const [main, ...others] = photos;
    const commentKey = `row:${row.id}`;
    const comment = texts[commentKey] ?? row.commentaire_client ?? '';
    const editing = mode === 'edit';

    // Choix des photos : pastilles posées PAR-DESSUS l'ouvrage (aperçu seulement), sans
    // prendre de place — la mise en page reste celle du PDF.
    const controls = editing && all.length > 0 && (
        <div className="df-photo-ctrl" style={{ position: 'absolute', left: 4, top: main ? 16 : 10, display: 'flex', gap: 4, zIndex: 2 }}>
            {(all.length > 1
                ? [['all', `Toutes (${all.length})`], ['one', '1 photo'], ['none', 'Aucune']]
                : [['one', 'Photo affichée'], ['none', 'Masquer']]).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setRowPhoto(row.id, { mode: k })}
                    style={{ border: `1px solid ${photoMode === k ? NAVY : '#E0DED9'}`, background: photoMode === k ? NAVY : 'rgba(255,255,255,0.95)', color: photoMode === k ? 'white' : '#374151', borderRadius: 99, fontSize: 10.5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(0,0,0,.12)' }}>
                    {l}
                </button>
            ))}
        </div>
    );

    return (
        <div className="df-report-item" style={{ position: 'relative', display: 'grid', gridTemplateColumns: main ? '62mm 1fr' : '1fr', gap: 14, padding: '12px 0', borderBottom: `1px solid ${LINE}` }}>
            {controls}
            {main && (
                <div>
                    {/* Photo à ses proportions d'origine (ni recadrée, ni déformée), dans 62 × 70 mm max. */}
                    <img src={main.url} alt="" crossOrigin="anonymous" onLoad={onImgLoad}
                        style={{ display: 'block', maxWidth: '100%', maxHeight: '70mm', width: 'auto', height: 'auto', borderRadius: 3 }} />
                    {photoCaption(main) && <div style={{ fontSize: 9.5, color: MUTED, marginTop: 3 }}>{photoCaption(main)}</div>}
                    {others.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                            {others.slice(0, 4).map((p) => (
                                <div key={p.id || p.url} title={editing ? 'Mettre en photo principale' : undefined}
                                    onClick={editing ? () => setRowPhoto(row.id, { main: p.id }) : undefined}
                                    style={{ cursor: editing ? 'pointer' : 'default' }}>
                                    <div style={{ height: '11mm', borderRadius: 2, overflow: 'hidden' }}>
                                        <img src={p.url} alt="" crossOrigin="anonymous" onLoad={onImgLoad} style={{ height: '100%', width: 'auto', display: 'block' }} />
                                    </div>
                                    {p.timestamp && <div style={{ fontSize: 7.5, color: MUTED, marginTop: 1 }}>{fmtShort(p.timestamp)}</div>}
                                </div>
                            ))}
                            {others.length > 4 && <div style={{ fontSize: 10, color: MUTED, alignSelf: 'center' }}>+{others.length - 4}</div>}
                        </div>
                    )}
                </div>
            )}
            <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    {/* Sans photo affichée, les pastilles de choix occupent le début de la ligne : on décale le titre. */}
                    <div style={{ minWidth: 0, paddingLeft: !main && controls ? 150 : 0 }}>
                        <div style={{ fontSize: 14, color: INK, fontWeight: 500 }}>{itemTitle(row, levels)}</div>
                        {!levels.includes('produit') && row.produit && itemTitle(row, levels) !== row.produit && (
                            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{row.produit}</div>
                        )}
                    </div>
                    <StatusPill status={status} />
                </div>
                <div style={{ marginTop: 8 }}>
                    <EditableText mode={mode} value={comment} onChange={(v) => setText(commentKey, v)}
                        placeholder="Commentaire client (optionnel)" style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.55 }} />
                </div>
            </div>
        </div>
    );
}

function SubHeader({ group, depth }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 16, paddingBottom: 6, borderBottom: `1px solid ${depth === 1 ? '#C9C7C1' : LINE}` }}>
            <span style={{ fontSize: depth === 1 ? 16 : 14, fontWeight: 500, color: depth === 1 ? INK : '#374151' }}>
                <span style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 8 }}>{fieldLabel(group.key)}</span>
                {group.value}
            </span>
            <ProgressText p={progressOf(group.rows)} style={{ fontSize: 11.5, color: MUTED }} />
        </div>
    );
}

// --- Blocs -----------------------------------------------------------------
// Chaque bloc : { key, keep (rester avec le suivant), render(mode) }.

function sectionBlocks(group, number, ctx) {
    const { levels, settings, texts, setText } = ctx;
    const out = [
        { key: `h:${group.id}`, keep: true, render: () => <H1 number={number}>{group.value}</H1> },
    ];
    if (settings.showProgress !== false) {
        out.push({ key: `p:${group.id}`, keep: true, render: () => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 10 }}>
                <ProgressBar p={progressOf(group.rows)} width="160px" />
                <ProgressText p={progressOf(group.rows)} style={{ fontSize: 12, color: MUTED }} />
            </div>
        ) });
    }
    out.push({ key: `n:${group.id}`, keep: true, render: (mode) => (
        <div style={{ paddingBottom: mode === 'static' && !texts[`note:${group.id}`]?.trim() ? 0 : 8 }}>
            <EditableText mode={mode} value={texts[`note:${group.id}`]} onChange={(v) => setText(`note:${group.id}`, v)}
                placeholder={`Note sur « ${group.value} » (optionnel)`} style={{ fontSize: 13, color: INK, lineHeight: 1.6 }} />
        </div>
    ) });
    const walk = (g, depth) => {
        if (depth > 0) out.push({ key: `s:${g.id}`, keep: true, render: () => <SubHeader group={g} depth={depth} /> });
        if (g.children.length) g.children.forEach((c) => walk(c, depth + 1));
        else g.rows.forEach((r) => out.push({ key: `i:${g.id}:${r.id}`, render: (mode) => <ItemBlock row={r} levels={levels} settings={settings} texts={texts} setText={setText} mode={mode} /> }));
    };
    walk(group, 0);
    return out;
}

// Annexe : chaque photo des ouvrages du rapport en grand, légendée (ouvrage, lieu, date, auteur).
// Les lignes réglées sur « Aucune » photo en sont exclues.
function annexBlocks(rows, levels, settings) {
    const out = [{ key: 'a:h', keep: true, render: () => <H1>Annexe photographique</H1> }];
    rows.forEach((r) => {
        if ((settings.photoModes?.[r.id] || 'all') === 'none') return;
        rowPhotos(r).forEach((p, i) => {
            const where = ['zone', 'piece', 'fenetre'].map((k) => String(r[k] ?? '').trim()).filter(Boolean).join(' · ');
            out.push({ key: `a:${r.id}:${p.id || i}`, render: () => <AnnexPhoto photo={p} title={[r.produit, where].filter(Boolean).join(' — ')} /> });
        });
    });
    return out.length > 1 ? out : [];
}

function AnnexPhoto({ photo, title }) {
    const { onImgLoad } = useContext(ReportCtx);
    return (
        <figure style={{ margin: 0, padding: '10px 0 14px', borderBottom: `1px solid ${LINE}` }}>
            <img src={photo.url} alt="" crossOrigin="anonymous" onLoad={onImgLoad}
                style={{ display: 'block', maxWidth: '100%', maxHeight: '108mm', width: 'auto', height: 'auto', margin: '0 auto', borderRadius: 3 }} />
            <figcaption style={{ fontSize: 11, color: INK, marginTop: 6, textAlign: 'center' }}>
                {title}{photoCaption(photo) && <span style={{ color: MUTED }}> · {photoCaption(photo)}</span>}
            </figcaption>
        </figure>
    );
}

function closingBlocks(project, texts, setText) {
    return [
        { key: 'c:h', keep: true, render: () => <H1>Prochaines étapes</H1> },
        { key: 'c:t', render: (mode) => (
            <EditableText mode={mode} value={texts.conclusion} onChange={(v) => setText('conclusion', v)}
                placeholder="Planning à venir, points d'attention, éléments attendus du client…" style={{ fontSize: 13, color: INK, lineHeight: 1.6 }} />
        ) },
        { key: 'c:f', render: () => (
            <div style={{ marginTop: 28, paddingTop: 14, borderTop: `1px solid ${LINE}`, fontSize: 12, color: MUTED }}>
                Votre interlocuteur : <span style={{ color: INK }}>{project?.manager || 'Lenglart'}</span>
            </div>
        ) },
    ];
}

/** Range les blocs en pages : un bloc « keep » part avec le suivant (titre jamais seul en bas). */
function paginate(blocks, heights) {
    const pages = [];
    let page = [];
    let used = 0;
    for (let i = 0; i < blocks.length; i++) {
        // Unité insécable : blocs « keep » consécutifs + le bloc qui les suit.
        let j = i;
        while (j < blocks.length - 1 && blocks[j].keep) j++;
        const unitH = blocks.slice(i, j + 1).reduce((s, b) => s + (heights[b.key] || 0), 0);
        if (page.length && used + unitH > CONTENT_H_PX) { pages.push(page); page = []; used = 0; }
        page.push(blocks[i]);
        used += heights[blocks[i].key] || 0;
    }
    if (page.length) pages.push(page);
    return pages;
}

export default function ClientReportDocument({ project, rows, tree, levels, settings, texts, setText, setRowPhoto, cover, editable, date, reportNumber, author }) {
    const mode = editable ? 'edit' : 'static';
    const ctx = { levels, settings, texts, setText };
    const coverPhoto = settings.coverUrl || null;

    // Sections (1 par groupe de 1er niveau, + « Prochaines étapes » si demandée).
    const sections = tree.map((g, i) => ({ id: g.id, title: g.value, group: g, blocks: sectionBlocks(g, String(i + 1).padStart(2, '0'), ctx) }));
    if (settings.showNext) sections.push({ id: 'closing', title: 'Prochaines étapes', group: null, blocks: closingBlocks(project, texts, setText) });
    if (settings.photos && settings.annex) {
        const blocks = annexBlocks(rows, levels, settings);
        if (blocks.length) sections.push({ id: 'annex', title: 'Annexe photographique', group: null, blocks });
    }

    // Synthèse + sommaire, avec le n° de la 1re page de chaque section.
    const tocRow = (s, i, pageNo) => () => {
        const p = s.group ? progressOf(s.group.rows) : null;
        return (
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 130px 34px', gap: 12, alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${LINE}` }}>
                <div style={{ fontSize: 13, color: MUTED }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: INK, fontWeight: 500 }}>{s.title}</div>
                    {s.group?.children.length > 0 && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{s.group.children.map((c) => c.value).join('  ·  ')}</div>}
                </div>
                <div>
                    {p && <div style={{ fontSize: 12, color: INK, textAlign: 'right', marginBottom: 5 }}><ProgressText p={p} /></div>}
                    {p && <ProgressBar p={p} />}
                </div>
                <div style={{ fontSize: 13, color: INK, textAlign: 'right' }}>{pageNo ?? ''}</div>
            </div>
        );
    };
    const summaryBlocks = (pageOf) => [
        { key: 'sum:h', keep: true, render: () => <H1>Synthèse</H1> },
        { key: 'sum:intro', keep: true, render: (m) => (
            <div style={{ paddingBottom: 14 }}>
                <EditableText mode={m} value={texts.intro} onChange={(v) => setText('intro', v)}
                    placeholder="Mot d'introduction (optionnel) : contexte, faits marquants depuis le dernier point…" style={{ fontSize: 13, color: INK, lineHeight: 1.6 }} />
            </div>
        ) },
        { key: 'sum:label', keep: true, render: () => (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 0 8px' }}>
                <span>Sommaire</span><span>Page</span>
            </div>
        ) },
        ...sections.map((s, i) => ({ key: `toc:${s.id}`, render: tocRow(s, i, pageOf(s.id)) })),
        { key: 'sum:total', render: () => (
            <div style={{ fontSize: 12, color: MUTED, paddingTop: 12 }}>
                <ProgressText p={progressOf(rows)} suffix=" au total · " />{rows.length} ouvrage{rows.length > 1 ? 's' : ''} dans ce rapport
            </div>
        ) },
        { key: 'sum:mentions', render: (m) => (
            <div style={{ marginTop: 22, padding: '10px 12px', background: '#F7F7F5', borderRadius: 4 }}>
                <EditableText mode={m} value={texts.mentions ?? DEFAULT_MENTIONS} onChange={(v) => setText('mentions', v)}
                    placeholder="Mentions (optionnel)" style={{ fontSize: 10.5, color: '#4B5563', lineHeight: 1.5 }} />
            </div>
        ) },
    ];

    // Mesure de chaque bloc (largeur utile A4), puis pagination.
    const [heights, setHeights] = useState({});
    // Une photo qui finit de charger change la hauteur de son ouvrage : on relance la mesure.
    const [, setImgTick] = useState(0);
    const onImgLoad = React.useCallback(() => setImgTick((t) => t + 1), []);
    const measureRef = useRef(null);
    const allBlocks = [...summaryBlocks(() => 99), ...sections.flatMap((s) => s.blocks)];
    // Après chaque rendu (pas de liste de dépendances) : un texte saisi change une hauteur.
    // Pas de boucle : on ne met à jour que si une hauteur a réellement changé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        const el = measureRef.current;
        if (!el) return;
        const next = {};
        el.querySelectorAll(':scope > [data-k]').forEach((n) => { next[n.dataset.k] = n.getBoundingClientRect().height; });
        const keys = Object.keys(next);
        const same = keys.length === Object.keys(heights).length && keys.every((k) => Math.abs(next[k] - (heights[k] ?? -1)) < 0.5);
        if (!same) setHeights(next);
    });

    const sectionPages = sections.map((s) => ({ id: s.id, pages: paginate(s.blocks, heights) }));
    const summaryCount = paginate(summaryBlocks(() => 99), heights).length;
    const firstPage = {};
    let n = 2 + summaryCount; // 1 = page de garde, puis la synthèse
    sectionPages.forEach((sp) => { firstPage[sp.id] = n; n += sp.pages.length; });
    const total = n - 1;
    const summaryPages = paginate(summaryBlocks((id) => firstPage[id]), heights);

    let pageNo = 1 + summaryPages.length;
    const ctxValue = useMemo(() => ({ showProgress: settings.showProgress !== false, setRowPhoto: setRowPhoto || (() => {}), onImgLoad, cover }), [settings.showProgress, setRowPhoto, onImgLoad, cover]);

    return (
        <ReportCtx.Provider value={ctxValue}>
            <div className="df-report" style={{ fontFamily: FONT, color: INK }}>
                <Page><Cover project={project} rows={rows} coverPhoto={coverPhoto} date={date} editing={mode === 'edit'} reportNumber={reportNumber} author={author} /></Page>
                {summaryPages.map((blocks, i) => (
                    <Page key={`sum${i}`}>{blocks.map((b) => <React.Fragment key={b.key}>{b.render(mode)}</React.Fragment>)}</Page>
                ))}
                {sectionPages.map((sp) => sp.pages.map((blocks, i) => {
                    pageNo += 1;
                    return (
                        <Page key={`${sp.id}#${i}`} footer number={pageNo} total={total} projectName={project?.name} reportNumber={reportNumber}>
                            {blocks.map((b) => <React.Fragment key={b.key}>{b.render(mode)}</React.Fragment>)}
                        </Page>
                    );
                }))}

                {/* Mesure, hors écran : mêmes blocs, largeur utile d'une page A4. */}
                <div ref={measureRef} aria-hidden style={{ position: 'absolute', left: -100000, top: 0, width: `${PAGE_W - 2 * PAD_X}mm`, visibility: 'hidden', pointerEvents: 'none' }}>
                    {allBlocks.map((b) => <div key={b.key} data-k={b.key} style={{ display: 'flow-root' }}>{b.render('measure')}</div>)}
                </div>
            </div>
        </ReportCtx.Provider>
    );
}
