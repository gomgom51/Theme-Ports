# Icônes du jeu (police PdaIcons)

Le code garde ses émojis (`'⚓'`, `'🛢️'`…) : une police en couleur, `web/fonts/pda-icons.woff2`, les dessine dans
le style du jeu, partout où passe du texte (DOM et carte). Style choisi par le propriétaire : vectoriel « lisse »,
contour encre, un aplat, une ombre et un reflet, sur une grille de 64 ; lisible à 16 px (texte à 14 px) et à 32 px
(texte à 28 px : boutons latéraux, tuiles de marchandises), médailles de victoire à 38 px.

- `icons.mjs` : premiers dessins (boutons latéraux, scores, marchandises, médailles, signes de carte) et les aides
  `shape` (forme + ombre + reflet découpés dedans), `rect`, `circ`, `sparkle`.
- `more.mjs` : le reste (risques, affaires, personnes, équipement, temps, son).
- `cps.mjs` : quels émojis chaque dessin remplace. Un dessin sans émoji n'a qu'un point de code privé (U+E000…).
- `build.mjs` : construit la police et met à jour la `unicode-range` de sa `@font-face` dans `web/css/style.css`.
- `build_colr.py` : aplatit chaque SVG (picosvg), un calque COLR par aplat, palette CPAL, chaque dessin cadré et
  centré dans son carré.

Construire (pas d'étape de build pour le jeu : la police est versionnée) :

```
pip install fonttools picosvg skia-pathops brotli
node tools/icons/build.mjs
node tools/icons-check.mjs
```

`tools/icons-check.mjs` (dans `npm test` et la CI) échoue si un émoji du code n'a pas de dessin, ou si la
`unicode-range` n'est plus à jour. Les symboles typographiques (flèches, coches, ▶) restent du texte : liste
`TEXT_GLYPHS` dans le script.

Points techniques :
- `unicode-range` limite la police aux émojis du jeu : le texte n'attend jamais son chargement.
- Sur la carte, la police est en tête de chaque `g.font` ; `document.fonts.load('16px PdaIcons', '⚓…')` (avec du
  texte : sans lui, une police à `unicode-range` ne se charge pas) puis redessin.
- Capitaine `🧑‍✈️` : 🧑 porte le dessin, ZWJ et ✈ sont des glyphes vides sans chasse.
- Métriques : chasse 1,285 em, dessin de 16/14 em, `lsb = xMin` (sans quoi FreeType et Skia décalent le dessin).
