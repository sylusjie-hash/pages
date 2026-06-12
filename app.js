const states = {
  standard: {
    indexLabel: '步骤 1 / 4',
    summary: '标准判断',
    progress: '18%',
    badge: '标准判断',
    title: '先判断作答步骤是否符合标准动作',
    lead:
      '系统先读取题目结构化信息，再检查用户有没有在题型识别、概念边界或标准步骤上偏离。',
    snapshot: '步骤判断中',
    prompt:
      '题目：定义判断。用户把“看起来像”直接当成“符合定义”，系统先不下结论，而是检查作答顺序。',
    focus: [
      '先核对题型，再核对标准动作，不直接看答案',
      '把“相似”与“符合”分开判断，避免外观误导',
      '确认是否先复述题干条件，再进入选项比对',
    ],
    cause: '待锁定：步骤是否偏离',
    advice: '提示：先复述题干条件，再进入选项比对',
    question: '你判断这道题时，先核对概念边界，还是先看选项外观？',
    action: '下一次先按题干条件复述一遍，再去排除干扰项。',
    practice: '重新做 1 道同类题，要求先说出标准动作再答题。',
    tags: ['标准动作', '题型识别', '步骤核对'],
    threadTop: '系统先做标准动作判断，不直接给结论。',
    threadUser: '用户：我先看选项，感觉 B 很像。',
    threadResult: '当前偏差：把“相似”当成“符合”，进入追问。',
  },
  question: {
    indexLabel: '步骤 2 / 4',
    summary: '追问锁因',
    progress: '46%',
    badge: '追问锁因',
    title: '通过短问题把模糊偏差收敛成可解释错因',
    lead:
      '追问要短、准、可答，目标不是继续讲题，而是确认用户究竟卡在审题、方法还是步骤。',
    snapshot: '追问中',
    prompt:
      '系统提示：如果你先看选项，那是为了验证题干条件，还是为了直接找“像答案”的选项？',
    focus: [
      '追问只问一个点，避免一次问太多',
      '围绕作答顺序和判断依据继续收窄错因',
      '把偏差归入可解释分类，而不是停留在表面现象',
    ],
    cause: '锁定错因：审题偏差',
    advice: '建议：先把题干条件说完整，再做选项比对',
    question: '你是漏看了“否定条件”，还是先入为主选了看起来最像的项？',
    action: '补做一遍同类题，先把条件逐条念出来再作答。',
    practice: '用口述方式复述条件，确认自己是否真正理解边界。',
    tags: ['审题偏差', '追问收敛', '可解释分类'],
    threadTop: '系统根据用户回答锁定错因标签。',
    threadUser: '用户：我没先核对条件，直接凭感觉选了最像的。',
    threadResult: '错因收敛为“审题偏差”，继续输出针对性点拨。',
  },
  advice: {
    indexLabel: '步骤 3 / 4',
    summary: '点拨输出',
    progress: '74%',
    badge: '点拨输出',
    title: '把诊断结果转成用户能执行的改进动作',
    lead:
      '点拨不是单纯讲解析，而是明确告诉用户“错因是什么”和“下次怎么改”，让建议能直接被执行。',
    snapshot: '点拨已输出',
    prompt:
      '系统结论：本题不是不会，而是作答顺序错了。先看选项导致你把相似当成了正确。',
    focus: [
      '输出一句话结论，帮用户快速抓住错因',
      '给出一个下一次可直接照做的动作',
      '点拨内容要支持后面的复练验证',
    ],
    cause: '错因标签：审题偏差 + 顺序错位',
    advice: '纠错动作：先复述条件，再排除干扰项，最后回到主规则',
    question: '下次遇到相似选项，你先做哪一步？',
    action: '先复述题干条件，再用主规则逐项排除。',
    practice: '复练时强制自己先说出判断口令，再开始看选项。',
    tags: ['纠错建议', '答题口令', '主规则优先'],
    threadTop: '系统已经把错因转成可执行建议。',
    threadUser: '用户：原来我不是不会，是顺序搞反了。',
    threadResult: '输出统一点拨：先条件后选项，先规则后相似。',
  },
  practice: {
    indexLabel: '步骤 4 / 4',
    summary: '复练验证',
    progress: '100%',
    badge: '复练验证',
    title: '让修正动作在同类题里再次被验证',
    lead:
      '复练不是重复刷题，而是验证用户是否真的改掉了原来的偏差，并让结果沉淀到后续优化里。',
    snapshot: '诊断完成',
    prompt:
      '复练任务：重新做 1 道同类定义判断题，先复述条件，再判断是否存在否定或例外。',
    focus: [
      '复练同类题，验证修正动作是否生效',
      '观察用户是否能主动说出标准动作',
      '把结果记录下来，为后续优化提供数据',
    ],
    cause: '诊断结果：已完成闭环验证',
    advice: '下一步：继续复盘高频错因，扩大可解释分类范围',
    question: '你能先把题干条件复述一遍，再开始做题吗？',
    action: '继续用同样的口令完成下一题，确认二次正确率是否提升。',
    practice: '本轮复练通过后，系统记录结果并进入持续优化。',
    tags: ['复练验证', '二次正确率', '结果沉淀'],
    threadTop: '系统记录结果并进入后续优化。',
    threadUser: '用户：这次我先念条件，再去看选项。',
    threadResult: '复练成功，闭环完成，进入结果沉淀。',
  },
};

