import React, { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { COLORS } from '../../lib/constants/ui';
import ImageLightbox from './ImageLightbox'; // Import du nouveau composant

const normalizePhoto = (item) => {
    if (typeof item === 'string') {
        return { url: item, id: item, timestamp: null, user: null };
    }
    return item;
};

export default function GridPhotoCell({ value, onImageUpload, onCustomAdd }) {
    const fileInputRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    const rawArray = Array.isArray(value) ? value : (value ? [value] : []);
    const photos = rawArray.map(normalizePhoto);

    const handleUpload = (e) => {
        e.stopPropagation();
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const newPhoto = {
            url,
            timestamp: new Date().toISOString(),
            user: "Aristide LENGLART",
            id: Date.now()
        };
        if (onImageUpload) onImageUpload([...rawArray, newPhoto]);
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
                style={{
                    width: 30, height: 30, flexShrink: 0, borderRadius: 4,
                    border: `1px dashed ${COLORS.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', background: '#F9FAFB', color: '#6B7280'
                }}
            >
                <Plus size={14} />
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
