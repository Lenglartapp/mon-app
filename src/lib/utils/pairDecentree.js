// src/lib/utils/pairDecentree.js
// ─────────────────────────────────────────────────────────────────────────────
// « Paire décentrée » (rideaux) — une paire dont les deux pans ont des dimensions
// différentes. En production, une telle paire est représentée par 3 lignes :
//   - 1 ligne PARENT  : localisation + bloc rail (le rail est unique pour la paire)
//   - 1 ligne ENFANT gauche : « Un seul pan (Rapatriement Gauche) »
//   - 1 ligne ENFANT droite : « Un seul pan (Rapatriement Droit) »
//
// Le lien parent/enfants passe par des MÉTADONNÉES INTERNES (pair_id, pair_role),
// PAS par de nouveaux champs de schéma — même principe que source_line_id /
// imported_at déjà posés à la migration. Aucun nouveau « champ » côté utilisateur.
// ─────────────────────────────────────────────────────────────────────────────
import { uid } from "./uid";

// Libellés (réutilisent EXACTEMENT les options existantes du select)
export const PAIRE_DECENTREE = "Paire décentrée";
export const RAP_GAUCHE = "Un seul pan (Rapatriement Gauche)";
export const RAP_DROIT = "Un seul pan (Rapatriement Droit)";

// Liste complète des options du champ paire_ou_un_seul_pan (avec « Paire décentrée »)
export const PAIRE_OPTIONS_BASE = [
    "Paire",
    "Un seul pan",
    "Pan libre",
    RAP_DROIT,
    RAP_GAUCHE,
    PAIRE_DECENTREE,
];

// Champs de localisation partagés par les 3 lignes (pour rester groupées et situées)
export const LOCALISATION_FIELDS = ["zone", "piece", "produit"];

// Identité du rail recopiée SUR LES ENFANTS (pour que la confection sache quel rail manœuvrer)
export const CHILD_INHERIT_RAIL = ["type_mecanisme", "modele_mecanisme", "couleur_mecanisme", "type_pose"];

// Données techniques du rail : portées par le PARENT uniquement.
// Sur les lignes enfants, ces colonnes affichent « voir parent » (affichage seul, donnée vide).
export const DECENTREE_PARENT_ONLY_TECH = ["largeur_mecanisme", "nombre_glisseur"];

// Bloc « rail » conservé sur la ligne parent (le rail est unique pour la paire).
// C'est ICI qu'on ajuste ce qui reste au parent vs ce qui part aux enfants.
export const PARENT_RAIL_FIELDS = [
    "type_mecanisme", "modele_mecanisme", "couleur_mecanisme", "meca_couvert",
    "largeur_mecanisme", "nombre_glisseur", "couleur_glisseur",
    "embout_meca", "embout_meca_link", "support", "support_link",
    "valeur_deduction", "type_pose", "statut_pose",
];

// ── Détection ────────────────────────────────────────────────────────────────
export const isDecentreeParent = (row) => row?.pair_role === "parent";
export const isDecentreeChild = (row) => row?.pair_role === "left" || row?.pair_role === "right";
export const isDecentreeRow = (row) => isDecentreeParent(row) || isDecentreeChild(row);

// Une ligne « normale » qui vient d'être passée à « Paire décentrée » (à éclater)
export const needsDecentreeSplit = (row) =>
    row?.paire_ou_un_seul_pan === PAIRE_DECENTREE && !row?.pair_role;

// ── Options conditionnées au contexte (pour optionsFn du select) ─────────────
export function paireOptionsForRow(row) {
    if (row?.pair_role === "parent") return [PAIRE_DECENTREE];
    if (row?.pair_role === "left") return [RAP_GAUCHE];
    if (row?.pair_role === "right") return [RAP_DROIT];
    return PAIRE_OPTIONS_BASE;
}

