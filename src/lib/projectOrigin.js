// Origine d'un projet et trace du devis — logique pure (testée dans tests/projectOrigin.test.mjs).
//
// 1. Origine : chemin de création affiché discrètement à côté de « Créé le » dans l'en-tête du
//    projet (événement « created » de project_events, cf. lib/projectEvents).
// 2. Trace du devis : les lignes d'un projet créé depuis un devis portaient l'historique du
//    chiffrage (journal des modifications, photos, messages, avec leur date et leur auteur
//    d'origine). Décision du 2026-11-14 : rien de l'historique du devis dans le projet.
//    À l'import, les lignes repartent sans commentaires ; pour les projets déjà créés, tout ce
//    qui est antérieur à la création du projet est MASQUÉ à l'affichage (rien n'est supprimé).

/** Libellé court de l'origine (en-tête) et détail (infobulle). `event` = ligne « created ». */
export function originOf(event) {
    if (!event) return null;
    const d = event.detail || {};
    const type = d.origin || (event.guessed ? (String(event.label || '').includes('import') ? 'import' : 'blank') : 'blank');
    const by = event.guessed ? null : (event.user_name || d.by || null);
    const short = {
        blank: 'via projet vierge',
        import: 'via import du devis',
        odoo: `via commande Odoo${d.orderName ? ` ${d.orderName}` : ''}`,
    }[type] || 'via projet vierge';
    const detail = [
        {
            blank: 'Projet vierge, créé à la main',
            import: `Import manuel du devis${d.minuteName ? ` « ${d.minuteName} »` : ''}`,
            odoo: `Créé automatiquement à la confirmation de la commande Odoo${d.orderName ? ` ${d.orderName}` : ''}${d.minuteName ? ` (devis « ${d.minuteName} »)` : ''}`,
        }[type],
        by && by !== 'Odoo' ? `par ${by}` : null,
        event.guessed ? '— origine reconstituée' : null,
    ].filter(Boolean).join(' ');
    return { type, short, detail, guessed: !!event.guessed };
}

const toTime = (v) => {
    if (v == null || v === '') return null;
    const t = typeof v === 'number' ? v : Date.parse(v);
    return Number.isFinite(t) ? t : null;
};

/** Date d'une entrée de ligne (commentaire, photo, journal, historique). */
export const entryTime = (c) => toTime(c?.createdAt ?? c?.date);

/**
 * Masque ce qui précède la création du projet (historique recopié du devis).
 * Une entrée sans date reste affichée ; sans date de création, rien n'est masqué.
 */
export function sansTraceDuDevis(entries, projectCreatedAt) {
    const t0 = toTime(projectCreatedAt);
    if (t0 == null || !Array.isArray(entries)) return entries;
    return entries.filter((c) => {
        const t = entryTime(c);
        return t == null || t >= t0;
    });
}

/** Ligne de devis reprise dans un projet : sans commentaires, photos ni journal du chiffrage. */
export const ligneSansHistoriqueDevis = (r) => {
    const { __logArchive, history, ...rest } = r || {}; // eslint-disable-line no-unused-vars
    return { ...rest, comments: [] };
};
