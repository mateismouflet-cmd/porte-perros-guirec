# Plan - Application de Prédiction des Ouvertures du Port de Perros-Guirec

## Contexte
Construire une application web (dashboard) pour prédire les horaires d'ouverture/fermeture de la porte automatique du port de Perros-Guirec basée sur les calculs de marées.

## Spécifications Fonctionnelles
1. Récupération des données de marée pour Brest (SHOM ou API météo marine)
2. Corrections pour Perros-Guirec (temps + hauteurs)
3. Calcul des horaires d'ouverture/fermeture de la porte
4. Correction pression atmosphérique
5. Dashboard visuel avec prédictions du jour

## Stages

### Stage 1 — Recherche
- Identifier la source de données marées la plus fiable (SHOM API, Stormglass, Open-Meteo, etc.)
- Vérifier les calculs de correction et la méthodologie
- Tester l'accès aux données de marée pour Brest et Perros-Guirec
- **Compétence**: `deep-research-swarm`

### Stage 2 — Développement WebApp
- Frontend: React + TypeScript + Tailwind + shadcn/ui
- Calculs de marée côté client
- Dashboard avec:
  - Vue du jour : horaires PM/BM Brest vs Perros
  - Hauteurs d'eau corrigées
  - Plages d'ouverture de la porte (vert = ouvert, rouge = fermé)
  - Compteur temps restant avant fermeture
  - Correction pression atmosphérique (input utilisateur)
  - Vue semaine
- **Compétence**: `vibecoding-webapp-swarm`

### Stage 3 — Déploiement
- Déployer en statique
- Livrer l'URL à l'utilisateur

## Règles de la Porte (à implémenter)
- Ouverture à 7,3m (± quelques cm, ex: 7,33m)
- Fermeture cas 1 (PM > 7,6m): à 7,60m (coef < 70) ou 8m (coef > 70) à marée descendante
- Fermeture cas 2 (PM < 7,6m): fermeture à la PM
- Marge capitainerie: ils publient avec marge de sécurité (ex: 16h30 réel → 16h publié)
