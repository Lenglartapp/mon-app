import { db } from './offlineDb';
import { supabase } from './supabaseClient';
import { updateStrippingPhantomColumns } from './schemaDrift';
import { isPermanentDbError, backoffDelay } from './dbErrors';
import { withRowLock } from './rowWriteLock';
import { mergeRows } from './rowsMerge';
import { getServerRows, saveServerRows } from './offlineProjects';
import { applyPhotoToRows, rememberSyncedPhoto, PHOTOS_SYNCED_EVENT } from './photos';
import { uploadBlobToStorage } from './utils/imageUpload';

/**
 * Enfile une mutation UPDATE pour envoi ultérieur.
 * @param {string} table  - Nom de la table Supabase (ex: 'projects')
 * @param {string} recordId - ID de l'enregistrement
 * @param {object} payload  - Payload snake_case prêt pour Supabase
 */
export const queueMutation = async (table, recordId, payload) => {
  try {
    // Une seule entrée active par (table, ligne) : on FUSIONNE avec l'entrée déjà en
    // file (les champs les plus récents gagnent). Sans ça, chaque sauvegarde échouée
    // empilait une copie complète de `rows`/`lines` (plusieurs Mo) dans IndexedDB.
    await db.transaction('rw', db.pending_mutations, async () => {
      const existing = await db.pending_mutations
        .where('record_id').equals(String(recordId))
        .filter(m => m.table === table && !m.dead)
        .sortBy('timestamp');
      const now = Date.now();
      const mergedPayload = Object.assign({}, ...existing.map(m => m.payload), payload);
      // Date de CHAQUE champ (et non de l'entrée) : une sauvegarde en direct réussie
      // ne périme que les champs plus anciens qu'elle (cf. supersedeQueuedMutations).
      const fieldTs = Object.assign({},
        ...existing.map(m => m.fieldTs || Object.fromEntries(Object.keys(m.payload || {}).map(k => [k, m.timestamp]))),
        Object.fromEntries(Object.keys(payload).map(k => [k, now])));
      if (existing.length > 0) await db.pending_mutations.bulkDelete(existing.map(m => m.id));
      await db.pending_mutations.add({
        table,
        record_id: String(recordId),
        payload: mergedPayload,
        fieldTs,
        timestamp: now,
      });
    });
    // Prévient useSyncQueue qu'un élément vient d'entrer en file (sinon il ne le
    // voyait qu'au prochain retour sur l'onglet / retour réseau).
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUEUE_EVENT));
  } catch (e) {
    console.warn('Impossible d\'enregistrer la mutation offline:', e);
  }
};

export const QUEUE_EVENT = 'droitfil:mutation-queued';

/**
 * Modifications encore EN FILE (non envoyées) pour ces lignes, fusionnées par id.
 * À superposer à ce qu'on lit de la base : sinon, si la page se charge avant la fin
 * de l'envoi, l'écran affiche l'ancienne version et la prochaine sauvegarde écrase
 * les modifications en attente (perte de données constatée en test).
 * @returns {Promise<Map<string, object>>} id -> payload (format base)
 */
export const getQueuedPayloads = async (table, ids = null) => {
  const out = new Map();
  try {
    const wanted = ids ? new Set(ids.map(String)) : null;
    const muts = (await db.pending_mutations.orderBy('timestamp').toArray())
      .filter(m => m.table === table && !m.dead && (!wanted || wanted.has(m.record_id)));
    for (const m of muts) out.set(m.record_id, { ...(out.get(m.record_id) || {}), ...m.payload });
  } catch { /* IndexedDB indisponible : rien à superposer */ }
  return out;
};

/** Nombre de mutations en attente (hors mutations mises de côté car refusées par la base). */
export const getPendingCount = async () => {
  const all = await db.pending_mutations.toArray();
  return all.filter(m => !m.dead).length;
};

/**
 * Une sauvegarde EN DIRECT vient de réussir pour (table, id) : les champs qu'elle a
 * écrits rendent PÉRIMÉES les mutations plus anciennes de la file. On les retire,
 * sinon un vieux `rows` rejoué plus tard écraserait la version plus récente.
 * Les champs NON couverts par la sauvegarde restent en file (aucune perte).
 */
