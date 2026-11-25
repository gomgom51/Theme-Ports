// Gestion du son : ambiance du port (écran d'accueil), ambiance marine (en jeu) et
// bruitages liés aux actions. Le son démarre au premier toucher ou clic, comme
// l'exigent les navigateurs.
import * as S from './sounds.js';
import { SHIP_TYPES } from '../data/ships.js';

const KEY = 'portdattache.audio';
// Musiques facultatives (à déposer dans web/musique/, voir docs/musique-suno.md).
// Pendant la partie, deux thèmes par standing de la compagnie (niveau1 puis niveau1b,
// … niveau5b), du vieux chant de marins à la musique de multinationale, et niveau0 quand
// la compagnie a perdu de l'argent (valeur nette sous 5 M$). Sans la seconde chanson d'un
// niveau, la première continue ; jeu.mp3 en secours.
const TRACKS = {
  title: { src: 'musique/accueil.mp3', volume: 0.45, loop: true },
  game: { src: 'musique/jeu.mp3', volume: 0.22, loop: true },
  end: { src: 'musique/victoire.mp3', volume: 0.5, loop: false },
  tier0: { src: 'musique/niveau0.mp3', volume: 0.22, loop: true },
  tier1: { src: 'musique/niveau1.mp3', volume: 0.22, loop: true },
  tier2: { src: 'musique/niveau2.mp3', volume: 0.22, loop: true },
  tier3: { src: 'musique/niveau3.mp3', volume: 0.22, loop: true },
  tier4: { src: 'musique/niveau4.mp3', volume: 0.22, loop: true },
  tier5: { src: 'musique/niveau5.mp3', volume: 0.22, loop: true },
  tier1b: { src: 'musique/niveau1b.mp3', volume: 0.22, loop: true },
  tier2b: { src: 'musique/niveau2b.mp3', volume: 0.22, loop: true },
  tier3b: { src: 'musique/niveau3b.mp3', volume: 0.22, loop: true },
  tier4b: { src: 'musique/niveau4b.mp3', volume: 0.22, loop: true },
  tier5b: { src: 'musique/niveau5b.mp3', volume: 0.22, loop: true },
  // Thèmes de situation (prioritaires sur le niveau quand le fichier existe) : une victoire en vue
  // (75 % du chemin), la liste noire, ou un concurrent sur le point de gagner.
  domination: { src: 'musique/domination.mp3', volume: 0.24, loop: true },
  reputation: { src: 'musique/respect.mp3', volume: 0.24, loop: true },
  legend: { src: 'musique/legende.mp3', volume: 0.24, loop: true },
  shadow: { src: 'musique/ombre.mp3', volume: 0.24, loop: true },
  blacklist: { src: 'musique/liste-noire.mp3', volume: 0.28, loop: true }, // enregistrée un peu moins fort (−17 LUFS)
  blacklistb: { src: 'musique/liste-noireb.mp3', volume: 0.24, loop: true }, // seconde chanson, après deux ans sur la liste
  menace: { src: 'musique/menace.mp3', volume: 0.21, loop: true }, // enregistrée un peu plus fort (−14,5 LUFS)
};

// Seconde chanson d'un thème de situation : sans elle, la première.
const MOOD_FALLBACK = { blacklistb: 'blacklist' };

