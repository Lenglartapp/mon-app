import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { COLORS } from '../../lib/constants/ui';
import ImageLightbox from './ImageLightbox';
import { useAuth } from '../../auth';
import { queuePhotoSafely } from '../../lib/syncQueue';
import { isServerReachable } from '../../lib/supabaseClient';
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

    // Hors ligne : la photo est mise en file sur l'appareil (lib/syncQueue.queuePhotoSafely)
    // et n'est affichée « en attente » qu'une fois l'enregistrement CONFIRMÉ.
    const addOffline = async (file, prepared, timestamp, user) => {
        if (!offlineContext?.projectId || !offlineContext?.rowId || !offlineContext?.fieldKey) {
            alert("Impossible d'ajouter une photo hors ligne ici. Reconnectez-vous et réessayez.");
            return;
        }
        try {
            const { localId, url, thumb } = await queuePhotoSafely({
                file, prepared,
                projectId: offlineContext.projectId,
                rowId: offlineContext.rowId,
                fieldKey: offlineContext.fieldKey,
                meta: { timestamp, user },
            });
            const pendingPhoto = { url, ...(thumb ? { thumb } : {}), id: localId, pending: true, timestamp, user };
            if (onImageUpload) onImageUpload([...rawArray, pendingPhoto]);
        } catch (err) {
            console.error('[photo] enregistrement hors ligne impossible :', err);
            alert("La photo n'a pas pu être enregistrée sur l'appareil (espace insuffisant ?). Réessayez.");
        }
    };

    const handleUpload = async (e) => {
        e.stopPropagation();
        const file = e.target.files?.[0];
        if (e.target) e.target.value = ''; // permet de reprendre la même photo
        if (!file) return;

        try {
            setUploading(true);
            const timestamp = new Date().toISOString();
            const user = currentUser?.name || 'Utilisateur';
            // Serveur connu injoignable : en file TOUT DE SUITE (fichier d'origine), avant la
            // compression — lente sur iPhone, une appli fermée entre-temps perdait la photo.
            if (!isServerReachable()) { await addOffline(file, null, timestamp, user); return; }

            // Photo nette (1600 px) + vignette légère pour l'affichage (cf. lib/photos).
            const prepared = await preparePhoto(file);
            try {
                const { url, thumb } = await uploadPhotoPair(prepared, 'minutes');
                const newPhoto = { url, ...(thumb ? { thumb } : {}), timestamp, user, id: Date.now() };
                if (onImageUpload) onImageUpload([...rawArray, newPhoto]);
            } catch {
                // Envoi impossible : la photo attend sur l'appareil, envoi automatique au retour du réseau.
                await addOffline(file, prepared, timestamp, user);
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
                    background: 'var(--df-surface)', color: 'var(--df-muted)',
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
