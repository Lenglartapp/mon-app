// src/lib/aggregatePurchases.js

// Agrège les achats (tissus, rails, etc.) à partir des lignes minute
export function aggregatePurchases(rows = []) {
  const byGroup = (arr, keyFn) => {
    const map = new Map();
    for (const r of arr) {
      const key = keyFn(r);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return Array.from(map.entries()).map(([label, items]) => ({
      label,
      total_ml: sum(items.map(x => toNum(x.ml_tissu_deco1 || x.ml_tissu_deco2 || x.ml_toile_finition_1 || x.ml_doublure || x.l_mecanisme))),
      total_pa: sum(items.map(x => toNum(x.pa_tissu_deco1 || x.pa_tissu_deco2 || x.pa_toile_finition_1 || x.pa_doublure || x.pa_meca || x.pa_mecanisme_store) *
        toNum(x.ml_tissu_deco1 || x.ml_tissu_deco2 || x.ml_toile_finition_1 || x.ml_doublure || x.l_mecanisme || 1))),
      children: items,
    }));
  };

  const tissus = [];
  for (const key of ["tissu_deco1", "tissu_deco2", "toile_finition_1"]) {
    const groups = byGroup(rows, (r) => r[key]);
    for (const g of groups) tissus.push(g);
  }

  const doublures = byGroup(rows, (r) => r.doublure);

  // Aggregate both legacy type_mecanisme and new mecanisme_store
  const railsLegacy = byGroup(rows, (r) => r.type_mecanisme);
  const railsNew = byGroup(rows, (r) => r.mecanisme_store);
  const rails = [...railsLegacy, ...railsNew];

  return { tissus, doublures, rails };
}

// ——— utils ———
const toNum = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);