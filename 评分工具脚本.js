(function () {
  const API_BASE = (window.SURVEY_API_BASE || "").replace(/\/$/, "");
  const API_TOKEN = window.SURVEY_API_TOKEN || "";
  const DRAFT_KEY = "paper-review-draft-v1";
  const REVIEWER_KEY = "paper-review-last-reviewer";

  const MAX_SCORES = {
    question_quality: 30,
    analysis_quality: 25,
    standardization: 15,
    difficulty: 10,
    structure: 10,
    simulation: 10,
  };

  const SCORE_LABELS = {
    question_quality: "试题质量",
    analysis_quality: "解析质量",
    standardization: "规范性",
    difficulty: "难度设计",
    structure: "结构合理性",
    simulation: "仿真度",
  };

  const ISSUE_THRESHOLDS = {
    question_quality: 20,
    analysis_quality: 16,
    standardization: 10,
    difficulty: 7,
    structure: 7,
    simulation: 7,
  };

  const MOBILE_SCORE_CONFIG = {
    question_quality: {
      title: "1. 试题质量",
      max: 30,
      ranges: [
        ["26 - 30 分", "题目整体质量高，考点设置合理，符合考试要求，无明显偏题怪题，训练价值强。"],
        ["20 - 25 分", "总体合格，个别题目在考点选择、设问方式或区分度上存在轻微问题，但不影响整卷使用。"],
        ["10 - 19 分", "存在较明显问题，如部分题目偏题、设问价值不高、考查点不典型，影响卷面质量。"],
        ["0 - 9 分", "题目整体质量较差，明显偏离模拟卷要求，不建议使用。"],
      ],
      focus: [
        "是否符合考试大纲和命题范围。",
        "是否考查核心能力，而非偏题、怪题、冷门题。",
        "是否具备合理区分度。",
        "是否能够体现选拔性或训练价值。",
        "是否与目标考试风格一致。",
      ],
    },
    analysis_quality: {
      title: "2. 解析质量",
      max: 25,
      ranges: [
        ["21 - 25 分", "解析完整清晰，逻辑严密，能准确呈现解题过程与命题意图，具有较强教学价值。"],
        ["16 - 20 分", "整体较好，个别解析略简略或层次不够充分，但能够支撑正常使用。"],
        ["8 - 15 分", "解析存在明显缺漏，推导不充分，部分题目解释不到位，影响理解和教学使用。"],
        ["0 - 7 分", "解析质量较差，仅给出结论或存在错误说明，无法满足使用要求。"],
      ],
      focus: [
        "是否有完整的分析过程，而非只给答案。",
        "是否能够解释错误选项或常见误区。",
        "表述是否准确、易懂、适合教学使用。",
        "是否能体现方法总结与思路迁移。",
      ],
    },
    standardization: {
      title: "3. 规范性",
      max: 15,
      ranges: [
        ["13 - 15 分", "题干、选项、解析、标点和格式整体规范统一，无明显书写或排版错误。"],
        ["10 - 12 分", "整体较规范，存在少量格式或表述小问题，但不影响整体使用。"],
        ["5 - 9 分", "存在较明显格式、术语或排版问题，降低整体专业感和使用体验。"],
        ["0 - 4 分", "规范性较差，格式混乱或错误较多，不建议直接使用。"],
      ],
      focus: [
        "题干和选项格式是否统一。",
        "术语、标点、数字及符号使用是否规范。",
        "解析排版是否整齐，编号是否清楚。",
      ],
    },
    difficulty: {
      title: "4. 难度设计",
      max: 10,
      ranges: [
        ["9 - 10 分", "整体难度定位准确，题目梯度合理，能够体现训练层次和区分效果。"],
        ["7 - 8 分", "难度总体可接受，但局部存在偏易或偏难情况，影响不大。"],
        ["4 - 6 分", "难度设计不够平衡，存在明显断层或局部失衡，影响整体体验。"],
        ["0 - 3 分", "难度设计明显失真，不符合目标使用场景。"],
      ],
      focus: [
        "整体难度是否符合目标考试或训练定位。",
        "题目梯度是否自然，是否有断层。",
        "是否兼顾基础、中档和提升层次。",
      ],
    },
    structure: {
      title: "5. 结构合理性",
      max: 10,
      ranges: [
        ["9 - 10 分", "题型分布、顺序安排和整体编排合理，卷面结构完整自然。"],
        ["7 - 8 分", "整体结构较合理，局部编排略可优化，但不影响正常使用。"],
        ["4 - 6 分", "结构存在不协调问题，如题型排序、数量分布或节奏感不佳。"],
        ["0 - 3 分", "结构混乱，整体逻辑不顺，明显影响使用体验。"],
      ],
      focus: [
        "模块顺序是否合理。",
        "题型、题量和节奏分布是否协调。",
        "整卷结构是否符合常规使用习惯。",
      ],
    },
    simulation: {
      title: "6. 仿真度",
      max: 10,
      ranges: [
        ["9 - 10 分", "题感、材料、设问和风格高度贴近目标考试，仿真效果好。"],
        ["7 - 8 分", "整体较贴近真题风格，个别题目或材料存在轻微偏差。"],
        ["4 - 6 分", "仿真度一般，部分题目题感偏离目标考试，真实感不足。"],
        ["0 - 3 分", "明显偏离目标考试风格，不具备较好的模拟训练价值。"],
      ],
      focus: [
        "是否贴近目标考试风格。",
        "材料与设问是否有真实考试质感。",
        "是否具备较强模拟和训练价值。",
      ],
    },
  };

  function hasValidApiBase() {
    return API_BASE && !/YOUR_LINUX_SERVER_IP/i.test(API_BASE);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function roundScore(value) {
    return Math.round(value * 100) / 100;
  }

  function getToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function showBanner(node, message, type) {
    if (!node) return;
    node.textContent = message;
    node.className = `status-banner show ${type}`;
  }

  function buildQuery(params) {
    const query = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      if (params[key]) query.set(key, params[key]);
    });
    return query.toString();
  }

  function clampScore(key, value) {
    const max = MAX_SCORES[key];
    if (!Number.isFinite(value)) return 0;
    return Math.min(Math.max(value, 0), max);
  }

  async function safeJson(response) {
    try {
      return await response.json();
    } catch (_error) {
      return null;
    }
  }

  function request(path, options) {
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(API_TOKEN ? { "X-API-Token": API_TOKEN } : {}),
        ...(options && options.headers ? options.headers : {}),
      },
    }).then(async (response) => {
      if (!response.ok) {
        const data = await safeJson(response);
        throw new Error((data && data.error) || `请求失败（${response.status}）`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return response.json();
      }
      return response;
    });
  }

  function renderMobileScoreCards() {
    const root = document.querySelector("#mobile-score-grid");
    if (!root) return;
    root.innerHTML = Object.keys(MOBILE_SCORE_CONFIG)
      .map((key) => {
        const item = MOBILE_SCORE_CONFIG[key];
        return `
          <article class="mobile-score-card">
            <div class="mobile-score-head">
              <h3 class="mobile-score-title">${item.title}</h3>
              <span class="mobile-score-max">满分 ${item.max} 分</span>
            </div>
            <div class="mobile-score-body">
              <div class="mobile-score-input-box">
                <label>实际得分</label>
                <input class="mobile-score-input" data-mobile-score="${key}" type="number" min="0" max="${item.max}" step="0.5" value="0" />
              </div>
              <div>
                <span class="mobile-section-title">判定标准</span>
                <div class="mobile-score-range-list">
                  ${item.ranges
                    .map(
                      (range) => `
                        <div class="mobile-score-range-item">
                          <strong>${range[0]}</strong>
                          <p>${escapeHtml(range[1])}</p>
                        </div>
                      `
                    )
                    .join("")}
                </div>
              </div>
              <div>
                <span class="mobile-section-title">问题说明</span>
                <textarea class="mobile-score-comment" data-mobile-comment="${key}" placeholder="说明扣分点在哪，如果个题出现问题，可明确标注"></textarea>
              </div>
              <div>
                <span class="mobile-section-title">评分关注点</span>
                <ol class="mobile-focus-list">
                  ${item.focus.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}
                </ol>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function getScoreTotal(form) {
    return Object.keys(MAX_SCORES).reduce((sum, key) => {
      const input = form.querySelector(`[name="${key}_score"]`);
      const value = Number(input && input.value ? input.value : 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  }

  function serializeForm(form) {
    const payload = {
      paper_name: "",
      batch: form.batch.value.trim(),
      paper_id: form.paper_id.value.trim(),
      module: form.module.value.trim(),
      reviewer: form.reviewer.value.trim(),
      review_date: form.review_date.value.trim(),
      scores: {},
      total_score: roundScore(getScoreTotal(form)),
      result: {
        is_pass: form.is_pass.value,
        veto: form.veto.value === "true",
        suggestion: form.suggestion.value.trim(),
      },
    };

    Object.keys(MAX_SCORES).forEach((key) => {
      payload.scores[key] = {
        score: clampScore(key, Number(form[`${key}_score`].value || 0)),
        comment: form[`${key}_comment`].value.trim(),
      };
    });

    if (payload.result.veto) {
      payload.result.is_pass = "不合格";
    }
    payload.total_score = roundScore(
      Object.values(payload.scores).reduce((sum, item) => sum + Number(item.score || 0), 0)
    );
    return payload;
  }

  function saveDraft(form) {
    const payload = serializeForm(form);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    if (payload.reviewer) {
      localStorage.setItem(REVIEWER_KEY, payload.reviewer);
    }
  }

  function loadDraft() {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    } catch (_error) {
      return null;
    }
  }

  function setValue(form, name, value) {
    const field = form[name];
    if (!field || value == null) return;
    field.value = value;
  }

  function hydrateForm(form, payload) {
    if (!payload) return;
    setValue(form, "batch", payload.batch);
    setValue(form, "paper_id", payload.paper_id);
    setValue(form, "module", payload.module);
    setValue(form, "reviewer", payload.reviewer);
    setValue(form, "review_date", payload.review_date);
    setValue(form, "suggestion", payload.result && payload.result.suggestion);
    setValue(form, "is_pass", payload.result && payload.result.is_pass);
    setValue(form, "veto", String(Boolean(payload.result && payload.result.veto)));

    Object.keys(MAX_SCORES).forEach((key) => {
      const item = (payload.scores || {})[key] || {};
      setValue(form, `${key}_score`, item.score);
      setValue(form, `${key}_comment`, item.comment);
    });
  }

  function refreshTotal(form) {
    const total = roundScore(getScoreTotal(form));
    const totalNode = document.querySelector("[data-total-score]");
    if (totalNode) {
      totalNode.textContent = total.toFixed(total % 1 === 0 ? 0 : 2);
    }
    if (form.total_score) {
      form.total_score.value = String(total);
    }
  }

  function bindScoreInputs(form) {
    Object.keys(MAX_SCORES).forEach((key) => {
      const desktopScoreInput = form[`${key}_score`];
      const desktopCommentInput = form[`${key}_comment`];
      const mobileScoreInput = document.querySelector(`[data-mobile-score="${key}"]`);
      const mobileCommentInput = document.querySelector(`[data-mobile-comment="${key}"]`);

      if (!desktopScoreInput || !desktopCommentInput) return;

      const syncScore = (source) => {
        const normalized = clampScore(key, Number(source.value || 0));
        desktopScoreInput.value = normalized;
        if (mobileScoreInput) mobileScoreInput.value = normalized;
        refreshTotal(form);
      };

      const syncComment = (source) => {
        const value = source.value || "";
        desktopCommentInput.value = value;
        if (mobileCommentInput) mobileCommentInput.value = value;
      };

      desktopScoreInput.addEventListener("input", () => syncScore(desktopScoreInput));
      desktopScoreInput.addEventListener("blur", () => syncScore(desktopScoreInput));
      desktopCommentInput.addEventListener("input", () => syncComment(desktopCommentInput));

      if (mobileScoreInput) {
        mobileScoreInput.addEventListener("input", () => syncScore(mobileScoreInput));
        mobileScoreInput.addEventListener("blur", () => syncScore(mobileScoreInput));
      }
      if (mobileCommentInput) {
        mobileCommentInput.addEventListener("input", () => syncComment(mobileCommentInput));
      }

      syncScore(desktopScoreInput);
      syncComment(desktopCommentInput);
    });
  }

  function bindAutoSave(form, statusBanner) {
    let timer = null;
    form.addEventListener("input", () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        saveDraft(form);
        showBanner(statusBanner, "草稿已保存在当前浏览器，可继续填写。", "info");
      }, 250);
    });
  }

  function validatePayload(payload) {
    const missing = [];
    if (!payload.paper_id) missing.push("编号");
    if (!payload.reviewer) missing.push("审核人员");
    if (!payload.review_date) missing.push("审核日期");
    if (!payload.result.is_pass) missing.push("审核结论");

    Object.keys(MAX_SCORES).forEach((key) => {
      const score = Number(payload.scores[key].score);
      if (!Number.isFinite(score)) {
        missing.push(`${SCORE_LABELS[key]}得分`);
      }
    });

    return missing;
  }

  function bindFormPage() {
    const form = document.querySelector("#paper-review-form");
    if (!form) return;

    const banner = document.querySelector("#form-status");
    const storedReviewer = localStorage.getItem(REVIEWER_KEY) || "";

    renderMobileScoreCards();

    form.review_date.value = getToday();
    if (storedReviewer) {
      form.reviewer.value = storedReviewer;
    }

    hydrateForm(form, loadDraft());
    if (!form.review_date.value) {
      form.review_date.value = getToday();
    }

    bindScoreInputs(form);
    bindAutoSave(form, banner);
    refreshTotal(form);

    form.veto.addEventListener("change", () => {
      if (form.veto.value === "true") {
        form.is_pass.value = "不合格";
      }
      saveDraft(form);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = serializeForm(form);
      const missing = validatePayload(payload);

      if (missing.length) {
        showBanner(banner, `请先补充必填项：${missing.join("、")}`, "error");
        return;
      }

      if (!hasValidApiBase()) {
        showBanner(
          banner,
          "当前还没有配置可用的 API 地址。请先修改评分工具接口配置.js 里的服务器地址，再提交到后端。",
          "error"
        );
        return;
      }

      try {
        showBanner(banner, "正在提交评分，请稍候……", "info");
        const result = await request("/api/reviews", {
          method: "POST",
          body: JSON.stringify({ payload }),
        });
        localStorage.removeItem(DRAFT_KEY);
        localStorage.setItem(REVIEWER_KEY, payload.reviewer);
        showBanner(
          banner,
          `提交成功，记录编号 #${result.id || ""}。你现在可以打开管理后台查看汇总结果。`,
          "info"
        );
      } catch (error) {
        showBanner(banner, error.message || "提交失败，请稍后重试。", "error");
      }
    });

    const clearBtn = document.querySelector("[data-action='clear-draft']");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        localStorage.removeItem(DRAFT_KEY);
        form.reset();
        form.review_date.value = getToday();
        if (storedReviewer) {
          form.reviewer.value = storedReviewer;
        }
        form.veto.value = "false";
        form.is_pass.value = "合格";
        document.querySelectorAll("[data-mobile-score]").forEach((node) => {
          node.value = "0";
        });
        document.querySelectorAll("[data-mobile-comment]").forEach((node) => {
          node.value = "";
        });
        refreshTotal(form);
        showBanner(banner, "本地草稿已清空。", "info");
      });
    }
  }

  function getStatusBadge(status) {
    if (status === "合格") return "success";
    if (status === "待修改") return "warning";
    return "danger";
  }

  function getScoreLevel(total) {
    if (Number(total) >= 85) return "good";
    if (Number(total) >= 70) return "mid";
    return "bad";
  }

  function getIssueDimensions(record) {
    const scores = record.scores || {};
    return Object.keys(SCORE_LABELS).filter((key) => {
      const score = Number((scores[key] || {}).score || 0);
      return score < ISSUE_THRESHOLDS[key];
    });
  }

  function toCommentList(record, issueKeys) {
    const scores = record.scores || {};
    const items = issueKeys
      .map((key) => {
        const comment = (scores[key] || {}).comment || "";
        return comment ? `${SCORE_LABELS[key]}：${comment}` : "";
      })
      .filter(Boolean);
    return items.length ? items : ["暂无单独问题说明"];
  }

  function renderCardList(records) {
    const root = document.querySelector("#review-card-list");
    if (!root) return;

    if (!records.length) {
      root.innerHTML = `<div class="card-empty">当前筛选条件下还没有评分记录。</div>`;
      return;
    }

    root.innerHTML = records
      .map((item) => {
        const result = item.result || {};
        const issues = getIssueDimensions(item);
        const scores = item.scores || {};
        const total = Number(item.total_score || 0);
        const comments = toCommentList(item, issues);

        return `
          <article class="review-card" data-review-id="${item._id}">
            <div class="review-card-top">
              <div>
                <h3 class="review-card-title">${escapeHtml(item.paper_name || item.paper_id || "-")}</h3>
                <div class="review-card-meta">
                  批次：${escapeHtml(item.batch || "-")} ｜ 编号：${escapeHtml(item.paper_id || "-")} ｜ 学科模块：${escapeHtml(item.module || "-")} ｜ 审核人：${escapeHtml(item.reviewer || "-")} ｜ ${escapeHtml(item.review_date || "-")}
                </div>
              </div>
              <div class="score-pill ${getScoreLevel(total)}">
                <strong>${total}</strong>
                <span>总分</span>
              </div>
            </div>
            <div class="review-card-badges">
              <span class="badge ${getStatusBadge(result.is_pass)}">${escapeHtml(result.is_pass || "-")}</span>
              <span class="badge ${result.veto ? "danger" : "primary"}">${result.veto ? "一票否决" : "无一票否决"}</span>
            </div>
            <div class="issue-block">
              <div class="issue-title">问题维度</div>
              <div class="issue-tags">
                ${
                  issues.length
                    ? issues.map((key) => `<span class="issue-tag">${SCORE_LABELS[key]} ↓</span>`).join("")
                    : '<span class="issue-tag ok">无明显问题</span>'
                }
              </div>
            </div>
            <div class="mini-bars">
              <div class="issue-title">六维评分</div>
              <div class="dimension-grid">
                ${Object.keys(SCORE_LABELS)
                  .map((key) => {
                    const score = Number((scores[key] || {}).score || 0);
                    const percent = Math.max(0, Math.min(100, (score / MAX_SCORES[key]) * 100));
                    return `
                      <div class="mini-bar-row">
                        <div class="mini-bar-label">${SCORE_LABELS[key]}${issues.includes(key) ? " !" : ""}</div>
                        <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${percent}%"></div></div>
                        <div class="mini-bar-value">${score}/${MAX_SCORES[key]}</div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>
            <div class="card-expand">
              <button class="card-expand-btn" type="button" data-expand-toggle="${item._id}">展开查看问题说明</button>
              <div class="card-expand-panel" data-expand-panel="${item._id}">
                <div class="expand-block">
                  <strong>问题说明</strong>
                  <ol class="expand-list">
                    ${comments.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}
                  </ol>
                </div>
                <div class="expand-block">
                  <strong>修改建议</strong>
                  <p class="expand-text">${escapeHtml(result.suggestion || "未填写修改建议。")}</p>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderMetrics(records) {
    const metricTotal = document.querySelector("[data-metric='total']");
    const metricAvg = document.querySelector("[data-metric='avg']");
    const metricPass = document.querySelector("[data-metric='pass']");
    const metricVeto = document.querySelector("[data-metric='veto']");
    const total = records.length;
    const avg =
      total === 0
        ? 0
        : roundScore(records.reduce((sum, item) => sum + Number(item.total_score || 0), 0) / total);
    const passCount = records.filter((item) => (item.result || {}).is_pass === "合格").length;
    const vetoCount = records.filter((item) => (item.result || {}).veto).length;

    if (metricTotal) metricTotal.textContent = String(total);
    if (metricAvg) metricAvg.textContent = String(avg);
    if (metricPass) metricPass.textContent = `${total ? Math.round((passCount / total) * 100) : 0}%`;
    if (metricVeto) metricVeto.textContent = String(vetoCount);
  }

  function renderBatchOptions(batches) {
    const select = document.querySelector("#filter-batch");
    if (!select) return;
    const current = select.value;
    const fixedOptions = ["第一批", "第二批", "第三批"];
    const optionList = Array.from(new Set([...fixedOptions, ...(batches || [])]));
    select.innerHTML =
      `<option value="">全部批次</option>` +
      optionList.map((item) => `<option value="${item}">${item}</option>`).join("");
    if (optionList.includes(current)) {
      select.value = current;
    }
  }

  async function bindAdminPage() {
    const adminRoot = document.querySelector("#paper-review-admin");
    if (!adminRoot) return;

    const banner = document.querySelector("#admin-status");
    let recordsCache = [];
    let quickFilter = "all";

    function getFilteredRecords(records) {
      if (quickFilter === "all") return records;
      if (quickFilter === "issues") return records.filter((item) => getIssueDimensions(item).length > 0);
      if (quickFilter === "veto") return records.filter((item) => (item.result || {}).veto);
      return records.filter((item) => (item.result || {}).is_pass === quickFilter);
    }

    function syncQuickFilterButtons() {
      document.querySelectorAll("[data-quick-filter]").forEach((button) => {
        button.classList.toggle("active", button.dataset.quickFilter === quickFilter);
      });
    }

    function paintAdmin(records) {
      const filtered = getFilteredRecords(records);
      renderCardList(filtered);
      renderMetrics(filtered);
    }

    async function loadData() {
      if (!hasValidApiBase()) {
        showBanner(
          banner,
          "当前还没有配置可用的 API 地址。请先修改评分工具接口配置.js 里的服务器地址，再刷新管理页。",
          "error"
        );
        return;
      }

      const batch = document.querySelector("#filter-batch").value;
      const status = document.querySelector("#filter-status").value;
      const keyword = document.querySelector("#filter-keyword").value.trim();

      try {
        showBanner(banner, "正在拉取评分数据……", "info");
        const query = buildQuery({ batch, status, keyword, limit: 500 });
        const data = await request(`/api/reviews?${query}`, { method: "GET" });
        recordsCache = data.records || [];
        renderBatchOptions((data.filters && data.filters.batches) || []);
        paintAdmin(recordsCache);
        showBanner(
          banner,
          `已加载 ${recordsCache.length} 条评分记录，可继续筛选、比较、查看问题说明或导出。`,
          "info"
        );
      } catch (error) {
        showBanner(banner, error.message || "加载失败，请稍后重试。", "error");
      }
    }

    document.querySelector("#filter-form").addEventListener("submit", (event) => {
      event.preventDefault();
      loadData();
    });

    document.querySelector("[data-action='reset-filters']").addEventListener("click", () => {
      document.querySelector("#filter-form").reset();
      quickFilter = "all";
      syncQuickFilterButtons();
      loadData();
    });

    document.querySelector("[data-action='refresh-list']").addEventListener("click", () => {
      loadData();
    });

    document.querySelector("[data-action='export-list']").addEventListener("click", () => {
      if (!hasValidApiBase()) {
        showBanner(banner, "请先配置 API 地址，导出才会生效。", "error");
        return;
      }
      const batch = document.querySelector("#filter-batch").value;
      const status = document.querySelector("#filter-status").value;
      const keyword = document.querySelector("#filter-keyword").value.trim();
      const query = buildQuery({ batch, status, keyword, apiToken: API_TOKEN || "" });
      window.open(`${API_BASE}/api/reviews-export?${query}`, "_blank");
    });

    document.querySelectorAll("[data-quick-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        quickFilter = button.dataset.quickFilter;
        syncQuickFilterButtons();
        paintAdmin(recordsCache);
      });
    });

    document.querySelector("#review-card-list").addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-expand-toggle]");
      if (!toggle) return;
      const panel = document.querySelector(`[data-expand-panel="${toggle.dataset.expandToggle}"]`);
      if (!panel) return;
      const expanded = panel.classList.toggle("show");
      toggle.textContent = expanded ? "收起问题说明" : "展开查看问题说明";
    });

    syncQuickFilterButtons();
    await loadData();
  }

  bindFormPage();
  bindAdminPage();
})();
