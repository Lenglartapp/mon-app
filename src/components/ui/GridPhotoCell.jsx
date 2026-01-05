import React, { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { COLORS } from '../../lib/constants/ui';
import ImageLightbox from './ImageLightbox'; // Import du nouveau composant
import { useAuth } from '../../auth'; // <--- Import

const normalizePhoto = (item) => {
    if (typeof item === 'string') {
        return { url: item, id: item, timestamp: null, user: null };
    }
    return item;
};

import { supabase } from '../../lib/supabaseClient'; // <--- Import Supabase

// ... imports remain the same

// Add style for spinner
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;
    document.head.appendChild(styleSheet);
}

export default function GridPhotoCell({ value, onImageUpload, onCustomAdd }) {
    const fileInputRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [uploading, setUploading] = useState(false); // <--- Loading State
    const { currentUser } = useAuth();

    const rawArray = Array.isArray(value) ? value : (value ? [value] : []);
    const photos = rawArray.map(normalizePhoto);

    // Fonction d'upload vers Supabase
    const uploadToSupabase = async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `minutes/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('attachments')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading image:', uploadError);
            throw uploadError;
        }

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
            const publicUrl = await uploadToSupabase(file);

            const newPhoto = {
                url: publicUrl,
                timestamp: new Date().toISOString(),
                user: currentUser?.name || "Utilisateur",
                id: Date.now()
            };
            if (onImageUpload) onImageUpload([...rawArray, newPhoto]);
        } catch (error) {
            alert("Erreur lors de l'upload de l'image.");
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
                        width: 30, height: 30, flexShrink: 0, borderRadius: 4,
                        border: `1px solid ${COLORS.border}`,
                        backgroundImage: `url(${photo.url})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer'
                    }}
                />
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
                    opacity: uploading ? 0.5 : 1
                }}
            >
                {uploading ? (
                    <div style={{
                        width: 14, height: 14,
                        border: '2px solid #ccc', borderTopColor: '#333',
                        borderRadius: '50%', animation: 'spin 1s linear infinite'
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
