// Planning du projet (vue Gantt) : les créneaux du planning de CE projet, par service —
// Préparation, Confection, Pose — au fil des jours (ou des semaines).
//   - Réalisé : créneaux validés (bleu nuit) ; Prévu : créneaux non validés (bleu clair).
//   - Confection prévue : cartes du Programme semaine (heures de la semaine).
//   - Pose (et Préparation) dépliables : une ligne par personne.
//   - Tissus : date de livraison estimée (DLE) de chaque tissu de la liste de courses Odoo,
//     ou sa date de réception une fois reçu.
// Lecture seule : tout vient du planning et de la liste de courses existants.
import React, { useMemo, useRef, useEffect, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { addDays, differenceInCalendarDays, format, startOfWeek, isWeekend } from "date-fns";
import { fr } from "date-fns/locale";
import DaDialog from "../ui/DaDialog";
import { ChoicePill } from "../ui/DaForm";
import { serviceOfEventType, netHoursOfEvent } from "../../lib/projectMetrics";
import { readCourseLines } from "../../lib/odoo/courseLinesClient";

const NAVY = "#1E2447";
const PLAN = "#A8C2EC";
const LINE = "#E8E6E2";
const MUTED = "#6B7280";
const LABEL_W = 260;
const SERVICES = [
  { key: "prepa", label: "Préparation", expandable: true },
  { key: "conf", label: "Confection", expandable: false },
  { key: "pose", label: "Pose", expandable: true },
];

const dayKey = (d) => format(d, "yyyy-MM-dd");
const evtDate = (e) => new Date(e.meta?.start || e.start_time || e.date);
const fmtH = (h) => `${Math.round(h * 10) / 10} h`.replace(".", ",");

/** Regroupe les créneaux du projet : par service, puis par jour, réalisé / prévu, et par personne. */
function buildData(events, projectId) {
  const svc = Object.fromEntries(SERVICES.map((s) => [s.key, { days: {}, people: {}, done: 0, planned: 0, weeks: [] }]));
  (events || []).forEach((e) => {
    if ((e.meta?.projectId ?? e.project_id) !== projectId || e.type === "absence") return;
    const d = evtDate(e);
    if (isNaN(d)) return;
    // Programme semaine (confection) : heures prévues pour la semaine de la carte.
    if (e.resourceId === "backlog_confection" || e.meta?.isBacklogMaster) {
      const h = Number(e.meta?.budgetHours) || 0;
      if (h > 0) { svc.conf.weeks.push({ start: startOfWeek(d, { weekStartsOn: 1 }), hours: h }); svc.conf.planned += h; }
      return;
    }
    const s = serviceOfEventType(e.type);
    if (!s) return;
    const h = netHoursOfEvent(e);
    const done = e.meta?.status === "validated";
    // Confection : le prévu vient du Programme semaine (sinon compté deux fois).
    if (s === "conf" && !done) return;
    const k = dayKey(d);
    const cell = (svc[s].days[k] ||= { done: 0, planned: 0 });
    cell[done ? "done" : "planned"] += h;
    svc[s][done ? "done" : "planned"] += h;
    const who = e.resourceId || "?";
    const p = (svc[s].people[who] ||= { days: {}, done: 0, planned: 0 });
    const pc = (p.days[k] ||= { done: 0, planned: 0 });
    pc[done ? "done" : "planned"] += h;
    p[done ? "done" : "planned"] += h;
  });
  return svc;
}

function Cell({ done, planned, width, showText }) {
  if (!done && !planned) return <div style={{ width, flexShrink: 0 }} />;
  const total = done + planned;
  const bg = done && planned ? `linear-gradient(90deg, ${NAVY} ${(done / total) * 100}%, ${PLAN} 0)` : done ? NAVY : PLAN;
  return (
    <div style={{ width, flexShrink: 0, padding: "0 1px", boxSizing: "border-box" }} title={`${done ? `Réalisé ${fmtH(done)}` : ""}${done && planned ? " · " : ""}${planned ? `Prévu ${fmtH(planned)}` : ""}`}>
      <div style={{ height: 22, borderRadius: 4, background: bg, color: done ? "white" : "#111827", fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", whiteSpace: "nowrap" }}>
        {showText ? Math.round(total) : ""}
      </div>
    </div>
  );
}

// Tissu de la liste de courses → repère daté : reçu (date de réception) ou attendu (DLE).
const fabricDate = (l) => {
  const received = !!l.date_reception || l.statut === "receptionne";
  const d = l.date_reception || l.date_livraison_estimee;
  return d ? { date: new Date(d), received } : null;
};
const fabricLabel = (l) => [l.fournisseur, [l.reference, l.coloris].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "Tissu";

export default function ProjectGanttModal({ open, onClose, project, events = [], users = [] }) {
  const data = useMemo(() => buildData(events, project?.id), [events, project?.id]);
  // Tissus du projet (liste de courses Odoo synchronisée)
  const [fabricsAll, setFabricsAll] = useState([]); // tous les tissus (avec ou sans date)
  useEffect(() => {
    if (!project?.id) return undefined;
    let alive = true;
    readCourseLines(project.id)
      .then((lines) => {
        if (!alive) return;
        setFabricsAll((lines || [])
          .filter((l) => !l.removed_from_odoo && (l.type_produit === "tissu" || !l.type_produit))
          .map((l) => {
            const fd = fabricDate(l);
            return { line: l, received: !!l.date_reception || l.statut === "receptionne", date: fd && !isNaN(fd.date) ? fd.date : null };
          }));
      })
      .catch(() => { /* pas de liste de courses : pas de ligne Tissus */ });
    return () => { alive = false; };
  }, [project?.id]);
  const fabrics = useMemo(() => fabricsAll.filter((f) => f.date), [fabricsAll]); // datés : repères sur la frise
  const [expanded, setExpanded] = useState({ pose: true });
  // Survol d'une pastille Tissus : liste des tissus de la date
  const [tip, setTip] = useState(null); // { x, y, items }
  const userName = (id) => users.find((u) => String(u.id) === String(id))?.name || "Sans nom";

  // Période : du premier au dernier créneau, élargie à aujourd'hui et à la livraison, par semaines entières.
  const { start, end } = useMemo(() => {
    const dates = [new Date()];
    SERVICES.forEach((s) => {
      Object.keys(data[s.key].days).forEach((k) => dates.push(new Date(k)));
      data[s.key].weeks.forEach((w) => { dates.push(w.start); dates.push(addDays(w.start, 6)); });
    });
    if (project?.deadline) dates.push(new Date(project.deadline));
    fabrics.forEach((f) => dates.push(f.date));
    const min = new Date(Math.min(...dates)); const max = new Date(Math.max(...dates));
    return { start: startOfWeek(addDays(min, -7), { weekStartsOn: 1 }), end: addDays(startOfWeek(addDays(max, 14), { weekStartsOn: 1 }), 6) };
  }, [data, project?.deadline, fabrics]);
  const nDays = differenceInCalendarDays(end, start) + 1;
  const [scale, setScale] = useState(() => (nDays > 140 ? "week" : "day"));
  const colW = scale === "day" ? 30 : 64;

  // Colonnes : jours, ou semaines (lundi) ; valeurs agrégées par colonne.
  const cols = useMemo(() => {
    const out = [];
    if (scale === "day") for (let i = 0; i < nDays; i++) { const d = addDays(start, i); out.push({ d, keys: [dayKey(d)], weekend: isWeekend(d) }); }
    else for (let i = 0; i < nDays; i += 7) { const d = addDays(start, i); out.push({ d, keys: Array.from({ length: 7 }, (_, j) => dayKey(addDays(d, j))), weekend: false }); }
    return out;
  }, [scale, start, nDays]);
  const sumCol = (days, keys) => keys.reduce((a, k) => ({ done: a.done + (days[k]?.done || 0), planned: a.planned + (days[k]?.planned || 0) }), { done: 0, planned: 0 });
  const xOf = (date) => (differenceInCalendarDays(date, start) / (scale === "day" ? 1 : 7)) * colW;
  const gridW = cols.length * colW;

  // Mois (bandeau du haut)
  const months = useMemo(() => {
    const out = [];
    cols.forEach((c, i) => {
      const label = format(c.d, "MMMM yyyy", { locale: fr });
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, from: i, n: 1 }); else out[out.length - 1].n += 1;
    });
    return out;
  }, [cols]);

  // Ouverture : on se place sur aujourd'hui.
  // (la fenêtre s'ouvre avec une animation : on attend qu'elle soit en place)
  const scrollRef = useRef(null);
  const startMs = start.getTime();
  useEffect(() => {
    const t = setTimeout(() => {
      const el = scrollRef.current;
      if (el) el.scrollLeft = Math.max(0, xOf(new Date()) - (el.clientWidth - LABEL_W) / 3);
    }, 120);
    return () => clearTimeout(t);
    // (recalé aussi quand la période s'élargit à l'arrivée des tissus)
  }, [scale, startMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const budget = project?.budget || {};
  const hasAny = fabricsAll.length > 0 || SERVICES.some((s) => data[s.key].done || data[s.key].planned);
  const today0 = new Date(new Date().toDateString());
  const nReceived = fabricsAll.filter((f) => f.received).length;
  const nLate = fabricsAll.filter((f) => !f.received && f.date && f.date < today0).length;
  const nNoDate = fabricsAll.filter((f) => !f.received && !f.date).length;
  // Tissus encore à recevoir : par DLE, ceux sans date à la fin
  const toReceive = fabricsAll.filter((f) => !f.received)
    .sort((a, b) => (a.date ? a.date.getTime() : Infinity) - (b.date ? b.date.getTime() : Infinity));
  const fabricStatus = (f) => (f.received ? { text: `Reçu le ${format(f.date || today0, "dd/MM/yyyy")}`, color: MUTED }
    : !f.date ? { text: "DLE manquante", color: "#B45309" }
      : f.date < today0 ? { text: `En retard — DLE ${format(f.date, "dd/MM/yyyy")}`, color: "#DC2626" }
        : { text: `DLE ${format(f.date, "dd/MM/yyyy")}`, color: MUTED });
  const markers = [
    { date: new Date(), label: "Aujourd'hui", color: "#DC2626" },
    ...(project?.deadline ? [{ date: new Date(project.deadline), label: "Livraison", color: NAVY }] : []),
    ...(project?.delivery_phases || []).filter((p) => p.date).map((p, i) => ({ date: new Date(p.date), label: p.label || `Phase ${i + 1}`, color: "#5B7FC4" })),
  ];

  // Colonne de gauche : la place de la flèche est TOUJOURS réservée, pour que tous les libellés
  // s'alignent (avec ou sans menu déroulant) ; les sous-lignes sont décalées d'un cran.
  const labelCell = ({ label, sub, child, onToggle, open, minH }) => (
    <div style={{ position: "sticky", left: 0, zIndex: 6, width: LABEL_W, flexShrink: 0, alignSelf: "stretch", display: "flex", alignItems: "center", gap: 6, padding: child ? "6px 12px 6px 33px" : "8px 12px", minHeight: minH, boxSizing: "border-box", background: child ? "#FAFAF9" : "white", borderRight: `1px solid ${LINE}`, cursor: onToggle ? "pointer" : "default" }} onClick={onToggle}>
      {!child && <span style={{ width: 15, flexShrink: 0, display: "flex", alignSelf: "flex-start", marginTop: 2 }}>{onToggle && (open ? <ChevronDown size={15} color={MUTED} /> : <ChevronRight size={15} color={MUTED} />)}</span>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: child ? 13 : 14, fontWeight: child ? 400 : 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.35, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );

  // Sous le nom du service : consommé / budget (barre) et prévu.
  const budgetSub = (done, planned, b) => (
    <div>
      {b > 0 && (
        <div style={{ height: 5, borderRadius: 99, background: "#EFEEEA", overflow: "hidden", margin: "3px 0 4px", width: "100%" }}>
          <div style={{ width: `${Math.min(100, (done / b) * 100)}%`, height: "100%", background: done > b ? "#DC2626" : NAVY }} />
        </div>
      )}
      <span style={{ color: "#111827", fontWeight: 500 }}>{fmtH(done)}</span>{b > 0 ? ` / ${fmtH(b)} consommées` : " consommées"} · prévu {fmtH(planned)}
    </div>
  );

  const row = (key, label, sub, days, opts = {}) => (
    <div key={key} style={{ display: "flex", borderBottom: `1px solid ${LINE}`, minHeight: opts.child ? 34 : opts.weeks ? 64 : 52, alignItems: "center", background: opts.child ? "#FAFAF9" : "white" }}>
      {labelCell({ label, sub, child: opts.child, onToggle: opts.onToggle, open: opts.open })}
      {/* Confection : 2 voies — en haut le réalisé (créneaux validés), en bas le Programme semaine (prévu). */}
      <div style={{ position: "relative", display: "flex", width: gridW, alignSelf: opts.weeks ? "stretch" : "center", alignItems: opts.weeks ? "flex-start" : "center", paddingTop: opts.weeks ? 6 : 0 }}>
        {cols.map((c, i) => { const v = sumCol(days, c.keys); return <Cell key={i} {...v} width={colW} showText={colW >= 30} />; })}
        {opts.weeks?.map((w, i) => {
          const x = xOf(w.start);
          const wpx = scale === "day" ? 5 * colW : colW;
          return (
            <div key={`w${i}`} title={`Programme semaine : ${fmtH(w.hours)} prévues`} style={{ position: "absolute", left: x + 1, width: wpx - 2, top: 34, height: 20, borderRadius: 4, background: PLAN, fontSize: 10, fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", whiteSpace: "nowrap" }}>
              {scale === "day" ? `Prévu ${fmtH(w.hours)}` : Math.round(w.hours)}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <DaDialog open={open} onClose={onClose} title="Planning du projet" subtitle={project?.name} maxWidth="xl" height="86vh" bodyPadding="0"
      headerExtra={(
        <div style={{ display: "flex", gap: 6 }}>
          <ChoicePill active={scale === "day"} onClick={() => setScale("day")}>Jours</ChoicePill>
          <ChoicePill active={scale === "week"} onClick={() => setScale("week")}>Semaines</ChoicePill>
        </div>
      )}
      footer={(
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 12, color: MUTED, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 14, height: 10, borderRadius: 3, background: NAVY, display: "inline-block" }} /> Réalisé (validé)</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 14, height: 10, borderRadius: 3, background: PLAN, display: "inline-block" }} /> Prévu</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 2, height: 12, background: "#DC2626", display: "inline-block" }} /> Aujourd'hui</span>
          <span>Chiffres : heures · Confection : en haut le réalisé, en bas le Programme semaine · Tissus : nombre de tissus (reçus, attendus à leur DLE, cerclés de rouge si en retard) — détail au survol.</span>
        </div>
      )}>
      {!hasAny ? (
        <div style={{ padding: 60, textAlign: "center", color: MUTED, fontSize: 14 }}>Aucun créneau n'est encore planifié pour ce projet.</div>
      ) : (
        <div ref={scrollRef} style={{ height: "100%", overflow: "auto", fontFamily: "Roboto, system-ui, sans-serif" }}>
          <div style={{ position: "relative", width: LABEL_W + gridW, minWidth: "100%" }}>
            {/* En-têtes : mois puis jours / semaines */}
            <div style={{ position: "sticky", top: 0, zIndex: 8, background: "#F4F4F4", borderBottom: "1px solid #E0DED9" }}>
              <div style={{ display: "flex" }}>
                <div style={{ position: "sticky", left: 0, zIndex: 9, width: LABEL_W, flexShrink: 0, background: "#F4F4F4", borderRight: `1px solid ${LINE}` }} />
                {months.map((m) => (
                  <div key={m.label + m.from} style={{ width: m.n * colW, flexShrink: 0, padding: "6px 8px", fontSize: 12, fontWeight: 600, color: "#374151", borderLeft: `1px solid ${LINE}`, boxSizing: "border-box", textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden" }}>{m.label}</div>
                ))}
              </div>
              <div style={{ display: "flex" }}>
                <div style={{ position: "sticky", left: 0, zIndex: 9, width: LABEL_W, flexShrink: 0, background: "#F4F4F4", borderRight: `1px solid ${LINE}`, padding: "4px 12px", fontSize: 12, color: MUTED, boxSizing: "border-box" }}>Service</div>
                {cols.map((c, i) => (
                  <div key={i} style={{ width: colW, flexShrink: 0, textAlign: "center", fontSize: 10.5, color: c.weekend ? "#9B9A97" : "#374151", padding: "4px 0", boxSizing: "border-box" }}>
                    {scale === "day" ? <>{format(c.d, "EEEEE", { locale: fr })}<br />{format(c.d, "d")}</> : <>S{format(c.d, "I")}<br />{format(c.d, "d/MM")}</>}
                  </div>
                ))}
              </div>
            </div>

            {/* Week-ends grisés (vue jours) */}
            {scale === "day" && cols.map((c, i) => c.weekend && (
              <div key={`we${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: LABEL_W + i * colW, width: colW, background: "rgba(17,24,39,0.03)", pointerEvents: "none", zIndex: 0 }} />
            ))}

            {/* Tissus : un repère par date (nombre de tissus), reçus en bleu nuit, attendus en bleu clair,
                attendus en retard (DLE dépassée) cerclés de rouge. Détail au survol. */}
            {fabricsAll.length > 0 && (() => {
              const pill = (fs, key) => {
                const allIn = fs.every((f) => f.received);
                const late = fs.some((f) => !f.received && f.date < today0);
                return (
                  <div key={key} style={{ minWidth: 22, height: 22, padding: "0 5px", boxSizing: "border-box", borderRadius: 99, background: allIn ? NAVY : PLAN, color: allIn ? "white" : "#111827", border: late ? "2px solid #DC2626" : "none", fontSize: 10.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}
                    onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ x: r.left + r.width / 2, y: r.bottom + 6, items: fs }); }}
                    onMouseLeave={() => setTip(null)}>
                    {fs.length}
                  </div>
                );
              };
              const gridRow = (list) => (
                <div style={{ display: "flex", width: gridW }}>
                  {cols.map((c, i) => {
                    const fs = list.filter((f) => f.date && c.keys.includes(dayKey(f.date)));
                    return <div key={i} style={{ width: colW, flexShrink: 0, display: "flex", justifyContent: "center" }}>{fs.length > 0 && pill(fs, i)}</div>;
                  })}
                </div>
              );
              const sub = `${nReceived} reçu${nReceived > 1 ? "s" : ""} sur ${fabricsAll.length}${nLate ? ` · ${nLate} en retard` : ""}${nNoDate ? ` · ${nNoDate} sans DLE` : ""}`;
              return (
                <>
                  {/* Tissus : pastille = nombre de tissus à la date (reçus en bleu nuit, attendus en bleu clair,
                      DLE dépassée cerclée de rouge) ; détail au survol. Dépliable : tissus encore à recevoir. */}
                  <div style={{ display: "flex", borderBottom: `1px solid ${LINE}`, minHeight: 52, alignItems: "center", background: "white" }}>
                    {labelCell({ label: "Tissus", sub, onToggle: toReceive.length ? () => setExpanded((x) => ({ ...x, tissus: !x.tissus })) : null, open: expanded.tissus })}
                    {gridRow(fabrics)}
                  </div>
                  {expanded.tissus && toReceive.map((f, i) => {
                    const st = fabricStatus(f);
                    return (
                      <div key={`t${i}`} style={{ display: "flex", borderBottom: `1px solid ${LINE}`, minHeight: 34, alignItems: "center", background: "#FAFAF9" }}>
                        {labelCell({ label: fabricLabel(f.line), sub: <span style={{ color: st.color, fontWeight: st.color === MUTED ? 400 : 600 }}>{st.text}</span>, child: true })}
                        {gridRow([f])}
                      </div>
                    );
                  })}
                </>
              );
            })()}

            {SERVICES.map((s) => {
              const d = data[s.key];
              const b = Number(budget[s.key]) || 0;
              const sub = budgetSub(d.done, d.planned, b);
              const people = Object.entries(d.people).sort((a, b2) => userName(a[0]).localeCompare(userName(b2[0]), "fr"));
              const canOpen = s.expandable && people.length > 0;
              return (
                <React.Fragment key={s.key}>
                  {row(s.key, s.label, sub, d.days, {
                    weeks: s.key === "conf" ? d.weeks : null,
                    onToggle: canOpen ? () => setExpanded((x) => ({ ...x, [s.key]: !x[s.key] })) : null,
                    open: expanded[s.key],
                  })}
                  {canOpen && expanded[s.key] && people.map(([id, p]) => row(`${s.key}:${id}`, userName(id), `${fmtH(p.done)} consommées · prévu ${fmtH(p.planned)}`, p.days, { child: true }))}
                </React.Fragment>
              );
            })}

            {/* Repères : aujourd'hui, livraison, phases */}
            {markers.map((m, i) => {
              const x = xOf(m.date);
              if (x < 0 || x > gridW) return null;
              return (
                <div key={`m${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: LABEL_W + x + (scale === "day" ? colW / 2 : 0), width: 0, borderLeft: `2px ${m.label === "Aujourd'hui" ? "solid" : "dashed"} ${m.color}`, zIndex: 3, pointerEvents: "none" }}>
                  <span style={{ position: "absolute", bottom: 6, left: 4, fontSize: 10, fontWeight: 600, color: m.color, background: "white", padding: "0 4px", borderRadius: 4, whiteSpace: "nowrap" }}>{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {tip && (
        <div style={{ position: "fixed", left: Math.min(tip.x, window.innerWidth - 180), top: tip.y, transform: "translateX(-50%)", zIndex: 2000, background: "#111827", color: "white", borderRadius: 8, padding: "8px 10px", fontSize: 12, lineHeight: 1.5, boxShadow: "0 8px 20px rgba(0,0,0,.2)", maxWidth: 340, pointerEvents: "none", fontFamily: "Roboto, system-ui, sans-serif" }}>
          {tip.items.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <span style={{ fontWeight: 500 }}>{fabricLabel(f.line)}</span>
              <span style={{ color: f.received ? "#A8C2EC" : f.date < today0 ? "#FCA5A5" : "#D1D5DB", whiteSpace: "nowrap" }}>{f.received ? `reçu ${format(f.date, "dd/MM")}` : `DLE ${format(f.date, "dd/MM")}`}</span>
            </div>
          ))}
        </div>
      )}
    </DaDialog>
  );
}
