// src/App.jsx — v5.3 (COMPLET, FIXED)
// ✅ Correctifs et fonctionnalités
// - Corrige "Unterminated string constant" (toutes les chaînes et \n correctement échappés)
// - Corrige tout `return` hors fonction
// - Accueil → Liste des dossiers → Projet (3 tableaux : Rideaux / Décors / Stores)
// - Bouton + : ajoute une ligne et scroll auto
// - ⚙️ Colonnes (popover) : cocher/décocher, Tout/Rien, persistance par vue/tableau
// - Édition de champ depuis l'en-tête (mini modal) — label/type/options/formule/lecture seule/largeur
// - Formules ({cle} + IF/ROUND/MIN/MAX/ROUNDUP) évaluées automatiquement
// - Modal Détail de ligne (formulaire complet) avec Enregistrer
// - Largeur pleine avec marges symétriques 24px
// - 58 champs (dont formules clés)

import React, { useEffect, useMemo, useRef, useState, createContext, useContext } from "react";
import {
  PencilRuler, Database, Boxes, GanttChart,
  Plus, Filter, Layers3, Star, Settings2, Search,
  ChevronUp, ChevronDown, Edit3, ChevronRight, X, MoreVertical,
  Trash2, Copy
} from "lucide-react";
import { AuthProvider, useAuth } from "./auth";

// --- Utils (globaux au fichier) ---
 export function slugParamName(raw = "") {
   return String(raw)
     .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // retire les accents
     .toLowerCase()
     .trim()
     .replace(/\s+/g, "_")                              // espaces -> _
     .replace(/[^a-z0-9_]/g, "_");                      // nettoie le reste
 }