// Sons enregistrés (prioritaires sur les versions synthétisées quand ils existent).
const SAMPLES = {
  fuel: 'sons/pompe.mp3', cash: 'sons/caisse.mp3', bell: 'sons/cloche.mp3', tick: 'sons/tic-tac.mp3', nofuel: 'sons/tasse-vide.mp3',
  // Confiance : deux battements de cœur quand elle monte, une porte qui claque quand elle baisse.
  // Vertu : harpe qui monte / qui retombe.
  trustUp: 'sons/confiance-plus.mp3', trustDown: 'sons/confiance-moins.mp3', virtueUp: 'sons/vertu-plus.mp3', virtueDown: 'sons/vertu-moins.mp3',
};
// Corne de départ : un son par famille de navires (même fonction), joué plus grave pour un
// gros navire et plus aigu pour un petit (hauteur selon le port en lourd, par rapport au navire
// de référence de la famille), et chaque navire garde sa nuance (± 3 %).
// Fichier sons/corne-<famille>.mp3 (la famille doit figurer dans HORN_FILES), sinon synthèse.
const HORN_FILES = new Set(['cargo', 'vapeur', 'vraquier', 'petrolier', 'gazier', 'porte_conteneurs', 'dramatique']);
// Clin d'œil : le plus gros navire du jeu a sa propre corne, jouée telle quelle (sans changer
// sa hauteur). Tant que le fichier n'est pas chargé, il garde la corne de sa famille.
const HORN_SPECIAL = { petrolier_ulcc: 'dramatique' };
const HORN_MAX = 3; // secondes : durée maximale d'une corne de famille (la corne spéciale reste entière)
export const HORN_FAMILIES = {
  cargo: { ref: 12500, types: ['caboteur', 'polyvalent', 'colis_lourds', 'frigorifique'] },
  vapeur: { ref: 9000, types: ['cargo_ancien', 'petrolier_ancien'] },
  vraquier: { ref: 58000, types: ['vraquier_handy', 'vraquier_supramax', 'vraquier_panamax', 'vraquier_capesize'] },
  petrolier: { ref: 110000, types: ['chimiquier', 'petrolier_mr', 'petrolier_aframax', 'petrolier_suezmax', 'petrolier_vlcc', 'petrolier_ulcc'] },
  gazier: { ref: 50000, types: ['gazier', 'methanier'] },
  porte_conteneurs: { ref: 55000, types: ['feeder', 'porte_voitures', 'pc_panamax', 'pc_geant'] },
};
const HORN_OF = Object.fromEntries(Object.entries(HORN_FAMILIES).flatMap(([f, F]) => F.types.map((t) => [t, f])));
export const hornFamily = (typeId) => HORN_OF[typeId] || 'cargo';
// Hauteur du son pour un navire : plus grave quand il est plus gros que la référence.
export function hornPitch(typeId, id = 0) {
  const F = HORN_FAMILIES[hornFamily(typeId)], dwt = SHIP_TYPES[typeId]?.dwt || F.ref;
  const size = Math.max(0.72, Math.min(1.35, Math.pow(F.ref / dwt, 0.18)));
  return size * (1 + ((((id || 0) * 37) % 7) - 3) / 100);
}
// Synthèse (sans fichier) : corne, sifflet à vapeur, deux coups, corne à deux tons.
export const HORN_SYNTH = {
  cargo: { freq: 160, dur: 1.3, gain: 0.24 },
  vapeur: { whistle: true, freq: 430, dur: 1.5, gain: 0.18 },
  vraquier: { freq: 105, dur: 2, gain: 0.27 },
  petrolier: { freq: 92, dur: 2.3, gain: 0.28, distance: 0.35 },
  gazier: { freq: 122, dur: 1, blasts: 2, gap: 0.35, gain: 0.25 },
  porte_conteneurs: { freq: 98, dur: 2.2, chord: true, gain: 0.22 },
};

// Sons des scènes d'événements fournis (sons/scene-<nom>.mp3, liste dans sons/LISEZMOI.txt) :
// chargés à la première scène qui les joue. Une scène sans son reste silencieuse.
const SCENE_SOUNDS = new Set([]);

function loadSettings() {
  const defaults = { ambience: true, sfx: true, music: true, volume: 0.8 };
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return defaults; }
}

export class AudioManager {
  constructor() {
    this.settings = loadSettings();
    this.ctx = null;
    this.sceneName = null;
    this.stopBed = null;
    this.state = {};
    this.onUnlock = null; // rappel de l'interface (accueil : bouton « Son », voile « Embarquer »)
    const unlock = (e) => this.unlock(e);
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    this.probe();
  }

