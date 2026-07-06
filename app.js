const MODULE_ORDER = ["政治理论", "常识判断", "言语理解", "数量关系", "判断推理", "资料分析"];
const VIEW_ENTRY_GATE = "entryGateView";
const VIEW_HOME = "homeView";
const VIEW_MODULE_REPORT = "moduleReportView";
const VIEW_FOCUS = "focusView";
const VIEW_SETTINGS = "settingsView";
const VIEW_PRACTICE = "practiceView";
const VIEW_ANSWER_SHEET = "answerSheetView";
const VIEW_ANALYSIS = "analysisView";
const VIEW_RESULT = "resultView";
const VIEW_EXPORT = "exportView";
const STORAGE_KEY = "mistake-training-h5-settings-v3";
const PRACTICE_MODE = {
  QUIZ: "quiz",
  MEMORIZE: "memorize",
};

const MODULE_COLORS = {
  政治理论: "#EB8A2F",
  常识判断: "#F19F52",
  言语理解: "#F5B36E",
  数量关系: "#D47728",
  判断推理: "#B85C00",
  资料分析: "#F7C697",
};

const DEFAULT_SETTINGS = {
  practiceMode: PRACTICE_MODE.MEMORIZE,
  questionCount: "10",
  customCount: 12,
  masteryTarget: 2,
};

const DEFAULT_FILTERS = {
  time: "all",
  order: "latest",
  customTimeRange: null,
  randomSeed: null,
};

const SEED_DATA = window.SEED_DATA || { questions: [], moduleCounts: {}, tagCatalog: [] };
const HEADER_BACK_BUTTON = document.getElementById("backButton");
const HEADER_EXPORT_BUTTON = document.getElementById("exportButton");
const HEADER_TITLE = document.getElementById("pageTitle");
const TIME_RANGE_MODAL_ROOT = document.getElementById("timeRangeModalRoot");
const VIEW_IDS = [
  VIEW_ENTRY_GATE,
  VIEW_HOME,
  VIEW_MODULE_REPORT,
  VIEW_FOCUS,
  VIEW_SETTINGS,
  VIEW_PRACTICE,
  VIEW_ANSWER_SHEET,
  VIEW_ANALYSIS,
  VIEW_RESULT,
  VIEW_EXPORT,
];
const EXPORT_ENABLED_VIEWS = new Set([VIEW_HOME, VIEW_MODULE_REPORT, VIEW_FOCUS]);

const TAG_ORDER_INDEX = new Map();
SEED_DATA.tagCatalog.forEach((item, index) => {
  TAG_ORDER_INDEX.set(makeNodeKey(item.module, item.visiblePath || []), index);
});

const QUESTION_BANK = (SEED_DATA.questions || []).map((question, index) => ({
  ...question,
  visiblePath: Array.isArray(question.visiblePath) ? question.visiblePath : [],
  orderIndex: index,
  leafLabel: (question.visiblePath || []).slice(-1)[0] || question.module,
  stemBlocks: buildStemBlocks(question.stemDisplay || question.stem),
}));

const QUESTION_MAP = new Map(QUESTION_BANK.map((question) => [question.id, question]));

let wrongRecords = buildWrongRecords(QUESTION_BANK);
let recordMap = new Map(wrongRecords.map((record) => [record.questionId, record]));

const state = {
  currentView: VIEW_HOME,
  history: [],
  filters: { ...DEFAULT_FILTERS },
  settings: loadSettings(),
  settingsDraft: null,
  expandedKeys: new Set(),
  moduleReport: null,
  exportSelection: new Set(),
  exportPreview: false,
  exportSourceView: VIEW_HOME,
  treeLookups: {
    home: new Map(),
    focus: new Map(),
  },
  session: null,
  analysisIndex: 0,
  analysisMode: "all",
  settingsReturnView: VIEW_HOME,
  timeRangePicker: {
    isOpen: false,
    draftStart: "",
    draftEnd: "",
  },
};

initializeExpandedModules();
wireGlobalEvents();
renderApp();

function loadSettings() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(raw),
    };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
}

function cloneSettings(settings = state.settings) {
  return {
    practiceMode: settings.practiceMode,
    questionCount: settings.questionCount,
    customCount: settings.customCount,
    masteryTarget: settings.masteryTarget,
  };
}

function getSettingsDraftOrSaved() {
  return state.settingsDraft || state.settings;
}

function openSettingsDraft() {
  state.settingsDraft = cloneSettings(state.settings);
}

function discardSettingsDraft() {
  state.settingsDraft = null;
}

function commitSettingsDraft() {
  if (!state.settingsDraft) {
    return;
  }
  state.settings = cloneSettings(state.settingsDraft);
  discardSettingsDraft();
  saveSettings();
}

function buildWrongRecords(questionBank) {
  const anchor = new Date("2026-07-01T09:00:00");
  return questionBank.map((question, index) => {
    const hash = hashString(question.id + question.module + index);
    const wrongCount = 1 + (hash % 4);
    const rewrongCount = hash % 5 === 0 ? 3 : hash % 7 === 0 ? 4 : hash % 3;
    const wrongAddedAt = daysAgo(anchor, (hash % 55) + 2);
    const lastWrongAt = daysAgo(anchor, (hash % 40) + 1);
    const lastPracticedAt = hash % 4 === 0 ? daysAgo(anchor, (hash % 14) + 1) : "";
    return {
      questionId: question.id,
      wrongAddedAt,
      lastWrongAt,
      lastPracticedAt,
      wrongCount,
      rewrongCount,
      masteryCorrectCount: 0,
      consecutiveCorrectCount: 0,
      status: "active",
      isFocus: rewrongCount >= 3 || wrongCount >= 4 || hash % 9 === 0,
    };
  });
}

function initializeExpandedModules() {
  const currentModules = getModuleStats(getVisibleRecords());
  currentModules
    .filter((item, index) => item.count > 0 && index < 2)
    .forEach((item) => state.expandedKeys.add(makeNodeKey(item.module, [])));
}