// =============== Thème & Styles ===============
const COLORS = { page: "#FAF5EE", tile: "#1E2447", text: "#111827", border: "#E5E7EB", rowAlt: "#F9FAFB" };
const S = {
  page: { minHeight: "100vh", width: "100%", background: COLORS.page, display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 40px" },
  brandBtn: { display: "flex", alignItems: "center", gap: 14, cursor: "pointer", background: "transparent", border: "none" },
  logoText: { fontWeight: 900, letterSpacing: 3, background: "#000", color: "#fff", padding: "8px 14px", borderRadius: 6 },
  userBtn: { display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: "transparent", border: "none" },
  avatarBox: { width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "#000", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700 },

  contentWrap: { width: "min(1200px, 96vw)", margin: "0 auto", padding: "8px 24px 24px" },
  contentWide: { width: "100%", margin: "0 auto", padding: "8px 24px 24px" }, // marges 24px à gauche/droite

  mainCenter: { flex: 1, display: "grid", placeItems: "center" },
  appsWrap: { width: "min(1200px, 96vw)" },
  appsBase: { display: "grid", justifyItems: "center" },
  appBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, cursor: "pointer", background: "transparent", border: "none" },
  tileBase: { borderRadius: 16, background: COLORS.tile, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px rgba(0,0,0,.15)" },
  label: { fontWeight: 800, fontSize: 16.5, letterSpacing: 0.2, color: COLORS.text },

  pills: { display: "flex", gap: 12, flexWrap: "wrap", padding: "8px 0 16px" },
  pill: (active) => ({ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 999, border: `1px solid ${COLORS.border}`, background: active ? COLORS.tile : "#fff", color: active ? "#fff" : COLORS.text, cursor: "pointer" }),

  searchRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center", marginBottom: 10 },
  searchBox: { position: "relative" },
  searchInput: { padding: "12px 12px 10px 38px", border: "none", borderBottom: `2px solid ${COLORS.text}20`, outline: "none", background: "transparent", fontSize: 16 },
  toolsRow: { display: "flex", gap: 14, alignItems: "center", color: COLORS.text, flexWrap: "wrap" },
  toolBtn: { display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" },

  tableBlock: { background: "#fff", borderRadius: 16, border: `1px solid ${COLORS.border}`, marginTop: 18, overflow: "visible" },  tableHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, gap: 10, flexWrap: "wrap" },
  tableTitle: { fontWeight: 900 },
  tableRight: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  tableWrap: { overflowX: "auto", maxWidth: "100%" },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${COLORS.border}`, background: "#F3F4F6", position: "sticky", top: 0, zIndex: 1 },
  thHead: { display: "flex", alignItems: "center", gap: 8 },
  td: { padding: 8, borderBottom: `1px solid ${COLORS.border}` },
  trAlt: { background: COLORS.rowAlt },
  smallBtn: { padding: "6px 10px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: "#fff", cursor: "pointer" },

  pop: { position: "absolute", top: "100%", right: 0, width: 320, maxHeight: "70vh", overflow: "auto", background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, boxShadow: "0 12px 28px rgba(0,0,0,.18)", zIndex: 60 },  modalBg: { position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 80 },
  modal: { width: "min(880px, 96vw)", maxHeight: "86vh", overflow: "hidden", background: "#fff", borderRadius: 16, boxShadow: "0 22px 48px rgba(0,0,0,.22)" },
  modalHead: { padding: 14, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" },
  modalBody: { padding: 14, maxHeight: "70vh", overflow: "auto" },
  modalRow: { display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center", padding: "8px 0" },
  listSidebar: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    background: "#fff",
    padding: 10,
    maxHeight: "75vh",
    overflow: "auto",
  },

  listItem: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    background: "#fff",
    padding: 10,
    cursor: "pointer",
  },

  smallIconBtn: {
    border: `1px solid ${COLORS.border}`,
    background: "#fff",
    borderRadius: 8,
    padding: "2px 6px",
    fontSize: 12,
    cursor: "pointer",
  },
};
// --- densité compacte table
S.tableCompact = { fontSize: 13 };
S.th = { ...S.th, padding: "6px 8px" };
S.td = { ...S.td, padding: "6px 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };


S.btn = { padding: "10px 14px", borderRadius: 12, border: `1px solid ${COLORS.border}`, background: "#fff", cursor: "pointer" };
// --- Étiquettes (cartes + toolbar)
S.etqToolbar = { display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" };
S.cardsWrap  = { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px,1fr))", gap:16, padding:"10px 12px 18px" };
S.card       = { border:"2px solid #1F2937", borderRadius:16, background:"#fff", padding:"14px 14px 10px" };
S.cardRow    = { display:"grid", gridTemplateColumns:"110px 1fr", gap:8, alignItems:"baseline", margin:"4px 0" };
S.cardLabel  = { fontWeight:700 };

// =============== Hooks & utils ===============
function useViewportWidth(){ const [w,setW]=useState(typeof window!=="undefined"?window.innerWidth:1200); useEffect(()=>{ const f=()=>setW(window.innerWidth); window.addEventListener("resize",f); return ()=>window.removeEventListener("resize",f);},[]); return w; }
function useLocalStorage(key, initial){ const [state,setState]=useState(()=>{ try{ const s=localStorage.getItem(key); return s?JSON.parse(s):initial;}catch{ return initial; } }); useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(state)); }catch{} },[key,state]); return [state,setState]; }
const uid = ()=> Math.random().toString(36).slice(2,9);
const truncate = (s,n)=>{ s=String(s||""); return s.length>n? s.slice(0,n)+".." : s; };
const toNumber = (v)=>{ if(typeof v==="number") return Number.isFinite(v)?v:0; const n=parseFloat(String(v||"").replace(",",".")); return Number.isFinite(n)? n : 0; };
const norm = (s)=> String(s||"").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const formatDateFR=(iso)=>{ if(!iso) return ""; const [y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; };

// ===== Chiffrage — helpers minute =====
const makeEmptyMinute = () => ({
  id: uid(),
  name: "Minute - Nouveau",
  client: "",
  notes: "",
  version: 1,
  lines: [],              // tu rempliras plus tard selon ton modèle
  updatedAt: Date.now(),
});

const makeDemoMinute = () => ({
  id: uid(),
  name: "Minute - Projet Démo",
  client: "Client Démo",
  notes: "Brouillon",
  version: 1,
  lines: [{ id: uid(), zone: "Étage", piece: "Chambre", produit: "Store Bateau" }],
  updatedAt: Date.now(),
});



// =============== Démo dossiers ===============

const DEMO_PROJECTS = [
  { id: uid(), name: "CHASSE",       due: "2025-08-28", manager: "Thomas BONNET", status: "En cours",  notes: "Ok pour prise.." },
  { id: uid(), name: "APPART DENIS", due: "2025-07-21", manager: "Thomas BONNET", status: "Terminé",  notes: "A voir pour ris.." },
  { id: uid(), name: "HOTEL ST JEAN",due: "2025-05-11", manager: "Thomas BONNET", status: "En cours",  notes: "Ok pour prise.." },
];

// =============== 64 colonnes ===============
const SCHEMA_64 = [
  { key: "sel", label: "Sel.", type: "checkbox", width: 60 },
  { key: "detail", label: "Détail", type: "button", width: 100 },
  { key: "zone", label: "Zone", type: "text", width: 120 },
  { key: "piece", label: "Pièce", type: "text", width: 120 },
  { key: "produit", label: "Produit", type: "select", options: ["Rideau","Voilage","Store Bateau","Store Enrouleur","Store Vénitien","Cache Sommier","Coussin","Décor de lit","Autres"], width: 140 },
  { key: "type_confection", label: "Type de confection", type: "select", options: ["Wave 80","Wave 60","Couteau","Flamand","Triplis","Creux","Taylor","Tuyaux d'orgue","Plat","A plat"], width: 160 },
  { key: "pair_un", label: "Paire / Un seul pan", type: "select", options: ["Paire","Un seul pan"], width: 150 },
  { key: "ampleur", label: "Ampleur", type: "number", precision: 2, width: 90 },
  { key: "l_mecanisme", label: "Largeur mécanisme", type: "number", width: 150 },
  { key: "largeur", label: "Largeur", type: "number", width: 110 },
  { key: "hauteur", label: "Hauteur", type: "number", width: 110 },
  { key: "statut_cotes", label: "Statut Cotes", type: "select", options: ["Pas prises","Côtes sur plans","Côtes approximatives","Côtes définitives"], width: 180 },
  { key: "f_bas", label: "Finition bas", type: "number", width: 120 },
  { key: "croisement", label: "Croisement", type: "number", width: 120 },
  { key: "retour_g", label: "Retour Gauche", type: "number", width: 130 },
  { key: "retour_d", label: "Retour Droit", type: "number", width: 120 },
  { key: "envers_visible", label: "Envers visible", type: "select", options: ["Oui","Non"], width: 120 },
  { key: "double", label: "Doublé", type: "select", options: ["Oui","Non"], width: 100 },
  { key: "h_tete", label: "Hauteur de tête", type: "number", width: 130 },
  { key: "type_rail", label: "Type de rail", type: "select", options: ["Kontrak","Projekt","Tekno","Mini","Separa 20mm","Separa 28mm","Tringle 40mm","Tringle 31mm","Free"], width: 160 },
  { key: "couleur_rail", label: "Couleur rail", type: "text", width: 140 },
  { key: "nom_tringle", label: "Nom Tringle", type: "text", width: 160 },
  { key: "diametre_tringle", label: "Diamètre Tringle", type: "select", options: ["2,5","2,8","3,1","3,3","3,5","4","5"], width: 150 },
  { key: "couv_mecanisme", label: "Couverture mécanisme", type: "select", options: ["Couvert","MiCouvert","Découvert"], width: 170 },
  { key: "supp_mecanisme", label: "Support mécanisme", type: "text", width: 180 },
  { key: "nb_glisseurs", label: "Nombre de glisseur/anneaux", type: "formula", formula: "ROUND({l_mecanisme}/10 + 2, 0)", width: 200, readOnly: true },
  { key: "type_pose", label: "Type de pose", type: "text", width: 140 },
  { key: "statut_preparation", label: "Statut Préparation", type: "select", options: ["No go","Go","Commencé","Terminé"], width: 180 },
  { key: "statut_pose", label: "Statut Pose", type: "select", options: ["No go","Go","Commencé","A parfaire","Terminé","Reprise"], width: 160 },
  { key: "val_ded_rail", label: "Valeur déduction rail", type: "number", width: 170 },
  { key: "h_finie", label: "Hauteur finie", type: "formula", formula: "{hauteur} - {val_ded_rail} + {f_bas}", width: 140, readOnly: true },
  { key: "l_finie", label: "Largeur finie", type: "formula", formula: "IF({pair_un}=='Paire', {largeur}/2 + 10 + {retour_g}+{retour_d}+{croisement}, {largeur} + 10 + {retour_g}+{retour_d}+{croisement})", width: 150, readOnly: true },
  { key: "a_plat", label: "A plat", type: "formula", formula: "({l_finie}*{ampleur})+({val_ourlet_cote}*4)", width: 140, readOnly: true },
  { key: "val_ourlet_cote", label: "Valeur ourlet de côté", type: "number", width: 160 },
  { key: "val_ourlet_haut", label: "Valeur ourlet haut", type: "number", width: 160 },
  { key: "piquage_bas", label: "Piquage ourlet du bas", type: "text", width: 160 },
  { key: "f_bas_type", label: "Finition ourlet du bas", type: "text", width: 160 },
  { key: "poids", label: "Poids", type: "number", width: 120 },
  { key: "onglet", label: "Onglet", type: "select", options: ["oui","non"], width: 100 },
  { key: "commentaire_confection", label: "Commentaire confection", type: "text", width: 220 },
  { key: "tissu_deco1", label: "Tissu Déco 1", type: "text", width: 160 },
  { key: "laize_tissu_deco1", label: "Laize Tissu Déco 1", type: "number", width: 160 },
  { key: "motif_deco1", label: "Motif Déco 1", type: "select", options: ["oui","non"], width: 120 },
  { key: "raccord_v1", label: "Raccord Vertical 1", type: "number", width: 150 },
  { key: "raccord_h1", label: "Raccord Horizontal 1", type: "number", width: 150 },
  { key: "tissu_deco2", label: "Tissu Déco 2", type: "text", width: 160 },
  { key: "laize_tissu_deco2", label: "Laize Tissu Déco 2", type: "number", width: 160 },
  { key: "motif_deco2", label: "Motif Déco 2", type: "select", options: ["oui","non"], width: 120 },
  { key: "raccord_v2", label: "Raccord Vertical 2", type: "number", width: 150 },
  { key: "raccord_h2", label: "Raccord Horizontal 2", type: "number", width: 150 },
  { key: "passementerie1", label: "Passementerie 1", type: "text", width: 150 },
  { key: "app_passementerie1", label: "Application Passementerie 1", type: "text", width: 200 },
  { key: "passementerie2", label: "Passementerie 2", type: "text", width: 150 },
  { key: "app_passementerie2", label: "Application Passementerie 2", type: "text", width: 200 },
  { key: "doublure", label: "Doublure", type: "text", width: 120 },
  { key: "laize_doublure", label: "Laize Doublure", type: "number", width: 140 },
  { key: "inter_doublure", label: "Interdoublure", type: "text", width: 140 },
  { key: "laize_inter", label: "Laize Interdoublure", type: "number", width: 160 },
  { key: "h_coupe_tissu", label: "Hauteur de coupe tissu", type: "formula", formula: "{h_finie} + ({val_ourlet_cote}*2) + ({h_tete}*2) + 10", width: 200, readOnly: true },
  { key: "h_coupe_tissu_motif", label: "Hauteur de coupe tissu motif", type: "formula", formula: "ROUND({h_coupe_tissu}/{raccord_v1},0)*{raccord_v1}", width: 240, readOnly: true },
  { key: "h_coupe_doublure", label: "Hauteur de coupe Doublure", type: "formula", formula: "IF({h_coupe_tissu}<280, {a_plat}, {h_coupe_tissu})", width: 220, readOnly: true },
  { key: "nb_les", label: "A plat / Laize tissu déco 1 (nb lés)", type: "formula", formula: "MAX(1,ROUNDUP({a_plat}/{laize_tissu_deco1},0))", width: 260, readOnly: true },
  { key: "statut_confection", label: "Statut Confection", type: "select", options: ["No go","Go","Coupé","Terminé","Reprise"], width: 180 },
  { key: "heures_confection", label: "Heures confection", type: "number", width: 150 },
  { key: "heures_pose",       label: "Heures pose",       type: "number", width: 130 },
  { key: "photo", label: "Photo prise sur site", type: "photo", width: 200 },
];

// === CHIFFRAGE_SCHEMA — Minutes (communs + spécifiques chiffrage) ===
const CHIFFRAGE_SCHEMA = [
  // Sélection / navigation
  { key: "sel",    label: "Sel.",    type: "checkbox", width: 60 },
  { key: "detail", label: "Détail",  type: "button",   width: 100 },

  // Identité / localisation
  { key: "zone",   label: "Zone",    type: "text",   width: 120 },
  { key: "piece",  label: "Pièce",   type: "text",   width: 120 },

  // Produit & confection
  { key: "produit", label: "Produit", type: "select",
    options: ["Rideau","Voilage","Store Bateau","Store Enrouleur","Store Vénitien","Cache Sommier","Coussin","Décor de lit","Autres"],
    width: 160
  },
  { key: "type_confection", label: "Type de confection", type: "select",
    options: ["Wave 80","Wave 60","Couteau","Flamand","Triplis","Creux","Taylor","Tuyaux d'orgue","Plat","A plat"],
    width: 180
  },
  { key: "pair_un", label: "Paire / Un seul pan", type: "select",
    options: ["Paire","Un seul pan"], width: 150
  },
  { key: "ampleur", label: "Ampleur", type: "number", precision: 2, width: 90 },

  // Cotes & géométrie
  { key: "l_mecanisme", label: "Largeur mécanisme", type: "number", width: 150 },
  { key: "largeur",     label: "Largeur",           type: "number", width: 110 },
  { key: "hauteur",     label: "Hauteur",           type: "number", width: 110 },
  { key: "hauteur_coupe_minutes", label: "H. coupe (min.)", type: "formula",
    formula: "hauteur + 50", width: 140
  },
  { key: "a_plat",     label: "À plat",     type: "formula", formula: "largeur * ampleur", width: 140 },
  { key: "croisement", label: "Croisement", type: "number", width: 120 },
  { key: "retour_g",   label: "Retour Gauche", type: "number", width: 130 },
  { key: "retour_d",   label: "Retour Droit",  type: "number", width: 130 },

  // Options pièce / rendu
  { key: "envers_visible", label: "Envers visible", type: "checkbox", width: 120 },
  { key: "double",         label: "Double",         type: "checkbox", width: 100 },

  // Tissus & raccords — Déco 1
  { key: "tissu_deco1",       label: "Tissu Déco 1",       type: "text",   width: 160 },
  { key: "laize_tissu_deco1", label: "Laize Déco 1",       type: "number", width: 140 },
  { key: "motif_deco1",       label: "Motif Déco 1",       type: "text",   width: 140 },
  { key: "raccord_v1",        label: "Raccord V1",         type: "number", width: 130 },
  { key: "raccord_h1",        label: "Raccord H1",         type: "number", width: 130 },
  { key: "ml_tissu_deco1",    label: "ML Déco 1",          type: "formula",
    // si laize > H. coupe : (a_plat + croisement + retour_g + retour_d)/100
    // sinon : ceil((a_plat + croisement + retour_g + retour_d)/laize) * (hauteur_coupe_minutes/100)
    formula: "IF(laize_tissu_deco1 > hauteur_coupe_minutes, (a_plat + croisement + retour_g + retour_d)/100, CEIL((a_plat + croisement + retour_g + retour_d)/laize_tissu_deco1) * (hauteur_coupe_minutes/100))",
    width: 200
  },
  { key: "pa_tissu_deco1",    label: "PA Déco 1",          type: "number", width: 120 },
  { key: "pv_tissu_deco1",    label: "PV Déco 1",          type: "number", width: 120 },

  // Tissus & raccords — Déco 2
  { key: "tissu_deco2",       label: "Tissu Déco 2",       type: "text",   width: 160 },
  { key: "laize_tissu_deco2", label: "Laize Déco 2",       type: "number", width: 140 },
  { key: "motif_deco2",       label: "Motif Déco 2",       type: "text",   width: 140 },
  { key: "raccord_v2",        label: "Raccord V2",         type: "number", width: 130 },
  { key: "raccord_h2",        label: "Raccord H2",         type: "number", width: 130 },
  { key: "ml_tissu_deco2",    label: "ML Déco 2",          type: "formula",
    formula: "IF(laize_tissu_deco2 > hauteur_coupe_minutes, (a_plat + croisement + retour_g + retour_d)/100, CEIL((a_plat + croisement + retour_g + retour_d)/laize_tissu_deco2) * (hauteur_coupe_minutes/100))",
    width: 200
  },
  { key: "pa_tissu_deco2",    label: "PA Déco 2",          type: "number", width: 120 },
  { key: "pv_tissu_deco2",    label: "PV Déco 2",          type: "number", width: 120 },

  // Passementeries
  { key: "passementerie1",     label: "Passementerie 1",     type: "text",   width: 160 },
  { key: "app_passementerie1", label: "Application Passementerie 1", type: "text", width: 200 },
  { key: "ml_passementerie1",  label: "ML Passementerie 1",  type: "number", width: 160 },
  { key: "pa_passementerie1",  label: "PA Passementerie 1",  type: "number", width: 160 },
  { key: "pv_passementerie1",  label: "PV Passementerie 1",  type: "number", width: 160 },

  { key: "passementerie2",     label: "Passementerie 2",     type: "text",   width: 160 },
  { key: "app_passementerie2", label: "Application Passementerie 2", type: "text", width: 200 },
  { key: "ml_passementerie2",  label: "ML Passementerie 2",  type: "number", width: 160 },
  { key: "pa_passementerie2",  label: "PA Passementerie 2",  type: "number", width: 160 },

  // Doublure
  { key: "doublure",       label: "Doublure",       type: "text",   width: 150 },
  { key: "laize_doublure", label: "Laize Doublure", type: "number", width: 150 },
  { key: "ml_doublure",    label: "ML Doublure",    type: "formula",
    formula: "IF(laize_doublure > hauteur_coupe_minutes, (a_plat + croisement + retour_g + retour_d)/100, CEIL((a_plat + croisement + retour_g + retour_d)/laize_doublure) * (hauteur_coupe_minutes/100))",
    width: 200
  },
  { key: "pa_doublure",    label: "PA Doublure",    type: "number", width: 140 },
  { key: "pv_doublure",    label: "PV Doublure",    type: "number", width: 140 },

  // Inter-doublure
  { key: "inter_doublure", label: "Inter Doublure", type: "text",   width: 150 },
  { key: "laize_inter",    label: "Laize Inter",    type: "number", width: 150 },
  { key: "ml_inter",       label: "ML Inter",       type: "formula",
    formula: "IF(laize_inter > hauteur_coupe_minutes, (a_plat + croisement + retour_g + retour_d)/100, CEIL((a_plat + croisement + retour_g + retour_d)/laize_inter) * (hauteur_coupe_minutes/100))",
    width: 200
  },
  { key: "pa_inter",       label: "PA Inter",       type: "number", width: 140 },
  { key: "pv_inter",       label: "PV Inter",       type: "number", width: 140 },

  // Rail / tringle / mécanisme
  { key: "type_rail",        label: "Type Rail",        type: "select", options: ["Rail","Tringle"], width: 120 },
  { key: "nom_tringle",      label: "Nom Tringle",      type: "text",   width: 140 },
  { key: "diametre_tringle", label: "Diamètre Tringle", type: "number", width: 140 },
  { key: "supp_mecanisme",   label: "Supplément mécanisme", type: "checkbox", width: 170 },
  { key: "pa_meca",          label: "PA Mécanisme",     type: "number", width: 140 },
  { key: "pv_meca",          label: "PV Mécanisme",     type: "number", width: 140 },

  // Prépa / pose / confection (valorisations)
  { key: "heures_prepa",     label: "Heures Prépa",     type: "number", width: 140 },
  { key: "pv_prepa",         label: "PV Prépa",         type: "number", width: 130 },
  { key: "type_pose",        label: "Type de pose",     type: "select", options: ["Murale","Plafond","Encastré"], width: 140 },
  { key: "heures_pose",      label: "Heures Pose",      type: "number", width: 140 },
  { key: "pv_pose",          label: "PV Pose",          type: "number", width: 120 },
  { key: "heures_confection",label: "Heures Confection",type: "number", width: 160 },
  { key: "pv_confection",    label: "PV Confection",    type: "number", width: 140 },

  // Frais / prix
  { key: "livraison",     label: "Livraison",     type: "number", width: 120 },
  { key: "prix_unitaire", label: "Prix Unitaire", type: "formula",
    // somme des PV composants + livraison
    formula: "NVL(pv_tissu_deco1,0)+NVL(pv_tissu_deco2,0)+NVL(pv_doublure,0)+NVL(pv_inter,0)+NVL(pv_meca,0)+NVL(pv_prepa,0)+NVL(pv_pose,0)+NVL(pv_confection,0)+NVL(livraison,0)",
    width: 160
  },
  { key: "quantite",     label: "Quantité",   type: "number",  width: 100 },
  { key: "prix_total",   label: "Prix Total", type: "formula", formula: "prix_unitaire * quantite", width: 140 },

  // Commentaires chiffrage
  { key: "commentaire_minute", label: "Commentaire", type: "text", width: 220 },
];


// ===== Schéma Minutes — Déplacement =====
const CHIFFRAGE_SCHEMA_DEP = [
  { key: "type_deplacement", label: "Type de Déplacement", type: "text", width: 180 },

  { key: "nb_techniciens", label: "Nombre de technicien", type: "number", width: 160 },
  { key: "duree_trajet_h", label: "Durée trajet (h)", type: "number", width: 150 },
  { key: "nb_nuits", label: "Nombre de nuit", type: "number", width: 140 },
  { key: "nb_repas", label: "Nombre de Repas", type: "number", width: 150 },

  // paramètres (temporairement en colonnes, on les cachera dans la vue par défaut)
  { key: "tauxhoraire", label: "Taux horaire", type: "number", width: 130 },
  { key: "prixhotel", label: "Prix hôtel (€/nuit)", type: "number", width: 160 },
  { key: "prixrepas", label: "Prix repas (€/repas)", type: "number", width: 160 },

  // coûts unitaires / dérivés
  { key: "transport_unitaire", label: "Transport € (unitaire)", type: "number", width: 180 },

  // formules
  { key: "pose_prix", label: "Pose €", type: "formula",
    formula: "nb_techniciens * duree_trajet_h * tauxhoraire", width: 120 },

  { key: "hotel_eur", label: "Hôtel €", type: "formula",
    formula: "nb_techniciens * nb_nuits * prixhotel", width: 120 },

  { key: "repas_eur", label: "Repas €", type: "formula",
    formula: "nb_techniciens * nb_repas * prixrepas", width: 120 },

  { key: "transport_eur", label: "Transport € (avion, train)", type: "formula",
    formula: "nb_techniciens * transport_unitaire", width: 190 },

  { key: "total_eur", label: "Total €", type: "formula",
    formula: "NVL(pose_prix,0) + NVL(hotel_eur,0) + NVL(repas_eur,0) + NVL(transport_eur,0)", width: 140 },
];


// ================== VUES PAR DÉFAUT ==================
export const DEFAULT_VIEWS = {
  // 1) BPF : on garde TOUT (pas de présélection → on retombe sur tout le schéma)
  //    Astuce : on met null pour forcer le fallback "toutes les colonnes du schema".
  bpf: {
    rideaux: null,
    decors:  null,
    stores:  null,
  },

  // 2) ÉTIQUETTES : on garde TOUT également (la sélection des champs reste libre),
  //    mais on va piloter la mise en page via ETIQUETTES_DEFAULTS ci-dessous.
  etiquettes: {
    rideaux: null,
    stores:  null,
  },

  // Minutes
  chiffrage: {
    minute: null, // null → “toutes les colonnes du schéma chiffrage”
  },

  // Minutes (vue par défaut utilisée par ChiffrageScreen → viewKey="minutes")
  minutes: {
    rideaux: [
      "sel","detail","zone","piece","produit","type_confection",
      "l_mecanisme","largeur","hauteur","hauteur_coupe_minutes",
      "pair_un","ampleur","a_plat","croisement","retour_g","retour_d",
      "envers_visible","double",
      "tissu_deco1","laize_tissu_deco1","motif_deco1","raccord_v1","raccord_h1",
      "ml_tissu_deco1","pa_tissu_deco1","pv_tissu_deco1",
      "doublure","laize_doublure","ml_doublure","pa_doublure","pv_doublure",
      "type_rail","nom_tringle","diametre_tringle","supp_mecanisme",
      "pa_meca","pv_meca",
      "heures_prepa","pv_prepa",
      "type_pose","heures_pose","pv_pose",
      "heures_confection","pv_confection",
      "livraison","prix_unitaire","quantite","prix_total"
    ],
    decors: [
      "sel","detail","zone","piece","produit","type_confection",
      "l_mecanisme","largeur","hauteur","hauteur_coupe_minutes",
      "pair_un","ampleur","a_plat","croisement","retour_g","retour_d",
      "envers_visible","double",
      "tissu_deco1","laize_tissu_deco1","motif_deco1","raccord_v1","raccord_h1",
      "ml_tissu_deco1","pa_tissu_deco1","pv_tissu_deco1",
      "doublure","laize_doublure","ml_doublure","pa_doublure","pv_doublure",
      "type_rail","nom_tringle","diametre_tringle","supp_mecanisme",
      "pa_meca","pv_meca",
      "heures_prepa","pv_prepa",
      "type_pose","heures_pose","pv_pose",
      "heures_confection","pv_confection",
      "livraison","prix_unitaire","quantite","prix_total"
    ],
    stores: [
      "sel","detail","zone","piece","produit","type_confection",
      "l_mecanisme","largeur","hauteur","hauteur_coupe_minutes",
      "pair_un","ampleur","a_plat","croisement","retour_g","retour_d",
      "envers_visible","double",
      "tissu_deco1","laize_tissu_deco1","motif_deco1","raccord_v1","raccord_h1",
      "ml_tissu_deco1","pa_tissu_deco1","pv_tissu_deco1",
      "doublure","laize_doublure","ml_doublure","pa_doublure","pv_doublure",
      "type_rail","nom_tringle","diametre_tringle","supp_mecanisme",
      "pa_meca","pv_meca",
      "heures_prepa","pv_prepa",
      "type_pose","heures_pose","pv_pose",
      "heures_confection","pv_confection",
      "livraison","prix_unitaire","quantite","prix_total"
    ],
  },

  // 3) PRISE DE COTES : 2 tableaux (rideaux / stores) avec la présélection demandée
  prise: {
    rideaux: [
      "sel","detail","zone","piece","produit","type_confection","pair_un","ampleur",
      "l_mecanisme","largeur","hauteur","statut_cotes",
      "f_bas","croisement","retour_g","retour_d",
      "envers_visible","type_rail","couleur_rail",
      "nom_tringle","diametre_tringle",
      "couv_mecanisme","supp_mecanisme","type_pose",
      "photo"
    ],
    stores: [
      "sel","detail","zone","piece","produit","type_confection","pair_un","ampleur",
      "l_mecanisme","largeur","hauteur","statut_cotes",
      "f_bas","croisement","retour_g","retour_d",
      "envers_visible","type_rail","couleur_rail",
      "nom_tringle","diametre_tringle",
      "couv_mecanisme","supp_mecanisme","type_pose",
      "photo"
    ],
  },

// Minutes — vue par défaut du tableau Déplacement
minutes_dep: {
  deplacements: [
    "type_deplacement",
    "nb_techniciens", "duree_trajet_h",
    "nb_nuits", "nb_repas",
    // paramètres masqués par défaut → on NE LES MET PAS dans la liste
    // "tauxhoraire", "prixhotel", "prixrepas",
    "transport_unitaire",
    "pose_prix", "hotel_eur", "repas_eur", "transport_eur",
    "total_eur"
  ],
},

  // 4) INSTALLATION : tableau unique “all/suivi” avec ta présélection
  installation: {
    all: [
      "sel","detail","zone","piece","produit",
      "statut_cotes","statut_preparation","statut_confection","statut_pose",
      "commentaire_confection",
      "photo"
    ],
  },
};


// ================== RÉGLAGES PAR DÉFAUT — ÉTIQUETTES ==================
// À utiliser pour pré-remplir les contrôles "Mise en page", "Colonnes écran",
// "Colonnes impression" et "1 étiquette par page".
export const ETIQUETTES_DEFAULTS = {
  layout: {
    density: "normal",      // "compact" | "normal" | "large" (si tu as d’autres valeurs, adapte)
    columnsScreen: 2,       // Colonnes écran : 2
    columnsPrint:  2,       // Colonnes impression : 2
    onePerPage:    true,    // ✅ 1 étiquette par page coché
  }
};

// =============== Lignes démo ===============
const DEMO_MASTER_ROWS = [
  { id: uid(), produit: "Rideau", zone: "1er étage", piece: "Chambre", type_confection: "Wave 60", pair_un: "Paire", ampleur: 1.8, largeur: 161, hauteur: 250, l_mecanisme: 165, f_bas: 2, croisement: 4, retour_g: 3, retour_d: 3, val_ded_rail: 0, val_ourlet_cote: 15, val_ourlet_haut: 8, onglet: "oui" },
  { id: uid(), produit: "Décor de lit", zone: "1er étage", piece: "Chambre", type_confection: "A plat", pair_un: "Un seul pan", ampleur: 1.6, largeur: 140, hauteur: 240, l_mecanisme: 150, f_bas: 1, croisement: 0, retour_g: 2, retour_d: 2, val_ded_rail: 0, val_ourlet_cote: 15, val_ourlet_haut: 8, onglet: "non" },
  { id: uid(), produit: "Store Bateau", zone: "RDC", piece: "Salon", type_confection: "A plat", pair_un: "Un seul pan", ampleur: 1.0, largeur: 130, hauteur: 220, l_mecanisme: 130, f_bas: 0, croisement: 0, retour_g: 0, retour_d: 0, val_ded_rail: 5, val_ourlet_cote: 10, val_ourlet_haut: 6, onglet: "non" },
];

// ================== DEMO MINUTES (liste de minutes) ==================
const DEMO_MINUTES = [
  {
    id: uid(),
    name: "Minute - Projet Démo",
    client: "Client Démo",
    version: 1,
    notes: "Brouillon",
    lines: [
      { id: uid(), produit: "Rideau", zone: "RDC",  piece: "Salon", type_confection: "Wave 60", pair_un: "Paire",
        statut_cotes: "côtes sur plans", l_mecanisme: 160, largeur: 150, hauteur: 250, retour_g: 3, retour_d: 3, type_pose: "Plafond",
        commentaire_minute: "Prévoir doublure", qty: 1, prix_unitaire: 0 },
      { id: uid(), produit: "Store Bateau", zone: "Étage",  piece: "Chambre", type_confection: "A plat", pair_un: "Un seul pan",
        statut_cotes: "pas prises", l_mecanisme: 120, largeur: 110, hauteur: 180, retour_g: 0, retour_d: 0, type_pose: "Mur",
        commentaire_minute: "", qty: 2, prix_unitaire: 0 },
    ]
  }
];

// ================== Mapping: lignes minute → lignes production ==================
function mapMinuteLinesToProductionRows(lines) {
  return (lines || []).map((m) => ({
    id: uid(),
    // champs communs → mêmes clés que le SCHEMA_64
    produit:           m.produit ?? "",
    zone:              m.zone ?? "",
    piece:             m.piece ?? "",
    type_confection:   m.type_confection ?? "",
    pair_un:           m.pair_un ?? "",
    statut_cotes:      m.statut_cotes ?? "",
    l_mecanisme:       m.l_mecanisme ?? "",
    largeur:           m.largeur ?? "",
    hauteur:           m.hauteur ?? "",
    retour_g:          m.retour_g ?? "",
    retour_d:          m.retour_d ?? "",
    type_pose:         m.type_pose ?? "",
    // redirection minute → prod
    commentaire_confection: m.commentaire_minute ?? "",
    // valeurs laissées vides par défaut (l’utilisateur complètera côté Prod)
    envers_visible: "", ampleur: "", f_bas: "", croisement: "",
    type_rail: "", couleur_rail: "", nom_tringle: "", diametre_tringle: "",
    couv_mecanisme: "", supp_mecanisme: "", val_ded_rail: "", val_ourlet_cote: "", val_ourlet_haut: "",
    photo: [],
    sel: false,
  }));
}

// =============== Moteur de formules ===============
function evalFormula(expr, row){
  if(!expr) return "";
  const js = String(expr).replace(/\{([^}]+)\}/g, (_,name)=>`get('${norm(name)}')`);
  const get = (k)=>{ const v=row[k]; const n=toNumber(v); return (typeof v==="number" || (String(v).trim()!=="" && Number.isFinite(n)))? n : v; };
  const ROUND=(x,n=0)=>{ const p=10**n; return Math.round((toNumber(x))*p)/p; };
  const IF=(cond,a,b)=>(cond?a:b);
  const MIN=(...xs)=>Math.min(...xs.map(toNumber));
  const MAX=(...xs)=>Math.max(...xs.map(toNumber));
  const ROUNDUP=(x)=>Math.ceil(toNumber(x));
  try{ const fn = new Function("get","ROUND","IF","MIN","MAX","ROUNDUP", `return (${js});`); return fn(get,ROUND,IF,MIN,MAX,ROUNDUP); } catch{ return "#ERR"; }
}
// === Helpers numériques sûrs ===
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// NVL(x,y) : retourne x s'il est un nombre, sinon y (par défaut 0)
const NVL = (x, y) => {
  const xn = Number(x);
  return Number.isFinite(xn) ? xn : Number(y ?? 0);
};

// Évalue une expression style Excel avec variables = champs de la ligne.
// Fonctions supportées : IF(cond, a, b), CEIL(x), NVL(x,y)
function evalFormulaExpr(expr, vars) {
  if (!expr || typeof expr !== "string") return 0;

  const RESERVED = new Set([
    "IF", "CEIL", "NVL",
    "Math", "Number", "NaN", "Infinity", "true", "false", "null", "undefined"
  ]);

  // Remplace tout identifiant par vars.<id> sauf nos fonctions et mots réservés
  const safeExpr = expr.replace(/\b([A-Za-z_]\w*)\b/g, (m, id) => {
    if (RESERVED.has(id)) return id;
    return `vars.${id}`;
  });

  const IF   = (cond, a, b) => (cond ? a : b);
  const CEIL = (x) => Math.ceil(Number(x));
  const NVL_FN = (x, y) => NVL(x, y);

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("vars", "IF", "CEIL", "NVL", `return (${safeExpr});`);
    const out = fn(vars, IF, CEIL, NVL_FN);
    const n = Number(out);
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    // console.warn("Formula error:", expr, e);
    return 0;
  }
}

/**
 * computeFormulas(rows, schema)
 * - Calcule les colonnes "formula" (support IF/CEIL/NVL).
 * - Respecte un override manuel si row.__manual?.[key] === true.
 * - 2 passes pour gérer des dépendances simples (ex: a_plat puis ml_*).
 */
function computeFormulas(rows, schema = SCHEMA_64) {
  if (!Array.isArray(rows) || !Array.isArray(schema)) return rows || [];

  const formulaCols = schema.filter((c) => c.type === "formula");

  let current = rows.map((r) => ({ ...r }));
  const PASSES = 2;

  for (let pass = 0; pass < PASSES; pass++) {
    current = current.map((row) => {
      const next = { ...row };

      // Construit le contexte vars pour cette ligne
      const vars = {};
      for (const col of schema) {
        const k = col.key;
        const val = next[k] ?? row[k];
        vars[k] = toNum(val);
      }

      // Applique chaque formule, sauf si override manuel actif
      for (const col of formulaCols) {
        const k = col.key;

        if (next.__manual?.[k]) continue; // ne pas recalculer si override

        const expr = col.formula;
        if (!expr) continue;

        const value = evalFormulaExpr(expr, vars);
        next[k] = value;
        vars[k] = toNum(value); // dispo pour les formules suivantes de la même passe
      }

      return next;
    });
  }

  return current;
}

// =============== Cellules ===============
function NumericInput({ value, onChange, ...rest }) {
  const [txt, setTxt] = React.useState(value ?? "");

  React.useEffect(() => {
    setTxt(value ?? "");
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={txt}
      onChange={(e) => {
        const v = e.target.value;
        setTxt(v);
        // Saisie libre, mais on transforme la virgule en point à la volée
        onChange(v.replace(",", "."));
      }}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ width: "100%", border: "none", outline: "none", background: "transparent" }}
    />
  );
}

// Normalise col.options vers array [{value, label}]
function normalizeOptions(opts) {
  if (Array.isArray(opts)) {
    if (!opts.length) return [];
    const first = opts[0];
    if (typeof first === "string") {
      return opts.map((s) => ({ value: s, label: s }));
    }
    if (first && typeof first === "object") {
      // { value, label } déjà ok
      if ("value" in first) {
        return opts.map((o) => ({ value: o.value, label: o.label ?? String(o.value) }));
      }
      // { key, label }
      if ("key" in first) {
        return opts.map((o) => ({ value: o.key, label: o.label ?? String(o.key) }));
      }
    }
    return [];
  }
  if (typeof opts === "string") {
    return opts
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ value: s, label: s }));
  }
  if (opts && typeof opts === "object") {
    // objet map {key: label}
    return Object.entries(opts).map(([k, v]) => ({ value: k, label: String(v) }));
  }
  return [];
}

function InputCell({
  row,
  col,
  isEditing,
  onStartEdit,
  onEndEdit,
  onChange,
  onOpenLightbox, // (images[], startIndex)
  onEnter,        // (shift:boolean)
}) {
  const key = col?.key;
  const type = col?.type || "text";
  const readOnly = !!col?.readOnly;
  const value = row?.[key];

  // ===== HOOKS — tjs en haut (pas de hooks conditionnels) =====
  const textRef   = React.useRef(null);
  const numberRef = React.useRef(null);
  const selectRef = React.useRef(null);
  const multiRef  = React.useRef(null);
  const fileRef   = React.useRef(null);

// après: const fileRef = React.useRef(null);
const [draft, setDraft] = React.useState(value);

// chaque fois qu’on (re)entre en édition, resynchroniser le draft avec la valeur
React.useEffect(() => {
  if (isEditing) setDraft(value ?? "");
}, [isEditing, value]);



  // focus auto quand on passe en édition
  React.useEffect(() => {
    if (!isEditing) return;
    if (type === "text"     && textRef.current)   { textRef.current.focus(); textRef.current.select?.(); }
    if (type === "number"   && numberRef.current) { numberRef.current.focus(); numberRef.current.select?.(); }
    if (type === "select"   && selectRef.current) { selectRef.current.focus(); selectRef.current.showPicker?.(); }
    if (type === "multiselect" && multiRef.current){ multiRef.current.focus(); }
    if (type === "photo"    && fileRef.current)   { fileRef.current.focus(); }
  }, [isEditing, type]);

  // ===== Helpers communs =====
const stopAll = (e) => { e.stopPropagation(); };

// 🔒 évite le double-commit (Enter puis blur)
const committedRef = React.useRef(false);

const normalize = (v) => {
  if (type === "number") return (v === "" ? "" : String(v).replace(",", "."));
  return v;
};

const commitOnce = (v) => {
  if (readOnly) { onEndEdit?.(); return; }
  if (committedRef.current) return;
  committedRef.current = true;

  const next = normalize(v);
  if (String(next) !== String(value)) onChange?.(key, next);
  onEndEdit?.();

  // relâche le verrou juste après le cycle d’événements
  setTimeout(() => { committedRef.current = false; }, 0);
};
  const handleInputKeyDown = (e) => {
  e.stopPropagation();
  if (e.key === "Enter") {
    e.preventDefault();
    const cur = e.currentTarget?.value;
    commitOnce(cur);                 // ✅ commit avant de bouger
    setTimeout(() => onEnter?.(e.shiftKey), 0); // laisse React démonter l’input avant de bouger
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    onEndEdit?.();
  }
};

  // ===== Rendus par type =====

  // 1) Checkbox (lecture/édition quasi identiques)
  if (type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange?.(key, e.target.checked)}
        onClick={stopAll}
        onMouseDown={stopAll}
      />
    );
  }

  // 2) Select (liste simple)
  if (type === "select") {
    const options = React.useMemo(() => normalizeOptions(col?.options), [col]);

const label =
  options.find((o) => String(o.value) === String(value))?.label ||
  (value ?? "—");

    return isEditing ? (
      <select
  ref={selectRef}
  value={value ?? ""}
  onChange={(e) => commitOnce(e.target.value)}   // ⬅️ au change
  onBlur={(e) => commitOnce(e.target.value)}     // ⬅️ au blur (sécurité)
  onKeyDown={handleInputKeyDown}
  onClick={stopAll}
  style={{ width: "100%" }}
>
        <option value=""></option>
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>{o.label}</option>
        ))}
      </select>
    ) : (
      <div
        onDoubleClick={() => !readOnly && onStartEdit?.()}
        style={{ cursor: readOnly ? "default" : "text" }}
      >
        {label || "—"}
      </div>
    );
  }

  // 3) MultiSelect (valeur tableau de valeurs)
  if (type === "multiselect") {
    const options = React.useMemo(() => normalizeOptions(col?.options), [col]);
    const selected = Array.isArray(value) ? value : [];
    const asLabels = selected
      .map((v) => options.find((o) => String(o.value) === String(v))?.label || String(v))
      .filter(Boolean);

    return isEditing ? (
      <div
        ref={multiRef}
        tabIndex={0}
        onKeyDown={handleInputKeyDown}
        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
        onClick={stopAll}
        onMouseDown={stopAll}
      >
        {options.map((o) => {
          const active = selected.some((v) => String(v) === String(o.value));
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                let next = selected;
                if (active) next = selected.filter((v) => String(v) !== String(o.value));
                else next = [...selected, o.value];
                onChange?.(key, next);
              }}
              style={{
                padding: "2px 6px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: active ? "#2563eb" : "#f8fafc",
                color: active ? "#fff" : "#111",
                fontSize: 12,
              }}
            >
              {o.label}
            </button>
          );
        })}
        {/* commit sur blur */}
        <span style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} />
      </div>
    ) : (
      <div
        onDoubleClick={() => !readOnly && onStartEdit?.()}
        style={{ display: "flex", gap: 6, flexWrap: "wrap", cursor: readOnly ? "default" : "text" }}
      >
        {asLabels.length ? asLabels.map((t, i) => (
          <span key={i} style={{ padding: "2px 6px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f8fafc", fontSize: 12 }}>
            {t}
          </span>
        )) : "—"}
      </div>
    );
  }

  // 4) Number
  if (type === "number") {
    const format = (v) => v ?? "";
    return isEditing ? (
      <input
  ref={numberRef}
  type="text"
  defaultValue={value ?? ""}
  onKeyDown={handleInputKeyDown}
  onBlur={(e) => commitOnce(e.target.value)}     // ⬅️
  onClick={stopAll}
  onMouseDown={stopAll}
  style={{ width: "100%" }}
  inputMode="decimal"
/>
    ) : (
      <div onDoubleClick={() => !readOnly && onStartEdit?.()}>
        {format(value) || "—"}
      </div>
    );
  }

  // 5) Photo (tableau d’URLs)
  if (type === "photo") {
    const imgs = Array.isArray(value) ? value : (value ? [value] : []);
    const open = (idx = 0) => onOpenLightbox?.(imgs, idx);

    return isEditing ? (
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
        onClick={stopAll}
        onMouseDown={stopAll}
      >
        {imgs.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => open(i)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 6,
              overflow: "hidden",
              border: "1px solid #e5e7eb",
              padding: 0,
            }}
            title="Voir"
          >
            <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        ))}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            const urls = files.map((f) => URL.createObjectURL(f));
            const next = [...imgs, ...urls];
            onChange?.(key, next);
            // on reste en édition pour pouvoir en rajouter
          }}
        />
      </div>
    ) : (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {imgs.length ? (
          imgs.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); open(i); }}
              onDoubleClick={(e) => { e.stopPropagation(); !readOnly && onStartEdit?.(); }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid #e5e7eb",
                padding: 0,
                cursor: "pointer",
              }}
              title="Voir"
            >
              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))
        ) : (
          <button
            type="button"
            onDoubleClick={() => !readOnly && onStartEdit?.()}
            style={{ fontSize: 12, opacity: 0.6, background: "none", border: "none", padding: 0, cursor: readOnly ? "default" : "text" }}
          >
            + Ajouter des photos
          </button>
        )}
      </div>
    );
  }

  // 6) Formula (lecture seule)
  if (type === "formula") {
    return <div>{value ?? "—"}</div>;
  }

  // 7) Button (action simple)
  if (type === "button") {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); col?.onClick?.(row); }}
        style={{ ...S.smallBtn }}
      >
        {col?.label || "Action"}
      </button>
    );
  }

  // 8) Détail (bouton d’ouverture, si tu l’utilises dans le tableau)
  if (key === "detail") {
    return (
      <button
        type="button"
        style={S.smallBtn}
        onClick={(e) => { e.stopPropagation(); col?.onOpen?.(row); }}
      >
        Ouvrir
      </button>
    );
  }

  // 9) Texte (par défaut)
  return isEditing ? (
    <input
      ref={textRef}
      type="text"
      defaultValue={value ?? ""}
      onKeyDown={handleInputKeyDown}
      onBlur={(e) => commitOnce(e.target.value)}
      onClick={stopAll}
      onMouseDown={stopAll}
      style={{ width: "100%" }}
    />
  ) : (
    <div
      onDoubleClick={() => !readOnly && onStartEdit?.()}
      style={{ cursor: readOnly ? "default" : "text" }}
    >
      {value ?? "—"}
    </div>
  );
}

function FilterPanel({ filters, setFilters, schema, onClose }) {
  const opsByType = {
    text: [
      { v: "contains", label: "contient" },
      { v: "eq",       label: "==" },
      { v: "neq",      label: "!=" },
      { v: "isEmpty",  label: "est vide" },
      { v: "notEmpty", label: "n'est pas vide" },
    ],
    select: [
      { v: "eq",       label: "==" },
      { v: "neq",      label: "!=" },
      { v: "contains", label: "contient" },
      { v: "isEmpty",  label: "est vide" },
      { v: "notEmpty", label: "n'est pas vide" },
    ],
    number: [
      { v: "eq",  label: "==" },
      { v: "neq", label: "!=" },
      { v: "gt",  label: ">"  },
      { v: "gte", label: ">=" },
      { v: "lt",  label: "<"  },
      { v: "lte", label: "<=" },
      { v: "isEmpty",  label: "est vide" },
      { v: "notEmpty", label: "n'est pas vide" },
    ],
    checkbox: [
      { v: "isTrue",  label: "est vrai"  },
      { v: "isFalse", label: "est faux"  },
    ],
    formula: [
      { v: "eq",  label: "==" },
      { v: "neq", label: "!=" },
      { v: "gt",  label: ">"  },
      { v: "gte", label: ">=" },
      { v: "lt",  label: "<"  },
      { v: "lte", label: "<=" },
      { v: "isEmpty",  label: "est vide" },
      { v: "notEmpty", label: "n'est pas vide" },
    ],
  };

  const byKey = useMemo(() => Object.fromEntries(schema.map(c => [c.key, c])), [schema]);

  const addLine = () => {
    // par défaut : première colonne texte si possible
    const first = schema.find(c => c.key !== "sel") || schema[0];
    const baseType = first?.type || "text";
    const baseOp = (opsByType[baseType] || opsByType.text)[0].v;
    setFilters(fs => [...(fs||[]), { key: first.key, op: baseOp, value: "" }]);
  };

  const updateAt = (i, patch) => {
    setFilters(fs => {
      const arr = [...(fs||[])];
      arr[i] = { ...arr[i], ...patch };
      // si on change de colonne → réaligner l’opérateur sur le nouveau type
      if (patch.key) {
        const t = byKey[patch.key]?.type || "text";
        const firstOp = (opsByType[t] || opsByType.text)[0].v;
        arr[i].op = firstOp;
        // si checkbox → pas de value libre
        if (t === "checkbox") delete arr[i].value;
      }
      return arr;
    });
  };

  const removeAt = (i) => setFilters(fs => (fs||[]).filter((_,j) => j!==i));
  const clearAll = () => setFilters([]);

  return (
    <div style={S.pop}>
      <div style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Filtres</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.smallBtn} onClick={addLine}>+ Ajouter</button>
          <button style={S.smallBtn} onClick={clearAll}>Tout effacer</button>
          <button style={S.smallBtn} onClick={onClose}><X size={14}/></button>
        </div>
      </div>

      <div style={{ padding: 10, display: "grid", gap: 8 }}>
        {(filters||[]).length === 0 && (
          <div style={{ opacity: .7 }}>Aucun filtre. Cliquez sur « Ajouter ».</div>
        )}

        {(filters||[]).map((f, i) => {
          const col = byKey[f.key] || schema[0];
          const type = col?.type || "text";
          const ops = opsByType[type] || opsByType.text;

          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 140px 1fr auto", gap: 8, alignItems: "center" }}>
              {/* Colonne */}
              <select value={f.key} onChange={(e)=>updateAt(i,{ key: e.target.value })}>
                {schema.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>

              {/* Opérateur */}
              <select value={f.op} onChange={(e)=>updateAt(i, { op: e.target.value })}>
                {ops.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>

              {/* Valeur (affichée sauf pour checkbox / isTrue/isFalse / isEmpty/notEmpty) */}
              {type === "checkbox" || ["isTrue","isFalse","isEmpty","notEmpty"].includes(f.op) ? (
                <div style={{ opacity:.6, fontStyle:"italic" }}>—</div>
              ) : (
                <input
                  value={f.value ?? ""}
                  onChange={(e)=>updateAt(i,{ value: e.target.value })}
                  placeholder="Valeur…"
                />
              )}

              <button style={S.smallBtn} onClick={()=>removeAt(i)} title="Supprimer">✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}



function ColumnPicker({ visibleCols, setVisibleCols, schema, onClose }) {
  // Colonnes protégées (toujours visibles)
  const MIN_COLS = ["sel", "detail"];

  // Bascule d’une colonne, en empêchant de décocher une colonne protégée
  const toggle = (k) => {
    setVisibleCols((arr) => {
      // on interdit la décoché de ces colonnes
      if (MIN_COLS.includes(k)) return arr;

      return arr.includes(k)
        ? arr.filter((x) => x !== k)
        : [...arr, k];
    });
  };

  return (
    <div style={S.pop}>
      {/* Entête */}
      <div
        style={{
          padding: 10,
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <strong>Colonnes</strong>
        <button onClick={onClose} style={S.smallBtn}>
          <X size={14} />
        </button>
      </div>

      {/* Boutons rapides */}
      <div style={{ padding: 10 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            style={S.smallBtn}
            onClick={() => setVisibleCols(schema.map((c) => c.key))}
          >
            Tout
          </button>

          <button
            style={S.smallBtn}
            onClick={() => setVisibleCols(["sel", "detail"])}
          >
            Rien
          </button>
        </div>

        {/* Liste des colonnes */}
        <div style={{ display: "grid", gap: 6 }}>
          {schema.map((c) => {
            const checked = visibleCols.includes(c.key);
            const locked = MIN_COLS.includes(c.key);
            return (
              <label
                key={c.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 2px",
                  borderBottom: `1px dashed ${COLORS.border}`,
                  opacity: locked ? 0.65 : 1,
                }}
                title={locked ? "Toujours visible" : ""}
              >
                <span>{c.label}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked}
                  onChange={() => toggle(c.key)}
                />
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EtqFieldPicker({ visibleKeys, setVisibleKeys, schema, onClose }) {
  const CANDIDATES = schema.filter(c => !["sel","detail","photo","button"].includes(c.key));
  const toggle = (k) =>
    setVisibleKeys(arr => arr.includes(k) ? arr.filter(x=>x!==k) : [...arr, k]);

  return (
    <div style={S.pop}>
      <div style={{ padding:10, borderBottom:`1px solid ${COLORS.border}`, display:"flex", justifyContent:"space-between" }}>
        <strong>Champs d’étiquette</strong>
        <button style={S.smallBtn} onClick={onClose}>Fermer</button>
      </div>
      <div style={{ padding:10, display:"flex", gap:8 }}>
        <button style={S.smallBtn} onClick={()=>setVisibleKeys(CANDIDATES.map(c=>c.key))}>Tout</button>
        <button style={S.smallBtn} onClick={()=>setVisibleKeys([])}>Rien</button>
      </div>
      <div style={{ padding:10, display:"grid", gap:6 }}>
        {CANDIDATES.map(c=>(
          <label key={c.key} style={{ display:"flex", justifyContent:"space-between", borderBottom:`1px dashed ${COLORS.border}`, padding:"3px 0" }}>
            <span>{c.label}</span>
            <input type="checkbox" checked={visibleKeys.includes(c.key)} onChange={()=>toggle(c.key)} />
          </label>
        ))}
      </div>
    </div>
  );
}

function EtiquetteCard({ row, schema, fields }) {
  const byKey = useMemo(()=>Object.fromEntries(schema.map(c=>[c.key,c])),[schema]);
  return (
    <div className="etq-card" style={S.card}>
      {fields.map(k => {
        const col = byKey[k]; if (!col) return null;
        const label = col.label || k;
        const val = row[k];
        const text = val == null ? "" : (col.type==="checkbox" ? (val?"Oui":"Non") : String(val));
        return (
          <div key={k} style={S.cardRow}>
            <div style={S.cardLabel}>{label} :</div>
            <div>{text}</div>
          </div>
        );
      })}
    </div>
  );
}

function EtiquettesSection({ title, tableKey, rows, schema }) {
  const sectionRef = React.useRef(null);

  // Clés LS
  const keyFields    = `prod.etq.fields.${tableKey}`;
  const keyFilters   = `prod.etq.filters.${tableKey}`;
  const keyGroup     = `prod.etq.group.${tableKey}`;
  const keyColsWeb   = `prod.etq.colsWeb.${tableKey}`;
  const keyColsPrint = `prod.etq.colsPrint.${tableKey}`;
  const keyDensity   = `prod.etq.density.${tableKey}`;
  const keyLayout    = `prod.etq.layout.${tableKey}`;      // "auto" | "1col" | "2col"
  const keyOnePer    = `prod.etq.onepage.${tableKey}`;     // bool

  // Champs visibles par défaut
  const DEFAULT = ["zone","piece","produit","type_confection","pair_un","ampleur","largeur","hauteur","nb_glisseurs","h_finie"];

  const [fieldsLS, setFields] = useLocalStorage(keyFields, DEFAULT);
  const [filters,  setFilters] = useLocalStorage(keyFilters, []);
  const [showFilters, setShowFilters] = React.useState(false);
  const [groupBy,  setGroupBy] = useLocalStorage(keyGroup, null);

  // Options d’affichage
  const [colsWeb,   setColsWeb]   = useLocalStorage(keyColsWeb, 3);
  const [colsPrint, setColsPrint] = useLocalStorage(keyColsPrint, 3);
  const [density,   setDensity]   = useLocalStorage(keyDensity, "normal"); // "compact" | "normal" | "large"

  // Nouveau : layout interne & 1/page
  const [layout,      setLayout]      = useLocalStorage(keyLayout, "auto"); // "auto" | "1col" | "2col"
  const [onePerPage,  setOnePerPage]  = useLocalStorage(keyOnePer, false);

  // Sélecteur de champs (comme ailleurs)
  const [showPicker, setShowPicker] = React.useState(false);

  // Injecter le nombre de colonnes impression pour la grille
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--etq-cols-print", String(colsPrint || 3));
    return () => root.style.removeProperty("--etq-cols-print");
  }, [colsPrint]);

  // --- Sécurité: ne garder que des clés existantes et autorisées
  const allowedKeys = React.useMemo(
    () => schema
      .filter(c => !["sel","detail","photo","button"].includes(c.key))
      .map(c => c.key),
    [schema]
  );

  const fields = React.useMemo(() => {
    const kept = (fieldsLS || []).filter(k => allowedKeys.includes(k));
    return kept.length ? kept : DEFAULT.filter(k => allowedKeys.includes(k));
  }, [fieldsLS, allowedKeys]);

  // 1) lignes de base : si des lignes sont cochées → seulement celles-là
  const base = rows.some(r => r.sel) ? rows.filter(r => r.sel) : rows;

  // 2) Filtres
  const filtered = React.useMemo(() => {
    if (!filters?.length) return base;
    return base.filter((r) =>
      filters.every((f) => {
        const v  = r?.[f.key];
        const sv = String(v ?? "");
        switch (f.op) {
          case "contains": return sv.toLowerCase().includes(String(f.value||"").toLowerCase());
          case "eq":       return sv === String(f.value ?? "");
          case "neq":      return sv !== String(f.value ?? "");
          case "gt":       return toNumber(v) >  toNumber(f.value);
          case "gte":      return toNumber(v) >= toNumber(f.value);
          case "lt":       return toNumber(v) <  toNumber(f.value);
          case "lte":      return toNumber(v) <= toNumber(f.value);
          case "isTrue":   return Boolean(v) === true;
          case "isFalse":  return Boolean(v) === false;
          case "isEmpty":  return sv === "" || v == null;
          case "notEmpty": return !(sv === "" || v == null);
          default:         return true;
        }
      })
    );
  }, [base, filters]);

  // 3) Évite les cartes entièrement vides
  const rowsForCards = React.useMemo(() => {
    const out = [];
    for (const r of filtered) {
      const hasValue = fields.some(k => {
        const v = r?.[k];
        return !(v == null || String(v).trim() === "");
      });
      if (hasValue) out.push(r);
    }
    return out;
  }, [filtered, fields]);

  // 4) Groupes
  const groups = React.useMemo(() => {
    if (!groupBy?.key) return null;
    const m = new Map();
    for (const r of rowsForCards) {
      const gv = r[groupBy.key] ?? "";
      const k = String(gv);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return Array.from(m.entries()).sort(([a],[b]) => a.localeCompare(b, "fr", { numeric:true }));
  }, [rowsForCards, groupBy]);

  // Impression
  const printAll = () => window.print();

  // Densité (taille de police / espacements)
  const densityStyle =
    density === "compact" ? { fontSize: 12, lineHeight: 1.1 }
  : density === "large"   ? { fontSize: 15, lineHeight: 1.3 }
                          : { fontSize: 13.5, lineHeight: 1.2 };

  // === Application du layout & "1/page" sur les cartes ===
  const applyCardStyles = React.useCallback(() => {
    const root = sectionRef.current;
    if (!root) return;
    const cards = root.querySelectorAll(".etq-card");
    cards.forEach((el) => {
      // Colonnage (écran)
      if (layout === "1col") {
        el.style.columnCount = "1";
      } else if (layout === "2col") {
        el.style.columnCount = "2";
      } else {
        el.style.columnCount = "1"; // auto -> base 1, ajusté avant impression si besoin
      }

      // Espacement colonne
      el.style.columnGap = "16px";

      // Empêcher la casse d’un champ sur 2 pages / colonnes
      Array.from(el.children).forEach((child) => {
        child.style.breakInside = "avoid";
      });

      // 1 étiquette par page (print)
      el.style.breakAfter = onePerPage ? "page" : "auto";
    });
  }, [layout, onePerPage]);

  React.useEffect(() => {
    applyCardStyles();
  }, [applyCardStyles, rowsForCards.length, fields.join(","), groupBy?.key, density]);

  // Auto-fit avant impression : si layout=auto et carte trop haute, bascule en 2 colonnes
  React.useEffect(() => {
    if (layout !== "auto") return;

    const onBefore = () => {
      const root = sectionRef.current;
      if (!root) return;

      const PX_PER_IN = 96;
      const A4_H = 11.69 * PX_PER_IN;          // ≈ 1123px
      const margin = (10 / 25.4) * PX_PER_IN;  // 10mm → px
      const maxH = A4_H - margin - margin;

      const cards = root.querySelectorAll(".etq-card");
      cards.forEach((el) => {
        el.style.columnCount = "1";
        if (el.scrollHeight > maxH) el.style.columnCount = "2";
      });
    };

    window.addEventListener("beforeprint", onBefore);
    return () => window.removeEventListener("beforeprint", onBefore);
  }, [layout]);

  return (
    <div ref={sectionRef} style={{ ...S.tableBlock, overflow: "visible" }}>
      {/* Toolbar — masquée à l’impression */}
      <div style={S.tableHeader} data-hide-on-print="1">
        <div style={S.tableTitle}>{title}</div>

        <div style={{ ...S.etqToolbar, flexWrap:"wrap" }}>
          <button style={S.smallBtn} onClick={printAll}>Imprimer</button>

          {/* Filtres */}
<div style={{ position: "relative", display: "inline-block" }}>
  <button style={S.smallBtn} onClick={()=>setShowFilters(s=>!s)}>
    <Filter size={16}/> Filtres
  </button>
  {showFilters && (
    <FilterPanel
      filters={filters}          // ← déjà dans DataTable via useLocalStorage
      setFilters={setFilters}    // ← idem
      schema={schema}
      onClose={() => setShowFilters(false)}
    />
  )}
</div>

          {/* Grouper */}
          <div>
            <select
              style={S.smallBtn}
              value={groupBy?.key || ""}
              title="Grouper par"
              onChange={(e)=> setGroupBy(e.target.value ? { key:e.target.value } : null)}
            >
              <option value="">— Aucun groupe —</option>
              {schema.filter(c=>!["sel","detail","photo","button"].includes(c.key)).map(c=>(
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            {groupBy?.key && <button style={S.smallBtn} onClick={()=>setGroupBy(null)}>Annuler le groupe</button>}
          </div>

          {/* Sélecteur de champs (même UX que les tableaux) */}
          <div style={{ position:"relative" }}>
            <button
              style={S.smallBtn}
              onClick={()=>setShowPicker(true)}
              title="Choisir les champs à afficher sur l'étiquette"
            >
              <Settings2 size={16}/> Champs
            </button>
            {showPicker && (
              <EtqFieldPicker
                visibleKeys={fields}
                setVisibleKeys={(arr)=>setFields(arr)}
                schema={schema}
                onClose={()=>setShowPicker(false)}
              />
            )}
          </div>

          {/* Mise en page interne */}
          <div>
            <label style={{ marginRight: 6 }}>Mise en page</label>
            <select
              style={S.smallBtn}
              value={layout}
              onChange={(e)=>setLayout(e.target.value)}
              title="Organisation interne de l'étiquette"
            >
              <option value="auto">Auto</option>
              <option value="1col">1 colonne</option>
              <option value="2col">2 colonnes</option>
            </select>
          </div>

          {/* Colonnes web / print */}
          <div>
            <label style={{ marginRight: 6 }}>Colonnes écran</label>
            <select style={S.smallBtn} value={colsWeb} onChange={(e)=>setColsWeb(Number(e.target.value)||3)}>
              {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={{ marginRight: 6 }}>Colonnes impression</label>
            <select style={S.smallBtn} value={colsPrint} onChange={(e)=>setColsPrint(Number(e.target.value)||3)}>
              {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* Densité */}
          <div>
            <label style={{ marginRight: 6 }}>Densité</label>
            <select style={S.smallBtn} value={density} onChange={(e)=>setDensity(e.target.value)}>
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
              <option value="large">Large</option>
            </select>
          </div>

          {/* 1 étiquette par page */}
          <label style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
            <input
              type="checkbox"
              checked={onePerPage}
              onChange={(e)=>setOnePerPage(e.target.checked)}
            />
            1 étiquette par page
          </label>
        </div>
      </div>

      {/* Corps */}
      {rowsForCards.length === 0 ? (
        <div style={{ padding: 12, opacity: .7 }}>
          Aucune étiquette : ajuste les filtres ou saisis des valeurs.
        </div>
      ) : !groupBy?.key ? (
        <div
          className="etq-grid"
          style={{
            ...S.cardsWrap,
            gridTemplateColumns: `repeat(${colsWeb}, minmax(260px, 1fr))`,
            ...densityStyle
          }}
        >
          {rowsForCards.map(r => (
            <EtiquetteCard key={r.id} row={r} schema={schema} fields={fields} />
          ))}
        </div>
      ) : (
        // Rendu groupé
        <div style={{ display:"grid", gap:18 }}>
          {Array.from(groups).map(([gv, rs]) => (
            <div key={gv}>
              <div data-hide-on-print="1" style={{ fontWeight:800, margin:"6px 0 8px" }}>
                {schema.find(c=>c.key===groupBy.key)?.label || groupBy.key} : {gv || "—"}
                <span style={{ opacity:.6, marginLeft:8 }}>({rs.length})</span>
              </div>
              <div
                className="etq-grid"
                style={{
                  ...S.cardsWrap,
                  gridTemplateColumns: `repeat(${colsWeb}, minmax(260px, 1fr))`,
                  ...densityStyle
                }}
              >
                {rs.map(r => (
                  <EtiquetteCard key={r.id} row={r} schema={schema} fields={fields} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Picker (sélecteur de champs) */}
      {showPicker && (
        <EtqFieldPicker
          visibleKeys={fields}
          setVisibleKeys={(arr)=>setFields(arr)}
          schema={schema}
          onClose={()=>setShowPicker(false)}
        />
      )}
    </div>
  );
}

function EditFieldModal({ col, onClose, onSave }){
  const [label,setLabel]=useState(col.label);
  const [type,setType]=useState(col.type);
  const [width,setWidth]=useState(col.width||120);
  const [readOnly,setReadOnly]=useState(Boolean(col.readOnly));
  const [options,setOptions]=useState((col.options||[]).join("\n")); // IMPORTANT: on gère les retours à la ligne ici
  const [formula,setFormula]=useState(col.formula||"");
  const [description,setDescription]=useState(col.description||"");

  return (
    <div style={S.modalBg} onClick={onClose}>
      <div style={S.modal} onClick={(e)=>e.stopPropagation()}>
        <div style={S.modalHead}>
          <span>Paramétrer le champ</span>
          <button style={S.smallBtn} onClick={onClose}>Fermer</button>
        </div>

        <div style={S.modalBody}>
          <div style={S.modalRow}>
            <label>Nom</label>
            <input value={label} onChange={(e)=>setLabel(e.target.value)}/>
          </div>

          <div style={S.modalRow}>
            <label>Type</label>
            <select value={type} onChange={(e)=>setType(e.target.value)}>
              <option value="text">Texte</option>
              <option value="number">Nombre</option>
              <option value="select">Liste</option>
              <option value="checkbox">Case à cocher</option>
              <option value="photo">Photo</option>
              <option value="formula">Formule</option>
              <option value="button">Bouton</option>
            </select>
          </div>

          <div style={S.modalRow}>
            <label>Largeur (px)</label>
            <input type="number" value={width} onChange={(e)=>setWidth(Number(e.target.value)||120)}/>
          </div>

          {type==="select" && (
            <div style={S.modalRow}>
              <label>Options (1 par ligne)</label>
              <textarea
                rows={5}
                value={options}
                onChange={(e)=>setOptions(e.target.value)}
              ></textarea>
            </div>
          )}

          {type==="formula" && (
            <div style={S.modalRow}>
              <label>Formule</label>
              <textarea
                rows={4}
                placeholder="ex: ROUND({l_mecanisme}/10 + 2, 0)"
                value={formula}
                onChange={(e)=>setFormula(e.target.value)}
              ></textarea>
            </div>
          )}

          <div style={S.modalRow}>
            <label>Lecture seule</label>
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(e)=>setReadOnly(e.target.checked)}
            />
          </div>
          <div style={S.modalRow}>
            <label>Description</label>
            <textarea rows={2} value={description} onChange={(e)=>setDescription(e.target.value)} />
          </div>
        </div>

        <div style={{ padding: 14, borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={S.smallBtn} onClick={onClose}>Annuler</button>
          <button
            style={{ ...S.smallBtn, background: COLORS.tile, color: "#fff", borderColor: COLORS.tile }}
            onClick={()=>{
              onSave({
                label,
                type,
                width,
                readOnly,
                options: options.split(/\n/).map(s=>s.trim()).filter(Boolean),
                formula,
                description
              });
              onClose();
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// === RowFormModal (édition à gauche + activité à droite) ==================
function RowFormModal({ row, schema, onClose, onSave, visibleKeys }) {
  const [draft, setDraft] = React.useState(row);

  // ---- hooks pour le journal d'activité ----
  const { addChange } = useActivity();
  const { currentUser } = useAuth();

  // petite map clé->col pour accès direct
  const colsByKey = React.useMemo(
    () => Object.fromEntries(schema.map((c) => [c.key, c])),
    [schema]
  );

  const handleChange = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  // ===== Utils de comparaison / filtrage des champs loggables =====
  
  // --- Paramètres minutes (helpers) ---
const PARAM_TYPES = ["prix", "coef"];


// Parse une saisie numérique (accepte virgule)
function toNumOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
  
  const norm = (v) => {
    if (v == null) return "";
    if (Array.isArray(v)) return JSON.stringify([...v].sort());
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };
  const isEqual = (a, b) => norm(a) === norm(b);

  const isLoggableField = (col) => {
    if (!col) return false;
    if (col.readOnly) return false;
    if (col.type === "formula") return false;
    if (col.key === "id" || col.key === "detail" || col.key === "sel") return false;
    return true;
  };

  // ---- Enregistrer + logger les deltas ----
  const handleSave = () => {
    const before = row || {};
    const after = draft;

    for (const col of schema) {
      if (!isLoggableField(col)) continue;

      // ➜ décommente la ligne suivante si tu veux ne logger QUE les champs visibles dans la modale
      // if (visibleKeys?.length && !visibleKeys.includes(col.key)) continue;

      const k = col.key;
      const from = before[k];
      const to = after[k];

      if (!isEqual(from, to)) {
        addChange(
          before.id, // rowId
          k,         // champ
          from,      // avant
          to,        // après
          currentUser?.name || "Utilisateur"
        );
      }
    }

    onSave?.(after);
    onClose?.();
  };

  // Rendu d’un champ (simple, sans dépendre d’InputCell)
  const renderFieldEditor = (col) => {
    const v = draft[col.key];

    if (col.type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={!!v}
          onChange={(e) => handleChange(col.key, e.target.checked)}
        />
      );
    }

    if (col.type === "number") {
      return (
        <input
          type="number"
          value={v ?? ""}
          onChange={(e) =>
            handleChange(col.key, e.target.value === "" ? "" : Number(e.target.value))
          }
          style={{ width: "100%" }}
        />
      );
    }

    if (col.type === "select") {
      const opts = (col.options || []).filter((o) =>
        o && typeof o === "object" ? o.value : o
      );
      return (
        <select
          value={v ?? ""}
          onChange={(e) => handleChange(col.key, e.target.value)}
          style={{ width: "100%" }}
        >
          <option value="">—</option>
          {opts.map((opt, i) => {
            const val = typeof opt === "object" ? opt.value : opt;
            const lab = typeof opt === "object" ? opt.label ?? opt.value : opt;
            return (
              <option key={i} value={String(val)}>
                {lab}
              </option>
            );
          })}
        </select>
      );
    }

    if (col.type === "photo") {
      const arr = Array.isArray(v) ? v : v ? [v] : [];
      const addFiles = (files) => {
        const next = [...arr];
        for (const f of files) {
          const url = URL.createObjectURL(f);
          next.push(url);
        }
        handleChange(col.key, next);
      };
      const removeAt = (i) => {
        const next = arr.filter((_, idx) => idx !== i);
        handleChange(col.key, next);
      };

      return (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {arr.map((src, i) => (
              <div
                key={i}
                style={{
                  position: "relative",
                  width: 80,
                  height: 80,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#eee",
                }}
              >
                <img
                  src={src}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <button
                  onClick={() => removeAt(i)}
                  title="Supprimer"
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    background: "#111827",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "2px 6px",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <label style={{ display: "inline-block" }}>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addFiles(e.target.files || [])}
              style={{ display: "none" }}
            />
            <span
              style={{
                padding: "6px 10px",
                border: "1px dashed #cbd5e1",
                borderRadius: 8,
                cursor: "pointer",
                background: "#f8fafc",
              }}
            >
              + Ajouter des photos
            </span>
          </label>
        </div>
      );
    }

    // default: texte
    return (
      <input
        value={v ?? ""}
        onChange={(e) => handleChange(col.key, e.target.value)}
        style={{ width: "100%" }}
      />
    );
  };

  const keys =
    visibleKeys && visibleKeys.length ? visibleKeys : schema.map((c) => c.key);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 96vw)",
          height: "min(82vh, 900px)",
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 20px 50px rgba(0,0,0,.2)",
          display: "grid",
          gridTemplateColumns: "1fr 360px",
        }}
      >
        {/* Header commun */}
        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 900 }}>Détail de la ligne</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #111827",
                background: "#111827",
                color: "#fff",
                fontWeight: 800,
              }}
            >
              Enregistrer
            </button>
          </div>
        </div>

        {/* Colonne gauche : formulaire éditable */}
        <div style={{ padding: 16, overflow: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: "12px 18px",
            }}
          >
            {keys.map((k) => {
              const col = colsByKey[k];
              if (!col) return null;
              return (
                <React.Fragment key={k}>
                  <div style={{ alignSelf: "center", fontWeight: 600 }}>
                    {col.label}
                  </div>
                  <div>{renderFieldEditor(col)}</div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Colonne droite : activité */}
        <ActivitySidebar row={draft} colsByKey={colsByKey} />
      </div>
    </div>
  );
}

function LightboxModal({ images, index, onClose, onPrev, onNext }) {
  const [i, setI] = useState(index || 0);
  const n = images?.length || 0;

  useEffect(() => setI(index || 0), [index]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  if (!n) return null;
  const src = images[i];

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.7)",
        display: "grid", placeItems: "center", zIndex: 999
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative", width: "min(92vw, 1200px)", height: "min(92vh, 800px)",
          background: "#000", borderRadius: 12, overflow: "hidden", boxShadow: "0 22px 48px rgba(0,0,0,.4)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
        />

        {/* Fermeture */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 10, right: 10,
            background: "rgba(0,0,0,.6)", color: "#fff",
            border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer"
          }}
        >Fermer (Esc)</button>

        {/* Prev / Next */}
        {n > 1 && (
          <>
            <button
              onClick={onPrev}
              style={{
                position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                background: "rgba(0,0,0,.6)", color: "#fff",
                border: "none", borderRadius: 999, width: 42, height: 42, cursor: "pointer", fontSize: 18
              }}
              title="Précédent (←)"
            >‹</button>
            <button
              onClick={onNext}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "rgba(0,0,0,.6)", color: "#fff",
                border: "none", borderRadius: 999, width: 42, height: 42, cursor: "pointer", fontSize: 18
              }}
              title="Suivant (→)"
            >›</button>

            {/* Compteur */}
            <div
              style={{
                position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
                background: "rgba(0,0,0,.6)", color: "#fff",
                borderRadius: 999, padding: "6px 10px", fontSize: 12
              }}
            >
              {i + 1} / {n}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ==== Activity context (log + comments) ====
// Format d'une entrée :
// { id, ts, type: 'change'|'comment', user, field?, from?, to?, text? }
const ActivityCtx = React.createContext(null);

function ActivityProvider({ children }) {
  const [logByRow, setLogByRow] = useLocalStorage("activity.log", {}); // { [rowId]: Entry[] }

  const append = React.useCallback((rowId, entry) => {
    setLogByRow(prev => {
      const cur = prev[rowId] || [];
      return { ...prev, [rowId]: [...cur, entry] };
    });
  }, [setLogByRow]);

  const addChange = React.useCallback((rowId, field, from, to, user) => {
    if (String(from) === String(to)) return; // pas de bruit
    append(rowId, { id: uid(), ts: Date.now(), type: "change", user, field, from, to });
  }, [append]);

  const addComment = React.useCallback((rowId, text, user) => {
    const t = (text || "").trim();
    if (!t) return;
    append(rowId, { id: uid(), ts: Date.now(), type: "comment", user, text: t });
  }, [append]);

  const getRow = React.useCallback((rowId) => logByRow[rowId] || [], [logByRow]);
  const value = React.useMemo(() => ({ addChange, addComment, getRow }), [addChange, addComment, getRow]);
  return <ActivityCtx.Provider value={value}>{children}</ActivityCtx.Provider>;
}

function useActivity() {
  const ctx = React.useContext(ActivityCtx);
  if (!ctx) throw new Error("useActivity must be used within <ActivityProvider>");
  return ctx;
}

// === Panneau latéral "Activité" (onglets + feed) =========================
function ActivitySidebar({ row, colsByKey, onClose }) {
  const colMap = colsByKey || {};
  const { currentUser } = useAuth();
  const { addComment, getRow } = useActivity();
  const [tab, setTab] = React.useState("all"); // 'all' | 'comments' | 'history'
  const [text, setText] = React.useState("");

  const items = React.useMemo(() => {
    const arr = (row?.id ? getRow(row.id) : []).slice().sort((a,b)=>a.ts-b.ts);
    if (tab === "comments") return arr.filter(x => x.type === "comment");
    if (tab === "history")  return arr.filter(x => x.type === "change");
    return arr;
  }, [row?.id, tab, getRow]);

  const publish = () => {
    addComment(row.id, text, currentUser?.name || "Utilisateur");
    setText("");
  };

  return (
    <div style={{ width: 380, borderLeft: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: 12, fontWeight: 800 }}>Activité — {row?.zone || row?.piece || ""}</div>

      <div style={{ display: "flex", gap: 8, padding: "0 12px 8px" }}>
  <button
    style={{ ...S.smallBtn, background: tab==="all" ? "#111827" : "#fff", color: tab==="all" ? "#fff" : "#111" }}
    onClick={() => setTab("all")}
  >
    Toutes
  </button>
  <button
    style={{ ...S.smallBtn, background: tab==="comments" ? "#111827" : "#fff", color: tab==="comments" ? "#fff" : "#111" }}
    onClick={() => setTab("comments")}
  >
    Commentaires
  </button>
  <button
    style={{ ...S.smallBtn, background: tab==="history" ? "#111827" : "#fff", color: tab==="history" ? "#fff" : "#111" }}
    onClick={() => setTab("history")}
  >
    Historique
  </button>
</div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 12px 12px" }}>
        {items.length === 0 ? (
          <div style={{ opacity: .6, padding: 12 }}>Aucune entrée.</div>
        ) : items.map(it => (
          <div key={it.id} style={{ padding: 10, border: `1px solid ${COLORS.border}`, borderRadius: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 12, opacity: .7 }}>
              {new Date(it.ts).toLocaleString()} — {it.user || "Utilisateur"}
            </div>
            {it.type === "comment" ? (
              <div style={{ marginTop: 6 }}>{it.text}</div>
            ) : (
              <div style={{ marginTop: 6 }}>
                <b>{colsByKey?.[it.field]?.label || it.field}</b> :{" "}
                <span style={{ textDecoration: "line-through", opacity: .7 }}>{String(it.from ?? "—")}</span>
                {" "}<span>→</span>{" "}
                <span style={{ color: "#166534", fontWeight: 600 }}>{String(it.to ?? "—")}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${COLORS.border}` }}>
        <textarea
          placeholder="Laisser un commentaire…"
          value={text}
          onChange={(e)=>setText(e.target.value)}
          onKeyDown={(e)=>{ if ((e.metaKey||e.ctrlKey) && e.key === "Enter") publish(); }}
          style={{ width: "100%", minHeight: 80 }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button style={S.smallBtn} onClick={publish}>Publier</button>
        </div>
      </div>
    </div>
  );
}


