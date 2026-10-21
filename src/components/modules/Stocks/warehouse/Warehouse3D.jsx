// Vue 3D de l'entrepôt (Three.js / react-three-fiber), chargée à la demande.
// Rayonnages et niveaux d'après lib/warehouse/layout ; remplissage = occupation en rouleaux.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Edges } from '@react-three/drei';
import { BUILDING, RACKS, FLOOR_ZONES, DECOR, DOORS } from '../../../../lib/warehouse/layout';
import { occupancyColor } from '../../../../lib/warehouse/occupancy';
import { useThemeMode } from '../../../../theme/themeContext';

// Couleurs de la scène (Three.js ne lit pas les variables CSS : deux jeux explicites).
const LIGHT = {
    posts: '#1E2447', hit: '#1E2447', door: '#1E2447', floor: '#FBFCFE', wall: '#FFFFFF',
    shelf: '#EDF0F6', shelfSel: '#C7D7F2', zone: '#DCE6F7', rails: '#EEF0F4', railBar: '#B9BFCC',
    room: '#F4F6FA', roomTop: '#DDE2EC', aisle: '#E3EBF8',
    bg: 'linear-gradient(180deg, #F7F9FD 0%, #EEF2F9 100%)', hemi: ['#FFFFFF', '#DCE3F0', 1.6],
    labelBg: 'rgba(255,255,255,0.92)', labelBorder: '#E0DED9', labelText: '#1E2447', aisleBg: '#1E2447',
    muted: '#6B7280', muted2: '#4B5563',
};
const DARK = {
    posts: '#7D8BB5', hit: '#9AAEE8', door: '#5A78D8', floor: '#2A2C31', wall: '#3B3E46',
    shelf: '#454952', shelfSel: '#4F6CA8', zone: '#2F3A52', rails: '#2E3137', railBar: '#5E6470',
    room: '#353840', roomTop: '#43474F', aisle: '#323A4C',
    bg: 'linear-gradient(180deg, #1D1E22 0%, #17181B 100%)', hemi: ['#FFFFFF', '#5A606C', 1.35],
    labelBg: 'rgba(31,31,31,0.92)', labelBorder: '#3A3A3A', labelText: '#E3E6EE', aisleBg: '#2F3F73',
    muted: '#A0A09C', muted2: '#B8B8B4',
};
let C = LIGHT; // fixé à chaque rendu de Warehouse3D, comme labelStyle
const CX = BUILDING.width / 2;
const CZ = BUILDING.depth / 2;
// Coordonnées du plan → scène centrée
const sx = (x) => x - CX;
const sz = (z) => z - CZ;

const makeLabel = (c) => ({
    fontFamily: 'Roboto, system-ui, sans-serif', fontSize: 12, fontWeight: 600, color: c.labelText, background: c.labelBg,
    border: `1px solid ${c.labelBorder}`, borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 2px 6px rgba(17,24,39,0.08)',
});
const LABELS = {
    light: { base: makeLabel(LIGHT), compact: { ...makeLabel(LIGHT), fontSize: 10, padding: '1px 6px' } },
    dark: { base: makeLabel(DARK), compact: { ...makeLabel(DARK), fontSize: 10, padding: '1px 6px' } },
};
let labelStyle = LABELS.light.base;
let isCompactLabel = false;

function Box({ position, size, color, opacity = 1, ...rest }) {
    return (
        <mesh position={position} {...rest}>
            <boxGeometry args={size} />
            <meshLambertMaterial color={color} transparent={opacity < 1} opacity={opacity} />
        </mesh>
    );
}

// Surbrillance « recherche » : boîte bleue qui pulse
function Pulse({ position, size }) {
    const ref = useRef();
    useFrame(({ clock }) => {
        if (ref.current) ref.current.material.opacity = 0.18 + 0.17 * (1 + Math.sin(clock.elapsedTime * 4)) / 2;
    });
    return (
        <mesh ref={ref} position={position}>
            <boxGeometry args={size} />
            <meshBasicMaterial color="#3B82F6" transparent opacity={0.25} depthWrite={false} />
        </mesh>
    );
}

