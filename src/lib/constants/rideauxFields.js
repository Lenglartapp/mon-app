// src/lib/constants/rideauxFields.js
// -----------------------------------------------------------------------------
// Listes d'options et libellés historiques des champs « rideaux ».
// Centralisé parce que ces valeurs étaient recopiées dans les schémas ET dans les
// modules d'import Excel, qui avaient déjà divergé.
// -----------------------------------------------------------------------------

/** Hauteurs de renfort de tête (liste stricte). */
export const HAUTEUR_RENFORT_TETE_OPTIONS = [
  "8 cm",
  "10 cm",
  "12 cm",
  "14 cm",
  "20 cm",
  "8 cm thermocollant",
  "10 cm thermocollant",
  "12 cm thermocollant",
  "14 cm thermocollant",
  "20 cm thermocollant",
];

/** Finitions d'ourlet, communes rideaux et stores bateaux.
 *  « Apparent » est devenu « Double + apparente » et « Invisible » est retiré : les lignes
 *  qui portent déjà ces valeurs les gardent (elles ne sont simplement plus proposées).
 *  Le coefficient de l'ourlet de côté en dépend : stores « Triple… » → × 6, « Double… » → × 4,
 *  « Surfil… » / « Point Bourdon… » → × 2 (cf. storesBateauxMetrage.js) ; rideaux, par côté,
 *  « Triple… » → 3 × OC, sinon 2 × OC (cf. coefOurletCoteRideau). */
export const FINITION_OURLET_OPTIONS = [
  "Double + apparente",
  "Surfil + Invisible",
  "Double + Invisible",
  "Point Bourdon + Invisible",
  "Point Bourdon + Plate apparente",
  "Triple + apparente",
  "Triple + invisible",
  "Bord/bord",
];

/** Finition de l'ourlet de côté (OC). */
export const FINITION_OC_OPTIONS = FINITION_OURLET_OPTIONS;

/** Rideaux : nombre de fois l'OC pris PAR CÔTÉ dans l'À plat, selon la Finition OC.
 *  « Triple… » → 3 ; Double, autres finitions et vide → 2 (comportement historique). */
// « Bord/bord » : coefficient à confirmer — pour l'instant celui par défaut (2), on joue sur l'ampleur.
const COEF_OC_RIDEAU = [["triple", 3]];
export function coefOurletCoteRideau(finitionOC) {
  const f = String(finitionOC || "").trim().toLowerCase();
  const hit = COEF_OC_RIDEAU.find(([prefix]) => f.startsWith(prefix));
  return hit ? hit[1] : 2;
}

/** Finition OB « Bord/bord » (rideaux, production) : + 3 cm sur la hauteur de coupe du tissu 1
 *  et de la doublure (cf. schemas/production/rideaux.js). Seule « Finition OB » déclenche. */
export const BORD_A_BORD_OB_CM = 3;
export const isBordABord = (v) => String(v || "").trim().toLowerCase() === "bord/bord";

/** Finition de l'ourlet du bas (OB) : la pastille Velcro n'existe que pour le bas. */
export const FINITION_OB_OPTIONS = [...FINITION_OURLET_OPTIONS, "Pastille Velcro"];

/** Finition OB des RIDEAUX : options propres aux rideaux (la liste ci-dessus reste celle des stores bateaux). */
export const FINITION_OB_RIDEAUX_OPTIONS = [...FINITION_OB_OPTIONS, "Assemblage finette"];

/** Crochets des rideaux (tableau de production et modèle Excel). */
export const TYPE_CROCHETS_OPTIONS = ['Crochet américain', 'Crochet américain + Ruban', 'Crochet escargot plastique', 'Crochet escargot métal', 'Agrafe à coudre', 'Crochets fourches'];