// =============== DataTable ===============
function DataTable({
  
  title,
  tableKey,
  rows,
  onRowsChange,
  schema,
  setSchema,
  searchQuery = "",
  viewKey = "installation",
}) {
  // --- Versionning du localStorage pour forcer la prise en compte des nouvelles présélections
const VIEWS_VERSION = 4; // ← incrémente quand tu changes DEFAULT_VIEWS
const keyLS = `prod.v${VIEWS_VERSION}.visible.${viewKey}.${tableKey}`;

const MIN_COLS = ["sel", "detail"]; // colonnes protégées

// Helper : savoir si une colonne est de type "formula"
const isFormulaKey = (schema, key) => {
  const col = schema?.find?.(c => c.key === key);
  return col?.type === "formula";
};

const keyCollapsed = `prod.group.collapsed.${viewKey}.${tableKey}`;
const [collapsed, setCollapsed] = useLocalStorage(keyCollapsed, {}); 
const toggleGroup = (gv)=> setCollapsed(s=> ({ ...s, [String(gv)]: !s[String(gv)] }));

// Défaut issu de DEFAULT_VIEWS si présent, sinon tout le schéma
const defaultFromViews = Array.isArray(DEFAULT_VIEWS?.[viewKey]?.[tableKey])
  ? Array.from(new Set([...MIN_COLS, ...DEFAULT_VIEWS[viewKey][tableKey]]))
  : schema.map((c) => c.key);

const [visibleCols, setVisibleCols] = useLocalStorage(keyLS, defaultFromViews);

// Sécurise : si jamais des colonnes protégées manquent, on les réimpose
useEffect(() => {
  setVisibleCols((arr) => Array.from(new Set([...(arr || []), ...MIN_COLS])));
}, [setVisibleCols]);

// Persistance par vue/tableau
  const keyOrder   = `prod.order.${viewKey}.${tableKey}`;
  const keyFilters = `prod.filters.${viewKey}.${tableKey}`;
  const keyGroup   = `prod.group.${viewKey}.${tableKey}`;
  const [order,   setOrder]   = useLocalStorage(keyOrder, null);   // null = ordre par défaut (schéma)
  const [filters, setFilters] = useLocalStorage(keyFilters, []);   // [{key,op,value}]
  const [groupBy, setGroupBy] = useLocalStorage(keyGroup, null);   // {key} | null
  
  // === Agrégats en pied de tableau (simple) ===
const keyAgg = `prod.agg.${viewKey}.${tableKey}`;
const [aggByCol, setAggByCol] = useLocalStorage(keyAgg, {}); // ex: { largeur: "sum", produit:"unique" }

const AGG_NUMERIC   = ["none", "sum", "avg"];            // Aucune, Somme, Moyenne
const AGG_NON_NUM   = ["none", "filled", "empty", "unique"]; // Aucune, Remplies, Vides, Unique
const nf = useMemo(() => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }), []);

