import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, Edit2 } from 'lucide-react';
import { format } from 'date-fns';

const ResourcePanel = ({ isOpen, onClose, users, hiddenResources, onToggleVisibility, onAddAbsence, onUpdateUser }) => {
    // État local pour le formulaire d'absence
    const [selectedUserForAbsence, setSelectedUserForAbsence] = useState(null);
    const [selectedGroupForAbsence, setSelectedGroupForAbsence] = useState(null); // Pour absence groupée
    const [absType, setAbsType] = useState('Congés');
    const [absStart, setAbsStart] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [absStartTime, setAbsStartTime] = useState('08:00');
    const [absEnd, setAbsEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [absEndTime, setAbsEndTime] = useState('17:00');

    // État local pour l'édition d'un user (Interim)
    const [editingUser, setEditingUser] = useState(null); // { id, first_name, last_name }

    if (!isOpen) return null;

    // Grouper les users pour l'affichage
    const groupedUsers = {
        prepa: users.filter(u => u.role === 'prepa'),
        conf: users.filter(u => u.role === 'conf'),
        pose: users.filter(u => u.role === 'pose')
    };

    const handleCreateAbsence = () => {
        if (selectedGroupForAbsence) {
            // -- MODE GROUPE --
            const members = groupedUsers[selectedGroupForAbsence];
            members.forEach(member => {
                onAddAbsence(member.id, absType, absStart, absStartTime, absEnd, absEndTime);
            });
            setSelectedGroupForAbsence(null);
        } else if (selectedUserForAbsence) {
            // -- MODE INDIVIDUEL --
            onAddAbsence(selectedUserForAbsence, absType, absStart, absStartTime, absEnd, absEndTime);
            setSelectedUserForAbsence(null);
        }

        // Reset form defaults 
        setAbsType('Congés');
        setAbsStart(format(new Date(), 'yyyy-MM-dd'));
        setAbsStartTime('08:00');
        setAbsEnd(format(new Date(), 'yyyy-MM-dd'));
        setAbsEndTime('17:00');
    };

    const openModal = (userId = null, groupId = null) => {
        setAbsStart(format(new Date(), 'yyyy-MM-dd'));
        setAbsEnd(format(new Date(), 'yyyy-MM-dd'));
        setSelectedUserForAbsence(userId);
        setSelectedGroupForAbsence(groupId);
    };

    const handleSaveUser = () => {
        if (editingUser) {
            onUpdateUser(editingUser); // Envoie { id, first_name, last_name, ... }
            setEditingUser(null);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} />
            <div style={{ position: 'relative', width: 420, background: 'white', height: '100%', boxShadow: '-5px 0 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease-out' }}>

                <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA' }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Gérer l'équipe</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={24} color="#6B7280" /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                    {Object.entries(groupedUsers).map(([role, members]) => (
                        <div key={role} style={{ marginBottom: 32 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280', marginBottom: 16, borderBottom: '1px solid #F3F4F6', paddingBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>
                                    {role === 'prepa' && 'Préparation'}
                                    {role === 'conf' && 'Atelier Confection'}
                                    {role === 'pose' && 'Équipes de Pose'}
                                    ({members.length})
                                </span>
                                {/* Bouton Absence Groupe */}
                                <button
                                    onClick={() => openModal(null, role)}
                                    title="Absence pour tout le groupe"
                                    style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, padding: '2px 8px', color: '#EF4444', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'none' }}
                                >
                                    <CalendarIcon size={12} /> Tout le groupe
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {members.map(user => {
                                    // isVisible = Actif dans le switch. Mais attention, le user a dit "désactivé via is_active".
                                    // On va utiliser le champ "active" du user s'il existe, sinon fallback sur hiddenResources.
                                    // Mais le code existant utilise hiddenResources pour le toggle "Visibilité".
                                    // On va unifier : Le switch "Actif/Inactif" contrôle hiddenResources (Masqué = Inactif).
                                    // Pour la consistance UI, on garde hiddenResources.
                                    const isVisible = !hiddenResources.includes(user.id);

                                    // Identification CDI vs Interim
                                    // "Considère comme Profil Flottant tout utilisateur dont le first_name commence par Interim"
                                    // Attention : si on le renomme, il ne commence plus par Interim. 
                                    // IL FAUT UN MOYEN DE SAVOIR SI C'EST UN COMPTE FLOTTANT A L'ORIGINE.
                                    // Supposons que le login/email ou un ID spécifique ou un champ 'is_interim' serait mieux.
                                    // FAUTE DE MIEUX : On se base sur le fait qu'il EST interim SI on peut l'éditer. 
                                    // MAIS si on ré-ouvre l'app, comment savoir ?
                                    // L'user dit : "tout utilisateur dont le first_name commence par Interim".
                                    // Si on le renomme "Sonia", il devient un CDI aux yeux du système ? C'est le risque.
                                    // Idéalement on stocke is_interim dans l'objet user.
                                    // On va supposer qu'on ajoute une propriété is_interim lors du chargement initial si ça commence par Interim, et on la garde.
                                    // Ou alors on checke si l'ID contient par exemple "temp" ou si une propriété custom existe.
                                    // Pour cet exercice, on va check "Interim" dans le nom OU si on a déjà flaggé comme interim.

                                    const isInterim = user.first_name?.startsWith('Interim') || user.is_interim;
                                    // Note: on ajoute is_interim dans l'objet user mis à jour pour persister ce statut après renommage.

                                    const isEditing = editingUser?.id === user.id;

                                    return (
                                        <div key={user.id} style={{ display: 'flex', flexDirection: 'column', background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px', opacity: isVisible ? 1 : 0.6 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isEditing ? 12 : 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: isVisible ? (isInterim ? '#FEF3C7' : '#DBEAFE') : '#F3F4F6', color: isVisible ? (isInterim ? '#D97706' : '#1E40AF') : '#9CA3AF', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 13 }}>
                                                        {user.first_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <div style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>
                                                                {user.first_name} {user.last_name}
                                                            </div>
                                                            {/* Badge */}
                                                            <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, fontWeight: 700, background: isInterim ? '#FFFbeb' : '#EFF6FF', color: isInterim ? '#B45309' : '#1D4ED8', border: `1px solid ${isInterim ? '#FCD34D' : '#BFDBFE'}` }}>
                                                                {isInterim ? 'INTERIM' : 'CDI'}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: 12, color: isVisible ? '#10B981' : '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            {isVisible ? 'Actif' : 'Désactivé'}
                                                            {/* Bouton Edit pour Interim */}
                                                            {isInterim && !isEditing && (
                                                                <button
                                                                    onClick={() => setEditingUser({ ...user, is_interim: true })} // On garde le flag
                                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, marginLeft: 4 }}
                                                                    title="Renommer"
                                                                >
                                                                    <Edit2 size={10} color="#6B7280" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    {/* Bouton Absence */}
                                                    <button
                                                        onClick={() => openModal(user.id, null)}
                                                        title="Déclarer absence"
                                                        style={{ padding: 6, borderRadius: 6, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', color: '#EF4444' }}
                                                    >
                                                        <CalendarIcon size={16} />
                                                    </button>

                                                    {/* BOUTON TOGGLE ACTIF/INACTIF */}
                                                    <button
                                                        onClick={() => onToggleVisibility(user.id)}
                                                        title={isVisible ? "Désactiver" : "Activer"}
                                                        style={{
                                                            width: 36, height: 20, borderRadius: 999,
                                                            background: isVisible ? '#10B981' : '#E5E7EB',
                                                            position: 'relative', border: 'none', cursor: 'pointer', transition: 'background 0.2s'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: 16, height: 16, borderRadius: '50%', background: 'white',
                                                            position: 'absolute', top: 2, left: isVisible ? 18 : 2,
                                                            transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                                        }} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* FORMULAIRE D'ÉDITION POUR INTERIM */}
                                            {isEditing && (
                                                <div style={{ marginTop: 8, padding: 8, background: '#F9FAFB', borderRadius: 6, border: '1px solid #E5E7EB' }}>
                                                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                                        <input
                                                            value={editingUser.first_name || ''}
                                                            onChange={e => setEditingUser({ ...editingUser, first_name: e.target.value })}
                                                            placeholder="Prénom"
                                                            style={{ flex: 1, padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #D1D5DB' }}
                                                        />
                                                        <input
                                                            value={editingUser.last_name || ''}
                                                            onChange={e => setEditingUser({ ...editingUser, last_name: e.target.value })}
                                                            placeholder="Nom"
                                                            style={{ flex: 1, padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #D1D5DB' }}
                                                        />
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                        <button onClick={() => setEditingUser(null)} style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #D1D5DB', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Annuler</button>
                                                        <button onClick={handleSaveUser} style={{ fontSize: 11, padding: '4px 8px', border: 'none', background: '#2563EB', color: 'white', borderRadius: 4, cursor: 'pointer' }}>Enregistrer</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* MODALE INTERNE POUR ABSENCE */}
                {(selectedUserForAbsence || selectedGroupForAbsence) && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.95)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                        <div style={{ width: '100%', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: 20 }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
                                {selectedGroupForAbsence ? `Absence Groupe : ${selectedGroupForAbsence.toUpperCase()}` : 'Déclarer une absence'}
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                                {/* Type d'absence */}
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Type</label>
                                    <select value={absType} onChange={e => setAbsType(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #D1D5DB', borderRadius: 6 }}>
                                        <option value="Congés">Congés</option>
                                        <option value="RTT">RTT</option>
                                        <option value="Maladie">Maladie</option>
                                        <option value="Autre">Autre</option>
                                    </select>
                                </div>

                                {/* Début */}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div style={{ flex: 2 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Date de début</label>
                                        <input type="date" value={absStart} onChange={e => setAbsStart(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #D1D5DB', borderRadius: 6 }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Heure</label>
                                        <input type="time" value={absStartTime} onChange={e => setAbsStartTime(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #D1D5DB', borderRadius: 6 }} />
                                    </div>
                                </div>

                                {/* Fin */}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div style={{ flex: 2 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Date de fin (incluse)</label>
                                        <input type="date" value={absEnd} onChange={e => setAbsEnd(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #D1D5DB', borderRadius: 6 }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Heure</label>
                                        <input type="time" value={absEndTime} onChange={e => setAbsEndTime(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #D1D5DB', borderRadius: 6 }} />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                    <button onClick={() => { setSelectedUserForAbsence(null); setSelectedGroupForAbsence(null); }} style={{ flex: 1, padding: '8px', border: '1px solid #D1D5DB', borderRadius: 6, background: 'white', fontWeight: 600 }}>Annuler</button>
                                    <button onClick={handleCreateAbsence} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 6, background: '#EF4444', color: 'white', fontWeight: 600 }}>Valider</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResourcePanel;
