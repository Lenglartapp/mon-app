import React, { useState } from "react";
import { COLORS, S } from "../lib/constants/ui";

export default function EditFieldModal({ col, onClose, onSave }) {
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