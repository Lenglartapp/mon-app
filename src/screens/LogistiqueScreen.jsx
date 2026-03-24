import React, { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Truck, Package, Search, X, Check, Trash2, PackagePlus, ChevronRight, FileText, Box, Weight } from 'lucide-react';
import { useShipments, isRideauVoilage } from '../hooks/useShipments';
import LogistiqueAnalyseView from '../components/modules/Logistique/LogistiqueAnalyseView';

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUTS = ['Brouillon', 'En préparation', 'Expédiée'];

const STATUT_STYLE = {
    'Brouillon':       { bg: '#F3F4F6', color: '#6B7280' },
    'En préparation':  { bg: '#FEF3C7', color: '#92400E' },
    'Expédiée':        { bg: '#D1FAE5', color: '#065F46' },
};

const EXPEDITION_STATUT_STYLE = {
    'Non expédié':         { bg: '#F3F4F6', color: '#6B7280' },
    'En préparation':      { bg: '#FEF3C7', color: '#92400E' },
    'Expédié':             { bg: '#D1FAE5', color: '#065F46' },
    'Rail expédié':        { bg: '#DBEAFE', color: '#1E40AF' },
    'Rideau expédié':      { bg: '#EDE9FE', color: '#5B21B6' },
    'Rail + Rideau expédié': { bg: '#D1FAE5', color: '#065F46' },
};

const TH = ({ children, style }) => (
    <th style={{
        padding: '12px 16px', fontSize: 11, fontWeight: 700,
        color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px',
        ...style,
    }}>{children}</th>
);

const pill = (label, style) => (
    <span style={{
        display: 'inline-block', padding: '3px 10px', borderRadius: 99,
        fontSize: 11, fontWeight: 700, ...style,
    }}>{label}</span>
);

// ── Modal générique ───────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 520 }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: '#fff', borderRadius: 16, width: `min(${width}px, 95vw)`,
                maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
            }}>
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={18} /></button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>{children}</div>
            </div>
        </div>
    );
}

// ── Formulaire création expédition ────────────────────────────────────────────
function CreateShipmentModal({ onClose, onCreate }) {
    const [form, setForm] = useState({ label: '', reference: '', destination: '', notes: '', date_expedition: '' });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await onCreate(form);
        if (result) onClose(result);
    };

    return (
        <Modal title="Nouvelle expédition" onClose={() => onClose(null)}>
            <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                    <label style={labelStyle}>Nom de l'expédition</label>
                    <input style={inputStyle} placeholder="ex: Livraison chantier Dupont" value={form.label} onChange={e => set('label', e.target.value)} required autoFocus />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Référence (laissez vide pour auto)</label>
                        <input style={inputStyle} placeholder="EXP-2026-001" value={form.reference} onChange={e => set('reference', e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Date d'expédition</label>
                        <input style={inputStyle} type="date" value={form.date_expedition} onChange={e => set('date_expedition', e.target.value)} />
                    </div>
                </div>
                <div>
                    <label style={labelStyle}>Destination</label>
                    <input style={inputStyle} placeholder="Adresse ou nom du chantier" value={form.destination} onChange={e => set('destination', e.target.value)} />
                </div>
                <div>
                    <label style={labelStyle}>Notes</label>
                    <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }} placeholder="Code portail, instructions particulières..." value={form.notes} onChange={e => set('notes', e.target.value)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button type="button" onClick={() => onClose(null)} style={btnSecondary}>Annuler</button>
                    <button type="submit" style={btnPrimary}>Créer</button>
                </div>
            </form>
        </Modal>
    );
}

// ── Picker ouvrages (2 étapes) ────────────────────────────────────────────────
// selectedMap : Map<rowId, 'complet' | 'rail' | 'rideau'>
const PARTIE_OPTIONS = [
    { value: 'complet', label: 'Rail + Rideau' },
    { value: 'rail',    label: 'Rail seul' },
    { value: 'rideau',  label: 'Rideau seul' },
];

function PartieSelector({ value, onChange }) {
    return (
        <div style={{ display: 'flex', gap: 4 }}>
            {PARTIE_OPTIONS.map(opt => (
                <button
                    key={opt.value}
                    onClick={e => { e.stopPropagation(); onChange(opt.value); }}
                    style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, border: '1px solid',
                        cursor: 'pointer',
                        borderColor: value === opt.value ? '#6366F1' : '#E5E7EB',
                        background: value === opt.value ? '#EEF2FF' : '#fff',
                        color: value === opt.value ? '#4F46E5' : '#6B7280',
                    }}
                >{opt.label}</button>
            ))}
        </div>
    );
}

