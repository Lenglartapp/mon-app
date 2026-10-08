// Textes des lignes du devis Odoo : on part du TEXTE TYPE de l'article Odoo (description de
// vente, avec des « XX » et des « A OU B » à compléter) et on le remplit avec la minute.
// Fonction pure, utilisée par quoteBuilder.describe().
//
// Règles validées par l'utilisateur (2026-10-08) pour rideaux et voilages :
//   « de X cm »          = largeur finie d'UN pan × ampleur (sans croisement ni retours)
//   « ramené à Y cm »    = largeur finie d'un pan
//   Paire → « Une paire de rideaux de X cm chaque ramenés à Y cm chaque sur hauteur de H cm »
//   Un pan → « Un rideau de X cm ramené à Y cm sur hauteur de H cm »

const toNum = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const qtyOf = (r) => Math.max(1, toNum(r?.quantite));
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const fmt = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const distinct = (rows, key) => [...new Set(rows.map((r) => String(r?.[key] ?? '').trim()).filter((v) => v && v !== '0'))];

const pluralWord = (w) => (/[sxz]$/.test(w) ? w : /(eau|au|eu)$/.test(w) ? `${w}x` : `${w}s`);
// Pluriel d'un nom composé : chaque mot (« store bateau » → « stores bateaux », « tenture murale »
// → « tentures murales »), sauf les petits mots de liaison.
const pluralize = (phrase) => String(phrase).split(' ').map((w) => (/^(de|du|des|la|le|les|à|a|en|et)$/i.test(w) || !w ? w : pluralWord(w))).join(' ');
const isPair = (row) => /paire/i.test(row?.paire_ou_un_seul_pan || '');

// ─── Listes de dimensions (remplacent les lignes d'exemple « Un rideau de XX cm… ») ─────────
function curtainDims(rows, word) {
  const groups = new Map();
  for (const r of rows) {
    const pair = isPair(r);
    const width = toNum(r.largeur);
    const pan = pair ? width / 2 : width; // largeur finie d'un pan
    const flat = pan * (toNum(r.ampleur) || 1); // à plat = pan × ampleur
    const h = toNum(r.hauteur);
    const k = `${pair}|${fmt(flat)}|${fmt(pan)}|${fmt(h)}`;
    const g = groups.get(k) || { pair, flat, pan, h, n: 0 };
    g.n += qtyOf(r);
    groups.set(k, g);
  }
  const plural = pluralize(word);
  return [...groups.values()].map((g) => {
    const hh = g.h ? ` sur hauteur de ${fmt(g.h)} cm` : '';
    if (g.pair) {
      const head = g.n > 1 ? `${g.n} paires de ${plural}` : `Une paire de ${plural}`;
      return `${head} de ${fmt(g.flat)} cm chaque ramenés à ${fmt(g.pan)} cm chaque${hh}`;
    }
    if (g.n > 1) return `${g.n} ${plural} de ${fmt(g.flat)} cm chacun ramenés à ${fmt(g.pan)} cm${hh}`;
    return `Un ${word} de ${fmt(g.flat)} cm ramené à ${fmt(g.pan)} cm${hh}`;
  });
}

function sizeDims(rows, word) {
  const groups = new Map();
  for (const r of rows) {
    const k = `${toNum(r.largeur)}|${toNum(r.hauteur)}`;
    const g = groups.get(k) || { L: toNum(r.largeur), H: toNum(r.hauteur), n: 0 };
    g.n += qtyOf(r);
    groups.set(k, g);
  }
  return [...groups.values()].map((g) => {
    const head = g.n > 1 ? `${g.n} ${pluralize(word)}` : `Un ${word}`;
    return `${head} de Largeur ${fmt(g.L)} cm x Hauteur ${fmt(g.H)} cm`;
  });
}

function railDims(rows) {
  const groups = new Map();
  for (const r of rows) {
    const L = toNum(r.largeur_mecanisme) || toNum(r.largeur);
    const g = groups.get(L) || { L, n: 0 };
    g.n += qtyOf(r);
    groups.set(L, g);
  }
  return [...groups.values()].map((g) => `${g.n} rail${g.n > 1 ? 's' : ''} de longueur ${fmt(g.L)} cm`);
}

