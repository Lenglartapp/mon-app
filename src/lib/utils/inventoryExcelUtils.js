import ExcelJS from 'exceljs';
import readXlsxFile from 'read-excel-file';

/**
 * Exporte l'inventaire actuel en fichier Excel
 * @param {Array} inventory 
 */
export async function exportInventoryToExcel(inventory) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventaire Solde');

    // Définition des colonnes
    worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Catégorie', key: 'category', width: 15 },
        { header: 'Produit', key: 'product', width: 30 },
        { header: 'Emplacement Actuel', key: 'location', width: 20 },
        { header: 'Affectation (Projet)', key: 'project', width: 25 },
        { header: 'Quantité Actuelle', key: 'qty', width: 15 },
        { header: 'Unité', key: 'unit', width: 10 },
        { header: 'NOUVELLE QUANTITÉ', key: 'newQty', width: 20 },
        { header: 'NOUVEL EMPLACEMENT', key: 'newLocation', width: 20 },
    ];

    // Mise en forme de l'en-tête
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' }
    };

    // Ajout des données
    inventory.forEach(item => {
        const row = worksheet.addRow({
            id: item.id,
            category: item.category || 'Divers',
            product: item.product,
            location: item.location || '',
            project: item.project || '',
            qty: item.qty,
            unit: item.unit,
            newQty: item.qty, // Par défaut, on garde la même quantité
            newLocation: item.location || '' // Par défaut, on garde le même emplacement
        });

        // Colorier les colonnes de modification pour suggérer la modif
        row.getCell('newQty').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEF3C7' } // Jaune clair
        };
        row.getCell('newLocation').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEF3C7' } // Jaune clair
        };
    });

    // Génération du buffer et téléchargement
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Export_Stock_Solde_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

/**
 * Traite le fichier Excel importé pour identifier les sorties de stock
 * @param {File} file 
 * @param {Array} currentInventory 
 */
export async function processInventoryClearanceImport(file, currentInventory) {
    try {
        const rows = await readXlsxFile(file);
        if (!rows || rows.length < 2) throw new Error("Fichier vide ou invalide");

        // Headers: [ID, Catégorie, Produit, Emplacement Actuel, Projet, Qty Actuelle, Unité, Nouvelle Qty, Nouvel Emplacement]
        // Index:     0,     1,       2,            3,           4,       5,       6,        7,              8
        
        const updates = [];
        
        // On commence à i = 1 pour sauter l'en-tête
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const id = row[0];
            const newQty = Number(row[7]); 
            const newLocation = row[8] ? String(row[8]).trim() : '';

            if (id === null || id === undefined) continue;

            const originalItem = currentInventory.find(item => item.id === id);
            
            if (originalItem) {
                const qtyDiff = Number(originalItem.qty) - newQty;
                const locChanged = (originalItem.location || '').trim() !== newLocation;

                if (qtyDiff > 0 || locChanged) {
                    updates.push({
                        ...originalItem,
                        qtyToRemove: Math.max(0, qtyDiff),
                        newTotalQty: newQty,
                        oldLocation: originalItem.location,
                        newLocation: newLocation,
                        hasQtyChange: qtyDiff > 0,
                        hasLocChange: locChanged,
                        reason: 'SOLDE / DÉSTOCKAGE EXCEL'
                    });
                }
            }
        }

        return updates;
    } catch (error) {
        console.error("Erreur import solde:", error);
        throw error;
    }
}
