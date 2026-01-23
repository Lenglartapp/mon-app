import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import BPFRideauCard from './BPFRideauCard';
import { GlobalStyles } from '@mui/material';

export default function BPFPrintPortal({ rows, project, onClose }) {

    // Filter for Rideaux/Voilages ONLY
    const rideauxRows = (rows || []).filter(r =>
        /rideau|voilage/i.test(r.produit || "") ||
        r.section === 'rideaux'
    );

    useEffect(() => {
        // Auto-trigger print
        const timer = setTimeout(() => {
            window.print();
            if (onClose) onClose();
        }, 500);
        return () => clearTimeout(timer);
    }, [onClose]);

    if (rideauxRows.length === 0) return null;

    return ReactDOM.createPortal(
        <div id="bpf-print-root">
            <GlobalStyles styles={{
                // Hide EVERYTHING else but respect proper print styles
                '@media print': {
                    'body > *:not(#bpf-print-root)': { display: 'none !important' },
                    '#bpf-print-root': {
                        display: 'block !important',
                        position: 'absolute', top: 0, left: 0, width: '100%'
                    },
                    '@page': {
                        size: 'A4 portrait',
                        margin: '5mm' // Small printer margin
                    }
                },
                // Hide this component on screen
                '#bpf-print-root': {
                    display: 'none'
                }
            }} />

            <div style={{
                width: '210mm', // A4 width
                margin: '0 auto',
                backgroundColor: 'white'
            }}>
                {rideauxRows.map((row, i) => (
                    <BPFRideauCard
                        key={row.id}
                        row={row}
                        project={project}
                        index={i}
                        total={rideauxRows.length}
                    />
                ))}
            </div>
        </div>,
        document.body
    );
}
