import { useState } from 'react';
import { X, Calendar as CalendarIcon, Settings, UserPlus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { productionGroup } from '../../lib/authz';
import { CONTRACT_TYPES } from './constants';
import { BLUE_TONES, DA_INPUT_STYLE } from '../../lib/constants/daStyles';

const GROUP_LABELS = { prepa: 'Préparation', conf: 'Confection', pose: 'Pose' };

// Styles DA : Roboto, champs 34 px à trait #E0DED9, boutons 8 px, bleu nuit pour l'action principale.
const ROBOTO = 'Roboto, system-ui, sans-serif';
const NAVY = '#1E2447';
const IN = { ...DA_INPUT_STYLE, height: 34, fontSize: 13, padding: '0 10px' };
const LBL = { display: 'block', fontSize: 12, color: '#6B7280', marginBottom: 4 };
const BTN = { flex: 1, height: 34, border: '1px solid #E0DED9', borderRadius: 8, background: 'white', color: '#374151', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' };
const BTN_PRIMARY = (on = true) => ({ ...BTN, border: 'none', background: on ? NAVY : '#E8E6E2', color: on ? 'white' : '#9B9A97', cursor: on ? 'pointer' : 'not-allowed' });
const ICON_BTN = { width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid #E0DED9', background: 'white', cursor: 'pointer', color: '#6B7280' };
const pill = (on) => ({ flex: 1, height: 32, borderRadius: 99, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', border: `1px solid ${on ? NAVY : '#E0DED9'}`, background: on ? NAVY : 'white', color: on ? 'white' : '#374151' });
const SUBPANEL = { background: '#F4F4F4', borderRadius: 8, padding: 14 };

// Contrats dans le nuancier bleu de la charte.
const CONTRACT_BADGE = {
    CDI: BLUE_TONES[4],
    CDD: BLUE_TONES[3],
    'Intérim': BLUE_TONES[5],
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
        <div style={{ ...SUBPANEL, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarIcon size={14} color={NAVY} />
                    Absence · {absenceTargetLabel}
                </span>
                <button
                    onClick={() => { setSelectedUserForAbsence(null); setSelectedGroupForAbsence(null); }}
                    title="Fermer"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B9A97', display: 'flex' }}
                >
                    <X size={16} />
                </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                    <label style={LBL}>Type</label>
                    <select value={absType} onChange={e => setAbsType(e.target.value)} style={{ ...IN, cursor: 'pointer' }}>
                        <option>Congés</option>
                        <option>RTT</option>
                        <option>Maladie</option>
                        <option>Autre</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                    <div style={{ flex: 2 }}>
                        <label style={LBL}>Date début</label>
                        <input type="date" value={absStart} onChange={e => setAbsStart(e.target.value)}
                            style={IN} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={LBL}>Heure</label>
                        <input type="time" value={absStartTime} onChange={e => setAbsStartTime(e.target.value)}
                            style={IN} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                    <div style={{ flex: 2 }}>
                        <label style={LBL}>Date fin (incluse)</label>
                        <input type="date" value={absEnd} onChange={e => setAbsEnd(e.target.value)}
                            style={IN} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={LBL}>Heure</label>
                        <input type="time" value={absEndTime} onChange={e => setAbsEndTime(e.target.value)}
                            style={IN} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 7, marginTop: 2 }}>
                    <button onClick={() => { setSelectedUserForAbsence(null); setSelectedGroupForAbsence(null); }} style={BTN}>
                        Annuler
                    </button>
                    <button onClick={handleCreateAbsence} style={BTN_PRIMARY()}>
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
                background: 'white', border: '1px solid #E0DED9', borderRadius: 8,
                padding: '10px 12px', marginBottom: 8,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Avatar + info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center',
                            fontWeight: 500, fontSize: 13, background: badge.bg, color: badge.color,
                        }}>
                            {displayName[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 500, fontSize: 14, color: '#111827' }}>{displayName}</span>
                                <span style={{
                                    fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                                    background: badge.bg, color: badge.color,
                                }}>
                                    {contractType}
                                </span>
                                {hasContractEnd && (
                                    <span style={{
                                        fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                                        background: '#F4F4F4', color: '#374151',
                                    }}>
                                        fin {fmtD(user.contract_end_date)}
                                    </span>
                                )}
                            </div>
                            {(user.contract_start_date || user.contract_end_date) && (
                                <div style={{ fontSize: 12, color: '#9B9A97', marginTop: 2 }}>
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
                            style={ICON_BTN}
                        >
                            <CalendarIcon size={14} />
                        </button>

                        <button
                            onClick={() => openContractSettings(user)}
                            title="Contrat (type & dates)"
                            style={{ ...ICON_BTN, ...(isContractSettings ? { background: NAVY, borderColor: NAVY, color: 'white' } : {}) }}
                        >
                            <Settings size={14} />
                        </button>

                        {onDeleteMember && (
                            <button
                                onClick={() => onDeleteMember(user)}
                                title="Supprimer (ou archiver si des créneaux sont déjà réalisés)"
                                style={ICON_BTN}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Paramètres contrat : type + dates */}
                {isContractSettings && (
                    <div style={{ ...SUBPANEL, marginTop: 10, padding: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 8 }}>Contrat</div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            {CONTRACT_TYPES.map(ct => (
                                <button key={ct} type="button" onClick={() => setEditType(ct)} style={pill(editType === ct)}>
                                    {ct}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            <div style={{ flex: 1 }}>
                                <label style={LBL}>Début (optionnel)</label>
                                <input type="date" value={editStart} onChange={e => setEditStart(e.target.value)}
                                    style={IN} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={LBL}>Fin (vide = aucune)</label>
                                <input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                                    style={IN} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => setContractSettingsFor(null)} style={{ ...BTN, flex: 'none', padding: '0 14px' }}>
                                Annuler
                            </button>
                            <button onClick={() => handleSaveContract(user.id)} style={{ ...BTN_PRIMARY(), flex: 'none', padding: '0 14px' }}>
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
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.4)' }} />
            <div style={{ position: 'relative', width: 'min(460px, 100vw)', background: 'white', height: '100%', boxShadow: '-5px 0 25px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', fontFamily: ROBOTO }}>

                {/* Header */}
                <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid #E8E6E2', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: 24, fontWeight: 400, color: '#111827', lineHeight: 1.2 }}>Gérer l'équipe</div>
                        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Membres, contrats, absences et fermetures.</div>
                    </div>
                    <button onClick={onClose} title="Fermer" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9B9A97', display: 'flex', padding: 4 }}>
                        <X size={20} />
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
                                marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #E8E6E2',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <span style={{ fontSize: 17, fontWeight: 500, color: '#111827' }}>
                                    {GROUP_LABELS[role]} <span style={{ fontSize: 13, color: '#9B9A97', fontWeight: 400 }}>{members.length}</span>
                                </span>
                                <button
                                    onClick={() => { setSelectedGroupForAbsence(role); setSelectedUserForAbsence(null); }}
                                    style={{ height: 30, background: 'white', border: '1px solid #E0DED9', borderRadius: 8, padding: '0 10px', color: '#374151', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                                >
                                    <CalendarIcon size={13} /> Absence groupe
                                </button>
                            </div>

                            {members.map(u => renderMember(u))}

                            {/* Ajouter un membre */}
                            {addingMemberFor === role ? (
                                <div style={{ ...SUBPANEL, marginTop: 4 }}>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 10 }}>
                                        Nouveau membre — {GROUP_LABELS[role]}
                                    </div>

                                    {/* Reprise d'une personne archivée (intérimaire qui revient) */}
                                    {archivedForGroup(role).length > 0 && (
                                        <div style={{ marginBottom: 8 }}>
                                            <label style={LBL}>Reprendre une personne archivée</label>
                                            <select value={rehireId} onChange={e => setRehireId(e.target.value)} style={{ ...IN, cursor: 'pointer' }}>
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
                                                style={{ ...IN, flex: 1 }}
                                            />
                                            <input
                                                value={newMemberLastName}
                                                onChange={e => setNewMemberLastName(e.target.value)}
                                                placeholder="Nom"
                                                style={{ ...IN, flex: 1 }}
                                            />
                                        </div>
                                    )}

                                    <div style={{ marginBottom: 8 }}>
                                        <label style={LBL}>Type de contrat</label>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {CONTRACT_TYPES.map(ct => (
                                                <button
                                                    key={ct}
                                                    type="button"
                                                    onClick={() => setNewMemberContract(ct)}
                                                    style={pill(newMemberContract === ct)}
                                                >
                                                    {ct}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={LBL}>Début (optionnel)</label>
                                            <input type="date" value={newMemberStart} onChange={e => setNewMemberStart(e.target.value)}
                                                style={IN} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={LBL}>Fin (optionnel)</label>
                                            <input type="date" value={newMemberEnd} onChange={e => setNewMemberEnd(e.target.value)}
                                                style={IN} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button onClick={resetAddMember} style={BTN}>
                                            Annuler
                                        </button>
                                        {(() => {
                                            const ready = !!rehireId || !!newMemberFirstName.trim();
                                            return (
                                                <button onClick={handleAddMember} disabled={!ready} style={BTN_PRIMARY(ready)}>
                                                    {rehireId ? 'Reprendre' : 'Ajouter'}
                                                </button>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { resetAddMember(); setAddingMemberFor(role); }}
                                    style={{ width: '100%', height: 34, border: '1px dashed #C9C7C2', borderRadius: 8, background: 'transparent', color: '#6B7280', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                >
                                    <UserPlus size={14} /> Ajouter un membre
                                </button>
                            )}
                        </div>
                    ))}

                    {/* Fermetures annuelles */}
                    <div style={{ paddingTop: 4, marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #E8E6E2' }}>
                            <span style={{ fontSize: 17, fontWeight: 500, color: '#111827' }}>
                                Fermetures annuelles
                            </span>
                            {!showClosureForm && (
                                <button onClick={() => setShowClosureForm(true)}
                                    style={{ height: 30, background: NAVY, color: 'white', border: 'none', borderRadius: 8, padding: '0 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
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
                                padding: '10px 12px', background: 'white', border: '1px solid #E0DED9',
                                borderRadius: 8, marginBottom: 8,
                            }}>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{c.title}</div>
                                    <div style={{ fontSize: 12, color: '#9B9A97' }}>
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
                            <div style={{ ...SUBPANEL, marginTop: 4 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                                    <div>
                                        <label style={LBL}>Libellé</label>
                                        <input value={closureLabel} onChange={e => setClosureLabel(e.target.value)}
                                            placeholder="ex : Congés d'été, Fêtes de fin d'année…"
                                            autoFocus
                                            style={IN} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 7 }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={LBL}>Début</label>
                                            <input type="date" value={closureStart} onChange={e => setClosureStart(e.target.value)}
                                                style={IN} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={LBL}>Fin</label>
                                            <input type="date" value={closureEnd} onChange={e => setClosureEnd(e.target.value)}
                                                style={IN} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 7 }}>
                                        <button onClick={() => { setShowClosureForm(false); setClosureLabel(''); }} style={BTN}>
                                            Annuler
                                        </button>
                                        <button onClick={handleAddClosure} disabled={!closureLabel.trim()} style={BTN_PRIMARY(!!closureLabel.trim())}>
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
