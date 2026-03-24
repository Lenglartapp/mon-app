import React from 'react';
import { Paper, Typography, Divider, Box } from '@mui/material';

export default React.memo(function DashboardSummary({ recap, nf, activeModules }) {
    // Default modules if undefined (safeguard)
    const mods = activeModules || { rideau: true, store: true, decor: true, autre_confection: true };

    // Items configuration for easier mapping
    const rawItems = [
        // 1. Production Categories (Dynamic)
        { label: "Rideaux", value: recap.caRideaux },
        { label: "Stores Négoce", value: recap.caStores },
        { label: "Stores Bateau", value: recap.caStoresBateau },
        { label: "Coussins", value: recap.caCoussins },
        { label: "Cache-Sommier", value: recap.caCacheSommier },
        { label: "Plaids", value: recap.caPlaid },
        { label: "Tenture", value: recap.caTenture },
        { label: "Mobilier", value: recap.caMobilier },
        { label: "Divers", value: recap.caDivers },

        // 2. Logistics & Extras
        { label: "Logistique", value: recap.depTotal, forceShow: true },
        { label: "Frais", value: recap.extrasTotal, color: "text.disabled", forceShow: true },

        // 3. Heures (Suffix 'h')
        { label: "H. Prépa", value: recap.hPrepa, suffix: "h", forceShow: true },
        { label: "H. Pose", value: recap.hPose, suffix: "h", forceShow: true },
        { label: "H. Conf", value: recap.hConf, suffix: "h", forceShow: true },
    ];

    // Show item if it has a value > 0 OR if it's explicitly forced (Logistics, Hours, etc.)
    const items = rawItems.filter(i => i.forceShow || (i.value && i.value > 0));

    return (
        <Paper
            elevation={2}
            sx={{
                p: 2,
                mb: 3, // Margin bottom to separate from content
                position: 'sticky',
                top: 0,
                zIndex: 100,
                backgroundColor: 'rgba(255, 255, 255, 0.95)', // Slight transparency for sticky effect
                backdropFilter: 'blur(8px)',
                borderBottom: '1px solid #e0e0e0'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {items.map((item, index) => (
                    <React.Fragment key={item.label}>
                        <div style={{ flex: 1, minWidth: 60, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
                                {item.label}
                            </Typography>
                            <Typography variant="h6" component="div" sx={{ fontWeight: 500, color: item.color || 'text.primary' }}>
                                {item.suffix
                                    ? `${Math.round(item.value || 0)} ${item.suffix}`
                                    : nf.format(item.value)}
                            </Typography>
                        </div>
                        {index < items.length - 1 && (
                            <Divider orientation="vertical" flexItem sx={{ height: 40, my: 'auto' }} />
                        )}
                    </React.Fragment>
                ))}

                <Divider orientation="vertical" flexItem sx={{ height: 50, mx: 2 }} />

                <div style={{ textAlign: 'right', paddingLeft: 8 }}>
                    <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                        CA TOTAL
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ fontWeight: 800, lineHeight: 1 }}>
                        {nf.format(recap.offreTotale)}
                    </Typography>
                </div>
            </div>
        </Paper>
    );
});
