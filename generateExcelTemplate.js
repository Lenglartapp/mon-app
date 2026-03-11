import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

import { RIDEAUX_SCHEMA } from './src/lib/schemas/chiffrage/rideaux.js';
import { STORES_CLASSIQUES_SCHEMA } from './src/lib/schemas/chiffrage/stores_classiques.js';
import { STORES_BATEAUX_SCHEMA } from './src/lib/schemas/chiffrage/stores_bateaux.js';
import { COUSSINS_SCHEMA } from './src/lib/schemas/chiffrage/coussins.js';
import { CACHE_SOMMIER_SCHEMA } from './src/lib/schemas/chiffrage/cache_sommier.js';
import { PLAID_SCHEMA } from './src/lib/schemas/chiffrage/plaid.js';
import { MOBILIER_SCHEMA } from './src/lib/schemas/chiffrage/mobilier.js';
import { TENTURE_MURALE_SCHEMA } from './src/lib/schemas/chiffrage/tenture_murale.js';

const TABS = [
  { name: 'Rideaux', schema: RIDEAUX_SCHEMA },
  { name: 'Stores', schema: STORES_CLASSIQUES_SCHEMA },
  { name: 'Stores Bateaux', schema: STORES_BATEAUX_SCHEMA },
  { name: 'Coussins', schema: COUSSINS_SCHEMA },
  { name: 'Cache-Sommier', schema: CACHE_SOMMIER_SCHEMA },
  { name: 'Plaid', schema: PLAID_SCHEMA },
  { name: 'Tête de lit', schema: MOBILIER_SCHEMA },
  { name: 'Tenture Murale', schema: TENTURE_MURALE_SCHEMA }
];

async function generate() {
  const workbook = new ExcelJS.Workbook();
  
  for (const tab of TABS) {
    const sheet = workbook.addWorksheet(tab.name);
    
    // Filter schema for writable fields
    const columns = tab.schema.filter(col => {
      // Ignore buttons, selectors, hidden cols
      const isButton = col.key === 'detail' || col.field === 'detail' || col.type === 'button';
      const isSel = col.key === 'sel' || col.label === 'Sel.';
      const isHidden = !!col.hidden;
      return !isButton && !isSel && !isHidden;
    }).map(col => {
      const key = col.key || col.field;
      const label = col.label || col.headerName || key;
      let readOnly = !!col.readOnly || col.type === 'formula';
      
      // Specifically lock catalog-driven and calculated fields
      const lockedFields = [
        'pa_tissu_deco1', 'pv_tissu_deco1', 'laize_tissu_deco1', 'prix_tissu_deco1',
        'pa_tissu_deco2', 'pv_tissu_deco2', 'laize_tissu_deco2', 'prix_tissu_deco2',
        'pa_doublure', 'pv_doublure', 'laize_doublure', 'prix_doublure',
        'pa_inter', 'pv_inter', 'laize_inter', 'prix_inter_doublure',
        'pa_passementerie1', 'pv_passementerie1', 'prix_passementerie1',
        'pa_passementerie2', 'pv_passementerie2', 'prix_passementerie2',
        'pa_mecanisme', 'pv_mecanisme', 'dim_mecanisme', 'prix_mecanisme',
        'pa_moteur', 'pv_moteur', 'prix_moteur',
        'pa_tissu', 'pv_tissu', 'prix_tissu',
        'pa_passementerie', 'pv_passementerie', 'prix_passementerie',
        'ca_total', 'prix_total', 'prix_vente', 'prix_achat', 'marge', 'total', 'ca'
      ];
      
      // Locking ML only for Rideaux
      if (tab.name === 'Rideaux') {
          lockedFields.push(
              'ml_tissu_deco1', 'ml_tissu_deco2', 'ml_doublure', 'ml_inter', 
              'ml_passementerie1', 'ml_passementerie2', 'ml_tissu', 'ml_passementerie'
          );
      }
      
      if (lockedFields.includes(key)) {
        readOnly = true;
      }
      
      const options = col.options || col.valueOptions;
      return {
        header: label,
        key: key,
        width: (col.width || 100) / 7, // Approximate Excel width
        readOnly: readOnly,
        options: options
      };
    });

    sheet.columns = columns.map(c => ({
      header: c.header,
      key: c.key,
      width: c.width
    }));

    // Style headers
    const headerRow = sheet.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell((cell, colNumber) => {
      const colDef = columns[colNumber - 1];
      
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      
      if (colDef.readOnly) {
         // Gray header for calculated fields
         cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
      } else {
         // Blue header for input fields
         cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
      }
    });

    // Add data validations for select columns and gray out readOnly cells
    let rowStart = 2;
    let rowEnd = 100;
    
    for (let c = 1; c <= columns.length; c++) {
      const colDef = columns[c - 1];
      
      if (colDef.options && Array.isArray(colDef.options)) {
        const optionList = colDef.options.join(',');
        for (let r = rowStart; r <= rowEnd; r++) {
          sheet.getCell(r, c).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${optionList}"`]
          };
        }
      }
      
      if (colDef.readOnly) {
        for (let r = rowStart; r <= rowEnd; r++) {
         const cell = sheet.getCell(r, c);
         cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
         // Lock cell (requires sheet protection)
         cell.protection = { locked: true };
        }
      } else {
        for (let r = rowStart; r <= rowEnd; r++) {
         const cell = sheet.getCell(r, c);
         cell.protection = { locked: false };
        }
      }
    }
    
    // Protect sheet but allow selecting locked and unlocked cells
    sheet.protect('password123', {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: true,
      formatColumns: true,
      formatRows: true
    });
  }

  const outputPath = path.join(process.env.HOME || process.env.USERPROFILE, 'Desktop', 'Template_Import_Devis.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Template created at: ${outputPath}`);
}

generate().catch(console.error);
