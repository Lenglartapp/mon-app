// Données du tableau de bord Inventaire : tissus à recevoir (tous projets) et fenêtres ouvertes.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { readOpenCourseLines } from '../../../lib/odoo/courseLinesClient';
import { computeDeliveryAlerts } from '../../../lib/stock/deliveryAlerts';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';

/** Lit les tissus à recevoir (tous projets) à l'ouverture du tableau de bord et calcule les alertes. */
export function useDeliveryAlerts(projects, events) {
    const online = useNetworkStatus();
    const [lines, setLines] = useState(null); // null = pas encore lu
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!online) return undefined;
        let alive = true;
        readOpenCourseLines()
            .then((l) => { if (alive) { setLines(l); setError(null); } })
            .catch((e) => { if (alive) setError(e?.message || String(e)); });
        return () => { alive = false; };
    }, [online]);
    const result = useMemo(
        () => (lines ? computeDeliveryAlerts({ lines, projects, events, today: new Date() }) : null),
        [lines, projects, events]
    );
    return { online, loading: online && !lines && !error, error, result };
}

/** État partagé du tableau de bord : liste filtrée + liste de courses ouverte. */
export function useDeliveryDialogs() {
    const [listFilter, setListFilter] = useState(null); // null = fermée
    const [courseProject, setCourseProject] = useState(null);
    const openList = useCallback((f) => setListFilter({ level: null, ...f }), []);
    const openItem = useCallback((item) => setCourseProject(item.project), []);
    return { listFilter, setListFilter, courseProject, setCourseProject, openList, openItem };
}
