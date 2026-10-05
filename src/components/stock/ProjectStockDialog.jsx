import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import { supabase } from '../../lib/supabaseClient';
import { readCourseLines } from '../../lib/odoo/courseLinesClient';
import { computeNeeds } from '../../lib/stock/projectStock';
import ProjectCourseListPanel from '../odoo/ProjectCourseListPanel';
import StockInventoryTab from '../modules/Stocks/StockInventoryTab';
import StockRequestsPanel from '../modules/Stocks/StockRequestsPanel';
import ProjectNeedsTab from './ProjectNeedsTab';
import ProjectComparisonTab from './ProjectComparisonTab';

// Modale « Stock » du dossier : 4 onglets.
//  1. Courses & stock  — liste de courses Odoo + stock en cours du dossier
//  2. Besoins du projet — ML par tissu calculé depuis le BPF
//  3. Comparatif        — besoin / commandé / reçu, statut par tissu
//  4. Mise à disposition — demandes atelier → logistique pour ce dossier

const TABS = [
    { key: 'courses', label: 'Courses & stock' },
    { key: 'needs', label: 'Besoins du projet' },
    { key: 'compare', label: 'Comparatif' },
    { key: 'mad', label: 'Mise à disposition' },
];

export default function ProjectStockDialog({ open, onClose, project, projects, inventory, onUpdateItem, onStockChanged }) {
    const [tab, setTab] = useState('courses');
    const [courseLines, setCourseLines] = useState([]);
    const [linesLoading, setLinesLoading] = useState(false);
    const [linesError, setLinesError] = useState(null);
    const [savingId, setSavingId] = useState(null);

    const needs = useMemo(() => computeNeeds(project?.rows || [], project?.materials || []), [project?.rows, project?.materials]);
    const projectInventory = useMemo(
        () => (inventory || []).filter((item) => item.project && item.project === project?.name),
        [inventory, project?.name]
    );

    // Liste de courses relue à chaque passage sur le comparatif (elle a pu être rafraîchie depuis Odoo).
    const loadLines = useCallback(async () => {
        if (!project?.id) return;
        setLinesLoading(true);
        try {
            setCourseLines(await readCourseLines(project.id));
            setLinesError(null);
        } catch (e) {
            setLinesError(e.message || String(e));
        } finally {
            setLinesLoading(false);
        }
    }, [project?.id]);

    useEffect(() => { if (open && tab === 'compare') loadLines(); }, [open, tab, loadLines]);

    const setMatch = async (line, value) => {
        setSavingId(line.odoo_id);
        const { error } = await supabase.from('odoo_course_lines').update({ besoin_match: value }).eq('odoo_id', line.odoo_id);
        setSavingId(null);
        if (error) {
            setLinesError(/besoin_match/.test(error.message)
                ? 'Rattachement impossible : la migration « besoin_match » doit être lancée dans Supabase.'
                : `Rattachement non enregistré : ${error.message}`);
            return;
        }
        setCourseLines((prev) => prev.map((l) => (l.odoo_id === line.odoo_id ? { ...l, besoin_match: value } : l)));
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth PaperProps={{ sx: { height: '85vh' } }}>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                <span>Stock Projet : {project?.name}</span>
                <Button onClick={onClose}>Fermer</Button>
            </DialogTitle>
            <div style={{ display: 'flex', gap: 4, padding: '0 24px 12px', borderBottom: '1px solid #E5E7EB' }}>
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        style={{
                            padding: '7px 18px', borderRadius: 9999, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                            background: tab === t.key ? '#1E2447' : '#F3F4F6', color: tab === t.key ? 'white' : '#4B5563',
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <DialogContent sx={{ p: 2, bgcolor: '#FCFCFD' }}>
                {tab === 'courses' && (
                    <>
                        <div style={{ marginBottom: 16 }}>
                            <ProjectCourseListPanel
                                droitfilProjectId={project?.id}
                                odooProjectId={project?.id_projet_odoo}
                                projectName={project?.name}
                            />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15, margin: '8px 0 12px', color: '#111827' }}>Stock en cours</div>
                        <StockInventoryTab inventory={projectInventory} projects={projects} onUpdateItem={onUpdateItem} />
                    </>
                )}
                {tab === 'needs' && <ProjectNeedsTab needs={needs} />}
                {tab === 'compare' && (
                    <ProjectComparisonTab
                        needs={needs}
                        courseLines={courseLines}
                        loading={linesLoading && !courseLines.length}
                        error={linesError}
                        onSetMatch={setMatch}
                        savingId={savingId}
                    />
                )}
                {tab === 'mad' && <StockRequestsPanel inventory={inventory || []} project={project?.name} onStockChanged={onStockChanged} />}
            </DialogContent>
        </Dialog>
    );
}
