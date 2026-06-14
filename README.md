# Marées Perros-Guirec — horaires d'ouverture de la porte du port

Tableau de bord web (en français) qui calcule **les vrais horaires d'ouverture et de
fermeture de la porte à flot automatique du port de Perros-Guirec** (Côtes-d'Armor),
à partir des prédictions de marée officielles du SHOM.

La porte du port s'ouvre et se ferme selon la hauteur d'eau. Connaître la marée ne
suffit pas : l'automate suit des règles de seuil précises, et la capitainerie publie
des horaires volontairement restrictifs (marge de sécurité). Cette application affiche
**les horaires réellement calculés, sans la marge** — pour savoir quand on peut
sortir et quand il faut rentrer.

## Fonctionnement

- **Ouverture** : quand la marée montante franchit **7,33 m**.
- **Fermeture**, selon la pleine mer (PM) et le coefficient :
  - PM ≤ 7,60 m → fermeture **à la pleine mer** ;
  - PM > 7,60 m et coef < 70 → fermeture sur la descente à **7,60 m** ;
  - PM > 7,60 m et coef ≥ 70 → fermeture sur la descente à **8,00 m**.

Tous les calculs tournent dans le navigateur. La seule pièce côté serveur est un proxy
(intégré au serveur de dev Vite) qui relaie les appels à l'API du SHOM.

## Sources de données

1. **SHOM** (principale) — prédictions officielles du port principal
   `PERROS-GUIREC_TRESTRAOU` : heures et hauteurs PM/BM, **coefficients officiels**,
   et courbe de hauteur d'eau au pas de 5 min, référencée au zéro hydrographique
   (la même référence que les seuils de la porte).
2. **Open-Meteo Marine** (repli) — recalée sur le SHOM si celui-ci est indisponible
   (précision dégradée, signalée par un bandeau).
3. Jeu de démonstration embarqué en dernier recours.

> ⚠️ Outil indicatif. La capitainerie peut à tout moment modifier la programmation de
> l'automate par mesure exceptionnelle. Toujours vérifier auprès du port.

## Lancer l'application

Sous Windows, double-cliquer sur **`Lancer l'appli.bat`** (démarre le serveur et ouvre
le navigateur). Sinon, en ligne de commande :

```bash
cd app
npm install
npm run dev      # → http://localhost:3000
```

Node ≥ 20.19 est requis pour le serveur de dev (Vite 7).

## Structure

```
app/                  Application React + TypeScript + Vite
├── src/lib/tideEngine.ts   Toute la logique marées / porte
├── src/pages/Home.tsx      « Aujourd'hui » — statut, courbe, fenêtres du jour
└── src/pages/Predictions.tsx  « Prévisions » — 7 jours
info.md, plan.md, research/   Règles métier et choix techniques (source de vérité)
```

Voir [`CLAUDE.md`](CLAUDE.md) pour les détails d'architecture et les subtilités de l'API SHOM.
