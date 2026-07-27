import React, { useState } from 'react';
import GridPhotoCell from './GridPhotoCell';
import SketchPadModal from './SketchPadModal';
import { dataUrlToBlob, uploadBlobToStorage } from '../../lib/utils/imageUpload';

export default function GridSketchCell({ value, rowId, field, onSketchUpdate }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSaveSketch = async (dataUrl) => {
        // Upload du croquis (PNG) vers Storage ; repli base64 inline si hors ligne / échec
        let url = dataUrl;
        try {
            url = await uploadBlobToStorage(dataUrlToBlob(dataUrl), 'croquis', 'png');
        } catch (e) {
            console.warn('Upload croquis échoué, conservation en base64 :', e);
        }

        const newSketch = {
            id: Date.now(),
            url,
            timestamp: new Date().toISOString(),
            user: "Aristide LENGLART"
        };

        // Value is array of sketches
        const currentSketches = Array.isArray(value) ? value : [];
        const nextSketches = [...currentSketches, newSketch];

        if (onSketchUpdate) {
            onSketchUpdate(nextSketches);
        }
    };

    // We pass 'onImageUpload' to handle REMOVAL from GridPhotoCell
    const handleListUpdate = (newList) => {
        if (onSketchUpdate) {
            onSketchUpdate(newList);
        }
    };

    return (
        <>
            <GridPhotoCell
                value={value}
                rowId={rowId}
                field={field}
                onImageUpload={handleListUpdate} // Handles deletion via generic logic
                onCustomAdd={() => setIsModalOpen(true)} // Overrides generic file input
            />
            {isModalOpen && (
                <SketchPadModal
                    open={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveSketch}
                />
            )}
        </>
    );
}
