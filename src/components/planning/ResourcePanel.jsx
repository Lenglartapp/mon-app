import { useState } from 'react';
import { X, Calendar as CalendarIcon, Settings, UserPlus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { productionGroup } from '../../lib/authz';
import { CONTRACT_TYPES } from './constants';

const GROUP_LABELS = { prepa: 'Préparation', conf: 'Atelier Confection', pose: 'Équipes de Pose' };

const CONTRACT_BADGE = {
    CDI:      { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    CDD:      { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
    'Intérim': { bg: '#FEF3C7', color: '#B45309', border: '#FCD34D' },
};

const ResourcePanel = ({
    isOpen, onClose,
    users, onAddAbsence,
    closures = [], archivedUsers = [],
    onAddClosure, onDeleteClosure,
    onAddMember, onReactivateMember, onUpdateContract, onDeleteMember,
}) => {
    // --- Absence state ---
    const [selectedUserForAbsence, setSelectedUserForAbsence] = useState(null);
    const [selectedGroupForAbsence, setSelectedGroupForAbsence] = useState(null);
    const [absType, setAbsType] = useState('Congés');
    const [absStart, setAbsStart] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [absStartTime, setAbsStartTime] = useState('08:00');
    const [absEnd, setAbsEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [absEndTime, setAbsEndTime] = useState('17:00');

    // --- Closure state ---
    const [showClosureForm, setShowClosureForm] = useState(false);
    const [closureLabel, setClosureLabel] = useState('');
    const [closureStart, setClosureStart] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [closureEnd, setClosureEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

    // --- Contract settings state (édition sur la fiche) ---
    const [contractSettingsFor, setContractSettingsFor] = useState(null);
    const [editType, setEditType] = useState('CDI');
    const [editStart, setEditStart] = useState('');
    const [editEnd, setEditEnd] = useState('');

    // --- Add member state ---
    const [addingMemberFor, setAddingMemberFor] = useState(null);
    const [newMemberFirstName, setNewMemberFirstName] = useState('');
    const [newMemberLastName, setNewMemberLastName] = useState('');
    const [newMemberContract, setNewMemberContract] = useState('CDI');
    const [newMemberStart, setNewMemberStart] = useState('');
    const [newMemberEnd, setNewMemberEnd] = useState('');
    const [rehireId, setRehireId] = useState(''); // id d'un archivé à reprendre

    if (!isOpen) return null;

    // On masque les membres archivés de la liste de gestion (ils restent en base + historique planning)
    const activeUsers = users.filter(u => !u.archived_at);
    const groupedUsers = {
        prepa: activeUsers.filter(u => productionGroup(u.role) === 'prepa'),
        conf: activeUsers.filter(u => productionGroup(u.role) === 'conf'),
        pose: activeUsers.filter(u => productionGroup(u.role) === 'pose'),
    };

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

    const handleAddClosure = () => {
        if (!closureLabel.trim()) return;
        onAddClosure(closureLabel.trim(), closureStart, closureEnd);
        setShowClosureForm(false);
        setClosureLabel('');
        setClosureStart(format(new Date(), 'yyyy-MM-dd'));
        setClosureEnd(format(new Date(), 'yyyy-MM-dd'));
    };

    const openContractSettings = (user) => {
        if (contractSettingsFor === user.id) {
            setContractSettingsFor(null);
            return;
        }
        setContractSettingsFor(user.id);
        setEditType(user.contract_type || 'CDI');
        setEditStart(user.contract_start_date || '');
        setEditEnd(user.contract_end_date || '');
    };

    const handleSaveContract = (userId) => {
        onUpdateContract(userId, { type: editType, start: editStart || null, end: editEnd || null });
        setContractSettingsFor(null);
    };

    const resetAddMember = () => {
        setAddingMemberFor(null);
        setNewMemberFirstName('');
        setNewMemberLastName('');
        setNewMemberContract('CDI');
        setNewMemberStart('');
        setNewMemberEnd('');
        setRehireId('');
    };

    const handleAddMember = () => {
        if (!addingMemberFor) return;
        const contract = { type: newMemberContract, start: newMemberStart || null, end: newMemberEnd || null };
        if (rehireId) {
            // Reprise d'un archivé : on réactive son profil existant (historique conservé)
            onReactivateMember(rehireId, contract);
        } else {
            if (!newMemberFirstName.trim()) return;
            onAddMember(addingMemberFor, newMemberFirstName.trim(), newMemberLastName.trim(), contract);
        }
        resetAddMember();
    };

    // Archivés repérables pour ce groupe (reprise d'intérimaires qui reviennent)
    const archivedForGroup = (role) => archivedUsers.filter(u => productionGroup(u.role) === role);

    // ── Absence form inline ──

    const selectedAbsenceTarget = selectedUserForAbsence || selectedGroupForAbsence;
    const absenceTargetLabel = selectedGroupForAbsence
        ? `Groupe — ${GROUP_LABELS[selectedGroupForAbsence]}`
        : users.find(u => u.id === selectedUserForAbsence)
            ? `${users.find(u => u.id === selectedUserForAbsence).first_name} ${users.find(u => u.id === selectedUserForAbsence).last_name || ''}`.trim()
            : null;

    const renderAbsenceForm = () => (
        <div style={{ background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: 8, padding: 14, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CalendarIcon size={12} color="#EF4444" />
                    {absenceTargetLabel}
                </span>
                <button
                    onClick={() => { setSelectedUserForAbsence(null); setSelectedGroupForAbsence(null); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 11 }}
                >
                    ✕ Fermer
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
    );

    // ── Member card ──

    const renderMember = (user) => {
        const isContractSettings = contractSettingsFor === user.id;
        const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        const contractType = user.contract_type || 'CDI';
        const badge = CONTRACT_BADGE[contractType] || CONTRACT_BADGE.CDI;
        const hasContractEnd = !!user.contract_end_date;
        const fmtD = (d) => format(new Date(d), 'dd/MM/yy');

        return (
            <div key={user.id} style={{
                background: 'white', border: '1px solid #E5E7EB', borderRadius: 8,
                padding: '11px 13px', marginBottom: 8,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Avatar + info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center',
                            fontWeight: 700, fontSize: 13, background: badge.bg, color: badge.color,
                        }}>
                            {displayName[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>{displayName}</span>
                                <span style={{
                                    fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700,
                                    background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                                }}>
                                    {contractType}
                                </span>
                                {hasContractEnd && (
                                    <span style={{
                                        fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700,
                                        background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA',
                                    }}>
                                        fin {fmtD(user.contract_end_date)}
                                    </span>
                                )}
                            </div>
                            {(user.contract_start_date || user.contract_end_date) && (
                                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
                                    {user.contract_start_date ? `du ${fmtD(user.contract_start_date)}` : ''}
                                    {user.contract_end_date ? ` au ${fmtD(user.contract_end_date)}` : (user.contract_start_date ? ' → en cours' : '')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <button
                            onClick={() => { setSelectedUserForAbsence(user.id); setSelectedGroupForAbsence(null); }}
                            title="Déclarer une absence"
                            style={{ padding: 5, borderRadius: 5, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', color: '#EF4444' }}
                        >
                            <CalendarIcon size={13} />
                        </button>

                        <button
                            onClick={() => openContractSettings(user)}
                            title="Contrat (type & dates)"
                            style={{
                                padding: 5, borderRadius: 5,
                                border: `1px solid ${hasContractEnd ? '#FECACA' : '#E5E7EB'}`,
                                background: hasContractEnd ? '#FEF2F2' : 'white',
                                cursor: 'pointer', color: hasContractEnd ? '#EF4444' : '#6B7280',
                            }}
                        >
                            <Settings size={13} />
                        </button>

                        {onDeleteMember && (
                            <button
                                onClick={() => onDeleteMember(user)}
                                title="Supprimer (ou archiver si des créneaux sont déjà réalisés)"
                                style={{ padding: 5, borderRadius: 5, border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', color: '#EF4444' }}
                            >
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Paramètres contrat : type + dates */}
                {isContractSettings && (
                    <div style={{ marginTop: 10, padding: 10, background: '#F9FAFB', borderRadius: 6, border: '1px solid #E5E7EB' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Contrat</div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            {CONTRACT_TYPES.map(ct => (
                                <button key={ct} type="button" onClick={() => setEditType(ct)}
                                    style={{
                                        flex: 1, padding: '5px 0', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                        border: `1px solid ${editType === ct ? '#111827' : '#D1D5DB'}`,
                                        background: editType === ct ? '#111827' : 'white',
                                        color: editType === ct ? 'white' : '#374151',
                                    }}>
                                    {ct}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6B7280', marginBottom: 2 }}>Début (optionnel)</label>
                                <input type="date" value={editStart} onChange={e => setEditStart(e.target.value)}
                                    style={{ width: '100%', padding: '5px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #D1D5DB' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6B7280', marginBottom: 2 }}>Fin (vide = aucune)</label>
                                <input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                                    style={{ width: '100%', padding: '5px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #D1D5DB' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => setContractSettingsFor(null)}
                                style={{ padding: '5px 10px', border: '1px solid #D1D5DB', borderRadius: 4, background: 'white', fontSize: 11, cursor: 'pointer' }}>
                                Annuler
                            </button>
                            <button onClick={() => handleSaveContract(user.id)}
                                style={{ padding: '5px 10px', border: 'none', borderRadius: 4, background: '#111827', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                Valider
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} />
            <div style={{ position: 'relative', width: 460, background: 'white', height: '100%', boxShadow: '-5px 0 25px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>

                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Gérer l'équipe</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                        <X size={22} color="#6B7280" />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px' }}>

                    {/* Formulaire absence inline (apparaît en haut quand sélectionné) */}
                    {selectedAbsenceTarget && renderAbsenceForm()}

                    {/* Groupes */}
                    {Object.entries(groupedUsers).map(([role, members]) => (
                        <div key={role} style={{ marginBottom: 24 }}>
                            <div style={{
                                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280',
                                marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #F3F4F6',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <span>{GROUP_LABELS[role]} ({members.length})</span>
                                <button
                                    onClick={() => { setSelectedGroupForAbsence(role); setSelectedUserForAbsence(null); }}
                                    style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, padding: '2px 7px', color: '#EF4444', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                                >
                                    <CalendarIcon size={10} /> Absence groupe
                                </button>
                            </div>

                            {members.map(u => renderMember(u))}

                            {/* Ajouter un membre */}
                            {addingMemberFor === role ? (
                                <div style={{ padding: 12, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, marginTop: 4 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 8 }}>
                                        Nouveau membre — {GROUP_LABELS[role]}
                                    </div>

                                    {/* Reprise d'une personne archivée (intérimaire qui revient) */}
                                    {archivedForGroup(role).length > 0 && (
                                        <div style={{ marginBottom: 8 }}>
                                            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#166534', marginBottom: 4 }}>Reprendre une personne archivée</label>
                                            <select value={rehireId} onChange={e => setRehireId(e.target.value)}
                                                style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #BBF7D0', background: 'white', boxSizing: 'border-box' }}>
                                                <option value="">— Nouvelle personne —</option>
                                                {archivedForGroup(role).map(a => (
                                                    <option key={a.id} value={a.id}>
                                                        {`${a.first_name || ''} ${a.last_name || ''}`.trim()}{a.contract_type ? ` (${a.contract_type})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Nom : uniquement pour une nouvelle personne */}
                                    {!rehireId && (
                                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                            <input
                                                value={newMemberFirstName}
                                                onChange={e => setNewMemberFirstName(e.target.value)}
                                                placeholder="Prénom *"
                                                autoFocus
                                                style={{ flex: 1, padding: '6px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #BBF7D0', boxSizing: 'border-box' }}
                                            />
                                            <input
                                                value={newMemberLastName}
                                                onChange={e => setNewMemberLastName(e.target.value)}
                                                placeholder="Nom"
                                                style={{ flex: 1, padding: '6px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #BBF7D0', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    )}

                                    <div style={{ marginBottom: 8 }}>
                                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#166534', marginBottom: 4 }}>Type de contrat</label>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {CONTRACT_TYPES.map(ct => (
                                                <button
                                                    key={ct}
                                                    type="button"
                                                    onClick={() => setNewMemberContract(ct)}
                                                    style={{
                                                        flex: 1, padding: '5px 0', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                                        border: `1px solid ${newMemberContract === ct ? '#16A34A' : '#BBF7D0'}`,
                                                        background: newMemberContract === ct ? '#16A34A' : 'white',
                                                        color: newMemberContract === ct ? 'white' : '#166534',
                                                    }}
                                                >
                                                    {ct}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#166534', marginBottom: 4 }}>Début (optionnel)</label>
                                            <input type="date" value={newMemberStart} onChange={e => setNewMemberStart(e.target.value)}
                                                style={{ width: '100%', padding: '5px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #BBF7D0', boxSizing: 'border-box' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#166534', marginBottom: 4 }}>Fin (optionnel)</label>
                                            <input type="date" value={newMemberEnd} onChange={e => setNewMemberEnd(e.target.value)}
                                                style={{ width: '100%', padding: '5px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #BBF7D0', boxSizing: 'border-box' }} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button onClick={resetAddMember}
                                            style={{ flex: 1, padding: '5px 0', border: '1px solid #D1D5DB', borderRadius: 4, background: 'white', fontSize: 11, cursor: 'pointer' }}>
                                            Annuler
                                        </button>
                                        {(() => {
                                            const ready = !!rehireId || !!newMemberFirstName.trim();
                                            return (
                                                <button onClick={handleAddMember} disabled={!ready}
                                                    style={{ flex: 1, padding: '5px 0', border: 'none', borderRadius: 4, background: ready ? '#16A34A' : '#E5E7EB', color: ready ? 'white' : '#9CA3AF', fontSize: 11, fontWeight: 600, cursor: ready ? 'pointer' : 'not-allowed' }}>
                                                    {rehireId ? 'Reprendre' : 'Ajouter'}
                                                </button>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { resetAddMember(); setAddingMemberFor(role); }}
                                    style={{ width: '100%', padding: '7px 0', border: '1px dashed #D1D5DB', borderRadius: 6, background: 'transparent', color: '#9CA3AF', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                                >
                                    <UserPlus size={12} /> Ajouter un membre
                                </button>
                            )}
                        </div>
                    ))}

                    {/* Fermetures annuelles */}
                    <div style={{ borderTop: '2px solid #F3F4F6', paddingTop: 20, marginTop: 8 }}>
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
            </div>
        </div>
    );
};

export default ResourcePanel;
