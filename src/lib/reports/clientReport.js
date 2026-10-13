// Rapport client (suivi de projet) — logique pure : regroupement des lignes selon la
// structure choisie, statut de pose traduit pour le client, photos, avancement.

import { resolvePendingPhoto } from '../photos';

export const GROUP_FIELDS = [
    { key: 'produit', label: 'Produit' },
    { key: 'zone', label: 'Zone' },
    { key: 'piece', label: 'Pièce' },
    { key: 'fenetre', label: 'Fenêtre' },
];
export const fieldLabel = (key) => GROUP_FIELDS.find((f) => f.key === key)?.label || key;

// Statut de pose interne → libellé client (modifiable dans le module) et état « posé ».
export const POSE_STATUSES = ['Non démarré', 'Méca posé', 'Accroché', 'Terminé', 'Reprise'];
export const DEFAULT_STATUS_LABELS = {
    'Non démarré': 'À venir',
    'Méca posé': 'Installation en cours',
    'Accroché': 'Installé',
    'Terminé': 'Terminé',
    'Reprise': 'Ajustement en cours',
};
const DONE = new Set(['Accroché', 'Terminé']);
const STARTED = new Set(['Méca posé', 'Reprise']);

// Produits sans pose (livrés) : coussins, plaids, caches-sommier.
export const hasPose = (row) => !/coussin|plaid|cache.sommier/i.test(String(row?.produit || ''));

/** État client d'une ligne : { key: 'done'|'progress'|'todo'|'none', label }. */
export function clientStatus(row, labels = DEFAULT_STATUS_LABELS) {
    if (!hasPose(row)) return { key: 'none', label: 'Livraison' };
    const s = row?.statut_pose || 'Non démarré';
    const key = DONE.has(s) ? 'done' : STARTED.has(s) ? 'progress' : 'todo';
    return { key, label: labels[s] || DEFAULT_STATUS_LABELS[s] || s };
}

/** Photos sur site, la plus récente d'abord. */
export function rowPhotos(row) {
    const list = Array.isArray(row?.photos_sur_site) ? row.photos_sur_site : [];
    // Photo encore en attente d'envoi (base64 sur l'appareil) : remplacée par sa version
    // envoyée si elle existe, sinon exclue (jamais de base64 enregistré dans un rapport).
    return list
        .map(resolvePendingPhoto)
        .filter((p) => p && p.url && !p.pending)
        .sort((a, b) => String(b.timestamp || b.id || '').localeCompare(String(a.timestamp || a.id || '')));
}

export const valueOf = (row, key) => String(row?.[key] ?? '').trim() || 'Non renseigné';

/** Avancement de pose d'un ensemble de lignes (produits sans pose exclus). */
export function progressOf(rows) {
    const posables = rows.filter(hasPose);
    const done = posables.filter((r) => DONE.has(r.statut_pose)).length;
    const progress = posables.filter((r) => STARTED.has(r.statut_pose)).length;
    return { total: posables.length, done, progress, todo: posables.length - done - progress };
}

/**
 * Arbre de sections selon les niveaux choisis (ordre d'apparition dans le projet conservé).
 * @returns [{ id, key, value, rows, children: [...] }] — feuilles : children vide.
 */
export function groupRows(rows, levels, parentId = '') {
    if (!levels.length) return [];
    const [key, ...rest] = levels;
    const groups = new Map();
    rows.forEach((r) => {
        const v = valueOf(r, key);
        if (!groups.has(v)) groups.set(v, []);
        groups.get(v).push(r);
    });
    return [...groups.entries()].map(([value, rs]) => {
        const id = `${parentId}/${key}:${value}`;
        return { id, key, value, rows: rs, children: groupRows(rs, rest, id) };
    });
}

// Filtres « ouvrages inclus » : localisation, produit, et statut de pose (valeur interne).
export const FILTER_FIELDS = ['zone', 'piece', 'fenetre', 'produit', 'statut'];
export const filterValue = (row, f) => (f === 'statut'
    ? (hasPose(row) ? (row?.statut_pose || 'Non démarré') : 'Sans pose')
    : valueOf(row, f));

/**
 * Lignes retenues pour le rapport. `excluded` : { zone: [...valeurs décochées], piece: [...], … }
 * (rien de décoché = tout inclus). `except` : champ ignoré (options d'un menu en cascade).
 */
export function filterRows(rows, { excluded = {} } = {}, except = null) {
    return (rows || []).filter((r) => FILTER_FIELDS.every((f) => (
        f === except || !excluded[f]?.length || !excluded[f].includes(filterValue(r, f))
    )));
}

/** Valeurs distinctes d'un champ (pour les filtres), dans l'ordre du projet. */
export const distinctValues = (rows, key) => [...new Set((rows || []).map((r) => filterValue(r, key)))];

/** Intitulé d'un ouvrage : les champs de localisation non utilisés comme regroupement. */
export function itemTitle(row, levels) {
    const parts = GROUP_FIELDS
        .filter((f) => !levels.includes(f.key))
        .map((f) => String(row?.[f.key] ?? '').trim())
        .filter(Boolean);
    return parts.join(' · ') || String(row?.produit || 'Ouvrage');
}
