// src/lib/planning/internalProject.js
//
// Le dossier « Interne Lenglart » recueille le temps qui n'appartient à aucun dossier
// client : prototype, étude interne, ouvrage caritatif, prise de cotes anticipée sur une
// affaire pas encore ouverte… Chaque créneau y est rangé sous un CHAPITRE libre
// (« prototype bambou », « Fab Lab »…), ce qui permet de savoir combien d'heures ont été
// passées, sur quoi et sur quelle période.
//
// Choix d'architecture : c'est un dossier NORMAL de la table `projects`. Du coup tous les
// calculs existants (computeProjectHours, jauges de charge, filtres du planning) marchent
// sans une ligne de code dédiée, et transférer plus tard ces heures vers un vrai dossier
// se réduit à changer le dossier rattaché au créneau.
//
// Aucune migration de base : tout loge dans des colonnes JSONB déjà présentes.
//   projects.config.isInternal        → le marqueur
//   projects.config.internalChapters  → [{ name, status: 'active' | 'done' }]
//   events.meta.internalChapter       → le chapitre porté par un créneau
//
// Ce dossier n'a pas d'heures vendues : il ne doit jamais être comparé à un budget ni
// entrer dans une mesure de rentabilité. Ses heures comptent en revanche normalement
// dans la charge des personnes (un prototype occupe l'atelier comme un chantier).

import { uid } from '../utils/uid';
import { netHoursOfEvent, serviceOfEventType } from '../projectMetrics';

export const INTERNAL_PROJECT_NAME = 'Interne Lenglart';

export const isInternalProject = (project) =>
    !!project && (project.config?.isInternal === true || project.name === INTERNAL_PROJECT_NAME);

export const findInternalProject = (projects) =>
    (projects || []).find(isInternalProject) || null;

// --- CHAPITRES ---

// Deux graphies d'un même chapitre doivent s'additionner : le planning a déjà produit
// « lenglart » et « LENGLART » côte à côte, comptés comme deux choses différentes.
export const normalizeChapter = (name) => String(name || '').trim().replace(/\s+/g, ' ');
export const sameChapter = (a, b) =>
    normalizeChapter(a).toLowerCase() === normalizeChapter(b).toLowerCase();

export const getChapters = (project) =>
    Array.isArray(project?.config?.internalChapters) ? project.config.internalChapters : [];

// Chapitres proposés à la saisie : on ne suggère que le travail EN COURS, sinon la liste
// s'allonge indéfiniment avec les années. Un chapitre terminé (ou transféré vers un
// dossier) sort des suggestions — mais ses heures restent dans le suivi pour toujours.
export const getActiveChapters = (project) =>
    getChapters(project).filter(c => c.status !== 'done');

// Renvoie le `config` à enregistrer si le chapitre est nouveau, sinon null (rien à écrire).
export const configWithChapter = (project, rawName) => {
    const name = normalizeChapter(rawName);
    if (!name) return null;
    const chapters = getChapters(project);
    if (chapters.some(c => sameChapter(c.name, name))) return null;
    return {
        ...(project?.config || {}),
        isInternal: true,
        internalChapters: [...chapters, { name, status: 'active' }],
    };
};

export const setChapterStatus = (project, name, status) => ({
    ...(project?.config || {}),
    isInternal: true,
    internalChapters: getChapters(project).map(c => sameChapter(c.name, name) ? { ...c, status } : c),
});

// Après un transfert, le chapitre n'a plus de créneaux internes : il disparaît donc du
// tableau (qui ne liste que ce qui a des heures) et sort des suggestions.
// Le détail du transfert reste écrit sur le chapitre (dossier, date, volume déplacé) :
// rien ne l'affiche aujourd'hui, mais ces heures ne seraient plus recalculables une fois
// parties, donc les perdre serait irréversible.
export const configWithTransfer = (project, name, target, moved = {}) => ({
    ...(project?.config || {}),
    isInternal: true,
    internalChapters: getChapters(project).map(c => sameChapter(c.name, name)
        ? {
            ...c,
            status: 'done',
            transferredTo: target?.id || null,
            transferredToName: target?.name || '',
            transferredAt: new Date().toISOString(),
            transferredHours: Math.round(((moved.done || 0) + (moved.planned || 0)) * 10) / 10,
            transferredCount: moved.count || 0,
        }
        : c),
});

