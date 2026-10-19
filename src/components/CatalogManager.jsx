import React, { useState, useMemo, useRef, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import { DataGrid } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import { Plus, Trash2 } from 'lucide-react';
import DaDialog, { DaTabs } from './ui/DaDialog';
import VariantTabs from './VariantTabs';
import { DaField } from './ui/DaForm';
import { ToolbarButton, ToolbarSearch } from './ui/ToolbarControls';
import { DATAGRID_DA_SX, TABLE_FRAME_STYLE, DA_FIELD_SX } from '../lib/constants/daStyles';
import { CHIFFRAGE_SCHEMA } from '../lib/schemas/chiffrage';
import { uid } from '../lib/utils/uid';
import { buildUsage } from '../lib/catalogUsage';
import UsagePopover from './catalog/UsagePopover';
import { usageColumn, withTextNumberEditor } from './catalog/usageColumn';
import { useExcelCaret, FOCUS_ROW_SX } from '../lib/hooks/useExcelCaret';

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

// Un tissu sans laize ne permet aucun métrage : saisie obligatoire (cf. Matériauthèque).
const FABRIC_CATEGORIES = ['Tissu', 'Tissus', 'Doublure', 'Doublures', 'Inter', 'Confection'];
const missingLaize = (r) => FABRIC_CATEGORIES.includes(r?.category) && !(Number(r?.width || r?.laize) > 0);
const PLACEHOLDER_NAME = 'Nouvel Article (à compléter)';

const SECTION_TITLE = { fontSize: 16, fontWeight: 500, color: '#111827', margin: 0 };

// rows : lignes du chiffrage (colonne « Utilisé » + détail des lignes qui utilisent l'article).
export default function CatalogManager({ open, onClose, catalog, onCatalogChange, rows = null, ...props }) {
    const [selectionModel, setSelectionModel] = useState([]);
    const [search, setSearch] = useState('');
    const [usageAnchor, setUsageAnchor] = useState(null); // { el, name }
    const [activeTab, setActiveTab] = React.useState('catalog');
    const [activeCategoryTab, setActiveCategoryTab] = React.useState('tissus'); // New Sub-tab state
    const [gridWrapEl, setGridWrapEl] = useState(null);
    // Tissus AJOUTÉS pendant cette ouverture : laize obligatoire avant de fermer. Les
    // anciens tissus sans laize sont signalés en rouge sans bloquer.
    const addedIdsRef = useRef(new Set());
    const [laizeAlert, setLaizeAlert] = useState(false);
    useEffect(() => { if (open) addedIdsRef.current = new Set(); else setLaizeAlert(false); }, [open]);
    const fabricsWithoutLaize = (catalog || []).filter(r => r && addedIdsRef.current.has(r.id) && missingLaize(r));
    const handleClose = (event, reason) => {
        if (fabricsWithoutLaize.length) {
            setLaizeAlert(true);
            setActiveTab('catalog');
            setActiveCategoryTab('tissus');
            setSearch('');
            return;
        }
        setLaizeAlert(false);
        onClose?.(event, reason);
    };
    useExcelCaret(gridWrapEl);
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

    const processRowUpdate = (newRow, oldRow) => {
        // Nom = Fournisseur + Référence + Coloris. Sans aucun des trois, on garde le nom
        // actuel : modifier la laize ou le prix d'un article sans fournisseur ne doit pas
        // le renommer « Article Sans Nom » (ses lignes seraient renommées avec lui).
        const nameParts = [newRow.provider, newRow.reference, newRow.color].filter(Boolean);
        const keep = oldRow?.name && oldRow.name !== PLACEHOLDER_NAME ? oldRow.name : 'Article Sans Nom';
        const name = nameParts.length > 0 ? nameParts.join(' ') : keep;
        
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
        return buildUsage(rows, new Set((catalog || []).map(i => i?.name).filter(Boolean)), fieldLabel);
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
        newRow.name = PLACEHOLDER_NAME;
        addedIdsRef.current.add(newId);
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
            { field: 'width', headerName: 'Laize', description: 'Laize (cm) — obligatoire pour un tissu (sinon pas de métrage)', width: 80, editable: true, type: 'number', valueParser: (value) => parseDecimal(value),
              cellClassName: (p) => (missingLaize(p.row) ? 'laize-manquante' : '') },
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
        if (usage) cols = [...cols, usageColumn(usage, setUsageAnchor)];

        return cols.map(({ width, ...col }) => withTextNumberEditor({ ...col, flex: width, minWidth: 60 }));
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
            onClose={handleClose}
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
                    {laizeAlert && fabricsWithoutLaize.length > 0 && (
                        <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: 8, padding: '10px 14px', fontSize: 13, lineHeight: 1.5 }}>
                            <strong>Laize manquante</strong> : sans laize, le métrage du tissu ne se calcule pas. Renseignez-la (case en rouge)
                            ou supprimez l'article avant de fermer — {fabricsWithoutLaize.map(r => r.name || 'article sans nom').join(', ')}.
                        </div>
                    )}
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
                    <div ref={setGridWrapEl} style={{ ...TABLE_FRAME_STYLE, flex: 1, minHeight: 0 }}>
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
                            sx={{ ...DATAGRID_DA_SX, ...FOCUS_ROW_SX, height: '100%', '& .MuiDataGrid-menuIcon': { overflow: 'hidden' },
                                '& .laize-manquante': { backgroundColor: '#FEF2F2', boxShadow: 'inset 0 0 0 1px #FCA5A5' } }}
                        />
                    </div>
                    <UsagePopover anchor={usageAnchor} list={usageList} onClose={() => setUsageAnchor(null)} where="du chiffrage" />
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
