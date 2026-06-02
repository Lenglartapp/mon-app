import { useMemo } from 'react';
import { differenceInMinutes, isAfter, parseISO } from 'date-fns';
import { computeProjectHours, calculateProjectStats } from '../lib/projectMetrics';

/**
 * Calcul la charge planifiée vs budget pour chaque projet.
 * @param {Array} projects 
 * @param {Array} events 
 * @param {Object} capacityConfig - { conf: number, pose: number } nombre de ressources (non utilisé ici directement, mais utile pour future projection)
 */
export function useCapacityPlanning(projects, events, capacityConfig = {}) {
    return useMemo(() => {
        if (!projects || !events) return { projectStats: [], globalCapacity: {} };

        // --- 1. CALCUL DES CAPACITÉS GLOBALES (Absences) ---
        // On suppose une semaine standard de 35h (7h/j) ou 39h/40h ? Ici on compte juste les heures d'absence
        // pour les déduire d'un total théorique si besoin, ou juste pour info.
        const absenceEvents = events.filter(e => e.type === 'absence');
        const absenceHoursByGroup = { conf: 0, pose: 0, prepa: 0 };

        absenceEvents.forEach(evt => {
            const start = new Date(evt.meta?.start || evt.date);
            const end = new Date(evt.meta?.end || evt.date);
            const durationMin = differenceInMinutes(end, start);
            // On convertit en heures (net ou brut ?) -> Absence = brut généralement
            const hours = durationMin / 60;

            // On ne sait pas le groupe de l'event directement ICI sauf si on avait la map resource -> group
            // MAIS on peut passer l'info ou ignorer le group for now.
            // Amélioration future : passer usersmap
            // Pour l'instant on stocke globalement ou on tente de deviner si on a le type ?
            // Les events absences n'ont pas de "type group" sauf si on l'a mis dans 'type'
            // Dans handleAddAbsence on met type: 'absence'.
            // On va accumuler globalement pour l'instant.
        });

        // --- 2. CALCUL PAR PROJET ---
        const projectStats = projects.map(proj => {
            // Heures par service — SOURCE UNIQUE partagée avec le dossier (projectMetrics)
            const hours = computeProjectHours(proj, events);
            const sum = (o) => Math.round((o.prepa || 0) + (o.conf || 0) + (o.pose || 0));

            const totalSold = sum(hours.budget);
            const totalConsumed = sum(hours.consumed);
            const totalFuture = sum(hours.planned);
            const remainingBudget = totalSold - totalConsumed;

            // Avancement réel — MÊME calcul que le dashboard du dossier
            const advancement = calculateProjectStats(proj.rows || []);

            // Date du dernier événement (pour le retard)
            let lastEventDate = null;
            events.forEach(evt => {
                if (evt.meta?.projectId !== proj.id || evt.type === 'absence') return;
                const end = new Date(evt.meta?.end || evt.date);
                if (!lastEventDate || isAfter(end, lastEventDate)) lastEventDate = end;
            });

            // Statut planning (alerte capacité / retard)
            let status = 'ok';
            const totalScheduled = totalConsumed + totalFuture;
            if (totalScheduled > totalSold && totalSold > 0) status = 'warning';
            if (proj.deadline && lastEventDate && isAfter(lastEventDate, new Date(proj.deadline))) {
                status = 'late';
            }

            // Détail par service (budget / consommé / planifié / restant), arrondi
            const byService = {};
            ['prepa', 'conf', 'pose'].forEach(s => {
                byService[s] = {
                    budget: Math.round(hours.budget[s] || 0),
                    consumed: Math.round(hours.consumed[s] || 0),
                    planned: Math.round(hours.planned[s] || 0),
                    remaining: Math.round((hours.budget[s] || 0) - (hours.consumed[s] || 0)),
                };
            });

            return {
                id: proj.id,
                name: proj.name,
                manager: proj.manager,
                deadline: proj.deadline,
                totalSold,
                totalConsumed,
                totalFuture,
                remainingBudget,
                byService,
                advancement, // { pctCotes, pctPrepa, pctConf, pctPose, cotesTotal, raw } ou null
                lastEventDate,
                schedulerStatus: status,
                projectStatus: proj.status || 'TODO'
            };
        }).sort((a, b) => {
            // Tri par urgence (Retard > Warning > Reste à faire décroissant)
            if (a.schedulerStatus === 'late' && b.schedulerStatus !== 'late') return -1;
            if (b.schedulerStatus === 'late' && a.schedulerStatus !== 'late') return 1;
            if (a.schedulerStatus === 'warning' && b.schedulerStatus !== 'warning') return -1;
            if (b.schedulerStatus === 'warning' && a.schedulerStatus !== 'warning') return 1;
            return b.remainingBudget - a.remainingBudget;
        });

        return { projectStats, absenceHoursByGroup };

    }, [projects, events]);
}
