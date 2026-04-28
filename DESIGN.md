---
name: Droit Fil
description: Outil de gestion de production confection sur mesure — droit fil, ça file droit.
colors:
  toile-de-coton: "#FAF5EE"
  bleu-heritage: "#1E2447"
  bleu-majorelle: "#1B3269"
  sable-datelier: "#CEAB95"
  terre-de-cuivre: "#BB7051"
  voile-de-lin: "#E6E6FF"
  noir-intemporel: "#191919"
  blanc-chaud: "#FEFCF8"
typography:
  display:
    fontFamily: "Roboto, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.3px"
  headline:
    fontFamily: "Roboto, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "Roboto, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Roboto, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Roboto, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "1.2px"
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "16px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  menu-row:
    backgroundColor: "#FEFCF8"
    textColor: "#191919"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  menu-row-hover:
    backgroundColor: "#F0E5D6"
    textColor: "#191919"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  icon-pill-default:
    backgroundColor: "#EDE0CE"
    textColor: "{colors.bleu-heritage}"
    rounded: "{rounded.md}"
    size: "40px"
  icon-pill-hover:
    backgroundColor: "{colors.bleu-heritage}"
    textColor: "{colors.blanc-chaud}"
    rounded: "{rounded.md}"
    size: "40px"
  button-primary:
    backgroundColor: "{colors.bleu-heritage}"
    textColor: "{colors.blanc-chaud}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.bleu-majorelle}"
    textColor: "{colors.blanc-chaud}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
---

# Design System: Droit Fil

## 1. Overview

**Creative North Star: "Le Droit Fil"**

Dans la confection, le droit fil est la ligne invisible qui ordonne tout : respecter le sens des fibres, c'est garantir que le tissu tombe juste, que la pièce tient. L'interface Droit Fil opère par la même logique. Chaque écran a une direction. Chaque élément est à sa place. Rien ne flotte, rien ne dérive.

La personnalité visuelle est celle d'un atelier haut de gamme : chaud sans être décoratif, précis sans être froid. La palette vient du matiau — Toile de Coton, Sable d'Atelier, Terre de Cuivre — et l'accent Bleu Héritage ancre l'ensemble dans le sérieux professionnel. Roboto, lisible et contemporain, disparaît dans la tâche.

Ce système refuse explicitement l'esthétique ERP générique (Odoo, SAP), les interfaces "blindées" de données sans air, et tout ce qui fait "logiciel de gestion de 2012". L'élégance ici est fonctionnelle : chaque décision visuelle sert la clarté, jamais la décoration.

**Key Characteristics:**
- Fond chaud Toile de Coton sur toutes les surfaces principales
- Bleu Héritage utilisé avec parcimonie : accent primaire, jamais décor
- Sable d'Atelier comme accent secondaire chaleureux (chevrons, highlights, micro-détails)
- Roboto sur toute la hiérarchie typographique — une seule famille, bien accordée
- Ombres uniquement à l'état (hover/focus) — plat au repos
- Aéré par décision, jamais par oubli

## 2. Colors: La Palette de l'Atelier

Une palette extraite des matières : fil, toile, sable, cuivre. Le Bleu Héritage est l'autorité ; le reste est chaleur.

### Primary
- **Bleu Héritage** (`#1E2447`): La couleur d'autorité. Icônes au hover, texte des titres forts, état actif de navigation. Utilisé sur ≤15% de chaque surface.
- **Bleu Majorelle** (`#1B3269`): Variante du Bleu Héritage pour hover profond sur boutons principaux. Jamais utilisé seul — toujours en réponse à une interaction.

### Secondary
- **Sable d'Atelier** (`#CEAB95`): L'accent chaud. Chevrons de navigation, indicateurs d'état discrets, micro-détails. Sa chaleur rappelle le matiau sans l'encombrer.
- **Terre de Cuivre** (`#BB7051`): Réservé aux états d'alerte chaleureux, CTA secondaires forts, ou accents dans des contextes très spécifiques. Utiliser avec parcimonie.

### Neutral
- **Toile de Coton** (`#FAF5EE`): Fond universel de toutes les pages. Jamais remplacé par du blanc pur — la chaleur est dans le fond.
- **Blanc Chaud** (`#FEFCF8`): Surface des composants "flottants" (cartes, items de menu, inputs). Légèrement plus clair que le fond pour créer la profondeur sans ombre.
- **Voile de Lin** (`#E6E6FF`): Teinte froide-douce pour les surfaces secondaires, tags d'état neutres, fonds alternés dans les tableaux de données.
- **Noir Intemporel** (`#191919`): Texte principal. Jamais `#000000` — le noir chaud est moins agressif sur fond crème.

### Named Rules
**La Règle du Droit Fil.** Le Bleu Héritage est la couleur d'autorité. Il n'apparaît pas en décoration. Chaque usage doit être justifié : action primaire, état actif, icône au focus. Utiliser librement, c'est le diluer.

