// Chapitrage unique des achats, partagé par la moulinette (profitabilityCalculator)
// et la liste d'achats (ShoppingListScreen). C'est le SEUL endroit qui décide de quoi
// va dans quel chapitre : toute évolution du découpage se répercute sur les deux écrans.
//
// Chapitres matières (achats fixes) :
//   1. Tissus & Doublures  — tissus déco, doublure, interdoublure, molleton, toile de finition
//   2. Passementerie       — isolée des tissus
//   3. Rails & Mécanismes  — rails, tringles, fournitures ET mécanismes de stores bateaux/vélum,
//                            qu'ils soient vendus au mètre linéaire ou à l'unité
//   4. Stores              — uniquement les stores négoce (produit fini acheté tel quel)
//
// La sous-traitance n'est pas un achat matière : elle est rendue à part (charges variables
// côté moulinette, chapitre simple côté liste d'achats).

export const PURCHASE_CHAPTERS = [
    { key: 'tissus', label: 'Tissus & Doublures' },
    { key: 'passementerie', label: 'Passementerie' },
    { key: 'rails', label: 'Rails & Mécanismes' },
    { key: 'stores', label: 'Stores' },
];

export const UNIT_ML = 'ml';
export const UNIT_PIECE = 'u';
export const UNIT_INTERVENTION = 'intervention';

const toNum = (v) => {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

const qtyOf = (r) => Math.max(1, toNum(r?.quantite));

// Deux familles de schémas coexistent et ne nomment pas leurs champs pareil :
// rideaux/stores collent le suffixe (ml_tissu1), les décors le soulignent (ml_tissu_1).
// Les deux sont acceptées ; une ligne ne porte jamais que l'une des deux.
const TISSU_FIELDS = [
    { name: 'tissu_deco1', ml: 'ml_tissu1', pa: 'pa_tissu1', motif: 'motif_deco1' },
    { name: 'tissu_deco2', ml: 'ml_tissu2', pa: 'pa_tissu2', motif: 'motif_deco2' },
    { name: 'doublure', ml: 'ml_doublure', pa: 'pa_doublure' },
    { name: 'interdoublure', ml: 'ml_interdoublure', pa: 'pa_interdoublure' },
    { name: 'inter_doublure', ml: 'ml_inter_doublure', pa: 'pa_inter' },
    { name: 'toile_finition_1', ml: 'ml_toile_finition_1', pa: 'pa_toile_finition_1' },
    { name: 'tissu_1', ml: 'ml_tissu_1', pa: 'pa_tissu_1' },
    { name: 'tissu_2', ml: 'ml_tissu_2', pa: 'pa_tissu_2' },
    { name: 'molleton', ml: 'ml_molleton', pa: 'pa_molleton' },
];

const PASSEMENTERIE_FIELDS = [
    { name: 'passementerie1', ml: 'ml_pass1', pa: 'pa_pass1' },
    { name: 'passementerie2', ml: 'ml_pass2', pa: 'pa_pass2' },
    { name: 'passementerie_1', ml: 'ml_pass_1', pa: 'pa_pass_1' },
    { name: 'passementerie_2', ml: 'ml_pass_2', pa: 'pa_pass_2' },
];

export const ST_LABELS = {
    pose: 'Sous-traitance Pose',
    confection: 'Sous-traitance Confection',
};

const SOUS_TRAITANCE_FIELDS = [
    { pa: 'st_pose_pa', label: ST_LABELS.pose },
    { pa: 'st_conf_pa', label: ST_LABELS.confection },
];

// Les PA de ligne sont stockés pour UNE unité de produit → toujours × quantité.
const lineCost = (r, key, q) => toNum(r?.[key]) * q;

const sourceOf = (r, qty, unit, pa) => ({
    // Côté liste d'achats les lignes viennent de plusieurs minutes (_minute est posé par
    // l'écran) ; côté moulinette il n'y en a qu'une, on retombe sur le produit.
    minute: r._minute || r.produit || 'Inconnu',
    zone: r.zone || '-',
    piece: r.piece || '-',
    produit: r.produit || '-',
    detail: r.detail || '',
    qty,
    unit,
    pa,
});

// Une même référence vendue au mètre sur une ligne et au forfait sur une autre donne
// deux entrées distinctes : mélanger les unités dans un total n'aurait aucun sens.
const push = (map, label, qty, unit, pa, source) => {
    const name = String(label ?? '').trim();
    if (!name || name === 'undefined') return;

    const key = `${name}|${unit}`;
    if (!map.has(key)) map.set(key, { label: name, qty: 0, unit, pa: 0, sources: [] });
    const item = map.get(key);
    item.qty += qty;
    item.pa += pa;
    if (source) item.sources.push(source);
};

const collectFabrics = (map, r, q, fields) => {
    for (const f of fields) {
        const name = r[f.name];
        if (!name) continue;
        const label = f.motif && r[f.motif] ? `${name} — ${r[f.motif]}` : name;
        const ml = toNum(r[f.ml]) * q;
        const pa = lineCost(r, f.pa, q);
        if (ml <= 0 && pa <= 0) continue;
        push(map, label, ml, UNIT_ML, pa, sourceOf(r, ml, UNIT_ML, pa));
    }
};

// PA mécanisme d'un store : soit le champ dédié, soit la somme des PA méca de la ligne.
// pa_meca est un champ legacy absent des schémas actuels, conservé pour les vieilles lignes.
const storeCost = (r) => (
    toNum(r.pa_mecanisme_store) > 0
        ? toNum(r.pa_mecanisme_store)
        : toNum(r.pa_meca) + toNum(r.pa_mecanisme) + toNum(r.pa_mecanisme_bis)
);

const collectMecanismes = (maps, r, q) => {
    const produit = String(r.produit || '');
    const isBateau = /bateau|vélum|velum/i.test(produit);
    const isStoreNegoce = !isBateau && (/store|canishade/i.test(produit) || /^autre$/i.test(produit));

    // nom_tringle est legacy (absent des schémas actuels) mais peut subsister dans
    // d'anciennes lignes : les lignes sont stockées en JSON libre.
    const mecaName = r.mecanisme_store || r.modele_mecanisme || r.nom_tringle;

    if (isStoreNegoce) {
        const pa = storeCost(r) * q;
        if (pa > 0) push(maps.stores, mecaName, q, UNIT_PIECE, pa, sourceOf(r, q, UNIT_PIECE, pa));
        return;
    }

    if (isBateau) {
        // Le mécanisme d'un bateau/vélum est une fourniture : il rejoint Rails & Mécanismes.
        // Seule sa toile reste dans Tissus & Doublures.
        const pa = storeCost(r) * q;
        if (pa > 0) push(maps.rails, mecaName, q, UNIT_PIECE, pa, sourceOf(r, q, UNIT_PIECE, pa));
        return;
    }

    // Rails, tringles et fournitures (rideaux, décors).
    const name = r.nom_tringle || r.modele_mecanisme || r.type_mecanisme || r.mecanisme_fourniture;
    const pa = (toNum(r.pa_meca) + toNum(r.pa_mecanisme)) * q;
    if (name && pa > 0) {
        const byMeter = r.type_mecanisme === 'Rail' || Boolean(r.nom_tringle);
        if (byMeter) {
            const ml = (toNum(r.largeur_mecanisme || r.l_mecanisme) / 100) * q;
            push(maps.rails, name, ml, UNIT_ML, pa, sourceOf(r, ml, UNIT_ML, pa));
        } else {
            push(maps.rails, name, q, UNIT_PIECE, pa, sourceOf(r, q, UNIT_PIECE, pa));
        }
    }

    // Mécanisme BIS (rideaux) : achat distinct au forfait, capté indépendamment du méca
    // principal — sinon il est perdu quand celui-ci est vide.
    const paBis = lineCost(r, 'pa_mecanisme_bis', q);
    if (paBis > 0) {
        push(maps.rails, r.mecanisme_bis || 'Méca Bis', q, UNIT_PIECE, paBis, sourceOf(r, q, UNIT_PIECE, paBis));
    }
};

const collectSousTraitance = (map, r, q) => {
    for (const f of SOUS_TRAITANCE_FIELDS) {
        const pa = lineCost(r, f.pa, q);
        if (pa > 0) push(map, f.label, q, UNIT_INTERVENTION, pa, sourceOf(r, q, UNIT_INTERVENTION, pa));
    }
};

const sorted = (map) => Array.from(map.values())
    .sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true }));