const isNumericCol = (col) => col?.type === "number"; // on garde simple (tu pourras enrichir si tu as d'autres types numériques)
const isEmptyValue = (v) => v == null || String(v).trim() === "";

const computeAggValue = (col, rows, mode) => {
  if (!mode || mode === "none") return "";

  const key = col.key;
  // numériques
  if (isNumericCol(col)) {
    const nums = rows
      .map(r => {
        const raw = r[key];
        if (raw === "" || raw == null) return null;
        const x = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
        return Number.isFinite(x) ? x : null;
      })
      .filter(x => x != null);

    if (nums.length === 0) return "—";

    if (mode === "sum") {
      const s = nums.reduce((a, b) => a + b, 0);
      return `Somme ${nf.format(s)}`;
    }
    if (mode === "avg") {
      const s = nums.reduce((a, b) => a + b, 0);
      return `Moyenne ${nf.format(s / nums.length)}`;
    }
    return "—";
  }

  // non numériques
  const vals = rows.map(r => r[key]);
  if (mode === "filled") {
    const n = vals.filter(v => !isEmptyValue(v)).length;
    return `Remplies ${n}`;
  }
  if (mode === "empty") {
    const n = vals.filter(v => isEmptyValue(v)).length;
    return `Vides ${n}`;
  }
  if (mode === "unique") {
    const set = new Set(vals.filter(v => !isEmptyValue(v)).map(v => String(v)));
    return `Unique ${set.size}`;
  }
  return "—";
};

  // Réimpose toujours les colonnes protégées
  useEffect(() => {
    setVisibleCols((arr) => Array.from(new Set([...(arr || []), ...MIN_COLS])));
  }, [setVisibleCols]);

// Colonne de tri initiale = 1ère colonne visible non protégée (on le garde pour info, mais on ne l’applique pas)
const firstSortable = useMemo(
  () =>
    schema.find((c) => visibleCols.includes(c.key) && !MIN_COLS.includes(c.key))?.key || null,
  [schema, visibleCols]
);

// ✅ Aucun tri par défaut au démarrage
const [sort, setSort] = useState({ key: null, dir: "asc" });

  // — Gèle le tri pendant un cycle de rendu quand on édite la colonne triée
const [sortFreeze, setSortFreeze] = useState(false);
const freezeSortOnce = () => {
  setSortFreeze(true);
  setTimeout(() => setSortFreeze(false), 0);
};
  const [lightbox, setLightbox] = useState(null);
  const [debugKeys, setDebugKeys] = useState(false); // activer via un bouton

const { addChange } = useActivity();
const { currentUser } = useAuth();
const { addUpdate } = useActivity();

// === ÉDITION COURANTE (une seule cellule à la fois) ===
const [editing, setEditing] = useState(null); // { rowId, colKey } | null
const [navOrder, setNavOrder] = useState(null); // null | string[] (liste d'IDs)
const isCellEditing = (rowId, colKey) =>
  editing?.rowId === rowId && editing?.colKey === colKey;

const startEdit = (rowIndex, rowId, colKey) => {
  setSelectedCell({ rowIndex, colKey });    // on garde la sélection
  setEditing({ rowId, colKey });            // on entre en édition
  setNavOrder(filtered.map(r => r.id));     // ← fige l'ordre courant des lignes visibles
  requestAnimationFrame(() => {
    focusCell(rowIndex, colKey, { edit: true });
  });
};

const stopEdit = () => {
  setEditing(null);
  setNavOrder(null); // ← enlève l'ordre figé
};


  const [showCols, setShowCols] = useState(false);
  const [editColKey, setEditColKey] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const wrapRef = useRef(null);
  const [menu, setMenu] = useState(null); // { key, x, y }
  const [showFilters, setShowFilters] = useState(false);
  const tdRefMap = useRef(new Map());
const setTdRef = (rowIndex, colKey, el) => {
  const k = `${rowIndex}::${colKey}`;
  if (el) tdRefMap.current.set(k, el);
  else tdRefMap.current.delete(k);
};


// === Drag & Drop colonnes (Airtable-like) ===
const [dragColKey, setDragColKey] = useState(null); // clé en cours de drag
const [dropIdx, setDropIdx] = useState(null);       // index d'insertion (dans "cols")

const isProtected = (key) => MIN_COLS.includes(key);
const isStickyKey = (key) => {
  const i = cols.findIndex(c => c.key === key);
  return i > -1 && i < stickyFirst;
};
const canDragKey = (key) => !isProtected(key) && !isStickyKey(key);

// ordre "full" de référence (si pas d'ordre → schéma)
const getFullOrder = () =>
  (order && order.length ? [...order] : schema.map(c => c.key));

// Applique le réordonnancement à partir d'un déplacement visible -> persiste dans `order`
const applyReorder = (fromKey, toVisibleIndex) => {
  if (!fromKey || toVisibleIndex == null) return;

  // liste des clés visibles (dans l'ordre affiché)
  const vis = cols.map(c => c.key);

  // indices visibles bornés + interdiction de déposer dans la zone sticky
  const minIdx = stickyFirst;
  const targetVisIdx = Math.max(minIdx, Math.min(toVisibleIndex, vis.length));
  const fromVisIdx   = vis.indexOf(fromKey);
  if (fromVisIdx < minIdx) return; // on ne déplace pas depuis la zone sticky

  // on déplace dans la projection visible
  const visNew = [...vis];
  visNew.splice(fromVisIdx, 1);
  visNew.splice(targetVisIdx > fromVisIdx ? targetVisIdx - 1 : targetVisIdx, 0, fromKey);

  // reconstruire un `order` complet : visible (réordonné) + clés cachées (ordre conservé)
  const full = getFullOrder();
  const hidden = full.filter(k => !vis.includes(k));
  const merged = [...visNew, ...hidden.filter(k => !visNew.includes(k))];

  setOrder(merged);
};

const handleDragStart = (e, key) => {
  if (!canDragKey(key)) { e.preventDefault(); return; }
  setDragColKey(key);
  setDropIdx(null);
  // utile pour Firefox
  e.dataTransfer?.setData("text/plain", key);
  e.dataTransfer?.setDragImage?.(e.currentTarget, 10, 10);
  e.dataTransfer.effectAllowed = "move";
};

const handleDragOver = (e, thIndex) => {
  if (!dragColKey) return;
  e.preventDefault(); // autorise le drop
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const before = x < rect.width / 2;
  const idx = before ? thIndex : thIndex + 1; // insertion avant/après
  setDropIdx(idx);
};

const handleDrop = (e) => {
  e.preventDefault();
  if (dragColKey != null && dropIdx != null) {
    applyReorder(dragColKey, dropIdx);
  }
  setDragColKey(null);
  setDropIdx(null);
};

const handleDragEnd = () => {
  setDragColKey(null);
  setDropIdx(null);
};

  const colsByKey = useMemo(
    () => Object.fromEntries(schema.map((c) => [c.key, c])),
    [schema]
  );

  const NON_SELECTABLE_TYPES = new Set(["button"]); // <-- select & photo deviennent sélectionnables
const NON_SELECTABLE_KEYS  = new Set(["detail"]);

const isSelectableColumn = (c) => (
  c && !NON_SELECTABLE_TYPES.has(c.type) && !NON_SELECTABLE_KEYS.has(c.key)
);

  // Ordre des colonnes : d'abord les protégées visibles (sel, detail), puis le reste des visibles
  const cols = useMemo(() => {
    const head = MIN_COLS
      .map((k) => colsByKey[k])
      .filter(Boolean)
      .filter((c) => visibleCols.includes(c.key));

    const tail = schema.filter(
      (c) => visibleCols.includes(c.key) && !MIN_COLS.includes(c.key)
    );

    // tri du "tail" selon l'ordre de la vue s'il existe
    const idx = new Map((order || []).map((k, i) => [k, i]));
    const tailSorted = [...tail].sort((a, b) => {
      const ia = idx.has(a.key) ? idx.get(a.key) : 9999;
      const ib = idx.has(b.key) ? idx.get(b.key) : 9999;
      return ia - ib;
    });

    return [...head, ...tailSorted];
  }, [schema, visibleCols, colsByKey, order]);

  const colIndexByKey = useMemo(
  () => new Map(cols.map((c, i) => [c.key, i])),
  [cols]
);

// --- Helpers pour la sélection/édition ----

// --- Accès direct à un <td> via la map des refs ---
const getTdRef = (rowIndex, colKey) => {
  const k = `${rowIndex}::${colKey}`;
  return tdRefMap.current.get(k) || null;
};

// --- Mettre le focus sur une cellule (et optionnellement entrer en édition) ---
const focusCell = (rowIndex, colKey, { edit = false } = {}) => {
  const ci = colIndexByKey.get(colKey);
  if (ci == null) return;

  const table = wrapRef.current?.querySelector('table');
  const tr = table?.querySelectorAll('tbody tr')[rowIndex];
  const td = tr?.querySelectorAll('td')[ci];

  if (!td) return;

  td.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  if (edit) {
    focusEditableInside(td);
  } else {
    wrapRef.current?.focus?.();
  }
};

// --- Utilitaire de rendu : savoir si une cellule est dans le rectangle sélectionné ---
const isSelected = (rowIndex, colKey) => {
  if (!selBox) return false;
  const ci = colIndexByKey.get(colKey);
  if (ci == null) return false;
  return (
    rowIndex >= selBox.rowStart && rowIndex <= selBox.rowEnd &&
    ci      >= selBox.colStart  && ci      <= selBox.colEnd
  );
};

// cellule éditable ?
const isEditableColumn = (c) =>
  c &&
  !c.readOnly &&
  !["formula","button","photo","detail"].includes(c.type);

// combien de colonnes figées (ex: 2 = Sel, Détail)
const stickyFirst = 2;

// calcul des décalages "left" pour chaque colonne figée
const leftOffsets = useMemo(() => {
  const map = {};
  let acc = 0;
  cols.slice(0, stickyFirst).forEach((c) => {
    map[c.key] = acc;
    acc += (c.width || 120);
  });
  return map;
}, [cols, stickyFirst]);

// helper pour savoir si une colonne est sticky
const isSticky = (key) => leftOffsets[key] !== undefined;

// largeur minimale du tableau (somme des colonnes)
const totalMinWidth = useMemo(
  () => cols.reduce((sum, c) => sum + (c.width || 120), 0),
  [cols]
);
const filtered = useMemo(() => {
  const qq = searchQuery.trim().toLowerCase();
  let data = rows;
  if (qq)
    data = data.filter((r) =>
      [r.zone, r.piece, r.produit].some((x) => String(x || "").toLowerCase().includes(qq))
    );

      // Filtres par vue (AND)
    if (filters?.length) {
    data = data.filter((r) => {
      return filters.every(f => {
        const v = r[f.key];
        const sv = String(v ?? "");
        switch (f.op) {
          case "contains":   return sv.toLowerCase().includes(String(f.value||"").toLowerCase());
          case "eq":         return sv === String(f.value ?? "");
          case "neq":        return sv !== String(f.value ?? "");
          case "gt":         return toNumber(v) >  toNumber(f.value);
          case "gte":        return toNumber(v) >= toNumber(f.value);
          case "lt":         return toNumber(v) <  toNumber(f.value);
          case "lte":        return toNumber(v) <= toNumber(f.value);
          case "isTrue":     return Boolean(v) === true;
          case "isFalse":    return Boolean(v) === false;
          case "isEmpty":    return sv === "" || v == null;
          case "notEmpty":   return !(sv === "" || v == null);
          default:           return true;
        }
      });
    });
  }

// SIMPLIFICATION: Pas de tri du tout pendant l'édition
if (editing || sortFreeze) {
  return data; // Retourne les données sans tri
}

// Tri normal uniquement quand aucune édition n'est en cours
// ✅ Garde: si pas de clé de tri, on renvoie tel quel
if (!sort?.key) return data;

const dir = sort.dir === "asc" ? 1 : -1;
return [...data].sort(
  (a, b) =>
    String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""), "fr", {
      numeric: true,
    }) * dir
);
}, [rows, searchQuery, sort, filters, editing, sortFreeze]);


// Pré-calcul mémoïsé pour toutes les colonnes visibles
const footerAggValues = useMemo(() => {
  const map = {};
  for (const c of cols) {
    const mode = aggByCol?.[c.key] || "none";
    map[c.key] = computeAggValue(c, filtered, mode);
  }
  return map;
}, [cols, filtered, aggByCol]);

