// Bruitages du port, entièrement synthétisés (aucun fichier son) avec la Web Audio API.
// Chaque fonction programme un son à l'instant `t` (temps du contexte audio) vers `out`.
// Elles marchent aussi dans un OfflineAudioContext (rendu d'un aperçu, tests).

const noiseCache = new WeakMap();

// Bruits blanc, rose et brun de quelques secondes, réutilisés en boucle.
function noise(ctx, kind = 'white') {
  let cache = noiseCache.get(ctx);
  if (!cache) { cache = {}; noiseCache.set(ctx, cache); }
  if (cache[kind]) return cache[kind];
  const len = Math.floor(ctx.sampleRate * 4);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  cache[kind] = buf;
  return buf;
}

function noiseSource(ctx, kind, t, dur) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx, kind);
  src.loop = true;
  src.start(t, Math.random() * 3);
  src.stop(t + dur + 0.05);
  return src;
}

// Enveloppe d'amplitude : montée, maintien, extinction exponentielle.
function envelope(ctx, t, { attack = 0.01, hold = 0, decay = 0.3, peak = 1 }) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
  return g;
}

function panner(ctx, pan, out) {
  if (!ctx.createStereoPanner) return out;
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(out);
  return p;
}

// Réverbération « bassin portuaire » : réponse impulsionnelle générée.
export function makeReverb(ctx, seconds = 2.6) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const tt = i / len;
      lp += 0.35 * ((Math.random() * 2 - 1) - lp); // un peu assourdie
      d[i] = lp * Math.pow(1 - tt, 2.2) * (i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  return conv;
}

// ---------- La mer ----------
// Fond continu : grondement grave qui respire lentement. Renvoie une fonction d'arrêt.
export function seaBed(ctx, out, t, { gain = 0.5 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx, 'brown');
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 3);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.09;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = gain * 0.35;
  lfo.connect(lfoGain).connect(g.gain);
  src.connect(lp).connect(g).connect(out);
  src.start(t);
  lfo.start(t);
  return (when = ctx.currentTime) => {
    g.gain.cancelScheduledValues(when);
    g.gain.setValueAtTime(g.gain.value, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.5);
    src.stop(when + 1.6); lfo.stop(when + 1.6);
  };
}