/** Un niveau de rayonnage : tablette + blocs de remplissage + zone cliquable. */
function Level({ code, base, height, rect, along, occ, selected, highlighted, hovered, onHover, onSelect }) {
    const o = occ.get(code);
    const pct = o?.pct || 0;
    const slots = along > 3 ? 10 : along > 1.4 ? 6 : 5;
    const filled = o?.rolls > 0 ? Math.max(1, Math.round(pct * slots)) : 0;
    const color = occupancyColor(Math.max(pct, filled ? 0.3 : 0));
    const { cx, cz, w, d, alongX } = rect;
    const slotLen = along / slots;
    const blocks = [];
    for (let i = 0; i < filled; i++) {
        const offset = -along / 2 + slotLen * (i + 0.5);
        const pos = alongX ? [cx + offset, base + 0.06 + height * 0.36, cz] : [cx, base + 0.06 + height * 0.36, cz + offset];
        const size = alongX ? [slotLen * 0.86, height * 0.7, d * 0.78] : [w * 0.78, height * 0.7, slotLen * 0.86];
        blocks.push(<Box key={i} position={pos} size={size} color={color} />);
    }
    const hitSize = [w * 1.02, height, d * 1.02];
    const hitPos = [cx, base + height / 2, cz];
    return (
        <group>
            {/* tablette */}
            <Box position={[cx, base + 0.015, cz]} size={[w, 0.03, d]} color={selected ? C.shelfSel : C.shelf} />
            {blocks}
            {highlighted && <Pulse position={hitPos} size={hitSize} />}
            <mesh
                position={hitPos}
                onPointerOver={(e) => { e.stopPropagation(); onHover(code, [cx, base + height + 0.05, cz]); }}
                onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
                onClick={(e) => { e.stopPropagation(); onSelect(code, [cx, base + height + 0.05, cz]); }}
            >
                <boxGeometry args={hitSize} />
                <meshBasicMaterial transparent opacity={selected ? 0.12 : hovered ? 0.08 : 0} color={C.hit} depthWrite={false} />
                {(selected || hovered) && <Edges color={C.hit} threshold={15} />}
            </mesh>
        </group>
    );
}

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

function Rack({ rack, ...p }) {
    const alongX = rack.face !== 'west';
    const w = alongX ? rack.width : rack.depth;
    const d = alongX ? rack.depth : rack.width;
    const cx = sx(rack.x + w / 2);
    const cz = sz(rack.z + d / 2);
    const along = rack.width;
    const total = rack.levels.reduce((s, l) => s + l.height, 0);
    const posts = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]];
    let base = 0;
    return (
        <group>
            {posts.map(([px, pz], i) => (
                <Box key={i} position={[cx + px * 0.98, total / 2, cz + pz * 0.98]} size={[0.035, total, 0.035]} color={C.posts} />
            ))}
            {rack.levels.map(l => {
                const el = (
                    <Level key={l.code} code={l.code} base={base} height={l.height} along={along}
                        rect={{ cx, cz, w, d, alongX }}
                        selected={p.selected === l.code} highlighted={p.highlight.has(l.code)} hovered={p.hovered === l.code}
                        occ={p.occ} onHover={p.onHover} onSelect={p.onSelect} />
                );
                base += l.height;
                return el;
            })}
            {/* dernière traverse (rayonnage ouvert : le niveau du haut reste visible) */}
            <Box position={[cx, total, cz]} size={[w, 0.02, d]} color={C.shelf} />
            <Html position={[cx, total + 0.35, cz]} center zIndexRange={[10, 0]}>
                <div style={{ ...labelStyle, background: C.aisleBg, color: 'white', border: 'none' }}>{rack.aisle}</div>
            </Html>
        </group>
    );
}

function FloorZone({ zone, occ, selected, highlighted, hovered, onHover, onSelect }) {
    const o = occ.get(zone.code);
    const cx = sx(zone.x + zone.width / 2), cz = sz(zone.z + zone.depth / 2);
    const n = o?.rolls > 0 ? Math.max(1, Math.round((o.pct || 0) * 6)) : 0;
    const color = occupancyColor(Math.max(o?.pct || 0, n ? 0.3 : 0));
    const cells = [];
    for (let i = 0; i < n; i++) {
        const col = i % 3, row = Math.floor(i / 3);
        cells.push(<Box key={i} position={[cx - zone.width / 3 + col * zone.width / 3, 0.18, cz - zone.depth / 4 + row * zone.depth / 2]} size={[zone.width / 3.4, 0.32, zone.depth / 2.4]} color={color} />);
    }
    return (
        <group>
            <Box position={[cx, 0.01, cz]} size={[zone.width, 0.02, zone.depth]} color={selected ? C.shelfSel : C.zone} />
            {cells}
            {highlighted && <Pulse position={[cx, 0.25, cz]} size={[zone.width, 0.5, zone.depth]} />}
            <mesh position={[cx, 0.25, cz]}
                onPointerOver={(e) => { e.stopPropagation(); onHover(zone.code, [cx, 0.55, cz]); }}
                onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
                onClick={(e) => { e.stopPropagation(); onSelect(zone.code, [cx, 0.55, cz]); }}>
                <boxGeometry args={[zone.width, 0.5, zone.depth]} />
                <meshBasicMaterial transparent opacity={selected ? 0.12 : hovered ? 0.08 : 0} color={C.hit} depthWrite={false} />
                {(selected || hovered) && <Edges color={C.hit} threshold={15} />}
            </mesh>
            <Html position={[cx, 0.75, cz]} center zIndexRange={[10, 0]}>
                <div style={labelStyle}>{zone.code} · {zone.label}{o ? ` · ${fmt(o.rolls)}${o.capacity ? `/${o.capacity}` : ''}` : ''}</div>
            </Html>
        </group>
    );
}

