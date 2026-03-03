// src/components/Moulinette.jsx
import React from "react";
import { COLORS, S } from "../lib/constants/ui";

const nfEur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export default function Moulinette({ rows = [], extraRows = [], depRows = [] }) {
  // ——— utils ———
  const toNum = React.useCallback((v) => {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }, []);
  const qty = (r) => Math.max(1, toNum(r?.quantite));

  // ——— 1) Agrégations “Achats fixes” ———
  const aggr = React.useMemo(() => {
    const mapTissus = new Map();
    const mapRails = new Map();
    const mapStores = new Map();

    const push = (m, key, label) => {
      if (!m.has(key)) m.set(key, { label, total_ml: 0, total_pa: 0, total_qty: 0 });
      return m.get(key);
    };

    const processTissu = (ref, motif, ml, paTotal, typeStr = "") => {
      if (!ref) return;
      const mlNum = toNum(ml);
      const paNum = toNum(paTotal);
      if (mlNum > 0 || paNum > 0) {
        // Just use the name, no prefix, to group the same item
        const labelStr = String(ref).trim();
        const fullLabel = motif ? `${labelStr} — ${motif}` : labelStr;
        const g = push(mapTissus, fullLabel, fullLabel);
        g.total_ml += mlNum;
        g.total_pa += paNum;
      }
    };

    for (const r of rows) {
      const q = qty(r);

      // ---- TISSUS ----
      processTissu(r.tissu_deco1, r.motif_deco1, toNum(r.ml_tissu_deco1) * q, r.pa_tissu_deco1);
      processTissu(r.tissu_deco2, r.motif_deco2, toNum(r.ml_tissu_deco2) * q, r.pa_tissu_deco2);
      processTissu(r.doublure, null, toNum(r.ml_doublure) * q, r.pa_doublure);
      processTissu(r.inter_doublure, null, toNum(r.ml_inter) * q, r.pa_inter);
      // Other schema variations (decors, etc.)
      processTissu(r.tissu_1, null, toNum(r.ml_tissu_1) * q, r.pa_tissu_1);
      processTissu(r.tissu_2, null, toNum(r.ml_tissu_2) * q, r.pa_tissu_2);
      processTissu(r.molleton, null, toNum(r.ml_molleton) * q, r.pa_molleton);
      processTissu(r.toile_finition_1, null, toNum(r.ml_toile_finition_1) * q, r.pa_toile_finition_1);

      // ---- RAILS / STORE MÉCANISMES ----
      const prodStr = String(r.produit || "");
      const isBateau = /bateau|vélum|velum/i.test(prodStr);
      const isStore = /store|canishade/i.test(prodStr) && !isBateau;

      if (isStore) {
        // ---- STORES ----
        const storeName = String(r.mecanisme_store || r.modele_mecanisme || r.nom_tringle || "").trim();
        // PA could be either in pa_mecanisme_store or pa_mecanisme
        const paStoreNum = toNum(r.pa_mecanisme_store) > 0 ? toNum(r.pa_mecanisme_store) : (toNum(r.pa_meca) + toNum(r.pa_mecanisme));
        if (storeName && paStoreNum > 0) {
          const g = push(mapStores, storeName, storeName);
          g.total_qty += q;
          g.total_pa += paStoreNum;
        }
      } else {
        // ---- RAILS / TRINGLES ----
        const railName = String(r.nom_tringle || r.modele_mecanisme || r.mecanisme_fourniture || "").trim();
        const lMecaCm = toNum(r.l_mecanisme || r.largeur_mecanisme);
        const paMecaTotalLigne = toNum(r.pa_meca) + toNum(r.pa_mecanisme) + toNum(r.pa_mecanisme_bis);

        if (railName && (lMecaCm > 0 || paMecaTotalLigne > 0)) {
          const mlMeters = (lMecaCm * q) / 100;
          const g = push(mapRails, railName, railName);
          g.total_ml += mlMeters;
          g.total_pa += paMecaTotalLigne;
        }
      }
    }

    const tissus = Array.from(mapTissus.values()).sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true }));
    const rails = Array.from(mapRails.values()).sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true }));
    const stores = Array.from(mapStores.values()).sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true }));

    const totalTissus = tissus.reduce((s, g) => s + g.total_pa, 0);
    const totalRails = rails.reduce((s, g) => s + g.total_pa, 0);
    const totalStores = stores.reduce((s, g) => s + g.total_pa, 0);

    return { tissus, rails, stores, totalTissus, totalRails, totalStores, achatsFixes: totalTissus + totalRails + totalStores };
  }, [rows, toNum]);

  // ——— 2) Achats variables ———
  const achatsVariables = React.useMemo(() => {
    const extras = (extraRows || []).reduce((s, r) => s + toNum(r?.montant_eur), 0);
    const depTotal = (depRows || []).reduce((s, r) => s + toNum(r?.total_eur), 0);
    return { extras, depTotal, total: extras + depTotal };
  }, [extraRows, depRows, toNum]);

  // ——— 3) CA, marge, contribution ———
  const caMinutes = React.useMemo(
    () => (rows || []).reduce((s, r) => s + toNum(r?.prix_total), 0),
    [rows, toNum]
  );
  const caTotal = caMinutes + achatsVariables.extras + achatsVariables.depTotal;
  const margeBrute = caTotal - aggr.achatsFixes;
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
            { key: "label", header: "Référence" },
            { key: "total_ml", header: "Somme ML", fmt: (v) => `${nf0.format(v)} ml` },
            { key: "total_pa", header: "Somme PA", fmt: (v) => nfEur0.format(v) },
          ]}
          emptyMsg="Aucun tissu détecté."
        />

        <div style={{ height: 10 }} />
        <SubTitle>Rails / mécanismes</SubTitle>
        <GroupsTable
          groups={aggr.rails}
          columns={[
            { key: "label", header: "Modèle mécanisme" },
            { key: "total_ml", header: "Somme ML", fmt: (v) => `${nf0.format(v)} ml` },
            { key: "total_pa", header: "Somme PA", fmt: (v) => nfEur0.format(v) },
          ]}
          emptyMsg="Aucun rail/mécanisme détecté (ou stores bateaux)."
        />

        <div style={{ height: 10 }} />
        <SubTitle>Stores Confectionnés</SubTitle>
        <GroupsTable
          groups={aggr.stores}
          columns={[
            { key: "label", header: "Modèle Store" },
            { key: "total_qty", header: "Quantité", fmt: (v) => `${nf0.format(v)} u` },
            { key: "total_pa", header: "Somme PA", fmt: (v) => nfEur0.format(v) },
          ]}
          emptyMsg="Aucun store détecté (Enrouleur, Vénitien, Californien, etc)."
        />
      </ExpandableSection>

      {/* Achats variables */}
      <ExpandableSection title="Achats variables" subtitle={nfEur0.format(achatsVariables.total)} defaultOpen>
        <SubTitle>Autres dépenses</SubTitle>
        <ListTable
          rows={extraRows}
          columns={[
            { key: "categorie", header: "Catégorie" },
            { key: "libelle", header: "Libellé" },
            { key: "montant_eur", header: "Montant (€)", fmt: (v) => nfEur0.format(toNum(v)) },
          ]}
          emptyMsg="Aucune dépense saisie."
        />

        <div style={{ height: 10 }} />
        <SubTitle>Déplacements</SubTitle>
        <ListTable
          rows={depRows}
          columns={[
            { key: "type_deplacement", header: "Type" },
            { key: "total_eur", header: "Total (€)", fmt: (v) => nfEur0.format(toNum(v)) },
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