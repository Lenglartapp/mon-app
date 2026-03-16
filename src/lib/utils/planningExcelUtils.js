import ExcelJS from 'exceljs';
import readXlsxFile from 'read-excel-file';
import { format, parse, setHours, setMinutes, setSeconds } from 'date-fns';
import { uid } from './uid';

const SERVICE_LABEL = { conf: 'Confection', pose: 'Pose', prepa: 'Préparation' };
const LABEL_TO_SERVICE = { confection: 'conf', pose: 'pose', 'préparation': 'prepa', preparation: 'prepa' };

// ─── GENERATE TEMPLATE ───────────────────────────────────────────────────────

/**
 * Génère un fichier Excel template pré-formaté pour la déclaration des temps.
 * @param {Date[]} columns - Jours ouvrés de la période active (déjà filtrés week-ends)
 * @param {Object[]} allMembers - Tous les membres actifs (conf + pose + prepa), avec champ `role`
 * @param {Object[]} projects - Projets actifs
 */
export async function generatePlanningTemplate(columns, allMembers, projects) {
    const workbook = new ExcelJS.Workbook();

    // ── Feuille principale EN PREMIER (read-excel-file lit le 1er onglet par défaut) ──
    const ws = workbook.addWorksheet('Déclaration');

    // ── Feuille cachée pour les listes longues ──
    const listsSheet = workbook.addWorksheet('__lists');
    listsSheet.state = 'veryHidden';

    const personNames = allMembers
        .map(m => `${m.first_name || ''} ${m.last_name || ''}`.trim())
        .filter(Boolean);

    const projectNames = projects
        .filter(p => p.status !== 'archive' && p.status !== 'done')
        .map(p => p.name)
        .filter(Boolean);

    personNames.forEach((name, i) => { listsSheet.getCell(`A${i + 1}`).value = name; });
    projectNames.forEach((name, i) => { listsSheet.getCell(`B${i + 1}`).value = name; });

    // ── Colonnes ──
    ws.columns = [
        { header: 'Date (JJ/MM/AAAA)', key: 'date',     width: 18 },
        { header: 'Personne',           key: 'personne', width: 24 },
        { header: 'Service',            key: 'service',  width: 16 },
        { header: 'Projet',             key: 'projet',   width: 36 },
        { header: 'Heure début',        key: 'debut',    width: 14 },
        { header: 'Heure fin',          key: 'fin',      width: 14 },
        { header: 'Validé (oui/non)',   key: 'valide',   width: 18 },
    ];

    // Style en-tête
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    headerRow.alignment = { vertical: 'middle' };
    headerRow.height = 20;

    // ── Lignes pré-remplies : un jour × un membre ──
    const dataStartRow = 2;
    let rowIdx = dataStartRow;

    if (allMembers.length > 0) {
        columns.forEach(day => {
            allMembers.forEach(member => {
                const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim();
                const serviceLabel = SERVICE_LABEL[member.role] || 'Confection';
                const row = ws.addRow({
                    date:     format(day, 'dd/MM/yyyy'),
                    personne: fullName,
                    service:  serviceLabel,
                    projet:   '',
                    debut:    '08:00',
                    fin:      '17:00',
                    valide:   'non',
                });
                // Cellules éditables en jaune
                ['projet', 'debut', 'fin', 'valide'].forEach(k => {
                    row.getCell(k).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                });
                rowIdx++;
            });
        });
    } else {
        columns.forEach(day => {
            const row = ws.addRow({ date: format(day, 'dd/MM/yyyy'), personne: '', service: '', projet: '', debut: '08:00', fin: '17:00', valide: 'non' });
            ['personne', 'service', 'projet', 'debut', 'fin', 'valide'].forEach(k => {
                row.getCell(k).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            });
            rowIdx++;
        });
    }

    const lastDataRow = rowIdx - 1;

    // ── Validation des données ──
    for (let r = dataStartRow; r <= lastDataRow; r++) {
        // Personne → liste depuis __lists colonne A
        ws.getCell(`B${r}`).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [`__lists!$A$1:$A${personNames.length}`],
            showErrorMessage: true,
            errorTitle: 'Valeur invalide',
            error: 'Sélectionnez une personne dans la liste.',
        };

        // Service → dropdown inline (liste courte)
        ws.getCell(`C${r}`).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: ['"Confection,Pose,Préparation"'],
            showErrorMessage: true,
            errorTitle: 'Valeur invalide',
            error: 'Sélectionnez un service : Confection, Pose ou Préparation.',
        };

        // Projet → liste depuis __lists colonne B
        ws.getCell(`D${r}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`__lists!$B$1:$B${projectNames.length}`],
            showInputMessage: true,
            promptTitle: 'Projet',
            prompt: 'Laissez vide si aucun projet à déclarer pour ce créneau.',
        };

        // Validé → dropdown oui/non
        ws.getCell(`G${r}`).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: ['"oui,non"'],
            showErrorMessage: true,
            errorTitle: 'Valeur invalide',
            error: 'Indiquez "oui" ou "non".',
        };
    }

    // Notes d'aide sur les colonnes heures
    ws.getColumn('E').eachCell({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber >= dataStartRow) cell.note = 'Format requis : HH:MM (ex: 08:00)';
    });
    ws.getColumn('F').eachCell({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber >= dataStartRow) cell.note = 'Format requis : HH:MM (ex: 17:00)';
    });

    // ── Téléchargement ──
    const startLabel = format(columns[0], 'yyyy-MM-dd');
    const endLabel   = format(columns[columns.length - 1], 'yyyy-MM-dd');
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Planning_Template_${startLabel}_${endLabel}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}


// ─── PROCESS IMPORT ──────────────────────────────────────────────────────────

/**
 * Parse et valide un fichier Excel de déclaration de temps.
 * Colonnes : 0=Date, 1=Personne, 2=Service, 3=Projet, 4=Début, 5=Fin, 6=Validé
 * @param {File} file
 * @param {Object[]} allMembers - Tous les membres (conf + pose + prepa)
 * @param {Object[]} projects
 * @param {Object[]} existingEvents
 * @returns {{ toCreate, toOverwrite, blocked, skipped, errors }}
 */
export async function processPlanningImport(file, allMembers, projects, existingEvents) {
    // Lecture explicite de l'onglet "Déclaration"
    const rows = await readXlsxFile(file, { sheet: 'Déclaration' });
    if (!rows || rows.length < 2) throw new Error('Fichier vide ou invalide');

    const toCreate   = [];
    const toOverwrite = [];
    const blocked    = [];
    const skipped    = []; // lignes sans projet
    const errors     = [];

    for (let i = 1; i < rows.length; i++) {
        const row    = rows[i];
        const rowNum = i + 1;

        // ── Ignorer lignes complètement vides ──
        if (!row[0] && !row[1] && !row[2] && !row[3]) continue;

        // ── Projet absent → skip silencieux ──
        const rawProject = row[3] ? String(row[3]).trim() : '';
        if (!rawProject) {
            skipped.push({ row: rowNum });
            continue;
        }

        // ── Parse Date ──
        let parsedDate;
        const rawDate = row[0];
        if (rawDate instanceof Date) {
            parsedDate = rawDate;
        } else if (typeof rawDate === 'string' && rawDate.trim()) {
            parsedDate = parse(rawDate.trim(), 'dd/MM/yyyy', new Date());
        } else {
            errors.push({ row: rowNum, message: `Date manquante ou invalide : "${rawDate}"` });
            continue;
        }
        if (isNaN(parsedDate.getTime())) {
            errors.push({ row: rowNum, message: `Format de date invalide (attendu JJ/MM/AAAA) : "${rawDate}"` });
            continue;
        }
        const dateStr = format(parsedDate, 'yyyy-MM-dd');

        // ── Personne ──
        const rawPerson = row[1] ? String(row[1]).trim() : '';
        if (!rawPerson) {
            errors.push({ row: rowNum, message: 'Personne non indiquée.' });
            continue;
        }
        const member = allMembers.find(
            m => `${m.first_name || ''} ${m.last_name || ''}`.trim().toLowerCase() === rawPerson.toLowerCase()
        );
        if (!member) {
            errors.push({ row: rowNum, message: `Personne introuvable : "${rawPerson}"` });
            continue;
        }
        const resourceId = member.id;

        // ── Service (utilisé pour le type d'événement) ──
        const rawService = row[2] ? String(row[2]).trim().toLowerCase() : '';
        const eventType  = LABEL_TO_SERVICE[rawService] || member.role || 'conf';

        // ── Projet ──
        const project = projects.find(
            p => (p.name || '').trim().toLowerCase() === rawProject.toLowerCase()
        );
        if (!project) {
            errors.push({ row: rowNum, message: `Projet introuvable : "${rawProject}"` });
            continue;
        }
        const projectId = project.id;

        // ── Heures ──
        const parseTime = (val) => {
            if (val == null) return null;
            if (val instanceof Date) return { h: val.getHours(), m: val.getMinutes() };
            const str   = String(val).trim();
            const parts = str.split(':');
            if (parts.length < 2) return null;
            const h  = parseInt(parts[0], 10);
            const mn = parseInt(parts[1], 10);
            if (isNaN(h) || isNaN(mn) || h < 0 || h > 23 || mn < 0 || mn > 59) return null;
            return { h, m: mn };
        };

        const startTime = parseTime(row[4]);
        const endTime   = parseTime(row[5]);

        if (!startTime) {
            errors.push({ row: rowNum, message: `Heure début invalide : "${row[4]}" (attendu HH:MM)` });
            continue;
        }
        if (!endTime) {
            errors.push({ row: rowNum, message: `Heure fin invalide : "${row[5]}" (attendu HH:MM)` });
            continue;
        }

        const startDt = setSeconds(setMinutes(setHours(new Date(parsedDate), startTime.h), startTime.m), 0);
        const endDt   = setSeconds(setMinutes(setHours(new Date(parsedDate), endTime.h),   endTime.m),   0);

        // ── Statut ──
        const rawValide = row[6] ? String(row[6]).trim().toLowerCase() : 'non';
        const status    = rawValide === 'oui' ? 'validated' : 'pending';

        // ── Détection conflit (même personne, même jour, même créneau) ──
        const pad2    = n => String(n).padStart(2, '0');
        const startHM = `${pad2(startTime.h)}:${pad2(startTime.m)}`;
        const endHM   = `${pad2(endTime.h)}:${pad2(endTime.m)}`;

        const conflict = existingEvents.find(e =>
            e.resourceId === resourceId &&
            e.date       === dateStr &&
            e.meta?.start &&
            e.meta?.end &&
            format(new Date(e.meta.start), 'HH:mm') === startHM &&
            format(new Date(e.meta.end),   'HH:mm') === endHM
        );

        const newEvent = {
            id:         conflict ? conflict.id : uid(),
            resourceId,
            date:       dateStr,
            title:      project.name,
            type:       eventType,
            meta: {
                projectId,
                start:         startDt.toISOString(),
                end:           endDt.toISOString(),
                status,
                assigned_name: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
                seriesId:      conflict?.meta?.seriesId || uid(),
            },
        };

        if (conflict) {
            if (conflict.meta?.status === 'validated') {
                blocked.push({
                    row:      rowNum,
                    personne: rawPerson,
                    date:     format(parsedDate, 'dd/MM/yyyy'),
                    debut:    startHM,
                    fin:      endHM,
                });
            } else {
                toOverwrite.push(newEvent);
            }
        } else {
            toCreate.push(newEvent);
        }
    }

    return { toCreate, toOverwrite, blocked, skipped, errors };
}
