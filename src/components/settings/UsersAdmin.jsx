// Paramètres › Utilisateurs (admin) : tableau de bord de l'équipe — rôle, compte de connexion,
// mot de passe provisoire, désactivation / réactivation, invitation par e-mail.
// Les actions passent par /api/admin/users (clé service_role côté serveur, rôle admin vérifié).
import React, { useEffect, useMemo, useState } from "react";
import { Avatar, TextField } from "@mui/material";
import { KeyRound, UserX, UserCheck, UserPlus, Copy, RefreshCw } from "lucide-react";
import DaDialog from "../ui/DaDialog";
import { DaField, ChoicePill } from "../ui/DaForm";
import { ToolbarButton, ToolbarSearch, TonePill, StatusSelectPill } from "../ui/ToolbarControls";
import { DA_FIELD_SX, TABLE_FRAME_STYLE } from "../../lib/constants/daStyles";
import { ROLE_INFO, roleOf } from "../../lib/constants/roleLabels";
import {
  listAccounts, setUserRole, setUserPassword, deactivateUser, reactivateUser, inviteUser,
} from "../../lib/adminUsers";

const ROLE_TONES = Object.fromEntries(Object.entries(ROLE_INFO).map(([k, v]) => [k, v.tone]));

const ROBOTO = "Roboto, system-ui, sans-serif";
const th = { padding: "10px 14px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#374151", background: "#F4F4F4", borderBottom: "1px solid #E0DED9", whiteSpace: "nowrap" };
const td = { padding: "10px 14px", borderBottom: "1px solid #E8E6E2", fontSize: 14, color: "#111827", verticalAlign: "middle" };
const iconBtn = { width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #E5E7EB", borderRadius: 8, background: "white", color: "#374151", cursor: "pointer" };

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const genPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(10);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("");
};

function PasswordDialog({ user, onClose, onDone }) {
  const [pwd, setPwd] = useState(genPassword);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const save = async () => {
    setSaving(true); setError("");
    try { await setUserPassword(user.id, pwd); setDone(true); onDone?.(); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };
  return (
    <DaDialog open onClose={onClose} title="Mot de passe provisoire" subtitle={user.name}
      footer={(
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <ToolbarButton onClick={onClose}>{done ? "Fermer" : "Annuler"}</ToolbarButton>
          {!done && <ToolbarButton primary onClick={save} disabled={saving || pwd.length < 8}>{saving ? "Enregistrement…" : "Définir ce mot de passe"}</ToolbarButton>}
        </div>
      )}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <DaField label="Nouveau mot de passe" hint="Au moins 8 caractères. Transmettez-le à la personne : elle pourra se connecter avec immédiatement.">
          <div style={{ display: "flex", gap: 8 }}>
            <TextField fullWidth size="small" value={pwd} onChange={(e) => setPwd(e.target.value)} disabled={done} sx={DA_FIELD_SX} />
            {!done && <button type="button" title="Générer un autre" style={{ ...iconBtn, width: 40, height: 40 }} onClick={() => setPwd(genPassword())}><RefreshCw size={16} /></button>}
            <button type="button" title="Copier" style={{ ...iconBtn, width: 40, height: 40 }} onClick={() => navigator.clipboard?.writeText(pwd)}><Copy size={16} /></button>
          </div>
        </DaField>
        {done && <div style={{ fontSize: 13, color: "#1E2447", fontWeight: 600 }}>Mot de passe enregistré.</div>}
        {error && <div style={{ fontSize: 13, color: "#B42318" }}>{error}</div>}
      </div>
    </DaDialog>
  );
}

function InviteDialog({ onClose, onDone }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("pose");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    setSaving(true); setError("");
    try { await inviteUser({ email, firstName, lastName, role }); onDone(email); }
    catch (e) { setError(e.message); setSaving(false); }
  };
  return (
    <DaDialog open onClose={onClose} title="Inviter un utilisateur" subtitle="Un e-mail lui permettra de choisir son mot de passe."
      footer={(
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <ToolbarButton onClick={onClose}>Annuler</ToolbarButton>
          <ToolbarButton primary onClick={send} disabled={saving || !firstName.trim() || !email.trim()}>{saving ? "Envoi…" : "Envoyer l'invitation"}</ToolbarButton>
        </div>
      )}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <DaField label="Prénom"><TextField fullWidth size="small" value={firstName} onChange={(e) => setFirstName(e.target.value)} sx={DA_FIELD_SX} autoFocus /></DaField>
          <DaField label="Nom"><TextField fullWidth size="small" value={lastName} onChange={(e) => setLastName(e.target.value)} sx={DA_FIELD_SX} /></DaField>
        </div>
        <DaField label="E-mail"><TextField fullWidth size="small" type="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={DA_FIELD_SX} /></DaField>
        <DaField label="Rôle">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(ROLE_INFO).map(([k, v]) => <ChoicePill key={k} active={role === k} onClick={() => setRole(k)}>{v.label}</ChoicePill>)}
          </div>
        </DaField>
        {error && <div style={{ fontSize: 13, color: "#B42318" }}>{error}</div>}
      </div>
    </DaDialog>
  );
}

