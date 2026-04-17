// src/lib/import/importProjectsFromExcel.js
import readXlsxFile from 'read-excel-file';
import { uid } from '../utils/uid';

// Prénoms autorisés dans le dropdown responsable
const ALLOWED_FIRST_NAMES = ['Angelina', 'Aristide', 'Adrien', 'Thomas', 'Alison', 'Emmanuel', 'Muriel'];

// Fallback si les users ne sont pas passés
const RESPONSABLES_FALLBACK = ALLOWED_FIRST_NAMES;

const STATUTS = ['À commencer', 'En cours', 'Terminé', 'SAV', 'Archivé'];

const STATUS_MAP = {
  'à commencer': 'TODO',
  'todo': 'TODO',
  'en cours': 'IN_PROGRESS',
  'in_progress': 'IN_PROGRESS',
  'terminé': 'DONE',
  'termine': 'DONE',
  'done': 'DONE',
  'sav': 'SAV',
  'archivé': 'ARCHIVED',
  'archive': 'ARCHIVED',
};

const TYPES_INTERVENTION = ['Livraison', 'Installation'];

// Modules : une colonne par module — valeur Oui/Non (conservé pour rétrocompat)
const MODULES = [
  { col: 'Rideau', produit: 'Rideau' },
  { col: 'Voilage', produit: 'Voilage' },
  { col: 'Store Bateau', produit: 'Store Bateau' },
  { col: 'Store Classique', produit: 'Store' },
  { col: 'Tenture Murale', produit: 'Tenture Murale' },
  { col: 'Cache-Sommier', produit: 'Cache-Sommier' },
  { col: 'Coussin', produit: 'Coussin' },
  { col: 'Plaid', produit: 'Plaid' },
  { col: 'Tête de lit', produit: 'Tête de lit' },
];

const BASE_COLUMNS = [
  'Nom projet',
  'Responsable',
  'Statut',
  'Type',
  'Date livraison',
  'H. Prépa allouées',
  'H. Conf allouées',
  'H. Pose allouées',
  'H. Prépa consommées',
  'H. Conf consommées',
  'H. Pose consommées',
  'Lieu',
];

const ALL_COLUMNS = [...BASE_COLUMNS, ...MODULES.map(m => m.col)];

// ---------------------------------------------------------------------------
// Helpers pour la définition des colonnes
// c(key, label, type, width, extra) → colonne saisie
// calc(key, label, width)           → colonne calculée (grisée, non importée)
// ---------------------------------------------------------------------------
const c = (key, label, type, width, extra = {}) => ({ key, label, type, width, computed: false, ...extra });
const calc = (key, label, width = 14) => ({ key, label, type: 'computed', width, computed: true });

// Options courantes
const OUI_NON = ['Oui', 'Non'];
const STATUT_COTES = ['Cote non prenable', 'Déduction restante à faire', 'Définitive', 'Validé par chef de projet'];
const REALISE_PAR = ['Lenglart', 'Sous-Traitant'];

