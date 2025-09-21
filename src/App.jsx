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
import { CHIFFRAGE_SCHEMA } from "./lib/schemas/chiffrage";
import { computeFormulas } from "./lib/formulas/compute";
import DataTable from "./components/DataTable";
import { DEFAULT_VIEWS } from "./lib/constants/views";
import { COLORS, S } from "./lib/constants/ui";
import MinuteEditor from "./components/MinuteEditor"
import ChiffrageScreen from "./screens/ChiffrageScreen";
import { ActivityProvider } from "./contexts/activity";
import { uid } from "./lib/utils/uid";
import { ProjectListScreen } from "./screens/ProjectListScreen";
import { ProductionProjectScreen } from "./screens/ProductionProjectScreen";
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
