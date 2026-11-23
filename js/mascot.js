// =========================================================================
// mascot.js · 主岛像素小人互动状态机（站在 Miles' Studio 2.5D 主岛前侧空地）
// =========================================================================
window.IpMascot = (() => {
  const BASE_DIR = "./assets/mascot/";
  const ACT = (n) => `${BASE_DIR}char_grad_actions_frames/char_grad_actions_0${n}.png`;
  const RUN = (n) => `${BASE_DIR}char_grad_run_frames/char_grad_run_0${n}.png`;
  const BUB = (n) => `${BASE_DIR}ui_emotion_bubbles_frames/ui_emotion_bubbles_0${n}.png`;

  let stageEl = null;
  let spriteEl = null;
  let bubbleEl = null;

  let mode = "idle"; // idle | emote | cheer | sprint
  let clickCycle = 0;
  let idleTick = 0;
  let idleTimer = null;
  let revertTimer = null;
  let bubbleTimer = null;

  function preload() {
    const urls = [];
    for (let i = 0; i < 8; i++) urls.push(ACT(i), BUB(i));
    for (let i = 0; i < 4; i++) urls.push(RUN(i));
    urls.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }

  function setSprite(src, withBounce = false) {
    if (!spriteEl) return;
    spriteEl.src = src;
    if (withBounce) {
      spriteEl.classList.remove("bounce-pop");
      void spriteEl.offsetWidth;
      spriteEl.classList.add("bounce-pop");
    }
  }

  function showBubble(idx, durationMs = 2000) {
    if (!bubbleEl) return;
    clearTimeout(bubbleTimer);
    if (idx === null || idx === undefined) {
      bubbleEl.classList.add("hidden");
      return;
    }
    bubbleEl.src = BUB(idx);
    bubbleEl.classList.remove("hidden");
    bubbleEl.style.animation = "none";
    void bubbleEl.offsetWidth;
    bubbleEl.style.animation = "";
    if (durationMs > 0) {
      bubbleTimer = setTimeout(() => bubbleEl.classList.add("hidden"), durationMs);
    }
  }

  function clearTimers() {
    clearInterval(idleTimer);
    clearTimeout(revertTimer);
    idleTimer = null;
    revertTimer = null;
  }

  function startIdle() {
    clearTimers();
    mode = "idle";
    setSprite(ACT(0), false);
    idleTick = 0;
    idleTimer = setInterval(() => {
      if (mode !== "idle") return;
      idleTick++;
      setSprite(idleTick % 3 === 0 ? ACT(1) : ACT(0), false);
      if (idleTick % 7 === 0) {
        showBubble(idleTick % 14 === 0 ? 7 : 3, 2100);
      }
    }, 950);
  }

  function handleMascotClick(e) {
    e.stopPropagation();
    if (mode === "sprint") return;
    clearTimers();
    const step = clickCycle % 4;
    clickCycle++;

    if (step === 0) {
      mode = "emote";
      window.SFX.coinCopy();
      setSprite(ACT(6), true); // 微笑挥手
      showBubble(1, 1900);
      revertTimer = setTimeout(startIdle, 1900);
    } else if (step === 1) {
      mode = "emote";
      window.SFX.cardHover();
      setSprite(ACT(7), true); // 双手高举欢呼
      showBubble(6, 1900); // 金色灵感闪电
      revertTimer = setTimeout(startIdle, 1900);
    } else if (step === 2) {
      mode = "emote";
      window.SFX.blip();
      setSprite(ACT(3), true); // 顶笔记本防身
      showBubble(2, 2000);
      revertTimer = setTimeout(startIdle, 2000);
    } else {
      mode = "emote";
      window.SFX.alarm();
      setSprite(ACT(4), true);
      showBubble(0, 500);
      revertTimer = setTimeout(() => {
        setSprite(ACT(5), false); // 晕倒躺平在主岛空地上
        showBubble(4, 2200);
        revertTimer = setTimeout(startIdle, 2300);
      }, 380);
    }
  }

  // 鼠标移到项目小岛时，主岛小人开心欢呼 + 亮出灵感闪电指引
  function cheerForProject(isMystery = false) {
    if (mode === "sprint" || mode === "cheer") return;
    clearTimers();
    mode = "cheer";
    setSprite(isMystery ? ACT(2) : ACT(7), true);
    showBubble(isMystery ? 0 : 6, 0);
  }

  function stopCheer() {
    if (mode !== "cheer") return;
    clearTimers();
    revertTimer = setTimeout(() => {
      if (mode === "cheer") {
        showBubble(null);
        startIdle();
      }
    }, 450);
  }

  function triggerSprintOut() {
    clearTimers();
    mode = "sprint";
    setSprite(ACT(7), true);
    showBubble(6, 900);
  }

  function resetToHome() {
    showBubble(null);
    startIdle();
  }

  function init() {
    stageEl = document.getElementById("ipMascotStage");
    spriteEl = document.getElementById("ipMascotSprite");
    bubbleEl = document.getElementById("ipEmotionBubble");
    if (!stageEl || !spriteEl) return;

    preload();
    startIdle();
    stageEl.addEventListener("click", handleMascotClick);
  }

  return {
    init,
    cheerForProject,
    stopCheer,
    triggerSprintOut,
    resetToHome
  };
})();
