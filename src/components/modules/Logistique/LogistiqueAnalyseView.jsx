import React, { useState, useMemo } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
  ScatterChart, Scatter, Cell, ZAxis,
} from 'recharts';
import { X } from 'lucide-react';

const STATUT_STYLE = {
  'Brouillon':      { bg: '#F3F4F6', color: '#6B7280' },
  'En préparation': { bg: '#FEF3C7', color: '#92400E' },
  'Expédiée':       { bg: '#D1FAE5', color: '#065F46' },
};

function getWeekInfo(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;

  const day = d.getDay() || 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - day + 1);

  const tmp = new Date(d.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  const year = tmp.getFullYear();

  return {
    key: `${year}-W${String(weekNo).padStart(2, '0')}`,
    label: `S${weekNo}`,
    fullLabel: `Semaine ${weekNo} · ${mon.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    shortDate: mon.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
  };
}

// ── Tooltip courbe semaines ────────────────────────────────────────────────────
function WeekTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.fullLabel}</div>
      <div style={{ color: '#6B7280' }}>{d.count} expédition{d.count > 1 ? 's' : ''}</div>
      <div style={{ marginTop: 6, color: '#9CA3AF', fontSize: 11 }}>Clic pour le détail</div>
    </div>
  );
}

// ── Tooltip scatter projets ───────────────────────────────────────────────────
function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const signalColor = d.ratio === null ? '#9CA3AF'
    : d.ratio > 1   ? '#EF4444'
    : d.ratio > 0.5 ? '#F59E0B'
    : '#10B981';
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12, maxWidth: 220 }}>
      <div style={{ fontWeight: 700, color: '#111827', marginBottom: 6 }}>{d.name}</div>
      <div style={{ color: '#6B7280' }}>{d.y} expédition{d.y > 1 ? 's' : ''}</div>
      <div style={{ color: '#6B7280' }}>{d.allocHours > 0 ? `${d.allocHours}h allouées` : 'Budget non renseigné'}</div>
      {d.ratio !== null && (
        <div style={{ marginTop: 4, fontWeight: 700, color: signalColor }}>
          {d.ratio} expéd. / 100h
        </div>
      )}
    </div>
  );
}

// ── Dot personnalisé scatter ──────────────────────────────────────────────────
function ScatterDot(props) {
  const { cx, cy, payload, fill } = props;
  const name = payload.name?.length > 14 ? payload.name.slice(0, 13) + '…' : (payload.name || '');
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill={fill} stroke="white" strokeWidth={2} style={{ cursor: 'default' }} />
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={10} fill="#374151">{name}</text>
    </g>
  );
}

export default function LogistiqueAnalyseView({ shipments, items, projects, onBack, embedded = false }) {
  const [selectedWeek, setSelectedWeek] = useState(null);

  // ── Données par semaine ────────────────────────────────────────────────────
  const weekData = useMemo(() => {
    const map = new Map();
    shipments.forEach(s => {
      const info = getWeekInfo(s.date_expedition);
      if (!info) return;
      if (!map.has(info.key)) map.set(info.key, { ...info, count: 0, shipmentList: [] });
      const w = map.get(info.key);
      w.count += 1;
      w.shipmentList.push(s);
    });
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [shipments]);

  const avgCount = useMemo(() => {
    if (!weekData.length) return 0;
    return Math.round(weekData.reduce((s, w) => s + w.count, 0) / weekData.length * 10) / 10;
  }, [weekData]);

  const selectedWeekData = selectedWeek ? weekData.find(w => w.key === selectedWeek) : null;

  // ── Données scatter par projet ─────────────────────────────────────────────
  const scatterData = useMemo(() => {
    const countByProject = new Map();
    items.filter(i => i.type === 'ouvrage' && i.project_id && i.expedition_id).forEach(i => {
      if (!countByProject.has(i.project_id)) countByProject.set(i.project_id, new Set());
      countByProject.get(i.project_id).add(i.expedition_id);
    });

    return [...countByProject.entries()]
      .map(([projectId, shipmentIds]) => {
        const project = projects.find(p => String(p.id) === String(projectId));
        if (!project) return null;
        const allocHours =
          Number(project.budget?.conf  || 0) +
          Number(project.budget?.prepa || 0) +
          Number(project.budget?.pose  || 0);
        const nbExpeditions = shipmentIds.size;
        const ratio = allocHours > 0
          ? Math.round((nbExpeditions / allocHours) * 10000) / 100
          : null;
        return {
          projectId,
          name: project.name || 'Sans nom',
          x: allocHours,       // heures allouées
          y: nbExpeditions,    // nb expéditions
          allocHours,
          ratio,
        };
      })
      .filter(Boolean);
  }, [items, projects]);

  const handleChartClick = (d) => {
    if (!d?.activePayload?.[0]) return;
    const item = d.activePayload[0].payload;
    setSelectedWeek(prev => prev === item.key ? null : item.key);
  };

  const CARD = { background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20 };

  // ── Panneau latéral ──────────────────────────────────────────────────────────
  const sidePanel = selectedWeekData && (
    <div style={{
      width: 300, flexShrink: 0,
      ...(embedded
        ? { border: '1px solid #E5E7EB', borderRadius: 12, background: 'white', overflow: 'hidden', alignSelf: 'flex-start' }
        : { borderLeft: '1px solid #E5E7EB', background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
      ),
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{selectedWeekData.fullLabel}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
            {selectedWeekData.count} expédition{selectedWeekData.count > 1 ? 's' : ''}
            {selectedWeekData.count > avgCount && (
              <span style={{ marginLeft: 6, fontWeight: 700, color: '#EF4444' }}>
                +{Math.round((selectedWeekData.count - avgCount) * 10) / 10} vs moy.
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setSelectedWeek(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, marginTop: -2 }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ overflowY: 'auto', padding: '12px 20px', maxHeight: embedded ? 400 : undefined, flex: embedded ? undefined : 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
          Expéditions ({selectedWeekData.shipmentList.length})
        </div>
        {selectedWeekData.shipmentList.map(s => {
          const sItems = items.filter(i => i.expedition_id === s.id && i.type === 'ouvrage');
          const projectNames = [...new Set(sItems.map(i => i.project_id))]
            .map(id => projects.find(p => String(p.id) === String(id))?.name)
            .filter(Boolean).join(', ') || null;
          const st = STATUT_STYLE[s.statut] || {};
          return (
            <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', minWidth: 0 }}>{s.label || s.reference}</div>
                <span style={{ background: st.bg, color: st.color, borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{s.statut}</span>
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.reference}</div>
              {projectNames && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{projectNames}</div>}
              {s.destination && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{s.destination}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Sections graphiques ──────────────────────────────────────────────────────
  const sections = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1, minWidth: 0 }}>

      {/* Section 1 : Courbe par semaine */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Rythme d'expédition par semaine</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>
          Cliquez sur un point pour voir le détail de la semaine. Moyenne : <strong>{avgCount}</strong> expédition{avgCount > 1 ? 's' : ''}/semaine.
        </div>
        <div style={CARD}>
          {weekData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Aucune expédition avec date renseignée.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={weekData} margin={{ top: 16, right: 16, bottom: 40, left: 0 }}
                onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} angle={-35} textAnchor="end" interval={0} height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<WeekTooltip />} />
                <ReferenceLine y={avgCount} stroke="#E5E7EB" strokeDasharray="4 4"
                  label={{ value: `Moy. ${avgCount}`, position: 'insideTopRight', fontSize: 10, fill: '#9CA3AF' }}
                />
                <Line
                  type="monotone" dataKey="count" name="Expéditions"
                  stroke="#6366F1" strokeWidth={2.5}
                  activeDot={{
                    r: 8, cursor: 'pointer', fill: '#6366F1', stroke: 'white', strokeWidth: 2,
                    onClick: (_, payload) => setSelectedWeek(prev => prev === payload.payload.key ? null : payload.payload.key),
                  }}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const isSelected = payload.key === selectedWeek;
                    return (
                      <circle key={`dot-${cx}`} cx={cx} cy={cy} r={isSelected ? 7 : 4}
                        fill={isSelected ? '#1E2447' : '#6366F1'}
                        stroke="white" strokeWidth={2}
                      />
                    );
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Section 2 : Scatter par projet */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Expéditions par projet</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>
          Axe horizontal : heures allouées. Axe vertical : nombre d'expéditions. Un projet en haut à gauche génère beaucoup d'expéditions pour peu d'heures allouées — signal d'alerte.
        </div>
        {scatterData.length === 0 ? (
          <div style={{ ...CARD, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Aucune expédition liée à un projet.</div>
        ) : (
          <div style={CARD}>
            <ResponsiveContainer width="100%" height={Math.max(320, scatterData.length * 18)}>
              <ScatterChart margin={{ top: 24, right: 24, bottom: 24, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis type="number" dataKey="x" name="Heures allouées"
                  label={{ value: 'Heures allouées', position: 'insideBottom', offset: -12, fontSize: 11, fill: '#9CA3AF' }}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                />
                <YAxis type="number" dataKey="y" name="Expéditions" allowDecimals={false}
                  label={{ value: 'Expéditions', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#9CA3AF' }}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                />
                <ZAxis range={[80, 80]} />
                <Tooltip content={<ScatterTooltip />} />
                <Scatter data={scatterData} shape={<ScatterDot />}>
                  {scatterData.map(d => {
                    const fill = d.ratio === null ? '#C7D2FE'
                      : d.ratio > 1   ? '#EF4444'
                      : d.ratio > 0.5 ? '#F59E0B'
                      : '#10B981';
                    return <Cell key={d.projectId} fill={fill} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
              {[
                ['#10B981', 'OK',     '≤ 0.5 expéd./100h'],
                ['#F59E0B', 'Modéré', '0.5 – 1 expéd./100h'],
                ['#EF4444', 'Élevé',  '> 1 expéd./100h'],
                ['#C7D2FE', '',       'Budget non renseigné'],
              ].map(([color, level, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6B7280' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  {level && <span style={{ fontWeight: 700, color }}>{level}</span>}
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );

  // ── Mode embarqué (dans LogistiqueScreen) ───────────────────────────────────
  if (embedded) {
    return (
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {sections}
        {sidePanel}
      </div>
    );
  }

  // ── Mode standalone (accès direct) ──────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#F9F7F2', display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
        <div>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontWeight: 600, fontSize: 13, marginBottom: 4, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Retour
          </button>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1F2937', margin: 0, letterSpacing: '-0.5px' }}>Analyse logistique</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: '4px 0 0' }}>{shipments.length} expédition{shipments.length > 1 ? 's' : ''} au total</p>
        </div>
        {sections}
      </div>
      {sidePanel}
    </div>
  );
}