function Decor() {
    return (
        <group>
            {DECOR.map(d => {
                const cx = sx(d.x + d.width / 2), cz = sz(d.z + d.depth / 2);
                if (d.kind === 'rails') {
                    return (
                        <group key={d.key}>
                            <Box position={[cx, 0.01, cz]} size={[d.width, 0.02, d.depth]} color={C.rails} />
                            {[0, 1, 2, 3, 4, 5].map(i => (
                                <Box key={i} position={[cx, 0.06 + (i % 2) * 0.05, cz - d.depth / 2 + 0.35 + i * 0.4]} size={[d.width * 0.86, 0.04, 0.06]} color={C.railBar} />
                            ))}
                            <Html position={[cx, 0.45, cz]} center zIndexRange={[10, 0]}><div style={{ ...labelStyle, color: C.muted }}>{d.label}{isCompactLabel ? '' : ' · non inventorié'}</div></Html>
                        </group>
                    );
                }
                return (
                    <group key={d.key}>
                        <Box position={[cx, d.height / 2, cz]} size={[d.width, d.height, d.depth]} color={C.room} />
                        <Box position={[cx, d.height + 0.02, cz]} size={[d.width, 0.04, d.depth]} color={C.roomTop} />
                        <Html position={[cx, d.height + 0.3, cz]} center zIndexRange={[10, 0]}><div style={{ ...labelStyle, color: C.muted }}>{d.label}</div></Html>
                    </group>
                );
            })}
        </group>
    );
}

/** Murs avec ouvertures de portes. Murs du fond (nord, ouest) plus hauts pour cadrer la vue. */
function Walls({ compact }) {
    const W = BUILDING.width, D = BUILDING.depth, t = 0.12;
    const back = 1.0, front = BUILDING.wallHeight;
    const segments = (wall, length) => {
        const doors = DOORS.filter(d => d.wall === wall).sort((a, b) => a.from - b.from);
        const out = [];
        let pos = 0;
        doors.forEach(d => { if (d.from > pos) out.push([pos, d.from]); pos = d.to; });
        if (pos < length) out.push([pos, length]);
        return out;
    };
    return (
        <group>
            {segments('north', W).map(([a, b], i) => <Box key={`n${i}`} position={[sx((a + b) / 2), back / 2, sz(-t / 2)]} size={[b - a, back, t]} color={C.wall} />)}
            {segments('south', W).map(([a, b], i) => <Box key={`s${i}`} position={[sx((a + b) / 2), front / 2, sz(D + t / 2)]} size={[b - a, front, t]} color={C.wall} />)}
            <Box position={[sx(-t / 2), back / 2, 0]} size={[t, back, D + 2 * t]} color={C.wall} />
            <Box position={[sx(W + t / 2), front / 2, 0]} size={[t, front, D + 2 * t]} color={C.wall} />
            {DOORS.map(d => {
                const z = d.wall === 'north' ? sz(0.18) : sz(D - 0.18);
                return (
                    <group key={d.key}>
                        <Box position={[sx((d.from + d.to) / 2), 0.012, z]} size={[d.to - d.from, 0.024, 0.36]} color={C.door} />
                        {!compact && (
                            <Html position={[sx((d.from + d.to) / 2), 0.25, d.wall === 'north' ? sz(-0.5) : sz(D + 0.55)]} center zIndexRange={[10, 0]}>
                                <div style={{ ...labelStyle, fontWeight: 500, fontSize: 11, color: C.muted2 }}>{d.label}</div>
                            </Html>
                        )}
                    </group>
                );
            })}
        </group>
    );
}

