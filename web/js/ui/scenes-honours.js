// Scènes des records et des méfaits, dessinées en double résolution et lissées : un peu moins
// pixelisées que les autres, pour marquer le coup.
//  trophy : sur une scène de gala, le dirigeant (costume aux couleurs de la compagnie) reçoit le
//           trophée sous les flashs, le brandit, puis le trophée vole jusqu'à sa place sur
//           l'étagère du bureau.
//  grim   : un bureau dans la nuit, une lampe qui se balance ; la preuve s'abat sur le bureau
//           (le couteau se plante), une silhouette s'éloigne, puis la preuve rejoint sa place.
// variant : { office (Image du bureau sans l'objet), item (Image de l'objet), slot ({ x, b, h }
//           dans le dessin du bureau 480 × 200), logo (Image), id }.
import { W, H, hash, clamp01, ease } from './pixel.js';

const OFFICE = { x: -34, w: 268, k: 268 / 480, ky: 112 / 200 }; // le bureau dessiné dans la scène (comme la scène « office »)
const smooth = (p) => { const q = clamp01(p); return q * q * (3 - 2 * q); };
const lerp = (a, b, p) => a + (b - a) * p;
const ok = (img) => img && img.complete && img.naturalWidth > 0;
// Le bureau est plus large que la scène : on le cadre pour que la place de l'objet soit visible.
const officeX = (slot) => (slot ? Math.max(W - OFFICE.w, Math.min(0, W / 2 - slot.x * OFFICE.k)) : OFFICE.x);
const slotRect = (slot) => {
  const h = slot.h * OFFICE.ky, w = h * 0.75;
  return { x: officeX(slot) + slot.x * OFFICE.k - w / 2, y: slot.b * OFFICE.ky - h, w, h };
};
function drawOffice(g, img, dark = 0, slot = null) {
  g.fillStyle = '#1b1f27'; g.fillRect(0, 0, W, H);
  if (ok(img)) g.drawImage(img, officeX(slot), 0, OFFICE.w, H);
  if (dark) { g.fillStyle = `rgba(8,10,24,${dark})`; g.fillRect(0, 0, W, H); }
}
function glint(g, x, y, r, t, color = '#fff6c8') {
  g.save();
  g.globalAlpha = clamp01(1 - t);
  g.strokeStyle = color; g.lineWidth = 0.8;
  g.beginPath(); g.arc(x, y, r * (0.4 + t * 1.6), 0, Math.PI * 2); g.stroke();
  g.fillStyle = color;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + t;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a - 0.12) * r * 1.8, y + Math.sin(a - 0.12) * r * 1.8); g.lineTo(x + Math.cos(a + 0.12) * r * 1.8, y + Math.sin(a + 0.12) * r * 1.8); g.fill();
  }
  g.restore();
}
// L'objet vole du milieu de la scène jusqu'à sa place (de p = 0 à 1).
function flight(g, item, slot, p, from = { x: 100, y: 78, h: 40 }) {
  const r = slotRect(slot);
  const q = smooth(p);
  const h = lerp(from.h, r.h, q), w = h * 0.75;
  const cx = lerp(from.x, r.x + r.w / 2, q), by = lerp(from.y, r.y + r.h, q) - Math.sin(q * Math.PI) * 26;
  if (ok(item)) g.drawImage(item, cx - w / 2, by - h, w, h);
  return r;
}

