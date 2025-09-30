// src/screens/HomeScreen.jsx
import React from "react";
import { S } from "../lib/constants/ui";
import AppTile from "../components/AppTile.jsx";
import { PencilRuler, Database, Boxes, GanttChart, Settings2 } from "lucide-react";
import { useViewportWidth } from "../lib/hooks/useViewportWidth";

// 🔐 ACL
import { useAuth } from "../auth";
import { can } from "../lib/authz";

export default function HomeScreen({
  onOpenProdList,
  onOpenSettings,
  onOpenChiffrage,
  onOpenInventory,
}) {
  const width = useViewportWidth();
  const cols = width < 700 ? 2 : 4;
  const gap = width < 700 ? 40 : 64;
  const tileSize = Math.max(88, Math.min(112, Math.round(width * 0.18)));

  const { currentUser } = useAuth();
  const may = {
    chiffrage:  can(currentUser, "chiffrage.view"),
    production: can(currentUser, "production.view"),
    inventory:  can(currentUser, "inventory.view"),
    planning:   can(currentUser, "planning.view"), // plus tard
    // ⚠️ pas de garde pour Settings : visible pour tous
  };

  // helper pour MASQUER totalement une tuile si non autorisé
  const hideTile = (ok, node) => (ok ? node : null);

  return (
    <div style={S.mainCenter}>
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
            <AppTile label="Planning" Icon={GanttChart} size={tileSize} onClick={() => console.log("/planning")} />
          )}

          {/* ✅ Toujours visible, quel que soit le rôle */}
          <AppTile label="Paramètres" Icon={Settings2} size={tileSize} onClick={onOpenSettings} />
        </div>
      </div>
    </div>
  );
}