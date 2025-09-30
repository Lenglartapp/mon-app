// Récupère toutes les "mentions" de tissus dans minutes & production
// et fabrique des options uniques pour le select "tissu_key".
const TISSU_COLS = ["tissu_deco1","tissu_deco2","doublure","inter_doublure"];

function trim(s){ return String(s ?? "").trim(); }

export function buildTissueIndex(minutes = [], projects = []) {
  const options = [];
  const seen = new Set();

  const pushOpt = ({ key, label, source_type, source_id, projet_nom, laize, coloris, reference }) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push({ key, label, source_type, source_id, projet_nom, laize, coloris, reference });
  };

  // 1) Minutes
  for (const m of minutes || []) {
    const lignes = Array.isArray(m?.lines) ? m.lines : [];
    for (const r of lignes) {
      for (const k of TISSU_COLS) {
        const nom = trim(r?.[k]);
        if (!nom) continue;
        const laize = r?.[`laize_${k}`] ?? null;
        const ref   = r?.[`ref_${k}`] ?? null;   // au cas où tu ajoutes ces champs plus tard
        const col   = r?.[`coloris_${k}`] ?? null;

        const key   = `${nom}||${laize ?? ""}`; // clé simple & stable
        const label = laize ? `${nom} — ${laize} cm` : nom;

        pushOpt({
          key, label,
          source_type: "minute",
          source_id: m.id,
          projet_nom: m.name || "Minute",
          laize, coloris: col, reference: ref
        });
      }
    }
  }

  // 2) Production (parcours chaque projet → rows)
  for (const p of projects || []) {
    const lignes = Array.isArray(p?.rows) ? p.rows : [];
    for (const r of lignes) {
      for (const k of TISSU_COLS) {
        const nom = trim(r?.[k]);
        if (!nom) continue;
        const laize = r?.[`laize_${k}`] ?? null;
        const ref   = r?.[`ref_${k}`] ?? null;
        const col   = r?.[`coloris_${k}`] ?? null;

        const key   = `${nom}||${laize ?? ""}`;
        const label = laize ? `${nom} — ${laize} cm` : nom;

        pushOpt({
          key, label,
          source_type: "production",
          source_id: p.id || p.name || "",
          projet_nom: p.name || "Projet",
          laize, coloris: col, reference: ref
        });
      }
    }
  }

  // sortie triée pour UX
  options.sort((a,b)=> a.label.localeCompare(b.label, "fr", { numeric:true }));
  return options;
}