import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";



function getTokenRange(str = "", caret = 0) {
  let a = caret - 1;
  let b = caret;
  while (a >= 0 && TOKEN_RX.test(str[a])) a--;
  while (b < str.length && TOKEN_RX.test(str[b])) b++;
  return { start: a + 1, end: b };
}

function replaceToken(str, caret, withText) {
  const { start, end } = getTokenRange(str, caret);
  const out = str.slice(0, start) + withText + str.slice(end);
  const newCaret = start + withText.length;
  return { out, caret: newCaret };
}

// Si tu as déjà un normalizeOptions ailleurs, importe-le à la place.
// Cette version accepte ["A","B"] ou [{label, value}] et uniformise.
function normalizeOptions(opts) {
  if (!Array.isArray(opts)) return [];
  return opts.map((o) =>
    typeof o === "object" && o !== null
      ? { label: String(o.label ?? o.value ?? ""), value: o.value ?? o.label ?? "" }
      : { label: String(o), value: o }
  );
}

const EMPTY_CTX = {};

function InputCell({
  row,
  col,
  isEditing,
  onStartEdit,
  onEndEdit,
  onChange,
  onOpenLightbox, // (images[], startIndex)
  onEnter,        // (shift:boolean)
  liveRecalc = false,
  formulaCtx = EMPTY_CTX,
  fxSessionActive = false,
  fxForceDraft = null,
  fxPendingToken = null,
  onFxConsumeToken,
  onFxStop,
}) {
  const key = col?.key;
  const type = col?.type || "text";

  void formulaCtx;

  // 🔓 NEW: autorise l’édition des colonnes "formula" (pour taper =...)
  // même si le schéma met readOnly: true.
  // 🔓 NEW: autorise l’édition des colonnes "formula" (pour taper =...)
  // même si le schéma met readOnly: true.
  const colReadOnly = typeof col?.readOnly === "function" ? col.readOnly(row) : !!col?.readOnly;
  const baseReadOnly = colReadOnly;
  const allowOverrideForFormula = type === "formula";
  const readOnly = allowOverrideForFormula ? false : baseReadOnly;

  const value = row?.[key];

  // ==== NEW: support override de formule par cellule (=...)
  const cellOverride = row?.__cellFormulas?.[key];
  const editDefault =
    isEditing && (type === "text" || type === "number" || type === "formula")
      ? (cellOverride ? `=${cellOverride}` : (value ?? ""))
      : undefined;

  // ===== HOOKS — tjs en haut (pas de hooks conditionnels) =====
  const textRef = React.useRef(null);
  const numberRef = React.useRef(null);
  const selectRef = React.useRef(null);
  const multiRef = React.useRef(null);
  const fileRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const [draft, setDraft] = React.useState(value);

  // chaque fois qu’on (re)entre en édition, resynchroniser le draft avec la valeur
  React.useEffect(() => {
    if (!isEditing) return;
    if (type === "formula") {
      const base = typeof fxForceDraft === "string"
        ? fxForceDraft
        : (cellOverride ? `=${cellOverride}`
          : (col?.formula ? `=${col.formula}` : (value ?? "")));
      setDraft(base ?? "");
    } else {
      setDraft(value ?? "");
    }
  }, [isEditing, value, type, cellOverride, fxForceDraft, col]);

  React.useEffect(() => {
    if (!fxPendingToken) return;
    if (!fxSessionActive || !isEditing || type !== "formula") {
      onFxConsumeToken?.();
      return;
    }
    const el = inputRef.current || textRef.current;
    const caret = (el && typeof el.selectionStart === "number")
      ? el.selectionStart
      : (typeof draft === "string" ? draft.length : 0);
    const src = typeof draft === "string" ? draft : "";
    const { out, caret: c2 } = replaceToken(src, caret, fxPendingToken);
    setDraft(out);
    if (el) {
      el.value = out;
      requestAnimationFrame(() => {
        try {
          (inputRef.current || textRef.current)?.setSelectionRange(c2, c2);
        } catch { }
      });
    }
    onFxConsumeToken?.();
  }, [fxPendingToken, fxSessionActive, isEditing, type, draft, onFxConsumeToken]);

  React.useEffect(() => {
    if (!fxSessionActive) return;
    if (!isEditing) onFxStop?.();
  }, [fxSessionActive, isEditing, onFxStop]);

  // focus auto quand on passe en édition
  React.useEffect(() => {
    if (!isEditing) return;
    if (type === "text" && textRef.current) { textRef.current.focus(); textRef.current.select?.(); }
    if (type === "number" && numberRef.current) { numberRef.current.focus(); numberRef.current.select?.(); }
    if (type === "select" && selectRef.current) { selectRef.current.focus(); selectRef.current.showPicker?.(); }
    if (type === "multiselect" && multiRef.current) { multiRef.current.focus(); }
    if (type === "photo" && fileRef.current) { fileRef.current.focus(); }
  }, [isEditing, type]);

  // ===== Helpers communs =====
  const stopAll = (e) => { e.stopPropagation(); };

  // 🔒 évite le double-commit (Enter puis blur)
  const committedRef = React.useRef(false);

  const normalize = (v) => {
    if (type === "number") return (v === "" ? "" : String(v).replace(",", "."));
    return v;
  };

  const commitOnce = (v) => {
    if (committedRef.current) return;

    // Autorise un override "=..." même si la colonne est readOnly (utile pour formula)
    const isFormulaOverride = typeof v === "string" && v.trim().startsWith("=");

    if (readOnly && !isFormulaOverride) {
      onEndEdit?.();
      return;
    }

    committedRef.current = true;

    const next = normalize(v);
    if (String(next) !== String(value)) onChange?.(key, next);
    onEndEdit?.();
    if (fxSessionActive) onFxStop?.();

    // relâche le verrou juste après le cycle d’événements
    setTimeout(() => { committedRef.current = false; }, 0);
  };

  const handleInputKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      const cur = e.currentTarget?.value;
      commitOnce(cur);                 // ✅ commit avant de bouger
      setTimeout(() => onEnter?.(e.shiftKey), 0); // laisse React démonter l’input avant de bouger
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onEndEdit?.();
    }
  };

  // ===== Rendus par type =====

  // 1) Checkbox (lecture/édition quasi identiques)
  if (type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange?.(key, e.target.checked)}
        onClick={stopAll}
        onMouseDown={stopAll}
      />
    );
  }

  // 2) Select (liste simple)
  if (type === "select") {
    const options = React.useMemo(() => normalizeOptions(col?.options), [col]);

    const label =
      options.find((o) => String(o.value) === String(value))?.label ||
      (value ?? "—");

    return isEditing ? (
      <select
        ref={selectRef}
        value={value ?? ""}
        onChange={(e) => commitOnce(e.target.value)}   // ⬅️ au change
        onBlur={(e) => commitOnce(e.target.value)}     // ⬅️ au blur (sécurité)
        onKeyDown={handleInputKeyDown}
        onClick={stopAll}
        style={{ width: "100%" }}
      >
        <option value=""></option>
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>{o.label}</option>
        ))}
      </select>
    ) : (
      <div
        onDoubleClick={() => !readOnly && onStartEdit?.()}
        style={{ cursor: readOnly ? "default" : "text" }}
      >
        {label || "—"}
      </div>
    );
  }

  // 3) MultiSelect (valeur tableau de valeurs)
  if (type === "multiselect") {
    const options = React.useMemo(() => normalizeOptions(col?.options), [col]);
    const selected = Array.isArray(value) ? value : [];
    const asLabels = selected
      .map((v) => options.find((o) => String(o.value) === String(v))?.label || String(v))
      .filter(Boolean);

    return isEditing ? (
      <div
        ref={multiRef}
        tabIndex={0}
        onKeyDown={handleInputKeyDown}
        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
        onClick={stopAll}
        onMouseDown={stopAll}
      >
        {options.map((o) => {
          const active = selected.some((v) => String(v) === String(o.value));
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                let next = selected;
                if (active) next = selected.filter((v) => String(v) !== String(o.value));
                else next = [...selected, o.value];
                onChange?.(key, next);
              }}
              style={{
                padding: "2px 6px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: active ? "#2563eb" : "#f8fafc",
                color: active ? "#fff" : "#111",
                fontSize: 12,
              }}
            >
              {o.label}
            </button>
          );
        })}
        {/* commit sur blur */}
        <span style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} />
      </div>
    ) : (
      <div
        onDoubleClick={() => !readOnly && onStartEdit?.()}
        style={{ display: "flex", gap: 6, flexWrap: "wrap", cursor: readOnly ? "default" : "text" }}
      >
        {asLabels.length ? asLabels.map((t, i) => (
          <span key={i} style={{ padding: "2px 6px", borderRadius: 8, border: "1px solid #E0DED9", background: "#f8fafc", fontSize: 12 }}>
            {t}
          </span>
        )) : "—"}
      </div>
    );
  }

  // 4) Number
  if (type === "number") {
    const format = (v) => v ?? "";
    return isEditing ? (
      <input
        ref={numberRef}
        type="text"
        defaultValue={editDefault ?? (value ?? "")}   // ← NEW: montre "=..." si override
        onKeyDown={handleInputKeyDown}
        onBlur={(e) => commitOnce(e.target.value)}
        onClick={stopAll}
        onMouseDown={stopAll}
        style={{ width: "100%" }}
        inputMode="decimal"
      />
    ) : (
      <div
        onDoubleClick={() => !readOnly && onStartEdit?.()}
        style={{
          color: readOnly ? "#9CA3AF" : "inherit",
          backgroundColor: readOnly ? "#F4F4F4" : "transparent",
          fontStyle: readOnly ? "italic" : "normal",
          padding: "2px 4px", borderRadius: 4
        }}
      >
        {format(value) || "—"}
      </div>
    );
  }

  // 5) Photo (tableau d’URLs)
  if (type === "photo") {
    const imgs = Array.isArray(value) ? value : (value ? [value] : []);
    const open = (idx = 0) => onOpenLightbox?.(imgs, idx);

    return isEditing ? (
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
        onClick={stopAll}
        onMouseDown={stopAll}
      >
        {imgs.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => open(i)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 6,
              overflow: "hidden",
              border: "1px solid #E0DED9",
              padding: 0,
            }}
            title="Voir"
          >
            <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        ))}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            const urls = files.map((f) => URL.createObjectURL(f));
            const next = [...imgs, ...urls];
            onChange?.(key, next);
          }}
        />
      </div>
    ) : (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {imgs.length ? (
          imgs.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); open(i); }}
              onDoubleClick={(e) => { e.stopPropagation(); !readOnly && onStartEdit?.(); }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid #E0DED9",
                padding: 0,
                cursor: "pointer",
              }}
              title="Voir"
            >
              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))
        ) : (
          <button
            type="button"
            onDoubleClick={() => !readOnly && onStartEdit?.()}
            style={{ fontSize: 12, opacity: 0.6, background: "none", border: "none", padding: 0, cursor: readOnly ? "default" : "text" }}
          >
            + Ajouter des photos
          </button>
        )}
      </div>
    );
  }

  // 6) Formula — EDITABLE avec "=..." (override cellule)
  if (type === "formula") {
    return isEditing ? (
      <div style={{ position: "relative" }}>
        <input
          ref={(el) => {
            textRef.current = el;
            inputRef.current = el;
          }}
          type="text"
          value={draft ?? ""}
          style={{
            width: "100%",
            minWidth: 420,
            position: "relative",
            zIndex: 20,
          }}
          onKeyDown={handleInputKeyDown}
          onBlur={(e) => {
            if (!fxSessionActive) {
              commitOnce(e.target.value);
              return;
            }
            // En mode formule, on ne commit pas sur blur : on laisse DataTable gérer
            e.preventDefault();
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
          }}
          onClick={stopAll}
          onMouseDown={stopAll}
        />
      </div>
    ) : (
      <div
        // 🔓 NEW: pour formula on ne bloque plus le double-clic par readOnly
        onDoubleClick={() => onStartEdit?.()}
        style={{ cursor: "text" }}
      >
        {value ?? "—"}
      </div>
    );
  }

  // 7) Button (action simple)
  if (type === "button") {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); col?.onClick?.(row); }}
        style={{ ...S.smallBtn }}
      >
        {col?.label || "Action"}
      </button>
    );
  }

  // 8) Détail (bouton d’ouverture)
  if (key === "detail") {
    return (
      <button
        type="button"
        style={S.smallBtn}
        onClick={(e) => { e.stopPropagation(); col?.onOpen?.(row); }}
      >
        Ouvrir
      </button>
    );
  }

  // 10) Catalog Item (Autocomplete from library)
  if (type === "catalog_item") {
    // 1. Get Catalog (from formulaCtx or empty)
    const catalog = formulaCtx?.catalog || [];

    // 2. Filter by Category if specified
    const category = col?.category;
    const filtered = React.useMemo(() => {
      if (!category) return catalog;
      // Support multiple categories? e.g. "Rail,Tringle" -> split
      const cats = category.split(",").map(c => c.trim().toLowerCase());
      return catalog.filter(item => {
        if (!item.category) return false;
        return cats.includes(item.category.toLowerCase());
      });
    }, [catalog, category]);

    // 3. Render
    return isEditing ? (
      <Autocomplete
        freeSolo
        options={filtered}
        getOptionLabel={(option) => {
          if (typeof option === "string") return option;
          return option.name || "";
        }}
        value={value || null}
        onChange={(event, newValue) => {
          const name = (typeof newValue === "object" && newValue) ? newValue.name : newValue;
          commitOnce(name || "");
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            autoFocus
            fullWidth
            variant="standard"
            InputProps={{ ...params.InputProps, disableUnderline: true }}
            onBlur={(e) => {
              // Only commit if needed. Autocomplete onChange handles selection.
              // But if users types manual text and leaves, we need this.
              // Problem: e.target.value might be weird in Autocomplete?
              // Usually for freeSolo strictly, it works.
              commitOnce(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                commitOnce(e.target.value);
              }
            }}
          />
        )}
        style={{ width: "100%" }}
        componentsProps={{
          popper: {
            onClick: stopAll,
            onMouseDown: stopAll
          }
        }}
        onMouseDown={stopAll} // Prevent grid click hijack
        onClick={stopAll}
      />
    ) : (
      <div
        onDoubleClick={() => !readOnly && onStartEdit?.()}
        style={{
          cursor: readOnly ? "default" : "text",
          color: readOnly ? "#9CA3AF" : "inherit", // Gray text
          backgroundColor: readOnly ? "#F4F4F4" : "transparent", // Light gray bg
          fontStyle: readOnly ? "italic" : "normal",
          padding: "2px 4px",
          borderRadius: 4
        }}
      >
        {value ?? "—"}
      </div>
    );
  }

  // 9) Texte (par défaut)
  return isEditing ? (
    <input
      ref={textRef}
      type="text"
      defaultValue={editDefault ?? (value ?? "")}
      onKeyDown={handleInputKeyDown}
      onBlur={(e) => commitOnce(e.target.value)}
      onClick={stopAll}
      onMouseDown={stopAll}
      style={{ width: "100%" }}
    />
  ) : (
    <div
      onDoubleClick={() => !readOnly && onStartEdit?.()}
      style={{
        cursor: readOnly ? "default" : "text",
        color: readOnly ? "#9CA3AF" : "inherit",
        backgroundColor: readOnly ? "#F4F4F4" : "transparent",
        fontStyle: readOnly ? "italic" : "normal",
        padding: "2px 4px",
        borderRadius: 4
      }}
    >
      {value ?? "—"}
    </div>
  );
}

export default InputCell;
