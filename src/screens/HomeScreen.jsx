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

  // Weekend
  if (day === 0 || day === 6) return pick([
    `On bosse le weekend ${n} ?`,
    `Même le weekend ${n} !`,
    `Repos… ou pas ${n} ?`,
    `Bonjour ${n},`,
  ]);

  // Lundi matin
  if (day === 1 && h < 12) return pick([
    `Bonne semaine ${n} !`,
    `On attaque ${n} ?`,
    `Lundi, c'est parti ${n} !`,
    `Bonjour ${n},`,
  ]);

  // Vendredi après-midi
  if (day === 5 && h >= 14) return pick([
    `Bon vendredi ${n} !`,
    `Dernière ligne droite ${n},`,
    `On finit la semaine en beauté ${n} ?`,
    `Bientôt le weekend ${n} !`,
  ]);

  // Matin (6h–12h)
  if (h >= 6 && h < 12) return pick([
    `Bonjour ${n},`,
    `Bonne matinée ${n},`,
    `Salut ${n},`,
    `C'est parti ${n} !`,
    `On commence ${n} ?`,
    `Au boulot ${n} !`,
    `Prêt pour la journée ${n} ?`,
  ]);

  // Pause déjeuner (12h–14h)
  if (h >= 12 && h < 14) return pick([
    `Bon appétit ${n} !`,
    `Bonne pause ${n},`,
    `Salut ${n},`,
    `Bonjour ${n},`,
  ]);

  // Après-midi (14h–18h)
  if (h >= 14 && h < 18) return pick([
    `Comment ça avance ${n} ?`,
    `On continue ${n} ?`,
    `Toujours là ${n} ?`,
    `Qu'est-ce qu'on fait ${n} ?`,
    `Salut ${n},`,
    `L'après-midi est à toi ${n},`,
  ]);

  // Soirée (18h–22h)
  if (h >= 18 && h < 22) return pick([
    `Bonsoir ${n},`,
    `Encore là ${n} ?`,
    `On finit fort ${n} ?`,
    `Dernière ligne droite ${n},`,
  ]);

  // Nuit tardive
  return pick([
    `Bonsoir ${n},`,
    `Encore debout ${n} ?`,
    `C'est tard ${n}…`,
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