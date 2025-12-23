// src/components/MinuteEditor.jsx
import React from "react";
import { Grid, Box, Typography } from "@mui/material";

// composants internes
import MinuteGrid from "./MinuteGrid";
import CatalogManager from "./CatalogManager";

// constantes / helpers
import { computeFormulas } from "../lib/formulas/compute";
import { recomputeRow } from "../lib/formulas/recomputeRow";
import { COLORS, S } from "../lib/constants/ui";
import { uid } from "../lib/utils/uid";

// hooks app (si MinuteEditor les utilise ; sinon tu peux supprimer ces lignes)
import { useActivity } from "../contexts/activity";
import { useAuth } from "../auth.jsx";
import { Library } from 'lucide-react';

import { CHIFFRAGE_SCHEMA_DEP } from "../lib/schemas/deplacement";
import { EXTRA_DEPENSES_SCHEMA } from "../lib/schemas/extraDepenses";
import { RIDEAUX_DEFAULT_VISIBILITY, DECORS_DEFAULT_VISIBILITY, STORES_DEFAULT_VISIBILITY } from "../lib/constants/gridDefaults";
import { DECORS_SCHEMA } from "../lib/schemas/decors";
import { STORES_SCHEMA } from "../lib/schemas/stores";
import { parseRideauxImport } from '../utils/importRideaux';


const EMPTY_CTX = {};

// ================ MinuteEditor (tableau des lignes d'une minute) =================
// 1. MinuteEditor Signature Update
function MinuteEditor({ minute, onChangeMinute, enableCellFormulas = true, formulaCtx = EMPTY_CTX, schema = [], setSchema, targetRowId }) {
  // ... (keep existing code up to return)

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* ... (keep header) ... */}

      <>
        {/* --- NOUVEAUX TABLEAUX : Autres Dépenses & Déplacement (EN HAUT) --- */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* Tableau Autres Dépenses */}
          <div style={{ ...S.modernCard, padding: 0 }}>
            {/* ... header ... */}
            <div style={{ padding: 0 }}>
              <MinuteGrid
                rows={rowsAutre}
                onRowsChange={mergeChildRowsFor("autre")}
                schema={EXTRA_DEPENSES_SCHEMA}
                enableCellFormulas={enableCellFormulas}
                formulaCtx={extendedCtx}
                onAdd={React.useCallback(() => handleAddRow("autre"), [handleAddRow])}
                onDelete={() => handleDeleteRows(selAutre)}
                rowSelectionModel={selAutre}
                onRowSelectionModelChange={setSelAutre}
                catalog={catalog}
                onDuplicateRow={handleDuplicateRow}
                hideCroquis={true}
                minuteId={minute?.id}
                targetRowId={targetRowId}
              />
            </div>
          </div>

          {/* Tableau Déplacement */}
          <div style={{ ...S.modernCard, padding: 0 }}>
            {/* ... header ... */}
            <div style={{ padding: 0 }}>
              <MinuteGrid
                rows={rowsDeplacement}
                onRowsChange={mergeChildRowsFor("deplacement")}
                schema={CHIFFRAGE_SCHEMA_DEP}
                enableCellFormulas={enableCellFormulas}
                formulaCtx={extendedCtx}
                onAdd={React.useCallback(() => handleAddRow("deplacement"), [handleAddRow])}
                onDelete={() => handleDeleteRows(selDeplacement)}
                rowSelectionModel={selDeplacement}
                onRowSelectionModelChange={setSelDeplacement}
                catalog={catalog}
                onDuplicateRow={handleDuplicateRow}
                hideCroquis={true}
                minuteId={minute?.id}
                targetRowId={targetRowId}
              />
            </div>
          </div>
        </div>



        {mods.rideau && (
          <div style={{ ...S.modernCard, padding: 0, marginBottom: 24 }}>
            {/* ... header ... */}
            <MinuteGrid
              title="" // Title in custom header
              rows={rowsRideaux}
              onRowsChange={mergeChildRowsFor("rideaux")}
              schema={schema}
              enableCellFormulas={enableCellFormulas}
              formulaCtx={extendedCtx}
              onAdd={React.useCallback(() => handleAddRow("rideaux"), [handleAddRow])}
              onDelete={() => handleDeleteRows(selRideaux)}
              rowSelectionModel={selRideaux}
              onRowSelectionModelChange={setSelRideaux}
              catalog={catalog}
              railOptions={railOptions}
              initialVisibilityModel={RIDEAUX_DEFAULT_VISIBILITY}
              onImportExcel={handleImportExcel}
              onDuplicateRow={handleDuplicateRow}
              hideCroquis={true}
              minuteId={minute?.id}
              targetRowId={targetRowId}
            />
          </div>
        )}

        {mods.decor && (
          <div style={{ ...S.modernCard, padding: 0, marginBottom: 24 }}>
            {/* ... header ... */}
            <MinuteGrid
              title=""
              rows={rowsDecors}
              onRowsChange={mergeChildRowsFor("decors")}
              schema={DECORS_SCHEMA}
              enableCellFormulas={enableCellFormulas}
              formulaCtx={extendedCtx}
              onAdd={React.useCallback(() => handleAddRow("decors"), [handleAddRow])}
              onDelete={() => handleDeleteRows(selDecors)}
              rowSelectionModel={selDecors}
              onRowSelectionModelChange={setSelDecors}
              catalog={catalog}
              initialVisibilityModel={DECORS_DEFAULT_VISIBILITY}
              onDuplicateRow={handleDuplicateRow}
              hideCroquis={true}
              minuteId={minute?.id}
              targetRowId={targetRowId}
            />
          </div>
        )}

        {mods.store && (
          <div style={{ ...S.modernCard, padding: 0, marginBottom: 24 }}>
            {/* ... header ... */}
            <MinuteGrid
              title=""
              rows={rowsStores}
              onRowsChange={mergeChildRowsFor("stores")}
              schema={STORES_SCHEMA}
              enableCellFormulas={enableCellFormulas}
              formulaCtx={extendedCtx}
              onAdd={React.useCallback(() => handleAddRow("stores"), [handleAddRow])}
              onDelete={() => handleDeleteRows(selStores)}
              rowSelectionModel={selStores}
              onRowSelectionModelChange={setSelStores}
              catalog={catalog}
              initialVisibilityModel={STORES_DEFAULT_VISIBILITY}
              onDuplicateRow={handleDuplicateRow}
              hideCroquis={true}
              minuteId={minute?.id}
              targetRowId={targetRowId}
            />
          </div>
        )}
      </>

      <CatalogManager
        open={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        catalog={catalog}
        onCatalogChange={handleCatalogChange}
        settings={minute?.settings || { taux_horaire: 35, prix_nuit: 180, prix_repas: 25 }}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
}

export default MinuteEditor;
