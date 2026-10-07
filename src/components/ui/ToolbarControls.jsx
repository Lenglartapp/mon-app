import React from 'react';
import { Search, X } from 'lucide-react';

// Contrôles de barre d'outils au style de la DA (listes Chiffrages / Projets) :
// hauteur 38 px, fond blanc, trait #E0DED9, coins 8 px, texte 13 px, sans cadre autour.

const BOX = {
  display: 'flex', alignItems: 'center', gap: 8, height: 38, boxSizing: 'border-box',
  background: 'white', border: '1px solid #E0DED9', borderRadius: 8, padding: '0 10px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontSize: 13, color: '#111827',
};
const INPUT = {
  flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
  fontSize: 13, color: '#111827', fontFamily: 'inherit', padding: 0,
};

/** Champ de recherche (loupe à gauche, croix pour vider). `list` : id d'un <datalist> de suggestions. */
export function ToolbarSearch({ value, onChange, placeholder, width = 320, list, icon = true }) {
  return (
    <div style={{ ...BOX, width }}>
      {icon && <Search size={16} color="#9CA3AF" style={{ flexShrink: 0 }} />}
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} list={list} style={INPUT} />
      {value ? (
        <button onClick={() => onChange('')} title="Effacer" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

/** Liste déroulante avec son libellé en gris dans le champ (« Catégorie  Toutes ▾ »). */
export function ToolbarSelect({ label, value, onChange, options }) {
  const active = options[0] && value !== options[0].value;
  return (
    <label style={{ ...BOX, cursor: 'pointer', borderColor: active ? '#1E2447' : '#E0DED9' }}>
      <span style={{ color: '#9B9A97', whiteSpace: 'nowrap' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...INPUT, flex: 'none', maxWidth: 90, textOverflow: 'ellipsis', cursor: 'pointer', fontWeight: active ? 600 : 400 }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Bouton d'action : blanc à trait (par défaut) ou bleu nuit (`primary`, ou `active` pour une bascule). */
export function ToolbarButton({ icon, children, onClick, primary = false, active = false, title }) {
  const dark = primary || active;
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px', borderRadius: 8,
        background: dark ? '#1E2447' : 'white', color: dark ? 'white' : '#374151',
        border: `1px solid ${dark ? '#1E2447' : '#E5E7EB'}`, cursor: 'pointer',
        fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
      }}
    >
      {icon}{children}
    </button>
  );
}

/** Tableau MUI DataGrid au style des listes Chiffrages / Projets (à mettre dans le `sx` du DataGrid). */
export const DATAGRID_DA_SX = {
  border: 'none',
  fontFamily: 'inherit',
  '--DataGrid-containerBackground': '#F4F4F4',
  '--DataGrid-rowBorderColor': '#E8E6E2',
  '& .MuiDataGrid-columnHeader': { backgroundColor: '#F4F4F4' },
  '& .MuiDataGrid-columnHeaderTitle': { fontSize: 13, fontWeight: 600, color: '#374151' },
  '& .MuiDataGrid-columnHeaders': { borderBottom: '1px solid #E0DED9' },
  '& .MuiDataGrid-columnSeparator': { color: '#E0DED9' },
  '& .MuiDataGrid-cell': { fontSize: 13, color: '#111827' },
  '& .MuiDataGrid-row:hover': { backgroundColor: '#F4F4F4' },
  '& .MuiDataGrid-footerContainer': { borderTop: '1px solid #E0DED9' },
};

/** Cadre du tableau : même contour que les listes (trait #E0DED9, coins 8 px, sans ombre). */
export const TABLE_FRAME_STYLE = {
  width: '100%', background: 'white', border: '1px solid #E0DED9', borderRadius: '8px', overflow: 'hidden',
};
