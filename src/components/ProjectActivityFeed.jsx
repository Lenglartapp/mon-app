import React, { useMemo } from 'react';
import { Clock, MessageSquare, CheckCircle, Edit, ArrowRight } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns'; // Ajout de 'format'
import { fr } from 'date-fns/locale';
import { COLORS } from '../lib/constants/ui';

const extractActivity = (rows) => {
    if (!Array.isArray(rows)) return [];
    const allEvents = [];

    rows.forEach(row => {
        const rowName = `${row.produit || 'Ligne'} - ${row.piece || '?'}`;

        // 1. Commentaires (Nettoyés)
        if (Array.isArray(row.comments)) {
            row.comments.forEach(c => {
                if (c.text && typeof c.text === 'string' && c.text.startsWith('Modif')) {
                    return;
                }

                allEvents.push({
                    id: `com-${c.date}-${Math.random()}`,
                    date: c.date || Date.now(),
                    type: 'comment',
                    user: c.author || 'Utilisateur',
                    actionLabel: 'a commenté sur',
                    text: c.text,
                    rowName: rowName
                });
            });
        }

        // 2. Historique des modifications
        if (Array.isArray(row.history)) {
            row.history.forEach(h => {
                allEvents.push({
                    id: `hist-${h.date}-${Math.random()}`,
                    date: h.date,
                    type: 'modification',
                    user: h.author || 'Système',
                    actionLabel: 'a modifié',
                    text: (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            <b>{h.field}</b> :
                            <span style={{ color: '#ef4444', textDecoration: 'line-through', opacity: 0.8 }}>{h.oldVal}</span>
                            <ArrowRight size={12} color="#6b7280" />
                            <span style={{ color: '#10b981', fontWeight: 600 }}>{h.newVal}</span>
                        </span>
                    ),
                    rowName: rowName
                });
            });
        }

        // 3. Création
        if (row.created) {
            allEvents.push({
                id: `create-${row.id}`,
                date: row.created,
                type: 'creation',
                user: 'Système',
                actionLabel: 'a créé',
                text: 'Nouvelle ligne',
                rowName: rowName
            });
        }
    });

    return allEvents.sort((a, b) => b.date - a.date);
};

export default function ProjectActivityFeed({ rows }) {
    const events = useMemo(() => extractActivity(rows), [rows]);

    if (events.length === 0) return <div style={{ padding: 20, textAlign: 'center', color: '#888', fontStyle: 'italic' }}>Aucune activité récente.</div>;

    return (
        <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: 'hidden', maxHeight: 500, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}`, background: '#f9fafb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} /> Journal du Projet
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
                {events.map((evt) => {
                    const dateObj = new Date(evt.date);
                    return (
                        <div key={evt.id} style={{ padding: '12px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 12 }}>
                            <div style={{ marginTop: 4 }}>
                                {evt.type === 'comment' ? <MessageSquare size={16} color="#6366f1" /> :
                                    evt.type === 'modification' ? <Edit size={16} color="#f59e0b" /> :
                                        <CheckCircle size={16} color="#10b981" />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                    <span style={{ fontSize: 13, color: '#374151' }}>
                                        <span style={{ fontWeight: 600 }}>{evt.user}</span> {evt.actionLabel} <span style={{ fontWeight: 600 }}>{evt.rowName}</span>
                                    </span>
                                    {/* MODIFICATION ICI : Date absolue + relative */}
                                    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', marginLeft: 8 }}>
                                        {format(dateObj, 'dd/MM/yyyy HH:mm', { locale: fr })} ({formatDistanceToNow(dateObj, { addSuffix: true, locale: fr })})
                                    </span>
                                </div>
                                <div style={{ fontSize: 13, color: '#4b5563', marginTop: 2 }}>{evt.text}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
