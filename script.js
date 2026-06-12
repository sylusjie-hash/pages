const demoScenarios = {
  correct_priority: {
    id: "correct_priority",
    strategyType: "correct",
    strategyTitle: "正确项优先",
    strategyCopy: "你刚刚做错的这道题，核心薄弱点更可能出在正确成语本身的理解与使用语境上。我们先围绕正确答案补练，帮助你把这个成语真正吃透。",
    strategyHint: "当前推荐以正确答案中的成语为主，适合在刚看完解析后立即巩固。",
    questionContext: {
      snippet: "在基层治理中，只有把群众提出的每一个细节问题都放在心上，工作推进才能真正做到_____，而不是停留在口号层面。",
      wrongIdiom: "蜻蜓点水",
      correctIdiom: "细致入微",
      tags: ["逻辑填空", "单空题", "成语填空", "基层治理", "错题解析后"]
    },
    recommendations: [
      {
        id: "cp-1",
        title: "先巩固“细致入微”的使用语境",
        idiom: "细致入微",
        reasonTag: "正确成语补练",
        difficulty: "中等",
        etaMinutes: 3,
        questionSnippet: "社区服务想真正做到贴近老人需求，既要有制度安排，也要在日常沟通中体现出_____的关照。",
        knowledgeFocus: "辨清“细致入微”强调观察与照顾周全，而不是泛泛的态度认真。",
        matchSource: "题干与本题正确成语完全一致，适合优先巩固正确答案的典型语境。 "
      },
      {
        id: "cp-2",
        title: "补足“细致入微”与近义表达的边界",
        idiom: "细致入微",
        reasonTag: "正确成语补练",
        difficulty: "中等偏上",
        etaMinutes: 2,
        questionSnippet: "优秀的讲解员不仅熟悉展品信息，还能对观众情绪变化作出_____的回应，让参观过程更有温度。",
        knowledgeFocus: "理解该成语如何和“体贴入微”“一丝不苟”等近义词区分。",
        matchSource: "同样考查“细致入微”的搭配对象和情境边界，能帮助减少记答案式学习。 "
      },
      {
        id: "cp-3",
        title: "通过场景迁移检验掌握程度",
        idiom: "细致入微",
        reasonTag: "正确成语补练",
        difficulty: "中等",
        etaMinutes: 3,
        questionSnippet: "科研管理并不只是流程合规，更需要对实验进度、设备协同和风险提醒做到_____。",
        knowledgeFocus: "把成语迁移到非日常叙事场景，检验是否真正理解其语义核心。",
        matchSource: "同成语跨场景复现，适合验证用户是否能在新语境中稳定识别。 "
      }
    ]
  },
  wrong_option_fallback: {
    id: "wrong_option_fallback",
    strategyType: "wrong",
    strategyTitle: "误选辨析",
    strategyCopy: "当前没有足够的正确项精准题，我们转而围绕你误选的成语来补练，重点帮你分清它真正适用的语境，避免下次再次误判。",
    strategyHint: "这组题会聚焦你刚才误选的成语，帮助你修正对它的含义和感情色彩理解。",
    questionContext: {
      snippet: "在基层治理中，只有把群众提出的每一个细节问题都放在心上，工作推进才能真正做到_____，而不是停留在口号层面。",
      wrongIdiom: "蜻蜓点水",
      correctIdiom: "细致入微",
      tags: ["逻辑填空", "单空题", "成语填空", "基层治理", "错项辨析"]
    },
    recommendations: [
      {
        id: "wf-1",
        title: "先纠正“蜻蜓点水”的误用",
        idiom: "蜻蜓点水",
        reasonTag: "误选成语辨析",
        difficulty: "中等",
        etaMinutes: 3,
        questionSnippet: "面对复杂问题，如果调研只停留在表面、走马观花，就容易流于_____，无法形成真正有效的方案。",
        knowledgeFocus: "明确“蜻蜓点水”常带有浅尝辄止、触及表面的意味，不适合表达深入细致。",
        matchSource: "当前无正确项精准匹配题，因此优先使用用户误选成语进行反向辨析。 "
      },
      {
        id: "wf-2",
        title: "拆开看“浅层接触”和“深入处理”",
        idiom: "蜻蜓点水",
        reasonTag: "误选成语辨析",
        difficulty: "中等偏上",
        etaMinutes: 2,
        questionSnippet: "政策落实如果只是在会议上简单传达、没有跟进反馈，就容易显得_____。",
        knowledgeFocus: "帮助识别这个成语与“细致入微”“深入浅出”等表达在方向上的根本差异。",
        matchSource: "围绕误选成语的核心误区设计，优先修正错误认知。 "
      },
      {
        id: "wf-3",
        title: "看负向语境中的稳定使用",
        idiom: "蜻蜓点水",
        reasonTag: "误选成语辨析",
        difficulty: "基础",
        etaMinutes: 2,
        questionSnippet: "项目复盘不能只是_____，而要把问题拆到执行细节，才有真正的改进价值。",
        knowledgeFocus: "通过负向评价语境强化该成语的情感色彩与典型搭配。",
        matchSource: "同误选成语的典型负向句式，适合快速建立稳定印象。 "
      }
    ]
  },
  same_tag_fallback: {
    id: "same_tag_fallback",
    strategyType: "fallback",
    strategyTitle: "同标签兜底",
    strategyCopy: "当前没有找到足够的成语级精准匹配题，这一组推荐来自同标签逻辑填空题，用来保证你还能继续保持练习节奏。",
    strategyHint: "这是兜底推荐，不代表与本题成语一一对应。页面会明确标注，避免把标签题误认为精准补练。",
    questionContext: {
      snippet: "在基层治理中，只有把群众提出的每一个细节问题都放在心上，工作推进才能真正做到_____，而不是停留在口号层面。",
      wrongIdiom: "蜻蜓点水",
      correctIdiom: "细致入微",
      tags: ["逻辑填空", "单空题", "同标签补练", "基层治理", "兜底推荐"]
    },
    recommendations: [
      {
        id: "sf-1",
        title: "同标签补练：治理语境逻辑填空",
        idiom: "标签兜底",
        reasonTag: "同标签推荐",
        difficulty: "中等",
        etaMinutes: 3,
        questionSnippet: "基层协商要真正解决问题，既需要制度设计，也离不开对居民意见的持续回应与_____。",
        knowledgeFocus: "继续在相近治理语境中训练语感，维持练习连贯性。",
        matchSource: "未命中成语级精准匹配，按同标签逻辑填空进入兜底推荐。 "
      },
      {
        id: "sf-2",
        title: "同标签补练：表达侧重辨析",
        idiom: "标签兜底",
        reasonTag: "同标签推荐",
        difficulty: "中等偏上",
        etaMinutes: 2,
        questionSnippet: "公共服务要提升满意度，关键不在口号新颖，而在执行过程中的持续跟踪与_____。",
        knowledgeFocus: "训练逻辑填空中语义侧重与搭配习惯的判断能力。",
        matchSource: "使用同标签题目承接补练，避免推荐链路中断。 "
      },
      {
        id: "sf-3",
        title: "同标签补练：复盘练习节奏",
        idiom: "标签兜底",
        reasonTag: "同标签推荐",
        difficulty: "基础",
        etaMinutes: 3,
        questionSnippet: "一项政策能否落地，往往取决于末端执行是否具备足够的耐心、回应与_____。",
        knowledgeFocus: "在没有精准题时继续练同类逻辑结构，保证错题后仍有可继续的训练内容。",
        matchSource: "同标签兜底场景，明确标识为延续练习而非成语精准补练。 "
      }
    ]
  }
};

