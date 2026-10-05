import React from 'react';
import { ChevronRight } from 'lucide-react';

// Récap du chiffrage : le CA total en grand, et un dépliant qui détaille sa composition
// (CA par famille de produits, logistique, frais, heures). L'état ouvert/fermé est
// mémorisé par poste (confort, best-effort).

const OPEN_KEY = 'chiffrage_recap_open';
const readOpen = () => { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; } };
const writeOpen = (v) => { try { localStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch { /* sans stockage : pas mémorisé */ } };

function Item({ label, value, muted }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, color: '#9B9A97' }}>{label}</span>
            <span style={{ fontSize: 16, fontWeight: 400, color: muted ? '#A8A7A3' : '#37352F', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        </div>
    );
}

export default React.memo(function DashboardSummary({ recap, nf }) {
    const [open, setOpen] = React.useState(readOpen);
    const toggle = () => setOpen((o) => { writeOpen(!o); return !o; });

    const products = [
        { label: "Rideaux", value: recap.caRideaux },
        { label: "Stores négoce", value: recap.caStores },
        { label: "Stores bateau", value: recap.caStoresBateau },
        { label: "Coussins", value: recap.caCoussins },
        { label: "Cache-sommier", value: recap.caCacheSommier },
        { label: "Plaids", value: recap.caPlaid },
        { label: "Tenture", value: recap.caTenture },
        { label: "Mobilier", value: recap.caMobilier },
        { label: "Divers", value: recap.caDivers },
    ].filter((i) => i.value && i.value > 0);

    const extras = [
        { label: "Logistique", value: recap.depTotal },
        { label: "Frais", value: recap.extrasTotal, muted: true },
    ];
    const hours = [
        { label: "Heures prépa", value: recap.hPrepa },
        { label: "Heures pose", value: recap.hPose },
        { label: "Heures conf", value: recap.hConf },
    ];

    return (
        <div style={{ margin: '4px 0 20px' }}>
            <button
                onClick={toggle}
                title={open ? "Masquer le détail" : "Voir le détail du prix"}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 6px 2px 0', borderRadius: 6, fontFamily: 'Roboto, system-ui, sans-serif' }}
            >
                <ChevronRight size={18} color="#9B9A97" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                <span style={{ fontSize: 34, fontWeight: 400, color: '#111827', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
                    {nf.format(recap.offreTotale)}
                </span>
                <span style={{ fontSize: 13, color: '#9B9A97', alignSelf: 'flex-end', marginBottom: 7 }}>CA total</span>
            </button>

            {open && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 24px', alignItems: 'flex-start', padding: '12px 0 4px 28px', fontFamily: 'Roboto, system-ui, sans-serif' }}>
                    {products.map((i) => <Item key={i.label} label={i.label} value={nf.format(i.value)} />)}
                    <div style={{ width: 1, alignSelf: 'stretch', background: '#EDEDEB' }} />
                    {extras.map((i) => <Item key={i.label} label={i.label} value={nf.format(i.value || 0)} muted={i.muted} />)}
                    <div style={{ width: 1, alignSelf: 'stretch', background: '#EDEDEB' }} />
                    {hours.map((i) => <Item key={i.label} label={i.label} value={`${Math.round(i.value || 0)} h`} />)}
                </div>
            )}
        </div>
    );
});
