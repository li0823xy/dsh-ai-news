/**
 * dsh-ai-news — browser half (AI search version)
 *
 * Five-section panel (LLM / Agent / AI creation trends / AI hot topics /
 * manju short drama). Data is fetched only via the refresh button (POST
 * /api/ai-news/refresh); the panel otherwise reads the cached news.json.
 * Clicking an item expands an AI summary, generated once per URL and cached.
 * Plain DOM, no React. Loaded via window.__ModuleLoader__.load().
 */

window.__ModuleLoader__.load({
  id: '@custom/dsh-ai-news',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    /** Required services — none; pure DOM client, only ctx.effect is used */
    exports.inject = [];

    /** Section order + labels (mirrors the host half). */
    const SECTIONS = [
      { id: 'llm', label: '大语言模型' },
      { id: 'agent', label: 'Agent' },
      { id: 'creation', label: 'AI 内容创作趋势' },
      { id: 'hot', label: 'AI 圈热点' },
      { id: 'manju', label: '漫剧' },
    ];

    /** Inline CSS for the plugin */
    const CSS = `
      .dsh-ai-news-entry {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 8px 12px;
        background: transparent;
        border: none;
        color: var(--dsw-alias-label-secondary, #e0e0e0);
        cursor: pointer;
        transition: background 0.15s;
        font-size: 14px;
        text-align: left;
      }
      .dsh-ai-news-entry:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.05));
        color: var(--dsw-alias-label-primary, #fff);
      }
      .dsh-ai-news-entry[data-active="true"] {
        background: var(--dsw-alias-interactive-bg-active, rgba(255,255,255,0.1));
        color: var(--dsw-alias-label-primary, #fff);
        font-weight: 600;
      }
      .dsh-ai-news-entry-icon { margin-right: 8px; flex-shrink: 0; display: inline-flex; }
      .dsh-ai-news-entry-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      [data-pane="conversation"], [class*="centerCol"] { position: relative; }
      .dsh-ai-news-view {
        z-index: 60;
        background: var(--dsw-alias-bg-base, #1a1a1a);
        color: var(--dsw-alias-label-primary, #e0e0e0);
        display: none;
        position: absolute;
        inset: 0;
        overflow: hidden;
      }
      html[data-dsh-ai-news-active] .dsh-ai-news-view { display: flex; flex-direction: column; }
      html[data-dsh-ai-news-active] [data-pane="conversation"] > *:not([data-dsh-ai-news-view]),
      html[data-dsh-ai-news-active] [class*="centerCol"] > *:not([data-dsh-ai-news-view]) {
        display: none !important;
      }
      .dsh-ai-news-header {
        flex: none;
        padding: 18px 22px 14px;
        border-bottom: 1px solid var(--dsw-alias-border-l1, #333);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .dsh-ai-news-title h2 { margin: 0 0 4px 0; font-size: 19px; }
      .dsh-ai-news-updated { font-size: 12px; color: var(--dsw-alias-label-secondary, #888); }
      .dsh-ai-news-refresh {
        flex: none;
        padding: 8px 16px;
        background: var(--dsw-alias-button-info-fill, #2a6dd4);
        color: var(--dsw-alias-label-primary-foreground, #fff);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
      }
      .dsh-ai-news-refresh:hover:not(:disabled) { background: var(--dsw-alias-button-info-hover, #1f5cb8); }
      .dsh-ai-news-refresh:disabled { opacity: 0.55; cursor: not-allowed; }
      .dsh-ai-news-actions { flex: none; display: flex; align-items: center; gap: 8px; }
      .dsh-ai-news-window {
        flex: none;
        padding: 7px 10px;
        background: var(--dsw-alias-bg-layer-2, #232323);
        color: var(--dsw-alias-label-primary, #e0e0e0);
        border: 1px solid var(--dsw-alias-border-l2, #444);
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        outline: none;
      }
      .dsh-ai-news-window:hover { border-color: var(--dsw-alias-state-business-primary, #6ea8fe); }
      .dsh-ai-news-tabs {
        flex: none;
        display: flex;
        gap: 6px;
        padding: 12px 22px 0;
        overflow-x: auto;
        border-bottom: 1px solid var(--dsw-alias-border-l1, #333);
      }
      .dsh-ai-news-tab {
        flex: none;
        padding: 7px 14px;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        border-radius: 6px 6px 0 0;
        color: var(--dsw-alias-label-secondary, #aaa);
        cursor: pointer;
        font-size: 13px;
        white-space: nowrap;
      }
      .dsh-ai-news-tab:hover { color: var(--dsw-alias-label-primary, #fff); background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.05)); }
      .dsh-ai-news-tab.active { color: var(--dsw-alias-label-primary, #fff); border-bottom-color: var(--dsw-alias-state-business-primary, #3b82f6); font-weight: 600; }
      .dsh-ai-news-content { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 22px 22px; }
      .dsh-ai-news-list { display: flex; flex-direction: column; gap: 10px; }
      .dsh-ai-news-item {
        border: 1px solid var(--dsw-alias-border-l1, #333);
        border-radius: 10px;
        background: var(--dsw-alias-bg-layer-2, #232323);
        overflow: hidden;
      }
      .dsh-ai-news-item-head {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        cursor: pointer;
      }
      .dsh-ai-news-item-head:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.04)); }
      .dsh-ai-news-item-title { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; line-height: 1.4; }
      .dsh-ai-news-item-title a { color: inherit; text-decoration: none; }
      .dsh-ai-news-item-title a:hover { text-decoration: underline; color: var(--dsw-alias-state-business-primary, #6ea8fe); }
      .dsh-ai-news-item-chevron { flex: none; color: var(--dsw-alias-label-tertiary, #777); font-size: 12px; padding-top: 2px; transition: transform 0.15s; }
      .dsh-ai-news-item.open .dsh-ai-news-item-chevron { transform: rotate(90deg); }
      .dsh-ai-news-item-snippet { padding: 0 14px 10px; font-size: 12.5px; line-height: 1.5; color: var(--dsw-alias-label-secondary, #aaa); }
      .dsh-ai-news-item-body { border-top: 1px solid var(--dsw-alias-border-l1, #333); padding: 12px 14px; font-size: 13px; line-height: 1.6; }
      .dsh-ai-news-item-body .dsh-ai-news-gen { color: var(--dsw-alias-label-tertiary, #999); font-size: 12px; }
      .dsh-ai-news-item-body .dsh-ai-news-origin { margin-top: 8px; font-size: 12px; word-break: break-all; }
      .dsh-ai-news-item-body .dsh-ai-news-origin a { color: var(--dsw-alias-state-business-primary, #6ea8fe); text-decoration: none; }
      .dsh-ai-news-item-body .dsh-ai-news-origin a:hover { text-decoration: underline; }
      .dsh-ai-news-manju-block { margin-top: 10px; border-radius: 8px; background: var(--dsw-alias-bg-base, rgba(0,0,0,0.2)); padding: 10px 12px; }
      .dsh-ai-news-manju-block .dsh-ai-news-mlabel { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
      .dsh-ai-news-manju-block p { margin: 0 0 8px; font-size: 12.5px; line-height: 1.6; }
      .dsh-ai-news-manju-block p:last-child { margin-bottom: 0; }
      .dsh-ai-news-empty, .dsh-ai-news-loading, .dsh-ai-news-error { text-align: center; padding: 40px 20px; color: var(--dsw-alias-label-tertiary, #888); font-size: 13px; }
      .dsh-ai-news-error { color: var(--dsw-alias-state-error-primary, #f87171); }
    `;

    /** Panel controller (shared by sidebar entry and panel). */
    class PanelController {
      constructor() {
        this.panelOpen = false;
        this.listeners = [];
      }
      toggle() {
        this.panelOpen = !this.panelOpen;
        this.notify();
      }
      close() {
        if (this.panelOpen) {
          this.panelOpen = false;
          this.notify();
        }
      }
      subscribe(listener) {
        this.listeners.push(listener);
        return () => {
          const idx = this.listeners.indexOf(listener);
          if (idx >= 0) this.listeners.splice(idx, 1);
        };
      }
      notify() {
        for (const listener of this.listeners) listener();
      }
    }

    /** Mount the sidebar entry row. */
    function mountSidebarEntry(controller) {
      const ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M5 5.5h6M5 8h4M5 10.5h5"/></svg>';
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.setAttribute('data-dsh-ai-news-entry', '');
      entry.setAttribute('data-dsh-plugin', 'ai-news');
      entry.setAttribute('data-dsh-part', 'sidebar-entry');
      entry.className = 'dsh-ai-news-entry';
      entry.setAttribute('aria-label', 'AI 新闻');
      entry.innerHTML = '<span class="dsh-ai-news-entry-icon">' + ICON + '</span><span class="dsh-ai-news-entry-label">AI 新闻</span>';
      entry.addEventListener('click', () => controller.toggle());

      const applyActive = () => {
        if (controller.panelOpen) entry.dataset.active = 'true';
        else delete entry.dataset.active;
      };
      const unsubscribe = controller.subscribe(applyActive);
      applyActive();

      const waitObserver = new MutationObserver(() => {
        const column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]');
        if (!column) return;
        const root = column.querySelector('[class*="logoRow"]')?.parentElement || column.firstElementChild;
        if (!root || root.contains(entry)) return;
        const button = root.querySelector('button[class*="newSession"]');
        if (!button) return;
        const logoRow = button.closest('[class*="logoRow"]');
        const base = (logoRow && logoRow.parentElement === root) ? logoRow : button;
        root.insertBefore(entry, base.nextElementSibling);
      });
      waitObserver.observe(document.body, { childList: true, subtree: true });

      return () => {
        waitObserver.disconnect();
        unsubscribe();
        entry.remove();
      };
    }

    /** Mount the news panel. */
    function mountPanel(controller) {
      let container = undefined;
      const state = {
        currentTab: 'llm',
        timeWindow: 'month',   // 'day' | 'week' | 'month'
        data: null,            // { fetchedAt, sections }
        summaries: {},         // url -> { summary, reason?, takeaway? }
        expanded: {},          // url -> true
        loading: false,        // refresh in progress
        error: null,
      };

      const TIME_WINDOW_OPTIONS = [
        { id: 'day', label: '今天' },
        { id: 'week', label: '最近一周' },
        { id: 'month', label: '最近一个月' },
      ];

      function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
      }

      function formatTime(iso) {
        if (!iso) return '';
        try {
          const d = new Date(iso);
          const pad = (n) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch {
          return '';
        }
      }

      async function loadNews() {
        try {
          const response = await fetch('/api/ai-news', { cache: 'no-store' });
          const json = await response.json();
          if (!json.ok) throw new Error(json.error || '加载失败');
          state.data = { fetchedAt: json.fetchedAt, sections: json.sections || {} };
          state.summaries = json.summaries || {};
          state.error = null;
        } catch (error) {
          state.error = error.message;
        }
        render();
      }

      function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

      async function fetchJson(url) {
        const response = await fetch(url, { cache: 'no-store' });
        const json = await response.json();
        if (!json.ok) throw new Error(json.error || '请求失败');
        return json;
      }

      /**
       * Refresh is async on the host: POST returns immediately, the search runs
       * in the background. We poll GET /api/ai-news until fetchedAt changes so
       * the long search never hangs the browser request, and the list updates
       * automatically when done.
       */
      async function refreshNews() {
        if (state.loading) return;
        state.loading = true;
        state.error = null;
        render();
        try {
          const resp = await fetch('/api/ai-news/refresh', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ window: state.timeWindow }),
            cache: 'no-store',
          });
          const json = await resp.json();
          if (!json.ok) throw new Error(json.error || '刷新失败');
          const previousFetchedAt = state.data?.fetchedAt || null;
          const deadline = Date.now() + 150000; // up to 150s
          let done = false;
          while (Date.now() < deadline) {
            await sleep(4000);
            let polled;
            try {
              polled = await fetchJson('/api/ai-news');
            } catch {
              continue; // transient; keep polling
            }
            if (polled.fetchedAt && polled.fetchedAt !== previousFetchedAt) {
              state.data = { fetchedAt: polled.fetchedAt, sections: polled.sections || {} };
              state.summaries = polled.summaries || {};
              done = true;
              break;
            }
          }
          if (!done) {
            // Timed out waiting; fall back to whatever the server has now.
            try {
              const latest = await fetchJson('/api/ai-news');
              state.data = { fetchedAt: latest.fetchedAt, sections: latest.sections || {} };
              state.summaries = latest.summaries || {};
            } catch {
              /* keep old data */
            }
          }
        } catch (error) {
          state.error = `刷新失败: ${error.message}`;
        }
        state.loading = false;
        render();
      }

      async function toggleItem(url, title, snippet, manju, open) {
        if (!open) {
          delete state.expanded[url];
          render();
          return;
        }
        state.expanded[url] = true;
        render();
        // Cached already? nothing to fetch.
        if (state.summaries[url]) return;
        try {
          const response = await fetch('/api/ai-news/summary', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url, title, snippet, manju }),
          });
          const json = await response.json();
          if (!json.ok) throw new Error(json.error || '摘要生成失败');
          state.summaries[url] = json.summary;
        } catch (error) {
          state.summaries[url] = { summary: `（摘要生成失败：${error.message}）` };
        }
        render();
      }

      function renderItem(item) {
        const isManju = item.section === 'manju';
        const open = !!state.expanded[item.url];
        const cached = state.summaries[item.url];
        const urlAttr = escapeHtml(item.url);
        const titleHtml = escapeHtml(item.title || '（无标题）');

        let bodyHtml = '';
        if (open) {
          if (!cached) {
            bodyHtml = '<div class="dsh-ai-news-item-body"><span class="dsh-ai-news-gen">正在生成摘要…</span></div>';
          } else {
            const summary = cached.summary ? escapeHtml(cached.summary) : '';
            let manjuHtml = '';
            if (isManju && (cached.reason || cached.takeaway)) {
              manjuHtml = '<div class="dsh-ai-news-manju-block">'
                + (cached.reason ? `<p><div class="dsh-ai-news-mlabel">🔥 爆款原因</div>${escapeHtml(cached.reason)}</p>` : '')
                + (cached.takeaway ? `<p><div class="dsh-ai-news-mlabel">💡 值得借鉴</div>${escapeHtml(cached.takeaway)}</p>` : '')
                + '</div>';
            }
            bodyHtml = `<div class="dsh-ai-news-item-body">
              <span class="dsh-ai-news-gen">AI 摘要</span>
              <p style="margin:6px 0 0">${summary}</p>
              ${manjuHtml}
              <div class="dsh-ai-news-origin">🔗 原文：<a href="${urlAttr}" target="_blank" rel="noopener noreferrer">${urlAttr}</a></div>
            </div>`;
          }
        }

        return `<div class="dsh-ai-news-item${open ? ' open' : ''}">
          <div class="dsh-ai-news-item-head" data-url="${urlAttr}" data-title="${titleHtml}" data-snippet="${escapeHtml(item.snippet || '')}" data-manju="${isManju ? '1' : ''}">
            <div class="dsh-ai-news-item-title">${titleHtml}</div>
            <div class="dsh-ai-news-item-chevron">▶</div>
          </div>
          ${item.snippet ? `<div class="dsh-ai-news-item-snippet">${escapeHtml(item.snippet)}</div>` : ''}
          ${bodyHtml}
        </div>`;
      }

      function render() {
        if (!container) return;
        const sections = state.data?.sections || {};
        const currentItems = sections[state.currentTab] || [];
        const tabLabels = SECTIONS.map((s) => s.id === state.currentTab
          ? `<button class="dsh-ai-news-tab active" data-tab="${s.id}">${escapeHtml(s.label)}</button>`
          : `<button class="dsh-ai-news-tab" data-tab="${s.id}">${escapeHtml(s.label)}</button>`).join('');

        const hasData = !!(state.data && state.data.fetchedAt);
        let contentHtml;
        if (state.error && !hasData) {
          contentHtml = `<div class="dsh-ai-news-error">❌ ${escapeHtml(state.error)}</div>`;
        } else if (!hasData) {
          contentHtml = state.loading
            ? `<div class="dsh-ai-news-loading">正在首次搜索各板块热点…（约需 25~40 秒）</div>`
            : `<div class="dsh-ai-news-empty">还没有数据。点击右上角「刷新」获取最新热点（会消耗少量 DeepSeek 额度）。</div>`;
        } else if (currentItems.length === 0) {
          contentHtml = `<div class="dsh-ai-news-empty">该板块暂无结果，试试点击「刷新」。</div>`;
        } else {
          contentHtml = `<div class="dsh-ai-news-list">${currentItems.map(renderItem).join('')}</div>`;
        }

        const updated = hasData
          ? `上次刷新：${formatTime(state.data.fetchedAt)}`
          : '尚未刷新';
        const refreshingNote = state.loading ? ' · 🔄 后台搜索中，完成后自动更新' : ' · 点「刷新」才会重新搜索（消耗额度）';

        const windowOptions = TIME_WINDOW_OPTIONS.map((w) =>
          `<option value="${w.id}" ${state.timeWindow === w.id ? 'selected' : ''}>${escapeHtml(w.label)}</option>`).join('');

        container.innerHTML = `
          <div class="dsh-ai-news-header">
            <div class="dsh-ai-news-title">
              <h2>📰 AI 热点</h2>
              <div class="dsh-ai-news-updated">${updated}${refreshingNote}</div>
            </div>
            <div class="dsh-ai-news-actions">
              <select class="dsh-ai-news-window" data-window title="时间范围">${windowOptions}</select>
              <button class="dsh-ai-news-refresh" data-refresh ${state.loading ? 'disabled' : ''}>${state.loading ? '搜索中…' : '🔄 刷新'}</button>
            </div>
          </div>
          <div class="dsh-ai-news-tabs">${tabLabels}</div>
          <div class="dsh-ai-news-content">${contentHtml}</div>
        `;

        container.querySelector('[data-refresh]')?.addEventListener('click', refreshNews);
        container.querySelector('[data-window]')?.addEventListener('change', (e) => {
          state.timeWindow = e.target.value;
        });
        container.querySelectorAll('[data-tab]').forEach((btn) => {
          btn.addEventListener('click', () => {
            state.currentTab = btn.dataset.tab;
            render();
          });
        });
        container.querySelectorAll('[data-url]').forEach((head) => {
          head.addEventListener('click', () => {
            const url = head.dataset.url;
            const title = head.dataset.title;
            const snippet = head.dataset.snippet;
            const manju = head.dataset.manju === '1';
            toggleItem(url, title, snippet, manju, !state.expanded[url]);
          });
        });
      }

      function ensure() {
        if (container && container.isConnected) return;
        const column = document.querySelector('[data-pane="conversation"], [class*="centerCol"]');
        if (!column) return;
        container = document.createElement('div');
        container.setAttribute('data-dsh-ai-news-view', '');
        container.setAttribute('data-dsh-plugin', 'ai-news');
        container.className = 'dsh-ai-news-view';
        column.appendChild(container);
        render();
        loadNews();
      }

      const applyActive = () => {
        if (controller.panelOpen) {
          document.documentElement.setAttribute('data-dsh-ai-news-active', '');
          document.documentElement.removeAttribute('data-dsh-taskboard-active');
        } else {
          document.documentElement.removeAttribute('data-dsh-ai-news-active');
        }
      };
      const onSidebarClick = (e) => {
        if (!controller.panelOpen) return;
        const target = e.target;
        if (target.closest && target.closest('[class*="sessionRow"], [class*="projectRow"], [class*="newSession"]')) {
          controller.close();
        }
      };
      const waitObserver = new MutationObserver(() => ensure());
      waitObserver.observe(document.body, { childList: true, subtree: true });
      document.addEventListener('click', onSidebarClick, true);
      const unsubscribe = controller.subscribe(applyActive);
      applyActive();
      ensure();

      return () => {
        waitObserver.disconnect();
        document.removeEventListener('click', onSidebarClick, true);
        unsubscribe();
        document.documentElement.removeAttribute('data-dsh-ai-news-active');
        if (container) container.remove();
      };
    }

    /** Inject CSS once. */
    function injectCSS() {
      const style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);
      return () => style.remove();
    }

    /** Plugin apply function. */
    exports.apply = function (ctx) {
      const disposers = [];
      try {
        disposers.push(injectCSS());
        const controller = new PanelController();
        disposers.push(mountSidebarEntry(controller));
        disposers.push(mountPanel(controller));
      } catch (error) {
        console.warn('[dsh-ai-news] mount failed:', error);
      }
      ctx.effect(() => () => {
        for (const dispose of disposers) dispose();
      }, 'dsh-ai-news: ui');
    };

    return module.exports;
  },
});
