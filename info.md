# Résultats de Recherche — Application Marées Perros-Guirec

## Source de données marées

### API principale (juin 2026) : SHOM directement
- Base : `https://services.data.shom.fr/<clé>/hdm` — la clé publique est embarquée
  dans le HTML de maree.shom.fr (champ `hdmServiceUrl`) ; en juin 2026 :
  `b2q8lrcdl4s04cbabsj4nhcb`.
- `GET /spm/hlt?harborName=PERROS-GUIREC_TRESTRAOU&duration=N&date=YYYY-MM-DD&utc=standard&correlation=1`
  → PM/BM (heures, hauteurs, **coefficients officiels**) par jour.
- `GET /spm/wl?harborName=...&duration=N&date=...&utc=standard&nbWaterLevels=288`
  → courbe de hauteur d'eau au pas de 5 min, référencée au zéro hydrographique.
- ⚠️ `utc=standard` renvoie l'**heure légale française** (heure d'été comprise) —
  vérifié le 10/06/2026 contre maree.info et le programme de la capitainerie
  (PM 14:44). Ce n'est PAS de l'UTC+1 : ne pas ajouter d'offset.
- ⚠️ L'API exige `Referer: https://maree.shom.fr/` et son WAF bloque les clients
  non-navigateur (curl/python → 403 même avec le bon Referer). Depuis une appli
  web il faut un proxy qui injecte le Referer (fait dans `vite.config.ts`,
  chemin `/api/shom`, dev + preview).

### API de repli : Open-Meteo Marine API
- URL: `https://marine-api.open-meteo.com/v1/marine`
- Gratuite, pas de clé API nécessaire, pas de rate limiting strict
- Paramètres : `latitude=48.82&longitude=-3.45&hourly=sea_level_height_msl`
  (⚠️ l'ancienne variable `sea_surface_height` n'existe plus — erreur 400)
- Résolution : 8km
- Donne les hauteurs d'eau horaires en mètres **référencées au niveau moyen (MSL)**,
  pas au zéro hydrographique
- ⚠️ Calibration mesurée contre le SHOM à Perros (juin 2026, stable de coef 49 à 93) :
  le modèle est **en avance de ~38 min** et décalé de **−5.9 m** par rapport aux
  hauteurs SHOM. Corriger : heures +38 min, hauteurs +5.9 m. Précision résultante
  ≈ ±5 min / ±15 cm.
- Limitation : ne fournit pas les coefficients ni les PM/BM

### API backup : Tide-Data.com
- URL: `https://api.tide-data.com`
- Données SHOM officielles, coefficients inclus
- Plan gratuit : 1000 requêtes/mois
- Nécessite une clé API (inscription)

### API météo (pression) : Open-Meteo Weather
- URL: `https://api.open-meteo.com/v1/forecast`
- Paramètres : `hourly=pressure_msl`, `timeformat=unixtime`, `timezone=Europe/Paris`
- Gratuite, pas de clé API

### Correction horaire (5 septembre 2026)
- Activée par défaut dans « Aujourd'hui », avec interrupteur conservé. « Prévisions » utilise toujours le mode automatique.
- Sur SHOM, chaque point de courbe et chaque hauteur PM/BM reçoit la correction correspondant à son instant (interpolation de la pression entre deux heures). Les heures PM/BM restent les références astronomiques SHOM ; les fenêtres sont recalculées sur la courbe corrigée.
- Requête météo couvrant tout l'horizon, avec jours adjacents pour minuit ; une requête partagée pour la semaine. Cache 30 minutes ; les deux pages relancent les calculs toutes les 5 minutes et au retour sur l'onglet. La date affichée est celle de récupération, pas celle de production du modèle.
- Une valeur météo absente, invalide ou expirée n'est jamais remplacée par 1013,25 hPa. Si un cycle entre deux BM contient un trou météo, ce cycle reste non corrigé et une alerte signale la couverture manquante. Pas d'extrapolation au-delà des données disponibles.
- Le curseur active une simulation à pression constante ; « Revenir au suivi automatique » retrouve la prévision horaire. Désactiver l'interrupteur supprime la correction SHOM.
- **Open-Meteo Marine inclut déjà le baromètre inverse** dans `sea_level_height_msl` : aucune correction supplémentaire automatique ou manuelle sur ce repli. L'interface l'indique. Source vérifiée : https://open-meteo.com/en/docs/marine-weather-api .
- Source météo : https://open-meteo.com/en/docs . La pression utilisée est ramenée au niveau de la mer (`pressure_msl`).
- Test de régression : données SHOM du 4 au 6 septembre 2026 dans `app/tests/fixtures/`. Le 5 à 12:46, PM 7,42 m ; à 1026,7 hPa, hauteur corrigée 7,2855 m et disparition du créneau de midi de 46 minutes.