/** Zoom de départ ajusté à la taille du cadre (l'entrepôt remplit la vue, téléphone compris). */
function FitZoom({ resetKey, controls }) {
    const { size, camera } = useThree();
    const saved = useRef(false);
    useEffect(() => {
        // Au premier affichage, on mémorise le cadrage voulu (cible comprise) ; « Recentrer »
        // y revient ensuite (sinon reset() ramènerait au cadrage d'origine de la bibliothèque).
        const c = controls.current;
        if (c && !saved.current) { c.update(); c.saveState(); saved.current = true; }
        else if (c) c.reset();
        const z = Math.min(size.width / 20, size.height / 10.6);
        camera.zoom = Math.max(12, Math.min(120, z));
        camera.updateProjectionMatrix();
    }, [size.width, size.height, camera, resetKey, controls]);
    return null;
}

/**
 * @param {Map} occ            occupation par code (lib/warehouse/occupancy)
 * @param {string|null} selected
 * @param {Set<string>} highlight  emplacements à faire clignoter (recherche, carte)
 */
export default function Warehouse3D({ occ, selected, onSelect, highlight = new Set(), height = 520, compact = false, resetKey = 0 }) {
    const { resolved } = useThemeMode();
    C = resolved === 'dark' ? DARK : LIGHT;
    labelStyle = LABELS[resolved === 'dark' ? 'dark' : 'light'][compact ? 'compact' : 'base'];
    isCompactLabel = compact;
    const [hover, setHover] = useState(null); // { code, pos }
    const [selPos, setSelPos] = useState(null);
    const controls = useRef();
    const hovered = hover?.code || null;
    const onHover = (code, pos) => setHover(code ? { code, pos } : null);
    const select = (code, pos) => { setSelPos(pos || null); onSelect(code); };
    const common = { occ, selected, highlight, hovered, onHover, onSelect: select };
    // Une seule étiquette d'information (survol, sinon sélection) : elle change de contenu
    // au lieu d'apparaître / disparaître à chaque niveau.
    const tipCode = hovered || selected;
    const tipPos = hover?.pos || (selected ? selPos : null);
    const tipOcc = tipCode ? occ.get(tipCode) : null;
    const camera = useMemo(() => ({ position: [9, 13, 15], zoom: 46, near: -100, far: 200 }), []);
    return (
        <div style={{ height, borderRadius: 12, overflow: 'hidden', background: C.bg, cursor: hovered ? 'pointer' : 'grab', touchAction: 'none' }}>
            {/* flat : sans traitement tonal, les couleurs restent celles de la DA (blancs francs) */}
            <Canvas flat orthographic camera={camera} dpr={[1, 2]} onPointerMissed={() => select(null)}>
                <FitZoom resetKey={resetKey} controls={controls} />
                <hemisphereLight args={C.hemi} />
                <directionalLight position={[8, 14, 6]} intensity={1.2} />
                <directionalLight position={[-10, 6, -8]} intensity={0.3} />
                {/* sol */}
                <Box position={[0, -0.03, 0]} size={[BUILDING.width + 0.24, 0.06, BUILDING.depth + 0.24]} color={C.floor} />
                {/* allée centrale (repère au sol) */}
                <Box position={[sx(7.2), 0.002, sz(3.4)]} size={[13.5, 0.004, 1.1]} color={C.aisle} />
                <Walls compact={compact} />
                <Decor />
                {RACKS.map(r => <Rack key={r.aisle} rack={r} {...common} />)}
                {FLOOR_ZONES.map(z => (
                    <FloorZone key={z.code} zone={z} occ={occ} selected={selected === z.code} highlighted={highlight.has(z.code)} hovered={hovered === z.code} onHover={onHover} onSelect={select} />
                ))}
                <Html position={tipPos || [0, -50, 0]} center zIndexRange={[20, 0]}>
                    <div style={{ ...labelStyle, visibility: tipCode && tipPos ? 'visible' : 'hidden' }}>
                        {tipCode} · {tipOcc ? `${fmt(tipOcc.rolls)}${tipOcc.capacity ? ` / ${tipOcc.capacity}` : ''} rouleau${tipOcc.rolls > 1 ? 'x' : ''}` : 'vide'}
                    </div>
                </Html>
                <OrbitControls
                    ref={controls}
                    makeDefault
                    enableDamping
                    minZoom={22}
                    maxZoom={150}
                    minPolarAngle={0.35}
                    maxPolarAngle={1.2}
                    minAzimuthAngle={-0.9}
                    maxAzimuthAngle={1.2}
                    target={[0, 1.1, -0.4]}
                />
            </Canvas>
        </div>
    );
}
