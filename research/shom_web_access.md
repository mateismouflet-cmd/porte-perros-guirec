# Recherche : Acces aux Donnees de Maree du SHOM

> Date d'enquete : Juin 2025
> Objectif : Obtenir quotidiennement les horaires de maree pour Brest
> Cible : https://maree.shom.fr / https://services.data.shom.fr

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Option 1 : API Officielle SHOM (Payante)](#2-option-1--api-officielle-shom-payante)
3. [Option 2 : Service REFMAR (Gratuit - Observations)](#3-option-2--service-refmar-gratuit---observations)
4. [Option 3 : Service de Vignettes (Gratuit)](#4-option-3--service-de-vignettes-gratuit)
5. [Option 4 : Geoservices OGC (Partiellement Gratuits)](#5-option-4--geoservices-ogc-partiellement-gratuits)
6. [Option 5 : Scraping du site maree.shom.fr](#6-option-5--scraping-du-site-mareeshomfr)
7. [Option 6 : Integration Home Assistant marees_france](#7-option-6--integration-home-assistant-marees_france)
8. [Option 7 : Alternatives Externes](#8-option-7--alternatives-externes)
9. [Option 8 : Bibliotheques Python (Calcul Harmonique)](#8-option-8--bibliotheques-python-calcul-harmonique)
10. [Comparatif et Recommandation](#10-comparatif-et-recommandation)
11. [Conditions d'Utilisation](#11-conditions-dutilisation)
12. [Annexes](#12-annexes)

---

## 1. Vue d'ensemble

Le SHOM (Service Hydrographique et Oceanographique de la Marine) propose plusieurs niveaux d'acces a ses donnees de maree :

| Niveau | Type d'acces | Cout | Usage |
|--------|-------------|------|-------|
| Site web maree.shom.fr | Consultation interactive | Gratuit | Humain uniquement |
| API SPM/SAPM | REST API avec cle | Payant | Programmatique - Predictions |
| Service REFMAR | SOS/REST API | Gratuit | Programmatique - Observations passees |
| Vignettes | Widget HTML/JS | Gratuit | Integration site web |
| Geoservices OGC | WMS/WFS/WMTS | Partiellement gratuit | Cartographie |

**Point cle** : Il n'existe **pas d'API publique et gratuite** pour les predictions de maree du SHOM. Les donnees de prediction necessitent un abonnement payant. Les donnees d'observation (REFMAR) sont gratuites mais different des predictions.

---

## 2. Option 1 : API Officielle SHOM (Payante)

### Description
L'API officielle du SHOM pour les predictions de maree est le **Service Unique de Prediction de Maree (SPM)** et le **Service de Prediction en tout Point (SAPM)**.

### URLs
- **Documentation** : https://services.data.shom.fr/support/fr/services/spm
- **Swagger/OpenAPI** : https://services.data.shom.fr/spm/doc/
- **Specification YAML** : https://services.data.shom.fr/support/sites/default/files/2026-03/service_spm_fr.yaml
- **Base URL API** : `https://services.data.shom.fr/spm`
- **Boutique pour souscription** : https://diffusion.shom.fr/marees/horaires-des-marees/marees_a_la_carte.html

### Endpoints

#### 2.1. Liste des ports (GET /listHarbors)
```
GET https://services.data.shom.fr/spm/listHarbors
```
**Reponse** : XML avec les attributs de chaque port :
- `cst` = identifiant du site (ex: BREST)
- `name` = nom du site
- `country` = pays
- `defaultUT` = fuseau horaire par defaut
- `additionalUT` = fuseaux horaires disponibles
- `isCoeffAvailable` = coefficients disponibles (1/0)
- `isOfficial` = site officiel (1/0)
- `hLegale` = heures legales disponibles (1/0)

#### 2.2. Verification d'acces (GET /{cle}/spm/checkaccess)
```
GET https://services.data.shom.fr/{cle}/spm/checkaccess
```
**Authentification** : Basic Auth (identifiant + mot de passe associes a la cle)

#### 2.3. Prediction de maree (POST /{cle}/spm)
```
POST https://services.data.shom.fr/{cle}/spm
```
**Parametres** :
| Parametre | Obligatoire | Description | Exemple |
|-----------|------------|-------------|---------|
| `harborName` | Oui | Identifiant du port | BREST |
| `functions` | Oui | Type de prediction (hlt, wl, wt) | hlt |
| `utc` | Oui | Fuseau horaire | standard |
| `date` | Oui | Date de debut (AAAA-MM-JJ) | 2024-01-15 |
| `endDate` | Non* | Date de fin (AAAA-MM-JJ) | 2024-01-22 |
| `duration` | Non* | Duree en jours (1-7305) | 7 |
| `correlation` | Non | Coefficients de maree (0 ou 1) | 1 |
| `nbWaterLevels` | Cond. | Pas de temps (24, 48, 96, 144, 288, 1440) | 24 |
| `waterThreshold` | Cond. | Seuil en cm | 180 |
| `sign` | Cond. | Signe du seuil (0=inf, 1=sup) | 0 |

* : Obligatoire si l'autre n'est pas specifiee

**Fonctions disponibles** :
- `hlt` : Heures et hauteurs des pleines et basses mers + coefficients
- `wl` : Hauteurs d'eau a un pas de temps donne (1, 5, 10, 15, 30, 60 minutes)
- `wt` : Calcul de seuils d'eau

**Reponse** : Reference de commande permettant de telecharger les resultats
**Telechargement** : `https://services.data.shom.fr/{cle}/telechargement/spm/SPM_{numeroDeCommande}/file/commande.zip`

### Formats de sortie
- TXT
- XML

### Periode couverte
- Du 01/01/1700 au 31/12/2100
- Duree maxi par calcul : 20 ans

### Securite requise
- TLS 1.2 minimum obligatoire
- Authentification Basic Auth avec cle d'abonnement

### Couts
- **SUP Maree** : Prix sur demande (environ 100-300 EUR/an selon l'usage)
- **SAPM** : Inclut l'acces au SUP Maree, prix superieur
- Voir https://diffusion.shom.fr/marees/horaires-des-marees/marees_a_la_carte.html

---

## 3. Option 2 : Service REFMAR (Gratuit - Observations)

### Description
Le service REFMAR fournit l'acces aux **observations** du niveau de la mer mesurees par les maregraphes. Ce sont des mesures reelles, PAS des predictions.

### URLs
- **Documentation** : https://services.data.shom.fr/support/fr/services/refmar
- **Base URL (JSON/XML)** : `https://services.data.shom.fr/maregraphie/sos/service`
- **Base URL (TXT)** : `https://services.data.shom.fr/fast-sos/service/txt`
- **Tutoriel** : https://refmar.shom.fr/donnees-refmar-sur-data.shom.fr/telechargement-des-donnees

### Endpoints

#### 3.1. Capacites (GET)
```
GET https://services.data.shom.fr/maregraphie/sos/service?request=GetCapabilities
```

#### 3.2. Observations (GET)
```
GET https://services.data.shom.fr/maregraphie/observation/{format}/{idMaregraphe}?sources={sources}&dtStart={debut}&dtEnd={fin}
```

**Exemple - Donnees de Brest (id=3) du 3 au 9 juillet 2019** :
```bash
wget -O reponse.txt "https://services.data.shom.fr/maregraphie/observation/txt/3?sources=1&dtStart=2019-07-03T00:00:00Z&dtEnd=2019-07-09T23:59:59Z"
```

**Parametres** :
| Parametre | Description | Valeurs |
|-----------|------------|---------|
| `format` | Format de sortie | json, pox (xml), txt |
| `idMaregraphe` | Identifiant du maregraphe | 3 (Brest), 68 (Toulon), etc. |
| `sources` | Type de donnees | 0=toutes, 1=brutes HF, 2=brutes differees, 3=validees differees, 4=validees horaires |
| `dtStart` | Date de debut (ISO 8601) | 2019-07-03T00:00:00Z |
| `dtEnd` | Date de fin (ISO 8601) | 2019-07-09T23:59:59Z |

#### 3.3. Observations (POST - JSON)
```bash
POST https://services.data.shom.fr/maregraphie/sos/service
Content-Type: application/json

{
  "request": "GetObservation",
  "procedure": ["https://shom.fr/maregraphie/procedure/68"],
  "observedProperty": ["https://shom.fr/maregraphie/observedProperty/WaterHeight/0"],
  "temporalFilter": [{"during": {"ref": "om:phenomenonTime", "value": ["2014-01-15T00:00:00Z", "2015-02-17T23:59:59Z"]}}]
}
```

### Identifiants de maregraphes connus
| ID | Port |
|----|------|
| 3 | Brest |
| 54 | Roscoff |
| 68 | Toulon |

### Limitations
- **Max 31 jours** par requete
- Donnees d'observation uniquement (pas de predictions)
- Ne couvre pas tous les ports (uniquement les maregraphes REFMAR)

### Format de la reponse (JSON)
```json
{
  "result": {
    "uom": "m",
    "value": 5.69
  },
  "samplingTime": "2015-01-15T13:34:17.000Z"
}
```

---

## 4. Option 3 : Service de Vignettes (Gratuit)

### Description
Service permettant de generer des widgets HTML/JS pour afficher les horaires de maree sur un site web.

### URL
- **Generation** : https://maree.shom.fr/vignette

### Types de vignettes

#### Petite vignette
- Horaires de maree d'un port pour les **24 prochaines heures**
- Heures, hauteurs des pleines et basses mers + coefficients
- Adaptee pour les bandeaux lateraux

#### Grande vignette
- Horaires de maree d'un port pour les **7 prochains jours**
- Heures, hauteurs des pleines et basses mers + coefficients
- Graphique de la maree du jour (dynamique et interrogeable)
- Adaptee pour la partie centrale d'une page

### Parametres URL
```
https://maree.shom.fr/vignette?harbor=BREST
```

### Exemple d'integration
```html
<iframe src="https://maree.shom.fr/vignette?harbor=BREST" width="300" height="400"></iframe>
```

---

## 5. Option 4 : Geoservices OGC (Partiellement Gratuits)

Le SHOM expose des services geographiques standards OGC via data.shom.fr.

### 5.1. WMS (Web Map Service)
- **Raster** : `https://services.data.shom.fr/INSPIRE/wms/r?service=WMS&version=1.3.0&request=GetCapabilities`
- **Vecteur** : `https://services.data.shom.fr/INSPIRE/wms/v?service=WMS&version=1.3.0&request=GetCapabilities`
- Reprojection a la volee, interrogation d'objets

### 5.2. WMTS (Web Map Tile Service)
- **URL** : `https://services.data.shom.fr/INSPIRE/wmts?request=GetCapabilities&Version=1.0.0&service=WMTS`
- Images pre-calculees, plus performant que WMS

### 5.3. WFS (Web Feature Service)
- **URL** : `https://services.data.shom.fr/INSPIRE/wfs?service=WFS&version=2.0.0&request=GetCapabilities`
- Acces aux objets vecteur des bases de donnees
- Donnees ouvertes sous licence ouverte / CC-BY-SA

### 5.4. ncWMS (Previsions oceanographiques)
- **URL** : `https://services.data.shom.fr/ncwms2/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`
- Visualisation des previsions oceanographiques

### Donnees maree disponibles via WFS
- Types de marees dans le monde
- Courants de maree 3D (Loire, etc.)
- Atlas de courants de surface (Brest, Iroise, Finistere)

---

## 6. Option 5 : Scraping du site maree.shom.fr

### Architecture du site
Le site maree.shom.fr est une application **Ember.js** (version 2.3.1) qui consomme des API internes.

### Endpoints internes decouverts
Extraits de la configuration de l'application (balise meta) :

```json
{
  "wlEndpoint": "/spm/wl",
  "hltEndpoint": "/spm/hlt",
  "coeffEndpoint": "/spm/coeff",
  "wfsHarborUrl": "https://services.data.shom.fr/x13f1b4faeszdyinv9zqxmx1/wfs?...",
  "hdmServiceUrl": "https://services.data.shom.fr/b2q8lrcdl4s04cbabsj4nhcb/hdm",
  "zoneFeatures": "https://services.data.shom.fr/x13f1b4faeszdyinv9zqxmx1/wfs?..."
}
```

### Routes de l'application
- `/harbor/:harbor_id` - Page d'un port
- `/harbor/:harbor_id/hlt` - Pleines et basses mers
- `/harbor/:harbor_id/wl` - Hauteurs d'eau
- `/harbor/:harbor_id/coeff` - Coefficients

### Exemple de page pour Brest
- **HLT (Pleines/Basses)** : `https://maree.shom.fr/harbor/BREST/hlt/0?date=2024-01-15&utc=standard`
- **WL (Hauteurs eau)** : `https://maree.shom.fr/harbor/BREST/wl?date=2024-01-15&utc=standard`
- **Coefficients** : `https://maree.shom.fr/harbor/BREST/coeff?date=2024-01-15&utc=standard`

### Structure des donnees dans le HTML
Les donnees sont rendues cote client dans des elements div avec des classes specifiques. Exemple pour les HLT :
```html
<div>
  <span>01:40</span>  <!-- heure basse mer -->
  <span>1.23</span>   <!-- hauteur (metres) -->
  <span>---</span>    <!-- coefficient (si PM) -->
  <span>07:43</span>  <!-- heure pleine mer -->
  <span>7.24</span>   <!-- hauteur -->
  <span>94</span>     <!-- coefficient -->
</div>
```

### Methode de scraping possible
```python
import requests
from bs4 import BeautifulSoup

url = "https://maree.shom.fr/harbor/BREST/hlt/0?date=2024-01-15&utc=standard"
headers = {"User-Agent": "Mozilla/5.0"}
response = requests.get(url, headers=headers)
soup = BeautifulSoup(response.text, "html.parser")
# Parser les divs contenant les donnees de maree
```

### Avertissements
- Le site indique "(C) 2022 SHOM. Tous droits reserves."
- Pas de mentions specifiques autorisant le scraping
- L'API interne est protegee (validation referer/authentification)
- Le site peut changer sa structure sans preavis
- **Scraping deconseille** pour un usage professionnel

---

## 7. Option 6 : Integration Home Assistant marees_france

### Description
Integration communautaire pour Home Assistant qui affiche les marees francaises depuis le SHOM.

### Informations
- **Auteur** : @KipK
- **GitHub** : https://github.com/KipK/marees_france
- **Installation** : via HACS

### Fonctionnalites
- Capteur de maree actuelle (montante/descendante)
- Prochaines marees (heure, hauteur, coefficient)
- Niveau d'eau courant (interpolation lineaire)
- Temperature de l'eau
- Coefficients de maree
- Vignettes graphiques

### Services disponibles
- `marees_france.get_tides_data`
- `marees_france.get_water_levels`
- `marees_france.get_coefficients_data`
- `marees_france.get_water_temp`
- `marees_france.reinitialize_harbor_data`

### Acces aux donnees
L'integration utilise des requetes HTTP vers les serveurs du SHOM (probablement maree.shom.fr ou services.data.shom.fr) avec gestion de cache locale. Le code source montre l'utilisation de `aiohttp` pour les appels asynchrones.

### Entites crees
| Entite | Description |
|--------|-------------|
| `sensor.marees_france_[PORT]` | Donnees de maree |
| `sensor.[PORT]_current_height` | Hauteur d'eau courante |
| `sensor.[PORT]_water_temp` | Temperature de l'eau |
| `sensor.[PORT]_next_high_tide` | Prochaine pleine mer |
| `sensor.[PORT]_next_low_tide` | Prochaine basse mer |
| `sensor.[PORT]_next_spring_tide` | Prochaines marees de vives-eaux |
| `sensor.[PORT]_next_neap_tide` | Prochaines marees de mortes-eaux |

---

## 8. Option 7 : Alternatives Externes

### 8.1. Stormglass.io
- **URL** : https://stormglass.io/
- **Free tier** : 10 requetes/jour
- **Paid plans** : 19 EUR/mois (500 req/jour), 49 EUR/mois (5000 req/jour)
- **Donnees** : Maree (extremes, haut/bas, niveau de la mer), meteo marine
- **Format** : JSON
- **Avantage** : API globale simple

### 8.2. WorldTides
- **URL** : https://www.worldtides.info/
- **Free tier** : Limite (environ 100 req/jour)
- **Paid plans** : A partir de ~10 EUR/mois
- **Donnees** : Predictions de maree globales
- **Format** : JSON

### 8.3. NOAA CO-OPS (USA uniquement)
- **URL** : https://api.tidesandcurrents.noaa.gov/
- **Cout** : Gratuit
- **Limitation** : Stations americaines uniquement

### 8.4. Open-Meteo
- **URL** : https://open-meteo.com/
- **Cout** : Gratuit (usage non commercial)
- **Donnees** : Meteo marine incluant niveaux de maree
- **Note** : Donnees modelisees, pas officielles

---

## 9. Option 8 : Bibliotheques Python (Calcul Harmonique)

### 9.1. pyTMD
- **URL** : https://pytmd.readthedocs.io/
- **Description** : Prediction de maree utilisant les modeles FES, TPXO, etc.
- **Installation** : `pip install pyTMD`
- **Usage** : Chargement des constituants harmoniques + calcul des predictions
- **Avantage** : Precis, base sur des modeles scientifiques

### 9.2. Pytides
- **URL** : https://github.com/sam-cox/pytides
- **Description** : Analyse et prediction de maree par constituents harmoniques
- **Installation** : `pip install pytides`
- **Usage** : Analyse de series temporelles + prediction

### 9.3. Pytide (CNES)
- **URL** : https://github.com/CNES/pangeo-pytide
- **Description** : Analyse des constituents harmoniques (base sur FES2014)
- **Installation** : `conda install pytide -c conda-forge`
- **Note** : Projet archive, integre dans pyfes

### 9.4. UTide
- **URL** : https://github.com/wesleybowman/UTide
- **Description** : Analyse harmonique des marees (methode Codiga)
- **Installation** : `pip install utide`

---

## 10. Comparatif et Recommandation

### Tableau comparatif

| Critere | API SHOM (payante) | REFMAR (gratuit) | Scraping | Vignettes | Stormglass |
|---------|-------------------|------------------|----------|-----------|------------|
| Cout | 100-300 EUR/an | Gratuit | Gratuit | Gratuit | 19 EUR/mois |
| Legalite | 100% legale | 100% legale | Grise | 100% legale | 100% legale |
| Fiabilite | Officielle SHOM | Mesures reelles | Fragile | Officielle | Modelisee |
| Type de donnees | Predictions | Observations passees | Predictions | Predictions | Predictions |
| Periode | 1700-2100 | Historique seul | 1 an | 7 jours | 10 jours |
| Format | TXT/XML | JSON/XML/TXT | HTML | HTML/JS | JSON |
| Automatisable | Oui | Oui | Non recommande | Partiellement | Oui |
| Coefficients | Oui | Non | Oui | Oui | Non |

### Recommandation

#### Pour un usage professionnel/industriel :
**Souscrire a l'API SPM (SUP Maree) du SHOM**
- C'est la seule source officielle et legale de predictions de maree en France
- Les donnees sont fiables et couvertes par le service public
- Le cout est raisonnable pour un usage professionnel

#### Pour un usage personnel/prototype :
**Option 1 : Service REFMAR (observations)**
- Gratuit et fiable
- Limitation : historique uniquement, pas de predictions

**Option 2 : Stormglass.io (free tier)**
- 10 requetes/jour gratuites
- Predictions globales
- Simple a integrer

#### Pour un usage avec Home Assistant :
- Utiliser l'integration `marees_france` par KipK
- Fonctionne directement avec les donnees du SHOM

#### A eviter :
- Le scraping du site maree.shom.fr (instable, non autorise explicitement)

---

## 11. Conditions d'Utilisation

### Cles extraites des CGV du SHOM

1. **Propriete intellectuelle** :
   > "L'integralite du contenu des pages editoriales et des documents diffuses par le site appartient a l'editeur et est protegee par les dispositions du code de la propriete intellectuelle."

2. **Donnees administratives** :
   > "Les documents proposes sur le site ne peuvent pas faire l'objet de l'exercice, par le public, d'un droit d'acces aux documents administratifs institué par la loi du 17/07/1978."

3. **Licences** :
   - Certaines donnees (types de marees, courants) sont sous **Licence Ouverte Etalab**
   - Les predictions officielles necessitent un abonnement payant
   - Les cartes et ouvrages sont soumis a des conditions specifiques

4. **Usage du site maree.shom.fr** :
   - "(C) 2022 SHOM. Tous droits reserves."
   - Le site est gratuit pour consultation interactive
   - Aucune API publique documentee pour un usage automatise

---

## 12. Annexes

### A. Exemple d'appel API REFMAR avec curl

```bash
# GetCapabilities
curl -s "https://services.data.shom.fr/maregraphie/sos/service?request=GetCapabilities"

# Observation Brest (id=3) en JSON
curl -s "https://services.data.shom.fr/maregraphie/observation/json/3?sources=1&dtStart=2024-01-01T00:00:00Z&dtEnd=2024-01-31T23:59:59Z"

# Observation Brest en TXT
curl -s "https://services.data.shom.fr/maregraphie/observation/txt/3?sources=4&dtStart=2024-01-01T00:00:00Z&dtEnd=2024-01-10T23:59:59Z"
```

### B. Exemple d'appel API SPM (avec cle d'abonnement)

```bash
# Liste des ports
curl -s "https://services.data.shom.fr/spm/listHarbors"

# Prediction HLT pour BREST (requiert authentification)
curl -u "user:pass" -X POST \
  "https://services.data.shom.fr/{CLE}/spm?harborName=BREST&functions=hlt&utc=standard&date=2024-01-15&duration=7&correlation=1"
```

### C. Coordonnees de Brest
- **Identifiant SHOM** : BREST
- **Latitude** : 48deg 22' 57.0'' N (48.3825)
- **Longitude** : 4deg 29' 41.0'' W (-4.4947)
- **Fuseau horaire par defaut** : UTC+0 (standard)

### D. Structure de la reponse HTML pour Brest (hlt)

Exemple de donnees pour le 15 janvier 2024 :
| Type | Heure | Hauteur (m) | Coefficient |
|------|-------|------------|-------------|
| Basse mer | 01:40 | 1.23 | --- |
| Pleine mer | 07:43 | 7.24 | 94 |
| Basse mer | 14:07 | 1.09 | --- |
| Pleine mer | 20:08 | 6.75 | 91 |

### E. Ressources et liens utiles

| Ressource | URL |
|-----------|-----|
| Site maree.shom.fr | https://maree.shom.fr |
| API Shom (documentation) | https://services.data.shom.fr/support/fr/services |
| Data.shom.fr | https://data.shom.fr |
| Diffusion.shom.fr | https://diffusion.shom.fr |
| REFMAR | https://refmar.shom.fr |
| GitHub marees_france (HA) | https://github.com/KipK/marees_france |
| pyTMD | https://pytmd.readthedocs.io/ |
| Pytides | https://github.com/sam-cox/pytides |
| Stormglass | https://stormglass.io/ |
| WorldTides | https://www.worldtides.info/ |

---

*Document genere lors d'une exploration approfondie des services du SHOM pour l'acces aux donnees de maree.*
