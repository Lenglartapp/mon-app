import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const GROUP_LABELS = { prepa: 'Préparation', conf: 'Atelier Confection', pose: 'Équipes de Pose' };

const ResourcePanel = ({
    isOpen, onClose,
    users, hiddenResources, onToggleVisibility, onAddAbsence,
    missions = [], closures = [],
    onCreateMission, onEndMission, onUpdateMissionEnd,
    onAddClosure, onDeleteClosure,
}) => {
    const [activeTab, setActiveTab] = useState('equipe');

    // --- Absence state ---
    const [selectedUserForAbsence, setSelectedUserForAbsence] = useState(null);
    const [selectedGroupForAbsence, setSelectedGroupForAbsence] = useState(null);
    const [absType, setAbsType] = useState('Congés');
    const [absStart, setAbsStart] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [absStartTime, setAbsStartTime] = useState('08:00');
    const [absEnd, setAbsEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [absEndTime, setAbsEndTime] = useState('17:00');

    // --- Mission state ---
    const [creatingMissionFor, setCreatingMissionFor] = useState(null);
    const [missionRealName, setMissionRealName] = useState('');
    const [missionStart, setMissionStart] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [missionEnd, setMissionEnd] = useState('');
    const [editingEndFor, setEditingEndFor] = useState(null); // missionId
    const [editingEndDate, setEditingEndDate] = useState('');

    // --- Closure state ---
    const [showClosureForm, setShowClosureForm] = useState(false);
    const [closureLabel, setClosureLabel] = useState('');
    const [closureStart, setClosureStart] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [closureEnd, setClosureEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

    if (!isOpen) return null;

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const groupedUsers = {
        prepa: users.filter(u => u.role === 'prepa'),
        conf: users.filter(u => u.role === 'conf'),
        pose: users.filter(u => u.role === 'pose'),
    };

    const getActiveMission = (userId) =>
        missions.find(m => {
            if (m.resourceId !== userId || m.type !== 'mission' || m.meta?.status === 'ended') return false;
            const mStart = m.meta?.start ? format(new Date(m.meta.start), 'yyyy-MM-dd') : null;
            const mEnd   = m.meta?.end   ? format(new Date(m.meta.end),   'yyyy-MM-dd') : null;
            if (!mStart) return false;
            return mStart <= todayStr && (!mEnd || mEnd >= '2099' || mEnd >= todayStr);
        });

    // ── Handlers ──

    const handleCreateAbsence = () => {
        if (selectedGroupForAbsence) {
            groupedUsers[selectedGroupForAbsence].forEach(u =>
                onAddAbsence(u.id, absType, absStart, absStartTime, absEnd, absEndTime)
            );
            setSelectedGroupForAbsence(null);
        } else if (selectedUserForAbsence) {
            onAddAbsence(selectedUserForAbsence, absType, absStart, absStartTime, absEnd, absEndTime);
            setSelectedUserForAbsence(null);
        }
        setAbsType('Congés');
        setAbsStart(format(new Date(), 'yyyy-MM-dd'));
        setAbsStartTime('08:00');
        setAbsEnd(format(new Date(), 'yyyy-MM-dd'));
        setAbsEndTime('17:00');
    };

    const handleStartMission = () => {
        if (!missionRealName.trim() || !creatingMissionFor) return;
        onCreateMission(creatingMissionFor, missionRealName.trim(), missionStart, missionEnd || null);
        setCreatingMissionFor(null);
        setMissionRealName('');
        setMissionStart(format(new Date(), 'yyyy-MM-dd'));
        setMissionEnd('');
    };

    const handleAddClosure = () => {
        if (!closureLabel.trim()) return;
        onAddClosure(closureLabel.trim(), closureStart, closureEnd);
        setShowClosureForm(false);
        setClosureLabel('');
        setClosureStart(format(new Date(), 'yyyy-MM-dd'));
        setClosureEnd(format(new Date(), 'yyyy-MM-dd'));
    };

    // ── Member card ──

    const renderMember = (user) => {
        const isVisible = !hiddenResources.includes(user.id);
        const isInterim = user.first_name?.startsWith('Interim') || user.is_interim;
        const activeMission = isInterim ? getActiveMission(user.id) : null;
        const isCreating = creatingMissionFor === user.id;

        const displayName = activeMission
            ? activeMission.title
            : `${user.first_name || ''} ${user.last_name || ''}`.trim();

        return (
            <div key={user.id} style={{
                background: 'white', border: '1px solid #E5E7EB', borderRadius: 8,
                padding: '11px 13px', opacity: isVisible ? 1 : 0.55, marginBottom: 8,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Avatar + info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center',
                            fontWeight: 700, fontSize: 13,
                            background: !isVisible ? '#F3F4F6' : activeMission ? '#FEF3C7' : isInterim ? '#FEF9C3' : '#DBEAFE',
                            color: !isVisible ? '#9CA3AF' : activeMission ? '#D97706' : isInterim ? '#D97706' : '#1E40AF',
                        }}>
                            {displayName[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>{displayName}</span>
                                <span style={{
                                    fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700,
                                    background: isInterim ? (activeMission ? '#FEF3C7' : '#F3F4F6') : '#EFF6FF',
                                    color: isInterim ? (activeMission ? '#B45309' : '#6B7280') : '#1D4ED8',
                                    border: `1px solid ${isInterim ? (activeMission ? '#FCD34D' : '#E5E7EB') : '#BFDBFE'}`,
                                }}>
                                    {isInterim ? (activeMission ? 'EN MISSION' : 'DISPONIBLE') : 'CDI'}
                                </span>
                            </div>
                            {isInterim && activeMission && (
                                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
                                    Slot {user.first_name} · {format(new Date(activeMission.meta?.start), 'dd/MM')}
                                    {activeMission.meta?.end && !activeMission.meta.end.startsWith('2099') ? ` → ${format(new Date(activeMission.meta.end), 'dd/MM')}` : ' → en cours'}
                                </div>
                            )}
                            {!isInterim && (
                                <div style={{ fontSize: 11, color: isVisible ? '#10B981' : '#9CA3AF' }}>
                                    {isVisible ? 'Actif' : 'Désactivé'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <button
                            onClick={() => { setActiveTab('dispos'); setSelectedUserForAbsence(user.id); setSelectedGroupForAbsence(null); }}
                            title="Déclarer absence"
                            style={{ padding: 5, borderRadius: 5, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', color: '#EF4444' }}
                        >
                            <CalendarIcon size={13} />
                        </button>

                        {isInterim && !activeMission && !isCreating && (
                            <button
                                onClick={() => { setCreatingMissionFor(user.id); setMissionStart(format(new Date(), 'yyyy-MM-dd')); }}
                                style={{ padding: '4px 8px', borderRadius: 5, border: 'none', background: '#F59E0B', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                            >
                                + Mission
                            </button>
                        )}
                        {isInterim && activeMission && (
                            <>
                                <button
                                    onClick={() => {
                                        setEditingEndFor(activeMission.id);
                                        const currentEnd = activeMission.meta?.end;
                                        setEditingEndDate(currentEnd && !currentEnd.startsWith('2099') ? format(new Date(currentEnd), 'yyyy-MM-dd') : '');
                                    }}
                                    style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #D1D5DB', background: 'white', color: '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Modifier fin
                                </button>
                                <button
                                    onClick={() => onEndMission(activeMission.id)}
                                    style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #FCD34D', background: 'white', color: '#92400E', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Terminer
                                </button>
                            </>
                        )}

                        {!isInterim && (
                            <button
                                onClick={() => onToggleVisibility(user.id)}
                                title={isVisible ? 'Désactiver' : 'Activer'}
                                style={{ width: 34, height: 19, borderRadius: 999, background: isVisible ? '#10B981' : '#E5E7EB', position: 'relative', border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
                            >
                                <div style={{ width: 15, height: 15, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: isVisible ? 17 : 2, transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Edit mission end date */}
                {isInterim && activeMission && editingEndFor === activeMission.id && (
                    <div style={{ marginTop: 10, padding: 10, background: '#F9FAFB', borderRadius: 6, border: '1px solid #E5E7EB' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Modifier la date de fin</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6B7280', marginBottom: 2 }}>Nouvelle fin (vide = en cours)</label>
                                <input type="date" value={editingEndDate} onChange={e => setEditingEndDate(e.target.value)}
                                    style={{ width: '100%', padding: '5px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #D1D5DB' }} />
                            </div>
                            <button onClick={() => setEditingEndFor(null)}
                                style={{ padding: '5px 10px', border: '1px solid #D1D5DB', borderRadius: 4, background: 'white', fontSize: 11, cursor: 'pointer' }}>
                                Annuler
                            </button>
                            <button onClick={() => {
                                onUpdateMissionEnd(activeMission.id, editingEndDate || null);
                                setEditingEndFor(null);
                            }}
                                style={{ padding: '5px 10px', border: 'none', borderRadius: 4, background: '#111827', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                Valider
                            </button>
                        </div>
                    </div>
                )}

                {/* Mission creation form */}
                {isCreating && (
                    <div style={{ marginTop: 10, padding: 10, background: '#FFFBEB', borderRadius: 6, border: '1px solid #FCD34D' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>Nouvelle mission</div>
                        <input
                            value={missionRealName}
                            onChange={e => setMissionRealName(e.target.value)}
                            placeholder="Prénom Nom de la personne"
                            autoFocus
                            style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #FCD34D', marginBottom: 7, boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#92400E', marginBottom: 2 }}>Début</label>
                                <input type="date" value={missionStart} onChange={e => setMissionStart(e.target.value)}
                                    style={{ width: '100%', padding: '5px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #FCD34D' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#92400E', marginBottom: 2 }}>Fin (optionnel)</label>
                                <input type="date" value={missionEnd} onChange={e => setMissionEnd(e.target.value)}
                                    style={{ width: '100%', padding: '5px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #FCD34D' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setCreatingMissionFor(null)}
                                style={{ flex: 1, padding: '5px 0', border: '1px solid #D1D5DB', borderRadius: 4, background: 'white', fontSize: 11, cursor: 'pointer' }}>
                                Annuler
                            </button>
                            <button onClick={handleStartMission} disabled={!missionRealName.trim()}
                                style={{ flex: 1, padding: '5px 0', border: 'none', borderRadius: 4, background: missionRealName.trim() ? '#F59E0B' : '#E5E7EB', color: missionRealName.trim() ? 'white' : '#9CA3AF', fontSize: 11, fontWeight: 600, cursor: missionRealName.trim() ? 'pointer' : 'not-allowed' }}>
                                Démarrer
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ── Absence form ──

    const selectedAbsenceTarget = selectedUserForAbsence || selectedGroupForAbsence;
    const absenceTargetLabel = selectedGroupForAbsence
        ? `Groupe — ${GROUP_LABELS[selectedGroupForAbsence]}`
        : users.find(u => u.id === selectedUserForAbsence) ? `${users.find(u => u.id === selectedUserForAbsence).first_name} ${users.find(u => u.id === selectedUserForAbsence).last_name || ''}`.trim()
        : null;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} />
            <div style={{ position: 'relative', width: 460, background: 'white', height: '100%', boxShadow: '-5px 0 25px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>

                {/* Header + Tabs */}
                <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Gérer l'équipe</h3>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                            <X size={22} color="#6B7280" />
                        </button>
                    </div>
                    <div style={{ display: 'flex' }}>
                        {[['equipe', 'Équipe'], ['dispos', 'Disponibilités']].map(([key, label]) => (
                            <button key={key} onClick={() => setActiveTab(key)} style={{
                                flex: 1, padding: '8px 0', border: 'none',
                                borderBottom: `2px solid ${activeTab === key ? '#111827' : 'transparent'}`,
                                background: 'transparent', fontSize: 13,
                                fontWeight: activeTab === key ? 700 : 500,
                                color: activeTab === key ? '#111827' : '#6B7280',
                                cursor: 'pointer', transition: 'all 0.15s',
                            }}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px' }}>

                    {/* ── ONGLET ÉQUIPE ── */}
                    {activeTab === 'equipe' && (
                        <div>
                            {Object.entries(groupedUsers).map(([role, members]) => (
                                <div key={role} style={{ marginBottom: 24 }}>
                                    <div style={{
                                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280',
                                        marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #F3F4F6',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}>
                                        <span>{GROUP_LABELS[role]} ({members.length})</span>
                                        <button
                                            onClick={() => { setActiveTab('dispos'); setSelectedGroupForAbsence(role); setSelectedUserForAbsence(null); }}
                                            style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, padding: '2px 7px', color: '#EF4444', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                                        >
                                            <CalendarIcon size={10} /> Absence groupe
                                        </button>
                                    </div>
                                    {members.map(u => renderMember(u))}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── ONGLET DISPONIBILITÉS ── */}
                    {activeTab === 'dispos' && (
                        <div>
                            {/* Section Absences */}
                            <div style={{ marginBottom: 28 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280', marginBottom: 12 }}>
                                    Congés &amp; Absences
                                </div>

                                {!selectedAbsenceTarget ? (
                                    /* Sélection cible */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        {Object.entries(groupedUsers).map(([role, members]) => (
                                            <button key={role}
                                                onClick={() => { setSelectedGroupForAbsence(role); setSelectedUserForAbsence(null); }}
                                                style={{ padding: '9px 12px', textAlign: 'left', border: '1px solid #E5E7EB', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 12, color: '#374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                            >
                                                <span>Tout le groupe — <strong>{GROUP_LABELS[role]}</strong></span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#9CA3AF', fontSize: 11 }}>
                                                    {members.length} pers. <ChevronRight size={12} />
                                                </div>
                                            </button>
                                        ))}
                                        <div style={{ height: 1, background: '#F3F4F6', margin: '4px 0' }} />
                                        {users.map(user => (
                                            <button key={user.id}
                                                onClick={() => { setSelectedUserForAbsence(user.id); setSelectedGroupForAbsence(null); }}
                                                style={{ padding: '9px 12px', textAlign: 'left', border: '1px solid #E5E7EB', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 12, color: '#374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                            >
                                                <span>{user.first_name} {user.last_name || ''}</span>
                                                <ChevronRight size={12} color="#9CA3AF" />
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    /* Formulaire absence */
                                    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: 14 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{absenceTargetLabel}</span>
                                            <button onClick={() => { setSelectedUserForAbsence(null); setSelectedGroupForAbsence(null); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 11 }}>
                                                ← Changer
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Type</label>
                                                <select value={absType} onChange={e => setAbsType(e.target.value)}
                                                    style={{ width: '100%', padding: 7, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }}>
                                                    <option>Congés</option>
                                                    <option>RTT</option>
                                                    <option>Maladie</option>
                                                    <option>Autre</option>
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', gap: 7 }}>
                                                <div style={{ flex: 2 }}>
                                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Date début</label>
                                                    <input type="date" value={absStart} onChange={e => setAbsStart(e.target.value)}
                                                        style={{ width: '100%', padding: 7, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Heure</label>
                                                    <input type="time" value={absStartTime} onChange={e => setAbsStartTime(e.target.value)}
                                                        style={{ width: '100%', padding: 7, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }} />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 7 }}>
                                                <div style={{ flex: 2 }}>
                                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Date fin (incluse)</label>
                                                    <input type="date" value={absEnd} onChange={e => setAbsEnd(e.target.value)}
                                                        style={{ width: '100%', padding: 7, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Heure</label>
                                                    <input type="time" value={absEndTime} onChange={e => setAbsEndTime(e.target.value)}
                                                        style={{ width: '100%', padding: 7, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }} />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 7, marginTop: 2 }}>
                                                <button onClick={() => { setSelectedUserForAbsence(null); setSelectedGroupForAbsence(null); }}
                                                    style={{ flex: 1, padding: 8, border: '1px solid #D1D5DB', borderRadius: 6, background: 'white', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                                                    Annuler
                                                </button>
                                                <button onClick={handleCreateAbsence}
                                                    style={{ flex: 1, padding: 8, border: 'none', borderRadius: 6, background: '#EF4444', color: 'white', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                                                    Valider
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section Fermetures annuelles */}
                            <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280' }}>
                                        Fermetures annuelles
                                    </span>
                                    {!showClosureForm && (
                                        <button onClick={() => setShowClosureForm(true)}
                                            style={{ background: '#111827', color: 'white', border: 'none', borderRadius: 4, padding: '3px 9px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                                            + Ajouter
                                        </button>
                                    )}
                                </div>

                                {closures.length === 0 && !showClosureForm && (
                                    <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '10px 0' }}>
                                        Aucune fermeture configurée
                                    </div>
                                )}

                                {closures.map(c => (
                                    <div key={c.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 10px', background: '#FEF2F2', border: '1px solid #FECACA',
                                        borderRadius: 6, marginBottom: 6,
                                    }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#991B1B' }}>{c.title}</div>
                                            <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                                                {c.meta?.start ? format(new Date(c.meta.start), 'dd/MM/yyyy') : '—'}
                                                {' → '}
                                                {c.meta?.end ? format(new Date(c.meta.end), 'dd/MM/yyyy') : '—'}
                                            </div>
                                        </div>
                                        <button onClick={() => onDeleteClosure(c.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
                                            <X size={13} />
                                        </button>
                                    </div>
                                ))}

                                {showClosureForm && (
                                    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: 14, marginTop: 4 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Libellé</label>
                                                <input value={closureLabel} onChange={e => setClosureLabel(e.target.value)}
                                                    placeholder="ex : Congés d'été, Fêtes de fin d'année…"
                                                    autoFocus
                                                    style={{ width: '100%', padding: 7, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: 7 }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Début</label>
                                                    <input type="date" value={closureStart} onChange={e => setClosureStart(e.target.value)}
                                                        style={{ width: '100%', padding: 7, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Fin</label>
                                                    <input type="date" value={closureEnd} onChange={e => setClosureEnd(e.target.value)}
                                                        style={{ width: '100%', padding: 7, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }} />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 7 }}>
                                                <button onClick={() => { setShowClosureForm(false); setClosureLabel(''); }}
                                                    style={{ flex: 1, padding: 8, border: '1px solid #D1D5DB', borderRadius: 6, background: 'white', fontSize: 12, cursor: 'pointer' }}>
                                                    Annuler
                                                </button>
                                                <button onClick={handleAddClosure} disabled={!closureLabel.trim()}
                                                    style={{ flex: 1, padding: 8, border: 'none', borderRadius: 6, background: closureLabel.trim() ? '#111827' : '#E5E7EB', color: closureLabel.trim() ? 'white' : '#9CA3AF', fontWeight: 600, fontSize: 12, cursor: closureLabel.trim() ? 'pointer' : 'not-allowed' }}>
                                                    Ajouter
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResourcePanel;
