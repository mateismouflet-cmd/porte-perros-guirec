# APIs de Donnees de Marees - Recherche Comprehensives
## Cotes Francaises : Brest et Perros-Guirec

**Date de recherche** : Juillet 2025
**Objectif** : Identifier les meilleures sources de donnees de marees pour predire les ouvertures de la porte du port de Perros-Guirec
**Donnees requises** : Heures PM/BM, Hauteurs d'eau PM/BM, Coefficients de maree

---

## Table des matieres

1. [Resume executif et recommandations](#1-resume-executif)
2. [API SHOM (Service Hydrographique et Oceanographique de la Marine)](#2-api-shom)
3. [Open-Meteo Marine API](#3-open-meteo-marine-api)
4. [Stormglass API](#4-stormglass-api)
5. [WorldTides API](#5-worldtides-api)
6. [Tide-Data.com API](#6-tide-datacom-api)
7. [TideCheck API](#7-tidecheck-api)
8. [REFMAR / Data.shom.fr (Observations)](#8-refmar-observations)
9. [Sites en ligne : maree.info et equivalents](#9-sites-en-ligne)
10. [Solutions Open Source et Librairies Python](#10-solutions-open-source)
11. [NOAA CO-OPS API](#11-noaa-co-ops-api)
12. [Modelles globaux FES2014 / FES2022](#12-modeles-globaux-fes)
13. [Meteo-France (via Open-Meteo)](#13-meteo-france)
14. [Comparatif de fiabilite](#14-comparatif-fiabilite)
15. [Matrice de decision](#15-matrice-de-decision)

---

## 1. Resume Executif et Recommandations

### Recommandation principale : Combinee "SHOM + Tide-Data.com"

Pour l'application de prediction des ouvertures de la porte de Perros-Guirec, la strategie optimale est une approche hybride :

| Priorite | Source | Usage |
|----------|--------|-------|
| **1** | **Tide-Data.com API** | Source principale quotidienne (PM/BM, hauteurs, coefficients) |
| **2** | **SHOM Vignettes gratuites** | Verification croisee et affichage officiel |
| **3** | **REFMAR observations** | Validation temps reel (quand disponible pour Perros-Guirec) |
| **4** | **Librairie PyFES** | Solution de backup offline si besoin |

### Top 5 des sources recommandees

| Rang | Source | Prix | Fiabilite | Facilite | Coefficients FR |
|------|--------|------|-----------|----------|-----------------|
| 1 | Tide-Data.com | Gratuit (1K req/mois) | Elevee (source SHOM) | Tres facile | Oui |
| 2 | SHOM SPM/SAPM | Payant (~300-500 EUR/an) | **Excellente** (reference) | Complexe | Oui |
| 3 | maree.info (widget) | Gratuit | Elevee (donnees SHOM) | Widget seulement | Oui |
| 4 | Open-Meteo Marine | **Gratuit** | Moyenne (modele 8km) | Tres facile | Non |
| 5 | Stormglass | 10 req/jour gratuites | Bonne | Facile | Non |

### Points cles

- **SHOM** est la seule source officielle et legale pour les coefficients de maree en France. Toutes les autres sources se basent sur les donnees SHOM (directement ou via des calculs harmoniques).
- **Open-Meteo** est excellent pour un prototypage rapide et gratuit mais sa resolution de 8km limite la precision en zone cotiere complexe comme Perros-Guirec.
- **Tide-Data.com** est l'API francaise la plus accessible avec un plan gratuit genereux et des donnees SHOM directes.
- **Stormglass** et **WorldTides** sont des options internationales fiables mais payantes pour un usage production.

---

## 2. API SHOM (Service Hydrographique et Oceanographique de la Marine)

### URL
- Portail : https://diffusion.shom.fr/services-numeriques/api-shom.html
- Boutique : https://diffusion.shom.fr/
- Data SHOM : https://data.shom.fr

### Gratuit / Payant

| Service | Prix | Details |
|---------|------|---------|
| **Vignettes horaires de maree** | **Gratuit** | Petite vignette (24h) et grande vignette (7 jours) |
| **Observations REFMAR** | **Gratuit** | Donnees temps reel via data.shom.fr |
| **Service de Prediction par Port (SPM)** | **Payant** | ~300-500 EUR/an selon l'usage |
| **Service de Prediction en tout Point (SAPM)** | **Payant** | Inclus SPM + prediction en coordonnees GPS |

### Parametres disponibles (SPM/SAPM)

- Heures et hauteurs de Pleines Mers (PM) et Basses Mers (BM)
- **Coefficients de maree** (specifique a la France)
- Hauteurs d'eau a pas de temps configurable (5, 10, 15, 30, 60 minutes)
- Calcul de seuil (recherche de creneaux horaires pour hauteur > ou < seuil)
- Formats : TXT, XML
- Periode : 01/01/1700 au 31/12/2100 (max 20 ans par calcul)

### Service de vignettes gratuit

Deux types de vignettes a integrer sur un site web :
- **Petite vignette** : Horaires PM/BM des 24 prochaines heures (heures + hauteurs + coefficients)
- **Grande vignette** : Horaires PM/BM des 7 prochains jours + graphique de maree dynamique

URL d'integration (exemple) : `https://services.data.shom.fr/horaires/...`

### Precision des donnees
- **Excellente** : C'est la reference nationale
- Donnees basees sur les constantes harmoniques propres du SHOM
- Coefficients de maree : calcul specifique francais
- Precision : quelques minutes sur les heures, quelques cm sur les hauteurs

### Facilite d'integration
- SPM/SAPM : Necessite une cle d'abonnement, integration SOAP/REST
- Vignettes : Simple iframe/widget a integrer
- REFMAR : API REST JSON/XML avec flux standardises (OGC SOS)

### Avantages
- Seule source officielle des coefficients de maree francais
- Donnees les plus fiables pour les cotes francaises
- Service vignette gratuit pour l'affichage
- Observations temps reel gratuites via REFMAR

### Inconvenients
- API programmatique payante pour les predictions
- Processus d'achat de cle peu agile
- Pas d'API REST moderne pour les predictions (formats XML/SOAP)

### Exemple de flux REFMAR (gratuit)
```
GET https://services.data.shom.fr/maregraphie/observation/json/{station_id}
  ?sources=0
  &dtStart=2025-01-15T00:00:00Z
  &dtEnd=2025-02-17T23:59:59Z
```
Limite : 31 jours par requete.

---

## 3. Open-Meteo Marine API

### URL
- Documentation : https://open-meteo.com/en/docs/marine-weather-api
- Blog : https://openmeteo.substack.com/

### Gratuit / Payant
- **Entierement gratuit**, open-source
- Pas de cle API requise
- Pas de limite de requetes (usage raisonnable)

### Parametres disponibles

| Variable | Description | Unite |
|----------|-------------|-------|
| `sea_level_height_msl` | Hauteur du niveau de la mer incluant les marees | metre |
| `ocean_current_velocity` | Vitesse des courants oceaniques | km/h |
| `ocean_current_direction` | Direction des courants | degres |
| `sea_surface_temperature` | Temperature de surface de la mer | Celsius |
| `wave_height` | Hauteur des vagues | metre |

**Important** : Pas de PM/BM directes, pas de coefficients. Il faut post-traiter les donnees `sea_level_height_msl` pour extraire les maxima/minima.

### Precision des donnees

- **Modele** : MeteoFrance SMOC Surface Merged Ocean Currents
- **Resolution** : 0.083 degres (~8 km)
- **Reference** : Global Mean Sea Level (pas LAT - Lowest Astronomical Tide)

**Avertissement officiel Open-Meteo** :
> "Tides and ocean currents are computed at 0.08 (~8 km) resolution using numerical models. Accuracy at coastal areas is limited. This is not suitable for coastal navigation and does not replace your nautical almanac. Use with caution!"

> "The model operates at an 8 km resolution, which cannot accurately capture complex coastlines. Tides and currents are highly localized, making precise modeling difficult."

### Facilite d'integration
- **Tres facile** : API REST simple, pas d'authentification
- Parametres : latitude, longitude, hourly variables
- Formats : JSON
- Exemple :
```bash
curl "https://marine-api.open-meteo.com/v1/forecast?latitude=48.81&longitude=-3.45&hourly=sea_level_height_msl"
```

### Avantages
- Gratuit et open-source
- Pas d'inscription necessaire
- Acces historique et previsions
- Integration facile
- Donnees meteo marine associees (vagues, courants, temperature)

### Inconvenients
- **Pas de coefficients de maree** (specificite francaise)
- **Pas d'heures PM/BM directes** (donnees horaires uniquement)
- Precision limitee en zone cotiere complexe (8km de resolution)
- Reference au niveau moyen mondial, pas au zero hydrographique francais
- Ne remplace pas les donnees SHOM pour la navigation cotiere

---

## 4. Stormglass API

### URL
- Site : https://stormglass.io/
- Documentation : https://docs.stormglass.io/
- Pricing : https://stormglass.io/pricing/

### Gratuit / Payant

| Plan | Prix | Limites |
|------|------|---------|
| **FREE** | 0 EUR/mois | 10 req/jour, tous parametres, **pas commercial** |
| **Small** | 19 EUR/mois | 500 req/jour |
| **Medium** | 49 EUR/mois | 5 000 req/jour, support, usage commercial |
| **Large** | 129 EUR/mois | 25 000 req/jour |

### Parametres disponibles (tide)

| Parametre | Description |
|-----------|-------------|
| `tideExtremes` | Heures et hauteurs des PM/BM |
| `tideHighLow` | Haute/Basse mer |
| `tideSeaLevel` | Niveau de la mer |

Autres parametres marins : wave height, swell, currents, water temperature, salinity, pH, oxygen, etc.

### Precision des donnees
- Sources multiples : ECMWF, NOAA, MetOffice UK, Met.no, DWD, FMI
- Precision globale, pas specifique France
- **Pas de coefficients de maree francais**
- Couverture mondiale

### Facilite d'integration
- API REST avec cle d'API
- Format JSON
- Exemple :
```bash
curl "https://api.stormglass.io/v2/tide/extremes/point?lat=48.81&lng=-3.45"
  -H "Authorization: YOUR_API_KEY"
```

### Avantages
- Donnees marines completes (vagues, courants, marees)
- Couverture mondiale
- Niveaux gratuits pour prototype
- Sources multiples agreegees

### Inconvenients
- Payant pour usage production/commercial
- Pas de coefficients de maree
- 10 req/jour seulement en gratuit
- Pas de specificite francaise

---

## 5. WorldTides API

### URL
- Site : https://www.worldtides.info/
- Developer : https://www.worldtides.info/developer

### Gratuit / Payant

| Plan | Prix | Credits |
|------|------|---------|
| **Inscription** | Gratuit | 100 credits offerts |
| Prepaye | 9.99 USD | 20 000 credits |
| Prepaye | 19.99 USD | 50 000 credits |
| Prepaye | 34.99 USD | 100 000 credits |
| Mensuel | 4.99 USD/mois | 20 000 credits |
| Mensuel | 9.99 USD/mois | 50 000 credits |
| Mensuel | 17.99 USD/mois | 100 000 credits |
| Mensuel | 29.99 USD/mois | 200 000 credits |

**Cout par prediction** :
- 7 jours de PM/BM (extremes) : 1 credit
- Hauteurs pour 7 jours (toutes les 30 min) : 1 credit supplementaire
- Datums : 1 credit

### Parametres disponibles

- Extremes (heures et hauteurs PM/BM)
- Hauteurs d'eau a intervalle regulier
- Datums (references verticales)
- Graphiques (option plot)

### Precision des donnees
- Basee sur des donnees harmoniques globales
- Couverture mondiale
- Pas de coefficients de maree francais
- Precision variable selon la zone (meilleure pres des stations maregraphiques)

### Facilite d'integration
- API REST simple
- Format JSON
- Exemple :
```bash
curl "https://www.worldtides.info/api/v3?heights&extremes&lat=48.81&lon=-3.45&key=YOUR_KEY"
```

### Avantages
- Tres economique pour faible volume
- API simple et bien documentee
- 100 credits gratuits pour tester
- Supporte differents datums

### Inconvenients
- Pas de coefficients de maree
- Precision moindre que SHOM en zone cotiere francaise
- Systeme de credits a gerer

---

## 6. Tide-Data.com API

### URL
- Site : https://tide-data.com/
- Documentation : https://tide-data.com/docs

### Gratuit / Payant

| Plan | Prix | Limites |
|------|------|---------|
| **Essai gratuit** | 0 EUR | 30 jours, 1 000 req/mois |
| **Starter** | Gratuit ? | 1 000 req/mois, tous ports, heures & coefficients |
| **Pro** | Payant | 50 000 req/mois, heures + coefficients + hauteurs, 5 ans historique |
| **Enterprise** | Sur mesure | Illimite, webhooks, SLA |

### Parametres disponibles

- **Heures et hauteurs de PM et BM**
- **Coefficients de maree**
- Plus de 60 ports de reference
- Cotation atlantique, Manche, Mediterranee
- Format JSON

### Precision des donnees
- **Source : SHOM** (Service Hydrographique et Oceanographique de la Marine)
- Donnees officielles francaises
- Mises a jour quotidiennes
- Uptime 99.9%+

### Facilite d'integration
- API REST avec cle API (header `Authorization`)
- Endpoint simple : `GET /tides/{port}`
- Exemple :
```bash
curl "https://www.tide-data.com/api/tides/Perros-Guirec" \
  -H "Authorization: YOUR_API_KEY"
```

### Avantages
- **Donnees SHOM officielles**
- **Coefficients de maree inclus**
- API REST moderne et simple
- Plan gratuit pour prototype
- Specifique a la France
- Plus de 60 ports couverts

### Inconvenients
- Plan production payant
- Essai gratuit limite a 30 jours / 1000 req
- Moins de ports que le SHOM directement (~60 vs 1000+)

---

## 7. TideCheck API

### URL
- Site : https://tidecheck.com/developers
- RapidAPI : Disponible aussi

### Gratuit / Payant

| Plan | Prix | Limites |
|------|------|---------|
| **Free** | 0 USD | 50 req/jour, 1 cle, previsions 37 jours |
| **Starter** | 9 USD/mois | 1 000 req/jour, 25 000/mois, historique |
| **Pro** | 29 USD/mois | 10 000 req/jour, 250 000/mois |
| **Business** | 79 USD/mois | 50 000 req/jour, 1 000 000/mois |

### Parametres disponibles

- Predictions de marees (heures et hauteurs PM/BM)
- Series temporelles minute par minute
- Heures lever/coucher du soleil
- Phases lunaires avec illumination
- Indicateurs de vives-eaux/mortes-eaux
- Ratings solunaires pour peche
- **20 000+ stations** dans 200+ pays

### Sources de donnees
- NOAA CO-OPS (USA)
- TICON-4 (international, CC-BY-4.0)
- FES2022 (modele global oceanique, AVISO+)

### Precision
- Predictions a 3 minutes et 2 cm pres vs predictions NOAA officielles
- Trois datums supportes : LAT, MLLW, MSL

### Facilite d'integration
- API REST avec cle `X-API-Key`
- Format JSON
- Response time < 50ms (Cloudflare Workers)
- Exemple :
```bash
curl "https://api.tidecheck.com/v1/tides?lat=48.81&lon=-3.45" \
  -H "X-API-Key: YOUR_KEY"
```

### Avantages
- 50 req/jour en gratuit (plus genereux que Stormglass)
- Tres grande couverture mondiale
- Donnees FES2022 pour les zones sans station maregraphique
- Rapide et bien documente

### Inconvenients
- Pas de coefficients de maree (systeme specifique a la France)
- Payant pour usage production
- Pour la France : donnees basees sur FES2022, pas directement SHOM

---

## 8. REFMAR / Data.shom.fr (Observations)

### URL
- Portail REFMAR : https://refmar.shom.fr/
- Data SHOM : https://data.shom.fr
- API : https://services.data.shom.fr/support/fr/services/refmar

### Gratuit / Payant
- **Entierement gratuit**
- Conforme INSPIRE / Open Data Etalab

### Parametres disponibles

- **Observations** de hauteur d'eau en temps reel (pas des predictions)
- Donnees de 142 stations maregraphiques francaises
- Metropole (40 stations RONIM) + Outre-mer
- Formats : JSON, XML, TXT
- Resolutions : haute frequence, validees horaires, validees temps differe

### Precision des donnees
- Donnees reelles mesurees (pas predites)
- Precision instrumentale : quelques mm a quelques cm
- Verification mensuelle par le SHOM

### Facilite d'integration
- API REST standard OGC SOS (Sensor Observation Service)
- Limite : 31 jours par requete
- Exemple :
```bash
curl "https://services.data.shom.fr/maregraphie/observation/json/{station_id}?sources=0&dtStart=...&dtEnd=..."
```

### Avantages
- Donnees reelles (pas predites) = tres fiable
- Gratuit et open data
- Stations francaises couvertes

### Inconvenients
- **Ce sont des observations, pas des predictions**
- Ne permet pas de predire les marees futures
- Limite a 31 jours de donnees par requete
- Perros-Guirec n'a pas necessairement une station REFMAR (verifier)
- Necessite d'identifier le bon station_id

---

## 9. Sites en Ligne : maree.info et Equivalents

### maree.info

- **URL** : https://maree.info/
- **Gratuit** : Oui, pour la consultation
- **Donnees** : Horaires PM/BM, coefficients, maregrammes, meteo
- **Source** : Donnees SHOM
- **Couverture** : Cotes francaises, belges, anglo-normandes
- **Perros-Guirec** : https://maree.info/66
- **API** : Aucune API documentee. Widget disponible.

### Autres sites

| Site | URL | API | Donnees |
|------|-----|-----|---------|
| maree.info | https://maree.info | Widget uniquement | PM/BM + coefficients + meteo |
| horaire-maree.fr | https://horaire-maree.fr | Non | Horaires PM/BM |
| maree.direct | https://www.maree.direct | Non | Comparatif applications |
| MeteoConsult | https://www.meteoconsult.fr | Non | Marees + meteo |

### Widget maree.info

Le site propose un widget "horloge des marees" a integrer :
```html
<iframe src="https://maree.info/horloge/..." ...></iframe>
```

### Avantages
- Donnees SHOM fiables
- Interface utilisateur eprouvee
- Gratuit pour consultation
- Coefficients de maree disponibles

### Inconvenients
- **Pas d'API programmatique**
- Pas de possibilite de scraping legal (conditions d'utilisation)
- Widget uniquement visuel (pas de donnees structurees)

---

## 10. Solutions Open Source et Librairies Python

### 10.1 PyTides

- **GitHub** : https://github.com/sam-cox/pytides
- **Description** : Prediction et analyse de marees par methodes harmoniques
- **Langage** : Python
- **Gratuit** : Oui (licence libre)

**Fonctionnement** :
- Utilise les constantes harmoniques (amplitude + phase) d'une station
- Calcule la prediction en sommant les contributions de chaque constituent
- Supporte les constituents NOAA

**Utilisation basique** :
```python
from pytides.tide import Tide
import numpy as np

# Avec des constantes harmoniques connues
tide = Tide.decompose(water_level_data, datetime_index)
prediction = tide.predict(future_datetimes)
```

**Avantage** : Une fois les constantes harmoniques SHOM obtenues, permet de calculer les marees sans dependance externe.

**Inconvenient** : Necessite les constantes harmoniques pour chaque port (disponibilite limitee pour la France - le SHOM ne les diffuse plus librement depuis 1999).

### 10.2 PyFES (AVISO/CNES)

- **Documentation** : https://cnes.github.io/aviso-fes/
- **Description** : Librairie officielle pour les modeles de marees FES2014 et FES2022
- **Organismes** : CNES, LEGOS, NOVELTIS, CLS
- **Gratuit** : Oui

**Architecture** :
- Moteur FES/Darwin : 99 constituents
- Moteur PERTH/Doodson : 80 constituents

**Utilisation** :
```python
import pyfes

# Chargement du modele
handler = pyfes.Handler("FES2014", "ocean", config_file)
date = numpy.datetime64("2025-07-01T12:00:00")

# Prediction
height, _, _ = handler(lat=48.81, lon=-3.45, date=date)
```

**Precision FES2014** :
- Ocean profond : RMS ~1.5 cm pour M2
- Plateau continental : RMS ~6-10 cm
- Zone cotiere : RMS ~10-25 cm
- FES2022 : Ameliorations significatives en zone cotiere

**Avantages** :
- Modele global scientifiquement valide
- Gratuit
- Pas de connexion Internet requise apres chargement du modele
- FES2022 ameliore significativement la precision cotiere

**Inconvenients** :
- Precision limitee en zone cotiere complexe (~10-25 cm d'erreur)
- **Pas de coefficients de maree francais**
- Necessite de telecharger les grilles FES (fichiers lourds)
- Les heures PM/BM necessitent un post-traitement (extraction des extrema)

### 10.3 pytmgpm (TMGPM)

- **GitHub** : https://github.com/hleroy/pytmgpm
- **Description** : Calculateur de marees base sur les donnees du livre TMGPM du SHOM (1982-1999)
- **Gratuit** : Oui (education uniquement)

**Avertissement** :
> "It must not by used for navigation. The book was later withdrawn from publication for security concerns."

**Inconvenient majeur** : Les constantes harmoniques ne sont plus publiees par le SHOM depuis 1999 pour des raisons de securite. Seuls quelques ports d'exemple sont disponibles.

### 10.4 UTide (Python)

- **GitHub** : https://github.com/wesleybowman/UTide
- **Description** : Analyse et prediction de marees par methode des moindres carres
- **Langage** : Python
- **Gratuit** : Oui

**Fonctionnalites** :
- Analyse harmonique classique
- Prediction de marees
- Constituents majeurs et mineurs
- Intervalles de confiance

### 10.5 pyTMD

- **Documentation** : https://pytmd.readthedocs.io/
- **Description** : Librairie Python pour la prediction de marees avec modeles OTIS, GOT, FES
- **Gratuit** : Oui

**Fonctionnalites** :
- Supporte FES2014, GOT4.10, TPXO9
- Calcul des arguments astronomiques
- Prediction avec corrections nodales

### 10.6 Home Assistant - marees_france

- **GitHub** : https://github.com/KipK/marees_france
- **Description** : Integration Home Assistant pour afficher les marees francaises
- **Source** : SHOM (via API interne)

**Entites crees** :
- `sensor.marees_france_[PORT]` : Etat de la maree (montante/descendante)
- `coefficient` : Coefficient de maree
- `current_height` : Hauteur actuelle
- `starting_height` / `finished_height` : Hauteurs debut/fin de cycle
- `starting_time` / `finished_time` : Heures debut/fin de cycle

---

## 11. NOAA CO-OPS API

### URL
- API : https://api.tidesandcurrents.noaa.gov/api/prod/
- Documentation : https://api.tidesandcurrents.noaa.gov/api/prod/

### Gratuit / Payant
- **Gratuit**
- Limite : 5 req/sec, 10 000 req/jour

### Parametres disponibles
- water_level, hourly_height, high_low
- predictions (predictions de marees)
- air_temperature, water_temperature, wind, air_pressure
- daily_mean, monthly_mean

### Applicabilite a la France

**Non applicable directement.** L'API NOAA CO-OPS ne couvre que :
- Les Etats-Unis
- Les territories americains
- Quelques stations internationales partenaires

**La France n'est pas couverte** par cette API. Cependant, les librairies Python (pyNOAA) peuvent servir de modele pour interroger les APIs europeennes.

---

## 12. Modeles Globaux FES2014 / FES2022

### Description
Les modeles FES (Finite Element Solution) sont des atlas globaux de marees oceaniques developpes par le CNES, LEGOS, NOVELTIS et CLS.

### FES2014
- **Resolution** : 1/16 degre (~6-7 km aux latitudes moyennes)
- **Constituents** : 34 (M2, S2, N2, K2, K1, O1, P1, Q1, etc.)
- **Donnees** : Elevations, courants, loading

### FES2022 (nouveau, juin 2024)
- **Resolution** : 1/16 degre, mais maillage ameliore en zone cotiere
- **Ameliorations** :
  - Bathymetrie amelioree en eaux peu profondes
  - Grille haute resolution affinee
  - Nouvelles donnees altimetriques et maregraphiques
  - T-UGO ameliore
  - **Ameliorations significatives en zones cotieres**

### Precision sur la France (cotier)

| Modele | RSS RMS (8 constituents) | Zone cotiere |
|--------|-------------------------|--------------|
| FES2014b | ~24.46 cm | Meilleur global en zone cotiere |
| EOT20 | Comparable | Tres bon |
| FES2022 | ~11-24 cm | Ameliore vs FES2014 |
| Modele local SHOM | **Quelques cm** | **Excellente** |

Les modeles globaux atteignent une precision de l'ordre de 10-25 cm en zone cotiere, ce qui est insuffisant pour la navigation precise mais peut suffire pour une estimation des ouvertures de port.

### Telechargement
- AVISO+ : https://www.aviso.altimetry.fr/
- CNES : https://cnes.github.io/aviso-fes/
- Acces gratuit apres inscription

---

## 13. Meteo-France (via Open-Meteo)

### URL
- API Open-Meteo : https://open-meteo.com/en/docs/meteofrance-api

### Parametres disponibles
Meteo-France ne fournit **pas directement** de predictions de marees. Cependant, via Open-Meteo :
- Modeles de vagues : MFWAM (MeteoFrance Wave Model)
- Courants oceaniques : SMOC (Surface Merged Ocean Currents)
- Niveau de la mer : sea_level_height_msl (incluant les marees)

### Resolution
- MFWAM : Global 0.083 (~8 km), 10 jours de prevision
- SMOC : Global 0.083 (~8 km), 10 jours de prevision

### Limites
- Pas de PM/BM directes
- Pas de coefficients de maree
- Resolution 8 km insuffisante pour les zones cotieres complexes

---

## 14. Comparatif de Fiabilite

### Echelle de fiabilite

| Niveau | Description | Sources |
|--------|-------------|---------|
| **Excellente** | Donnees officielles, constantes harmoniques locales, verification reguliere | SHOM SPM/SAPM |
| **Tres bonne** | Donnees SHOM via API tierce, coefficients inclus | Tide-Data.com, maree.info |
| **Bonne** | Modeles globaux valides, sources multiples | Stormglass, WorldTides, TideCheck |
| **Moyenne** | Modeles physiques globaux, resolution 8km | Open-Meteo, FES2014/2022 |
| **Limitee** | Observations seulement (pas de predictions) | REFMAR |

### Comparaison pour les besoins specifiques (Perros-Guirec)

| Critere | SHOM | Tide-Data | Open-Meteo | Stormglass | FES2022 |
|---------|------|-----------|------------|------------|---------|
| Heures PM/BM | Oui | Oui | Post-traitement | Oui | Post-traitement |
| Hauteurs PM/BM | Oui | Oui | Oui (MSL) | Oui | Oui |
| **Coefficients** | **Oui** | **Oui** | **Non** | **Non** | **Non** |
| Precision cotiere | Quelques cm | Quelques cm | ~10-30 cm | Variable | ~10-25 cm |
| Couverture FR | Complete | 60+ ports | Mondiale | Mondiale | Mondiale |
| Gratuit | Vignettes oui | 1K req/mois | Oui | 10 req/j | Oui (modele) |
| Facilite d'API | Complexe | Facile | Tres facile | Facile | Complexe |

---

## 15. Matrice de Decision

### Pour un prototype / MVP

| Option | Cout | Delai | Qualite |
|--------|------|-------|---------|
| **Open-Meteo** (sea_level_height_msl) | Gratuit | 1 jour | Moyenne |
| **Tide-Data.com** (essai gratuit) | Gratuit 30j | 1 jour | Tres bonne |
| **SHOM vignettes** | Gratuit | 1 jour | Bonne (widget) |

### Pour la production (application Perros-Guirec)

| Option | Cout mensuel | Qualite | Maintenance |
|--------|-------------|---------|-------------|
| **Tide-Data.com Pro** | ~Payant | Tres bonne | Faible |
| **Stormglass Medium** | 49 EUR/mois | Bonne | Faible |
| **TideCheck Starter** | 9 USD/mois | Bonne | Faible |
| **SHOM SPM/SAPM** | ~300-500 EUR/an | **Excellente** | Complexe |
| **PyFES + FES2022** | Gratuit (serveur) | Moyenne-bonne | Elevee |

### Recommandation finale

**Architecture recommandee pour l'application Perros-Guirec :**

```
+------------------+     +------------------+     +------------------+
|   Frontend App   |---->|  Tide-Data.com   |---->|    Donnees SHOM  |
|                  |     |  API (principal) |     |   (source verite)|
+------------------+     +------------------+     +------------------+
        |                         |
        | (fallback)              | (validation)
        v                         v
+------------------+     +------------------+
|  Open-Meteo      |     |  REFMAR obs      |
|  (backup gratuit)|     |  (temps reel)    |
+------------------+     +------------------+
```

1. **Source principale** : Tide-Data.com API (coefficients + heures + hauteurs)
2. **Backup** : Open-Meteo (gratuit, toujours disponible)
3. **Validation** : Comparaison avec REFMAR si station disponible pres de Perros-Guirec
4. **Affichage officiel** : Widget SHOM pour la confiance des utilisateurs

### Notes importantes

- Le **coefficient de maree** est un indicateur specifique a la France qui n'existe pas dans les API internationales. Pour obtenir les coefficients, il faut imperativement utiliser une source SHOM (Tide-Data.com, vignettes SHOM, ou SPM/SAPM).
- La **portee de Perros-Guirec** est un site complexe (cotes rocheuses, iles, chenaux). La precision des modeles globaux (FES, Open-Meteo) y sera degradee par rapport aux predictions SHOM qui utilisent des constantes harmoniques locales.
- Pour la **securite des usagers de la porte du port**, les donnees SHOM sont la seule reference legale. Il faut clairement indiquer que l'application fournit une "estimation a titre indicatif" et renvoyer vers les sources officielles.

---

## Annexes

### A. Coordonnees des ports d'interet

| Port | Latitude | Longitude |
|------|----------|-----------|
| Brest | 48.39 | -4.49 |
| Perros-Guirec | 48.81 | -3.45 |

### B. Ressources complementaires

| Ressource | URL |
|-----------|-----|
| SHOM - Marees | https://marees.shom.fr/ |
| REFMAR | https://refmar.shom.fr/ |
| Data SHOM | https://data.shom.fr |
| AVISO FES | https://www.aviso.altimetry.fr/ |
| Open-Meteo Marine | https://open-meteo.com/en/docs/marine-weather-api |
| PyFES Documentation | https://cnes.github.io/aviso-fes/ |
| maree.info | https://maree.info/ |
| tide-data.com | https://tide-data.com/ |
| tidecheck.com | https://tidecheck.com/developers |
| stormglass.io | https://stormglass.io/ |
| worldtides.info | https://www.worldtides.info/ |

### C. Bibliographie

- Lyard et al., 2021 - FES2014 global ocean tide atlas (Ocean Science, 17, 615-649)
- Hart-Davis et al., 2021 - EOT20 global ocean tide model (ESSD, 13, 3869)
- Stammer et al., 2014 - Accuracy assessment of global ocean tide models
- SHOM - Services numeriques API : https://diffusion.shom.fr/services-numeriques/api-shom.html
- Open-Meteo Blog - New Marine Models (2025)