**La Règle du Fond Chaud.** Le fond est Toile de Coton (#FAF5EE), partout, toujours. Blanc pur interdit en fond de page. La chaleur vient du fond, pas des accents.

## 3. Typography

**Font unique:** Roboto (Google Fonts: weights 400, 500, 700) — `Roboto, system-ui, -apple-system, sans-serif`

**Caractère:** Roboto humaniste et géométrique — il projette modernité et sérieux sans froideur. Un seul corps pour toute la hiérarchie : les graisses font le travail que d'autres systèmes confient à des familles multiples.

### Hierarchy
- **Display** (700, 22px, lh 1.2, ls -0.3px): Salutations, titres d'écran principaux. Jamais dans les tableaux ou les listes compactes.
- **Headline** (700, 18px, lh 1.3): Titres de sections, headers de modales.
- **Title** (500, 15px, lh 1.4): Labels des items de navigation, éléments interactifs principaux.
- **Body** (400, 14px, lh 1.55): Texte de contenu, descriptions, champs. Max 70ch en prose.
- **Label** (700, 10px, lh 1, ls 1.2px, MAJUSCULES): En-têtes de sections, catégories de navigation, métadonnées. Toujours en majuscules.

### Named Rules
**La Règle de la Graisse.** 400 pour lire, 500 pour identifier, 700 pour structurer. Pas d'intermédiaires ni de mélange de graisses sur un même niveau.

## 4. Elevation

Droit Fil est plat au repos. Les ombres répondent aux états, elles ne décorent pas.

### Shadow Vocabulary
- **Ambient (repos):** `0 1px 3px rgba(30,36,71,0.05)` — présence minimale sur les éléments flottants (cartes, menu rows). Invisible à l'écran, perceptible au cerveau.
- **Lifted (hover):** `0 4px 20px rgba(30,36,71,0.10)` — apparaît au survol. L'élément s'élève vers l'utilisateur.
- **Elevated (modal/popover):** `0 16px 48px rgba(30,36,71,0.18)` — réservé aux surfaces flottantes au-dessus du contenu.

### Named Rules
**La Règle du Repos Plat.** Aucun élément interactif n'a d'ombre forte au repos. Les ombres profondes récompensent l'interaction — hover, focus, drag. Un repos ombré est un mensonge sur l'état.

## 5. Components

### Menu Rows (composant signature)
La navigation principale de Droit Fil. Généreux, tactile, immédiatement lisible.

- **Shape:** Gently curved (14px radius)
- **Default:** Fond Blanc Chaud `#FEFCF8`, bordure `#E6DDD2` 1px, ombre ambient
- **Hover:** Fond `#F0E5D6` (Toile de Coton + touche Sable), bordure `#D4C5B5`, ombre Lifted, `translateY(-1.5px)`
- **Icon pill:** 40×40px, radius 10px — fond `#EDE0CE` + icône Bleu Héritage au repos ; fond Bleu Héritage + icône Blanc Chaud au hover
- **Chevron:** Sable d'Atelier `#CEAB95` au repos, Bleu Héritage au hover, `translateX(3px)` au hover
- **Label:** Roboto 500, 15px, Noir Intemporel
- **Transition:** 140ms ease-out sur background, shadow, transform, border-color

### Buttons
- **Shape:** Gently curved (10px radius)
- **Primary:** Fond Bleu Héritage, texte Blanc Chaud, padding 10px 18px, Roboto 500
- **Primary hover:** Fond Bleu Majorelle, `translateY(-1px)`, ombre Lifted
- **Secondary / Ghost:** Bordure Bleu Héritage 1px, fond transparent, texte Bleu Héritage

### Cards / Containers
- **Corner Style:** 14–16px radius
- **Background:** Blanc Chaud `#FEFCF8`
- **Shadow:** Ambient au repos, Lifted au hover si cliquable
- **Border:** `#E6DDD2` 1px — présent, jamais gras
- **Internal Padding:** 14–16px

### Inputs / Fields
- **Style:** Fond Blanc Chaud, bordure `#E6DDD2` 1px, radius 8px
- **Focus:** Bordure Bleu Héritage 2px, pas d'ombre externe — le changement de bordure suffit
- **Error:** Bordure Terre de Cuivre `#BB7051`
- **Label:** Roboto 700 12px, Noir Intemporel, au-dessus du champ

### Navigation (Section Labels)
Labels de catégorie au-dessus des groupes de navigation : Roboto 700, 10px, MAJUSCULES, letter-spacing 1.2px, couleur `#9E8E7E` (warm mid-gray). Spacing 22px entre chaque section.

## 6. Do's and Don'ts

### Do:
- **Do** utiliser Toile de Coton `#FAF5EE` comme fond universel de toutes les pages, sans exception.
- **Do** charger Roboto depuis Google Fonts (weights 400, 500, 700) — c'est la police de la marque.
- **Do** appliquer le Sable d'Atelier `#CEAB95` comme accent chaud secondaire : chevrons, highlights discrets, indicateurs.
- **Do** laisser de l'air. Un écran aéré n'est pas un écran incomplet — c'est un écran qui respecte l'utilisateur.
- **Do** utiliser les ombres uniquement en réponse aux états (hover, focus, elevation). Pas d'ombre décorative.
- **Do** grouper les items de navigation par domaine métier avec des section labels en majuscules.
- **Do** tester chaque composant avec des données réelles — noms longs, modules masqués par ACL, états vides.

### Don't:
- **Don't** utiliser blanc pur `#ffffff` en fond de page. Le fond est toujours Toile de Coton ou Blanc Chaud.
- **Don't** reproduire l'esthétique ERP générique : tableaux imbriqués, bordures partout, hiérarchie plate, densité sans air.
- **Don't** utiliser le Bleu Héritage en fond de grandes surfaces — c'est une couleur d'accent, pas de fond.
- **Don't** mélanger Roboto avec une autre famille typographique — une seule famille, toujours.
- **Don't** ajouter des ombres permanentes aux éléments interactifs au repos — elles appartiennent au hover.
- **Don't** créer de nouvelles couleurs hors de la palette. Si une couleur manque, utiliser un tonal de la palette existante.
- **Don't** utiliser `border-left` épais en couleur comme accent sur des items — interdit par la grammaire du système.
- **Don't** faire "vieux logiciel" : pas d'icônes clipart, pas de gradients texte, pas de glassmorphism décoratif.
