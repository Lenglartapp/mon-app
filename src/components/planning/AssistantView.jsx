import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const PROJECT_STATUS_OPTIONS = {
    TODO: { label: "À commencer", color: "#6B7280", bg: "#F3F4F6" },
    IN_PROGRESS: { label: "En cours", color: "#3B82F6", bg: "#EFF6FF" },
    DONE: { label: "Terminé", color: "#10B981", bg: "#ECFDF5" },
    SAV: { label: "SAV", color: "#F59E0B", bg: "#FFFBEB" },
    ARCHIVED: { label: "Archivé", color: "#374151", bg: "#F9FAFB" }
};

const AssistantView = ({ stats, onUpdateProject }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'remainingBudget', direction: 'asc' });

    const sortedStats = useMemo(() => {
        let sortable = stats.filter(p => p.projectStatus !== 'ARCHIVED');
        if (sortConfig.key) {
            sortable.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];

                // Handle null/undefined (e.g. deadline)
                if (valA === undefined || valA === null) valA = sortConfig.key === 'deadline' ? '9999-99-99' : 0;
                if (valB === undefined || valB === null) valB = sortConfig.key === 'deadline' ? '9999-99-99' : 0;

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [stats, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortLabel = ({ label, sortKey }) => (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
            justifyContent: sortKey === 'projectStatus' ? 'center' : (sortKey === 'name' || sortKey === 'deadline' ? 'flex-start' : 'flex-end'),
            userSelect: 'none'
        }} onClick={() => handleSort(sortKey)}>
            {label}
            {sortConfig.key === sortKey ? (
                sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
            ) : <ArrowUpDown size={12} style={{ opacity: 0.3 }} />}
        </div>
    );

    return (
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                        <tr>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', userSelect: 'none' }}>
                                Nom du Dossier
                            </th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', userSelect: 'none' }}>
                                <SortLabel label="Deadline" sortKey="deadline" />
                            </th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', userSelect: 'none' }}>
                                <SortLabel label="Statut" sortKey="projectStatus" />
                            </th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', userSelect: 'none' }}>
                                <SortLabel label="Budget (h)" sortKey="totalSold" />
                            </th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', userSelect: 'none' }}>
                                <SortLabel label="Conso. (h)" sortKey="totalConsumed" />
                            </th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', userSelect: 'none' }}>
                                <SortLabel label="Restant (h)" sortKey="remainingBudget" />
                            </th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', userSelect: 'none' }}>
                                <SortLabel label="Planifié (h)" sortKey="totalFuture" />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedStats.map(proj => {
                            const statusOpt = PROJECT_STATUS_OPTIONS[proj.projectStatus] || PROJECT_STATUS_OPTIONS.TODO;
                            return (
                                <tr key={proj.id} style={{ borderBottom: '1px solid #F3F4F6', background: 'white' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>
                                        {proj.name}
                                        <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 400 }}>{proj.manager || "Non assigné"}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>
                                        {proj.deadline ? format(new Date(proj.deadline), 'dd MMM yyyy', { locale: fr }) : '-'}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                        <div style={{ position: 'relative', display: 'inline-block' }}>
                                            <select
                                                value={proj.projectStatus || "TODO"}
                                                onChange={(e) => onUpdateProject && onUpdateProject(proj.id, { status: e.target.value })}
                                                style={{
                                                    appearance: 'none',
                                                    padding: "4px 12px 4px 24px",
                                                    borderRadius: 20,
                                                    border: "1px solid #E5E7EB",
                                                    background: 'white',
                                                    color: "#374151",
                                                    fontWeight: 600,
                                                    fontSize: 11,
                                                    cursor: 'pointer',
                                                    textAlign: 'center',
                                                    outline: 'none',
                                                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                                    minWidth: 100
                                                }}
                                            >
                                                {Object.entries(PROJECT_STATUS_OPTIONS).map(([key, opt]) => (
                                                    <option key={key} value={key}>{opt.label}</option>
                                                ))}
                                            </select>
                                            <div style={{
                                                position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)',
                                                width: 6, height: 6, borderRadius: '50%',
                                                background: statusOpt.color,
                                                pointerEvents: 'none'
                                            }} />
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>{proj.totalSold}h</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#6B7280' }}>
                                        {proj.totalConsumed}h
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: proj.remainingBudget < 0 ? '#EF4444' : '#10B981' }}>
                                        {proj.remainingBudget}h
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#111827' }}>
                                        {proj.totalFuture}h
                                    </td>
                                </tr>
                            );
                        })}
                        {sortedStats.length === 0 && (
                            <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>Aucun projet actif.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AssistantView;