export default function UsersAdmin({ users = [], currentUserId }) {
  // Copie locale : les actions s'affichent tout de suite, sans recharger toute l'équipe.
  const [list, setList] = useState(users);
  useEffect(() => { setList(users); }, [users]);
  const [accounts, setAccounts] = useState(null);
  const [accountsError, setAccountsError] = useState("");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState("active"); // active | archived
  const [pwdUser, setPwdUser] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [flash, setFlash] = useState("");
  const [busyId, setBusyId] = useState(null);

  const loadAccounts = () => listAccounts().then((a) => { setAccounts(a); setAccountsError(""); }).catch((e) => setAccountsError(e.message));
  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { if (!flash) return undefined; const t = setTimeout(() => setFlash(""), 4000); return () => clearTimeout(t); }, [flash]);

  const patchLocal = (id, patch) => setList((l) => l.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  const act = async (u, fn, patch, message) => {
    setBusyId(u.id);
    try { await fn(); if (patch) patchLocal(u.id, patch); setFlash(message); }
    catch (e) { alert(e.message); }
    finally { setBusyId(null); }
  };
  const changeRole = (u, role) => act(u, () => setUserRole(u.id, role), { role }, `${u.name} : rôle « ${roleOf(role).label} ».`);
  const toggleActive = (u) => {
    const off = !u.archived_at;
    if (off && !window.confirm(`Désactiver ${u.name} ?\n\nIl ne pourra plus se connecter et disparaîtra des listes ; son historique est conservé. Réactivable à tout moment.`)) return;
    act(u, () => (off ? deactivateUser(u.id) : reactivateUser(u.id)), { archived_at: off ? new Date().toISOString() : null }, off ? `${u.name} désactivé.` : `${u.name} réactivé.`);
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list
      .filter((u) => (show === "active" ? !u.archived_at : !!u.archived_at))
      .filter((u) => !q || [u.name, accounts?.[u.id]?.email, roleOf(u.role).label].filter(Boolean).join(" ").toLowerCase().includes(q))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr"));
  }, [list, show, search, accounts]);
  const nActive = list.filter((u) => !u.archived_at).length;
  const nArchived = list.length - nActive;

  const accountCell = (u) => {
    if (!accounts) return <span style={{ color: "#9B9A97" }}>{accountsError ? "—" : "…"}</span>;
    const a = accounts[u.id];
    if (!a) return <span style={{ color: "#9B9A97" }}>Sans compte</span>;
    return (
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#111827", overflow: "hidden", textOverflow: "ellipsis" }}>{a.email}</div>
        <div style={{ fontSize: 12, color: "#9B9A97" }}>
          {a.lastSignInAt ? `Dernière connexion le ${fmtDate(a.lastSignInAt)}` : a.invitedAt && !a.confirmed ? `Invité le ${fmtDate(a.invitedAt)} — en attente` : "Jamais connecté"}
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: ROBOTO }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Nom, e-mail, rôle…" width={320} grow />
        <ChoicePill active={show === "active"} onClick={() => setShow("active")}>Actifs ({nActive})</ChoicePill>
        <ChoicePill active={show === "archived"} onClick={() => setShow("archived")}>Désactivés ({nArchived})</ChoicePill>
        <span style={{ fontSize: 13, color: flash ? "#1E2447" : "#B42318", fontWeight: 600 }}>{flash || accountsError}</span>
        <div style={{ marginLeft: "auto" }}>
          <ToolbarButton primary icon={<UserPlus size={16} />} onClick={() => setInviting(true)}>Inviter un utilisateur</ToolbarButton>
        </div>
      </div>

      <div style={TABLE_FRAME_STYLE}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup><col style={{ width: "28%" }} /><col style={{ width: "34%" }} /><col style={{ width: "22%" }} /><col style={{ width: "16%" }} /></colgroup>
          <thead>
            <tr><th style={th}>Nom</th><th style={th}>Compte</th><th style={th}>Rôle</th><th style={{ ...th, textAlign: "right" }}>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((u, i) => {
              const last = i === rows.length - 1 ? { borderBottom: "none" } : {};
              const isMe = u.id === currentUserId;
              const hasAccount = !!accounts?.[u.id];
              return (
                <tr key={u.id} style={{ opacity: busyId === u.id ? 0.5 : 1 }}>
                  <td style={{ ...td, ...last }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <Avatar src={u.avatar_url || u.avatarUrl} sx={{ width: 28, height: 28, fontSize: 12, bgcolor: "#F4F4F4", color: "#6B7280", fontFamily: ROBOTO }}>
                        {(u.name || "?").substring(0, 2).toUpperCase()}
                      </Avatar>
                      <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
                      {isMe && <TonePill tone={5}>Vous</TonePill>}
                    </div>
                  </td>
                  <td style={{ ...td, ...last }}>{accountCell(u)}</td>
                  <td style={{ ...td, ...last }}>
                    {ROLE_INFO[u.role] ? (
                      <StatusSelectPill value={u.role} options={ROLE_INFO} tones={ROLE_TONES} title="Changer le rôle"
                        disabled={isMe || busyId === u.id} onChange={(r) => changeRole(u, r)} />
                    ) : <TonePill tone={null}>{u.role || "—"}</TonePill>}
                  </td>
                  <td style={{ ...td, ...last, textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      {hasAccount && !u.archived_at && (
                        <button type="button" style={iconBtn} title="Définir un mot de passe provisoire" onClick={() => setPwdUser(u)}><KeyRound size={15} /></button>
                      )}
                      {!isMe && (
                        <button type="button" style={iconBtn} title={u.archived_at ? "Réactiver" : "Désactiver"} onClick={() => toggleActive(u)} disabled={busyId === u.id}>
                          {u.archived_at ? <UserCheck size={15} /> : <UserX size={15} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={4} style={{ ...td, borderBottom: "none", textAlign: "center", color: "#9B9A97", padding: 28 }}>Aucun utilisateur.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pwdUser && <PasswordDialog user={pwdUser} onClose={() => setPwdUser(null)} />}
      {inviting && (
        <InviteDialog onClose={() => setInviting(false)} onDone={(email) => {
          setInviting(false);
          setFlash(`Invitation envoyée à ${email}. La personne apparaîtra ici après rechargement de la page.`);
          loadAccounts();
        }} />
      )}
    </div>
  );
}
