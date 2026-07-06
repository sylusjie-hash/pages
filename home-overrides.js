"use strict";

function ensureExtendedTreeLookups() {
  if (!state.treeLookups) {
    state.treeLookups = {};
  }
  if (!(state.treeLookups.home instanceof Map)) {
    state.treeLookups.home = new Map();
  }
  if (!(state.treeLookups.focus instanceof Map)) {
    state.treeLookups.focus = new Map();
  }
  if (!(state.treeLookups.moduleReport instanceof Map)) {
    state.treeLookups.moduleReport = new Map();
  }
}

function resetHomeTreeExpansion() {
  if (!state || !(state.expandedKeys instanceof Set)) {
    return;
  }
  state.expandedKeys = new Set();
}

function resetModuleTreeExpansion() {
  if (!state || !(state.expandedKeys instanceof Set)) {
    return;
  }
  state.expandedKeys = new Set();
}

function resetFocusTreeExpansion() {
  if (!state || !(state.expandedKeys instanceof Set)) {
    return;
  }
  state.expandedKeys = new Set();
}

function navigateTo(viewId, options = {}) {
  const {
    replace = false,
    scrollToTop = true,
    preserveHomeExpansion = false,
    preserveModuleExpansion = false,
    preserveFocusExpansion = false,
  } = options;

  if (state.currentView === VIEW_SETTINGS && viewId !== VIEW_SETTINGS) {
    discardSettingsDraft();
  }

  if (state.currentView !== viewId && !replace) {
    state.history.push(state.currentView);
  }

  if (viewId === VIEW_HOME && !preserveHomeExpansion) {
    resetHomeTreeExpansion();
  }

  if (viewId === VIEW_MODULE_REPORT && !preserveModuleExpansion) {
    resetModuleTreeExpansion();
  }

  if (viewId === VIEW_FOCUS && !preserveFocusExpansion) {
    resetFocusTreeExpansion();
  }

  state.currentView = viewId;
  renderApp();
  if (scrollToTop) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function goBack() {
  if (state.history.length) {
    const nextView = state.history.pop();
    if (state.currentView === VIEW_SETTINGS) {
      discardSettingsDraft();
    }
    if (nextView === VIEW_HOME) {
      resetHomeTreeExpansion();
    }
    if (nextView === VIEW_MODULE_REPORT) {
      resetModuleTreeExpansion();
    }
    if (nextView === VIEW_FOCUS) {
      resetFocusTreeExpansion();
    }
    state.currentView = nextView;
    renderApp();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (state.currentView === VIEW_HOME) {
    navigateTo(VIEW_ENTRY_GATE, { replace: true });
    return;
  }

  if (state.currentView === VIEW_ENTRY_GATE) {
    resetHomeTreeExpansion();
    navigateTo(VIEW_HOME, { replace: true });
    return;
  }

  if (state.currentView === VIEW_SETTINGS) {
    discardSettingsDraft();
  }
  resetHomeTreeExpansion();
  navigateTo(VIEW_HOME, { replace: true });
}

function bindHomeBackOverride() {
  const backButton = document.getElementById("backButton");
  if (!backButton || backButton.dataset.homeBackBound === "true") {
    return;
  }
  backButton.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      goBack();
    },
    true
  );
  backButton.dataset.homeBackBound = "true";
}

function openHomeModule(module) {
  if (!module) {
    return;
  }
  state.expandedKeys = new Set([makeNodeKey(module, [])]);
  navigateTo(VIEW_HOME, { preserveHomeExpansion: true });
}

