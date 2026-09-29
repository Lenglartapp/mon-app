// Famille d'un chiffrage : l'original (sans parentId) + ses variantes/recalibrages
// (parentId = id de l'original). Structure à plat, un seul niveau.

export const familyRootId = (minute) => minute?.parentId || minute?.id;

const isRecalibrage = (m) => / Recalibrage \d+$/i.test(m?.name || "");

// Prochain numéro de version de la famille. On part du plus grand numéro existant
// (et non du nombre de membres) pour ne jamais réutiliser un numéro après une suppression.
export function nextFamilyVersion(minutes, rootId) {
  const members = (minutes || []).filter(m => m.id === rootId || m.parentId === rootId);
  const maxVersion = members.reduce((max, m) => Math.max(max, Number(m.version) || 1), 1);
  return Math.max(maxVersion, members.length) + 1;
}

// Membres ordonnés (original d'abord, puis par version/date) avec leur code d'onglet :
// V1 = original, V2, V3… = variantes, R1, R2… = recalibrages.
export function buildFamilyTabs(minutes, current) {
  const rootId = familyRootId(current);
  if (!rootId) return [];
  const byId = new Map((minutes || []).map(m => [m.id, m]));
  // Le chiffrage ouvert (détail) prime sur sa version « liste légère »
  if (current?.id) byId.set(current.id, { ...byId.get(current.id), ...current });
  const members = [...byId.values()].filter(m => m.id === rootId || m.parentId === rootId);
  const root = members.find(m => m.id === rootId);
  const children = members
    .filter(m => m.id !== rootId)
    .sort((a, b) => (Number(a.version) || 0) - (Number(b.version) || 0) || (a.createdAt || 0) - (b.createdAt || 0));

  let v = 1;
  let r = 0;
  const tabs = [];
  if (root) tabs.push({ id: root.id, code: "V1", name: root.name, isRoot: true });
  children.forEach(m => {
    if (isRecalibrage(m)) tabs.push({ id: m.id, code: `R${++r}`, name: m.name });
    else tabs.push({ id: m.id, code: `V${++v}`, name: m.name });
  });
  return tabs;
}

// Couleur d'intercalaire : dégradé bleu nuit (#1E2447, l'original) → bleu clair (dernier).
const NAVY = [30, 36, 71];
const LIGHT = [168, 182, 218];
export function variantShade(index, count) {
  const t = count <= 1 ? 0 : index / (count - 1);
  const c = NAVY.map((v, k) => Math.round(v + (LIGHT[k] - v) * t));
  return { bg: `rgb(${c.join(",")})`, fg: t > 0.55 ? "#1E2447" : "#FFFFFF" };
}
