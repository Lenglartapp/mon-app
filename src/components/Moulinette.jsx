// src/components/Moulinette.jsx
import React from "react";
import { COLORS, S } from "../lib/constants/ui";

const nfEur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const nf0    = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export default function Moulinette({ rows = [], extraRows = [], depRows = [] }) {
  // ——— utils ———
  const toNum = React.useCallback((v) => {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }, []);
  const qty = (r) => Math.max(1, toNum(r?.quantite));

  // ——— 1) Agrégations “Achats fixes” ———
  const aggr = React.useMemo(() => {
    const mapTissus = new Map();   // key -> { label, total_ml, total_pa }
    const mapRails  = new Map();   // key -> { label, total_ml, total_pa }

    const push = (m, key, label) => {
      if (!m.has(key)) m.set(key, { label, total_ml: 0, total_pa: 0 });
      return m.get(key);
    };

    for (const r of rows) {
      const q = qty(r);

      // ---- TISSUS (les PA sont déjà des totaux ligne → on les somme tels quels) ----
      // Déco 1
      if (r.tissu_deco1) {
        const ml = toNum(r.ml_tissu_deco1) * q;     // juste informatif
        const pa = toNum(r.pa_tissu_deco1);         // déjà un TOTAL ligne
        if (ml > 0 || pa > 0) {
          const label = r.motif_deco1 ? `${r.tissu_deco1} — ${r.motif_deco1}` : String(r.tissu_deco1);
          const g = push(mapTissus, `T1|${label}`, label);
          g.total_ml += ml;
          g.total_pa += pa;                          // ✅ somme directe
        }
      }

      // Déco 2
      if (r.tissu_deco2) {
        const ml = toNum(r.ml_tissu_deco2) * q;
        const pa = toNum(r.pa_tissu_deco2);
        if (ml > 0 || pa > 0) {
          const label = r.motif_deco2 ? `${r.tissu_deco2} — ${r.motif_deco2}` : String(r.tissu_deco2);
          const g = push(mapTissus, `T2|${label}`, label);
          g.total_ml += ml;
          g.total_pa += pa;                          // ✅ somme directe
        }
      }

      // Doublure
      if (r.doublure) {
        const ml = toNum(r.ml_doublure) * q;
        const pa = toNum(r.pa_doublure);
        if (ml > 0 || pa > 0) {
          const label = `Doublure — ${String(r.doublure)}`;
          const g = push(mapTissus, `D|${label}`, label);
          g.total_ml += ml;
          g.total_pa += pa;                          // ✅ somme directe
        }
      }

      // Inter-doublure
      if (r.inter_doublure) {
        const ml = toNum(r.ml_inter) * q;
        const pa = toNum(r.pa_inter);
        if (ml > 0 || pa > 0) {
          const label = `Inter-doublure — ${String(r.inter_doublure)}`;
          const g = push(mapTissus, `I|${label}`, label);
          g.total_ml += ml;
          g.total_pa += pa;                          // ✅ somme directe
        }
      }

      // ---- RAILS / MÉCANISMES (groupé par nom_tringle) ----
      const name = String(r.nom_tringle || "").trim();
      const lmCm = toNum(r.l_mecanisme);            // en CM dans tes minutes
      const paMecaTotalLigne = toNum(r.pa_meca);    // ✅ déjà un TOTAL ligne (pas au mètre)
      if (name && (lmCm > 0 || paMecaTotalLigne > 0)) {
        const mlMeters = (lmCm * q) / 100;          // ✅ conversion cm→m et × quantite
        const g = push(mapRails, name, name);
        g.total_ml += mlMeters;                      // ✅ somme ML en mètres
        g.total_pa += paMecaTotalLigne;              // ✅ somme directe des PA lignes
      }
    }

    const tissus = Array.from(mapTissus.values()).sort((a,b) => a.label.localeCompare(b.label, "fr", { numeric:true }));
    const rails  = Array.from(mapRails.values()).sort((a,b) => a.label.localeCompare(b.label, "fr", { numeric:true }));

    const totalTissus = tissus.reduce((s,g)=> s + g.total_pa, 0);
    const totalRails  = rails.reduce((s,g)=> s + g.total_pa, 0);

    return { tissus, rails, totalTissus, totalRails, achatsFixes: totalTissus + totalRails };
  }, [rows, toNum]);

  // ——— 2) Achats variables ———
  const achatsVariables = React.useMemo(() => {
    const extras   = (extraRows || []).reduce((s, r) => s + toNum(r?.montant_eur), 0);
    const depTotal = (depRows   || []).reduce((s, r) => s + toNum(r?.total_eur), 0);
    return { extras, depTotal, total: extras + depTotal };
  }, [extraRows, depRows, toNum]);

  // ——— 3) CA, marge, contribution ———
  const caMinutes = React.useMemo(
    () => (rows || []).reduce((s, r) => s + toNum(r?.prix_total), 0),
    [rows, toNum]
  );
  const caTotal = caMinutes + achatsVariables.extras + achatsVariables.depTotal;
  const margeBrute   = caTotal - aggr.achatsFixes;
  const contribution = margeBrute - achatsVariables.total;

  // ——— 4) Heures & contrib horaire ———
  const heuresTotales = React.useMemo(() => {
    let h = 0;
    for (const r of rows || []) {
      h += toNum(r?.heures_prepa);
      h += toNum(r?.heures_confection);
      h += toNum(r?.heures_pose);
    }
    return h;
  }, [rows, toNum]);
  const contribHoraire = heuresTotales > 0 ? (contribution / heuresTotales) : 0;

  const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* KPIs synthèse */}
      <Card>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(120px, 1fr))",
            gap: 12,
            alignItems: "stretch",
          }}
        >
          <Kpi label="CA total" value={nfEur0.format(caTotal)} badge={`${pct(caTotal, caTotal)} %`} primary />
          <Kpi label="Achats fixes" value={nfEur0.format(aggr.achatsFixes)} />
          <Kpi label="Marge brute" value={nfEur0.format(margeBrute)} badge={`${pct(margeBrute, caTotal)} %`} />
          <Kpi label="Achats variables" value={nfEur0.format(achatsVariables.total)} />
          <Kpi label="Contribution" value={nfEur0.format(contribution)} badge={`${pct(contribution, caTotal)} %`} />
          <Kpi label="Heures totales" value={nf0.format(heuresTotales)} suffix="h" />
          <Kpi label="Contrib. horaire" value={nfEur0.format(contribHoraire)} />
        </div>
      </Card>

      {/* Achats fixes */}
      <ExpandableSection title="Achats fixes" subtitle={nfEur0.format(aggr.achatsFixes)} defaultOpen>
        <SubTitle>Tissus (Déco, Doublure, Inter-doublure)</SubTitle>
        <GroupsTable
          groups={aggr.tissus}
          columns={[
            { key: "label",    header: "Référence" },
            { key: "total_ml", header: "Somme ML", fmt: (v)=> `${nf0.format(v)} ml` },
            { key: "total_pa", header: "Somme PA", fmt: (v)=> nfEur0.format(v) },
          ]}
          emptyMsg="Aucun tissu détecté."
        />

        <div style={{ height: 10 }} />
        <SubTitle>Rails / mécanismes</SubTitle>
        <GroupsTable
          groups={aggr.rails}
          columns={[
            { key: "label",    header: "Nom mécanisme" },
            { key: "total_ml", header: "Somme ML", fmt: (v)=> `${nf0.format(v)} ml` },
            { key: "total_pa", header: "Somme PA", fmt: (v)=> nfEur0.format(v) },
          ]}
          emptyMsg="Aucun rail/mécanisme détecté."
        />
      </ExpandableSection>

      {/* Achats variables */}
      <ExpandableSection title="Achats variables" subtitle={nfEur0.format(achatsVariables.total)} defaultOpen>
        <SubTitle>Autres dépenses</SubTitle>
        <ListTable
          rows={extraRows}
          columns={[
            { key: "categorie",   header: "Catégorie" },
            { key: "libelle",     header: "Libellé" },
            { key: "montant_eur", header: "Montant (€)", fmt: (v)=> nfEur0.format(toNum(v)) },
          ]}
          emptyMsg="Aucune dépense saisie."
        />

        <div style={{ height: 10 }} />
        <SubTitle>Déplacements</SubTitle>
        <ListTable
          rows={depRows}
          columns={[
            { key: "type_deplacement", header: "Type" },
            { key: "total_eur",        header: "Total (€)", fmt: (v)=> nfEur0.format(toNum(v)) },
          ]}
          emptyMsg="Aucun déplacement."
        />
      </ExpandableSection>
    </div>
  );
}

