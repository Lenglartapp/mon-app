import readXlsxFile from 'read-excel-file';
import { uid } from '../lib/utils/uid';
import { recomputeRow } from '../lib/formulas/recomputeRow';

export async function parseRideauxImport(file, schema, ctx, catalog = []) {
    try {
        const rows = await readXlsxFile(file);
        if (!rows || rows.length < 2) return [];

        // Headers are in first row. Normalize them to match our expected text.
        const headers = rows[0].map(h => (h || '').toString().toLowerCase().trim());
        const dataRows = rows.slice(1);

        // V3 Column Mapping
        const colMap = {
            zone: 'zone',
            piece: 'pièce',
            produit: 'produit',
            quantite: 'quantité',
            largeur: 'largeur (cm)',
            hauteur: 'hauteur (cm)',
            ampleur: 'ampleur',
            type_confection: 'type confection',
            pair_un: 'paire / un pan',

            // Technical
            croisement: 'croisement (cm)',
            retour_g: 'retour gauche (cm)',
            retour_d: 'retour droit (cm)',
            envers_visible: 'envers visible',

            // Library Fields (Text inputs to be matched)
            tissu_deco1: 'tissu déco 1',
            tissu_deco2: 'tissu déco 2',
            doublure: 'doublure',
            inter_doublure: 'inter doublure',
            passementerie1: 'passementerie 1',
            passementerie2: 'passementerie 2',
            modele_mecanisme: 'modèle rail/tringle',
            type_mecanisme: 'type de mécanisme',
        };

        const indices = {};
        for (const [key, headerText] of Object.entries(colMap)) {
            indices[key] = headers.indexOf(headerText);
        }

        const parsedRows = dataRows.map(rowCellValues => {
            const getValue = (key) => {
                const idx = indices[key];
                if (idx === undefined || idx === -1) return undefined;
                return rowCellValues[idx];
            };

            const produit = getValue('produit');
            if (!produit) return null; // Skip empty rows

            // --- SMART MATCHING LOGIC ---
            // Configuration for each field to look up and inject properties
            const targets = [
                {
                    key: 'tissu_deco1', cat: 'Tissu',
                    inject: { name: 'tissu_deco1', id: 'tissu_id', pa: 'pa_tissu_deco1', pv: 'pv_tissu_deco1', width: 'laize_tissu_deco1', rv: 'raccord_v1', rh: 'raccord_h1', motif: 'motif_deco1' }
                },
                {
                    key: 'tissu_deco2', cat: 'Tissu',
                    inject: { name: 'tissu_deco2', id: 'tissu_2_id', pa: 'pa_tissu_deco2', pv: 'pv_tissu_deco2', width: 'laize_tissu_deco2', rv: 'raccord_v2', rh: 'raccord_h2', motif: 'motif_deco2' }
                },
                {
                    key: 'doublure', cat: 'Tissu',
                    inject: { name: 'doublure', id: 'doublure_id', pa: 'pa_doublure', pv: 'pv_doublure', width: 'laize_doublure' }
                },
                {
                    key: 'inter_doublure', cat: 'Tissu',
                    inject: { name: 'inter_doublure', id: 'inter_doublure_id', pa: 'pa_inter', pv: 'pv_inter', width: 'laize_inter' }
                },
                {
                    key: 'passementerie1', cat: 'Accessoire',
                    inject: { name: 'passementerie1', id: 'passementerie_1_id', pa: 'pa_passementerie1', pv: 'pv_passementerie1' }
                },
                {
                    key: 'passementerie2', cat: 'Accessoire',
                    inject: { name: 'passementerie2', id: 'passementerie_2_id', pa: 'pa_passementerie2', pv: 'pv_passementerie2' }
                },
                {
                    key: 'modele_mecanisme', cat: 'Rail',
                    inject: { name: 'modele_mecanisme', id: 'rail_id', pa: 'pa_mecanisme', pv: 'pv_mecanisme', dim: 'dim_mecanisme' }
                }
            ];

            // Injected props object
            const injected = {};

            targets.forEach(target => {
                const searchName = getValue(target.key)?.toString().trim().toLowerCase();
                if (!searchName) return;

                // Find in catalog (Name match)
                const item = catalog.find(c => c.name.toLowerCase().trim() === searchName);

                if (item) {
                    // Inject Name (Correct Case)
                    injected[target.inject.name] = item.name;
                    // Inject ID
                    if (target.inject.id) injected[target.inject.id] = item.id;

                    // Inject Prices (PA/PV)
                    if (target.inject.pa) injected[target.inject.pa] = item.buyPrice || 0;
                    if (target.inject.pv) injected[target.inject.pv] = item.sellPrice || 0;

                    // Inject Technicals (Width/Laize, Raccords)
                    if (target.inject.width) injected[target.inject.width] = item.width || 0;
                    if (target.inject.rv) injected[target.inject.rv] = item.raccord_v || 0;
                    if (target.inject.rh) injected[target.inject.rh] = item.raccord_h || 0;

                    // Inject Motif (Boolean -> Text)
                    if (target.inject.motif) {
                        injected[target.inject.motif] = item.motif ? 'Oui' : 'Non';
                    }

                    // Specific for Rail Dimension
                    if (target.inject.dim && item.dimension) injected[target.inject.dim] = item.dimension;

                } else {
                    // Not found: Keep raw text input from Excel
                    injected[target.inject.name] = getValue(target.key);
                }
            });

            // Construct raw row
            const rawRow = {
                id: uid(),
                zone: getValue('zone') || '',
                piece: getValue('piece') || '',
                produit: produit,
                quantite: Number(getValue('quantite')) || 1,
                largeur: Number(getValue('largeur')) || 0,
                hauteur: Number(getValue('hauteur')) || 0,
                ampleur: Number(getValue('ampleur')) || 0,

                // Technical V3
                croisement: Number(getValue('croisement')) || 0,
                retour_g: Number(getValue('retour_g')) || 0,
                retour_d: Number(getValue('retour_d')) || 0,
                envers_visible: (getValue('envers_visible') === 'Oui'),

                type_confection: getValue('type_confection') || '',
                pair_un: getValue('pair_un') || '',

                type_mecanisme: getValue('type_mecanisme') || '',

                // Injected Matches (Populated above)
                ...injected
            };

            // Vital: Recompute logical columns (prices, ml, etc.) using the app's trusted formula engine
            return recomputeRow(rawRow, schema, ctx);
        }).filter(r => r !== null);

        return parsedRows;

    } catch (error) {
        console.error("Error parsing Excel:", error);
        throw new Error("Impossible de lire le fichier Excel. Vérifiez le format.");
    }
}
