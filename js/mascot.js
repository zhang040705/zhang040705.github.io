// =========================================================================
// mascot.js · 个人 IP 像素小人帧动画状态机（冰美式待机、IDEA 灵感爆发、点击彩蛋、切页冲刺）
// =========================================================================
window.IpMascot = (() => {
  const BASE_DIR = "./assets/mascot/";
  const ACT = (n) => `${BASE_DIR}char_grad_actions_frames/char_grad_actions_0${n}.png`;
  const RUN = (n) => `${BASE_DIR}char_grad_run_frames/char_grad_run_0${n}.png`;
  const BUB = (n) => `${BASE_DIR}ui_emotion_bubbles_frames/ui_emotion_bubbles_0${n}.png`;

  // Actions frames:
  // 0: 拿冰美式待机, 1: 吸冰美式, 2: 举冰美式两眼放光, 3: 头顶笔记本挡灾,
  // 4: 吓飞跳起, 5: 晕倒躺平, 6: 微笑挥手, 7: 双手高举欢呼
  // Bubbles frames:
  // 0: ?, 1: !, 2: 汗滴, 3: 低电量, 4: 404, 5: 怒气, 6: 灵感闪电, 7: ZZZ

  let stageEl = null;
  let spriteEl = null;
  let bubbleEl = null;

  let mode = "idle"; // idle | inspired | wave | shield | faint | sprint
  let clickCycle = 0;
  let idleTick = 0;
  let frameTimer = null;
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

  function showBubble(bubbleIdx, durationMs = 2200) {
    if (!bubbleEl) return;
    clearTimeout(bubbleTimer);
    if (bubbleIdx === null || bubbleIdx === undefined) {
      bubbleEl.classList.add("hidden");
      return;
    }
    bubbleEl.src = BUB(bubbleIdx);
    bubbleEl.classList.remove("hidden");
    // Re-trigger pop-in animation
    bubbleEl.style.animation = "none";
    void bubbleEl.offsetWidth;
    bubbleEl.style.animation = "";
    if (durationMs > 0) {
      bubbleTimer = setTimeout(() => {
        bubbleEl.classList.add("hidden");
      }, durationMs);
    }
  }

  function clearTimers() {
    clearInterval(frameTimer);
    clearTimeout(revertTimer);
    frameTimer = null;
    revertTimer = null;
  }

  function startIdle() {
    clearTimers();
    mode = "idle";
    if (stageEl) stageEl.classList.remove("sprint-out", "is-fainted");
    setSprite(ACT(0), false);

    // 喝冰美式循环待机，间歇冒出低电量或 ZZZ 气泡
    idleTick = 0;
    frameTimer = setInterval(() => {
      if (mode !== "idle") return;
      idleTick++;
      const sipping = idleTick % 3 === 0;
      setSprite(sipping ? ACT(1) : ACT(0), false);
      if (idleTick % 7 === 0) {
        showBubble(idleTick % 14 === 0 ? 7 : 3, 2100);
      }
    }, 950);
  }

  // 鼠标进入 IDEA 整体区域：稳定切入一次灵感欢呼状态，不重复抖动抽搐
  function enterIdeaHover() {
    if (mode === "sprint" || mode === "inspired") return;
    clearTimers();
    mode = "inspired";
    setSprite(ACT(7), true);
    showBubble(6, 0); // 悬停期间常驻金色灵感闪电，不反复闪烁
  }

  function leaveIdeaHover() {
    if (mode !== "inspired") return;
    clearTimers();
    revertTimer = setTimeout(() => {
      if (mode === "inspired") {
        showBubble(null);
        startIdle();
      }
    }, 550);
  }

  // 点击小人触发彩蛋状态循环：挥手 -> 顶笔记本防身 -> 吓飞晕倒404 -> 爬起继续喝咖啡
  function handleMascotClick() {
    if (mode === "sprint") return;
    clearTimers();
    const step = clickCycle % 3;
    clickCycle++;

    if (step === 0) {
      mode = "wave";
      window.SFX.coinCopy();
      setSprite(ACT(6), true);
      showBubble(1, 2000); // 感叹号
      revertTimer = setTimeout(startIdle, 2000);
    } else if (step === 1) {
      mode = "shield";
      window.SFX.blip();
      setSprite(ACT(3), true);
      showBubble(2, 2100); // 汗滴
      revertTimer = setTimeout(startIdle, 2100);
    } else {
      mode = "faint";
      window.SFX.alarm();
      setSprite(ACT(4), true); // 吓飞跳起
      showBubble(0, 600);
      revertTimer = setTimeout(() => {
        if (stageEl) stageEl.classList.add("is-fainted");
        setSprite(ACT(5), false); // 稳稳平躺在 need. 顶部平台上
        showBubble(4, 2400); // 404 气泡
        revertTimer = setTimeout(startIdle, 2500);
      }, 420);
    }
  }

  // 点击跳转人格测试子页时：小人加速冲刺跑出屏幕
  function triggerSprintOut() {
    clearTimers();
    mode = "sprint";
    showBubble(1, 900);
    let f = 0;
    setSprite(RUN(0), false);
    frameTimer = setInterval(() => {
      f = (f + 1) % 4;
      setSprite(RUN(f), false);
    }, 90);

    if (stageEl) {
      requestAnimationFrame(() => {
        stageEl.classList.add("sprint-out");
      });
    }
  }

  function resetToHome() {
    if (stageEl) stageEl.classList.remove("sprint-out", "is-fainted");
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
    enterIdeaHover,
    leaveIdeaHover,
    triggerSprintOut,
    resetToHome
  };
})();
