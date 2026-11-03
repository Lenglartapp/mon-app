// src/components/project/DeliveryPhasing.jsx
// -----------------------------------------------------------------------------
// En-tête du dossier de production : date de livraison globale + bouton « Phasage ».
// Le bouton ouvre une fenêtre accrochée sous l'en-tête :
//   - liste des phases (date, ce qu'elles concernent, nb d'ouvrages, heures prépa / conf
//     / pose), ▶ pour voir les ouvrages, ✎ pour modifier ;
//   - modifier / ajouter une phase : la MÊME fenêtre s'élargit (filtres zone, pièce,
//     fenêtre, produit + tableau des ouvrages) — on ne quitte jamais l'écran.
// Logique (critères, priorités, heures) : src/lib/deliveryPhases.js.
// -----------------------------------------------------------------------------
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import {
  CRITERIA, GLOBAL, PHASE_COLORS, phaseColor, nextColor, normalizePhases, buildOuvrages, resolveAll, ruleLabel,
  phaseGroups, sumHours, addRule, removeRule, addOuvrages, removeOuvrages, resetOuvrages,
} from '../../lib/deliveryPhases';

const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `ph_${Date.now()}_${Math.random().toString(36).slice(2)}`);
const emptyFilters = () => ({ zone: [], piece: [], fenetre: [], produit: [] });
const fmtDate = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'sans date');
const fmtShort = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—');
const nf = (v) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');
const byPlace = (a, b) => a.zone.localeCompare(b.zone) || a.piece.localeCompare(b.piece, 'fr', { numeric: true }) || a.fenetre.localeCompare(b.fenetre);
const dims = (o) => (o.largeur || o.hauteur ? `${o.largeur ?? '?'}×${o.hauteur ?? '?'}` : '');

const LIST_WIDTH = 600;
const EDIT_WIDTH = 1120;

function Hours({ ouvrages }) {
  const h = sumHours(ouvrages);
  return (
    <span className="dph-hrs">
      <span><i>Prépa</i> {nf(h.prepa)} h</span>
      <span><i>Conf</i> {nf(h.conf)} h</span>
      <span><i>Pose</i> {nf(h.pose)} h</span>
    </span>
  );
}

