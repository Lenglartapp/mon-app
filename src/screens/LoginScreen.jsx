import React, { useState } from 'react';
import { useAuth } from '../auth';
import { Monitor, Scissors, Truck } from 'lucide-react';

export default function LoginScreen() {
    const { users, login } = useAuth();
    const [logoError, setLogoError] = useState(false);

    // Grouper les utilisateurs par type de ressource
    const groups = {
        bureau: users.filter(u => u.resourceType === 'bureau' || !u.resourceType),
        atelier: users.filter(u => u.resourceType === 'prepa' || u.resourceType === 'conf'),
        pose: users.filter(u => u.resourceType === 'pose'),
    };

    const SectionHeader = ({ icon: Icon, color, bg, title }) => (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 16, marginTop: 10,
            paddingBottom: 8, borderBottom: '1px solid #F3F4F6'
        }}>
            <div style={{
                background: bg, color: color,
                padding: 8, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <Icon size={18} strokeWidth={2.5} />
            </div>
            <span style={{
                fontSize: 13, fontWeight: 700, color: '#374151',
                textTransform: 'uppercase', letterSpacing: 0.8
            }}>
                {title}
            </span>
        </div>
    );

    const UserCard = ({ user }) => (
        <button
            onClick={() => login(user)}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                padding: '16px 12px', borderRadius: 12, border: '1px solid #E5E7EB',
                background: 'white', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                minWidth: 140, flex: '1 0 140px', maxWidth: 180,
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#2563EB';
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)';
            }}
        >
            <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: user.color || '#374151', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 18, border: '3px solid #F9FAFB',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                {user.initials || (user.name ? user.name.slice(0, 2).toUpperCase() : '??')}
            </div>
            <div style={{ textAlign: 'center', width: '100%' }}>
                <div style={{
                    fontWeight: 600, color: '#111827', fontSize: 14,
                    marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                    {user.name}
                </div>
                <div style={{
                    fontSize: 11, color: '#6B7280', textTransform: 'uppercase',
                    letterSpacing: 0.5, fontWeight: 500
                }}>
                    {user.role}
                </div>
            </div>
        </button>
    );

    return (
        <div style={{
            minHeight: '100vh', background: '#F3F4F6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{
                maxWidth: 900, width: '100%',
                background: 'white', borderRadius: 24,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                padding: '40px 50px',
                display: 'flex', flexDirection: 'column', gap: 40
            }}>

                {/* HEADER LOGO */}
                <div style={{ textAlign: 'center' }}>
                    {!logoError ? (
                        <img
                            src="/logo.png"
                            alt="LENGLART"
                            style={{ height: 60, width: 'auto', marginBottom: 16 }}
                            onError={() => setLogoError(true)}
                        />
                    ) : (
                        <h1 style={{ fontSize: 36, fontWeight: 900, color: '#111827', marginBottom: 8, letterSpacing: -1 }}>LENGLART</h1>
                    )}
                    <p style={{ color: '#6B7280', fontSize: 15, fontWeight: 500 }}>
                        Choisissez votre profil pour accéder à l'espace de production
                    </p>
                </div>

                {/* SECTIONS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

                    {groups.bureau?.length > 0 && (
                        <section>
                            <SectionHeader icon={Monitor} title="Bureau & Pilotage" bg="#F3F4F6" color="#374151" />
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                {groups.bureau.map(user => <UserCard key={user.id} user={user} />)}
                            </div>
                        </section>
                    )}

                    {groups.atelier?.length > 0 && (
                        <section>
                            <SectionHeader icon={Scissors} title="Atelier & Confection" bg="#EFF6FF" color="#1E40AF" />
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                {groups.atelier.map(user => <UserCard key={user.id} user={user} />)}
                            </div>
                        </section>
                    )}

                    {groups.pose?.length > 0 && (
                        <section>
                            <SectionHeader icon={Truck} title="Équipes de Pose" bg="#ECFDF5" color="#047857" />
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                {groups.pose.map(user => <UserCard key={user.id} user={user} />)}
                            </div>
                        </section>
                    )}

                </div>

                <div style={{ textAlign: 'center', marginTop: 10, color: '#9CA3AF', fontSize: 12 }}>
                    © {new Date().getFullYear()} Lenglart - Version Production 1.0
                </div>
            </div>
        </div>
    );
}