// === Grouping (derive) ===
const groups = useMemo(() => {
  if (!groupBy?.key) return null;
  const m = new Map();
  for (const r of filtered) {
    const gv = r[groupBy.key] ?? "";
    const key = String(gv);
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(r);
  }
  return Array.from(m.entries()).sort(([a],[b]) =>
    a.localeCompare(b, "fr", { numeric: true })
  ); // [ [groupValueStr, rows[]], ... ]
}, [filtered, groupBy]);

  // Sélection rectangulaire
const [selBox, setSelBox] = useState(null); // { rowStart,rowEnd,colStart,colEnd }
const draggingRef = useRef(null);           // { rowStart, colStart }
// Gestion sélection globale (checkbox "tout sélectionner")
const selectedRowIds = useMemo(() => {
  return new Set(filtered.filter(r => r.sel).map(r => r.id));
}, [filtered]);

const allVisibleSelected = filtered.length > 0 && selectedRowIds.size === filtered.length;
const someVisibleSelected = selectedRowIds.size > 0 && !allVisibleSelected;

// Fonction pour cocher/décocher toutes les lignes visibles
const toggleSelectAllVisible = (checked) => {
  const ids = new Set(filtered.map(r => r.id));
  const next = computeFormulas(
    rows.map(r => ids.has(r.id) ? { ...r, sel: checked } : r),
    schema
  );
  onRowsChange(next);
};

const deleteSelected = () => {
  if (selectedRowIds.size === 0) return;
  if (!confirm(`Supprimer ${selectedRowIds.size} ligne(s) sélectionnée(s) ?`)) return;
  const next = rows.filter(r => !selectedRowIds.has(r.id));
  onRowsChange(next);
};

// index des lignes visibles (filtered) → utile pendant le drag
const rowIndexById = useMemo(() => {
  const m = new Map();
  filtered.forEach((r, i) => m.set(r.id, i));
  return m;
}, [filtered]);

// Cellule active et ancre de sélection (pour Shift+flèches)
const [activeCell, setActiveCell] = useState(null);   // { rowIndex, colKey } | null
const [selAnchor,  setSelAnchor]  = useState(null);   // { rowIndex, colKey } | null


// Cellule simplement sélectionnée (clic simple) — sert de base pour taper, Enter, Tab, flèches
const [selectedCell, setSelectedCell] = useState(null); // { rowIndex, colKey } | null

// util: donne l’index de colonne à partir de la clé
const getColIndex = (key) => colIndexByKey.get(key);

// util: borne un entier dans [min,max]
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// place la sélection 1x1, met la cellule active, et (optionnel) entre en édition
const activateCell = (rowIndex, colKey, { edit = false } = {}) => {
  const ci = getColIndex(colKey);
  if (ci == null) return;
  setActiveCell({ rowIndex, colKey });
  setSelAnchor({ rowIndex, colKey });
  setSelBox({ rowStart: rowIndex, rowEnd: rowIndex, colStart: ci, colEnd: ci });

  if (edit) {
    // tente de focus l’input de la cellule
    const table = wrapRef.current?.querySelector('table');
    const row = table?.querySelectorAll('tbody tr')[rowIndex];
    const td = row?.querySelectorAll('td')[ci];
    if (td) requestAnimationFrame(() => focusEditableInside(td));
  }
};

// === Déplacement cellule → cellule (garde la même colonne) ===
const gotoCell = (rowIndex, colKey, { edit = false } = {}) => {
  const ci = colIndexByKey.get(colKey);
  if (ci == null) return;

  setSelectedCell({ rowIndex, colKey });
  setSelBox({ rowStart: rowIndex, rowEnd: rowIndex, colStart: ci, colEnd: ci });

  // Si tu as déjà activateCell, utilise-le (sinon focusCell)
  if (typeof activateCell === "function") {
    activateCell(rowIndex, colKey, { edit });
  } else if (typeof focusCell === "function") {
    focusCell(rowIndex, colKey, { edit });
  }

  // ⬅️ garde le focus "global tableau" pour que les flèches marchent sans re-cliquer
  try {
    wrapRef.current?.focus?.({ preventScroll: true });
  } catch {
    wrapRef.current?.focus?.();
  }
};

// === Appelé par une cellule quand on presse Enter dans un champ ===
const handleFieldEnter = (rowId, colKey, { shift = false } = {}) => {
  // 1) Ordre de référence : snapshot si dispo, sinon ordre courant
  const order = navOrder && navOrder.length ? navOrder : filtered.map(r => r.id);

  // 2) Position actuelle (par ID)
  const curPos = order.indexOf(rowId);
  if (curPos < 0) return;

  // 3) Ligne cible dans l'ordre figé
  const delta   = shift ? -1 : 1;
  const nextPos = Math.max(0, Math.min(order.length - 1, curPos + delta));
  const nextId  = order[nextPos];

  // 4) Convertit ID cible -> index courant pour le focus
  const nextIndex = filtered.findIndex(r => r.id === nextId);
  if (nextIndex < 0) return;

  // 5) Laisse commit/blur se terminer avant de bouger
requestAnimationFrame(() => {
  gotoCell(nextIndex, colKey, { edit: false });
  // 👇 garde le focus “global tableau” pour enchaîner flèches/saisie sans re-cliquer
  try {
    wrapRef.current?.focus?.({ preventScroll: true });
  } catch {
    // certains navigateurs ne supportent pas l’option ; fallback simple
    wrapRef.current?.focus?.();
  }
});
};


// étend le rectangle depuis l’ancre jusqu’à (rowIndex,colKey)
const extendFromAnchorTo = (rowIndex, colKey) => {
  if (!selAnchor) return;
  const ci = getColIndex(colKey);
  const ai = getColIndex(selAnchor.colKey);
  if (ci == null || ai == null) return;
  setActiveCell({ rowIndex, colKey });
  setSelBox({
    rowStart: Math.min(selAnchor.rowIndex, rowIndex),
    rowEnd:   Math.max(selAnchor.rowIndex, rowIndex),
    colStart: Math.min(ai, ci),
    colEnd:   Math.max(ai, ci),
  });
};

const ensureAnchor = () => {
  if (!selAnchor && selectedCell) setSelAnchor(selectedCell);
};

// renvoie la prochaine cellule (déplacement par flèche/Enter)
const nextCell = (rowIndex, colKey, dir) => {
  // dir: 'down'|'up'|'left'|'right'
  const colsCount = cols.length;
  const ci = getColIndex(colKey) ?? 0;
  let r = rowIndex, c = ci;

  if (dir === 'down')  r += 1;
  if (dir === 'up')    r -= 1;
  if (dir === 'right') c += 1;
  if (dir === 'left')  c -= 1;

  r = clamp(r, 0, filtered.length - 1);
  c = clamp(c, 0, colsCount - 1);
  return { rowIndex: r, colKey: cols[c].key };
};

// scroll dans la vue si nécessaire
const scrollCellIntoView = (rowIndex, colKey) => {
  const ci = getColIndex(colKey);
  const table = wrapRef.current?.querySelector('table');
  const row = table?.querySelectorAll('tbody tr')[rowIndex];
  const td = row?.querySelectorAll('td')[ci];
  td?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
};

// lire la valeur d'une cellule
const getCellValue = (rowId, colKey) => {
  const r = rows.find(x => x.id === rowId);
  return r ? r[colKey] : undefined;
};

// mise à jour en lot de plusieurs lignes pour une même colonne
const bulkSet = (colKey, ids, value) => {
  const idset = new Set(ids);
  const next = computeFormulas(
    rows.map(r => (idset.has(r.id) ? { ...r, [colKey]: value } : r)),
    schema
  );
  onRowsChange(next);
};

const setManyCells = (updates) => {
  if (!Array.isArray(updates) || updates.length === 0) return;

  // index des rows avant modif
  const before = new Map(rows.map(r => [r.id, r]));
  // log toutes les diffs
  for (const u of updates) {
    const prev = before.get(u.id);
    if (!prev) continue;
    const oldVal = prev[u.key];
    if (String(oldVal) !== String(u.value)) {
      addChange(u.id, u.key, oldVal, u.value, currentUser?.name || "Utilisateur");
    }
  }

  // appliquer les changements regroupés
  const byId = new Map();
  for (const u of updates) {
    if (!byId.has(u.id)) byId.set(u.id, {});
    byId.get(u.id)[u.key] = u.value;
  }
  const next = computeFormulas(
    rows.map(r => byId.has(r.id) ? { ...r, ...byId.get(r.id) } : r),
    schema
  );
  onRowsChange(next);
};

// démarrer une sélection
const beginSelection = (rowIndex, rowId, colKey, e) => {
  const ci = colIndexByKey.get(colKey);
  if (ci == null) return;

  setSelBox({ rowStart: rowIndex, rowEnd: rowIndex, colStart: ci, colEnd: ci });

  // ❌ NE FORCE PLUS LE FOCUS DU WRAPPER ICI
  // wrapRef.current?.focus?.();

  draggingRef.current = { rowStart: rowIndex, colStart: ci };
};

// étendre la sélection pendant le glisser
const extendSelection = (rowIndex, colKey, e) => {
  const drag = draggingRef.current;
  if (!drag) return;

  // si le bouton gauche n’est plus enfoncé → on arrête le drag
  if (!e || !(e.buttons & 1)) { draggingRef.current = null; return; }

  const ci = colIndexByKey.get(colKey);
  if (ci == null) return;

  const rowStart = Math.min(drag.rowStart, rowIndex);
  const rowEnd   = Math.max(drag.rowStart, rowIndex);
  const colStart = Math.min(drag.colStart, ci);
  const colEnd   = Math.max(drag.colStart, ci);

  setSelBox({ rowStart, rowEnd, colStart, colEnd });
};

// terminer la sélection au relâchement de la souris
const endSelection = () => { draggingRef.current = null; };

useEffect(() => {
  const end = () => endSelection();
  window.addEventListener("mouseup", end);
  return () => window.removeEventListener("mouseup", end);
}, []);

// --- Gestion clavier “Excel-like” ---
const handleKeyDown = async (e) => {
  // Sommes-nous dans un champ éditable ?
  const active = document.activeElement;
  const tag = active?.tagName?.toLowerCase();
  const inField = tag === "input" || tag === "textarea" || tag === "select";

  // 0) ESC
  if (e.key === "Escape") {
    if (inField) return;
    setSelBox(null);
    setEditing(null);
    return;
  }

  if (inField) {
  // Si on tape dans un input / textarea / select,
  // on laisse InputCell gérer Enter/Blur/Commit.
  return;
}

  // 1) Copie/Collage — uniquement hors champ
  if (!inField && (e.metaKey || e.ctrlKey)) {
    const k = e.key.toLowerCase();
    if (!selBox) return;

    if (k === "c") {
      e.preventDefault();
      const rowsInSel = filtered.slice(selBox.rowStart, selBox.rowEnd + 1);
      const colsInSel = cols.slice(selBox.colStart, selBox.colEnd + 1);
      const grid = rowsInSel.map(r =>
        colsInSel.map(c => (r[c.key] == null ? "" : String(r[c.key]))).join("\t")
      ).join("\n");
      try { await navigator.clipboard.writeText(grid); } catch {}
      return;
    }

    if (k === "v") {
      e.preventDefault();
      let txt = "";
      try { txt = await navigator.clipboard.readText(); } catch {}
      if (!txt) return;

      const lines  = txt.replace(/\r/g, "").split("\n");
      const matrix = lines.map(line => line.split("\t"));
      const H = matrix.length;
      const W = Math.max(...matrix.map(r => r.length || 0));

      if (!selectedCell && !selBox) return;

      const startRowIndex = selectedCell ? selectedCell.rowIndex : selBox.rowStart;
      const startColIndex = selectedCell ? (colIndexByKey.get(selectedCell.colKey) ?? 0) : selBox.colStart;

      const isSingleTarget = !selBox || (selBox.rowStart === selBox.rowEnd && selBox.colStart === selBox.colEnd);
      const destRows = isSingleTarget ? H : (selBox.rowEnd - selBox.rowStart + 1);
      const destCols = isSingleTarget ? W : (selBox.colEnd - selBox.colStart + 1);

      const updates = [];
      for (let dr = 0; dr < destRows; dr++) {
        const rIndex = startRowIndex + dr;
        if (rIndex < 0 || rIndex >= filtered.length) break;
        const row = filtered[rIndex];

        for (let dc = 0; dc < destCols; dc++) {
          const cIndex = startColIndex + dc;
          if (cIndex < 0 || cIndex >= cols.length) break;
          const col = cols[cIndex];
          if (!col || col.type === "formula" || col.readOnly) continue;

          const srcR = Math.min(dr, H - 1);
          const srcC = Math.min(dc, (matrix[srcR]?.length || 0) - 1);
          const raw = (matrix[srcR] && matrix[srcR][srcC] != null) ? matrix[srcR][srcC] : "";
          const value = col.type === "number"
            ? (raw === "" ? "" : String(raw).replace(",", "."))
            : raw;

          updates.push({ id: row.id, key: col.key, value });
        }
      }

      if (updates.length) setManyCells(updates);

      const lastRow = Math.min(startRowIndex + destRows - 1, filtered.length - 1);
      const lastCol = Math.min(startColIndex + destCols - 1, cols.length - 1);
      setSelectedCell({ rowIndex: startRowIndex, colKey: cols[startColIndex].key });
      setSelBox({ rowStart: startRowIndex, rowEnd: lastRow, colStart: startColIndex, colEnd: lastCol });
      setActiveCell?.({ rowIndex: startRowIndex, colKey: cols[startColIndex].key });
      scrollCellIntoView(lastRow, cols[lastCol].key);
      return;
    }
  }

  // 2) Taper un caractère hors champ -> éditer
  if (!inField && e.key.length === 1 && !e.altKey && !e.metaKey && !e.ctrlKey && selectedCell) {
    const { rowIndex, colKey } = selectedCell;
    const col = colsByKey[colKey];
    if (col && !col.readOnly && !["formula","button","photo","detail"].includes(col.type)) {
      e.preventDefault();
      setEditing({ rowId: filtered[rowIndex].id, colKey });
      requestAnimationFrame(() => {
        const td = getTdRef(rowIndex, colKey);
        const el = td?.querySelector('input:not([type="checkbox"]), textarea, select');
        if (!el) return;
        el.focus();
        if ("value" in el && typeof el.value === "string") {
          el.value = e.key;
          const evt = new Event("input", { bubbles: true });
          el.dispatchEvent(evt);
          el.setSelectionRange?.(el.value.length, el.value.length);
        }
      });
    }
    return;
  }

  // 3) ENTER — géré au niveau tableau seulement si on n’est PAS dans un champ
if (e.key === "Enter") {
  // Si on est dans un input/textarea/select, on laisse InputCell s'en occuper.
  if (inField) return;

  e.preventDefault();
  if (!selectedCell) return;

  const { rowIndex, colKey } = selectedCell;
  const delta    = e.shiftKey ? -1 : 1;
  const nextRow  = clamp(rowIndex + delta, 0, filtered.length - 1);
  const ci       = colIndexByKey.get(colKey) ?? 0;

  setSelectedCell({ rowIndex: nextRow, colKey });
  setSelBox({ rowStart: nextRow, rowEnd: nextRow, colStart: ci, colEnd: ci });

  const nextCol   = colsByKey[colKey];
  const editable  = nextCol && !nextCol.readOnly && !["formula","button","photo","detail"].includes(nextCol.type);

  if (editable) {
    setEditing({ rowId: filtered[nextRow].id, colKey });
    requestAnimationFrame(() => focusCell(nextRow, colKey, { edit: true }));
  } else {
    focusCell(nextRow, colKey, { edit: false });
  }
  return;
}

  // 4) TAB
  if (e.key === "Tab") {
    e.preventDefault();
    if (!selectedCell) return;
    const { rowIndex, colKey } = selectedCell;
    const cur = colIndexByKey.get(colKey);
    const delta = e.shiftKey ? -1 : 1;
    const nc = Math.max(0, Math.min(cols.length - 1, cur + delta));
    const nextKey = cols[nc].key;

    setSelectedCell({ rowIndex, colKey: nextKey });
    setSelBox({ rowStart: rowIndex, rowEnd: rowIndex, colStart: nc, colEnd: nc });

    const nextCol = colsByKey[nextKey];
    if (nextCol && !nextCol.readOnly && !["formula","button","photo","detail"].includes(nextCol.type)) {
      setEditing({ rowId: filtered[rowIndex].id, colKey: nextKey });
      requestAnimationFrame(() => focusCell(rowIndex, nextKey, { edit: true }));
    } else {
      focusCell(rowIndex, nextKey);
    }
    return;
  }

  // 5) Flèches
  if (!inField && ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
  e.preventDefault();
  if (!selectedCell) return;

  const { rowIndex, colKey } = selectedCell;
  const cur = colIndexByKey.get(colKey) ?? 0;

  let nr = rowIndex, nc = cur;
  if (e.key === "ArrowUp")    nr = Math.max(0, rowIndex - 1);
  if (e.key === "ArrowDown")  nr = Math.min(filtered.length - 1, rowIndex + 1);
  if (e.key === "ArrowLeft")  nc = Math.max(0, cur - 1);
  if (e.key === "ArrowRight") nc = Math.min(cols.length - 1, cur + 1);

  const nextKey = cols[nc].key;

  if (e.shiftKey) {
    // Étend la sélection depuis l’ancre jusqu’à la nouvelle cellule
    ensureAnchor(); // si pas d’ancre, utilise la cellule d’origine
    setSelectedCell({ rowIndex: nr, colKey: nextKey }); // curseur visible
    extendFromAnchorTo(nr, nextKey);                    // met à jour selBox
  } else {
    // Déplacement simple (réinitialise le rectangle)
    setSelAnchor({ rowIndex: nr, colKey: nextKey });
    setSelectedCell({ rowIndex: nr, colKey: nextKey });
    setSelBox({ rowStart: nr, rowEnd: nr, colStart: nc, colEnd: nc });
  }

  focusCell(nr, nextKey, { edit: false });
  return;
}
};

const handleMouseDown = (e, rowIndex, colKey) => {
  if (e.button !== 0) return; // uniquement clic gauche

  // ne pas démarrer si on clique dans un champ éditable
  const t = e.target;
  const tag = t.tagName?.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea" || t.isContentEditable) return;

  const col = colsByKey[colKey];
  if (!isSelectableColumn(col)) return; // <-- important

  const rowId = filtered[rowIndex]?.id;
  if (!rowId) return;

  beginSelection(rowIndex, rowId, colKey, e);
  e.preventDefault();
};

const handleMouseOver = (e, rowIndex, colKey) => {
  const t = e.target;
  const tag = t.tagName?.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea" || t.isContentEditable) return;

  extendSelection(rowIndex, colKey, e);
};

// --- Focus l’élément éditable (input/textarea/select) à l’intérieur d’un <td> ---
const focusEditableInside = (td) => {
  if (!td) return false;
  const el = td.querySelector('input:not([type="checkbox"]), textarea, select');
  if (!el) return false;

  el.focus();

  // 👉 IMPORTANT: ne plus faire select() (ça cause l'auto-sélection gênante)
  // Place simplement le caret à la fin si c’est un input/textarea texte
  if (("selectionStart" in el) && typeof el.value === "string") {
    const end = el.value.length;
    try { el.setSelectionRange(end, end); } catch {}
  }

  return true;
};


const handleClickCell = (e, rowIndex, colKey) => {
  if (e.button !== undefined && e.button !== 0) return; // sécurité: clic gauche seulement s'il y a button

  // ne pas voler le clic des inputs/select/textarea
  const t = e.target;
  const tag = t.tagName?.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea" || t.isContentEditable) return;

  const col = colsByKey[colKey];
  if (!isSelectableColumn(col)) return;

  // 👉 Excel-like: un clic = sélectionne la cellule (PAS d’édition)
  const ci = colIndexByKey.get(colKey);
  if (ci == null) return;

  setSelectedCell({ rowIndex, colKey });

  // activeCell + ancre de sélection + rectangle 1x1
  setActiveCell({ rowIndex, colKey });
  setSelAnchor({ rowIndex, colKey });
  setSelBox({ rowStart: rowIndex, rowEnd: rowIndex, colStart: ci, colEnd: ci });

  // vider un éventuel mode édition et reprendre le focus clavier
  setEditing(null);
  wrapRef.current?.focus?.();

  // stop drag précédent
  draggingRef.current = null;

  e.preventDefault();
};

const handleDoubleClickCell = (e, rowIndex, colKey) => {
  const t = e.target;
  const tag = t.tagName?.toLowerCase();

  // Si on double-clique déjà dans un champ, ne fais rien (le browser a déjà focus)
  if (tag === "input" || tag === "select" || tag === "textarea" || t.isContentEditable) {
    return;
  }

  const col = colsByKey[colKey];
  if (!isSelectableColumn(col)) return;

  // Sélectionne d'abord la cellule
  const ci = colIndexByKey.get(colKey);
  if (ci == null) return;

  setActiveCell({ rowIndex, colKey });
  setSelAnchor({ rowIndex, colKey });
  setSelBox({ rowStart: rowIndex, rowEnd: rowIndex, colStart: ci, colEnd: ci });

  // Puis essaie d'éditer : si un input/select est présent → focus
  const td = e.currentTarget;
  const hadEditable = !!td.querySelector('input:not([type="checkbox"]), textarea, select');
  if (hadEditable) {
    focusEditableInside(td); // focus + select()
  } else {
    // Sinon, on force l’édition (focusCell avec edit=true va chercher l’input rendu par InputCell)
    focusCell(rowIndex, colKey, { edit: true });
  }

  e.preventDefault();
};

  const update = (id, key, value) => {
  // 1) journalisation (si présent chez toi)
  const before = (rows || []).find(r => r.id === id);
  const oldVal = before ? before[key] : undefined;
  if (String(oldVal) !== String(value)) {
    addChange?.(id, key, oldVal, value, currentUser?.name || "Utilisateur");
  }

  // 2) si on modifie la colonne triée, fige le tri pour le prochain render
  if (key === sort?.key) freezeSortOnce?.();

  // 3) applique la saisie + marque la cellule comme "manuelle"
  const changed = (rows || []).map(r => {
    if (r.id !== id) return r;
    return {
      ...r,
      [key]: value,
      __manual: { ...(r.__manual || {}), [key]: true }, // ← important
    };
  });

  // 4) recalcul des formules
  const computed = typeof computeFormulas === "function"
    ? computeFormulas(changed, schema)
    : changed;

  // 5) préserve les valeurs manuelles après le calcul
  const next = computed.map(nr => {
    const pr = changed.find(p => p.id === nr.id);
    if (!pr?.__manual) return nr;
    const out = { ...nr, __manual: pr.__manual };
    for (const k of Object.keys(pr.__manual)) {
      if (pr.__manual[k]) out[k] = pr[k]; // ← on remet la valeur saisie
    }
    return out;
  });

  // 6) commit
  onRowsChange?.(next);
};


  const addRow = () => {
  // Sélection d’un gabarit sûr pour préremplir (si dispo)
  const hasFiltered = Array.isArray(filtered) && filtered.length > 0;
  const hasRows     = Array.isArray(rows) && rows.length > 0;
  const base        = (hasFiltered ? filtered[filtered.length - 1]
                     : hasRows    ? rows[rows.length - 1]
                                  : {}) || {};

  // 🔒 Produit par défaut forcé UNIQUEMENT via tableKey (pour matcher le filtre MinuteEditor)
  const defaultProduit =
    tableKey === "rideaux" ? "Rideau"
  : tableKey === "decors"  ? "Décor de lit"
  :                          "Store Enrouleur"; // 'stores'

  const newRow = {
    id: uid(),
    produit: defaultProduit,
    // on clone quelques champs utiles pour que la ligne passe d'éventuels filtres locaux
    zone: base.zone ?? "",
    piece: base.piece ?? "",
    type_confection: base.type_confection ?? "",
    pair_un: base.pair_un ?? "",
    l_mecanisme: base.l_mecanisme ?? "",
    largeur: base.largeur ?? "",
    hauteur: base.hauteur ?? "",
    f_bas: base.f_bas ?? "",
    croisement: base.croisement ?? "",
    retour_g: base.retour_g ?? "",
    retour_d: base.retour_d ?? "",
    val_ded_rail: base.val_ded_rail ?? "",
    val_ourlet_cote: base.val_ourlet_cote ?? "",
    val_ourlet_haut: base.val_ourlet_haut ?? "",
  };

  // On pousse UNIQUEMENT la sous-liste (DataTable) ; MinuteEditor fusionnera et recalculera
  const safeRows = Array.isArray(rows) ? rows : [];
  const next = [...safeRows, newRow];
  onRowsChange(next);

  // scroll jusqu'en bas pour rendre la nouvelle ligne visible
  requestAnimationFrame(() => {
    if (wrapRef?.current) {
      wrapRef.current.scrollTop = wrapRef.current.scrollHeight;
    }
  });
};

  const onSaveCol = (key, patch) => {
    setSchema((s) => {
      const idx = s.findIndex((c) => c.key === key);
      if (idx === -1) return s;
      const next = [...s];
      next[idx] = { ...next[idx], ...patch, options: patch.options ?? next[idx].options };
      return next;
    });
  };

  const HeaderSelectAll = ({ all, some, onToggle }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some && !all;
  }, [all, some]);

  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
      <input
        ref={ref}
        type="checkbox"
        checked={all}
        onChange={(e) => onToggle(e.target.checked)}
        aria-checked={some && !all ? "mixed" : all}
      />
      <span>Sélec.</span>
    </label>
  );
};
  const SortLabel = ({ columnKey, children }) => {
    const active = sort.key === columnKey;
    const DirIcon = sort.dir === "asc" ? ChevronUp : ChevronDown;
    return (
      <button
        onClick={() =>
          setSort((s) => ({
            key: columnKey,
            dir: s.key === columnKey && s.dir === "asc" ? "desc" : "asc",
          }))
        }
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
      >
        <span>{children}</span>
        {active && <DirIcon size={14} />}
      </button>
    );
  };

  const AggSelect = ({ col }) => {
  const options = isNumericCol(col) ? AGG_NUMERIC : AGG_NON_NUM;
  const value   = aggByCol?.[col.key] || "none";

  const setVal = (v) => setAggByCol(s => ({ ...(s || {}), [col.key]: v }));

  // petit select compact
  return (
    <select
      value={value}
      onChange={(e) => setVal(e.target.value)}
      title="Agrégat de colonne"
      style={{
        fontSize: 12,
        padding: "2px 6px",
        borderRadius: 6,
        border: `1px solid ${COLORS.border}`,
        background: "#fff",
      }}
    >
      {options.map(o => (
        <option key={o} value={o}>
          {o === "none" ? "Aucune"
           : o === "sum" ? "Somme"
           : o === "avg" ? "Moyenne"
           : o === "filled" ? "Remplies"
           : o === "empty" ? "Vides"
           : o === "unique" ? "Unique"
           : o}
        </option>
      ))}
    </select>
  );
};

  // ==== Étape 6 — Menu d'en-tête façon Airtable ====