export const supersedeQueuedMutations = async (table, recordId, writtenKeys, writtenAt) => {
  try {
    const keys = new Set(writtenKeys);
    const muts = await db.pending_mutations
      .where('record_id').equals(String(recordId))
      .filter(m => m.table === table && !m.dead)
      .toArray();
    for (const m of muts) {
      const tsOf = (k) => m.fieldTs?.[k] ?? m.timestamp;
      const isStale = (k) => keys.has(k) && tsOf(k) <= writtenAt;
      if (!Object.keys(m.payload || {}).some(isStale)) continue;
      const rest = Object.fromEntries(Object.entries(m.payload || {}).filter(([k]) => !isStale(k)));
      if (Object.keys(rest).length === 0) await db.pending_mutations.delete(m.id);
      else await db.pending_mutations.update(m.id, {
        payload: rest,
        fieldTs: Object.fromEntries(Object.keys(rest).map(k => [k, tsOf(k)])),
      });
    }
  } catch (e) {
    console.warn('[syncQueue] nettoyage des mutations périmées impossible :', e);
  }
};

/**
 * Fusion « à trois » des lignes d'un projet avant envoi (cf. lib/rowsMerge).
 * @returns {{ rows: object[]|null, error?: any }} rows null = pas de base fiable :
 *          on envoie la version locale telle quelle (comportement historique).
 */
const mergeWithServerRows = async (projectId, localRows) => {
  const base = await getServerRows(projectId);
  if (!base) return { rows: null };
  const { data, error } = await supabase.from('projects').select('rows').eq('id', projectId).single();
  if (error) return { rows: null, error };
  const merged = mergeRows(base, localRows, Array.isArray(data?.rows) ? data.rows : []);
  return { rows: merged };
};

// Reprise progressive par ligne (mémoire de l'onglet) : après un échec transitoire,
// on attend 5 s, 10 s, 20 s… (max 5 min) avant de réessayer. Évite de renvoyer des
// Mo de `rows` à chaque retour sur l'onglet pendant que la base est déjà saturée.
const retryState = new Map(); // key -> { failures, nextAt }

/**
 * Vide la file : fusionne les mutations par (table, record_id) et envoie à Supabase.
 * Retourne { synced, failed }.
 */
export const drainQueue = async () => {
  const mutations = (await db.pending_mutations.orderBy('timestamp').toArray()).filter(m => !m.dead);
  if (mutations.length === 0) return { synced: 0, failed: 0 };

  // Fusionner par (table, record_id) en ordre chronologique → last-write-wins
  const grouped = new Map();
  for (const mut of mutations) {
    const key = `${mut.table}::${mut.record_id}`;
    if (!grouped.has(key)) {
      grouped.set(key, { key, table: mut.table, record_id: mut.record_id, payload: {}, ids: [] });
    }
    const entry = grouped.get(key);
    Object.assign(entry.payload, mut.payload);
    entry.ids.push(mut.id);
  }

  let synced = 0;
  let failed = 0;

  for (const { key, table, record_id, ids } of grouped.values()) {
    const retry = retryState.get(key);
    if (retry && Date.now() < retry.nextAt) { failed++; continue; } // pas encore l'heure

    // Écriture sérialisée avec les sauvegardes en direct de la même ligne.
    // AUTO-RÉPARATION : si la base rejette une colonne inexistante (dérive de schéma,
    // ex. `pinned_ids` fusionnée dans le payload), on la retire et on rejoue — pour que
    // le reste (surtout `rows`) finisse par être écrit. Sans ça, une colonne fantôme
    // bloquait la mutation en boucle et emportait `rows` avec elle (perte de données).
    // Relecture DANS le verrou : une sauvegarde en direct a pu réussir entre-temps et
    // retirer des champs devenus périmés (supersedeQueuedMutations) — on n'envoie que
    // ce qui reste réellement en file, jamais une version plus ancienne que la base.
    const { error, dropped, skipped } = await withRowLock(table, record_id, async () => {
      const fresh = (await db.pending_mutations.bulkGet(ids)).filter(m => m && !m.dead);
      if (fresh.length === 0) return { error: null, dropped: [], skipped: true };
      const current = {};
      fresh.sort((x, y) => x.timestamp - y.timestamp).forEach(m => Object.assign(current, m.payload));
      if (Object.keys(current).length === 0) return { error: null, dropped: [], skipped: true };
      // PROJETS : on ne rejoue que ce que le téléphone a réellement modifié, fusionné
      // avec la version actuelle du serveur (le bureau a pu travailler entre-temps).
      if (table === 'projects' && Array.isArray(current.rows)) {
        const merged = await mergeWithServerRows(record_id, current.rows);
        if (merged.error) return { error: merged.error, dropped: [] };
        if (merged.rows) current.rows = merged.rows;
      }
      const res = await updateStrippingPhantomColumns(supabase, table, record_id, current);
      if (!res.error && table === 'projects' && Array.isArray(res.body.rows)) await saveServerRows(record_id, res.body.rows);
      return res;
    });
    if (skipped) { await db.pending_mutations.bulkDelete(ids); retryState.delete(key); continue; }
    if (dropped.length > 0) {
      console.warn(`[drainQueue] colonne(s) fantôme(s) retirée(s) [${table}/${record_id}] : ${dropped.join(', ')}`);
    }
    if (!error) {
      await db.pending_mutations.bulkDelete(ids);
      retryState.delete(key);
      synced++;
    } else if (isPermanentDbError(error)) {
      // Refus DÉFINITIF de la base (donnée invalide, contrainte…) : réessayer ne
      // changera rien. On NE SUPPRIME PAS (aucune perte : la mutation reste dans
      // IndexedDB, consultable) mais on la met de côté pour ne plus marteler la base.
      console.error(`Sync refusée définitivement [${table}/${record_id}] — mise de côté :`, error);
      await Promise.all(ids.map(id => db.pending_mutations.update(id, { dead: true, error: String(error.message || error.code || '') })));
      retryState.delete(key);
      failed++;
    } else {
      const failures = (retry?.failures || 0) + 1;
      retryState.set(key, { failures, nextAt: Date.now() + backoffDelay(failures) });
      console.error(`Sync échouée [${table}/${record_id}] (essai ${failures}) :`, error);
      failed++;
    }
  }

  return { synced, failed };
};

