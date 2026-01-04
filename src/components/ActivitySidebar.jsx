import React from "react";
import { useAuth } from "../auth";
import { useActivity } from "../contexts/activity";
import { COLORS, S } from "../lib/constants/ui";


export default function ActivitySidebar({ row, colsByKey, onClose }) {
  const colMap = colsByKey || {};
  const { currentUser } = useAuth();

  const { addComment, getRow, lastActivity } = useActivity();
  const [tab, setTab] = React.useState("all"); // 'all' | 'comments' | 'history'
  const [text, setText] = React.useState("");
  const [allItems, setAllItems] = React.useState([]);

  // Chargement initial + Refresh si nouvelle activité
  React.useEffect(() => {
    if (row?.id) {
      getRow(row.id).then(setAllItems);
    }
  }, [row?.id, lastActivity]); // Recharge si lastActivity change (même d'ailleurs pour l'instant)

  const items = React.useMemo(() => {
    const arr = allItems.slice().sort((a, b) => a.ts - b.ts);
    if (tab === "comments") return arr.filter(x => x.type === "comment");
    if (tab === "history") return arr.filter(x => x.type === "change");
    return arr;
  }, [allItems, tab]);

  const publish = () => {
    const rId = row?.id;
    const t = (text || "").trim();
    if (!rId || !t) return;
    addComment(rId, t, currentUser?.name || "Utilisateur");
    // Pas besoin de setText("") ici, on attend que l'activité revienne via lastActivity pour refresh ? 
    // Non, on clear direct pour UX.
    setText("");
  };

  return (
    <div style={{ width: 380, borderLeft: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: 12, fontWeight: 800 }}>
        Activité — {row?.zone || row?.piece || ""}
      </div>

      <div style={{ display: "flex", gap: 8, padding: "0 12px 8px" }}>
        <button
          style={{ ...S.smallBtn, background: tab === "all" ? "#111827" : "#fff", color: tab === "all" ? "#fff" : "#111" }}
          onClick={() => setTab("all")}
        >
          Toutes
        </button>
        <button
          style={{ ...S.smallBtn, background: tab === "comments" ? "#111827" : "#fff", color: tab === "comments" ? "#fff" : "#111" }}
          onClick={() => setTab("comments")}
        >
          Commentaires
        </button>
        <button
          style={{ ...S.smallBtn, background: tab === "history" ? "#111827" : "#fff", color: tab === "history" ? "#fff" : "#111" }}
          onClick={() => setTab("history")}
        >
          Historique
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 12px 12px" }}>
        {items.length === 0 ? (
          <div style={{ opacity: .6, padding: 12 }}>Aucune entrée.</div>
        ) : (
          console.log("DEBUG SIDEBAR - Liste des items:", items) || items.map(it => (
            <div key={it.id} style={{ padding: 10, border: `1px solid ${COLORS.border}`, borderRadius: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, opacity: 1, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                {new Date(it.ts).toLocaleString()} — {it.user_name || "Auteur inconnu"}
              </div>
              {it.type === "comment" ? (
                <div style={{ marginTop: 6 }}>{it.text}</div>
              ) : (
                <div style={{ marginTop: 6 }}>
                  <b>{colMap?.[it.field]?.label || it.field}</b> :{" "}
                  <span style={{ textDecoration: "line-through", opacity: .7 }}>{String(it.from ?? "—")}</span>
                  {" "}<span>→</span>{" "}
                  <span style={{ color: "#166534", fontWeight: 600 }}>{String(it.to ?? "—")}</span>
                </div>
              )}
            </div>
          )))}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${COLORS.border}` }}>
        <textarea
          placeholder="Laisser un commentaire…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") publish(); }}
          style={{ width: "100%", minHeight: 80 }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            style={S.smallBtn}
            onClick={publish}
            disabled={!text?.trim() || !row?.id}
          >Publier</button>
        </div>
      </div>
    </div>
  );
}