function wireGlobalEvents() {
  HEADER_BACK_BUTTON.addEventListener("click", goBack);
  HEADER_EXPORT_BUTTON.addEventListener("click", () => {
    if (!EXPORT_ENABLED_VIEWS.has(state.currentView)) {
      return;
    }
    openExportView();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const toggleTrigger = event.target.closest('[data-action="toggle-node"]');
    if (toggleTrigger) {
      event.preventDefault();
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }

    const { action } = target.dataset;
    if (!action) {
      return;
    }

    switch (action) {
      case "go-home":
        navigateTo(VIEW_HOME, { replace: true });
        break;
      case "open-settings":
        state.settingsReturnView = state.currentView;
        openSettingsDraft();
        navigateTo(VIEW_SETTINGS);
        break;
      case "open-module-report":
        state.moduleReport = target.dataset.module || null;
        navigateTo(VIEW_MODULE_REPORT);
        break;
      case "open-focus":
        navigateTo(VIEW_FOCUS);
        break;
      case "toggle-node":
        target.blur();
        toggleNode(target.dataset.key || "", target);
        break;
      case "start-node":
        startFromTreeNode(target.dataset.tree, target.dataset.key);
        break;
      case "open-home-module":
        openHomeModule(target.dataset.module || "");
        break;
      case "start-all":
        startPracticeSession({
          sourceType: "all",
          sourceTree: "home",
          sourceLabel: "全模块混合训练",
          nodePath: [],
          questionIds: getVisibleRecords().map((record) => record.questionId),
        });
        break;
      case "start-focus":
        startPracticeSession({
          sourceType: "focus",
          sourceTree: "focus",
          sourceLabel: "重点复练池",
          nodePath: [],
          questionIds: getFocusRecords().map((record) => record.questionId),
        });
        break;
      case "set-practice-mode":
        if (!state.settingsDraft) {
          openSettingsDraft();
        }
        state.settingsDraft.practiceMode = target.dataset.mode === PRACTICE_MODE.QUIZ ? PRACTICE_MODE.QUIZ : PRACTICE_MODE.MEMORIZE;
        renderApp();
        break;
      case "set-question-count":
        if (!state.settingsDraft) {
          openSettingsDraft();
        }
        state.settingsDraft.questionCount = target.dataset.value || "10";
        renderApp();
        break;
      case "set-mastery-target":
        if (!state.settingsDraft) {
          openSettingsDraft();
        }
        state.settingsDraft.masteryTarget = Math.min(3, Math.max(1, Number(target.dataset.value) || 2));
        renderApp();
        break;
      case "save-settings":
        commitSettingsDraft();
        navigateTo(state.settingsReturnView || VIEW_HOME, { replace: true });
        break;
      case "cancel-time-range":
        closeTimeRangePicker();
        break;
      case "confirm-time-range":
        applyCustomTimeRange();
        break;
      case "answer-option":
        handleAnswerSelection(Number(target.dataset.questionIndex), Number(target.dataset.optionIndex));
        break;
      case "open-answer-sheet":
        navigateTo(VIEW_ANSWER_SHEET);
        break;
      case "jump-question":
        jumpToQuestion(Number(target.dataset.questionIndex));
        break;
      case "submit-quiz":
        finalizeSession();
        navigateTo(VIEW_RESULT);
        break;
      case "next-memorize":
        advanceMemorizeQuestion();
        break;
      case "submit-memorize":
        finalizeSession();
        navigateTo(VIEW_RESULT);
        break;
      case "view-analysis":
        state.analysisMode = "all";
        state.analysisIndex = 0;
        navigateTo(VIEW_ANALYSIS);
        break;
      case "view-wrong-analysis":
        if (!state.session?.report?.wrongQuestionIds?.length) {
          return;
        }
        state.analysisMode = "wrongOnly";
        state.analysisIndex = 0;
        navigateTo(VIEW_ANALYSIS);
        break;
      case "analysis-prev":
        state.analysisIndex = Math.max(0, state.analysisIndex - 1);
        renderApp();
        break;
      case "analysis-next":
        state.analysisIndex = Math.min(getAnalysisQuestions().length - 1, state.analysisIndex + 1);
        renderApp();
        break;
      case "return-report":
        navigateTo(VIEW_RESULT);
        break;
      case "toggle-focus-question":
        toggleFocusQuestion(target.dataset.questionId || "");
        break;
      case "diagnose-question":
        handleDiagnosisAction(target.dataset.questionId || "");
        break;
      case "same-knowledge":
        openSpecialTraining(target.dataset.questionId || "");
        break;
      case "start-same-knowledge-node":
        startSameKnowledgeTrainingFromNode(target.dataset.key || "");
        break;
      case "adjust-settings":
        state.settingsReturnView = VIEW_RESULT;
        openSettingsDraft();
        navigateTo(VIEW_SETTINGS);
        break;
      case "return-tree":
        returnToKnowledgeTree();
        break;
      case "return-home":
        if (state.session?.kind === "special" && state.session.specialOrigin) {
          state.session.specialOrigin = null;
        }
        state.history = [];
        navigateTo(VIEW_HOME, { replace: true });
        break;
      case "return-special-origin":
        restoreSpecialOrigin();
        break;
      case "export-toggle":
        toggleExportSelection(target.dataset.questionId || "");
        break;
      case "export-toggle-all":
        toggleExportAll();
        break;
      case "export-preview":
        state.exportPreview = true;
        renderApp();
        break;
      case "export-print":
        window.print();
        break;
      default:
        break;
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    const action = target.dataset.action;
    if (!action) {
      return;
    }

    switch (action) {
      case "change-time-filter":
        if ((target.value || "all") === "custom") {
          openTimeRangePicker();
          break;
        }
        state.filters.time = target.value || "all";
        renderApp();
        break;
      case "change-order-filter":
        updateOrderFilter(target.value || "latest");
        renderApp();
        break;
      case "change-custom-count":
        if (!state.settingsDraft) {
          openSettingsDraft();
        }
        state.settingsDraft.customCount = Math.max(1, Math.min(50, Number(target.value) || 1));
        renderApp();
        break;
      case "change-time-range-start":
        state.timeRangePicker.draftStart = target.value || "";
        renderTimeRangeModal();
        break;
      case "change-time-range-end":
        state.timeRangePicker.draftEnd = target.value || "";
        renderTimeRangeModal();
        break;
      default:
        break;
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    const action = target.dataset.action;
    if (action !== "change-custom-count") {
      return;
    }
    if (!state.settingsDraft) {
      openSettingsDraft();
    }
    state.settingsDraft.customCount = Math.max(1, Math.min(50, Number(target.value) || 1));
    renderApp();
  });
}

function renderApp() {
  refreshRecordMap();
  renderHeader();
  renderEntryGateView();
  renderHomeView();
  renderModuleReportView();
  renderFocusView();
  renderSettingsView();
  renderPracticeView();
  renderAnswerSheetView();
  renderAnalysisView();
  renderResultView();
  renderExportView();
  renderTimeRangeModal();

  VIEW_IDS.forEach((viewId) => {
    const element = document.getElementById(viewId);
    element.classList.toggle("is-active", viewId === state.currentView);
  });
}

function renderHeader() {
  const pageMeta = getPageMeta();
  HEADER_TITLE.textContent = pageMeta.title;
  HEADER_BACK_BUTTON.classList.toggle("is-hidden", !pageMeta.showBack);
  HEADER_EXPORT_BUTTON.classList.toggle("is-hidden", !pageMeta.showExport);
}

function getPageMetaLegacy() {
  switch (state.currentView) {
    case VIEW_MODULE_REPORT:
      return {
        title: "模块报告",
        showBack: true,
        showExport: true,
      };
    case VIEW_FOCUS:
      return {
        title: "重点复练",
        showBack: true,
        showExport: true,
      };
    case VIEW_SETTINGS:
      return {
        title: "训练设置",
        showBack: true,
        showExport: false,
      };
    case VIEW_PRACTICE:
      return {
        title: state.session?.mode === PRACTICE_MODE.QUIZ ? "做题模式" : "背题模式",
        showBack: true,
        showExport: false,
      };
    case VIEW_ANSWER_SHEET:
      return {
        title: "答题卡",
        showBack: true,
        showExport: false,
      };
    case VIEW_ANALYSIS:
      return {
        title: "逐题解析",
        showBack: true,
        showExport: false,
      };
    case VIEW_RESULT:
      return {
        title: "练习报告",
        showBack: true,
        showExport: false,
      };
    case VIEW_EXPORT:
      return {
        title: "导出 PDF",
        showBack: true,
        showExport: false,
      };
    case VIEW_HOME:
    default:
      return {
        title: "错题训练",
        showBack: false,
        showExport: true,
      };
  }
}

function navigateTo(viewId, options = {}) {
  const { replace = false, scrollToTop = true } = options;
  if (state.currentView === VIEW_SETTINGS && viewId !== VIEW_SETTINGS) {
    discardSettingsDraft();
  }
  if (state.currentView !== viewId && !replace) {
    state.history.push(state.currentView);
  }
  state.currentView = viewId;
  renderApp();
  if (scrollToTop) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function goBackLegacy() {
  if (!state.history.length) {
    return;
  }
  state.currentView = state.history.pop();
  renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderHomeViewLegacy() {
  const container = document.getElementById(VIEW_HOME);
  const records = getVisibleRecords();
  const moduleStats = getModuleStats(records);
  const focusRecords = getFocusRecords(records);
  const recommendations = getRecommendedModules(moduleStats);
  const { roots, lookup } = buildKnowledgeTree(records);
  state.treeLookups.home = lookup;

  container.innerHTML = `
    <section class="chart-card hero-chart">
      <h2 class="chart-title">错题报告</h2>
      ${renderPiePanel({
        title: "全行测错题统计",
        data: moduleStats,
        total: records.length,
        centerCaption: "当前错题",
        rightAction: `
          <button class="focus-button" type="button" data-action="open-focus">
            <span>重点复练</span>
            <strong>${focusRecords.length} 道</strong>
          </button>
        `,
      })}
      <div class="button-grid">
        ${MODULE_ORDER.map((module) => {
          const moduleRecordCount = moduleStats.find((item) => item.module === module)?.count || 0;
          const stubbornCount = getStubbornCount(records.filter((record) => getQuestion(record.questionId)?.module === module));
          return `
            <button class="module-button" type="button" data-action="open-module-report" data-module="${module}">
              <span>
                <strong>${escapeHTML(module)}</strong>
                <span>错题 ${moduleRecordCount} 道${stubbornCount ? ` / 顽固 ${stubbornCount} 道` : ""}</span>
              </span>
            </button>
          `;
        }).join("")}
      </div>
      <div class="summary-panel stack">
        <div class="tree-header">
          <h3 class="section-title small">重点复练推荐</h3>
          <span class="caption">点击后进入对应模块知识树</span>
        </div>
        <div class="recommend-list">
          ${recommendations.map((item) => `
            <button class="recommend-button" type="button" data-action="open-home-module" data-module="${item.module}">
              <span class="recommend-copy">
                <strong>${escapeHTML(item.module)}</strong>
                <span>错题最多的优先复练模块</span>
              </span>
              <span class="legend-value">${item.count} 道</span>
            </button>
          `).join("")}
        </div>
      </div>
    </section>
    ${renderFilterStrip()}
    <section class="panel">
      <div class="tree-header">
        <h2 class="section-title">知识树选练</h2>
        <span class="caption">箭头只展开，右侧道数直接开练</span>
      </div>
      ${roots.length ? renderTree(roots, "home") : renderEmptyState("当前筛选下暂无待练错题", "调整录入时间，或先去错题报告看看其他模块。")}
      ${renderStubbornNote(records)}
    </section>
    <div class="cta-stack">
      <button class="primary-button" type="button" data-action="start-all">开始复练全部错题</button>
      <p class="note-text">ⓘ此模式下，全模块错题随机混合训练</p>
    </div>
  `;
}

function renderModuleReportView() {
  const container = document.getElementById(VIEW_MODULE_REPORT);
  const module = state.moduleReport;
  if (!module) {
    container.innerHTML = renderEmptyState("还没有选中模块", "从首页点击模块入口后，会进入对应的错题报告。");
    return;
  }

  const overallRecords = getVisibleRecords();
  const moduleRecords = overallRecords.filter((record) => getQuestion(record.questionId)?.module === module);
  const overallStats = getModuleStats(overallRecords);
  const tagStats = getModuleTagStats(moduleRecords);
  const recommendations = getRecommendedModules(overallStats);

  container.innerHTML = `
    ${renderFilterStrip()}
    <section class="chart-card hero-chart">
      <h2 class="chart-title">全行测按模块分布</h2>
      ${renderPiePanel({
        title: "全行测错题统计",
        data: overallStats,
        total: overallRecords.length,
        centerCaption: "当前错题",
      })}
    </section>
    <section class="chart-card hero-chart">
      <div class="tree-header">
        <h2 class="chart-title">该模块按标签分布</h2>
        <span class="caption">${escapeHTML(module)}</span>
      </div>
      ${tagStats.length
        ? renderPiePanel({
            title: `${module} 鏍囩鍒嗗竷`,
            data: tagStats,
            total: moduleRecords.length,
            centerCaption: `${module} 错题`,
          })
        : renderEmptyState("这个模块当前没有待练错题", "回到首页切换其他模块，或者试试重点复练。")}
      <div class="recommend-list">
        ${recommendations.map((item) => `
          <button class="recommend-button" type="button" data-action="open-home-module" data-module="${item.module}">
            <span class="recommend-copy">
              <strong>${escapeHTML(item.module)}</strong>
              <span>错题高发模块，先回知识树挑范围/span>
            </span>
            <span class="legend-value">${item.count} 道</span>
          </button>
        `).join("")}
      </div>
      <div class="single-action">
        <button class="secondary-button" type="button" data-action="open-home-module" data-module="${module}">
          进入该模块知识树
        </button>
      </div>
    </section>
  `;
}

function renderFocusViewLegacy() {
  const container = document.getElementById(VIEW_FOCUS);
  const focusRecords = getFocusRecords();
  const moduleStats = getModuleStats(focusRecords);
  const { roots, lookup } = buildKnowledgeTree(focusRecords);
  state.treeLookups.focus = lookup;

  container.innerHTML = `
    <section class="panel">
      <div class="tree-header">
        <h2 class="section-title">重点复练池/h2>
        <span class="caption">错频高、顽固错题和手动加入会汇总到这里</span>
      </div>
      <div class="status-strip">
        <span>当前重点复练题数</span>
        <strong>${focusRecords.length} 道</strong>
      </div>
    </section>
    ${renderFilterStrip()}
    <section class="chart-card hero-chart">
      <h2 class="chart-title">重点复练按模块分布/h2>
      ${moduleStats.length
        ? renderPiePanel({
            title: "重点复练统计",
            data: moduleStats,
            total: focusRecords.length,
            centerCaption: "重点复练",
          })
        : renderEmptyState("还没有重点复练题", "做错累计达到 3 次，或手动加入后会进入这里。")}
    </section>
    <section class="panel">
      <div class="tree-header">
        <h2 class="section-title">按知识树挑范围/h2>
        <span class="caption">页面仍按知识树组织，不平铺题目/span>
      </div>
      ${roots.length ? renderTree(roots, "focus") : renderEmptyState("当前重点复练池为空", "先在解析页点击“加入重点复练”，或者继续错题复练。")}
      ${renderStubbornNote(focusRecords)}
    </section>
  `;
}

function renderSettingsView() {
  const container = document.getElementById(VIEW_SETTINGS);
  const settingsViewModel = getSettingsDraftOrSaved();
  const isCustom = settingsViewModel.questionCount === "custom";
  const practiceModeRule = getPracticeModeRule(settingsViewModel);
  container.innerHTML = `
    <section class="settings-card settings-section">
      <div>
        <h2 class="settings-block-title">刷题模式</h2>
        <p class="caption">默认记住你上次的选择。</p>
        <div class="segmented">
          <button type="button" data-action="set-practice-mode" data-mode="${PRACTICE_MODE.MEMORIZE}" class="${settingsViewModel.practiceMode === PRACTICE_MODE.MEMORIZE ? "is-selected" : ""}">
            背题模式
          </button>
          <button type="button" data-action="set-practice-mode" data-mode="${PRACTICE_MODE.QUIZ}" class="${settingsViewModel.practiceMode === PRACTICE_MODE.QUIZ ? "is-selected" : ""}">
            做题模式
          </button>
        </div>
        <div class="mode-rule-flow" aria-label="当前模式规则">
          ${practiceModeRule.map((label) => `<span class="mode-step">${label}</span>`).join('<span class="mode-arrow" aria-hidden="true">→</span>')}
        </div>
      </div>
      <div>
        <h3 class="settings-block-title">题量设置</h3>
        <div class="segmented four">
          ${[
            { label: "5题", value: "5" },
            { label: "10题", value: "10" },
            { label: "全部", value: "all" },
            { label: "自定义", value: "custom" },
          ].map((item) => `
            <button type="button" data-action="set-question-count" data-value="${item.value}" class="${settingsViewModel.questionCount === item.value ? "is-selected" : ""}">
              ${item.label}
            </button>
          `).join("")}
        </div>
        ${isCustom ? `
          <div class="stack stack-top-gap">
            <input
              class="inline-input"
              type="number"
              min="1"
              max="50"
              value="${settingsViewModel.customCount}"
              data-action="change-custom-count"
              placeholder="输入题量"
            />
            <span class="caption">篇章阅读 &gt; 普通篇章按完整材料组取数，不拆开推送。</span>
          </div>
        ` : ""}
      </div>
      <div>
        <h3 class="settings-block-title">累计做对出库次数</h3>
        <div class="segmented three">
          ${[1, 2, 3].map((value) => `
            <button type="button" data-action="set-mastery-target" data-value="${value}" class="${settingsViewModel.masteryTarget === value ? "is-selected" : ""}">
              累计做对 ${value} 次
            </button>
          `).join("")}
        </div>
      </div>
      <div class="summary-panel stack">
        <div class="summary-row">
          <span>当前刷题模式</span>
          <strong>${settingsViewModel.practiceMode === PRACTICE_MODE.QUIZ ? "做题模式" : "背题模式"}</strong>
        </div>
        <div class="summary-row">
          <span>当前题量</span>
          <strong>${formatQuestionCountLabel(settingsViewModel)}</strong>
        </div>
        <div class="summary-row">
          <span>出库规则</span>
          <strong>累计做对 ${settingsViewModel.masteryTarget} 次</strong>
        </div>
      </div>
      <button class="primary-button settings-save-button" type="button" data-action="save-settings">完成</button>
    </section>
  `;
}

function renderPracticeView() {
  const container = document.getElementById(VIEW_PRACTICE);
  const session = state.session;
  if (!session) {
    container.innerHTML = renderEmptyState("还没有开始练题", "从知识树、重点复练或全模块混练入口开始。");
    return;
  }

  const question = session.questions[session.currentIndex];
  if (!question) {
    container.innerHTML = renderEmptyState("当前题目不存在", "返回知识树重新发起练习。");
    return;
  }

  const selected = session.answers[question.id];
  const answered = Number.isInteger(selected);
  const isQuizMode = session.mode === PRACTICE_MODE.QUIZ;
  container.innerHTML = renderRefinedPracticeCard({ session, question, selected, answered, isQuizMode });
}

function renderRefinedPracticeCard({ session, question, selected, answered, isQuizMode }) {
  const breadcrumb = escapeHTML([question.module].concat(question.visiblePath).join(" / "));
  const typeLabel = escapeHTML(question.questionType || "单选题");
  const submitLabel = session.currentIndex === session.questions.length - 1 ? "交卷并看报告" : "下一题";

  return `
    <section class="question-card question-card-refined">
      <div class="status-strip">
        <span>${session.kind === "special" ? "相同知识点练习" : isQuizMode ? "做题模式" : "背题模式"}</span>
        <strong>第 ${session.currentIndex + 1} / ${session.questions.length} 题</strong>
      </div>
      <div class="question-breadcrumb">${breadcrumb}</div>
      <div class="question-refined-head">
        <span class="question-type-chip">${typeLabel}</span>
      </div>
      ${question.isVirtual ? `
        <div class="virtual-question-note">
          <strong>虚拟题占位</strong>
          <span>当前知识点样本题不足 5 题，本题仅用于补满本组练习，不写入错题池与重点复练池。</span>
        </div>
      ` : ""}
      ${renderQuestionStem(question, "question-stem question-stem-refined")}
      <div class="option-list option-list-refined">
        ${question.options.map((option, optionIndex) => {
          const optionClass = getOptionClass({ mode: session.mode, question, selected, optionIndex });
          return `
            <button
              class="option-button option-button-refined ${optionClass}"
              type="button"
              data-action="answer-option"
              data-question-index="${session.currentIndex}"
              data-option-index="${optionIndex}"
            >
              <span class="option-mark option-mark-refined">${String.fromCharCode(65 + optionIndex)}</span>
              <span class="option-copy">${escapeHTML(option)}</span>
            </button>
          `;
        }).join("")}
      </div>
      ${session.mode === PRACTICE_MODE.MEMORIZE && answered ? renderInlineAnalysisPanel(question, selected) : ""}
      <div class="practice-actions">
        ${session.mode === PRACTICE_MODE.MEMORIZE ? renderPracticeAnalysisActions(question) : ""}
        <div class="single-action">
          ${session.mode === PRACTICE_MODE.MEMORIZE
            ? `<button class="primary-button" type="button" data-action="${session.currentIndex === session.questions.length - 1 ? "submit-memorize" : "next-memorize"}">${submitLabel}</button>`
            : `<button class="secondary-button muted" type="button" data-action="open-answer-sheet">查看答题卡</button>`}
        </div>
      </div>
    </section>
  `;
}

function renderInlineAnalysisPanel(question, selectedOption) {
  const correct = question.answerIndex;
  return `
    <div class="analysis-panel-inline">
      <div class="analysis-answer-row">
        <span>你的答案：${Number.isInteger(selectedOption) ? String.fromCharCode(65 + selectedOption) : "未作答"}</span>
        <span>正确答案：${String.fromCharCode(65 + correct)}</span>
      </div>
      <div class="analysis-inline-copy html-content">${sanitizeAnalysisHtml(question.analysis)}</div>
    </div>
  `;
}

function renderQuestionStem(question, className = "question-stem") {
  const blocks = Array.isArray(question.stemBlocks) && question.stemBlocks.length
    ? question.stemBlocks
    : [String(question.stem || "")];
  return `
    <div class="${className}">
      ${blocks.map((block) => `<p>${escapeHTML(block)}</p>`).join("")}
    </div>
  `;
}

function renderAnswerSheetView() {
  const container = document.getElementById(VIEW_ANSWER_SHEET);
  const session = state.session;
  if (!session) {
    container.innerHTML = renderEmptyState("还没有生成答题卡", "做题模式答完全部题目后，会来到这里交卷。");
    return;
  }

  const answeredCount = session.questions.filter((question) => Number.isInteger(session.answers[question.id])).length;
  container.innerHTML = `
    <section class="panel stack">
      <h2 class="section-title">答题卡</h2>
      <div class="summary-row">
        <span>已答题数</span>
        <strong>${answeredCount} / ${session.questions.length}</strong>
      </div>
      <div class="sheet-grid">
        ${session.questions.map((question, index) => `
          <button
            class="sheet-cell ${Number.isInteger(session.answers[question.id]) ? "is-answered" : ""} ${index === session.currentIndex ? "is-current" : ""}"
            type="button"
            data-action="jump-question"
            data-question-index="${index}"
          >
            ${index + 1}
          </button>
        `).join("")}
      </div>
      <p class="caption">点数字可回到对应题目检查。确认后交卷，再统一看练习报告与解析。</p>
      <div class="button-row">
        <button class="secondary-button" type="button" data-action="jump-question" data-question-index="${session.currentIndex}">
          回到当前题
        </button>
        <button class="primary-button" type="button" data-action="submit-quiz">
          交卷
        </button>
      </div>
    </section>
  `;
}

function renderAnalysisView() {
  const container = document.getElementById(VIEW_ANALYSIS);
  const session = state.session;
  const analysisQuestions = getAnalysisQuestions();
  if (!session || session.mode !== PRACTICE_MODE.QUIZ || !session.report || !analysisQuestions.length) {
    container.innerHTML = renderEmptyState("当前没有逐题解析", "做题模式交卷后，才会按顺序进入这里复盘。");
    return;
  }

  state.analysisIndex = Math.max(0, Math.min(analysisQuestions.length - 1, state.analysisIndex));
  const question = analysisQuestions[state.analysisIndex];
  const selected = session.answers[question.id];
  const titleLabel = state.analysisMode === "wrongOnly" ? "错题解析" : "逐题解析";
  const leftAction = state.analysisIndex === 0 ? "return-report" : "analysis-prev";
  const rightAction = state.analysisIndex === analysisQuestions.length - 1 ? "return-report" : "analysis-next";
  const leftLabel = state.analysisIndex === 0 ? "回到报告页" : "上一题";
  const rightLabel = state.analysisIndex === analysisQuestions.length - 1 ? "回到报告页" : "下一题";

  container.innerHTML = `
    <section class="question-card question-card-refined">
      <div class="status-strip">
        <span>${titleLabel}</span>
        <strong>第 ${state.analysisIndex + 1} / ${analysisQuestions.length} 题</strong>
      </div>
      <div class="question-breadcrumb">${escapeHTML([question.module].concat(question.visiblePath).join(" / "))}</div>
      <div class="question-refined-head">
        <span class="question-type-chip">${escapeHTML(question.questionType || "单选题")}</span>
      </div>
      ${renderQuestionStem(question, "question-stem question-stem-refined")}
      <div class="option-list option-list-refined">
        ${question.options.map((option, optionIndex) => `
          <div class="option-button option-button-refined ${getReviewOptionClass(question, selected, optionIndex)}">
            <span class="option-mark option-mark-refined">${String.fromCharCode(65 + optionIndex)}</span>
            <span class="option-copy">${escapeHTML(option)}</span>
          </div>
        `).join("")}
      </div>
      ${renderInlineAnalysisPanel(question, selected)}
      ${renderPracticeAnalysisActions(question)}
      <div class="button-row button-row-top">
        <button class="secondary-button" type="button" data-action="${leftAction}">
          ${leftLabel}
        </button>
        <button class="primary-button" type="button" data-action="${rightAction}">
          ${rightLabel}
        </button>
      </div>
    </section>
  `;
}

function renderResultView() {
  const container = document.getElementById(VIEW_RESULT);
  const session = state.session;
  const report = state.session?.report;
  if (!report) {
    container.innerHTML = renderEmptyState("还没有练习报告", "完成一次错题训练后，这里会回到清晰的结果反馈。");
    return;
  }

  if (session?.kind === "special") {
    container.innerHTML = renderSpecialResultView(report);
    return;
  }

  const knowledgeTree = buildSameKnowledgeTree(session.questions);
  state.treeLookups.sameKnowledgeReport = knowledgeTree.lookup;

  if (session?.mode === PRACTICE_MODE.MEMORIZE) {
    container.innerHTML = renderMemorizeResultView(report, knowledgeTree.roots);
    return;
  }

  container.innerHTML = renderQuizResultView(report, knowledgeTree.roots);
}

function renderMemorizeResultView(report, knowledgeRoots) {
  const resultStats = [
    { label: "已掌握", caption: "本次做对", count: report.correct, color: "#1f7a48" },
    { label: "未掌握", caption: "本次做错", count: report.stillWrong, color: "#b63d21" },
  ].filter((item) => item.count > 0);

  return `
    <section class="result-card">
      <h2 class="panel-title result-panel-title">练习报告</h2>
      <div class="chart-card result-pie-card">
        <div class="chart-shell result-chart-shell">
          <div class="chart-wrap result-chart-wrap">
            ${renderStatusPieSvg(resultStats, 168)}
            <div class="chart-center">
              <strong class="chart-total">${report.accuracy}%</strong>
              <span class="caption">本次正确率</span>
            </div>
          </div>
          <div class="chart-legend result-chart-legend">
            ${resultStats.map((item) => `
              <div class="legend-item">
                <span class="legend-dot" style="color: ${item.color}"></span>
                <span class="legend-label">${escapeHTML(item.label)}（${escapeHTML(item.caption)}）</span>
                <span class="legend-value">${item.count} 道</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
      <section class="panel same-knowledge-report-card">
        <h3 class="same-knowledge-title">练习相同知识点题目</h3>
        <div class="same-knowledge-tree">
          ${knowledgeRoots.length ? renderSameKnowledgeTree(knowledgeRoots) : renderEmptyState("当前没有可继续练习的知识点", "完成更多错题训练后，会在这里聚合同知识点入口。")}
        </div>
      </section>
      <div class="result-actions">
        <div class="button-row">
          <button class="secondary-button" type="button" data-action="return-home">回到首页</button>
          <button class="primary-button" type="button" data-action="adjust-settings">调整设置</button>
        </div>
      </div>
    </section>
  `;
}

function renderQuizResultView(report, knowledgeRoots) {
  const resultStats = [
    { label: "已掌握", caption: "本次做对", count: report.correct, color: "#1f7a48" },
    { label: "未掌握", caption: "本次做错", count: report.stillWrong, color: "#b63d21" },
  ].filter((item) => item.count > 0);
  const wrongDisabled = !report.wrongQuestionIds?.length;

  return `
    <section class="result-card">
      <h2 class="panel-title result-panel-title">练习报告</h2>
      <div class="chart-card result-pie-card">
        <div class="chart-shell result-chart-shell">
          <div class="chart-wrap result-chart-wrap">
            ${renderStatusPieSvg(resultStats, 168)}
            <div class="chart-center">
              <strong class="chart-total">${report.accuracy}%</strong>
              <span class="caption">本次正确率</span>
            </div>
          </div>
          <div class="chart-legend result-chart-legend">
            ${resultStats.map((item) => `
              <div class="legend-item">
                <span class="legend-dot" style="color: ${item.color}"></span>
                <span class="legend-label">${escapeHTML(item.label)}（${escapeHTML(item.caption)}）</span>
                <span class="legend-value">${item.count} 道</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="result-actions result-actions-top">
        <div class="button-row">
          <button class="secondary-button" type="button" data-action="view-analysis">逐题解析</button>
          <button class="secondary-button" type="button" data-action="view-wrong-analysis" ${wrongDisabled ? "disabled" : ""}>错题解析</button>
        </div>
      </div>
      <section class="panel same-knowledge-report-card">
        <h3 class="same-knowledge-title">练习相同知识点题目</h3>
        <div class="same-knowledge-tree">
          ${knowledgeRoots.length ? renderSameKnowledgeTree(knowledgeRoots) : renderEmptyState("当前没有可继续练习的知识点", "完成更多错题训练后，会在这里聚合同知识点入口。")}
        </div>
      </section>
      <div class="result-actions">
        <div class="button-row">
          <button class="secondary-button" type="button" data-action="return-home">回到首页</button>
          <button class="primary-button" type="button" data-action="adjust-settings">调整设置</button>
        </div>
      </div>
    </section>
  `;
}

function renderSpecialResultView(report) {
  const resultStats = [
    { label: "已掌握", caption: "本次做对", count: report.correct, color: "#1f7a48" },
    { label: "未掌握", caption: "本次做错", count: report.stillWrong, color: "#b63d21" },
  ].filter((item) => item.count > 0);

  return `
    <section class="result-card">
      <h2 class="panel-title result-panel-title">练习报告</h2>
      <div class="chart-card result-pie-card">
        <div class="chart-shell result-chart-shell">
          <div class="chart-wrap result-chart-wrap">
            ${renderStatusPieSvg(resultStats, 168)}
            <div class="chart-center">
              <strong class="chart-total">${report.accuracy}%</strong>
              <span class="caption">本次正确率</span>
            </div>
          </div>
          <div class="chart-legend result-chart-legend">
            ${resultStats.map((item) => `
              <div class="legend-item">
                <span class="legend-dot" style="color: ${item.color}"></span>
                <span class="legend-label">${escapeHTML(item.label)}（${escapeHTML(item.caption)}）</span>
                <span class="legend-value">${item.count} 道</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="result-actions">
        <div class="button-row">
          <button class="secondary-button" type="button" data-action="return-special-origin">返回训练页</button>
          <button class="primary-button" type="button" data-action="return-home">返回首页</button>
        </div>
      </div>
    </section>
  `;
}

function renderStatusPieSvg(data, size) {
  if (!data.length) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 12}" fill="#fff" stroke="#efcfb0" stroke-width="2"></circle>
      </svg>
    `;
  }

  const radius = size / 2 - 12;
  const center = size / 2;
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let startAngle = -Math.PI / 2;

  const segments = data.map((item) => {
    const currentStart = startAngle;
    const ratio = item.count / total;
    const endAngle = currentStart + ratio * Math.PI * 2;
    const path = describeArcSlice(center, center, radius, currentStart, endAngle);
    const midAngle = currentStart + (endAngle - currentStart) / 2;
    const showLabel = ratio >= 0.08;
    const labelPoint = showLabel ? polarToCartesian(center, center, radius * 0.76, midAngle) : null;
    const labelMarkup = showLabel
      ? `<text x="${labelPoint.x.toFixed(2)}" y="${labelPoint.y.toFixed(2)}" class="pie-percent-label" text-anchor="middle" dominant-baseline="central">${Math.round(ratio * 100)}%</text>`
      : "";
    startAngle = endAngle;
    return `
      <g>
        <path d="${path}" fill="${colorWithAlpha(item.color, 0.14)}" stroke="${item.color}" stroke-width="1.5"></path>
        ${labelMarkup}
      </g>
    `;
  });

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="#ffffff" stroke="#efcfb0" stroke-width="1.5"></circle>
      ${segments.join("")}
      <circle cx="${center}" cy="${center}" r="${radius * 0.46}" fill="#fffaf5" stroke="#efcfb0" stroke-width="1.5"></circle>
    </svg>
  `;
}

function renderExportView() {
  const container = document.getElementById(VIEW_EXPORT);
  const activeQuestions = getExportSourceRecords().map((record) => getQuestion(record.questionId)).filter(Boolean);
  const selectedQuestions = activeQuestions.filter((question) => state.exportSelection.has(question.id));
  container.innerHTML = `
    <section class="export-card">
      <div class="tree-header">
        <h2 class="section-title">自选题目导出</h2>
        <span class="caption">生成带水印的 PDF 预览，再下载保存</span>
      </div>
      <div class="button-row button-row-bottom">
        <button class="secondary-button" type="button" data-action="export-toggle-all">
          ${selectedQuestions.length === activeQuestions.length && activeQuestions.length ? "取消全选" : "全选当前错题"}
        </button>
        <button class="primary-button" type="button" data-action="export-preview">
          生成预览
        </button>
      </div>
      <div class="summary-row">
        <span>已选择</span>
        <strong>${selectedQuestions.length} / ${activeQuestions.length}</strong>
      </div>
      <div class="export-list export-list-top">
        ${activeQuestions.map((question) => `
          <label class="check-row">
            <input type="checkbox" data-action="export-toggle" data-question-id="${question.id}" ${state.exportSelection.has(question.id) ? "checked" : ""} />
            <span>
              <strong>${escapeHTML(question.stem)}</strong>
              <span class="caption">${escapeHTML([question.module].concat(question.visiblePath).join(" / "))}</span>
            </span>
          </label>
        `).join("")}
      </div>
    </section>
    ${state.exportPreview ? renderExportPreview(selectedQuestions) : ""}
  `;
}

function renderExportPreview(selectedQuestions) {
  if (!selectedQuestions.length) {
    return renderEmptyState("还没有选中题目", "先勾选要导出的错题，再生成 PDF 预览。");
  }

  const previewQuestions = selectedQuestions.slice(0, 6);
  return `
    <section class="export-card">
      <h2 class="section-title">PDF 预览</h2>
      <div class="export-preview">
        <div class="watermark">错题训练导出 仅原型演示</div>
        ${previewQuestions.map((question, index) => `
          <article class="preview-question">
            <h4>${index + 1}. ${escapeHTML(question.stem)}</h4>
            <p class="caption">${escapeHTML([question.module].concat(question.visiblePath).join(" / "))}</p>
            <ul>
              ${question.options.map((option) => `<li>${escapeHTML(option)}</li>`).join("")}
            </ul>
          </article>
        `).join("")}
        ${selectedQuestions.length > previewQuestions.length ? `<p class="caption caption-spaced">其余 ${selectedQuestions.length - previewQuestions.length} 题已收纳到导出列表中。</p>` : ""}
      </div>
      <div class="export-actions">
        <button class="primary-button" type="button" data-action="export-print">下载 PDF</button>
      </div>
    </section>
  `;
}

function renderPiePanelLegacy({ title, data, total, centerCaption, rightAction = "" }) {
  return `
    <div class="stack">
      <div class="tree-header">
        <h3 class="chart-title small">${escapeHTML(title)}</h3>
        ${rightAction || ""}
      </div>
      <div class="chart-shell">
        <div class="chart-wrap">
          ${renderPieSvg(data, 168)}
          <div class="chart-center">
            <strong class="chart-total">${total}</strong>
            <span class="caption">${escapeHTML(centerCaption)}</span>
          </div>
        </div>
        <div class="chart-legend">
          ${data.map((item) => `
            <div class="legend-item">
              <span class="legend-dot" style="color: ${MODULE_COLORS[item.module || item.label] || item.color || "#EB8A2F"}"></span>
              <span class="legend-label">$${escapeHTML(item.label)}</span>
              <span class="legend-value">${item.count} 道</span>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderPieSvgLegacy(data, size) {
  if (!data.length) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 12}" fill="#fff" stroke="#efcfb0" stroke-width="2"></circle>
      </svg>
    `;
  }

  const radius = size / 2 - 12;
  const center = size / 2;
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let startAngle = -Math.PI / 2;

  const segments = data.map((item, index) => {
    const ratio = item.count / total;
    const endAngle = startAngle + ratio * Math.PI * 2;
    const path = describeArcSlice(center, center, radius, startAngle, endAngle);
    const stroke = MODULE_COLORS[item.module || item.label] || Object.values(MODULE_COLORS)[index % MODULE_ORDER.length];
    const fill = colorWithAlpha(stroke, 0.16 + (index % 3) * 0.05);
    startAngle = endAngle;
    return `<path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"></path>`;
  });

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="#ffffff" stroke="#efcfb0" stroke-width="1.5"></circle>
      ${segments.join("")}
      <circle cx="${center}" cy="${center}" r="${radius * 0.46}" fill="#fffaf5" stroke="#efcfb0" stroke-width="1.5"></circle>
    </svg>
  `;
}

function renderFilterStripLegacy() {
  return `
    <section class="filter-strip" aria-label="训练筛选栏">
      <label class="filter-pill">
        录入时间
        <select data-action="change-time-filter">
          <option value="all" ${state.filters.time === "all" ? "selected" : ""}>不限</option>
          <option value="7" ${state.filters.time === "7" ? "selected" : ""}>7天内/option>
          <option value="30" ${state.filters.time === "30" ? "selected" : ""}>30天内</option>
        </select>
      </label>
      <label class="filter-pill">
        练习顺序
        <select data-action="change-order-filter">
          <option value="latest" ${state.filters.order === "latest" ? "selected" : ""}>最近录入/option>
          <option value="earliest" ${state.filters.order === "earliest" ? "selected" : ""}>最早录入/option>
          <option value="random" ${state.filters.order === "random" ? "selected" : ""}>随机</option>
        </select>
      </label>
      <button class="filter-pill" type="button" data-action="open-settings">训练设置</button>
    </section>
  `;
}

function renderTree(nodes, treeType) {
  return `<div class="tree-list">${nodes.map((node) => renderTreeNode(node, treeType)).join("")}</div>`;
}

function renderTreeNode(node, treeType) {
  const hasChildren = node.children.length > 0;
  const isExpanded = state.expandedKeys.has(node.key);
  const label = node.path.length ? node.label : node.module;
  return `
    <div class="${node.path.length ? "tree-node" : "tree-group"}">
      <div class="tree-row">
        <button
          class="tree-expand ${hasChildren ? (isExpanded ? "is-open" : "") : "is-leaf"}"
          type="button"
          data-action="toggle-node"
          data-key="${node.key}"
          aria-label="${hasChildren ? `展开 ${label}` : `${label} 为末级标签`}"
        ></button>
        <div class="tree-info">
          <p class="tree-label">${escapeHTML(label)}</p>
          <div class="tree-meta">
            <strong>错题 ${node.wrongCount} 道</strong>
            <strong>顽固 ${node.stubbornCount} 道</strong>
          </div>
        </div>
        <button
          class="count-button ${node.wrongCount ? "" : "is-disabled"}"
          type="button"
          data-action="start-node"
          data-tree="${treeType}"
          data-key="${node.key}"
          ${node.wrongCount ? "" : "disabled"}
        >
          ${node.wrongCount}道
        </button>
      </div>
      ${hasChildren && isExpanded ? `<div class="tree-node-branch">${node.children.map((child) => renderTreeNode(child, treeType)).join("")}</div>` : ""}
    </div>
  `;
}

function renderStubbornNoteLegacy(records) {
  const stubbornCount = getStubbornCount(records);
  if (!stubbornCount) {
    return "";
  }
  return `
    <div class="stubborn-note">
      <div class="note-text">顽固错题定义：在错题复练中再次做错累计达鍒?3 次及以上。/div>
    </div>
  `;
}

function renderPracticeAnalysisActions(question) {
  const record = recordMap.get(question.id);
  const focusLabel = record?.isFocus ? "移出重点复练" : "加入重点复练";
  return `
    <div class="analysis-actions">
      <div class="action-row">
        <button class="secondary-button" type="button" data-action="diagnose-question" data-question-id="${question.id}">
          错因诊断
        </button>
        <button class="secondary-button" type="button" data-action="toggle-focus-question" data-question-id="${question.id}">
          ${focusLabel}
        </button>
      </div>
      <div class="single-action">
        <button class="ghost-button" type="button" data-action="same-knowledge" data-question-id="${question.id}">
          练习相同知识点题目
        </button>
      </div>
    </div>
  `;
}

function renderAnalysisBox(question, selectedOption) {
  const correct = question.answerIndex;
  return `
    <div class="analysis-box">
      <h3>答案与解析</h3>
      <p class="meta-text">你的答案：${Number.isInteger(selectedOption) ? String.fromCharCode(65 + selectedOption) : "未作答"}。  正确答案：${String.fromCharCode(65 + correct)}</p>
      <div class="html-content">${sanitizeAnalysisHtml(question.analysis)}</div>
    </div>
  `;
}

function renderEmptyState(title, description) {
  return `
    <div class="empty-state">
      <strong>${escapeHTML(title)}</strong>
      <span class="caption">${escapeHTML(description)}</span>
    </div>
  `;
}

function renderTimeRangeModal() {
  if (!TIME_RANGE_MODAL_ROOT) {
    return;
  }
  if (!state.timeRangePicker.isOpen) {
    TIME_RANGE_MODAL_ROOT.innerHTML = "";
    return;
  }

  TIME_RANGE_MODAL_ROOT.innerHTML = `
    <div class="modal-overlay" role="presentation">
      <section class="modal-card" role="dialog" aria-modal="true" aria-label="自定义录入时间">
        <div class="modal-head">
          <h2 class="panel-title">自定义时间</h2>
          <div class="modal-actions">
            <button class="secondary-button modal-action-button" type="button" data-action="cancel-time-range">取消</button>
            <button class="primary-button modal-action-button" type="button" data-action="confirm-time-range">确定</button>
          </div>
        </div>
        <div class="date-range-grid">
          <label class="date-field">
            <span class="field-label">开始日期</span>
            <input
              class="inline-input"
              type="date"
              value="${state.timeRangePicker.draftStart || ""}"
              max="${state.timeRangePicker.draftEnd || getTodayDateString()}"
              data-action="change-time-range-start"
            />
          </label>
          <label class="date-field">
            <span class="field-label">结束日期</span>
            <input
              class="inline-input"
              type="date"
              value="${state.timeRangePicker.draftEnd || ""}"
              min="${state.timeRangePicker.draftStart || ""}"
              max="${getTodayDateString()}"
              data-action="change-time-range-end"
            />
          </label>
        </div>
        <p class="caption modal-caption">所选时间按自然日计算，包含开始日 00:00:00 到结束日 23:59:59。</p>
      </section>
    </div>
  `;
}

function openTimeRangePicker() {
  const draftRange = resolveTimeRangeDraft();
  state.timeRangePicker = {
    isOpen: true,
    draftStart: draftRange.startDate,
    draftEnd: draftRange.endDate,
  };
  renderTimeRangeModal();
}

function closeTimeRangePicker() {
  state.timeRangePicker = {
    isOpen: false,
    draftStart: "",
    draftEnd: "",
  };
  renderTimeRangeModal();
  renderApp();
}

function applyCustomTimeRange() {
  const { draftStart, draftEnd } = state.timeRangePicker;
  if (!draftStart || !draftEnd) {
    window.alert("请先选择完整的开始日期和结束日期。");
    return;
  }
  if (draftStart > draftEnd) {
    window.alert("开始日期不能晚于结束日期。");
    return;
  }
  state.filters.time = "custom";
  state.filters.customTimeRange = {
    startDate: draftStart,
    endDate: draftEnd,
  };
  state.timeRangePicker = {
    isOpen: false,
    draftStart: "",
    draftEnd: "",
  };
  renderApp();
}

function resolveTimeRangeDraft() {
  if (state.filters.time === "custom" && state.filters.customTimeRange) {
    return { ...state.filters.customTimeRange };
  }

  const today = getTodayDateString();
  if (state.filters.time === "7" || state.filters.time === "30") {
    const presetRange = getPresetTimeRange(state.filters.time);
    return {
      startDate: toDateInputValue(presetRange.start),
      endDate: toDateInputValue(presetRange.end),
    };
  }

  const sortedRecords = [...wrongRecords].sort(
    (left, right) => new Date(left.wrongAddedAt).getTime() - new Date(right.wrongAddedAt).getTime()
  );
  return {
    startDate: sortedRecords.length ? toDateInputValue(new Date(sortedRecords[0].wrongAddedAt)) : today,
    endDate: today,
  };
}

function getVisibleRecords() {
  let records = wrongRecords.filter((record) => record.status === "active");
  const timeRange = getActiveTimeRange();
  if (timeRange) {
    records = records.filter((record) => {
      const addedAt = new Date(record.wrongAddedAt);
      return addedAt >= timeRange.start && addedAt <= timeRange.end;
    });
  }
  return sortRecords(records, state.filters.order);
}

function getFocusRecords(inputRecords = null) {
  const records = inputRecords ? [...inputRecords] : getVisibleRecords();
  return records.filter((record) => isFocusRecord(record));
}

function sortRecords(records, orderMode) {
  const list = [...records];
  const compareByWrongAddedAt = (left, right) => {
    const leftAddedAt = new Date(left.wrongAddedAt).getTime();
    const rightAddedAt = new Date(right.wrongAddedAt).getTime();
    if (leftAddedAt !== rightAddedAt) {
      return rightAddedAt - leftAddedAt;
    }
    if ((left.rewrongCount || 0) !== (right.rewrongCount || 0)) {
      return (right.rewrongCount || 0) - (left.rewrongCount || 0);
    }
    if ((left.wrongCount || 0) !== (right.wrongCount || 0)) {
      return (right.wrongCount || 0) - (left.wrongCount || 0);
    }
    return String(left.questionId).localeCompare(String(right.questionId), "zh-CN");
  };

  if (orderMode === "random") {
    const randomSeed = state.filters.randomSeed || createRandomSeed();
    state.filters.randomSeed = randomSeed;
    list.sort((left, right) => {
      const leftRank = getStableRandomRank(left, randomSeed);
      const rightRank = getStableRandomRank(right, randomSeed);
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return compareByWrongAddedAt(left, right);
    });
    return list;
  }

  list.sort(compareByWrongAddedAt);
  if (orderMode === "earliest") {
    list.reverse();
  }
  return list;
}

function getModuleStats(records) {
  return MODULE_ORDER.map((module) => ({
    label: module,
    module,
    count: records.filter((record) => getQuestion(record.questionId)?.module === module).length,
  })).filter((item) => item.count > 0);
}

function getRecommendedModules(moduleStats) {
  return [...moduleStats].sort((left, right) => right.count - left.count).slice(0, 2);
}

function getModuleTagStats(records) {
  const counts = new Map();
  records.forEach((record) => {
    const question = getQuestion(record.questionId);
    if (!question) {
      return;
    }
    const label = question.visiblePath[0] || question.module;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "zh-CN"));
}

function buildKnowledgeTree(records) {
  const rootMap = new Map();
  const lookup = new Map();

  records.forEach((record) => {
    const question = getQuestion(record.questionId);
    if (!question) {
      return;
    }
    const module = question.module;
    const rootKey = makeNodeKey(module, []);
    let root = rootMap.get(rootKey);
    if (!root) {
      root = createTreeNode(module, []);
      rootMap.set(rootKey, root);
      lookup.set(rootKey, root);
    }

    appendRecordToNode(root, record);

    let currentNode = root;
    const path = [];
    question.visiblePath.forEach((segment) => {
      path.push(segment);
      const key = makeNodeKey(module, path);
      let nextNode = currentNode.childMap.get(key);
      if (!nextNode) {
        nextNode = createTreeNode(module, [...path]);
        currentNode.childMap.set(key, nextNode);
        currentNode.children.push(nextNode);
        lookup.set(key, nextNode);
      }
      appendRecordToNode(nextNode, record);
      currentNode = nextNode;
    });
  });

  const roots = [...rootMap.values()]
    .map((root) => finalizeTreeNode(root))
    .sort(compareTreeNodes);

  return { roots, lookup };
}

function createTreeNode(module, path) {
  return {
    module,
    path,
    label: path[path.length - 1] || module,
    key: makeNodeKey(module, path),
    children: [],
    childMap: new Map(),
    questionIds: new Set(),
    stubbornIds: new Set(),
    wrongCount: 0,
    stubbornCount: 0,
  };
}

function appendRecordToNode(node, record) {
  node.questionIds.add(record.questionId);
  if (isStubbornRecord(record)) {
    node.stubbornIds.add(record.questionId);
  }
}

function finalizeTreeNode(node) {
  node.wrongCount = node.questionIds.size;
  node.stubbornCount = node.stubbornIds.size;
  node.children = node.children.map((child) => finalizeTreeNode(child)).sort(compareTreeNodes);
  return node;
}

function compareTreeNodes(left, right) {
  const leftOrder = TAG_ORDER_INDEX.get(left.key) ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = TAG_ORDER_INDEX.get(right.key) ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return left.label.localeCompare(right.label, "zh-CN");
}

function toggleNode(key, triggerElement = null) {
  if (!key) {
    return;
  }
  const previousScrollTop = window.scrollY;
  if (state.expandedKeys.has(key)) {
    state.expandedKeys.delete(key);
  } else {
    state.expandedKeys.add(key);
  }
  renderApp();
  const restoreScroll = () => {
    window.scrollTo(0, previousScrollTop);
    triggerElement?.blur?.();
  };
  window.requestAnimationFrame(() => {
    restoreScroll();
    window.requestAnimationFrame(restoreScroll);
    window.setTimeout(restoreScroll, 80);
  });
}

function openHomeModule(module) {
  if (!module) {
    return;
  }
  state.expandedKeys.add(makeNodeKey(module, []));
  navigateTo(VIEW_HOME);
}

function startFromTreeNode(treeType, key) {
  const lookup = treeType === "focus" ? state.treeLookups.focus : state.treeLookups.home;
  const node = lookup.get(key);
  if (!node || !node.questionIds.size) {
    return;
  }
  startPracticeSession({
    sourceType: "node",
    sourceTree: treeType,
    sourceLabel: buildNodeLabel(node),
    nodePath: node.path,
    questionIds: [...node.questionIds],
  });
}

function startPracticeSession({ sourceType, sourceTree, sourceLabel, nodePath, questionIds }) {
  const uniqueIds = [...new Set(questionIds)].filter((questionId) => QUESTION_MAP.has(questionId));
  if (!uniqueIds.length) {
    window.alert("当前范围下没有可练习的错题。");
    return;
  }

  const selection = selectQuestionsForSession(uniqueIds, nodePath);
  if (selection.overflowed) {
    window.alert(`当前层级可练错题不足 ${resolveQuestionLimit()} 题，已按全部可练题目开始练习。`);
  }

  const questions = selection.questionIds.map((questionId) => getQuestion(questionId)).filter(Boolean);
  if (!questions.length) {
    window.alert("当前设置下没有选出可练习的错题。");
    return;
  }

  state.session = {
    kind: "mistake",
    mode: state.settings.practiceMode,
    sourceType,
    sourceTree,
    sourceLabel,
    nodePath,
    questions,
    answers: {},
    currentIndex: 0,
    report: null,
  };
  state.analysisIndex = 0;
  navigateTo(VIEW_PRACTICE);
}

function selectQuestionsForSession(questionIds, nodePath) {
  const records = questionIds
    .map((id) => recordMap.get(id))
    .filter(Boolean);

  const limit = resolveQuestionLimit();
  const isMaterialBundle = Array.isArray(nodePath) && nodePath.join(">")==="篇章阅读>普通篇章";
  if (isMaterialBundle) {
    const groups = groupByMaterial(records);
    const fullIds = groups.flatMap((group) => group.records.map((record) => record.questionId));
    const pickedGroups = limit === Infinity ? groups : groups.slice(0, Math.max(1, Math.ceil(limit / 5)));
    return {
      questionIds: pickedGroups.flatMap((group) => group.records.map((record) => record.questionId)),
      overflowed: state.settings.questionCount === "custom" && Number.isFinite(limit) && fullIds.length < limit,
    };
  }

  const sorted = sortRecords(records, state.filters.order);
  return {
    questionIds: (limit === Infinity ? sorted : sorted.slice(0, limit)).map((record) => record.questionId),
    overflowed: state.settings.questionCount === "custom" && Number.isFinite(limit) && sorted.length < limit,
  };
}

function groupByMaterial(records) {
  const groupMap = new Map();
  records.forEach((record) => {
    const question = getQuestion(record.questionId);
    const materialGroupId = question?.materialGroupId;
    if (!materialGroupId) {
      return;
    }
    if (!groupMap.has(materialGroupId)) {
      groupMap.set(materialGroupId, []);
    }
    groupMap.get(materialGroupId).push(record);
  });

  return [...groupMap.entries()]
    .map(([materialGroupId, groupRecords]) => ({ materialGroupId, records: sortRecords(groupRecords, state.filters.order) }))
    .filter((group) => group.records.length >= 5)
    .sort((left, right) => sortRecords([left.records[0], right.records[0]], "latest")[0].questionId === left.records[0].questionId ? -1 : 1);
}

function resolveQuestionLimit() {
  if (state.settings.questionCount === "all") {
    return Infinity;
  }
  if (state.settings.questionCount === "custom") {
    return Math.max(1, Number(state.settings.customCount) || 1);
  }
  return Math.max(1, Number(state.settings.questionCount) || 10);
}

function handleAnswerSelection(questionIndex, optionIndex) {
  const session = state.session;
  if (!session) {
    return;
  }
  const question = session.questions[questionIndex];
  if (!question) {
    return;
  }

  session.answers[question.id] = optionIndex;

  if (session.mode === PRACTICE_MODE.QUIZ) {
    if (questionIndex >= session.questions.length - 1) {
      navigateTo(VIEW_ANSWER_SHEET);
    } else {
      session.currentIndex = Math.min(session.questions.length - 1, questionIndex + 1);
      renderApp();
    }
    return;
  }

  renderApp();
}

function advanceMemorizeQuestion() {
  if (!state.session) {
    return;
  }
  if (state.session.currentIndex >= state.session.questions.length - 1) {
    finalizeSession();
    navigateTo(VIEW_RESULT);
    return;
  }
  state.session.currentIndex += 1;
  renderApp();
}

function jumpToQuestion(questionIndex) {
  if (!state.session) {
    return;
  }
  state.session.currentIndex = Math.max(0, Math.min(state.session.questions.length - 1, questionIndex));
  navigateTo(VIEW_PRACTICE);
}

function finalizeSession() {
  if (!state.session || state.session.report) {
    return;
  }

  const nowIso = new Date("2026-07-01T18:00:00").toISOString();
  const masteryTarget = state.settings.masteryTarget;
  let correct = 0;
  let stillWrong = 0;
  let newlyMastered = 0;
  const wrongQuestionIds = [];
  const correctQuestionIds = [];

  state.session.questions.forEach((question) => {
    const answerIndex = state.session.answers[question.id];
    const isCorrect = Number.isInteger(question.answerIndex) && answerIndex === question.answerIndex;

    if (state.session.kind === "special") {
      if (question.isVirtual) {
        stillWrong += 1;
        wrongQuestionIds.push(question.id);
        return;
      }

      if (isCorrect) {
        correct += 1;
        correctQuestionIds.push(question.id);
      } else {
        const record = ensureWrongRecord(question.id, nowIso);
        stillWrong += 1;
        wrongQuestionIds.push(question.id);
        record.status = "active";
        record.wrongCount += 1;
        record.rewrongCount += 1;
        record.lastWrongAt = nowIso;
        record.lastPracticedAt = nowIso;
        record.isFocus = isFocusRecord(record);
      }
      return;
    }

    const record = ensureWrongRecord(question.id, nowIso);
    if (isCorrect) {
      correct += 1;
      correctQuestionIds.push(question.id);
      record.masteryCorrectCount = Number(record.masteryCorrectCount || 0) + 1;
      if (record.masteryCorrectCount >= masteryTarget && record.status !== "mastered") {
        record.status = "mastered";
        record.isFocus = false;
        newlyMastered += 1;
      }
    } else {
      stillWrong += 1;
      wrongQuestionIds.push(question.id);
      record.status = "active";
      record.wrongCount += 1;
      record.rewrongCount += 1;
      record.lastWrongAt = nowIso;
    }
    record.lastPracticedAt = nowIso;
    record.isFocus = isFocusRecord(record);
  });

  const followupQuestion = state.session.questions.find((question) => state.session.answers[question.id] !== question.answerIndex) || state.session.questions[0];
  state.session.report = {
    total: state.session.questions.length,
    correct,
    accuracy: Math.round((correct / state.session.questions.length) * 100),
    stillWrong,
    mastered: correct,
    newlyMastered,
    followupQuestionId: followupQuestion?.id || state.session.questions[0]?.id || "",
    masteryTarget,
    modeLabel: state.session.mode === PRACTICE_MODE.QUIZ ? "做题模式" : "背题模式",
    wrongQuestionIds,
    correctQuestionIds,
  };
  renderApp();
}

function ensureWrongRecord(questionId, nowIso = new Date().toISOString()) {
  const existing = recordMap.get(questionId);
  if (existing) {
    return existing;
  }

  const record = {
    questionId,
    wrongAddedAt: nowIso,
    lastWrongAt: nowIso,
    lastPracticedAt: "",
    wrongCount: 0,
    rewrongCount: 0,
    masteryCorrectCount: 0,
    consecutiveCorrectCount: 0,
    status: "active",
    isFocus: false,
  };
  wrongRecords.push(record);
  refreshRecordMap();
  return recordMap.get(questionId);
}

function returnToKnowledgeTree() {
  const sourceTree = state.session?.sourceTree === "focus" ? VIEW_FOCUS : VIEW_HOME;
  navigateTo(sourceTree);
}

function toggleFocusQuestion(questionId) {
  const record = recordMap.get(questionId);
  if (!record) {
    return;
  }
  record.isFocus = !record.isFocus;
  renderApp();
}

function handleDiagnosisAction(questionId) {
  const session = state.session;
  const currentQuestion = session?.questions?.[session.currentIndex];
  const isCurrentMemorizeQuestion = session?.mode === PRACTICE_MODE.MEMORIZE && state.currentView === VIEW_PRACTICE && currentQuestion?.id === questionId;
  const answered = isCurrentMemorizeQuestion ? Number.isInteger(session.answers[questionId]) : true;
  if (!answered) {
    window.alert("当前未完成题目，无法诊断错因");
    return;
  }
  openDiagnosis(questionId);
}

function openDiagnosis(questionId) {
  const question = getQuestion(questionId);
  if (!question) {
    return;
  }
  window.alert(`这里会跳转到已有点拨系统，并透传题目上下文：${question.id}`);
}

function openSpecialTraining(questionId) {
  const question = getQuestion(questionId);
  if (!question) {
    return;
  }
  startSpecialTrainingSession({
    module: question.module,
    path: question.visiblePath,
    sourceLabel: `${question.leafLabel} / 相同知识点练习`,
    origin: buildSpecialOriginSnapshot(),
  });
}

function startSameKnowledgeTrainingFromNode(key) {
  const lookup = state.treeLookups.sameKnowledgeReport;
  const node = lookup?.get(key);
  if (!node) {
    return;
  }
  startSpecialTrainingSession({
    module: node.module,
    path: node.path,
    sourceLabel: `${buildSameKnowledgeNodeLabel(node)} / 相同知识点练习`,
    origin: buildSpecialOriginSnapshot(),
  });
}

function startSpecialTrainingSession({ module, path, sourceLabel, origin }) {
  const candidateIds = collectSpecialTrainingCandidateIds(module, path);
  if (!candidateIds.length && !path.length) {
    window.alert("当前知识点下暂无可练习题目。");
    return;
  }

  const shuffled = [...candidateIds];
  shuffleInPlace(shuffled);
  const selectedIds = shuffled.slice(0, Math.min(5, shuffled.length));
  const realQuestions = selectedIds.map((questionId) => getQuestion(questionId)).filter(Boolean);
  const virtualQuestions = buildVirtualSpecialQuestions({
    module,
    path,
    startIndex: realQuestions.length,
    count: Math.max(0, 5 - realQuestions.length),
  });
  const questions = realQuestions.concat(virtualQuestions);

  state.session = {
    kind: "special",
    mode: PRACTICE_MODE.QUIZ,
    sourceType: "specialKnowledge",
    sourceTree: "special",
    sourceLabel,
    nodePath: path,
    questions,
    answers: {},
    currentIndex: 0,
    report: null,
    specialOrigin: origin || null,
  };
  state.analysisIndex = 0;
  navigateTo(VIEW_PRACTICE);
}

function collectSpecialTrainingCandidateIds(module, path) {
  return QUESTION_BANK
    .filter((question) => question.module === module && pathStartsWith(question.visiblePath, path))
    .map((question) => question.id);
}

function pathStartsWith(fullPath, prefixPath) {
  if (!prefixPath.length) {
    return true;
  }
  if (prefixPath.length > fullPath.length) {
    return false;
  }
  return prefixPath.every((segment, index) => fullPath[index] === segment);
}

function buildSameKnowledgeTree(questions) {
  const rootMap = new Map();
  const lookup = new Map();

  questions.forEach((question) => {
    const module = question.module;
    const rootKey = makeSameKnowledgeNodeKey(module, []);
    let root = rootMap.get(rootKey);
    if (!root) {
      root = createSameKnowledgeNode(module, []);
      rootMap.set(rootKey, root);
      lookup.set(rootKey, root);
    }

    let currentNode = root;
    const path = [];
    question.visiblePath.forEach((segment) => {
      path.push(segment);
      const key = makeSameKnowledgeNodeKey(module, path);
      let nextNode = currentNode.childMap.get(key);
      if (!nextNode) {
        nextNode = createSameKnowledgeNode(module, [...path]);
        currentNode.childMap.set(key, nextNode);
        currentNode.children.push(nextNode);
        lookup.set(key, nextNode);
      }
      currentNode = nextNode;
    });
  });

  const roots = [...rootMap.values()].map((node) => finalizeSameKnowledgeNode(node)).sort(compareTreeNodes);
  lookup.forEach((node) => {
    node.questionIds = new Set(collectSpecialTrainingCandidateIds(node.module, node.path));
  });

  return { roots, lookup };
}

function createSameKnowledgeNode(module, path) {
  return {
    module,
    path,
    label: path[path.length - 1] || module,
    key: makeSameKnowledgeNodeKey(module, path),
    children: [],
    childMap: new Map(),
    questionIds: new Set(),
  };
}

function finalizeSameKnowledgeNode(node) {
  node.children = node.children.map((child) => finalizeSameKnowledgeNode(child)).sort(compareTreeNodes);
  return node;
}

function makeSameKnowledgeNodeKey(module, path) {
  return `sameKnowledge::${makeNodeKey(module, path)}`;
}

function buildSameKnowledgeNodeLabel(node) {
  return [node.module].concat(node.path).join(" / ");
}

function buildSpecialOriginSnapshot() {
  return {
    viewId: state.currentView,
    session: clonePlainData(state.session),
    analysisIndex: state.analysisIndex,
    analysisMode: state.analysisMode,
    expandedKeys: [...state.expandedKeys],
    history: [...state.history],
    scrollTop: Number(window.scrollY || 0),
  };
}

function clonePlainData(value) {
  if (value == null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function buildVirtualSpecialQuestions({ module, path, startIndex, count }) {
  return Array.from({ length: count }, (_, offset) => {
    const questionNumber = startIndex + offset + 1;
    const stem = `当前知识点样本题不足 5 题，这是第 ${questionNumber} 道虚拟题占位。点击任意选项继续本组练习，交卷后本题按未做对计入结果。`;
    return {
      id: `virtual-special::${module}::${path.join(">")}::${questionNumber}`,
      isVirtual: true,
      module,
      visiblePath: [...path],
      leafLabel: path[path.length - 1] || module,
      questionType: "虚拟占位题",
      stem,
      stemBlocks: buildStemBlocks(stem),
      options: [
        "继续下一题",
        "查看下一道补位题",
        "保持 5 题一组练习",
        "交卷后统一看报告",
      ],
      answerIndex: null,
      analysis: "<p>当前知识点的真实样本题不足 5 题，本题为虚拟占位题，仅用于补满本组练习，不写入错题池、不写入重点复练池，也不参与累计做对出库次数。</p>",
    };
  });
}

function restoreSpecialOrigin() {
  const origin = state.session?.specialOrigin;
  if (!origin?.viewId) {
    navigateTo(VIEW_HOME, { replace: true });
    return;
  }

  state.session = origin.session || null;
  state.analysisIndex = Number(origin.analysisIndex || 0);
  state.analysisMode = origin.analysisMode || "all";
  state.expandedKeys = new Set(origin.expandedKeys || []);
  state.history = Array.isArray(origin.history) ? [...origin.history] : [];

  navigateTo(origin.viewId, { replace: true, scrollToTop: false });

  const restoreScrollTop = Number(origin.scrollTop || 0);
  const restoreScroll = () => window.scrollTo(0, restoreScrollTop);
  window.requestAnimationFrame(() => {
    restoreScroll();
    window.requestAnimationFrame(restoreScroll);
  });
}

function renderSameKnowledgeTree(nodes) {
  return `<div class="tree-list same-knowledge-tree-list">${nodes.map((node) => renderSameKnowledgeTreeNode(node)).join("")}</div>`;
}

function renderSameKnowledgeTreeNode(node) {
  const hasChildren = node.children.length > 0;
  const isExpanded = state.expandedKeys.has(node.key);
  const label = node.path.length ? node.label : node.module;
  return `
    <div class="${node.path.length ? "tree-node" : "tree-group"}">
      <div class="tree-row same-knowledge-tree-row">
        <button
          class="tree-expand ${hasChildren ? (isExpanded ? "is-open" : "") : "is-leaf"}"
          type="button"
          data-action="toggle-node"
          data-key="${node.key}"
          aria-label="${hasChildren ? `展开 ${label}` : `${label} 为末级标签`}"
        ></button>
        <div class="tree-info">
          <p class="tree-label">${escapeHTML(label)}</p>
        </div>
        <button
          class="count-button same-knowledge-action ${node.questionIds.size ? "" : "is-disabled"}"
          type="button"
          data-action="start-same-knowledge-node"
          data-key="${node.key}"
          ${node.questionIds.size ? "" : "disabled"}
        >
          练习
        </button>
      </div>
      ${hasChildren && isExpanded ? `<div class="tree-node-branch">${node.children.map((child) => renderSameKnowledgeTreeNode(child)).join("")}</div>` : ""}
    </div>
  `;
}

function getAnalysisQuestions() {
  const session = state.session;
  if (!session?.report) {
    return [];
  }
  if (state.analysisMode === "wrongOnly") {
    const wrongIds = new Set(session.report.wrongQuestionIds || []);
    return session.questions.filter((question) => wrongIds.has(question.id));
  }
  return session.questions;
}

function openExportView() {
  state.exportPreview = false;
  state.exportSourceView = state.currentView;
  const availableIds = getExportSourceRecords().map((record) => record.questionId);
  state.exportSelection = new Set([...state.exportSelection].filter((questionId) => availableIds.includes(questionId)));
  if (!state.exportSelection.size) {
    availableIds.slice(0, 8).forEach((questionId) => state.exportSelection.add(questionId));
  }
  navigateTo(VIEW_EXPORT);
}

function toggleExportSelection(questionId) {
  if (!questionId) {
    return;
  }
  if (state.exportSelection.has(questionId)) {
    state.exportSelection.delete(questionId);
  } else {
    state.exportSelection.add(questionId);
  }
  renderApp();
}

function toggleExportAll() {
  const activeIds = getExportSourceRecords().map((record) => record.questionId);
  const allSelected = activeIds.length && activeIds.every((id) => state.exportSelection.has(id));
  if (allSelected) {
    activeIds.forEach((id) => state.exportSelection.delete(id));
  } else {
    activeIds.forEach((id) => state.exportSelection.add(id));
  }
  renderApp();
}

function getOptionClass({ mode, question, selected, optionIndex }) {
  if (mode === PRACTICE_MODE.QUIZ) {
    return Number.isInteger(selected) && selected === optionIndex ? "is-selected" : "";
  }
  if (!Number.isInteger(selected)) {
    return "";
  }
  if (optionIndex === question.answerIndex) {
    return "is-correct";
  }
  if (selected === optionIndex && selected !== question.answerIndex) {
    return "is-wrong";
  }
  return "";
}

function getReviewOptionClass(question, selected, optionIndex) {
  if (optionIndex === question.answerIndex) {
    return "is-correct";
  }
  if (selected === optionIndex && selected !== question.answerIndex) {
    return "is-wrong";
  }
  return "";
}

function isStubbornRecord(record) {
  return Number(record.rewrongCount || 0) >= 3;
}

function isFocusRecord(record) {
  return Boolean(record.isFocus || Number(record.wrongCount || 0) >= 4 || isStubbornRecord(record));
}

function getStubbornCount(records) {
  return records.filter((record) => isStubbornRecord(record)).length;
}

function formatQuestionCountLabel(settings = state.settings) {
  if (settings.questionCount === "all") {
    return "全部";
  }
  if (settings.questionCount === "custom") {
    return `${settings.customCount} 题`;
  }
  return `${settings.questionCount} 题`;
}

function formatTimeFilterLabel() {
  if (state.filters.time === "7") {
    return "7天内";
  }
  if (state.filters.time === "30") {
    return "30天内";
  }
  if (state.filters.time === "custom" && state.filters.customTimeRange) {
    const { startDate, endDate } = state.filters.customTimeRange;
    return `${formatShortDate(startDate)}-${formatShortDate(endDate)}`;
  }
  return "不限";
}

function formatOrderFilterLabel() {
  if (state.filters.order === "earliest") {
    return "最早录入";
  }
  if (state.filters.order === "random") {
    return "随机";
  }
  return "最近录入";
}

function formatTrainingSettingLabel() {
  const modeLabel = state.settings.practiceMode === PRACTICE_MODE.QUIZ ? "做题" : "背题";
  return `${modeLabel} ${formatQuestionCountLabel()}`;
}

function getPracticeModeRule(settings = state.settings) {
  if (settings.practiceMode === PRACTICE_MODE.QUIZ) {
    return ["选择答案", "自动下一题", "答题卡交卷"];
  }
  return ["选择答案", "即时解析", "手动下一题"];
}

function getQuestion(questionId) {
  return QUESTION_MAP.get(questionId);
}

function refreshRecordMap() {
  recordMap = new Map(wrongRecords.map((record) => [record.questionId, record]));
}

function buildNodeLabel(node) {
  return [node.module].concat(node.path).join(" / ");
}

function makeNodeKey(module, path) {
  return `${module}::${(path || []).join(">")}`;
}

function daysAgo(anchor, days) {
  const date = new Date(anchor);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function hashString(input) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getTodayDateString() {
  return toDateInputValue(new Date());
}

function toDateInputValue(date) {
  const current = new Date(date);
  const year = current.getFullYear();
  const month = String(current.getMonth() + 1).padStart(2, "0");
  const day = String(current.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(dateString) {
  if (!dateString) {
    return "";
  }
  const [year, month, day] = String(dateString).split("-");
  return `${month}.${day}`;
}

function startOfDay(dateLike) {
  const date = new Date(dateLike);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(dateLike) {
  const date = new Date(dateLike);
  date.setHours(23, 59, 59, 999);
  return date;
}

function getPresetTimeRange(timeFilter) {
  const end = endOfDay(new Date());
  const days = timeFilter === "7" ? 7 : 30;
  const start = startOfDay(end);
  start.setDate(start.getDate() - (days - 1));
  return { start, end };
}

function getActiveTimeRange() {
  if (state.filters.time === "all") {
    return null;
  }
  if (state.filters.time === "custom") {
    const customRange = state.filters.customTimeRange;
    if (!customRange?.startDate || !customRange?.endDate) {
      return null;
    }
    return {
      start: startOfDay(customRange.startDate),
      end: endOfDay(customRange.endDate),
    };
  }
  return getPresetTimeRange(state.filters.time);
}

function createRandomSeed() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getStableRandomRank(record, seed) {
  return hashString(`${seed}::${record.questionId}`);
}

function updateOrderFilter(nextOrder) {
  const previousOrder = state.filters.order;
  state.filters.order = nextOrder;
  if (nextOrder === "random" && previousOrder !== "random") {
    state.filters.randomSeed = createRandomSeed();
  }
}

function getExportSourceRecords() {
  if (state.exportSourceView === VIEW_MODULE_REPORT && state.moduleReport) {
    return getVisibleRecords().filter((record) => getQuestion(record.questionId)?.module === state.moduleReport);
  }
  if (state.exportSourceView === VIEW_FOCUS) {
    return getFocusRecords();
  }
  return getVisibleRecords();
}

function shuffleInPlace(list) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }
}

function describeArcSlice(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function polarToCartesian(cx, cy, radius, angleInRadians) {
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function colorWithAlpha(hexColor, alpha) {
  const safeHex = hexColor.replace("#", "");
  const red = parseInt(safeHex.slice(0, 2), 16);
  const green = parseInt(safeHex.slice(2, 4), 16);
  const blue = parseInt(safeHex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function sanitizeAnalysisHtml(html) {
  return String(html || "")
    .replace(/<img[^>]*data-latex="([^"]*)"[^>]*>/g, '<span class="badge">公式片段</span>')
    .replace(/<img[^>]*>/g, '<span class="badge">图示</span>');
}

function buildStemBlocks(stem) {
  const source = String(stem || "").trim();
  if (!source) {
    return [];
  }

  if (source.includes("\n")) {
    return source.split(/\n+/).map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  }

  const raw = source.replace(/\s+/g, " ").trim();

  const sentenceBreak = findSentenceBreak(raw);
  if (sentenceBreak > 0) {
    return [raw.slice(0, sentenceBreak).trim(), raw.slice(sentenceBreak).trim()].filter(Boolean);
  }

  return [raw];
}

function findSentenceBreak(text) {
  const punctuationMatches = [...text.matchAll(/[。！？?]/g)];
  if (punctuationMatches.length) {
    const lastMatch = punctuationMatches[punctuationMatches.length - 1];
    const trailing = text.slice(lastMatch.index + 1).trim();
    if (trailing.length >= 6 && trailing.length <= 36) {
      return lastMatch.index + 1;
    }
  }

  const cues = ["下列", "根据资料", "以下", "关于", "则", "可知"];
  for (const cue of cues) {
    const index = text.indexOf(cue);
    if (index >= 8) {
      return index;
    }
  }
  return -1;
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHomeView() {
  const container = document.getElementById(VIEW_HOME);
  const records = getVisibleRecords();
  const moduleStats = getModuleStats(records);
  const { roots, lookup } = buildKnowledgeTree(records);
  state.treeLookups.home = lookup;

  container.innerHTML = `
    ${renderHomeReportCard(records, moduleStats)}
    <section class="panel home-tree-card">
      ${renderFilterStrip("home-filter-strip")}
      <div class="home-tree-panel">
        ${roots.length ? renderTree(roots, "home") : renderEmptyState("当前筛选下暂无待练错题", "调整录入时间，或先进入模块报告查看其他模块。")}
        ${renderStubbornNote(records, { plain: true })}
      </div>
    </section>
    <div class="cta-stack home-cta-stack">
      <button class="primary-button" type="button" data-action="start-all">开始复练全部错题</button>
      <p class="note-text">ⓘ此模式下，全模块错题随机混合训练</p>
    </div>
  `;
}

function renderHomeReportCard(records, moduleStats) {
  return `
    <section class="chart-card hero-chart home-report-card">
      <h2 class="home-report-title">错题报告</h2>
      <div class="home-chart-shell">
        <div class="chart-wrap home-chart-wrap">
          ${renderPieSvg(moduleStats, 148, { showPercentages: true, minLabelRatio: 0.08 })}
          <div class="chart-center">
            <strong class="chart-total">${records.length}</strong>
            <span class="caption">当前错题</span>
          </div>
        </div>
        <div class="chart-legend home-chart-legend">
          ${renderLegendItems(moduleStats)}
        </div>
      </div>
      <div class="home-focus-row">
        <button class="focus-button home-focus-button" type="button" data-action="open-focus">重点复练</button>
      </div>
      <div class="button-grid home-module-grid">
        ${MODULE_ORDER.map((module) => `
          <button class="module-button home-module-button" type="button" data-action="open-module-report" data-module="${module}">
            <strong>${escapeHTML(module)}</strong>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPieSvg(data, size, options = {}) {
  const { showPercentages = false, minLabelRatio = 0 } = options;
  if (!data.length) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 12}" fill="#fff" stroke="#efcfb0" stroke-width="2"></circle>
      </svg>
    `;
  }

  const radius = size / 2 - 12;
  const center = size / 2;
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let startAngle = -Math.PI / 2;

  const segments = data.map((item, index) => {
    const currentStart = startAngle;
    const ratio = item.count / total;
    const endAngle = currentStart + ratio * Math.PI * 2;
    const path = describeArcSlice(center, center, radius, currentStart, endAngle);
    const stroke = resolveChartColor(item.module || item.label, index);
    const fill = colorWithAlpha(stroke, 0.14);
    const midAngle = currentStart + (endAngle - currentStart) / 2;
    const showLabel = showPercentages && ratio >= minLabelRatio;
    const labelPoint = showLabel ? polarToCartesian(center, center, radius * 0.76, midAngle) : null;
    const labelMarkup = showLabel
      ? `<text x="${labelPoint.x.toFixed(2)}" y="${labelPoint.y.toFixed(2)}" class="pie-percent-label" text-anchor="middle" dominant-baseline="central">${Math.round(ratio * 100)}%</text>`
      : "";
    startAngle = endAngle;
    return `
      <g>
        <path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"></path>
        ${labelMarkup}
      </g>
    `;
  });

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="#ffffff" stroke="#efcfb0" stroke-width="1.5"></circle>
      ${segments.join("")}
      <circle cx="${center}" cy="${center}" r="${radius * 0.46}" fill="#fffaf5" stroke="#efcfb0" stroke-width="1.5"></circle>
    </svg>
  `;
}

function renderStubbornNote(records, options = {}) {
  const { plain = false } = options;
  const stubbornCount = getStubbornCount(records);
  if (!records.length || (!plain && !stubbornCount)) {
    return "";
  }
  const noteMarkup = "顽固错题定义：在错题复练中再次做错累计达到 3 次及以上。";
  if (plain) {
    return `<p class="note-text stubborn-note-inline">ⓘ${noteMarkup}</p>`;
  }
  return `
    <div class="stubborn-note">
      <div class="note-text">${noteMarkup}</div>
    </div>
  `;
}

function renderHomeView() {
  const container = document.getElementById(VIEW_HOME);
  const records = getVisibleRecords();
  const moduleStats = getModuleStats(records);
  const { roots, lookup } = buildKnowledgeTree(records);
  state.treeLookups.home = lookup;

  container.innerHTML = `
    ${renderHomeReportCard(records, moduleStats)}
    <section class="panel home-tree-card">
      ${renderFilterStrip("home-filter-strip")}
      <div class="home-tree-panel">
        ${roots.length ? renderTree(roots, "home") : renderEmptyState("当前筛选下暂无待练错题", "调整录入时间，或先进入模块报告查看其他模块。")}
        ${renderStubbornNote(records, { plain: true })}
      </div>
    </section>
    <div class="cta-stack home-cta-stack">
      <button class="primary-button" type="button" data-action="start-all">开始复练全部错题</button>
      <p class="note-text">ⓘ此模式下，全模块错题随机混合训练</p>
    </div>
  `;
}

function renderHomeReportCard(records, moduleStats) {
  return `
    <section class="chart-card hero-chart home-report-card">
      <h2 class="home-report-title">错题报告</h2>
      <div class="home-chart-shell">
        <div class="chart-wrap home-chart-wrap">
          ${renderPieSvg(moduleStats, 148, { showPercentages: true, minLabelRatio: 0.08 })}
          <div class="chart-center">
            <strong class="chart-total">${records.length}</strong>
            <span class="caption">当前错题</span>
          </div>
        </div>
        <div class="chart-legend home-chart-legend">
          ${renderLegendItems(moduleStats)}
        </div>
      </div>
      <div class="home-focus-row">
        <button class="focus-button home-focus-button" type="button" data-action="open-focus">重点复练</button>
      </div>
      <div class="button-grid home-module-grid">
        ${MODULE_ORDER.map((module) => `
          <button class="module-button home-module-button" type="button" data-action="open-module-report" data-module="${module}">
            <strong>${escapeHTML(module)}</strong>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPieSvg(data, size, options = {}) {
  const { showPercentages = false, minLabelRatio = 0 } = options;
  if (!data.length) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 12}" fill="#fff" stroke="#efcfb0" stroke-width="2"></circle>
      </svg>
    `;
  }

  const radius = size / 2 - 12;
  const center = size / 2;
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let startAngle = -Math.PI / 2;

  const segments = data.map((item, index) => {
    const currentStart = startAngle;
    const ratio = item.count / total;
    const endAngle = currentStart + ratio * Math.PI * 2;
    const path = describeArcSlice(center, center, radius, currentStart, endAngle);
    const stroke = resolveChartColor(item.module || item.label, index);
    const fill = colorWithAlpha(stroke, 0.14);
    const midAngle = currentStart + (endAngle - currentStart) / 2;
    const showLabel = showPercentages && ratio >= minLabelRatio;
    const labelPoint = showLabel ? polarToCartesian(center, center, radius * 0.76, midAngle) : null;
    const labelMarkup = showLabel
      ? `<text x="${labelPoint.x.toFixed(2)}" y="${labelPoint.y.toFixed(2)}" class="pie-percent-label" text-anchor="middle" dominant-baseline="central">${Math.round(ratio * 100)}%</text>`
      : "";
    startAngle = endAngle;
    return `
      <g>
        <path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"></path>
        ${labelMarkup}
      </g>
    `;
  });

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="#ffffff" stroke="#efcfb0" stroke-width="1.5"></circle>
      ${segments.join("")}
      <circle cx="${center}" cy="${center}" r="${radius * 0.46}" fill="#fffaf5" stroke="#efcfb0" stroke-width="1.5"></circle>
    </svg>
  `;
}

function renderStubbornNote(records, options = {}) {
  const { plain = false } = options;
  const stubbornCount = getStubbornCount(records);
  if (!records.length || (!plain && !stubbornCount)) {
    return "";
  }
  const noteMarkup = "顽固错题定义：在错题复练中再次做错累计达到 3 次及以上。";
  if (plain) {
    return `<p class="note-text stubborn-note-inline">ⓘ${noteMarkup}</p>`;
  }
  return `
    <div class="stubborn-note">
      <div class="note-text">${noteMarkup}</div>
    </div>
  `;
}

function renderHomeView() {
  const container = document.getElementById(VIEW_HOME);
  const records = getVisibleRecords();
  const moduleStats = getModuleStats(records);
  const { roots, lookup } = buildKnowledgeTree(records);
  state.treeLookups.home = lookup;

  container.innerHTML = `
    ${renderHomeReportCard(records, moduleStats)}
    <section class="panel home-tree-card">
      ${renderFilterStrip("home-filter-strip")}
      <div class="home-tree-panel">
        ${roots.length ? renderTree(roots, "home") : renderEmptyState("当前筛选下暂无待练错题", "调整录入时间，或先进入模块报告查看其他模块。")}
        ${renderStubbornNote(records, { plain: true })}
      </div>
    </section>
    <div class="cta-stack home-cta-stack">
      <button class="primary-button" type="button" data-action="start-all">开始复练全部错题</button>
      <p class="note-text">ⓘ此模式下，全模块错题随机混合训练</p>
    </div>
  `;
}

function renderHomeReportCard(records, moduleStats) {
  return `
    <section class="chart-card hero-chart home-report-card">
      <h2 class="home-report-title">错题报告</h2>
      <div class="home-chart-shell">
        <div class="chart-wrap home-chart-wrap">
          ${renderPieSvg(moduleStats, 148, { showPercentages: true, minLabelRatio: 0.08 })}
          <div class="chart-center">
            <strong class="chart-total">${records.length}</strong>
            <span class="caption">当前错题</span>
          </div>
        </div>
        <div class="chart-legend home-chart-legend">
          ${renderLegendItems(moduleStats)}
        </div>
      </div>
      <div class="home-focus-row">
        <button class="focus-button home-focus-button" type="button" data-action="open-focus">重点复练</button>
      </div>
      <div class="button-grid home-module-grid">
        ${MODULE_ORDER.map((module) => `
          <button class="module-button home-module-button" type="button" data-action="open-module-report" data-module="${module}">
            <strong>${escapeHTML(module)}</strong>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPieSvg(data, size, options = {}) {
  const { showPercentages = false, minLabelRatio = 0 } = options;
  if (!data.length) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 12}" fill="#fff" stroke="#efcfb0" stroke-width="2"></circle>
      </svg>
    `;
  }

  const radius = size / 2 - 12;
  const center = size / 2;
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let startAngle = -Math.PI / 2;

  const segments = data.map((item, index) => {
    const currentStart = startAngle;
    const ratio = item.count / total;
    const endAngle = currentStart + ratio * Math.PI * 2;
    const path = describeArcSlice(center, center, radius, currentStart, endAngle);
    const stroke = resolveChartColor(item.module || item.label, index);
    const fill = colorWithAlpha(stroke, 0.14);
    const midAngle = currentStart + (endAngle - currentStart) / 2;
    const showLabel = showPercentages && ratio >= minLabelRatio;
    const labelPoint = showLabel ? polarToCartesian(center, center, radius * 0.76, midAngle) : null;
    const labelMarkup = showLabel
      ? `<text x="${labelPoint.x.toFixed(2)}" y="${labelPoint.y.toFixed(2)}" class="pie-percent-label" text-anchor="middle" dominant-baseline="central">${Math.round(ratio * 100)}%</text>`
      : "";
    startAngle = endAngle;
    return `
      <g>
        <path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"></path>
        ${labelMarkup}
      </g>
    `;
  });

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="#ffffff" stroke="#efcfb0" stroke-width="1.5"></circle>
      ${segments.join("")}
      <circle cx="${center}" cy="${center}" r="${radius * 0.46}" fill="#fffaf5" stroke="#efcfb0" stroke-width="1.5"></circle>
    </svg>
  `;
}

function renderStubbornNote(records, options = {}) {
  const { plain = false } = options;
  const stubbornCount = getStubbornCount(records);
  if (!records.length || (!plain && !stubbornCount)) {
    return "";
  }
  const noteMarkup = "顽固错题定义：在错题复练中再次做错累计达到 3 次及以上。";
  if (plain) {
    return `<p class="note-text stubborn-note-inline">ⓘ${noteMarkup}</p>`;
  }
  return `
    <div class="stubborn-note">
      <div class="note-text">${noteMarkup}</div>
    </div>
  `;
}

function getPageMeta() {
  switch (state.currentView) {
    case VIEW_ENTRY_GATE:
      return {
        title: "上一页",
        showBack: true,
        showExport: false,
      };
    case VIEW_MODULE_REPORT:
      return {
        title: "模块报告",
        showBack: true,
        showExport: true,
      };
    case VIEW_FOCUS:
      return {
        title: "重点复练",
        showBack: true,
        showExport: true,
      };
    case VIEW_SETTINGS:
      return {
        title: "训练设置",
        showBack: true,
        showExport: false,
      };
    case VIEW_PRACTICE:
      return {
        title: state.session?.mode === PRACTICE_MODE.QUIZ ? "做题模式" : "背题模式",
        showBack: true,
        showExport: false,
      };
    case VIEW_ANSWER_SHEET:
      return {
        title: "答题卡",
        showBack: true,
        showExport: false,
      };
    case VIEW_ANALYSIS:
      return {
        title: "逐题解析",
        showBack: true,
        showExport: false,
      };
    case VIEW_RESULT:
      return {
        title: "练习报告",
        showBack: true,
        showExport: false,
      };
    case VIEW_EXPORT:
      return {
        title: "导出 PDF",
        showBack: true,
        showExport: false,
      };
    case VIEW_HOME:
    default:
      return {
        title: "错题训练",
        showBack: true,
        showExport: true,
      };
  }
}

function goBack() {
  if (state.history.length) {
    state.currentView = state.history.pop();
    renderApp();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (state.currentView === VIEW_HOME) {
    navigateTo(VIEW_ENTRY_GATE, { replace: true });
    return;
  }

  if (state.currentView === VIEW_ENTRY_GATE) {
    navigateTo(VIEW_HOME, { replace: true });
    return;
  }

  navigateTo(VIEW_HOME, { replace: true });
}

function renderEntryGateView() {
  const container = document.getElementById(VIEW_ENTRY_GATE);
  container.innerHTML = `
    <section class="panel entry-gate-card">
      <p class="caption">进入错题训练前置页占位</p>
      <h2 class="section-title">已返回上一级页面</h2>
      <p class="note-text">当前原型还没有接入真实来源页，这里先作为首页返回的承接页。</p>
      <button class="primary-button" type="button" data-action="go-home">进入错题训练</button>
    </section>
  `;
}

function renderHomeView() {
  const container = document.getElementById(VIEW_HOME);
  const records = getVisibleRecords();
  const moduleStats = getModuleStats(records);
  const { roots, lookup } = buildKnowledgeTree(records);
  state.treeLookups.home = lookup;

  container.innerHTML = `
    ${renderHomeReportCard(records, moduleStats)}
    <section class="panel home-tree-card">
      ${renderFilterStrip("home-filter-strip")}
      <div class="home-tree-panel">
      ${roots.length ? renderTree(roots, "home") : renderEmptyState("当前筛选下暂无待练错题", "调整录入时间，或先进入模块报告查看其他模块。")}
        ${renderStubbornNote(records, { plain: true })}
      </div>
    </section>
    <div class="cta-stack home-cta-stack">
      <button class="primary-button" type="button" data-action="start-all">开始复练全部错题</button>
      <p class="note-text">ⓘ此模式下，全模块错题随机混合训练</p>
    </div>
  `;
}

function renderFocusView() {
  const container = document.getElementById(VIEW_FOCUS);
  const focusRecords = getFocusRecords();
  const moduleStats = getModuleStats(focusRecords);
  const recommendations = getRecommendedModules(getModuleStats(getVisibleRecords()));
  const { roots, lookup } = buildKnowledgeTree(focusRecords);
  state.treeLookups.focus = lookup;

  container.innerHTML = `
    <section class="panel">
      <div class="tree-header">
        <h2 class="section-title">重点复练池/h2>
        <span class="caption">错频最高、顽固错题和手动加入的题会汇总到这里</span>
      </div>
      <div class="status-strip">
        <span>当前重点复练题数</span>
        <strong>${focusRecords.length} 道</strong>
      </div>
    </section>
    ${renderFilterStrip()}
    <section class="chart-card hero-chart">
      <h2 class="chart-title">重点复练按模块分布/h2>
      ${moduleStats.length
        ? renderPiePanel({
            title: "重点复练统计",
            data: moduleStats,
            total: focusRecords.length,
            centerCaption: "重点复练",
          })
        : renderEmptyState("还没有重点复练题", "做错累计达到 3 次，或手动加入后会进入这里。")}
    </section>
    ${recommendations.length ? `
      <section class="panel">
        <div class="tree-header">
          <h2 class="section-title">重点复练推荐</h2>
          <span class="caption">优先回到这些模块知识树，继续按层级选练</span>
        </div>
        <div class="recommend-list">
          ${recommendations.map((item) => `
            <button class="recommend-button" type="button" data-action="open-home-module" data-module="${item.module}">
              <span class="recommend-copy">
                <strong>${escapeHTML(item.module)}</strong>
                <span>错题高发模块，点击后进入对应知识树/span>
              </span>
              <span class="legend-value">${item.count} 道</span>
            </button>
          `).join("")}
        </div>
      </section>
    ` : ""}
    <section class="panel">
      <div class="tree-header">
        <h2 class="section-title">按知识树挑范围/h2>
        <span class="caption">页面仍按知识树组织，不平铺题目/span>
      </div>
      ${roots.length ? renderTree(roots, "focus") : renderEmptyState("当前重点复练池为空", "先在解析页点击“加入重点复练”，或继续做错题复练。")}
      ${renderStubbornNote(focusRecords)}
    </section>
  `;
}

function renderHomeReportCard(records, moduleStats) {
  return `
    <section class="chart-card hero-chart home-report-card">
      <h2 class="home-report-title">错题报告</h2>
      <p class="home-chart-heading">全行测错题统计/p>
      <div class="home-chart-shell">
        <div class="chart-wrap home-chart-wrap">
          ${renderPieSvg(moduleStats, 148)}
          <div class="chart-center">
            <strong class="chart-total">${records.length}</strong>
            <span class="caption">当前错题</span>
          </div>
          <button class="focus-button home-focus-button" type="button" data-action="open-focus">重点复练</button>
        </div>
        <div class="chart-legend home-chart-legend">
          ${renderLegendItems(moduleStats)}
        </div>
      </div>
      <div class="button-grid home-module-grid">
        ${MODULE_ORDER.map((module) => `
          <button class="module-button home-module-button" type="button" data-action="open-module-report" data-module="${module}">
            <strong>${escapeHTML(module)}</strong>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPiePanel({ title, data, total, centerCaption, rightAction = "" }) {
  return `
    <div class="stack">
      <div class="tree-header">
        <h3 class="chart-title small">${escapeHTML(title)}</h3>
        ${rightAction || ""}
      </div>
      <div class="chart-shell">
        <div class="chart-wrap">
          ${renderPieSvg(data, 168)}
          <div class="chart-center">
            <strong class="chart-total">${total}</strong>
            <span class="caption">${escapeHTML(centerCaption)}</span>
          </div>
        </div>
        <div class="chart-legend">
          ${renderLegendItems(data)}
        </div>
      </div>
    </div>
  `;
}

function renderLegendItems(data) {
  return data.map((item, index) => `
    <div class="legend-item">
      <span class="legend-dot" style="color: ${resolveChartColor(item.module || item.label, index)}"></span>
      <span class="legend-label">${escapeHTML(item.label)}</span>
      <span class="legend-value">${item.count} 道</span>
    </div>
  `).join("");
}

function renderPieSvg(data, size) {
  if (!data.length) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 12}" fill="#fff" stroke="#efcfb0" stroke-width="2"></circle>
      </svg>
    `;
  }

  const radius = size / 2 - 12;
  const center = size / 2;
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let startAngle = -Math.PI / 2;

  const segments = data.map((item, index) => {
    const ratio = item.count / total;
    const endAngle = startAngle + ratio * Math.PI * 2;
    const path = describeArcSlice(center, center, radius, startAngle, endAngle);
    const stroke = resolveChartColor(item.module || item.label, index);
    const fill = colorWithAlpha(stroke, 0.14);
    startAngle = endAngle;
    return `<path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"></path>`;
  });

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="#ffffff" stroke="#efcfb0" stroke-width="1.5"></circle>
      ${segments.join("")}
      <circle cx="${center}" cy="${center}" r="${radius * 0.46}" fill="#fffaf5" stroke="#efcfb0" stroke-width="1.5"></circle>
    </svg>
  `;
}

function getChartPalette() {
  return [
    "#EB8A2F",
    "#D96C5F",
    "#7D93E8",
    "#5E9A8B",
    "#AF6FAE",
    "#8DA94E",
    "#D2A33A",
    "#6990B8",
  ];
}

function resolveChartColor(key, index = 0) {
  const palette = getChartPalette();
  if (key && MODULE_ORDER.includes(key)) {
    return palette[MODULE_ORDER.indexOf(key) % palette.length];
  }
  const hashIndex = Math.abs(hashString(String(key || index))) % palette.length;
  return palette[hashIndex];
}

function renderFilterStrip(extraClass = "") {
  const className = extraClass ? `filter-strip ${extraClass}` : "filter-strip";
  return `
    <section class="${className}" aria-label="训练筛选栏">
      <label class="filter-pill">
        <span class="filter-pill-title">录入时间</span>
        <select data-action="change-time-filter">
          <option value="all" ${state.filters.time === "all" ? "selected" : ""}>不限</option>
          <option value="7" ${state.filters.time === "7" ? "selected" : ""}>7天内</option>
          <option value="30" ${state.filters.time === "30" ? "selected" : ""}>30天内</option>
          <option value="custom" ${state.filters.time === "custom" ? "selected" : ""}>自定义</option>
        </select>
      </label>
      <label class="filter-pill">
        <span class="filter-pill-title">练习顺序</span>
        <select data-action="change-order-filter">
          <option value="latest" ${state.filters.order === "latest" ? "selected" : ""}>最近录入</option>
          <option value="earliest" ${state.filters.order === "earliest" ? "selected" : ""}>最早录入</option>
          <option value="random" ${state.filters.order === "random" ? "selected" : ""}>随机</option>
        </select>
      </label>
      <button class="filter-pill filter-pill-button filter-pill-direct" type="button" data-action="open-settings">
        <span class="filter-pill-title">训练设置</span>
      </button>
    </section>
  `;
}

function renderStubbornNote(records, options = {}) {
  const { plain = false } = options;
  const stubbornCount = getStubbornCount(records);
  if (!records.length || (!plain && !stubbornCount)) {
    return "";
  }
  const noteMarkup = "顽固错题定义：在错题复练中再次做错累计达到 3 次及以上。";
  if (plain) {
    return `<p class="note-text stubborn-note-inline">ⓘ${noteMarkup}</p>`;
  }
  return `
    <div class="stubborn-note">
      <div class="note-text">${noteMarkup}</div>
    </div>
  `;
}

