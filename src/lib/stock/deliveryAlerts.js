// Alertes de livraison des tissus commandés (tableau de bord Inventaire) — logique PURE.
// Source : miroir de la liste de courses Odoo (odoo_course_lines). La DLE (date de livraison
// estimée) est saisie dans Odoo par les achats : Droitfil la lit, ne la modifie jamais.
// Droitfil remonte l'information ; les relances fournisseurs se traitent à part.

import { serviceOfEventType } from '../projectMetrics.js';

export const LEVELS = {
    late: { key: 'late', label: 'En retard', rank: 0 },
    tension: { key: 'tension', label: 'En tension', rank: 1 },
    nodate: { key: 'nodate', label: 'Sans date', rank: 2 },
    ok: { key: 'ok', label: 'À venir', rank: 3 },
};

export const OPEN_STATUTS = ['commande_passee', 'reception_partielle'];
const DONE_PROJECT = ['DONE', 'ARCHIVED', 'Livré'];
const DAY = 86400000;

// ── Dates au jour près, heure locale ─────────────────────────────────────────
/** « 2026-11-20 » (Odoo) ou ISO complet → minuit local ; null si vide / invalide. */
export function toDay(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v).trim());
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(v);
    return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
/** Écart en jours calendaires (b − a). */
export const daysBetween = (a, b) => Math.round((toDay(b) - toDay(a)) / DAY);
const pad = (n) => String(n).padStart(2, '0');
/** JJ/MM, ou JJ/MM/AAAA si l'année diffère de celle de `today`. */
export function fmtDay(d, today = new Date()) {
    const x = toDay(d);
    if (!x) return '—';
    const base = `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`;
    return x.getFullYear() === toDay(today).getFullYear() ? base : `${base}/${x.getFullYear()}`;
}

// ── Date de besoin d'un projet ───────────────────────────────────────────────
const evtDay = (e) => toDay(e.meta?.start || e.start_time || e.date);
const projectOf = (e) => e.meta?.projectId ?? e.project_id;

/**
 * PROCHAIN créneau de CONFECTION par projet, à partir d'aujourd'hui : blocs atelier et cartes du
 * Programme semaine (une carte compte dès le lundi de sa semaine ; semaine en cours → aujourd'hui).
 * Le tissu doit être là pour coudre : un RDV de métrage ou une pose ne déclenche pas d'alerte, et
 * sur un projet en plusieurs phases les créneaux déjà passés ne comptent plus. Absences exclues.
 * @returns Map projectId → Date
 */
export function nextConfectionByProject(events, today = new Date()) {
    const t0 = toDay(today);
    const out = new Map();
    for (const e of events || []) {
        const pid = projectOf(e);
        if (pid == null || e.type === 'absence') continue;
        const isBacklog = e.resourceId === 'backlog_confection' || e.meta?.isBacklogMaster;
        if (!isBacklog && serviceOfEventType(e.type) !== 'conf') continue;
        let d = evtDay(e);
        if (!d) continue;
        if (isBacklog) {
            const wd = d.getDay();
            const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (wd === 0 ? -6 : 1 - wd));
            const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
            if (sunday < t0) continue;
            d = monday < t0 ? t0 : monday;
        } else if (d < t0) continue;
        const key = String(pid);
        if (!out.has(key) || d < out.get(key)) out.set(key, d);
    }
    return out;
}

// ── Lignes concernées ────────────────────────────────────────────────────────
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
/**
 * Quantité commandée, reçue et reste à recevoir d'une ligne de courses.
 *  • Ligne d'achat pas encore reliée (commandé vide ou 0) : quantité de la liste.
 *  • Une ligne d'achat Odoo peut couvrir PLUSIEURS lignes de courses (ex. Smooth 110 + 500 + 90 =
 *    700 ml commandés : chaque ligne porte 700). Commandé > quantité de la ligne → la ligne prend
 *    sa quantité, et sa part du reçu au prorata.
 *  • Commandé < quantité de la ligne (commande réduite) : le commandé fait foi.
 */
export function remainingOf(l) {
    const qc = num(l.quantite_commandee) || 0;
    const q = num(l.quantite) || 0;
    const qr = Math.max(0, num(l.quantite_recue) || 0);
    let ordered; let received;
    if (!(qc > 0)) { ordered = q; received = qr; }
    else if (q > 0 && qc > q) { ordered = q; received = qr * (q / qc); }
    else { ordered = qc; received = qr; }
    const r2 = (n) => Math.round(n * 100) / 100;
    return { ordered: r2(ordered), received: r2(received), remaining: Math.max(0, r2(ordered - received)) };
}

const isFabric = (l) => l.type_produit === 'tissu' || !l.type_produit;

