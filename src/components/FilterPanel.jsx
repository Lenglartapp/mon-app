// src/components/FilterPanel.jsx
import React, { useState, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { uid } from '../lib/utils/uid';

export function getFieldType(col) {
    if (!col) return 'text';
    if (col.type === 'number' || col.type === 'formula') return 'number';
    if (col.type === 'select' || col.type === 'singleSelect' || col.type === 'catalog_item' || col.options) return 'select';
    return 'text';
}

// Options d'un champ, normalisées en { value, label }.
// Deux formats coexistent dans les schémas : liste de chaînes (["Oui", "Non"])
// et liste d'objets ([{ value: 'IN_PROGRESS', label: 'En cours' }]).
function getColOptions(col) {
    if (!Array.isArray(col?.options)) return [];
    return col.options
        .map(o => (o && typeof o === 'object')
            ? { value: String(o.value ?? ''), label: String(o.label ?? o.value ?? '') }
            : { value: String(o ?? ''), label: String(o ?? '') })
        .filter(o => o.value !== '');
}

export function getOperatorsForCol(col) {
    const type = getFieldType(col);
    if (type === 'number') return [
        { value: 'equals', label: '=' },
        { value: 'notEqual', label: '≠' },
        { value: 'greaterThan', label: '>' },
        { value: 'lessThan', label: '<' },
        { value: 'greaterThanOrEqual', label: '≥' },
        { value: 'lessThanOrEqual', label: '≤' },
        { value: 'blank', label: 'est vide' },
        { value: 'notBlank', label: "n'est pas vide" },
    ];
    if (type === 'select') return [
        { value: 'equals', label: 'est' },
        { value: 'notEqual', label: "n'est pas" },
        { value: 'contains', label: 'contient' },
        { value: 'blank', label: 'est vide' },
        { value: 'notBlank', label: "n'est pas vide" },
    ];
    return [
        { value: 'contains', label: 'contient' },
        { value: 'notContains', label: 'ne contient pas' },
        { value: 'equals', label: 'est' },
        { value: 'notEqual', label: "n'est pas" },
        { value: 'blank', label: 'est vide' },
        { value: 'notBlank', label: "n'est pas vide" },
    ];
}

export function isConditionActive(cond) {
    if (!cond.field) return false;
    if (cond.operator === 'blank' || cond.operator === 'notBlank') return true;
    return cond.value !== '' && cond.value !== null && cond.value !== undefined;
}

export function evaluateCondition(cond, row) {
    const rawVal = row[cond.field];
    const filterVal = String(cond.value ?? '').toLowerCase().trim();
    switch (cond.operator) {
        case 'blank': return rawVal === null || rawVal === undefined || rawVal === '';
        case 'notBlank': return rawVal !== null && rawVal !== undefined && rawVal !== '';
        case 'contains': return String(rawVal ?? '').toLowerCase().includes(filterVal);
        case 'notContains': return !String(rawVal ?? '').toLowerCase().includes(filterVal);
        case 'equals': return String(rawVal ?? '').toLowerCase() === filterVal;
        case 'notEqual': return String(rawVal ?? '').toLowerCase() !== filterVal;
        case 'greaterThan': return Number(rawVal) > Number(cond.value);
        case 'lessThan': return Number(rawVal) < Number(cond.value);
        case 'greaterThanOrEqual': return Number(rawVal) >= Number(cond.value);
        case 'lessThanOrEqual': return Number(rawVal) <= Number(cond.value);
        default: return true;
    }
}

function FieldSelect({ fields, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const inputRef = useRef(null);

    const filtered = fields.filter(f =>
        f.label.toLowerCase().includes(search.toLowerCase())
    );
    const selected = fields.find(f => f.key === value);

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50); }}
                style={{
                    width: 150, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4,
                    background: 'white', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    color: selected ? '#111827' : '#9ca3af',
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {selected?.label || '— Champ —'}
                </span>
                <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0, marginLeft: 4 }}>▾</span>
            </button>
            {open && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => { setOpen(false); setSearch(''); }} />
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, marginTop: 2,
                        background: 'white', border: '1px solid #e5e7eb', borderRadius: 6,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 9999,
                        minWidth: 180, maxHeight: 240, overflow: 'hidden',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        <div style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Rechercher un champ..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ width: '100%', padding: '3px 6px', border: '1px solid #e5e7eb', borderRadius: 3, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {filtered.map(f => (
                                <div
                                    key={f.key}
                                    onClick={() => { onChange(f.key); setOpen(false); setSearch(''); }}
                                    style={{
                                        padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                                        background: f.key === value ? '#eff6ff' : 'white',
                                        fontWeight: f.key === value ? 600 : 400,
                                        color: f.key === value ? '#2563eb' : '#111827',
                                    }}
                                    onMouseEnter={e => { if (f.key !== value) e.currentTarget.style.background = '#f9fafb'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = f.key === value ? '#eff6ff' : 'white'; }}
                                >
                                    {f.label}
                                </div>
                            ))}
                            {filtered.length === 0 && (
                                <div style={{ padding: '8px 12px', fontSize: 12, color: '#9ca3af' }}>Aucun champ</div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default function FilterPanel({ schema, conditions, onChange, filters, setFilters }) {
    // Rétrocompatibilité avec l'ancienne API (filters/setFilters)
    conditions = conditions ?? filters ?? [];
    onChange = onChange ?? setFilters ?? (() => {});
    const filterableFields = schema.filter(col =>
        col.key !== 'sel' && !col.hidden &&
        !['photo', 'croquis', 'button'].includes(col.type)
    );

    const addCondition = () => {
        const firstCol = filterableFields[0];
        const ops = firstCol ? getOperatorsForCol(firstCol) : [{ value: 'contains' }];
        onChange([...conditions, {
            id: uid(),
            logic: 'et',
            field: firstCol?.key || '',
            operator: ops[0].value,
            value: '',
        }]);
    };

    const remove = (id) => onChange(conditions.filter(c => c.id !== id));

    const update = (id, patch) => onChange(conditions.map(c => c.id === id ? { ...c, ...patch } : c));

    const handleFieldChange = (id, fieldKey) => {
        const col = filterableFields.find(f => f.key === fieldKey);
        const ops = getOperatorsForCol(col);
        update(id, { field: fieldKey, operator: ops[0].value, value: '' });
    };

    const needsValue = (operator) => operator !== 'blank' && operator !== 'notBlank';

    return (
        <div style={{
            background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: 16, minWidth: 560,
        }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Filtrer</div>

            {conditions.length === 0 && (
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12, padding: '8px 0' }}>
                    Aucun filtre actif — ajoutez une condition pour filtrer les lignes.
                </div>
            )}

            {conditions.map((cond, i) => {
                const col = filterableFields.find(f => f.key === cond.field);
                const operators = getOperatorsForCol(col);
                const showValue = needsValue(cond.operator);
                const colOptions = getColOptions(col);

                return (
                    <div key={cond.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        {i === 0 ? (
                            <div style={{ width: 80, fontSize: 12, color: '#6b7280', textAlign: 'right', paddingRight: 4, flexShrink: 0 }}>
                                Lorsque
                            </div>
                        ) : (
                            <select
                                value={cond.logic}
                                onChange={e => update(cond.id, { logic: e.target.value })}
                                style={{ width: 80, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, flexShrink: 0 }}
                            >
                                <option value="et">et</option>
                                <option value="ou">ou</option>
                            </select>
                        )}

                        <FieldSelect
                            fields={filterableFields}
                            value={cond.field}
                            onChange={(fieldKey) => handleFieldChange(cond.id, fieldKey)}
                        />

                        <select
                            value={cond.operator}
                            onChange={e => update(cond.id, { operator: e.target.value, value: '' })}
                            style={{ padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, minWidth: 130 }}
                        >
                            {operators.map(op => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                        </select>

                        {showValue ? (
                            colOptions.length > 0 ? (
                                // Champ à options : on propose la liste au lieu d'une saisie libre.
                                // La valeur stockée est la valeur interne (ex. IN_PROGRESS), pas le
                                // libellé affiché — sans ça, la comparaison ne tombe jamais juste.
                                <select
                                    value={cond.value}
                                    onChange={e => update(cond.id, { value: e.target.value })}
                                    style={{ flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, outline: 'none', minWidth: 80, background: 'white' }}
                                >
                                    <option value="">— Choisir une valeur —</option>
                                    {colOptions.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type={getFieldType(col) === 'number' ? 'number' : 'text'}
                                    placeholder="Saisir une valeur"
                                    value={cond.value}
                                    onChange={e => update(cond.id, { value: e.target.value })}
                                    style={{ flex: 1, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, outline: 'none', minWidth: 80 }}
                                />
                            )
                        ) : (
                            <div style={{ flex: 1 }} />
                        )}

                        <button
                            onClick={() => remove(cond.id)}
                            style={{ flexShrink: 0, padding: 4, color: '#9ca3af', borderRadius: 3, display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fee2e2'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent'; }}
                            title="Supprimer la condition"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                );
            })}

            <button
                onClick={addCondition}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                    color: '#2563eb', fontSize: 13, borderRadius: 4, marginTop: 4,
                    border: '1px dashed #93c5fd', background: 'transparent', cursor: 'pointer',
                    width: '100%', justifyContent: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
                <Plus size={14} /> Ajouter une condition
            </button>
        </div>
    );
}
