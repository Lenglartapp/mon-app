import React, { useState } from 'react';
import { useAuth } from '../auth';
import { Monitor, Scissors, Truck, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, TextField, Button, CircularProgress, Alert } from '@mui/material';

export default function LoginScreen() {
    const { users, login } = useAuth();
    const [logoError, setLogoError] = useState(false);

    // États du formulaire
    const [selectedUser, setSelectedUser] = useState(null);
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleUserClick = (user) => {
        if (!user.email) return;
        setSelectedUser(user);
        setPassword("");
        setError(null);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await login(selectedUser.email, password);
        } catch (err) {
            console.error(err);
            setError("Mot de passe incorrect.");
            setLoading(false);
        }
    };

    const groups = {
        bureau: users.filter(u => u.resourceType === 'bureau' || !u.resourceType),
        atelier: users.filter(u => u.resourceType === 'prepa' || u.resourceType === 'conf'),
        pose: users.filter(u => u.resourceType === 'pose'),
    };

    const SectionHeader = ({ icon: Icon, color, bg, title }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, marginTop: 10, paddingBottom: 8, borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ background: bg, color: color, padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</span>
        </div>
    );

    const UserCard = ({ user }) => (
        <button
            onClick={() => handleUserClick(user)}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                padding: '16px 12px', borderRadius: 12, border: '1px solid #E5E7EB',
                background: 'white', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                minWidth: 140, flex: '1 0 140px', maxWidth: 180,
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
            <div style={{
                width: 52, height: 52, borderRadius: '50%', background: user.color || '#374151', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, border: '3px solid #F9FAFB',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                {user.initials || (user.name ? user.name.slice(0, 2).toUpperCase() : '??')}
            </div>
            <div style={{ textAlign: 'center', width: '100%' }}>
                <div style={{ fontWeight: 600, color: '#111827', fontSize: 14, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>{user.role}</div>
            </div>
        </button>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ maxWidth: 900, width: '100%', background: 'white', borderRadius: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '40px 50px', display: 'flex', flexDirection: 'column', gap: 40 }}>
                <div style={{ textAlign: 'center' }}>
                    {!logoError ? <img src="/logo.png" alt="LENGLART" style={{ height: 60, width: 'auto', marginBottom: 16 }} onError={() => setLogoError(true)} /> : <h1 style={{ fontSize: 36, fontWeight: 900 }}>LENGLART</h1>}
                    <p style={{ color: '#6B7280', fontSize: 15, fontWeight: 500 }}>Connexion sécurisée à l'espace production</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {groups.bureau?.length > 0 && <section><SectionHeader icon={Monitor} title="Bureau & Pilotage" bg="#F3F4F6" color="#374151" /><div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>{groups.bureau.map(u => <UserCard key={u.id} user={u} />)}</div></section>}
                    {groups.atelier?.length > 0 && <section><SectionHeader icon={Scissors} title="Atelier" bg="#EFF6FF" color="#1E40AF" /><div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>{groups.atelier.map(u => <UserCard key={u.id} user={u} />)}</div></section>}
                    {groups.pose?.length > 0 && <section><SectionHeader icon={Truck} title="Pose" bg="#ECFDF5" color="#047857" /><div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>{groups.pose.map(u => <UserCard key={u.id} user={u} />)}</div></section>}
                </div>
                <div style={{ textAlign: 'center', marginTop: 10, color: '#9CA3AF', fontSize: 12 }}>© Lenglart - Production 1.0</div>
            </div>

            <Dialog open={!!selectedUser} onClose={() => setSelectedUser(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
                <DialogTitle sx={{ textAlign: 'center', fontWeight: 700 }}>Bonjour {selectedUser?.name?.split(' ')[0]} 👋</DialogTitle>
                <DialogContent>
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}><div style={{ width: 64, height: 64, borderRadius: '50%', background: selectedUser?.color || '#374151', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24 }}>{selectedUser?.initials}</div></div>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField autoFocus label="Mot de passe" type="password" fullWidth value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
                        <Button type="submit" variant="contained" size="large" disabled={loading || !password} startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Lock size={20} />} sx={{ borderRadius: 3, py: 1.5, fontWeight: 700, bgcolor: '#111827', '&:hover': { bgcolor: 'black' } }}>{loading ? 'Connexion...' : 'Se connecter'}</Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}