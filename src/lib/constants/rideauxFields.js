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
  "14 cm",
  "8 cm thermocollant",
  "10 cm thermocollant",
  "14 cm thermocollant",
];

/** Finitions d'ourlet — partagées par « Finition OB » (piquage_ourlet) et « Finition OC » (finition_oc). */
export const FINITION_OURLET_OPTIONS = [
  "Apparent",
  "Invisible",
  "Surfil + Invisible",
  "Double + Invisible",
  "Point Bourdon + Invisible",
  "Point Bourdon + Plate apparente",
];

// -----------------------------------------------------------------------------
// ANCIENS LIBELLÉS D'EN-TÊTE
// Les deux imports Excel (importGlobalExcel pour le chiffrage,
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
  // Étiquettes : les intitulés « Etiq. Lavage » / « Etiq. Lenglart » ont changé de
  // SENS (les libellés ont été remis en face du contenu réel). Les colonnes des
  // anciens fichiers doivent continuer d'atterrir dans leur clé D'ORIGINE — d'où
  // ces alias, et les intitulés inédits côté modèle Excel (cf. importProjectsFromExcel).
  etiquette_lavage:             ["Etiq. Lavage"],
  etiquette_lenglart:           ["Etiq. Lenglart"],
};
