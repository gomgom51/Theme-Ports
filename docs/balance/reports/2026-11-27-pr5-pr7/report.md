# Comparaison d'équilibre : main / pr5 / pr7 / pr5+pr7

Suite **full**, 2026-11-27 01:15 UTC, 41 min sur 4 cœurs. Mêmes graines pour chaque version : les écarts viennent des changements de code, mais une modification qui touche la suite aléatoire rebat aussi les parties (regarder les médianes et le nombre de graines où l'écart va dans le même sens, pas une graine isolée).

- **main** : `origin/main` (44b3292)
- **pr5** : `3ab63c3` (3ab63c3)
- **pr7** : `c8b4701` (c8b4701)
- **pr5+pr7** : `origin/main+3ab63c3+c8b4701` (44b3292 + 3ab63c3 + c8b4701)

## Population d'IA (24 parties × 4 compagnies, 5 ans, victoires coupées)

Multiple = valeur nette finale / valeur nette de départ. Une ligne par version, écart à la référence entre parenthèses.

| Version | Médiane | 10 % les plus bas | 10 % les plus hauts | Faillites | Rachetées | Naufrages | NaN |
|---|---|---|---|---|---|---|---|
| main | ×26.0 | ×5.5 | ×51.4 | 0 | 12 | 65 | 0 |
| pr5 | ×24.8 (-1.2) | ×4.6 (-1.0) | ×55.0 (+3.6) | 1 | 15 | 59 | 0 |
| pr7 | ×24.0 (-2.0) | ×6.5 (+1.0) | ×51.8 (+0.4) | 0 | 13 | 53 | 0 |
| pr5+pr7 | ×20.5 (-5.5) | ×5.7 (+0.2) | ×47.4 (-3.9) | 0 | 12 | 67 | 0 |

pr5 contre main, compagnie par compagnie (même graine) : mieux de plus de 5 % pour 40, moins bien pour 50, le reste à ±5 %.

pr7 contre main, compagnie par compagnie (même graine) : mieux de plus de 5 % pour 36, moins bien pour 42, le reste à ±5 %.

pr5+pr7 contre main, compagnie par compagnie (même graine) : mieux de plus de 5 % pour 41, moins bien pour 48, le reste à ±5 %.

### Par tempérament (médiane des survivantes)

| Tempérament | main | pr5 | pr7 | pr5+pr7 |
|---|---|---|---|---|
| batisseur | ×37.5 (24) | ×28.6 (23) | ×33.0 (23) | ×28.6 (23) |
| conquerant | ×29.8 (24) | ×27.9 (24) | ×28.8 (24) | ×28.2 (24) |
| ombre | ×6.7 (13) | ×5.7 (9) | ×7.9 (13) | ×11.8 (14) |
| vertueux | ×21.9 (23) | ×29.1 (24) | ×24.0 (23) | ×19.1 (23) |

### Par catégorie de navire

Net = gains − dépenses du navire, en M$ par navire-année. Port = part du temps à quai (manutention, attente). Navires = nombre de navires de ce type passés dans les flottes (choix de l'IA).

| Type | main : net / chargé / port / navires | pr5 : net / chargé / port / navires | pr7 : net / chargé / port / navires | pr5+pr7 : net / chargé / port / navires |
|---|---|---|---|---|
| Cargo | 2.3 / 67 % / 17 % / 1446 | 2.6 (+0.3) / 68 % / 16 % / 1374 | 2.7 (+0.4) / 66 % / 18 % / 1389 | 2.3 (+0.1) / 67 % / 16 % / 1393 |
| Pétrolier | 8.4 / 52 % / 10 % / 152 | 7.6 (-0.8) / 49 % / 11 % / 138 | 7.8 (-0.6) / 52 % / 10 % / 160 | 6.3 (-2.1) / 49 % / 11 % / 145 |
| Vraquier | 11.2 / 69 % / 18 % / 133 | 11.2 (+0.0) / 68 % / 18 % / 126 | 9.1 (-2.0) / 69 % / 18 % / 135 | 9.9 (-1.3) / 69 % / 18 % / 125 |
| Porte-conteneurs | -1.6 / 66 % / 12 % / 54 | -0.4 (+1.3) / 67 % / 12 % / 56 | 1.8 (+3.5) / 67 % / 12 % / 58 | 1.5 (+3.1) / 65 % / 13 % / 62 |
| Spécialisé | 16.9 / 47 % / 15 % / 18 | 13.1 (-3.8) / 48 % / 14 % / 19 | 17.0 (+0.1) / 48 % / 15 % / 13 | 14.9 (-2.0) / 46 % / 15 % / 18 |
| Gazier | 16.6 / 42 % / 12 % / 7 | 13.4 (-3.2) / 45 % / 10 % / 4 | 10.0 (-6.6) / 47 % / 10 % / 4 | 5.6 (-11.0) / 41 % / 11 % / 4 |

### Par modèle de navire

Net = gains − dépenses du navire, en M$ par navire-année. Port = part du temps à quai (manutention, attente). Navires = nombre de navires de ce type passés dans les flottes (choix de l'IA).

| Type | main : net / chargé / port / navires | pr5 : net / chargé / port / navires | pr7 : net / chargé / port / navires | pr5+pr7 : net / chargé / port / navires |
|---|---|---|---|---|
| caboteur | 1.5 / 64 % / 18 % / 775 | 1.3 (-0.2) / 66 % / 17 % / 652 | 1.8 (+0.3) / 63 % / 19 % / 717 | 1.6 (+0.1) / 64 % / 17 % / 678 |
| cargo_ancien | 2.6 / 68 % / 17 % / 574 | 3.1 (+0.5) / 68 % / 16 % / 620 | 3.1 (+0.5) / 66 % / 17 % / 574 | 2.5 (-0.1) / 67 % / 16 % / 612 |
| polyvalent | 6.6 / 79 % / 15 % / 75 | 7.2 (+0.6) / 81 % / 13 % / 86 | 6.5 (-0.1) / 79 % / 14 % / 83 | 5.4 (-1.2) / 81 % / 13 % / 89 |
| petrolier_ancien | 5.0 / 49 % / 10 % / 75 | 3.0 (-1.9) / 41 % / 12 % / 77 | 5.4 (+0.5) / 49 % / 11 % / 82 | 2.5 (-2.5) / 41 % / 12 % / 74 |
| petrolier_mr | 10.5 / 55 % / 10 % / 43 | 11.2 (+0.7) / 57 % / 9 % / 36 | 10.4 (-0.1) / 56 % / 9 % / 47 | 9.5 (-1.1) / 57 % / 9 % / 45 |
| vraquier_handy | 10.3 / 72 % / 17 % / 52 | 9.0 (-1.3) / 72 % / 17 % / 47 | 7.6 (-2.7) / 71 % / 17 % / 56 | 9.6 (-0.7) / 72 % / 17 % / 63 |
| feeder | -2.2 / 66 % / 12 % / 52 | 1.8 (+4.0) / 68 % / 12 % / 53 | 0.3 (+2.5) / 67 % / 11 % / 53 | 1.5 (+3.8) / 66 % / 12 % / 55 |
| vraquier_supramax | 11.8 / 71 % / 19 % / 41 | 13.1 (+1.3) / 70 % / 19 % / 38 | 10.9 (-0.9) / 71 % / 19 % / 47 | 12.0 (+0.2) / 70 % / 19 % / 34 |
| vraquier_panamax | 12.6 / 66 % / 19 % / 32 | 14.2 (+1.6) / 66 % / 20 % / 29 | 9.6 (-3.0) / 64 % / 18 % / 24 | 10.9 (-1.7) / 64 % / 20 % / 18 |
| colis_lourds | 0.9 / 79 % / 13 % / 22 | 4.2 (+3.3) / 74 % / 14 % / 16 | 3.7 (+2.8) / 75 % / 14 % / 15 | 7.5 (+6.6) / 67 % / 15 % / 14 |
| chimiquier | 10.5 / 54 % / 10 % / 21 | 8.2 (-2.3) / 51 % / 10 % / 17 | 6.2 (-4.3) / 54 % / 9 % / 25 | 9.5 (-1.1) / 58 % / 10 % / 18 |
| frigorifique | 17.0 / 47 % / 15 % / 15 | 16.6 (-0.4) / 49 % / 14 % / 16 | 17.0 (+0.0) / 48 % / 15 % / 13 | 14.9 (-2.1) / 46 % / 15 % / 17 |
| vraquier_capesize | 9.5 / 49 % / 18 % / 8 | 9.4 (-0.1) / 43 % / 17 % / 12 | 8.8 (-0.7) / 47 % / 19 % / 8 | 2.7 (-6.8) / 50 % / 16 % / 10 |
| petrolier_aframax | 23.2 / 59 % / 13 % / 7 | 31.2 (+7.9) / 58 % / 10 % / 5 | 20.8 (-2.4) / 59 % / 10 % / 4 | 17.8 (-5.4) / 47 % / 11 % / 4 |
| gazier | 16.6 / 42 % / 12 % / 7 | 13.4 (-3.2) / 45 % / 10 % / 4 | 10.0 (-6.6) / 47 % / 10 % / 4 | 5.6 (-11.0) / 41 % / 11 % / 4 |
| porte_voitures | 16.6 / 47 % / 14 % / 3 | -11.0 (-27.6) / 45 % / 14 % / 3 | – | 15.0 (-1.6) / 41 % / 15 % / 1 |
| petrolier_suezmax | 13.2 / 44 % / 16 % / 5 | 16.0 (+2.7) / 49 % / 11 % / 1 | 16.3 (+3.0) / 59 % / 15 % / 1 | 12.1 (-1.2) / 55 % / 15 % / 2 |
| pc_panamax | 21.8 / 66 % / 20 % / 2 | 19.7 (-2.1) / 50 % / 22 % / 2 | 29.8 (+8.0) / 67 % / 20 % / 5 | -8.7 (-30.5) / 62 % / 20 % / 6 |
| petrolier_vlcc | 20.8 / 65 % / 12 % / 1 | -12.5 (-33.3) / 0 % / 4 % / 1 | – | 1.9 (-18.9) / 90 % / 10 % / 1 |
| pc_geant | – | -133.6 / 49 % / 32 % / 1 | – | 47.2 / 56 % / 28 % / 1 |
| petrolier_ulcc | – | -1.7 / 22 % / 12 % / 1 | 1.2 / 17 % / 6 % / 1 | -7.5 / 0 % / 61 % / 1 |

## Stratégies (16 marchés, 5 ans, quatre compagnies spécialisées)

Victoires = marchés où la stratégie finit première. Règle n° 3 : aucune ne doit gagner plus de 60 % des marchés.

| Stratégie | main : victoires · médiane | pr5 : victoires · médiane | pr7 : victoires · médiane | pr5+pr7 : victoires · médiane |
|---|---|---|---|---|
| cargos | 1/16 · ×36.0 | 1/16 · ×46.2 | 3/16 · ×37.0 | 2/16 · ×40.6 |
| vrac | 5/16 · ×44.3 | 4/16 · ×48.9 | 5/16 · ×44.3 | 3/16 · ×52.3 |
| citernes | 7/16 · ×50.1 | 3/16 · ×39.8 | 4/16 · ×41.1 | 4/16 · ×36.2 |
| lignes | 3/16 · ×35.2 | 8/16 · ×52.8 | 4/16 · ×30.1 | 7/16 · ×53.6 |

## Rentabilité de chaque modèle (un navire seul, marché normal, 2 an(s))

M$ net par an ; « négoce » = rentable seulement en achetant et revendant ; ❌ = non rentable.

| Modèle | main | pr5 | pr7 | pr5+pr7 |
|---|---|---|---|---|
| caboteur | 2.5 | 2.5 (+0.0) | 2.5 (+0.0) | 2.5 (+0.0) |
| cargo_ancien | 3.5 | 3.2 (-0.3) | 3.5 (+0.0) | 3.2 (-0.3) |
| polyvalent | 9.0 | 10.5 (+1.5) | 9.0 (+0.0) | 10.5 (+1.5) |
| colis_lourds | 9.1 | 9.2 (+0.1) | 9.1 (+0.0) | 9.2 (+0.1) |
| vraquier_handy | 9.3 | 10.4 (+1.1) | 9.3 (+0.0) | 10.4 (+1.1) |
| vraquier_supramax | 14.3 | 16.0 (+1.7) | 14.3 (+0.0) | 16.0 (+1.7) |
| vraquier_panamax | 13.2 | 13.2 (+0.0) | 13.2 (+0.0) | 13.2 (+0.0) |
| vraquier_capesize | 9.6 | 9.6 (+0.0) | 9.6 (+0.0) | 9.6 (+0.0) |
| petrolier_ancien | 7.0 | 2.9 (-4.1) | 7.0 (+0.0) | 2.9 (-4.1) |
| petrolier_mr | 10.9 | 10.9 (+0.0) | 10.9 (+0.0) | 10.9 (+0.0) |
| chimiquier | 9.2 | 9.2 (+0.0) | 9.2 (+0.0) | 9.2 (+0.0) |
| petrolier_aframax | 26.7 | 26.7 (+0.0) | 26.7 (+0.0) | 26.7 (+0.0) |
| petrolier_suezmax | 22.6 | 22.6 (+0.0) | 22.6 (+0.0) | 22.6 (+0.0) |
| petrolier_vlcc | 15.0 | 15.0 (+0.0) | 15.0 (+0.0) | 15.0 (+0.0) |
| petrolier_ulcc | 10.1 | 10.1 (+0.0) | 10.1 (+0.0) | 10.1 (+0.0) |
| gazier | 10.3 | 10.3 (+0.0) | 10.3 (+0.0) | 10.3 (+0.0) |
| methanier | 51.2 | 51.2 (+0.0) | 51.2 (+0.0) | 51.2 (+0.0) |
| feeder | 8.5 | 8.5 (+0.0) | 8.5 (+0.0) | 8.5 (+0.0) |
| pc_panamax | 35.7 | 35.7 (+0.0) | 35.7 (+0.0) | 35.7 (+0.0) |
| pc_geant | 58.4 | 58.4 (+0.0) | 58.4 (+0.0) | 58.4 (+0.0) |
| porte_voitures | 24.3 | 24.3 (+0.0) | 24.3 (+0.0) | 24.3 (+0.0) |
| frigorifique | 14.9 | 14.9 (+0.0) | 14.9 (+0.0) | 14.9 (+0.0) |

## Victoires (16 parties IA, 14 ans max, une compagnie par tempérament)

Cible : une victoire difficile mais atteignable vers dix ans, chaque chemin gagne parfois, aucun toujours.

| Version | Parties gagnées | Médiane (ans) | Avant 10 ans | Par chemin |
|---|---|---|---|---|
| main | 11/16 | 10.6 | 5 | shadow 1, reputation 4, legend 5, domination 1 |
| pr5 | 10/16 | 10.3 | 3 | reputation 6, shadow 2, legend 2 |
| pr7 | 8/16 | 10.9 | 1 | shadow 3, reputation 3, domination 1, legend 1 |
| pr5+pr7 | 9/16 | 10.4 | 3 | legend 2, reputation 4, shadow 3 |

| Graine | main | pr5 | pr7 | pr5+pr7 |
|---|---|---|---|---|
| 1 | aucune | aucune | aucune | aucune |
| 2 | shadow 9.5 a (ombre) | reputation 12.2 a (vertueux) | shadow 10.5 a (ombre) | legend 10.4 a (batisseur) |
| 3 | aucune | reputation 9.1 a (vertueux) | aucune | reputation 10.7 a (vertueux) |
| 4 | reputation 10.9 a (vertueux) | aucune | shadow 10.9 a (ombre) | aucune |
| 5 | legend 8.2 a (conquerant) | aucune | reputation 11.0 a (vertueux) | aucune |
| 6 | legend 10.9 a (batisseur) | aucune | aucune | shadow 8.8 a (ombre) |
| 7 | reputation 8.7 a (vertueux) | reputation 10.3 a (vertueux) | reputation 10.1 a (vertueux) | legend 11.5 a (conquerant) |
| 8 | aucune | shadow 10.2 a (ombre) | reputation 13.2 a (vertueux) | shadow 10.7 a (ombre) |
| 9 | legend 9.4 a (batisseur) | shadow 10.5 a (ombre) | shadow 10.4 a (ombre) | shadow 10.7 a (ombre) |
| 10 | legend 11.6 a (batisseur) | legend 9.0 a (batisseur) | aucune | reputation 8.7 a (vertueux) |
| 11 | aucune | reputation 10.6 a (vertueux) | aucune | reputation 10.1 a (vertueux) |
| 12 | domination 10.6 a (conquerant) | aucune | domination 8.9 a (conquerant) | aucune |
| 13 | reputation 11.6 a (vertueux) | aucune | aucune | aucune |
| 14 | legend 9.7 a (batisseur) | legend 9.6 a (conquerant) | aucune | aucune |
| 15 | aucune | reputation 11.1 a (vertueux) | aucune | aucune |
| 16 | reputation 11.9 a (vertueux) | reputation 10.1 a (vertueux) | legend 12.3 a (batisseur) | reputation 9.9 a (vertueux) |