// Totaux d'un ensemble de créneaux — sert au récapitulatif avant transfert ET à la trace.
export const totalsOfEvents = (events) => (events || []).reduce((acc, evt) => {
    const h = netHoursOfEvent(evt);
    if (evt.meta?.status === 'validated') acc.done += h; else acc.planned += h;
    acc.count += 1;
    return acc;
}, { done: 0, planned: 0, count: 0 });

// --- SUIVI DES HEURES ---

// Heures internes ventilées par chapitre, sur une période optionnelle.
// Un créneau validé compte comme réalisé, sinon comme encore programmé — même règle que
// pour les dossiers clients, pour que les deux chiffres se lisent de la même façon.
// `from`/`to` sont des dates ISO (yyyy-mm-dd) incluses, ou null pour « depuis toujours ».
const emptyByService = () => ({ prepa: 0, conf: 0, pose: 0, total: 0 });

export const computeChapterStats = (project, events, { from = null, to = null, service = '' } = {}) => {
    const rows = new Map();
    const known = getChapters(project);
    const statusOf = (name) => known.find(c => sameChapter(c.name, name))?.status || 'active';
    const newRow = (name) => ({ name, status: statusOf(name), done: emptyByService(), planned: emptyByService(), count: 0 });

    // La liste ne contient QUE les chapitres ayant des heures dans le filtre courant :
    // afficher un chapitre à 0 h sur une période où il n'existait pas (ou dans un service
    // qui n'est pas le sien) fausse la lecture — et le compteur « Chapitres » avec.
    (events || []).forEach(evt => {
        if (!project?.id || evt.meta?.projectId !== project.id) return;
        const svc = serviceOfEventType(evt.type);
        if (!svc) return;                       // absences, fermetures : hors suivi
        if (service && svc !== service) return; // filtre par service

        const day = (evt.meta?.start || evt.date || '').slice(0, 10);
        if (from && day && day < from) return;
        if (to && day && day > to) return;

        const name = normalizeChapter(evt.meta?.internalChapter) || 'Sans chapitre';
        const key = name.toLowerCase();
        if (!rows.has(key)) rows.set(key, newRow(name));

        const row = rows.get(key);
        const bucket = evt.meta?.status === 'validated' ? row.done : row.planned;
        const h = netHoursOfEvent(evt);
        bucket[svc] += h;
        bucket.total += h;
        row.count += 1;
    });

    const list = [...rows.values()].sort((a, b) => (b.done.total + b.planned.total) - (a.done.total + a.planned.total));
    const totals = list.reduce((acc, r) => {
        ['prepa', 'conf', 'pose', 'total'].forEach(k => {
            acc.done[k] += r.done[k];
            acc.planned[k] += r.planned[k];
        });
        return acc;
    }, { done: emptyByService(), planned: emptyByService() });

    return { chapters: list, totals };
};

// Créneaux internes d'un chapitre — la matière que le transfert va déplacer.
export const eventsOfChapter = (project, events, chapterName) =>
    (events || []).filter(evt =>
        project?.id && evt.meta?.projectId === project.id
        && sameChapter(evt.meta?.internalChapter, chapterName)
    );

// Dossier créé à la volée à la première utilisation : personne n'a à le créer à la main.
// Budgets à zéro — il n'a rien de vendu, c'est un collecteur.
export const buildInternalProject = () => ({
    id: uid(),
    name: INTERNAL_PROJECT_NAME,
    status: 'IN_PROGRESS',
    manager: '',
    budget: { prepa: 0, conf: 0, pose: 0 },
    config: { isInternal: true, internalChapters: [] },
    rows: [],
});
