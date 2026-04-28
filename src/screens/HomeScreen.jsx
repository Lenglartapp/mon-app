// src/screens/HomeScreen.jsx
import React from "react";
import { S } from "../lib/constants/ui";
import AppTile from "../components/AppTile.jsx";
import { PencilRuler, Database, Boxes, GanttChart, Settings2, Truck, TrendingUp } from "lucide-react";
import { useViewportWidth } from "../lib/hooks/useViewportWidth";

// 🔐 ACL
import { useAuth } from "../auth";
import { can } from "../lib/authz";

function pickGreeting(name) {
  const n = name?.split(" ")[0] || "";
  const h = new Date().getHours();
  const day = new Date().getDay(); // 0=dim, 1=lun … 6=sam
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Lundi matin
  if (day === 1 && h < 12) return pick([
    `Bonjour ${n},`,
    `Bonne semaine ${n},`,
    `Bonne matinée ${n},`,
  ]);

  // Vendredi après-midi
  if (day === 5 && h >= 14) return pick([
    `Bon vendredi ${n},`,
    `Bonne fin de semaine ${n},`,
    `Bonsoir ${n},`,
  ]);

  // Matin (6h–12h)
  if (h >= 6 && h < 12) return pick([
    `Bonjour ${n},`,
    `Bonne matinée ${n},`,
    `Bonjour ${n}, belle journée devant vous.`,
  ]);

  // Midi (12h–14h)
  if (h >= 12 && h < 14) return pick([
    `Bonjour ${n},`,
    `Bon après-midi ${n},`,
    `Bonne continuation ${n},`,
  ]);

  // Après-midi (14h–18h)
  if (h >= 14 && h < 18) return pick([
    `Bon après-midi ${n},`,
    `Comment se passe la journée ${n} ?`,
    `Bonne continuation ${n},`,
    `Que faisons-nous ${n} ?`,
  ]);

  // Soirée et nuit
  return pick([
    `Bonsoir ${n},`,
    `Bonne soirée ${n},`,
    `Bonsoir ${n}, bonne continuation.`,
  ]);
}

export default function HomeScreen({
  onOpenProdList,
  onOpenSettings,
  onOpenChiffrage,
  onOpenInventory,
  onOpenPlanning,
  onOpenLogistique,
  onOpenPerformance,
}) {
  const width = useViewportWidth();
  const cols = width < 700 ? 2 : 4;
  const gap = width < 700 ? 32 : 52;
  const tileSize = Math.max(80, Math.min(96, Math.round(width * 0.14)));

  const { currentUser } = useAuth();

  // DEBUG : Voir ce que le système détecte vraiment
  const detectedRole = currentUser?.role || "Aucun rôle détecté";
  console.log("Role actuel:", detectedRole);

  const may = {
    chiffrage: can(currentUser, "nav.chiffrage"),
    production: can(currentUser, "nav.production"),
    inventory: can(currentUser, "nav.inventory"),
    planning: can(currentUser, "planning.view"),
    logistique: can(currentUser, "nav.logistique"),
    performance: can(currentUser, "nav.performance"),
  };

  // helper pour MASQUER totalement une tuile si non autorisé
  const hideTile = (ok, node) => (ok ? node : null);

  const greetingText = React.useMemo(() => pickGreeting(currentUser?.name), [currentUser?.name]);
  const dateStr = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>

      {/* Salutation */}
      <div style={{ marginBottom: 64, textAlign: "center" }}>
        <div style={{ fontFamily: "Roboto, system-ui, sans-serif", fontWeight: 300, fontSize: "clamp(30px, 3.2vw, 46px)", color: "#191919", letterSpacing: -0.5 }}>
          {greetingText}
        </div>
        <div style={{ fontFamily: "Roboto, system-ui, sans-serif", fontWeight: 300, fontStyle: "italic", fontSize: "clamp(14px, 1.3vw, 17px)", color: "#9B8E82", marginTop: 8 }}>
          {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
        </div>
      </div>

      <div style={S.appsWrap}>
        <div style={{ ...S.appsBase, gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
          {hideTile(
            may.chiffrage,
            <AppTile label="Chiffrage" Icon={PencilRuler} size={tileSize} onClick={onOpenChiffrage} />
          )}

          {hideTile(
            may.production,
            <AppTile label="Production" Icon={Database} size={tileSize} onClick={onOpenProdList} />
          )}

          {hideTile(
            may.inventory,
            <AppTile label="Inventaire" Icon={Boxes} size={tileSize} onClick={onOpenInventory} />
          )}

          {hideTile(
            may.planning,
            <AppTile label="Planning" Icon={GanttChart} size={tileSize} onClick={onOpenPlanning} />
          )}

          {hideTile(
            may.logistique,
            <AppTile label="Logistique" Icon={Truck} size={tileSize} onClick={onOpenLogistique} />
          )}

          {hideTile(
            may.performance,
            <AppTile label="Performance" Icon={TrendingUp} size={tileSize} onClick={onOpenPerformance} />
          )}

          {/* ✅ Toujours visible */}
          <AppTile label="Paramètres" Icon={Settings2} size={tileSize} onClick={onOpenSettings} />
        </div>
      </div>
    </div>
  );

}