// rendu du menu
const HeaderMenu = ({ anchor }) => {
  if (!anchor) return null;
  const k = anchor.key;
  const col = colsByKey[k];
  if (!col) return null;
  const lock = MIN_COLS.includes(k);

  return (
    <>
      {/* backdrop pour clic extérieur */}
      <div
        onClick={closeMenu}
        style={{ position: "fixed", inset: 0, zIndex: 999 }}
      />
      <div
        style={{
          position: "fixed",
          left: anchor.x,
          top: anchor.y,
          width: 280,
          maxHeight: "70vh",
          overflow: "auto",
          background: "#fff",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          boxShadow: "0 12px 28px rgba(0,0,0,.18)",
          zIndex: 1000
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 700 }}>
          {col.label}
        </div>

        <div style={{ padding: 6, display: "grid", gap: 4 }}>
          <button style={S.smallBtn} onClick={() => { setEditColKey(k); closeMenu(); }}>
            ✏️ Modifier le champ
          </button>
          <button style={S.smallBtn} onClick={() => duplicateField(k)}>
            🧬 Dupliquer le champ
          </button>
          <button style={S.smallBtn} onClick={() => insertLeft(k)}>
            ↩︎ Insérer à gauche
          </button>
          <button style={S.smallBtn} onClick={() => insertRight(k)}>
            ↪︎ Insérer à droite
          </button>

          <div style={{ height: 1, background: COLORS.border, margin: "6px 0" }} />

          <button style={S.smallBtn} onClick={() => sortAsc(k)}>
            🔼 Trier 1 → 9 / A → Z
          </button>
          <button style={S.smallBtn} onClick={() => sortDesc(k)}>
            🔽 Trier 9 → 1 / Z → A
          </button>

          <button style={S.smallBtn} onClick={() => quickFilterNotEmpty(k)}>
            🔎 Filtrer: non vide
          </button>
          <button style={S.smallBtn} onClick={() => groupByThis(k)}>
            🧩 Grouper selon ce champ
          </button>

          <div style={{ height: 1, background: COLORS.border, margin: "6px 0" }} />

          <button style={{ ...S.smallBtn, opacity: lock ? .5 : 1 }} disabled={lock} onClick={() => hideField(k)}>
            🙈 Masquer le champ
          </button>

          <button
  style={{ ...S.smallBtn, color: "#b91c1c", borderColor: COLORS.border, opacity: lock ? .5 : 1 }}
  disabled={lock}
  onClick={() => removeField(k)}
>
  🗑️ Supprimer le champ
</button>

        </div>
      </div>
    </>
  );
};


  const closeMenu = () => setMenu(null);

  // Masquer une colonne (sauf protégées)
  const hideField = (key) => {
    const MIN_COLS = ["sel", "detail"];
    if (MIN_COLS.includes(key)) return; // protégées
    setVisibleCols(cols => cols.filter(k => k !== key));
    closeMenu();
  };

  // Supprimer complètement une colonne du schéma
const removeField = (key) => {
  if (MIN_COLS.includes(key)) return; // sel/detail protégées

  // 1) Retirer du schéma
  setSchema((sc) => sc.filter((c) => c.key !== key));

  // 2) Nettoyer tous les états liés
  setVisibleCols((cols) => (cols || []).filter((k) => k !== key));
  setOrder((ord) => (ord || []).filter((k) => k !== key));
  setFilters((fs) => (fs || []).filter((f) => f.key !== key));
  setGroupBy((g) => (g?.key === key ? null : g));
  setSort((s) => (s.key === key ? { key: firstSortable, dir: "asc" } : s));

  // (optionnel) ne touche pas aux rows : avoir une clé orpheline dans l’objet ne gêne pas,
  // et l’effet sur le parent recalculera les formules avec le nouveau schéma.

  closeMenu();
};

  // Trier asc/desc sur la colonne
  const sortAsc  = (key) => { setSort({ key, dir: "asc"  }); closeMenu(); };
  const sortDesc = (key) => { setSort({ key, dir: "desc" }); closeMenu(); };

  // Créer une entrée de filtre basique selon le type
  const addFilterFor = (key) => {
    const col = colsByKey[key];
    if (!col) return;
    const base =
      col.type === "number"
        ? { key, op: "gte", value: 0 }
        : col.type === "checkbox"
        ? { key, op: "isTrue", value: true }
        : { key, op: "contains", value: "" }; // texte/select par défaut
    setFilters(fs => [...(fs || []), base]);
    closeMenu();
  };

  // Grouper par cette colonne
  const groupByField = (key) => { setGroupBy({ key }); closeMenu(); };

  // Dupliquer un champ dans le schéma (et copier les valeurs)
  const duplicateField = (key) => {
    const src = colsByKey[key];
    if (!src) return;
    // génère une clé unique
    const baseKey = `${src.key}_copy`;
    let k = baseKey, i = 1;
    const keys = new Set(schema.map(c => c.key));
    while (keys.has(k)) { i += 1; k = `${baseKey}_${i}`; }

    const newCol = {
      ...src,
      key: k,
      label: `${src.label} (copie)`,
      readOnly: src.type === "formula" ? true : src.readOnly
    };

    // insérer la colonne juste à droite dans l'ordre courant
    setSchema(sc => {
      const idx = sc.findIndex(c => c.key === key);
      const next = [...sc];
      next.splice(idx + 1, 0, newCol);
      return next;
    });

    // valeurs copiées
    const nextRows = computeFormulas(
      rows.map(r => ({ ...r, [k]: r[key] })),
      schema
    );
    onRowsChange(nextRows);

    // afficher la colonne si elle était masquée
    setVisibleCols(cols => Array.from(new Set([...cols, k])));

    // mémoriser l'ordre (localStorage) si tu utilises `order`
    setOrder(ord => {
      const cur = ord && ord.length ? [...ord] : schema.map(c => c.key);
      const pos = cur.indexOf(key);
      const out = [...cur];
      out.splice(pos + 1, 0, k);
      return out;
    });

    closeMenu();
  };

const insertField = (key, side = "right") => {
    const srcIndex = schema.findIndex(c => c.key === key);
  if (srcIndex < 0) return;

  // colonne vide par défaut (texte)
  const baseKey = "new_field";
  let k = baseKey, i = 1;
  const keys = new Set(schema.map(c => c.key));
  while (keys.has(k)) { i += 1; k = `${baseKey}_${i}`; }

  const newCol = { key: k, label: "Nouveau champ", type: "text", width: 140 };

  setSchema(sc => {
    const next = [...sc];
    const at = side === "left" ? srcIndex : srcIndex + 1;
    next.splice(at, 0, newCol);
    return next;
  });

  // rendre visible + insérer dans l’ordre
  setVisibleCols(cols => Array.from(new Set([...cols, k])));
  setOrder(ord => {
    const cur = ord && ord.length ? [...ord] : schema.map(c => c.key);
    const at = side === "left" ? cur.indexOf(key) : cur.indexOf(key) + 1;
    const out = [...cur];
    out.splice(at, 0, k);
    return out;
  });

  // rows inchangées (valeurs vides)
  onRowsChange(computeFormulas(rows, schema));
  closeMenu();
};

// Aliases pour compat avec HeaderMenu
 const insertLeft  = (key) => insertField(key, "left");
 const insertRight = (key) => insertField(key, "right");
 const quickFilterNotEmpty = (key) => {
   setFilters((fs) => [...(fs || []), { key, op: "notEmpty" }]);
   closeMenu();
 };
 const groupByThis = (key) => groupByField(key);


  // Copier une « URL » de champ (placeholder local)
  const copyFieldUrl = async (key) => {
    const url = `#/view/${viewKey}/table/${tableKey}/field/${key}`;
    try { await navigator.clipboard.writeText(url); } catch {}
    closeMenu();
  };

  // Ouvrir la modale d’édition (pour description/permissions on réutilise la même)
  const editField = (key) => { setEditColKey(key); closeMenu(); };

  // Masquer via action dédiée
  const hideThisField = (key) => hideField(key);

  return (
    <div style={{ ...S.tableBlock }}>
      <div style={S.tableHeader}>
        <div style={S.tableTitle}>{title}</div>
        <div style={S.tableRight}>
  {/* + Ajouter */}
  <button style={S.smallBtn} title="Ajouter" onClick={addRow}>
    <Plus size={16} />
  </button>

  {/* 🗑️ Supprimer les lignes sélectionnées — À AJOUTER ICI */}
  <button
    style={S.smallBtn}
    title="Supprimer les lignes sélectionnées"
    onClick={deleteSelected}
    disabled={selectedRowIds.size === 0}
  >
    <X size={16} /> Supprimer
  </button>

{/* Filtres */}
  <div style={{ position: "relative", display: "inline-block" }}>
    <button
      style={S.smallBtn}
      title="Filtres"
      onClick={() => setShowFilters(s => !s)}
    >
      <Filter size={16} />
    </button>
    {showFilters && (
      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        schema={schema}
        onClose={() => setShowFilters(false)}
      />
    )}
  </div>

  {/* Regrouper */}
<div style={{ position:"relative" }}>
  <select
    style={S.smallBtn}
    title="Grouper par"
    value={groupBy?.key || ""}
    onChange={(e)=> setGroupBy(e.target.value ? { key: e.target.value } : null)}
  >
    <option value="">— Aucun groupe —</option>
    {cols.filter(c=>c.key!=="sel" && c.key!=="detail").map(c=>(
      <option key={c.key} value={c.key}>{c.label}</option>
    ))}
  </select>
  {groupBy?.key && (
    <button style={S.smallBtn} onClick={()=>setGroupBy(null)}>Annuler le groupe</button>
  )}
</div>

  {/* Favoris */}
  <button style={S.smallBtn} title="Favoris">
    <Star size={16} />
  </button>

  {/* Colonnes */}
  <div style={{ position: "relative" }}>
    <button style={S.smallBtn} title="Colonnes" onClick={() => setShowCols((s) => !s)}>
      <Settings2 size={16} />
    </button>
    {showCols && (
      <ColumnPicker
        visibleCols={visibleCols}
        setVisibleCols={setVisibleCols}
        schema={schema}
        onClose={() => setShowCols(false)}
      />
    )}
  </div>
  <button
  style={{
    ...S.smallBtn,
    background: debugKeys ? "#2563eb" : "#f3f4f6",
    color: debugKeys ? "#fff" : "#111",
  }}
  onClick={() => setDebugKeys(d => !d)}
  title="Afficher les infos de debug (cellule active/sélection, etc.)"
>
  🐞 Debug
</button>

</div>
      </div>

      <div
  style={{ ...S.tableWrap, userSelect: draggingRef.current ? "none" : "auto" }}
  ref={wrapRef}
  tabIndex={0}
  onKeyDown={handleKeyDown}
  onMouseDownCapture={(e) => {
    // Si on clique sur un vrai champ, on laisse faire.
    const t = e.target;
    const tag = t?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    // Si une cellule est en édition, empêche le clic "de transition"
    // de voler le focus avant que l’input ait le temps de blur/commit.
    if (editing) {
      e.preventDefault();
    }
  }}
>
        <table style={{ ...S.table, ...S.tableCompact, minWidth: totalMinWidth }}>
          <thead>
  <tr>
    {cols.map((c, i) => {
      const isSticky = leftOffsets[c.key] !== undefined;
      const stickyStyle = isSticky
        ? { position: "sticky", left: leftOffsets[c.key], zIndex: 3, background: "#fff" }
        : {};

      return (
        <th
          key={c.key}
          style={{
            ...S.th,
            minWidth: c.width || 120,
            position: "relative",
            ...stickyStyle,
            cursor: canDragKey(c.key) ? "grab" : "default",
            opacity: dragColKey === c.key ? 0.6 : 1,
          }}

          /* ==== Drag & Drop (Airtable-like) ==== */
          draggable={canDragKey(c.key)}
          onDragStart={(e) => handleDragStart(e, c.key)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}

          /* ==== Menu contextuel existant ==== */
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ key: c.key, x: e.clientX, y: e.clientY });
          }}
        >
          {/* Barre d’insertion visuelle */}
          {dropIdx != null && (
            <>
              {dropIdx === i && (
                <div
                  style={{
                    position: "absolute",
                    left: -2,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: "#2563eb",
                  }}
                />
              )}
              {dropIdx === i + 1 && (
                <div
                  style={{
                    position: "absolute",
                    right: -2,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: "#2563eb",
                  }}
                />
              )}
            </>
          )}

          {/* Contenu d’en-tête inchangé */}
          <div style={S.thHead}>
            {c.key === "sel" ? (
              <HeaderSelectAll
                all={allVisibleSelected}
                some={someVisibleSelected}
                onToggle={toggleSelectAllVisible}
              />
            ) : (
              <>
                <SortLabel columnKey={c.key}>{c.label}</SortLabel>
                <button
                  title="Modifier le champ"
                  onClick={() => setEditColKey(c.key)}
                  style={{ border: "none", background: "transparent", cursor: "pointer" }}
                >
                  <Edit3 size={14} />
                </button>
                <button
                  title="Menu"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setMenu({ key: c.key, x: r.left, y: r.bottom });
                  }}
                  style={{ border: "none", background: "transparent", cursor: "pointer" }}
                >
                  <MoreVertical size={16} />
                </button>
              </>
            )}
          </div>
        </th>
      );
    })}
  </tr>
