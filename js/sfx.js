// =========================================================================
// sfx.js · 纯代码 8-Bit 芯片音效合成器 (Web Audio API)
// =========================================================================
window.SFX = (() => {
  let ctx = null;
  let enabled = true;

  function init() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  function tone(freq, duration = 0.07, type = "square", vol = 0.045, delay = 0, slideTo = null) {
    if (!enabled) return;
    init();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  return {
    get enabled() { return enabled; },
    set enabled(val) { enabled = Boolean(val); },
    blip() {
      tone(587.33, 0.045, "square", 0.032);
    },
    cardHover() {
      tone(740, 0.04, "triangle", 0.035, 0, 980);
    },
    launch() {
      tone(330, 0.06, "square", 0.05, 0);
      tone(440, 0.06, "square", 0.05, 0.055);
      tone(659.25, 0.14, "square", 0.055, 0.11);
    },
    cartridgeInsert() {
      tone(220, 0.05, "square", 0.045, 0);
      tone(440, 0.06, "square", 0.045, 0.045);
      tone(880, 0.08, "triangle", 0.055, 0.095);
    },
    coinCopy() {
      tone(987.77, 0.07, "square", 0.048, 0);
      tone(1318.51, 0.18, "square", 0.052, 0.07);
    },
    laserScan() {
      tone(320, 0.22, "sawtooth", 0.042, 0, 1280);
      tone(660, 0.08, "square", 0.045, 0.23);
      tone(880, 0.12, "square", 0.045, 0.31);
    },
    alarm() {
      tone(620, 0.11, "sawtooth", 0.06, 0, 280);
      tone(620, 0.11, "sawtooth", 0.06, 0.14, 280);
    },
    stampSlam() {
      tone(140, 0.14, "triangle", 0.085, 0, 42);
      tone(95, 0.1, "sawtooth", 0.065, 0.02, 35);
    },
    fanfare(isRare = false) {
      const notes = isRare
        ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
        : [440, 554.37, 659.25, 880];
      notes.forEach((n, idx) => {
        tone(n, idx === notes.length - 1 ? 0.22 : 0.08, "square", 0.048, idx * 0.075);
      });
    }
  };
})();
