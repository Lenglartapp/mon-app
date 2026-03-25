// src/components/EtiquettesSection.jsx
import React, { useState, useEffect } from "react";
import { Box, Button, Typography, GlobalStyles, Collapse, Pagination } from "@mui/material";
import { Print, FilterList, ViewColumn } from "@mui/icons-material";
import { useLocalStorage } from "../lib/hooks/useLocalStorage.js";
import FilterPanel from "./FilterPanel.jsx";
import EtiquetteCard from "./EtiquetteCard.jsx";
import EtiquetteRideauxCard, { ETIQUETTE_RIDEAUX_FIELDS } from "./EtiquetteRideauxCard.jsx";
import EtiquetteStoresBateauxCard, { ETIQUETTE_STORES_BATEAUX_FIELDS } from "./EtiquetteStoresBateauxCard.jsx";
import ColumnSelectorMenu from "./ui/ColumnSelectorMenu.jsx";
import PrintableLabelsContainer from "./PrintableLabelsContainer.jsx";
import BPFPrintPortal from "./print/BPFPrintPortal.jsx";
import EtiquettesRideauxPrintPortal from "./EtiquettesRideauxPrintPortal.jsx";
import EtiquettesStoresBateauxPrintPortal from "./EtiquettesStoresBateauxPrintPortal.jsx";

// CONSTANTES
const PAGE_SIZE = 9;

// Clé unique pour un ouvrage
const ouvrageKey = (r) => `${r.zone || ""}||${r.piece || ""}`;