// ---------------------------------------------------------------------------
// Définition des feuilles produits
// ---------------------------------------------------------------------------
const PRODUCT_SHEETS = [

  // ── RIDEAUX & VOILAGES ──────────────────────────────────────────────────
  {
    name: 'Rideaux & Voilages',
    produit: 'Rideau',
    color: 'FF1E3A5F',
    columns: [
      c('zone',                        'Zone',                    'text',     16),
      c('piece',                       'Pièce',                   'text',     18),
      c('produit',                     'Produit',                 'select',   16, { options: ['Rideau', 'Voilage'] }),
      c('type_confection',             'Type Conf.',              'select',   18, { options: ['Pli Flamand', 'Plis Creux', 'Pli Plat', 'Tripli', 'Wave 80', 'Wave 60', 'Pli Couteau', 'A Plat'] }),
      c('hauteur_renfort_tete',        'H. Renfort Tête',         'text',     16),
      c('paire_ou_un_seul_pan',        'Paire ou Pan',            'select',   20, { options: ['Paire', 'Un seul pan', 'Un seul pan (Rapatriement Droit)', 'Un seul pan (Rapatriement Gauche)'] }),
      c('largeur_gorge',               'Larg. Gorge (cm)',        'number',   16),
      c('profondeur_gorge',            'Prof. Gorge (cm)',        'number',   16),
      c('ampleur',                     'Ampleur',                 'number',   12),
      c('largeur_mecanisme',           'L. Méca (cm)',            'number',   14),
      c('largeur',                     'Largeur (cm)',            'number',   14),
      calc('largeur_finie',            'L. Finie',                12),
      c('v_ourlets_de_cotes',          'Ourlets Côtés',           'number',   14),
      c('piquage_ourlet',              'Piquage Ourlet',          'select',   16, { options: ['Apparent', 'Invisible'] }),
      calc('a_plat',                   'À Plat',                  12),
      c('hspf_droite',                 'HSPF Droit',              'number',   13),
      c('hspf_milieu',                 'HSPF Milieu',             'number',   14),
      c('hspf_gauche',                 'HSPF Gauche',             'number',   14),
      c('statut_cotes',                'Statut Côtes',            'select',   22, { options: STATUT_COTES }),
      c('valeur_deduction',            'Val. Déduc.',             'number',   13),
      c('finition_bas',                'Cassant / Rasant',        'number',   16),
      calc('hauteur_finie_droite',     'H. Finie Droite',         15),
      calc('hauteur_finie_milieu',     'H. Finie Milieu',         15),
      calc('hauteur_finie_gauche',     'H. Finie Gauche',         15),
      calc('hauteur_coupe',            'H. Coupe',                13),
      calc('hauteur_coupe_motif',      'H. Coupe Motif',          15),
      calc('hauteur_coupe_doublure',   'H. Coupe Doubl.',         16),
      c('deduction_doublure',          'Déd. Doublure',           'number',   14),
      c('piquage_ourlets_du_bas',      'Piq. Bas',                'number',   12),
      c('piquage_ourlets_bas_doublure','Piq. Bas Doubl.',         'number',   16),
      c('doublure_finition_bas',       'Doubl. Fin. Bas',         'number',   16),
      c('finition_champs',             'Fin. Chant',              'number',   13),
      c('poids',                       'Poids',                   'select',   10, { options: OUI_NON }),
      c('onglets',                     'Onglets',                 'select',   14, { options: ['Non', 'Régulier', 'Irrégulier'] }),
      c('bride',                       'Bride',                   'select',   10, { options: OUI_NON }),
      c('type_crochets',               'Crochets',                'select',   18, { options: ['Crochet Américain', 'Crochet Escargot'] }),
      c('point_chausson',              'Point Chausson',          'select',   16, { options: OUI_NON }),
      calc('nombre_les',               'Nb Lés',                  11),
      c('tissu_deco1',                 'Tissu 1',                 'text',     22),
      c('laize_tissu1',                'Laize T1',                'number',   12),
      c('raccord_v_tissu1',            'Raccord V T1',            'number',   14),
      c('raccord_h_tissu1',            'Raccord H T1',            'number',   14),
      c('tissu_deco2',                 'Tissu 2',                 'text',     22),
      c('laize_tissu2',                'Laize T2',                'number',   12),
      c('raccord_v_tissu2',            'Raccord V T2',            'number',   14),
      c('raccord_h_tissu2',            'Raccord H T2',            'number',   14),
      c('doublure',                    'Doublure',                'text',     22),
      c('laize_doublure',              'Laize D.',                'number',   12),
      c('inter_doublure',              'Interdoublure',           'text',     18),
      c('laize_inter',                 'Laize Interdoubl.',       'number',   18),
      c('passementerie1',              'Pass. 1',                 'text',     22),
      c('application_passementerie1',  'Appli Pass. 1',           'text',     16),
      c('passementerie2',              'Pass. 2',                 'text',     22),
      c('application_passementerie2',  'Appli Pass. 2',           'text',     16),
      c('croisement',                  'Croisement',              'number',   13),
      c('type_croisement',             'Type Croisement',         'select',   26, { options: ['Croisement par chevauchement rail', 'Patte de croisement devant derrière', 'Patte de croisement double devant', 'Croisement simple arrière gauche', 'Croisement simple arrière droit'] }),
      c('retour_gauche',               'Retour G',                'number',   12),
      c('retour_droit',                'Retour D',                'number',   12),
      c('type_retours',                'Type Retours',            'select',   14, { options: ['Élastique', 'Velcro', 'Piton'] }),
      c('hauteur_corniere_elastique',  'H. Cornière / Élastique', 'number',   22),
      c('etiquette_lavage',            'Etiq. Lavage',            'select',   14, { options: OUI_NON }),
      c('etiquette_lenglart',          'Etiq. Lenglart',          'select',   15, { options: OUI_NON }),
      c('type_mecanisme',              'Type Méca',               'text',     16),
      c('modele_mecanisme',            'Modèle Méca',             'text',     16),
      c('couleur_mecanisme',           'Couleur Méca',            'text',     16),
      c('meca_couvert',                'Méca Couvert',            'select',   15, { options: ['Couvert', 'Mi-Couvert', 'Découvert'] }),
      c('type_commande',               'Type Commande',           'select',   22, { options: ['Manuelle', 'Télécommande/Radio', 'Commande murale Radio', 'Commande murale Sec', 'Fourni par le client'] }),
      calc('nombre_glisseur',          'Nb Glisseurs',            13),
      c('couleur_glisseur',            'Couleur Glisseur',        'text',     16),
      c('piton',                       'Piton',                   'text',     12),
      c('embout_meca',                 'Embout Méca',             'text',     14),
      c('support',                     'Support',                 'text',     14),
      c('equerre',                     'Équerre',                 'select',   12, { options: ['5', '8', '12', '18', 'F7,5', 'F10'] }),
      c('commentaire_confection',      'Commentaire Confection',  'text',     30),
      c('type_pose',                   'Type Pose',               'select',   16, { options: ['Mural', 'Plafond', 'Grande hauteur', 'Suspente', 'Naissance', 'Encastrée'] }),
      c('heures_confection',           'H. Conf.',                'number',   12),
      c('quantite',                    'Qté',                     'number',    8),
    ],
    example: {
      zone: 'Salon', piece: 'Fenêtre principale', produit: 'Rideau',
      type_confection: 'Pli Flamand', paire_ou_un_seul_pan: 'Paire',
      largeur_mecanisme: 280, largeur: 275, ampleur: 2.5,
      hspf_droite: 260, hspf_milieu: 260, hspf_gauche: 260,
      valeur_deduction: 1, finition_bas: 0,
      tissu_deco1: 'Lin beige', laize_tissu1: 140, quantite: 1,
    },
  },

  // ── STORES BATEAUX ───────────────────────────────────────────────────────
  {
    name: 'Stores Bateaux',
    produit: 'Store Bateau',
    color: 'FF4A235A',
    columns: [
      c('zone',                        'Zone',                    'text',     16),
      c('piece',                       'Pièce',                   'text',     18),
      c('produit',                     'Produit',                 'select',   16, { options: ['Store Bateau', 'Store Velum'] }),
      c('largeur',                     'Largeur (cm)',            'number',   14),
      calc('largeur_finie',            'L. Finie',                12),
      c('ourlet_de_cote',              'Ourlet Côté',             'number',   13),
      calc('a_plat',                   'À Plat',                  12),
      c('hauteur_finie',               'H. Finie (cm)',           'number',   14),
      c('statut_cotes',                'Statut Côtes',            'select',   22, { options: STATUT_COTES }),
      calc('hauteur_coupe',            'H. Coupe',                13),
      calc('hauteur_coupe_motif',      'H. Coupe Motif',          15),
      calc('hauteur_coupe_doublure',   'H. Coupe Doubl.',         16),
      c('picage_bas',                  'Piqûre Bas',              'text',     14),
      c('finition_chant_et_retour',    'Finition Chant & Retour', 'text',     22),
      c('toile_finition_1',            'Tissu 1',                 'text',     22),
      c('laize_toile_finition_1',      'Laize TF1',               'number',   13),
      c('raccord_v_toile_finition_1',  'Raccord V TF1',           'number',   15),
      c('raccord_h_toile_finition_1',  'Raccord H TF1',           'number',   15),
      c('doublure',                    'Doublure',                'text',     22),
      c('laize_doublure',              'Laize D.',                'number',   12),
      c('largeur_gorge',               'Larg. Gorge (cm)',        'number',   16),
      c('profondeur_gorge',            'Prof. Gorge (cm)',        'number',   16),
      c('etiquette_lavage',            'Étiq. Lavage',            'select',   14, { options: OUI_NON }),
      c('mecanisme_store',             'Méca Store',              'text',     20),
      c('couleur_mecanisme',           'Couleur Méca',            'text',     16),
      c('type_commande',               'Type Commande',           'select',   22, { options: ['Manuelle', 'Télécommande', 'Commande murale', 'Fourni par le client'] }),
      c('type_moteur',                 'Type Moteur',             'text',     14),
      c('cote_manoeuvre',              'Côté Manœuvre',           'select',   16, { options: ['Droite', 'Gauche'] }),
      c('methode_manoeuvre',           'Méthode Manœuvre',        'select',   20, { options: ['Cabestan', 'Freel', 'Cordon', 'Chaînette'] }),
      c('equerre_support',             'Équerre Support',         'text',     16),
      calc('nombre_anneaux_largeur',   'Nb Anneaux Larg.',        18),
      c('deportation_premier_anneau',  'Déport 1er Anneau',       'text',     18),
      c('valeur_velcro',               'Val. Velcro',             'select',   13, { options: ['2', '2.5', '5'] }),
      c('valeur_intervalle',           'Val. Intervalle',         'number',   15),
      calc('nombre_intervalles',       'Nb Intervalles',          14),
      c('barre_de_charge',             'Barre Charge',            'text',     14),
      c('longueur_barre_de_charge',    'Long. Barre Ch.',         'number',   16),
      c('longueur_tigette',            'Long. Tigette',           'number',   14),
      calc('nombre_de_tigettes',       'Nb Tigettes',             13),
      c('espace_ouverture_fenetre',    'Espace Ouv. Fenêtre',     'number',   20),
      c('guidage',                     'Guidage',                 'select',   14, { options: ['Guidé', 'Pas guidé'] }),
      c('cable_intermediaire',         'Câble Intermédiaire',     'select',   20, { options: ['1', '2', '3'] }),
      c('type_pose',                   'Type Pose',               'select',   16, { options: ['Mural', 'Plafond', 'Grande hauteur', 'Naissance', 'Sur ouvrant', 'Encastré'] }),
      c('commentaire_confection',      'Commentaire Confection',  'text',     30),
      c('heures_prepa',                'H. Prépa',                'number',   12),
      c('heures_confection',           'H. Conf.',                'number',   12),
      c('quantite',                    'Qté',                     'number',    8),
    ],
    example: {
      zone: 'Chambre', piece: 'Fenêtre gauche', produit: 'Store Bateau',
      largeur: 120, ourlet_de_cote: 1.5, hauteur_finie: 180,
      statut_cotes: 'Définitive', toile_finition_1: 'Coton blanc cassé',
      laize_toile_finition_1: 140, cote_manoeuvre: 'Droite',
      methode_manoeuvre: 'Cordon', valeur_intervalle: 30, quantite: 1,
    },
  },

  // ── STORES CLASSIQUES ────────────────────────────────────────────────────
  {
    name: 'Stores Classiques',
    produit: 'Store Enrouleur',
    color: 'FF1A5276',
    columns: [
      c('zone',              'Zone',               'text',     16),
      c('piece',             'Pièce',              'text',     18),
      c('produit',           'Produit',            'select',   20, { options: ['Store Enrouleur', 'Store Vénitien', 'Store Bande Verticale', 'Store Canishade', 'Store Coffre', 'Autre'] }),
      c('largeur',           'Largeur (cm)',        'number',   14),
      c('hauteur',           'Hauteur (cm)',        'number',   14),
      c('largeur_gorge',     'Larg. Gorge (cm)',    'number',   16),
      c('profondeur_gorge',  'Prof. Gorge (cm)',    'number',   16),
      c('toile_finition_1',  'Toile',               'text',     22),
      c('mecanisme_store',   'Méca Store',          'text',     20),
      c('type_commande',     'Type Commande',       'select',   22, { options: ['Manuelle', 'Radio', 'Commande murale', 'Fourni par le client'] }),
      c('cote_manoeuvre',    'Côté Manœuvre',       'select',   18, { options: ['Manœuvre gauche', 'Manœuvre droite'] }),
      c('hauteur_manoeuvre', 'H. Manœuvre (cm)',    'number',   16),
      c('type_pose',         'Type Pose',           'select',   16, { options: ['Mural', 'Plafond', 'Grande hauteur', 'Suspente', 'Naissance', 'Sur ouvrant', 'Encastré'] }),
      c('guidage_coulisse',  'Guidage / Coulisse',  'select',   18, { options: ['Guidé', 'Pas guidé', 'Coulisse'] }),
      c('statut_cotes',      'Statut Côtes',        'select',   22, { options: STATUT_COTES }),
      c('quantite',          'Qté',                 'number',    8),
    ],
    example: {
      zone: 'Bureau', piece: 'Fenêtre', produit: 'Store Enrouleur',
      largeur: 100, hauteur: 150, cote_manoeuvre: 'Manœuvre droite', quantite: 1,
    },
  },

  // ── COUSSINS ─────────────────────────────────────────────────────────────
  {
    name: 'Coussins',
    produit: 'Coussins',
    color: 'FF1E6B45',
    columns: [
      c('zone',                   'Zone',                        'text',     16),
      c('piece',                  'Pièce',                       'text',     18),
      c('realise_par',            'Réalisé par',                 'select',   16, { options: REALISE_PAR }),
      c('nom_sous_traitant',      'Nom Sous-Traitant',           'text',     20),
      c('largeur',                'Largeur (cm)',                'number',   14),
      c('hauteur',                'Hauteur (cm)',                'number',   14),
      c('epaisseur',              'Épaisseur',                   'number',   13),
      calc('largeur_coupe',       'Larg. Coupe',                 13),
      calc('hauteur_coupe',       'Haut. Coupe',                 13),
      c('tissu_1',                'Tissu 1',                     'text',     22),
      c('laize_tissu_1',          'Laize T1',                    'number',   12),
      c('ml_tissu_1',             'ML T1',                       'number',   10),
      c('tissu_2',                'Tissu 2',                     'text',     22),
      c('laize_tissu_2',          'Laize T2',                    'number',   12),
      c('ml_tissu_2',             'ML T2',                       'number',   10),
      c('type_interieur',         'Intérieur',                   'select',   18, { options: ['Mousse', 'Intérieur Plume', 'Intérieur Polyester'] }),
      c('passementerie_1',        'Pass. 1',                     'text',     22),
      c('app_passementerie_1',    'Appli Pass. 1',               'text',     18),
      c('ml_pass_1',              'ML P1',                       'number',   10),
      c('passementerie_2',        'Pass. 2',                     'text',     22),
      c('app_passementerie_2',    'Appli Pass. 2',               'text',     18),
      c('ml_pass_2',              'ML P2',                       'number',   10),
      c('heures_confection',      'H. Conf.',                    'number',   12),
      c('quantite',               'Qté',                         'number',    8),
    ],
    example: {
      zone: 'Salon', piece: 'Canapé', realise_par: 'Lenglart',
      largeur: 45, hauteur: 45, epaisseur: 10,
      tissu_1: 'Velours bleu', laize_tissu_1: 140,
      type_interieur: 'Mousse', quantite: 4,
    },
  },

  // ── CACHE-SOMMIER ────────────────────────────────────────────────────────
  {
    name: 'Cache-Sommier',
    produit: 'Cache-Sommier',
    color: 'FF6E2C00',
    columns: [
      c('zone',                   'Zone',                 'text',     16),
      c('piece',                  'Pièce',                'text',     18),
      c('realise_par',            'Réalisé par',          'select',   16, { options: REALISE_PAR }),
      c('nom_sous_traitant',      'Nom Sous-Traitant',    'text',     20),
      c('type_confection',        'Confection',           'select',   18, { options: ['Confection boîte', 'Plis Dior'] }),
      c('largeur',                'Largeur (cm)',         'number',   14),
      c('longueur',               'Longueur (cm)',        'number',   14),
      calc('longueur_coupe',      'Long. Coupe',          14),
      c('hauteur',                'Hauteur (cm)',         'number',   14),
      c('ourlet_bas',             'Ourlet Bas',           'number',   12),
      calc('a_plat',              'À Plat',               12),
      c('tissu_1',                'Tissu 1',              'text',     22),
      c('laize_tissu_1',          'Laize T1',             'number',   12),
      c('ml_tissu_1',             'ML T1',                'number',   10),
      c('tissu_2',                'Tissu 2',              'text',     22),
      c('laize_tissu_2',          'Laize T2',             'number',   12),
      c('ml_tissu_2',             'ML T2',                'number',   10),
      c('passementerie_1',        'Pass. 1',              'text',     22),
      c('app_passementerie_1',    'Appli Pass. 1',        'text',     18),
      c('ml_pass_1',              'ML P1',                'number',   10),
      calc('largeur_satinette',   'Larg. Satinette',      16),
      calc('longueur_satinette',  'Long. Satinette',      16),
      c('nb_plis_dior',           'Nb Plis Dior',         'number',   14),
      c('finition_plis_dior',     'Finition Plis Dior',   'text',     18),
      c('doublure',               'Doublure',             'select',   14, { options: OUI_NON }),
      c('heures_confection',      'H. Conf.',             'number',   12),
      c('quantite',               'Qté',                  'number',    8),
    ],
    example: {
      zone: 'Chambre', piece: 'Lit principal', realise_par: 'Lenglart',
      type_confection: 'Confection boîte', largeur: 160, longueur: 200,
      hauteur: 35, tissu_1: 'Lin naturel', laize_tissu_1: 300, quantite: 1,
    },
  },

  // ── PLAIDS ───────────────────────────────────────────────────────────────
  {
    name: 'Plaids',
    produit: 'Plaid',
    color: 'FF0D3349',
    columns: [
      c('zone',                   'Zone',                 'text',     16),
      c('piece',                  'Pièce',                'text',     18),
      c('realise_par',            'Réalisé par',          'select',   16, { options: REALISE_PAR }),
      c('nom_sous_traitant',      'Nom Sous-Traitant',    'text',     20),
      c('largeur',                'Largeur (cm)',         'number',   14),
      c('hauteur',                'Hauteur (cm)',         'number',   14),
      calc('largeur_coupe',       'Larg. Coupe',          13),
      calc('hauteur_coupe',       'Haut. Coupe',          13),
      c('tissu_1',                'Tissu 1',              'text',     22),
      c('laize_tissu_1',          'Laize T1',             'number',   12),
      c('ml_tissu_1',             'ML T1',                'number',   10),
      c('tissu_2',                'Tissu 2',              'text',     22),
      c('laize_tissu_2',          'Laize T2',             'number',   12),
      c('ml_tissu_2',             'ML T2',                'number',   10),
      c('molleton',               'Molleton',             'text',     18),
      c('laize_molleton',         'Laize Mol.',           'number',   13),
      c('ml_molleton',            'ML Mol.',              'number',   10),
      c('passementerie_1',        'Pass. 1',              'text',     22),
      c('app_passementerie_1',    'Appli Pass. 1',        'text',     18),
      c('ml_pass_1',              'ML P1',                'number',   10),
      c('passementerie_2',        'Pass. 2',              'text',     22),
      c('app_passementerie_2',    'Appli Pass. 2',        'text',     18),
      c('ml_pass_2',              'ML P2',                'number',   10),
      c('heures_confection',      'H. Conf.',             'number',   12),
      c('quantite',               'Qté',                  'number',    8),
    ],
    example: {
      zone: 'Salon', piece: 'Canapé', realise_par: 'Lenglart',
      largeur: 130, hauteur: 170, tissu_1: 'Cachemire gris',
      laize_tissu_1: 150, quantite: 2,
    },
  },

  // ── TÊTES DE LIT ─────────────────────────────────────────────────────────
  {
    name: 'Têtes de Lit',
    produit: 'Tête de lit',
    color: 'FF4A148C',
    columns: [
      c('zone',                   'Zone',                 'text',     16),
      c('piece',                  'Pièce',                'text',     18),
      c('realise_par',            'Réalisé par',          'select',   16, { options: REALISE_PAR }),
      c('nom_sous_traitant',      'Nom Sous-Traitant',    'text',     20),
      c('largeur',                'Largeur (cm)',         'number',   14),
      c('hauteur',                'Hauteur (cm)',         'number',   14),
      c('epaisseur',              'Épaisseur',            'number',   13),
      c('tissu_1',                'Tissu 1',              'text',     22),
      c('laize_tissu_1',          'Laize T1',             'number',   12),
      c('ml_tissu_1',             'ML T1',                'number',   10),
      c('tissu_2',                'Tissu 2',              'text',     22),
      c('laize_tissu_2',          'Laize T2',             'number',   12),
      c('ml_tissu_2',             'ML T2',                'number',   10),
      c('passementerie_1',        'Pass. 1',              'text',     22),
      c('app_passementerie_1',    'Appli Pass. 1',        'text',     18),
      c('ml_pass_1',              'ML P1',                'number',   10),
      c('passementerie_2',        'Pass. 2',              'text',     22),
      c('app_passementerie_2',    'Appli Pass. 2',        'text',     18),
      c('ml_pass_2',              'ML P2',                'number',   10),
      c('molleton',               'Molleton / Mousse',    'text',     20),
      c('laize_molleton',         'Laize Moll/Mous.',     'number',   16),
      c('ml_molleton',            'ML Moll/Mous.',        'number',   14),
      c('mecanisme_fourniture',   'Mécanisme',            'text',     20),
      c('heures_confection',      'H. Conf.',             'number',   12),
      c('quantite',               'Qté',                  'number',    8),
    ],
    example: {
      zone: 'Chambre', piece: 'Lit principal', realise_par: 'Lenglart',
      largeur: 160, hauteur: 120, epaisseur: 8,
      tissu_1: 'Velours anthracite', laize_tissu_1: 140, quantite: 1,
    },
  },

  // ── TENTURES MURALES ─────────────────────────────────────────────────────
  {
    name: 'Tentures Murales',
    produit: 'Tenture Murale',
    color: 'FF4E342E',
    columns: [
      c('zone',                   'Zone',                 'text',     16),
      c('piece',                  'Pièce',                'text',     18),
      c('largeur',                'Largeur (cm)',         'number',   14),
      c('hauteur',                'Hauteur (cm)',         'number',   14),
      calc('largeur_coupe',       'Larg. Coupe',          13),
      calc('hauteur_coupe',       'Haut. Coupe',          13),
      c('tissu_1',                'Tissu 1',              'text',     22),
      c('laize_tissu_1',          'Laize T1',             'number',   12),
      c('ml_tissu_1',             'ML T1',                'number',   10),
      c('molleton',               'Molleton',             'text',     18),
      c('ml_molleton',            'ML Mol.',              'number',   10),
      c('passementerie_1',        'Pass. 1',              'text',     22),
      c('app_passementerie_1',    'Appli Pass. 1',        'text',     18),
      c('ml_pass_1',              'ML P1',                'number',   10),
      c('baguette_1',             'Baguette 1',           'text',     18),
      c('ml_baguette_1',          'ML B1',                'number',   10),
      c('baguette_2',             'Baguette 2',           'text',     18),
      c('ml_baguette_2',          'ML B2',                'number',   10),
      c('heures_confection',      'H. Conf.',             'number',   12),
      c('quantite',               'Qté',                  'number',    8),
    ],
    example: {
      zone: 'Entrée', piece: 'Mur nord', largeur: 350, hauteur: 250,
      tissu_1: 'Toile de Jouy', laize_tissu_1: 140, quantite: 1,
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers de parsing
// ---------------------------------------------------------------------------

function parseStatus(raw) {
  if (!raw) return 'TODO';
  return STATUS_MAP[(raw + '').toLowerCase().trim()] || 'TODO';
}

function parseType(raw) {
  if (!raw) return null;
  const s = (raw + '').toLowerCase().trim();
  if (s === 'installation') return 'installation';
  if (s === 'livraison') return 'livraison';
  return null;
}

function isOui(raw) {
  if (!raw) return false;
  const s = (raw + '').toLowerCase().trim();
  return s === 'oui' || s === 'yes' || s === 'x' || s === '1' || s === 'true';
}

function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const s = (raw + '').trim();
  if (!s) return null;
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return s;
}

function parseHours(raw) {
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : Math.max(0, n);
}

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------

export async function parseProjectsFromExcel(file) {
  // 1. Lire la feuille "Projets" (feuille 1)
  const rows = await readXlsxFile(file);
  if (!rows || rows.length < 2) return [];

  const headerRow = rows[0].map(h => (h == null ? '' : h.toString().trim()));
  const colIndex = {};
  ALL_COLUMNS.forEach(col => {
    const idx = headerRow.findIndex(h => h.toLowerCase() === col.toLowerCase());
    colIndex[col] = idx;
  });

  const projects = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const get = (col) => {
      const idx = colIndex[col];
      return idx >= 0 ? row[idx] : null;
    };

    const name = (get('Nom projet') || '').toString().trim();
    if (!name) continue;

    // Rétrocompat : lignes depuis Oui/Non si pas de feuilles produits
    const rows_data = MODULES
      .filter(m => isOui(get(m.col)))
      .map(m => ({ id: uid(), produit: m.produit, zone: '', piece: '', quantite: 1 }));

    projects.push({
      id: uid(),
      name,
      manager: (get('Responsable') || '').toString().trim(),
      status: parseStatus(get('Statut')),
      intervention_type: parseType(get('Type')),
      due: parseDate(get('Date livraison')),
      location: (get('Lieu') || '').toString().trim(),
      budget: {
        prepa: parseHours(get('H. Prépa allouées')),
        conf:  parseHours(get('H. Conf allouées')),
        pose:  parseHours(get('H. Pose allouées')),
      },
      consumed_import: {
        prepa: parseHours(get('H. Prépa consommées')),
        conf:  parseHours(get('H. Conf consommées')),
        pose:  parseHours(get('H. Pose consommées')),
      },
      rows: rows_data,
      created_at: new Date().toISOString(),
    });
  }

  if (projects.length === 0) return [];

  // 2. Tenter de lire les feuilles produits (nouveau format multi-feuilles)
  //    Toutes les lignes produits sont associées au premier projet du fichier.
  const productRows = [];
  for (const sheet of PRODUCT_SHEETS) {
    let sheetRows;
    try {
      sheetRows = await readXlsxFile(file, { sheet: sheet.name });
    } catch {
      continue; // feuille absente → on passe
    }
    if (!sheetRows || sheetRows.length < 2) continue;

    const header = sheetRows[0].map(h => (h == null ? '' : h.toString().trim()));

    // Index colonne par label (insensible à la casse)
    const sheetColIndex = {};
    sheet.columns.forEach(col => {
      const idx = header.findIndex(h => h.toLowerCase() === col.label.toLowerCase());
      sheetColIndex[col.key] = idx;
    });

    for (let i = 1; i < sheetRows.length; i++) {
      const r = sheetRows[i];
      const get = (key) => {
        const idx = sheetColIndex[key];
        return idx >= 0 ? r[idx] : null;
      };

      // Ignorer les lignes vides
      const zone  = (get('zone')  ?? '').toString().trim();
      const piece = (get('piece') ?? '').toString().trim();
      if (!zone && !piece) continue;

      const rowObj = {
        id: uid(),
        produit: (get('produit') ?? sheet.produit).toString().trim(),
      };

      // N'importer que les champs éditables (pas les calculés)
      sheet.columns.forEach(col => {
        if (col.computed) return;      // champ calculé → ignoré, recalculé en app
        if (col.key === 'produit') return; // déjà géré
        const val = get(col.key);
        if (val == null) return;
        if (col.type === 'number') {
          const n = parseFloat(val);
          if (!isNaN(n)) rowObj[col.key] = n;
        } else {
          const s = val.toString().trim();
          if (s) rowObj[col.key] = s;
        }
      });

      productRows.push(rowObj);
    }
  }

  // Si des feuilles produits ont été trouvées → elles remplacent les lignes Oui/Non
  if (productRows.length > 0) {
    projects[0].rows = productRows;
  }

  return projects;
}

// ---------------------------------------------------------------------------
// Helpers template
// ---------------------------------------------------------------------------

function addDropdown(ws, colLetter, fromRow, toRow, values) {
  for (let r = fromRow; r <= toRow; r++) {
    ws.getCell(`${colLetter}${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${values.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Valeur invalide',
      error: `Choisir parmi : ${values.join(', ')}`,
    };
  }
}

const colLetter = (n) => {
  let s = '';
  while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

// ---------------------------------------------------------------------------
// Génération du template
// ---------------------------------------------------------------------------

export async function downloadProjectsTemplate(users = []) {
  const { default: ExcelJS } = await import('exceljs');
  const responsables = users.length > 0
    ? users
        .filter(u => u.first_name && ALLOWED_FIRST_NAMES.includes(u.first_name))
        .map(u => u.name)
        .filter(Boolean)
    : RESPONSABLES_FALLBACK;
  const finalResponsables = responsables.length > 0 ? responsables : RESPONSABLES_FALLBACK;
  const wb = new ExcelJS.Workbook();

  // ---- Feuille 1 : Projets (inchangée) ------------------------------------
  const ws = wb.addWorksheet('Projets');

  const baseColDefs = BASE_COLUMNS.map(col => ({ header: col, key: col, width: Math.max(col.length + 6, 14) }));
  const moduleColDefs = MODULES.map(m => ({ header: m.col, key: m.col, width: Math.max(m.col.length + 4, 12) }));
  ws.columns = [...baseColDefs, ...moduleColDefs];

  ws.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2447' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws.getRow(1).height = 22;

  const moduleStartIdx = BASE_COLUMNS.length + 1;
  for (let c2 = moduleStartIdx; c2 < moduleStartIdx + MODULES.length; c2++) {
    ws.getRow(1).getCell(c2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D4A6B' } };
  }

  ws.addRow({
    'Nom projet': 'Appartement Martin',
    'Responsable': finalResponsables[0] || '',
    'Statut': 'En cours',
    'Type': 'Livraison',
    'Date livraison': '30/06/2025',
    'H. Prépa allouées': 8,
    'H. Conf allouées': 40,
    'H. Pose allouées': 6,
    'H. Prépa consommées': 0,
    'H. Conf consommées': 0,
    'H. Pose consommées': 0,
    'Lieu': 'Paris 8e',
    'Rideau': 'Oui',
    'Voilage': 'Non',
    'Store Bateau': 'Oui',
    'Store Classique': 'Non',
    'Tenture Murale': 'Non',
    'Cache-Sommier': 'Non',
    'Coussin': 'Non',
    'Plaid': 'Non',
    'Tête de lit': 'Non',
  });

  const MAX_ROWS = 100;
  addDropdown(ws, colLetter(2), 2, MAX_ROWS, finalResponsables);
  addDropdown(ws, colLetter(3), 2, MAX_ROWS, STATUTS);
  addDropdown(ws, colLetter(4), 2, MAX_ROWS, TYPES_INTERVENTION);
  for (let i = 0; i < MODULES.length; i++) {
    addDropdown(ws, colLetter(moduleStartIdx + i), 2, MAX_ROWS, ['Oui', 'Non']);
  }

  // ---- Feuilles produits ---------------------------------------------------
  const MAX_PROD_ROWS = 200;
  const COLOR_COMPUTED_HEADER = 'FF9E9E9E'; // gris pour colonnes calculées
  const COLOR_COMPUTED_CELL   = 'FFF5F5F5'; // gris très clair pour cellules calculées
  const COLOR_EXAMPLE_CELL    = 'FFFFF9E7'; // jaune très clair pour ligne exemple

  for (const sheet of PRODUCT_SHEETS) {
    const ws2 = wb.addWorksheet(sheet.name);

    ws2.columns = sheet.columns.map(col => ({
      header: col.label,
      key: col.key,
      width: col.width || 16,
    }));

    // Style header : coloré si éditable, gris si calculé
    sheet.columns.forEach((col, idx) => {
      const cell = ws2.getRow(1).getCell(idx + 1);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: col.computed ? COLOR_COMPUTED_HEADER : sheet.color },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
      if (col.computed) {
        cell.note = 'Champ calculé automatiquement par l\'application après import';
      }
    });
    ws2.getRow(1).height = 22;

    // Ligne d'exemple
    ws2.addRow(sheet.example);
    sheet.columns.forEach((col, idx) => {
      const cell = ws2.getRow(2).getCell(idx + 1);
      cell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: col.computed ? COLOR_COMPUTED_CELL : COLOR_EXAMPLE_CELL },
      };
    });

    // Dropdowns (uniquement sur colonnes éditables de type select)
    sheet.columns.forEach((col, colIdx) => {
      if (!col.computed && col.type === 'select' && col.options?.length) {
        addDropdown(ws2, colLetter(colIdx + 1), 2, MAX_PROD_ROWS, col.options);
      }
    });
  }

  // ---- Export -------------------------------------------------------------
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template_import_projets.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
