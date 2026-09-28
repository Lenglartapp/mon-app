import { db } from './offlineDb';
import { supabase } from './supabaseClient';
import { updateStrippingPhantomColumns } from './schemaDrift';
import { isPermanentDbError, backoffDelay } from './dbErrors';
import { withRowLock } from './rowWriteLock';

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
  } catch (e) {
    console.warn('Impossible d\'enregistrer la mutation offline:', e);
  }
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
      return updateStrippingPhantomColumns(supabase, table, record_id, current);
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
 * @param {string} fieldKey
 * @param {string} localId    - ID temporaire déjà mis dans le tableau de photos
 * @param {string} base64DataUrl
 * @param {object} photoMeta  - { user, timestamp }
 */
export const queuePhoto = async (projectId, rowId, fieldKey, localId, base64DataUrl, photoMeta) => {
  try {
    await db.offline_photos.add({
      project_id: String(projectId),
      row_id: String(rowId),
      field_key: fieldKey,
      local_id: localId,
      base64: base64DataUrl,
      photo_meta: photoMeta,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.warn('Impossible d\'enregistrer la photo offline:', e);
  }
};

/** Nombre de photos en attente */
export const getPendingPhotoCount = () => db.offline_photos.count();

/**
 * Upload toutes les photos en attente vers Supabase Storage,
 * puis patche les rows du projet avec les vraies URLs.
 */
// Verrou module-level : évite deux drainPhotos simultanés dans le même onglet
let _drainPhotosRunning = false;

export const drainPhotos = async () => {
  if (_drainPhotosRunning) return { synced: 0, failed: 0 };
  _drainPhotosRunning = true;

  try {
  const photos = await db.offline_photos.orderBy('timestamp').toArray();
  if (photos.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const photo of photos) {
    try {
      // 1. Upload vers Supabase Storage
      const blob = base64ToBlob(photo.base64);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const filePath = `minutes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, blob);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      // Lecture-modification-écriture VERROUILLÉE sur la ligne : aucune autre
      // sauvegarde de ce projet ne peut s'intercaler (sinon perte de la photo
      // ou écrasement des rows plus récents).
      await withRowLock('projects', photo.project_id, async () => {
        // 2. Récupérer les rows actuelles du projet depuis Supabase
        const { data: project, error: fetchError } = await supabase
          .from('projects')
          .select('rows')
          .eq('id', photo.project_id)
          .single();
        if (fetchError) throw fetchError;

        const realPhotoEntry = {
          url: publicUrl,
          id: Date.now(),
          timestamp: photo.photo_meta?.timestamp || new Date().toISOString(),
          user: photo.photo_meta?.user || 'Utilisateur',
        };

        let updatedRows;

        if (photo.field_key === '__activity__') {
          // Cas photo uploadée depuis la sidebar activité :
          // → remplacer l'entrée pending dans comments + ajouter à photos_sur_site si présent
          updatedRows = (project.rows || []).map(row => {
            if (String(row.id) !== String(photo.row_id)) return row;

            // Remplacer/ajouter dans comments (matching par localId)
            const existingComments = Array.isArray(row.comments) ? row.comments : [];
            const hasEntry = existingComments.some(c => c.id === photo.local_id);
            const realActivity = {
              id: Date.now(),
              content: publicUrl,
              caption: photo.photo_meta?.caption || null,
              type: 'image',
              createdAt: photo.photo_meta?.timestamp || new Date().toISOString(),
              date: new Date(photo.photo_meta?.timestamp || Date.now()).getTime(),
              author: photo.photo_meta?.user || 'Utilisateur',
            };
            const updatedComments = hasEntry
              ? existingComments.map(c => c.id === photo.local_id ? realActivity : c)
              : [...existingComments, realActivity];

            // Ajouter à photos_sur_site si ce champ existe dans la row
            const hasSurSite = Array.isArray(row.photos_sur_site);
            const updatedPhotosSurSite = hasSurSite
              ? [...row.photos_sur_site.filter(p => p?.id !== photo.local_id), realPhotoEntry]
              : row.photos_sur_site;

            return {
              ...row,
              comments: updatedComments,
              ...(hasSurSite && { photos_sur_site: updatedPhotosSurSite }),
            };
          });
        } else {
          // 3. Cas photo d'un champ schema (GridPhotoCell) : patcher uniquement le champ ciblé
          updatedRows = (project.rows || []).map(row => {
            if (String(row.id) !== String(photo.row_id)) return row;
            const existing = Array.isArray(row[photo.field_key]) ? row[photo.field_key] : [];
            const filtered = existing.filter(p => p?.id !== photo.local_id);
            return { ...row, [photo.field_key]: [...filtered, realPhotoEntry] };
          });
        }

        // 4. Mettre à jour le projet dans Supabase
        const { error: updateError } = await supabase
          .from('projects')
          .update({ rows: updatedRows })
          .eq('id', photo.project_id);
        if (updateError) throw updateError;
      });

      // 5. Nettoyer IndexedDB
      await db.offline_photos.delete(photo.id);
      synced++;
    } catch (e) {
      console.error('Photo sync échouée:', e);
      failed++;
    }
  }

  return { synced, failed };
  } finally {
    _drainPhotosRunning = false;
  }
};
