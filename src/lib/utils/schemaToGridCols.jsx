import React from 'react';
import FormulaEditCell from '../../components/FormulaEditCell';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';

/**
 * Maps a custom schema type to MUI Data Grid column type.
 */
const mapType = (type) => {
  switch (type) {
    case 'number':
    case 'formula': // Formulas result in numbers usually
      return 'number';
    case 'checkbox':
      return 'boolean';
    case 'select':
      return 'singleSelect';
    case 'date':
      return 'date';
    case 'datetime':
      return 'dateTime';
    default:
      return 'string';
  }
};

/**
 * Converts custom schema to MUI Data Grid columns.
 * @param {Array} schema - The custom schema array.
 * @param {boolean} enableCellFormulas - Whether cell formulas are enabled.
 * @returns {Array} - Array of GridColDef.
 */
export function schemaToGridCols(schema, enableCellFormulas = false, onOpenDetail) {
  if (!Array.isArray(schema)) return [];

  return schema.map((col) => {
    const isFormula = col.type === 'formula';
    const isReadOnly = !!col.readOnly;

    // Determine editability
    // Formulas are editable only if enableCellFormulas is true (for overrides)
    // ReadOnly columns are never editable (unless we decide overrides allow it, but usually readOnly means readOnly)
    let editable = !isReadOnly;
    if (isFormula && !enableCellFormulas) {
      editable = false;
    }

    const gridCol = {
      field: col.key,
      headerName: col.label || col.key,
      width: col.width || 100,
      editable: editable,
      type: mapType(col.type),
      description: col.formula ? `Formula: ${col.formula}` : undefined,
    };

    // Use Custom Edit Cell for formulas if enabled
    if (enableCellFormulas && (isFormula || col.type === 'number')) {
      gridCol.type = 'string'; // Force string to allow formula editing
      gridCol.align = 'right';
      gridCol.headerAlign = 'right';
      gridCol.sortComparator = (v1, v2) => {
        const n1 = Number(v1);
        const n2 = Number(v2);
        if (isNaN(n1)) return 1;
        if (isNaN(n2)) return -1;
        return n1 - n2;
      };
      gridCol.renderEditCell = (params) => (
        <FormulaEditCell {...params} defaultFormula={col.formula} schema={schema} />
      );
    }

    // Handle Select Options
    if (col.type === 'select' && Array.isArray(col.options)) {
      gridCol.valueOptions = col.options;
    }

    // Handle specific types that might need custom rendering or logic
    if (col.key === 'detail' || col.type === 'button') {
      gridCol.renderCell = (params) => {
        const commentCount = params.row.comments?.length || 0;

        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              height: '100%',
              cursor: 'pointer',
              // Expand to cover cell padding
              margin: '0 -10px',
              padding: '0 10px',
              minWidth: '100%'
            }}
            onClick={(e) => {
              e.stopPropagation();
              console.log('Detail container clicked', params.row.id);
              onOpenDetail && onOpenDetail(params.row);
            }}
          >
            <Tooltip title="Ouvrir le détail">
              <IconButton size="small" onClick={(e) => {
                e.stopPropagation();
                console.log('Detail icon clicked', params.row.id);
                onOpenDetail && onOpenDetail(params.row);
              }}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {commentCount > 0 && (
              <Tooltip title={`${commentCount} commentaire(s)`}>
                <div
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  <Badge badgeContent={commentCount} color="primary">
                    <ChatBubbleOutlineIcon fontSize="small" color="action" />
                  </Badge>
                </div>
              </Tooltip>
            )}
          </div>
        );
      };
      gridCol.sortable = false;
      gridCol.filterable = false;
      gridCol.editable = false;
    }

    return gridCol;
  });
}
