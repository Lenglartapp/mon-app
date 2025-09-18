// src/App.jsx — v4.2 (Production complet, 58 champs, sans crash)
// - Accueil avec tuiles → Production
// - Tableau Production avec **58 champs** (édition inline)
// - Formules clés recalculées : nb_glisseurs, h_finie, l_finie, a_plat, nb_les,
//   h_coupe_tissu, h_coupe_tissu_motif, h_coupe_doublure
// - Ajout de ligne stable, modal détail par ligne, sélecteur de colonnes (popover)
// ⚠️ Version safe (pas de dépendances tierces autres que lucide-react). Style simple inline.

import React, { useEffect, useMemo, useState } from "react";
import {
  PencilRuler, Database, Boxes, GanttChart,
  Plus, Filter, Settings2, ChevronRight, X
} from "lucide-react";

// ================= Theme & utils =================
const COLORS = { page: "#FAF5EE", tile: "#1E2447", text: "#111827", border: "#E5E7EB", rowAlt: "#F9FAFB" };
const S = {
  page: { minHeight: "100vh", width: "100vw", background: COLORS.page, display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 40px" },
  brandBtn: { display: "flex", alignItems: "center", gap: 14, cursor: "pointer", background: "transparent", border: "none" },
  userBtn: { display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: "transparent", border: "none" },
  avatarBox: { width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "#000", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700 },
  main: { flex: 1, display: "flex", flexDirection: "column" },
  contentWrap: { width: "min(1200px, 96vw)", margin: "0 auto", padding: "8px 24px 24px" },
  tile: { borderRadius: 16, background: COLORS.tile, color: "#fff", width: 112, height: 112, display: "grid", placeItems: "center", boxShadow: "0 2px 4px rgba(0,0,0,.15)" },
  tableBlock: { background: "#fff", borderRadius: 16, border: `1px solid ${COLORS.border}`, overflow: "hidden" },
  tableHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottom: `1px solid ${COLORS.border}` },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  th: { textAlign: "left", padding: 10, borderBottom: `1px solid ${COLORS.border}`, background: "#F3F4F6" },
  td: { padding: 8, borderBottom: `1px solid ${COLORS.border}` },
  smallBtn: { padding: "6px 10px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: "#fff", cursor: "pointer" },
  pop: { position: "absolute", top: "100%", right: 0, width: 280, maxHeight: 320, overflow: "auto", background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, boxShadow: "0 12px 28px rgba(0,0,0,.18)", zIndex: 50 }
};

const uid = () => Math.random().toString(36).slice(2, 9);
const toNumber = (v) => { if (typeof v === "number") return v; const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

// ================= 58 champs =================
const SCHEMA_58 = [
  { key: "zone", label: "Zone", type: "text", width: 140 }, // 1
  { key: "piece", label: "Pièce", type: "text", width: 140 }, // 2
  { key: "produit", label: "Produit", type: "select", options: ["Rideau","Voilage","Store Bateau","Store Enrouleur","Store Vénitien","Cache Sommier","Coussin","Décor de lit","Autres"], width: 160 }, // 3
  { key: "type_confection", label: "Type de confection", type: "select", options: ["Wave 80","Wave 60","Couteau","Flamand","Triplis","Creux","Taylor","Tuyaux d'orgue","Plat","A plat"], width: 160 }, // 4
  { key: "pair_un", label: "Paire / Un seul pan", type: "select", options: ["Paire","Un seul pan"], width: 160 }, // 5
  { key: "cote_rattr", label: "Côté de rattriment", type: "select", options:["Gauche","Droite"], width: 150 }, // 6
  { key: "ampleur", label: "Ampleur", type: "number", width: 100 }, // 7
  { key: "double", label: "Doublé", type: "select", options:["Oui","Non"], width: 100 }, // 8
  { key: "envers_visible", label: "Envers visible", type: "select", options:["Oui","Non"], width: 130 }, // 9
  { key: "h_tete", label: "Hauteur de tête", type: "number", width: 140 }, // 10
  { key: "l_mecanisme", label: "Largeur mécanisme", type: "number", width: 160 }, // 11
  { key: "largeur", label: "Largeur", type: "number", width: 120 }, // 12
  { key: "hauteur", label: "Hauteur", type: "number", width: 120 }, // 13
  { key: "f_bas", label: "Finition bas", type: "number", width: 130 }, // 14
  { key: "croisement", label: "Croisement", type: "number", width: 130 }, // 15
  { key: "retour_g", label: "Retour Gauche", type: "number", width: 140 }, // 16
  { key: "retour_d", label: "Retour Droit", type: "number", width: 130 }, // 17
  { key: "type_rail", label: "Type de rail", type: "select", options:["Kontrak","Projekt","Tekno","Mini","Separa 20mm","Separa 28mm","Tringle 40mm","Tringle 31mm","Free"], width: 160 }, // 18
  { key: "couleur_rail", label: "Couleur rail", type: "text", width: 140 }, // 19
  { key: "nb_glisseurs", label: "Nombre de glisseur/anneaux", type: "formula", width: 220 }, // 20
  { key: "couv_mecanisme", label: "Couverture mécanisme", type: "select", options:["Couvert","MiCouvert","Découvert"], width: 170 }, // 21
  { key: "type_pose", label: "Type de pose", type: "text", width: 140 }, // 22
  { key: "val_ded_rail", label: "Valeur déduction rail", type: "number", width: 170 }, // 23
  { key: "tissu_deco1", label: "Tissu Déco 1", type: "text", width: 140 }, // 24
  { key: "laize_tissu_deco1", label: "Laize Tissu Déco 1", type: "number", width: 170 }, // 25
  { key: "motif_deco1", label: "Motif Déco 1", type: "select", options:["Oui","Non"], width: 140 }, // 26
  { key: "raccord_v1", label: "Raccord Vertical 1", type: "number", width: 160 }, // 27
  { key: "raccord_h1", label: "Raccord Horizontal 1", type: "number", width: 170 }, // 28
  { key: "tissu_deco2", label: "Tissu Déco 2", type: "text", width: 140 }, // 29
  { key: "laize_tissu_deco2", label: "Laize Tissu Déco 2", type: "number", width: 170 }, // 30
  { key: "motif_deco2", label: "Motif Déco 2", type: "select", options:["Oui","Non"], width: 140 }, // 31
  { key: "raccord_v2", label: "Raccord Vertical 2", type: "number", width: 160 }, // 32
  { key: "raccord_h2", label: "Raccord Horizontal 2", type: "number", width: 170 }, // 33
  { key: "passementerie1", label: "Passementerie 1", type: "text", width: 160 }, // 34
  { key: "app_passem1", label: "Application Passementerie 1", type: "text", width: 200 }, // 35
  { key: "passementerie2", label: "Passementerie 2", type: "text", width: 160 }, // 36
  { key: "app_passem2", label: "Application Passementerie 2", type: "text", width: 200 }, // 37
  { key: "doublure", label: "Doublure", type: "text", width: 140 }, // 38
  { key: "laize_doublure", label: "Laize Doublure", type: "number", width: 160 }, // 39
  { key: "interdoubure", label: "Interdoubure", type: "text", width: 150 }, // 40
  { key: "laize_interdoubure", label: "Laize Interdoubure", type: "number", width: 180 }, // 41
  { key: "h_finie", label: "Hauteur finie", type: "formula", width: 140 }, // 42
  { key: "l_finie", label: "Largeur finie", type: "formula", width: 150 }, // 43
  { key: "a_plat", label: "A plat", type: "formula", width: 120 }, // 44
  { key: "nb_les", label: "Nombre de lés", type: "formula", width: 140 }, // 45
  { key: "equip_tete", label: "Equipement de tête", type: "text", width: 170 }, // 46
  { key: "h_coupe_tissu", label: "Hauteur de coupe tissu", type: "formula", width: 200 }, // 47
  { key: "h_coupe_tissu_motif", label: "Hauteur coupe tissu motif", type: "formula", width: 220 }, // 48
  { key: "h_coupe_doublure", label: "Hauteur coupe Doublure", type: "formula", width: 200 }, // 49
  { key: "val_ourlet_bas", label: "Valeur Ourlet du bas", type: "number", width: 180 }, // 50
  { key: "piquage_ourlet_bas", label: "Piquage Ourlet du bas", type: "text", width: 200 }, // 51
  { key: "fin_ourlet_bas", label: "Finition Ourlet du bas", type: "text", width: 190 }, // 52
  { key: "val_ourlet_cote", label: "Valeur Ourlet de côté", type: "number", width: 190 }, // 53
  { key: "piquage_ourlet_cote", label: "Piquage Ourlet de côté", type: "text", width: 200 }, // 54
  { key: "onglet", label: "Onglet", type: "select", options:["Oui","Non"], width: 120 }, // 55
  { key: "poids", label: "Poids", type: "text", width: 120 }, // 56
  { key: "commentaire", label: "Commentaire confection", type: "longtext", width: 260 }, // 57
  { key: "photos", label: "Photos", type: "photo", width: 220 }, // 58 (champ pratique pour pièces jointes)
];

// ================= Formule engine =================
function computeFormulas(rows){
  return rows.map((r) => {
    const x = { ...r };
    // #20 nb_glisseurs = round(l_mecanisme/10 + 2)
    x.nb_glisseurs = Math.round(toNumber(x.l_mecanisme) / 10 + 2);
    // #42 h_finie = hauteur - val_ded_rail + f_bas
    x.h_finie = toNumber(x.hauteur) - toNumber(x.val_ded_rail) + toNumber(x.f_bas);
    // #43 l_finie
    const baseLargeur = toNumber(x.largeur);
    const retours = toNumber(x.retour_g) + toNumber(x.retour_d) + toNumber(x.croisement);
    x.l_finie = (x.pair_un === "Paire")
      ? baseLargeur / 2 + 10 + retours
      : baseLargeur + 10 + retours;
    // #44 a_plat = l_finie * ampleur + ourlets côtés *4 (approx)
    x.a_plat = toNumber(x.l_finie) * (toNumber(x.ampleur) || 1) + (toNumber(x.val_ourlet_cote) * 4);
    // #45 nb_les = ceil(a_plat / laize tissu déco 1)
    const laize1 = toNumber(x.laize_tissu_deco1) || 1;
    x.nb_les = Math.max(1, Math.ceil(toNumber(x.a_plat) / laize1));
    // #47 h_coupe_tissu = h_finie + (val_ourlet_bas*2) + (h_tete*2) + 10
    x.h_coupe_tissu = toNumber(x.h_finie) + (toNumber(x.val_ourlet_bas) * 2) + (toNumber(x.h_tete) * 2) + 10;
    // #48 h_coupe_tissu_motif = ceil(h_coupe_tissu / raccord_v1) * raccord_v1 (si raccord)
    const rv1 = toNumber(x.raccord_v1);
    x.h_coupe_tissu_motif = rv1 > 0 ? Math.ceil(toNumber(x.h_coupe_tissu) / rv1) * rv1 : toNumber(x.h_coupe_tissu);
    // #49 h_coupe_doublure : règle simple (à affiner si besoin)
    x.h_coupe_doublure = toNumber(x.h_coupe_tissu) < 280 ? toNumber(x.a_plat) : toNumber(x.h_coupe_tissu);
    return x;
  });
}

// ================== Table helpers ==================
function InputCell({ row, col, onChange }){
  const v = row[col.key];
  const common = { style:{ width:"100%", border:"none", outline:"none", background:"transparent" } };
  if (col.type === "number") return <input type="number" value={v ?? ""} onChange={e=>onChange(col.key, e.target.value)} {...common} />;
  if (col.type === "select") return (
    <select value={v ?? ""} onChange={e=>onChange(col.key, e.target.value)} style={{ width:"100%" }}>
      <option value=""></option>
      {(col.options||[]).map(o=> <option key={o} value={o}>{o}</option>)}
    </select>
  );
  if (col.type === "longtext") return <textarea rows={2} value={v ?? ""} onChange={e=>onChange(col.key, e.target.value)} style={{ width:"100%", resize:"vertical" }} />;
  if (col.type === "photo") return (
    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
      {(Array.isArray(v)? v: []).map((src,idx)=>(
        <img key={idx} src={src} alt="" style={{ width:36, height:36, objectFit:"cover", borderRadius:6 }} />
      ))}
      <input type="file" accept="image/*" onChange={(e)=>{ const f=e.target.files?.[0]; if(!f) return; const url=URL.createObjectURL(f); const arr=Array.isArray(v)?[...v,url]:[url]; onChange(col.key, arr); }} />
    </div>
  );
  if (col.type === "formula") return <span style={{ opacity:.9 }}>{String(v ?? "")}</span>;
  return <input value={v ?? ""} onChange={e=>onChange(col.key, e.target.value)} {...common} />;
}

function ColumnPicker({ schema, visible, setVisible, onClose }){
  const toggle = (k) => setVisible((arr)=> arr.includes(k) ? arr.filter(x=>x!==k) : [...arr, k]);
  return (
    <div style={S.pop} onClick={(e)=> e.stopPropagation()}>
      <div style={{ position:"sticky", top:0, background:"#fff", padding:10, borderBottom:`1px solid ${COLORS.border}`, fontWeight:700 }}>Colonnes</div>
      <div style={{ padding:10 }}>
        {schema.map(c=> (
          <label key={c.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px dashed ${COLORS.border}` }}>
            <span>{c.label}</span>
            <input type="checkbox" checked={visible.includes(c.key)} onChange={()=> toggle(c.key)} />
          </label>
        ))}
      </div>
      <div style={{ display:"flex", gap:8, padding:10, borderTop:`1px solid ${COLORS.border}` }}>
        <button style={S.smallBtn} onClick={()=> setVisible(schema.map(c=>c.key))}>Tout</button>
        <button style={S.smallBtn} onClick={()=> setVisible([])}>Rien</button>
        <button style={{ ...S.smallBtn, marginLeft:"auto" }} onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

function RowFormModal({ row, schema, onChange, onClose }){
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", display:"grid", placeItems:"center", zIndex:100 }} onClick={onClose}>
      <div style={{ width:"min(900px, 92vw)", maxHeight:"86vh", overflow:"auto", background:"#fff", borderRadius:16, boxShadow:"0 22px 48px rgba(0,0,0,.22)" }} onClick={(e)=>e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:14, borderBottom:`1px solid ${COLORS.border}`, fontWeight:800 }}>
          <span>Détail de la ligne</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={18} /></button>
        </div>
        <div style={{ padding:14, display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {schema.map(c=> (
            <div key={c.key} style={{ display:"grid", gap:6 }}>
              <label style={{ fontSize:13, opacity:.8 }}>{c.label}</label>
              <InputCell row={row} col={c} onChange={(key,val)=> onChange(key,val)} />
            </div>
          ))}
        </div>
        <div style={{ padding:14, borderTop:`1px solid ${COLORS.border}`, display:"flex", justifyContent:"flex-end" }}>
          <button style={S.smallBtn} onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ================== DataTable ==================
function DataTable({ rows, setRows, schema }){
  const [pickerOpen, setPickerOpen] = useState(false);
  const keyLS = "prod.visible.columns";
  const [visible, setVisible] = useState(()=>{
    try { const s = localStorage.getItem(keyLS); return s? JSON.parse(s): schema.map(c=>c.key); } catch { return schema.map(c=>c.key); }
  });
  useEffect(()=>{ try { localStorage.setItem(keyLS, JSON.stringify(visible)); } catch {} }, [visible]);

  const columns = useMemo(()=> schema.filter(c=> visible.includes(c.key)), [schema, visible]);

  const [modalRow, setModalRow] = useState(null);

  const update = (id, key, value) => {
    setRows((arr)=> computeFormulas(arr.map(r=> r.id===id ? { ...r, [key]: value } : r)));
  };
  const addRow = () => {
    const base = { id: uid(), produit: "Rideau", pair_un: "Paire", ampleur: 1.8, largeur: 160, hauteur: 240 };
    setRows((arr)=> computeFormulas([...arr, base]));
  };

  return (
    <div style={S.tableBlock}>
      <div style={S.tableHeader}>
        <div style={{ fontWeight:800 }}>BPF Rideaux</div>
        <div style={{ position:"relative", display:"flex", gap:8 }}>
          <button style={S.smallBtn} onClick={addRow}><Plus size={16} /> Ajouter</button>
          <button style={S.smallBtn} onClick={()=> setPickerOpen((v)=>!v)}><Settings2 size={16} /> Colonnes</button>
          {pickerOpen && (
            <div style={{ position:"relative" }}>
              <ColumnPicker schema={schema} visible={visible} setVisible={setVisible} onClose={()=> setPickerOpen(false)} />
            </div>
          )}
        </div>
      </div>

      <div style={{ overflowX:"auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>⋮</th>
              {columns.map(c=> <th key={c.key} style={{ ...S.th, minWidth: c.width || 120 }}>{c.label}</th>)}
              <th style={S.th}>Détail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,idx)=> (
              <tr key={r.id} style={idx%2? { background: COLORS.rowAlt }: undefined}>
                <td style={S.td}><input type="checkbox" /></td>
                {columns.map(c=> (
                  <td key={c.key} style={S.td}>
                    <InputCell row={r} col={c} onChange={(k,v)=> update(r.id, k, v)} />
                  </td>
                ))}
                <td style={S.td}>
                  <button style={{ ...S.smallBtn }} onClick={()=> setModalRow(r)}><ChevronRight size={16} /> Ouvrir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalRow && (
        <RowFormModal row={modalRow} schema={schema} onChange={(k,v)=> update(modalRow.id, k, v)} onClose={()=> setModalRow(null)} />
      )}
    </div>
  );
}

// ================ Ecran Production ================
function ProductionProjectScreen(){
  const [rows, setRows] = useState(()=> computeFormulas([
    { id: uid(), produit:"Rideau", zone:"1er étage", piece:"Chambre", type_confection:"A plat", pair_un:"Paire", ampleur:1.8, largeur:160, hauteur:250, l_mecanisme:165, f_bas:2, croisement:4, retour_g:3, retour_d:3, val_ded_rail:0, laize_tissu_deco1:140, h_tete:5, val_ourlet_bas:7, val_ourlet_cote:3 },
  ]));
  return (
    <div style={S.contentWrap}>
      <h2 style={{ fontSize:22, margin:"8px 0 14px", fontWeight:900, color:COLORS.text }}>Production</h2>
      <DataTable rows={rows} setRows={setRows} schema={SCHEMA_58} />
    </div>
  );
}

// ================= Accueil =================
function useViewportWidth(){
  const [w,setW] = useState(typeof window!=='undefined'? window.innerWidth: 1200);
  useEffect(()=>{ const onR=()=> setW(window.innerWidth); window.addEventListener('resize', onR); return ()=> window.removeEventListener('resize', onR); },[]);
  return w;
}
function AppTile({ label, Icon, onClick }){
  const w = useViewportWidth();
  const size = Math.max(88, Math.min(112, Math.round(w*0.18)));
  const iconSize = Math.max(24, Math.round(size/2));
  return (
    <div role="button" tabIndex={0} onClick={onClick} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, cursor:"pointer" }}>
      <div style={{ ...S.tile, width:size, height:size }}><Icon size={iconSize} /></div>
      <span style={{ fontWeight:800, fontSize:16.5, color:COLORS.text }}>{label}</span>
    </div>
  );
}
function HomeScreen({ onOpenProdList }){
  const w = useViewportWidth();
  const cols = w < 700 ? 2 : 4; const gap = w < 700 ? 40 : 64;
  return (
    <div style={{ display:"grid", placeItems:"center", flex:1 }}>
      <div style={{ width:"min(1100px, 92vw)" }}>
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols}, 1fr)`, gap, justifyItems:"center" }}>
          <AppTile label="Chiffrage" Icon={PencilRuler} onClick={()=>{}} />
          <AppTile label="Production" Icon={Database} onClick={onOpenProdList} />
          <AppTile label="Inventaire" Icon={Boxes} onClick={()=>{}} />
          <AppTile label="Planning" Icon={GanttChart} onClick={()=>{}} />
        </div>
      </div>
    </div>
  );
}

// ================= Root App =================
export default function App(){
  const [screen, setScreen] = useState('home');
  const LOGO_SRC = "/logo.png"; const AVATAR_SRC = "/avatar.jpg";
  const [logoOk, setLogoOk] = useState(true); const [avatarOk, setAvatarOk] = useState(true);

  return (
    <div style={S.page}>
      <header style={S.header}>
        <button style={S.brandBtn} onClick={()=> setScreen('home')}>
          {logoOk ? (
            <img src={LOGO_SRC} alt="LENGLART" style={{ height:"clamp(24px,5vw,36px)" }} onError={()=> setLogoOk(false)} />
          ) : (
            <svg style={{ height:"clamp(24px,5vw,36px)" }} viewBox="0 0 320 72" aria-label="LENGLART"><rect width="320" height="72" rx="6" fill="#000" /><text x="20" y="48" fill="#fff" fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fontSize="32" letterSpacing="2">LENGLART</text></svg>
          )}
        </button>
        <button style={S.userBtn}>
          <div style={S.avatarBox}>
            {avatarOk ? (
              <img src={AVATAR_SRC} alt="Avatar" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={()=> setAvatarOk(false)} />
            ) : ("AL")}
          </div>
          <span style={{ fontWeight:600 }}>Aristide LENGLART</span>
        </button>
      </header>

      {screen==='home' && <HomeScreen onOpenProdList={()=> setScreen('production')} />}
      {screen==='production' && <ProductionProjectScreen />}
    </div>
  );
}
