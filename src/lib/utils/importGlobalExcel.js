import readXlsxFile from 'read-excel-file';
import { uid } from './uid';
import { recomputeRow } from '../formulas/recomputeRow';

import { RIDEAUX_SCHEMA } from '../schemas/chiffrage/rideaux';
import { STORES_CLASSIQUES_SCHEMA } from '../schemas/chiffrage/stores_classiques';
import { STORES_BATEAUX_SCHEMA } from '../schemas/chiffrage/stores_bateaux';
import { COUSSINS_SCHEMA } from '../schemas/chiffrage/coussins';
import { CACHE_SOMMIER_SCHEMA } from '../schemas/chiffrage/cache_sommier';
import { PLAID_SCHEMA } from '../schemas/chiffrage/plaid';
import { TENTURE_MURALE_SCHEMA } from '../schemas/chiffrage/tenture_murale';
import { MOBILIER_SCHEMA } from '../schemas/chiffrage/mobilier';

const NAME_TO_SCHEMA = {
  'Rideaux': RIDEAUX_SCHEMA,
  'Stores': STORES_CLASSIQUES_SCHEMA,
  'Stores Bateaux': STORES_BATEAUX_SCHEMA,
  'Coussins': COUSSINS_SCHEMA,
  'Cache-Sommier': CACHE_SOMMIER_SCHEMA,
  'Plaid': PLAID_SCHEMA,
  'Tête de lit': MOBILIER_SCHEMA,
  'Tenture Murale': TENTURE_MURALE_SCHEMA
};

