// src/components/ui/GridTotalsFooter.jsx
// -----------------------------------------------------------------------------
// Pied de tableau MUI DataGrid avec une ligne « Total » alignée sur les colonnes (la version
// gratuite du DataGrid n'a pas d'agrégation). Vide par défaut : double-clic sur une case
// pour choisir le calcul (somme, moyenne, nombre…). Les totaux portent sur TOUTES les lignes
// affichées (recherche et filtres compris), pas seulement la page visible.
//
// Utilisation : <DataGrid slots={{ footer: GridTotalsFooter }}
//   slotProps={{ footer: { totals, onTotalsChange, columnsConfig } }} />
//   - totals         : { [field]: 'sum' | 'avg' | … } (choix courants)
//   - columnsConfig  : { [field]: { numeric?, unitField?, getValue?, disabled? } }
// -----------------------------------------------------------------------------
import React, { useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import {
  GridFooter, useGridApiContext, useGridSelector, useGridApiEventHandler,
  gridVisibleColumnDefinitionsSelector, gridFilteredSortedRowEntriesSelector,
} from '@mui/x-data-grid';
import { NUMERIC_TOTALS, TEXT_TOTALS, computeTotal, totalLabel } from '../../lib/gridTotals';

export default function GridTotalsFooter({ totals = {}, onTotalsChange, columnsConfig = {} }) {
  const apiRef = useGridApiContext();
  const columns = useGridSelector(apiRef, gridVisibleColumnDefinitionsSelector);
  const entries = useGridSelector(apiRef, gridFilteredSortedRowEntriesSelector);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [menu, setMenu] = useState(null); // { anchor, field, numeric }
  useGridApiEventHandler(apiRef, 'scrollPositionChange', (p) => setScrollLeft(p.left));

  const valueOf = (row, col) => {
    const cfg = columnsConfig[col.field];
    if (cfg?.getValue) return cfg.getValue(row);
    try { return apiRef.current.getRowValue(row, col); } catch { return row[col.field]; }
  };

  return (
    <>
      <div className="df-grid-totals" style={{ flexShrink: 0, overflow: 'hidden', borderTop: '1px solid var(--df-border)', background: 'var(--df-surface)' }}>
        <div style={{ display: 'flex', transform: `translateX(${-scrollLeft}px)` }}>
          {columns.map((col) => {
            const cfg = columnsConfig[col.field] || {};
            const disabled = cfg.disabled || col.field.startsWith('_') || col.field === '__check__';
            const kind = totals[col.field];
            const value = kind ? computeTotal(kind, entries.map(({ model }) => ({
              value: valueOf(model, col), unit: cfg.unitField ? model[cfg.unitField] : undefined,
            })), { numeric: !!cfg.numeric }) : '';
            const right = col.align === 'right';
            return (
              <div
                key={col.field}
                onDoubleClick={disabled ? undefined : (e) => setMenu({ anchor: e.currentTarget, field: col.field, numeric: !!cfg.numeric })}
                title={disabled ? undefined : (kind ? `${totalLabel(kind)} — double-clic pour changer` : 'Double-clic : choisir un calcul')}
                style={{
                  width: col.computedWidth, minWidth: col.computedWidth, flexShrink: 0, boxSizing: 'border-box', height: 38,
                  padding: '0 10px', display: 'flex', alignItems: 'center', gap: 6,
                  justifyContent: right ? 'flex-end' : 'flex-start',
                  cursor: disabled ? 'default' : 'pointer', userSelect: 'none', overflow: 'hidden', whiteSpace: 'nowrap',
                  fontFamily: 'Roboto, system-ui, sans-serif', fontVariantNumeric: 'tabular-nums',
                }}
              >
                {kind && (
                  <>
                    <span style={{ fontSize: 11, color: 'var(--df-muted)' }}>{totalLabel(kind)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--df-text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <GridFooter />
      <Menu
        anchorEl={menu?.anchor || null}
        open={!!menu}
        onClose={() => setMenu(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { fontFamily: 'Roboto, system-ui, sans-serif' } } }}
      >
        {menu && [{ key: '', label: 'Aucun' }, ...(menu.numeric ? NUMERIC_TOTALS : TEXT_TOTALS)].map((t) => (
          <MenuItem
            key={t.key || 'none'}
            dense
            selected={(totals[menu.field] || '') === t.key}
            onClick={() => {
              const next = { ...totals };
              if (t.key) next[menu.field] = t.key; else delete next[menu.field];
              onTotalsChange?.(next);
              setMenu(null);
            }}
            sx={{ fontSize: 13, color: t.key ? 'var(--df-text)' : 'var(--df-muted)' }}
          >
            {t.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
