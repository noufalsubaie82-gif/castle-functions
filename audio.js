// مؤثرات صوتية مُولَّدة بالكامل في المتصفح (Web Audio) — لا ملفات خارجية
(function () {
  let ctx = null, master = null, muted = false, amb = null;
  try { muted = localStorage.getItem('castle_mute') === '1'; } catch (e) { }
  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ctx = new C(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, when, slideTo) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, filterFreq, when, type) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + (when || 0);
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = c.createGain(); g.gain.value = vol || 0.4;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  const S = {
    click() { tone(900, .05, 'square', .08); },
    tick() { tone(1400, .03, 'square', .06); },
    roll() { tone(500 + Math.random() * 200, .04, 'triangle', .12); noise(.04, .1, 3000); },
    good() { [523, 659, 784].forEach((f, i) => tone(f, .25, 'triangle', .22, i * .08)); },
    bad() { tone(180, .35, 'sawtooth', .18, 0, 90); tone(140, .35, 'square', .08, .02, 70); },
    unlock() { noise(.08, .5, 4000, 0, 'highpass'); tone(300, .1, 'square', .15, .05); noise(.12, .4, 2500, .18, 'bandpass'); tone(1200, .2, 'triangle', .15, .25); },
    door() { noise(1.4, .35, 400); tone(70, 1.2, 'sawtooth', .12, 0, 45); tone(110, .9, 'triangle', .08, .3, 60); },
    key() { [1318, 1568, 2093, 2637].forEach((f, i) => tone(f, .35, 'sine', .18, i * .09)); noise(.3, .08, 6000, .1, 'highpass'); },
    gem() { [1760, 2349, 2794].forEach((f, i) => tone(f, .4, 'sine', .14, i * .06)); },
    place() { tone(660, .12, 'sine', .18, 0, 990); },
    zap() { noise(.25, .45, 5000, 0, 'highpass'); tone(2000, .2, 'sawtooth', .1, 0, 200); },
    beep() { tone(2200, .07, 'square', .07); },
    boom() { noise(2.2, 1, 300); tone(60, 1.5, 'sine', .6, 0, 25); noise(.6, .5, 2000, .05); },
    magic() { for (let i = 0; i < 8; i++) tone(800 + i * 180, .25, 'sine', .08, i * .05); },
    fanfare() {
      const n = [[523, 0], [523, .15], [523, .3], [659, .45], [784, .75], [659, 1.0], [784, 1.15], [1047, 1.45]];
      n.forEach(([f, w]) => { tone(f, .35, 'triangle', .25, w); tone(f / 2, .35, 'sine', .12, w); });
    },
    ambient(on) {
      const c = ac(); if (!c) return;
      if (on && !amb) {
        const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), f = c.createBiquadFilter();
        o1.type = 'sawtooth'; o1.frequency.value = 55; o2.type = 'sawtooth'; o2.frequency.value = 55.6;
        f.type = 'lowpass'; f.frequency.value = 260; g.gain.value = 0.035; lfo.frequency.value = .08; lg.gain.value = 120;
        lfo.connect(lg); lg.connect(f.frequency); o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
        o1.start(); o2.start(); lfo.start(); amb = { o1, o2, lfo, g };
      } else if (!on && amb) { try { amb.o1.stop(); amb.o2.stop(); amb.lfo.stop(); } catch (e) { } amb = null; }
    },
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('castle_mute', muted ? '1' : '0'); } catch (e) { } ac(); if (master) master.gain.value = muted ? 0 : 0.6; return muted; },
    unlockAudio() { ac(); }
  };
  window.SFX = S;
})();
