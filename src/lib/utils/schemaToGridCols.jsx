import React from 'react';
import FormulaEditCell from '../../components/FormulaEditCell';
import { GridEditInputCell } from '@mui/x-data-grid';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import Chip from '@mui/material/Chip';

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
export function schemaToGridCols(schema, enableCellFormulas = false, onOpenDetail, catalog = []) {
  if (!Array.isArray(schema)) return [];

  // Filter out 'sel' column and explicitly hidden columns
  const filteredSchema = schema.filter(col => col.key !== 'sel' && col.label !== 'Sel.' && !col.hidden);

  return filteredSchema.map((col) => {
    const isFormula = col.type === 'formula';
    const isReadOnly = !!col.readOnly;

    // Determine editability
    let editable = col.editable !== undefined ? col.editable : !isReadOnly;
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
      cellClassName: (params) => {
        if (col.editable && typeof col.editable === 'function' && !col.editable(params)) {
          return 'cell-read-only';
        }
        return '';
      }
    };

    if (col.key === 'commentaire') {
      gridCol.renderEditCell = (params) => <GridEditInputCell {...params} multiline />;
    }

    // Link Catalog to 'tissu', 'doublure', 'produit' columns (including variations like tissu_deco_1)
    const isCatalogColumn = col.key.includes('tissu') || col.key.includes('doublure') || (col.key === 'produit' && !col.hidden);
    if (isCatalogColumn && catalog.length > 0) {
      gridCol.type = 'singleSelect';
      gridCol.valueOptions = catalog.map(a => a.name);
      gridCol.editable = true;
    }

    // Handle standard singleSelect with valueOptions
    if ((col.type === 'singleSelect' || col.type === 'select') && Array.isArray(col.valueOptions || col.options)) {
      gridCol.type = 'singleSelect';
      gridCol.valueOptions = col.valueOptions || col.options;
    }

    // Currency Formatting (Force override)
    const isPrice = ['prix', 'montant', 'total', 'cout', 'pa', 'pv', 'transport'].some(term => col.key.toLowerCase().includes(term));
    // Remove type check to ensure coverage
    if (isPrice) {
      const formatter = (value) => {
        if (value === null || value === undefined || value === '') return '';
        const n = Number(value);
        if (isNaN(n)) return value; // Return original if not NaN? Or empty? User code said params.value. Let's return value to be safe or empty. User code: return params.value if isNaN.
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
      };

      gridCol.valueFormatter = (params) => {
        // Handle both MUI v5 (params.value) and v6 (value)
        const value = (params && typeof params === 'object' && 'value' in params) ? params.value : params;
        return formatter(value);
      };

      // Force renderCell
      gridCol.renderCell = (params) => formatter(params.value);
    }

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

    // Handle Select Options & Chips
    if (col.type === 'select' && Array.isArray(col.options)) {
      gridCol.valueOptions = col.options;
      gridCol.renderCell = (params) => {
        if (!params.value) return '';
        return (
          <Chip
            label={params.value}
            size="small"
            style={{ backgroundColor: stringToColor(params.value), color: '#000000' }}
          />
        );
      };
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

// Helper to generate pastel color from string
function stringToColor(string) {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  const hex = "00000".substring(0, 6 - c.length) + c;

  // Convert to RGB and mix with white for pastel
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const mix = (val) => Math.round((val + 255) / 2);

  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