function OuvragePicker({ projects, existingRowIds, onClose, onAdd }) {
    const [step, setStep] = useState(1);
    const [selectedProject, setSelectedProject] = useState(null);
    const [search, setSearch] = useState('');
    // Map<rowId, 'complet'|'rail'|'rideau'>
    const [selectedMap, setSelectedMap] = useState(new Map());

    const filteredProjects = useMemo(() => {
        if (!search.trim()) return projects;
        return projects.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
    }, [projects, search]);

    const rows = useMemo(() => selectedProject?.rows || [], [selectedProject]);

    const toggleRow = (id, produit) => {
        setSelectedMap(prev => {
            const next = new Map(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                // Rideau/voilage → défaut "complet", autres → 'complet' (ignoré à la validation)
                next.set(id, 'complet');
            }
            return next;
        });
    };

    const setPartie = (id, partie) => {
        setSelectedMap(prev => {
            const next = new Map(prev);
            if (next.has(id)) next.set(id, partie);
            return next;
        });
    };

    const handleAdd = () => {
        const selected = rows
            .filter(r => selectedMap.has(r.id))
            .map(r => ({ row: r, partie: selectedMap.get(r.id) }));
        onAdd(selected, selectedProject);
    };

    const visibleRows = rows.filter(r =>
        !search.trim() || `${r.piece} ${r.produit}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Modal title={step === 1 ? 'Étape 1 — Choisir un projet' : `Étape 2 — ${selectedProject?.name}`} onClose={onClose} width={600}>
            <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {step === 1 && (
                    <>
                        <input style={inputStyle} placeholder="Rechercher un projet..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                            {filteredProjects.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 13, padding: '8px 0' }}>Aucun projet trouvé.</div>}
                            {filteredProjects.map(p => (
                                <button key={p.id} onClick={() => { setSelectedProject(p); setStep(2); setSearch(''); }} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB',
                                    background: '#FAFAFA', cursor: 'pointer', textAlign: 'left',
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{(p.rows || []).length} ouvrage(s)</div>
                                    </div>
                                    <ChevronRight size={16} color="#9CA3AF" />
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <button onClick={() => { setStep(1); setSelectedMap(new Map()); }} style={{ ...btnSecondary, alignSelf: 'flex-start', fontSize: 12 }}>
                            ← Changer de projet
                        </button>
                        <input style={inputStyle} placeholder="Filtrer les ouvrages..." value={search} onChange={e => setSearch(e.target.value)} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 380, overflowY: 'auto', paddingRight: 2 }}>
                            {visibleRows.map(r => {
                                const alreadyAdded = existingRowIds.has(r.id);
                                const checked = selectedMap.has(r.id);
                                const statutExp = r.statut_expedition || 'Non expédié';
                                const isRV = isRideauVoilage(r.produit);

                                return (
                                    <div key={r.id} style={{
                                        borderRadius: 8,
                                        border: `1px solid ${checked ? '#6366F1' : '#E5E7EB'}`,
                                        background: alreadyAdded ? '#F9FAFB' : checked ? '#EEF2FF' : '#fff',
                                        opacity: alreadyAdded ? 0.6 : 1,
                                    }}>
                                        {/* Ligne principale — div cliquable */}
                                        <div
                                            onClick={() => !alreadyAdded && toggleRow(r.id, r.produit)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '9px 12px',
                                                cursor: alreadyAdded ? 'not-allowed' : 'pointer',
                                                userSelect: 'none',
                                            }}
                                        >
                                            {/* Checkbox */}
                                            <div style={{
                                                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                                                border: `2px solid ${checked ? '#6366F1' : '#D1D5DB'}`,
                                                background: checked ? '#6366F1' : '#fff',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                {checked && <Check size={11} color="#fff" />}
                                            </div>
                                            {/* Texte */}
                                            <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                                                <span style={{ fontWeight: 600 }}>{r.piece || '—'}</span>
                                                {r.produit && <span style={{ color: '#6B7280' }}> · {r.produit}</span>}
                                                {isRV && <span style={{ marginLeft: 6, fontSize: 10, color: '#9CA3AF' }}>Rideau/Voilage</span>}
                                            </div>
                                            {/* Badge statut */}
                                            <div style={{ flexShrink: 0 }}>
                                                {alreadyAdded
                                                    ? <span style={{ fontSize: 10, color: '#6B7280' }}>Déjà ajouté</span>
                                                    : pill(statutExp, EXPEDITION_STATUT_STYLE[statutExp] || EXPEDITION_STATUT_STYLE['Non expédié'])
                                                }
                                            </div>
                                        </div>

                                        {/* Sélecteur Rail/Rideau */}
                                        {checked && isRV && (
                                            <div style={{ padding: '4px 12px 8px 40px', borderTop: '1px solid #EEF2FF', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 600 }}>Expédier :</span>
                                                <PartieSelector value={selectedMap.get(r.id)} onChange={v => setPartie(r.id, v)} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                            <button onClick={onClose} style={btnSecondary}>Annuler</button>
                            <button onClick={handleAdd} disabled={selectedMap.size === 0} style={{ ...btnPrimary, opacity: selectedMap.size === 0 ? 0.5 : 1 }}>
                                Ajouter ({selectedMap.size})
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}

// ── Modal ligne libre ─────────────────────────────────────────────────────────
function FreeItemModal({ onClose, onAdd }) {
    const [description, setDescription] = useState('');
    const [quantite, setQuantite] = useState('');
    const [notes, setNotes] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onAdd({ type: 'libre', description, quantite, notes });
        onClose();
    };

    return (
        <Modal title="Ajouter une ligne libre" onClose={onClose} width={420}>
            <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                    <label style={labelStyle}>Description</label>
                    <input style={inputStyle} placeholder="ex: Visseuse + embouts" value={description} onChange={e => setDescription(e.target.value)} required autoFocus />
                </div>
                <div>
                    <label style={labelStyle}>Quantité</label>
                    <input style={inputStyle} placeholder="ex: 2 rouleaux, 1 carton..." value={quantite} onChange={e => setQuantite(e.target.value)} />
                </div>
                <div>
                    <label style={labelStyle}>Notes</label>
                    <input style={inputStyle} placeholder="Remarque optionnelle" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button type="button" onClick={onClose} style={btnSecondary}>Annuler</button>
                    <button type="submit" style={btnPrimary}>Ajouter</button>
                </div>
            </form>
        </Modal>
    );
}

// ── Types de colis ────────────────────────────────────────────────────────────
const COLIS_TYPES = ['Carton', 'Palette', 'Tube', 'Caisse', 'Autre'];

// ── Modal création colis ──────────────────────────────────────────────────────
function CreateColisModal({ onClose, onCreate }) {
    const [form, setForm] = useState({ type: 'Carton', label: '', dimensions: '', poids: '' });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        await onCreate(form);
        onClose();
    };

    return (
        <Modal title="Nouveau colis" onClose={onClose} width={420}>
            <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Type</label>
                        <select style={inputStyle} value={form.type} onChange={e => set('type', e.target.value)}>
                            {COLIS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 2 }}>
                        <label style={labelStyle}>Nom / étiquette</label>
                        <input style={inputStyle} placeholder="ex: Carton rideaux salon" value={form.label} onChange={e => set('label', e.target.value)} autoFocus />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Dimensions</label>
                        <input style={inputStyle} placeholder="80×60×40 cm" value={form.dimensions} onChange={e => set('dimensions', e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Poids</label>
                        <input style={inputStyle} placeholder="12 kg" value={form.poids} onChange={e => set('poids', e.target.value)} />
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button type="button" onClick={onClose} style={btnSecondary}>Annuler</button>
                    <button type="submit" style={btnPrimary}>Créer</button>
                </div>
            </form>
        </Modal>
    );
}

// ── Section Répartition ───────────────────────────────────────────────────────
function ColisSection({ shipmentId, shipmentItems, colisItems, isExpediee, onCreateColis, onUpdateColis, onDeleteColis, onToggleItem }) {
    const [showCreate, setShowCreate] = useState(false);
    const [expandedColisId, setExpandedColisId] = useState(null);

    // Items disponibles pour la répartition (ouvrages + libres de l'expédition)
    const availableItems = shipmentItems;

    const labelForItem = (item) => {
        if (item.type === 'ouvrage') {
            return [item.piece, item.produit].filter(Boolean).join(' · ');
        }
        return [item.description, item.quantite].filter(Boolean).join(' · ');
    };

    return (
        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>
                    RÉPARTITION <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({colisItems.length} colis)</span>
                </div>
                {!isExpediee && (
                    <button onClick={() => setShowCreate(true)} style={{ ...btnSecondary, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Box size={13} /> Ajouter un colis
                    </button>
                )}
            </div>

            {colisItems.length === 0 ? (
                <div style={{ padding: '24px', color: '#9CA3AF', fontSize: 13, textAlign: 'center' }}>
                    Aucun colis défini. Créez-en un pour organiser le contenu de l'expédition.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {colisItems.map((c, idx) => {
                        const isOpen = expandedColisId === c.id;
                        const assignedItemIds = c.item_ids || [];
                        const assignedItems = availableItems.filter(i => assignedItemIds.includes(i.id));
                        const unassignedItems = availableItems.filter(i => !assignedItemIds.includes(i.id));

                        return (
                            <div key={c.id} style={{ borderBottom: idx < colisItems.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                                {/* Header du colis */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', userSelect: 'none' }}
                                    onClick={() => setExpandedColisId(isOpen ? null : c.id)}>
                                    <Box size={15} color="#6366F1" style={{ flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                                            {c.label || `${c.type} ${idx + 1}`}
                                        </span>
                                        <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 8 }}>{c.type}</span>
                                        {c.dimensions && <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 6 }}>· {c.dimensions}</span>}
                                        {c.poids && <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 6 }}>· {c.poids}</span>}
                                    </div>
                                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{assignedItems.length} item{assignedItems.length !== 1 ? 's' : ''}</span>
                                    <span style={{ fontSize: 12, color: '#9CA3AF', transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>›</span>
                                    {!isExpediee && (
                                        <button onClick={e => { e.stopPropagation(); if (window.confirm('Supprimer ce colis ?')) onDeleteColis(c.id); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E5E7EB', padding: 2, marginLeft: 4 }}>
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>

                                {/* Contenu du colis (expandable) */}
                                {isOpen && (
                                    <div style={{ padding: '0 16px 12px 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {/* Items déjà assignés */}
                                        {assignedItems.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                {assignedItems.map(item => (
                                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, background: '#F5F3FF' }}>
                                                        <span style={{ fontSize: 12, flex: 1, color: '#374151' }}>{labelForItem(item)}</span>
                                                        {!isExpediee && (
                                                            <button onClick={() => onToggleItem(c.id, item.id)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, fontSize: 14, lineHeight: 1 }}>
                                                                ×
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Ajouter des items depuis l'expédition */}
                                        {!isExpediee && unassignedItems.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginBottom: 4 }}>AJOUTER DANS CE COLIS</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    {unassignedItems.map(item => (
                                                        <div key={item.id} onClick={() => onToggleItem(c.id, item.id)}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, background: '#F9FAFB', cursor: 'pointer', border: '1px dashed #E5E7EB' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#EEF2FF'}
                                                            onMouseLeave={e => e.currentTarget.style.background = '#F9FAFB'}>
                                                            <Plus size={11} color="#9CA3AF" style={{ flexShrink: 0 }} />
                                                            <span style={{ fontSize: 12, color: '#6B7280' }}>{labelForItem(item)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {assignedItems.length === 0 && isExpediee && (
                                            <div style={{ fontSize: 12, color: '#9CA3AF' }}>Aucun item assigné.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showCreate && (
                <CreateColisModal
                    onClose={() => setShowCreate(false)}
                    onCreate={(fields) => onCreateColis(shipmentId, fields)}
                />
            )}
        </div>
    );
}

// ── Vue Détail expédition ─────────────────────────────────────────────────────
function ShipmentDetail({ shipment, shipmentItems, colisItems, projects, onBack, onUpdateShipment, onAddItems, onRemoveItem, onValidate, onDelete, onCreateColis, onUpdateColis, onDeleteColis, onToggleItem }) {
    const [showPicker, setShowPicker] = useState(false);
    const [showFreeItem, setShowFreeItem] = useState(false);
    const [editingStatut, setEditingStatut] = useState(false);

    const ouvrageItems = shipmentItems.filter(i => i.type === 'ouvrage');
    const libreItems = shipmentItems.filter(i => i.type === 'libre');
    const existingRowIds = useMemo(() => new Set(ouvrageItems.map(i => i.row_id)), [ouvrageItems]);
    const isExpediee = shipment.statut === 'Expédiée';

    // selected = [{ row, partie }]
    const handlePickerAdd = async (selected, project) => {
        const newItems = selected.map(({ row: r, partie }) => ({
            type: 'ouvrage',
            project_id: String(project.id),
            row_id: r.id,
            piece: r.piece || '',
            produit: r.produit || '',
            // Pour rideau/voilage, on garde la partie ; pour les autres on met 'complet'
            partie: isRideauVoilage(r.produit) ? partie : 'complet',
        }));
        await onAddItems(shipment.id, newItems);
        setShowPicker(false);
    };

    const handleValidate = async () => {
        if (!window.confirm(`Confirmer l'expédition "${shipment.label || shipment.reference}" ?\n\nLes ouvrages inclus seront marqués "Expédié".`)) return;
        await onValidate(shipment.id);
    };

    const handleDelete = async () => {
        if (!window.confirm('Supprimer cette expédition ?')) return;
        await onDelete(shipment.id);
        onBack();
    };

    const projectName = (projectId) => projects.find(p => String(p.id) === String(projectId))?.name || '—';

    return (
        <div style={{ minHeight: '100vh', background: '#F9F7F2', padding: 24 }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div>
                        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontWeight: 600, fontSize: 13, marginBottom: 4, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                            ← Retour
                        </button>
                        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.5px' }}>
                            {shipment.label || shipment.reference}
                        </h1>
                        {shipment.label && <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>{shipment.reference}</div>}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                            {/* Statut cliquable */}
                            <div style={{ position: 'relative' }}>
                                <button onClick={() => !isExpediee && setEditingStatut(v => !v)} style={{ background: 'none', border: 'none', cursor: isExpediee ? 'default' : 'pointer', padding: 0 }}>
                                    {pill(shipment.statut, STATUT_STYLE[shipment.statut] || STATUT_STYLE['Brouillon'])}
                                </button>
                                {editingStatut && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 10, minWidth: 160 }}>
                                        {STATUTS.filter(s => s !== 'Expédiée').map(s => (
                                            <button key={s} onClick={() => { onUpdateShipment(shipment.id, { statut: s }); setEditingStatut(false); }} style={{ display: 'block', width: '100%', padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>
                                                {pill(s, STATUT_STYLE[s])}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {shipment.date_expedition && <span style={{ fontSize: 12, color: '#6B7280' }}>{new Date(shipment.date_expedition).toLocaleDateString('fr-FR')}</span>}
                            {shipment.destination && <span style={{ fontSize: 12, color: '#6B7280' }}>· {shipment.destination}</span>}
                        </div>
                        {shipment.notes && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 6, fontStyle: 'italic' }}>{shipment.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {!isExpediee && (
                            <button onClick={handleValidate} style={{ ...btnPrimary, background: '#1E2447' }}>
                                <Truck size={14} /> Valider expédition
                            </button>
                        )}
                        <button onClick={handleDelete} style={{ ...btnSecondary, color: '#EF4444', borderColor: '#FEE2E2' }}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Ouvrages */}
                <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>
                            OUVRAGES <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({ouvrageItems.length})</span>
                        </div>
                        {!isExpediee && (
                            <button onClick={() => setShowPicker(true)} style={{ ...btnSecondary, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <PackagePlus size={13} /> Ajouter des ouvrages
                            </button>
                        )}
                    </div>
                    {ouvrageItems.length === 0 ? (
                        <div style={{ padding: '24px', color: '#9CA3AF', fontSize: 13, textAlign: 'center' }}>Aucun ouvrage ajouté.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#F9FAFB' }}>
                                <tr>
                                    <TH>Pièce</TH>
                                    <TH>Produit</TH>
                                    <TH>Projet</TH>
                                    {!isExpediee && <TH style={{ width: 40 }} />}
                                </tr>
                            </thead>
                            <tbody>
                                {ouvrageItems.map(item => {
                                    const partieLabel = item.partie && item.partie !== 'complet'
                                        ? item.partie === 'rail' ? 'Rail seul' : 'Rideau seul'
                                        : null;
                                    return (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                            <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{item.piece || '—'}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 13, color: '#6B7280' }}>
                                                {item.produit || '—'}
                                                {partieLabel && (
                                                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#DBEAFE', color: '#1E40AF' }}>
                                                        {partieLabel}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 16px', fontSize: 12, color: '#9CA3AF' }}>{projectName(item.project_id)}</td>
                                            {!isExpediee && (
                                                <td style={{ padding: '10px 16px' }}>
                                                    <button onClick={() => onRemoveItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 2 }}>
                                                        <X size={14} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Items libres */}
                <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>
                            ITEMS LIBRES <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({libreItems.length})</span>
                        </div>
                        {!isExpediee && (
                            <button onClick={() => setShowFreeItem(true)} style={{ ...btnSecondary, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Plus size={13} /> Ajouter un item
                            </button>
                        )}
                    </div>
                    {libreItems.length === 0 ? (
                        <div style={{ padding: '24px', color: '#9CA3AF', fontSize: 13, textAlign: 'center' }}>Aucun item libre ajouté.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#F9FAFB' }}>
                                <tr>
                                    <TH>Description</TH>
                                    <TH>Quantité</TH>
                                    <TH>Notes</TH>
                                    {!isExpediee && <TH style={{ width: 40 }} />}
                                </tr>
                            </thead>
                            <tbody>
                                {libreItems.map(item => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                        <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{item.description}</td>
                                        <td style={{ padding: '10px 16px', fontSize: 13, color: '#6B7280' }}>{item.quantite || '—'}</td>
                                        <td style={{ padding: '10px 16px', fontSize: 12, color: '#9CA3AF' }}>{item.notes || '—'}</td>
                                        {!isExpediee && (
                                            <td style={{ padding: '10px 16px' }}>
                                                <button onClick={() => onRemoveItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 2 }}>
                                                    <X size={14} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Répartition */}
                <ColisSection
                    shipmentId={shipment.id}
                    shipmentItems={shipmentItems}
                    colisItems={colisItems}
                    isExpediee={isExpediee}
                    onCreateColis={onCreateColis}
                    onUpdateColis={onUpdateColis}
                    onDeleteColis={onDeleteColis}
                    onToggleItem={onToggleItem}
                />
            </div>

            {showPicker && (
                <OuvragePicker projects={projects} existingRowIds={existingRowIds} onClose={() => setShowPicker(false)} onAdd={handlePickerAdd} />
            )}
            {showFreeItem && (
                <FreeItemModal onClose={() => setShowFreeItem(false)} onAdd={(item) => onAddItems(shipment.id, [item])} />
            )}
        </div>
    );
}

// ── Vue liste (tableau style ProjectList) ─────────────────────────────────────
function ShipmentList({ shipments, items, projects, onSelect, onDelete, onUpdateShipment }) {
    const [search, setSearch] = useState('');
    const [filterStatut, setFilterStatut] = useState('');
    const [filterProject, setFilterProject] = useState('');

    const filtered = useMemo(() => {
        return shipments.filter(s => {
            if (filterStatut && s.statut !== filterStatut) return false;
            if (search.trim()) {
                const q = search.toLowerCase();
                if (!`${s.label} ${s.reference} ${s.destination} ${s.notes}`.toLowerCase().includes(q)) return false;
            }
            if (filterProject) {
                const shipmentItems = items.filter(i => i.expedition_id === s.id && i.type === 'ouvrage');
                if (!shipmentItems.some(i => i.project_id === filterProject)) return false;
            }
            return true;
        });
    }, [shipments, items, search, filterStatut, filterProject]);

    const usedProjects = useMemo(() => {
        const ids = new Set(items.filter(i => i.type === 'ouvrage').map(i => i.project_id));
        return projects.filter(p => ids.has(String(p.id)));
    }, [items, projects]);

    const projectNamesForShipment = (shipmentId) => {
        const sItems = items.filter(i => i.expedition_id === shipmentId && i.type === 'ouvrage');
        const ids = [...new Set(sItems.map(i => i.project_id))];
        return ids.map(id => projects.find(p => String(p.id) === String(id))?.name).filter(Boolean).join(', ') || '—';
    };

    const countOuvrages = (shipmentId) => items.filter(i => i.expedition_id === shipmentId && i.type === 'ouvrage').length;
    const countLibres = (shipmentId) => items.filter(i => i.expedition_id === shipmentId && i.type === 'libre').length;

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Supprimer cette expédition ?')) return;
        onDelete(id);
    };

    return (
        <>
            {/* Barre de filtres */}
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                    <input style={{ ...inputStyle, paddingLeft: 32, background: 'white' }} placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <select style={{ ...inputStyle, flex: 1, cursor: 'pointer', background: 'white' }} value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
                        <option value="">Tous les statuts</option>
                        {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select style={{ ...inputStyle, flex: 1, cursor: 'pointer', background: 'white' }} value={filterProject} onChange={e => setFilterProject(e.target.value)}>
                        <option value="">Tous les projets</option>
                        {usedProjects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Tableau */}
            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                {filtered.length === 0 ? (
                    <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9CA3AF' }}>
                        <Truck size={48} style={{ opacity: 0.15, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
                        <div style={{ fontWeight: 600, fontSize: 15, color: '#6B7280' }}>
                            {shipments.length === 0 ? 'Aucune expédition' : 'Aucun résultat'}
                        </div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>
                            {shipments.length === 0 ? 'Créez votre première expédition avec le bouton ci-dessus.' : 'Modifiez les filtres pour voir plus de résultats.'}
                        </div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                <tr>
                                    <TH>Référence</TH>
                                    <TH>Projet(s)</TH>
                                    <TH>Notes</TH>
                                    <TH>Contenu</TH>
                                    <TH>Date expédition</TH>
                                    <TH style={{ textAlign: 'center' }}>Statut</TH>
                                    <TH style={{ width: 48 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((s) => {
                                    const nOuvrages = countOuvrages(s.id);
                                    const nLibres = countLibres(s.id);
                                    const contenu = [
                                        nOuvrages > 0 && `${nOuvrages} ouvrage${nOuvrages > 1 ? 's' : ''}`,
                                        nLibres > 0 && `${nLibres} item${nLibres > 1 ? 's' : ''} libre${nLibres > 1 ? 's' : ''}`,
                                    ].filter(Boolean).join(' + ') || '—';

                                    return (
                                        <tr
                                            key={s.id}
                                            onClick={() => onSelect(s)}
                                            style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', transition: 'background 0.1s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                        >
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>{s.label || s.reference}</div>
                                                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{s.label ? s.reference : ''}{s.destination ? ` · ${s.destination}` : ''}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>
                                                {projectNamesForShipment(s.id)}
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', maxWidth: 200 }}>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {s.notes || '—'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280' }}>{contenu}</td>
                                            <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>
                                                {s.date_expedition ? new Date(s.date_expedition).toLocaleDateString('fr-FR') : '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                <select
                                                    value={s.statut || 'Brouillon'}
                                                    onChange={e => onUpdateShipment(s.id, { statut: e.target.value })}
                                                    disabled={s.statut === 'Expédiée'}
                                                    style={{
                                                        appearance: 'none', padding: '5px 12px', borderRadius: 20,
                                                        border: '1px solid #E5E7EB', background: 'white',
                                                        color: STATUT_STYLE[s.statut]?.color || '#6B7280',
                                                        fontWeight: 600, fontSize: 12, cursor: s.statut === 'Expédiée' ? 'default' : 'pointer',
                                                        outline: 'none', minWidth: 120, textAlign: 'center',
                                                    }}
                                                >
                                                    {STATUTS.map(st => <option key={st} value={st}>{st}</option>)}
                                                </select>
                                            </td>
                                            <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                                                <button onClick={e => handleDelete(e, s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 4 }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}

// ── Onglets ───────────────────────────────────────────────────────────────────
const TABS = [
    { key: 'expeditions', label: 'Expéditions' },
    { key: 'analyse',     label: 'Analyse' },
];

// ── Écran principal ───────────────────────────────────────────────────────────
export default function LogistiqueScreen({ projects, onUpdateProject, onBack }) {
    const {
        shipments, items, loading,
        createShipment, updateShipment, deleteShipment,
        addItems, removeItem, validateShipment,
        createColis, updateColis, deleteColis, toggleItemInColis,
        itemsForShipment, colisForShipment,
    } = useShipments();

    const [tabKey, setTabKey]             = useState('expeditions');
    const [view, setView]                 = useState('main'); // 'main' | 'detail'
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [showCreate, setShowCreate]     = useState(false);

    const handleCreate = async (fields) => {
        const shipment = await createShipment(fields);
        if (shipment) { setSelectedShipment(shipment); setView('detail'); }
        return shipment;
    };

    const handleSelect  = (shipment) => { setSelectedShipment(shipment); setView('detail'); };
    const handleBack    = () => { setSelectedShipment(null); setView('main'); };

    const liveShipment = useMemo(() => {
        if (!selectedShipment) return null;
        return shipments.find(s => s.id === selectedShipment.id) || selectedShipment;
    }, [shipments, selectedShipment]);

    const handleValidate = async (id) => {
        await validateShipment(id, projects, onUpdateProject);
    };

    // ── Vue détail (full takeover, pas de tabs) ──
    if (view === 'detail' && liveShipment) {
        return (
            <ShipmentDetail
                shipment={liveShipment}
                shipmentItems={itemsForShipment(liveShipment.id)}
                colisItems={colisForShipment(liveShipment.id)}
                projects={projects}
                onBack={handleBack}
                onUpdateShipment={updateShipment}
                onAddItems={addItems}
                onRemoveItem={removeItem}
                onValidate={handleValidate}
                onDelete={(id) => { deleteShipment(id); handleBack(); }}
                onCreateColis={createColis}
                onUpdateColis={updateColis}
                onDeleteColis={deleteColis}
                onToggleItem={toggleItemInColis}
            />
        );
    }

    // ── Vue principale (tabbed) ──
    return (
        <div style={{ minHeight: '100vh', background: '#F9F7F2', padding: 24, display: 'flex', flexDirection: 'column' }}>
            <div style={{ maxWidth: 1600, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1 }}>

                {/* Header */}
                <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontWeight: 600, fontSize: 13, marginBottom: 8, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                            ← Retour
                        </button>
                        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>Logistique</h1>
                        <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>Gestion des expéditions et suivi logistique</p>
                    </div>
                    {tabKey === 'expeditions' && (
                        <button onClick={() => setShowCreate(true)} style={{ ...btnPrimary, background: '#1E2447', padding: '10px 20px', fontSize: 14, fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                            <Plus size={16} /> Nouvelle expédition
                        </button>
                    )}
                </div>

                {/* Pastilles de navigation */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                    <div style={{
                        background: 'white', borderRadius: 9999, padding: 4, display: 'flex', gap: 4,
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                        border: '1px solid rgba(0,0,0,0.05)',
                    }}>
                        {TABS.map(t => (
                            <button key={t.key} onClick={() => setTabKey(t.key)} style={{
                                padding: '8px 28px', borderRadius: 9999, fontSize: 14, fontWeight: 500,
                                border: 'none', cursor: 'pointer',
                                background: tabKey === t.key ? '#1E2447' : 'transparent',
                                color: tabKey === t.key ? 'white' : '#4B5563',
                                transition: 'all 0.2s',
                                boxShadow: tabKey === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                outline: 'none',
                            }}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Contenu */}
                <div style={{ flex: 1 }}>

                    {/* ── Onglet Expéditions ── */}
                    {tabKey === 'expeditions' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Stats */}
                            {!loading && (
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    {[
                                        { label: 'Total',          value: shipments.length,                                            bg: '#F9FAFB', color: '#374151' },
                                        { label: 'En préparation', value: shipments.filter(s => s.statut === 'En préparation').length,  bg: '#FFFBEB', color: '#92400E' },
                                        { label: 'Expédiées',      value: shipments.filter(s => s.statut === 'Expédiée').length,        bg: '#ECFDF5', color: '#065F46' },
                                        { label: 'Brouillons',     value: shipments.filter(s => s.statut === 'Brouillon').length,       bg: '#F5F3FF', color: '#5B21B6' },
                                    ].map(s => (
                                        <div key={s.label} style={{ flex: '1 1 120px', background: s.bg, borderRadius: 12, padding: '14px 18px', border: '1px solid rgba(0,0,0,0.04)' }}>
                                            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: s.color, opacity: 0.7, marginTop: 2 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {loading ? (
                                <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Chargement...</div>
                            ) : (
                                <ShipmentList
                                    shipments={shipments}
                                    items={items}
                                    projects={projects}
                                    onSelect={handleSelect}
                                    onDelete={deleteShipment}
                                    onUpdateShipment={updateShipment}
                                />
                            )}
                        </div>
                    )}

                    {/* ── Onglet Analyse ── */}
                    {tabKey === 'analyse' && (
                        <LogistiqueAnalyseView
                            shipments={shipments}
                            items={items}
                            projects={projects}
                            embedded
                        />
                    )}
                </div>
            </div>

            {showCreate && (
                <CreateShipmentModal onClose={(result) => { setShowCreate(false); if (result) handleSelect(result); }} onCreate={createShipment} />
            )}
        </div>
    );
}

// ── Styles partagés ───────────────────────────────────────────────────────────
const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid #E5E7EB', fontSize: 13, outline: 'none',
    boxSizing: 'border-box',
};
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 };
const btnPrimary = {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: '#6366F1', color: '#fff', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
};
const btnSecondary = {
    padding: '7px 14px', borderRadius: 8,
    border: '1px solid #E5E7EB', background: '#fff',
    color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
};
