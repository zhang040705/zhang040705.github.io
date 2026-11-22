// =========================================================================
// poster.js · 9:16 高清离屏 Canvas 海报渲染器（兼容本地 file:// 与手机长按保存）
// =========================================================================
window.PosterRenderer = (() => {
  function drawFallbackPixelPet(ctx, cx, cy, scale, accentColor, mood) {
    const grid = [
      "......2222......",
      ".......22.......",
      "...1111111111...",
      "..133333333331..",
      "..131111111131..",
      "..131441144131..",
      "..131441144131..",
      "..131111111131..",
      "..131155551131..",
      "..133333333331..",
      "...1111111111...",
      "....11....11....",
      "...111....111..."
    ];
    const palette = {
      "1": "#090a14",
      "2": "#ffd166",
      "3": accentColor,
      "4": mood === "angry" || mood === "alert" ? "#ff4d6d" : "#4cc9f0",
      "5": mood === "happy" || mood === "heart" || mood === "crown" ? "#06d6a0" : "#ffd166"
    };
    const w = grid[0].length * scale;
    const h = grid.length * scale;
    const sx = Math.round(cx - w / 2);
    const sy = Math.round(cy - h / 2);
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const ch = grid[r][c];
        if (ch !== "." && palette[ch]) {
          ctx.fillStyle = palette[ch];
          ctx.fillRect(sx + c * scale, sy + r * scale, scale, scale);
        }
      }
    }
  }

  function drawRadar(ctx, cx, cy, radius, dims8, accentColor) {
    const { DIM_LABELS } = window.AppData;
    const n = 8;
    for (let lv = 1; lv <= 3; lv++) {
      const r = (radius * lv) / 3;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = lv === 3 ? "#4b548f" : "#2b3057";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.font = "bold 18px monospace";
    ctx.fillStyle = "#cbd3f8";
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = "#2b3057";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const lx = cx + (radius + 36) * Math.cos(angle);
      const ly = cy + (radius + 24) * Math.sin(angle);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${DIM_LABELS[i]}(${dims8[i]})`, lx, ly);
    }

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const r = (radius * dims8[i]) / 3;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = accentColor + "44";
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const r = (radius * dims8[i]) / 3;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }
  }

  function wrapChineseText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    let line = "";
    let lines = [];
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line.length > 0) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…";
    }
    lines.forEach((l, idx) => ctx.fillText(l, x, y + idx * lineHeight));
    return lines.length;
  }

  async function render(result, opts = {}) {
    const canvas = document.getElementById("posterCanvas");
    const ctx = canvas.getContext("2d");
    const W = 720, H = 1280;
    const p = result.persona;
    const dims = opts.dims;
    const roast = opts.roast;
    const aiName = opts.aiName;
    const isPreview = Boolean(opts.isPreview);

    const artImg = await window.AppData.loadPersonaImage(p.img);

    // Background
    ctx.fillStyle = "#101223";
    ctx.fillRect(0, 0, W, H);

    // Subtle pixel grid
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let gx = 0; gx < W; gx += 24) ctx.fillRect(gx, 0, 1, H);
    for (let gy = 0; gy < H; gy += 24) ctx.fillRect(0, gy, W, 1);

    // Outer arcade frame
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, W - 40, H - 40);
    ctx.strokeStyle = "#3a4170";
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 32, W - 64, H - 64);

    // Top header bar
    ctx.fillStyle = "#1b1e38";
    ctx.fillRect(44, 42, W - 88, 56);
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(isPreview ? "硅基风评鉴定局 · 20型图鉴预览" : "硅基风评鉴定局 · AI 审讯回执", 62, 70);

    ctx.font = "bold 19px monospace";
    ctx.fillStyle = "#4cc9f0";
    ctx.textAlign = "right";
    ctx.fillText(isPreview ? `编号: #${String(p.indexNo || 1).padStart(2, "0")}/20` : `审讯官: ${aiName}`, W - 62, 70);

    // Corner stamp
    ctx.save();
    ctx.translate(W - 122, 168);
    ctx.rotate(0.16);
    ctx.strokeStyle = "#ff4d6d";
    ctx.lineWidth = 5;
    ctx.fillStyle = "rgba(255, 77, 109, 0.16)";
    ctx.fillRect(-76, -26, 152, 52);
    ctx.strokeRect(-76, -26, 152, 52);
    ctx.fillStyle = "#ff4d6d";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(result.stamp, 0, 2);
    ctx.restore();

    // Rarity + Code + Name
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = result.isHidden ? "#ff4d6d" : "#06d6a0";
    ctx.font = "bold 20px monospace";
    ctx.fillText(
      isPreview ? `[ ${p.rarity} · 标准原型档案 ]` : `[ ${p.rarity} · 匹配度 ${result.similarity}% ]`,
      56, 126
    );

    const codeFontSize = p.code.length >= 8 ? 50 : 62;
    ctx.fillStyle = p.color;
    ctx.font = `bold ${codeFontSize}px monospace`;
    ctx.fillText(p.code, 56, 178);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px monospace";
    ctx.fillText(p.name, 56, 224);

    // HERO 1:1 Illustration Card Frame
    const frameSize = 382;
    const frameX = Math.round((W - frameSize) / 2);
    const frameY = 250;

    ctx.fillStyle = "#151830";
    ctx.fillRect(52, frameY + 14, W - 104, frameSize - 28);
    ctx.strokeStyle = "#2b315a";
    ctx.lineWidth = 2;
    ctx.strokeRect(52, frameY + 14, W - 104, frameSize - 28);

    ctx.save();
    ctx.fillStyle = "#5c669e";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(106, frameY + frameSize / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("16-BIT PIXEL ARCHIVE", 0, 0);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "#5c669e";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(W - 106, frameY + frameSize / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(result.isHidden ? "RARE HIDDEN EDITION" : "CLIENT PROFILE CARD", 0, 0);
    ctx.restore();

    ctx.fillStyle = "#090a14";
    ctx.fillRect(frameX - 4, frameY - 4, frameSize + 14, frameSize + 14);
    ctx.fillStyle = "#0b0d19";
    ctx.fillRect(frameX, frameY, frameSize, frameSize);

    if (artImg) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(artImg, frameX + 6, frameY + 6, frameSize - 12, frameSize - 12);
      ctx.restore();
    } else {
      drawFallbackPixelPet(ctx, W / 2, frameY + frameSize / 2, 12, p.color, p.petMood);
    }

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 6;
    ctx.strokeRect(frameX, frameY, frameSize, frameSize);

    const rivets = [
      [frameX + 8, frameY + 8],
      [frameX + frameSize - 16, frameY + 8],
      [frameX + 8, frameY + frameSize - 16],
      [frameX + frameSize - 16, frameY + frameSize - 16]
    ];
    ctx.fillStyle = "#ffd166";
    rivets.forEach(([rx, ry]) => ctx.fillRect(rx, ry, 8, 8));

    // RPG Dialogue Box: AI's custom ROAST
    const roastY = 650;
    const roastH = 132;
    ctx.fillStyle = "#0b0d19";
    ctx.fillRect(52, roastY, W - 104, roastH);
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 4;
    ctx.strokeRect(52, roastY, W - 104, roastH);

    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      isPreview ? `💬 典型 AI 毒舌证词（示例）：` : `💬 你的 ${aiName} 亲笔毒舌证词：`,
      72, roastY + 16
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px monospace";
    wrapChineseText(ctx, `“${roast}”`, 72, roastY + 52, W - 144, 34, 2);

    // 8-Dim Radar
    drawRadar(ctx, W / 2, 938, 98, dims, p.color);

    // Official Verdict Box
    const descY = 1094;
    const descH = 108;
    ctx.fillStyle = "#1b1e38";
    ctx.fillRect(52, descY, W - 104, descH);
    ctx.strokeStyle = "#3a4170";
    ctx.lineWidth = 3;
    ctx.strokeRect(52, descY, W - 104, descH);

    ctx.fillStyle = "#cbd3f8";
    ctx.font = "20px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    wrapChineseText(ctx, `📌 档案判词：${p.desc}`, 70, descY + 16, W - 140, 28, 3);

    // Bottom Watermark
    ctx.fillStyle = "#7e88b8";
    ctx.font = "bold 17px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("研究生像素闯关 IP · 硅基风评鉴定局 · 纯本地解析", W / 2, 1236);

    // Update 3D Card Parallax Floating Illustration & Theme Accent
    const holoCard = document.getElementById("holoCard3D");
    const parallaxFloat = document.getElementById("cardParallaxHero");
    const resultControls = document.getElementById("resultControlsZone");
    if (holoCard) {
      holoCard.style.setProperty("--result-accent", p.color);
      holoCard.style.setProperty("--result-glow", p.color + "66");
    }
    if (resultControls) {
      resultControls.style.setProperty("--result-accent", p.color);
    }
    if (parallaxFloat) {
      parallaxFloat.src = window.AppData.getPersonaImageUrl(p.img);
    }

    // Physical stamp impact animation
    const stampBadge = document.getElementById("stampImpactBadge");
    if (stampBadge) {
      stampBadge.textContent = result.stamp;
      stampBadge.classList.remove("stamped");
      void stampBadge.offsetWidth;
      stampBadge.classList.add("stamped");
      setTimeout(() => window.SFX.stampSlam(), 140);
    }

    const posterImg = document.getElementById("posterImg");
    const saveHint = document.getElementById("saveHint");

    try {
      const dataUrl = canvas.toDataURL("image/png");
      posterImg.src = dataUrl;
      posterImg.classList.remove("hidden");
      canvas.classList.add("hidden");
      canvas.classList.remove("poster-live");
      saveHint.textContent = "✨ 移动鼠标或倾斜手机检视 3D 实体闪卡 · 手机直接长按海报保存";
      return dataUrl;
    } catch {
      posterImg.classList.add("hidden");
      canvas.classList.remove("hidden");
      canvas.classList.add("poster-live");
      saveHint.textContent = "👀 本地 file:// 预览模式（3D 实体闪卡已就绪，开启本地 HTTP 服务可一键下载 PNG）";
      return null;
    }
  }

  return { render };
})();
