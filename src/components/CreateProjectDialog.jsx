import React, { useState, useMemo } from 'react';
import { TextField, Autocomplete } from '@mui/material';
import DaDialog, { DaTabs } from './ui/DaDialog';
import { ToolbarButton } from './ui/ToolbarControls';
import { DA_FIELD_SX } from '../lib/constants/daStyles';
import { DaField, ChoicePill } from './ui/DaForm';
import { createBlankProject } from "../lib/import/createBlankProject";
import { computeFormulas } from "../lib/formulas/compute";
import AddressAutocomplete from "./AddressAutocomplete";

const ROBOTO = 'Roboto, system-ui, sans-serif';

export default function CreateProjectDialog({
    open,
    onClose,
    onCreateBlank,
    onCreateFromMinute,
    onLoadMinuteDetail,
    minutes = [],
    prodSchema
}) {
    const [tab, setTab] = useState(0);

    // -- BLANK STATE --
    const [projectName, setProjectName] = useState("");
    const [useRideaux, setUseRideaux] = useState(true);
    const [useStoresClassiques, setUseStoresClassiques] = useState(false);
    const [useStoresBateau, setUseStoresBateau] = useState(false);
    const [useTentures, setUseTentures] = useState(false);
    const [useCacheSommier, setUseCacheSommier] = useState(false);
    const [usePlaid, setUsePlaid] = useState(false);
    const [useCoussins, setUseCoussins] = useState(false);
    const [useMobilier, setUseMobilier] = useState(false);

    // -- IMPORT STATE --
    const [selectedMinute, setSelectedMinute] = useState(null);
    // PERF — La liste des minutes est légère (sans `lines`). On charge le détail complet
    // de la minute choisie pour disposer de ses ouvrages au moment de créer le projet.
    const [selectedFull, setSelectedFull] = useState(null);
    const [loadingMinute, setLoadingMinute] = useState(false);
    // Le détail (lignes) du chiffrage n'a pas pu être chargé → on bloque l'import
    // (sinon le projet serait créé SANS ses ouvrages).
    const [minuteLoadFailed, setMinuteLoadFailed] = useState(false);
    const [deliveryDate, setDeliveryDate] = useState("");

    // -- EMPLACEMENT & LOGISTIQUE --
    const [location, setLocation] = useState("");
    const [interventionType, setInterventionType] = useState("livraison");
    const [expeditionType, setExpeditionType] = useState("depart_nantes");

    // RESET ON OPEN
    React.useEffect(() => {
        if (open) {
            setTab(minutes.length > 0 ? 0 : 1);
            setProjectName("");
            setSelectedMinute(null);
            setSelectedFull(null);
            setDeliveryDate("");
            setLocation("");
            setInterventionType("livraison");
            setExpeditionType("depart_nantes");
            setUseRideaux(true);
            setUseStoresClassiques(false);
            setUseStoresBateau(false);
            setUseTentures(false);
            setUseCacheSommier(false);
            setUsePlaid(false);
            setUseCoussins(false);
            setUseMobilier(false);
        }
    }, [open, minutes.length]);

    const logistique = {
        location,
        intervention_type: interventionType,
        expedition_type: interventionType === "installation" ? expeditionType : null,
    };

    const handleCreateBlank = () => {
        if (!projectName.trim()) return;
        onCreateBlank(projectName, [], {
            useRideaux,
            useStoresClassiques,
            useStoresBateau,
            useTentures,
            useCacheSommier,
            usePlaid,
            useCoussins,
            useMobilier,
            deliveryDate,
            ...logistique,
        });
    };

    // Charge le détail complet d'une minute à la sélection (pour ses ouvrages).
    const handleSelectMinute = async (m) => {
        setSelectedMinute(m);
        setSelectedFull(null);
        setMinuteLoadFailed(false);
        if (!m) return;
        // Si la minute possède déjà ses lignes (rare avec la liste légère), inutile de recharger.
        if (Array.isArray(m.lines) && m.lines.length > 0) { setSelectedFull(m); return; }
        if (!onLoadMinuteDetail || !m.id) { setSelectedFull(m); return; }
        setLoadingMinute(true);
        const full = await Promise.resolve(onLoadMinuteDetail(m.id)).catch(() => null);
        setSelectedFull(full || null);
        setMinuteLoadFailed(!full);
        setLoadingMinute(false);
    };

    const handleImport = async () => {
        if (!selectedMinute) return;
        // Garantit qu'on a bien le détail complet (lignes) avant de créer le projet.
        let full = selectedFull;
        if (!full) {
            if (onLoadMinuteDetail && selectedMinute.id) {
                setLoadingMinute(true);
                full = await Promise.resolve(onLoadMinuteDetail(selectedMinute.id)).catch(() => null);
                setLoadingMinute(false);
                if (!full) { setMinuteLoadFailed(true); return; } // jamais de projet sans ses lignes
                setSelectedFull(full);
                setMinuteLoadFailed(false);
            } else {
                full = selectedMinute;
            }
        }
        onCreateFromMinute({
            name: full.name || "Projet Importé",
            rows: full.lines || [],
            meta: full,
            deliveryDate,
            ...logistique,
        });
    };


    return (
        <DaDialog
            open={open}
            onClose={onClose}
            title="Nouveau projet"
            subtitle="À partir d'une minute chiffrée ou d'un projet vierge."
            maxWidth="sm"
            tabs={<DaTabs
                tabs={[
                    { key: 0, label: "Import d'une minute", disabled: minutes.length === 0 },
                    { key: 1, label: 'Projet vierge' },
                ]}
                value={tab}
                onChange={setTab}
            />}
            footer={<>
                <div style={{ flex: 1 }} />
                <ToolbarButton onClick={onClose}>Annuler</ToolbarButton>
                {tab === 0 ? (
                    <ToolbarButton primary onClick={handleImport} disabled={!selectedMinute || !deliveryDate || loadingMinute}>
                        {loadingMinute ? 'Chargement…' : 'Importer le projet'}
                    </ToolbarButton>
                ) : (
                    <ToolbarButton primary onClick={handleCreateBlank} disabled={!projectName.trim() || !deliveryDate}>
                        Créer le projet
                    </ToolbarButton>
                )}
            </>}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* ONGLET 0 : IMPORT D'UNE MINUTE */}
                {tab === 0 && (<>
                    <DaField label="Minute chiffrée" hint="Créez le projet directement à partir d'une minute validée.">
                        <Autocomplete
                            options={minutes}
                            getOptionLabel={(m) => `${m.name || "Sans nom"} (${m.client || "Client ?"})`}
                            value={selectedMinute}
                            onChange={(e, v) => handleSelectMinute(v)}
                            renderInput={(params) => <TextField {...params} placeholder="Rechercher une minute…" autoFocus size="small" sx={DA_FIELD_SX} />}
                            renderOption={(props, option) => (
                                <li {...props}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 500, fontSize: 14 }}>{option.name || "Sans nom"}</span>
                                        <span style={{ fontSize: 12, color: '#6B7280' }}>
                                            {option.client || "Client inconnu"} — {new Date(option.ts || Date.now()).toLocaleDateString()}
                                        </span>
                                    </div>
                                </li>
                            )}
                        />
                    </DaField>
                    <DaField label="Date de livraison prévue">
                        <TextField type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} fullWidth size="small" sx={DA_FIELD_SX} />
                    </DaField>
                    {selectedMinute && (
                        <div style={{ padding: '12px 14px', background: '#F7F7F5', borderRadius: 8, fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontWeight: 600, color: '#111827' }}>Résumé</div>
                            <div>Client : {selectedMinute.client || "—"}</div>
                            <div>Lignes : {loadingMinute ? "chargement…" : minuteLoadFailed ? "non chargées" : `${((selectedFull || selectedMinute).lines || []).length} ouvrages`}</div>
                            {minuteLoadFailed && !loadingMinute && (
                                <div style={{ color: '#B91C1C', marginTop: 2 }}>
                                    Le chiffrage n'a pas pu être chargé (serveur lent ou connexion interrompue). Cliquez sur « Importer le projet » pour réessayer.
                                </div>
                            )}
                        </div>
                    )}
                </>)}

                {/* ONGLET 1 : PROJET VIERGE */}
                {tab === 1 && (<>
                    <DaField label="Nom du projet / client" hint="Créez un projet vide et ajoutez vos ouvrages ensuite.">
                        <TextField autoFocus fullWidth size="small" sx={DA_FIELD_SX} value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Ex : M. Martin - Salon" />
                    </DaField>
                    <DaField label="Date de livraison prévue">
                        <TextField type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} fullWidth size="small" sx={DA_FIELD_SX} />
                    </DaField>
                    <DaField label="Types de produits prévus">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {[
                                ['Rideaux', useRideaux, setUseRideaux],
                                ['Stores classiques', useStoresClassiques, setUseStoresClassiques],
                                ['Stores bateau', useStoresBateau, setUseStoresBateau],
                                ['Tentures', useTentures, setUseTentures],
                                ['Cache-sommier', useCacheSommier, setUseCacheSommier],
                                ['Plaid', usePlaid, setUsePlaid],
                                ['Coussins', useCoussins, setUseCoussins],
                                ['Mobilier', useMobilier, setUseMobilier],
                            ].map(([label, on, set]) => (
                                <ChoicePill key={label} active={on} onClick={() => set(!on)}>{label}</ChoicePill>
                            ))}
                        </div>
                    </DaField>
                </>)}

                {/* Emplacement & logistique (commun aux deux onglets) */}
                <div style={{ marginTop: 4, paddingTop: 16, borderTop: '1px solid #E8E6E2', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ fontFamily: ROBOTO, fontSize: 18, fontWeight: 500, color: '#111827' }}>Emplacement et logistique</div>
                    <DaField label="Emplacement du projet">
                        <AddressAutocomplete
                            value={location}
                            onChange={setLocation}
                            placeholder="Ex : 20 rue du Renard, Paris…"
                            inputStyle={{ border: '1px solid #E0DED9', borderRadius: 8, padding: '0 12px', height: 38, fontSize: 14, width: '100%', background: '#fff', boxSizing: 'border-box' }}
                        />
                    </DaField>
                    <DaField label="Type d'intervention">
                        <div style={{ display: 'flex', gap: 8 }}>
                            <ChoicePill active={interventionType === 'livraison'} onClick={() => setInterventionType('livraison')}>Livraison</ChoicePill>
                            <ChoicePill active={interventionType === 'installation'} onClick={() => setInterventionType('installation')}>Installation</ChoicePill>
                        </div>
                    </DaField>
                    {interventionType === "installation" && (
                        <DaField label="Comment la marchandise arrive sur place ?">
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <ChoicePill active={expeditionType === 'depart_nantes'} onClick={() => setExpeditionType('depart_nantes')}>Départ depuis Nantes</ChoicePill>
                                <ChoicePill active={expeditionType === 'expedition'} onClick={() => setExpeditionType('expedition')}>Expédition transporteur</ChoicePill>
                            </div>
                        </DaField>
                    )}
                </div>
            </div>
        </DaDialog>
    );
}
