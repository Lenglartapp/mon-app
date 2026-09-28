// src/lib/inlineImages.js
// -----------------------------------------------------------------------------
// Images INCRUSTÉES (data:image/…;base64) dans les JSONB (`wall`, `rows`, `lines`).
//
// Chaque image incrustée pèse des centaines de Ko et voyage à CHAQUE chargement et
// CHAQUE sauvegarde (ex. projet PELLETIER : 1,4 Mo de mur pour quelques photos
// postées avant l'upload Storage ; croquis dont l'upload a échoué).
//
// Principe, SANS AUCUN RISQUE DE PERTE :
//  1. On repère les images incrustées et on les envoie dans Storage en arrière-plan.
//  2. Tant que l'envoi n'a pas réussi, l'image incrustée est conservée telle quelle.
//  3. Une fois l'URL obtenue, les sauvegardes suivantes remplacent l'image par son
//     URL (cache mémoire dataUrl -> url). Jamais de remplacement sans URL valide.
// Les photos `pending` (file hors ligne des photos) ne sont PAS concernées : elles
// ont leur propre mécanisme (drainPhotos) et sont retirées avant envoi.
// -----------------------------------------------------------------------------

import { dataUrlToBlob, uploadBlobToStorage } from './utils/imageUpload';

const urlByDataUrl = new Map(); // dataUrl -> URL Storage
const uploading = new Set();

const isInline = (v) => typeof v === 'string' && v.startsWith('data:image/');

const startUpload = (dataUrl) => {
  if (urlByDataUrl.has(dataUrl) || uploading.has(dataUrl)) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  uploading.add(dataUrl);
  const ext = (dataUrl.slice(11, dataUrl.indexOf(';')) || 'png').replace('jpeg', 'jpg');
  return uploadBlobToStorage(dataUrlToBlob(dataUrl), 'migrated', ext)
    .then((url) => { if (url) urlByDataUrl.set(dataUrl, url); return url; })
    .catch((e) => { console.warn('[inlineImages] envoi Storage échoué (image conservée incrustée) :', e?.message || e); return null; })
    .finally(() => uploading.delete(dataUrl));
};

/**
 * Remplace les images incrustées DÉJÀ envoyées par leur URL, et lance l'envoi des
 * autres. Ne descend que dans les tableaux/objets (les images sont dans des listes
 * de photos/croquis ou des posts), profondeur bornée.
 * @returns {{ value: any, changed: boolean, uploads: Promise[] }}
 */
export const replaceInlineImages = (value, depth = 0) => {
  const uploads = [];
  const walk = (v, d) => {
    if (isInline(v)) {
      const url = urlByDataUrl.get(v);
      if (url) return url;
      const p = startUpload(v);
      if (p) uploads.push(p);
      return v;
    }
    if (d > 5 || v === null || typeof v !== 'object') return v;
    if (v.pending) return v; // photo en file hors ligne : gérée ailleurs
    // Copie PARESSEUSE : on ne recrée l'objet/tableau qu'au premier remplacement
    // (appelé à chaque sauvegarde sur des milliers de lignes).
    let out = null;
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        const y = walk(v[i], d + 1);
        if (y !== v[i]) { if (!out) out = v.slice(); out[i] = y; }
      }
      return out || v;
    }
    for (const k in v) {
      const x = v[k];
      if (x === null || (typeof x !== 'object' && !isInline(x))) continue;
      const y = walk(x, d + 1);
      if (y !== x) { if (!out) out = { ...v }; out[k] = y; }
    }
    return out || v;
  };
  const out = walk(value, depth);
  return { value: out, changed: out !== value, uploads };
};

/** true si la valeur contient au moins une image incrustée (hors `pending`). */
export const hasInlineImages = (value) => {
  let found = false;
  const walk = (v, d) => {
    if (found) return;
    if (isInline(v)) { found = true; return; }
    if (d > 5 || v === null || typeof v !== 'object' || v.pending) return;
    for (const x of Array.isArray(v) ? v : Object.values(v)) walk(x, d + 1);
  };
  walk(value, 0);
  return found;
};