// ── TYPE DE MÉCANISME ────────────────────────────────────────────────────────
// Liste commune au chiffrage et à la production. « Sans Méca » a été renommé
// « Sans Méca/Méca existant » (nov. 2026) : les lignes déjà saisies gardent
// l'ancien libellé en base, d'où `isSansMeca` qui reconnaît les deux. C'est elle
// qu'il faut tester partout où « pas de mécanisme » coupe les prix PA/PV Méca.
export const SANS_MECA = 'Sans Méca/Méca existant';
export const SANS_MECA_LEGACY = 'Sans Méca';
export const TYPE_MECANISME_OPTIONS = ['Rail', 'Tringle', 'Rail Motorisé', SANS_MECA];
export const isSansMeca = (v) => v === SANS_MECA || v === SANS_MECA_LEGACY;

// Anciennes VALEURS de liste, converties vers le libellé courant à l'import Excel.
export const LEGACY_OPTION_VALUES = {
  type_mecanisme: { [SANS_MECA_LEGACY]: SANS_MECA },
};

/** Valeur importée : ancien libellé converti, toute autre valeur conservée telle quelle. */
export const upgradeLegacyOption = (key, value) => LEGACY_OPTION_VALUES[key]?.[value] ?? value;

// -----------------------------------------------------------------------------
// ANCIENS LIBELLÉS D'EN-TÊTE
// Les deux imports Excel (minuteExcelImport pour le chiffrage,
// importProjectsFromExcel pour la production) associent les colonnes du fichier
// aux clés internes PAR LE LIBELLÉ. Renommer un libellé rendrait donc muets tous
// les fichiers déjà remplis par les équipes : la colonne serait ignorée en
// silence, sans la moindre erreur. Ces alias garantissent que l'ancien en-tête
// ET le nouveau sont acceptés.
// Le libellé COURANT du schéma reste prioritaire ; ces valeurs ne servent qu'en
// repli. Ne jamais retirer une entrée : d'anciens fichiers circulent longtemps.
// -----------------------------------------------------------------------------
export const LEGACY_HEADER_ALIASES = {
  type_confection:              ["Confection", "Type Conf.", "Type Confection"],
  piquage_ourlet:               ["Piquage Ourlet", "Piquage ourlet"],
  piquage_ourlets_du_bas:       ["Piq. Bas", "OB Tissu"],
  piquage_ourlets_bas_doublure: ["Piq. Bas Doubl."],
  doublure_finition_bas:        ["Doubl. Fin. Bas", "Doubl. fin. bas"],
  hauteur_renfort_tete:         ["H/Renfort Têtes", "H. Renfort Tête", "H. Renfort tête"],
  v_ourlets_de_cotes:           ["Ourlets Côtés", "Ourlets de côté"],
  // Stores bateaux (oct. 2026) : libellés raccourcis, anciens en-têtes (tableau ET modèle Excel).
  ourlet_de_cote:               ["Ourlet Côté"],
  finition_chant_et_retour:     ["Finition Chant & Retour", "Finition Chant et Retour"],
  methode_manoeuvre:            ["Méthode Manœuvre", "Méthode manœuvre"],
  // Étiquettes : les intitulés « Etiq. Lavage » / « Etiq. Lenglart » ont changé de
  // SENS (les libellés ont été remis en face du contenu réel). Les colonnes des
  // anciens fichiers doivent continuer d'atterrir dans leur clé D'ORIGINE — d'où
  // ces alias, et les intitulés inédits côté modèle Excel (cf. importProjectsFromExcel).
  etiquette_lavage:             ["Etiq. Lavage"],
  etiquette_lenglart:           ["Etiq. Lenglart"],
  // Nb lés : affichés PAR RIDEAU depuis le 26/10/2026 (« Nb Lés / rideau ») ; anciens en-têtes.
  nombre_les:                   ["Nb Lés"],
  nombre_les_t2:                ["Nb Lés T2"],
  nombre_les_doublure:          ["Nb Lés Doublure"],
  nombre_les_inter:             ["Nb Lés Inter."],
};
