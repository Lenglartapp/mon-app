// src/lib/formulas/recomputeRow.js

import { DECOR_PRODUIT_RE } from '../constants/productRouting';
import { evalFormula } from "./eval.js";
import { FORMULES_METRAGE_V2, isMetrageV2Row, largeurFinieV2, parseCm } from "./metrageVersion.js";

const NVL = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number(fallback);
};

const roundStep05 = (val) => {
  if (!Number.isFinite(val)) return 0;
  return Math.ceil(val * 2) / 2;
};

// Applique le coefficient de recalibrage commercial (stocké sur la ligne) APRÈS les formules
function applyRecalCoef(next) {
  const rc = Number(next.recal_coef);
  if (Number.isFinite(rc) && rc > 0 && Math.abs(rc - 1) > 0.00001) {
    next.prix_total = Math.round(next.prix_total * rc * 100) / 100;
    next.total_price = next.prix_total;
  }
  return next;
}

// Les schémas du module Production portent un marqueur `module` (posé à leur
// définition, cf. src/lib/schemas/production*). Il permet de faire diverger une
// règle entre Production et Chiffrage/Minutes sans dupliquer tout le calcul.
const isProduction = (schema, ctx) => schema?.module === 'production' || ctx?.module === 'production';

// --- CORE RECOMPUTE FUNCTION ---
export function recomputeRow(row, schema, ctx = {}) {
  const next = { ...row };
  const catalog = ctx.catalog || [];
  const settings = ctx.settings || {};
  const getPrice = ctx.getPrice || ((name) => {
    if (!name) return { pa: 0, pv: 0, found: false };
    const item = catalog.find(i => i.name === name);
    return item ? { pa: item.buyPrice || 0, pv: item.sellPrice || 0, found: true } : { pa: 0, pv: 0, found: false };
  });

  // --- 0. DATA ENRICHMENT (AUTO-FILL FROM CATALOG) ---
  const fillFromCatalog = (nameKey, mapRules) => {
    const name = next[nameKey];
    if (!name) return;
    const item = catalog.find(i => i.name === name);
    if (item) {
      Object.entries(mapRules).forEach(([rowKey, itemProp]) => {
        let val = item[itemProp];
        if (itemProp === 'laize') val = item.laize || item.width || item.dimension || 0;
        if (itemProp === 'raccord_v') val = item.raccord_v || item.vRepeat || 0;
        if (itemProp === 'raccord_h') val = item.raccord_h || item.hRepeat || 0; // Added this back as it was in original
        if (itemProp === 'pa') val = item.buyPrice || item.pa || 0;
        if (itemProp === 'pv') val = item.sellPrice || item.pv || 0;
        if (val !== undefined) next[rowKey] = val;
      });
    }
  };

  // 1a. AUTRES DEPENSES (Extra Expenses)
  if (next.produit === "Autre Dépense" || next.section === 'autre') {
    if (next.categorie?.includes("Commission")) {
      const pct = NVL(next.pourcentage);
      const baseCA = NVL(ctx.totalCA);
      next.prix_total = Math.round((baseCA * (pct / 100)) * 100) / 100;
      next.total_price = next.prix_total;
      return next;
    }
    next.total_price = NVL(next.prix_total);
    return next;
  }

  // 1b. DEPLACEMENTS (Specific Logistics)
  if (next.produit === "Déplacement") {
    const isSimpleCotes = next.type_deplacement === "Prise de cotes";

    const nbTech = Math.max(1, NVL(next.nb_tech));
    const nbAR = Math.max(1, NVL(next.nb_allers_retours, 1));
    const tempsTrajetAR = NVL(next.temps_trajet, 0);
    const joursInter = NVL(next.duree_intervention_jours, 0);
    const prixBillet = NVL(next.prix_billet, 0);
    const isDecouchage = next.decouchage === "Oui";

    const tauxHoraire = NVL(settings.taux_horaire, 0);

    let heuresFactureesUnit = 0;
    let coutMOUnit = 0;
    if (!isSimpleCotes) {
      if (tempsTrajetAR > 0) {
        // Aller seul = A/R ÷ 2, arrondi au plafond pair (tranches de 2h)
        const tempsAller = tempsTrajetAR / 2;
        const tempsAllerArrondi = Math.ceil(tempsAller / 2) * 2;

        if (tempsAllerArrondi <= 8) {
          // Tout en heures normales × 2 (aller + retour)
          heuresFactureesUnit = tempsAllerArrondi * 2;
          coutMOUnit = heuresFactureesUnit * tauxHoraire;
        } else {
          // 8h aller + retour au tarif normal, dépassement à +25%
          const heuresNormales = 8 * 2;
          const heuresSup = (tempsAllerArrondi - 8) * 2;
          heuresFactureesUnit = heuresNormales + heuresSup;
          coutMOUnit = heuresNormales * tauxHoraire + heuresSup * tauxHoraire * 1.25;
        }
      }
      next.heures_facturees = heuresFactureesUnit * nbAR * nbTech;
    }

    if (!isSimpleCotes) {
      next.cout_mo = coutMOUnit * nbAR * nbTech;

      if (isDecouchage && joursInter > 0) {
        next.nb_nuits = Math.max(0, (joursInter - 1) * nbTech);
        next.nb_repas = joursInter * 2 * nbTech;
      } else {
        next.nb_nuits = 0; next.nb_repas = 0;
      }
      next.cout_nuits = next.nb_nuits * NVL(settings.prix_nuit, 180);
      next.cout_repas = next.nb_repas * NVL(settings.prix_repas, 25);
      next.cout_billet_total = prixBillet * nbTech * nbAR;
    } else {
      next.cout_mo = Number(next.heures_facturees) * tauxHoraire;
      next.nb_nuits = 0;
      next.nb_repas = 0;
      next.cout_nuits = 0;
      next.cout_repas = 0;
      next.cout_billet_total = 0;
    }

    next.total_price = next.cout_mo + next.cout_nuits + next.cout_repas + next.cout_billet_total;
    next.prix_total = next.total_price;
    return applyRecalCoef(next);
  }

  // =========================================================
  // 2. PRODUCT-SPECIFIC CALCULATIONS (IDEALLY ISOLATED)
  // =========================================================
  const isRideau = /rideau|voilage/i.test(String(next.produit || ""));
  const isStore = /store|canishade/i.test(String(next.produit || ""));

  if (isRideau) {
    // A. Sync Fabric Specs
    fillFromCatalog('tissu_deco1', { laize_tissu1: 'laize', raccord_v_tissu1: 'raccord_v', raccord_h_tissu1: 'raccord_h' });
    fillFromCatalog('tissu_deco2', { laize_tissu2: 'laize', raccord_v_tissu2: 'raccord_v', raccord_h_tissu2: 'raccord_h' });
    fillFromCatalog('doublure', { laize_doublure: 'laize' });
    fillFromCatalog('interdoublure', { laize_interdoublure: 'laize' });

    // B. Geometry
    // En PRODUCTION, Largeur et L. Méca sont deux saisies INDÉPENDANTES : le rideau peut
    // être plus large que le rail (et inversement). On n'amorce donc la largeur depuis le
    // rail que si elle n'a jamais été renseignée (clé absente : ligne importée) ; une
    // largeur effacée ou remise à 0 doit le rester, sinon elle « revient » à la valeur du
    // rail à chaque recalcul.
    // En CHIFFRAGE/MINUTES, on garde le pré-remplissage historique : toute largeur vide
    // ou nulle reprend la largeur du rail.
    const largeurAAmorcer = isProduction(schema, ctx)
      ? next.largeur === undefined
      : !next.largeur;
    if (largeurAAmorcer && next.largeur_mecanisme) next.largeur = next.largeur_mecanisme;
    const L = NVL(next.largeur);
    const H = NVL(next.hauteur);
    const Ampleur = NVL(next.ampleur, 0);
    const FinitionBas = NVL(next.finition_bas, 0);
    const Croisement = NVL(next.croisement, 0);
    const RetourG = NVL(next.retour_gauche, 0);
    const RetourD = NVL(next.retour_droit, 0);

    const isOnePanel = (next.paire_ou_un_seul_pan || "").startsWith("Un seul pan");
    const coeff = L >= 200 ? 1.06 : 1.10;
    let A_Plat = isOnePanel ? ((L * coeff) * Ampleur + RetourG + RetourD) : (((L / 2) * coeff * Ampleur + RetourG) * 2 + Croisement);
    // Nombre de rideaux couverts par l'À plat (v2 : on raisonne par rideau → ×2 au métrage si paire)
    let nbRideaux = 1;
    // H. Coupe interdoublure — historique : celle du tissu 1 ; v2 : hauteur finie + hauteur tête.
    let H_Inter = null;
    // Formules de métrage v2 : uniquement les chiffrages créés après leur mise en place
    // (paramètre `formules_metrage` posé à la création, hérité par variantes/duplicats),
    // ou les lignes déjà marquées v2. La ligne est alors marquée, pour que la production
    // (dont les getters ne voient que la ligne) reprenne les mêmes règles après mise en projet.
    // Les anciens chiffrages gardent le calcul historique. En production, les getters du
    // schéma font foi (voir schemas/production/rideaux.js).
    const rowV2 = Number(ctx.paramsMap?.formules_metrage) >= FORMULES_METRAGE_V2 || isMetrageV2Row(next);
    const metrageV2 = !isProduction(schema, ctx) && rowV2;
    if (metrageV2) next.formules_metrage = FORMULES_METRAGE_V2;
    let H_Coupe;
    if (!metrageV2) {
      H_Coupe = H + FinitionBas + 50;
    } else {
      // CHIFFRAGE — L. Finie (par rideau) :
      //   Un seul pan : L + 10 + 2,5 % × L
      //   Paire       : L/2 + 10 + 2,5 % × L/2 + Croisement/2
      //   Wave 60/80  : (L/pan + 10 + 2,5 %) arrondie au multiple pair de 6/8 cm, + Croisement/2 si paire
      const lFinie = largeurFinieV2({ largeur: L, isOnePanel, croisement: Croisement, typeConfection: next.type_confection });
      next.largeur_finie = Math.round(lFinie * 10) / 10;

      // CHIFFRAGE — H. Coupe = Hauteur + Fin. Bas + k × Hauteur tête + 2 × OB
      //   k = 2 si non doublé (case Doublure vide), 1 si doublé.
      // Hauteur tête = clé production `hauteur_renfort_tete` (peut valoir « 8 cm »).
      const num = parseCm;
      const HTete = num(next.hauteur_renfort_tete);
      const OB = num(next.piquage_ourlets_du_bas);
      const isDouble = String(next.doublure || "").trim() !== "";
      H_Coupe = Math.round((H + FinitionBas + (isDouble ? 1 : 2) * HTete + 2 * OB) * 10) / 10;
      // Interdoublure : hauteur finie (Hauteur + Fin. Bas) + hauteur tête.
      H_Inter = Math.round((H + FinitionBas + HTete) * 10) / 10;

      // CHIFFRAGE — À plat PAR RIDEAU (même pour une paire) :
      //   Non doublé              : L. Finie × Ampleur + Retour + 4 × OC
      //   Doublé de lui-même      : L. Finie × Ampleur + Retour
      //   Doublé d'un autre tissu : L. Finie × Ampleur + Retour + 2 × Fin. Chant + 3
      //   Retour = max(Ret. G, Ret. D), comme en production (chaque rideau n'a qu'un retour).
      const norm = (v) => String(v ?? "").trim().toLowerCase();
      const OC = num(next.v_ourlets_de_cotes);
      const Chant = num(next.finition_champs);
      const isSelfLined = isDouble && norm(next.doublure) === norm(next.tissu_deco1);
      const ourlets = !isDouble ? 4 * OC : isSelfLined ? 0 : 2 * Chant + 3;
      A_Plat = Math.round((lFinie * Ampleur + Math.max(RetourG, RetourD) + ourlets) * 10) / 10;
      nbRideaux = isOnePanel ? 1 : 2;
    }
    next.a_plat = A_Plat;
    next.hauteur_coupe = H_Coupe;

    // Hauteur finie milieu — moyenne de G et D, sauf si déjà renseignée manuellement
    const _ded = NVL(next.valeur_deduction || next.val_ded_rail);
    const _fb  = NVL(next.finition_bas || next.f_bas);
    const _hfG = Math.round((NVL(next.hspf_gauche) - _ded + _fb) * 10) / 10;
    const _hfD = Math.round((NVL(next.hspf_droite) - _ded + _fb) * 10) / 10;
    if (next.hauteur_finie_milieu == null || next.hauteur_finie_milieu === '') {
        next.hauteur_finie_milieu = Math.round(((_hfG + _hfD) / 2) * 10) / 10;
    }

    // C. ML & Costs
    const RaccordV = NVL(next.raccord_v_tissu1, 0);
    next.hauteur_coupe_motif = (RaccordV > 0) ? Math.ceil(H_Coupe / RaccordV) * RaccordV + RaccordV : H_Coupe; // Added + RaccordV back

    // `egaliteCouche` (v2) : à égalité laize = hauteur, le tissu est couché (≥), comme en
    // production. Historique : strictement supérieur.
    // `demiLe` (v2, tissus unis) : sur une paire, lés par rideau arrondis au DEMI-lé supérieur
    // (un lé coupé en deux sert les deux rideaux) — 1,2 → 1,5 par rideau → 3 pour la paire.
    const calcML = (laize, hC, hCM, egaliteCouche = false, demiLe = false) => {
      if (!laize || laize <= 0) return { nbLes: 0, ml: 0 };
      // Determine H Key
      const H_Key = (hCM > hC) ? hCM : hC;

      if (egaliteCouche ? laize >= H_Key : laize > H_Key) {
        // Railoaded
        return {
          nbLes: 0,
          ml: roundStep05((A_Plat * nbRideaux) / 100)
        };
      } else {
        // Vertical — Nb lés par rideau (v2), métrage × nb de rideaux (2 pour une paire)
        const NbLes = (demiLe && nbRideaux === 2) ? Math.ceil((A_Plat / laize) * 2) / 2 : Math.ceil(A_Plat / laize);
        return {
          nbLes: NbLes,
          ml: roundStep05((NbLes * H_Key * nbRideaux) / 100)
        };
      }
    };

    // Tissu 1
    const tissu1Uni = !NVL(next.raccord_v_tissu1) && !NVL(next.raccord_h_tissu1);
    const res1 = calcML(NVL(next.laize_tissu1), H_Coupe, next.hauteur_coupe_motif, metrageV2, metrageV2 && tissu1Uni);
    next.nb_les_tissu1 = res1.nbLes; next.ml_tissu1 = res1.ml;
    const p1 = getPrice(next.tissu_deco1);
    if (p1.found) {
      next.pa_tissu1 = next.ml_tissu1 * (p1.pa || 0);
      next.pv_tissu1 = next.ml_tissu1 * (p1.pv || 0);
    } else {
      next.pa_tissu1 = 0; next.pv_tissu1 = 0; // tissu vidé → coût remis à 0
    }

    // Tissu 2 — v2 : saisie libre (prises de main, bandes…), Nb lés et ML ne sont plus calculés.
    if (!rowV2) {
      const res2 = calcML(NVL(next.laize_tissu2), H_Coupe, H_Coupe); // Tissu 2 is considered unie
      next.nb_les_tissu2 = res2.nbLes; next.ml_tissu2 = res2.ml;
    }
    const p2 = getPrice(next.tissu_deco2);
    if (p2.found) {
      next.pa_tissu2 = NVL(next.ml_tissu2) * (p2.pa || 0);
      next.pv_tissu2 = NVL(next.ml_tissu2) * (p2.pv || 0);
    } else {
      next.pa_tissu2 = 0; next.pv_tissu2 = 0;
    }

    // Doublure
    // Doublure : même H. Coupe que le tissu 1 (unie, sans raccord).
    const resD = calcML(NVL(next.laize_doublure), H_Coupe, H_Coupe, metrageV2, metrageV2);
    next.nb_les_doublure = resD.nbLes; next.ml_doublure = resD.ml;
    const pD = getPrice(next.doublure);
    if (pD.found) {
      next.pa_doublure = next.ml_doublure * (pD.pa || 0);
      next.pv_doublure = next.ml_doublure * (pD.pv || 0);
    } else {
      next.pa_doublure = 0; next.pv_doublure = 0;
    }

    // Interdoublure
    const hInter = H_Inter ?? H_Coupe;
    const resI = calcML(NVL(next.laize_interdoublure), hInter, hInter, metrageV2, metrageV2);
    next.nb_les_interdoublure = resI.nbLes; next.ml_interdoublure = resI.ml;
    const pI = getPrice(next.interdoublure);
    if (pI.found) {
      next.pa_interdoublure = next.ml_interdoublure * (pI.pa || 0);
      next.pv_interdoublure = next.ml_interdoublure * (pI.pv || 0);
    } else {
      next.pa_interdoublure = 0; next.pv_interdoublure = 0;
    }

    // Passementerie
    const isPaire = next.paire_ou_un_seul_pan === "Paire";
    // v2 : l'À plat est déjà par rideau (nbRideaux = 2) → pas de division par 2
    const L_Pan = (isPaire && nbRideaux === 1) ? A_Plat / 2 : A_Plat;

    const calcPassML = (app) => {
      if (!app) return 0;
      let res = 0;
      if (app === 'I') res = H_Coupe;
      else if (app === 'U') res = (H_Coupe * 2) + L_Pan;
      else if (app === 'L') res = H_Coupe + L_Pan;
      else if (app === '-') res = L_Pan;
      else return 0;

      return isPaire ? (res * 2) : res;
    };
    // « Prise de main » : ML saisi à la main (bande de tissu appliquée) → on ne le recalcule
    // pas ; sinon ML dérivé de la géométrie selon l'application (I/U/L/-).
    if (next.application_passementerie1 !== 'Prise de main') {
      next.ml_pass1 = roundStep05(calcPassML(next.application_passementerie1) / 100);
    }
    const pP1 = getPrice(next.passementerie1);
    if (pP1.found) {
      next.pa_pass1 = NVL(next.ml_pass1) * (pP1.pa || 0);
      next.pv_pass1 = NVL(next.ml_pass1) * (pP1.pv || 0);
    } else {
      next.pa_pass1 = 0; next.pv_pass1 = 0;
    }

    if (next.application_passementerie2 !== 'Prise de main') {
      next.ml_pass2 = roundStep05(calcPassML(next.application_passementerie2) / 100);
    }
    const pP2 = getPrice(next.passementerie2);
    if (pP2.found) {
      next.pa_pass2 = NVL(next.ml_pass2) * (pP2.pa || 0);
      next.pv_pass2 = NVL(next.ml_pass2) * (pP2.pv || 0);
    } else {
      next.pa_pass2 = 0; next.pv_pass2 = 0;
    }

    // Mecanisme
    next.pv_mecanisme_auto = false; // repère de verrouillage du PV (recalculé ci-dessous)
    if (next.type_mecanisme === 'Sans Méca') {
      next.modele_mecanisme = '';
      next.pa_mecanisme = 0;
      next.pv_mecanisme = 0;
    } else {
      // Le mode (pièce vs ml) dépend du MODÈLE choisi, pas du type Rail/Tringle.
      const mecaItem = catalog.find(i => i.name === next.modele_mecanisme);
      if (mecaItem?.unit === 'pce') {
        // À la pièce : PA saisi à la main dans le tableau, PV = PA × marge (coef de la
        // biblio, 2 par défaut). Le PV devient auto → verrouillé (pv_mecanisme_auto).
        const coef = Number(mecaItem.coef) || 2;
        next.pv_mecanisme = Math.round(NVL(next.pa_mecanisme) * coef * 100) / 100;
        next.pv_mecanisme_auto = true;
      } else if (next.type_mecanisme === 'Rail') {
        // Rail facturé au ml : PA et PV depuis la largeur méca × prix catalogue.
        const pM = getPrice(next.modele_mecanisme);
        const wM = NVL(next.largeur_mecanisme) / 100;
        if (pM.found) {
          next.pa_mecanisme = wM * (pM.pa || 0);
          next.pv_mecanisme = wM * (pM.pv || 0);
        }
      }
      // Autres (ex. Tringle au ml) : PA/PV restent saisis à la main.
    }

    // Méca Bis — même règle que le mécanisme principal ci-dessus. Elle manquait :
    // sur un article vendu à la pièce, le PA se remplissait depuis le catalogue mais
    // le PV restait à saisir, alors que PA Méca / PV Méca s'enchaînaient bien.
    next.pv_mecanisme_bis_auto = false; // repère de verrouillage du PV
    if (next.mecanisme_bis) {
      const mecaBisItem = catalog.find(i => i.name === next.mecanisme_bis);
      if (mecaBisItem?.unit === 'pce') {
        // À la pièce : PA saisi à la main, PV = PA × marge (coef de la biblio, 2 par
        // défaut). Le PV devient auto → verrouillé (pv_mecanisme_bis_auto).
        const coef = Number(mecaBisItem.coef) || 2;
        next.pv_mecanisme_bis = Math.round(NVL(next.pa_mecanisme_bis) * coef * 100) / 100;
        next.pv_mecanisme_bis_auto = true;
      } else if (next.type_mecanisme === 'Rail') {
        // Rail facturé au ml : PA et PV depuis la largeur méca × prix catalogue.
        const pMB = getPrice(next.mecanisme_bis);
        const wMB = NVL(next.largeur_mecanisme) / 100;
        if (pMB.found) {
          next.pa_mecanisme_bis = wMB * (pMB.pa || 0);
          next.pv_mecanisme_bis = wMB * (pMB.pv || 0);
        }
      }
    } else {
      next.pa_mecanisme_bis = 0;
      next.pv_mecanisme_bis = 0;
    }

    // Embrasse (passementerie vendue à la pièce)
    next.pv_embrasse_auto = false; // repère de verrouillage du PV
    if (next.embrasse) {
      const embItem = catalog.find(i => i.name === next.embrasse);
      if (embItem?.unit === 'pce') {
        // À la pièce : PA saisi à la main dans le tableau, PV = PA × marge (coef de la
        // biblio, 2 par défaut). Le PV devient auto → verrouillé (pv_embrasse_auto).
        const coef = Number(embItem.coef) || 2;
        next.pv_embrasse = Math.round(NVL(next.pa_embrasse) * coef * 100) / 100;
        next.pv_embrasse_auto = true;
      }
    } else {
      next.pa_embrasse = 0;
      next.pv_embrasse = 0;
    }
  }

  if (isStore) {
    // Sync Toile Finition 1
    fillFromCatalog('toile_finition_1', {
      laize_toile_finition_1: 'laize',
      raccord_v_toile_finition_1: 'raccord_v',
      raccord_h_toile_finition_1: 'raccord_h',
    });

    // Sync Mecanisme Store
    const itemMecaStore = catalog.find(i => i.name === next.mecanisme_store);
    next.pv_mecanisme_store_auto = false;
    if (itemMecaStore) {
      // Un coefficient posé sur l'article suffit à piloter le PV, même si l'unité
      // de l'article est restée à « ml » : les mécanismes de store se vendent
      // toujours à la pièce, et les articles créés avant que le coef soit saisissable
      // au catalogue portent encore l'unité par défaut. Sans coef, rien ne change :
      // les devis existants gardent leur PV saisi à la main.
      const storeCoef = Number(itemMecaStore.coef);
      const hasStoreCoef = Number.isFinite(storeCoef) && storeCoef > 0;
      if (itemMecaStore.unit === 'pce' || hasStoreCoef) {
        // À la pièce : PA saisi à la main, PV = PA × marge (coef biblio, 2 par défaut).
        const coef = hasStoreCoef ? storeCoef : 2;
        next.pv_mecanisme_store = Math.round(NVL(next.pa_mecanisme_store) * coef * 100) / 100;
        next.pv_mecanisme_store_auto = true;
      } else {
        if (next.pa_mecanisme_store === undefined || next.pa_mecanisme_store === 0) { // Only fill if not manually set
          next.pa_mecanisme_store = itemMecaStore.buyPrice || itemMecaStore.pa || 0;
        }
        if (next.pv_mecanisme_store === undefined || next.pv_mecanisme_store === 0) { // Only fill if not manually set
          next.pv_mecanisme_store = itemMecaStore.sellPrice || itemMecaStore.pv || 0;
        }
      }
    }

    // Toile Finition 1 (ML is manual, but prices are calculated)
    const pTF1 = getPrice(next.toile_finition_1);
    if (pTF1.found) {
      next.pa_toile_finition_1 = NVL(next.ml_toile_finition_1) * (pTF1.pa || 0);
      next.pv_toile_finition_1 = NVL(next.ml_toile_finition_1) * (pTF1.pv || 0);
    } else {
      next.pa_toile_finition_1 = 0; next.pv_toile_finition_1 = 0;
    }

    // Doublure (ML is manual for stores)
    const pD = getPrice(next.doublure);
    if (pD.found) {
      next.pa_doublure = NVL(next.ml_doublure) * (pD.pa || 0);
      next.pv_doublure = NVL(next.ml_doublure) * (pD.pv || 0);
    } else {
      next.pa_doublure = 0; next.pv_doublure = 0;
    }

    // Passementerie 1 & 2 (ML manuel pour les stores, PA/PV depuis le catalogue)
    const pP1 = getPrice(next.passementerie1);
    if (pP1.found) {
      next.pa_pass1 = NVL(next.ml_pass1) * (pP1.pa || 0);
      next.pv_pass1 = NVL(next.ml_pass1) * (pP1.pv || 0);
    } else {
      next.pa_pass1 = 0; next.pv_pass1 = 0;
    }
    const pP2 = getPrice(next.passementerie2);
    if (pP2.found) {
      next.pa_pass2 = NVL(next.ml_pass2) * (pP2.pa || 0);
      next.pv_pass2 = NVL(next.ml_pass2) * (pP2.pv || 0);
    } else {
      next.pa_pass2 = 0; next.pv_pass2 = 0;
    }

    const isBateau = /bateau|velum|vélum/i.test(next.produit || "");
    if (isBateau) {
      // For Store Bateau/Velum, mecanisme_fourniture is used for the mechanism
      fillFromCatalog('mecanisme_fourniture', {});
      const pM = getPrice(next.mecanisme_fourniture);
      if (pM.found) {
        next.pa_mecanisme = NVL(next.quantite) * (pM.pa || 0);
        next.pv_mecanisme = NVL(next.quantite) * (pM.pv || 0);
      }
    }
    // Generic Store logic for manually entered P.U. handled later
  }

  // --- 10. DECOR PRODUCTS (Coussins, Plaids, etc.) ---
  const isDecor = DECOR_PRODUIT_RE.test(String(next.produit || ""));

  if (isDecor) {
    // A. Fabrics (Underscored keys for Decors)
    fillFromCatalog('tissu_1', { laize_tissu_1: 'laize' });
    if (next.tissu_1) {
      const pT1 = getPrice(next.tissu_1);
      // ml_tissu_1 is MANUALLY entered for Decors (no auto-calc)
      if (pT1.found) {
        next.pa_tissu_1 = NVL(next.ml_tissu_1) * (pT1.pa || 0);
        next.pv_tissu_1 = NVL(next.ml_tissu_1) * (pT1.pv || 0);
      }
    } else {
      next.pa_tissu_1 = 0; next.pv_tissu_1 = 0; // tissu vidé → coût remis à 0
    }
    fillFromCatalog('tissu_2', { laize_tissu_2: 'laize' });
    if (next.tissu_2) {
      const pT2 = getPrice(next.tissu_2);
      if (pT2.found) {
        next.pa_tissu_2 = NVL(next.ml_tissu_2) * (pT2.pa || 0);
        next.pv_tissu_2 = NVL(next.ml_tissu_2) * (pT2.pv || 0);
      }
    } else {
      next.pa_tissu_2 = 0; next.pv_tissu_2 = 0;
    }

    // B. Passementerie
    fillFromCatalog('passementerie_1', {});
    if (next.passementerie_1) {
      const pP1D = getPrice(next.passementerie_1);
      if (pP1D.found) {
        next.pa_pass_1 = NVL(next.ml_pass_1) * (pP1D.pa || 0);
        next.pv_pass_1 = NVL(next.ml_pass_1) * (pP1D.pv || 0);
      }
    } else {
      next.pa_pass_1 = 0; next.pv_pass_1 = 0;
    }
    fillFromCatalog('passementerie_2', {});
    if (next.passementerie_2) {
      const pP2D = getPrice(next.passementerie_2);
      if (pP2D.found) {
        next.pa_pass_2 = NVL(next.ml_pass_2) * (pP2D.pa || 0);
        next.pv_pass_2 = NVL(next.ml_pass_2) * (pP2D.pv || 0);
      }
    } else {
      next.pa_pass_2 = 0; next.pv_pass_2 = 0;
    }

    // C. Interior / Mechanism (Shared) — per-unit costs, quantite applied at total level
    if (next.type_interieur) {
      const pInt = getPrice(next.type_interieur);
      if (pInt.found) {
        next.pa_interieur = (pInt.pa || 0);
        next.pv_interieur = (pInt.pv || 0);
      }
    } else {
      next.pa_interieur = 0; next.pv_interieur = 0;
    }
    next.pv_mecanisme_auto = false;
    if (next.mecanisme_fourniture) {
      const itemMF = catalog.find(i => i.name === next.mecanisme_fourniture);
      if (itemMF?.unit === 'pce') {
        // À la pièce : PA saisi à la main, PV = PA × marge (coef biblio, 2 par défaut).
        const coef = Number(itemMF.coef) || 2;
        next.pv_mecanisme = Math.round(NVL(next.pa_mecanisme) * coef * 100) / 100;
        next.pv_mecanisme_auto = true;
      } else if (NVL(next.pa_mecanisme) === 0) {
        const pMF = getPrice(next.mecanisme_fourniture);
        if (pMF.found) {
          next.pa_mecanisme = (pMF.pa || 0);
          next.pv_mecanisme = (pMF.pv || 0);
        }
      }
    }

    // Molleton (NEW for Tenture)
    fillFromCatalog('molleton', {});
    if (next.molleton) {
      const pMoll = getPrice(next.molleton);
      if (pMoll.found) {
        next.pa_molleton = NVL(next.ml_molleton) * (pMoll.pa || 0);
        next.pv_molleton = NVL(next.ml_molleton) * (pMoll.pv || 0);
      }
    } else {
      next.pa_molleton = 0; next.pv_molleton = 0;
    }

    // D. Baguettes (NEW for Tenture)
    fillFromCatalog('baguette_1', {});
    if (next.baguette_1) {
      const pB1 = getPrice(next.baguette_1);
      if (pB1.found) {
        next.pa_baguette_1 = NVL(next.ml_baguette_1) * (pB1.pa || 0);
        next.pv_baguette_1 = NVL(next.ml_baguette_1) * (pB1.pv || 0);
      }
    } else {
      next.pa_baguette_1 = 0; next.pv_baguette_1 = 0;
    }
    fillFromCatalog('baguette_2', {});
    if (next.baguette_2) {
      const pB2 = getPrice(next.baguette_2);
      if (pB2.found) {
        next.pa_baguette_2 = NVL(next.ml_baguette_2) * (pB2.pa || 0);
        next.pv_baguette_2 = NVL(next.ml_baguette_2) * (pB2.pv || 0);
      }
    } else {
      next.pa_baguette_2 = 0; next.pv_baguette_2 = 0;
    }
  } else if (!isRideau && !isStore) {
    // --- 11. GENERIC OTHERS ---
    // Minimal logic for products not specifically handled
    if (next.tissu_1) {
      const pT1 = getPrice(next.tissu_1);
      if (pT1.found) {
        next.pa_tissu_1 = NVL(next.ml_tissu_1) * (pT1.pa || 0);
        next.pv_tissu_1 = NVL(next.ml_tissu_1) * (pT1.pv || 0);
      }
    } else {
      next.pa_tissu_1 = 0; next.pv_tissu_1 = 0;
    }
  }

  // --- 11. PRESTATIONS & SOUS-TRAITANCE ---
  const taux = NVL(settings.taux_horaire, 135); // Changed from 35 to 135 as per common settings
  next.pv_prepa = NVL(next.heures_prepa) * taux;
  next.pv_pose = NVL(next.heures_pose) * taux;
  next.pv_confection = NVL(next.heures_confection) * taux;

  const coeffST = Number(settings.coef_sous_traitance) || 2;
  next.st_pose_pv = NVL(next.st_pose_pa) * coeffST;
  next.st_conf_pv = NVL(next.st_conf_pa) * coeffST;

  // --- 11b. OVERRIDES DE RECALIBRAGE COMMERCIAL ---
  // Si la ligne a été recalibrée (prorata ou leviers), on écrase les PV calculés
  // par les valeurs overridées, AVANT le calcul du total.
  if (next.__pv_overrides && typeof next.__pv_overrides === 'object') {
    Object.entries(next.__pv_overrides).forEach(([key, val]) => {
      if (typeof val === 'number') next[key] = val;
    });
  }

  // --- 12. TOTAUX ---
  const totalPriceComponents =
    NVL(next.pv_tissu1) + NVL(next.pv_tissu2) +
    NVL(next.pv_doublure) + NVL(next.pv_interdoublure) +
    NVL(next.pv_pass1) + NVL(next.pv_pass2) + NVL(next.pv_embrasse) +
    NVL(next.pv_mecanisme) + NVL(next.pv_mecanisme_bis) +
    NVL(next.pv_tissu_1) + NVL(next.pv_pass_1) +
    NVL(next.pv_tissu_2) + NVL(next.pv_pass_2) +
    NVL(next.pv_interieur) + NVL(next.pv_toile_finition_1) + NVL(next.pv_mecanisme_store) +
    NVL(next.pv_baguette_1) + NVL(next.pv_baguette_2) + NVL(next.pv_molleton) +
    NVL(next.pv_prepa) + NVL(next.pv_pose) + NVL(next.pv_confection) +
    NVL(next.st_pose_pv) + NVL(next.st_conf_pv) +
    NVL(next.livraison);

  // For isDecor: all pv_ components are per-unit, so unit_price = sum of components, total = unit_price × quantite
  // For others (stores, rideaux): pv_ components may already include quantite, so keep existing logic
  if (totalPriceComponents > 0) {
    next.unit_price = isDecor
      ? totalPriceComponents
      : totalPriceComponents / NVL(next.quantite, 1);
  }

  next.total_price = totalPriceComponents > 0
    ? (isDecor ? totalPriceComponents * NVL(next.quantite, 1) : totalPriceComponents)
    : NVL(next.unit_price) * NVL(next.quantite, 1);
  next.prix_total = next.total_price;

  return next;
}