/** Libellé d'un tissu : « FOURNISSEUR · Référence coloris ». */
export const fabricLabel = (l) => [l.fournisseur, [l.reference, l.coloris].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Tissu';

function levelText(level, { gap, needIn }) {
    if (level === 'late') return `${gap} j de retard`;
    if (level === 'tension') return `arrive ${gap} j après le besoin`;
    if (level === 'nodate') {
        if (needIn === null) return 'pas de date';
        if (needIn > 0) return `pas de date, besoin dans ${needIn} j`;
        if (needIn === 0) return "pas de date, besoin aujourd'hui";
        return `pas de date, besoin dépassé de ${-needIn} j`;
    }
    return '';
}

/**
 * Classe chaque tissu commandé et pas encore entièrement reçu.
 * @param {{ lines, projects, events, today }} args
 * @returns {{ items, alerts, counts, quality }}
 *   items  : tous les tissus concernés (niveau compris « ok »), triés du plus grave au moins grave ;
 *   alerts : items hors « ok » ; counts : { late, tension, nodate, ok } ;
 *   quality: { total, withoutDle, bySupplier[], byProject[] } (tissus commandés sans DLE).
 */
export function computeDeliveryAlerts({ lines = [], projects = [], events = [], today = new Date() } = {}) {
    const t0 = toDay(today);
    const projById = new Map((projects || []).map((p) => [String(p.id), p]));
    const nextConf = nextConfectionByProject(events, t0);

    const items = [];
    for (const l of lines || []) {
        if (l.removed_from_odoo || !isFabric(l) || !OPEN_STATUTS.includes(l.statut)) continue;
        const project = projById.get(String(l.droitfil_project_id));
        if (!project || DONE_PROJECT.includes(project.status)) continue;
        const { ordered, received, remaining } = remainingOf(l);
        if (!(remaining > 0)) continue;

        const conf = nextConf.get(String(project.id)) || null;
        const deadline = toDay(project.deadline || project.due);
        const need = conf || deadline;
        const needSource = conf ? 'prochain créneau confection' : deadline ? 'livraison projet' : null;
        const dle = toDay(l.date_livraison_estimee);

        let level; let gap = null;
        if (dle && dle < t0) { level = 'late'; gap = daysBetween(dle, t0); }
        else if (dle && need && dle > need) { level = 'tension'; gap = daysBetween(need, dle); }
        else if (!dle) level = 'nodate';
        else level = 'ok';
        const needIn = need ? daysBetween(t0, need) : null;

        items.push({
            id: l.odoo_id, line: l, project, projectId: project.id, projectName: project.name || `Projet #${project.id}`,
            supplier: (l.fournisseur || '').trim() || 'Fournisseur inconnu', label: fabricLabel(l),
            ordered, received, remaining, partial: received > 0, unit: l.type_produit === 'tissu' || !l.unite ? 'ml' : l.unite,
            dle, need, needSource, needIn, level, gap, text: levelText(level, { gap, needIn }),
        });
    }

    const far = Number.POSITIVE_INFINITY;
    items.sort((a, b) => LEVELS[a.level].rank - LEVELS[b.level].rank
        || (a.dle ? +a.dle : far) - (b.dle ? +b.dle : far)
        || (a.need ? +a.need : far) - (b.need ? +b.need : far));

    const counts = { late: 0, tension: 0, nodate: 0, ok: 0 };
    items.forEach((i) => { counts[i.level]++; });

    const breakdown = (keyOf) => {
        const m = new Map();
        items.forEach((i) => {
            const k = keyOf(i);
            const e = m.get(k) || { name: k, without: 0, total: 0 };
            e.total++; if (!i.dle) e.without++;
            m.set(k, e);
        });
        return [...m.values()].filter((e) => e.without > 0)
            .sort((a, b) => b.without - a.without || b.without / b.total - a.without / a.total || a.name.localeCompare(b.name));
    };

    return {
        items,
        alerts: items.filter((i) => i.level !== 'ok'),
        counts,
        quality: { total: items.length, withoutDle: counts.nodate, bySupplier: breakdown((i) => i.supplier), byProject: breakdown((i) => i.projectName) },
    };
}

// ── Arrivées prochaines ──────────────────────────────────────────────────────
export const HORIZONS = [7, 14, 30];
const WEEKDAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const mondayOf = (d) => { const wd = d.getDay(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (wd === 0 ? -6 : 1 - wd)); };

/**
 * Tissus dont la DLE tombe entre aujourd'hui et aujourd'hui + horizon (inclus), groupés par jour
 * (horizon 7) ou par semaine (14, 30). Les tissus en retard n'y sont pas.
 * @returns [{ key, label, items, count, ml }]
 */
export function upcomingArrivals(items, { today = new Date(), horizon = 7 } = {}) {
    const t0 = toDay(today);
    const end = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + horizon);
    const byWeek = horizon > 7;
    const groups = new Map();
    (items || []).filter((i) => i.dle && i.dle >= t0 && i.dle <= end)
        .sort((a, b) => a.dle - b.dle || a.projectName.localeCompare(b.projectName))
        .forEach((i) => {
            const start = byWeek ? mondayOf(i.dle) : i.dle;
            const key = start.getTime();
            if (!groups.has(key)) {
                const label = byWeek ? `Semaine du ${fmtDay(start, today)}`
                    : daysBetween(t0, start) === 0 ? `Aujourd'hui ${fmtDay(start, today)}`
                    : daysBetween(t0, start) === 1 ? `Demain ${fmtDay(start, today)}`
                    : `${WEEKDAYS[start.getDay()]} ${fmtDay(start, today)}`;
                groups.set(key, { key, label, items: [], count: 0, ml: 0 });
            }
            const g = groups.get(key);
            g.items.push(i); g.count++; if (i.unit === 'ml') g.ml += i.remaining;
        });
    return [...groups.values()].map((g) => ({ ...g, ml: Math.round(g.ml * 10) / 10 }));
}