export async function importGlobalExcel(file, ctx, catalog = []) {
  try {
    const sheets = await readXlsxFile(file, { getSheets: true });
    let allImportedRows = [];

    for (const sheet of sheets) {
      const sheetName = sheet.name;
      const targetSchema = NAME_TO_SCHEMA[sheetName];

      if (!targetSchema) continue; // Skip unknown sheets

      const rows = await readXlsxFile(file, { sheet: sheetName });
      if (!rows || rows.length < 2) continue;

      // Map headers to column keys via schema labels
      const headerRow = rows[0].map(h => (h || '').toString().toLowerCase().trim());
      const dataRows = rows.slice(1);

      // Create a unified matching registry: header => colKey
      const headerToKey = {};
      targetSchema.forEach(col => {
        if (!col) return;
        const key = col.key || col.field;
        const labelText = (col.label || col.headerName || key).toLowerCase().trim();
        headerToKey[labelText] = key;
      });

      const parsedRows = dataRows.map(rowCellValues => {
        const rawRow = { id: uid() };

        // For each cell, map it to our internal keys
        headerRow.forEach((h, index) => {
          const colKey = headerToKey[h];
          if (colKey) {
             const value = rowCellValues[index];
             if (value !== null && value !== undefined) {
                 rawRow[colKey] = value;
             }
          }
        });

        // Ensure Produit is defined to allow MinuteEditor to route the row
        if (!rawRow.produit) {
            if (sheetName === 'Rideaux') rawRow.produit = 'Rideau';
            if (sheetName === 'Stores') rawRow.produit = 'Store Enrouleur';
            if (sheetName === 'Stores Bateaux') rawRow.produit = 'Store Bateau';
            if (sheetName === 'Coussins') rawRow.produit = 'Coussins';
            if (sheetName === 'Cache-Sommier') rawRow.produit = 'Cache-Sommier';
            if (sheetName === 'Plaid') rawRow.produit = 'Plaid';
            if (sheetName === 'Tête de lit') rawRow.produit = 'Tête de lit';
            if (sheetName === 'Tenture Murale') rawRow.produit = 'Tenture Murale';
        }

        // --- CATALOG MATCHING ---
        // Find fields that correspond to catalog items and inject their PA/PV/Width
        targetSchema.forEach(col => {
           const key = col.key || col.field;
           const val = rawRow[key];

           // If this column is a "select" AND the user typed something
           if (val && typeof val === 'string' && ['tissu_deco1', 'tissu_deco2', 'doublure', 'inter_doublure', 'tissu', 'passementerie1', 'passementerie2', 'passementerie', 'mecanisme', 'modele_mecanisme', 'moteur'].includes(key)) {
               const searchName = val.trim().toLowerCase();
               const item = catalog.find(c => (c.name || '').toLowerCase().trim() === searchName);

               if (item) {
                   // Inject exact name
                   rawRow[key] = item.name;

                   // Standardize property injection based on our key naming patterns
                   if (key === 'tissu_deco1' || key === 'tissu') {
                       rawRow.tissu_id = item.id;
                       rawRow.pa_tissu_deco1 = item.buyPrice || 0;
                       rawRow.pv_tissu_deco1 = item.sellPrice || 0;
                       rawRow.pa_tissu = item.buyPrice || 0;
                       rawRow.pv_tissu = item.sellPrice || 0;
                       rawRow.laize_tissu_deco1 = item.width || 0;
                       rawRow.raccord_v1 = item.raccord_v || 0;
                       rawRow.raccord_h1 = item.raccord_h || 0;
                       rawRow.motif_deco1 = item.motif ? 'Oui' : 'Non';
                   } else if (key === 'tissu_deco2') {
                       rawRow.tissu_2_id = item.id;
                       rawRow.pa_tissu_deco2 = item.buyPrice || 0;
                       rawRow.pv_tissu_deco2 = item.sellPrice || 0;
                       rawRow.laize_tissu_deco2 = item.width || 0;
                       rawRow.raccord_v2 = item.raccord_v || 0;
                       rawRow.raccord_h2 = item.raccord_h || 0;
                       rawRow.motif_deco2 = item.motif ? 'Oui' : 'Non';
                   } else if (key === 'doublure') {
                       rawRow.doublure_id = item.id;
                       rawRow.pa_doublure = item.buyPrice || 0;
                       rawRow.pv_doublure = item.sellPrice || 0;
                       rawRow.laize_doublure = item.width || 0;
                   } else if (key === 'inter_doublure') {
                       rawRow.inter_doublure_id = item.id;
                       rawRow.pa_inter = item.buyPrice || 0;
                       rawRow.pv_inter = item.sellPrice || 0;
                       rawRow.laize_inter = item.width || 0;
                   } else if (key === 'passementerie1' || key === 'passementerie') {
                       rawRow.passementerie_1_id = item.id;
                       rawRow.pa_passementerie1 = item.buyPrice || 0;
                       rawRow.pv_passementerie1 = item.sellPrice || 0;
                       rawRow.pa_passementerie = item.buyPrice || 0;
                       rawRow.pv_passementerie = item.sellPrice || 0;
                   } else if (key === 'passementerie2') {
                       rawRow.passementerie_2_id = item.id;
                       rawRow.pa_passementerie2 = item.buyPrice || 0;
                       rawRow.pv_passementerie2 = item.sellPrice || 0;
                   } else if (key === 'modele_mecanisme' || key === 'mecanisme') {
                       rawRow.rail_id = item.id;
                       rawRow.pa_mecanisme = item.buyPrice || 0;
                       rawRow.pv_mecanisme = item.sellPrice || 0;
                       if (item.dimension) rawRow.dim_mecanisme = item.dimension;
                   } else if (key === 'moteur') {
                       rawRow.moteur_id = item.id;
                       rawRow.pa_moteur = item.buyPrice || 0;
                       rawRow.pv_moteur = item.sellPrice || 0;
                   }
               }
           }
        });

        // Recompute formulas
        return recomputeRow(rawRow, targetSchema, ctx);
      }).filter(Boolean);

      allImportedRows = allImportedRows.concat(parsedRows);
    }

    return allImportedRows;

  } catch (error) {
    console.error("Error parsing Global Excel:", error);
    throw new Error("Impossible de lire le fichier Excel. Vérifiez le format.");
  }
}
