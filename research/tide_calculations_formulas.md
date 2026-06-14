# Formules de Correction de Marée : Brest (Port de Référence) → Perros-Guirec

## Document de référence pour le calcul des ouvertures de la porte automatique du port de Perros-Guirec

**Date de rédaction** : Avril 2026
**Sources** : SHOM (Service Hydrographique et Océanographique de la Marine), maree.info, maree.shom.fr, Annuaire des Marées SHOM, Bloc Marine Figaro Nautisme

---

## 1. Synthèse des résultats de validation

### 1.1 Résultat principal

**Perros-Guirec est un PORT PRINCIPAL SHOM** (ID maree.info : 66), doté de ses propres constantes harmoniques et de ses propres prédictions directes. Il **n'est PAS un port satellite (rattaché) de Brest** au sens officiel du SHOM.

### 1.2 Validation des formules fournies

| Formule fournie | Statut | Commentaire |
|-----------------|--------|-------------|
| Correction heures PM, coeff > 70 : +1h05 | **NON VALIDEE** | Les prédictions SHOM directes montrent un décalage de ~+88 à +90 min en vive-eau |
| Correction heures PM, coeff < 70 : +1h15 | **NON VALIDEE** | Les prédictions SHOM directes montrent un décalage de ~+78 à +84 min en morte-eau |
| Correction heures BM, coeff > 70 : +1h10 | **NON VALIDEE** | Même observation, le sens de variation est inversé par rapport aux données réelles |
| Correction heures BM, coeff < 70 : +1h20 | **NON VALIDEE** | La correction réelle augmente avec le coefficient, alors que la formule indique l'inverse |
| Hauteur PM : H_Perros = H_Brest × 1,05 + 0,10 | **INCORRECTE** | Écart systématique de ~+1,45 m avec les prédictions SHOM réelles |
| Hauteur BM : H_Perros = H_Brest (diff négligeable) | **INCORRECTE** | La différence réelle est de +0,44 m à +1,00 m selon le coefficient |

### 1.3 Recommandation

Pour la gestion automatique de la porte du bassin à flot de Perros-Guirec, il est **fortement recommandé** d'utiliser :
1. Les prédictions **directes** du SHOM pour Perros-Guirec (disponibles sur maree.shom.fr ou maree.info)
2. Ou la méthode harmonique avec les constantes harmoniques du port

Les formules empiriques fournies ne permettent pas d'obtenir la précision nécessaire (±10 cm) pour la gestion d'une porte automatique.

---

## 2. Méthode SHOM officielle pour les ports rattachés

### 2.1 Principe général

Pour les ports **satellites** (rattachés) d'un port principal, le SHOM fournit des corrections à appliquer aux prédictions du port principal. Ces corrections sont données pour :
- **Pleines Mers de Vives-Eaux** (PMVE, coefficient ~95)
- **Pleines Mers de Mortes-Eaux** (PMME, coefficient ~45)
- **Basses Mers de Mortes-Eaux** (BMME, coefficient ~45)
- **Basses Mers de Vives-Eaux** (BMVE, coefficient ~95)

**Source** : Notice "Marées à la carte" SHOM, Annexe 6 - Format des calculs des valeurs de rattachements

### 2.2 Corrections de hauteurs (méthode validée)

Les corrections aux hauteurs varient **proportionnellement** à la hauteur du port principal. Elles sont déterminées par **interpolation linéaire** :

```
Correction_hauteur = Correction_VE + (Correction_ME - Correction_VE) × (H_jour - H_VE) / (H_ME - H_VE)
```

Où :
- `H_jour` = hauteur d'eau au port principal le jour considéré
- `H_VE` = hauteur moyenne de vive-eau au port principal
- `H_ME` = hauteur moyenne de morte-eau au port principal
- `Correction_VE` = correction de hauteur pour la vive-eau (donnée SHOM)
- `Correction_ME` = correction de hauteur pour la morte-eau (donnée SHOM)

**Précision** : ±10 à 20 cm pour les ports bien caractérisés.

