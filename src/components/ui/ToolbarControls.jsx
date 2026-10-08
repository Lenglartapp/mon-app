import React from 'react';
import { useState } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import { BLUE_TONES, toneColors } from '../../lib/constants/daStyles';
import FitPanel from './FitPanel';

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
export function ToolbarSearch({ value, onChange, placeholder, width = 320, list, icon = true, grow = false }) {
  // `grow` : prend la place libre (jusqu'à `width`) et rétrécit sur petit écran au lieu de pousser
  // les boutons voisins à la ligne.
  return (
    <div style={{ ...BOX, ...(grow ? { flex: '1 1 200px', maxWidth: width, minWidth: 180 } : { width }) }}>
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
/** `tone` (0 à 5) : bouton plein dans le nuancier bleu, aux couleurs des pastilles correspondantes. */
export function ToolbarButton({ icon, children, onClick, primary = false, active = false, tone = null, title, disabled = false }) {
  const dark = primary || active;
  const t = tone != null ? BLUE_TONES[tone] : null;
  const bg = t ? t.bg : dark ? '#1E2447' : 'white';
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={{
        opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px', borderRadius: 8,
        background: bg, color: t ? t.color : dark ? 'white' : '#374151',
        border: `1px solid ${t || dark ? bg : '#E5E7EB'}`,
        fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
      }}
    >
      {icon}{children}
    </button>
  );
}

/** Pastille arrondie dans le nuancier bleu (`tone` de 0 = foncé à 5 = clair ; null = gris neutre). */
export function TonePill({ tone = 4, children, title }) {
  const t = toneColors(tone); // null → gris neutre
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 99,
      background: t.bg, color: t.color, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1,
    }}>
      {children}
    </span>
  );
}

/** Menu déroulant (même principe que le sélecteur de vue du Planning).
    options : [{ value, label, count? }] — le nombre s'affiche s'il est fourni.
    `multiple` : `value` est un tableau, chaque clic coche / décoche (au moins un choix reste coché). */
export function ToolbarMenu({ value, onChange, options, width = 240, multiple = false }) {
  const [open, setOpen] = useState(false);
  const isOn = (v) => (multiple ? value.includes(v) : value === v);
  const text = (o) => (o.count != null ? `${o.label} (${o.count})` : o.label);
  const selected = options.filter(o => isOn(o.value));
  const buttonText = selected.length ? selected.map(text).join(' + ') : options[0]?.label;
  const pick = (v) => {
    if (!multiple) { onChange(v); setOpen(false); return; }
    const next = value.includes(v) ? value.filter(x => x !== v) : [...value, v];
    if (next.length) onChange(options.map(o => o.value).filter(x => next.includes(x))); // ordre du menu
  };
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ ...BOX, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
      >
        {buttonText} <ChevronDown size={14} color="#6B7280" />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 80 }} onClick={() => setOpen(false)} />
          <FitPanel style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width, background: 'white', borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #E0DED9', zIndex: 90, padding: 4 }}>
            {options.map(o => (
              <div
                key={o.value}
                onClick={() => pick(o.value)}
                style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: isOn(o.value) ? '#EEF4FD' : 'transparent', color: '#111827', fontWeight: isOn(o.value) ? 600 : 400 }}
              >
                {multiple && (
                  <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${isOn(o.value) ? '#1E2447' : '#C9C7C2'}`, background: isOn(o.value) ? '#1E2447' : 'white' }}>
                    {isOn(o.value) && <Check size={11} color="white" strokeWidth={3} />}
                  </span>
                )}
                <span style={{ flex: 1 }}>{text(o)}</span>
                {!multiple && isOn(o.value) && <Check size={14} color="#1E2447" />}
              </div>
            ))}
          </FitPanel>
        </>
      )}
    </div>
  );
}

/** Statut modifiable : la pastille du nuancier (TonePill) + la liste déroulante native, invisible,
    posée par-dessus. Même rendu et même menu partout (listes Chiffrages / Projets, Programmation,
    entêtes de projet et de chiffrage). options : { CLE: { label } } ; tones : { CLE: 0..5 | null }. */
export function StatusSelectPill({ value, options, tones, onChange, disabled = false, title = 'Changer le statut' }) {
  const opt = options[value] || Object.values(options)[0];
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
      <TonePill tone={tones[value] ?? tones[Object.keys(options)[0]]}>{opt?.label}</TonePill>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        title={title}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: disabled ? 'default' : 'pointer', appearance: 'none', border: 'none' }}
      >
        {Object.entries(options).map(([key, o]) => (
          <option key={key} value={key}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