// Une vague qui monte puis se retire (bruit rose filtré, filtre qui s'ouvre et se referme).
export function wave(ctx, out, t, { gain = 0.35, dur = 5.5, pan = 0 } = {}) {
  const src = noiseSource(ctx, 'pink', t, dur);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 0.55;
  bp.frequency.setValueAtTime(350, t);
  bp.frequency.exponentialRampToValueAtTime(1500 + Math.random() * 800, t + dur * 0.42);
  bp.frequency.exponentialRampToValueAtTime(420, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(gain * 0.5, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(panner(ctx, pan, out));
}

// Clapotis contre le quai.
export function slap(ctx, out, t, { gain = 0.25, pan = 0 } = {}) {
  const src = noiseSource(ctx, 'pink', t, 0.5);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 500 + Math.random() * 500; lp.Q.value = 3;
  const g = envelope(ctx, t, { attack: 0.03, decay: 0.35, peak: gain });
  src.connect(lp).connect(g).connect(panner(ctx, pan, out));
}

// ---------- Mouettes ----------
// Série de cris « kiaaou kiou kiou » : glissando de fréquence, voix éraillée (modulation de
// fréquence rapide), filtre de formant. distance : 0 (proche) à 1 (lointaine).
export function gull(ctx, out, t, { calls = 3, base = 1650, gain = 0.22, pan = 0, distance = 0.3 } = {}) {
  const dest = panner(ctx, pan, out);
  const air = ctx.createBiquadFilter();
  air.type = 'lowpass'; air.frequency.value = 7000 - distance * 4500;
  air.connect(dest);
  let tt = t, f0 = base * (0.9 + Math.random() * 0.2);
  for (let i = 0; i < calls; i++) {
    const long = i === 0 && Math.random() < 0.7;
    const dur = long ? 0.42 + Math.random() * 0.12 : 0.17 + Math.random() * 0.07;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * 0.75, tt);
    osc.frequency.linearRampToValueAtTime(f0 * 1.22, tt + dur * 0.22);
    osc.frequency.exponentialRampToValueAtTime(f0 * (long ? 0.52 : 0.68), tt + dur);
    const mod = ctx.createOscillator();
    mod.frequency.value = 38 + Math.random() * 30;
    const modGain = ctx.createGain();
    modGain.gain.value = f0 * 0.06;
    mod.connect(modGain).connect(osc.frequency);
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass'; formant.frequency.value = 2300; formant.Q.value = 1.2;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 700;
    const g = envelope(ctx, tt, { attack: 0.025, hold: dur * 0.35, decay: dur * 0.6, peak: gain * (1 - distance * 0.6) * (i ? 0.85 : 1) });
    osc.connect(formant).connect(hp).connect(g).connect(air);
    osc.start(tt); mod.start(tt);
    osc.stop(tt + dur + 0.05); mod.stop(tt + dur + 0.05);
    tt += dur + 0.06 + Math.random() * 0.12;
    f0 *= 0.95;
  }
  return tt - t;
}

// ---------- Corne de brume ----------
// Son grave et puissant, qui monte en pression puis résonne dans le bassin.
export function horn(ctx, out, t, { dur = 2.8, freq = 98, gain = 0.32, distance = 0.4, reverb = null } = {}) {
  const mix = ctx.createGain();
  mix.gain.value = 1;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 2.5;
  lp.frequency.setValueAtTime(250, t);
  lp.frequency.exponentialRampToValueAtTime(1300 - distance * 500, t + 0.35);
  lp.frequency.exponentialRampToValueAtTime(950 - distance * 400, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.32);
  g.gain.setValueAtTime(gain, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.7);
  const parts = [[freq, 'sawtooth', 1], [freq * 1.004, 'sawtooth', 0.8], [freq * 0.996, 'sawtooth', 0.8], [freq * 2, 'square', 0.18], [freq * 1.5, 'sawtooth', 0.22]];
  const vib = ctx.createOscillator();
  vib.frequency.value = 4.3;
  const vibGain = ctx.createGain();
  vibGain.gain.value = freq * 0.003;
  vib.connect(vibGain);
  for (const [f, type, a] of parts) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f * 0.93, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.28);
    vibGain.connect(o.frequency);
    const og = ctx.createGain();
    og.gain.value = a * 0.3;
    o.connect(og).connect(mix);
    o.start(t); o.stop(t + dur + 0.8);
  }
  vib.start(t); vib.stop(t + dur + 0.8);
  mix.connect(lp).connect(g);
  g.connect(out);
  if (reverb) {
    const send = ctx.createGain();
    send.gain.value = 0.5 + distance * 0.5;
    g.connect(send).connect(reverb);
  }
  return dur + 0.7;
}

// ---------- Sifflet à vapeur ----------
// Vieux navires : un sifflet clair et soufflé (vapeur qui chuinte autour de la note).
export function whistle(ctx, out, t, { dur = 1.5, freq = 420, gain = 0.2, reverb = null } = {}) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.12);
  g.gain.setValueAtTime(gain, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
  for (const [f, a] of [[freq, 1], [freq * 1.25, 0.55], [freq * 1.5, 0.4], [freq * 2, 0.12]]) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f * 0.9, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.15);
    const og = ctx.createGain(); og.gain.value = a * 0.25;
    o.connect(og).connect(g);
    o.start(t); o.stop(t + dur + 0.4);
  }
  const steam = noiseSource(ctx, 'white', t, dur + 0.4);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 3; bp.Q.value = 1.2;
  const sg = ctx.createGain(); sg.gain.value = 0.18;
  steam.connect(bp).connect(sg).connect(g);
  g.connect(out);
  if (reverb) { const send = ctx.createGain(); send.gain.value = 0.6; g.connect(send).connect(reverb); }
  return dur + 0.35;
}

