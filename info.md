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
- Paramètre : `hourly=surface_pressure`
- Gratuite, pas de clé API

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
- **Hauteur d'ouverture** : 7.3 m (± quelques cm, ex: 7.33m)
- **Fermeture** : Deux cas possibles :
  - Si H_PM > 7.6m (resp. 8m) → fermeture à 7.60m (coef < 70) ou 8m (coef > 70) à marée descendante
  - Si H_PM < 7.6m → fermeture à la PM

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
