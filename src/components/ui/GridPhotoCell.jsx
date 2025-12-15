import React, { useRef, useState, useEffect } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, User, Calendar, X } from 'lucide-react';
import { COLORS } from '../../lib/constants/ui';
import Dialog from '@mui/material/Dialog';

// Helper to ensure we always work with objects
const normalizePhoto = (item) => {
    if (typeof item === 'string') {
        return {
            url: item,
            id: item, // Use URL as ID for legacy
            timestamp: null,
            user: null
        };
    }
    return item;
};

export default function GridPhotoCell({ value, rowId, api, field, onImageUpload, onCustomAdd }) {
    const fileInputRef = useRef(null);

    // Local state for Lightbox
    const [isOpen, setIsOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Parse raw value into normalized array
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
            user: "Aristide LENGLART", // Hardcoded for now per instructions
            id: Date.now()
        };

        // Append to existing RAW value (we must persist the structure)
        // If mixed (strings and objects), it's fine, the array tracks it.
        const newRawArray = [...rawArray, newPhoto];

        if (onImageUpload) {
            onImageUpload(newRawArray);
        }
    };

    const handleRemove = (idToRemove) => {
        const newRawArray = rawArray.filter(item => {
            const norm = normalizePhoto(item);
            return norm.id !== idToRemove;
        });

        if (onImageUpload) {
            onImageUpload(newRawArray);
        }

        if (newRawArray.length === 0) {
            setIsOpen(false);
        } else if (currentIndex >= newRawArray.length) {
            setCurrentIndex(newRawArray.length - 1);
        }
    };

    const handleAddClick = (e) => {
        e.stopPropagation();
        if (onImageUpload && typeof onImageUpload === 'function' && onImageUpload.length === 0) {
            // Special case: if onImageUpload doesn't take args, it might be a void trigger? No.
            // Let's rely on a separate prop `onCustomAdd` to be explicit.
        }

        // If a custom add handler is provided, use it (e.g., for SketchPad)
        if (onCustomAdd) {
            onCustomAdd();
            return;
        }

        fileInputRef.current?.click();
    };

    const openLightbox = (e, index) => {
        e.stopPropagation();
        setCurrentIndex(index);
        setIsOpen(true);
    };

    const handleNext = (e) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % photos.length);
    };

    const handlePrev = (e) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    };

    // Keyboard Navigation
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, photos.length]);

    const currentPhoto = photos[currentIndex];

    // Date Formatting
    const formatDate = (isoString) => {
        if (!isoString) return "Date inconnue";
        return new Intl.DateTimeFormat('fr-FR', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        }).format(new Date(isoString));
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%', width: '100%', overflowX: 'auto' }}>
            {/* Thumbnails */}
            {photos.map((photo, idx) => (
                <div
                    key={photo.id || idx}
                    onClick={(e) => openLightbox(e, idx)}
                    style={{
                        width: 30,
                        height: 30,
                        flexShrink: 0,
                        borderRadius: 4,
                        border: `1px solid ${COLORS.border}`,
                        backgroundImage: `url(${photo.url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        cursor: 'pointer'
                    }}
                />
            ))}

            {/* Add Button */}
            <button
                onClick={handleAddClick}
                style={{
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    borderRadius: 4,
                    border: `1px dashed ${COLORS.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', background: '#F9FAFB', color: '#6B7280'
                }}
                title="Ajouter une photo"
            >
                <Plus size={14} />
            </button>

            <input
                type="file" ref={fileInputRef} style={{ display: 'none' }}
                accept="image/*" onChange={handleUpload} onClick={(e) => e.stopPropagation()}
            />

            {/* Advanced Lightbox Modal */}
            {isOpen && currentPhoto && (
                <Dialog
                    open={isOpen}
                    onClose={() => setIsOpen(false)}
                    maxWidth="xl"
                    PaperProps={{
                        style: { backgroundColor: 'transparent', boxShadow: 'none', overflow: 'visible' }
                    }}
                >
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                        {/* Main Image */}
                        <img
                            src={currentPhoto.url}
                            alt="Detail"
                            style={{
                                maxWidth: '90vw', maxHeight: '80vh',
                                borderRadius: 8,
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                            }}
                        />

                        {/* Navigation Arrows */}
                        {photos.length > 1 && (
                            <>
                                <button
                                    onClick={handlePrev}
                                    style={{
                                        position: 'absolute', left: -50, top: '50%', transform: 'translateY(-50%)',
                                        background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                                        padding: 12, cursor: 'pointer', color: 'white', display: 'flex'
                                    }}
                                >
                                    <ChevronLeft size={32} />
                                </button>
                                <button
                                    onClick={handleNext}
                                    style={{
                                        position: 'absolute', right: -50, top: '50%', transform: 'translateY(-50%)',
                                        background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                                        padding: 12, cursor: 'pointer', color: 'white', display: 'flex'
                                    }}
                                >
                                    <ChevronRight size={32} />
                                </button>
                            </>
                        )}

                        {/* Metadata & Controls Bar */}
                        <div style={{
                            marginTop: 12, width: '100%', maxWidth: '90vw',
                            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                            borderRadius: 12, padding: '12px 20px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            color: 'white'
                        }}>
                            <div style={{ display: 'flex', gap: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9 }}>
                                    <User size={16} />
                                    <span style={{ fontSize: 14, fontWeight: 500 }}>{currentPhoto.user || 'Utilisateur inconnu'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9 }}>
                                    <Calendar size={16} />
                                    <span style={{ fontSize: 14 }}>{formatDate(currentPhoto.timestamp)}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12 }}>
                                <button
                                    onClick={() => handleRemove(currentPhoto.id)}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)',
                                        borderRadius: 6, padding: '6px 12px',
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        cursor: 'pointer', color: '#fca5a5', fontWeight: 600, fontSize: 13
                                    }}
                                >
                                    <Trash2 size={14} /> Supprimer
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: 6, padding: '6px 12px',
                                        cursor: 'pointer', color: 'white', fontWeight: 600, fontSize: 13
                                    }}
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>

                    </div>
                </Dialog>
            )}
        </div>
    );
}