function lengthDims(rows) {
  const groups = new Map();
  for (const r of rows) {
    const L = toNum(r.largeur);
    const g = groups.get(L) || { L, n: 0 };
    g.n += qtyOf(r);
    groups.set(L, g);
  }
  return [...groups.values()].map((g) => `${g.n > 1 ? `${g.n} longueurs` : 'Une longueur'} de ${fmt(g.L)} cm`);
}

// Quelle liste de dimensions pour cette ligne ?
function dimsFor({ typeKey, comp, rows }) {
  const curtain = typeKey === 'rideau' || typeKey === 'voilage';
  const word = typeKey === 'voilage' ? 'voilage' : 'rideau';
  if (comp?.family === 'Mécanismes' || comp?.bucket === 'prepa') {
    if (typeKey === 'store_bateau') return lengthDims(rows);
    if (typeKey === 'store') return sizeDims(rows, 'store');
    return railDims(rows);
  }
  if (curtain) return curtainDims(rows, word);
  if (typeKey === 'store' || typeKey === 'store_bateau') return sizeDims(rows, 'store');
  const produit = norm(rows[0]?.produit) || 'élément';
  return sizeDims(rows, produit);
}

// ─── Remplissage ───────────────────────────────────────────────────────────────
const COLOR_RE = /\b(blanc|noir|bronze|inox|anthracite|gris|alu(minium)? brut|laiton|or|argent|champagne)\b/i;
const stem = (w) => norm(w).replace(/[^a-z]/g, '').slice(0, 5);

/** Choisit l'option d'une ligne « A OU B OU C » qui correspond à la minute (sinon null). */
function pickOption(options, facts) {
  const factStems = facts.flatMap((f) => norm(f).split(/[^a-z]+/)).filter((w) => w.length >= 4).map(stem);
  const exact = options.find((o) => facts.some((f) => norm(f) === norm(o)));
  if (exact) return exact;
  return options.find((o) => norm(o).split(/[^a-z]+/).filter((w) => w.length >= 4).some((w) => factStems.includes(stem(w)))) || null;
}

/**
 * @returns {{ text: string, todo: number }} texte rempli + nombre de « XX » / « OU » restants
 */
