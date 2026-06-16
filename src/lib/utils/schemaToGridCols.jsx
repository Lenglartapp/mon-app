import React, { useRef, useState } from 'react';
import FormulaEditCell from '../../components/FormulaEditCell';
import GridPhotoCell from '../../components/ui/GridPhotoCell';
import GridSketchCell from '../../components/ui/GridSketchCell';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import Chip from '@mui/material/Chip';
import { Type, Hash, Calendar, CheckSquare, Image as ImageIcon, PenTool, ChevronDown } from 'lucide-react';

// Formateur EUR créé une seule fois au niveau module (Intl.NumberFormat est coûteux à instancier)
const EUR_FORMATTER = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

// Cellule avec lien optionnel (Embout Méca, Support)
function LinkableCell({ value, linkValue, canEdit, rowId, linkField, onLinkUpdate }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const anchorRef = useRef(null);

  const handleOpen = (e) => {
    e.stopPropagation();
    setDraft(linkValue || '');
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const handleSave = () => {
    onLinkUpdate && onLinkUpdate(rowId, linkField, draft.trim());
    setOpen(false);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onLinkUpdate && onLinkUpdate(rowId, linkField, '');
    setOpen(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', height: '100%' }}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value || ''}
      </span>
      {linkValue && (
        <Tooltip title="Ouvrir la documentation" placement="top">
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); window.open(linkValue, '_blank', 'noopener,noreferrer'); }}
          >
            <OpenInNewIcon style={{ fontSize: 14, color: '#3B82F6' }} />
          </IconButton>
        </Tooltip>
      )}
      {canEdit && (
        <>
          <Tooltip title={linkValue ? "Modifier le lien" : "Ajouter un lien"} placement="top">
            <IconButton size="small" ref={anchorRef} onClick={handleOpen}>
              <LinkIcon style={{ fontSize: 14, color: linkValue ? '#10B981' : '#9CA3AF' }} />
            </IconButton>
          </Tooltip>
          <Popover
            open={open}
            anchorEl={anchorRef.current}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 340 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                {linkValue ? 'Modifier le lien de documentation' : 'Ajouter un lien de documentation'}
              </div>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleClose(); }}
                placeholder="https://... ou lien OneDrive"
                style={{
                  border: '1px solid #D1D5DB', borderRadius: 4, padding: '6px 8px',
                  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                {linkValue && (
                  <button
                    onClick={handleDelete}
                    style={{ fontSize: 12, color: '#EF4444', border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', marginRight: 'auto' }}
                  >
                    Supprimer
                  </button>
                )}
                <button
                  onClick={handleClose}
                  style={{ fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 4, background: 'white', cursor: 'pointer', padding: '4px 10px' }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  style={{ fontSize: 12, background: '#3B82F6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '4px 10px' }}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </Popover>
        </>
      )}
    </div>
  );
}


const getColumnIcon = (col) => {
  if (col.type === 'formula' || (col.readOnly && col.type === 'number'))
    return <span className="text-gray-400 font-serif italic text-[14px] leading-none pr-0.5" style={{ transform: 'translateY(1px)' }}>ƒx</span>;
  if (col.type === 'photo') return <ImageIcon size={14} className="text-gray-400" />;
  if (col.type === 'croquis') return <PenTool size={14} className="text-gray-400" />;
  if (col.type === 'date' || col.type === 'datetime') return <Calendar size={14} className="text-gray-400" />;
  if (col.type === 'checkbox') return <CheckSquare size={14} className="text-gray-400" />;
  if (col.type === 'select' || col.type === 'catalog_item' || col.options || col.key?.includes('tissu') || col.key?.includes('doublure') || (col.key?.includes('passementerie') && !col.key?.includes('app_')) || col.key?.includes('mecanisme')) {
    return <ChevronDown size={14} className="text-gray-400" strokeWidth={2.5} />;
  }
  if (col.type === 'number') return <Hash size={14} className="text-gray-400" />;
  return <Type size={14} className="text-gray-400" />;
};

// Composant Header AG Grid — affiche icône + label
function AgColumnHeader(props) {
  const { displayName, column } = props;
  const icon = column?.getColDef?.()?.context?._headerIcon;
  const tooltip = column?.getColDef?.()?.headerTooltip;

  const label = (
    <span style={{ fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingTop: '2px', fontSize: '13px', flex: 1 }}>
      {displayName}
    </span>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', overflow: 'hidden' }}>
      {icon && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, height: '14px' }}>
          {icon}
        </div>
      )}
      {tooltip ? (
        <Tooltip title={tooltip} placement="top" arrow enterDelay={300}>
          {label}
        </Tooltip>
      ) : label}
    </div>
  );
}

const chipFields = ['produit', 'type_confection', 'paire_ou_un_seul_pan', 'application_passementerie1', 'application_passementerie2', 'type_mecanisme', 'type_pose', 'type_interieur', 'style_confection'];

/**
 * Converts custom schema to AG Grid column definitions (ColDef[]).
 */
export function schemaToGridCols(
  schema,
  enableCellFormulas = false,
  onOpenDetail,
  catalog = [],
  railOptions = [],
  onPhotoChange,
  onDuplicate,
  hideCroquis = false,
  readOnly = false,
  gridTitle = '',
  projectId = null,
  onLinkUpdate = null,
  canEditLinks = false
) {
  if (!Array.isArray(schema)) return [];

  const filteredSchema = schema.filter(col => {
    if (col.key === 'sel' || col.label === 'Sel.' || col.hidden) return false;
    if (hideCroquis && col.type === 'croquis') return false;
    return true;
  });

  return filteredSchema.map((col) => {
    const isFormula = col.type === 'formula';

    // --- Editability ---
    let isCellEditableFn;
    if (typeof col.readOnly === 'function') {
      isCellEditableFn = (params) => !col.readOnly(params.data || {});
    } else if (col.editable !== undefined) {
      if (typeof col.editable === 'function') {
        isCellEditableFn = (params) => col.editable({ row: params.data || {} });
      } else {
        isCellEditableFn = () => !!col.editable;
      }
    } else {
      const isReadOnly = !!col.readOnly || readOnly;
      isCellEditableFn = () => !isReadOnly;
    }

    const headerName = col.headerName || col.label || col.key;
    const gridCol = {
      field: col.key,
      headerName,
      initialWidth: col.width || 120,
      resizable: true,
      sortable: true,
      editable: readOnly ? false : (params) => params.node?.rowPinned ? false : isCellEditableFn(params),
      // Header avec icône — stocké dans context (AG Grid v35 rejette les props custom directes)
      headerComponent: AgColumnHeader,
      context: { _headerIcon: getColumnIcon(col) },
      // Cell class pour read-only styling (pas de grisage sur la ligne de totaux)
      cellClass: (params) => {
        if (params.node?.rowPinned) return '';
        if (readOnly) return 'ag-cell-read-only';
        if (!isCellEditableFn(params)) return 'ag-cell-read-only';
        if (col.key === 'dim_mecanisme') {
          const type = params.data?.type_mecanisme || '';
          const isLocked = type === 'Rail' || type.includes('Store') || type === 'Canishade';
          if (isLocked) return 'ag-cell-read-only';
        }
        return '';
      },
    };

    // Tooltip on column header for formula/readOnly columns
    if (col.tooltip) {
      gridCol.headerTooltip = col.tooltip;
    }

    // valueFormatter (explicit override from schema)
    if (col.valueFormatter) {
      gridCol.valueFormatter = (params) => col.valueFormatter(params.value);
    }

    // valueGetter — ignoré sur la ligne de totaux (on utilise la valeur pré-calculée par computeAgg)
    if (col.valueGetter) {
      gridCol.valueGetter = (params) => {
        if (params.node?.rowPinned) return params.data?.[col.key];
        return col.valueGetter({ row: params.data || {} });
      };
    }

    // Numbers → right-aligned
    if (col.type === 'number' || col.type === 'formula') {
      gridCol.type = 'numericColumn';
      // Accepte virgule ET point comme séparateur décimal (usage français)
      gridCol.valueParser = (params) => {
        const str = String(params.newValue ?? '').trim().replace(',', '.');
        const n = parseFloat(str);
        return isNaN(n) ? params.newValue : n;
      };
    }

    // --- Catalog columns (dropdown) ---
    const isCatalogType = col.type === 'catalog_item';
    const isLegacyCatalogCol =
      col.key.includes('tissu') ||
      col.key.includes('doublure') ||
      (col.key.includes('passementerie') && !col.key.includes('app_')) ||
      (col.key === 'produit' && !col.hidden && col.type !== 'text');
    const isMechColumn = ['modele_mecanisme', 'nom_tringle', 'rail', 'mecanisme_bis'].includes(col.key);

    if ((isCatalogType || isLegacyCatalogCol || isMechColumn) && catalog.length > 0) {
      let filteredCatalog = catalog;

      if (isCatalogType && col.category) {
        const cats = col.category.split(',').map(c => c.trim().toLowerCase());
        filteredCatalog = catalog.filter(item => {
          if (!item.category) return false;
          return cats.includes(item.category.trim().toLowerCase());
        });
      } else {
        if (col.key.includes('tissu') || col.key.includes('doublure')) {
          filteredCatalog = catalog.filter(item => ['Tissu', 'Confection'].includes(item.category));
        } else if (col.key.includes('passementerie')) {
          filteredCatalog = catalog.filter(item => item.category === 'Passementerie');
        } else if (isMechColumn) {
          filteredCatalog = catalog.filter(item => item.category === 'Rail');
        }
      }

      gridCol.cellEditor = 'agSelectCellEditor';

      if (col.key === 'modele_mecanisme' || col.key === 'mecanisme_bis') {
        gridCol.cellEditorParams = (params) => {
          const typeMeca = params.data?.type_mecanisme;
          let subFiltered = filteredCatalog;
          if (typeMeca === 'Rail') {
            subFiltered = subFiltered.filter(a => !a.unit || a.unit === 'ml' || a.unit === 'pce');
          }
          return { values: ['', ...subFiltered.map(a => a.name)] };
        };
      } else {
        gridCol.cellEditorParams = { values: ['', ...filteredCatalog.map(a => a.name)] };
      }
    }

    // Standard singleSelect / select
    if ((col.type === 'singleSelect' || col.type === 'select') && Array.isArray(col.valueOptions || col.options)) {
      gridCol.cellEditor = 'agSelectCellEditor';
      if (col.optionsFn) {
        gridCol.cellEditorParams = (params) => ({ values: ['', ...col.optionsFn(params.data)] });
      } else {
        const rawOptions = col.valueOptions || col.options;
        gridCol.cellEditorParams = { values: ['', ...rawOptions] };
      }
    }

    // PHOTO CELL
    if (col.type === 'photo') {
      gridCol.cellRenderer = (params) => (
        <GridPhotoCell
          value={params.value}
          onImageUpload={(newVal) => onPhotoChange && onPhotoChange(params.data?.id, params.colDef?.field, newVal)}
          offlineContext={projectId ? { projectId, rowId: params.data?.id, fieldKey: params.colDef?.field } : undefined}
        />
      );
      gridCol.editable = false;
      gridCol.sortable = false;
    }

    // SKETCH CELL
    if (col.type === 'croquis') {
      gridCol.cellRenderer = (params) => (
        <GridSketchCell
          value={params.value}
          rowId={params.data?.id}
          field={params.colDef?.field}
          onSketchUpdate={(newVal) => onPhotoChange && onPhotoChange(params.data?.id, params.colDef?.field, newVal)}
        />
      );
      gridCol.editable = false;
      gridCol.sortable = false;
    }

    // --- Currency Formatting ---
    const isPriceTerm = ['prix', 'montant', 'total', 'cout', 'pa', 'pv', 'transport', 'livraison'].some(term => {
      const lowerKey = col.key.toLowerCase();
      if (term === 'pa' || term === 'pv') {
        return lowerKey === term || lowerKey.startsWith(term + '_') || lowerKey.endsWith('_' + term) || lowerKey.includes('_' + term + '_');
      }
      return lowerKey.includes(term);
    });
    const isRepas = col.key === 'nb_repas';
    const isHeuresPrepa = col.key === 'heures_prepa';
    const isML = col.key.startsWith('ml_');
    const isNb = col.key.startsWith('nb_');
    const isPaire = col.key.includes('paire');
    const isPrice = isPriceTerm && !isRepas && !isHeuresPrepa && !isML && !isNb && !isPaire;

    if (isPrice && !col.valueFormatter && !gridCol.valueFormatter) {
      gridCol.valueFormatter = (params) => {
        const value = params.value;
        if (value === null || value === undefined || value === '') return '';
        const n = Number(value);
        if (isNaN(n)) return String(value);
        return EUR_FORMATTER.format(n);
      };
    }

    // Affichage : limite à 2 décimales max (sans forcer de zéros inutiles).
    // Display-only — n'altère pas la valeur réelle stockée/utilisée dans les calculs.
    if ((col.type === 'number' || col.type === 'formula') && !col.valueFormatter && !gridCol.valueFormatter) {
      gridCol.valueFormatter = (params) => {
        const value = params.value;
        if (value === null || value === undefined || value === '') return '';
        const n = Number(value);
        if (isNaN(n)) return String(value);
        return String(Math.round(n * 100) / 100);
      };
    }

    // --- Éditeur numérique (test diagnostic : agTextCellEditor natif AG Grid) ---
    // FormulaEditCell remplacé temporairement pour isoler le bug d'édition.
    // getValue() de FormulaEditCell n'était jamais appelé par AG Grid v35.
    if (enableCellFormulas && (isFormula || col.type === 'number')) {
      gridCol.type = undefined;
      gridCol.cellEditor = 'agTextCellEditor';
      gridCol.comparator = (a, b) => {
        const n1 = Number(a), n2 = Number(b);
        if (isNaN(n1)) return 1;
        if (isNaN(n2)) return -1;
        return n1 - n2;
      };
    }

    // --- Chip renderer (select fields) ---
    if (
      ((col.type === 'select' || col.type === 'singleSelect') && Array.isArray(col.options || col.valueOptions)) ||
      chipFields.includes(col.key)
    ) {
      if (!gridCol.cellRenderer) {
        gridCol.cellRenderer = (params) => {
          if (params.node?.rowPinned) return null;
          if (!params.value) return '';
          return (
            <Chip
              label={params.value}
              size="small"
              style={{
                backgroundColor: getThemedColor(params.value, col.key, gridTitle),
                color: '#1F2937',
                fontWeight: 600,
                fontSize: '0.75rem',
                border: '1px solid rgba(0,0,0,0.05)',
              }}
            />
          );
        };
      }
    }

    // --- Linkable text cell (withLink: true) ---
    if (col.withLink) {
      const linkField = col.key + '_link';
      gridCol.cellRenderer = (params) => {
        if (params.node?.rowPinned) return params.value || '';
        return (
          <LinkableCell
            value={params.value}
            linkValue={params.data?.[linkField]}
            canEdit={canEditLinks}
            rowId={params.data?.id}
            linkField={linkField}
            onLinkUpdate={onLinkUpdate}
          />
        );
      };
      gridCol.editable = readOnly ? false : (params) => params.node?.rowPinned ? false : isCellEditableFn(params);
    }

    // --- Detail / Button column ---
    if (col.key === 'detail' || col.type === 'button') {
      gridCol.cellRenderer = (params) => {
        if (params.node?.rowPinned) return null;
        const comments = params.data?.comments || [];
        const commentCount = comments.filter(c => c.type !== 'log').length;
        return (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: '100%', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onOpenDetail && onOpenDetail(params.data); }}
          >
            {onDuplicate && (
              <Tooltip title="Dupliquer">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDuplicate(params.data?.id); }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Ouvrir le détail">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onOpenDetail && onOpenDetail(params.data); }}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {commentCount > 0 && (
              <Tooltip title={`${commentCount} commentaire(s)`}>
                <Badge badgeContent={commentCount} color="primary">
                  <ChatBubbleOutlineIcon fontSize="small" color="action" />
                </Badge>
              </Tooltip>
            )}
          </div>
        );
      };
      gridCol.sortable = false;
      gridCol.editable = false;
    }

    return gridCol;
  });
}