// ---------- Docks ----------
// Caisse en bois posée sur le quai : choc sourd, claquement du bois, résonance de la caisse.
export function crate(ctx, out, t, { gain = 0.5, pan = 0, size = 1, reverb = null } = {}) {
  const dest = panner(ctx, pan, out);
  const bus = ctx.createGain();
  bus.connect(dest);
  if (reverb) { const s = ctx.createGain(); s.gain.value = 0.35; bus.connect(s).connect(reverb); }
  const thump = (tt, amp) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(130 / size, tt);
    o.frequency.exponentialRampToValueAtTime(48 / size, tt + 0.09);
    o.connect(envelope(ctx, tt, { attack: 0.003, decay: 0.2, peak: amp })).connect(bus);
    o.start(tt); o.stop(tt + 0.25);
    const n = noiseSource(ctx, 'white', tt, 0.12);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 700 + Math.random() * 600; bp.Q.value = 1.1;
    n.connect(bp).connect(envelope(ctx, tt, { attack: 0.002, decay: 0.07, peak: amp * 0.55 })).connect(bus);
    const body = noiseSource(ctx, 'white', tt, 0.35);
    const res = ctx.createBiquadFilter();
    res.type = 'bandpass'; res.frequency.value = (190 + Math.random() * 80) / size; res.Q.value = 14;
    body.connect(res).connect(envelope(ctx, tt, { attack: 0.002, decay: 0.28, peak: amp * 2.2 })).connect(bus);
  };
  thump(t, gain);
  if (Math.random() < 0.6) thump(t + 0.1 + Math.random() * 0.08, gain * 0.45); // la caisse rebondit
}

// Tampon posé sur un papier, sur un bureau en bois : un choc sourd et bref, le claquement du papier.
// Sec (sans réverbération) et court, car il revient à chaque boîte de dialogue.
export function stamp(ctx, out, t, { gain = 0.22 } = {}) {
  const bus = ctx.createGain();
  bus.connect(out);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.07);
  o.connect(envelope(ctx, t, { attack: 0.002, decay: 0.13, peak: gain })).connect(bus);
  o.start(t); o.stop(t + 0.2);
  const n = noiseSource(ctx, 'white', t, 0.08);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1400;
  n.connect(lp).connect(envelope(ctx, t, { attack: 0.001, decay: 0.035, peak: gain * 0.5 })).connect(bus);
  const body = noiseSource(ctx, 'white', t, 0.18);
  const res = ctx.createBiquadFilter();
  res.type = 'bandpass'; res.frequency.value = 240; res.Q.value = 9;
  body.connect(res).connect(envelope(ctx, t, { attack: 0.002, decay: 0.12, peak: gain * 1.6 })).connect(bus);
}

// Conteneur métallique qui cogne : partiels inharmoniques qui résonnent.
export function clank(ctx, out, t, { gain = 0.3, pan = 0, base = 150, reverb = null } = {}) {
  const dest = panner(ctx, pan, out);
  const bus = ctx.createGain();
  bus.connect(dest);
  if (reverb) { const s = ctx.createGain(); s.gain.value = 0.6; bus.connect(s).connect(reverb); }
  const b = base * (0.85 + Math.random() * 0.3);
  [[1, 1, 1.1], [2.76, 0.6, 0.8], [5.4, 0.35, 0.5], [8.93, 0.2, 0.35], [13.3, 0.12, 0.2]].forEach(([r, a, d]) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = b * r;
    o.connect(envelope(ctx, t, { attack: 0.002, decay: d, peak: gain * a })).connect(bus);
    o.start(t); o.stop(t + d + 0.05);
  });
  const n = noiseSource(ctx, 'white', t, 0.06);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 1800;
  n.connect(hp).connect(envelope(ctx, t, { attack: 0.001, decay: 0.04, peak: gain * 0.7 })).connect(bus);
}

