# Police d'icônes en couleur (COLR v0 + CPAL) : un glyphe de base par icône, un calque par aplat.
# Appelé par build.mjs : python3 build_colr.py icones.json sortie.woff2 PdaIcons
import json, sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path
from fontTools.colorLib.builder import buildCOLR, buildCPAL
from picosvg.svg import SVG
import pathops

UPM = 1000
BOX = 1143          # 16/14 em : 16 px pile dans un texte de 14 px (et 32 px à 28 px)
SIDE = 71           # 1 px de marge de chaque côté à 14 px
ADV = BOX + 2 * SIDE
BOTTOM = -214       # 3 px sous la ligne de base à 14 px : le dessin est centré sur les minuscules et capitales

def pp(d, evenodd=False):
    p = pathops.Path(); parse_path(d, p.getPen())
    if evenodd: p.fillType = pathops.FillType.EVEN_ODD
    p.simplify(); return p

def glyph(path, box):
    s = BOX / box
    pen = TTGlyphPen(None)
    path.draw(TransformPen(Cu2QuPen(pen, 0.5, reverse_direction=True), (s, 0, 0, -s, SIDE, BOTTOM + BOX)))
    return pen.glyph()

def layers_of(ic):
    # picosvg aplatit traits, découpes et transformations : il ne reste que des tracés pleins.
    pico = SVG.fromstring(ic['svg']).topicosvg()
    out = []
    for el in pico.xpath('//svg:path'):
        fill = el.attrib.get('fill', 'black')
        if fill == 'none': continue
        op = float(el.attrib.get('fill-opacity', 1)) * float(el.attrib.get('opacity', 1))
        out.append((pp(el.attrib['d'], el.attrib.get('fill-rule') == 'evenodd'), fill, op))
    return out

def rgba(hexcol, a):
    h = hexcol.lstrip('#')
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)

def main(src, out, family):
    icons = json.load(open(src))
    empty = TTGlyphPen(None).glyph()
    # Glyphes vides de chasse nulle : sélecteurs de variante, ZWJ, et ✈ (seulement dans 🧑‍✈️, le capitaine).
    ZERO = ('vs15', 'vs16', 'zwj', 'plane')
    order = ['.notdef', *ZERO]
    glyphs = {n: empty for n in order}
    cmap = {0xFE0E: 'vs15', 0xFE0F: 'vs16', 0x200D: 'zwj', 0x2708: 'plane'}
    uvs, colr, palette, pidx = [(0x2708, 0xFE0F, None), (0x2708, 0xFE0E, None)], {}, [], {}
    pua = 0xE000
    for name, ic in icons.items():
        lays = layers_of(ic)
        base = pathops.Path()
        for p, _, _ in lays: base = pathops.op(base, p, pathops.PathOp.UNION)
        # Cadré et centré dans son carré : même présence pour tous, rien de décentré.
        x0, y0, x1, y1 = base.bounds
        B = ic['box']; k = min(1.3, 0.94 * B / max(x1 - x0, y1 - y0))
        tx, ty = B / 2 - k * (x0 + x1) / 2, B / 2 - k * (y0 + y1) / 2
        def fit(p):
            q = pathops.Path(); p.draw(TransformPen(q.getPen(), (k, 0, 0, k, tx, ty))); return q
        lays = [(fit(p), c, a) for p, c, a in lays]
        base = fit(base)
        order.append(name); glyphs[name] = glyph(base, ic['box'])
        colr[name] = []
        for i, (p, col, a) in enumerate(lays):
            ln = f'{name}.{i}'; order.append(ln); glyphs[ln] = glyph(p, ic['box'])
            key = rgba(col, a)
            if key not in pidx: pidx[key] = len(palette); palette.append(key)
            colr[name].append((ln, pidx[key]))
        for cp in ic['cps'] + [pua]:
            if cp in cmap: print('doublon', hex(cp), name, file=sys.stderr)
            cmap[cp] = name
            if not 0xE000 <= cp <= 0xF8FF: uvs += [(cp, 0xFE0F, None), (cp, 0xFE0E, None)]
        pua += 1
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap, uvs=uvs)
    fb.setupGlyf(glyphs)
    glyf = fb.font['glyf']
    metrics = {}
    for n in order:
        g = glyf[n]; g.recalcBounds(glyf)
        adv = 0 if n in ZERO else ADV
        # lsb = xMin, sinon FreeType et Skia décalent le dessin vers la gauche.
        metrics[n] = (adv, getattr(g, 'xMin', 0) if g.numberOfContours else 0)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=880, descent=-220)
    fb.setupNameTable({'familyName': family, 'styleName': 'Regular'})
    fb.setupOS2(sTypoAscender=880, sTypoDescender=-220, sTypoLineGap=0, usWinAscent=950, usWinDescent=250)
    fb.setupPost()
    fb.font['COLR'] = buildCOLR(colr, version=0)
    fb.font['CPAL'] = buildCPAL([palette])
    fb.font.flavor = 'woff2'
    fb.save(out)
    print(out, len(icons), 'icônes', len(palette), 'couleurs')

if __name__ == '__main__':
    main(*sys.argv[1:4])
