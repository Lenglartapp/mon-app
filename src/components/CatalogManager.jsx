import React, { useState, useMemo, useRef, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import Popover from '@mui/material/Popover';
import { DataGrid } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import DaDialog, { DaTabs } from './ui/DaDialog';
import VariantTabs from './VariantTabs';
import { DaField } from './ui/DaForm';
import { ToolbarButton, ToolbarSearch } from './ui/ToolbarControls';
import { DATAGRID_DA_SX, TABLE_FRAME_STYLE, DA_FIELD_SX } from '../lib/constants/daStyles';
import { CHIFFRAGE_SCHEMA } from '../lib/schemas/chiffrage';
import { uid } from '../lib/utils/uid';

const CATEGORY_TABS = [
    { key: 'tissus', label: 'Tissus' },
    { key: 'rails', label: 'Rails' },
    { key: 'stores', label: 'Stores' },
    { key: 'passementerie', label: 'Passementerie' },
];

// Libellé de la colonne d'une ligne de chiffrage qui référence un article (« Tissu 1 »…).
const FIELD_LABELS = Object.fromEntries((CHIFFRAGE_SCHEMA || []).map((c) => [c.key, c.label]));
const EXTRA_LABELS = { tissu_1: 'Tissu 1', tissu_2: 'Tissu 2', passementerie_1: 'Passementerie 1', passementerie_2: 'Passementerie 2', type_interieur: 'Intérieur', molleton: 'Molleton', baguette_1: 'Baguette 1', baguette_2: 'Baguette 2', mecanisme_fourniture: 'Mécanisme', mecanisme_store: 'Mécanisme store', toile_finition_1: 'Toile' };
const fieldLabel = (k) => FIELD_LABELS[k] || EXTRA_LABELS[k] || k;
const lineLabel = (r) => [r.zone, r.piece, r.produit].filter(Boolean).join(' · ') || 'Ligne sans repère';

/**
 * Où chaque article de la bibliothèque est utilisé dans le chiffrage :
 * nom d'article → [{ id, label, fields: [colonne…] }]
 */
function buildUsage(rows, names) {
    const out = new Map();
    (rows || []).forEach((r) => {
        if (!r || typeof r !== 'object') return;
        const hits = new Map();
        Object.entries(r).forEach(([k, v]) => {
            if (typeof v !== 'string' || !names.has(v)) return;
            if (!hits.has(v)) hits.set(v, []);
            hits.get(v).push(fieldLabel(k));
        });
        hits.forEach((fields, name) => {
            if (!out.has(name)) out.set(name, []);
            out.get(name).push({ id: r.id, label: lineLabel(r), fields });
        });
    });
    return out;
}

const SECTION_TITLE = { fontSize: 16, fontWeight: 500, color: '#111827', margin: 0 };

// rows : lignes du chiffrage (colonne « Utilisé » + détail des lignes qui utilisent l'article).
export default function CatalogManager({ open, onClose, catalog, onCatalogChange, rows = null, ...props }) {
    const [selectionModel, setSelectionModel] = useState([]);
    const [search, setSearch] = useState('');
    const [usageAnchor, setUsageAnchor] = useState(null); // { el, name }
    const [activeTab, setActiveTab] = React.useState('catalog');
    const [activeCategoryTab, setActiveCategoryTab] = React.useState('tissus'); // New Sub-tab state
    const [localSettings, setLocalSettings] = React.useState(props.settings || { taux_horaire: 135, prix_nuit: 180, prix_repas: 25 });

    // Track previous props to prevent overwrite loops caused by parent re-renders
    const prevSettingsRef = useRef(JSON.stringify(props.settings));

    useEffect(() => {
        const nextStr = JSON.stringify(props.settings);
        if (nextStr !== prevSettingsRef.current) {
            // Only update if external data genuinely changed
            setLocalSettings(props.settings);
            prevSettingsRef.current = nextStr;
        }
    }, [props.settings]);

    // Sécurité : Si le catalogue arrive avec des IDs manquants (ex: import ou bug historique)
    // on les génère et on notifie le parent immédiatement.
    useEffect(() => {
        if (catalog && Array.isArray(catalog) && catalog.some(r => !r.id)) {
            console.log("🛠️ Lib : Nettoyage automatique des IDs manquants dans la bibliothèque");
            const clean = catalog.map(r => r.id ? r : { ...r, id: uid() });
            onCatalogChange(clean);
        }
    }, [catalog, onCatalogChange]);

    const onSettingsChange = props.onSettingsChange;
    // Debounce ref
    const debounceRef = useRef(null);

    const handleSettingChange = (key, val) => {
        // 1. Update local UI immediately
        const finalVal = val === '' ? '' : Number(val);
        const newSettings = { ...localSettings, [key]: finalVal };
        setLocalSettings(newSettings);

        // 2. Debounce parent update
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            if (onSettingsChange) {
                onSettingsChange(newSettings);
            }
        }, 800);
    };

    const handleDeleteRows = () => {
        const newCatalog = catalog.filter(r => !selectionModel.includes(r.id));
        onCatalogChange(newCatalog);
        setSelectionModel([]);
    };

    const processRowUpdate = (newRow) => {
        // Auto-concat logic: Fournisseur + Référence + Coloris
        const nameParts = [newRow.provider, newRow.reference, newRow.color].filter(Boolean);
        const name = nameParts.length > 0 ? nameParts.join(' ') : 'Article Sans Nom';
        
        // Auto-compute sellPrice if buyPrice or coef changed (except for stores)
        let sellPrice = newRow.sellPrice;
        if (activeCategoryTab !== 'stores' && newRow.buyPrice !== undefined && newRow.coef !== undefined) {
            sellPrice = Math.round((newRow.buyPrice * newRow.coef) * 100) / 100;
        }

        const updatedRow = { ...newRow, name, sellPrice };

        const updatedCatalog = catalog.map(r => r.id === newRow.id ? updatedRow : r);
        onCatalogChange(updatedCatalog);
        return updatedRow;
    };

    // Filtered Rows for DataGrid
    const filteredRows = useMemo(() => {
        if (!catalog) return [];
        
        // Sécurité : Assurer que chaque ligne a un ID pour éviter le crash DataGrid
        const sanitized = catalog.map(r => r.id ? r : { ...r, id: uid() });

        let list = sanitized;
        if (activeCategoryTab === 'tissus') list = sanitized.filter(r => ['Tissu', 'Tissus', 'Doublure', 'Doublures', 'Inter', 'Confection'].includes(r.category));
        else if (activeCategoryTab === 'rails') list = sanitized.filter(r => ['Rail', 'Rails', 'Tringle', 'Mecanisme', 'Mécanisme'].includes(r.category));
        else if (activeCategoryTab === 'stores') list = sanitized.filter(r => ['Store', 'Stores', 'Mecanisme Store'].includes(r.category));
        else if (activeCategoryTab === 'passementerie') list = sanitized.filter(r => ['Passementerie'].includes(r.category));
        const q = search.trim().toLowerCase();
        if (q) list = list.filter(r => [r.name, r.provider, r.reference, r.color].filter(Boolean).join(' ').toLowerCase().includes(q));
        return list;
    }, [catalog, activeCategoryTab, search]);

    // Utilisation de chaque article dans les lignes du chiffrage.
    const usage = useMemo(() => {
        if (!Array.isArray(rows)) return null;
        return buildUsage(rows, new Set((catalog || []).map(i => i?.name).filter(Boolean)));
    }, [rows, catalog]);
    const usageList = usageAnchor ? (usage?.get(usageAnchor.name) || []) : [];

    const handleAddRow = () => {
        const newId = uid();

        // Determine category based on active tab
        let defaultCategory = 'Tissu';
        if (activeCategoryTab === 'rails') defaultCategory = 'Rail';
        if (activeCategoryTab === 'stores') defaultCategory = 'Store';
        if (activeCategoryTab === 'passementerie') defaultCategory = 'Passementerie';

        const newRow = {
            id: newId,
            name: '', // Will be computed
            provider: '',
            reference: '',
            color: '',
            category: defaultCategory, // Pre-fill based on tab
            buyPrice: undefined,
            coef: 2, // Coef 2 par défaut partout, stores compris (PV = PA × Coef)
            sellPrice: undefined,
            width: undefined,
            motif: false,
            raccord_v: undefined,
            raccord_h: undefined,
            // Les mécanismes de store se vendent à la pièce, jamais au mètre linéaire.
            unit: activeCategoryTab === 'stores' ? 'pce' : 'ml'
        };
        // Auto-compute name immediately
        newRow.name = 'Nouvel Article (à compléter)';
        onCatalogChange([...catalog, newRow]);
    };

    const columns = useMemo(() => {
        const base = [
            { field: 'provider', headerName: 'Fournisseur', width: 140, editable: true },
            { field: 'reference', headerName: 'Référence', width: 140, editable: true },
            { field: 'color', headerName: 'Coloris', width: 120, editable: true },
            {
                field: 'name',
                headerName: 'Nom complet',
                width: 250,
                editable: false,
                description: 'Généré automatiquement (Fournisseur + Ref + Coloris)',
                valueGetter: (value, row) => {
                    const parts = [row?.provider, row?.reference, row?.color].filter(Boolean);
                    return parts.length > 0 ? parts.join(' ') : (value || '');
                },
            },
        ];

        const parseDecimal = (value) => {
            const str = String(value ?? '').trim().replace(',', '.');
            const n = parseFloat(str);
            return isNaN(n) ? value : n;
        };

        const priceCols = [
            {
                field: 'buyPrice',
                headerName: 'PA (€)',
                description: 'Prix d\'achat',
                width: 110,
                valueParser: (value) => parseDecimal(value),
                editable: (params) => params.row.unit !== 'pce', // Lock if Piece
                type: 'number',
                valueFormatter: (value) => {
                    if (value === undefined || value === null || value === '') return '';
                    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
                },
                renderCell: (params) => {
                    if (params.row.unit === 'pce') {
                        return <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: 11 }}>Voir tableau</span>;
                    }
                    if (params.value === undefined || params.value === null || params.value === '') return '';
                    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(params.value);
                }
            },
            {
                field: 'coef',
                headerName: 'Coef',
                width: 80,
                editable: true,
                type: 'number',
                valueParser: (value) => parseDecimal(value),
                description: 'Coefficient multiplicateur pour le calcul du PV (PV = PA * Coef)'
            },
            {
                field: 'sellPrice',
                headerName: 'PV (€)',
                description: 'Prix de vente (PV = PA × Coef)',
                width: 110,
                editable: (params) => params.row.unit !== 'pce', // Lock if Piece
                type: 'number',
                valueParser: (value) => parseDecimal(value),
                valueFormatter: (value) => {
                    if (value === undefined || value === null || value === '') return '';
                    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
                },
                renderCell: (params) => {
                    if (params.row.unit === 'pce') {
                        return <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: 11 }}>Voir tableau</span>;
                    }
                    if (params.value === undefined || params.value === null || params.value === '') return '';
                    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(params.value);
                }
            },
            {
                field: 'unit',
                headerName: 'Unité',
                width: 80,
                editable: true,
                type: 'singleSelect',
                valueOptions: ['ml', 'm2', 'pce', 'h']
            },
        ];

        const fabricCols = [
            { field: 'width', headerName: 'Laize', description: 'Laize (cm)', width: 80, editable: true, type: 'number', valueParser: (value) => parseDecimal(value) },
            { field: 'motif', headerName: 'Motif', description: 'Tissu à motif ?', width: 70, editable: true, type: 'boolean' },
            { field: 'raccord_v', headerName: 'Racc. V', description: 'Raccord vertical (cm)', width: 85, editable: true, type: 'number', valueParser: (value) => parseDecimal(value) },
            { field: 'raccord_h', headerName: 'Racc. H', description: 'Raccord horizontal (cm)', width: 85, editable: true, type: 'number', valueParser: (value) => parseDecimal(value) },
        ];

        let cols = [...base];

        // PA / PV / Unit: Visible for Tissus, Rails AND Passementerie
        if (['tissus', 'rails', 'passementerie'].includes(activeCategoryTab)) {
            cols = [...cols, ...priceCols];
        }

        // Stores : le mécanisme est toujours vendu à la pièce, et son PA est propre à
        // chaque ligne de chiffrage — un PA/PV catalogue n'aurait pas de sens ici.
        // Seul le coefficient en a un : il pilote le PV de la ligne (PV = PA × Coef),
        // comme pour les rails. Sans lui, le PV Méca des stores restait à saisir à la main.
        if (activeCategoryTab === 'stores') {
            const coefCol = priceCols.find(c => c.field === 'coef');
            if (coefCol) cols = [...cols, coefCol];
        }

        // Fabric Specs (Laize, Motif, Raccords): Visible for Tissus ONLY
        if (activeCategoryTab === 'tissus') {
            cols = [...cols, ...fabricCols];
        }

        // Colonnes extensibles : elles se partagent TOUJOURS la largeur de la fenêtre
        // (proportions = largeurs d'origine, plancher bas) — jamais de défilement
        // horizontal, laize et raccords visibles quel que soit l'écran. Libellé complet
        // en infobulle (`description`) quand l'en-tête est abrégé.
        // Utilisation dans le chiffrage : nombre de lignes, cliquable pour voir lesquelles.
        if (usage) {
            cols = [...cols, {
                field: '__usage',
                headerName: 'Utilisé',
                description: "Nombre de lignes du chiffrage qui utilisent l'article (cliquer pour les voir)",
                width: 90,
                type: 'number',
                align: 'right',
                headerAlign: 'right',
                editable: false,
                valueGetter: (_v, row) => usage.get(row?.name)?.length || 0,
                renderCell: (params) => {
                    const n = params.value || 0;
                    if (!n) return <span style={{ color: '#D1D5DB' }}>—</span>;
                    return (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setUsageAnchor({ el: e.currentTarget, name: params.row.name }); }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px', borderRadius: 99, border: 'none', background: '#E8EAF2', color: '#1E2447', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                            {n} <ChevronDown size={12} />
                        </button>
                    );
                },
            }];
        }

        return cols.map(({ width, ...col }) => ({ ...col, flex: width, minWidth: 60 }));
    }, [activeCategoryTab, usage]);

    if (!open) return null;

    const settingField = (key, label, hint, extra = {}) => (
        <DaField label={label} hint={hint}>
            <TextField
                type="number"
                size="small"
                fullWidth
                value={localSettings[key] ?? (key === 'coef_sous_traitance' ? 2 : '')}
                onChange={(e) => handleSettingChange(key, e.target.value)}
                sx={DA_FIELD_SX}
                inputProps={extra}
            />
        </DaField>
    );

    return (
        <DaDialog
            open
            onClose={onClose}
            title="Bibliothèque"
            subtitle="Articles et paramètres de ce chiffrage"
            maxWidth="xl"
            height="90vh"
            bodyPadding="0"
            tabs={(
                // Intercalaires (comme les variantes du chiffrage), posés sur le trait sous l'en-tête.
                <div style={{ marginBottom: -15 }}>
                    <VariantTabs
                        tabs={[{ id: 'catalog', code: "Bibliothèque d'articles", name: '' }, { id: 'settings', code: 'Paramètres globaux', name: '' }]}
                        activeId={activeTab}
                        onOpen={setActiveTab}
                        colorFor={(_i, _n, on) => (on ? { bg: '#1E2447', fg: '#FFFFFF' } : { bg: '#E8EAF2', fg: '#1E2447' })}
                    />
                </div>
            )}
        >
            {activeTab === 'catalog' ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 28px 20px', boxSizing: 'border-box', gap: 14 }}>
                    {/* Barre : familles à gauche, actions à droite */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <DaTabs tabs={CATEGORY_TABS} value={activeCategoryTab} onChange={(k) => { setActiveCategoryTab(k); setSelectionModel([]); }} />
                        <span style={{ flex: 1 }} />
                        <ToolbarSearch value={search} onChange={setSearch} placeholder="Rechercher un article…" width={260} grow />
                        {selectionModel.length > 0 && (
                            <ToolbarButton icon={<Trash2 size={15} />} onClick={handleDeleteRows}>Supprimer ({selectionModel.length})</ToolbarButton>
                        )}
                        <ToolbarButton primary icon={<Plus size={15} />} onClick={handleAddRow}>Ajouter un article</ToolbarButton>
                    </div>
                    <div style={{ ...TABLE_FRAME_STYLE, flex: 1, minHeight: 0 }}>
                        <DataGrid
                            rows={filteredRows}
                            columns={columns}
                            processRowUpdate={processRowUpdate}
                            checkboxSelection
                            disableRowSelectionOnClick
                            rowSelectionModel={selectionModel}
                            onRowSelectionModelChange={setSelectionModel}
                            localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                            rowHeight={40}
                            columnHeaderHeight={42}
                            // L'icône de menu masquée de la dernière colonne dépassait de quelques px
                            // et suffisait à faire apparaître un défilement horizontal.
                            sx={{ ...DATAGRID_DA_SX, height: '100%', '& .MuiDataGrid-menuIcon': { overflow: 'hidden' } }}
                        />
                    </div>
                    <Popover
                        open={!!usageAnchor}
                        anchorEl={usageAnchor?.el}
                        onClose={() => setUsageAnchor(null)}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                        PaperProps={{ sx: { borderRadius: '8px', border: '1px solid #E0DED9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', maxWidth: 420 } }}
                    >
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #E8E6E2' }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{usageAnchor?.name}</div>
                            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Utilisé sur {usageList.length} ligne{usageList.length > 1 ? 's' : ''} du chiffrage</div>
                        </div>
                        <div style={{ maxHeight: 320, overflowY: 'auto', padding: '4px 0' }}>
                            {usageList.map((u, i) => (
                                <div key={u.id || i} style={{ display: 'flex', gap: 10, justifyContent: 'space-between', padding: '6px 14px', fontSize: 13, color: '#374151' }}>
                                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.label}</span>
                                    <span style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{u.fields.join(', ')}</span>
                                </div>
                            ))}
                        </div>
                    </Popover>
                </div>
            ) : (
                <div style={{ padding: '24px 28px', maxWidth: 760 }}>
                    <p style={SECTION_TITLE}>Paramètres de chiffrage</p>
                    <div style={{ fontSize: 13, color: '#6B7280', margin: '6px 0 20px' }}>
                        Valeurs de base des calculs automatiques de ce chiffrage (pose, confection, déplacements).
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px 24px' }}>
                        {settingField('taux_horaire', 'Taux horaire (€/h)', "Main d'œuvre : pose, confection, préparation.")}
                        {settingField('prix_nuit', 'Prix nuit hôtel (€)', "Coût d'une nuitée par technicien.")}
                        {settingField('prix_repas', 'Prix repas (€)', "Coût d'un repas par technicien.")}
                        {settingField('coef_sous_traitance', 'Coef. sous-traitance', 'PV sous-traitance = PA × coef.', { step: '0.1' })}
                    </div>
                </div>
            )}
        </DaDialog>
    );
}