const analyticsQueue = [];

const state = {
  currentScenarioId: "correct_priority",
  drawerOpen: false,
  expandedCardIds: new Set(),
  selectedFeedback: null
};

const strategyTheme = {
  correct: {
    chip: "正确项优先",
    tagClass: "is-correct"
  },
  wrong: {
    chip: "误选辨析",
    tagClass: "is-wrong"
  },
  fallback: {
    chip: "同标签兜底",
    tagClass: "is-fallback"
  }
};

const elements = {
  heroBadge: document.getElementById("hero-badge"),
  heroSubtitle: document.getElementById("hero-subtitle"),
  totalMinutes: document.getElementById("total-minutes"),
  strategyChip: document.getElementById("strategy-chip"),
  questionSnippet: document.getElementById("question-snippet"),
  wrongIdiom: document.getElementById("wrong-idiom"),
  correctIdiom: document.getElementById("correct-idiom"),
  questionTags: document.getElementById("question-tags"),
  strategyTag: document.getElementById("strategy-tag"),
  strategyCopy: document.getElementById("strategy-copy"),
  strategyHint: document.getElementById("strategy-hint"),
  strategyPanel: document.querySelector(".strategy-panel"),
  recommendationCount: document.getElementById("recommendation-count"),
  recommendationList: document.getElementById("recommendation-list"),
  recommendationTemplate: document.getElementById("recommendation-template"),
  actionFeedback: document.getElementById("action-feedback"),
  startButton: document.getElementById("start-button"),
  skipButton: document.getElementById("skip-button"),
  demoToggle: document.getElementById("demo-toggle"),
  demoDrawer: document.getElementById("demo-drawer"),
  demoClose: document.getElementById("demo-close"),
  demoOptions: document.getElementById("demo-options"),
  feedbackButtons: Array.from(document.querySelectorAll("[data-feedback]"))
};

