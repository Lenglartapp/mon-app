// src/screens/HomeScreen.jsx
import React from "react";
import { S } from "../lib/constants/ui";
import AppTile from "../components/AppTile.jsx";
import { PencilRuler, Database, Boxes, GanttChart, Settings2, Truck, TrendingUp } from "lucide-react";
import { useViewportWidth } from "../lib/hooks/useViewportWidth";

// 🔐 ACL
import { useAuth } from "../auth";
import { can } from "../lib/authz";

// Calendrier des fêtes (index 0 = 1er du mois)
const FETES = [
  ["Marie","Basile","Geneviève","Odilon","Édouard","Melchior","Raymond","Lucien","Alix","Guillaume","Paulin","Tatiana","Yvette","Nina","Rémi","Marcel","Antoine","Prisca","Marius","Sébastien","Agnès","Vincent","Bernard","François de Sales","Paul","Timothée","Angèle","Thomas","Gildas","Martine","Don Bosco"],
  ["Ella","Présentation","Blaise","Véronique","Agathe","Gaston","Eugénie","Jacqueline","Apolline","Arnaud","Lourdes","Félix","Béatrice","Valentin","Claude","Julienne","Alexis","Bernadette","Gabin","Aimée","Damien","Isabelle","Lazare","Modeste","Roméo","Nestor","Anne-Line","Romain","Auguste","Martine"],
  ["Aubin","Charles","Guénolé","Casimir","Olive","Colette","Félicité","Jean de Dieu","Françoise","Vivien","Rosine","Justine","Rodrigue","Mathilde","Louise","Bénédicte","Patrick","Cyrille","Joseph","Herbert","Clémence","Léa","Victorien","Cathy","Annonciation","Larissa","Habib","Gontran","Gwladys","Amédée","Benjamin"],
  ["Hugues","Sandrine","Richard","Isidore","Irène","Marcellin","Baptiste","Julie","Gautier","Fulbert","Stanislas","Jules","Ida","Maxime","Paterne","Benoît-Joseph","Anicet","Parfait","Emma","Odette","Anselme","Alexandre","Georges","Fidèle","Marc","Alida","Zita","Valérie","Catherine","Pio","Robert"],
  ["Fête du Travail","Boris","Philippe","Sylvain","Judith","Prudence","Gisèle","Victoire","Pacôme","Solange","Estelle","Achille","Rolande","Matthias","Denise","Honoré","Pascal","Éric","Yves","Bernardin","Constantin","Émile","Didier","Donatien","Sophie","Bérenger","Augustin","Germain","Maximin","Ferdinand","Visitation"],
  ["Justin","Blandine","Kévin","Clotilde","Igor","Norbert","Gilbert","Médard","Diane","Landry","Barnabé","Guy","Antoine","Élisée","Germaine","Régis","Hervé","Léonce","Romuald","Sylvère","Rodolphe","Paulin","Audrey","Jean-Baptiste","Prosper","Anthelme","Fernand","Irénée","Pierre","Martial"],
  ["Thierry","Martinien","Thomas","Florent","Antoine","Mariette","Raoul","Thibaut","Amandine","Ulrich","Benoît","Olivier","Henri","Aimé","Donald","Eustache","Charlotte","Frédéric","Arsène","Marina","Victor","Marie-Madeleine","Brigitte","Christine","Jacques","Nathalie","Liliane","Samson","Marthe","Juliette","Ignace"],
  ["Alphonse","Julien","Lydie","Jean-Marie","Abel","Transfiguration","Gaétan","Dominique","Amour","Laurent","Claire","Clarisse","Hippolyte","Evrard","Assomption","Armel","Hyacinthe","Hélène","Jean-Eudes","Bernard","Christophe","Fabrice","Rose","Barthélemy","Louis","Natacha","Monique","Augustin","Sabine","Fiacre","Aristide"],
  ["Gilles","Ingrid","Grégoire","Rosalie","Raïssa","Bertrand","Reine","Nativité","Alain","Inès","Adelphe","Apollinaire","Aimé","Sainte-Croix","Roland","Edith","Lambert","Nadège","Émilie","Davy","Matthieu","Maurice","Constance","Thècle","Hermann","Côme","Vincent","Venceslas","Michel","Jérôme"],
  ["Thérèse","Léger","Gérard","François","Fleur","Bruno","Serge","Pélagie","Denis","Ghislain","Firmin","Wilfrid","Géraud","Juste","Thérèse d'Avila","Edwige","Baudouin","Luc","René","Adeline","Céline","Élodie","Jean","Claret","Crépin","Dimitri","Émeline","Simon","Narcisse","Bienheureux","Quentin"],
  ["Toussaint","Défunts","Hubert","Charles","Sylvie","Bertille","Carine","Geoffrey","Théodore","Léon","Martin","Christian","Brice","Sidoine","Albert","Marguerite","Élisabeth","Aude","Tanguy","Edmond","Présentation","Cécile","Clément","Flora","Catherine","Delphine","Sévrin","Jacques","Saturnin","André"],
  ["Florence","Viviane","François-Xavier","Barbara","Gérald","Nicolas","Ambroise","Immaculée Conception","Pierre Fourier","Romaric","Daniel","Jeanne","Lucie","Odile","Ninon","Alice","Gaël","Gatien","Urbain","Abraham","Pierre Canisius","Françoise-Xavière","Armand","Adèle","Noël","Étienne","Jean","Innocents","David","Roger","Sylvestre"],
];

// Jours qui s'affichent tels quels (pas de "Saint" devant)
const JOURS_SPECIAUX = new Set([
  "Fête du Travail","Toussaint","Défunts","Noël","Assomption",
  "Transfiguration","Présentation","Annonciation","Immaculée Conception",
  "Sainte-Croix","Nativité","Visitation","Innocents","Lourdes",
]);

function getFete() {
  const now = new Date();
  const name = FETES[now.getMonth()]?.[now.getDate() - 1];
  if (!name) return null;
  return JOURS_SPECIAUX.has(name) ? name : `Saint ${name}`;
}

function pickGreeting(name) {
  const n = name?.split(" ")[0] || "";
  const h = new Date().getHours();
  const day = new Date().getDay(); // 0=dim, 1=lun … 6=sam
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Lundi matin
  if (day === 1 && h < 12) return `Bonne semaine ${n},`;

  // Matin (6h–12h)
  if (h >= 6 && h < 12) return pick([
    `Bonjour ${n},`,
    `Bonne matinée ${n},`,
    `Nous sommes d'attaque ${n} !`,
  ]);

  // Midi (12h–14h)
  if (h >= 12 && h < 14) return pick([
    `Bonjour ${n},`,
    `Comment allez-vous ${n} ?`,
  ]);

  // Après-midi (14h–18h)
  if (h >= 14 && h < 18) return pick([
    `Salut ${n},`,
    `Comment allez-vous ${n} ?`,
    `Que faisons-nous ${n} ?`,
    `Nous sommes d'attaque ${n} !`,
  ]);

  // Soirée et nuit
  return pick([
    `Bonsoir ${n},`,
    `Comment allez-vous ${n} ?`,
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
          {getFete() && `, ${getFete()}`}
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