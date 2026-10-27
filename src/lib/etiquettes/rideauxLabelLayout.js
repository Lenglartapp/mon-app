// src/lib/etiquettes/rideauxLabelLayout.js
// Grille de l'étiquette rideau (format atelier, cf. etiquettesV2/EtiquettesV2RectoVersoPortal.jsx).
// Référence des emplacements : l'étiquette stores bateaux place ses informations communes
// aux mêmes section / ligne / colonne.

// Cellule = [clé, libellé]. Une ligne = 1 à 4 cellules (grille 4 colonnes, complétée
// par des cases blanches). Un groupe peut porter un cadre matière (`frame`).
// RÈGLES : une case ne change jamais de ligne ; case masquée ou vide = case blanche à sa
// place ; on ne retire que des blocs entiers (ligne toute masquée, cadre vide, section vide).
// Clés croisées (cf. production/rideaux.js) : etiquette_lavage = Oui/Non « Étiq. Lenglart »,
// etiquette_lenglart = consigne d'entretien.
export const RIDEAUX_V2_SECTIONS = [
  { name: "COUPE", groups: [
    { frame: "Tissu 1", rows: [
      [["tissu_deco1", "Tissu"], ["laize_tissu1", "Laize"], ["hauteur_coupe", "H. coupe"], ["hauteur_coupe_motif", "H. motif"]],
      [["nombre_les", "Lés"], ["reste_les", "Appièc."], ["ht_t1", "Coupe"], ["cote", "Côté appièc."]],
    ]},
    { frame: "Tissu 2", rows: [
      [["tissu_deco2", "Tissu"], ["laize_tissu2", "Laize"], ["hauteur_coupe_t2", "H. coupe"], ["hauteur_coupe_motif_t2", "H. motif"]],
      [["nombre_les_t2", "Lés"], ["reste_les_t2", "Appièc."], ["ht_t2", "Coupe"]],
    ]},
    { frame: "Doublure", rows: [
      [["doublure", "Tissu"], ["laize_doublure", "Laize"], ["hauteur_coupe_doublure", "H. coupe"], ["deduction_doublure", "Doublure −"]],
      [["nombre_les_doublure", "Lés"], ["reste_les_doublure", "Appièc."], ["ht_doubl", "Coupe"]],
    ]},
    { frame: "Interdoublure", rows: [
      [["inter_doublure", "Tissu"], ["laize_inter", "Laize"], ["hauteur_coupe_inter", "H. coupe"]],
      [["nombre_les_inter", "Lés"], ["reste_les_inter", "Appièc."], ["ht_inter", "Coupe"]],
    ]},
    { rows: [
      [["passementerie1", "Pass. 1"], ["ml_pass1", "ML"], ["passementerie2", "Pass. 2"], ["ml_pass2", "ML"]],
      [["ampleur", "Ampleur"], ["a_plat", "À plat"]],
    ]},
  ]},
  { name: "OURLETS", groups: [
    { rows: [
      [["piquage_ourlets_du_bas", "OB"], ["piquage_ourlet", "Fin. OB"], ["onglets", "Onglets"]],
      [["v_ourlets_de_cotes", "OC"], ["finition_oc", "Fin. OC"], ["finition_champs", "Chant"], ["finition_retour", "Fin. retour"]],
      [["piquage_ourlets_bas_doublure", "OB doubl."], ["doublure_finition_bas", "Fin. OB doubl."]],
      [["poids", "Poids"], ["etiquette_lavage", "Étiq. Lenglart"], ["etiquette_lenglart", "Entretien"]],
    ]},
  ]},
  { name: "PRÉPARATION", groups: [
    { rows: [
      [["type_confection", "Plis"], ["hauteur_renfort_tete", "Renfort tête"], ["finition_bas_txt", "Bas"]],
      [["type_mecanisme", "Méca"], ["modele_mecanisme", "Modèle"], ["meca_couvert", "Montage"], ["type_croisement", "Croisement"]],
      [["hauteur_finie_gauche", "HF G"], ["hauteur_finie_milieu", "HF M"], ["hauteur_finie_droite", "HF D"]],
    ]},
  ]},
  { name: "FINITION TÊTE", groups: [
    { rows: [
      [["largeur_finie", "LF"], ["retour_gauche", "Retour G"], ["retour_droit", "Retour D"]],
      [["crochets_txt", "Crochets"], ["nombre_glisseur", "Glisseurs"], ["ruflette", "Ruflette"]],
      [["point_chausson", "Pt chausson"], ["bride", "Bride"], ["emballage", "Emballage"]],
    ]},
  ]},
];
