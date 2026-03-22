import ExcelJS from 'exceljs';
import readXlsxFile from 'read-excel-file';
import { format, parse, setHours, setMinutes, setSeconds } from 'date-fns';
import { uid } from './uid';

const SERVICE_LABEL = { conf: 'Confection', pose: 'Pose', prepa: 'Préparation' };
const LABEL_TO_SERVICE = { confection: 'conf', pose: 'pose', 'préparation': 'prepa', preparation: 'prepa' };

// Conf et Préparation utilisent la durée en heures (pas de créneau horaire)
const IS_HOUR_MODE = (serviceKey) => serviceKey === 'conf' || serviceKey === 'prepa';

// Calcule l'heure de fin à partir d'une durée (en sautant la pause déjeuner 12-13)
function computeEndFromDuration(baseDate, durationHours) {
    let remaining = durationHours * 60; // en minutes
    let currentMin = 8 * 60; // 8h00

    const morningMins = Math.min(remaining, 240); // 8h00–12h00
    currentMin += morningMins;
    remaining -= morningMins;

    if (remaining > 0) {
        currentMin = 13 * 60; // saute la pause déjeuner
        currentMin += remaining;
    }

    const h = Math.floor(currentMin / 60);
    const m = currentMin % 60;
    const endDt = setSeconds(setMinutes(setHours(new Date(baseDate), h), m), 0);
    return endDt;
}

// ─── GENERATE TEMPLATE ───────────────────────────────────────────────────────

/**
 * Génère un fichier Excel template pré-formaté pour la déclaration des temps.
 *
 * Structure des colonnes :
 *   A Date | B Personne | C Service | D Projet | E Durée (h) | F Heure début | G Heure fin | H Validé
 *
 *  - Confection & Préparation : colonne E remplie, F et G grisées (non pertinentes)
 *  - Pose                     : colonne E grisée,  F et G remplies
 */
export async function generatePlanningTemplate(columns, allMembers, projects) {
    const workbook = new ExcelJS.Workbook();

    const ws = workbook.addWorksheet('Déclaration');

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
        { header: 'Durée (h)',          key: 'duree',    width: 12 }, // conf & prepa
        { header: 'Heure début',        key: 'debut',    width: 14 }, // pose seulement
        { header: 'Heure fin',          key: 'fin',      width: 14 }, // pose seulement
        { header: 'Validé (oui/non)',   key: 'valide',   width: 18 },
    ];

    // Style en-tête
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    headerRow.alignment = { vertical: 'middle' };
    headerRow.height = 20;

    // Ajouter une note sur l'en-tête Durée
    ws.getCell('E1').note = 'Confection & Préparation : indiquez le nombre d\'heures (ex: 8, 4, 2.5). Minimum 0.5, maximum 8.';
    ws.getCell('F1').note = 'Pose uniquement : heure de début au format HH:MM (ex: 08:00).';
    ws.getCell('G1').note = 'Pose uniquement : heure de fin au format HH:MM (ex: 17:00).';

    const YELLOW  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // cellule éditable
    const GRAY    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; // cellule non pertinente

    // ── Lignes pré-remplies : un jour × un membre ──
    const dataStartRow = 2;
    let rowIdx = dataStartRow;

    const addMemberRow = (day, member) => {
        const fullName    = `${member.first_name || ''} ${member.last_name || ''}`.trim();
        const serviceKey  = member.role || 'conf';
        const serviceLabel = SERVICE_LABEL[serviceKey] || 'Confection';
        const hourMode    = IS_HOUR_MODE(serviceKey);

        const row = ws.addRow({
            date:     format(day, 'dd/MM/yyyy'),
            personne: fullName,
            service:  serviceLabel,
            projet:   '',
            duree:    hourMode ? 8 : '',
            debut:    hourMode ? '' : '08:00',
            fin:      hourMode ? '' : '17:00',
            valide:   'non',
        });

        // Cellules éditables en jaune, non-pertinentes en gris
        row.getCell('projet').fill = YELLOW;
        row.getCell('valide').fill = YELLOW;

        if (hourMode) {
            row.getCell('duree').fill = YELLOW;
            row.getCell('debut').fill = GRAY;
            row.getCell('fin').fill   = GRAY;
        } else {
            row.getCell('duree').fill = GRAY;
            row.getCell('debut').fill = YELLOW;
            row.getCell('fin').fill   = YELLOW;
        }

        rowIdx++;
    };

    if (allMembers.length > 0) {
        columns.forEach(day => {
            allMembers.forEach(member => addMemberRow(day, member));
        });
    } else {
        // Template vide sans membres pré-remplis
        columns.forEach(day => {
            const row = ws.addRow({
                date: format(day, 'dd/MM/yyyy'),
                personne: '', service: '', projet: '',
                duree: '', debut: '', fin: '', valide: 'non',
            });
            ['personne', 'service', 'projet', 'duree', 'debut', 'fin', 'valide'].forEach(k => {
                row.getCell(k).fill = YELLOW;
            });
            rowIdx++;
        });
    }

    const lastDataRow = rowIdx - 1;

    // ── Validation des données ──
    for (let r = dataStartRow; r <= lastDataRow; r++) {
        ws.getCell(`B${r}`).dataValidation = {
            type: 'list', allowBlank: false,
            formulae: [`__lists!$A$1:$A${personNames.length}`],
            showErrorMessage: true, errorTitle: 'Valeur invalide',
            error: 'Sélectionnez une personne dans la liste.',
        };

        ws.getCell(`C${r}`).dataValidation = {
            type: 'list', allowBlank: false,
            formulae: ['"Confection,Pose,Préparation"'],
            showErrorMessage: true, errorTitle: 'Valeur invalide',
            error: 'Sélectionnez un service : Confection, Pose ou Préparation.',
        };

        ws.getCell(`D${r}`).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: [`__lists!$B$1:$B${projectNames.length}`],
            showInputMessage: true, promptTitle: 'Projet',
            prompt: 'Laissez vide si aucun projet à déclarer.',
        };

        // Durée : nombre entre 0.5 et 8 (conf/prepa)
        ws.getCell(`E${r}`).dataValidation = {
            type: 'decimal', operator: 'between', allowBlank: true,
            formulae: [0.5, 8],
            showInputMessage: true, promptTitle: 'Durée',
            prompt: 'Confection & Préparation : durée en heures (0.5 à 8). Laissez vide pour la Pose.',
        };

        ws.getCell(`H${r}`).dataValidation = {
            type: 'list', allowBlank: false,
            formulae: ['"oui,non"'],
            showErrorMessage: true, errorTitle: 'Valeur invalide',
            error: 'Indiquez "oui" ou "non".',
        };
    }

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
 *
 * Colonnes : 0=Date, 1=Personne, 2=Service, 3=Projet,
 *            4=Durée(h), 5=Heure début, 6=Heure fin, 7=Validé
 *
 * Logique :
 *  - Confection & Préparation : lit la colonne 4 (Durée), calcule start=08h00 et end depuis durée
 *  - Pose                     : lit les colonnes 5 (début) et 6 (fin)
 */
