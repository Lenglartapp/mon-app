import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const AssistantView = ({ stats }) => {
    return (
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                        <tr>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Projet</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Deadline</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Budget (h)</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Planifié (h)</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Progression</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>État</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.map(proj => (
                            <tr key={proj.id} style={{ borderBottom: '1px solid #F3F4F6', background: proj.status === 'late' ? '#FEF2F2' : 'white' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>
                                    {proj.name}
                                    <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 400 }}>{proj.manager || "Non assigné"}</div>
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>
                                    {proj.deadline ? format(new Date(proj.deadline), 'dd MMM yyyy', { locale: fr }) : '-'}
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{proj.totalSold}h</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', color: proj.totalPlanned > proj.totalSold ? '#EF4444' : '#111827' }}>
                                    {proj.totalPlanned}h
                                </td>
                                <td style={{ padding: '12px 16px', width: 120 }}>
                                    <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.min(proj.progress, 100)}%`, height: '100%', background: proj.progress > 100 ? '#EF4444' : '#10B981', transition: 'width 0.3s' }} />
                                    </div>
                                    <div style={{ textAlign: 'center', fontSize: 11, color: '#6B7280', marginTop: 4 }}>{Math.round(proj.progress)}%</div>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                    {proj.status === 'late' && <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>EN RETARD</span>}
                                    {proj.status === 'warning' && <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>SURCHARGE</span>}
                                    {proj.status === 'ok' && <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>OK</span>}
                                </td>
                            </tr>
                        ))}
                        {stats.length === 0 && (
                            <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>Aucun projet actif.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AssistantView;