  // Les navigateurs interdisent le son avant un premier clic ou une touche, sauf
  // exceptions (application Android, site installé, son autorisé pour ce site) :
  // dans ces cas-là, tout démarre tout de suite, sans attendre.
  probe() {
    if (window.AndroidBridge || navigator.getAutoplayPolicy?.('audiocontext') === 'allowed') { this.unlock(); return; }
    this.setupContext();
    const c = this.ctx;
    if (!c) return;
    if (c.state === 'running') { this.unlock(); return; }
    c.addEventListener('statechange', () => { if (c.state === 'running' && !this.unlocked) this.unlock(); });
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* stockage indisponible */ } }

  // Premier geste (e) ou démarrage autorisé (sans e) : le son peut jouer.
  unlock(e) {
    if (!this.ctx) this.setupContext();
    else if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
    if (this.unlocked) { this.unlockTarget = null; return; } // un nouveau geste : ce n'est plus celui qui a débloqué le son
    this.unlocked = true;
    this.unlockTarget = e?.target || null; // pour reconnaître le clic qui a débloqué le son
    this.musicScene = null;
    this.playMusic(this.sceneName);
    this.onUnlock?.(e?.type || null);
  }

  setupContext() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.settings.volume;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
    this.master.connect(comp).connect(c.destination);
    this.ambBus = c.createGain();
    this.ambBus.gain.value = 1;
    this.ambBus.connect(this.master);
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);
    this.reverb = S.makeReverb(c);
    const wet = c.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);
    this.timer = setInterval(() => this.tick(), 400);
    this.loadSamples();
    const scene = this.sceneName;
    this.sceneName = null;
    if (scene) this.setScene(scene);
  }

  setScene(name) {
    if (name === this.sceneName) return;
    this.sceneName = name;
    this.playMusic(name);
    if (!this.ctx) return;
    if (this.stopBed) { this.stopBed(this.ctx.currentTime); this.stopBed = null; }
    this.state = {};
    const scene = S.SCENES[name];
    if (scene?.bed && this.settings.ambience) this.stopBed = S.seaBed(this.ctx, this.ambBus, this.ctx.currentTime + 0.05, { gain: scene.bed });
  }

  tick() {
    const c = this.ctx;
    if (!c || c.state !== 'running' || !this.settings.ambience) return;
    const scene = S.SCENES[this.sceneName];
    if (!scene) return;
    const now = c.currentTime;
    S.scheduleScene(c, this.ambBus, this.reverb, scene, this.state, now, now + 1.5);
  }

  async loadSamples() {
    this.buffers ??= {};
    for (const [name, src] of Object.entries(SAMPLES)) {
      try {
        const res = await fetch(src);
        if (!res.ok) continue;
        this.buffers[name] = await this.ctx.decodeAudioData(await res.arrayBuffer());
      } catch { /* on garde la version synthétisée */ }
    }
    for (const f of HORN_FILES) this.loadHorn(`corne-${f}`); // en arrière-plan : prêtes au premier départ
  }

  // Charge une corne (une seule fois) ; en cas d'échec, la synthèse prend le relais.
  loadHorn(name) {
    this.buffers ??= {};
    this.hornMissing ??= new Set();
    this.hornLoading ??= {};
    if (this.buffers[name] || this.hornMissing.has(name) || this.hornLoading[name]) return;
    this.hornLoading[name] = fetch(`sons/${name}.mp3`).then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
      .then((b) => this.ctx.decodeAudioData(b)).then((buf) => { this.buffers[name] = buf; }).catch(() => this.hornMissing.add(name));
  }

  // Son d'une scène d'événement, chargé à la demande.
  async playScene(kind) {
    const c = this.ctx, name = `scene-${kind}`;
    if (!c || !this.settings.sfx || c.state !== 'running' || !SCENE_SOUNDS.has(kind)) return;
    this.buffers = this.buffers || {};
    if (!this.buffers[name]) {
      try {
        const res = await fetch(`sons/${name}.mp3`);
        if (!res.ok) return;
        this.buffers[name] = await c.decodeAudioData(await res.arrayBuffer());
      } catch { return; }
    }
    this.playSample(name, { gain: 0.8, fadeOut: 0.6 });
  }

  // Corne de départ d'une famille (ou corne spéciale `special`, jouée sans changer sa hauteur) :
  // le fichier s'il est chargé, sinon la version synthétisée. Renvoie la durée approximative.
  playHorn(fam, pitch = 1, t = this.ctx.currentTime + 0.03, special = null) {
    const c = this.ctx, name = `corne-${fam}`;
    this.buffers ??= {};
    const sp = special && `corne-${special}`;
    if (sp && this.buffers[sp]) { this.playSample(sp, { gain: 0.8, fadeOut: 0.2 }); return this.buffers[sp].duration; }
    if (sp && HORN_FILES.has(special)) this.loadHorn(sp);
    if (this.buffers[name]) {
      // Joué plus lentement pour un gros navire : jamais plus de HORN_MAX secondes (fondu à la fin).
      const len = Math.min(HORN_MAX, this.buffers[name].duration / pitch);
      this.playSample(name, { gain: 0.8, rate: pitch, duration: len, fadeOut: 0.5 });
      return len;
    }
    if (HORN_FILES.has(fam)) this.loadHorn(name);
    const B = HORN_SYNTH[fam] || HORN_SYNTH.cargo, r = this.reverb, out = this.sfxBus;
    const H = { ...B, dur: B.dur / Math.sqrt(pitch) }; // un gros navire sonne plus grave et plus longtemps
    const f = H.freq * pitch, n = H.blasts || 1;
    for (let i = 0; i < n; i++) {
      const at = t + i * (H.dur + (H.gap || 0.3));
      if (H.whistle) S.whistle(c, out, at, { dur: H.dur, freq: f, gain: H.gain, reverb: r });
      else {
        S.horn(c, out, at, { dur: H.dur, freq: f, gain: H.gain, distance: H.distance ?? 0.25, reverb: r });
        if (H.chord) S.horn(c, out, at, { dur: H.dur, freq: f * 1.19, gain: H.gain * 0.7, distance: H.distance ?? 0.25, reverb: r }); // deux tons
      }
    }
    return n * H.dur + (n - 1) * (H.gap || 0.3) + 0.7;
  }

  // Joue un son enregistré : extrait de `duration` secondes avec fondu de sortie.
  playSample(name, { gain = 0.8, duration = null, fadeOut = 0.3, rate = 1 } = {}) {
    const buf = this.buffers?.[name];
    if (!buf) return false;
    const c = this.ctx, t = c.currentTime + 0.02;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = c.createGain();
    const end = t + (duration ?? buf.duration / rate);
    g.gain.setValueAtTime(gain, t);
    g.gain.setValueAtTime(gain, Math.max(t, end - fadeOut));
    g.gain.linearRampToValueAtTime(0.0001, end);
    src.connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(end + 0.05);
    return true;
  }

  // Bruitages ponctuels.
  play(name, arg) {
    const c = this.ctx;
    if (!c || !this.settings.sfx || c.state !== 'running') return;
    const t = c.currentTime + 0.03;
    const r = this.reverb, out = this.sfxBus;
    if (name === 'depart') {
      // arg : le navire qui appareille (sa famille, et sa hauteur à lui).
      const fam = arg ? hornFamily(arg.type) : 'cargo';
      const pitch = arg ? hornPitch(arg.type, arg.id) : 1;
      const len = this.playHorn(fam, pitch, t, arg ? HORN_SPECIAL[arg.type] : null);
      S.chain(c, out, t + len + 0.2, { gain: 0.12, dur: 0.7, pan: 0.3 });
    } else if (name === 'arrive') {
      S.gull(c, out, t, { calls: 3, pan: -0.3, distance: 0.25, gain: 0.2 });
      S.slap(c, out, t + 0.4, { gain: 0.2 });
    } else if (name === 'pause') {
      // Le temps s'arrête : trois coups de cloche.
      this.playSample('bell', { gain: 0.5, fadeOut: 0.2 });
    } else if (name === 'bell') {
      // Un seul coup de cloche : une nouvelle qui mérite l'attention, sans arrêter le temps.
      this.playSample('bell', { gain: 0.32, duration: 1.3, fadeOut: 0.4 });
    } else if (name === 'time') {
      // Le temps repart : un tic-tac, d'autant plus rapide que la vitesse est grande.
      const rate = [1, 1, 1.4, 1.9][arg] || 1;
      this.playSample('tick', { gain: 0.85, duration: 1.1, fadeOut: 0.25, rate });
    } else if (name === 'crates') {
      S.crate(c, out, t, { gain: 0.38, pan: -0.2, reverb: r });
      S.crate(c, out, t + 0.45, { gain: 0.32, pan: 0.15, size: 1.2, reverb: r });
      S.clank(c, out, t + 0.95, { gain: 0.14, pan: 0.3, reverb: r });
    } else if (name === 'sunk') {
      S.horn(c, out, t, { dur: 3.5, freq: 82, gain: 0.24, distance: 0.8, reverb: r });
    } else if (name === 'fuel') {
      if (!this.playSample('fuel', { gain: 0.75, duration: 2.3, fadeOut: 0.4 })) S.fuelPump(c, out, t, { dur: 1.5, gain: 0.32 });
    } else if (name === 'nofuel') {
      // Pas de quoi payer le plein : la tasse vide.
      this.playSample('nofuel', { gain: 0.85, fadeOut: 0.3 });
    } else if (name === 'cash' || name === 'pay') {
      if (!this.playSample('cash', { gain: 0.8 })) S.cashRegister(c, out, t, { gain: 0.42 });
    } else if (name === 'trustUp' || name === 'trustDown' || name === 'virtueUp' || name === 'virtueDown') {
      // Confiance et vertu : fichiers de SAMPLES (sons/confiance-plus.mp3…) ; synthèse si l'un manque.
      if (!this.playSample(name, { gain: name === 'trustUp' ? 0.6 : 0.5, fadeOut: 0.3 })) S.standingCue(c, out, t, { kind: name.startsWith('trust') ? 'trust' : 'virtue', up: name.endsWith('Up') });
    } else if (name === 'buy') {
      S.horn(c, out, t, { dur: 0.9, freq: 116, gain: 0.2, distance: 0.3, reverb: r });
    }
  }

  setAmbience(on) {
    this.settings.ambience = on;
    this.save();
    const scene = this.sceneName;
    this.sceneName = null;
    if (this.stopBed && this.ctx) { this.stopBed(this.ctx.currentTime); this.stopBed = null; }
    this.setScene(scene);
  }
  setSfx(on) { this.settings.sfx = on; this.save(); }
  setMusic(on) {
    this.settings.music = on;
    this.save();
    if (on) { this.musicScene = null; this.playMusic(this.sceneName); } else this.fadeOutMusic();
  }

  // ---------- Musique ----------
  // Morceau de la partie (0 à 9 : deux par standing de la compagnie).
  setMusicTier(tier) {
    if (this.musicTier === tier) return;
    this.musicTier = tier;
    if (this.sceneName === 'game' && this.musicScene) { this.musicScene = null; this.playMusic('game'); }
  }
  // Thème de situation (null : la musique du niveau).
  setMusicMood(mood) {
    if (this.musicMood === mood) return;
    this.musicMood = mood;
    if (this.sceneName === 'game' && this.musicScene) { this.musicScene = null; this.playMusic('game'); }
  }
  trackFor(scene) {
    const ok = (k) => TRACKS[k] && !this.missing?.has(TRACKS[k].src);
    if (scene === 'game' && this.musicMood && ok(this.musicMood)) return this.musicMood;
    if (scene === 'game' && MOOD_FALLBACK[this.musicMood] && ok(MOOD_FALLBACK[this.musicMood])) return MOOD_FALLBACK[this.musicMood]; // sans la seconde chanson, la première continue
    if (scene === 'game') {
      const step = this.musicTier ?? 0;
      if (step < 0) return ok('tier0') ? 'tier0' : ok('tier1') ? 'tier1' : ok('game') ? 'game' : null; // niveau 0 : les temps sont durs
      const k = `tier${Math.floor(step / 2) + 1}`;
      const kb = step % 2 ? `${k}b` : null;
      return kb && ok(kb) ? kb : ok(k) ? k : ok('game') ? 'game' : null;
    }
    return ok(scene) ? scene : null;
  }
  playMusic(scene) {
    if (!this.unlocked && !window.AndroidBridge) { this.musicScene = null; return; }
    const key = scene === 'game' ? `game:${this.musicTier ?? 0}:${this.musicMood || ''}` : scene;
    if (key === this.musicScene) return;
    this.musicScene = key;
    const name = this.trackFor(scene);
    const track = TRACKS[name];
    if (!track || !this.settings.music) { this.fadeOutMusic(); return; }
    if (this.music && this.musicSrc === track.src) return; // même morceau : il continue
    // Le morceau en cours ne s'efface que quand le suivant joue vraiment : si la seconde
    // chanson d'un niveau n'existe pas, la première continue sans reprendre au début.
    const prev = this.music, prevSrc = this.musicSrc, prevKind = this.musicKind;
    const el = new Audio(track.src);
    el.loop = track.loop;
    el.volume = 0;
    // Tous les morceaux lancés et pas encore éteints : deux demandes coup sur coup (entrée en
    // partie, puis niveau de la compagnie) ne doivent pas laisser l'ancien morceau tourner.
    (this.live ??= new Set()).add(el);
    el.addEventListener('error', () => {
      (this.missing ||= new Set()).add(track.src);
      this.live.delete(el);
      if (this.music !== el) return;
      if (prev && !prev.paused && prevKind === 'game' && scene === 'game') { this.music = prev; this.musicSrc = prevSrc; this.musicKind = prevKind; return; }
      this.stopOthers(null);
      this.music = null; this.musicSrc = null;
      // Fichier absent : on se rabat sur le morceau suivant (première chanson, puis jeu.mp3).
      if (scene === 'game' && name !== 'game') { this.musicScene = null; this.playMusic('game'); }
    });
    el.play().then(() => {
      if (this.music !== el) { el.pause(); this.live.delete(el); return; }
      this.stopOthers(el); // le nouveau morceau joue : tous les autres s'effacent
      this.fade(el, track.volume, 2500);
      // La musique couvre un peu l'ambiance.
      if (this.ambBus) this.ambBus.gain.setTargetAtTime(0.6, this.ctx.currentTime, 1);
    }).catch(() => {});
    this.music = el;
    this.musicSrc = track.src;
    this.musicKind = scene;
  }
  // Efface tous les morceaux en cours sauf `keep`.
  stopOthers(keep) {
    for (const o of [...(this.live || [])]) {
      if (o === keep) continue;
      this.live.delete(o);
      this.fade(o, 0, 1200, () => o.pause());
    }
  }
  fadeOutMusic() {
    this.music = null;
    this.musicSrc = null;
    if (this.ambBus) this.ambBus.gain.setTargetAtTime(1, this.ctx.currentTime, 1);
    this.stopOthers(null);
  }
  fade(el, to, ms, done) {
    const from = el.volume, start = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) requestAnimationFrame(step); else done?.();
    };
    requestAnimationFrame(step);
  }

  suspend() {
    this.paused = true;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    this.music?.pause();
  }
  resume() {
    this.paused = false;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (this.music && this.settings.music) this.music.play().catch(() => {});
  }
}