function pushAnalytics(eventName, payload = {}) {
  analyticsQueue.push({
    event: eventName,
    payload,
    timestamp: new Date().toISOString()
  });
  window.analyticsQueue = analyticsQueue;
}

function getScenario() {
  return demoScenarios[state.currentScenarioId];
}

function getTotalMinutes(recommendations) {
  const total = recommendations.reduce((sum, item) => sum + item.etaMinutes, 0);
  return `${total} 分钟`;
}

function getThemeLabel(strategyType) {
  return strategyTheme[strategyType]?.chip || "精准推荐";
}

function renderTags(tags) {
  elements.questionTags.innerHTML = "";
  tags.forEach((tagText) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = tagText;
    elements.questionTags.appendChild(tag);
  });
}

function renderRecommendations(recommendations, strategyType) {
  elements.recommendationList.innerHTML = "";
  recommendations.forEach((item, index) => {
    const fragment = elements.recommendationTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".recommendation-card");
    const reason = fragment.querySelector(".recommendation-card__reason");
    const title = fragment.querySelector(".recommendation-card__title");
    const toggle = fragment.querySelector(".recommendation-card__toggle");
    const chips = fragment.querySelectorAll(".chip");
    const snippet = fragment.querySelector(".recommendation-card__snippet");
    const details = fragment.querySelector(".recommendation-card__details");
    const matchSource = fragment.querySelector(".detail-row__value--match-source");
    const knowledgeFocus = fragment.querySelector(".detail-row__value--knowledge-focus");

    card.dataset.cardId = item.id;
    reason.textContent = item.reasonTag;
    title.textContent = `${index + 1}. ${item.title}`;
    chips[0].textContent = `关联：${item.idiom}`;
    chips[1].textContent = `难度：${item.difficulty}`;
    chips[2].textContent = `预计 ${item.etaMinutes} 分钟`;
    snippet.textContent = item.questionSnippet;
    matchSource.textContent = item.matchSource.trim();
    knowledgeFocus.textContent = item.knowledgeFocus;

    card.classList.add(`recommendation-card--${strategyType}`);

    const expanded = state.expandedCardIds.has(item.id);
    details.hidden = !expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "收起原因" : "查看原因";

    toggle.addEventListener("click", () => {
      const nextExpanded = !state.expandedCardIds.has(item.id);
      if (nextExpanded) {
        state.expandedCardIds.add(item.id);
      } else {
        state.expandedCardIds.delete(item.id);
      }
      pushAnalytics("expand_card", {
        scenarioId: state.currentScenarioId,
        cardId: item.id,
        expanded: nextExpanded
      });
      renderRecommendations(getScenario().recommendations, getScenario().strategyType);
    });

    elements.recommendationList.appendChild(fragment);
  });
}

function renderDemoOptions() {
  const scenarioEntries = [
    {
      id: "correct_priority",
      label: "正确项优先",
      helper: "优先用正确成语补练"
    },
    {
      id: "wrong_option_fallback",
      label: "误选辨析",
      helper: "无精准题时改用误选成语"
    },
    {
      id: "same_tag_fallback",
      label: "同标签兜底",
      helper: "无成语匹配时用同标签题承接"
    }
  ];

  elements.demoOptions.innerHTML = "";
  scenarioEntries.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "demo-option";
    button.textContent = `${entry.label} · ${entry.helper}`;
    button.setAttribute("role", "radio");
    const isActive = state.currentScenarioId === entry.id;
    button.setAttribute("aria-checked", String(isActive));
    if (isActive) {
      button.classList.add("is-active");
    }

    button.addEventListener("click", () => {
      if (state.currentScenarioId === entry.id) {
        return;
      }
      state.currentScenarioId = entry.id;
      state.expandedCardIds.clear();
      state.selectedFeedback = null;
      updateFeedbackButtons();
      setActionFeedback("");
      setDrawerOpen(false);
      pushAnalytics("switch_demo_state", {
        scenarioId: entry.id
      });
      render();
    });

    elements.demoOptions.appendChild(button);
  });
}