**Source** : SHOM Annuaire des Marées, Tome 1, §1.2.3.4.2 ; Notice "Marées à la carte"

### 2.3 Corrections d'heures (méthode validée)

**Règle cruciale** : L'interpolation linéaire entre la correction de vive-eau et celle de morte-eau **n'a pas de signification** pour les heures.

En métropole, pour une marée de type semi-diurne, la méthode SHOM indique d'appliquer :

| Situation | Correction à appliquer |
|-----------|----------------------|
| L'heure de la PM/BM au port principal est à **moins de 2h** de l'heure moyenne de PM/BM de vive-eau | Correction vive-eau |
| L'heure de la PM/BM au port principal est à **moins de 2h** de l'heure moyenne de PM/BM de morte-eau | Correction morte-eau |
| L'heure est à **plus de 2h** des heures moyennes VE et ME | **Moyenne arithmétique** des deux corrections |

**Source** : SHOM Annuaire des Marées, Tome 1, §1.2.3.3 et §1.2.3.4.1

### 2.4 Exemple de calcul (extrait SHOM)

**Problème** : Trouver l'heure et la hauteur de la basse mer au port rattaché, sachant que :
- BM du port principal à 11h00, hauteur = 3,00 m
- BM morte-eau du port principal : 4,30 m (correction port rattaché : -0,80 m)
- BM vive-eau du port principal : 1,50 m (correction port rattaché : -0,20 m)
- Heures moyennes BM : ME = 8h00, VE = 14h50

**Calcul de l'heure** :
- 11h00 - 8h00 = 3h00 après BM de ME
- 14h50 - 11h00 = 3h50 avant BM de VE
- Ni l'un ni l'autre n'est < 2h → on prend la moyenne : (+0h50 + +0h30) / 2 = **+0h40**
- Heure BM au port rattaché : **11h40**

**Calcul de la hauteur** (par interpolation linéaire sur le graphique ou par calcul) :
- Pour H = 3,00 m au port principal → correction = **-0,50 m**
- Hauteur BM au port rattaché : 3,00 - 0,50 = **2,50 m**

**Source** : SHOM Annuaire des Marées 2022, §1.2.3.4

---

## 3. Calcul du coefficient de marée

### 3.1 Définition

Le coefficient de marée est un nombre **sans dimension**, calculé pour le port de **Brest**, qui caractérise l'amplitude de la marée sur une échelle de 20 à 120.

### 3.2 Formule exacte

```
C = (H_PM - N₀) / U × 100
```

Où :
| Paramètre | Description | Valeur à Brest |
|-----------|-------------|----------------|
| `C` | Coefficient de marée (sans dimension) | 20 à 120 |
| `H_PM` | Hauteur de la pleine mer au-dessus du zéro hydrographique (m) | Variable |
| `N₀` | Hauteur du niveau de mi-marée au-dessus du zéro hydrographique (m) | ~4,13 m |
| `U` | Unité de hauteur = valeur moyenne de l'amplitude des vives-eaux d'équinoxe (m) | **3,05 m** |

Le marnage semi-diurne de référence pour C = 100 est donc de **2 × 3,05 = 6,10 m**.

### 3.3 Formule alternative (à partir du marnage)

```
C = Marnage_semi_diurne / 6,10 × 100
```

Où `Marnage_semi_diurne` est le marnage calculé uniquement à partir des ondes semi-diurnes de la formule harmonique.

### 3.4 Correspondance coefficients / types de marée

| Coefficient | Type de marée |
|-------------|---------------|
| 120 | Marées extraordinaires de vive-eau d'équinoxe |
| 95 | Marées de vive-eau moyenne |
| **70** | **Seuil vive-eau / morte-eau** |
| 45 | Marées de morte-eau moyenne |
| 20 | Marées de morte-eau les plus faibles |

**Règles** :
- Coefficient **> 70** → Marée de **vive-eau** (grand marnage)
- Coefficient **< 70** → Marée de **morte-eau** (petit marnage)
- Coefficient **≥ 100** → Grande marée

### 3.5 Précision et limites

