// =========================================================================
// app.js · 场景调度、四周散落闪卡布置、测试流程控制与事件绑定
// =========================================================================
(() => {
  const {
    AI_PLATFORMS,
    STANDARD_PROMPT,
    RESCUE_PROMPT,
    DIM_LABELS,
    MANUAL_QUESTIONS,
    ALL_PERSONAS,
    getPersonaImageUrl,
    parseAIReply,
    classifyClient,
    getStamp
  } = window.AppData;

  const SFX = window.SFX;
  const VoxelField = window.VoxelField;
  const IpMascot = window.IpMascot;
  const { Particles, Polygraph, initHoloCard3D } = window.Effects;
  const PosterRenderer = window.PosterRenderer;

  const state = {
    selectedAI: AI_PLATFORMS[0],
    dims: null,
    mem: "Y",
    roast: "",
    h1: null,
    h2: null,
    manualIdx: 0,
    manualAnswers: [],
    currentScene: "sceneIpHome",
    lastSceneBeforeGallery: "sceneHero",
    isPreviewMode: false,
    previewIndex: 0,
    currentPosterCode: "",
    posterDataUrl: null,
    pendingResult: null,
    isWaveTransitioning: false
  };

  // ---------- 工具函数 ----------
  function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2400);
  }

  function triggerScreenShake() {
    document.body.classList.remove("screen-shake");
    void document.body.offsetWidth;
    document.body.classList.add("screen-shake");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    }
  }

  // ---------- 平滑运镜场景切换 ----------
  function switchScene(targetId, stepNum = 0) {
    const scenes = [
      "sceneIpHome",
      "sceneHero",
      "sceneStep1",
      "sceneStep2",
      "sceneManual",
      "sceneStep3",
      "sceneStep4",
      "sceneGallery"
    ];

    scenes.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === state.currentScene && id !== targetId) {
        el.classList.add("exit-zoom");
        el.classList.remove("active");
        setTimeout(() => el.classList.remove("exit-zoom"), 560);
      } else if (id !== targetId) {
        el.classList.remove("active", "exit-zoom");
      }
    });

    const nextEl = document.getElementById(targetId);
    if (nextEl) {
      window.scrollTo({ top: 0, behavior: "instant" });
      requestAnimationFrame(() => {
        nextEl.classList.add("active");
      });
    }

    if (targetId !== "sceneGallery" && !(targetId === "sceneStep4" && state.isPreviewMode)) {
      state.lastSceneBeforeGallery = targetId;
    }
    state.currentScene = targetId;

    // 同步顶栏品牌文本与返回主页按钮
    const isIpHome = targetId === "sceneIpHome";
    const brandText = document.getElementById("hudBrandText");
    const backBtn = document.getElementById("btnBackToIpHome");
    if (brandText) {
      brandText.textContent = isIpHome ? "MILES' WORLD" : "16-BIT 硅基风评鉴定局";
    }
    if (backBtn) {
      backBtn.classList.toggle("hidden", isIpHome);
    }

    // 同步所有开放场景顶部的步骤节点
    if (stepNum > 0) {
      document.querySelectorAll(".step-track").forEach(track => {
        const nodes = track.querySelectorAll(".step-node");
        nodes.forEach((node, idx) => {
          const n = idx + 1;
          node.classList.remove("active", "done");
          if (n < stepNum) node.classList.add("done");
          if (n === stepNum) node.classList.add("active");
        });
      });
    }
  }

  // ---------- 个人 IP 主页 <-> 人格测试子页：边缘 3D 波浪起伏变色过渡 ----------
  function navigateWithVoxelWave(targetMode, targetSceneId) {
    if (state.isWaveTransitioning) return;
    state.isWaveTransitioning = true;

    SFX.launch();

    // 1. 先平滑隐藏当前页 UI，把完整舞台让给 3D 像素方块波浪翻涌
    const curEl = document.getElementById(state.currentScene);
    if (curEl) {
      curEl.classList.add("exit-zoom");
      curEl.classList.remove("active");
      setTimeout(() => curEl.classList.remove("exit-zoom"), 560);
    }

    if (targetMode === "dark") {
      VoxelField.setTheme("#4cc9f0");
    }

    // 2. 启动从边缘扫过全屏的 3D 方块波浪起伏与变色，浪潮扫过主体后再浮现目标页 UI
    VoxelField.transitionMode(targetMode, () => {
      document.body.classList.toggle("theme-light", targetMode === "light");
      if (targetMode === "light" && IpMascot) {
        IpMascot.resetToHome();
      }
      switchScene(targetSceneId);
      setTimeout(() => {
        state.isWaveTransitioning = false;
      }, 360);
    });
  }

  // ---------- 首页右侧 3D 堆叠闪卡卡堆 ----------
  function buildHeroDeckStack() {
    const stack = document.getElementById("heroDeckStack");
    if (!stack) return;
    stack.innerHTML = "";

    // 精选 5 张标志性闪卡叠成一摞，最顶层为 GOD!，下层依次微微露边
    const deckCodes = ["DDL", "PUA!", "PROMPT", "CHEATER", "GOD!"];
    const deckCards = deckCodes
      .map(code => ALL_PERSONAS.find(p => p.code === code))
      .filter(Boolean);

    const offsets = [
      { dx: "-22px", dy: "16px",  dz: "-44px", rot: "-9deg",  hdx: "-48px", hdy: "22px",  hdz: "-32px", hrot: "-18deg" },
      { dx: "-14px", dy: "10px",  dz: "-32px", rot: "-5deg",  hdx: "-26px", hdy: "12px",  hdz: "-22px", hrot: "-10deg" },
      { dx: "12px",  dy: "8px",   dz: "-20px", rot: "6deg",   hdx: "38px",  hdy: "16px",  hdz: "-14px", hrot: "14deg"  },
      { dx: "6px",   dy: "3px",   dz: "-10px", rot: "3deg",   hdx: "18px",  hdy: "5px",   hdz: "-6px",  hrot: "7deg"   },
      { dx: "0px",   dy: "0px",   dz: "0px",   rot: "-1.5deg",hdx: "0px",   hdy: "-6px",  hdz: "18px",  hrot: "0deg"   }
    ];

    deckCards.forEach((p, idx) => {
      const cfg = offsets[idx] || offsets[offsets.length - 1];
      const isTop = idx === deckCards.length - 1;
      const card = document.createElement("div");
      card.className = "deck-card" + (isTop ? " is-top" : "");
      card.style.setProperty("--dx", cfg.dx);
      card.style.setProperty("--dy", cfg.dy);
      card.style.setProperty("--dz", cfg.dz);
      card.style.setProperty("--rot", cfg.rot);
      card.style.setProperty("--hdx", cfg.hdx);
      card.style.setProperty("--hdy", cfg.hdy);
      card.style.setProperty("--hdz", cfg.hdz);
      card.style.setProperty("--hrot", cfg.hrot);
      card.style.setProperty("--card-accent", p.color);
      card.style.zIndex = String(10 + idx);

      card.innerHTML = `
        <div class="deck-card-body">
          <span class="deck-card-tag">${p.isHidden ? "HIDDEN" : "RARE"}</span>
          <div class="deck-card-art-wrap">
            <img class="deck-card-art" src="${getPersonaImageUrl(p.img)}" alt="${p.code}" />
          </div>
          <div class="deck-card-meta">
            <div class="deck-card-code">${p.code}</div>
            <div class="deck-card-name">${p.name}</div>
          </div>
          <div class="deck-card-foil"></div>
        </div>
      `;
      stack.appendChild(card);
    });

    stack.addEventListener("pointerenter", () => {
      SFX.cardHover();
      VoxelField.setTheme("#ffd166");
    });
  }

  // ---------- 卡堆 -> 图鉴 平滑 FLIP 展开动画 ----------
  function openGalleryFromDeck() {
    const deckEl = document.getElementById("heroDeckStack");
    const deckRect = deckEl ? deckEl.getBoundingClientRect() : null;
    const hasDeckOrigin = state.currentScene === "sceneHero" && deckRect && deckRect.width > 0;

    SFX.launch();
    switchScene("sceneGallery");

    if (!hasDeckOrigin) return;

    const deckCx = deckRect.left + deckRect.width / 2;
    const deckCy = deckRect.top + deckRect.height / 2;
    const cards = Array.from(document.querySelectorAll("#galleryGrid .gallery-item"));

    // First: 将所有图鉴卡片瞬间定位于右侧卡堆中心，随后平滑飞散铺开到网格位
    cards.forEach((card, idx) => {
      const r = card.getBoundingClientRect();
      const dx = deckCx - (r.left + r.width / 2);
      const dy = deckCy - (r.top + r.height / 2);
      const rot = ((idx % 5) - 2) * 5;
      card.style.transition = "none";
      card.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.72) rotate(${rot}deg)`;
      card.style.opacity = idx < 8 ? "0.95" : "0.2";
    });

    // 强制重排后播放错峰展开动画
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        cards.forEach((card, idx) => {
          const delay = Math.min(idx * 18, 220);
          card.style.transition = `transform 0.58s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, opacity 0.42s ease ${delay}ms`;
          card.style.transform = "translate3d(0, 0, 0) scale(1) rotate(0deg)";
          card.style.opacity = "1";
        });
        setTimeout(() => {
          cards.forEach(card => {
            card.style.transition = "";
            card.style.transform = "";
            card.style.opacity = "";
          });
        }, 850);
      });
    });
  }

  // ---------- 图鉴 -> 首页 平滑 FLIP 收拢回卡堆动画 ----------
  function closeGalleryToOrigin() {
    const targetScene = state.lastSceneBeforeGallery || "sceneHero";
    SFX.blip();

    if (targetScene !== "sceneHero") {
      switchScene(targetScene);
      return;
    }

    const deckEl = document.getElementById("heroDeckStack");
    const deckRect = deckEl ? deckEl.getBoundingClientRect() : null;
    const deckCx = deckRect && deckRect.width > 0 ? deckRect.left + deckRect.width / 2 : window.innerWidth * 0.72;
    const deckCy = deckRect && deckRect.height > 0 ? deckRect.top + deckRect.height / 2 : window.innerHeight * 0.5;
    const cards = Array.from(document.querySelectorAll("#galleryGrid .gallery-item"));

    cards.forEach((card, idx) => {
      const r = card.getBoundingClientRect();
      const dx = deckCx - (r.left + r.width / 2);
      const dy = deckCy - (r.top + r.height / 2);
      const rot = ((idx % 5) - 2) * 6;
      const delay = Math.min(idx * 10, 120);
      card.style.transition = `transform 0.42s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, opacity 0.34s ease ${delay}ms`;
      card.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.66) rotate(${rot}deg)`;
      card.style.opacity = idx < 5 ? "0.85" : "0";
    });

    setTimeout(() => {
      switchScene("sceneHero");
      VoxelField.setTheme("#4cc9f0");
      setTimeout(() => {
        cards.forEach(card => {
          card.style.transition = "";
          card.style.transform = "";
          card.style.opacity = "";
        });
      }, 280);
    }, 340);
  }

  // ---------- Step 1：各平台专属像素风 SVG Logo ----------
  function makeAIPixelLogoSvg(aiId, colorHex) {
    const map = {
      // 豆包：圆润像素耳机/萌豆轮廓
      "豆包": `
        <rect x="4" y="2" width="8" height="2" fill="${colorHex}"/>
        <rect x="2" y="4" width="12" height="8" fill="${colorHex}"/>
        <rect x="4" y="12" width="8" height="2" fill="${colorHex}"/>
        <rect x="4" y="5" width="8" height="6" fill="#090a14"/>
        <rect x="5" y="7" width="2" height="2" fill="#ffffff"/>
        <rect x="9" y="7" width="2" height="2" fill="#ffffff"/>
        <rect x="1" y="6" width="1" height="4" fill="#ffd166"/>
        <rect x="14" y="6" width="1" height="4" fill="#ffd166"/>`,
      // ChatGPT：像素六角花环结
      "ChatGPT": `
        <rect x="6" y="1" width="4" height="2" fill="${colorHex}"/>
        <rect x="3" y="3" width="3" height="3" fill="${colorHex}"/>
        <rect x="10" y="3" width="3" height="3" fill="${colorHex}"/>
        <rect x="1" y="6" width="3" height="4" fill="${colorHex}"/>
        <rect x="12" y="6" width="3" height="4" fill="${colorHex}"/>
        <rect x="3" y="10" width="3" height="3" fill="${colorHex}"/>
        <rect x="10" y="10" width="3" height="3" fill="${colorHex}"/>
        <rect x="6" y="13" width="4" height="2" fill="${colorHex}"/>
        <rect x="6" y="6" width="4" height="4" fill="#ffffff"/>
        <rect x="7" y="7" width="2" height="2" fill="#090a14"/>`,
      // Claude：像素星芒放射太阳
      "Claude": `
        <rect x="7" y="1" width="2" height="14" fill="${colorHex}"/>
        <rect x="1" y="7" width="14" height="2" fill="${colorHex}"/>
        <rect x="3" y="3" width="2" height="2" fill="${colorHex}"/>
        <rect x="11" y="3" width="2" height="2" fill="${colorHex}"/>
        <rect x="3" y="11" width="2" height="2" fill="${colorHex}"/>
        <rect x="11" y="11" width="2" height="2" fill="${colorHex}"/>
        <rect x="5" y="5" width="6" height="6" fill="#ffd166"/>
        <rect x="7" y="7" width="2" height="2" fill="#ffffff"/>`,
      // Gemini：像素四角菱形星辰
      "Gemini": `
        <rect x="7" y="1" width="2" height="3" fill="${colorHex}"/>
        <rect x="7" y="12" width="2" height="3" fill="${colorHex}"/>
        <rect x="1" y="7" width="3" height="2" fill="${colorHex}"/>
        <rect x="12" y="7" width="3" height="2" fill="${colorHex}"/>
        <rect x="6" y="4" width="4" height="8" fill="${colorHex}"/>
        <rect x="4" y="6" width="8" height="4" fill="${colorHex}"/>
        <rect x="6" y="6" width="4" height="4" fill="#ffffff"/>
        <rect x="12" y="2" width="2" height="2" fill="#ffd166"/>`,
      // Kimi：像素 K 字闪电徽章
      "Kimi": `
        <rect x="3" y="2" width="3" height="12" fill="${colorHex}"/>
        <rect x="6" y="7" width="2" height="2" fill="#ffffff"/>
        <rect x="8" y="5" width="2" height="2" fill="${colorHex}"/>
        <rect x="10" y="3" width="3" height="2" fill="${colorHex}"/>
        <rect x="8" y="9" width="2" height="2" fill="${colorHex}"/>
        <rect x="10" y="11" width="3" height="3" fill="${colorHex}"/>
        <rect x="12" y="2" width="2" height="2" fill="#4cc9f0"/>`,
      // 通义千问：像素菱形星环 Q
      "通义千问": `
        <rect x="5" y="2" width="6" height="2" fill="${colorHex}"/>
        <rect x="3" y="4" width="2" height="6" fill="${colorHex}"/>
        <rect x="11" y="4" width="2" height="6" fill="${colorHex}"/>
        <rect x="5" y="10" width="6" height="2" fill="${colorHex}"/>
        <rect x="6" y="5" width="4" height="4" fill="#ffffff"/>
        <rect x="9" y="11" width="3" height="2" fill="#4cc9f0"/>
        <rect x="11" y="12" width="3" height="2" fill="#4cc9f0"/>`,
      // DeepSeek：像素蓝鲸跃水剪影
      "DeepSeek": `
        <rect x="4" y="4" width="7" height="2" fill="${colorHex}"/>
        <rect x="2" y="6" width="10" height="4" fill="${colorHex}"/>
        <rect x="3" y="10" width="8" height="2" fill="#4cc9f0"/>
        <rect x="12" y="5" width="2" height="3" fill="${colorHex}"/>
        <rect x="13" y="3" width="2" height="2" fill="#4cc9f0"/>
        <rect x="5" y="7" width="2" height="2" fill="#ffffff"/>
        <rect x="6" y="2" width="1" height="2" fill="#72efdd"/>
        <rect x="8" y="1" width="1" height="3" fill="#72efdd"/>`,
      // 其他 AI：像素魔法芯片
      "其他 AI": `
        <rect x="4" y="4" width="8" height="8" fill="${colorHex}"/>
        <rect x="6" y="6" width="4" height="4" fill="#090a14"/>
        <rect x="7" y="7" width="2" height="2" fill="#ffd166"/>
        <rect x="6" y="1" width="1" height="3" fill="#cbd5ff"/>
        <rect x="9" y="1" width="1" height="3" fill="#cbd5ff"/>
        <rect x="6" y="12" width="1" height="3" fill="#cbd5ff"/>
        <rect x="9" y="12" width="1" height="3" fill="#cbd5ff"/>
        <rect x="1" y="6" width="3" height="1" fill="#cbd5ff"/>
        <rect x="1" y="9" width="3" height="1" fill="#cbd5ff"/>
        <rect x="12" y="6" width="3" height="1" fill="#cbd5ff"/>
        <rect x="12" y="9" width="3" height="1" fill="#cbd5ff"/>`
    };
    const body = map[aiId] || map["其他 AI"];
    return `<svg class="ai-mini-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${body}</svg>`;
  }

  function initAIGrid() {
    const grid = document.getElementById("aiGrid");
    grid.innerHTML = "";
    AI_PLATFORMS.forEach((ai, idx) => {
      const btn = document.createElement("button");
      btn.className = "ai-tile" + (idx === 0 ? " selected" : "");
      btn.style.setProperty("--tile-color", ai.color);
      btn.innerHTML = `
        ${makeAIPixelLogoSvg(ai.id, ai.color)}
        <span class="ai-tile-name">${ai.label}</span>
      `;
      btn.onclick = () => {
        document.querySelectorAll(".ai-tile").forEach(el => el.classList.remove("selected"));
        btn.classList.add("selected");
        state.selectedAI = ai;
        SFX.cartridgeInsert();
        VoxelField.setTheme(ai.color);
        updateAITip();
      };
      grid.appendChild(btn);
    });
    updateAITip();
    document.getElementById("promptPreview").textContent = STANDARD_PROMPT;
  }

  function updateAITip() {
    const link = document.getElementById("btnOpenAI");
    if (state.selectedAI.url) {
      link.href = state.selectedAI.url;
      link.classList.remove("hidden");
    } else {
      link.classList.add("hidden");
    }
  }

  // ---------- Step 2：激光解析与粒子吸积 ----------
  function handleParsedData(parsed) {
    state.dims = parsed.dims;
    state.mem = parsed.mem;
    state.roast = parsed.roast;

    const status = document.getElementById("parseStatus");
    status.className = "status-banner status-ok";
    status.textContent = `✅ 激光锁定暗号：${parsed.dims.join("-")} ｜ 记忆状态：${parsed.mem} ｜ 正在推入测谎仪坦白局…`;
    status.classList.remove("hidden");
    document.getElementById("rescueBox").classList.add("hidden");

    const wrap = document.getElementById("scannerStage");
    wrap.classList.remove("scanning");
    void wrap.offsetWidth;
    wrap.classList.add("scanning");
    SFX.laserScan();
    VoxelField.setTheme("#06d6a0");

    Particles.spawnAttractor(wrap, () => {
      document.getElementById("confessQ1").classList.remove("hidden");
      document.getElementById("confessQ2").classList.add("hidden");
      Polygraph.setStress(1);
      switchScene("sceneStep3", 3);
    });
  }

  function tryParseInput(showError = true) {
    const raw = document.getElementById("aiReplyInput").value;
    const parsed = parseAIReply(raw);
    const status = document.getElementById("parseStatus");
    if (parsed) {
      handleParsedData(parsed);
      return true;
    }
    if (showError && raw.trim().length > 0) {
      SFX.alarm();
      triggerScreenShake();
      status.className = "status-banner status-err";
      status.textContent = "⚠️ 没在文本里找到 [CODE: 1-2-3-...] 暗号！别慌，点下方红色按钮一键复制催交卷话术发给 AI 即可。";
      status.classList.remove("hidden");
      document.getElementById("rescueBox").classList.remove("hidden");
    }
    return false;
  }

  // ---------- Step 3 -> 4：拟真镭射塑封卡包沿虚线撕开演出 ----------
  let packTearDone = false;

  function resetFoilPackVisuals(res) {
    packTearDone = false;
    const wrapper = document.getElementById("foilPackWrapper");
    const caption = document.getElementById("packCaption");
    const emblem = document.getElementById("packEmblem");
    const meta = document.getElementById("packMeta");
    const topLabel = document.getElementById("packTopLabel");
    const handle = document.getElementById("tearHandle");
    const progress = document.getElementById("tearProgress");
    const packTop = document.getElementById("foilPackTop");
    const innerArt = document.getElementById("packInnerArt");
    const innerCode = document.getElementById("packInnerCode");
    const innerName = document.getElementById("packInnerName");

    wrapper.classList.remove("torn", "card-emerge", "rare-alert");
    wrapper.style.setProperty("--pack-accent", res.persona.color);
    handle.style.left = "0px";
    handle.classList.remove("dragging");
    progress.style.width = "0%";
    packTop.style.transform = "";
    packTop.style.opacity = "1";

    innerArt.src = getPersonaImageUrl(res.persona.img);
    innerCode.textContent = res.persona.code;
    innerName.textContent = res.persona.name;

    const isAlertRare = res.persona.code === "CHEATER" || res.persona.code === "BANNED";
    if (isAlertRare) {
      wrapper.classList.add("rare-alert");
      caption.textContent = "🚨 检测到稀有隐藏款！按住虚线从左向右撕开卡包";
      emblem.innerHTML = "WARNING<br/>HIDDEN";
      meta.textContent = "TOP SECRET · ALERT EDITION";
      topLabel.textContent = "CAUTION · TEAR TO UNSEAL";
    } else if (res.isHidden) {
      caption.textContent = "✨ 触发隐藏档案卡包！沿虚线向右滑动撕开";
      emblem.innerHTML = "RARE<br/>EDITION";
      meta.textContent = `审讯官 ${state.selectedAI.id} · 隐藏彩蛋封存`;
      topLabel.textContent = "RARE BOOSTER PACK";
    } else {
      caption.textContent = "已封存 · 按住剪刀沿虚线从左向右撕开卡包";
      emblem.innerHTML = "16-BIT<br/>VERDICT";
      meta.textContent = `审讯官 ${state.selectedAI.id} · 匹配度 ${res.similarity}%`;
      topLabel.textContent = "SEALED BOOSTER PACK";
    }
  }

  function prepareUnsealCeremony() {
    const res = classifyClient(state.dims, state.h1, state.h2, state.mem);
    const matchedItem = ALL_PERSONAS.find(item => item.code === res.persona.code);
    if (matchedItem) res.persona = { ...res.persona, indexNo: matchedItem.indexNo };
    state.pendingResult = res;

    resetFoilPackVisuals(res);

    const isAlertRare = res.persona.code === "CHEATER" || res.persona.code === "BANNED";
    if (isAlertRare) {
      VoxelField.setTheme("#ff4d6d");
      SFX.alarm();
      triggerScreenShake();
    } else {
      VoxelField.setTheme(res.persona.color);
      SFX.coinCopy();
    }

    document.getElementById("unsealOverlay").classList.remove("hidden");
  }

  // 撕开完成后的连贯三段演出：1.封口条飞离 -> 2.闪卡从袋口滑出 -> 3.包装袋滑落退出，无缝切入 3D 闪卡结果台
  function triggerPackTearSequence() {
    if (packTearDone) return;
    packTearDone = true;

    const wrapper = document.getElementById("foilPackWrapper");
    const caption = document.getElementById("packCaption");
    const res = state.pendingResult;

    SFX.laserScan();
    triggerScreenShake();
    caption.textContent = `✨ 封口已撕开 · 正在抽出【${res ? res.persona.code : ""}】实体闪卡…`;

    const rect = wrapper.getBoundingClientRect();
    Particles.spawnBurst(rect.left + rect.width * 0.5, rect.top + 64, res ? res.persona.color : "#ffd166", 46);

    // 阶段 1：封口飞离 + 闪卡从包装内向上滑出
    wrapper.classList.add("torn");

    // 阶段 2：包装袋完全不透明向下滑落脱离，闪卡聚焦放大
    setTimeout(() => {
      SFX.fanfare(res && res.isHidden);
      wrapper.classList.add("card-emerge");
    }, 520);

    // 阶段 3：等待包装袋彻底滑出底边后，连贯切入 Step 4 完整 3D 实体闪卡舞台
    setTimeout(() => {
      executeUnsealAndShowResult();
    }, 1260);
  }

  function initFoilPackTearInteraction() {
    const track = document.getElementById("tearTrack");
    const handle = document.getElementById("tearHandle");
    const progress = document.getElementById("tearProgress");
    const packTop = document.getElementById("foilPackTop");
    const wrapper = document.getElementById("foilPackWrapper");
    const overlay = document.getElementById("unsealOverlay");
    const btnQuick = document.getElementById("btnQuickTear");
    if (!track || !handle || !wrapper) return;

    let dragging = false;
    let startX = 0;
    let maxDist = 200;
    let lastSoundStep = 0;

    // 镭射包装袋与内部闪卡实时随鼠标产生 3D 倾角与金属扫光折射
    const applyPackTilt = (clientX, clientY) => {
      if (overlay.classList.contains("hidden")) return;
      const nx = Math.max(-1, Math.min(1, (clientX / window.innerWidth) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, (clientY / window.innerHeight) * 2 - 1));
      const rotY = nx * (dragging ? 8 : 16);
      const rotX = -ny * (dragging ? 6 : 14);
      wrapper.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
      const gx = Math.round((nx * 0.5 + 0.5) * 100);
      const gy = Math.round((ny * 0.5 + 0.5) * 100);
      wrapper.style.setProperty("--pack-glare-x", `${gx}%`);
      wrapper.style.setProperty("--pack-glare-y", `${gy}%`);
      wrapper.style.setProperty("--pack-foil-angle", `${Math.round(115 + nx * 36)}deg`);
    };

    window.addEventListener("pointermove", (e) => {
      applyPackTilt(e.clientX, e.clientY);
    });

    const updateProgress = (ratio) => {
      const clamped = Math.max(0, Math.min(1, ratio));
      const px = clamped * maxDist;
      handle.style.left = `${px}px`;
      progress.style.width = `${Math.round(clamped * 94)}%`;
      // 随着撕开进度，顶部封口条实时轻微翘起产生拟真撕裂手感
      packTop.style.transform = `translate3d(${(clamped * 14).toFixed(1)}px, ${(-clamped * 12).toFixed(1)}px, 16px) rotate(${(clamped * 9).toFixed(1)}deg)`;

      const step = Math.floor(clamped * 6);
      if (step > lastSoundStep) {
        lastSoundStep = step;
        SFX.blip();
      }
      if (clamped >= 0.82) {
        dragging = false;
        handle.classList.remove("dragging");
        triggerPackTearSequence();
      }
    };

    const onStart = (e) => {
      if (packTearDone) return;
      dragging = true;
      lastSoundStep = 0;
      const trackRect = track.getBoundingClientRect();
      maxDist = Math.max(100, track.offsetWidth - handle.offsetWidth);
      startX = trackRect.left + handle.offsetWidth * 0.5;
      handle.classList.add("dragging");
      if (handle.setPointerCapture && e.pointerId !== undefined) {
        try { handle.setPointerCapture(e.pointerId); } catch {}
      }
      updateProgress((e.clientX - startX) / Math.max(100, trackRect.width - handle.offsetWidth));
    };

    const onMove = (e) => {
      if (!dragging || packTearDone) return;
      const trackRect = track.getBoundingClientRect();
      const span = Math.max(100, trackRect.width - handle.offsetWidth);
      updateProgress((e.clientX - (trackRect.left + handle.offsetWidth * 0.5)) / span);
    };

    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove("dragging");
      if (!packTearDone) {
        // 未撕满则平滑弹回起点
        handle.style.left = "0px";
        progress.style.width = "0%";
        packTop.style.transform = "";
      }
    };

    track.addEventListener("pointerdown", onStart);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);

    if (btnQuick) {
      btnQuick.onclick = () => {
        if (packTearDone) return;
        const trackRect = track.getBoundingClientRect();
        maxDist = Math.max(100, trackRect.width - handle.offsetWidth);
        let p = 0;
        const anim = () => {
          p += 0.14;
          updateProgress(p);
          if (p < 0.85 && !packTearDone) requestAnimationFrame(anim);
        };
        requestAnimationFrame(anim);
      };
    }
  }

  async function executeUnsealAndShowResult() {
    document.getElementById("unsealOverlay").classList.add("hidden");

    const res = state.pendingResult || classifyClient(state.dims, state.h1, state.h2, state.mem);
    state.isPreviewMode = false;

    Particles.spawnBurst(window.innerWidth / 2, window.innerHeight / 2, res.persona.color, 65);
    SFX.fanfare(res.isHidden);
    triggerScreenShake();
    VoxelField.setTheme(res.persona.color);

    document.getElementById("previewNavBox").classList.add("hidden");
    document.getElementById("testActionRow").classList.remove("hidden");
    document.getElementById("resultGalleryFooter").classList.remove("hidden");

    document.getElementById("verdictCode").textContent = res.persona.code;
    document.getElementById("verdictName").textContent = `${res.persona.name} · ${res.persona.rarity}（匹配度 ${res.similarity}%）`;
    document.getElementById("verdictRoast").textContent = `“${state.roast}”`;

    const holoCard = document.getElementById("holoCard3D");
    holoCard.classList.remove("unseal-flip");
    void holoCard.offsetWidth;
    holoCard.classList.add("unseal-flip");
    setTimeout(() => holoCard.classList.remove("unseal-flip"), 800);

    const record = {
      ai: state.selectedAI.id,
      code: res.persona.code,
      name: res.persona.name,
      similarity: res.similarity,
      roast: state.roast,
      dims: state.dims.join("-"),
      time: Date.now()
    };
    let history = [];
    try { history = JSON.parse(localStorage.getItem("ai_client_test_history") || "[]"); } catch {}
    history = [record, ...history.filter(h => h.ai !== record.ai)].slice(0, 2);
    try { localStorage.setItem("ai_client_test_history", JSON.stringify(history)); } catch {}

    renderDualCompare(history);
    switchScene("sceneStep4", 4);

    state.currentPosterCode = res.persona.code;
    state.posterDataUrl = await PosterRenderer.render(res, {
      isPreview: false,
      dims: state.dims,
      roast: state.roast,
      aiName: state.selectedAI.id
    });
  }

  async function openPersonaPreview(index) {
    const total = ALL_PERSONAS.length;
    const safeIdx = ((index % total) + total) % total;
    state.isPreviewMode = true;
    state.previewIndex = safeIdx;

    const p = ALL_PERSONAS[safeIdx];
    const previewDims = p.previewDims || p.target.slice(0, 8);
    const previewStamp = p.previewStamp || getStamp(p.target[8], p.target[9]);
    const previewRoast = p.previewRoast || p.desc;

    SFX.blip();
    VoxelField.setTheme(p.color);
    document.getElementById("previewNavBox").classList.remove("hidden");
    document.getElementById("testActionRow").classList.add("hidden");
    document.getElementById("dualCompareSection").classList.add("hidden");
    document.getElementById("resultGalleryFooter").classList.add("hidden");

    document.getElementById("verdictCode").textContent = p.code;
    document.getElementById("verdictName").textContent = `${p.name} · 图鉴原型 (#${safeIdx + 1}/${total})`;
    document.getElementById("verdictRoast").textContent = `“${previewRoast}”`;

    const holoCard = document.getElementById("holoCard3D");
    holoCard.classList.remove("unseal-flip");
    void holoCard.offsetWidth;
    holoCard.classList.add("unseal-flip");
    setTimeout(() => holoCard.classList.remove("unseal-flip"), 800);

    switchScene("sceneStep4", 4);
    state.currentPosterCode = p.code;
    state.posterDataUrl = await PosterRenderer.render(
      { persona: p, similarity: 100, isHidden: p.isHidden, stamp: previewStamp },
      { isPreview: true, dims: previewDims, roast: previewRoast, aiName: "图鉴预览" }
    );
  }

  function renderDualCompare(history) {
    const sec = document.getElementById("dualCompareSection");
    const grid = document.getElementById("dualCompareGrid");
    if (!history || history.length < 2) {
      sec.classList.add("hidden");
      return;
    }
    sec.classList.remove("hidden");
    grid.innerHTML = history.map(item => `
      <div class="compare-card">
        <div style="color: var(--cyan); font-weight: 700;">审讯官：${item.ai}</div>
        <div class="compare-code">${item.code}</div>
        <div style="color: #fff;">${item.name}（${item.similarity}%）</div>
        <div style="color: var(--muted); font-size: 10px; margin-top: 3px;">CODE: ${item.dims}</div>
        <div class="compare-roast">“${item.roast}”</div>
      </div>
    `).join("");
  }

  function renderManualStep() {
    const item = MANUAL_QUESTIONS[state.manualIdx];
    document.getElementById("manualProgress").textContent = `第 ${state.manualIdx + 1} / 8 题 · ${DIM_LABELS[item.dim]}`;
    document.getElementById("manualQuestion").textContent = item.q;
    const box = document.getElementById("manualChoices");
    box.innerHTML = "";
    ["A", "B", "C"].forEach((letter, i) => {
      const btn = document.createElement("button");
      btn.className = "choice-pill";
      btn.innerHTML = `<span class="choice-key">${letter}</span><div class="choice-title">${item.opts[i]}</div>`;
      btn.onclick = () => {
        SFX.blip();
        state.manualAnswers[item.dim] = i + 1;
        state.manualIdx++;
        if (state.manualIdx < MANUAL_QUESTIONS.length) {
          renderManualStep();
        } else {
          state.selectedAI = { id: "人类自测", label: "人类自测", hasMem: false, color: "#4cc9f0", url: "", tip: "" };
          state.dims = [...state.manualAnswers];
          state.mem = "Q";
          state.roast = "懒得切 App 亲自交卷的效率派甲方，至少对自己还算诚实。";
          document.getElementById("confessQ1").classList.remove("hidden");
          document.getElementById("confessQ2").classList.add("hidden");
          Polygraph.setStress(1);
          switchScene("sceneStep3", 3);
        }
      };
      box.appendChild(btn);
    });
  }

  function initGallery() {
    const grid = document.getElementById("galleryGrid");
    grid.innerHTML = "";
    ALL_PERSONAS.forEach((p, idx) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `gallery-item ${p.isHidden ? "hidden-type" : ""}`;
      card.innerHTML = `
        <img class="gallery-thumb" src="${getPersonaImageUrl(p.img)}" alt="${p.code} ${p.name}" loading="lazy" />
        <div class="gallery-code" style="color:${p.color}">${p.code}</div>
        <div class="gallery-name">${p.name} <span style="font-size:10px;color:var(--muted)">[${p.rarity}]</span></div>
        <div class="gallery-desc">${p.desc}</div>
      `;
      card.onclick = () => openPersonaPreview(idx);
      grid.appendChild(card);
    });
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    // 个人 IP 主页：鼠标悬停 IDEA 时稳定触发一次小人灵感欢呼，移开后平滑恢复
    const ideaEl = document.getElementById("ideaWordmark");
    if (ideaEl) {
      ideaEl.addEventListener("pointerenter", () => {
        SFX.cardHover();
        if (IpMascot) IpMascot.enterIdeaHover();
      });
      ideaEl.addEventListener("pointerleave", () => {
        if (IpMascot) IpMascot.leaveIdeaHover();
      });
    }

    document.getElementById("btnEnterPersonaTest").onclick = () => {
      if (IpMascot) IpMascot.triggerSprintOut();
      navigateWithVoxelWave("dark", "sceneHero");
    };

    document.getElementById("btnBackToIpHome").onclick = () => {
      navigateWithVoxelWave("light", "sceneIpHome");
    };

    document.getElementById("btnBrandHome").onclick = () => {
      if (state.currentScene === "sceneIpHome") {
        SFX.blip();
        return;
      }
      if (state.currentScene === "sceneHero") {
        navigateWithVoxelWave("light", "sceneIpHome");
      } else {
        SFX.blip();
        VoxelField.setTheme("#4cc9f0");
        switchScene("sceneHero");
      }
    };

    document.getElementById("btnToggleSound").onclick = (e) => {
      SFX.enabled = !SFX.enabled;
      e.currentTarget.textContent = SFX.enabled ? "🔊 音效: 开" : "🔇 音效: 关";
      e.currentTarget.classList.toggle("muted", !SFX.enabled);
      if (SFX.enabled) SFX.blip();
    };

    document.getElementById("btnToggleCRT").onclick = (e) => {
      const off = document.body.classList.toggle("crt-off");
      e.currentTarget.textContent = off ? "📺 CRT: 关" : "📺 CRT: 开";
      e.currentTarget.classList.toggle("muted", off);
      SFX.blip();
    };

    // Hero Launch Button -> 平滑运镜切入测试页 Step 1
    document.getElementById("btnHeroLaunch").onclick = (e) => {
      SFX.launch();
      const rect = e.currentTarget.getBoundingClientRect();
      Particles.spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, "#ffd166", 48);
      VoxelField.setTheme(state.selectedAI.color || "#4cc9f0");
      switchScene("sceneStep1", 1);
    };

    document.getElementById("btnHeroGallery").onclick = () => openGalleryFromDeck();
    document.getElementById("heroDeckStack").onclick = () => openGalleryFromDeck();
    document.getElementById("heroDeckStack").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openGalleryFromDeck();
      }
    });

    document.getElementById("btnHeroManual").onclick = () => {
      SFX.blip();
      state.manualIdx = 0;
      state.manualAnswers = new Array(8).fill(2);
      renderManualStep();
      switchScene("sceneManual", 2);
    };

    document.getElementById("btnCopyPrompt").onclick = async (e) => {
      const ok = await copyText(STANDARD_PROMPT);
      if (ok) {
        SFX.coinCopy();
        const rect = e.currentTarget.getBoundingClientRect();
        Particles.spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, "#ffd166", 36);
      }
      showToast(ok ? "✅ 已复制《AI 审讯令》，快去粘贴给 AI！" : "⚠️ 复制失败，请展开全文手动复制");
      if (ok) setTimeout(() => switchScene("sceneStep2", 2), 680);
    };

    document.getElementById("btnGoStep2").onclick = () => {
      SFX.blip();
      switchScene("sceneStep2", 2);
    };

    document.getElementById("btnBackStep1").onclick = () => {
      SFX.blip();
      switchScene("sceneStep1", 1);
    };

    document.getElementById("btnTogglePrompt").onclick = () => {
      SFX.blip();
      document.getElementById("promptPreview").classList.toggle("hidden");
    };

    document.getElementById("btnReadClipboard").onclick = async () => {
      SFX.blip();
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return showToast("剪贴板为空，请先去复制 AI 回复");
        document.getElementById("aiReplyInput").value = text;
        tryParseInput(true);
      } catch {
        showToast("当前浏览器不支持自动读取，请直接长按上方文本框粘贴");
        document.getElementById("aiReplyInput").focus();
      }
    };

    document.getElementById("btnParseManual").onclick = () => tryParseInput(true);
    document.getElementById("aiReplyInput").addEventListener("input", () => tryParseInput(false));

    document.getElementById("btnCopyRescue").onclick = async () => {
      await copyText(RESCUE_PROMPT);
      SFX.coinCopy();
      showToast("🚑 已复制催交卷话术，发给 AI 补发暗号即可");
    };

    document.getElementById("btnFillDemo").onclick = () => {
      document.getElementById("aiReplyInput").value =
        "哈哈你这甲方需求写得比作业提纲还严，每次我稍微瞎编一点你就立刻抓包，但干起活来确实很爽快。\n[CODE: 3-2-2-2-1-3-3-1 | MEM: Y | ROAST: 把AI当研发团队带的硬核跨界甲方，规则比导师还严但从不瞎折腾]";
      tryParseInput(true);
    };

    document.querySelectorAll("[data-stress]").forEach(btn => {
      btn.addEventListener("pointerenter", () => {
        const stress = Number(btn.getAttribute("data-stress") || 1);
        Polygraph.setStress(stress);
        if (stress === 3) SFX.alarm();
        else SFX.blip();
      });
    });

    document.querySelectorAll("[data-h1]").forEach(btn => {
      btn.onclick = () => {
        SFX.cartridgeInsert();
        state.h1 = Number(btn.getAttribute("data-h1"));
        document.getElementById("confessQ1").classList.add("hidden");
        document.getElementById("confessQ2").classList.remove("hidden");
      };
    });

    document.querySelectorAll("[data-h2]").forEach(btn => {
      btn.onclick = () => {
        state.h2 = Number(btn.getAttribute("data-h2"));
        prepareUnsealCeremony();
      };
    });

    initFoilPackTearInteraction();

    document.getElementById("btnDownloadPoster").onclick = () => {
      SFX.coinCopy();
      if (!state.posterDataUrl) {
        showToast("⚠️ 本地 file:// 限制导出 PNG，请通过本地服务器打开或直接截图保存");
        return;
      }
      const safeCode = (state.currentPosterCode || "POSTER").replace(/[^a-zA-Z0-9_-]/g, "");
      const a = document.createElement("a");
      a.download = `AI甲方风评_${safeCode}_${Date.now()}.png`;
      a.href = state.posterDataUrl;
      a.click();
      showToast("💾 海报已触发下载");
    };

    document.getElementById("btnPreviewPrev").onclick = () => openPersonaPreview(state.previewIndex - 1);
    document.getElementById("btnPreviewNext").onclick = () => openPersonaPreview(state.previewIndex + 1);
    document.getElementById("btnBackToGallery").onclick = () => {
      SFX.blip();
      state.isPreviewMode = false;
      switchScene("sceneGallery");
    };

    document.getElementById("btnDualTest").onclick = () => {
      SFX.blip();
      document.getElementById("aiReplyInput").value = "";
      document.getElementById("parseStatus").classList.add("hidden");
      document.getElementById("rescueBox").classList.add("hidden");
      showToast("换一家 AI 粘贴审讯令，回来自动生成双 AI 对账单！");
      switchScene("sceneStep1", 1);
    };

    document.getElementById("btnRetest").onclick = () => {
      SFX.blip();
      document.getElementById("aiReplyInput").value = "";
      document.getElementById("parseStatus").classList.add("hidden");
      document.getElementById("rescueBox").classList.add("hidden");
      VoxelField.setTheme("#4cc9f0");
      switchScene("sceneStep1", 1);
    };

    document.getElementById("btnClearHistory").onclick = () => {
      SFX.blip();
      localStorage.removeItem("ai_client_test_history");
      document.getElementById("dualCompareSection").classList.add("hidden");
      showToast("已清空双 AI 对账记录");
    };

    document.getElementById("btnStartManual").onclick = () => {
      SFX.blip();
      state.manualIdx = 0;
      state.manualAnswers = new Array(8).fill(2);
      renderManualStep();
      switchScene("sceneManual", 2);
    };

    document.getElementById("btnCancelManual").onclick = () => {
      SFX.blip();
      switchScene("sceneStep1", 1);
    };

    document.getElementById("btnOpenGallery").onclick = () => {
      SFX.blip();
      switchScene("sceneGallery");
    };
    document.getElementById("btnResultGallery").onclick = () => {
      SFX.blip();
      switchScene("sceneGallery");
    };
    document.getElementById("btnCloseGallery").onclick = () => closeGalleryToOrigin();
  }

  // ---------- 启动主循环 ----------
  VoxelField.init();
  if (IpMascot) IpMascot.init();
  Particles.init();
  Polygraph.init();
  initHoloCard3D();
  buildHeroDeckStack();
  initAIGrid();
  initGallery();
  bindEvents();

  function masterLoop(nowMs) {
    const nowSec = nowMs * 0.001;
    VoxelField.render(nowSec);
    Particles.render();
    Polygraph.render();
    requestAnimationFrame(masterLoop);
  }
  requestAnimationFrame(masterLoop);
})();