// ─── Panneau de sélection par ouvrage ────────────────────────────────────────
function OuvrageSelectionPanel({ rows, selected, onChange }) {
  const [search, setSearch] = React.useState("");

  // Grouper par zone, trié
  const byZone = React.useMemo(() => {
    const map = {};
    (rows || []).forEach(r => {
      const z = r.zone || "(sans zone)";
      if (!map[z]) map[z] = [];
      const key = ouvrageKey(r);
      if (!map[z].find(i => i.key === key)) {
        map[z].push({ key, piece: r.piece || "(sans pièce)", zone: z });
      }
    });
    // Trier zones et pièces
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([zone, items]) => ({
        zone,
        items: items.sort((a, b) => a.piece.localeCompare(b.piece)),
      }));
  }, [rows]);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return byZone;
    const q = search.toLowerCase();
    return byZone
      .map(g => ({
        ...g,
        items: g.items.filter(i =>
          i.zone.toLowerCase().includes(q) || i.piece.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.items.length > 0);
  }, [byZone, search]);

  const toggle = (key) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(next);
  };

  const toggleZone = (items) => {
    const keys = items.map(i => i.key);
    const allSelected = keys.every(k => selected.has(k));
    const next = new Set(selected);
    if (allSelected) keys.forEach(k => next.delete(k));
    else keys.forEach(k => next.add(k));
    onChange(next);
  };

  const totalItems = byZone.reduce((s, g) => s + g.items.length, 0);

  return (
    <Box sx={{
      mb: 3, bgcolor: "white", borderRadius: 2,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      border: "1px solid #E5E7EB",
      overflow: "hidden",
    }}>
      {/* Header */}
      <Box sx={{
        p: "10px 14px", borderBottom: "1px solid #F3F4F6",
        display: "flex", alignItems: "center", gap: 1.5,
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une zone ou pièce…"
          style={{
            flex: 1, fontSize: 12, padding: "5px 10px",
            border: "1px solid #E5E7EB", borderRadius: 6,
            outline: "none", fontFamily: "inherit",
          }}
        />
        <button
          onClick={() => onChange(new Set(rows.map(ouvrageKey)))}
          style={{ fontSize: 11, color: "#4B5563", background: "none", border: "1px solid #E5E7EB", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
        >
          Tout
        </button>
        <button
          onClick={() => onChange(new Set())}
          style={{ fontSize: 11, color: "#4B5563", background: "none", border: "1px solid #E5E7EB", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
        >
          Aucun
        </button>
        {selected.size > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#92742A", background: "#FEF3C7", borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap" }}>
            {selected.size}/{totalItems} sélectionné{selected.size > 1 ? "s" : ""}
          </span>
        )}
      </Box>

      {/* Liste groupée */}
      <Box sx={{ maxHeight: 280, overflowY: "auto", p: "6px 0" }}>
        {filtered.map(({ zone, items }) => {
          const allChecked = items.every(i => selected.has(i.key));
          const someChecked = items.some(i => selected.has(i.key));
          return (
            <Box key={zone}>
              {/* Titre zone */}
              <Box
                onClick={() => toggleZone(items)}
                sx={{
                  display: "flex", alignItems: "center", gap: 1,
                  px: 2, py: "4px",
                  cursor: "pointer",
                  bgcolor: "#F9FAFB",
                  borderTop: "1px solid #F3F4F6",
                  "&:hover": { bgcolor: "#F3F4F6" },
                }}
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                  style={{ cursor: "pointer", accentColor: "#1F2937" }}
                />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#374151" }}>
                  {zone}
                </span>
                <span style={{ fontSize: 10, color: "#9CA3AF", marginLeft: "auto" }}>
                  {items.filter(i => selected.has(i.key)).length}/{items.length}
                </span>
              </Box>

              {/* Pièces */}
              {items.map(item => (
                <Box
                  key={item.key}
                  onClick={() => toggle(item.key)}
                  sx={{
                    display: "flex", alignItems: "center", gap: 1.5,
                    px: 3, py: "3px", cursor: "pointer",
                    "&:hover": { bgcolor: "#F9FAFB" },
                  }}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={selected.has(item.key)}
                    style={{ cursor: "pointer", accentColor: "#1F2937" }}
                  />
                  <span style={{ fontSize: 12, color: selected.has(item.key) ? "#111827" : "#6B7280", fontWeight: selected.has(item.key) ? 600 : 400 }}>
                    {item.piece}
                  </span>
                </Box>
              ))}
            </Box>
          );
        })}
        {filtered.length === 0 && (
          <Box sx={{ py: 3, textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>
            Aucun résultat
          </Box>
        )}
      </Box>
    </Box>
  );
}

function BulkCustomizePanel({ fields, initialHidden, count, onApply, onClose }) {
  const [draft, setDraft] = React.useState([...initialHidden]);

  const sections = React.useMemo(() => [...new Set(fields.map(f => f.section))], [fields]);

  const toggle = (key) =>
    setDraft(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const toggleSection = (section) => {
    const keys = fields.filter(f => f.section === section).map(f => f.key);
    const allHidden = keys.every(k => draft.includes(k));
    setDraft(prev => allHidden
      ? prev.filter(k => !keys.includes(k))
      : [...new Set([...prev, ...keys])]
    );
  };

  const hiddenCount = draft.length;

  return (
    <Box sx={{
      mb: 3, p: 2.5,
      bgcolor: "white", borderRadius: 2,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      border: "1px solid #E5E7EB",
    }}>
      {/* Header panel */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Box sx={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
            Champs affichés sur les étiquettes
          </Box>
          <Box sx={{ fontSize: 11, color: "#6B7280", mt: 0.3 }}>
            Appliqué sur les <strong>{count}</strong> étiquette{count > 1 ? "s" : ""} visibles
            {hiddenCount > 0 && (
              <span style={{ marginLeft: 8, color: "#92742A", fontWeight: 600 }}>
                — {hiddenCount} champ{hiddenCount > 1 ? "s" : ""} masqué{hiddenCount > 1 ? "s" : ""}
              </span>
            )}
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <button
            onClick={() => setDraft([])}
            style={{
              fontSize: 11, color: "#6B7280", background: "none",
              border: "1px solid #E5E7EB", borderRadius: 6,
              padding: "5px 12px", cursor: "pointer",
            }}
          >
            Tout afficher
          </button>
          <button
            onClick={() => onApply(draft)}
            style={{
              fontSize: 12, fontWeight: 700, color: "white",
              background: "#1F2937", border: "none",
              borderRadius: 6, padding: "5px 16px", cursor: "pointer",
            }}
          >
            Appliquer
          </button>
        </Box>
      </Box>

      {/* Champs par section */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {sections.map(section => {
          const sectionFields = fields.filter(f => f.section === section);
          const hiddenInSection = sectionFields.filter(f => draft.includes(f.key)).length;
          return (
            <Box key={section}>
              <Box
                onClick={() => toggleSection(section)}
                sx={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase", color: "#6B7280",
                  mb: 0.8, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 1,
                  "&:hover": { color: "#374151" },
                }}
              >
                {section}
                {hiddenInSection > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: "#92742A",
                    background: "#FEF3C7", borderRadius: 3, padding: "1px 5px",
                  }}>
                    {hiddenInSection} masqué{hiddenInSection > 1 ? "s" : ""}
                  </span>
                )}
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
                {sectionFields.map(f => {
                  const hidden = draft.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      onClick={() => toggle(f.key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "4px 10px",
                        border: `1px solid ${hidden ? "#FECACA" : "#D1FAE5"}`,
                        borderRadius: 6,
                        background: hidden ? "#FEF2F2" : "#F0FDF4",
                        cursor: "pointer",
                        fontSize: 11, fontWeight: 600,
                        color: hidden ? "#9CA3AF" : "#111827",
                        textDecoration: hidden ? "line-through" : "none",
                        transition: "all 0.1s",
                      }}
                    >
                      <span style={{ fontSize: 12 }}>{hidden ? "🚫" : "👁"}</span>
                      {f.label}
                    </button>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default function EtiquettesSection({
  title,
  tableKey,
  rows,
  schema,
  projectName,
  onEditRow,
  onRowsChange,
}) {
  const isRideaux = tableKey === "rideaux";
  const isStoresBateaux = tableKey === "stores_bateaux";

  const handleRowChange = React.useCallback((updatedRow) => {
    if (!onRowsChange) return;
    onRowsChange((rows || []).map(r => r.id === updatedRow.id ? updatedRow : r));
  }, [rows, onRowsChange]);
  // --- STATE PERSISTANT ---
  const keyFields = `prod.etq.fields.${tableKey}`;
  const keyFilters = `prod.etq.filters.${tableKey}`;
  const [fieldsLS, setFields] = useLocalStorage(keyFields, []);
  const [filters, setFilters] = useLocalStorage(keyFilters, []);

  // --- STATE UI ---
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkCustomize, setShowBulkCustomize] = useState(false);
  const [showSelection, setShowSelection] = useState(false);
  const [selectedOuvrages, setSelectedOuvrages] = useState(new Set());
  const [anchorElPicker, setAnchorElPicker] = useState(null);
  const [page, setPage] = useState(1);
  const [showPrintPortal, setShowPrintPortal] = useState(false);
  const [showBPFPortal, setShowBPFPortal] = useState(false);

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
    const sel = res.filter(r => r.sel);
    if (sel.length > 0) res = sel;

    if (filters.length > 0) {
      res = res.filter(r =>
        filters.every(f => {
          const val = r[f.key];
          const sVal = String(val || "").toLowerCase();
          const fVal = String(f.value || "").toLowerCase();
          return sVal.includes(fVal);
        })
      );
    }

    // Filtre sélection par ouvrage (zone + pièce)
    if (selectedOuvrages.size > 0) {
      res = res.filter(r => selectedOuvrages.has(ouvrageKey(r)));
    }

    return res;
  }, [rows, filters, selectedOuvrages]);

  // Champs masqués en commun sur les étiquettes filtrées (pour init du panel bulk)
  const etqFields = isRideaux ? ETIQUETTE_RIDEAUX_FIELDS : isStoresBateaux ? ETIQUETTE_STORES_BATEAUX_FIELDS : [];
  const bulkCommonHidden = React.useMemo(() => {
    if ((!isRideaux && !isStoresBateaux) || filteredRows.length === 0) return [];
    const allKeys = etqFields.map(f => f.key);
    return allKeys.filter(k =>
      filteredRows.every(r => (r.etiquette_hidden_fields || []).includes(k))
    );
  }, [isRideaux, isStoresBateaux, filteredRows, etqFields]);

  const handleBulkApply = React.useCallback((hiddenFields) => {
    if (!onRowsChange) return;
    const updated = (rows || []).map(r => {
      if (!filteredRows.find(fr => fr.id === r.id)) return r;
      return { ...r, etiquette_hidden_fields: hiddenFields };
    });
    onRowsChange(updated);
    setShowBulkCustomize(false);
  }, [rows, filteredRows, onRowsChange]);

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
    if (isRideaux || isStoresBateaux) {
      setShowBPFPortal(true);
    } else {
      setShowPrintPortal(true);
    }
  };

  useEffect(() => {
    if (showPrintPortal || showBPFPortal) {
      const timer = setTimeout(() => {
        // window.print(); // Portals handle print themselves now
        // Actually EtiquettesSection's PrintableLabelsContainer likely relies on parent global styles 
        // OR EtiquettesSection's effect was triggering print.
        // Let's keep existing logic for showPrintPortal ONLY, BPF handles itself.
        if (showPrintPortal) {
          window.print();
          setShowPrintPortal(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showPrintPortal, showBPFPortal]);


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

          'body > *:not(#print-root):not(#bpf-print-root):not(#etq-rideaux-print-root):not(#etq-stores-bateaux-print-root)': { display: 'none !important' },

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
            {(isRideaux || isStoresBateaux) && (
              <Button
                onClick={() => setShowSelection(v => !v)}
                size="small"
                variant={showSelection ? "contained" : "outlined"}
                sx={selectedOuvrages.size > 0 ? { borderColor: "#92742A", color: showSelection ? "white" : "#92742A" } : {}}
              >
                Sélection
                {selectedOuvrages.size > 0 && (
                  <span style={{
                    marginLeft: 6, fontSize: 10, fontWeight: 700,
                    background: showSelection ? "rgba(255,255,255,0.3)" : "#92742A",
                    color: "white", borderRadius: 10, padding: "1px 6px",
                  }}>
                    {selectedOuvrages.size}
                  </span>
                )}
              </Button>
            )}
            <Button
              startIcon={<ViewColumn />}
              onClick={(isRideaux || isStoresBateaux)
                ? () => setShowBulkCustomize(v => !v)
                : (e) => setAnchorElPicker(e.currentTarget)
              }
              size="small"
              variant={showBulkCustomize ? "contained" : "outlined"}
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

        {/* SÉLECTION PAR OUVRAGE */}
        {(isRideaux || isStoresBateaux) && (
          <Collapse in={showSelection}>
            <OuvrageSelectionPanel
              rows={rows}
              selected={selectedOuvrages}
              onChange={setSelectedOuvrages}
            />
          </Collapse>
        )}

        {/* BULK CUSTOMIZE */}
        {(isRideaux || isStoresBateaux) && (
          <Collapse in={showBulkCustomize}>
            <BulkCustomizePanel
              fields={etqFields}
              initialHidden={bulkCommonHidden}
              count={filteredRows.length}
              onApply={handleBulkApply}
              onClose={() => setShowBulkCustomize(false)}
            />
          </Collapse>
        )}

        <ColumnSelectorMenu
          anchorEl={anchorElPicker}
          open={Boolean(anchorElPicker)}
          onClose={() => setAnchorElPicker(null)}
          allColumns={pickerCandidates}
          visibleColumns={fields}
          onChange={setFields}
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: (isRideaux || isStoresBateaux) ? '1fr' : 'repeat(auto-fill, minmax(400px, 1fr))', gap: 3 }}>
          {paginatedRows.map((row, i) => (
            isRideaux ? (
              <EtiquetteRideauxCard
                key={row.id}
                row={row}
                projectName={projectName}
                index={(page - 1) * PAGE_SIZE + i}
                total={filteredRows.length}
                onEdit={onEditRow}
                onRowChange={handleRowChange}
              />
            ) : isStoresBateaux ? (
              <EtiquetteStoresBateauxCard
                key={row.id}
                row={row}
                projectName={projectName}
                index={(page - 1) * PAGE_SIZE + i}
                total={filteredRows.length}
                onEdit={onEditRow}
                onRowChange={handleRowChange}
              />
            ) : (
              <EtiquetteCard
                key={row.id}
                row={row} schema={schema} fields={fields} projectName={projectName}
                mode="screen"
              />
            )
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

      {/* PORTAL IMPRESSION ÉTIQUETTES RIDEAUX */}
      {showBPFPortal && isRideaux && (
        <EtiquettesRideauxPrintPortal
          rows={filteredRows}
          projectName={projectName}
          onClose={() => setShowBPFPortal(false)}
        />
      )}

      {/* PORTAL IMPRESSION ÉTIQUETTES STORES BATEAUX */}
      {showBPFPortal && isStoresBateaux && (
        <EtiquettesStoresBateauxPrintPortal
          rows={filteredRows}
          projectName={projectName}
          onClose={() => setShowBPFPortal(false)}
        />
      )}

      {/* PORTAL BPF (autres produits) */}
      {showBPFPortal && !isRideaux && !isStoresBateaux && (
        <BPFPrintPortal
          rows={filteredRows}
          project={{ name: projectName }}
          onClose={() => setShowBPFPortal(false)}
        />
      )}
    </Box>
  );
}