- Le coefficient est calculé **uniquement à partir des ondes semi-diurnes**
- Les hauteurs d'eau prédites sont calculées avec **toutes les ondes** (semi-diurnes, diurnes, quart-diurnes, longues périodes)
- Pour un même coefficient, les hauteurs prédites peuvent légèrement varier (jusqu'à ~70 cm d'écart)
- Le coefficient est identique sur toutes les côtes de la Manche et de l'Atlantique (approximation valide)

**Source** : SHOM, Annuaire des Marées ; maree.info ; Wikipedia "Calcul de marée" ; Voiles et Voiliers

---

## 4. Calcul de la hauteur d'eau à un instant quelconque

### 4.1 Formule harmonique complète (SHOM)

La formule exacte utilisée par le SHOM pour les prédictions :

```
h(t) = Z₀ + Σᵢ fᵢ × Aᵢ × cos(Vᵢ(t) + uᵢ - Gᵢ)
```

Où :
| Paramètre | Description |
|-----------|-------------|
| `h(t)` | Hauteur d'eau à l'instant t (m) |
| `Z₀` | Niveau moyen (m au-dessus du zéro hydrographique) |
| `Aᵢ` | Amplitude de la composante harmonique i (constante du port) |
| `Gᵢ` | Phase (retard de phase) de la composante i (constante du port) |
| `fᵢ`, `uᵢ` | Corrections nodales (paramètres astronomiques lents) |
| `Vᵢ(t)` | Argument astronomique de la composante i à l'instant t |

Le SHOM utilise plusieurs dizaines de composantes harmoniques (M2, S2, N2, K2, K1, O1, etc.) pour obtenir une précision de quelques centimètres.

**Source** : SHOM, "La marée" (Ouvrage 941) ; Refmar (FORMULATION DE LA MÉTHODE DE CALCUL)

### 4.2 Approximation sinusoïdale (modèle simplifié)

Entre une pleine mer et une basse mer consécutives, la hauteur d'eau peut être approximée par une fonction cosinus :

```
h(t) = H_BM + (Marnage / 2) × [1 - cos(π × (t - t_BM) / (t_PM - t_BM))]
```

Pour une marée descendante (PM → BM) :
```
h(t) = H_PM - (Marnage / 2) × [1 - cos(π × (t - t_PM) / (t_BM - t_PM))]
```

Où :
| Paramètre | Description |
|-----------|-------------|
| `h(t)` | Hauteur d'eau à l'instant t (m) |
| `H_BM`, `H_PM` | Hauteurs de basse mer et pleine mer (m) |
| `Marnage` | H_PM - H_BM (m) |
| `t_BM`, `t_PM` | Heures de basse mer et pleine mer |
| `t` | Heure pour laquelle on calcule la hauteur |

**Précision** : ±10 à 30 cm selon les ports et les conditions. Valide uniquement pour les marées de type semi-diurne bien régulières.

**Source** : ENSM Le Havre, "Éléments sur les marées" (Stage FM 2019)

### 4.3 Exemple de formule sinusoïdale paramétrée

Pour un port donné, la hauteur d'eau peut s'écrire sous la forme :

```
h(t) = a × sin(ω × t + φ) + b
```

Avec :
- `a = Marnage_max / 2` (amplitude, moitié du marnage maximal)
- `b = (H_PM_max + H_BM_min) / 2` (niveau moyen)
- `ω = π / 6` rad/h (pulsation, période ≈ 12h25)
- `φ` = phase déterminée empiriquement à partir des observations

**Exemple pour Saint-Malo** (jour de grande marée) :
```
h(t) ≈ 5,9 × sin(πt/6 - 1,97) + 6,9
```

**Source** : Serge Mehl, "Marée et fonction sinus"

---

## 5. Méthode des douzièmes

### 5.1 Principe

La méthode des douzièmes est une approximation empirique de la courbe sinusoïdale, utilisée par les marins pour estimer rapidement la hauteur d'eau sans calcul trigonométrique.

### 5.2 Paramètres de base

```
Marnage = H_PM - H_BM
Heure_marée = |t_PM - t_BM| / 6
Douzième = Marnage / 12
```