// Cache pour getThemedColor — même value+colKey+gridTitle → même couleur, calculée une seule fois
const _colorCache = new Map();

function getThemedColor(value, colKey, gridTitle) {
  const cacheKey = `${value}|${colKey}|${gridTitle}`;
  if (_colorCache.has(cacheKey)) return _colorCache.get(cacheKey);
  const strValue = String(value || '');
  const title = String(gridTitle || '').toLowerCase();

  let baseHue = 0;
  if (title.includes('rideau') || title.includes('voilage')) {
    baseHue = 150;
  } else if (title.includes('store')) {
    baseHue = 210;
  } else if (title.includes('coussin') || title.includes('plaid')) {
    baseHue = 35;
  } else if (title.includes('tête de lit') || title.includes('mobilier') || title.includes('tenture')) {
    baseHue = 270;
  } else if (title.includes('déplacement') || title.includes('dépense') || title.includes('autre')) {
    baseHue = 0;
  } else {
    baseHue = Array.from(title).reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
  }

  if (baseHue < 20 || baseHue > 340) baseHue = 220;

  const colHash = Array.from(colKey).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hueVariation = (colHash % 60) - 30;
  let finalHue = (baseHue + hueVariation) % 360;
  if (finalHue < 0) finalHue += 360;

  const valHash = Array.from(strValue).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const saturation = 40 + (valHash % 40);
  const lightness = 85 + (valHash % 10);

  if (strValue === '-' || strValue.toLowerCase() === 'aucun' || strValue.toLowerCase() === 'non') {
    const neutral = `hsl(0, 0%, 95%)`;
    _colorCache.set(cacheKey, neutral);
    return neutral;
  }

  const result = `hsl(${finalHue}, ${saturation}%, ${lightness}%)`;
  _colorCache.set(cacheKey, result);
  return result;
}