// ── Création des 3 lignes à partir d'une ligne source ────────────────────────
// Le parent conserve son id (préserve références/persistance), son identité, son
// bloc rail et ses métadonnées ; toutes les autres colonnes (dimensions/confection)
// sont vidées. Les 2 enfants sont créés VIDES (sauf localisation + rôle).
export function createDecentreePair(sourceRow = {}, schema = []) {
    const pairId = uid();
    const keepOnParent = new Set([...LOCALISATION_FIELDS, ...PARENT_RAIL_FIELDS]);

    // Parent : on part de la ligne source, on vide les colonnes hors localisation+rail.
    const parent = { ...sourceRow };
    (schema || []).forEach((col) => {
        if (col?.key && !keepOnParent.has(col.key)) delete parent[col.key];
    });
    parent.id = sourceRow.id || uid();
    parent.pair_id = pairId;
    parent.pair_role = "parent";
    parent.paire_ou_un_seul_pan = PAIRE_DECENTREE;

    const makeChild = (role, paireValue) => {
        const child = { id: uid(), pair_id: pairId, pair_role: role, paire_ou_un_seul_pan: paireValue };
        // Version des formules de métrage : les enfants suivent la ligne d'origine.
        if (sourceRow.formules_metrage !== undefined) child.formules_metrage = sourceRow.formules_metrage;
        // Localisation + identité du rail recopiées ; le reste reste vide (à saisir).
        [...LOCALISATION_FIELDS, ...CHILD_INHERIT_RAIL].forEach((k) => {
            if (sourceRow[k] !== undefined) child[k] = sourceRow[k];
        });
        return child;
    };

    return [parent, makeChild("left", RAP_GAUCHE), makeChild("right", RAP_DROIT)];
}

// ── Duplication ──────────────────────────────────────────────────────────────
// Dupliquer une ligne d'une paire (parent OU pan) duplique TOUTE la paire :
// parent + 2 pans recopiés, sous un NOUVEAU pair_id (sinon deux parents
// partageraient le même pair_id). Une ligne hors paire est copiée seule, sans
// métadonnées de paire. `copyRow(source)` fabrique la copie (nouvel id, libellé…).
// Renvoie le nouveau tableau de lignes, ou null si l'id est introuvable.
export function duplicateRowOrPair(rows = [], id, copyRow) {
    const index = rows.findIndex((r) => r.id === id);
    if (index === -1) return null;
    const source = rows[index];
    const out = [...rows];

    if (!isDecentreeRow(source) || !source.pair_id) {
        const copy = copyRow(source);
        delete copy.pair_id;
        delete copy.pair_role;
        out.splice(index + 1, 0, copy);
        return out;
    }

    const members = rows.filter((r) => r.pair_id === source.pair_id);
    // Un seul parent par copie, même si la paire en a déjà plusieurs (anciens doublons) :
    // on prend la ligne cliquée si c'est un parent, sinon le premier parent de la paire.
    const parent = isDecentreeParent(source) ? source : members.find(isDecentreeParent);
    const left = members.find((r) => r.pair_role === "left");
    const right = members.find((r) => r.pair_role === "right");
    const block = [parent, left, right].filter(Boolean);

    const newPairId = uid();
    const copies = block.map((r) => ({ ...copyRow(r), pair_id: newPairId, pair_role: r.pair_role }));
    const lastIndex = Math.max(...members.map((r) => rows.indexOf(r)));
    out.splice(lastIndex + 1, 0, ...copies);
    return out;
}

// Réordonne une liste de lignes pour que chaque enfant suive immédiatement son parent.
// Les lignes sans appartenance à une paire gardent leur position relative.
// Aucune ligne n'est jamais écartée : si une paire a plusieurs lignes du même rôle
// (doublons hérités d'une ancienne duplication), elles sont toutes conservées.
export function orderDecentreeRows(rows = []) {
    const byPair = new Map();
    rows.forEach((r) => {
        if (r?.pair_id) {
            if (!byPair.has(r.pair_id)) byPair.set(r.pair_id, { parent: [], left: [], right: [], other: [] });
            const slot = byPair.get(r.pair_id);
            (slot[r.pair_role] || slot.other).push(r);
        }
    });

    const emitted = new Set();
    const out = [];
    rows.forEach((r) => {
        if (!r?.pair_id) { out.push(r); return; }
        if (emitted.has(r.pair_id)) return; // déjà émis le bloc complet
        emitted.add(r.pair_id);
        const { parent, left, right, other } = byPair.get(r.pair_id);
        out.push(...parent, ...left, ...right, ...other);
    });
    return out;
}
