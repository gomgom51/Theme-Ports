// Le bureau en pixel art (officepx.js) dans les scènes « nouveau bureau », « record » et « méfait », à la
// place de l'ancien dessin vectoriel : la scène se dessine en résolution 3 (600 × 336) et un pixel du bureau
// y vaut deux pixels du canevas, comme dans le panneau Bureau (le cadre montre presque tout le décor).
import { paintOffice, officeArtVersion, honourSpot } from './officepx.js';

export const OFFICE_SCENE = { W: 400, H: 168, k: 2 / 3 }; // pixels du bureau ; k : pixels de scène par pixel du bureau
const S = 2; // trophées deux fois plus fins que la pièce, comme dans le panneau

const toCanvas = (img) => {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
};
function paint(o) {
  const r = paintOffice({ ...o, W: OFFICE_SCENE.W, H: OFFICE_SCENE.H, S });
  const cv = document.createElement('canvas');
  cv.width = OFFICE_SCENE.W * S; cv.height = OFFICE_SCENE.H * S;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(toCanvas(r.room), 0, 0, cv.width, cv.height);
  if (r.juke) g.drawImage(toCanvas(r.juke.img), r.juke.x * S, r.juke.y * S, r.juke.w * S, r.juke.h * S);
  if (r.hi) g.drawImage(toCanvas(r.hi.img), Math.round(r.hi.x * S), Math.round(r.hi.y * S));
  return { canvas: cv, ox: r.ox, F: r.F };
}

/**
 * Le bureau d'une compagnie pour une scène. o : tier, shadow, color, logo, model, held (voir paintOffice).
 * Renvoie une fonction qui donne { canvas, ox, F } : elle repeint quand l'emblème ou les trophées, chargés à
 * part, arrivent (la scène l'appelle à chaque image, c'est gratuit le reste du temps).
 */
export function officeShot(o) {
  let ver = -1, shot = null;
  return () => {
    const v = officeArtVersion();
    if (v !== ver) { ver = v; shot = paint(o); }
    return shot;
  };
}

// Abscisse (pixels de scène) où poser le bureau : centré, ou cadré pour que la place d'un objet soit visible.
export function officeLeft(shot, spot = null, W = 200) {
  const w = OFFICE_SCENE.W * OFFICE_SCENE.k;
  const x = spot ? Math.max(W - w, Math.min(0, W / 2 - (spot.x + shot.ox) * OFFICE_SCENE.k)) : (W - w) / 2;
  return Math.round(x * 3) / 3; // calé sur les pixels du canevas (résolution 3)
}
// Dessine le bureau dans la scène (transformation de la scène déjà posée).
export function drawOfficeShot(g, shot, left) {
  if (!shot) return;
  const sm = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.drawImage(shot.canvas, left, 0, OFFICE_SCENE.W * OFFICE_SCENE.k, OFFICE_SCENE.H * OFFICE_SCENE.k);
  g.imageSmoothingEnabled = sm;
}
// Place d'un trophée ou d'un méfait dans le bureau, en pixels de scène : { x, y, w, h }.
export function spotRect(shot, spot, left) {
  const k = OFFICE_SCENE.k, h = spot.h * k, w = h * 0.75;
  return { x: left + (spot.x + shot.ox) * k - w / 2, y: (shot.F + spot.b) * k - h, w, h };
}
export { honourSpot };