// ---------- Personnages lissés ----------
function person(g, x, y, suit, { armUp = 0, walk = 0, tie = '#f4f0e6', skin = '#e9c7a3', hair = '#3a2a1e', face = 1 } = {}) {
  g.save();
  g.translate(x, y);
  const bob = Math.abs(Math.sin(walk * Math.PI)) * 0.8;
  g.translate(0, -bob);
  // Jambes
  g.fillStyle = '#23262d';
  const step = Math.sin(walk * Math.PI) * 2.2;
  g.beginPath(); g.roundRect(-3.6 + step * 0.3, -13, 3, 13, 1); g.fill();
  g.beginPath(); g.roundRect(0.6 - step * 0.3, -13, 3, 13, 1); g.fill();
  g.fillStyle = '#111'; g.fillRect(-4.2 + step * 0.3, -1.2, 4, 1.4); g.fillRect(0.2 - step * 0.3, -1.2, 4, 1.4);
  // Bras gauche (le long du corps)
  g.strokeStyle = suit; g.lineCap = 'round'; g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(-5 * face, -23); g.lineTo(-6.2 * face, -14); g.stroke();
  g.fillStyle = skin; g.beginPath(); g.arc(-6.2 * face, -13.4, 1.2, 0, Math.PI * 2); g.fill();
  // Corps
  g.fillStyle = suit;
  g.beginPath(); g.roundRect(-5.4, -25.5, 10.8, 13.5, 2.2); g.fill();
  g.fillStyle = '#f4f0e6'; g.beginPath(); g.moveTo(-1.8, -25.4); g.lineTo(1.8, -25.4); g.lineTo(0, -19.6); g.fill();
  g.fillStyle = tie; g.beginPath(); g.moveTo(-0.6, -24.6); g.lineTo(0.6, -24.6); g.lineTo(0.9, -19.4); g.lineTo(0, -18.4); g.lineTo(-0.9, -19.4); g.fill();
  // Tête
  g.fillStyle = skin; g.beginPath(); g.arc(0, -29.4, 3.7, 0, Math.PI * 2); g.fill();
  g.fillStyle = hair; g.beginPath(); g.arc(0, -30.4, 3.8, Math.PI * 1.05, Math.PI * 1.95); g.fill();
  // Bras droit : levé selon armUp (0 : le long du corps, 1 : au-dessus de la tête)
  const a = lerp(Math.PI * 0.55, -Math.PI * 0.42, armUp); // angle depuis l'épaule
  const sx = 5 * face, sy = -23;
  const hx = sx + Math.cos(a) * 9.5 * face, hy = sy + Math.sin(a) * 9.5;
  g.strokeStyle = suit; g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy); g.stroke();
  g.fillStyle = skin; g.beginPath(); g.arc(hx, hy, 1.2, 0, Math.PI * 2); g.fill();
  g.restore();
  return { x: x + hx, y: y - bob + hy };
}