// Chaîne qui se déroule : petits chocs métalliques rapprochés.
export function chain(ctx, out, t, { gain = 0.18, pan = 0, dur = 0.8 } = {}) {
  const dest = panner(ctx, pan, out);
  let tt = t;
  while (tt < t + dur) {
    const n = noiseSource(ctx, 'white', tt, 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2600 + Math.random() * 2600; bp.Q.value = 5;
    const amp = gain * (0.5 + Math.random() * 0.5) * (1 - (tt - t) / (dur * 1.4));
    n.connect(bp).connect(envelope(ctx, tt, { attack: 0.001, decay: 0.035, peak: amp })).connect(dest);
    tt += 0.025 + Math.random() * 0.06;
  }
}

// ---------- Pompe à carburant ----------
// Deux bips de mise en route, le moteur de la pompe, le fuel qui coule (glouglous),
// puis le « clac » du pistolet qui se coupe.
export function fuelPump(ctx, out, t, { dur = 1.6, gain = 0.3 } = {}) {
  const dest = out;
  [0, 0.16].forEach((dt) => {
    const b = ctx.createOscillator();
    b.type = 'square'; b.frequency.value = 1320;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
    b.connect(lp).connect(envelope(ctx, t + dt, { attack: 0.004, hold: 0.06, decay: 0.03, peak: gain * 0.18 })).connect(dest);
    b.start(t + dt); b.stop(t + dt + 0.12);
  });
  const t0 = t + 0.35, t1 = t0 + dur;
  // Moteur : bourdonnement grave avec un léger tremblement.
  const motor = ctx.createGain();
  motor.gain.setValueAtTime(0.0001, t0);
  motor.gain.exponentialRampToValueAtTime(gain * 0.5, t0 + 0.2);
  motor.gain.setValueAtTime(gain * 0.5, t1);
  motor.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.12);
  const mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 420; mlp.Q.value = 1.5;
  [104, 105.3, 52].forEach((fq) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fq;
    const og = ctx.createGain(); og.gain.value = 0.35; o.connect(og).connect(mlp);
    o.start(t0); o.stop(t1 + 0.2);
  });
  const trem = ctx.createOscillator(); trem.frequency.value = 9;
  const tg = ctx.createGain(); tg.gain.value = gain * 0.12;
  trem.connect(tg).connect(motor.gain);
  trem.start(t0); trem.stop(t1 + 0.2);
  mlp.connect(motor).connect(dest);
  // Le fuel qui coule.
  const flow = noiseSource(ctx, 'pink', t0, dur + 0.2);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 2.2;
  const glug = ctx.createOscillator(); glug.frequency.value = 4.5;
  const gg = ctx.createGain(); gg.gain.value = 260;
  glug.connect(gg).connect(bp.frequency);
  glug.start(t0); glug.stop(t1 + 0.2);
  const fg = ctx.createGain();
  fg.gain.setValueAtTime(0.0001, t0 + 0.05);
  fg.gain.exponentialRampToValueAtTime(gain * 0.9, t0 + 0.35);
  fg.gain.setValueAtTime(gain * 0.9, t1 - 0.1);
  fg.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.05);
  flow.connect(bp).connect(fg).connect(dest);
  // Clac du pistolet.
  const n = noiseSource(ctx, 'white', t1, 0.05);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200;
  n.connect(hp).connect(envelope(ctx, t1, { attack: 0.001, decay: 0.025, peak: gain * 0.9 })).connect(dest);
  const k = ctx.createOscillator(); k.type = 'sine';
  k.frequency.setValueAtTime(420, t1); k.frequency.exponentialRampToValueAtTime(160, t1 + 0.07);
  k.connect(envelope(ctx, t1, { attack: 0.002, decay: 0.09, peak: gain * 0.7 })).connect(dest);
  k.start(t1); k.stop(t1 + 0.15);
  return t1 - t + 0.15;
}