/* ─────────────── helpers UI ─────────────── */

function Card({ children, style }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        background: "#fff",
        padding: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Kpi({ label, value, badge, suffix, primary }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        padding: 8,
        borderRadius: 10,
        background: primary ? "rgba(59,130,246,.06)" : "transparent",
        border: primary ? `1px solid rgba(59,130,246,.25)` : `1px solid transparent`,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, display: "flex", alignItems: "baseline", gap: 6 }}>
        <span>{value}</span>
        {suffix && <span style={{ fontSize: 12, color: "#6b7280" }}>{suffix}</span>}
        {badge && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 12,
              padding: "2px 6px",
              borderRadius: 999,
              background: "#F3F4F6",
              color: "#374151",
            }}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function ExpandableSection({ title, subtitle, children, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Card>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
          <b>{title}</b>
          {subtitle && <span style={{ color: "#6b7280" }}>— {subtitle}</span>}
        </div>
        <span style={{ opacity: 0.6 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </Card>
  );
}

function SubTitle({ children }) {
  return <div style={{ fontWeight: 700, opacity: 0.85, marginBottom: 6 }}>{children}</div>;
}

function GroupsTable({ groups, columns, emptyMsg }) {
  if (!groups || groups.length === 0) {
    return <div style={{ color: "#6b7280" }}>{emptyMsg}</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: "left", padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {columns.map((c) => {
                const raw = g[c.key];
                const val = typeof c.fmt === "function" ? c.fmt(raw, g) : raw;
                return (
                  <td key={c.key} style={{ padding: 8 }}>
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListTable({ rows, columns, emptyMsg }) {
  if (!rows || rows.length === 0) {
    return <div style={{ color: "#6b7280" }}>{emptyMsg}</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: "left", padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {columns.map((c) => {
                const raw = r?.[c.key];
                const val = typeof c.fmt === "function" ? c.fmt(raw, r) : raw;
                return (
                  <td key={c.key} style={{ padding: 8 }}>
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}