import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { COLORS } from '../../lib/constants/ui';
import ImageLightbox from './ImageLightbox';
import { useAuth } from '../../auth';
import { blobToBase64, queuePhoto } from '../../lib/syncQueue';
import { preparePhoto, uploadPhotoPair, thumbOf, resolvePendingPhoto, PHOTOS_SYNCED_EVENT } from '../../lib/photos';

const normalizePhoto = (item) => {
    if (typeof item === 'string') {
        return { url: item, id: item, timestamp: null, user: null };
    }
    return item;
};

export default function GridPhotoCell({ value, onImageUpload, onCustomAdd, offlineContext }) {
    const fileInputRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [uploading, setUploading] = useState(false);
    const { currentUser } = useAuth();

    // Une photo hors ligne vient de partir : on réaffiche (vraie photo au lieu de « en attente »).
    const [, refresh] = useReducer((n) => n + 1, 0);
    useEffect(() => {
        window.addEventListener(PHOTOS_SYNCED_EVENT, refresh);
        return () => window.removeEventListener(PHOTOS_SYNCED_EVENT, refresh);
    }, []);

    const rawArray = Array.isArray(value) ? value : (value ? [value] : []);
    const photos = rawArray.map(normalizePhoto).map(resolvePendingPhoto);

    const handleUpload = async (e) => {
        e.stopPropagation();
        const file = e.target.files?.[0];
        if (e.target) e.target.value = ''; // permet de reprendre la même photo
        if (!file) return;

        try {
            setUploading(true);
            // Photo nette (1600 px) + vignette légère pour l'affichage (cf. lib/photos).
            const prepared = await preparePhoto(file);
            const timestamp = new Date().toISOString();
            const user = currentUser?.name || 'Utilisateur';

            try {
                // Tentative d'upload en ligne
                const { url, thumb } = await uploadPhotoPair(prepared, 'minutes');
                const newPhoto = { url, ...(thumb ? { thumb } : {}), timestamp, user, id: Date.now() };
                if (onImageUpload) onImageUpload([...rawArray, newPhoto]);
            } catch {
                // Hors ligne : la photo attend sur l'appareil, envoi automatique au retour du réseau.
                if (!offlineContext?.projectId || !offlineContext?.rowId || !offlineContext?.fieldKey) {
                    alert("Impossible d'ajouter une photo hors ligne ici. Reconnectez-vous et réessayez.");
                    return;
                }
                const base64 = await blobToBase64(prepared.full);
                const thumb64 = prepared.thumb ? await blobToBase64(prepared.thumb) : null;
                const localId = `pending_${Date.now()}`;
                await queuePhoto(
                    offlineContext.projectId,
                    offlineContext.rowId,
                    offlineContext.fieldKey,
                    localId,
                    base64,
                    { timestamp, user },
                    thumb64,
                );
                const pendingPhoto = { url: base64, ...(thumb64 ? { thumb: thumb64 } : {}), id: localId, pending: true, timestamp, user };
                if (onImageUpload) onImageUpload([...rawArray, pendingPhoto]);
            }
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = (idToRemove) => {
        const newRawArray = rawArray.filter(item => {
            const norm = normalizePhoto(item);
            return norm.id !== idToRemove;
        });
        if (onImageUpload) onImageUpload(newRawArray);
    };

    const handleAddClick = (e) => {
        e.stopPropagation();
        if (onCustomAdd) { onCustomAdd(); return; }
        fileInputRef.current?.click();
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%', width: '100%', overflowX: 'auto' }}>
            {photos.map((photo, idx) => (
                <div
                    key={photo.id || idx}
                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); setIsOpen(true); }}
                    style={{
                        position: 'relative',
                        width: 30, height: 30, flexShrink: 0, borderRadius: 4,
                        border: `1px solid ${photo.pending ? '#f59e0b' : COLORS.border}`,
                        backgroundImage: `url(${thumbOf(photo)})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer',
                    }}
                >
                    {photo.pending && (
                        <div style={{
                            position: 'absolute', inset: 0, borderRadius: 3,
                            background: 'rgba(245,158,11,0.45)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12,
                        }} title="Photo en attente de synchronisation">⏳</div>
                    )}
                </div>
            ))}

            <button
                onClick={handleAddClick}
                disabled={uploading}
                style={{
                    width: 30, height: 30, flexShrink: 0, borderRadius: 4,
                    border: `1px dashed ${COLORS.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: uploading ? 'wait' : 'pointer',
                    background: '#F4F4F4', color: '#6B7280',
                    opacity: uploading ? 0.5 : 1,
                }}
            >
                {uploading ? (
                    <div style={{
                        width: 14, height: 14,
                        border: '2px solid #ccc', borderTopColor: '#333',
                        borderRadius: '50%', animation: 'spin 1s linear infinite',
                    }} />
                ) : (
                    <Plus size={14} />
                )}
            </button>

            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleUpload} onClick={(e) => e.stopPropagation()} />

            <ImageLightbox
                open={isOpen}
                onClose={() => setIsOpen(false)}
                images={photos}
                initialIndex={currentIndex}
                onRemove={handleRemove}
            />
        </div>
    );
}
