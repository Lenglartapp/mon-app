// Métrage « couché regroupé » (formules de métrage v4) — logique PURE, partagée par le
// chiffrage, la production et les besoins du projet.
//
// En couché, chaque rideau prenait une bande pleine laize (ML = à plat × nb rideaux), même
// si sa H. coupe n'en occupe qu'une partie. À l'atelier, on empile dans la laize autant de
// rideaux que possible, y compris de lignes différentes. Règle :
//  1. une pièce par rideau (paire = 2, un seul pan = 1) × Qté : { ligneId, h: H. coupe, a: à plat } ;
//  2. tri par à plat décroissant puis H. coupe décroissante (tri stable : ordre des lignes à égalité) ;
//  3. first-fit : la pièce va dans la 1re bande où Σh + h ≤ laize, sinon nouvelle bande
//     (pas de marge entre pièces : la marge machine est déjà dans h) ;
//  4. longueur d'une bande = max(à plat) de ses pièces ; ML total = Σ longueurs ÷ 100, sans arrondi.
// Répartition : ML d'une pièce = longueur bande × h ÷ Σh de la bande ÷ 100 ; ML d'une ligne =
// somme de ses pièces, arrondie au centième. L'arrondi au 0,5 m se fait une seule fois, sur le
// total du tissu, là où les besoins sont agrégés.
// Hors périmètre : rotation couché ↔ debout, rideaux courts mis bout à bout dans une bande.

const EPS = 1e-9;
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Place des pièces dans des bandes de la laize donnée.
 * @param {Array<{ligneId, h, a}>} pieces  dans l'ordre des lignes
 * @param {number} laize  cm
 * @returns {{ mlTotal, bandes: [{ longueur, laizeUtilisee, pieces }], mlParLigne: Object<ligneId, number> }}
 */
export function regrouperCouche(pieces, laize) {
    const L = Number(laize) || 0;
    const valid = (pieces || []).filter((p) => p && p.h > 0 && p.a > 0 && p.h <= L + EPS);
    // Tri stable (Array.prototype.sort l'est) : à plat ↓, puis H. coupe ↓.
    const sorted = valid.map((p, i) => ({ ...p, i })).sort((x, y) => y.a - x.a || y.h - x.h || x.i - y.i);
    const bandes = [];
    sorted.forEach((p) => {
        let b = bandes.find((x) => x.laizeUtilisee + p.h <= L + EPS);
        if (!b) { b = { longueur: 0, laizeUtilisee: 0, pieces: [] }; bandes.push(b); }
        b.pieces.push(p);
        b.laizeUtilisee += p.h;
        b.longueur = Math.max(b.longueur, p.a);
    });
    const exact = {};
    bandes.forEach((b, n) => {
        b.numero = n + 1;
        b.laizeUtilisee = Math.round(b.laizeUtilisee * 10) / 10;
        b.pieces.forEach((p) => {
            p.ml = (b.longueur * p.h) / b.laizeUtilisee / 100;
            exact[p.ligneId] = (exact[p.ligneId] || 0) + p.ml;
        });
    });
    const mlParLigne = Object.fromEntries(Object.entries(exact).map(([k, v]) => [k, r2(v)]));
    return { mlTotal: bandes.reduce((s, b) => s + b.longueur, 0) / 100, bandes, mlParLigne };
}

/** Matières regroupées, chacune séparément (sa laize, sa H. coupe). */
export const MATIERES_REGROUPEES = ['tissu1', 'doublure', 'inter'];

/**
 * Regroupe toutes les lignes d'un chiffrage / projet.
 * @param {Array<{ id, label, count, matieres: { tissu1?|doublure?|inter?: { article, laize, h, a } } }>} lignes
 *   `count` = nombre de rideaux de la ligne (pans × Qté). Une matière absente = non regroupée.
 * @returns {Map<id, { tissu1?, doublure?, inter? }>} par matière : { ml, bandes: [{ numero, n, avec: [label], nb }], total }
 */
export function metrageRegroupeLignes(lignes) {
    const groups = new Map();
    (lignes || []).forEach((l) => {
        MATIERES_REGROUPEES.forEach((mat) => {
            const m = l.matieres?.[mat];
            if (!m || !(m.laize > 0) || !(m.h > 0) || !(m.a > 0)) return;
            const key = `${mat}|${String(m.article || '').trim().toUpperCase()}|${m.laize}`;
            if (!groups.has(key)) groups.set(key, { mat, laize: m.laize, pieces: [] });
            const g = groups.get(key);
            for (let k = 0; k < (l.count || 1); k++) g.pieces.push({ ligneId: l.id, h: m.h, a: m.a, label: l.label });
        });
    });
    const out = new Map();
    groups.forEach((g) => {
        const res = regrouperCouche(g.pieces, g.laize);
        const bandesDe = new Map();
        res.bandes.forEach((b) => b.pieces.forEach((p) => {
            if (!bandesDe.has(p.ligneId)) bandesDe.set(p.ligneId, []);
            const list = bandesDe.get(p.ligneId);
            if (list.some((x) => x.numero === b.numero)) return;
            const avec = b.pieces.filter((x) => x.ligneId !== p.ligneId).map((x) => x.label);
            list.push({ numero: b.numero, nb: b.pieces.length, avec: [...new Set(avec)] });
        }));
        Object.entries(res.mlParLigne).forEach(([id, ml]) => {
            if (!out.has(id)) out.set(id, {});
            out.get(id)[g.mat] = { ml, bandes: bandesDe.get(id) || [], total: res.mlTotal, nbBandes: res.bandes.length };
        });
    });
    return out;
}

/** Infobulle d'une matière regroupée : « Couché regroupé : bande n° 3 avec Lit 2 (2 dans la laize) ». */
export function texteRegroupe(info) {
    if (!info?.bandes?.length) return '';
    return 'Couché regroupé : ' + info.bandes.map((b) => `bande n° ${b.numero}${b.avec.length ? ` avec ${b.avec.join(', ')}` : ''} (${b.nb} dans la laize)`).join(' ; ');
}

/** Arrondi au 0,5 m supérieur, une seule fois sur le total d'un tissu. */
export const arrondiDemiMetre = (ml) => Math.ceil(Number(ml || 0) * 2 - 1e-9) / 2;
