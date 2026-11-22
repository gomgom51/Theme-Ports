# Musiques à générer avec Suno

Sept morceaux, à déposer dans `web/musique/` sous les noms indiqués. L'esprit
recherché : la chanson de marins française des années 80, avec accordéon, guitare
et voix chaleureuse, entre la ballade de port et la valse qu'on chante en chœur au
comptoir.

Suno refuse les noms d'artistes dans les styles : on décrit donc le son voulu.
Les paroles ci-dessous sont originales, écrites pour le jeu.

---

## 1. `accueil.mp3` : la chanson du jeu (écran d'accueil)

**Style of Music** (à coller tel quel) :

```
chanson française de marins, valse 6/8, accordéon, guitare acoustique, contrebasse, voix masculine grave et chaleureuse, chœur de comptoir au refrain, ambiance de port breton, années 80, mélancolique et fière
```

**Titre** : Port d'attache

**Paroles** :

```
[Couplet 1]
J'avais trois sous en poche et un vieux caboteur,
Rouillé du pont aux cales, qui toussait comme un fumeur,
Un bureau sur le quai, une ampoule qui pend,
Et la mer devant moi, grande comme un serment.

[Refrain]
Port d'attache, port d'attache,
C'est vers toi que je reviens,
Que je charge du blé, du charbon ou du cacao,
C'est ton nom qu'on lit à la poupe de mes bateaux.
Port d'attache, port d'attache,
Quand la tempête a tout pris,
Il me reste une amarre, un phare,
Et les lumières du quai dans la nuit.

[Couplet 2]
De Rotterdam à Santos, de Djeddah à Shanghai,
J'ai couru les contrats, j'ai payé mes marins,
Le fuel qui s'envole, le canal qui se ferme,
Les banquiers qui sourient tant que le vent tient ferme.

[Refrain]

[Pont]
Et quand le client grogne et paie à moitié,
Je bois à la santé des cargos oubliés,
Des coques qui rouillent au fond des chantiers,
Et des mouettes qui rient de nos fortunes passées.

[Couplet 3]
Aujourd'hui mes navires portent mes couleurs,
Des pétroliers immenses, des cargos voyageurs,
Mais quand je ferme les yeux, c'est toujours la même chanson :
La sirène, les mouettes, et le vieux caboteur au ponton.

[Refrain final]
Port d'attache, port d'attache,
C'est vers toi que je reviens…
```

---

## 2. Pendant la partie : un thème par standing de la compagnie

La musique de la partie suit le bureau de la compagnie (Bureau 💼) : quand la
valeur nette fait passer au bureau suivant, le thème change en fondu. On part du
vieux chant de marins et on arrive, au sommet, à la musique de multinationale.

Ces morceaux accompagnent des heures de jeu : cocher **Instrumental** dans Suno,
éviter les montées brutales, et garder la version dont la fin enchaîne le mieux
avec le début (le jeu les joue en boucle). Durée idéale : 2 à 4 minutes.

### `niveau1.mp3` — Le cagibi du quai (moins de 10 M$)

Un rafiot, un bureau au bout du quai : la taverne des vieux marins.

```
instrumental, chant de marins traditionnel du XIXe siècle, concertina, violon, flûte en fer-blanc, tambour sur tonneau, frappements de pieds sur le plancher, 6/8, taverne de port enfumée, rustique et entraînant, sans voix, enregistrement chaleureux un peu ancien
```

### `niveau2.mp3` — Le bureau sur le port (10 à 30 M$)

La compagnie a pignon sur rue : le folk maritime d'un port breton.

```
instrumental, folk maritime des années 60, accordéon musette, guitare acoustique, contrebasse, banjo léger, mandoline, valse 6/8 douce, ambiance de port breton au soleil, sans voix, mélodie simple et chantante
```

### `niveau3.mp3` — Le siège de la compagnie (30 à 100 M$)

Boiseries et tableaux de navires : le jazz feutré d'un armateur établi.

```
instrumental, jazz de port des années 70, piano électrique, contrebasse, balais sur caisse claire, cuivres feutrés, touche d'accordéon, swing doux, élégant et détendu, sans voix
```

### `niveau4.mp3` — L'étage de direction (100 à 300 M$)

La baie vitrée sur tout le port : une bande originale de documentaire maritime.

```
instrumental, pop orchestrale des années 90, cordes amples, piano, guitare claire, batterie légère, cor d'harmonie, bande originale de documentaire maritime, confiant et lumineux, sans voix
```

### `niveau5.mp3` — La tour de verre (plus de 300 M$)

Le port entier à vos pieds : la musique d'une multinationale qui a des
bureaux sur tous les continents.

```
instrumental, musique de multinationale, électronique ambiante moderne, cordes cinématiques, percussions du monde (taiko, tabla, steel-drum, djembé), synthétiseurs brillants, grandiose et confiant, style publicité internationale, sans voix
```

En secours, si un de ces fichiers manque, le jeu joue `jeu.mp3` s'il existe
(même consignes : instrumental, doux, en boucle).

---

## 3. `victoire.mp3` : fin de partie (30 à 60 secondes)

```
courte fanfare marine joyeuse, accordéon, cuivres légers, tambourin, chœur qui chante « oh hisse », fête sur le quai, 6/8, final triomphant
```

---

## Ensuite

1. Télécharger les MP3 depuis Suno.
2. Les renommer exactement `accueil.mp3`, `niveau1.mp3` à `niveau5.mp3` et `victoire.mp3`.
3. Les déposer dans `web/musique/` du dépôt (sur GitHub : *Add file → Upload files*).
4. Le prochain APK et la version PC les intègrent automatiquement.
