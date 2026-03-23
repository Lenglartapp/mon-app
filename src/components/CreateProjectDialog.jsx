import React, { useState, useMemo } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Tabs, Tab, TextField, Autocomplete, MenuItem,
    Typography, Box, Checkbox, FormControlLabel, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { FolderPlus, FileJson } from 'lucide-react';
import { createBlankProject } from "../lib/import/createBlankProject";
import { computeFormulas } from "../lib/formulas/compute";
import AddressAutocomplete from "./AddressAutocomplete";

function TabPanel({ children, value, index, ...other }) {
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            {...other}
            style={{ padding: '24px 0' }}
        >
            {value === index && children}
        </div>
    );
}

export default function CreateProjectDialog({
    open,
    onClose,
    onCreateBlank,
    onCreateFromMinute,
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

    const handleImport = () => {
        if (!selectedMinute) return;
        onCreateFromMinute({
            name: selectedMinute.name || "Projet Importé",
            rows: selectedMinute.lines || [],
            meta: selectedMinute,
            deliveryDate,
            ...logistique,
        });
    };


    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            TransitionProps={{ timeout: 300 }}
        >
            <DialogTitle sx={{ textAlign: 'center', pb: 0, fontWeight: 800 }}>
                Nouveau Projet Production
            </DialogTitle>

            <DialogContent>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} centered sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab label="Import Minute" disabled={minutes.length === 0} icon={<FileJson size={16} />} iconPosition="start" />
                    <Tab label="Projet Vierge" icon={<FolderPlus size={16} />} iconPosition="start" />
                </Tabs>

                {/* TAB 0: IMPORT */}
                <TabPanel value={tab} index={0}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                        Créez un projet de production directement à partir d'un devis / minute chiffrée validée.
                    </Typography>

                    <Autocomplete
                        options={minutes}
                        getOptionLabel={(m) => `${m.name || "Sans nom"} (${m.client || "Client ?"})`}
                        value={selectedMinute}
                        onChange={(e, v) => setSelectedMinute(v)}
                        renderInput={(params) => <TextField {...params} label="Rechercher une minute..." placeholder="Tapez le nom..." autoFocus />}
                        renderOption={(props, option) => (
                            <li {...props}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 600 }}>{option.name || "Sans nom"}</span>
                                    <span style={{ fontSize: 12, opacity: 0.7 }}>
                                        {option.client || "Client inconnu"} — {new Date(option.ts || Date.now()).toLocaleDateString()}
                                    </span>
                                </div>
                            </li>
                        )}
                    />

                    <TextField
                        type="date"
                        label="Date de livraison prévue"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        sx={{ mt: 3 }}
                    />

                    {selectedMinute && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: '#f9fafb', borderRadius: 2, border: '1px solid #e5e7eb' }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" display="block">RÉSUMÉ</Typography>
                            <Typography variant="body2"><strong>Client :</strong> {selectedMinute.client || "—"}</Typography>
                            <Typography variant="body2"><strong>Lignes :</strong> {(selectedMinute.lines || []).length} ouvrages</Typography>
                        </Box>
                    )}
                </TabPanel>

                {/* TAB 1: BLANK */}
                <TabPanel value={tab} index={1}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                        Créez un projet vide et ajoutez vos ouvrages manuellement.
                    </Typography>

                    <TextField
                        autoFocus
                        label="Nom du Projet / Client"
                        fullWidth
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="Ex: Mr. Martin - Salon"
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        type="date"
                        label="Date de livraison prévue"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        sx={{ mb: 3 }}
                    />

                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                        Types de produits prévus :
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                        <FormControlLabel
                            control={<Checkbox checked={useRideaux} onChange={e => setUseRideaux(e.target.checked)} />}
                            label="Rideaux"
                        />
                        <FormControlLabel
                            control={<Checkbox checked={useStoresClassiques} onChange={e => setUseStoresClassiques(e.target.checked)} />}
                            label="Stores Classiques"
                        />
                        <FormControlLabel
                            control={<Checkbox checked={useStoresBateau} onChange={e => setUseStoresBateau(e.target.checked)} />}
                            label="Stores Bateau"
                        />
                         <FormControlLabel
                            control={<Checkbox checked={useTentures} onChange={e => setUseTentures(e.target.checked)} />}
                            label="Tentures"
                        />
                        <FormControlLabel
                            control={<Checkbox checked={useCacheSommier} onChange={e => setUseCacheSommier(e.target.checked)} />}
                            label="Cache Sommier"
                        />
                        <FormControlLabel
                            control={<Checkbox checked={usePlaid} onChange={e => setUsePlaid(e.target.checked)} />}
                            label="Plaid"
                        />
                        <FormControlLabel
                            control={<Checkbox checked={useCoussins} onChange={e => setUseCoussins(e.target.checked)} />}
                            label="Coussins"
                        />
                        <FormControlLabel
                            control={<Checkbox checked={useMobilier} onChange={e => setUseMobilier(e.target.checked)} />}
                            label="Mobilier"
                        />
                    </Box>
                </TabPanel>

                {/* ── Emplacement & logistique (commun aux deux onglets) ── */}
                <Box sx={{ mt: 1, pt: 2, borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="subtitle2" fontWeight={700}>Emplacement & logistique</Typography>

                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            Emplacement du projet
                        </Typography>
                        <AddressAutocomplete
                            value={location}
                            onChange={setLocation}
                            placeholder="Ex: 20 rue du Renard, Paris…"
                            inputStyle={{ border: '1px solid #c4c4c4', borderRadius: 4, padding: '8px 10px', fontSize: 14, width: '100%', background: '#fff' }}
                        />
                    </Box>

                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            Type d'intervention
                        </Typography>
                        <ToggleButtonGroup
                            value={interventionType}
                            exclusive
                            onChange={(e, v) => v && setInterventionType(v)}
                            size="small"
                        >
                            <ToggleButton value="livraison">Livraison</ToggleButton>
                            <ToggleButton value="installation">Installation</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    {interventionType === "installation" && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                Comment la marchandise arrive sur place ?
                            </Typography>
                            <ToggleButtonGroup
                                value={expeditionType}
                                exclusive
                                onChange={(e, v) => v && setExpeditionType(v)}
                                size="small"
                            >
                                <ToggleButton value="depart_nantes">Départ depuis Nantes</ToggleButton>
                                <ToggleButton value="expedition">Expédition transporteur</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 0, justifyContent: 'space-between' }}>
                <Button onClick={onClose} color="inherit">Annuler</Button>

                {tab === 0 ? (
                    <Button
                        variant="contained"
                        onClick={handleImport}
                        disabled={!selectedMinute || !deliveryDate}
                    >
                        Importer le projet
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        onClick={handleCreateBlank}
                        disabled={!projectName.trim() || !deliveryDate}
                    >
                        Créer le projet
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
