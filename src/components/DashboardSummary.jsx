import React from 'react';
import { ChevronRight } from 'lucide-react';

// Récap du chiffrage :
//  - toujours visible : le CA total en grand, et à côté les heures (conf, pose, prépa) ;
//  - la flèche déplie EN DESSOUS le détail du prix : CA par produit (avec %), logistique, frais.
// Dépliage animé (hauteur + fondu). L'état ouvert/fermé est mémorisé par poste (best-effort).

const OPEN_KEY = 'chiffrage_recap_open';
const readOpen = () => { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; } };
const writeOpen = (v) => { try { localStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch { /* sans stockage : pas mémorisé */ } };

const FONT = 'Roboto, system-ui, sans-serif';
const LABEL = { fontSize: 14, color: '#787774' };
const BIG = { fontWeight: 400, color: '#111827', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.01em' };

const PRODUCTS = [
    { key: 'caRideaux', label: 'Rideaux' },
    { key: 'caStores', label: 'Stores négoce' },
    { key: 'caStoresBateau', label: 'Stores bateau' },
    { key: 'caCoussins', label: 'Coussins' },
    { key: 'caCacheSommier', label: 'Cache-sommier' },
    { key: 'caPlaid', label: 'Plaids' },
    { key: 'caTenture', label: 'Tenture' },
    { key: 'caMobilier', label: 'Mobilier' },
    { key: 'caDivers', label: 'Divers' },
];

const pct = (part, total) => {
    if (!total || !part) return null;
    const p = (part / total) * 100;
    return p < 1 ? '< 1 %' : `${Math.round(p)} %`;
};

function Hours({ label, value }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={LABEL}>{label}</span>
            <span style={{ ...BIG, fontSize: 30 }}>{Math.round(value || 0)} h</span>
        </div>
    );
}

function Amount({ label, value, share, muted }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, whiteSpace: 'nowrap' }}>
            <span style={LABEL}>{label}</span>
            <span style={{ ...BIG, fontSize: 22, color: muted ? '#9B9A97' : '#111827' }}>
                {value}
                {share && <span style={{ marginLeft: 8, fontSize: 14, color: '#9B9A97', letterSpacing: 0 }}>{share}</span>}
            </span>
        </div>
    );
}

export default React.memo(function DashboardSummary({ recap, nf }) {
    const [open, setOpen] = React.useState(readOpen);
    const toggle = () => setOpen((o) => { writeOpen(!o); return !o; });
    const total = recap.offreTotale || 0;

    const products = PRODUCTS
        .map((p) => ({ label: p.label, value: recap[p.key] || 0 }))
        .filter((i) => i.value > 0)
        .sort((a, b) => b.value - a.value);

    return (
        <div style={{ margin: '8px 0 28px', fontFamily: FONT }}>
            {/* Ligne principale : prix + heures */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap' }}>
                <button
                    onClick={toggle}
                    title={open ? "Masquer le détail du prix" : "Voir le détail du prix"}
                    aria-expanded={open}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 6px 2px 0', borderRadius: 6, fontFamily: FONT }}
                >
                    <ChevronRight size={20} color="#9B9A97" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s ease' }} />
                    <span style={{ ...BIG, fontSize: 40 }}>{nf.format(total)}</span>
                </button>
                <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end' }}>
                    <Hours label="Confection" value={recap.hConf} />
                    <Hours label="Pose" value={recap.hPose} />
                    <Hours label="Prépa" value={recap.hPrepa} />
                </div>
            </div>

            {/* Détail du prix, déplié sous le prix (hauteur + fondu animés) */}
            <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .25s ease' }}>
                <div style={{ overflow: 'hidden', minHeight: 0 }}>
                    <div
                        aria-hidden={!open}
                        style={{
                            display: 'flex', flexWrap: 'wrap', gap: '16px 36px', padding: '18px 0 2px 28px',
                            opacity: open ? 1 : 0, transform: open ? 'translateY(0)' : 'translateY(-4px)',
                            transition: 'opacity .22s ease, transform .22s ease',
                        }}
                    >
                        {products.map((p) => (
                            <Amount key={p.label} label={p.label} value={nf.format(p.value)} share={pct(p.value, total)} />
                        ))}
                        <div style={{ width: 1, alignSelf: 'stretch', background: '#EDEDEB' }} />
                        <Amount label="Logistique" value={nf.format(recap.depTotal || 0)} share={pct(recap.depTotal, total)} />
                        <Amount label="Frais" value={nf.format(recap.extrasTotal || 0)} muted />
                    </div>
                </div>
            </div>
        </div>
    );
});
