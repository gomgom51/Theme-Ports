// Gestion du son : ambiance du port (écran d'accueil), ambiance marine (en jeu) et
// bruitages liés aux actions. Le son démarre au premier toucher ou clic, comme
// l'exigent les navigateurs.
import * as S from './sounds.js';

const KEY = 'portdattache.audio';
// Musiques facultatives (à déposer dans web/musique/, voir docs/musique-suno.md).
const TRACKS = {
  title: { src: 'musique/accueil.mp3', volume: 0.45, loop: true },
  game: { src: 'musique/jeu.mp3', volume: 0.22, loop: true },
  end: { src: 'musique/victoire.mp3', volume: 0.5, loop: false },
};

// Sons enregistrés (prioritaires sur les versions synthétisées quand ils existent).
const SAMPLES = { fuel: 'sons/pompe.mp3', cash: 'sons/caisse.mp3' };

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
    const unlock = () => this.unlock();
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* stockage indisponible */ } }

  unlock() {
    if (!this.unlocked) {
      this.unlocked = true;
      const scene = this.musicScene ?? this.sceneName;
      this.musicScene = null;
      this.playMusic(scene);
    }
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
      return;
    }
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
    if (scene && this.settings.ambience) this.stopBed = S.seaBed(this.ctx, this.ambBus, this.ctx.currentTime + 0.05, { gain: scene.bed });
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
    this.buffers = {};
    for (const [name, src] of Object.entries(SAMPLES)) {
      try {
        const res = await fetch(src);
        if (!res.ok) continue;
        this.buffers[name] = await this.ctx.decodeAudioData(await res.arrayBuffer());
      } catch { /* on garde la version synthétisée */ }
    }
  }

  // Joue un son enregistré : extrait de `duration` secondes avec fondu de sortie.
  playSample(name, { gain = 0.8, duration = null, fadeOut = 0.3 } = {}) {
    const buf = this.buffers?.[name];
    if (!buf) return false;
    const c = this.ctx, t = c.currentTime + 0.02;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    const end = t + (duration ?? buf.duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.setValueAtTime(gain, Math.max(t, end - fadeOut));
    g.gain.linearRampToValueAtTime(0.0001, end);
    src.connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(end + 0.05);
    return true;
  }

  // Bruitages ponctuels.
  play(name) {
    const c = this.ctx;
    if (!c || !this.settings.sfx || c.state !== 'running') return;
    const t = c.currentTime + 0.03;
    const r = this.reverb, out = this.sfxBus;
    if (name === 'depart') {
      S.horn(c, out, t, { dur: 1.6, freq: 104, gain: 0.26, distance: 0.25, reverb: r });
      S.chain(c, out, t + 1.9, { gain: 0.12, dur: 0.7, pan: 0.3 });
    } else if (name === 'arrive') {
      S.gull(c, out, t, { calls: 3, pan: -0.3, distance: 0.25, gain: 0.2 });
      S.slap(c, out, t + 0.4, { gain: 0.2 });
    } else if (name === 'crates') {
      S.crate(c, out, t, { gain: 0.38, pan: -0.2, reverb: r });
      S.crate(c, out, t + 0.45, { gain: 0.32, pan: 0.15, size: 1.2, reverb: r });
      S.clank(c, out, t + 0.95, { gain: 0.14, pan: 0.3, reverb: r });
    } else if (name === 'sunk') {
      S.horn(c, out, t, { dur: 3.5, freq: 82, gain: 0.24, distance: 0.8, reverb: r });
    } else if (name === 'fuel') {
      if (!this.playSample('fuel', { gain: 0.75, duration: 2.3, fadeOut: 0.4 })) S.fuelPump(c, out, t, { dur: 1.5, gain: 0.32 });
    } else if (name === 'cash' || name === 'pay') {
      if (!this.playSample('cash', { gain: 0.8 })) S.cashRegister(c, out, t, { gain: 0.42 });
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
  playMusic(scene) {
    if (!this.unlocked && !window.AndroidBridge) { this.musicScene = null; return; }
    if (scene === this.musicScene) return;
    this.musicScene = scene;
    this.fadeOutMusic();
    const track = TRACKS[scene];
    if (!track || !this.settings.music || this.missing?.has(track.src)) return;
    const el = new Audio(track.src);
    el.loop = track.loop;
    el.volume = 0;
    el.addEventListener('error', () => { (this.missing ||= new Set()).add(track.src); });
    el.play().then(() => {
      this.fade(el, track.volume, 2500);
      // La musique couvre un peu l'ambiance.
      if (this.ambBus && this.music === el) this.ambBus.gain.setTargetAtTime(0.6, this.ctx.currentTime, 1);
    }).catch(() => {});
    this.music = el;
  }
  fadeOutMusic() {
    const el = this.music;
    this.music = null;
    if (this.ambBus) this.ambBus.gain.setTargetAtTime(1, this.ctx.currentTime, 1);
    if (el) this.fade(el, 0, 1200, () => el.pause());
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
