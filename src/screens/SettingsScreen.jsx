// src/screens/SettingsScreen.jsx
// Paramètres : profil de l'utilisateur connecté et, pour l'admin, la liste des utilisateurs.
// Même DA que les autres modules : titre de page 32 px, onglets en pastilles sur la ligne du
// titre, sections sans cadre (titres 20 px), champs DaField, tableau à cadre fin.
import React, { useState } from "react";
import { TextField, Avatar } from "@mui/material";
import { Camera } from "lucide-react";
import { useAuth, ROLES } from "../auth";
import { DaField } from "../components/ui/DaForm";
import { ToolbarButton, TonePill } from "../components/ui/ToolbarControls";
import { DA_FIELD_SX } from "../lib/constants/daStyles";
import { supabase } from "../lib/supabaseClient";
import { compressAndUpload } from "../lib/utils/imageUpload";
import { useAppSettings } from "../hooks/useSupabase";

import UsersAdmin from "../components/settings/UsersAdmin";
import InstallApp from "../components/settings/InstallApp";
import { roleOf } from "../lib/constants/roleLabels";

const ROBOTO = "Roboto, system-ui, sans-serif";
const sectionTitle = { fontSize: 20, fontWeight: 500, fontFamily: ROBOTO, color: "#111827", margin: "0 0 14px" };

function SoonRow({ title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #E8E6E2" }}>
      <span style={{ fontSize: 14, color: "#374151" }}>{title}</span>
      <TonePill tone={null}>Bientôt disponible</TonePill>
    </div>
  );
}