### 5.3 Progression des douzièmes

| Heure-marée | Progression | Hauteur cumulée |
|-------------|-------------|-----------------|
| 1ère HM | +1/12 du marnage | 1/12 |
| 2ème HM | +2/12 du marnage | 3/12 (= 1/4) |
| 3ème HM | +3/12 du marnage | 6/12 (= 1/2) |
| 4ème HM | +3/12 du marnage | 9/12 (= 3/4) |
| 5ème HM | +2/12 du marnage | 11/12 |
| 6ème HM | +1/12 du marnage | 12/12 (= plein) |

### 5.4 Formule de calcul pour un instant quelconque

Pour un nombre décimal d'heures-marées écoulées depuis la BM (par exemple 2,75 HM) :

1. Calculer le nombre de douzièmes correspondant :
   - 1ère HM complète : 1 dz
   - 2ème HM complète : 2 dz (cumul : 3 dz)
   - Fraction de 3ème HM : (2,75 - 2) / 1 × 3 dz = 0,75 × 3 = 2,25 dz
   - **Total : 5,25 douzièmes**

2. Hauteur d'eau : `h = H_BM + 5,25 × (Marnage / 12)`

### 5.5 Précision de la méthode

- **Précision** : ±20 à 50 cm selon les cas
- **Limite** : Valide uniquement pour les marées de type semi-diurne régulières
- **Non applicable** : Saint-Malo, Le Havre (tenues du plein), zones à marée mixte ou diurne

**Source** : SHOM Annuaire des Marées ; Bateaux.com ; Loisirs-Nautic ; Glenans

---

## 6. Règles d'ouverture de la porte automatique de Perros-Guirec

### 6.1 Caractéristiques du bassin à flot

