import React from "react";
import { StatusSelectPill } from "./ToolbarControls";

// En-tête « fiche d'identité » partagé par l'écran chiffrage et l'écran projet :
// carte deux colonnes (identité à gauche, encadré à droite), titre renommable au
// double-clic, statut en pilule, chargé d'affaires modifiable, méta-infos.

function stringToColor(string) {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}

const initialsOf = (name) => String(name || "?").trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";

// bare : sans cadre (fond, bordure, ombre, marges), posé directement sur la page.
export function HeaderCard({ left, right, stacked = false, bare = false }) {
  return (
    <div style={{
      ...(bare ? {} : {
        background: 'var(--df-bg)', border: '1px solid var(--df-border)', borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: stacked ? 16 : '22px 26px',
      }),
      display: 'grid', gridTemplateColumns: (stacked || !right) ? 'minmax(0,1fr)' : 'minmax(0,1.3fr) minmax(0,1fr)', gap: stacked ? 16 : 28,
    }}>
      <div style={{ minWidth: 0 }}>{left}</div>
      {right && <div style={{ minWidth: 0, display: 'flex' }}>{right}</div>}
    </div>
  );
}

const PANEL_TONES = {
  notes: { bg: 'var(--df-chip-adv-bg)', border: 'var(--df-x-F3E3A3)', accent: '#F59E0B', title: 'var(--df-warn-text)' },
  logistics: { bg: 'var(--df-x-F5F7FB)', border: 'var(--df-x-DCE3EF)', accent: 'var(--df-primary)', title: 'var(--df-primary)' },
  // Bloc discret façon Notion (même rendu que le bloc Notes du chiffrage)
  soft: { bg: 'var(--df-surface)', soft: true },
};

export function HeaderPanel({ title, tone = 'notes', children }) {
  const t = PANEL_TONES[tone] || PANEL_TONES.notes;
  if (t.soft) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: t.bg, borderRadius: 8, padding: '10px 14px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--df-faint-2)', marginBottom: 10 }}>{title}</div>
        {children}
      </div>
    );
  }
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
      background: t.bg, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.accent}`,
      borderRadius: 8, padding: '14px 18px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: t.title, marginBottom: tone === 'logistics' ? 16 : 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function EditableTitle({ value, onSave, canEdit, placeholder = "Sans nom", fontSize = 30, fontWeight = 800, fontFamily = "inherit" }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value || "");
  const [hover, setHover] = React.useState(false);

  React.useEffect(() => { if (!editing) setDraft(value || ""); }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    else setDraft(value || "");
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setDraft(value || ""); setEditing(false); }
        }}
        style={{
          fontSize, fontWeight, color: 'var(--df-text)', fontFamily, letterSpacing: '-0.01em',
          border: '2px solid #3B82F6', borderRadius: 6, padding: '0 6px', marginLeft: -8,
          outline: 'none', width: '100%', maxWidth: 900, background: 'var(--df-bg)',
        }}
        placeholder={placeholder}
      />
    );
  }

  return (
    <h1
      onDoubleClick={canEdit ? () => setEditing(true) : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={canEdit ? "Double-cliquer pour renommer" : undefined}
      style={{
        fontSize, fontWeight, fontFamily, color: 'var(--df-text)', margin: 0, marginLeft: -6, lineHeight: 1.15,
        letterSpacing: '-0.01em', padding: '2px 6px', borderRadius: 6, cursor: 'default',
        display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: '100%',
        background: canEdit && hover ? 'var(--df-surface-2)' : 'transparent',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || placeholder}</span>
      {canEdit && <span style={{ fontSize: 14, color: 'var(--df-muted)', opacity: hover ? 1 : 0, transition: 'opacity .15s' }}>✎</span>}
    </h1>
  );
}

// options: { KEY: { label, color } }
// Statut d'entête (projet, chiffrage) : même pastille et même liste déroulante que dans les listes.
export function StatusPill({ value, options, tones, onChange, disabled, title, disabledOptions }) {
  return <StatusSelectPill value={value} options={options} tones={tones} onChange={onChange} disabled={disabled} title={title} disabledOptions={disabledOptions} />;
}

export function HeaderButton({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'var(--df-bg)', border: '1px solid var(--df-border)', cursor: 'pointer', color: 'var(--df-text-2)', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}
    >
      {children}
    </button>
  );
}

export function MetaItem({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--df-faint-2)', fontFamily: 'Roboto, system-ui, sans-serif' }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--df-text-1b)', display: 'flex', alignItems: 'center', gap: 6, minHeight: 26 }}>{children}</span>
    </div>
  );
}

// users: [{ id, name }]
export function OwnerPicker({ value, users = [], onChange, canEdit }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const avatar = (name, size = 24) => (
    <span style={{
      width: size, height: size, borderRadius: '50%', background: name ? stringToColor(name) : 'var(--df-border-strong)', color: 'white',
      fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{initialsOf(name)}</span>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={canEdit ? () => setOpen(o => !o) : undefined}
        title={canEdit ? "Changer de chargé d'affaires" : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid transparent', background: open ? 'var(--df-bg)' : 'none',
          borderColor: open ? 'var(--df-border-2)' : 'transparent', padding: '2px 8px 2px 2px', borderRadius: 99,
          cursor: canEdit ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: value ? 'var(--df-text-1b)' : 'var(--df-faint)',
        }}
      >
        {avatar(value)}
        {value || "Non assigné"}
        {canEdit && <span style={{ color: 'var(--df-faint)', fontSize: 10 }}>▾</span>}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 1000, background: 'var(--df-bg)', border: '1px solid var(--df-border)',
          borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)', padding: 6, minWidth: 220, maxHeight: 320, overflowY: 'auto',
        }}>
          {users.length === 0 && <div style={{ padding: '7px 8px', fontSize: 12, color: 'var(--df-faint)' }}>Aucun utilisateur éligible</div>}
          {users.map(u => (
            <div
              key={u.id || u.name}
              onClick={() => { setOpen(false); if (u.name !== value) onChange(u.name); }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--df-surface-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = u.name === value ? 'var(--df-surface)' : 'transparent'; }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: u.name === value ? 'var(--df-surface)' : 'transparent', fontWeight: u.name === value ? 600 : 400 }}
            >
              {avatar(u.name)}
              {u.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
