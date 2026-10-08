import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DaDialog, { DaTabs } from '../ui/DaDialog';
import { supabase } from '../../lib/supabaseClient';
import { readCourseLines } from '../../lib/odoo/courseLinesClient';
import { computeNeeds } from '../../lib/stock/projectStock';
import { cotesBasis } from '../../lib/stock/bpfMetrage';
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

export default function ProjectStockDialog({ open, onClose, project, projects, inventory, movements = [], onUpdateItem, onStockChanged }) {
    const [tab, setTab] = useState('courses');
    const [courseLines, setCourseLines] = useState([]);
    const [linesLoading, setLinesLoading] = useState(false);
    const [linesError, setLinesError] = useState(null);
    const [savingId, setSavingId] = useState(null);

    const needs = useMemo(() => computeNeeds(project?.rows || [], project?.materials || []), [project?.rows, project?.materials]);
    // État des cotes des rideaux → note de fiabilité des besoins (toutes validées / prises / partielles / plan).
    const basis = useMemo(() => cotesBasis(project?.rows || []), [project?.rows]);
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
        <DaDialog
            open={open}
            onClose={onClose}
            title="Stock du projet"
            subtitle={project?.name}
            maxWidth="xl"
            height="85vh"
            bodyPadding="20px 28px"
            tabs={<DaTabs tabs={TABS} value={tab} onChange={setTab} />}
        >
                {tab === 'courses' && (
                    <>
                        <div style={{ marginBottom: 16 }}>
                            <ProjectCourseListPanel
                                droitfilProjectId={project?.id}
                                odooProjectId={project?.id_projet_odoo}
                                projectName={project?.name}
                            />
                        </div>
                        <div style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 500, fontSize: 20, margin: '24px 0 12px', color: '#111827' }}>Stock en cours</div>
                        {/* movements : sans eux, la fiche de vie d'un article ouverte d'ici restait vide */}
                        <StockInventoryTab embedded inventory={projectInventory} projects={projects} movements={movements} onUpdateItem={onUpdateItem} />
                    </>
                )}
                {tab === 'needs' && <ProjectNeedsTab needs={needs} basis={basis} />}
                {tab === 'compare' && (
                    <ProjectComparisonTab
                        needs={needs}
                        basis={basis}
                        courseLines={courseLines}
                        loading={linesLoading && !courseLines.length}
                        error={linesError}
                        onSetMatch={setMatch}
                        savingId={savingId}
                    />
                )}
                {tab === 'mad' && <StockRequestsPanel inventory={inventory || []} project={project?.name} onStockChanged={onStockChanged} />}
        </DaDialog>
    );
}