const stateTabs = Array.from(document.querySelectorAll('[data-state-tab]'));
const panel = document.querySelector('[data-diagnosis-panel]');

if (panel && stateTabs.length) {
  const fields = {
    indexLabel: document.querySelector('[data-state-step-label]'),
    summary: document.querySelector('[data-state-summary]'),
    progress: document.querySelector('[data-state-progress]'),
    badge: panel.querySelector('[data-state-badge]'),
    title: panel.querySelector('[data-state-title]'),
    lead: panel.querySelector('[data-state-lead]'),
    snapshot: panel.querySelector('[data-state-snapshot]'),
    prompt: panel.querySelector('[data-state-prompt]'),
    focus: panel.querySelector('[data-state-focus]'),
    cause: panel.querySelector('[data-state-cause]'),
    advice: panel.querySelector('[data-state-advice]'),
    question: panel.querySelector('[data-state-question]'),
    action: panel.querySelector('[data-state-action]'),
    practice: panel.querySelector('[data-state-practice]'),
    tags: panel.querySelector('[data-state-tags]'),
    threadTop: panel.querySelector('[data-thread-top]'),
    threadUser: panel.querySelector('[data-thread-user]'),
    threadResult: panel.querySelector('[data-thread-result]'),
  };

  const setState = (key) => {
    const state = states[key];
    if (!state) return;

    stateTabs.forEach((tab) => {
      const active = tab.dataset.state === key;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });

    if (fields.indexLabel) fields.indexLabel.textContent = state.indexLabel;
    if (fields.summary) fields.summary.textContent = state.summary;
    if (fields.progress) fields.progress.style.width = state.progress;
    if (fields.badge) fields.badge.textContent = state.badge;
    if (fields.title) fields.title.textContent = state.title;
    if (fields.lead) fields.lead.textContent = state.lead;
    if (fields.snapshot) fields.snapshot.textContent = state.snapshot;
    if (fields.prompt) fields.prompt.textContent = state.prompt;
    if (fields.cause) fields.cause.textContent = state.cause;
    if (fields.advice) fields.advice.textContent = state.advice;
    if (fields.question) fields.question.textContent = state.question;
    if (fields.action) fields.action.textContent = state.action;
    if (fields.practice) fields.practice.textContent = state.practice;
    if (fields.threadTop) fields.threadTop.textContent = state.threadTop;
    if (fields.threadUser) fields.threadUser.textContent = state.threadUser;
    if (fields.threadResult) fields.threadResult.textContent = state.threadResult;

    if (fields.focus) {
      fields.focus.replaceChildren(
        ...state.focus.map((text) => {
          const li = document.createElement('li');
          li.textContent = text;
          return li;
        })
      );
    }

    if (fields.tags) {
      fields.tags.replaceChildren(
        ...state.tags.map((text) => {
          const li = document.createElement('li');
          li.className = 'tag';
          li.textContent = text;
          return li;
        })
      );
    }
  };

  const moveFocus = (currentIndex, direction) => {
    const nextIndex = (currentIndex + direction + stateTabs.length) % stateTabs.length;
    const nextTab = stateTabs[nextIndex];
    nextTab.focus();
    setState(nextTab.dataset.state);
  };

  stateTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setState(tab.dataset.state));
    tab.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveFocus(index, 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveFocus(index, -1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        stateTabs[0].focus();
        setState(stateTabs[0].dataset.state);
      } else if (event.key === 'End') {
        event.preventDefault();
        stateTabs[stateTabs.length - 1].focus();
        setState(stateTabs[stateTabs.length - 1].dataset.state);
      }
    });
  });

  setState('standard');
}