export function fillTemplate({ template, productName, typeKey, comp, rows = [], library = [], refs: refsIn = null, laizes: laizesIn = null }) {
  const lib = new Map(library.map((i) => [norm(i.name), i]));
  const refKey = comp?.refKey;
  // refs / laizes fournis par le moteur quand une ligne regroupe plusieurs colonnes (Tissu 1 + Tissu 2).
  const refs = refsIn || (refKey ? distinct(rows, refKey) : []);
  const items = refs.map((r) => ({ name: r, item: lib.get(norm(r)) }));
  const lined = rows.some((r) => String(r.doublure || '').trim() || toNum(r.pv_doublure));
  const plis = distinct(rows, 'type_confection').map((p) => (/^plis?\b/i.test(p) ? p.replace(/^pli\b/i, 'Plis') : `Plis ${p}`));
  const ampleurs = distinct(rows, 'ampleur').map((a) => fmt(toNum(a)));
  const finitions = distinct(rows, 'finition_bas');
  const poses = distinct(rows, 'type_pose');
  const models = [...new Set([...distinct(rows, 'modele_mecanisme'), ...distinct(rows, 'mecanisme_store')])];
  const facts = [lined ? 'Doublé' : 'Non doublé', ...poses, ...finitions, ...distinct(rows, 'mecanisme_store'), ...distinct(rows, 'modele_mecanisme'), ...distinct(rows, 'type_mecanisme')];

  const out = [];
  let todo = 0;
  let inList = false; // après « Soit : » / « pour : » : les lignes d'exemple sont remplacées
  let dimsDone = false;
  const pushDims = () => {
    if (dimsDone) return;
    out.push(...dimsFor({ typeKey, comp, rows }));
    dimsDone = true;
  };

  for (const raw of String(template || '').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const n = norm(line);

    if (/^(soit|pour)\s*:?$/.test(n)) { out.push(line.trim()); inList = true; continue; }
    if (inList) {
      if (!n) continue;
      // Ligne d'exemple de dimensions : « Un rideau de XX cm… », « 1 rail de longueur XX cm »…
      if (/^(un|une|1)\b/.test(n) && (/\bxx\b/.test(n) || /\bcm\b/.test(n))) { pushDims(); continue; }
      inList = false;
    }

    if (/^plis?\s+xx/.test(n) && plis.length) { out.push(plis.join(' / ')); continue; }
    if (/^ampleur/.test(n)) { out.push(ampleurs.length ? `Ampleur : ${ampleurs.join(' / ')}` : line); if (!ampleurs.length) todo++; continue; }
    if (/finition .*xx.*sol/.test(n)) {
      const f = finitions[0];
      if (!f || toNum(f) < 0) continue; // pas d'info : on retire la ligne
      out.push(toNum(f) > 0 ? `Finition à ${fmt(toNum(f))} cm du sol` : `Finition ${f.toLowerCase()}`);
      continue;
    }
    if (/^r[ée]alis[ée]e?s? en (la|notre) r[ée]f[ée]rence xx/i.test(line) || /^embrasse en la r[ée]f[ée]rence xx/i.test(line)) {
      const prefix = line.trim().split(/ r[ée]f[ée]rence /i)[0];
      if (!items.length) { out.push(line); todo++; continue; }
      for (const { name, item } of items) {
        out.push(item?.reference
          ? `${prefix} référence ${item.reference.trim()}${item.provider ? ` des établissements ${item.provider.trim()}` : ''}`
          : `${prefix} référence ${name}`);
      }
      continue;
    }
    if (/^rail\s+xx/.test(n) && models.length) { out.push(`Rail ${models.join(' / ')}`); continue; }
    if (/^fixations?\s+xx/.test(n) && poses.length) { out.push(`Fixations ${poses.map((p) => p.toLowerCase()).join(' / ')}`); continue; }
    if (/^coloris\s*:?\s*xx/.test(n)) {
      // Tissu : coloris de la bibliothèque ; mécanisme : couleur en fin de modèle (« … Blanc »).
      const colors = [...new Set([
        ...items.map((i) => i.item?.color).filter(Boolean),
        ...(comp?.family === 'Mécanismes' ? models.map((m) => (m.match(COLOR_RE) || [])[0]).filter(Boolean) : []),
      ])];
      if (colors.length) out.push(`Coloris : ${colors.join(' / ')}`); else { out.push(line); todo++; }
      continue;
    }
    if (/^laize\s*:\s*xx/.test(n)) {
      const lz = laizesIn || (comp?.laizeKey ? distinct(rows, comp.laizeKey) : []);
      const fromLib = items.map((i) => i.item?.width).filter(Boolean).map(String);
      const all = [...new Set([...lz, ...fromLib])];
      if (all.length) out.push(`Laize : ${all.map((x) => fmt(toNum(x))).join(' / ')} cm`); else { out.push(line); todo++; }
      continue;
    }
    if (/^rac+ord/.test(n) && comp?.refKey) {
      const suffix = refKey.replace(/^tissu_deco/, 'tissu'); // tissu_deco1 → raccord_v_tissu1
      const v = rows.map((r) => toNum(r[`raccord_v_${suffix}`])).find((x) => x > 0);
      const h = rows.map((r) => toNum(r[`raccord_h_${suffix}`])).find((x) => x > 0);
      out.push(v || h ? `Raccord H/V : ${h ? `${fmt(h)} cm` : 'aucun'} / ${v ? `${fmt(v)} cm` : 'aucun'}` : line);
      continue;
    }
    if (/\sOU\s/.test(line)) {
      const options = line.split(/\s+OU\s+/).map((s) => s.trim());
      // Préfixe commun éventuel (« Pose Plafond OU Suspentes ») : on garde l'option entière.
      const choice = pickOption(options, facts);
      if (choice) { out.push(choice); continue; }
      out.push(line); todo++;
      continue;
    }
    if (/\bXX\b/.test(line)) todo++;
    out.push(line);
  }
  // Mécanismes / préparation sans « Soit : » dans le texte type : on ajoute les longueurs.
  if (!dimsDone && (comp?.family === 'Mécanismes' || comp?.bucket === 'prepa')) {
    out.push('Soit :');
    pushDims();
  }
  // Nettoyage : pas de lignes vides en double ni en fin de texte.
  const clean = out.filter((l, i, a) => l.trim() || (i > 0 && a[i - 1].trim()));
  while (clean.length && !clean[clean.length - 1].trim()) clean.pop();
  return { text: [productName, ...clean].join('\n'), todo };
}
