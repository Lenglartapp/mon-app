import React from "react";
import { S } from "../lib/constants/ui";
import AppTile from "../components/AppTile.jsx";
import { PencilRuler, Database, Boxes, GanttChart, Settings2 } from "lucide-react";
import { useViewportWidth } from "../lib/hooks/useViewportWidth";

export default function HomeScreen({ onOpenProdList, onOpenSettings, onOpenChiffrage }) {

  const width = useViewportWidth();
  const cols = width < 700 ? 2 : 4;
  const gap = width < 700 ? 40 : 64;
  const tileSize = Math.max(88, Math.min(112, Math.round(width*0.18)));

  return (
    <div style={S.mainCenter}>
      <div style={S.appsWrap}>
        <div style={{ ...S.appsBase, gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
          <AppTile
  label="Chiffrage"
  Icon={PencilRuler}
  size={tileSize}
  onClick={onOpenChiffrage}
/>
          <AppTile label="Production" Icon={Database}    size={tileSize} onClick={onOpenProdList} />
          <AppTile label="Inventaire" Icon={Boxes}       size={tileSize} onClick={()=>console.log("/inventaire")} />
          <AppTile label="Planning"   Icon={GanttChart}  size={tileSize} onClick={()=>console.log("/planning")} />
          {/* 🔧 Nouvelle tuile Paramètres */}
          <AppTile label="Paramètres" Icon={Settings2}   size={tileSize} onClick={onOpenSettings} />
        </div>
      </div>
    </div>
  );
}