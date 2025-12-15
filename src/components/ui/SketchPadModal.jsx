import React, { useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import ReactCanvasDraw from 'react-canvas-draw';
import { Undo, Trash2, Save, X, Pencil, Eraser } from 'lucide-react';

export default function SketchPadModal({ open, onClose, onSave }) {
    const canvasRef = useRef(null);
    const [brushColor, setBrushColor] = useState('#000000');
    const [brushRadius, setBrushRadius] = useState(2);
    const [eraseMode, setEraseMode] = useState(false);

    const handleClear = () => {
        canvasRef.current?.clear();
    };

    const handleUndo = () => {
        canvasRef.current?.undo();
    };

    const handleSave = () => {
        if (canvasRef.current) {
            // Get data URL (Base64 PNG)
            const dataUrl = canvasRef.current.getDataURL();
            onSave(dataUrl);
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    height: '80vh',
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
        >
            <DialogTitle sx={{
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontWeight: 700
            }}>
                Nouveau Croquis
                <IconButton onClick={onClose}><X /></IconButton>
            </DialogTitle>

            <DialogContent sx={{ flex: 1, p: 0, bgcolor: '#F3F4F6', position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <ReactCanvasDraw
                        ref={canvasRef}
                        brushColor={eraseMode ? '#FFFFFF' : brushColor}
                        brushRadius={eraseMode ? 10 : brushRadius}
                        lazyRadius={1}
                        canvasWidth={1000}
                        canvasHeight={800} // Fixed large size, overflow hidden handled by container
                        gridColor="rgba(0,0,0,0.05)"
                        style={{ boxShadow: '0 4px 6px rgba(0,0,0,0.1)', background: 'white' }}
                    />
                </div>

                {/* FLOATING TOOLS PANEL */}
                <Box sx={{
                    position: 'absolute',
                    top: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bgcolor: 'white',
                    p: 1.5,
                    borderRadius: 3,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                }}>
                    <IconButton
                        onClick={() => setEraseMode(false)}
                        color={!eraseMode ? 'primary' : 'default'}
                        sx={{ bgcolor: !eraseMode ? '#EFF6FF' : 'transparent' }}
                    >
                        <Pencil size={20} />
                    </IconButton>
                    <IconButton
                        onClick={() => setEraseMode(true)}
                        color={eraseMode ? 'error' : 'default'}
                        sx={{ bgcolor: eraseMode ? '#FEF2F2' : 'transparent' }}
                    >
                        <Eraser size={20} />
                    </IconButton>

                    <Box sx={{ width: 1, height: 24, bgcolor: '#E5E7EB', mx: 1 }} />

                    <Box sx={{ width: 100 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Épaisseur</Typography>
                        <Slider
                            size="small"
                            value={brushRadius}
                            min={1}
                            max={10}
                            onChange={(e, v) => setBrushRadius(v)}
                        />
                    </Box>

                    <Box sx={{ width: 1, height: 24, bgcolor: '#E5E7EB', mx: 1 }} />

                    <IconButton onClick={handleUndo} title="Annuler">
                        <Undo size={20} />
                    </IconButton>
                    <IconButton onClick={handleClear} title="Tout effacer" color="error">
                        <Trash2 size={20} />
                    </IconButton>
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid #E5E7EB', justifyContent: 'space-between' }}>
                <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Annuler</Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    startIcon={<Save />}
                    sx={{ fontWeight: 700, px: 3 }}
                >
                    Enregistrer le Croquis
                </Button>
            </DialogActions>
        </Dialog>
    );
}
