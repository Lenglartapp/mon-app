// src/lib/data/production.demo.js

import { uid } from "../utils/uid.js";

export const DEMO_MASTER_ROWS = [
  { id: uid(), produit: "Rideau", zone: "1er étage", piece: "Chambre", type_confection: "Wave 60", pair_un: "Paire", ampleur: 1.8, largeur: 161, hauteur: 250, l_mecanisme: 165, f_bas: 2, croisement: 4, retour_g: 3, retour_d: 3, val_ded_rail: 0, val_ourlet_cote: 15, val_ourlet_haut: 8, onglet: "oui" },
  { id: uid(), produit: "Décor de lit", zone: "1er étage", piece: "Chambre", type_confection: "A plat", pair_un: "Un seul pan", ampleur: 1.6, largeur: 140, hauteur: 240, l_mecanisme: 150, f_bas: 1, croisement: 0, retour_g: 2, retour_d: 2, val_ded_rail: 0, val_ourlet_cote: 15, val_ourlet_haut: 8, onglet: "non" },
  { id: uid(), produit: "Store Bateau", zone: "RDC", piece: "Salon", type_confection: "A plat", pair_un: "Un seul pan", ampleur: 1.0, largeur: 130, hauteur: 220, l_mecanisme: 130, f_bas: 0, croisement: 0, retour_g: 0, retour_d: 0, val_ded_rail: 5, val_ourlet_cote: 10, val_ourlet_haut: 6, onglet: "non" },
];