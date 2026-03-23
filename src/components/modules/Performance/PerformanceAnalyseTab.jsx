import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, Cell,
} from 'recharts';
import { differenceInMinutes, format, startOfMonth, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const SERVICE_LABELS = {
  conf: 'Confection',
  prepa: 'Préparation',
  pose: 'Pose',
};

const SERVICE_COLORS = {
  conf: '#6366F1',
  prepa: '#10B981',
  pose: '#F59E0B',
};

function computeRealized(events, projectId) {
  const counts = { prepa: 0, conf: 0, pose: 0 };
  if (!events || !projectId) return counts;
  events
    .filter(e => e.meta?.projectId === projectId && e.meta?.status === 'validated')
    .forEach(evt => {
      const start = new Date(evt.meta?.start);
      const end = new Date(evt.meta?.end);
      const raw = differenceInMinutes(end, start);
      const net = raw > 300 ? raw - 60 : raw;
      const hours = Math.max(0, net / 60);
      const type = (evt.type || '').toLowerCase();
      if (type === 'rdv' || type === 'prepa' || type === 'metrage') counts.prepa += hours;
      else if (type === 'atelier' || type === 'conf' || type === 'confection') counts.conf += hours;
      else if (type === 'chantier' || type === 'pose' || type === 'installation') counts.pose += hours;
    });
  return counts;
}

// Calcule le % d'écart : (consommé - alloué) / alloué * 100
function ecartPct(alloc, real) {
  if (!alloc || alloc === 0) return null;
  return Math.round(((real - alloc) / alloc) * 100);
}

const CHART_STYLE = {
  background: 'white',
  borderRadius: 12,
  border: '1px solid #E5E7EB',
  padding: 20,
};

const SECTION_TITLE = { fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 };

function FilterBar({ value, onChange }) {
  const tabs = [
    { key: 'all', label: 'Tous les services' },
    { key: 'conf', label: 'Confection' },
    { key: 'prepa', label: 'Préparation' },
    { key: 'pose', label: 'Pose' },
  ];
  return (
    <div style={{ display: 'flex', background: 'white', borderRadius: 9999, padding: 3, gap: 3, border: '1px solid #E5E7EB', width: 'fit-content' }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          padding: '7px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 500,
          border: 'none', cursor: 'pointer',
          background: value === t.key ? '#1E2447' : 'transparent',
          color: value === t.key ? 'white' : '#4B5563',
          transition: 'all 0.15s',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// Tooltip custom simple
function CustomTooltip({ active, payload, label, suffix = '%' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: '#111827' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.fill || p.stroke || '#374151' }}>
          {p.name} : {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}{suffix}
        </div>
      ))}
    </div>
  );
}

