// src/components/EtqFieldPicker.jsx
import React from "react";
import { S, COLORS } from "../lib/constants/ui.js";

export default function EtqFieldPicker({ visibleKeys, setVisibleKeys, schema, onClose }) {
  const CANDIDATES = (schema || []).filter(c => !["sel","detail","photo","button"].includes(c.key));

  const toggle = (k) =>
    setVisibleKeys(arr => (arr || []).includes(k) ? (arr || []).filter(x=>x!==k) : [ ...(arr || []), k ]);

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
            <input
              type="checkbox"
              checked={(visibleKeys || []).includes(c.key)}
              onChange={()=>toggle(c.key)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}