| Caractéristique | Valeur |
|-----------------|--------|
| Capacité | 612 places (40 visiteurs) |
| Niveau d'eau moyen maintenu | 2,50 m |
| Mur submersible | À la côte 7 m |
| Tirant d'eau maximum | 2,50 m |
| **Largeur du seuil basculant** | **12 m** (remplaçant l'ancienne porte de 5,85 m) |
| Mise en service du seuil | 2024-2025 |

**Source** : Ville de Perros-Guirec, Guide du Port 2025 ; ActuNautique ; Figaro Nautisme

### 6.2 Règles d'ouverture officielles (Bloc Marine)

| Coefficient | Période d'ouverture |
|-------------|---------------------|
| **> 70** | 1h30 avant PM → 1h30 après PM |
| **60 à 70** | 1h avant PM → 1h après PM |
| **50 à 60** | 1h avant PM → 30 min après PM |
| **45 à 50** | 30 min avant PM → fermeture **à la PM** |
| **< 45** | **Pas d'ouverture** |

### 6.3 Horaires de service du seuil

| Période | Horaires de service |
|---------|---------------------|
| Juin, Juillet, Août | 24h/24 |
| Avril, Mai, Septembre | 6h → 22h |
| Octobre → Mars | 8h → 20h |

### 6.4 Vigie et contact

- **Vigie porte du bassin à flot** : 02 96 23 19 03
- **Capitainerie** : 02 96 49 80 50
- **VHF** : Canal 9

### 6.5 Règles de fermeture déduites

Les règles fournies par l'utilisateur pour la fermeture sont cohérentes avec le fonctionnement d'un bassin à flot :

| Cas | Condition | Règle de fermeture |
|-----|-----------|-------------------|
| Cas 1 | PM > 7,6 m (coefficient élevé) | Fermeture à la côte descendante : 7,60 m (si coeff < 70) ou 8,00 m (si coeff > 70) |
| Cas 2 | PM < 7,6 m (coefficient faible) | Fermeture **à la PM** (la porte se ferme quand le niveau extérieur atteint son maximum) |

**Principe physique** : La porte/ seuil basculant s'ouvre quand le niveau extérieur est suffisamment élevé par rapport au niveau du bassin (2,50 m). La fermeture empêche l'eau de s'échapper du bassin quand le niveau extérieur descend.

### 6.6 Calcul de la hauteur d'ouverture (7,3 m)

Le seuil d'ouverture de 7,3 m correspond approximativement à :
- Un coefficient de **~50-55** selon les jours
- C'est le minimum pour que le niveau extérieur soit suffisamment au-dessus du niveau du bassin (2,50 m) pour permettre le passage avec un débit acceptable
- Avec ± quelques cm (ex: 7,33 m) pour tenir compte de l'incertitude

**Source** : Figaro Nautisme - Bloc Marine, fiche Port Perros-Guirec

---

## 7. Impact de la pression atmosphérique sur le niveau de la mer

### 7.1 Règle du baromètre inversé

```
Variation_niveau_mer (cm) = -1 × (P_atm - 1013) (hPa)
```

Où :
- `P_atm` = pression atmosphérique réelle au niveau de la mer (hPa)
- **1013 hPa** = pression atmosphérique de référence pour les prédictions SHOM
- Le signe **-1** indique qu'une baisse de pression entraîne une élévation du niveau

### 7.2 Exemples

| Pression atmosphérique | Effet sur le niveau de la mer |
|------------------------|------------------------------|
| 1023 hPa (anticyclone) | **-10 cm** (décote) |
| 1013 hPa (normale) | 0 cm (prédiction SHOM) |
| 1003 hPa (dépression) | **+10 cm** (surcote) |
| 993 hPa (forte dépression) | **+20 cm** (surcote) |
| 965 hPa (tempête) | **+48 cm** (surcote importante) |

### 7.3 Autres facteurs météorologiques

| Facteur | Mécanisme | Effet typique |
|---------|-----------|---------------|
| Vent de mer (onshore) | Poussée d'eau vers la côte | +10 cm à +1 m selon force/durée |
| Vent de terre (offshore) | Évacuation de l'eau | -10 cm à -50 cm |
| Houle | Accumulation d'énergie côtière | +quelques cm à dizaines de cm |

### 7.4 Précaution pour la navigation

Les prédictions SHOM sont calculées pour une pression de 1013 hPa et sans vent. En conditions réelles :
- Vérifier la pression atmosphérique sur les prévisions météo
- Une surcote de 20-30 cm peut être critique pour le passage d'une porte à hauteur limite
- Les effets météo sont **principalement locaux et temporaires**

**Source** : SHOM Notice "Marées à la carte" ; maree.direct ; Charente-Maritime (Étude aléas)

---

## 8. Documentation SHOM sur les ports satellites

### 8.1 Obtention des valeurs de rattachement

Le service "Marées à la carte" du SHOM (maree.shom.fr) fournit automatiquement :
- Les corrections en **heures** (h min)
- Les corrections en **hauteurs** (cm)
- Pour les PMVE (coef 95), PMME (coef 45), BMME (coef 45), BMVE (coef 95)

### 8.2 Ports rattachés à Brest (exemples)

Les ports suivants sont rattachés à Brest avec des corrections SHOM officielles :

| Port | Correction PM-VE | Correction PM-ME | Correction BM-ME | Correction BM-VE |
|------|-----------------|-----------------|-----------------|-----------------|
| Baie de Lampaul (Ouessant) | +10 min | +10 min | +5 min | 0 min |
| Île Molène | +10 min | +15 min | +20 min | +20 min |
| Le Conquet | 0 min | 0 min | +5 min | +5 min |
| Camaret-sur-Mer | -10 min | -10 min | -10 min | -15 min |
| Douarnenez | -10 min | -10 min | -10 min | -20 min |
| Île de Sein | -5 min | -5 min | -10 min | -15 min |

**Note** : Perros-Guirec **ne figure pas** dans la liste des ports rattachés à Brest, car c'est un port principal avec ses propres prédictions directes.

### 8.3 Méthode de calcul SHOM

Les prédictions sont calculées à l'aide de la **formule harmonique** à partir des caractéristiques de marée actuelles. Elles :
- Ne prennent pas en compte les variations météorologiques
- Sont disponibles de 01/01/1700 à +20 ans
- Ont une précision de quelques centimètres pour les ports principaux

**Source** : SHOM, Notice "Marées à la carte" ; maree.info

---

## 9. Données comparatives Brest vs Perros-Guirec (prédictions SHOM)

### 9.1 Données du 25 avril 2026 (morte-eau, coeff 44)

| | Brest | Perros-Guirec | Différence |
|---|-------|---------------|------------|
| PM1 | 00h12 / 5,58 m | 01h24 / 7,41 m | **+1h12 / +1,83 m** |
| BM1 | 06h46 / 2,55 m | 08h03 / 3,48 m | **+1h17 / +0,93 m** |
| PM2 | 13h06 / 5,37 m | 14h30 / 7,17 m | **+1h24 / +1,80 m** |
| BM2 | 19h20 / 2,76 m | 20h42 / 3,76 m | **+1h22 / +1,00 m** |

### 9.2 Données du 29 avril 2026 (vive-eau, coeff 74-77)

| | Brest | Perros-Guirec | Différence |
|---|-------|---------------|------------|
| PM1 | 04h25 / 6,43 m | 05h55 / 8,56 m | **+1h30 / +2,13 m** |
| BM1 | 10h48 / 1,64 m | 12h17 / 2,08 m | **+1h29 / +0,44 m** |
| PM2 | 16h47 / 6,49 m | 18h21 / 8,65 m | **+1h34 / +2,16 m** |

### 9.3 Analyse des écarts

| Paramètre | Observations | Conclusion |
|-----------|-------------|------------|
| Différence temporelle | Varie de +78 min (morte-eau) à +94 min (vive-eau) | Augmente avec le coefficient |
| Différence hauteur PM | Varie de +1,80 m (morte-eau) à +2,16 m (vive-eau) | Augmente avec le coefficient |
| Différence hauteur BM | Varie de +0,44 m (vive-eau) à +1,00 m (morte-eau) | Diminue avec le coefficient |
| Rapport PM | ~1,33 (constant) | Multiplicateur, pas offset |

### 9.4 Vérification de la formule de l'utilisateur

La formule `H_Perros = H_Brest × 1,05 + 0,10` ne fonctionne **pas** :
- Pour PM (Brest 5,58 m) : calcul = 5,96 m, réel = 7,41 m → **écart de +1,45 m**
- Pour PM (Brest 6,43 m) : calcul = 6,85 m, réel = 8,56 m → **écart de +1,71 m**

**Source** : maree.info (données SHOM officielles)

---

## 10. Résumé des formules validées et à vérifier

### Formules VALIDÉES (sources SHOM confirmées)

| # | Formule | Source | Précision |
|---|---------|--------|-----------|
| 1 | Coefficient : `C = (H_PM - N₀) / 3,05 × 100` | SHOM Annuaire | ± unité |
| 2 | Marnage : `M = H_PM - H_BM` | SHOM | Exact |
| 3 | Heure-marée : `HM = |t_PM - t_BM| / 6` | SHOM | ~ ±2 min |
| 4 | Douzième : `dz = M / 12` | SHOM/Glenans | Approximation |
| 5 | Hauteur (courbes types) : `h = f × M + H_BM` | SHOM | ±10-20 cm |
| 6 | Hauteur (sinusoïde) : `h(t) = H_BM + M/2 × [1 - cos(πt/T)]` | Cours marine | ±10-30 cm |
| 7 | Effet barométrique : `Δh = -(P - 1013) cm` | SHOM/Ifremer | ~ ±1 cm/hPa |
| 8 | Corrections hauteurs ports rattachés : interpolation linéaire | SHOM §1.2.3.4.2 | ±10-20 cm |
| 9 | Corrections heures ports rattachés : règle des ±2h ou moyenne | SHOM §1.2.3.3 | ±5-15 min |
| 10 | Formule harmonique : `h(t) = Z₀ + Σ fᵢAᵢcos(Vᵢ+uᵢ-Gᵢ)` | SHOM | ±2-5 cm |

### Formules à NE PAS UTILISER (non conformes SHOM)

| # | Formule | Problème identifié |
|---|---------|-------------------|
| 1 | `H_Perros = H_Brest × 1,05 + 0,10` | Écart systématique de +1,45 m ; Perros a ses propres prédictions directes |
| 2 | `H_Perros(BM) = H_Brest(BM)` | Différence réelle de +0,44 à +1,00 m |
| 3 | Corrections d'heures fournies (65-80 min) | Ne correspondent pas aux prédictions SHOM (+78 à +94 min) ; sens de variation inversé |

### Recommandations pour le système automatique

1. **Utiliser les prédictions directes du SHOM** pour Perros-Guirec via l'API maree.shom.fr
2. **Pour les hauteurs intermédiaires**, utiliser la formule sinusoïdale ou la méthode des douzièmes
3. **Intégrer une correction météo** (surcote/décote) à partir des prévisions de pression
4. **Ajouter une marge de sécurité** de 20-30 cm pour les effets météorologiques non prévisibles
5. **Seuil critique** : 7,3 m (±5 cm) correspond approximativement à un coefficient de 50-55

---

## 11. Références et liens

| Référence | Source | Lien |
|-----------|--------|------|
| SHOM - Marées à la carte | Service officiel | https://maree.shom.fr |
| Notice Marées à la carte (PDF) | SHOM | https://services.data.shom.fr/static/specifications/notice_marees_a_la_carte.pdf |
| maree.info - Données officielles | Site agréé SHOM | https://maree.info |
| maree.info - Ports rattachés Brest | Corrections SHOM | https://maree.info/82/ports-rattaches |
| maree.info - Perros-Guirec | Prédictions directes | https://maree.info/66 |
| Annuaire des Marées 2022 (PDF) | SHOM | https://www.skipperclub.lu/Downloads/shom/SHOM_annuaire_des_marees_tome1_2022.pdf |
| Refmar - Formulation méthode calcul | SHOM | https://refmar.shom.fr/sites/default/files/2024-01/TIPE_formulation.pdf |
| Refmar - Prédiction de marée | SHOM | https://refmar.shom.fr/sites/default/files/2025-01/GT-TSH_CatD_Fiche_Prediction_maree.pdf |
| Wikipedia - Calcul de marée | Encyclopédie | https://fr.wikipedia.org/wiki/Calcul_de_mar%C3%A9e |
| Figaro Nautisme - Perros-Guirec | Bloc Marine | https://figaronautisme.meteoconsult.fr/bloc-marine/info-port/234 |
| Guide du Port Perros-Guirec 2025 | Ville de Perros-Guirec | https://www.perros-guirec.com/app/uploads/perros-guirec/2025/06/GPort-Perros-Guirec-2025.pdf |
| Ville de Perros-Guirec - Ports | Informations | https://www.perros-guirec.com/ville/vie-quotidienne/les-ports/ |
| Marée et fonction sinus | Cours mathématique | http://serge.mehl.free.fr/anx/malo_sinus.html |
| Cours ENSM - Éléments sur les marées | École maritime | http://www.ressources.profmarine.fr/stageFM/AC_FS_maree(FM19).pdf |
| Manuel canadien des marées | DFO Canada | https://waves-vagues.dfo-mpo.gc.ca/library-bibliotheque/64374.pdf |
| Bernard Simon - La marée | IHO | https://legacy.iho.int/iho_pubs/CB/C-33/C-33_maree_simon_fr.pdf |
| Glenans - Calcul hauteur d'eau | Association | https://www.glenans.asso.fr/actualites/pourquoi-et-comment-calculer-la-hauteur-deau-due-aux-marees---2262 |
| maree.direct - Pression et marées | Site spécialisé | https://www.maree.direct/maree-meteo-pression-mer/ |
| Voiles et Voiliers - Coefficient | Magazine | https://voilesetvoiliers.ouest-france.fr/meteo/maree/coef-039216d0-9d45-ee4c-b4a4-30c63c071967 |

---

*Document établi à partir des sources officielles du SHOM et des données de maree.info (licence SHOM n°20/2015). Les formules empiriques non conformes à la méthodologie SHOM ont été identifiées et signalées.*