export default function PerformanceAnalyseTab({ projects, events, entries }) {
  const [serviceFilter, setServiceFilter] = useState('all');

  const services = serviceFilter === 'all' ? ['conf', 'prepa', 'pose'] : [serviceFilter];

  // ── Données calculées ────────────────────────────────────────────────────────
  const projectData = useMemo(() => {
    return projects
      .filter(p => p.budget && Object.values(p.budget).some(v => Number(v) > 0))
      .map(p => {
        const realized = computeRealized(events, p.id);
        return { project: p, realized };
      });
  }, [projects, events]);

  // ── Graphe 1 : Taux de tenue par chef de projet ──────────────────────────────
  const dataByManager = useMemo(() => {
    const map = {};
    projectData.forEach(({ project, realized }) => {
      const mgr = project.manager || 'Non assigné';
      if (!map[mgr]) map[mgr] = { pctSum: 0, count: 0, sav: 0 };
      services.forEach(svc => {
        const alloc = Number(project.budget?.[svc] || 0);
        const real = realized[svc] || 0;
        const pct = ecartPct(alloc, real);
        if (pct !== null) {
          map[mgr].pctSum += pct;
          map[mgr].count += 1;
        }
        const entry = entries.find(e => e.project_id === project.id && e.service === svc);
        if (entry?.has_sav) map[mgr].sav += 1;
      });
    });
    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        ecartMoyen: d.count > 0 ? Math.round(d.pctSum / d.count) : 0,
        sav: d.sav,
        nbProjets: d.count,
      }))
      .sort((a, b) => b.ecartMoyen - a.ecartMoyen);
  }, [projectData, services, entries]);

  // ── Graphe 2 : Top raisons ───────────────────────────────────────────────────
  const dataRaisons = useMemo(() => {
    const map = {};
    entries
      .filter(e => serviceFilter === 'all' || e.service === serviceFilter)
      .forEach(e => {
        (e.raisons || []).forEach(r => { map[r] = (map[r] || 0) + 1; });
      });
    return Object.entries(map)
      .map(([raison, count]) => ({ raison: raison.length > 30 ? raison.slice(0, 28) + '…' : raison, raisonFull: raison, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [entries, serviceFilter]);

  // ── Graphe 3 : Évolution mensuelle de l'écart moyen ─────────────────────────
  const dataEvolution = useMemo(() => {
    // On se base sur la date updated_at des entries (quand le bilan a été saisi)
    // ou created_at des projets
    const monthMap = {};
    projectData.forEach(({ project, realized }) => {
      const dateRef = project.created_at || project.createdAt;
      if (!dateRef) return;
      let monthKey;
      try { monthKey = format(new Date(dateRef), 'yyyy-MM'); } catch { return; }

      if (!monthMap[monthKey]) monthMap[monthKey] = { pctSum: 0, count: 0 };
      services.forEach(svc => {
        const alloc = Number(project.budget?.[svc] || 0);
        const real = realized[svc] || 0;
        const pct = ecartPct(alloc, real);
        if (pct !== null) {
          monthMap[monthKey].pctSum += pct;
          monthMap[monthKey].count += 1;
        }
      });
    });

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        mois: format(parseISO(`${month}-01`), 'MMM yy', { locale: fr }),
        ecartMoyen: d.count > 0 ? Math.round(d.pctSum / d.count) : 0,
      }))
      .slice(-12); // 12 derniers mois
  }, [projectData, services]);

  // ── Graphe 4 : Distribution des écarts ──────────────────────────────────────
  const dataDistribution = useMemo(() => {
    const buckets = { '< −10%': 0, '−10% à 0%': 0, '0% à +10%': 0, '+10% à +20%': 0, '> +20%': 0 };
    projectData.forEach(({ project, realized }) => {
      services.forEach(svc => {
        const alloc = Number(project.budget?.[svc] || 0);
        const real = realized[svc] || 0;
        const pct = ecartPct(alloc, real);
        if (pct === null) return;
        if (pct < -10) buckets['< −10%']++;
        else if (pct < 0) buckets['−10% à 0%']++;
        else if (pct <= 10) buckets['0% à +10%']++;
        else if (pct <= 20) buckets['+10% à +20%']++;
        else buckets['> +20%']++;
      });
    });
    return Object.entries(buckets).map(([tranche, count]) => ({ tranche, count }));
  }, [projectData, services]);

  const bucketColors = ['#10B981', '#34D399', '#FCD34D', '#FB923C', '#EF4444'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filtre global */}
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <FilterBar value={serviceFilter} onChange={setServiceFilter} />
      </div>

      {/* Ligne 1 : Graphes 1 + 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Graphe 1 : Écart moyen par chef de projet */}
        <div style={CHART_STYLE}>
          <div style={SECTION_TITLE}>Écart moyen par chef de projet (%)</div>
          {dataByManager.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dataByManager} layout="vertical" margin={{ left: 0, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" unit="%" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip suffix="%" />} />
                <ReferenceLine x={0} stroke="#E5E7EB" />
                <Bar dataKey="ecartMoyen" name="Écart moyen" radius={[0, 4, 4, 0]}
                  fill="#6366F1"
                  label={{ position: 'right', fontSize: 11, formatter: v => `${v > 0 ? '+' : ''}${v}%` }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Graphe 2 : Top raisons */}
        <div style={CHART_STYLE}>
          <div style={SECTION_TITLE}>Raisons de dépassement les plus fréquentes</div>
          {dataRaisons.length === 0 ? (
            <Empty message="Aucune raison saisie pour l'instant" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dataRaisons} layout="vertical" margin={{ left: 0, right: 32 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="raison" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n, p) => [v, p.payload.raisonFull]} />
                <Bar dataKey="count" name="Occurrences" fill="#F59E0B" radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fontSize: 12 }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Ligne 2 : Graphes 3 + 4 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>

        {/* Graphe 3 : Évolution mensuelle */}
        <div style={CHART_STYLE}>
          <div style={SECTION_TITLE}>Évolution de l'écart moyen sur 12 mois</div>
          {dataEvolution.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dataEvolution} margin={{ right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis unit="%" tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip suffix="%" />} />
                <ReferenceLine y={0} stroke="#E5E7EB" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="ecartMoyen"
                  name="Écart moyen"
                  stroke="#6366F1"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#6366F1' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Graphe 4 : Distribution */}
        <div style={CHART_STYLE}>
          <div style={SECTION_TITLE}>Distribution des écarts</div>
          {dataDistribution.every(d => d.count === 0) ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dataDistribution} margin={{ bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="tranche" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, 'Projets']} />
                <Bar dataKey="count" name="Projets" radius={[4, 4, 0, 0]}>
                  {dataDistribution.map((entry, index) => (
                    <Cell key={index} fill={bucketColors[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Légende manuelle colorée */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {dataDistribution.map((d, i) => (
              <span key={d.tranche} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#374151' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: bucketColors[i], display: 'inline-block' }} />
                {d.tranche}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Empty({ message = 'Pas encore de données' }) {
  return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>
      {message}
    </div>
  );
}