function renderHomeView() {
  ensureExtendedTreeLookups();
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
      <button class="primary-button home-all-button" type="button" data-action="start-all">开始复练全部错题</button>
      <p class="note-text">ⓘ此模式下，全模块错题随机混合训练</p>
    </div>
  `;
}

function renderHomeReportCard(records, moduleStats) {
  return `
    <section class="chart-card hero-chart home-report-card">
      <div class="home-report-head">
        <h2 class="home-report-title">错题报告</h2>
      </div>
      <div class="home-report-body">
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
          <p class="note-text home-focus-note">ⓘ包括错频最高、顽固错题和手动加入的题目</p>
        </div>
        <div class="button-grid home-module-grid">
          ${MODULE_ORDER.map((module) => `
            <button class="module-button home-module-button" type="button" data-action="open-module-report" data-module="${module}">
              <strong>${escapeHTML(module)}</strong>
            </button>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderModuleReportView() {
  ensureExtendedTreeLookups();
  const container = document.getElementById(VIEW_MODULE_REPORT);
  const module = state.moduleReport;
  if (!module) {
    container.innerHTML = renderEmptyState("还没有选中模块", "从首页点击模块入口后，会进入对应的模块报告页。");
    return;
  }

  const allRecords = getVisibleRecords();
  const moduleRecords = allRecords.filter((record) => getQuestion(record.questionId)?.module === module);
  const tagStats = getModuleTagStats(moduleRecords);
  const { roots, lookup } = buildKnowledgeTree(moduleRecords);
  state.treeLookups.moduleReport = lookup;

  const moduleRoot = roots.find((item) => item.module === module) || null;
  const visibleNodes = moduleRoot ? moduleRoot.children : [];

  container.innerHTML = `
    ${renderModuleReportCard(module, tagStats)}
    <section class="panel home-tree-card module-tree-card">
      ${renderFilterStrip("home-filter-strip module-filter-strip")}
      <div class="home-tree-panel module-tree-panel">
        ${visibleNodes.length ? renderTree(visibleNodes, "moduleReport") : renderEmptyState("当前筛选下暂无该模块错题", "调整录入时间，或切换其他模块继续查看。")}
        ${renderStubbornNote(moduleRecords, { plain: true })}
      </div>
    </section>
  `;
}

function renderModuleReportCard(module, tagStats) {
  return `
    <section class="chart-card hero-chart module-report-card">
      <div class="module-report-head">
        <h2 class="module-report-title">${escapeHTML(module)}错题统计</h2>
      </div>
      <div class="module-report-body">
        ${tagStats.length
          ? `
            <div class="module-chart-shell">
              <div class="chart-wrap module-chart-wrap">
                ${renderPieSvg(tagStats, 152, { showPercentages: true, minLabelRatio: 0.08 })}
                <div class="chart-center module-chart-center">
                  <strong class="module-chart-label">${escapeHTML(module)}</strong>
                </div>
              </div>
              <div class="chart-legend module-chart-legend">
                ${renderLegendItems(tagStats)}
              </div>
            </div>
          `
          : renderEmptyState(`${module}当前没有可统计错题`, "调整筛选条件，或返回首页切换其他模块。")}
      </div>
    </section>
  `;
}

function renderFocusView() {
  ensureExtendedTreeLookups();
  const container = document.getElementById(VIEW_FOCUS);
  const focusRecords = getFocusRecords();
  const moduleStats = getModuleStats(focusRecords);
  const recommendations = getRecommendedModules(moduleStats);
  const { roots, lookup } = buildKnowledgeTree(focusRecords);
  state.treeLookups.focus = lookup;

  container.innerHTML = `
    ${renderFocusReportCard(moduleStats, recommendations)}
    <section class="panel home-tree-card focus-tree-card">
      ${renderFilterStrip("home-filter-strip focus-filter-strip")}
      <div class="home-tree-panel focus-tree-panel">
        ${roots.length ? renderTree(roots, "focus") : renderEmptyState("当前重点复练池为空", "先在解析页点击“加入重点复练”，或继续做错题复练。")}
        ${renderStubbornNote(focusRecords, { plain: true })}
      </div>
    </section>
  `;
}

function renderFocusReportCard(moduleStats, recommendations) {
  return `
    <section class="chart-card hero-chart focus-report-card">
      <div class="focus-report-head">
        <h2 class="focus-report-title">重点复练统计</h2>
      </div>
      <div class="focus-report-body">
        ${moduleStats.length
          ? `
            <div class="focus-chart-shell">
              <div class="chart-wrap focus-chart-wrap">
                ${renderPieSvg(moduleStats, 152, { showPercentages: true, minLabelRatio: 0.08 })}
                <div class="chart-center focus-chart-center">
                  <strong class="focus-chart-label">重点复练</strong>
                </div>
              </div>
              <div class="chart-legend focus-chart-legend">
                ${renderLegendItems(moduleStats)}
              </div>
            </div>
          `
          : renderEmptyState("还没有重点复练题", "做错累计达到 3 次，或手动加入后会进入这里。")}
        ${recommendations.length ? `
          <div class="focus-recommend-panel">
            <h3 class="focus-recommend-title">重点复练推荐</h3>
            <div class="focus-recommend-list">
              ${recommendations.map((item, index) => `
                <div class="focus-recommend-item">
                  <span class="focus-recommend-rank">${index + 1}</span>
                  <span class="focus-recommend-name">${escapeHTML(item.module)}</span>
                  <span class="focus-recommend-count">${item.count} 道</span>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}
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

function startFromTreeNode(treeType, key) {
  ensureExtendedTreeLookups();
  let lookup = state.treeLookups.home;
  if (treeType === "focus") {
    lookup = state.treeLookups.focus;
  }
  if (treeType === "moduleReport") {
    lookup = state.treeLookups.moduleReport;
  }

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

function returnToKnowledgeTree() {
  if (state.session?.sourceTree === "focus") {
    navigateTo(VIEW_FOCUS);
    return;
  }
  if (state.session?.sourceTree === "moduleReport") {
    navigateTo(VIEW_MODULE_REPORT);
    return;
  }
  navigateTo(VIEW_HOME);
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

ensureExtendedTreeLookups();
resetHomeTreeExpansion();
bindHomeBackOverride();

if (typeof renderApp === "function") {
  renderApp();
}
