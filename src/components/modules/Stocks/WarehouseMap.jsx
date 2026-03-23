import React from 'react';
import { Map, Wrench } from 'lucide-react';

export default function WarehouseMap() {
    return (
        <div style={{
            background: '#0B1220',
            borderRadius: 16,
            padding: '60px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 320,
            textAlign: 'center',
            border: '1px solid #1E293B',
        }}>
            <div style={{
                width: 64, height: 64,
                borderRadius: 16,
                background: '#1E293B',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
            }}>
                <Map size={28} color="#3B82F6" />
            </div>

            <div style={{ fontSize: 20, fontWeight: 800, color: '#E2E8F0', marginBottom: 8 }}>
                Plan de l'entrepôt
            </div>

            <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#1E293B', borderRadius: 20,
                padding: '4px 14px', marginBottom: 16,
            }}>
                <Wrench size={12} color="#F59E0B" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>En cours de conception</span>
            </div>

            <div style={{ fontSize: 14, color: '#475569', maxWidth: 380, lineHeight: 1.7 }}>
                La vue interactive de l'entrepôt sera disponible prochainement.
                Un plan 2D personnalisé est en préparation.
            </div>
        </div>
    );
}
