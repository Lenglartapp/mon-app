// src/components/EtiquettesSection.jsx
import React, { useState, useEffect } from "react";
import { Box, Button, Typography, GlobalStyles, Collapse, Pagination } from "@mui/material";
import { Print, FilterList, ViewColumn } from "@mui/icons-material";
import { useLocalStorage } from "../lib/hooks/useLocalStorage.js";
import FilterPanel from "./FilterPanel.jsx";
import EtiquetteCard from "./EtiquetteCard.jsx";
import ColumnSelectorMenu from "./ui/ColumnSelectorMenu.jsx";
import PrintableLabelsContainer from "./PrintableLabelsContainer.jsx";

// CONSTANTES
const PAGE_SIZE = 9;

export default function EtiquettesSection({
  title,
  tableKey,
  rows,
  schema,
  projectName
}) {
  // --- STATE PERSISTANT ---
  const keyFields = `prod.etq.fields.${tableKey}`;
  const keyFilters = `prod.etq.filters.${tableKey}`;
  const [fieldsLS, setFields] = useLocalStorage(keyFields, []);
  const [filters, setFilters] = useLocalStorage(keyFilters, []);

  // --- STATE UI ---
  const [showFilters, setShowFilters] = useState(false);
  const [anchorElPicker, setAnchorElPicker] = useState(null);
  const [page, setPage] = useState(1);
  const [showPrintPortal, setShowPrintPortal] = useState(false); // Portal State

  // --- CHAMPS VISIBLES (Just default logic) ---
  const fields = React.useMemo(() => {
    if (fieldsLS && fieldsLS.length > 0) return fieldsLS;
    return (schema || [])
      .filter(c => !['sel', 'detail', 'zone', 'piece', 'photo'].includes(c.key))
      .slice(0, 6)
      .map(c => c.key);
  }, [fieldsLS, schema]);

  const pickerCandidates = React.useMemo(() =>
    (schema || []).filter(c => !["sel", "detail", "photo", "button"].includes(c.key)),
    [schema]);

  // --- FILTRAGE ---
  const filteredRows = React.useMemo(() => {
    let res = rows || [];
    const selected = res.filter(r => r.sel);
    if (selected.length > 0) res = selected;

    if (filters.length > 0) {
      res = res.filter(r => {
        return filters.every(f => {
          const val = r[f.key];
          const sVal = String(val || "").toLowerCase();
          const fVal = String(f.value || "").toLowerCase();
          return sVal.includes(fVal);
        });
      });
    }
    return res;
  }, [rows, filters]);

  // --- PAGINATION (Ecran) ---
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const paginatedRows = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  useEffect(() => {
    setPage(1);
  }, [filters.length, rows.length]);

  // --- PRINT LIFECYCLE (PORTAL) ---
  const handlePrint = () => {
    setShowPrintPortal(true);
  };

  useEffect(() => {
    if (showPrintPortal) {
      const timer = setTimeout(() => {
        window.print();
        setShowPrintPortal(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showPrintPortal]);


  return (
    <Box sx={{ mb: 4 }}>
      {/* GLOBAL PRINT STYLES - DENSE GRID */}
      <GlobalStyles styles={{
        '#print-root': { display: 'none' },

        '@media print': {
          '@page': {
            size: 'A4',
            margin: 0
          },

          'body > *:not(#print-root)': { display: 'none !important' },

          '#print-root': {
            display: 'block !important',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '210mm',
            backgroundColor: 'white',
            zIndex: 99999,
          },

          '.print-page-a4': {
            width: '210mm',
            height: '297mm',
            pageBreakAfter: 'always',
            overflow: 'hidden',
            border: '1px solid transparent',
            boxSizing: 'border-box',
            padding: '10mm',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            gap: '10mm',
          },
          '.print-page-a4:last-child': {
            pageBreakAfter: 'auto'
          },

          // HALF PAGE Slot
          '.print-label-half': {
            height: '136mm',
            // border: '1px dotted #ccc',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column'
          },

          // CARD ITSELF (Grid wrapper)
          '.etq-card-print': {
            height: '100%',
            border: '1px solid #000',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            // Minimal padding inside outer border
            padding: '1px'
          },

          // HEADER (Compact)
          '.etq-header-print': {
            borderBottom: '1px solid #000',
            padding: '2px',
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '10pt',
            textTransform: 'uppercase',
            backgroundColor: '#eee'
          },

          // GRID LAYOUT (4 COLS)
          '.etq-print-grid': {
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            // No gap because we use borders on cells
            gap: '0',
            flex: 1,
            alignContent: 'start',
            // Ensure borders don't double up too much or look weird? 
            // We will use border-right/bottom on cells
            borderTop: '1px solid #ccc'
          },

          // CELL
          '.etq-print-cell': {
            borderRight: '1px solid #ccc',
            borderBottom: '1px solid #ccc',
            padding: '2px 3px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: '26px'
          },
          // Remove right border for 4th col?
          // '.etq-print-cell:nth-of-type(4n)': { borderRight: 'none' }, // simplistic

          // LABEL & VALUE
          '.etq-cell-label': {
            fontSize: '7pt',
            color: '#666',
            textTransform: 'uppercase',
            lineHeight: 1,
            marginBottom: '1px'
          },
          '.etq-cell-value': {
            fontSize: '8.5pt',
            color: '#000',
            fontWeight: 'bold',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          },

          // SPANS
          '.col-span-2': { gridColumn: 'span 2' },
          '.col-span-4': { gridColumn: 'span 4' },
        }
      }} />

      {/* VUE ECRAN */}
      <Box>
        {/* TOOLBAR */}
        <Box sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          mb: 2, p: 2, bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#374151', textTransform: 'uppercase', fontSize: 14 }}>
            {title} <span style={{ opacity: 0.5, marginLeft: 8 }}>({filteredRows.length})</span>
          </Typography>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<FilterList />}
              onClick={() => setShowFilters(!showFilters)}
              size="small"
              variant={showFilters ? "contained" : "outlined"}
            >
              Filtres
            </Button>
            <Button
              startIcon={<ViewColumn />}
              onClick={(e) => setAnchorElPicker(e.currentTarget)}
              size="small" variant="outlined"
            >
              Champs
            </Button>
            <Button
              startIcon={<Print />}
              onClick={handlePrint}
              disabled={showPrintPortal}
              size="small" variant="contained"
            >
              {showPrintPortal ? '...' : 'Imprimer'}
            </Button>
          </Box>
        </Box>

        <Collapse in={showFilters}>
          <Box sx={{ mb: 3 }}>
            <FilterPanel
              filters={filters} setFilters={setFilters}
              schema={schema} onClose={() => setShowFilters(false)}
              inline={true}
            />
          </Box>
        </Collapse>

        <ColumnSelectorMenu
          anchorEl={anchorElPicker}
          open={Boolean(anchorElPicker)}
          onClose={() => setAnchorElPicker(null)}
          allColumns={pickerCandidates}
          visibleColumns={fields}
          onChange={setFields}
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 3 }}>
          {paginatedRows.map(row => (
            <EtiquetteCard
              key={row.id}
              row={row} schema={schema} fields={fields} projectName={projectName}
              mode="screen"
            />
          ))}
        </Box>

        {filteredRows.length > PAGE_SIZE && (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              count={totalPages} page={page} onChange={(e, v) => setPage(v)}
              color="primary" showFirstButton showLastButton
            />
          </Box>
        )}

        {filteredRows.length === 0 && (
          <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            Aucune donnée.
          </Typography>
        )}
      </Box>

      {/* PORTAL FOR PRINTING */}
      {showPrintPortal && (
        <PrintableLabelsContainer
          rows={filteredRows}
          schema={schema}
          fields={fields}
          projectName={projectName}
        />
      )}
    </Box>
  );
}