## Formules de calcul validées

### Détection PM/BM
À partir des hauteurs horaires, détecter les maxima (PM) et minima (BM).

### Coefficient de marée
```
C = (H_PM - N₀) / 3.05 × 100
```
où N₀ est le niveau moyen de la mer pour la journée (moyenne de PM et BM).
En pratique, pour l'Atlantique français, le coefficient SHOM est calculé différemment (basé sur les composantes harmoniques). Pour l'application, on peut approximer ou récupérer la valeur si disponible.

### Hauteur d'eau à un instant quelconque (formule sinusoïdale)
```
h(t) = H_BM + (M/2) × [1 - cos(π × t / T)]
```
où :
- M = H_PM - H_BM (marnage)
- T = durée entre BM et PM (ou PM et BM)
- t = temps écoulé depuis la BM (ou PM)
- h(t) = hauteur d'eau à l'instant t

Précision : ±10-30 cm (suffisant pour la prédiction de porte)

### Effet barométrique
```
Δh = -(P - 1013.25) × 0.01  (en mètres)
```
où P est la pression atmosphérique en hPa.
Si P = 1023 hPa → Δh = -0.10m (niveau plus bas)
Si P = 983 hPa → Δh = +0.30m (niveau plus haut)

## Règles d'ouverture de la porte du port de Perros-Guirec

### Paramètres de l'automate
- **Hauteur d'ouverture** : 7,30 m
- **Fermeture** : Deux cas possibles :
  - Si H_PM > 7.6m (resp. 8m) → fermeture à 7.60m (coef < 70) ou 8m (coef > 70) à marée descendante
  - Si H_PM < 7.6m → fermeture à la PM

### Repères de renverse dans le bassin
- **Fin du jusant** : 5 heures avant chaque pleine mer (PM)
- **Fin du flot** : 1 heure 30 après chaque pleine mer (PM)
- Ces horaires sont des repères calculés. Une renverse proche de minuit peut être rattachée à une PM de la veille ou du lendemain.

### Marges de sécurité capitainerie
La capitainerie publie avec marge de sécurité (ex: calcul 16h30 → publié 16h). Ce qui est restrictif sur 2h d'ouverture. La porte ferme plutôt vers l'heure réelle calculée.

### Comportement réel
- Si le coefficient permet d'atteindre pile la hauteur de déclenchement mais seulement celle-ci, le port n'ouvre pas (ou très brièvement). Il faut une marge.
- Il arrive que la porte ferme avant la prévision → bateaux coincés en mer.

## Coordonnées
- Perros-Guirec : lat=48.8167, lon=-3.45
- Brest (référence) : lat=48.39, lon=-4.49

## Découverte importante
Perros-Guirec est un port principal SHOM avec ses propres prédictions directes. Les formules empiriques de correction depuis Brest (× 1.05 + 0.10) ne sont PAS correctes selon le SHOM. Il faut utiliser les données directes pour Perros-Guirec via API ou calculer à partir des hauteurs horaires.

## Architecture recommandée pour l'app
1. Appel à Open-Meteo Marine API pour obtenir les hauteurs d'eau horaires pour Perros-Guirec
2. Détection des PM/BM dans les données horaires
3. Calcul de la courbe de marée par interpolation sinusoïdale
4. Application des règles d'ouverture/fermeture
5. Récupération de la pression atmosphérique via Open-Meteo Weather
6. Correction barométrique optionnelle
7. Dashboard visuel avec courbe de marée, plages d'ouverture, compte à rebours
