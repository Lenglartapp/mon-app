import React from 'react';
import ReactDOM from 'react-dom';
import EtiquetteCard from './EtiquetteCard.jsx';

// Helper Chunk
const chunk = (arr, size) => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
    );
};

export default function PrintableLabelsContainer({ rows, schema, fields, projectName }) {
    if (!rows || rows.length === 0) return null;

    const pairs = chunk(rows, 2);

    return ReactDOM.createPortal(
        <div id="print-root">
            {pairs.map((pair, i) => (
                <div key={i} className="print-page-a4">
                    {/* Label 1 (Top) */}
                    <div className="print-label-half">
                        <EtiquetteCard
                            row={pair[0]}
                            schema={schema}
                            fields={fields}
                            projectName={projectName}
                            mode="print"
                        />
                    </div>
                    {/* Label 2 (Bottom) */}
                    {pair[1] && (
                        <div className="print-label-half">
                            <EtiquetteCard
                                row={pair[1]}
                                schema={schema}
                                fields={fields}
                                projectName={projectName}
                                mode="print"
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>,
        document.body
    );
}