export async function processPlanningImport(file, allMembers, projects, existingEvents) {
    const rows = await readXlsxFile(file, { sheet: 'Déclaration' });
    if (!rows || rows.length < 2) throw new Error('Fichier vide ou invalide');

    const toCreate    = [];
    const toOverwrite = [];
    const blocked     = [];
    const skipped     = [];
    const errors      = [];

    for (let i = 1; i < rows.length; i++) {
        const row    = rows[i];
        const rowNum = i + 1;

        if (!row[0] && !row[1] && !row[2] && !row[3]) continue;

        // ── Projet absent → skip silencieux ──
        const rawProject = row[3] ? String(row[3]).trim() : '';
        if (!rawProject) { skipped.push({ row: rowNum }); continue; }

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

        // ── Service ──
        const rawService = row[2] ? String(row[2]).trim().toLowerCase() : '';
        const eventType  = LABEL_TO_SERVICE[rawService] || member.role || 'conf';
        const hourMode   = IS_HOUR_MODE(eventType);

        // ── Projet ──
        const project = projects.find(
            p => (p.name || '').trim().toLowerCase() === rawProject.toLowerCase()
        );
        if (!project) {
            errors.push({ row: rowNum, message: `Projet introuvable : "${rawProject}"` });
            continue;
        }
        const projectId = project.id;

        // ── Statut (colonne H = index 7) ──
        const rawValide = row[7] ? String(row[7]).trim().toLowerCase() : 'non';
        const status    = rawValide === 'oui' ? 'validated' : 'pending';

        let startDt, endDt, durationHours = null;

        if (hourMode) {
            // ── MODE DURÉE : Confection & Préparation ──
            const rawDuree = row[4];
            let dh = null;
            if (rawDuree != null && rawDuree !== '') {
                dh = parseFloat(String(rawDuree).trim());
            }
            if (dh == null || isNaN(dh) || dh <= 0 || dh > 8) {
                // Par défaut 8h si la cellule est vide ou invalide
                dh = 8;
            }
            durationHours = dh;
            startDt = setSeconds(setMinutes(setHours(new Date(parsedDate), 8), 0), 0);
            endDt   = computeEndFromDuration(parsedDate, dh);
        } else {
            // ── MODE CRÉNEAU : Pose ──
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

            const startTime = parseTime(row[5]);
            const endTime   = parseTime(row[6]);

            if (!startTime) {
                errors.push({ row: rowNum, message: `Heure début invalide : "${row[5]}" (attendu HH:MM)` });
                continue;
            }
            if (!endTime) {
                errors.push({ row: rowNum, message: `Heure fin invalide : "${row[6]}" (attendu HH:MM)` });
                continue;
            }

            startDt = setSeconds(setMinutes(setHours(new Date(parsedDate), startTime.h), startTime.m), 0);
            endDt   = setSeconds(setMinutes(setHours(new Date(parsedDate), endTime.h),   endTime.m),   0);
        }

        // ── Détection conflit ──
        const conflict = hourMode
            ? existingEvents.find(e =>
                e.resourceId === resourceId &&
                e.date       === dateStr &&
                e.meta?.durationHours === durationHours
            )
            : existingEvents.find(e =>
                e.resourceId === resourceId &&
                e.date       === dateStr &&
                e.meta?.start &&
                e.meta?.end &&
                format(new Date(e.meta.start), 'HH:mm') === format(startDt, 'HH:mm') &&
                format(new Date(e.meta.end),   'HH:mm') === format(endDt,   'HH:mm')
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
                ...(hourMode && { durationHours, createdAt: new Date().toISOString() }),
            },
        };

        if (conflict) {
            if (conflict.meta?.status === 'validated') {
                blocked.push({
                    row:      rowNum,
                    personne: rawPerson,
                    date:     format(parsedDate, 'dd/MM/yyyy'),
                    ...(hourMode
                        ? { duree: `${durationHours}h` }
                        : { debut: format(startDt, 'HH:mm'), fin: format(endDt, 'HH:mm') }
                    ),
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
