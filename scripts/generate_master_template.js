import ExcelJS from 'exceljs';
import fs from 'fs';

// Columns definition for Rideaux Template
// Columns definition for Rideaux Template (V3)
const RIDEAUX_COLUMNS = [
    // INPUTS (White, Unlocked)
    { header: 'Zone', key: 'zone', width: 15, locked: false },
    { header: 'Pièce', key: 'piece', width: 15, locked: false },
    { header: 'Produit', key: 'produit', width: 20, locked: false, validation: { type: 'list', formulae: ['"Rideau,Voilage,Store Bateau,Store Enrouleur,Coussin"'] } },
    { header: 'Quantité', key: 'quantite', width: 10, locked: false },
    { header: 'Largeur (cm)', key: 'largeur', width: 12, locked: false },
    { header: 'Hauteur (cm)', key: 'hauteur', width: 12, locked: false },
    { header: 'Ampleur', key: 'ampleur', width: 10, locked: false },

    // CHAMPS TECHNIQUES (V3)
    { header: 'Croisement (cm)', key: 'croisement', width: 12, locked: false },
    { header: 'Retour Gauche (cm)', key: 'retour_g', width: 15, locked: false },
    { header: 'Retour Droit (cm)', key: 'retour_d', width: 15, locked: false },
    { header: 'Envers Visible', key: 'envers_visible', width: 15, locked: false, validation: { type: 'list', formulae: ['"Oui,Non"'] } },

    { header: 'Type Confection', key: 'type_confection', width: 20, locked: false, validation: { type: 'list', formulae: ['"Wave 80,Wave 60,Couteau,Flamand,Triplis,Creux,Plat"'] } },
    { header: 'Paire / Un Pan', key: 'pair_un', width: 15, locked: false, validation: { type: 'list', formulae: ['"Paire,Un seul pan"'] } },

    // TISSUS & ACCESSOIRES (Recherche VJS)
    { header: 'Tissu Déco 1', key: 'tissu_deco1', width: 25, locked: false },
    { header: 'Tissu Déco 2', key: 'tissu_deco2', width: 25, locked: false },
    { header: 'Doublure', key: 'doublure', width: 25, locked: false },
    { header: 'Inter Doublure', key: 'inter_doublure', width: 25, locked: false },
    { header: 'Passementerie 1', key: 'passementerie1', width: 25, locked: false },
    { header: 'Passementerie 2', key: 'passementerie2', width: 25, locked: false },

    // MECANISME (Recherche VJS)
    { header: 'Type de Mécanisme', key: 'type_mecanisme', width: 15, locked: false, validation: { type: 'list', formulae: ['"Rail,Tringle,Store"'] } },
    { header: 'Modèle Rail/Tringle', key: 'modele_mecanisme', width: 25, locked: false },

    // OUTPUTS (Grey, Locked) -- Calculated by ERP (Indicatif)
    { header: 'ML Tissu 1 (Calculé)', key: 'ml_tissu_deco1', width: 12, locked: true, style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } } } },
    { header: 'ML Tissu 2 (Calculé)', key: 'ml_tissu_deco2', width: 12, locked: true, style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } } } },
    { header: 'Prix Unitaire (Calculé)', key: 'prix_unitaire', width: 15, locked: true, style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } } } },
    { header: 'Prix Total (Calculé)', key: 'prix_total', width: 15, locked: true, style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } } } },
];

const generateMasterTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Saisie Rideaux');

    // Define Columns
    worksheet.columns = RIDEAUX_COLUMNS.map(c => ({
        header: c.header,
        key: c.key,
        width: c.width,
        style: c.style
    }));

    // Apply Header Styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; // Blue-Grey/Black
    headerRow.alignment = { horizontal: 'center' };

    // Apply Validation & Protection logic per column
    for (let i = 2; i <= 1000; i++) {
        const row = worksheet.getRow(i);

        RIDEAUX_COLUMNS.forEach((colDef, idx) => {
            const cell = row.getCell(idx + 1);

            // Protection
            if (colDef.locked) {
                cell.protection = { locked: true };
                if (colDef.style?.fill) cell.fill = colDef.style.fill;
            } else {
                cell.protection = { locked: false };
            }

            // Validation
            if (colDef.validation) {
                cell.dataValidation = colDef.validation;
            }
        });
    }

    // Protect Sheet (Password: "secret")
    await worksheet.protect('secret', { selectLockedCells: true, selectUnlockedCells: true });

    const filename = 'Modele_Saisie_Rideaux_MASTER.xlsx';
    await workbook.xlsx.writeFile(filename);
    console.log(`✅ ${filename} generated successfully!`);
};

generateMasterTemplate().catch(err => console.error(err));
