import { uid } from "../utils/uid";

export const DEMO_PROJECTS = [
  { id: uid(), name: "CHASSE",       due: "2025-08-28", manager: "Thomas BONNET", status: "En cours",  notes: "Ok pour prise.." },
  { id: uid(), name: "APPART DENIS", due: "2025-07-21", manager: "Thomas BONNET", status: "Terminé",  notes: "A voir pour ris.." },
  { id: uid(), name: "HOTEL ST JEAN",due: "2025-05-11", manager: "Thomas BONNET", status: "En cours",  notes: "Ok pour prise.." },
];

export const ETIQUETTES_DEFAULTS = {
  layout: { density: "normal", columnsScreen: 2, columnsPrint: 2, onePerPage: true }
};

export const DEMO_MINUTES = [
  {
    id: uid(), name: "Minute - Projet Démo", client: "Client Démo", version: 1, notes: "Brouillon",
    lines: [
      { id: uid(), produit:"Rideau", zone:"RDC", piece:"Salon", type_confection:"Wave 60", pair_un:"Paire",
        statut_cotes:"côtes sur plans", l_mecanisme:160, largeur:150, hauteur:250, retour_g:3, retour_d:3, type_pose:"Plafond",
        commentaire_minute:"Prévoir doublure", qty:1, prix_unitaire:0 },
      { id: uid(), produit:"Store Bateau", zone:"Étage", piece:"Chambre", type_confection:"A plat", pair_un:"Un seul pan",
        statut_cotes:"pas prises", l_mecanisme:120, largeur:110, hauteur:180, retour_g:0, retour_d:0, type_pose:"Mur",
        commentaire_minute:"", qty:2, prix_unitaire:0 },
    ]
  }
];

export function mapMinuteLinesToProductionRows(lines) {
  return (lines || []).map((m) => ({
    id: uid(),
    produit: m.produit ?? "", zone: m.zone ?? "", piece: m.piece ?? "",
    type_confection: m.type_confection ?? "", pair_un: m.pair_un ?? "",
    statut_cotes: m.statut_cotes ?? "", l_mecanisme: m.l_mecanisme ?? "",
    largeur: m.largeur ?? "", hauteur: m.hauteur ?? "",
    retour_g: m.retour_g ?? "", retour_d: m.retour_d ?? "", type_pose: m.type_pose ?? "",
    commentaire_confection: m.commentaire_minute ?? "",
    envers_visible:"", ampleur:"", f_bas:"", croisement:"",
    type_rail:"", couleur_rail:"", nom_tringle:"", diametre_tringle:"",
    couv_mecanisme:"", supp_mecanisme:"", val_ded_rail:"", val_ourlet_cote:"", val_ourlet_haut:"",
    photo:[], sel:false,
  }));
}