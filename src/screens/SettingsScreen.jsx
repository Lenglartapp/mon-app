import React, { useState } from "react";
import { S, COLORS } from "../lib/constants/ui";
import { useAuth } from "../auth";

export default function SettingsScreen({ onBack }) {
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