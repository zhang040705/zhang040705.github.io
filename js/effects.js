// =========================================================================
// effects.js · 前景像素粒子流 + 测谎仪心电图 + 高拟物 3D 闪卡陀螺仪/鼠标倾角
// =========================================================================
window.Effects = (() => {
  // 1. Foreground Pixel Particle Engine (Attractor & Confetti Burst)
  const Particles = {
    canvas: null,
    ctx: null,
    list: [],
    init() {
      this.canvas = document.getElementById("fxOverlayCanvas");
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext("2d");
      const resize = () => {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
      };
      window.addEventListener("resize", resize);
      resize();
    },
    spawnAttractor(sourceEl, onComplete) {
      const rect = sourceEl.getBoundingClientRect();
      const tx = window.innerWidth * 0.5;
      const ty = window.innerHeight * 0.42;
      const colors = ["#4cc9f0", "#ffd166", "#06d6a0", "#ff4d6d", "#b583ff"];
      for (let i = 0; i < 68; i++) {
        this.list.push({
          mode: "attract",
          x: rect.left + Math.random() * rect.width,
          y: rect.top + Math.random() * rect.height,
          vx: (Math.random() - 0.5) * 12,
          vy: (Math.random() - 0.5) * 12,
          tx,
          ty,
          size: 5 + Math.floor(Math.random() * 6),
          color: colors[i % colors.length],
          age: 0,
          maxAge: 28 + Math.floor(Math.random() * 12)
        });
      }
      if (onComplete) setTimeout(onComplete, 600);
    },
    spawnBurst(cx, cy, accent = "#ffd166", count = 56) {
      const colors = [accent, "#ffd166", "#4cc9f0", "#ff4d6d", "#06d6a0"];
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2.5 + Math.random() * 12;
        this.list.push({
          mode: "burst",
          x: cx,
          y: cy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 3.2,
          size: 5 + Math.floor(Math.random() * 6),
          color: colors[i % colors.length],
          age: 0,
          maxAge: 34 + Math.floor(Math.random() * 22)
        });
      }
    },
    render() {
      if (!this.ctx || this.list.length === 0) return;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const alive = [];
      for (const p of this.list) {
        p.age++;
        if (p.mode === "attract") {
          const t = p.age / p.maxAge;
          p.x += p.vx * (1 - t) + (p.tx - p.x) * (0.14 + t * 0.25);
          p.y += p.vy * (1 - t) + (p.ty - p.y) * (0.14 + t * 0.25);
        } else {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.36;
          p.vx *= 0.96;
        }
        if (p.age < p.maxAge) {
          alive.push(p);
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
          ctx.strokeStyle = "#070914";
          ctx.lineWidth = 1;
          ctx.strokeRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
      }
      this.list = alive;
      if (this.list.length === 0) {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  };

  // 2. Step 3 Real-Time Pixel Polygraph ECG
  const Polygraph = {
    canvas: null,
    ctx: null,
    history: [],
    phase: 0,
    stress: 1,
    init() {
      this.canvas = document.getElementById("ecgCanvas");
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext("2d");
      this.history = new Array(115).fill(27);
    },
    setStress(level) {
      this.stress = level;
      const hdr = document.getElementById("polygraphHeader");
      const bpmEl = document.getElementById("ecgBpmText");
      if (!hdr || !bpmEl) return;
      if (level === 3) {
        hdr.classList.add("alert");
        bpmEl.textContent = "BPM: 148 · 🚨 检测到海王/白嫖心率飙升！";
        window.VoxelField.setTheme("#ff4d6d");
      } else if (level === 2) {
        hdr.classList.remove("alert");
        bpmEl.textContent = "BPM: 96 · 轻微波动";
        window.VoxelField.setTheme("#ffd166");
      } else {
        hdr.classList.remove("alert");
        bpmEl.textContent = "BPM: 74 · 波形平稳";
        window.VoxelField.setTheme("#06d6a0");
      }
    },
    render() {
      const step3 = document.getElementById("sceneStep3");
      if (!this.ctx || !step3 || !step3.classList.contains("active")) return;
      const ctx = this.ctx;
      const W = this.canvas.width;
      const H = this.canvas.height;
      const mid = H / 2;

      const speed = this.stress === 3 ? 0.36 : this.stress === 2 ? 0.24 : 0.17;
      this.phase += speed;
      const cycle = this.phase % (Math.PI * 2);
      const amp = this.stress === 3 ? 21 : this.stress === 2 ? 15 : 11;

      let offset = 0;
      if (cycle > 2.6 && cycle < 2.9) offset = -amp * 0.4;
      else if (cycle >= 2.9 && cycle < 3.15) offset = -amp;
      else if (cycle >= 3.15 && cycle < 3.4) offset = amp * 0.75;
      else offset = (Math.random() - 0.5) * (this.stress * 1.8);

      this.history.push(Math.max(4, Math.min(H - 4, Math.round(mid + offset))));
      if (this.history.length > 115) this.history.shift();

      ctx.fillStyle = "#070913";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "rgba(76, 201, 240, 0.08)";
      for (let x = 0; x < W; x += 16) ctx.fillRect(x, 0, 1, H);
      for (let y = 0; y < H; y += 16) ctx.fillRect(0, y, W, 1);

      const stepX = W / (this.history.length - 1);
      const color = this.stress === 3 ? "#ff4d6d" : this.stress === 2 ? "#ffd166" : "#06d6a0";
      ctx.fillStyle = color;
      for (let i = 0; i < this.history.length; i++) {
        const x = Math.round(i * stepX);
        const y = this.history[i];
        ctx.fillRect(x, y - 1, 4, 4);
        if (i > 0) {
          const prevY = this.history[i - 1];
          ctx.fillRect(x - 2, Math.min(y, prevY), 3, Math.max(3, Math.abs(y - prevY)));
        }
      }
    }
  };

  // 3. Physical 3D Trading Card Interactive Tilt & Specular Foil
  function initHoloCard3D() {
    const card = document.getElementById("holoCard3D");
    const foil = document.getElementById("holoFoilLayer");
    if (!card || !foil) return;

    const applyTilt = (nx, ny) => {
      const rotY = nx * 18;
      const rotX = -ny * 18;
      card.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
      const gx = Math.round((nx * 0.5 + 0.5) * 100);
      const gy = Math.round((ny * 0.5 + 0.5) * 100);
      const angle = Math.round(115 + nx * 38);
      foil.style.setProperty("--glare-x", `${gx}%`);
      foil.style.setProperty("--glare-y", `${gy}%`);
      foil.style.setProperty("--holo-x", `${gx}%`);
      foil.style.setProperty("--holo-y", `${gy}%`);
      foil.style.setProperty("--foil-angle", `${angle}deg`);
    };

    // 全屏任意位置移动鼠标都能平滑驱动 3D 实体闪卡与镭射角度变化
    window.addEventListener("pointermove", (e) => {
      const scene4 = document.getElementById("sceneStep4");
      if (!scene4 || !scene4.classList.contains("active")) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      applyTilt(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny)));
    });

    window.addEventListener("pointerleave", () => {
      card.style.transform = "rotateX(0deg) rotateY(0deg)";
    });

    window.addEventListener("deviceorientation", (e) => {
      const scene4 = document.getElementById("sceneStep4");
      if (!scene4 || !scene4.classList.contains("active")) return;
      if (e.gamma === null || e.beta === null) return;
      const nx = Math.max(-1, Math.min(1, e.gamma / 24));
      const ny = Math.max(-1, Math.min(1, (e.beta - 45) / 24));
      applyTilt(nx, ny);
    });
  }

  return {
    Particles,
    Polygraph,
    initHoloCard3D
  };
})();
