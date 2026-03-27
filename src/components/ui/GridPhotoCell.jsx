import React, { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { COLORS } from '../../lib/constants/ui';
import ImageLightbox from './ImageLightbox';
import { useAuth } from '../../auth';
import { supabase } from '../../lib/supabaseClient';
import { blobToBase64, queuePhoto } from '../../lib/syncQueue';

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

    const rawArray = Array.isArray(value) ? value : (value ? [value] : []);
    const photos = rawArray.map(normalizePhoto);

    // Compression client avant upload (max 1600px, JPEG q=0.82)
    const compressImage = (file) => new Promise((resolve) => {
        const MAX_PX = 1600;
        const QUALITY = 0.82;
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let { width, height } = img;
            if (width > MAX_PX || height > MAX_PX) {
                if (width >= height) { height = Math.round(height * MAX_PX / width); width = MAX_PX; }
                else { width = Math.round(width * MAX_PX / height); height = MAX_PX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            canvas.toBlob(resolve, 'image/jpeg', QUALITY);
        };
        img.src = objectUrl;
    });

    // Upload vers Supabase Storage
    const uploadToSupabase = async (file) => {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        const filePath = `minutes/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('attachments')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('attachments')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const handleUpload = async (e) => {
        e.stopPropagation();
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const compressed = await compressImage(file);

            try {
                // Tentative d'upload en ligne
                const publicUrl = await uploadToSupabase(compressed);
                const newPhoto = {
                    url: publicUrl,
                    timestamp: new Date().toISOString(),
                    user: currentUser?.name || 'Utilisateur',
                    id: Date.now(),
                };
                if (onImageUpload) onImageUpload([...rawArray, newPhoto]);
            } catch {
                // Hors ligne : stocker en base64 + afficher en pending
                if (!offlineContext?.projectId || !offlineContext?.rowId || !offlineContext?.fieldKey) {
                    alert("Impossible d'ajouter une photo hors ligne ici. Reconnectez-vous et réessayez.");
                    return;
                }
                const base64 = await blobToBase64(compressed);
                const localId = `pending_${Date.now()}`;
                const photoMeta = {
                    timestamp: new Date().toISOString(),
                    user: currentUser?.name || 'Utilisateur',
                };
                await queuePhoto(
                    offlineContext.projectId,
                    offlineContext.rowId,
                    offlineContext.fieldKey,
                    localId,
                    base64,
                    photoMeta,
                );
                const pendingPhoto = {
                    url: base64,
                    id: localId,
                    pending: true,
                    timestamp: photoMeta.timestamp,
                    user: photoMeta.user,
                };
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
                        backgroundImage: `url(${photo.url})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer',
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
                    background: '#F9FAFB', color: '#6B7280',
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
