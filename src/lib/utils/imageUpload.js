import { supabase } from '../supabaseClient';

// Bucket unique pour toutes les pièces jointes (photos, croquis, mur, avatars…)
const BUCKET = 'attachments';

/**
 * Compresse une image (File ou Blob) via canvas et renvoie un Blob.
 * Redimensionne au plus grand côté = maxPx et ré-encode (JPEG par défaut).
 * @param {File|Blob} file
 * @param {{maxPx?: number, quality?: number, mime?: string}} [opts]
 * @returns {Promise<Blob>}
 */
export const compressImageToBlob = (file, { maxPx = 1600, quality = 0.82, mime = 'image/jpeg' } = {}) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Compression échouée'))), mime, quality);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image illisible')); };
    img.src = objectUrl;
  });

/**
 * Convertit une data URL (base64) en Blob.
 * @param {string} dataUrl
 * @returns {Blob}
 */
export const dataUrlToBlob = (dataUrl) => {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

/**
 * Upload un Blob dans le bucket Storage `attachments` et renvoie l'URL publique.
 * @param {Blob} blob
 * @param {string} folder  - sous-dossier (ex: 'minutes', 'activity', 'croquis', 'wall', 'avatars')
 * @param {string} [ext]   - extension sans point (défaut 'jpg')
 * @returns {Promise<string>} URL publique
 */
export const uploadBlobToStorage = async (blob, folder, ext = 'jpg') => {
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(fileName, blob);
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return publicUrl;
};

/**
 * Raccourci : compresse un File image (JPEG) puis l'upload dans Storage.
 * @param {File|Blob} file
 * @param {string} folder
 * @param {{maxPx?: number, quality?: number}} [opts]
 * @returns {Promise<string>} URL publique
 */
export const compressAndUpload = async (file, folder, opts = {}) => {
  const blob = await compressImageToBlob(file, opts);
  return uploadBlobToStorage(blob, folder, 'jpg');
};
