// Origine du projet, à côté de « Créé le » : « via projet vierge », « via import du devis »
// ou « via commande Odoo S00123 », en petit italique gris ; le détail (qui, quel devis) au survol.
import React, { useEffect, useState } from 'react';
import { fetchProjectEvents, PROJECT_EVENTS_CHANGED } from '../../lib/projectEvents';
import { originOf } from '../../lib/projectOrigin';

export default function ProjectOriginNote({ project }) {
    const [origin, setOrigin] = useState(null);
    useEffect(() => {
        if (!project?.id) return undefined;
        let alive = true;
        const load = () => fetchProjectEvents(project).then(({ events }) => {
            if (alive) setOrigin(originOf(events.find((e) => e.type === 'created')));
        }).catch(() => {});
        load();
        window.addEventListener(PROJECT_EVENTS_CHANGED, load);
        return () => { alive = false; window.removeEventListener(PROJECT_EVENTS_CHANGED, load); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project?.id]);

    if (!origin) return null;
    return (
        <span
            title={origin.detail}
            style={{ fontSize: 12, fontWeight: 400, fontStyle: 'italic', color: 'var(--df-faint-2)', whiteSpace: 'nowrap', cursor: 'default' }}
        >
            {origin.short}
        </span>
    );
}