// ---------- Scène de gala ----------
function stage(g, t, color, logo) {
  // Rideau
  const grad = g.createLinearGradient(0, 0, 0, 86);
  grad.addColorStop(0, '#0d1424'); grad.addColorStop(1, '#1d2b48');
  g.fillStyle = grad; g.fillRect(0, 0, W, 86);
  for (let x = 0; x < W; x += 8) { g.fillStyle = `rgba(0,0,0,${0.18 + 0.12 * Math.sin(x * 0.7)})`; g.fillRect(x, 0, 4, 86); }
  g.fillStyle = '#5b1d22'; g.fillRect(0, 0, W, 9);
  for (let x = 0; x < W; x += 6) { g.fillStyle = '#c9a24a'; g.beginPath(); g.moveTo(x, 9); g.lineTo(x + 3, 13); g.lineTo(x + 6, 9); g.fill(); }
  // Grande bannière aux couleurs de la compagnie
  g.fillStyle = color; g.beginPath(); g.moveTo(84, 14); g.lineTo(136, 14); g.lineTo(136, 50); g.lineTo(110, 58); g.lineTo(84, 50); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(84, 14, 6, 36);
  if (ok(logo)) g.drawImage(logo, 98, 22, 24, 24);
  // Projecteurs
  for (const [x0, ph] of [[30, 0], [170, 1.7]]) {
    const sway = Math.sin(t * 0.9 + ph) * 10;
    g.save();
    const cg = g.createLinearGradient(x0, 0, 110 + sway, 90);
    cg.addColorStop(0, 'rgba(255,248,214,0.32)'); cg.addColorStop(1, 'rgba(255,248,214,0.02)');
    g.fillStyle = cg;
    g.beginPath(); g.moveTo(x0 - 3, 0); g.lineTo(x0 + 3, 0); g.lineTo(130 + sway, 92); g.lineTo(90 + sway, 92); g.fill();
    g.restore();
  }
  // Plancher de la scène
  g.fillStyle = '#3a2a1e'; g.fillRect(0, 86, W, 26);
  g.fillStyle = '#4a3626'; for (let x = -10; x < W; x += 14) g.fillRect(x, 86, 1, 26);
  g.fillStyle = '#6b4f37'; g.fillRect(0, 86, W, 1.2);
  const fl = g.createRadialGradient(110, 90, 2, 110, 90, 40);
  fl.addColorStop(0, 'rgba(255,240,200,0.35)'); fl.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = fl; g.fillRect(60, 80, 100, 20);
  // Pupitre
  g.fillStyle = '#2a2018'; g.beginPath(); g.moveTo(40, 66); g.lineTo(62, 66); g.lineTo(60, 90); g.lineTo(42, 90); g.fill();
  g.fillStyle = color; g.fillRect(43, 70, 16, 10);
  g.fillStyle = '#c9a24a'; g.fillRect(39, 64.5, 24, 2);
  g.strokeStyle = '#555'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(56, 64); g.quadraticCurveTo(60, 58, 57, 55); g.stroke();
}
function audience(g, t) {
  for (let i = 0; i < 16; i++) {
    const x = 6 + i * 12.6 + (hash(i, 3) % 5), y = 104 + (hash(i, 4) % 4);
    g.fillStyle = '#07090f';
    g.beginPath(); g.arc(x, y - 6, 3.6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.roundRect(x - 6, y - 3, 12, 12, 4); g.fill();
  }
  // Flashs des photographes
  for (let i = 0; i < 6; i++) {
    const period = 1.1 + (hash(i, 9) % 70) / 100, ph = (hash(i, 10) % 100) / 100;
    const k = ((t / period) + ph) % 1;
    if (k > 0.12) continue;
    const x = 14 + (hash(i, 11) % 172), y = 96 + (hash(i, 12) % 6);
    const fg = g.createRadialGradient(x, y, 0, x, y, 14);
    fg.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - k / 0.12)})`); fg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = fg; g.fillRect(x - 14, y - 14, 28, 28);
  }
}
function confetti(g, t, t0, color) {
  if (t < t0) return;
  const cols = [color, '#ffd34d', '#f4f4f4', '#5fd3e8', '#ff8a7a'];
  for (let i = 0; i < 70; i++) {
    const k = ((t - t0) / 2.6 + (hash(i, 61) % 100) / 100) % 1;
    const x = (hash(i, 62) % W) + Math.sin(t * 2.4 + i) * 4, y = -4 + k * (H + 8);
    g.save(); g.translate(x, y); g.rotate(t * 3 + i); g.fillStyle = cols[i % cols.length]; g.fillRect(-1.2, -0.6, 2.4, 1.2); g.restore();
  }
}

export const HONOUR_SCENES = {
  trophy: {
    title: 'Un nouveau record !', mood: 'good', res: 3, loop: [6.2, 8.2],
    draw(g, t, o) {
      const v = o.variant || {};
      const color = o.color || '#c0392b';
      if (t < 4.2) {
        stage(g, t, color, v.logo);
        // Le présentateur, à gauche, tient le trophée jusqu'à la remise.
        const give = smooth((t - 1.0) / 0.6);
        const pres = person(g, 74, 88, '#3b3f47', { armUp: 0.35 - give * 0.15, tie: '#8c2f2f', hair: '#bcbcbc' });
        // Le dirigeant entre par la droite, reçoit le trophée et le brandit.
        const walk = clamp01(t / 1.0);
        const cx = lerp(178, 104, ease(walk));
        const raise = smooth((t - 1.7) / 0.7);
        const ceo = person(g, cx, 88, color, { armUp: 0.32 + raise * 0.68, walk: walk < 1 ? t * 2.2 : 0, face: -1, tie: '#f2c230' });
        const hand = give < 1 ? { x: lerp(pres.x, ceo.x, give), y: lerp(pres.y, ceo.y, give) } : ceo;
        if (ok(v.item)) {
          const hh = 18 + raise * 4;
          g.drawImage(v.item, hand.x - hh * 0.375, hand.y - hh + 2, hh * 0.75, hh);
          if (t > 2.4) glint(g, hand.x + 3, hand.y - hh + 4, 3, ((t - 2.4) * 0.8) % 1);
        }
        audience(g, t);
        confetti(g, t, 2.3, color);
        if (t > 3.6) { g.fillStyle = `rgba(0,0,0,${smooth((t - 3.6) / 0.6)})`; g.fillRect(0, 0, W, H); }
        return;
      }
      // Le bureau : le trophée rejoint sa place sur l'étagère.
      drawOffice(g, v.office, 0, v.slot);
      if (t < 4.6) { g.fillStyle = `rgba(0,0,0,${1 - smooth((t - 4.2) / 0.4)})`; g.fillRect(0, 0, W, H); }
      const p = clamp01((t - 4.4) / 1.5);
      const r = v.slot ? flight(g, v.item, v.slot, p) : null;
      if (r && t > 5.9) glint(g, r.x + r.w / 2, r.y + r.h * 0.3, 4, ((t - 5.9) * 0.7) % 1);
    },
  },
  grim: {
    title: 'Un méfait de plus', mood: 'bad', res: 3, loop: [5.8, 7.8],
    draw(g, t, o) {
      const v = o.variant || {};
      if (t < 3.6) {
        // Choc : le bureau tremble quand la preuve s'abat.
        const hit = 1.2;
        const shake = t > hit && t < hit + 0.25 ? (hash(Math.floor(t * 60), 7) % 3) - 1 : 0;
        g.save(); g.translate(shake * 1.4, shake);
        g.fillStyle = '#07080d'; g.fillRect(-4, -4, W + 8, H + 8);
        // La porte entrouverte au fond, et la silhouette qui s'éloigne.
        g.fillStyle = '#1a1712'; g.fillRect(150, 14, 30, 58);
        const lightA = 0.55 + Math.sin(t * 13) * 0.04;
        g.fillStyle = `rgba(255,214,140,${lightA})`; g.fillRect(150, 14, 7, 58);
        const leave = smooth((t - 1.8) / 1.2);
        if (t > 0.5 && leave < 1) { g.fillStyle = `rgba(4,4,6,${1 - leave})`; g.beginPath(); g.arc(153.5 + leave * 4, 30, 2.6, 0, Math.PI * 2); g.fill(); g.fillRect(151 + leave * 4, 32.5, 5, 20); }
        // Le bureau en perspective.
        g.fillStyle = '#2a1a10'; g.beginPath(); g.moveTo(10, 74); g.lineTo(190, 74); g.lineTo(206, 112); g.lineTo(-6, 112); g.fill();
        g.fillStyle = '#3a2416'; g.fillRect(-6, 74, 212, 1.4);
        // La lampe qui se balance, et son cercle de lumière.
        const sw = Math.sin(t * 1.6) * 0.18;
        const lx = 70 + Math.sin(sw) * 40, ly = 6 + Math.cos(sw) * 40;
        g.strokeStyle = '#111'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(70, -2); g.lineTo(lx, ly); g.stroke();
        const flick = t > hit && t < hit + 0.4 && Math.floor(t * 20) % 2 ? 0.4 : 1;
        const cone = g.createRadialGradient(lx + 10, 92, 2, lx + 10, 92, 46);
        cone.addColorStop(0, `rgba(255,214,150,${0.5 * flick})`); cone.addColorStop(1, 'rgba(255,214,150,0)');
        g.fillStyle = cone; g.fillRect(0, 50, W, 62);
        g.fillStyle = '#2b2b2b'; g.beginPath(); g.moveTo(lx - 7, ly + 6); g.lineTo(lx + 7, ly + 6); g.lineTo(lx + 3, ly); g.lineTo(lx - 3, ly); g.fill();
        g.fillStyle = `rgba(255,236,190,${flick})`; g.beginPath(); g.arc(lx, ly + 6.5, 1.6, 0, Math.PI * 2); g.fill();
        // La preuve tombe (le couteau se plante, la pointe en bas).
        const fall = smooth(t / hit);
        const hh = v.id === 'couteau' ? 50 : 40, bx = 100;
        const y = lerp(-hh, 96, Math.pow(fall, 2));
        if (ok(v.item)) {
          if (v.id === 'couteau') g.drawImage(v.item, bx - hh * 0.375, y - hh, hh * 0.75, hh);
          else { const bounce = t > hit ? Math.max(0, Math.sin((t - hit) * 14) * 3 * Math.exp(-(t - hit) * 5)) : 0; g.drawImage(v.item, bx - hh * 0.375, y - hh - bounce, hh * 0.75, hh); }
        }
        if (t > hit) {
          for (let i = 0; i < 10; i++) { const k = clamp01((t - hit) / 0.8); g.fillStyle = `rgba(120,100,80,${0.6 * (1 - k)})`; g.fillRect(bx + (i - 5) * 3 * k * 2, 95 - k * 6 - (i % 3), 1, 1); }
          glint(g, bx + 4, 70, 3.4, ((t - hit - 0.3) * 0.7) % 1, '#ff5a4a');
        }
        g.restore();
        if (t > 3.0) { g.fillStyle = `rgba(0,0,0,${smooth((t - 3.0) / 0.6)})`; g.fillRect(0, 0, W, H); }
        return;
      }
      drawOffice(g, v.office, 0.45, v.slot);
      if (t < 4.0) { g.fillStyle = `rgba(0,0,0,${1 - smooth((t - 3.6) / 0.4)})`; g.fillRect(0, 0, W, H); }
      const p = clamp01((t - 3.9) / 1.5);
      const r = v.slot ? flight(g, v.item, v.slot, p, { x: 100, y: 84, h: 36 }) : null;
      if (r && t > 5.4) glint(g, r.x + r.w / 2, r.y + r.h * 0.35, 3.6, ((t - 5.4) * 0.6) % 1, '#ff5a4a');
    },
  },
};