function setDrawerOpen(isOpen) {
  state.drawerOpen = isOpen;
  elements.demoDrawer.classList.toggle("is-open", isOpen);
  elements.demoDrawer.setAttribute("aria-hidden", String(!isOpen));
  elements.demoToggle.setAttribute("aria-expanded", String(isOpen));
}

function setActionFeedback(message) {
  elements.actionFeedback.textContent = message;
}

function updateFeedbackButtons() {
  elements.feedbackButtons.forEach((button) => {
    const active = state.selectedFeedback === button.dataset.feedback;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function applyStrategyClasses(strategyType) {
  elements.strategyTag.classList.remove("is-correct", "is-wrong", "is-fallback");
  elements.strategyTag.classList.add(`is-${strategyType}`);
  elements.strategyPanel.dataset.strategy = strategyType;
}

function render() {
  const scenario = getScenario();
  const { questionContext, recommendations, strategyType, strategyTitle, strategyCopy, strategyHint } = scenario;
  const themeLabel = getThemeLabel(strategyType);

  elements.heroBadge.textContent = `${recommendations.length} 题推荐`;
  elements.heroSubtitle.textContent = strategyType === "fallback"
    ? "当前进入同标签兜底推荐，继续保持练习节奏，同时明确标识为非精准成语补练。"
    : "围绕你刚刚答错的成语题做短量补练，帮你把薄弱点补得更准。";
  elements.totalMinutes.textContent = getTotalMinutes(recommendations);
  elements.strategyChip.textContent = themeLabel;
  elements.questionSnippet.textContent = questionContext.snippet;
  elements.wrongIdiom.textContent = questionContext.wrongIdiom;
  elements.correctIdiom.textContent = questionContext.correctIdiom;
  renderTags(questionContext.tags);

  elements.strategyTag.textContent = strategyTitle;
  elements.strategyCopy.textContent = strategyCopy;
  elements.strategyHint.textContent = strategyHint;
  applyStrategyClasses(strategyType);
  elements.recommendationCount.textContent = `${recommendations.length} 道题`;

  renderRecommendations(recommendations, strategyType);
  renderDemoOptions();

  pushAnalytics("view_recommendations", {
    scenarioId: state.currentScenarioId,
    strategyType,
    recommendationCount: recommendations.length
  });
}

function simulateStartPractice() {
  const scenario = getScenario();
  const firstTitle = scenario.recommendations[0]?.title || "推荐练习";
  setActionFeedback(`已进入补练队列，准备从“${firstTitle}”开始。`);
  pushAnalytics("start_practice", {
    scenarioId: state.currentScenarioId,
    recommendationCount: scenario.recommendations.length
  });
}

function simulateSkipRecommendations() {
  const scenario = getScenario();
  const label = scenario.strategyType === "fallback" ? "已跳过本轮同标签补练，稍后仍可从错题本继续进入。" : "已跳过本轮精准补练，系统会保留这组题供你稍后继续。";
  setActionFeedback(label);
  pushAnalytics("skip_recommendations", {
    scenarioId: state.currentScenarioId,
    strategyType: scenario.strategyType
  });
}

function bindEvents() {
  elements.startButton.addEventListener("click", simulateStartPractice);
  elements.skipButton.addEventListener("click", simulateSkipRecommendations);
  elements.demoToggle.addEventListener("click", () => setDrawerOpen(!state.drawerOpen));
  elements.demoClose.addEventListener("click", () => setDrawerOpen(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.drawerOpen) {
      setDrawerOpen(false);
    }
  });

  elements.feedbackButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedFeedback = button.dataset.feedback;
      updateFeedbackButtons();
      const feedbackMap = {
        relevant: "已记录：这组推荐对你有帮助。",
        uncertain: "已记录：你想先看看再决定是否继续。",
        irrelevant: "已记录：这组推荐相关性有待提升。"
      };
      setActionFeedback(feedbackMap[state.selectedFeedback] || "");
      pushAnalytics("feedback_relevance", {
        scenarioId: state.currentScenarioId,
        value: state.selectedFeedback
      });
    });
  });
}

bindEvents();
render();