</thead>
          <tbody>
  {!groupBy?.key ? (
    /* ========= Rendu PLAT ========= */
    filtered.map((r, idx) => (
      <tr key={r.id} style={idx % 2 ? S.trAlt : undefined}>
        {cols.map((c) => (
          <td
            key={c.key}
            ref={(el) => setTdRef(idx, c.key, el)}
            tabIndex={-1}
            data-row={idx}
            data-col={c.key}
            onMouseDown={(e) => handleMouseDown(e, idx, c.key)}
            onMouseOver={(e) => handleMouseOver(e, idx, c.key)}
            onClick={(e) => handleClickCell(e, idx, c.key)}
            onDoubleClick={(e) => handleDoubleClickCell(e, idx, c.key)}
            style={{
              ...S.td,
              ...(isSticky(c.key)
  ? {
      position: "sticky",
      left: leftOffsets[c.key],
      zIndex: 3,
      background: "#fff",
    }
  : {}),
              ...(isSelected(idx, c.key)
  ? {
      outline: debugKeys ? "2px solid #10b981" : "2px solid #2563eb",
      outlineOffset: -2,
      boxShadow: `inset 0 0 0 1px ${debugKeys ? "#10b98133" : "#2563eb22"}`,
    }
  : {}),
            }}
          >
            {c.key === "detail" ? (
              <button style={S.smallBtn} onClick={() => setDetailRow(r)}>
                Ouvrir <ChevronRight size={14} />
              </button>
            ) : c.key === "sel" ? (
              <input
                type="checkbox"
                checked={!!r.sel}
                onChange={(e) => update(r.id, "sel", e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <InputCell
                row={r}
                col={c}
                isEditing={isCellEditing(r.id, c.key)}
                onStartEdit={() => startEdit(idx, r.id, c.key)}
                onEndEdit={() => stopEdit()}
                onChange={(k, v) => update(r.id, k, v)}
                onOpenLightbox={(images, startIndex = 0) => {
                  if (!Array.isArray(images) || images.length === 0) return;
                  setLightbox({ images, index: startIndex });
                }}
                onEnter={(shift) => {
  stopEdit();
  handleFieldEnter(r.id, c.key, { shift });
}}
              />
            )}
          </td>
        ))}
      </tr>
    ))
  ) : (
    /* ========= Rendu GROUPÉ ========= */
    groups.map(([gv, rowsIn], gi) => {
      const isCol = !!collapsed[String(gv)];
      const count = rowsIn.length;
      return (
        <React.Fragment key={`grp_${gv}_${gi}`}>
          <tr style={{ background: "#fafafa" }}>
            <td colSpan={cols.length} style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>
              <button
                onClick={() => toggleGroup(gv)}
                style={{ ...S.smallBtn, marginRight: 8 }}
                title={isCol ? "Déplier" : "Replier"}
              >
                {isCol ? "▶" : "▼"}
              </button>
              <b>{String(gv) || "(sans valeur)"}</b>
              <span style={{ opacity: 0.6, marginLeft: 6 }}>— {count} ligne(s)</span>
            </td>
          </tr>

          {!isCol &&
            rowsIn.map((r) => {
              const absIdx = rowIndexById.get(r.id) ?? 0;
              return (
                <tr key={r.id}>
                  {cols.map((c) => (
                    <td
                      key={c.key}
                      data-row={absIdx}
                      data-col={c.key}
                      ref={(el) => setTdRef(absIdx, c.key, el)}
                      onMouseDown={(e) => handleMouseDown(e, absIdx, c.key)}
                      onMouseOver={(e) => handleMouseOver(e, absIdx, c.key)}
                      onClick={(e) => handleClickCell(e, absIdx, c.key)}
                      onDoubleClick={(e) => handleDoubleClickCell(e, absIdx, c.key)}
                      style={{
                        ...S.td,
                        ...(isSticky(c.key)
  ? {
      position: "sticky",
      left: leftOffsets[c.key],
      zIndex: 3,
      background: "#fff",
    }
  : {}),
                        ...(isSelected(absIdx, c.key)
                          ? {
      outline: debugKeys ? "2px solid #10b981" : "2px solid #2563eb",
      outlineOffset: -2,
      boxShadow: `inset 0 0 0 1px ${debugKeys ? "#10b98133" : "#2563eb22"}`,
    }
  : {}),
                      }}
                    >
                      {c.key === "detail" ? (
                        <button style={S.smallBtn} onClick={() => setDetailRow(r)}>
                          Ouvrir <ChevronRight size={14} />
                        </button>
                      ) : c.key === "sel" ? (
                        <input
                          type="checkbox"
                          checked={!!r.sel}
                          onChange={(e) => update(r.id, "sel", e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <InputCell
                          row={r}
                          col={c}
                          isEditing={isCellEditing(r.id, c.key)}
                          onStartEdit={() => startEdit(absIdx, r.id, c.key)}
                          onEndEdit={() => stopEdit()}
                          onChange={(k, v) => update(r.id, k, v)}
                          onOpenLightbox={(images, startIndex = 0) => {
                            if (!Array.isArray(images) || images.length === 0) return;
                            setLightbox({ images, index: startIndex });
                          }}
                          onEnter={(shift) => {
  stopEdit();
  handleFieldEnter(r.id, c.key, { shift });
}}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
        </React.Fragment>
      );
    })
  )}
</tbody>
<tfoot>
  <tr>
    {cols.map((c) => (
      <td
        key={c.key}
        style={{
          ...S.td,
          position: leftOffsets[c.key] !== undefined ? "sticky" : undefined,
          left: leftOffsets[c.key],
          zIndex: leftOffsets[c.key] !== undefined ? 1 : undefined,
          background: "#fafafa",
          borderTop: `1px solid ${COLORS.border}`,
          // un peu de style “footer”
          fontSize: 12,
          color: "#111827",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ opacity: footerAggValues[c.key] ? 1 : .55 }}>
            {footerAggValues[c.key] || "—"}
          </div>
          {/* pas d’agrégat pour les colonnes protégées si tu veux */}
          {!["detail"].includes(c.key) && (
            <AggSelect col={c} />
          )}
        </div>
      </td>
    ))}
  </tr>
</tfoot>
        </table>
      </div>
      {debugKeys && (
  <div style={{ 
    marginTop: 8, 
    padding: 8, 
    border: `1px dashed ${COLORS.border}`, 
    borderRadius: 8, 
    background: "#fafafa", 
    fontSize: 12, 
    lineHeight: 1.5 
  }}>
    <div><b>Cellule sélectionnée</b> : {selectedCell ? `${selectedCell.rowIndex} :: ${selectedCell.colKey}` : "(aucune)"}</div>
    <div><b>Cellule active</b> : {activeCell ? `${activeCell.rowIndex} :: ${activeCell.colKey}` : "(aucune)"}</div>
    <div>
      <b>Rectangle sélectionné</b> :{" "}
      {selBox
        ? `rows ${selBox.rowStart} → ${selBox.rowEnd}, cols ${selBox.colStart} → ${selBox.colEnd}`
        : "(aucun)"}
    </div>
    <div><b>Tri</b> : {sort.key} ({sort.dir})</div>
    <div><b>Groupe</b> : {groupBy?.key || "—"}</div>
    <div><b>Filtres</b> : {filters?.length ? JSON.stringify(filters) : "—"}</div>
    <div><b>Colonnes visibles</b> : {Array.isArray(visibleCols) ? visibleCols.join(", ") : "—"}</div>
  </div>
)}
      {detailRow && (
        <RowFormModal
          row={detailRow}
          schema={schema}
          onClose={() => setDetailRow(null)}
          onSave={(val) => {
            const next = computeFormulas(
              rows.map((r) => (r.id === val.id ? val : r)),
              schema
            );
            onRowsChange(next);
          }}
          visibleKeys={cols.map(c => c.key)}
        />
      )}

      {detailRow && (
  <ActivitySidebar
    row={detailRow}
    onClose={() => setDetailRow(null)}
  />
)}

      {editColKey && (
        <EditFieldModal
          col={colsByKey[editColKey]}
          onClose={() => setEditColKey(null)}
          onSave={(patch) => onSaveCol(editColKey, patch)}
        />
      )}
      {lightbox && (
        <LightboxModal
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onPrev={() => {
            setLightbox((lb) => ({
              ...lb,
              index: (lb.index - 1 + lb.images.length) % lb.images.length
            }))
          }}
          onNext={() => {
            setLightbox((lb) => ({
              ...lb,
              index: (lb.index + 1) % lb.images.length
            }))
          }}
        />
      )}

        {menu && <HeaderMenu anchor={menu} />}
  </div>
);
}


// =============== Écran Projet ===============
const STAGES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "prise", label: "Prise de cotes" },
  { key: "bpf", label: "Bon pour fab" },
  { key: "etiquettes", label: "Etiquettes" },
  { key: "installation", label: "Installation" },
];

// === Dashboard helpers ===
const DONE = "Terminé";

function dashCompute(rows) {
  const total = rows.length;

  const val = (r, k) => (r && r[k] != null ? String(r[k]) : "");

  const isDone = (v) => v === DONE;

  // Compteurs par étape
  let prepDone = 0, confDone = 0, poseDone = 0, fullDone = 0;

  // Totaux d'heures
  let hConf = 0, hPose = 0;

  for (const r of rows) {
    if (isDone(val(r, "statut_preparation"))) prepDone++;
    if (isDone(val(r, "statut_confection")))  confDone++;
    if (isDone(val(r, "statut_pose")))        poseDone++;

    if (
      isDone(val(r, "statut_preparation")) &&
      isDone(val(r, "statut_confection")) &&
      isDone(val(r, "statut_pose"))
    ) fullDone++;

    const hc = Number(r.heures_confection);
    const hp = Number(r.heures_pose);
    if (Number.isFinite(hc)) hConf += hc;
    if (Number.isFinite(hp)) hPose += hp;
  }

  const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0);

  return {
    total,
    steps: {
      preparation: { done: prepDone, pct: pct(prepDone, total) },
      confection:  { done: confDone, pct: pct(confDone, total) },
      pose:        { done: poseDone, pct: pct(poseDone, total) },
    },
    full: { done: fullDone, pct: pct(fullDone, total) },
    hours: {
      sumConfection: hConf,
      sumPose: hPose,
    }
  };
}

function DashboardTiles({ rows, projectHours }) {
  const d = React.useMemo(() => dashCompute(rows), [rows]);

  const ph = projectHours || { confectionReport: 0, poseReport: 0 };

  const Tile = ({ title, val, sub }) => (
    <div style={{
      background:"#fff", border:"1px solid #e5e7eb", borderRadius:12,
      padding:16, minWidth:220, boxShadow:"0 1px 2px rgba(0,0,0,.04)"
    }}>
      <div style={{ fontSize:14, fontWeight:700 }}>{title}</div>
      <div style={{ fontSize:28, fontWeight:800, marginTop:6 }}>{val}</div>
      {sub && <div style={{ fontSize:12, opacity:.7, marginTop:4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display:"grid", gap:16 }}>
      {/* Ligne 1 : Avancement par étape */}
      <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
        <Tile
          title="Préparation — terminé"
          val={`${d.steps.preparation.done} / ${d.total}`}
          sub={`${d.steps.preparation.pct}%`}
        />
        <Tile
          title="Confection — terminé"
          val={`${d.steps.confection.done} / ${d.total}`}
          sub={`${d.steps.confection.pct}%`}
        />
        <Tile
          title="Pose — terminé"
          val={`${d.steps.pose.done} / ${d.total}`}
          sub={`${d.steps.pose.pct}%`}
        />
        <Tile
          title="Cumulé (prépa + conf + pose)"
          val={`${d.full.done} / ${d.total}`}
          sub={`${d.full.pct}%`}
        />
      </div>

      {/* Ligne 2 : Heures */}
      <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
        <Tile
          title="Heures confection (somme lignes)"
          val={`${d.hours.sumConfection.toLocaleString("fr-FR")} h`}
        />
        <Tile
          title="Heures pose (somme lignes)"
          val={`${d.hours.sumPose.toLocaleString("fr-FR")} h`}
        />
        <Tile
          title="Déclaré (projet) — confection"
          val={`${Number(ph.confectionReport||0).toLocaleString("fr-FR")} h`}
        />
        <Tile
          title="Déclaré (projet) — pose"
          val={`${Number(ph.poseReport||0).toLocaleString("fr-FR")} h`}
        />
      </div>
    </div>
  );
}

// ================ MinuteEditor (tableau des lignes d'une minute) =================
function MinuteEditor({ minute, onChangeMinute }) {
  const [rows, setRows] = React.useState(() =>
    computeFormulas(minute?.lines || [], CHIFFRAGE_SCHEMA)
  );

  // Ignorer une resync quand la modif vient d'ici
const skipNextSyncRef = React.useRef(false);

  // Resync UNIQUEMENT quand on change de minute (id). On ne se réécrit pas à chaque
  // changement de minute.lines (ça provoquait le "flash → disparition").
  React.useEffect(() => {
    setRows(computeFormulas(minute?.lines || [], CHIFFRAGE_SCHEMA));
  }, [minute?.id]);

  // Modules actifs (fallback = tous cochés pour anciennes minutes)
  const mods = minute?.modules || { rideau: true, store: true, decor: true };

  // Sous-ensembles par module
  const rowsRideaux = rows.filter((r) => /rideau|voilage/i.test(String(r.produit || "")));
  const rowsDecors  = rows.filter((r) => /d[ée]cor/i.test(String(r.produit || "")));
  const rowsStores  = rows.filter((r) => /store/i.test(String(r.produit || "")));

// Id unique si absent
const uid = () => Math.random().toString(36).slice(2, 9);

// Produit par défaut cohérent selon le tableau courant
const ensureProduitFor = (key, r) => {
  if (r?.produit) return r;
  if (key === "rideaux") return { ...r, produit: "Rideau" };
  if (key === "decors")  return { ...r, produit: "Décor de lit" };
  if (key === "stores")  return { ...r, produit: "Store Enrouleur" };
  return r;
};

// S'assure que chaque ligne a un id
const withIds = (arr) => (Array.isArray(arr) ? arr : []).map((r) => (r?.id ? r : { ...r, id: uid() }));
  
  // Réinjecte TOUT le sous-tableau (ajouts + edits) dans rows
  const mergeChildRowsFor = (key) => (childRows) => {
  // On normalise d’abord la sous-liste reçue du DataTable :
  // - produit par défaut selon la table (rideaux/decors/stores)
  // - id garanti
  const normalizedChild = withIds((childRows || []).map((r) => ensureProduitFor(key, r)));

  // Garder uniquement les lignes des AUTRES sous-ensembles
  const isInSubset = (r) => {
    const p = String(r.produit || "");
    if (key === "rideaux") return /rideau|voilage/i.test(p);
    if (key === "decors")  return /d[ée]cor/i.test(p);
    if (key === "stores")  return /store/i.test(p);
    return false;
  };
  const others = (rows || []).filter((r) => !isInSubset(r));

  // Fusion + recalcul des formules
  const next = [...others, ...normalizedChild];
  const withFx = computeFormulas(next, CHIFFRAGE_SCHEMA);

  // Commit local (remontée au parent se fait via l'useEffect plus bas)
  skipNextSyncRef.current = true;   // ⬅️ indique que la prochaine resync est à ignorer
setRows(withFx);
};

  // Remonte au parent à chaque modif
  React.useEffect(() => {
    onChangeMinute?.({ ...minute, lines: rows, updatedAt: Date.now() });
  }, [rows]);

  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
      {/* En-tête de l’éditeur (nom, version, statut, infos) */}
      <div style={{
        padding: 10, borderBottom: `1px solid ${COLORS.border}`, background: "#fff",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <b>{minute?.name || "Minute sans nom"}</b>
            <span style={{ opacity: .6 }}>v{minute?.version ?? 1}</span>
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
            Chargé·e : <b>{minute?.owner || "—"}</b>
            {" · "}Créé le {new Date(minute?.createdAt || Date.now()).toLocaleDateString("fr-FR")}
            {" · "}Modules :
            {minute?.modules?.rideau && " Rideaux"}
            {minute?.modules?.store &&  " · Stores"}
            {minute?.modules?.decor &&  " · Décors de lit"}
          </div>
          {minute?.notes && (
            <div style={{ fontSize: 12, color: "#334155", marginTop: 6, whiteSpace: "pre-wrap" }}>
              {minute.notes}
            </div>
          )}
        </div>

        <select
          value={minute?.status || "Non commencé"}
          onChange={(e)=> onChangeMinute?.({ ...minute, status: e.target.value, updatedAt: Date.now() })}
          style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white" }}
        >
          <option>Non commencé</option>
          <option>En cours d’étude</option>
          <option>À valider</option>
          <option>Validé</option>
        </select>
      </div>

      {/* 1/2/3 tableaux selon modules */}
      <>
        {mods.rideau && (
          <DataTable
            title="Rideaux"
            tableKey="rideaux"
            rows={rowsRideaux}
            onRowsChange={mergeChildRowsFor("rideaux")}
            schema={CHIFFRAGE_SCHEMA}
            setSchema={() => {}}     // on fige le schéma côté minutes
            searchQuery=""
            viewKey="minutes"
          />
        )}

        {mods.decor && (
          <DataTable
            title="Décors de lit"
            tableKey="decors"
            rows={rowsDecors}
            onRowsChange={mergeChildRowsFor("decors")}
            schema={CHIFFRAGE_SCHEMA}
            setSchema={() => {}}
            searchQuery=""
            viewKey="minutes"
          />
        )}

        {mods.store && (
          <DataTable
            title="Stores"
            tableKey="stores"
            rows={rowsStores}
            onRowsChange={mergeChildRowsFor("stores")}
            schema={CHIFFRAGE_SCHEMA}
            setSchema={() => {}}
            searchQuery=""
            viewKey="minutes"
          />
        )}
      </>
    </div>
  );
}

// ====================== MinutesScreen (liste + éditeur + export) =================
function MinutesScreen({ onExportToProduction }) {
  const [minutes, setMinutes] = useLocalStorage("minutes.v1", DEMO_MINUTES);
  const [selId, setSelId] = React.useState(minutes?.[0]?.id || null);
  const selected = minutes.find(m => m.id === selId) || null;

  const createMinute = () => {
        const now = Date.now();
    const m = {
      id: uid(),
      name: "Nouvelle minute",
      client: "",
      version: 1,
      notes: "",
      lines: [],
      // ▼ paramètres par défaut (drawer)
      params: [
        { id: uid(), name: "taux_horaire",     type: "prix", value: 135 },
        { id: uid(), name: "prix_achat_tissu", type: "prix", value: null },
        { id: uid(), name: "nuit_hotel",       type: "prix", value: 150 },
      ],
      // ▼ tableau “déplacements” prêt (même si vide au départ)
      deplacements: [],
      createdAt: now,
      updatedAt: now,
    };
    setMinutes((a)=> [m, ...(a||[])]);
    setSelId(m.id);
  };

    const duplicateMinute = (id) => {
    const src = minutes.find(m => m.id === id);
    if (!src) return;
    const copy = {
      ...src,
      id: uid(),
      name: src.name + " (copie)",
      version: (src.version || 1) + 1,
     // lignes recopiées avec nouveaux ids
     lines: (src.lines || []).map(l => ({ ...l, id: uid() })),
     // params recopiés avec nouveaux ids (si présents)
     params: (src.params || []).map(p => ({ ...p, id: uid() })),
     // déplacements recopiés avec nouveaux ids (si tu stockes un id par ligne)
     deplacements: (src.deplacements || []).map(d => ({ ...d, id: uid() })),
     updatedAt: Date.now(),
    };
    setMinutes([copy, ...minutes]);
    setSelId(copy.id);
  };

  const deleteMinute = (id) => {
    if (!confirm("Supprimer cette minute ?")) return;
    const next = (minutes || []).filter(m => m.id !== id);
    setMinutes(next);
    if (selId === id) setSelId(next?.[0]?.id || null);
  };

  const saveMinute = (patch) => {
    setMinutes((arr) => arr.map(m => (m.id === patch.id ? { ...m, ...patch } : m)));
  };

  const exportSelected = () => {
    if (!selected) return;
    const mapped = mapMinuteLinesToProductionRows(selected.lines || []);
    onExportToProduction(mapped, selected);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
      {/* Colonne gauche : liste */}
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Minutes</b>
          <button style={S.smallBtn} onClick={createMinute}>+ Nouvelle</button>
        </div>
        <div style={{ maxHeight: 520, overflow: "auto" }}>
          {(minutes || []).map((m) => (
            <div
              key={m.id}
              onClick={() => setSelId(m.id)}
              style={{
                padding: 10,
                borderBottom: `1px solid ${COLORS.border}`,
                cursor: "pointer",
                background: selId === m.id ? "#eef2ff" : "#fff"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 12, opacity: .7 }}>v{m.version} — {(m.lines||[]).length} ligne(s)</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={S.smallBtn} title="Dupliquer" onClick={(e)=>{ e.stopPropagation(); duplicateMinute(m.id); }}>🧬</button>
                  <button style={{ ...S.smallBtn, color: "#b91c1c" }} title="Supprimer" onClick={(e)=>{ e.stopPropagation(); deleteMinute(m.id); }}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
          {!minutes?.length && (
            <div style={{ padding: 12, opacity: .7 }}>Aucune minute. Crée la première.</div>
          )}
        </div>
      </div>

      {/* Colonne droite : éditeur + export */}
      <div style={{ display: "grid", gap: 12 }}>
        {/* Métadonnées minute */}
        {selected ? (
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: .7 }}>Nom</div>
                <input
                  value={selected.name || ""}
                  onChange={(e)=> saveMinute({ ...selected, name: e.target.value })}
                  style={S.input}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: .7 }}>Client</div>
                <input
                  value={selected.client || ""}
                  onChange={(e)=> saveMinute({ ...selected, client: e.target.value })}
                  style={S.input}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 12, opacity: .7 }}>Notes</div>
                <textarea
                  value={selected.notes || ""}
                  onChange={(e)=> saveMinute({ ...selected, notes: e.target.value })}
                  style={{ ...S.input, height: 70 }}
                />
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={S.smallBtn} onClick={exportSelected}>⇪ Exporter vers Production</button>
            </div>
          </div>
        ) : null}

        {/* Table des lignes */}
        {selected ? (
          <MinuteEditor
            minute={selected}
            onChangeMinute={(m)=> saveMinute(m)}
          />
        ) : (
          <div style={{ padding: 20, border: `1px dashed ${COLORS.border}`, borderRadius: 12, textAlign: "center" }}>
            Sélectionne ou crée une minute pour commencer.
          </div>
        )}
      </div>
    </div>
  );
}


function ProductionProjectScreen({ projectName, onBack }){
  const [stage, setStage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [schema, setSchema] = useState(SCHEMA_64);
  const [rows, setRows] = useState(()=> computeFormulas(DEMO_MASTER_ROWS, SCHEMA_64));
  useEffect(()=>{ setRows((rs)=> computeFormulas(rs, schema)); }, [schema]);
  // --- MERGE FIX : accepte aussi les nouvelles lignes créées dans un tableau enfant
  const mergeChildRowsFor = (tableKey) => {
  return (nr) => {
    setRows((all) => {
      const isInTable = (r) => {
        const p = String(r?.produit || "");
        if (tableKey === "rideaux") return /rideau|voilage/i.test(p);
        if (tableKey === "decors")  return /d[ée]cor/i.test(p); // gère "decor"/"décor"
        if (tableKey === "stores")  return /store/i.test(p);
        return false;
      };

      const others = all.filter((r) => !isInTable(r));
      return computeFormulas([...(others || []), ...(nr || [])], schema);
    });
  };
};

// Segments visibles
const rowsRideaux = rows.filter((r) => /rideau|voilage/i.test(String(r.produit)));
const rowsDecors  = rows.filter((r) => /d[ée]cor/i.test(String(r.produit)));
const rowsStores  = rows.filter((r) => /store/i.test(String(r.produit)));

  return (
    <div style={S.contentWide}>
      <div style={{ margin: "4px 0 12px", color: COLORS.text, fontWeight: 600 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", color: COLORS.text }}>Production</button>
        {" / "}<span style={{ fontWeight: 800 }}>{projectName}</span>
      </div>

      <div style={S.pills}>
        {STAGES.map((p)=> (
          <button key={p.key} style={S.pill(stage===p.key)} onClick={()=>setStage(p.key)}>{p.label}</button>
        ))}
      </div>

      <div style={S.searchRow}>
        <div style={S.searchBox}>
          <Search size={18} style={{ position: "absolute", left: 10, top: 12, opacity: .6 }} />
          <input placeholder="Recherche" value={search} onChange={(e)=>setSearch(e.target.value)} style={S.searchInput} />
        </div>
        <div style={S.toolsRow}>
          <span style={S.toolBtn}><Filter size={16}/> Filtre</span>
          <span style={S.toolBtn}><Layers3 size={16}/> Regrouper</span>
          <span style={S.toolBtn}><Star size={16}/> Favoris</span>
        </div>
      </div>

      {/* === DASHBOARD === */}
{stage === "dashboard" && (
  <DashboardTiles
    rows={rows}
    // tu peux mettre 0/0 pour démarrer, on branchera plus tard sur des inputs projet
    projectHours={{ conf: 0, pose: 0 }}
  />
)}
{stage === "chiffrage" && (
  <MinutesScreen
    onExportToProduction={(mappedRows, minute) => {
      // Ajoute les lignes mappées au tableau Production
      setRows((rs) => computeFormulas([...(rs || []), ...mappedRows], schema));
      alert(`Exporté ${mappedRows.length} ligne(s) depuis "${minute?.name || "Minute"}" vers Production.`);
    }}
  />
)}
      {stage === "etiquettes" && (
  // 👉 Rideaux + Stores (pas Décors) — titres Étiquettes
  <div style={S.contentWide}>
    <EtiquettesSection
      title="Etiquettes Rideaux"
      tableKey="rideaux"
      rows={rowsRideaux}
      schema={schema}
    />
    <EtiquettesSection
      title="Etiquettes Stores"
      tableKey="stores"
      rows={rowsStores}
      schema={schema}
    />
  </div>
)}

{stage === "prise" && (
  // 👉 Prise de cotes = 2 tableaux (Rideaux + Stores), titres + presets
  <>
    <DataTable
      title="PRISE DE COTE RIDEAU"
      tableKey="rideaux"
      rows={rowsRideaux}
      onRowsChange={mergeChildRowsFor("rideaux")}
      schema={schema}
      setSchema={setSchema}
      searchQuery={search}
      viewKey="prise"
    />
    <DataTable
      title="PRISE DE COTE STORE"
      tableKey="stores"
      rows={rowsStores}
      onRowsChange={mergeChildRowsFor("stores")}
      schema={schema}
      setSchema={setSchema}
      searchQuery={search}
      viewKey="prise"
    />
  </>
)}

{stage === "installation" && (
  // 👉 Installation = 1 seul tableau cumulant tout
  <DataTable
    title="Suivi Installation / Livraison"
    tableKey="all"
    rows={rows} // toutes les lignes (rideaux + décors + stores)
    onRowsChange={(nr) => setRows(computeFormulas(nr, schema))}
    schema={schema}
    setSchema={setSchema}
    searchQuery={search}
    viewKey="installation"
  />
)}

{stage === "bpf" && (
  <>
    <DataTable
      title="BPF Rideaux"
      tableKey="rideaux"
      rows={rowsRideaux}
      onRowsChange={mergeChildRowsFor("rideaux")}
      schema={schema}
      setSchema={setSchema}
      searchQuery={search}
      viewKey="bpf"
    />
    <DataTable
      title="BPF Décors de lit"
      tableKey="decors"
      rows={rowsDecors}
      onRowsChange={mergeChildRowsFor("decors")}
      schema={schema}
      setSchema={setSchema}
      searchQuery={search}
      viewKey="bpf"
    />
    <DataTable
      title="BPF Stores"
      tableKey="stores"
      rows={rowsStores}
      onRowsChange={mergeChildRowsFor("stores")}
      schema={schema}
      setSchema={setSchema}
      searchQuery={search}
      viewKey="bpf"
    />
  </>
)}

</div>
);
}


// ===== ChiffrageIndex : liste des minutes =====
function ChiffrageIndex({ minutes, onBack, onOpen, onCreate, onDelete }) {
  return (
    <div style={S.contentWrap}>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <button style={S.smallBtn} onClick={onBack}>← Retour</button>
        <h2 style={{ margin: 0 }}>Chiffrage</h2>
        <div style={{ flex: 1 }} />
        <button style={{ ...S.smallBtn, fontWeight: 700 }} onClick={onCreate}>+ Nouvelle minute</button>
      </div>

      <div style={{ 
        background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12,
        padding: 12
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#374151" }}>
              <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>Nom</th>
              <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>Client</th>
              <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>Version</th>
              <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>Lignes</th>
              <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>Modifié</th>
              <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }} />
            </tr>
          </thead>
          <tbody>
            {minutes.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: "#6b7280" }}>
                  Aucune minute pour l’instant. Cliquez sur <b>+ Nouvelle minute</b>.
                </td>
              </tr>
            )}

            {minutes.map(m => (
              <tr key={m.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <td style={{ padding: 10, fontWeight: 600 }}>{m.name}</td>
                <td style={{ padding: 10 }}>{m.client || "—"}</td>
                <td style={{ padding: 10 }}>v{m.version || 1}</td>
                <td style={{ padding: 10 }}>{Array.isArray(m.lines) ? m.lines.length : 0}</td>
                <td style={{ padding: 10, color: "#6b7280" }}>
                  {m.updatedAt ? new Date(m.updatedAt).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td style={{ padding: 10, textAlign: "right" }}>
                  <button style={S.smallBtn} onClick={()=>onOpen(m.id)}>Ouvrir</button>{" "}
                  <button style={{ ...S.smallBtn, color: "#b91c1c" }} onClick={()=>onDelete(m.id)}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const Link2 = ({ children, onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    style={{
      border: "none",
      background: "transparent",
      padding: 0,
      margin: 0,
      cursor: "pointer",
      color: "#2563eb",
      fontWeight: 600,
    }}
  >
    {children}
  </button>
);




// === Écran d’édition d’une minute (DataTable + Drawer paramètres) ===
function ChiffrageScreen({ minuteId, minutes, setMinutes, onBack }) {
  // 1) Récupère la minute courante
  const minute = React.useMemo(
    () => (minutes || []).find((m) => m.id === minuteId),
    [minutes, minuteId]
  );

  // 2) Schéma + lignes principales
  const [schema] = React.useState(CHIFFRAGE_SCHEMA);
  const [rows, setRows] = React.useState(() =>
    computeFormulas(minute?.lines || [], CHIFFRAGE_SCHEMA)
  );

  // 3) Déplacement (schéma dédié)
  const [depRows, setDepRows] = React.useState(
    computeFormulas(minute?.deplacements || [], CHIFFRAGE_SCHEMA_DEP)
  );

  // Resync quand minute change
  React.useEffect(() => {
    setRows(computeFormulas(minute?.lines || [], CHIFFRAGE_SCHEMA));
    setDepRows(computeFormulas(minute?.deplacements || [], CHIFFRAGE_SCHEMA_DEP));
  }, [minute?.id, minute?.lines, minute?.deplacements]);

  // 4) Modules sélectionnés (fallback)
  const mods = minute?.modules || { rideau: true, store: true, decor: true };

  // 5) Helpers persistance
  const updateMinute = (patch) =>
    setMinutes((all) =>
      (all || []).map((m) =>
        m.id === minuteId ? { ...m, ...patch, updatedAt: Date.now() } : m
      )
    );

  // Sauvegarde des lignes "Déplacement"
  const handleDepRowsChange = (nr) => {
    const next = computeFormulas(nr || [], CHIFFRAGE_SCHEMA_DEP);
    setDepRows(next);
    updateMinute({ deplacements: next });
  };

  // Sauvegarde des lignes principales
  const handleRowsChange = (nr) => {
    const next = computeFormulas(nr || [], schema);
    setRows(next);
    updateMinute({ lines: next });
  };

  // 6) Drawer Paramètres — vit ici (PAS dans MinuteEditor)
  const [showParams, setShowParams] = React.useState(false);

  // Helpers locaux
  const slugParamName = (raw) =>
    String(raw || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const toNumOrNull = (v) => {
    if (v === "" || v == null) return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const DEFAULT_PARAMS = [
    { id: uid(), name: "taux_horaire",     type: "prix", value: 135 },
    { id: uid(), name: "prix_hotel",       type: "prix", value: 150 },
    { id: uid(), name: "prix_achat_tissu", type: "prix", value: null },
  ];

  const [paramDraft, setParamDraft] = React.useState(() => {
    const base = Array.isArray(minute?.params) ? minute.params : [];
    return (base.length ? base : DEFAULT_PARAMS);
  });

  // Resync du drawer si on change de minute
  React.useEffect(() => {
    const base = Array.isArray(minute?.params) ? minute.params : [];
    setParamDraft(base.length ? base : DEFAULT_PARAMS);
  }, [minute?.id]);

  // Persistance des paramètres à chaque modif
  React.useEffect(() => {
    // nettoyage léger
    const cleaned = (paramDraft || []).map(p => ({
      id: p.id || uid(),
      name: slugParamName(p.name || ""),
      type: p.type === "coef" ? "coef" : "prix",
      value: toNumOrNull(p.value),
    }));
    updateMinute({ params: cleaned });
  }, [paramDraft]);

  const addParam = () => {
    setParamDraft(d => ([...(d || []), { id: uid(), name: "", type: "prix", value: null }]));
  };
  const setParamField = (id, key, value) => {
    setParamDraft(d => (d || []).map(p => p.id === id ? { ...p, [key]: value } : p));
  };
  const removeParam = (id) => {
    setParamDraft(d => (d || []).filter(p => p.id !== id));
  };

  // 7) Métadonnées minute
  const [name, setName]   = React.useState(minute?.name || "Minute sans nom");
  const [notes, setNotes] = React.useState(minute?.notes || "");
  React.useEffect(() => {
    setName(minute?.name || "Minute sans nom");
    setNotes(minute?.notes || "");
  }, [minuteId, minute?.name, minute?.notes]);

  const saveHeader = () => {
    updateMinute({ name: name || "Minute sans nom", notes });
  };

  // 8) Garde si ID invalide
  if (!minute) {
    return (
      <div style={S.contentWrap}>
        <div style={{ marginBottom: 12 }}>
          <button style={S.smallBtn} onClick={onBack}>← Retour</button>
        </div>
        <div
          style={{
            padding: 24,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            background: "#fff",
          }}
        >
          Minute introuvable.
        </div>
      </div>
    );
  }

  // 9) UI
  return (
    <div style={S.contentWide}>
      {/* Barre supérieure */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <button style={S.smallBtn} onClick={onBack}>← Retour</button>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du devis / minute"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              background: "#fff",
              fontWeight: 800,
            }}
          />
          <button style={S.smallBtn} onClick={saveHeader}>Enregistrer</button>
        </div>

        <div style={{ display: "flex", gap: 8, justifySelf: "end", alignItems: "center" }}>
          <div style={{ opacity: 0.7 }}>
            {new Date(minute.updatedAt || minute.createdAt || Date.now()).toLocaleString("fr-FR")}
          </div>
          <button
            style={S.smallBtn}
            onClick={() => setShowParams(s => !s)}
            title="Paramètres minute (taux horaire, coefs, prix...)"
          >
            ⚙️ Paramètres {showParams ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Notes minute (optionnel) */}
      <div
        style={{
          marginBottom: 12,
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 8,
        }}
      >
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optionnel)"
          rows={2}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${COLORS.border}`,
            background: "#fff",
            resize: "vertical",
          }}
        />
      </div>

      {/* Drawer Paramètres */}
      {showParams && (
        <div
          style={{
            marginBottom: 12,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            background: "#fff",
            padding: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <b>Paramètres de la minute</b>
            <button style={S.smallBtn} onClick={addParam}>+ Ajouter un paramètre</button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#374151" }}>
                  <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>Nom (clé)</th>
                  <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>Type</th>
                  <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>Valeur</th>
                  <th style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }} />
                </tr>
              </thead>
              <tbody>
                {(paramDraft || []).length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 10, color: "#6b7280" }}>
                      Aucun paramètre. Cliquez sur <b>+ Ajouter un paramètre</b>.
                    </td>
                  </tr>
                )}
                {(paramDraft || []).map((p) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: 8, minWidth: 220 }}>
                      <input
                        value={p.name || ""}
                        onChange={(e) => setParamField(p.id, "name", e.target.value)}
                        onBlur={(e) => setParamField(p.id, "name", slugParamName(e.target.value))}
                        placeholder="ex: taux_horaire, coef_tissu_luxe…"
                        style={S.input}
                      />
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                        Accents/espaces normalisés automatiquement.
                      </div>
                    </td>
                    <td style={{ padding: 8, width: 140 }}>
                      <select
                        value={p.type || "prix"}
                        onChange={(e) => setParamField(p.id, "type", e.target.value === "coef" ? "coef" : "prix")}
                        style={{ ...S.input, height: 34 }}
                      >
                        <option value="prix">prix</option>
                        <option value="coef">coef</option>
                      </select>
                    </td>
                    <td style={{ padding: 8, width: 160 }}>
                      <input
                        value={p.value ?? ""}
                        onChange={(e) => setParamField(p.id, "value", e.target.value)}
                        placeholder={p.type === "coef" ? "ex: 1,5" : "ex: 135"}
                        style={S.input}
                      />
                    </td>
                    <td style={{ padding: 8, textAlign: "right" }}>
                      <button
                        style={{ ...S.smallBtn, color: "#b91c1c" }}
                        onClick={() => removeParam(p.id)}
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Déplacement (au-dessus des 3 tableaux) */}
      <DataTable
        title="Déplacement"
        tableKey="deplacements"
        rows={depRows}
        onRowsChange={handleDepRowsChange}
        schema={CHIFFRAGE_SCHEMA_DEP}
        setSchema={() => {}}
        searchQuery=""
        viewKey="minutes_dep"
      />

      {/* Lignes principales : 1/2/3 tableaux selon modules (via MinuteEditor) */}
      <MinuteEditor
        minute={{ ...minute, lines: rows }}
        onChangeMinute={(m)=> updateMinute({ lines: m.lines })}
      />
    </div>
  );
}

// === LISTE DES MINUTES (style "Production") =============================
function ChiffrageRoot({ minutes = [], setMinutes, onOpenMinute, onBack }) {
  const { currentUser } = useAuth?.() || { currentUser: { name: "—" } };
  const [q, setQ] = React.useState("");

// --- Popup "Nouvelle minute"
  const [newMinOpen, setNewMinOpen] = useState(false);
  const [newMin, setNewMin] = useState({
    charge: (currentUser?.name || "").trim(),
    projet: "",
    note: "",
    status: "Non commencé", // valeurs: Non commencé | En cours d’étude | À valider | Validé
    modules: { rideau: true, store: true, decor: true }, // par défaut les 3
  });
  
  // normalise (au cas où d'anciennes minutes n'ont pas encore ces champs)
  const norm = (m) => ({
    id: m.id,
    name: m.name || "Minute sans nom",
    client: m.client || "",
    notes: m.notes || "",
    version: m.version ?? 1,
    lines: m.lines || [],
    createdAt: m.createdAt || Date.now(),
    updatedAt: m.updatedAt || Date.now(),
    owner: m.owner || currentUser?.name || "—",
    status: m.status || "Non commencé"
  });

  const list = (minutes || []).map(norm).filter(m => {
    const s = (q || "").toLowerCase();
    if (!s) return true;
    return (
      String(m.name).toLowerCase().includes(s) ||
      String(m.client).toLowerCase().includes(s) ||
      String(m.owner).toLowerCase().includes(s)
    );
  }).sort((a,b)=> b.updatedAt - a.updatedAt);

  const addMinute = () => {
    setNewMinOpen(true); // on ouvre la popup au lieu de créer directement
  };

  const handleCreateMinute = () => {
    const { charge, projet, note, status, modules } = newMin;
    if (!projet.trim() || !charge.trim()) return;
    if (!modules.rideau && !modules.store && !modules.decor) return;

    const now = Date.now();
    const id = uid();
    const m = {
      id,
      name: projet.trim(),             // nom du chiffrage
      client: "—",
      notes: (note || "").trim(),      // note/commentaire
      version: 1,
      lines: [],                       // si tu sépares plus tard par module, on adaptera ici
      // ▼▼ paramètres par défaut (drawer latéral)
   params: [
     { id: uid(), name: "taux_horaire",     type: "prix", value: 135 },
     { id: uid(), name: "prix_achat_tissu", type: "prix", value: null },
     { id: uid(), name: "nuit_hotel",       type: "prix", value: 150 },
   ],
   // ▼▼ (optionnel mais recommandé) tableau déplacements vide prêt à l’emploi
   deplacements: [],
      createdAt: now,
      updatedAt: now,
      owner: charge.trim(),            // chargé d’affaires
      status,                          // statut lisible (fr)
      modules: { ...modules },         // flags R/S/D
    };
    setMinutes((xs) => [m, ...(xs || [])]);  // ajout en tête de liste
    setNewMinOpen(false);
    onOpenMinute?.(id);                       // ouvre directement la minute
  };

  const duplicate = (id) => {
    setMinutes((xs) => {
      const src = xs.find(x => x.id === id);
      if (!src) return xs;
      const copy = norm({
        ...src,
        id: uid(),
        name: `${src.name} (copie)`,
        version: (src.version ?? 1) + 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "Non commencé",
      });
      return [copy, ...xs];
    });
  };

  const removeOne = (id) => {
    if (!confirm("Supprimer cette minute ?")) return;
    setMinutes((xs) => xs.filter(x => x.id !== id));
  };

  // petit style local pour éviter de toucher S.*
  const T = {
    wrap: { padding: 16 },
    headerRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
    back: S.smallBtn,
    title: { fontSize: 28, fontWeight: 900, margin: 0, flex: 1 },
    newBtn: { ...S.smallBtn, padding: "10px 14px", fontWeight: 800 },
    search: { position: "relative", width: 420, maxWidth: "100%" },
    searchInput: {
      width: "100%", padding: "10px 14px 10px 38px",
      borderRadius: 10, border: `1px solid ${COLORS.border}`, background: "#fff"
    },
    table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 0 rgba(0,0,0,.05)" },
    th: { textAlign: "left", fontSize: 12, letterSpacing: .3, textTransform: "uppercase", color: "#6b7280", padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, background: "#fafafa" },
    td: { padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` },
    tr: { cursor: "pointer" },
    trHover: { background: "#fbfbfb" },
    badge: (kind) => ({
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      background: kind === "Terminé" ? "#dcfce7"
               : kind === "En cours" ? "#fde68a"
               : "#e5e7eb",
      color: "#111827"
    }),
    actions: { display: "flex", gap: 8, justifyContent: "flex-end" },
    iconBtn: { ...S.smallBtn, padding: "6px 8px" }
  };

  return (
    <div style={T.wrap}>
      {/* Barre top */}
      <div style={T.headerRow}>
        <button style={T.back} onClick={onBack}>← Retour</button>
        <h1 style={T.title}>Chiffrage</h1>

        <div style={T.search}>
          <Search size={16} style={{ position: "absolute", left: 10, top: 11, opacity: .6 }} />
          <input
            placeholder="Rechercher une minute (nom, client, chargé)"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            style={T.searchInput}
          />
        </div>

        <button style={T.newBtn} onClick={addMinute}>
          <Plus size={16}/> Nouvelle minute
        </button>
      </div>

{newMinOpen && (
  <div
    style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.25)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
    }}
    onClick={() => setNewMinOpen(false)}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 460, background: "#fff", borderRadius: 12, padding: 16,
        boxShadow: "0 12px 32px rgba(0,0,0,.2)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Nouvelle minute</h3>
        <button style={T.newBtn} onClick={() => setNewMinOpen(false)}>Fermer</button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, opacity: .7 }}>Chargé·e d’affaires</div>
          <input
            style={{ width: "100%" }}
            value={newMin.charge}
            onChange={(e)=> setNewMin(m => ({ ...m, charge: e.target.value }))}
          />
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: .7 }}>Nom du chiffrage</div>
          <input
            style={{ width: "100%" }}
            value={newMin.projet}
            onChange={(e)=> setNewMin(m => ({ ...m, projet: e.target.value }))}
            placeholder={`Minute ${new Date().toLocaleDateString("fr-FR")}`}
          />
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: .7 }}>Statut</div>
          <select
            style={{ width: "100%" }}
            value={newMin.status}
            onChange={(e)=> setNewMin(m => ({ ...m, status: e.target.value }))}
          >
            <option>Non commencé</option>
            <option>En cours d’étude</option>
            <option>À valider</option>
            <option>Validé</option>
          </select>
        </label>

        <div>
          <div style={{ fontSize: 12, opacity: .7, marginBottom: 4 }}>Modules à inclure</div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={newMin.modules.rideau}
              onChange={(e)=> setNewMin(m => ({ ...m, modules: { ...m.modules, rideau: e.target.checked } }))}
            />
            Rideaux
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={newMin.modules.store}
              onChange={(e)=> setNewMin(m => ({ ...m, modules: { ...m.modules, store: e.target.checked } }))}
            />
            Stores
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={newMin.modules.decor}
              onChange={(e)=> setNewMin(m => ({ ...m, modules: { ...m.modules, decor: e.target.checked } }))}
            />
            Décors de lit
          </label>
          <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
            (Coche au moins un module)
          </div>
        </div>

        <label>
          <div style={{ fontSize: 12, opacity: .7 }}>Note</div>
          <textarea
            rows={3}
            style={{ width: "100%" }}
            value={newMin.note}
            onChange={(e)=> setNewMin(m => ({ ...m, note: e.target.value }))}
            placeholder="Commentaire interne…"
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button style={S.smallBtn} onClick={()=> setNewMinOpen(false)}>Annuler</button>
          <button
            style={S.smallBtn}
            onClick={handleCreateMinute}
            disabled={
              !newMin.charge.trim() ||
              !newMin.projet.trim() ||
              !(newMin.modules.rideau || newMin.modules.store || newMin.modules.decor)
            }
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  </div>
)}


      {/* Tableau */}
      <table style={T.table}>
        <thead>
          <tr>
            <th style={T.th}>Nom du devis</th>
            <th style={T.th}>Date de la minute</th>
            <th style={T.th}>Chargé du devis</th>
            <th style={T.th}>Statut</th>
            <th style={T.th}>Modules</th>
            <th style={T.th}>Notes</th>
            <th style={{ ...T.th, width: 140, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((m, i) => (
            <tr
              key={m.id}
              style={{ ...T.tr, ...(i % 2 ? { background: "#fcfcfc" } : null) }}
              onMouseEnter={(e)=> e.currentTarget.style.background = "#f9fafb"}
              onMouseLeave={(e)=> e.currentTarget.style.background = i % 2 ? "#fcfcfc" : "#fff"}
              onClick={(e)=> {
                // éviter que les boutons à droite déclenchent l'ouverture
                if ((e.target.closest && e.target.closest(".row-actions"))) return;
                onOpenMinute(m.id);
              }}
            >
              <td style={T.td}><b>{m.name}</b><div style={{ opacity: .6, fontSize: 12 }}>{m.client || "—"}</div></td>
              <td style={T.td}>{new Date(m.updatedAt || m.createdAt).toLocaleString("fr-FR")}</td>
              <td style={T.td}>{m.owner || "—"}</td>
              <td style={T.td}><span style={T.badge(m.status)}>{m.status}</span></td>
              <td style={T.td}>
  { (m.modules?.rideau || m.modules?.store || m.modules?.decor)
    ? [ m.modules?.rideau && "Rideaux",
        m.modules?.store  && "Stores",
        m.modules?.decor  && "Décors de lit" ].filter(Boolean).join(" · ")
    : "—"
  }
</td>
              <td style={T.td}>{m.notes || "—"}</td>
              <td style={{ ...T.td }}>
                <div className="row-actions" style={T.actions}>
                  <button
  title="Dupliquer"
  style={T.iconBtn}
  onClick={(e)=>{ e.stopPropagation(); duplicate(m.id); }}
>
  <Copy size={16} />
</button>

<button
  title="Supprimer"
  style={T.iconBtn}
  onClick={(e)=>{ e.stopPropagation(); removeOne(m.id); }}
>
  <Trash2 size={16} />
</button>
                </div>
              </td>
            </tr>
          ))}

          {!list.length && (
            <tr>
              <td colSpan={6} style={{ ...T.td, textAlign: "center", color: "#6b7280" }}>
                Aucune minute pour le moment. Crée la première avec « Nouvelle minute ».
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// =============== Écran Paramètres ===============

// --- Paramètres (profil simple démo)
function SettingsScreen({ onBack }) {
  const { currentUser, setCurrentUser } = useAuth();
  const [name, setName] = useState(currentUser?.name || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || "");

  const handleSave = () => {
    setCurrentUser({ ...currentUser, name, email, avatarUrl });
    onBack?.();
  };

  const handleAvatarFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setAvatarUrl(url);               // prévisualisation + stockage démo
  };

  return (
    <div style={S.contentWrap}>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <button style={S.smallBtn} onClick={onBack}>← Retour</button>
        <h2 style={{ margin: 0 }}>Paramètres</h2>
      </div>

      <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
        <label style={{ display: "grid", gridTemplateColumns: "160px 1fr", alignItems: "center", gap: 10 }}>
          <span>Nom</span>
          <input value={name} onChange={(e)=>setName(e.target.value)} />
        </label>

        <label style={{ display: "grid", gridTemplateColumns: "160px 1fr", alignItems: "center", gap: 10 }}>
          <span>Email</span>
          <input value={email} onChange={(e)=>setEmail(e.target.value)} />
        </label>

        <label style={{ display: "grid", gridTemplateColumns: "160px 1fr", alignItems: "center", gap: 10 }}>
          <span>Avatar</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", background: "#eee" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : null}
            </div>
            <input type="file" accept="image/*" onChange={handleAvatarFile} />
          </div>
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button style={S.smallBtn} onClick={onBack}>Annuler</button>
          <button
            style={{ ...S.smallBtn, background: COLORS.tile, color: "#fff", borderColor: COLORS.tile }}
            onClick={handleSave}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
// =============== Liste des dossiers ===============
function ProjectListScreen({ projects, setProjects, onOpenProject }){
  const [q,setQ]=useState("");
  const width=useViewportWidth();
  const filtered=useMemo(()=>{ const qq=q.trim().toLowerCase(); if(!qq) return projects; return projects.filter((p)=>[p.name,p.manager,p.status,p.notes].some((x)=>String(x||"").toLowerCase().includes(qq)));},[projects,q]);
  const createProject=()=>{ const name=prompt("Nom du dossier ?","NOUVEAU DOSSIER"); if(!name) return; const p={ id:uid(), name, due:new Date().toISOString().slice(0,10), manager:"Thomas BONNET", status:"En cours", notes:""}; setProjects((arr)=>[p,...arr]); };
  return (
    <div style={S.contentWrap}>
      <div style={{ display: "grid", gridTemplateColumns: width<900?"1fr":"280px 1fr", gap: 24, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.text }}>Production</div>
          <button onClick={createProject} style={{ marginTop: 12, background: COLORS.tile, color: "#fff", padding: "10px 14px", borderRadius: 10, border: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Plus size={16}/> Nouveau
          </button>
        </div>
        <div>
          <div style={{ fontSize: 18, marginBottom: 6 }}>Recherche</div>
          <div style={S.searchBox}>
            <Search size={18} style={{ position: "absolute", left: 10, top: 12, opacity: .6 }} />
            <input placeholder="Rechercher un dossier" value={q} onChange={(e)=>setQ(e.target.value)} style={S.searchInput} />
          </div>
          <div style={{ ...S.toolsRow, marginTop: 10 }}>
            <span style={S.toolBtn}><Filter size={16}/> Filtre</span>
            <span style={S.toolBtn}><Layers3 size={16}/> Regrouper</span>
            <span style={S.toolBtn}><Star size={16}/> Favoris</span>
          </div>
        </div>
      </div>

      <div style={{ ...S.tableBlock, marginTop: 18, borderRadius: 20 }}>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Nom dossier</th>
                <th style={S.th}>Date de livraison</th>
                <th style={S.th}>Chargé·e de projet</th>
                <th style={S.th}>Statut</th>
                <th style={S.th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p,idx)=> (
                <tr key={p.id} style={idx%2?S.trAlt:undefined}>
                  <td style={S.td}><button onClick={()=>onOpenProject(p)} style={{ background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", fontWeight: 800 }}>{p.name}</button></td>
                  <td style={S.td}>{formatDateFR(p.due)}</td>
                  <td style={S.td}>{p.manager}</td>
                  <td style={S.td}><span style={{ ...S.smallBtn, background: "#FCD34D", borderColor: "#FCD34D" }}>En cours</span></td>
                  <td style={S.td} title={p.notes}>{truncate(p.notes,18)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =============== Accueil ===============
function AppTile({ label, Icon, size = 160, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        border: `1px solid ${COLORS.border}`,
        background: "#fff",
        boxShadow: "0 2px 12px rgba(0,0,0,.06)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        cursor: "pointer",
      }}
    >
      {Icon ? <Icon size={Math.round(size * 0.35)} /> : null}
      <div style={{ fontWeight: 700 }}>{label}</div>
    </button>
  );
}

function HomeScreen({ onOpenProdList, onOpenSettings, onOpenChiffrage }) {

  const width = useViewportWidth();
  const cols = width < 700 ? 2 : 4;
  const gap = width < 700 ? 40 : 64;
  const tileSize = Math.max(88, Math.min(112, Math.round(width*0.18)));

  return (
    <div style={S.mainCenter}>
      <div style={S.appsWrap}>
        <div style={{ ...S.appsBase, gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
          <AppTile
  label="Chiffrage"
  Icon={PencilRuler}
  size={tileSize}
  onClick={onOpenChiffrage}
/>
          <AppTile label="Production" Icon={Database}    size={tileSize} onClick={onOpenProdList} />
          <AppTile label="Inventaire" Icon={Boxes}       size={tileSize} onClick={()=>console.log("/inventaire")} />
          <AppTile label="Planning"   Icon={GanttChart}  size={tileSize} onClick={()=>console.log("/planning")} />
          {/* 🔧 Nouvelle tuile Paramètres */}
          <AppTile label="Paramètres" Icon={Settings2}   size={tileSize} onClick={onOpenSettings} />
        </div>
      </div>
    </div>
  );
}

// =============== App Root ===============
// --- Badge utilisateur (nom + avatar), cliquable vers Paramètres
function UserBadge({ onClick }) {
  const { currentUser } = useAuth();
  const hasAvatar = Boolean(currentUser?.avatarUrl);

  return (
    <button
      style={S.userBtn}
      onClick={onClick}
      aria-label="Profil utilisateur"
      title="Ouvrir mes paramètres"
    >
      <div style={S.avatarBox}>
        {hasAvatar ? (
          <img
            src={currentUser.avatarUrl}
            alt="Avatar"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div>AL</div>
        )}
      </div>
      <span style={{ fontWeight: 600 }}>{currentUser?.name || "Utilisateur"}</span>
    </button>
  );
}


export default function App(){
  const [screen, setScreen] = useState("home"); // home | prodList | project | chiffrage | settings
  const [logoOk, setLogoOk] = useState(true);
  const [avatarOk, setAvatarOk] = useState(true);
  const [projects, setProjects] = useState(DEMO_PROJECTS);
  const [current, setCurrent] = useState(null);
  const [quoteMinutes, setQuoteMinutes] = useLocalStorage("chiffrage.minutes", []);
  const [openMinuteId, setOpenMinuteId] = useState(null);

  const LOGO_SRC = "/logo.png";

  return (
  <AuthProvider>
    <ActivityProvider>
        <style>{`
:root {
  /* Valeur par défaut si la section n'injecte rien */
  --etq-cols-print: 3;
}

/* Les cartes */
.etq-card{
  break-inside: avoid;
  page-break-inside: avoid;
  box-shadow: none;
  border-width: 1.2px;
}

/* Saut de page optionnel entre groupes */
/* .print-break { break-after: page; } */

@media print {
  @page { size: A4 portrait; margin: 10mm; }

  html, body, #root { height: auto !important; overflow: visible !important; background: #fff !important; }

  /* Masquer l'UI */
  [data-hide-on-print="1"] { display: none !important; }

  /* Colonnes à l'impression (fallback) */
  .etq-grid { grid-template-columns: repeat(var(--etq-cols-print, 3), 1fr) !important; gap: 10px !important; }

  /* Couleurs fidèles */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`}</style>
      <div style={S.page}>
        <header style={S.header}>
  <button style={S.brandBtn} onClick={() => setScreen("home")} aria-label="Retour à l'accueil">
    {logoOk ? (
      <img src={LOGO_SRC} alt="LENGLART" style={{ height: "clamp(24px, 5vw, 36px)", width: "auto" }} onError={() => setLogoOk(false)} />
    ) : (
      <span style={S.logoText}>LENGLART</span>
    )}
  </button>
{/* Badge utilisateur (nom + avatar) */}
<UserBadge onClick={() => setScreen("settings")} />
</header>

       {/* === Accueil === */}
{screen === "home" && (
  <HomeScreen
    onOpenProdList={() => setScreen("prodList")}
    onOpenSettings={() => setScreen("settings")}
    onOpenChiffrage={() => setScreen("chiffrageRoot")}   // ⬅️ va vers la liste
  />
)}

{/* === Liste Production === */}
{screen === "prodList" && (
  <ProjectListScreen
    projects={projects}
    setProjects={setProjects}
    onOpenProject={(p) => { setCurrent(p); setScreen("project"); }}
  />
)}

{/* === Chiffrage : LISTE === */}
{screen === "chiffrageRoot" && (
  <ChiffrageRoot
    minutes={quoteMinutes}
    setMinutes={setQuoteMinutes}
    onBack={() => setScreen("home")}
    onOpenMinute={(id) => {                // ⬅️ ouvre l’éditeur pour l’ID choisi
      setOpenMinuteId(id);
      setScreen("chiffrage");
    }}
  />
)}

{/* === Chiffrage : ÉDITEUR === */}
{screen === "chiffrage" && openMinuteId && (
  <ChiffrageScreen
    minuteId={openMinuteId}                // ⬅️ **important**
    minutes={quoteMinutes}                 // ⬅️ **important**
    setMinutes={setQuoteMinutes}
    onBack={() => setScreen("chiffrageRoot")}
  />
)}

{/* === Projet Production === */}
{screen === "project" && current && (
  <ProductionProjectScreen
    projectName={current.name}
    onBack={() => setScreen("prodList")}
  />
)}

{/* === Paramètres === */}
{screen === "settings" && (
  <SettingsScreen onBack={() => setScreen("home")} />
)}
      </div>
    </ActivityProvider>
  </AuthProvider>
  );
}
