export function generateRowLogs(oldRow, newRow, schema, authorName = 'Système') {
    const logs = [];
    if (!oldRow || !newRow) return logs;

    Object.keys(newRow).forEach(key => {
        // Skip internal fields or arrays like comments/croquis logic validation
        if (key === 'comments' || key === 'croquis' || key === 'activity' || key.startsWith('__')) return;

        const oldVal = oldRow[key];
        const newVal = newRow[key];

        // Loose equality check (matches "10" and 10)
        if (oldVal != newVal) {
            // Ignore if both are effectively empty (null vs undefined vs "")
            if ((oldVal === null || oldVal === undefined || oldVal === "") &&
                (newVal === null || newVal === undefined || newVal === "")) {
                return;
            }

            // Find label from schema
            const colDef = schema ? schema.find(c => c.key === key) : null;
            const label = colDef ? (colDef.label || key) : key;

            logs.push({
                id: Date.now() + Math.random(),
                // Text fallback for legacy support or simple display
                text: `Modif ${label}`,
                field: label,
                from: formatVal(oldVal),
                to: formatVal(newVal),
                createdAt: new Date().toISOString(),
                type: 'log',
                author: authorName
            });
        }
    });

    return logs;
}

function formatVal(v) {
    if (v === null || v === undefined || v === '') return 'vide';
    return String(v);
}
