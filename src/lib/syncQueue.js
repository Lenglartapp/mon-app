import { db } from './offlineDb';
import { supabase } from './supabaseClient';
import { updateStrippingPhantomColumns } from './schemaDrift';

/**
 * Enfile une mutation UPDATE pour envoi ultérieur.
 * @param {string} table  - Nom de la table Supabase (ex: 'projects')
 * @param {string} recordId - ID de l'enregistrement
 * @param {object} payload  - Payload snake_case prêt pour Supabase
 */
export const queueMutation = async (table, recordId, payload) => {
  try {
    await db.pending_mutations.add({
      table,
      record_id: String(recordId),
      payload,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.warn('Impossible d\'enregistrer la mutation offline:', e);
  }
};

/** Nombre de mutations en attente */
export const getPendingCount = () => db.pending_mutations.count();

/**
 * Vide la file : fusionne les mutations par (table, record_id) et envoie à Supabase.
 * Retourne { synced, failed }.
 */
export const drainQueue = async () => {
  const mutations = await db.pending_mutations.orderBy('timestamp').toArray();
  if (mutations.length === 0) return { synced: 0, failed: 0 };

  // Fusionner par (table, record_id) en ordre chronologique → last-write-wins
  const grouped = new Map();
  for (const mut of mutations) {
    const key = `${mut.table}::${mut.record_id}`;
    if (!grouped.has(key)) {
      grouped.set(key, { table: mut.table, record_id: mut.record_id, payload: {}, ids: [] });
    }
    const entry = grouped.get(key);
    Object.assign(entry.payload, mut.payload);
    entry.ids.push(mut.id);
  }

  let synced = 0;
  let failed = 0;

  for (const { table, record_id, payload, ids } of grouped.values()) {
    // AUTO-RÉPARATION : si la base rejette une colonne inexistante (dérive de schéma,
    // ex. `pinned_ids` fusionnée dans le payload), on la retire et on rejoue — pour que
    // le reste (surtout `rows`) finisse par être écrit. Sans ça, une colonne fantôme
    // bloquait la mutation en boucle et emportait `rows` avec elle (perte de données).
    const { error, dropped } = await updateStrippingPhantomColumns(supabase, table, record_id, payload);
    if (dropped.length > 0) {
      console.warn(`[drainQueue] colonne(s) fantôme(s) retirée(s) [${table}/${record_id}] : ${dropped.join(', ')}`);
    }
    if (!error) {
      await db.pending_mutations.bulkDelete(ids);
      synced++;
    } else {
      console.error(`Sync échouée [${table}/${record_id}]:`, error);
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
