import React, { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import { ChevronLeft, ChevronRight, User, Calendar, Trash2, X } from 'lucide-react';

export default function ImageLightbox({ open, onClose, images = [], initialIndex = 0, onRemove }) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    // Reset index on open
    useEffect(() => {
        if (open) setCurrentIndex(initialIndex);
    }, [open, initialIndex]);

    const currentPhoto = images[currentIndex];

    const handleNext = (e) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const handlePrev = (e) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    // Keyboard Navigation
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, images.length]);

    // Helper Date
    const formatDate = (isoString) => {
        if (!isoString) return "Date inconnue";
        try {
            return new Intl.DateTimeFormat('fr-FR', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            }).format(new Date(isoString));
        } catch (e) { return isoString; }
    };

    if (!currentPhoto) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xl"
            PaperProps={{
                style: { backgroundColor: 'transparent', boxShadow: 'none', overflow: 'visible' }
            }}
        >
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', outline: 'none' }}>

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
                {images.length > 1 && (
                    <>
                        <button
                            onClick={handlePrev}
                            style={{
                                position: 'absolute', left: -60, top: '50%', transform: 'translateY(-50%)',
                                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                                padding: 12, cursor: 'pointer', color: 'white', display: 'flex'
                            }}
                        >
                            <ChevronLeft size={32} />
                        </button>
                        <button
                            onClick={handleNext}
                            style={{
                                position: 'absolute', right: -60, top: '50%', transform: 'translateY(-50%)',
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
                            <span style={{ fontSize: 14 }}>{formatDate(currentPhoto.date || currentPhoto.timestamp)}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                        {onRemove && (
                            <button
                                onClick={() => {
                                    onRemove(currentPhoto.id);
                                    if (images.length <= 1) onClose();
                                }}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)',
                                    borderRadius: 6, padding: '6px 12px',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    cursor: 'pointer', color: '#fca5a5', fontWeight: 600, fontSize: 13
                                }}
                            >
                                <Trash2 size={14} /> Supprimer
                            </button>
                        )}
                        <button
                            onClick={onClose}
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
    );
}
