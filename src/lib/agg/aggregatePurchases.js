// Agrège les besoins à partir des lignes "minutes"
// Regroupe : TISSUS (tissu_deco1), DOUBLURES (doublure), RAILS (type_rail/nom_tringle/diametre_tringle)
export function aggregatePurchases(rows = []) {
  const toNum = (v) => {
    const n = Number(String(v ?? "").toString().replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const push = (map, key, item) => {
    if (!map.has(key)) map.set(key, { ...item, total_ml: 0, total_pa: 0, count: 0, children: [] });
    return map.get(key);
  };

  const tissus = new Map();
  const doublures = new Map();
  const rails = new Map();

  for (const r of rows) {
    const qty = Math.max(1, toNum(r.quantite));

    // --- TISSU déco 1
    if (r.tissu_deco1 && toNum(r.ml_tissu_deco1) > 0) {
      const key = `TISSU|${r.tissu_deco1}|${r.motif_deco1 ?? ""}`;
      const label = r.motif_deco1 ? `${r.tissu_deco1} — ${r.motif_deco1}` : String(r.tissu_deco1);
      const g = push(tissus, key, { kind: "tissu", label, ref: r.tissu_deco1, motif: r.motif_deco1, pa_field: "pa_tissu_deco1" });
      const ml = toNum(r.ml_tissu_deco1) * qty;
      g.total_ml += ml;
      const pa = toNum(r.pa_tissu_deco1);
      if (pa > 0) g.total_pa += pa * ml; // PA au mètre
      g.count++;
      g.children.push(childFromRow(r, ml));
    }

    // --- DOUBLURE
    if (r.doublure && toNum(r.ml_doublure) > 0) {
      const key = `DOUBLURE|${r.doublure}`;
      const label = String(r.doublure);
      const g = push(doublures, key, { kind: "doublure", label, ref: r.doublure, pa_field: "pa_doublure" });
      const ml = toNum(r.ml_doublure) * qty;
      g.total_ml += ml;
      const pa = toNum(r.pa_doublure);
      if (pa > 0) g.total_pa += pa * ml;
      g.count++;
      g.children.push(childFromRow(r, ml));
    }

    // --- RAILS / MÉCANISMES (linéaire = l_mecanisme)
    const hasRail = (r.type_rail || r.nom_tringle || r.diametre_tringle);
    const lm = toNum(r.l_mecanisme);
    if (hasRail && lm > 0) {
      const key = `RAIL|${r.type_rail ?? ""}|${r.nom_tringle ?? ""}|${r.diametre_tringle ?? ""}`;
      const parts = [r.type_rail, r.nom_tringle, r.diametre_tringle ? `Ø${r.diametre_tringle}` : ""].filter(Boolean);
      const label = parts.join(" — ") || "Mécanisme";
      const g = push(rails, key, { kind: "rail", label, type_rail: r.type_rail, nom_tringle: r.nom_tringle, diametre_tringle: r.diametre_tringle, pa_field: "pa_meca" });
      const ml = lm * qty;
      g.total_ml += ml;
      const pa = toNum(r.pa_meca);
      if (pa > 0) g.total_pa += pa * ml; // PA au mètre linéaire
      g.count++;
      g.children.push(childFromRow(r, ml));
    }
  }

  const mapToArray = (m) =>
    Array.from(m.values()).sort((a, b) => a.label.localeCompare(b.label));

  return {
    tissus: mapToArray(tissus),
    doublures: mapToArray(doublures),
    rails: mapToArray(rails),
  };

  function childFromRow(r, ml) {
    return {
      zone: r.zone ?? "",
      piece: r.piece ?? "",
      produit: r.produit ?? "",
      type: r.type_confection ?? "",
      largeur: toNum(r.largeur),
      hauteur: toNum(r.hauteur),
      quantite: Math.max(1, toNum(r.quantite)),
      ml: ml,
      detail: r.detail ?? "",
    };
  }
}