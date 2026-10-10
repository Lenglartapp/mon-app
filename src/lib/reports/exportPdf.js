// Rapport client en PDF par l'impression du navigateur (« Enregistrer au format PDF ») :
// rapide, texte sélectionnable, rendu identique à l'aperçu (mêmes pages A4).

export const waitImages = (root, timeout = 15000) => Promise.race([
    Promise.all([...root.querySelectorAll('img')].map((img) => (img.complete
        ? Promise.resolve()
        : new Promise((res) => { img.onload = res; img.onerror = res; })))),
    new Promise((res) => setTimeout(res, timeout)),
]);

/** Nom proposé pour le fichier (le navigateur reprend le titre de la page). */
export const reportFileName = (projectName, date) => {
    const d = new Date(date);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const safe = String(projectName || 'Projet').replace(/[\\/:*?"<>|]+/g, ' ').trim();
    return `Rapport client - ${safe} - ${ymd}`;
};

export const PRINT_CSS = `
    /* À l'écran : mis en page mais hors de vue (pas display:none, sinon la pagination ne peut rien mesurer). */
    #df-report-print { position: fixed; left: -100000px; top: 0; width: 210mm; pointer-events: none; }
    @media print {
        body > *:not(#df-report-print) { display: none !important; }
        #df-report-print { position: static !important; left: auto !important; width: auto !important; }
        @page { size: A4 portrait; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
        #df-report-print .df-report-page { break-after: page; page-break-after: always; box-shadow: none !important; margin: 0 !important; }
        #df-report-print .df-report-page:last-of-type { break-after: auto; page-break-after: auto; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
`;

/** Ouvre l'impression une fois les images chargées ; le titre de la page sert de nom de fichier. */
export async function printReport(container, fileName) {
    await waitImages(container);
    if (document.fonts?.ready) await document.fonts.ready;
    const prevTitle = document.title;
    document.title = fileName;
    const restore = () => { document.title = prevTitle; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 1000); // navigateurs sans « afterprint » : print() est bloquant
}
