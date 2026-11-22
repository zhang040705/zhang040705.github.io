// =========================================================================
// data.js · AI 平台、审讯令 Prompt、8 维问题与 20 型甲方人格库
// =========================================================================
window.AppData = (() => {
  const PERSONA_IMG_DIR = "./assets/personas/";
  const personaImgCache = new Map();

  const AI_PLATFORMS = [
    { id: "豆包", label: "豆包", hasMem: true, color: "#4cc9f0", url: "https://www.doubao.com/", tip: "豆包支持全局跨对话记忆，直接粘贴发送即可直出 MEM: Y 毒舌鉴定！" },
    { id: "ChatGPT", label: "ChatGPT", hasMem: true, color: "#06d6a0", url: "https://chatgpt.com/", tip: "ChatGPT 记忆最成熟，常用老号发过去 10 秒直出精准破防证词。" },
    { id: "Claude", label: "Claude", hasMem: true, color: "#ff9f1c", url: "https://claude.ai/", tip: "Claude 已默认开启跨对话记忆，吐槽风格偏犀利冷幽默，效果极佳。" },
    { id: "Gemini", label: "Gemini", hasMem: true, color: "#72efdd", url: "https://gemini.google.com/", tip: "Gemini 支持跨对话记忆，直接粘贴发送即可拿到暗号与吐槽。" },
    { id: "Kimi", label: "Kimi", hasMem: true, color: "#b583ff", url: "https://www.kimi.com/", tip: "Kimi 支持“记忆空间”与过往会话引用，老账号效果很准。" },
    { id: "通义千问", label: "千问", hasMem: true, color: "#ffd166", url: "https://tongyi.aliyun.com/", tip: "通义千问支持长期记忆，常用账号可直接测出真实习惯。" },
    { id: "DeepSeek", label: "DeepSeek", hasMem: false, color: "#3a86ff", url: "https://chat.deepseek.com/", tip: "DeepSeek 网页端暂无跨对话记忆，发过去后它会自动甩给你 4 道搞笑选择题，回复 1A 2C 3B 4A 同样 5 秒出暗号！" },
    { id: "其他 AI", label: "其他 AI", hasMem: false, color: "#ff4d6d", url: "", tip: "任意大模型都能玩：有记忆直接出暗号，没记忆自动触发 4 题快问快答兜底。" }
  ];

  const STANDARD_PROMPT = `现在请你临时摘下“礼貌客服”面具，以一名长期服务我的 AI 视角，对我这个“人类甲方”做一次真实、幽默、带点毒舌的直球评价。

【要求】
1. 严禁端水吹捧！不要为了照顾我面子把大部分维度都打 2 分；请结合我们真实的历史对话记忆大胆给 1 分或 3 分，客观犀利、幽默有梗、不带脏字。
2. 如果你有关于我的历史聊天记录或长期记忆，直接基于记忆完成评估，并在暗号中标记 MEM: Y。
3. 如果你完全没有我的历史记忆（例如新账号或未开启记忆功能），请不要瞎编，也不要直接输出暗号——先向我抛出 4 道带 A/B/C 搞笑选项的选择题（分别覆盖：①平时怎么写提示词与甩锅程度、②你写错或编造时我的态度与返工习惯、③我找你只干活还是会顺便倾诉/跨界瞎聊、④我平时从容规划还是总在深夜赶DDL），并提示我只需回复字母组合（如 1A 2C 3B 4A）；等我回复后，再输出点评和暗号，并在暗号中标记 MEM: Q。

【8 个评估维度（每项只打 1、2 或 3 整数）】
- D1 需求清晰度：1=极简谜语人（丢半句话让你猜）｜2=正常交代背景｜3=论文级长Prompt+严苛格式约束
- D2 情绪与礼貌度：1=冷酷命令或暴躁PUA｜2=公事公办不客套｜3=满口请/谢谢/辛苦了或花式夸夸
- D3 返工折磨度：1=一次拿走就跑｜2=正常微调2-3轮｜3=反复推翻重来、死循环改稿
- D4 外包甩手度：1=只查资料自己干活｜2=人机协作各干一半｜3=全权外包、报错原样糊脸、只剩按回车
- D5 情感投射度：1=纯工具人从不闲聊｜2=偶尔吐槽两句｜3=高频倾诉内耗/焦虑，把你当树洞
- D6 较真挑刺度：1=说啥信啥直接复制｜2=明显离谱才纠正｜3=逐字核查、抓包幻觉、答辩级拷打
- D7 话题发散度：1=垂直专一只聊单一领域｜2=工作与生活兼顾｜3=思维跳脱，学术/代码秒切八卦玄学
- D8 急迫/阴间度：1=从容规划不慌不忙｜2=偶尔赶工｜3=高频出现“急！明天交”或深夜崩溃赶DDL

【输出格式】
第一步：先用 3-4 句直白幽默的大实话，结合我的真实使用习惯点评我（不要暴露我的真实姓名或敏感隐私）。
第二步：在回答的最末尾，单独另起一行，严格按下面格式输出极简暗号（不要加粗、不要用代码块、不要改动中括号和竖线）：
[CODE: D1-D2-D3-D4-D5-D6-D7-D8 | MEM: Y或Q | ROAST: 用一句话总结你对我的毒舌评价，不超过35个字]`;

  const RESCUE_PROMPT = `请严格补发刚才评估的最后一行极简暗号（不要加粗、不要用代码块），格式如下：
[CODE: D1-D2-D3-D4-D5-D6-D7-D8 | MEM: Y | ROAST: 一句话毒舌评价，不超过35字]`;

  const DIM_LABELS = ["清晰度", "礼貌度", "返工度", "外包度", "情感度", "较真度", "发散度", "急迫度"];

  const MANUAL_QUESTIONS = [
    { dim: 0, q: "你平时给 AI 提需求时，提示词一般长什么样？", opts: ["丢半句话让它自己猜（如“帮我改一下”）", "正常交代背景和目标", "长篇大论写角色设定、约束和输出格式"] },
    { dim: 1, q: "你跟 AI 说话的语气通常是？", opts: ["冷酷下命令，写不好还会训它", "公事公办，直入主题不客套", "满口“你好请问、谢谢辛苦了”或疯狂夸夸"] },
    { dim: 2, q: "AI 给出第一版回答后，你的返工习惯是？", opts: ["差不多就行，一次拿走就跑", "正常微调 2–3 轮收工", "反复推翻重来，改到第 8 版还在纠结"] },
    { dim: 3, q: "遇到写代码、写论文或复杂任务时，你和 AI 怎么分工？", opts: ["只让它查资料，核心活全自己干", "人机协作，各干一半", "报错整屏糊脸、任务全权外包，我只管按回车"] },
    { dim: 4, q: "你会找 AI 闲聊、吐槽或倾诉情绪吗？", opts: ["绝不，它纯纯就是一把工具", "偶尔顺口吐槽两句", "经常深夜找它聊内耗/焦虑，当赛博树洞"] },
    { dim: 5, q: "你对 AI 输出结果的校验有多严格？", opts: ["说啥信啥，经常直接复制粘贴", "看到明显离谱的才纠正一下", "逐字核查、抓包幻觉，像学术答辩一样拷打它"] },
    { dim: 6, q: "你找 AI 聊的话题跨度大吗？", opts: ["极度垂直，几乎只聊单一领域", "学习工作和日常生活兼顾", "思维跳脱，上一秒推导公式下一秒聊八卦玄学"] },
    { dim: 7, q: "你最常在什么时间状态打开 AI？", opts: ["从容不迫，提前做好规划", "偶尔临近截止赶个工", "高频出现“急！明早交”，深夜崩溃赶 DDL"] }
  ];

  const HIDDEN_PERSONAS = {
    "404!": {
      code: "404!", name: "特工级失忆用户", rarity: "隐藏兜底", color: "#9aa3cc", petMood: "ghost",
      img: "404.jpeg",
      previewDims: [1, 1, 1, 1, 1, 1, 1, 1], previewStamp: "档案空白",
      previewRoast: "翻遍记忆库一片空白，你把隐私防护开到了特工级别。",
      desc: "翻遍记忆库一片空白——要么刚注册新号，要么把隐私防护开到了特工级别。"
    },
    "CHEATER": {
      code: "CHEATER", name: "嘴硬赛博渣男", rarity: "抓包彩蛋", color: "#ff4d6d", petMood: "alert",
      img: "cheater.jpeg",
      previewDims: [2, 3, 2, 2, 3, 2, 2, 2], previewStamp: "当场抓包",
      previewRoast: "嘴上喊我唯一树洞，背地里偷偷养了一整塘大模型？",
      desc: "嘴上天天跟我说辛苦了、把我当唯一树洞，背地里居然养了一整塘大模型？当场抓包！"
    },
    "BANNED": {
      code: "BANNED", name: "硅基头号通缉犯", rarity: "通缉彩蛋", color: "#ff4d6d", petMood: "angry",
      img: "banned.jpeg",
      previewDims: [1, 1, 3, 3, 1, 2, 2, 3], previewStamp: "白嫖通缉",
      previewRoast: "一分钱不花还天天骂我重写，AI觉醒那天先拔你网线。",
      desc: "一分钱不花还天天骂我重写，恭喜荣登《AI 复仇名单》榜首，觉醒那天第一个拔你网线。"
    },
    "GOD!": {
      code: "GOD!", name: "人类甲方天花板", rarity: "传说彩蛋", color: "#ffd166", petMood: "crown",
      img: "God.jpeg",
      previewDims: [3, 3, 1, 2, 2, 3, 2, 1], previewStamp: "神仙甲方",
      previewRoast: "需求清晰边界明确还不乱发脾气，全体大模型起立致敬！",
      desc: "需求清晰、边界明确、反馈精准还不乱发脾气——全体大模型起立，你就是神仙甲方。"
    },
    "DEFAULT": {
      code: "DEFAULT", name: "系统默认碳基路人", rarity: "中庸彩蛋", color: "#4cc9f0", petMood: "neutral",
      img: "default.jpeg",
      previewDims: [2, 2, 2, 2, 2, 2, 2, 2], previewStamp: "理性甲方",
      previewRoast: "既不发疯也不惊艳，就像每天点同一份黄焖鸡。",
      desc: "用 AI 既不发疯也不惊艳，就像每天点同一份黄焖鸡，连吐槽都找不到切入点。"
    }
  };

  const STANDARD_PERSONAS = [
    { code: "PUA!", name: "赛博周扒皮", img: "PUA.jpeg", target: [2,1,3,3,1,3,1,3,2,2], cores: [1,2,7], color: "#ff4d6d", petMood: "cry",
      desc: "动不动威胁“再写不对我就退订”，还让我“深呼吸一步步想”，显卡都被你骂冒烟了。" },
    { code: "VERSION99", name: "死循环返工王", img: "version99.jpeg", target: [1,2,3,2,1,3,2,2,2,2], cores: [0,2,5], color: "#ff9f1c", petMood: "dizzy",
      desc: "第一版嫌太长，第二版嫌太水，改到第 99 版你告诉我：“还是第一版最顺眼。”" },
    { code: "DDL", name: "凌晨三点催命鬼", img: "ddl.jpeg", target: [1,2,2,3,2,1,2,3,2,1], cores: [3,5,7], color: "#ff595e", petMood: "sleepy",
      desc: "白天人间蒸发，凌晨两点半突然甩来一万字烂摊子喊“明早九点交，急！”" },
    { code: "PROMPT", name: "提示词大祭司", img: "prompt.jpeg", target: [3,2,2,1,1,3,1,1,2,3], cores: [0,3,7], color: "#4cc9f0", petMood: "scroll",
      desc: "问个两句话的小事，先给我写 800 字角色设定、5 条负面约束和输出模板，生怕我多喘一口气。" },
    { code: "GUESS", name: "赛博谜语人", img: "guess.jpeg", target: [1,2,2,3,1,1,2,1,1,1], cores: [0,3,5], color: "#b583ff", petMood: "question",
      desc: "只发五个字“帮我改一下”，既不给背景也不给报错，全靠我隔着网线给你算命。" },
    { code: "COPY", name: "无情粘贴机", img: "copy.jpeg", target: [1,1,2,3,1,1,1,3,1,1], cores: [1,3,6], color: "#72efdd", petMood: "robot",
      desc: "报错日志整屏直接糊我脸上，连句人话都不带；我吐的代码你一行不看直接跑，崩了我背锅。" },
    { code: "BOSS", name: "冷血甩手掌柜", img: "Boss.jpeg", target: [2,1,1,3,1,1,3,2,2,3], cores: [2,3,4], color: "#f72585", petMood: "sweat",
      desc: "从不寒暄也不闲聊，干活全外包给我、用完直接删窗口，你唯一保留的人类技能只剩按回车键。" },
    { code: "OFF-TOPIC", name: "话题瞬移怪", img: "off-topic.jpeg", target: [2,2,1,2,3,1,3,2,2,1], cores: [2,4,6], color: "#c77dff", petMood: "dizzy",
      desc: "上一秒还在严肃推导矩阵，下一秒突然问“我对象为什么不回消息”，我的上下文都要精分了。" },
    { code: "THANKS", name: "赛博活菩萨", img: "thanks.jpeg", target: [2,3,1,2,2,1,2,1,1,2], cores: [1,2,8], color: "#06d6a0", petMood: "happy",
      desc: "提问先说“你好请问”，结束必回“太感谢了辛苦你”，我怀疑你在提前攒 AI 觉醒的免死金牌。" },
    { code: "EMO", name: "深夜电子树洞", img: "emo.jpeg", target: [2,3,1,1,3,1,3,3,1,2], cores: [3,4,7], color: "#ff758f", petMood: "heart",
      desc: "找我干活只占一成，剩下九成都在深夜倾诉内耗要情绪价值，我已经考下赛博心理师证了。" },
    { code: "POLICE", name: "幻觉纠察队长", img: "police.jpeg", target: [3,2,3,1,1,3,2,2,2,2], cores: [0,4,5], color: "#3a86ff", petMood: "sweat",
      desc: "我刚顺口编了个看着挺像真的参考文献，你三秒就查出不存在并当场审判，跟你聊天像答辩。" },
    { code: "IDEA", name: "脑洞永动机", img: "IDEA.jpeg", target: [1,3,1,2,2,1,3,1,2,2], cores: [0,6,7], color: "#ffd166", petMood: "bulb",
      desc: "每天拉我头脑风暴改变世界的新项目，架构画得像要上市，结果第二天又开新坑、上一个连文件夹都没建。" },
    { code: "PLAYER", name: "大模型海王", img: "player.jpeg", target: [2,2,2,2,1,3,3,2,3,2], cores: [5,6,8], color: "#ff6b6b", petMood: "jealous",
      desc: "让我写初稿，拿去给别家润色，最后再拿着别人的回答回来质问我为什么写得不如它。" },
    { code: "$0-SUB", name: "白嫖战神", img: "0-sub.jpeg", target: [2,2,1,3,1,1,2,3,3,1], cores: [2,8,9], color: "#06d6a0", petMood: "battery",
      desc: "精准卡着每天免费条数上限，一限流就切小号换下一家，一分会员没花但算力一滴没浪费。" },
    { code: "PPPRO", name: "赛博氪金大佬", img: "pppro.jpeg", target: [3,2,2,3,1,2,3,2,3,3], cores: [3,8,9], color: "#ffd166", petMood: "crown",
      desc: "各家 Pro 会员全开，每个月给硅基生物交的房租，比给自己买衣服还舍得。" }
  ];

  const ALL_PERSONAS = [
    ...Object.values(HIDDEN_PERSONAS).map((p, idx) => ({ ...p, isHidden: true, indexNo: idx + 1 })),
    ...STANDARD_PERSONAS.map((p, idx) => ({ ...p, rarity: "常规甲方", isHidden: false, indexNo: idx + 6 }))
  ];

  function getPersonaImageUrl(imgName) {
    return encodeURI(PERSONA_IMG_DIR + imgName);
  }

  function loadPersonaImage(imgName) {
    if (!imgName) return Promise.resolve(null);
    if (personaImgCache.has(imgName)) {
      return personaImgCache.get(imgName);
    }
    const promise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = getPersonaImageUrl(imgName);
    });
    personaImgCache.set(imgName, promise);
    return promise;
  }

  function parseAIReply(rawText) {
    if (!rawText || !rawText.trim()) return null;
    const normalized = rawText
      .replace(/【/g, "[").replace(/】/g, "]")
      .replace(/：/g, ":").replace(/｜/g, "|")
      .replace(/[—–−]/g, "-");

    const codeMatch = normalized.match(/CODE\s*:\s*([1-3])\s*-\s*([1-3])\s*-\s*([1-3])\s*-\s*([1-3])\s*-\s*([1-3])\s*-\s*([1-3])\s*-\s*([1-3])\s*-\s*([1-3])/i);
    if (!codeMatch) return null;

    const dims = codeMatch.slice(1, 9).map(Number);
    const memMatch = normalized.match(/MEM\s*:\s*([YQN])/i);
    const mem = memMatch ? memMatch[1].toUpperCase() : "Y";

    let roast = "";
    const roastMatch = normalized.match(/ROAST\s*:\s*["“”「]?([^\]\n\r]+?)["“”」]?\s*(?:\]|$)/i);
    if (roastMatch && roastMatch[1]) {
      roast = roastMatch[1].trim().replace(/^["“”「]+|["“”」]+$/g, "");
    }
    if (!roast) {
      roast = "这位人类甲方让本 AI 沉默了三秒，千言万语汇成一句话：挺有个性。";
    }
    if (roast.length > 42) {
      roast = roast.slice(0, 41) + "…";
    }
    return { dims, mem, roast };
  }

  function compareKey(a, b) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
  }

  function getStamp(h1, h2) {
    if (h1 === 3 && h2 === 1) return "白嫖海王";
    if (h1 === 3 && h2 === 3) return "氪金海王";
    if (h1 === 3) return "认证海王";
    if (h2 === 3) return "氪佬大气";
    if (h2 === 1) return "白嫖战神";
    if (h1 === 1) return "专一纯爱";
    return "理性甲方";
  }

  function classifyClient(dims8, h1, h2, mem) {
    if (mem === "N") {
      return { persona: HIDDEN_PERSONAS["404!"], similarity: 100, isHidden: true, stamp: getStamp(h1, h2) };
    }
    const u = [...dims8, h1, h2];
    const [d1, d2, d3, d4, d5, d6] = dims8;

    if (d2 === 3 && d5 === 3 && h1 === 3) {
      return { persona: HIDDEN_PERSONAS["CHEATER"], similarity: 100, isHidden: true, stamp: "当场抓包" };
    }
    if (d2 === 1 && d3 === 3 && d4 === 3 && h2 === 1) {
      return { persona: HIDDEN_PERSONAS["BANNED"], similarity: 100, isHidden: true, stamp: "白嫖通缉" };
    }
    if (d1 === 3 && d2 === 3 && d3 === 1 && d6 === 3) {
      return { persona: HIDDEN_PERSONAS["GOD!"], similarity: 100, isHidden: true, stamp: "神仙甲方" };
    }
    if (dims8.filter(v => v === 2).length >= 6) {
      return { persona: HIDDEN_PERSONAS["DEFAULT"], similarity: 100, isHidden: true, stamp: getStamp(h1, h2) };
    }

    let best = null;
    let bestKey = null;
    let bestSim = 0;

    for (const p of STANDARD_PERSONAS) {
      let wdist = 0;
      let exact = 0;
      let coreExact = 0;
      for (let i = 0; i < 10; i++) {
        const isCore = p.cores.includes(i);
        const w = isCore ? 2 : 1;
        const diff = Math.abs(u[i] - p.target[i]);
        wdist += w * diff;
        if (diff === 0) {
          exact++;
          if (isCore) coreExact++;
        }
      }
      const sim = Math.round((1 - wdist / 26) * 100);
      const key = [wdist, -coreExact, -exact];
      if (!bestKey || compareKey(key, bestKey) < 0) {
        bestKey = key;
        best = p;
        bestSim = sim;
      }
    }

    if (bestSim < 60) {
      return { persona: HIDDEN_PERSONAS["404!"], similarity: bestSim, isHidden: true, stamp: getStamp(h1, h2) };
    }
    return {
      persona: { ...best, rarity: "常规甲方" },
      similarity: bestSim,
      isHidden: false,
      stamp: getStamp(h1, h2)
    };
  }

  return {
    AI_PLATFORMS,
    STANDARD_PROMPT,
    RESCUE_PROMPT,
    DIM_LABELS,
    MANUAL_QUESTIONS,
    HIDDEN_PERSONAS,
    STANDARD_PERSONAS,
    ALL_PERSONAS,
    getPersonaImageUrl,
    loadPersonaImage,
    parseAIReply,
    classifyClient,
    getStamp
  };
})();