// ---------- Caisse enregistreuse ----------
// « Ka-tching » : tiroir qui s'ouvre, deux coups de clochette, pièces qui tintent.
export function cashRegister(ctx, out, t, { gain = 0.35, pan = 0 } = {}) {
  const dest = panner(ctx, pan, out);
  // Le tiroir : frottement puis choc.
  const n = noiseSource(ctx, 'white', t, 0.12);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.4;
  n.connect(bp).connect(envelope(ctx, t, { attack: 0.01, hold: 0.03, decay: 0.06, peak: gain * 0.35 })).connect(dest);
  const thud = ctx.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(220, t + 0.08);
  thud.frequency.exponentialRampToValueAtTime(90, t + 0.16);
  thud.connect(envelope(ctx, t + 0.08, { attack: 0.002, decay: 0.12, peak: gain * 0.5 })).connect(dest);
  thud.start(t + 0.08); thud.stop(t + 0.3);
  // La clochette, deux fois (« ka-tching »).
  [[t + 0.13, 1650, 1], [t + 0.2, 2210, 0.85]].forEach(([tt, f0, a]) => {
    [[1, 1, 1.3], [2.0, 0.5, 0.9], [2.76, 0.35, 0.6], [5.4, 0.15, 0.3]].forEach(([r, amp, d]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f0 * r;
      o.connect(envelope(ctx, tt, { attack: 0.002, decay: d, peak: gain * 0.45 * amp * a })).connect(dest);
      o.start(tt); o.stop(tt + d + 0.05);
    });
  });
  // Les pièces.
  for (let k = 0; k < 9; k++) {
    const tt = t + 0.22 + Math.random() * 0.35;
    const c = ctx.createOscillator();
    c.type = 'triangle';
    c.frequency.value = 3800 + Math.random() * 3200;
    c.connect(envelope(ctx, tt, { attack: 0.001, decay: 0.05 + Math.random() * 0.08, peak: gain * 0.12 })).connect(dest);
    c.start(tt); c.stop(tt + 0.2);
  }
}

// ---------- Ambiances ----------
// Programme les événements d'une ambiance entre `from` et `to` (secondes du contexte).
// `state` garde l'heure du prochain événement de chaque famille d'un appel à l'autre.
export const SCENES = {
  // L'ambiance d'ouverture : le port en pleine activité.
  // bed : la houle continue en fond (0 = coupée ; trop présente, elle fatiguait l'oreille).
  title: {
    bed: 0,
    events: {
      wave: { first: [0.2, 1], every: [3.2, 6], play: (c, o, t, r) => wave(c, o, t, { gain: 0.22 + Math.random() * 0.12, dur: 4.5 + Math.random() * 2.5, pan: Math.random() * 1.2 - 0.6 }) },
      slap: { first: [1, 3], every: [1.8, 4.5], play: (c, o, t) => slap(c, o, t, { gain: 0.12 + Math.random() * 0.1, pan: Math.random() * 1.4 - 0.7 }) },
      gull: { first: [0.6, 1.5], every: [3.5, 9], play: (c, o, t) => {
        const pan = Math.random() * 1.6 - 0.8;
        const d = gull(c, o, t, { calls: 2 + Math.floor(Math.random() * 4), pan, distance: Math.random() * 0.7 });
        if (Math.random() < 0.35) gull(c, o, t + d + 0.3, { calls: 2 + Math.floor(Math.random() * 2), base: 1900, pan: -pan, distance: 0.6 }); // une autre lui répond
      } },
      dock: { first: [2.5, 4], every: [3.5, 9], play: (c, o, t, r) => {
        const pan = Math.random() * 1.4 - 0.7, x = Math.random();
        if (x < 0.45) crate(c, o, t, { gain: 0.32 + Math.random() * 0.2, pan, size: 0.8 + Math.random() * 0.6, reverb: r });
        else if (x < 0.7) { crate(c, o, t, { gain: 0.3, pan, reverb: r }); crate(c, o, t + 0.55 + Math.random() * 0.3, { gain: 0.26, pan, reverb: r }); }
        else if (x < 0.88) clank(c, o, t, { gain: 0.18 + Math.random() * 0.1, pan, reverb: r });
        else chain(c, o, t, { pan, dur: 0.6 + Math.random() * 0.6 });
      } },
      horn: { first: [1.4, 1.8], every: [38, 70], play: (c, o, t, r) => horn(c, o, t, { dur: 2.4 + Math.random() * 1.2, freq: 92 + Math.random() * 16, distance: 0.35 + Math.random() * 0.4, reverb: r }) },
    },
  },
  // En jeu : la mer et quelques mouettes au loin, discrètement.
  game: {
    bed: 0,
    events: {
      wave: { first: [0.5, 2], every: [4.5, 8.5], play: (c, o, t) => wave(c, o, t, { gain: 0.13 + Math.random() * 0.07, dur: 5 + Math.random() * 2.5, pan: Math.random() * 1.2 - 0.6 }) },
      gull: { first: [6, 15], every: [22, 50], play: (c, o, t) => gull(c, o, t, { calls: 2 + Math.floor(Math.random() * 3), pan: Math.random() * 1.6 - 0.8, distance: 0.55 + Math.random() * 0.4, gain: 0.16 }) },
    },
  },
};