// ---------------------------------------------------------------------------
// PHOTOS OFFLINE
// ---------------------------------------------------------------------------

/** Convertit un blob en base64 data URL */
export const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

/** Convertit une base64 data URL en Blob */
const base64ToBlob = (dataUrl) => {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

/**
 * Enfile une photo pour upload ultérieur.
 * @param {string} projectId
 * @param {string} rowId
 * @param {string} fieldKey     - champ photo de la ligne, ou '__activity__' (photo en commentaire)
 * @param {string} localId      - ID déjà mis sur l'entrée « en attente » (gardé par l'entrée réelle)
 * @param {string} base64DataUrl
 * @param {object} photoMeta    - { user, timestamp, caption? }
 * @param {string} [thumbBase64] - vignette (facultative)
 */
export const queuePhoto = async (projectId, rowId, fieldKey, localId, base64DataUrl, photoMeta, thumbBase64 = null) => {
  try {
    await db.offline_photos.add({
      project_id: String(projectId),
      row_id: String(rowId),
      field_key: fieldKey,
      local_id: localId,
      base64: base64DataUrl,
      thumb64: thumbBase64,
      photo_meta: photoMeta,
      timestamp: Date.now(),
    });
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUEUE_EVENT));
  } catch (e) {
    console.warn('Impossible d\'enregistrer la photo offline:', e);
  }
};

/** Nombre de photos en attente (hors photos dont la ligne a disparu, gardées à part). */
export const getPendingPhotoCount = async () => (await db.offline_photos.toArray()).filter(p => !p.orphan).length;

const PHOTO_UPLOAD_CONCURRENCY = 3;
const extOfDataUrl = (d) => (/^data:image\/png/.test(d || '') ? 'png' : 'jpg');

/** Entrées réelles d'une photo envoyée (même id que l'entrée en attente). */
const photoEntries = (photo, url, thumb) => {
  const ts = photo.photo_meta?.timestamp || new Date().toISOString();
  const user = photo.photo_meta?.user || 'Utilisateur';
  const entry = { id: photo.local_id, url, ...(thumb ? { thumb } : {}), timestamp: ts, user };
  const activity = {
    id: photo.local_id, content: url, ...(thumb ? { thumb } : {}),
    caption: photo.photo_meta?.caption || null, type: 'image',
    createdAt: ts, date: new Date(ts).getTime(), author: user,
  };
  return { entry, activity };
};

/**
 * Envoie les photos en attente puis les range dans leurs lignes.
 *  1. Envoi des fichiers (3 à la fois). L'URL obtenue est notée sur la photo en file :
 *     une coupure en plein milieu ne crée jamais de doublon au prochain essai.
 *  2. UNE seule écriture par projet (verrouillée, sur la version actuelle du serveur)
 *     pour toutes ses photos, au lieu d'une réécriture complète par photo.
 *  3. Ligne supprimée entre-temps : la photo n'est PAS jetée, elle reste sur l'appareil
 *     (marquée « orpheline ») pour être récupérée.
 * Reprise progressive en cas d'échec (30 s → 30 min), mémorisée avec la photo.
 */
