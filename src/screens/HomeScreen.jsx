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
  onOpenPlanning,
}) {
  const width = useViewportWidth();
  const cols = width < 700 ? 2 : 4;
  const gap = width < 700 ? 40 : 64;
  const tileSize = Math.max(88, Math.min(112, Math.round(width * 0.18)));

  const { currentUser } = useAuth();

  // DEBUG : Voir ce que le système détecte vraiment
  const detectedRole = currentUser?.role || "Aucun rôle détecté";
  console.log("Role actuel:", detectedRole);

  const may = {
    chiffrage: can(currentUser, "chiffrage.view"),
    production: can(currentUser, "production.view"),
    inventory: can(currentUser, "inventory.view"),
    planning: can(currentUser, "planning.view"),
  };

  // helper pour MASQUER totalement une tuile si non autorisé
  const hideTile = (ok, node) => (ok ? node : null);

  return (
    <div style={S.mainCenter}>
      {/* Petit bandeau de debug discret pour comprendre pourquoi ça bloque */}
      <div style={{ position: 'absolute', top: 60, right: 20, fontSize: 10, color: '#999', opacity: 0.5 }}>
        Debug: {currentUser?.name} ({detectedRole})
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

          {/* ✅ Toujours visible */}
          <AppTile label="Paramètres" Icon={Settings2} size={tileSize} onClick={onOpenSettings} />
        </div>
      </div>
    </div>
  );
}