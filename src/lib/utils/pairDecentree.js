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
        // Localisation + identité du rail recopiées ; le reste reste vide (à saisir).
        [...LOCALISATION_FIELDS, ...CHILD_INHERIT_RAIL].forEach((k) => {
            if (sourceRow[k] !== undefined) child[k] = sourceRow[k];
        });
        return child;
    };

    return [parent, makeChild("left", RAP_GAUCHE), makeChild("right", RAP_DROIT)];
}

// Réordonne une liste de lignes pour que chaque enfant suive immédiatement son parent.
// Les lignes sans appartenance à une paire gardent leur position relative.
export function orderDecentreeRows(rows = []) {
    const byPair = new Map();
    rows.forEach((r) => {
        if (r?.pair_id) {
            if (!byPair.has(r.pair_id)) byPair.set(r.pair_id, { parent: null, left: null, right: null });
            const slot = byPair.get(r.pair_id);
            if (r.pair_role === "parent") slot.parent = r;
            else if (r.pair_role === "left") slot.left = r;
            else if (r.pair_role === "right") slot.right = r;
        }
    });

    const emitted = new Set();
    const out = [];
    rows.forEach((r) => {
        if (!r?.pair_id) { out.push(r); return; }
        if (emitted.has(r.pair_id)) return; // déjà émis le bloc complet
        emitted.add(r.pair_id);
        const { parent, left, right } = byPair.get(r.pair_id);
        [parent, left, right].forEach((x) => { if (x) out.push(x); });
    });
    return out;
}
