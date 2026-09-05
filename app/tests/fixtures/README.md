# Données de régression SHOM

Les fichiers `shom-2026-09-04-hlt.json` et `shom-2026-09-04-wl.json` contiennent
les réponses publiques SHOM consultées le 5 septembre 2026, via le proxy de l'application.

- Port : `PERROS-GUIREC_TRESTRAOU`
- Début : `2026-09-04`, durée : 3 jours, `utc=standard`
- `spm/hlt` : `correlation=1`
- `spm/wl` : `nbWaterLevels=288`
- Source : https://maree.shom.fr/harbor/PERROS-GUIREC_TRESTRAOU/hlt/0

Ces données astronomiques permettent de reproduire le faux créneau du 5 septembre
à midi : 12:00–12:46, PM 7,42 m, coefficient 43. La valeur météo 1026,7 hPa utilisée
par le test est celle consultée auprès d'Open-Meteo pour midi lors du diagnostic.
Ce sont des prédictions archivées pour le test, pas une mesure de la porte ni de la mer.
Les jours supplémentaires recopiés dans le test sont synthétiques et servent aux bords
de l'horizon, sans être présentés comme des observations SHOM de ces autres dates.