export default function SettingsScreen({ onBack }) {
  const {
    currentUser, setCurrentUser,
    users
  } = useAuth();

  const isAdmin = currentUser?.role === ROLES.ADMIN;
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("profile");

  // --- Profile State --- (keeps state)
  const [name, setName] = useState(currentUser?.name || "");
  const [email] = useState(currentUser?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || "");
  const [avatarUploading, setAvatarUploading] = useState(false);

  // --- GLOBAL SETTINGS ---
  const { settings: dbSettings, updateSettings } = useAppSettings();
  const [globalSettings, setGlobalSettings] = useState({ hourlyRate: 135, vatRate: 20 });

  // Sync state when DB settings load
  React.useEffect(() => {
    if (dbSettings) setGlobalSettings(dbSettings);
  }, [dbSettings]);


  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // 0. Update Global Settings (Admin Only)
      if (isAdmin) {
        await updateSettings(globalSettings);
      }

      const updates = {
        first_name: name.split(' ')[0],
        last_name: name.split(' ').slice(1).join(' '),
        avatar_url: avatarUrl,
      };

      // 1. Update Supabase Profile
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id);

      if (error) throw error;

      // 2. Update Local State
      setCurrentUser({ ...currentUser, name, avatarUrl });
      alert("Profil mis à jour avec succès.");
      if (onBack) onBack();

    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Erreur lors de la mise à jour du profil : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setAvatarUploading(true);
      // Upload réel vers Storage (avant : URL blob locale perdue au rechargement)
      const url = await compressAndUpload(f, 'avatars', { maxPx: 512 });
      setAvatarUrl(url);
    } catch (err) {
      console.error('Upload avatar échoué :', err);
      alert("Erreur lors de l'envoi de la photo de profil.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const role = roleOf(currentUser?.role);
  const tabs = [{ key: "profile", label: "Mon profil" }, ...(isAdmin ? [{ key: "users", label: "Utilisateurs" }] : [])];

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", padding: 24, fontFamily: ROBOTO }}>
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>
        {/* Titre + onglets sur la même ligne (comme Planning / Inventaire) */}
        <div className="df-title-tabs" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "end", columnGap: 16, marginBottom: 32 }}>
          <div>
            {onBack && (
              <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontWeight: 600, fontSize: 13, marginBottom: 4, padding: 0 }}>
                ← Retour
              </button>
            )}
            <h1 style={{ fontSize: 32, fontWeight: 400, color: "#111827", margin: 0, letterSpacing: "-0.01em" }}>Paramètres</h1>
          </div>
          {tabs.length > 1 ? (
            <div style={{ display: "flex", gap: 2, paddingBottom: 2 }}>
              {tabs.map((t) => (
                <button
                  key={t.key}
                  className="df-pill-tab" data-active={tab === t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    padding: "8px 20px", borderRadius: 99, fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer", outline: "none",
                    background: tab === t.key ? "#1E2447" : "transparent", color: tab === t.key ? "#FFFFFF" : "#4B5563",
                    boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.2s cubic-bezier(0.25, 1, 0.5, 1)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : <div />}
          <div />
        </div>

        {/* === MON PROFIL === : identité à gauche, réglages à droite, bloc centré */}
        {tab === "profile" && (
          <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(220px, 280px) minmax(0, 1fr)", gap: 48, alignItems: "start" }} className="df-settings-profile">
            {/* Identité */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "28px 20px", background: "#F7F7F5", borderRadius: 12 }}>
              <div style={{ position: "relative" }}>
                <Avatar src={avatarUrl} sx={{ width: 104, height: 104, bgcolor: "white", color: "#6B7280", fontSize: 34, fontWeight: 400, fontFamily: ROBOTO, border: "1px solid #E0DED9" }}>
                  {name ? name.substring(0, 2).toUpperCase() : "U"}
                </Avatar>
                <label title="Changer la photo" style={{ position: "absolute", right: 0, bottom: 0, width: 32, height: 32, borderRadius: 99, background: "#1E2447", color: "white", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #F7F7F5", cursor: avatarUploading ? "wait" : "pointer" }}>
                  <Camera size={15} />
                  <input hidden accept="image/*" type="file" disabled={avatarUploading} onChange={handleAvatarFile} />
                </label>
              </div>
              <div style={{ fontSize: 22, fontWeight: 400, color: "#111827", marginTop: 16 }}>{name || "Nouvel utilisateur"}</div>
              <div style={{ marginTop: 8 }}><TonePill tone={role.tone}>{role.label}</TonePill></div>
              <div style={{ fontSize: 13, color: "#6B7280", marginTop: 10, wordBreak: "break-all" }}>{email || "Aucun e-mail"}</div>
              {avatarUploading && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>Envoi de la photo…</div>}
            </div>

            {/* Réglages */}
            <div>
              <h2 style={sectionTitle}>Informations personnelles</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 36 }}>
                <DaField label="Nom complet">
                  <TextField fullWidth size="small" value={name} onChange={(e) => setName(e.target.value)} sx={DA_FIELD_SX} />
                </DaField>
                <DaField label="E-mail" hint="Identifiant de connexion, non modifiable ici.">
                  <TextField fullWidth size="small" value={email} disabled sx={DA_FIELD_SX} />
                </DaField>
              </div>

              <h2 style={sectionTitle}>Sécurité et notifications</h2>
              <div style={{ borderTop: "1px solid #E8E6E2", marginBottom: 32 }}>
                <SoonRow title="Modification du mot de passe" />
                <SoonRow title="Préférences de notifications" />
              </div>

              <h2 style={sectionTitle}>Application</h2>
              <div style={{ borderTop: "1px solid #E8E6E2", marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid #E8E6E2" }}>
                  <div>
                    <div style={{ fontSize: 14, color: "#374151" }}>Installer Droitfil sur cet appareil</div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>Dans le Dock (Mac), le menu Démarrer (Windows) ou sur l'écran d'accueil, dans sa propre fenêtre. Mises à jour automatiques.</div>
                  </div>
                  <InstallApp />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <ToolbarButton onClick={onBack}>Annuler</ToolbarButton>
                <ToolbarButton primary onClick={handleSaveProfile} disabled={saving || avatarUploading}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </ToolbarButton>
              </div>
            </div>
          </div>
        )}

        {/* === UTILISATEURS (admin) === */}
        {tab === "users" && isAdmin && <UsersAdmin users={users} currentUserId={currentUser?.id} />}
      </div>
    </div>
  );
}
