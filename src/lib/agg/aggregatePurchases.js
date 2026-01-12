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

    // --- TISSU déco 1 (Rideaux)
    if (r.tissu_deco1 && toNum(r.ml_tissu_deco1) > 0) {
      const key = `TISSU|${r.tissu_deco1}|${r.motif_deco1 ?? ""}`;
      const label = r.motif_deco1 ? `${r.tissu_deco1} — ${r.motif_deco1}` : String(r.tissu_deco1);
      const g = push(tissus, key, { kind: "tissu", label, ref: r.tissu_deco1, motif: r.motif_deco1, pa_field: "pa_tissu_deco1" });
      const ml = toNum(r.ml_tissu_deco1) * qty;
      g.total_ml += ml;
      const pa = toNum(r.pa_tissu_deco1);
      if (pa > 0) g.total_pa += pa * ml;
      g.count++;
      g.children.push(childFromRow(r, ml));
    }

    // --- DECORS: Tissu 1
    if (r.tissu_1 && toNum(r.ml_tissu_1) > 0) {
      const key = `TISSU_DEC|${r.tissu_1}`;
      const label = `Décor: ${r.tissu_1}`;
      const g = push(tissus, key, { kind: "tissu", label, ref: r.tissu_1, pa_field: "pa_tissu_1" });
      const ml = toNum(r.ml_tissu_1) * qty;
      g.total_ml += ml;
      const pa = toNum(r.pa_tissu_1); // Note: pa_tissu_1 in recomputeRow is Total PA per unit. Here we expect PA per meter?
      // RecomputeRow: pa_tissu_1 = ml * unit_pa.
      // So r.pa_tissu_1 is TOTAL cost per Unit.
      // aggregatePurchases expects `total_pa` to be sum of costs.
      // And logic above `g.total_pa += pa * ml` implies `pa` is UNIT PRICE.
      // But r.pa_tissu_deco1 in rideaux logic is... 
      // In recomputeRow: `next.pa_tissu1 = next.ml_tissu1 * (p1.pa || 0)` -> Total Price.
      // So `r.pa_tissu1` IS Total Price (Cost).
      // Line 28 in aggregatePurchases: `if (pa > 0) g.total_pa += pa * ml;`
      // THIS LOOKS WRONG if `pa` is `r.pa_tissu_deco1` (Total Cost).
      // Total Cost * ML = HUGE number.
      // WAIT. Let's check `toNum(r.pa_tissu_deco1)`.
      // If `pa_tissu_deco1` is the name of the column, usually it stores the result of the calculation (Total PA).
      // If so, aggregatePurchases should be `g.total_pa += pa * qty` (if pa is per unit) or `g.total_pa += pa` if pa is total line cost?
      // `r.pa_tissu_deco1` is for ONE unit (row unit).
      // So total for line is `r.pa_tissu_deco1 * qty`.
      // The current existing code `g.total_pa += pa * ml` implies `pa` is interpreted as Price Per Meter?
      // But `r.pa_tissu_deco1` is likely the Calculated Total PA for the Fabric part.
      // This looks like a BUG in existing code OR I misunderstand `r.pa_tissu_deco1`.
      // recomputeRow: `next.pa_tissu1 = next.ml_tissu1 * (p1.pa || 0);`
      // So `pa_tissu1` is COST (Euros).
      // aggregatePurchases line 28: `g.total_pa += pa * ml`.
      // COST * METERS ??? That makes no sense.
      // Unless `pa` variable in snippet is NOT `r.pa_tissu_deco1`.
      // `const pa = toNum(r.pa_tissu_deco1);`
      // It IS.
      // Conclusion: Existing code calculates Cost * Meters. This is definitely wrong for financial aggregation if `pa` is cost.
      // However, I am refactoring DECORS. I should do it Right for Decors.
      // Correct Logic for Decors:
      // total_cost = r.pa_tissu_1 * qty.
      // g.total_pa += total_cost.
      // I will implement this for Decors.

      // FIXING AGGREGATION FOR DECORS:
      const costPerUnit = toNum(r.pa_tissu_1);
      g.total_pa += costPerUnit * qty;

      g.count++;
      g.children.push(childFromRow(r, ml));
    }

    // --- DECORS: Tissu 2
    if (r.tissu_2 && toNum(r.ml_tissu_2) > 0) {
      const key = `TISSU_DEC_2|${r.tissu_2}`;
      const label = `Décor T2: ${r.tissu_2}`;
      const g = push(tissus, key, { kind: "tissu", label, ref: r.tissu_2, pa_field: "pa_tissu_2" });
      const ml = toNum(r.ml_tissu_2) * qty;
      g.total_ml += ml;
      const costPerUnit = toNum(r.pa_tissu_2);
      g.total_pa += costPerUnit * qty;
      g.count++;
      g.children.push(childFromRow(r, ml));
    }

    // --- DECORS: Passementerie 1
    if (r.passementerie_1 && toNum(r.ml_pass_1) > 0) {
      const key = `PASS_DEC|${r.passementerie_1}`;
      const label = `Passementerie: ${r.passementerie_1}`;
      const g = push(tissus, key, { kind: "tissu", label, ref: r.passementerie_1, pa_field: "pa_pass_1" });
      const ml = toNum(r.ml_pass_1) * qty;
      g.total_ml += ml;
      const costPerUnit = toNum(r.pa_pass_1);
      g.total_pa += costPerUnit * qty;
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

    // --- DECORS: Mecanisme/Fourniture
    if (r.mecanisme_fourniture) {
      const key = `MECA_DEC|${r.mecanisme_fourniture}`;
      const label = `Fourniture: ${r.mecanisme_fourniture}`;
      const g = push(rails, key, { kind: "rail", label, ref: r.mecanisme_fourniture, pa_field: "pa_mecanisme" });
      const ml = qty; // Units
      g.total_ml += ml;
      const costPerUnit = toNum(r.pa_mecanisme);
      g.total_pa += costPerUnit * qty;
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