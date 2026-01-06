import { useMemo } from 'react';
import { differenceInMinutes, isAfter, parseISO } from 'date-fns';

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
            // 1. Budget Vendu
            const budget = proj.budget || { prepa: 0, conf: 0, pose: 0 };
            const totalSold = (budget.prepa || 0) + (budget.conf || 0) + (budget.pose || 0);

            // 2. Planifié (Somme des events du projet)
            const projEvents = events.filter(e => e.meta?.projectId === proj.id && e.type !== 'absence');
            let totalPlanned = 0;
            let lastEventDate = null;

            projEvents.forEach(evt => {
                const start = new Date(evt.meta?.start || evt.date);
                const end = new Date(evt.meta?.end || evt.date);

                // Calcul Net (Règle 5h -> -1h pause)
                const rawMinutes = differenceInMinutes(end, start);
                const netMinutes = rawMinutes > 300 ? rawMinutes - 60 : rawMinutes;
                totalPlanned += Math.max(0, netMinutes / 60);

                // Tracking date max pour retard
                if (!lastEventDate || isAfter(end, lastEventDate)) {
                    lastEventDate = end;
                }
            });

            // 3. Statut
            let status = 'ok';
            if (totalPlanned > totalSold && totalSold > 0) status = 'warning';

            // Check Retard Deadline (si projet a une due date)
            if (proj.due && lastEventDate) {
                // Si le dernier event planifié dépasse la deadline du projet
                if (isAfter(lastEventDate, new Date(proj.due))) {
                    status = 'late';
                }
            }

            // Reste à faire
            const remaining = Math.max(0, totalSold - totalPlanned);
            const progress = totalSold > 0 ? (totalPlanned / totalSold) * 100 : 0;

            return {
                id: proj.id,
                name: proj.name,
                manager: proj.manager,
                deadline: proj.due,
                totalSold: Math.round(totalSold),
                totalPlanned: Math.round(totalPlanned),
                remaining: Math.round(remaining),
                progress: Math.round(progress),
                lastEventDate,
                status
            };
        }).sort((a, b) => {
            // Tri par urgence (Retard > Warning > Reste à faire décroissant)
            if (a.status === 'late') return -1;
            if (b.status === 'late') return 1;
            if (a.status === 'warning') return -1;
            if (b.status === 'warning') return 1;
            return b.remaining - a.remaining;
        });

        return { projectStats, absenceHoursByGroup };

    }, [projects, events]);
}
