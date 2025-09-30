// src/screens/SettingsScreen.jsx
import React, { useMemo, useState } from "react";
import { S, COLORS } from "../lib/constants/ui";
import { useAuth, ROLES } from "../auth";
import { Pencil, Trash2, Plus, ShieldCheck, RefreshCcw } from "lucide-react";

const ROLE_OPTIONS = [
  { value: ROLES.ADMIN,            label: "Admin" },
  { value: ROLES.ORDONNANCEMENT,   label: "Ordonnancement (plein accès hors admin)" },
  { value: ROLES.PILOTAGE_PROJET,  label: "Pilotage projet (lecture seule Planning)" },
  { value: ROLES.PRODUCTION,       label: "Production (Prod + Inventaire, pas Chiffrage)" },
];

export default function SettingsScreen({ onBack }) {
  const {
    currentUser, setCurrentUser,
    users, addUser, updateUser, removeUser, resetPasswordDemo
  } = useAuth();

  const isAdmin = currentUser?.role === ROLES.ADMIN;

  // --- Onglets
  const [tab, setTab] = useState(isAdmin ? "profile" : "profile"); // "profile" | "users"

  // --- Profil (comme avant)
  const [name, setName] = useState(currentUser?.name || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || "");

  const handleSaveProfile = () => {
    setCurrentUser({ ...currentUser, name, email, avatarUrl });
    onBack?.();
  };

  const handleAvatarFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setAvatarUrl(url);
  };

  // --- Users (admin)
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({ name: "", email: "", role: ROLES.PRODUCTION });

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return (users || []).filter(u =>
      [u.name, u.email, u.role].some(x => String(x || "").toLowerCase().includes(q))
    );
  }, [users, query]);

  const openCreate = () => {
    setEditId(null);
    setDraft({ name: "", email: "", role: ROLES.PRODUCTION });
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditId(u.id);
    setDraft({ name: u.name || "", email: u.email || "", role: u.role || ROLES.PRODUCTION });
    setModalOpen(true);
  };

  const saveUser = () => {
    const payload = {
      name: (draft.name || "").trim(),
      email: (draft.email || "").trim(),
      role: draft.role || ROLES.PRODUCTION,
    };
    if (!payload.name || !payload.email) {
      alert("Nom et email sont requis.");
      return;
    }
    if (editId) updateUser(editId, payload);
    else addUser(payload);
    setModalOpen(false);
  };

  const askDelete = (u) => {
    if (u.id === currentUser?.id) {
      alert("Impossible de supprimer l'utilisateur actuellement connecté.");
      return;
    }
    if (confirm(`Supprimer ${u.name} ?`)) removeUser(u.id);
  };

  return (
    <div style={S.contentWrap}>
      {/* Barre top */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <button style={S.smallBtn} onClick={onBack}>← Retour</button>
        <h2 style={{ margin: 0 }}>Paramètres</h2>
        <div style={{ flex: 1 }} />
        {isAdmin && (
          <div style={S.pills} aria-label="Onglets paramètres">
            <button style={S.pill(tab === "profile")} onClick={() => setTab("profile")}>Mon profil</button>
            <button style={S.pill(tab === "users")} onClick={() => setTab("users")}>Utilisateurs</button>
          </div>
        )}
      </div>

      {/* === Onglet PROFIL === */}
      {tab === "profile" && (
        <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
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
              onClick={handleSaveProfile}
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* === Onglet UTILISATEURS (ADMIN) === */}
      {tab === "users" && isAdmin && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              placeholder="Rechercher nom / email / rôle"
              style={{ ...S.input, maxWidth: 360 }}
              aria-label="Recherche utilisateur"
            />
            <div style={{ flex: 1 }} />
            <button
              style={{ ...S.smallBtn, background: COLORS.tile, color: "#fff", borderColor: COLORS.tile }}
              onClick={openCreate}
            >
              <Plus size={14} /> Nouveau
            </button>
          </div>

          <div style={{ ...S.tableBlock }}>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Nom</th>
                    <th style={S.th}>Email</th>
                    <th style={S.th}>Rôle</th>
                    <th style={{ ...S.th, width: 180 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredUsers || []).map((u, idx) => (
                    <tr key={u.id || idx} style={idx % 2 ? S.trAlt : undefined}>
                      <td style={S.td}>{u.name}</td>
                      <td style={S.td}>{u.email}</td>
                      <td style={S.td}>
                        <span style={{ ...S.smallBtn, background: "#eef2ff", borderColor: "#eef2ff" }}>
                          {ROLE_OPTIONS.find(r => r.value === u.role)?.label || u.role}
                        </span>
                      </td>
                      <td style={S.td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={S.smallBtn} title="Modifier" onClick={()=>openEdit(u)}>
                            <Pencil size={14} /> Modifier
                          </button>
                          <button
                            style={{ ...S.smallBtn }}
                            title="Réinitialiser mot de passe"
                            onClick={()=>resetPasswordDemo(u.id)}
                          >
                            <RefreshCcw size={14} /> Reset MDP
                          </button>
                          <button
                            style={{ ...S.smallBtn, color: "#b91c1c", borderColor: "#e5e7eb" }}
                            title="Supprimer"
                            onClick={()=>askDelete(u)}
                          >
                            <Trash2 size={14} /> Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!filteredUsers || filteredUsers.length === 0) && (
                    <tr><td style={S.td} colSpan={4}>Aucun utilisateur.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal création/édition */}
          {modalOpen && (
            <div style={S.modalBackdrop}>
              <div style={{ ...S.modal, width: 560, borderRadius: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <ShieldCheck size={18} />
                  <b>{editId ? "Modifier un utilisateur" : "Nouvel utilisateur"}</b>
                  <div style={{ flex: 1 }} />
                  <button style={S.smallBtn} onClick={()=>setModalOpen(false)}>Fermer</button>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", gap: 10 }}>
                    <span>Nom</span>
                    <input value={draft.name} onChange={(e)=>setDraft(d=>({ ...d, name: e.target.value }))} />
                  </label>
                  <label style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", gap: 10 }}>
                    <span>Email</span>
                    <input value={draft.email} onChange={(e)=>setDraft(d=>({ ...d, email: e.target.value }))} />
                  </label>
                  <label style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", gap: 10 }}>
                    <span>Rôle</span>
                    <select
                      value={draft.role}
                      onChange={(e)=>setDraft(d=>({ ...d, role: e.target.value }))}
                      style={S.input}
                    >
                      {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </label>
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                  <button style={S.smallBtn} onClick={()=>setModalOpen(false)}>Annuler</button>
                  <button
                    style={{ ...S.smallBtn, background: COLORS.tile, color: "#fff", borderColor: COLORS.tile }}
                    onClick={saveUser}
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}