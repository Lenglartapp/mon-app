// src/components/EtiquettesSection.jsx
import React from "react";
import { COLORS, S } from "../lib/constants/ui.js";
import { Filter, Settings2 } from "lucide-react";
import { useLocalStorage } from "../lib/hooks/useLocalStorage.js";
import FilterPanel from "./FilterPanel.jsx";
import EtqFieldPicker from "./EtqFieldPicker.jsx";
import EtiquetteCard from "./EtiquetteCard.jsx";

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function EtiquettesSection({ title, tableKey, rows, schema }) {
  const sectionRef = React.useRef(null);

  // Clés LS
  const keyFields = `prod.etq.fields.${tableKey}`;
  const keyFilters = `prod.etq.filters.${tableKey}`;
  const keyGroup = `prod.etq.group.${tableKey}`;
  const keyColsWeb = `prod.etq.colsWeb.${tableKey}`;
  const keyColsPrint = `prod.etq.colsPrint.${tableKey}`;
  const keyDensity = `prod.etq.density.${tableKey}`;
  const keyLayout = `prod.etq.layout.${tableKey}`;      // "auto" | "1col" | "2col"
  const keyOnePer = `prod.etq.onepage.${tableKey}`;     // bool

  // Champs visibles par défaut
  const DEFAULT = [
    "zone", "piece", "produit", "type_confection", "pair_un", "ampleur",
    "largeur", "hauteur", "nb_glisseurs", "h_finie"
  ];

  const [fieldsLS, setFields] = useLocalStorage(keyFields, DEFAULT);
  const [filters, setFilters] = useLocalStorage(keyFilters, []);
  const [showFilters, setShowFilters] = React.useState(false);
  const [groupBy, setGroupBy] = useLocalStorage(keyGroup, null);

  // Options d’affichage
  const [colsWeb, setColsWeb] = useLocalStorage(keyColsWeb, 3);
  const [colsPrint, setColsPrint] = useLocalStorage(keyColsPrint, 3);
  const [density, setDensity] = useLocalStorage(keyDensity, "normal"); // "compact" | "normal" | "large"

  // Nouveau : layout interne & 1/page
  const [layout, setLayout] = useLocalStorage(keyLayout, "auto"); // "auto" | "1col" | "2col"
  const [onePerPage, setOnePerPage] = useLocalStorage(keyOnePer, false);

  // Sélecteur de champs (comme ailleurs)
  const [showPicker, setShowPicker] = React.useState(false);

  // Injecter le nombre de colonnes impression pour la grille
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--etq-cols-print", String(colsPrint || 3));
    return () => root.style.removeProperty("--etq-cols-print");
  }, [colsPrint]);

  // --- Sécurité: ne garder que des clés existantes et autorisées
  const allowedKeys = React.useMemo(
    () =>
      (schema || [])
        .filter((c) => !["sel", "detail", "photo", "button"].includes(c.key))
        .map((c) => c.key),
    [schema]
  );

  const fields = React.useMemo(() => {
    const kept = (fieldsLS || []).filter((k) => allowedKeys.includes(k));
    return kept.length ? kept : DEFAULT.filter((k) => allowedKeys.includes(k));
  }, [fieldsLS, allowedKeys]);

  // 1) lignes de base : si des lignes sont cochées → seulement celles-là
  const base = Array.isArray(rows) && rows.some((r) => r?.sel)
    ? rows.filter((r) => r?.sel)
    : (rows || []);

  // 2) Filtres
  const filtered = React.useMemo(() => {
    if (!filters?.length) return base;
    return base.filter((r) =>
      filters.every((f) => {
        const v = r?.[f.key];
        const sv = String(v ?? "");
        switch (f.op) {
          case "contains": return sv.toLowerCase().includes(String(f.value || "").toLowerCase());
          case "eq": return sv === String(f.value ?? "");
          case "neq": return sv !== String(f.value ?? "");
          case "gt": return toNumber(v) > toNumber(f.value);
          case "gte": return toNumber(v) >= toNumber(f.value);
          case "lt": return toNumber(v) < toNumber(f.value);
          case "lte": return toNumber(v) <= toNumber(f.value);
          case "isTrue": return Boolean(v) === true;
          case "isFalse": return Boolean(v) === false;
          case "isEmpty": return sv === "" || v == null;
          case "notEmpty": return !(sv === "" || v == null);
          default: return true;
        }
      })
    );
  }, [base, filters]);

  // 3) Évite les cartes entièrement vides
  const rowsForCards = React.useMemo(() => {
    const out = [];
    for (const r of filtered) {
      const hasValue = fields.some((k) => {
        const v = r?.[k];
        return !(v == null || String(v).trim() === "");
      });
      if (hasValue) out.push(r);
    }
    return out;
  }, [filtered, fields]);

  // 4) Groupes
  const groups = React.useMemo(() => {
    if (!groupBy?.key) return null;
    const m = new Map();
    for (const r of rowsForCards) {
      const gv = r[groupBy.key] ?? "";
      const k = String(gv);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return Array.from(m.entries()).sort(([a], [b]) =>
      a.localeCompare(b, "fr", { numeric: true })
    );
  }, [rowsForCards, groupBy]);

  // Impression
  const printAll = () => window.print();

  // Densité (taille de police / espacements)
  const densityStyle =
    density === "compact"
      ? { fontSize: 12, lineHeight: 1.1 }
      : density === "large"
        ? { fontSize: 15, lineHeight: 1.3 }
        : { fontSize: 13.5, lineHeight: 1.2 };

  // === Application du layout & "1/page" sur les cartes ===
  const applyCardStyles = React.useCallback(() => {
    const root = sectionRef.current;
    if (!root) return;
    const cards = root.querySelectorAll(".etq-card");
    cards.forEach((el) => {
      // Colonnage (écran)
      if (layout === "1col") {
        el.style.columnCount = "1";
      } else if (layout === "2col") {
        el.style.columnCount = "2";
      } else {
        el.style.columnCount = "1"; // auto -> base 1, ajusté avant impression si besoin
      }

      // Espacement colonne
      el.style.columnGap = "16px";

      // Empêcher la casse d’un champ sur 2 pages / colonnes
      Array.from(el.children).forEach((child) => {
        child.style.breakInside = "avoid";
      });

      // 1 étiquette par page (print)
      el.style.breakAfter = onePerPage ? "page" : "auto";
    });
  }, [layout, onePerPage]);

  React.useEffect(() => {
    applyCardStyles();
  }, [applyCardStyles, rowsForCards.length, fields.join(","), groupBy?.key, density]);

  // Auto-fit avant impression : si layout=auto et carte trop haute, bascule en 2 colonnes
  React.useEffect(() => {
    if (layout !== "auto") return;

    const onBefore = () => {
      const root = sectionRef.current;
      if (!root) return;

      const PX_PER_IN = 96;
      const A4_H = 11.69 * PX_PER_IN; // ≈ 1123px
      const margin = (10 / 25.4) * PX_PER_IN; // 10mm → px
      const maxH = A4_H - margin - margin;

      const cards = root.querySelectorAll(".etq-card");
      cards.forEach((el) => {
        el.style.columnCount = "1";
        if (el.scrollHeight > maxH) el.style.columnCount = "2";
      });
    };

    window.addEventListener("beforeprint", onBefore);
    return () => window.removeEventListener("beforeprint", onBefore);
  }, [layout]);

  return (
    <div ref={sectionRef} style={{ ...S.modernCard, overflow: "visible", padding: 0, marginBottom: 24 }}>
      {/* Toolbar — masquée à l’impression */}
      <div
        data-hide-on-print="1"
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', textTransform: 'uppercase' }}>{title}</div>

        <div style={{ ...S.etqToolbar, flexWrap: "wrap" }}>
          <button style={S.smallBtn} onClick={printAll}>
            Imprimer
          </button>

          {/* Filtres */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <button style={S.smallBtn} onClick={() => setShowFilters((s) => !s)}>
              <Filter size={16} /> Filtres
            </button>
            {showFilters && (
              <FilterPanel
                filters={filters} // ← déjà dans DataTable via useLocalStorage
                setFilters={setFilters} // ← idem
                schema={schema}
                onClose={() => setShowFilters(false)}
              />
            )}
          </div>

          {/* Grouper */}
          <div>
            <select
              style={S.smallBtn}
              value={groupBy?.key || ""}
              title="Grouper par"
              onChange={(e) =>
                setGroupBy(e.target.value ? { key: e.target.value } : null)
              }
            >
              <option value="">— Aucun groupe —</option>
              {(schema || [])
                .filter((c) => !["sel", "detail", "photo", "button"].includes(c.key))
                .map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
            </select>
            {groupBy?.key && (
              <button style={S.smallBtn} onClick={() => setGroupBy(null)}>
                Annuler le groupe
              </button>
            )}
          </div>

          {/* Sélecteur de champs */}
          <div style={{ position: "relative" }}>
            <button
              style={S.smallBtn}
              onClick={() => setShowPicker(true)}
              title="Choisir les champs à afficher sur l'étiquette"
            >
              <Settings2 size={16} /> Champs
            </button>
            {showPicker && (
              <EtqFieldPicker
                visibleKeys={fields}
                setVisibleKeys={(arr) => setFields(arr)}
                schema={schema}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>

          {/* Mise en page interne */}
          <div>
            <label style={{ marginRight: 6 }}>Mise en page</label>
            <select
              style={S.smallBtn}
              value={layout}
              onChange={(e) => setLayout(e.target.value)}
              title="Organisation interne de l'étiquette"
            >
              <option value="auto">Auto</option>
              <option value="1col">1 colonne</option>
              <option value="2col">2 colonnes</option>
            </select>
          </div>

          {/* Colonnes web / print */}
          <div>
            <label style={{ marginRight: 6 }}>Colonnes écran</label>
            <select
              style={S.smallBtn}
              value={colsWeb}
              onChange={(e) => setColsWeb(Number(e.target.value) || 3)}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ marginRight: 6 }}>Colonnes impression</label>
            <select
              style={S.smallBtn}
              value={colsPrint}
              onChange={(e) => setColsPrint(Number(e.target.value) || 3)}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Densité */}
          <div>
            <label style={{ marginRight: 6 }}>Densité</label>
            <select
              style={S.smallBtn}
              value={density}
              onChange={(e) => setDensity(e.target.value)}
            >
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
              <option value="large">Large</option>
            </select>
          </div>

          {/* 1 étiquette par page */}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={onePerPage}
              onChange={(e) => setOnePerPage(e.target.checked)}
            />
            1 étiquette par page
          </label>
        </div>
      </div>

      {/* Corps */}
      {rowsForCards.length === 0 ? (
        <div style={{ padding: 12, opacity: 0.7 }}>
          Aucune étiquette : ajuste les filtres ou saisis des valeurs.
        </div>
      ) : !groupBy?.key ? (
        <div
          className="etq-grid"
          style={{
            ...S.cardsWrap,
            gridTemplateColumns: `repeat(${colsWeb}, minmax(260px, 1fr))`,
            ...densityStyle,
          }}
        >
          {rowsForCards.map((r) => (
            <EtiquetteCard key={r.id} row={r} schema={schema} fields={fields} />
          ))}
        </div>
      ) : (
        // Rendu groupé
        <div style={{ display: "grid", gap: 18 }}>
          {Array.from(groups).map(([gv, rs]) => (
            <div key={gv}>
              <div
                data-hide-on-print="1"
                style={{ fontWeight: 800, margin: "6px 0 8px" }}
              >
                {(schema || []).find((c) => c.key === groupBy.key)?.label ||
                  groupBy.key}{" "}
                : {gv || "—"}
                <span style={{ opacity: 0.6, marginLeft: 8 }}>({rs.length})</span>
              </div>
              <div
                className="etq-grid"
                style={{
                  ...S.cardsWrap,
                  gridTemplateColumns: `repeat(${colsWeb}, minmax(260px, 1fr))`,
                  ...densityStyle,
                }}
              >
                {rs.map((r) => (
                  <EtiquetteCard key={r.id} row={r} schema={schema} fields={fields} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Picker (sélecteur de champs) */}
      {showPicker && (
        <EtqFieldPicker
          visibleKeys={fields}
          setVisibleKeys={(arr) => setFields(arr)}
          schema={schema}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}