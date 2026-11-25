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
valeur nette fait passer au bureau suivant, le thème change en fondu. Chaque niveau
a deux chansons : `niveauN.mp3`, puis `niveauNb.mp3` à partir de 10, 23, 55, 175 et
600 M$ — Suno produit deux versions de chaque prompt, gardez les deux. Sans la seconde,
la première continue. Un niveau atteint est acquis : si la valeur nette repasse sous son
seuil, le bureau et la première chanson du niveau restent. Seul le niveau 0 fait exception :
sous 5 M$ de valeur nette (la compagnie a perdu de l'argent depuis ses débuts), c'est le
thème du niveau 0 et le retour au cagibi, jusqu'à ce que la compagnie remonte.

### `niveau0.mp3` — Les temps sont durs (valeur nette sous 5 M$)

L'argent manque, le doute s'installe. Une guitare seule, jouée au loin, comme
entendue depuis un quai désert balayé par le vent. Des notes rares, hésitantes,
avec de longs silences. Pas de batterie, pas de voix : de la mélancolie, pas du
désespoir (le joueur doit avoir envie de se relever).

Mode **Custom**, case **Instrumental** cochée, ce style (en anglais, Suno le
comprend mieux) :

```
instrumental, lonely fingerpicked acoustic guitar, minor key, slow 70 bpm, distant and far away as if heard across an empty windswept harbour, wind blowing, faint creak of mooring ropes, sparse hesitant melody with long pauses, doubt and melancholy with a glimmer of hope, no drums, no vocals, natural room reverb, intimate lo-fi recording
```

Styles à exclure : `drums, vocals, piano, strings, synth, upbeat`. Gardez la version
où la guitare reste lointaine sans que le vent la couvre, et dont la fin enchaîne
avec le début. On part du
vieux chant de marins et on arrive, au sommet, à la musique de multinationale.

Ces morceaux accompagnent des heures de jeu : cocher **Instrumental** dans Suno,
éviter les montées brutales, et garder la version dont la fin enchaîne le mieux
avec le début (le jeu les joue en boucle). Durée idéale : 2 à 4 minutes.

### `niveau1.mp3` — Le cagibi du quai (5 à 15 M$)

Un rafiot, un bureau au bout du quai : la taverne des vieux marins.

```
instrumental, chant de marins traditionnel du XIXe siècle, concertina, violon, flûte en fer-blanc, tambour sur tonneau, frappements de pieds sur le plancher, 6/8, taverne de port enfumée, rustique et entraînant, sans voix, enregistrement chaleureux un peu ancien
```

### `niveau2.mp3` — Le bureau sur le port (15 à 35 M$)

La compagnie a pignon sur rue. Le brief : « On a une vraie équipe, nos premiers
clients fidèles, les navires tournent. Ça bosse toute la semaine et ça danse à
la fête du port. » Ce thème doit être plus entraînant que le niveau 1, pas plus
calme : on passe de la taverne enfumée au groupe de bal folk breton, plus
rapide, plus plein, mieux enregistré, qui fait danser tout le quai. Un
enchaînement de deux airs, comme dans un bal, avec un changement de tonalité.

Mêmes consignes que pour les niveaux 3 et 5 : styles en anglais, mode
**Custom**, case **Instrumental** décochée, structure dans le champ des paroles
(non chantée).

**Style of Music** :

```
lively breton celtic folk dance band, fast energetic jig in 6/8, 126 BPM, accordion lead melody, fiddle answering, tin whistle, bouzouki, acoustic guitar driving rhythm, upright bass, bodhran, foot stomping and hand claps, harbour festival dance, joyful and spirited, tight warm band recording, instrumental, no vocals
```

**Exclude Styles** (si le champ existe) :

```
vocals, singing, waltz, slow, relaxed, lounge, ambient, lo-fi, jingle
```

**Titre** : Le bal du port

**Paroles** (structure seulement) :

```
[Intro: fiddle alone, then the whole band kicks in]

[Main Tune: accordion lead, bodhran and foot stomping]

[Second Tune: fiddle and tin whistle, faster]

[Break: hand claps and bodhran only]

[Main Tune: full band, accordion and fiddle together]

[Second Tune: key change, even more lively]

[Outro: full band, last round of the main tune, strong ending]

[End]
```

### `niveau3.mp3` — Le siège de la compagnie (35 à 100 M$)

Le pivot entre la petite affaire du port et le groupe international. Le brief
du patron : « On a un vrai siège, des contrats avec les grands chargeurs, on
embauche, on ouvre des lignes. On n'est plus la petite boîte du quai, pas encore
la multinationale : on a faim, on avance. » La musique doit avoir de l'élan,
pas de la détente : les instruments du port des niveaux 1 et 2 (accordéon,
violon, guitare) portés par une vraie rythmique, avec les cordes et les cuivres
qui annoncent la suite. Couplets en mineur (la tension) qui s'ouvrent en majeur
au refrain (l'ambition).

Mêmes consignes que pour le niveau 5 : styles en anglais, mode **Custom**, case
**Instrumental** décochée, structure dans le champ des paroles (non chantée).

**Style of Music** :

```
cinematic folk rock, driving 4/4 groove, 116 BPM, determined and ambitious, acoustic guitar strumming, accordion lead melody, fiddle, electric bass, live drums with tom rhythm, string section building, brass swells, celtic touch, minor verses lifting to a major chorus, forward momentum, instrumental, no vocals
```

**Exclude Styles** (si le champ existe) :

```
vocals, singing, jazz, lounge, smooth, elevator music, bossa nova, lo-fi, jingle
```

**Titre** : Le siège

**Paroles** (structure seulement) :

```
[Intro: accordion alone, then acoustic guitar strumming]

[Verse: drums and bass enter, steady drive, accordion melody]

[Pre-Chorus: strings rising, tension]

[Chorus: full band, fiddle and accordion together, brass swells, determined]

[Break: tom drums and bass, the engine room]

[Verse: strings join the melody]

[Final Chorus: full band and strings, bigger]

[Outro: accordion melody over strumming guitar, steady ending]

[End]
```

### `niveau4.mp3` — L'étage de direction (100 à 300 M$)

La baie vitrée sur tout le port : une bande originale de documentaire maritime.

```
instrumental, pop orchestrale des années 90, cordes amples, piano, guitare claire, batterie légère, cor d'harmonie, bande originale de documentaire maritime, confiant et lumineux, sans voix
```

### `niveau5.mp3` — La tour de verre (plus de 300 M$)

Le port entier à vos pieds. Le brief, comme le donnerait le PDG au compositeur
de l'hymne du groupe : « Nous avons commencé avec un caboteur rouillé sur un
quai ; aujourd'hui nos navires portent les marchandises du monde entier. Notre
thème doit dire que nous sommes solides, présents partout, tournés vers
l'avenir, et que nous n'avons pas oublié le port d'où nous venons. »
D'où un seul motif héroïque, facile à retenir, qui revient et grandit, et
l'accordéon du premier niveau qui ouvre et ferme le morceau.

Les styles sont en anglais : Suno les comprend mieux. Ne pas parler de
« publicité » ni de « jingle » : Suno fait alors des morceaux de 30 à 60 secondes.

Mode **Custom**, case **Instrumental** décochée : la structure ci-dessous, mise
dans le champ des paroles, donne un morceau complet de 3 à 4 minutes (les
indications entre crochets ne sont pas chantées).

**Style of Music** :

```
corporate brand anthem for a global shipping group, cinematic orchestral pop, 100 BPM, major key, warm strings, bold french horns, grand piano, steady modern pulse, soft electronic textures, deep taut drums, one heroic memorable main motif that returns and grows, lone accordion recalling the old harbour, confident, prestigious, optimistic, timeless, instrumental, no vocals
```

**Exclude Styles** (si le champ existe) :

```
vocals, singing, choir, jingle, advertisement, EDM drop, dubstep, trailer hits, lo-fi
```

**Titre** : Hymne du groupe

**Paroles** (structure seulement) :

```
[Intro: solo accordion, harbour at dawn, main motif]

[Verse: piano and warm strings, main motif]

[Build: french horns join, drums enter, rising]

[Chorus: full orchestra, main motif, wide and proud]

[Bridge: calm, piano and strings, the world seen from above]

[Build: pulse returns, horns rising]

[Final Chorus: full orchestra, main motif, triumphant]

[Outro: accordion returns, main motif, gentle ending]

[End]
```

Si Suno chante malgré tout, cocher **Instrumental** et allonger le meilleur
essai avec **Extend** depuis la fin (« continue the main motif, full
orchestra ») jusqu'à 3 minutes environ.

En secours, si un de ces fichiers manque, le jeu joue `jeu.mp3` s'il existe
(même consignes : instrumental, doux, en boucle).

---

## 3. `victoire.mp3` : fin de partie (30 à 60 secondes)

```
courte fanfare marine joyeuse, accordéon, cuivres légers, tambourin, chœur qui chante « oh hisse », fête sur le quai, 6/8, final triomphant
```

---

## 4. Thèmes de situation : une victoire en vue, la liste noire, la menace

Ces morceaux remplacent la musique du niveau quand la situation l'exige, puis lui
rendent la place quand elle passe. Chacun est facultatif : s'il manque, la musique du
niveau continue. Priorité : une victoire en vue pour vous (75 % du chemin, Bureau →
Victoires) ; sinon la liste noire ; sinon un concurrent à 90 % d'une victoire.

Mêmes consignes que pour les niveaux : mode **Custom**, case **Instrumental** cochée
(sauf mention contraire), 2 à 4 minutes, sans montée brutale, et garder la version
dont la fin enchaîne le mieux avec le début (le jeu les joue en boucle). Les styles
sont en anglais : Suno les comprend mieux. Le fil conducteur reste le même : le motif
d'accordéon du vieux port, que chaque thème transforme à sa façon.

Styles à exclure pour tous (champ **Exclude Styles**) :

```
vocals, singing, lyrics, jingle, advertisement, EDM drop, dubstep, lo-fi hip hop
```

### `liste-noire.mp3` — Sur la liste noire internationale

La compagnie est devenue un paria : ses navires ne peuvent plus entrer dans les ports
qui appliquent les sanctions, les banques ont fermé la porte, on ne commerce plus
qu'avec l'ombre. Ce n'est pas un casse réussi : c'est une saga, solennelle et tragique.
Le pouvoir, la solitude, une famille qui ne reculera plus. On veut de grands moments :
une trompette seule qui tient de longues notes dans le silence, une valse lente qui
prend son temps, des cordes qui s'ouvrent sur un accord tenu, et de l'espace entre les
phrases pour sentir que c'est grand. L'accordéon du vieux port revient au milieu,
comme un souvenir d'avant.

Suno refuse les noms de films et de compositeurs : le style décrit le son sans les
nommer. Pas de jazz, pas de batterie, pas de tango (c'est ce qui donnait l'air de casse).

Mode **Custom**, case **Instrumental** décochée : la structure ci-dessous, mise dans le
champ des paroles, impose les longues notes et les silences (les indications entre
crochets ne sont pas chantées).

**Style of Music** :

```
instrumental, solemn tragic orchestral waltz, 1970s crime saga film score, slow 3/4 at 60 bpm, minor key, rubato, a lone trumpet holding long sustained notes over silence, mandolin tremolo, lush string section with long held chords, warm oboe and clarinet, soft low brass swells, Mediterranean melancholy, grand and spacious, long pauses between phrases, power, loneliness and inevitability, no drums, no vocals
```

**Exclude Styles** :

```
jazz, swing, tango, heist, caper, upbeat, drums, percussion, drum kit, electronic, synth, vocals, singing, choir, jingle
```

**Titre** : Pavillon noir

Suno produit deux versions : gardez les deux. La première sous le nom `liste-noire.mp3`, la
seconde sous `liste-noireb.mp3` : elle prend le relais après deux ans sur la liste noire (le
chemin de l'ombre est long). Sans elle, la première continue.

**Paroles** (structure seulement) :

```
[Intro: solo trumpet alone in silence, long sustained notes, a pause after each phrase]

[Theme: slow waltz, mandolin tremolo, strings enter softly, the trumpet melody]

[Swell: full strings rise to one long held chord, then silence]

[Interlude: a lone accordion plays the old harbour waltz in minor, like a memory]

[Grand Theme: full orchestra, slow and broad, long notes, solemn and powerful]

[Outro: solo trumpet returns, fading, the last note held long]

[End]
```

Gardez la version dont l'introduction laisse la trompette vraiment seule, et dont les
accords tenus durent (si Suno remplit les silences, régénérez). Si une batterie s'invite
malgré tout, cochez **Instrumental** en gardant le style, ou baissez le tempo à 54 bpm.
Si le morceau est trop court, allongez le meilleur essai avec **Extend** depuis la fin
(« continue the slow waltz, solo trumpet, long held notes ») jusqu'à 3 minutes environ.

### `ombre.mp3` — La flotte fantôme approche de la victoire

Les méfaits s'accumulent, la flotte grossit, chaque pays sous embargo est servi : la
compagnie de l'ombre est sur le point de régner sur les mers que personne ne surveille.
Ce n'est plus un polar, c'est le thème du méchant : une pulsation froide et implacable,
des cuivres qui frappent, et le motif du vieux port devenu une marche sinistre.

```
instrumental, dark orchestral thriller, villain theme, 104 bpm, relentless pulsing low synth bass, war drums and taiko, staccato cellos and basses, menacing low brass stabs, cold choir pads without words, distant ship horns, the old harbour accordion motif turned into a sinister march, powerful and unstoppable, crime syndicate ruling the seas, no vocals, seamless loop
```

**Titre** : La flotte fantôme

### `domination.mp3` — Seul maître à bord en vue

Les concurrents tombent un à un, ruinés ou rachetés. Une marche de conquête, impériale
et sans pitié, comme une salle de conseil où l'on signe le rachat du dernier rival : un
seul thème qui revient sans cesse et grandit, d'une caisse claire seule jusqu'à tout
l'orchestre.

```
instrumental, imperial conquest march, 96 bpm, relentless snare drum ostinato from the very start, one single theme repeated and growing in a long crescendo, low brass, timpani, strings in unison, ruthless and grand, cold boardroom power, the old harbour motif played by bold horns, no vocals, seamless loop
```

**Titre** : Le dernier rachat

### `respect.mp3` — La compagnie la plus respectée en vue

Les hauts faits s'alignent, la réputation touche la perfection : l'armateur honnête,
celui qui a livré l'aide après l'ouragan et ramené tous ses marins. Noble, chaleureux,
lumineux, avec des cloches de port au loin. Des voix sans paroles sont permises, mais
pas de chant.

```
instrumental, noble and warm orchestral theme, 84 bpm, major key, solo cello melody, gentle piano, soft strings, wordless choir humming softly, distant harbour bells, dignified, hopeful and luminous, gratitude, the honest shipowner, the old harbour accordion motif played tenderly, no lyrics, seamless loop
```

**Titre** : Le pavillon d'honneur

### `legende.mp3` — La compagnie légendaire en vue

Les records tombent : la plus grande flotte, le plus de tonnes, tous les ports du monde.
Une épopée maritime : le chant de marins de l'écran d'accueil (6/8) devenu un hymne
d'aventure pour grand orchestre, avec des cors qui s'envolent et un chœur qui lance des
« oh » sans paroles.

```
instrumental, epic maritime adventure, 6/8 time, 120 bpm, full orchestra, soaring french horns, driving strings, big timpani, a sea shanty melody transformed into a heroic anthem, wordless choir chants "oh", crashing waves, wide and legendary, joyful and triumphant, no lyrics, seamless loop
```

**Titre** : La légende des sept mers

### `menace.mp3` — Un concurrent est sur le point de gagner (facultatif)

Un rival atteint 90 % d'une victoire : il faut réagir, et vite. Une horloge qui tourne,
une tension qui monte sans jamais exploser, pour pousser le joueur à agir (racheter,
riposter, ou gagner avant lui).

```
instrumental, tense countdown, 100 bpm, ticking clock percussion, insistent staccato string ostinato, low drones, rising tension without release, urgent pulse, suspense, a fragment of the old harbour motif in minor, no vocals, seamless loop
```

**Titre** : Le temps presse

---

## Ensuite

1. Télécharger les MP3 depuis Suno.
2. Les renommer exactement `accueil.mp3`, `niveau1.mp3` à `niveau5.mp3`, `victoire.mp3`, et pour les
   thèmes de situation `liste-noire.mp3` (et `liste-noireb.mp3`), `ombre.mp3`, `domination.mp3`, `respect.mp3`, `legende.mp3`
   et `menace.mp3`.
3. Les déposer dans `web/musique/` du dépôt (sur GitHub : *Add file → Upload files*).
4. Le prochain APK et la version PC les intègrent automatiquement.
