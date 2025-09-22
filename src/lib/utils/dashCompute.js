
const DONE = "Terminé";

export function dashCompute(rows = []) {
  const total = rows.length;

  const val = (r, k) => (r && r[k] != null ? String(r[k]) : "");

  const isDone = (v) => v === DONE;

  // Compteurs par étape
  let prepDone = 0,
    confDone = 0,
    poseDone = 0,
    fullDone = 0;

  // Totaux d'heures
  let hConf = 0,
    hPose = 0;

  for (const r of rows) {
    if (isDone(val(r, "statut_preparation"))) prepDone++;
    if (isDone(val(r, "statut_confection"))) confDone++;
    if (isDone(val(r, "statut_pose"))) poseDone++;

    if (
      isDone(val(r, "statut_preparation")) &&
      isDone(val(r, "statut_confection")) &&
      isDone(val(r, "statut_pose"))
    )
      fullDone++;

    const hc = Number(r.heures_confection);
    const hp = Number(r.heures_pose);
    if (Number.isFinite(hc)) hConf += hc;
    if (Number.isFinite(hp)) hPose += hp;
  }

  const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0);

  return {
    total,
    steps: {
      preparation: { done: prepDone, pct: pct(prepDone, total) },
      confection: { done: confDone, pct: pct(confDone, total) },
      pose: { done: poseDone, pct: pct(poseDone, total) },
    },
    full: { done: fullDone, pct: pct(fullDone, total) },
    hours: {
      sumConfection: hConf,
      sumPose: hPose,
    },
  };
}