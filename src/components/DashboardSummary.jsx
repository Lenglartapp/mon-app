import React from 'react';
import { ChevronRight } from 'lucide-react';

// Récap du chiffrage : le CA total en grand et, sur la même rangée à droite, le détail
// de sa composition (CA par famille de produits, logistique, frais, heures).
// La flèche masque / affiche le détail ; l'état est mémorisé par poste (confort, best-effort).

const OPEN_KEY = 'chiffrage_recap_open';
const readOpen = () => { try { return localStorage.getItem(OPEN_KEY) !== '0'; } catch { return true; } };
const writeOpen = (v) => { try { localStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch { /* sans stockage : pas mémorisé */ } };

const FONT = 'Roboto, system-ui, sans-serif';

function Item({ label, value, muted }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 13, color: '#9B9A97' }}>{label}</span>
            <span style={{ fontSize: 18, fontWeight: 400, color: muted ? '#A8A7A3' : '#37352F', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        </div>
    );
}

const Sep = () => <div style={{ width: 1, alignSelf: 'stretch', background: '#EDEDEB' }} />;

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
        { label: "H. prépa", value: recap.hPrepa },
        { label: "H. pose", value: recap.hPose },
        { label: "H. conf", value: recap.hConf },
    ];

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, margin: '4px 0 24px', fontFamily: FONT, flexWrap: 'wrap' }}>
            <button
                onClick={toggle}
                title={open ? "Masquer le détail" : "Voir le détail du prix"}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 4px 2px 0', borderRadius: 6, fontFamily: FONT, flexShrink: 0 }}
            >
                <ChevronRight size={20} color="#9B9A97" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                <span style={{ fontSize: 40, fontWeight: 400, color: '#111827', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                    {nf.format(recap.offreTotale)}
                </span>
            </button>

            {open && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 22px', alignItems: 'stretch' }}>
                    {products.map((i) => <Item key={i.label} label={i.label} value={nf.format(i.value)} />)}
                    <Sep />
                    {extras.map((i) => <Item key={i.label} label={i.label} value={nf.format(i.value || 0)} muted={i.muted} />)}
                    <Sep />
                    {hours.map((i) => <Item key={i.label} label={i.label} value={`${Math.round(i.value || 0)} h`} />)}
                </div>
            )}
        </div>
    );
});
