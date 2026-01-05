// src/screens/SettingsScreen.jsx
import React, { useState } from "react";
import {
  Container, Card, CardContent, CardHeader,
  Typography, Grid, TextField, Button, Avatar, IconButton,
  Divider, Box, Switch, Badge, Chip, Paper
} from "@mui/material";
import { Camera, ArrowLeft, Mail, Briefcase, Users } from "lucide-react";
import { useAuth, ROLES } from "../auth";

const ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: "Administrateur", color: "#1e1b4b" }, // Indigo 950
  { value: ROLES.ORDONNANCEMENT, label: "Ordonnancement", color: "#0f766e" }, // Teal 700
  { value: ROLES.PILOTAGE_PROJET, label: "Pilotage", color: "#c2410c" }, // Orange 700
  { value: ROLES.PRODUCTION, label: "Production", color: "#374151" }, // Gray 700
  { value: ROLES.ADV, label: "ADV", color: "#be185d" }, // Pink 700
];

import { supabase } from "../lib/supabaseClient";
import { useAppSettings } from "../hooks/useSupabase"; // <-- IMPORT HERE

export default function SettingsScreen({ onBack }) {
  const {
    currentUser, setCurrentUser,
    users, resetPasswordDemo
  } = useAuth();

  const isAdmin = currentUser?.role === ROLES.ADMIN;
  const [tab, setTab] = useState("profile");

  // --- Profile State --- (keeps state)
  const [name, setName] = useState(currentUser?.name || "");
  const [email] = useState(currentUser?.email || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [jobTitle, setJobTitle] = useState(currentUser?.jobTitle || "");
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || "");

  // Security
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Preferences
  const [notifEmail, setNotifEmail] = useState(currentUser?.preferences?.notifEmail ?? true);
  const [notifMentions, setNotifMentions] = useState(currentUser?.preferences?.mentions ?? true);
  const [notifActivity, setNotifActivity] = useState(currentUser?.preferences?.activity ?? false);

  // --- GLOBAL SETTINGS ---
  const { settings: dbSettings, updateSettings } = useAppSettings();
  const [globalSettings, setGlobalSettings] = useState({ hourlyRate: 135, vatRate: 20 });

  // Sync state when DB settings load
  React.useEffect(() => {
    if (dbSettings) setGlobalSettings(dbSettings);
  }, [dbSettings]);


  const handleSaveProfile = async () => {
    if (password && password !== confirmPassword) {
      alert("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      // 0. Update Global Settings (Admin Only)
      if (isAdmin) {
        await updateSettings(globalSettings);
      }

      const updates = {
        first_name: name.split(' ')[0], // Simple split for first/last name mapping
        last_name: name.split(' ').slice(1).join(' '),
        phone,
        job_title: jobTitle,
        avatar_url: avatarUrl,
        preferences: {
          notifEmail,
          mentions: notifMentions,
          activity: notifActivity
        }
      };

      // 1. Update Supabase Profile
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id);

      if (error) throw error;

      // 2. Update Password if changed (Requires separate auth API call)
      if (password) {
        const { error: pwdError } = await supabase.auth.updateUser({ password: password });
        if (pwdError) throw pwdError;
      }

      // 3. Update Local State
      const updatedUser = {
        ...currentUser,
        name, // Keep display name
        phone,
        jobTitle,
        avatarUrl,
        preferences: updates.preferences
      };
      setCurrentUser(updatedUser);
      alert("Profil et paramètres mis à jour avec succès.");
      if (onBack) onBack();

    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Erreur lors de la mise à jour du profil : " + err.message);
    }
  };

  const handleAvatarFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setAvatarUrl(url);
  };

  const roleInfo = ROLE_OPTIONS.find(r => r.value === currentUser?.role) || { label: currentUser?.role, color: '#333' };

  // Common styles
  const cardStyle = {
    bgcolor: 'transparent',
    boxShadow: 'none',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: 4
  };

  const inputStyle = {
    bgcolor: 'white',
    borderRadius: 1
  };

  // --- Render ---
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F9F7F2', py: 4 }}>
      <Container maxWidth="lg">

        {/* HEADER NAV */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <Button
            startIcon={<ArrowLeft size={20} />}
            onClick={onBack}
            sx={{
              color: '#6B7280',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { color: '#111827', bgcolor: 'transparent' }
            }}
          >
            Retour au Dashboard
          </Button>
          <Box sx={{ flex: 1 }} />

          {isAdmin && (
            <Box sx={{ bgcolor: 'rgba(255,255,255,0.6)', borderRadius: 3, p: 0.5, border: '1px solid rgba(0,0,0,0.05)' }}>
              <Button
                variant={tab === 'profile' ? 'contained' : 'text'}
                size="small"
                onClick={() => setTab('profile')}
                sx={{
                  borderRadius: 2,
                  bgcolor: tab === 'profile' ? '#1F2937' : 'transparent',
                  color: tab === 'profile' ? 'white' : '#6B7280',
                  boxShadow: 'none',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { bgcolor: tab === 'profile' ? '#374151' : 'rgba(0,0,0,0.04)' }
                }}
              >
                Mon Profil
              </Button>
              <Button
                variant={tab === 'users' ? 'contained' : 'text'}
                size="small"
                onClick={() => setTab('users')}
                sx={{
                  borderRadius: 2,
                  bgcolor: tab === 'users' ? '#1F2937' : 'transparent',
                  color: tab === 'users' ? 'white' : '#6B7280',
                  boxShadow: 'none',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { bgcolor: tab === 'users' ? '#374151' : 'rgba(0,0,0,0.04)' }
                }}
              >
                Utilisateurs
              </Button>
            </Box>
          )}
        </Box>

        {/* === TAB: PROFILE === */}
        {tab === 'profile' && (
          <Grid container spacing={4}>
            {/* ... (Keep existing Left Column) */}
            <Grid item xs={12} md={4}>
              {/* ... (Avatar & User Info Card Content - same as before) ... */}
              <Paper
                elevation={0}
                sx={{
                  ...cardStyle,
                  p: 4,
                  textAlign: 'center',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={
                    <IconButton
                      component="label"
                      sx={{
                        bgcolor: '#1F2937',
                        color: 'white',
                        width: 36, height: 36,
                        border: '3px solid #F9F7F2', // Matches background
                        '&:hover': { bgcolor: '#374151' }
                      }}
                    >
                      <Camera size={18} />
                      <input hidden accept="image/*" type="file" onChange={handleAvatarFile} />
                    </IconButton>
                  }
                >
                  <Avatar
                    src={avatarUrl}
                    sx={{
                      width: 120, height: 120,
                      bgcolor: 'white',
                      color: '#9CA3AF',
                      fontSize: 40,
                      fontWeight: 800,
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                      border: '1px solid rgba(0,0,0,0.05)'
                    }}
                  >
                    {name ? name.substring(0, 2).toUpperCase() : "U"}
                  </Avatar>
                </Badge>

                <Typography variant="h5" fontWeight={800} sx={{ mt: 3, color: '#111827' }}>
                  {name || "Nouvel Utilisateur"}
                </Typography>

                <Chip
                  label={roleInfo.label}
                  size="small"
                  sx={{
                    mt: 1,
                    bgcolor: roleInfo.color,
                    color: 'white',
                    fontWeight: 600,
                    fontSize: 11,
                    height: 24,
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}
                />

                <Box sx={{ mt: 4, width: '100%', textAlign: 'left' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, color: '#4B5563' }}>
                    <Mail size={18} />
                    <Typography variant="body2" fontWeight={500}>{email || "Aucun email"}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, color: '#4B5563' }}>
                    <Briefcase size={18} />
                    <Typography variant="body2" fontWeight={500}>{jobTitle || "Poste non défini"}</Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 3, width: '100%', borderColor: 'rgba(0,0,0,0.06)' }} />

                <Typography variant="caption" color="text.secondary">
                  Membre depuis 2024
                </Typography>
              </Paper>
            </Grid>

            {/* COLONNE DROITE: FORMULAIRE */}
            <Grid item xs={12} md={8}>
              <Paper
                elevation={0}
                sx={{
                  ...cardStyle,
                  overflow: 'hidden'
                }}
              >
                {/* --- GLOBAL SETTINGS (ADMIN ONLY) --- */}
                {isAdmin && (
                  <>
                    <CardHeader
                      title="Paramètres de l'Application"
                      titleTypographyProps={{ variant: 'subtitle1', fontWeight: 800, color: '#be185d', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: 12 }}
                      sx={{ px: 4, pt: 4, pb: 0 }}
                    />
                    <CardContent sx={{ px: 4, py: 3 }}>
                      <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Taux Horaire Global (€/h)"
                            type="number"
                            fullWidth
                            variant="outlined"
                            size="small"
                            value={globalSettings.hourlyRate}
                            onChange={(e) => setGlobalSettings(prev => ({ ...prev, hourlyRate: Number(e.target.value) }))}
                            InputProps={{ sx: inputStyle }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Taux TVA (%)"
                            type="number"
                            fullWidth
                            variant="outlined"
                            size="small"
                            value={globalSettings.vatRate}
                            onChange={(e) => setGlobalSettings(prev => ({ ...prev, vatRate: Number(e.target.value) }))}
                            InputProps={{ sx: inputStyle }}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                    <Divider sx={{ mx: 4, borderColor: 'rgba(0,0,0,0.06)' }} />
                  </>
                )}

                <CardHeader
                  title="Informations Personnelles"
                  titleTypographyProps={{ variant: 'subtitle1', fontWeight: 800, color: '#111827', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: 12 }}
                  sx={{ px: 4, pt: isAdmin ? 3 : 4, pb: 0 }}
                />
                <CardContent sx={{ px: 4, py: 3 }}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Nom complet"
                        fullWidth
                        variant="outlined"
                        size="small"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        InputProps={{ sx: inputStyle }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Téléphone"
                        fullWidth
                        variant="outlined"
                        size="small"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+33 6..."
                        InputProps={{ sx: inputStyle }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Fonction / Poste"
                        fullWidth
                        variant="outlined"
                        size="small"
                        placeholder="Ex: Responsable Production"
                        value={jobTitle}
                        onChange={e => setJobTitle(e.target.value)}
                        InputProps={{ sx: inputStyle }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>

                <Divider sx={{ mx: 4, borderColor: 'rgba(0,0,0,0.06)' }} />

                <CardHeader
                  title="Sécurité & Connexion"
                  titleTypographyProps={{ variant: 'subtitle1', fontWeight: 800, color: '#111827', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: 12 }}
                  sx={{ px: 4, pt: 3, pb: 0 }}
                />
                <CardContent sx={{ px: 4, py: 3 }}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Nouveau mot de passe"
                        type="password"
                        fullWidth
                        variant="outlined"
                        size="small"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        InputProps={{ sx: inputStyle }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Confirmer le mot de passe"
                        type="password"
                        fullWidth
                        variant="outlined"
                        size="small"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        InputProps={{ sx: inputStyle }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>

                <Divider sx={{ mx: 4, borderColor: 'rgba(0,0,0,0.06)' }} />

                <CardHeader
                  title="Gestion des Notifications"
                  titleTypographyProps={{ variant: 'subtitle1', fontWeight: 800, color: '#111827', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: 12 }}
                  sx={{ px: 4, pt: 3, pb: 0 }}
                />
                <CardContent sx={{ px: 4, pt: 1, pb: 3 }}>
                  {/* Mentions */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, mb: 1, bgcolor: 'rgb(249 250 251)', borderRadius: 2, border: '1px solid rgba(0,0,0,0.04)' }}>
                    <Box>
                      <Typography fontWeight={600} color="#374151" fontSize={14}>Mentions et Assignations</Typography>
                      <Typography variant="caption" color="#6B7280">
                        Être notifié quand on me cite ou m'assigne une tâche
                      </Typography>
                    </Box>
                    <Switch
                      checked={notifMentions}
                      onChange={e => setNotifMentions(e.target.checked)}
                    />
                  </Box>

                  {/* Activity */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, bgcolor: 'rgb(249 250 251)', borderRadius: 2, border: '1px solid rgba(0,0,0,0.04)' }}>
                    <Box>
                      <Typography fontWeight={600} color="#374151" fontSize={14}>Activité de mes projets</Typography>
                      <Typography variant="caption" color="#6B7280">
                        Modifications sur les projets où je suis membre
                      </Typography>
                    </Box>
                    <Switch
                      checked={notifActivity}
                      onChange={e => setNotifActivity(e.target.checked)}
                    />
                  </Box>
                </CardContent>

                <Divider sx={{ borderColor: 'rgba(0,0,0,0.06)' }} />

                {/* FOOTER ACTIONS */}
                <Box sx={{ p: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                  <Button
                    onClick={onBack}
                    sx={{ color: '#6B7280', fontWeight: 600, textTransform: 'none' }}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSaveProfile}
                    sx={{
                      px: 4,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: '#1F2937', // Dark Grey like Project List
                      color: 'white',
                      textTransform: 'none',
                      fontWeight: 600,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      '&:hover': { bgcolor: '#111827' }
                    }}
                  >
                    Enregistrer les modifications
                  </Button>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* === TAB: USERS (Admin) === */}
        {tab === 'users' && isAdmin && (
          <Paper elevation={0} sx={{ ...cardStyle, p: 4 }}>
            <Typography variant="h6" fontWeight={800} gutterBottom>Gestion des Utilisateurs</Typography>
            <Box sx={{ mt: 2 }}>
              {users.map(u => (
                <Box key={u.id} sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography fontWeight={600} color="#1F2937">{u.name}</Typography>
                    <Typography variant="caption" color="#6B7280">{u.email} — {u.role}</Typography>
                  </Box>
                  <Button size="small" variant="outlined" color="inherit" onClick={() => resetPasswordDemo(u.id)} sx={{ bgcolor: 'white' }}>Reset MDP</Button>
                </Box>
              ))}
              <Box sx={{ p: 4, textAlign: 'center', color: '#9CA3AF' }}>
                <Users size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                <Typography variant="body2">Interface d'administration complète bientôt disponible.</Typography>
              </Box>
            </Box>
          </Paper>
        )}

      </Container>
    </Box>
  );
}