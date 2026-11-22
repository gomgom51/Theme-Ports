# Musiques à générer avec Suno

Trois morceaux, à déposer dans `web/musique/` sous les noms indiqués. L'esprit
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

## 2. `jeu.mp3` : musique pendant la partie (instrumentale, en boucle)

Elle doit accompagner des heures de jeu sans fatiguer : douce, sans voix, sans
montée brutale. Cocher **Instrumental** dans Suno.

```
instrumental, valse marine 6/8 douce, accordéon et guitare folk, mandoline, contrebasse légère, ambiance de port calme, mélodie simple et répétitive, sans voix, sans percussions fortes
```

Astuce : générer plusieurs versions et garder celle dont la fin enchaîne le mieux
avec le début (le jeu la joue en boucle).

---

## 3. `victoire.mp3` : fin de partie (30 à 60 secondes)

```
courte fanfare marine joyeuse, accordéon, cuivres légers, tambourin, chœur qui chante « oh hisse », fête sur le quai, 6/8, final triomphant
```

---

## Ensuite

1. Télécharger les MP3 depuis Suno.
2. Les renommer exactement `accueil.mp3`, `jeu.mp3` et `victoire.mp3`.
3. Les déposer dans `web/musique/` du dépôt (sur GitHub : *Add file → Upload files*).
4. Le prochain APK et la version PC les intègrent automatiquement.
