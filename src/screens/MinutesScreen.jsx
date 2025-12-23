// src/screens/MinutesScreen.jsx
import React from "react";
import { COLORS, S } from "../lib/constants/ui";
import MinuteEditor from "../components/MinuteEditor";
import { uid } from "../lib/utils/uid";
import { useAuth } from "../auth";
import { useNotifications } from "../contexts/NotificationContext";
import { useLocalStorage } from "../lib/hooks/useLocalStorage";
import { mapMinuteLinesToProductionRows } from "../lib/data/demo";

/** Mock data or empty defaults */
const DEMO_MINUTES = [];

export default function MinutesScreen({ onExportToProduction }) {
  const [minutes, setMinutes] = useLocalStorage("minutes.v1", DEMO_MINUTES);
  const [selId, setSelId] = React.useState(null);
  const selected = minutes.find(m => m.id === selId) || null;

  const { currentUser, ROLES } = useAuth();
  const { addNotification } = useNotifications();

  // On mount, auto-select first if none selected
  React.useEffect(() => {
    if (!selId && minutes.length > 0) {
      setSelId(minutes[0].id);
    }
  }, [minutes, selId]);

  const createMinute = () => {
    const now = Date.now();
    const m = {
      id: uid(),
      name: "Nouvelle minute",
      client: "",
      version: 1,
      status: "DRAFT", // DRAFT, PENDING_APPROVAL, VALIDATED, REJECTED
      notes: "",
      lines: [],
      // ▼ paramètres par défaut (drawer)
      params: [
        { id: uid(), name: "taux_horaire", type: "prix", value: 135 },
        { id: uid(), name: "prix_achat_tissu", type: "prix", value: null },
        { id: uid(), name: "nuit_hotel", type: "prix", value: 150 },
      ],
      // ▼ tableau “déplacements” prêt (même si vide au départ)
      deplacements: [],
      createdAt: now,
      updatedAt: now,
    };
    setMinutes((a) => [m, ...(a || [])]);
    setSelId(m.id);
  };

  const duplicateMinute = (id) => {
    const src = minutes.find(m => m.id === id);
    if (!src) return;
    const copy = {
      ...src,
      id: uid(),
      name: src.name + " (copie)",
      version: (src.version || 1) + 1,
      status: "DRAFT", // Reset status on copy
      // lignes recopiées avec nouveaux ids
      lines: (src.lines || []).map(l => ({ ...l, id: uid() })),
      // params recopiés avec nouveaux ids (si présents)
      params: (src.params || []).map(p => ({ ...p, id: uid() })),
      // déplacements recopiés avec nouveaux ids (si tu stockes un id par ligne)
      deplacements: (src.deplacements || []).map(d => ({ ...d, id: uid() })),
      updatedAt: Date.now(),
    };
    setMinutes([copy, ...minutes]);
    setSelId(copy.id);
  };

  const deleteMinute = (id) => {
    if (!confirm("Supprimer cette minute ?")) return;
    const next = (minutes || []).filter(m => m.id !== id);
    setMinutes(next);
    if (selId === id) setSelId(next?.[0]?.id || null);
  };

  const saveMinute = (patch) => {
    setMinutes((arr) => arr.map(m => (m.id === patch.id ? { ...m, ...patch } : m)));
  };

  // --- VALIDATION LOGIC ---

  // Calculate Grand Total On-the-Fly
  const getGrandTotal = (min) => {
    if (!min) return 0;
    // Sum lines (Rideaux/Stores)
    const linesTotal = (min.lines || []).reduce((acc, l) => acc + (l.prix_total || 0), 0);
    // Sum deplacements
    const depTotal = (min.deplacements || []).reduce((acc, d) => acc + (d.total_eur || 0), 0);
    // Sum extras (if any/implemented)
    const extrasTotal = (min.extras || []).reduce((acc, e) => acc + (e.montant_eur || 0), 0);

    return linesTotal + depTotal + extrasTotal;
  };

  const handleAction = (action) => {
    if (!selected) return;
    const total = getGrandTotal(selected);
    const isAdmin = currentUser?.role === ROLES.ADMIN; // DIRECTION role

    if (action === "SUBMIT_VALIDATION") {
      saveMinute({ ...selected, status: "PENDING_APPROVAL" });
      addNotification(
        "Validation requise",
        `Le devis "${selected.name}" (${Math.round(total)}€) requiert validation.`,
        "warning"
      );
      alert("Demande de validation envoyée à la direction.");
    }
    else if (action === "VALIDATE") {
      saveMinute({ ...selected, status: "VALIDATED" });
      addNotification(
        "Devis Validé",
        `Le devis "${selected.name}" a été validé.`,
        "success"
      );
      // Logic: Also Trigger Export? Or just change status?
      // User said: "Action -> Statut VALIDATED".
    }
    else if (action === "REJECT") {
      saveMinute({ ...selected, status: "DRAFT" }); // Back to draft
      addNotification(
        "Devis Refusé",
        `Le devis "${selected.name}" a été refusé.`,
        "error"
      );
    }
    else if (action === "EXPORT") {
      if (selected.status !== 'VALIDATED') {
        // Optional safety check, though valid workflow might clear it before this point
        alert("Attention: Ce devis n'est pas encore validé.");
      }
      const mapped = mapMinuteLinesToProductionRows(selected.lines || []);
      onExportToProduction(mapped, selected);
    }
  };


  const renderActionButtons = () => {
    if (!selected) return null;
    const status = selected.status || "DRAFT";
    const total = getGrandTotal(selected);
    const isAdmin = currentUser?.role === ROLES.ADMIN;

    if (status === "PENDING_APPROVAL") {
      if (isAdmin) {
        return (
          <>
            <button onClick={() => handleAction("VALIDATE")} style={{ ...S.smallBtn, background: '#10b981', color: 'white', borderColor: '#10b981' }}>✅ Accepter</button>
            <button onClick={() => handleAction("REJECT")} style={{ ...S.smallBtn, background: '#ef4444', color: 'white', borderColor: '#ef4444' }}>❌ Refuser</button>
          </>
        );
      } else {
        return (
          <button disabled style={{ ...S.smallBtn, background: '#e5e7eb', color: '#9ca3af', cursor: 'not-allowed' }}>⏳ En attente de validation...</button>
        );
      }
    }

    if (status === "VALIDATED") {
      return (
        <>
          <span style={{ color: '#10b981', fontWeight: 600, fontSize: 13, marginRight: 8, display: 'flex', alignItems: 'center' }}>✅ Validé</span>
          <button onClick={() => handleAction("EXPORT")} style={{ ...S.smallBtn, background: '#3b82f6', color: 'white', borderColor: '#3b82f6' }}>⇪ Exporter vers Prod</button>
        </>
      );
    }

    // Default: DRAFT or REJECTED
    // Check Threshold > 20000
    if (total > 20000 && !isAdmin) {
      return (
        <button onClick={() => handleAction("SUBMIT_VALIDATION")} style={{ ...S.smallBtn, background: '#f59e0b', color: 'white', borderColor: '#f59e0b' }}>
          ✋ Soumettre pour validation ({Math.round(total / 1000)}k€)
        </button>
      );
    } else {
      // Standard flow
      return (
        <button onClick={() => handleAction("VALIDATE")} style={{ ...S.smallBtn, background: '#3b82f6', color: 'white', borderColor: '#3b82f6' }}>
          💾 Valider et Terminer
        </button>
      );
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
      {/* Colonne gauche : liste */}
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Minutes</b>
          <button style={S.smallBtn} onClick={createMinute}>+ Nouvelle</button>
        </div>
        <div style={{ maxHeight: 520, overflow: "auto" }}>
          {(minutes || []).map((m) => {
            const st = m.status || "DRAFT";
            const sColor = st === 'VALIDATED' ? '#10b981' : st === 'PENDING_APPROVAL' ? '#f59e0b' : '#9ca3af';
            return (
              <div
                key={m.id}
                onClick={() => setSelId(m.id)}
                style={{
                  padding: 10,
                  borderBottom: `1px solid ${COLORS.border}`,
                  cursor: "pointer",
                  background: selId === m.id ? "#eef2ff" : "#fff",
                  borderLeft: `4px solid ${sColor}`
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <div style={{ fontSize: 12, opacity: .7 }}>v{m.version} — {(m.lines || []).length} ligne(s)</div>
                    {/* Status Badge */}
                    <div style={{ fontSize: 10, color: sColor, fontWeight: 600, marginTop: 2 }}>
                      {st === 'PENDING_APPROVAL' ? 'EN ATTENTE' : st === 'VALIDATED' ? 'VALIDÉ' : 'BROUILLON'}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={S.smallBtn} title="Dupliquer" onClick={(e) => { e.stopPropagation(); duplicateMinute(m.id); }}>🧬</button>
                    <button style={{ ...S.smallBtn, color: "#b91c1c" }} title="Supprimer" onClick={(e) => { e.stopPropagation(); deleteMinute(m.id); }}>🗑️</button>
                  </div>
                </div>
              </div>
            )
          })}
          {!minutes?.length && (
            <div style={{ padding: 12, opacity: .7 }}>Aucune minute. Crée la première.</div>
          )}
        </div>
      </div>

      {/* Colonne droite : éditeur + export */}
      <div style={{ display: "grid", gap: 12 }}>
        {/* Métadonnées minute */}
        {selected ? (
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: .7 }}>Nom</div>
                <input
                  value={selected.name || ""}
                  onChange={(e) => saveMinute({ ...selected, name: e.target.value })}
                  style={S.input}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: .7 }}>Client</div>
                <input
                  value={selected.client || ""}
                  onChange={(e) => saveMinute({ ...selected, client: e.target.value })}
                  style={S.input}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 12, opacity: .7 }}>Notes</div>
                <textarea
                  value={selected.notes || ""}
                  onChange={(e) => saveMinute({ ...selected, notes: e.target.value })}
                  style={{ ...S.input, height: 70 }}
                />
              </div>
            </div>
            {/* DEBUG INFO (TEMPORARY) */}
            <div style={{ fontSize: 10, color: '#6b7280', background: '#f9fafb', padding: 5, borderRadius: 4, marginBottom: 5 }}>
              Status: <b>{selected.status || 'DRAFT'}</b> | Total: <b>{Math.round(getGrandTotal(selected))}€</b><br />
              User: <b>{currentUser?.name || 'Grand Public'}</b> | Role: <b>{currentUser?.role}</b> | Admin: <b>{currentUser?.role === ROLES.ADMIN ? 'YES' : 'NO'}</b>
            </div>

            {/* ACTION BUTTONS AREA */}
            <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", borderTop: `1px solid #f3f4f6`, paddingTop: 12 }}>
              {renderActionButtons()}
            </div>
          </div>
        ) : null}

        {/* Table des lignes */}
        {selected ? (
          <MinuteEditor
            minute={selected}
            onChangeMinute={(m) => saveMinute(m)}
          />
        ) : (
          <div style={{ padding: 20, border: `1px dashed ${COLORS.border}`, borderRadius: 12, textAlign: "center" }}>
            Sélectionne ou crée une minute pour commencer.
          </div>
        )}
      </div>
    </div>
  );
}