function OuvrageList({ groups }) {
  return (
    <div className="dph-items">
      <div className="dph-item dph-item-head"><span>Zone</span><span>Pièce · produit</span><span>Fen.</span><span>L×H</span><span>Prépa</span><span>Conf</span><span>Pose</span></div>
      {groups.filter((g) => g.ouvrages.length).map((g) => (
        <React.Fragment key={g.key}>
          {g.label && <h4>{g.label}</h4>}
          {[...g.ouvrages].sort(byPlace).map((o) => (
            <div className="dph-item" key={o.id}>
              <span className="dph-muted">{o.zone}</span>
              <span className="dph-ellipsis">{o.piece || '—'} <span className="dph-faint">· {o.produit}</span></span>
              <span className="dph-muted">{o.fenetre}</span>
              <span className="dph-mono dph-faint">{dims(o)}</span>
              <span className="dph-mono dph-r">{nf(o.prepa)}</span>
              <span className="dph-mono dph-r">{nf(o.conf)}</span>
              <span className="dph-mono dph-r">{nf(o.pose)}</span>
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function DeliveryPhasing({ project, rows, canEdit, onUpdateProject }) {
  const phases = useMemo(() => normalizePhases(project?.delivery_phases), [project?.delivery_phases]);
  const ouvrages = useMemo(() => buildOuvrages(rows), [rows]);
  const resolved = useMemo(() => resolveAll(ouvrages, phases), [ouvrages, phases]);
  const deadline = project?.deadline ? String(project.deadline).slice(0, 10) : '';

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [openPh, setOpenPh] = useState(() => new Set());
  const [filters, setFilters] = useState(emptyFilters);
  const [view, setView] = useState('all');
  const [checked, setChecked] = useState(() => new Set());
  const [openDD, setOpenDD] = useState(null);
  const [ddSearch, setDdSearch] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [offset, setOffset] = useState(0);
  const wrapRef = useRef(null);

  const editing = editingId ? phases.find((p) => p.id === editingId) : null;
  const colorOf = (id) => { const i = phases.findIndex((p) => p.id === id); return phaseColor(phases[i], i); };
  const [colorOpen, setColorOpen] = useState(false);
  const sorted = useMemo(() => [...phases].sort((a, b) => (a.date || '9').localeCompare(b.date || '9')), [phases]);

  const save = useCallback((next) => onUpdateProject(project.id, { delivery_phases: next }), [onUpdateProject, project?.id]);

  // Fenêtre accrochée sous l'en-tête, recalée pour rester dans l'écran (plus large en modification).
  const place = useCallback(() => {
    const el = wrapRef.current; if (!el) return;
    const vw = window.innerWidth; const r = el.getBoundingClientRect();
    const width = Math.min(editingId ? EDIT_WIDTH : LIST_WIDTH, vw - 32);
    const left = Math.max(16, Math.min(r.left, vw - width - 16));
    setOffset(left - r.left);
  }, [editingId]);
  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, place]);

  const closeAll = useCallback(() => { setOpen(false); setEditingId(null); setOpenDD(null); setChecked(new Set()); }, []);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) closeAll(); };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (openDD) setOpenDD(null); else if (editingId) setEditingId(null); else closeAll();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, openDD, editingId, closeAll]);

  const startEdit = (id, label) => {
    setEditingId(id); setNameDraft(label); setFilters(emptyFilters()); setView('all');
    setChecked(new Set()); setOpenDD(null); setConfirmDelete(false); setColorOpen(false); setOpen(true);
  };
  const addPhase = () => {
    const id = newId(); const label = `Phase ${phases.length + 1}`;
    save([...phases, { id, label, date: '', color: nextColor(phases), rules: [], row_ids: [], excluded_ids: [] }]);
    startEdit(id, label);
  };
  const toggle = (setter, key) => setter((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const late = (p) => !!(p.date && deadline && p.date > deadline);
  const hasConflict = ouvrages.some((o) => resolved[o.id]?.conflict);
  const needsCheck = phases.some(late) || hasConflict;
  const sans = ouvrages.filter((o) => resolved[o.id]?.phaseId === GLOBAL);

  // ── Modification ──
  const matches = (o, except) => CRITERIA.every(({ key }) => key === except || !filters[key].length || filters[key].includes(o[key]));
  const anyFilter = CRITERIA.some(({ key }) => filters[key].length);
  const visible = editing ? ouvrages.filter((o) => matches(o) && (view === 'all'
    || (view === 'mine' ? resolved[o.id]?.phaseId === editing.id : resolved[o.id]?.phaseId === GLOBAL))) : [];
  const mine = editing ? ouvrages.filter((o) => resolved[o.id]?.phaseId === editing.id) : [];
  const currentRule = Object.fromEntries(CRITERIA.filter(({ key }) => filters[key].length).map(({ key }) => [key, [...filters[key]]]));
  const commitName = () => { if (editing && nameDraft.trim() !== editing.label) save(phases.map((p) => (p.id === editing.id ? { ...p, label: nameDraft.trim() } : p))); };

  const renderFilter = ({ key, label }) => {
    const sel = filters[key];
    const txt = sel.length ? (sel.length === 1 ? sel[0] : `${sel[0]} +${sel.length - 1}`) : 'Tous';
    let options = null;
    if (openDD === key) {
      const counts = {};
      for (const o of ouvrages) if (o[key] && matches(o, key)) counts[o[key]] = (counts[o[key]] || 0) + 1;
      const q = ddSearch.toLowerCase();
      options = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })).filter((v) => !q || v.toLowerCase().includes(q))
        .map((v) => ({ v, n: counts[v] }));
    }
    return (
      <div className="dph-dd" key={key}>
        <button type="button" className={`dph-dd-btn ${sel.length ? 'on' : ''}`} onClick={() => { setOpenDD(openDD === key ? null : key); setDdSearch(''); }}>
          <span className="dph-muted">{label}</span> {txt}
        </button>
        {options && (
          <div className="dph-pop">
            <input type="search" autoFocus placeholder="Rechercher…" value={ddSearch} onChange={(e) => setDdSearch(e.target.value)} />
            <div className="dph-pop-list">
              {options.length ? options.map(({ v, n }) => (
                <label key={v}>
                  <input type="checkbox" checked={sel.includes(v)}
                    onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.checked ? [...f[key], v] : f[key].filter((x) => x !== v) }))} />
                  <span>{v}</span><em>{n}</em>
                </label>
              )) : <div className="dph-empty">Aucune valeur</div>}
            </div>
            {sel.length > 0 && <button type="button" className="dph-link" onClick={() => setFilters((f) => ({ ...f, [key]: [] }))}>Effacer</button>}
          </div>
        )}
      </div>
    );
  };

  const editPanel = editing && (() => {
    const nManual = editing.row_ids.filter((id) => resolved[id]).length;
    const nExcluded = editing.excluded_ids.filter((id) => resolved[id]).length;
    const ids = [...checked];
    const allChecked = visible.length > 0 && visible.every((o) => checked.has(o.id));
    return (
      <>
        <div className="dph-head">
          <button type="button" className="dph-back" onClick={() => { commitName(); setEditingId(null); setChecked(new Set()); }}>← Phases</button>
          <div className="dph-color">
            <button type="button" className="dph-color-btn" title="Couleur de la phase" aria-label="Couleur de la phase" aria-expanded={colorOpen}
              onClick={() => setColorOpen((o) => !o)}><span className="dph-swatch" style={{ background: colorOf(editing.id), width: 14, height: 14 }} /></button>
            {colorOpen && (
              <div className="dph-color-pop" role="listbox" aria-label="Couleurs">
                {PHASE_COLORS.map((c) => {
                  const current = colorOf(editing.id) === c.css;
                  return (
                    <button type="button" key={c.key} title={c.label} aria-label={c.label} aria-selected={current} className={current ? 'on' : ''}
                      style={{ background: c.css }}
                      onClick={() => { save(phases.map((p) => (p.id === editing.id ? { ...p, color: c.key } : p))); setColorOpen(false); }} />
                  );
                })}
              </div>
            )}
          </div>
          <input className="dph-name" value={nameDraft} aria-label="Nom de la phase" onChange={(e) => setNameDraft(e.target.value)} onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
          <label className="dph-muted dph-small" htmlFor="dph-date">Date</label>
          <input id="dph-date" className="dph-date" type="date" value={editing.date || ''}
            onChange={(e) => save(phases.map((p) => (p.id === editing.id ? { ...p, date: e.target.value } : p)))} />
          <span className="dph-small dph-muted dph-grow">{mine.length} ouvrage{mine.length > 1 ? 's' : ''} · <Hours ouvrages={mine} /></span>
          <button type="button" className="dph-x" aria-label="Fermer" onClick={() => { commitName(); closeAll(); }}>×</button>
        </div>
        <div className="dph-incl">
          <span className="dph-eyebrow">Inclus</span>
          {editing.rules.map((r, i) => (
            <span className="dph-chip" key={i}>{ruleLabel(r)}<button type="button" aria-label="Retirer ce critère" onClick={() => save(removeRule(phases, editing.id, i))}>×</button></span>
          ))}
          {nManual > 0 && <span className="dph-chip">{nManual} ajouté{nManual > 1 ? 's' : ''} un par un<button type="button" aria-label="Retirer" onClick={() => save(resetOuvrages(phases, editing.row_ids))}>×</button></span>}
          {nExcluded > 0 && <span className="dph-chip">{nExcluded} retiré{nExcluded > 1 ? 's' : ''}<button type="button" aria-label="Annuler les retraits" onClick={() => save(resetOuvrages(phases, editing.excluded_ids))}>×</button></span>}
          {!editing.rules.length && !nManual && <span className="dph-small dph-muted">Aucun ouvrage</span>}
          {late(editing) && <span className="dph-late">Après la date globale ({fmtDate(deadline)})</span>}
        </div>
        <div className="dph-filters">
          {CRITERIA.map(renderFilter)}
          {anyFilter && <button type="button" className="dph-link" onClick={() => setFilters(emptyFilters())}>Réinitialiser</button>}
          <div className="dph-seg" role="group" aria-label="Affichage">
            <button type="button" className={view === 'all' ? 'on' : ''} onClick={() => setView('all')}>Tous</button>
            <button type="button" className={view === 'mine' ? 'on' : ''} onClick={() => setView('mine')}>Dans cette phase ({mine.length})</button>
            <button type="button" className={view === 'none' ? 'on' : ''} onClick={() => setView('none')}>Sans phase</button>
          </div>
        </div>
        {(ids.length > 0 || anyFilter) && <div className="dph-action">
          {ids.length ? (
            <>
              <span className="dph-grow"><b>{ids.length}</b> ouvrage{ids.length > 1 ? 's' : ''} coché{ids.length > 1 ? 's' : ''}</span>
              <button type="button" className="dph-btn" onClick={() => { save(addOuvrages(phases, editing.id, ids)); setChecked(new Set()); }}>Ajouter à {editing.label || 'la phase'}</button>
              <button type="button" className="dph-btn ghost" onClick={() => { save(removeOuvrages(phases, editing.id, ids, ouvrages)); setChecked(new Set()); }}>Retirer de la phase</button>
              <button type="button" className="dph-btn ghost" onClick={() => { save(resetOuvrages(phases, ids)); setChecked(new Set()); }}>Revenir aux critères</button>
            </>
          ) : (
            <>
              <span className="dph-grow"><b>{visible.length}</b> ouvrage{visible.length > 1 ? 's' : ''} · <b>{ruleLabel(currentRule)}</b></span>
              <button type="button" className="dph-btn" onClick={() => { save(addRule(phases, editing.id, currentRule)); setFilters(emptyFilters()); setView('mine'); }}>
                Ajouter ces critères à {editing.label || 'la phase'}
              </button>
            </>
          )}
        </div>}
        <div className="dph-table">
          <table>
            <thead><tr>
              <th><input type="checkbox" aria-label="Tout cocher" checked={allChecked}
                onChange={(e) => setChecked((s) => { const n = new Set(s); visible.forEach((o) => (e.target.checked ? n.add(o.id) : n.delete(o.id))); return n; })} /></th>
              <th>Zone</th><th>Pièce</th><th>Fenêtre</th><th>Produit</th><th>L × H</th><th>Prépa</th><th>Conf</th><th>Pose</th><th>Phase actuelle</th>
            </tr></thead>
            <tbody>
              {visible.length ? visible.map((o) => {
                const r = resolved[o.id]; const q = phases.find((p) => p.id === r.phaseId);
                return (
                  <tr key={o.id} className={r.phaseId === editing.id ? 'mine' : ''}>
                    <td><input type="checkbox" aria-label="Cocher" checked={checked.has(o.id)} onChange={() => toggle(setChecked, o.id)} /></td>
                    <td>{o.zone}</td><td>{o.piece}</td><td>{o.fenetre || <span className="dph-faint">—</span>}</td><td>{o.produit}</td>
                    <td className="dph-mono dph-muted">{dims(o)}</td>
                    <td className="dph-mono dph-muted">{nf(o.prepa)}</td><td className="dph-mono dph-muted">{nf(o.conf)}</td><td className="dph-mono dph-muted">{nf(o.pose)}</td>
                    <td>
                      {q ? <span className="dph-pill"><span className="dph-swatch" style={{ background: colorOf(q.id) }} />{q.label || 'Phase'} · {fmtShort(q.date)}</span>
                        : <span className="dph-pill none">Date globale</span>}
                      {r.source === 'manual' && <span className="dph-src">un par un</span>}
                      {r.conflict && <span className="dph-conflict" title={r.conflict.map((id) => phases.find((p) => p.id === id)?.label).join(' / ')}>⚠ conflit</span>}
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={10} className="dph-empty">Aucun ouvrage.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="dph-foot">
          <button type="button" className="dph-btn danger" onClick={() => {
            if (!confirmDelete) { setConfirmDelete(true); return; }
            save(phases.filter((p) => p.id !== editing.id)); setEditingId(null);
          }}>{confirmDelete ? 'Confirmer la suppression' : 'Supprimer la phase'}</button>
          <button type="button" className="dph-btn" onClick={() => { commitName(); setEditingId(null); setChecked(new Set()); }}>Terminer</button>
        </div>
      </>
    );
  })();

  const listPanel = !editing && (
    <>
      <div className="dph-head">
        <h3 className="dph-grow">Phasage livraison</h3>
        <button type="button" className="dph-x" aria-label="Fermer" onClick={closeAll}>×</button>
      </div>
      <div className="dph-body">
        {sorted.length === 0 && <div className="dph-empty">Aucune phase : tout part à la date globale.</div>}
        {sorted.map((p) => {
          const { ouvrages: own, groups } = phaseGroups(p, ouvrages, resolved);
          const isOpen = openPh.has(p.id);
          return (
            <div className={`dph-ph ${isOpen ? 'open' : ''}`} key={p.id}>
              <div className="dph-ph-row" onClick={() => toggle(setOpenPh, p.id)}>
                <span className="dph-chev">▶</span>
                <span className="dph-swatch" style={{ background: colorOf(p.id) }} />
                <span className="dph-ph-name">{p.label || 'Phase sans nom'}</span>
                <span className={`dph-ph-date ${late(p) ? 'late' : ''}`}>{fmtDate(p.date)}</span>
                <span className="dph-small dph-muted">{own.length} ouvr.</span>
                {canEdit ? (
                  <button type="button" className="dph-icon" title="Modifier la phase" aria-label={`Modifier ${p.label}`}
                    onClick={(e) => { e.stopPropagation(); startEdit(p.id, p.label || ''); }}><Pencil size={14} /></button>
                ) : <span />}
              </div>
              <div className="dph-tags">
                {groups.filter((g) => g.ouvrages.length).map((g) => <span className="dph-tag" key={g.key}>{g.label}<em>{g.ouvrages.length}</em></span>)}
                {!own.length && <span className="dph-small dph-muted">Aucun ouvrage rattaché</span>}
              </div>
              {own.length > 0 && <div className="dph-ph-hrs"><Hours ouvrages={own} /></div>}
              {late(p) && <div className="dph-late dph-indent">Tombe après la date de livraison globale ({fmtDate(deadline)}).</div>}
              {isOpen && own.length > 0 && <div className="dph-indent"><OuvrageList groups={groups} /></div>}
            </div>
          );
        })}
        {sorted.length > 0 && (
          <div className={`dph-ph global ${openPh.has(GLOBAL) ? 'open' : ''}`}>
            <div className="dph-ph-row" onClick={() => toggle(setOpenPh, GLOBAL)}>
              <span className="dph-chev">▶</span>
              <span className="dph-swatch" style={{ border: '1.5px dashed var(--df-faint)' }} />
              <span className="dph-ph-name">Sans phase → date globale</span>
              <span className="dph-ph-date">{fmtDate(deadline)}</span>
              <span className="dph-small dph-muted">{sans.length} ouvr.</span><span />
            </div>
            {sans.length > 0 && <div className="dph-ph-hrs"><Hours ouvrages={sans} /></div>}
            {openPh.has(GLOBAL) && sans.length > 0 && <div className="dph-indent"><OuvrageList groups={[{ key: 'sans', label: '', ouvrages: sans }]} /></div>}
          </div>
        )}
      </div>
      <div className="dph-foot">
        {canEdit ? <button type="button" className="dph-btn" onClick={addPhase}>+ Ajouter une phase</button> : <span />}
      </div>
    </>
  );

  return (
    <div ref={wrapRef} className="dph-wrap">
      <style>{CSS}</style>
      <button type="button" className={`dph-trigger ${phases.length ? '' : 'empty'} ${open ? 'on' : ''}`} aria-expanded={open}
        disabled={!phases.length && !canEdit}
        onClick={() => { if (!phases.length) { addPhase(); return; } open ? closeAll() : setOpen(true); }}>
        {phases.length ? (
          <>
            <span className="dph-dots">{sorted.map((p) => <i key={p.id} style={{ background: colorOf(p.id) }} />)}</span>
            Phasage · {phases.length} phase{phases.length > 1 ? 's' : ''}
            {needsCheck && <b className="dph-warn" title="Une phase tombe après la date globale, ou un ouvrage est en conflit">!</b>}
          </>
        ) : '+ Phasage'}
      </button>
      {open && (
        <div className={`dph-panel ${editing ? 'wide' : ''}`} style={{ left: offset, width: Math.min(editing ? EDIT_WIDTH : LIST_WIDTH, window.innerWidth - 32) }}
          role="dialog" aria-label="Phasage livraison">
          {editing ? editPanel : listPanel}
        </div>
      )}
    </div>
  );
}

const CSS = `
.dph-wrap { position: relative; display: inline-flex; font-family: Roboto, system-ui, -apple-system, "Segoe UI", sans-serif; }
.dph-wrap input, .dph-wrap button { font-family: inherit; }
.dph-wrap button { font-family: inherit; cursor: pointer; }
.dph-trigger { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--df-border); background: var(--df-bg); border-radius: 99px; padding: 3px 11px 3px 8px; font-size: 12.5px; color: var(--df-text-2); }
.dph-trigger:hover { border-color: var(--df-primary); }
.dph-trigger.on { background: var(--df-primary); color: #fff; border-color: var(--df-primary); }
.dph-trigger.empty { border-style: dashed; color: var(--df-muted); padding-left: 11px; }
.dph-trigger:disabled { cursor: default; opacity: .6; }
.dph-dots { display: inline-flex; }
.dph-dots i { width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--df-bg); margin-left: -3px; box-sizing: content-box; }
.dph-dots i:first-child { margin-left: 0; }
.dph-warn { color: var(--df-warn-text); font-weight: 700; }
.dph-trigger.on .dph-warn { color: #FCD34D; }
.dph-panel { position: absolute; top: calc(100% + 8px); z-index: 1000; background: var(--df-bg); border: 1px solid var(--df-border); border-radius: 12px; box-shadow: 0 16px 40px rgba(17,24,39,.16); overflow: hidden; text-align: left; font-size: 13px; color: var(--df-text); }
.dph-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--df-border-soft); flex-wrap: wrap; }
.dph-head h3 { margin: 0; font-size: 15px; font-weight: 700; }
.dph-body { max-height: 62vh; overflow: auto; padding: 6px; }
.dph-foot { border-top: 1px solid var(--df-border-soft); padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.dph-grow { flex: 1; min-width: 0; }
.dph-small { font-size: 12px; }
.dph-muted { color: var(--df-muted); }
.dph-faint { color: var(--df-faint); }
.dph-mono { font-size: 12px; font-variant-numeric: tabular-nums; }
.dph-r { text-align: right; }
.dph-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--df-muted); margin-right: 4px; }
.dph-x { border: 0; background: transparent; color: var(--df-muted); font-size: 20px; line-height: 1; padding: 4px 8px; border-radius: 6px; }
.dph-x:hover { background: var(--df-hover); }
.dph-icon { border: 0; background: transparent; color: var(--df-muted); width: 28px; height: 28px; border-radius: 6px; display: inline-grid; place-items: center; }
.dph-icon:hover { background: var(--df-bg); color: var(--df-primary-text); box-shadow: inset 0 0 0 1px var(--df-border); }
.dph-swatch { width: 10px; height: 10px; border-radius: 50%; flex: none; display: inline-block; box-sizing: border-box; box-shadow: 0 0 0 1px var(--df-border-strong); }
.dph-ph { border-radius: 8px; padding: 8px; }
.dph-ph + .dph-ph { border-top: 1px solid var(--df-border-soft); }
.dph-ph:hover { background: var(--df-surface); }
.dph-ph-row { display: grid; grid-template-columns: 18px 10px minmax(0,1fr) auto auto 28px; align-items: center; gap: 8px; cursor: pointer; }
.dph-chev { color: var(--df-faint); font-size: 10px; transition: transform .15s; text-align: center; }
.dph-ph.open .dph-chev { transform: rotate(90deg); }
.dph-ph-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dph-ph.global .dph-ph-name { font-weight: 400; color: var(--df-muted); }
.dph-ph-date { font-variant-numeric: tabular-nums; font-weight: 500; color: var(--df-text-2); }
.dph-ph-date.late { color: var(--df-warn-text); }
.dph-tags { display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0 0 36px; }
.dph-tag { font-size: 12px; color: var(--df-text-2); background: var(--df-surface); border: 1px solid var(--df-border-soft); border-radius: 6px; padding: 1px 8px; }
.dph-ph:hover .dph-tag { background: var(--df-bg); }
.dph-tag em { font-style: normal; color: var(--df-faint); margin-left: 4px; }
.dph-ph-hrs { margin: 6px 0 0 36px; }
.dph-indent { margin-left: 36px; }
.dph-hrs { display: inline-flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--df-text-2); font-variant-numeric: tabular-nums; }
.dph-hrs span { white-space: nowrap; font-weight: 500; }
.dph-hrs i { font-style: normal; font-weight: 400; color: var(--df-muted); margin-right: 2px; }
.dph-late { font-size: 12px; color: var(--df-warn-text); background: var(--df-warn-bg); border-radius: 6px; padding: 4px 8px; margin-top: 6px; }
.dph-items { margin-top: 8px; border-left: 2px solid var(--df-border-soft); padding: 0 12px 0 10px; max-height: 260px; overflow: auto; }
.dph-items h4 { margin: 6px 0 2px; font-size: 11px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: var(--df-muted); }
.dph-item { display: grid; grid-template-columns: 56px minmax(0,1fr) 30px 64px 40px 40px 40px; gap: 8px; align-items: baseline; padding: 3px 0; font-size: 12.5px; color: var(--df-text-2); }
.dph-item-head { position: sticky; top: 0; background: var(--df-bg); font-size: 11px; color: var(--df-muted); border-bottom: 1px solid var(--df-border-soft); z-index: 1; }
.dph-ph:hover .dph-item-head { background: var(--df-surface); }
.dph-item-head span:nth-child(n+5) { text-align: right; }
.dph-ellipsis { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dph-back { border: 0; background: transparent; color: var(--df-text); font-weight: 500; font-size: 13px; padding: 4px 6px; border-radius: 6px; }
.dph-back:hover { background: var(--df-hover); }
.dph-name { font-size: 15px; font-weight: 700; border: 1px solid transparent; border-radius: 6px; padding: 3px 6px; background: transparent; width: 220px; min-width: 0; color: var(--df-text); font-family: inherit; }
.dph-name:hover, .dph-name:focus { border-color: var(--df-border); outline: none; }
.dph-date { border: 1px solid var(--df-border); border-radius: 6px; padding: 3px 6px; font-size: 13px; color: var(--df-text-2); background: var(--df-bg); font-family: inherit; }
.dph-color { position: relative; }
.dph-color-btn { border: 1px solid var(--df-border); background: var(--df-bg); border-radius: 6px; width: 28px; height: 28px; display: inline-grid; place-items: center; }
.dph-color-btn:hover { border-color: var(--df-primary); }
.dph-color-pop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 10; display: grid; grid-template-columns: repeat(5, 22px); gap: 8px; padding: 10px; background: var(--df-bg); border: 1px solid var(--df-border); border-radius: 10px; box-shadow: 0 12px 32px rgba(17,24,39,.16); }
.dph-color-pop button { width: 22px; height: 22px; border-radius: 50%; border: 0; padding: 0; box-shadow: 0 0 0 1px var(--df-border-strong); }
.dph-color-pop button:hover { transform: scale(1.12); }
.dph-color-pop button.on { box-shadow: 0 0 0 2px var(--df-bg), 0 0 0 4px var(--df-text); }
.dph-color-pop { grid-template-columns: repeat(5, 22px) !important; }
.dph-incl { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--df-border-soft); background: var(--df-surface); font-size: 12.5px; }
.dph-incl .dph-late { margin: 0; }
.dph-chip { display: inline-flex; align-items: center; gap: 4px; background: var(--df-bg); border: 1px solid var(--df-border); border-radius: 99px; padding: 2px 4px 2px 10px; color: var(--df-text-2); }
.dph-chip button { border: 0; background: transparent; color: var(--df-faint); font-size: 14px; line-height: 1; padding: 0 5px; border-radius: 99px; }
.dph-chip button:hover { color: var(--df-danger); }
.dph-filters { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 14px 8px; align-items: center; }
.dph-dd { position: relative; }
.dph-dd-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--df-border); background: var(--df-bg); border-radius: 8px; padding: 6px 10px; font-size: 13px; color: var(--df-text); }
.dph-dd-btn.on { border-color: var(--df-primary); background: var(--df-surface); font-weight: 500; }
.dph-dd-btn::after { content: "▾"; font-size: 10px; color: var(--df-muted); }
.dph-pop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 10; width: 270px; background: var(--df-bg); border: 1px solid var(--df-border); border-radius: 10px; box-shadow: 0 12px 32px rgba(17,24,39,.16); padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.dph-pop input[type=search] { border: 1px solid var(--df-border); border-radius: 6px; padding: 6px 8px; background: var(--df-bg); color: var(--df-text); font-family: inherit; }
.dph-pop-list { max-height: 260px; overflow: auto; display: flex; flex-direction: column; }
.dph-pop label { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 6px; cursor: pointer; }
.dph-pop label:hover { background: var(--df-hover); }
.dph-pop label span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.dph-pop label em { font-style: normal; color: var(--df-faint); font-size: 12px; }
.dph-link { border: 0; background: transparent; color: var(--df-text); text-decoration: underline; text-underline-offset: 2px; font-size: 12.5px; font-weight: 500; padding: 4px 6px; align-self: flex-end; }
.dph-seg { display: inline-flex; border: 1px solid var(--df-border); border-radius: 8px; overflow: hidden; margin-left: auto; }
.dph-seg button { border: 0; background: var(--df-bg); padding: 6px 10px; font-size: 12.5px; color: var(--df-muted); }
.dph-seg button.on { background: var(--df-primary); color: #fff; }
.dph-action { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 9px 12px; margin: 0 14px; background: var(--df-surface); border-radius: 10px; color: var(--df-text-2); }
.dph-btn { border: 1px solid var(--df-primary); background: var(--df-primary); color: #fff; border-radius: 8px; padding: 6px 12px; font-size: 13px; font-weight: 500; white-space: nowrap; }
.dph-btn.ghost { background: var(--df-bg); color: var(--df-text); border-color: var(--df-border); }
.dph-btn.danger { background: var(--df-bg); color: var(--df-danger); border-color: var(--df-border); }
.dph-table { margin: 10px 14px 0; border: 1px solid var(--df-border-soft); border-radius: 10px; overflow: auto; max-height: 46vh; }
.dph-table table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dph-table th { position: sticky; top: 0; background: var(--df-surface); text-align: left; font-weight: 500; color: var(--df-muted); font-size: 12px; padding: 8px 10px; border-bottom: 1px solid var(--df-border); white-space: nowrap; z-index: 1; }
.dph-table td { padding: 6px 10px; border-bottom: 1px solid var(--df-border-soft); white-space: nowrap; }
.dph-table tr:hover td { background: var(--df-hover); }
.dph-table tr.mine td { background: var(--df-selected); }
.dph-pill { display: inline-flex; align-items: center; gap: 6px; border-radius: 99px; padding: 2px 9px 2px 7px; font-size: 12px; background: var(--df-surface); color: var(--df-text-2); }
.dph-pill.none { background: transparent; border: 1px dashed var(--df-border); color: var(--df-muted); }
.dph-src { font-size: 11px; color: var(--df-faint); margin-left: 6px; }
.dph-conflict { color: var(--df-warn-text); font-size: 11.5px; margin-left: 6px; }
.dph-empty { padding: 24px; text-align: center; color: var(--df-muted); }
.dph-panel input[type=checkbox] { accent-color: var(--df-primary); width: 15px; height: 15px; }
`;
