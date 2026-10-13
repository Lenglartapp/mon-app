// src/lib/photos.js
// -----------------------------------------------------------------------------
// Photos des lignes de projet (prise de vue, vignette, envoi, file hors ligne).
//
//  • Qualité : photo gardée à 1600 px (grand côté), JPEG 85 % → nette et lisible en
//    rapport client. Une VIGNETTE (360 px) est créée en plus, pour afficher vite les
//    listes ; la vraie photo n'est téléchargée qu'à l'ouverture.
//  • Entrée stockée dans la ligne : { id, url, thumb, timestamp, user } (les anciennes
//    photos sans `thumb` s'affichent avec `url`, comme avant).
//  • Hors ligne : la photo attend sur l'appareil (lib/syncQueue). Une fois envoyée, son
//    entrée garde le MÊME id que l'entrée « en attente » et elle est mémorisée ici :
//    toute sauvegarde ultérieure remplace l'entrée en attente par la vraie (sinon une
//    simple modification de statut effaçait la photo qui venait de partir).
// -----------------------------------------------------------------------------

import { compressImageToBlob, uploadBlobToStorage } from './utils/imageUpload';

export const PHOTO_MAX_PX = 1600;
const PHOTO_QUALITY = 0.85;
const THUMB_PX = 360;
const THUMB_QUALITY = 0.72;

/** Photo prête à l'envoi : { full, thumb } (thumb null si l'image n'a pas pu être lue). */
export async function preparePhoto(file) {
  try {
    const full = await compressImageToBlob(file, { maxPx: PHOTO_MAX_PX, quality: PHOTO_QUALITY });
    let thumb = null;
    try { thumb = await compressImageToBlob(full, { maxPx: THUMB_PX, quality: THUMB_QUALITY }); } catch { /* sans vignette */ }
    return { full, thumb };
  } catch {
    // Format que le navigateur ne sait pas lire (ex. HEIC hors Safari) : on envoie
    // le fichier d'origine plutôt que de bloquer la prise de photo.
    return { full: file, thumb: null };
  }
}

const extOf = (blob) => (/png/.test(blob?.type || '') ? 'png' : /heic|heif/.test(blob?.type || '') ? 'heic' : 'jpg');

/** Envoie la photo (+ sa vignette) dans Storage → { url, thumb }. */
export async function uploadPhotoPair({ full, thumb }, folder) {
  const url = await uploadBlobToStorage(full, folder, extOf(full));
  let thumbUrl = null;
  if (thumb) {
    try { thumbUrl = await uploadBlobToStorage(thumb, `${folder}/thumbs`, 'jpg'); } catch { /* la photo suffit */ }
  }
  return { url, thumb: thumbUrl };
}

/** URL à afficher en miniature. */
export const thumbOf = (photo) => photo?.thumb || photo?.url;

// ——— Photos envoyées pendant la session (id de l'entrée en attente → entrées réelles) ———
export const PHOTOS_SYNCED_EVENT = 'droitfil:photos-synced';
const synced = new Map(); // localId -> { entry, activity }

export const rememberSyncedPhoto = (localId, rep) => synced.set(String(localId), rep);

/** Entrée réelle d'une photo « en attente » déjà envoyée, sinon l'entrée telle quelle. */
export const resolvePendingPhoto = (p) => {
  if (!p?.pending) return p;
  const rep = synced.get(String(p.id));
  if (!rep) return p;
  return p.type === 'image' ? (rep.activity || p) : (rep.entry || p);
};

/**
 * Lignes prêtes à être enregistrées : chaque entrée en attente est remplacée par sa
 * version envoyée si elle existe, sinon retirée (son envoi la rajoutera).
 */
export const cleanPendingPhotosForSave = (rows) => (rows || []).map((row) => {
  let out = row;
  for (const key of Object.keys(row || {})) {
    const v = row[key];
    if (!Array.isArray(v) || !v.some((p) => p?.pending)) continue;
    if (out === row) out = { ...row };
    out[key] = v.map(resolvePendingPhoto).filter((p) => !p?.pending);
  }
  return out;
});

/**
 * Place une photo envoyée dans les lignes : remplace l'entrée en attente (même id) ou
 * l'ajoute. Idempotent (rejouer ne crée pas de doublon).
 * rep = { rowId, fieldKey, localId, entry, activity }
 * @returns {{ rows: object[], found: boolean }}
 */
export function applyPhotoToRows(rows, rep) {
  let found = false;
  const id = String(rep.localId);
  const upsert = (list, item) => {
    const arr = Array.isArray(list) ? list : [];
    return arr.some((x) => String(x?.id) === id)
      ? arr.map((x) => (String(x?.id) === id ? item : x))
      : [...arr, item];
  };
  const out = (rows || []).map((row) => {
    if (String(row?.id) !== String(rep.rowId)) return row;
    found = true;
    if (rep.fieldKey === '__activity__') {
      return {
        ...row,
        comments: upsert(row.comments, rep.activity),
        ...(Array.isArray(row.photos_sur_site) ? { photos_sur_site: upsert(row.photos_sur_site, rep.entry) } : {}),
      };
    }
    return { ...row, [rep.fieldKey]: upsert(row[rep.fieldKey], rep.entry) };
  });
  return { rows: out, found };
}