export const sumPA = (items = []) => items.reduce((acc, item) => acc + item.pa, 0);

/**
 * Agrège des lignes de chiffrage en chapitres d'achat.
 * Les lignes peuvent porter un `_minute` (nom de la minute d'origine) pour l'affichage.
 *
 * Chaque chapitre est TOUJOURS présent, même vide : les deux écrans affichent la même
 * structure d'un chiffrage à l'autre, avec un total à 0 quand il n'y a rien.
 */
export function aggregatePurchaseChapters(rows = []) {
    const maps = {
        tissus: new Map(),
        passementerie: new Map(),
        rails: new Map(),
        stores: new Map(),
    };
    const stMap = new Map();

    for (const r of rows) {
        if (!r) continue;
        const q = qtyOf(r);
        collectFabrics(maps.tissus, r, q, TISSU_FIELDS);
        collectFabrics(maps.passementerie, r, q, PASSEMENTERIE_FIELDS);
        collectMecanismes(maps, r, q);
        collectSousTraitance(stMap, r, q);
    }

    const chapters = {
        tissus: sorted(maps.tissus),
        passementerie: sorted(maps.passementerie),
        rails: sorted(maps.rails),
        stores: sorted(maps.stores),
    };

    return {
        ...chapters,
        sous_traitance: sorted(stMap),
        total: PURCHASE_CHAPTERS.reduce((acc, c) => acc + sumPA(chapters[c.key]), 0),
    };
}