export function scheduleScene(ctx, out, reverb, scene, state, from, to) {
  for (const [name, ev] of Object.entries(scene.events)) {
    if (state[name] == null) state[name] = from + ev.first[0] + Math.random() * (ev.first[1] - ev.first[0]);
    while (state[name] < to) {
      if (state[name] >= from - 0.05) ev.play(ctx, out, Math.max(state[name], ctx.currentTime + 0.02), reverb);
      state[name] += ev.every[0] + Math.random() * (ev.every[1] - ev.every[0]);
    }
  }
}

// Confiance et vertu : un petit signal (≈ 0,3 s) quand la note bouge d'un point ou plus.
// Confiance : bois et laiton (deux notes de marimba) ; vertu : verre (carillon léger, avec un
// harmonique qui scintille). En hausse les notes montent ; en baisse elles descendent sur un
// petit coup sourd.
export function standingCue(ctx, out, t, { kind = 'trust', up = true, gain = 0.16 } = {}) {
  const trust = kind === 'trust';
  const notes = trust ? (up ? [523.25, 783.99] : [392, 293.66]) : (up ? [1318.5, 1975.5] : [659.25, 587.33]);
  notes.forEach((f, i) => {
    const t0 = t + i * (trust ? 0.09 : 0.075), dur = trust ? 0.22 : 0.36;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = trust ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out); o.start(t0); o.stop(t0 + dur + 0.02);
    if (!trust && up) {
      const o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2.01, t0);
      g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(gain * 0.3, t0 + 0.01); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.8);
      o2.connect(g2).connect(out); o2.start(t0); o2.stop(t0 + dur);
    }
  });
  if (!up) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(62, t + 0.18);
    g.gain.setValueAtTime(gain * 0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.22);
  }
}


// ---------- Œufs de Pâques (sons de secours, sans fichier) ----------
// Sonar : un « ping » clair qui s'éteint dans l'eau, puis son écho.
export function sonar(ctx, out, t, { gain = 0.22, reverb = null } = {}) {
  for (const [dt, g] of [[0, 1], [0.95, 0.35]]) {
    const o = ctx.createOscillator(), e = envelope(ctx, t + dt, { attack: 0.004, decay: 1.6, peak: gain * g });
    o.type = 'sine';
    o.frequency.setValueAtTime(1180, t + dt);
    o.frequency.exponentialRampToValueAtTime(1120, t + dt + 1.6);
    o.connect(e).connect(out);
    if (reverb) e.connect(reverb);
    o.start(t + dt); o.stop(t + dt + 1.8);
  }
}
// Fantôme : un accord mineur qui gonfle et tremble, dans le vent.
export function ghost(ctx, out, t, { gain = 0.12, reverb = null } = {}) {
  const dur = 3.2;
  for (const f of [220, 261.6, 329.6, 440 * 1.003]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    lfo.frequency.value = 5 + Math.random() * 1.5; lg.gain.value = f * 0.012;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain / 3, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    if (reverb) g.connect(reverb);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }
  const n = noiseSource(ctx, 'pink', t, dur), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
  bp.type = 'bandpass'; bp.frequency.setValueAtTime(500, t); bp.frequency.linearRampToValueAtTime(900, t + dur); bp.Q.value = 2;
  ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(gain * 0.5, t + 1.4); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(bp).connect(ng).connect(out);
}
// Fanfare : trois notes montantes, brèves et joyeuses.
export function fanfare(ctx, out, t, { gain = 0.14, reverb = null } = {}) {
  [523.3, 659.3, 784, 1046.5].forEach((f, i) => {
    const o = ctx.createOscillator(), e = envelope(ctx, t + i * 0.13, { attack: 0.01, hold: i === 3 ? 0.25 : 0.05, decay: i === 3 ? 0.6 : 0.12, peak: gain });
    o.type = 'square'; o.frequency.value = f;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    o.connect(lp).connect(e).connect(out);
    if (reverb) e.connect(reverb);
    o.start(t + i * 0.13); o.stop(t + i * 0.13 + 1);
  });
}