// Verrou module-level : évite deux drainPhotos simultanés dans le même onglet
let _drainPhotosRunning = false;

export const drainPhotos = async () => {
  if (_drainPhotosRunning) return { synced: 0, failed: 0 };
  _drainPhotosRunning = true;

  try {
    const now = Date.now();
    const photos = (await db.offline_photos.orderBy('timestamp').toArray())
      .filter(p => !p.orphan && !(p.next_at && p.next_at > now));
    if (photos.length === 0) return { synced: 0, failed: 0 };

    let failed = 0;
    const markFailure = async (photo, e) => {
      failed++;
      const failures = (photo.failures || 0) + 1;
      console.error('Photo sync échouée:', e);
      await db.offline_photos.update(photo.id, {
        failures, next_at: Date.now() + Math.min(30_000 * 2 ** (failures - 1), 30 * 60_000),
      }).catch(() => {});
    };

    // 1. Envoi des fichiers
    const queue = photos.filter(p => !p.uploaded_url);
    const worker = async () => {
      while (queue.length) {
        const photo = queue.shift();
        try {
          const folder = photo.field_key === '__activity__' ? 'activity' : 'minutes';
          const url = await uploadBlobToStorage(base64ToBlob(photo.base64), folder, extOfDataUrl(photo.base64));
          let thumb = null;
          if (photo.thumb64) {
            try { thumb = await uploadBlobToStorage(base64ToBlob(photo.thumb64), `${folder}/thumbs`, 'jpg'); } catch { /* sans vignette */ }
          }
          photo.uploaded_url = url;
          photo.uploaded_thumb = thumb;
          await db.offline_photos.update(photo.id, { uploaded_url: url, uploaded_thumb: thumb });
        } catch (e) { await markFailure(photo, e); }
      }
    };
    await Promise.all(Array.from({ length: PHOTO_UPLOAD_CONCURRENCY }, worker));

    // 2. Rangement dans les lignes : une écriture par projet
    const byProject = new Map();
    for (const p of photos) {
      if (!p.uploaded_url) continue;
      if (!byProject.has(p.project_id)) byProject.set(p.project_id, []);
      byProject.get(p.project_id).push(p);
    }

    let synced = 0;
    for (const [projectId, list] of byProject) {
      try {
        const reps = list.map(p => ({ photo: p, rep: { rowId: p.row_id, fieldKey: p.field_key, localId: p.local_id, ...photoEntries(p, p.uploaded_url, p.uploaded_thumb) } }));
        const result = await withRowLock('projects', projectId, async () => {
          const { data: project, error: fetchError } = await supabase
            .from('projects').select('rows').eq('id', projectId).single();
          if (fetchError) throw fetchError;
          let rows = project?.rows || [];
          const placed = [], orphans = [];
          for (const r of reps) {
            const res = applyPhotoToRows(rows, r.rep);
            if (res.found) { rows = res.rows; placed.push(r); } else orphans.push(r);
          }
          if (placed.length > 0) {
            const { error: updateError } = await supabase.from('projects').update({ rows }).eq('id', projectId);
            if (updateError) throw updateError;
          }
          return { placed, orphans };
        });

        for (const r of result.placed) {
          rememberSyncedPhoto(r.rep.localId, r.rep);
          await db.offline_photos.delete(r.photo.id);
          synced++;
        }
        for (const r of result.orphans) {
          console.warn('[drainPhotos] ligne introuvable, photo gardée sur l\'appareil :', r.rep);
          await db.offline_photos.update(r.photo.id, { orphan: true });
        }
        // Copie de l'appareil à jour (sinon un projet rouvert hors ligne montrerait encore
        // l'entrée en attente) + écrans ouverts prévenus.
        if (result.placed.length > 0) {
          try {
            const cached = await db.projects.get(projectId);
            if (cached && Array.isArray(cached.rows)) {
              let rows = cached.rows;
              for (const r of result.placed) rows = applyPhotoToRows(rows, r.rep).rows;
              await db.projects.update(projectId, { rows });
            }
          } catch { /* cache best effort */ }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(PHOTOS_SYNCED_EVENT, { detail: { projectId, reps: result.placed.map(r => r.rep) } }));
          }
        }
      } catch (e) {
        for (const p of list) await markFailure(p, e);
      }
    }

    return { synced, failed };
  } finally {
    _drainPhotosRunning = false;
  }
};
