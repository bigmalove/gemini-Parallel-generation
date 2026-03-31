(() => {
  'use strict';

  const TAG = '[GeminiParallelSwipe]';
  const PARALLEL_SOURCES = new Set([
    'makersuite',
    'vertexai',
    'openai',
    'custom',
    'openrouter',
    'azure_openai',
  ]);
  const FORCE_SINGLE_FOREGROUND_SOURCES = new Set(['openai', 'custom', 'openrouter', 'azure_openai']);
  const ALLOWED_TYPES = new Set(['normal', 'regenerate', 'continue']);
  const CONFIG_KEY = 'gemini_parallel_swipe_config';
  const STATUS_BAR_POSITION_STORAGE_KEY = 'gemini_parallel_swipe_status_bar_position';
  const STATUS_BAR_STYLE_ID = 'gemini-parallel-status-style';
  const STATUS_BAR_CLASS = 'gemini-parallel-status-bar';
  const STATUS_BAR_TEXT_CLASS = 'gemini-parallel-status-text';
  const STATUS_BAR_DOTS_CLASS = 'gemini-parallel-status-dots';
  const STATUS_BAR_DOT_CLASS = 'gemini-parallel-status-dot';
  const STATUS_BAR_TOGGLE_BUTTON_CLASS = 'gemini-parallel-status-toggle-btn';
  const STATUS_BAR_SETTINGS_BUTTON_CLASS = 'gemini-parallel-status-settings-btn';
  const STATUS_BAR_DRAGGING_CLASS = 'is-dragging';
  const STATUS_BAR_COLLAPSED_CLASS = 'is-collapsed';
  const STATUS_BAR_WORKING_CLASS = 'is-working';
  const STATUS_BAR_SIMPLE_MODE_CLASS = 'is-simple-mode';
  const STATUS_BAR_VERTICAL_CLASS = 'is-vertical';
  const STATUS_BAR_NAV_UP_BUTTON_CLASS = 'gemini-parallel-status-nav-up-btn';
  const STATUS_BAR_NAV_DOWN_BUTTON_CLASS = 'gemini-parallel-status-nav-down-btn';
  const STATUS_BAR_NAV_PRESSING_CLASS = 'is-pressing';
  const SETTINGS_PANEL_CLASS = 'gemini-parallel-settings-panel';
  const SETTINGS_ROW_CLASS = 'gemini-parallel-settings-row';
  const SETTINGS_CHECKBOX_ROW_CLASS = 'gemini-parallel-settings-row-checkbox';
  const SETTINGS_STEPPER_CLASS = 'gemini-parallel-settings-stepper';
  const DEBUG_FLAG_KEY = '__GeminiParallelSwipeDebug';
  const DEFAULT_STATUS_BAR_OPACITY_PERCENT = 100;
  const MIN_STATUS_BAR_OPACITY_PERCENT = 30;
  const MAX_STATUS_BAR_OPACITY_PERCENT = 100;
  const DEFAULT_STATUS_BAR_SCALE_PERCENT = 100;
  const MIN_STATUS_BAR_SCALE_PERCENT = 80;
  const MAX_STATUS_BAR_SCALE_PERCENT = 180;
  const JOB_PHASES = Object.freeze({
    armed: 'armed',
    prefetching: 'prefetching',
    waiting_target: 'waiting_target',
    writing: 'writing',
    done: 'done',
    aborted: 'aborted',
    superseded: 'superseded',
  });
  const DEFAULT_CONFIG = {
    enabled: true,
    max_parallel_cap: 5,
    retry_count: 5,
    retry_delay_ms: 1000,
    min_reply_tokens: 0,
    auction_mode_enabled: false,
    silent_mode_enabled: true,
    parallel_temperatures: [],
    status_bar_position: null,
    status_bar_collapsed: false,
    status_bar_simple_mode: false,
    status_bar_vertical: false,
    status_bar_opacity_percent: DEFAULT_STATUS_BAR_OPACITY_PERCENT,
    status_bar_scale_percent: DEFAULT_STATUS_BAR_SCALE_PERCENT,
    old_floor_swipe_enabled: true,
    worldbook_switcher_enabled: true,
    worldbook_switcher: {
      simpleMode: true,
      favoriteWorldbooks: [],
      currentWorldbook: '',
      entryUsageStats: {},
      panelState: {
        allWorldbooks: false,
        frequentEntries: false,
      },
      pinnedWorldbooks: [],
    },
  };
  const GENERATE_API_PATH = '/api/backends/chat-completions/generate';
  const DEFAULT_429_RETRIES = 5;
  const DEFAULT_429_RETRY_DELAY_MS = 1000;
  const DEFAULT_MIN_REPLY_TOKENS = 0;
  const MAX_RETRY_COUNT = 10;
  const MAX_RETRY_DELAY_MS = 10000;
  const MAX_MIN_REPLY_TOKENS = 4096;
  const AUCTION_FOREGROUND_SETTLE_GRACE_MS = 800;
  const AUCTION_FOREGROUND_UNCERTAIN_SETTLE_GRACE_MS = 1400;
  const MIN_TEMPERATURE = 0;
  const MAX_TEMPERATURE = 2;
  const DEFAULT_PARALLEL_TEMPERATURE = 1.0;
  const FETCH_RETRY_SKIP_FLAG = '__gemini_parallel_retry_handled';
  const FETCH_PATCH_MARKER = '__GeminiParallelSwipeFetchPatched';
  const PAIRED_SWIPE_META_KEY = '__gemini_parallel_pair';
  const PAIRED_SWIPE_STATUS_KEY = '__gemini_parallel_branch_status';
  const PAIRED_SWIPE_PAYLOAD_KEY = '__gemini_parallel_payload_snapshot';
  const PAIRED_SWIPE_PENDING_TEXT = '生成中...';
  const PAIRED_SWIPE_COMPOSER_CLASS = 'gemini-paired-inline-composer';
  const PAIRED_SWIPE_COMPOSER_OPEN_CLASS = 'is-open';
  const PAIRED_SWIPE_USER_CONTAINER_CLASS = 'gemini-paired-user-controls';
  const PAIRED_SWIPE_BRANCH_BUTTON_CLASS = 'gemini-paired-branch-btn';
  const PAIRED_SWIPE_STATUS_TEXT_CLASS = 'gemini-paired-status-text';
  const PAIRED_SWIPE_COMPOSER_TEXTAREA_CLASS = 'gemini-paired-inline-textarea';
  const PAIRED_SWIPE_COMPOSER_ACTIONS_CLASS = 'gemini-paired-inline-actions';
  const PAIRED_SWIPE_COMPOSER_CONFIRM_CLASS = 'gemini-paired-inline-confirm';
  const PAIRED_SWIPE_COMPOSER_CANCEL_CLASS = 'gemini-paired-inline-cancel';
  const PAIRED_SWIPE_COMPOSER_FEEDBACK_CLASS = 'gemini-paired-inline-feedback';
  const PAIRED_SWIPE_PLACEHOLDER_CLASS = 'is-placeholder';
  const PAIRED_SWIPE_ERROR_CLASS = 'is-error';

  const instanceKey = '__GeminiParallelSwipeInstance';
  const globalObj = getHostWindow();

  if (globalObj[instanceKey] && typeof globalObj[instanceKey].destroy === 'function') {
    try {
      globalObj[instanceKey].destroy();
    } catch (error) {
      console.warn(TAG, '清理旧实例失败:', error);
    }
  }

  let config = loadConfig();
  let patchTimer = null;
  let domBindTimer = null;
  let mutationObserver = null;
  let lastGenerationType = 'normal';
  let activeJob = null;
  let jobCounter = 0;
  let generationSequence = 0;
  let statusTrackTimer = null;
  let manualSendLock = false;
  let isSettingsPopupOpening = false;
  let statusBarDragState = null;
  let lastStatusBarToggleAt = 0;
  let statusBarIgnoreToggleUntil = 0;
  let lastNavActionAt = 0;
  let lastNavActionKey = '';
  let navCursorMessageId = null;
  let navCursorUpdatedAt = 0;
  let retryStatusSeq = 0;
  let retryStatusKeySeq = 0;
  let activeForegroundSession = null;
  let internalGenerateRequestInFlight = 0;
  let temporarySuspendSeq = 0;
  const eventStops = [];
  const domCleanups = [];
  const fetchPatchCleanups = [];
  const retryStatusEntries = new Map();
  const navPressFeedbackTimers = new WeakMap();
  const temporarySuspensions = new Map();
  const pairedSwipeStates = new Map();
  const pairedSwipeJobs = new Map();
  const pairedSwipeSyncLocks = new Set();
  let pairedSwipePairSeq = 0;
  let pairedSwipeBranchSeq = 0;
  let pairedSwipeComposerUserMessageId = null;
  let pairedSwipeComposerDraft = '';
  let foregroundGenerationRunning = false;

  function log(...args) {
    console.log(TAG, ...args);
  }

  function warn(...args) {
    console.warn(TAG, ...args);
  }

  function isDebugEnabled() {
    return window[DEBUG_FLAG_KEY] !== false;
  }

  function debug(...args) {
    if (!isDebugEnabled()) return;
    console.log(TAG, '[debug]', ...args);
  }

  function summarizeJob(job) {
    if (!job) return null;
    return {
      id: job.id,
      phase: job.phase,
      state: job.state,
      generationType: job.generationType,
      targetN: job.targetN,
      extraCount: job.extraCount,
      messageId: job.messageId,
      targetMessageId: job.targetMessageId,
      targetMessageIdFromEvent: job.targetMessageIdFromEvent,
      foregroundEnded: Boolean(job.foregroundEnded),
      foregroundStopped: Boolean(job.foregroundStopped),
      parallelCompleted: Boolean(job.parallelCompleted),
      superseded: Boolean(job.superseded),
      aborted: Boolean(job.aborted),
      progress: job.progress
        ? {
            completed: Number(job.progress.completed) || 0,
            total: Number(job.progress.total) || 0,
            success: Number(job.progress.success) || 0,
            failed: Number(job.progress.failed) || 0,
          }
        : null,
      bufferedCount: Array.isArray(job.bufferedTexts) ? job.bufferedTexts.length : 0,
      flushedCount: Number(job.flushedCount) || 0,
      writtenCount: Number(job.writtenCount) || 0,
      writeFailedCount: Number(job.writeFailedCount) || 0,
      auctionEnabled: Boolean(job.auctionEnabled),
      winnerSource: job.winnerSource || null,
      winnerMessageId: Number.isFinite(Number(job.winnerMessageId)) ? Number(job.winnerMessageId) : null,
      winnerWriteDone: Boolean(job.winnerWriteDone),
      pendingWriteCount: Math.max(
        0,
        (Array.isArray(job.bufferedTexts) ? job.bufferedTexts.length : 0) - (Number(job.flushedCount) || 0),
      ),
      writeTargetMode: job.writeTarget?.mode || null,
    };
  }

  function infoToast(message) {
    if (isSilentModeEnabled()) return;
    const hostWindow = getHostWindow();
    if (hostWindow.toastr && typeof hostWindow.toastr.info === 'function') {
      hostWindow.toastr.info(message, 'Gemini并发生成');
    }
  }

  function successToast(message) {
    if (isSilentModeEnabled()) return;
    const hostWindow = getHostWindow();
    if (hostWindow.toastr && typeof hostWindow.toastr.success === 'function') {
      hostWindow.toastr.success(message, 'Gemini并发生成');
    }
  }

  function warningToast(message) {
    if (isSilentModeEnabled()) return;
    const hostWindow = getHostWindow();
    if (hostWindow.toastr && typeof hostWindow.toastr.warning === 'function') {
      hostWindow.toastr.warning(message, 'Gemini并发生成');
    }
  }

  function errorToast(message) {
    if (isSilentModeEnabled()) return;
    const hostWindow = getHostWindow();
    if (hostWindow.toastr && typeof hostWindow.toastr.error === 'function') {
      hostWindow.toastr.error(message, 'Gemini并发生成');
    }
  }

  function getHostWindow() {
    try {
      if (window.parent && window.parent !== window) {
        return window.parent;
      }
    } catch {
      // ignore
    }
    return window;
  }

  function getHostDocument() {
    const hostWindow = getHostWindow();
    if (hostWindow && hostWindow.document) {
      return hostWindow.document;
    }
    return document;
  }

  function getHostLocalStorage() {
    try {
      const hostWindow = getHostWindow();
      if (hostWindow?.localStorage) {
        return hostWindow.localStorage;
      }
    } catch {
      // ignore
    }
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  function getChatContainer() {
    return getHostDocument().querySelector('#chat');
  }

  function formatCssNumber(value, digits = 2) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return num.toFixed(digits).replace(/\.?0+$/, '');
  }

  function formatScaledPx(value, scale, digits = 2) {
    return `${formatCssNumber(Number(value) * Number(scale), digits)}px`;
  }

  function ensureStatusBarStyle() {
    const hostDocument = getHostDocument();
    if (!hostDocument) return false;
    const statusBarOpacity = getConfiguredStatusBarOpacityPercent() / 100;
    const statusBarScale = getConfiguredStatusBarScalePercent() / 100;
    const px = (value, digits = 2) => formatScaledPx(value, statusBarScale, digits);
    const cssText = `
      .${STATUS_BAR_CLASS} {
        position: fixed;
        left: 50%;
        bottom: ${px(6)};
        transform: translateX(-50%);
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        gap: ${px(8)};
        width: max-content;
        max-width: calc(100% - ${px(20)});
        margin: 0;
        min-height: ${px(28)};
        padding: ${px(3)} ${px(12)};
        border-radius: 999px;
        background: rgba(18, 20, 26, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.24);
        color: #f5f7fa;
        font-size: ${px(12)};
        font-weight: 600;
        line-height: 1.2;
        letter-spacing: ${px(0.2)};
        text-shadow: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        pointer-events: auto;
        opacity: ${formatCssNumber(statusBarOpacity)};
        backdrop-filter: blur(${px(2)});
        box-shadow: 0 ${px(1)} ${px(8)} rgba(0, 0, 0, 0.35);
        z-index: 2147483646;
        touch-action: none;
        user-select: none;
        cursor: grab;
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_DRAGGING_CLASS} {
        cursor: grabbing;
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_COLLAPSED_CLASS} {
        min-width: max-content;
        max-width: calc(100% - ${px(20)});
        width: auto;
        padding: ${px(3)} ${px(6)};
        gap: ${px(4)};
        justify-content: center;
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_COLLAPSED_CLASS} .${STATUS_BAR_TEXT_CLASS},
      .${STATUS_BAR_CLASS}.${STATUS_BAR_COLLAPSED_CLASS} .${STATUS_BAR_DOTS_CLASS},
      .${STATUS_BAR_CLASS}.${STATUS_BAR_COLLAPSED_CLASS} .${STATUS_BAR_SETTINGS_BUTTON_CLASS} {
        display: none;
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_COLLAPSED_CLASS} .${STATUS_BAR_TOGGLE_BUTTON_CLASS} {
        pointer-events: auto;
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_WORKING_CLASS}.${STATUS_BAR_COLLAPSED_CLASS} .${STATUS_BAR_TOGGLE_BUTTON_CLASS} {
        border-color: rgba(125, 211, 252, 0.78);
        background: rgba(56, 189, 248, 0.2);
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_WORKING_CLASS}.${STATUS_BAR_COLLAPSED_CLASS}
      .${STATUS_BAR_TOGGLE_BUTTON_CLASS} .gemini-parallel-status-spinner {
        display: inline-block;
        font-size: ${px(13)};
        line-height: 1;
        color: rgba(201, 236, 255, 0.96);
        transform-origin: 50% 50%;
        will-change: transform;
        animation: gemini-parallel-status-spinner-spin 2.4s linear infinite;
      }

      @keyframes gemini-parallel-status-spinner-spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .${STATUS_BAR_CLASS}.${STATUS_BAR_WORKING_CLASS}.${STATUS_BAR_COLLAPSED_CLASS}
        .${STATUS_BAR_TOGGLE_BUTTON_CLASS} .gemini-parallel-status-spinner {
          animation: none;
          transform: none;
        }

        .${STATUS_BAR_NAV_UP_BUTTON_CLASS},
        .${STATUS_BAR_NAV_DOWN_BUTTON_CLASS} {
          transition: none;
        }

        .${STATUS_BAR_NAV_UP_BUTTON_CLASS}.${STATUS_BAR_NAV_PRESSING_CLASS},
        .${STATUS_BAR_NAV_DOWN_BUTTON_CLASS}.${STATUS_BAR_NAV_PRESSING_CLASS} {
          transform: none;
          box-shadow: none;
        }
      }

      .${STATUS_BAR_TOGGLE_BUTTON_CLASS} {
        flex: 0 0 auto;
        width: ${px(22)};
        min-width: ${px(22)};
        height: ${px(22)};
        border: 1px solid rgba(255, 255, 255, 0.28);
        background: rgba(255, 255, 255, 0.08);
        color: #f5f7fa;
        font-size: ${px(12)};
        font-weight: 700;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        cursor: pointer;
      }

      .${STATUS_BAR_TOGGLE_BUTTON_CLASS}:hover {
        background: rgba(255, 255, 255, 0.16);
      }

      .${STATUS_BAR_TEXT_CLASS} {
        display: inline-block;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_VERTICAL_CLASS} {
        flex-direction: column;
        align-items: stretch;
        justify-content: center;
        gap: ${px(6)};
        width: min(${px(140)}, calc(100% - ${px(20)}));
        min-height: auto;
        padding: ${px(8)};
        border-radius: ${px(18)};
        white-space: normal;
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_VERTICAL_CLASS} .${STATUS_BAR_TOGGLE_BUTTON_CLASS},
      .${STATUS_BAR_CLASS}.${STATUS_BAR_VERTICAL_CLASS} .${STATUS_BAR_NAV_UP_BUTTON_CLASS},
      .${STATUS_BAR_CLASS}.${STATUS_BAR_VERTICAL_CLASS} .${STATUS_BAR_NAV_DOWN_BUTTON_CLASS} {
        align-self: center;
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_VERTICAL_CLASS} .${STATUS_BAR_TEXT_CLASS} {
        display: block;
        width: 100%;
        min-width: 0;
        text-align: center;
        white-space: normal;
        word-break: break-word;
        line-height: 1.35;
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_VERTICAL_CLASS} .${STATUS_BAR_DOTS_CLASS} {
        justify-content: center;
        flex-wrap: wrap;
        width: 100%;
        gap: ${px(5)};
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_VERTICAL_CLASS} .${STATUS_BAR_SETTINGS_BUTTON_CLASS} {
        width: 100%;
        justify-content: center;
        border-radius: ${px(10)};
        padding: ${px(4)} ${px(10)};
      }

      .${STATUS_BAR_DOTS_CLASS} {
        display: none;
        align-items: center;
        gap: ${px(6)};
        min-height: ${px(10)};
      }

      .${STATUS_BAR_DOT_CLASS} {
        width: ${px(8)};
        height: ${px(8)};
        border-radius: 999px;
        background: #64748b;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18);
      }

      .${STATUS_BAR_DOT_CLASS}[data-state='success'] {
        background: var(--GeminiParallelDotSuccess, #22c55e);
      }

      .${STATUS_BAR_DOT_CLASS}[data-state='failed'] {
        background: var(--GeminiParallelDotFailed, #ef4444);
      }

      .${STATUS_BAR_DOT_CLASS}[data-state='retrying'] {
        background: var(--GeminiParallelDotRetrying, #f59e0b);
      }

      .${STATUS_BAR_DOT_CLASS}[data-state='running'] {
        background: var(--GeminiParallelDotRunning, #38bdf8);
      }

      .${STATUS_BAR_DOT_CLASS}[data-state='idle'] {
        background: var(--GeminiParallelDotIdle, #64748b);
      }

      .${STATUS_BAR_DOT_CLASS}[data-state='disabled'] {
        background: var(--GeminiParallelDotDisabled, #475569);
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_SIMPLE_MODE_CLASS} {
        gap: ${px(6)};
        padding-right: ${px(8)};
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_VERTICAL_CLASS}.${STATUS_BAR_SIMPLE_MODE_CLASS} {
        width: auto;
        min-width: ${px(36)};
        padding: ${px(6)};
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_SIMPLE_MODE_CLASS} .${STATUS_BAR_TEXT_CLASS} {
        display: none;
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_SIMPLE_MODE_CLASS} .${STATUS_BAR_DOTS_CLASS} {
        display: inline-flex;
      }

      .${STATUS_BAR_SETTINGS_BUTTON_CLASS} {
        flex: 0 0 auto;
        border: 1px solid rgba(255, 255, 255, 0.28);
        background: rgba(255, 255, 255, 0.08);
        color: #f5f7fa;
        font-size: ${px(11)};
        font-weight: 600;
        border-radius: 999px;
        padding: ${px(2)} ${px(10)};
        min-height: ${px(22)};
        display: inline-flex;
        align-items: center;
        line-height: 1.3;
        cursor: pointer;
      }

      .${STATUS_BAR_CLASS}.${STATUS_BAR_SIMPLE_MODE_CLASS} .${STATUS_BAR_SETTINGS_BUTTON_CLASS} {
        width: ${px(22)};
        min-width: ${px(22)};
        padding: 0;
        justify-content: center;
        font-size: ${px(12)};
      }

      .${STATUS_BAR_SETTINGS_BUTTON_CLASS}:hover {
        background: rgba(255, 255, 255, 0.16);
      }

      .${STATUS_BAR_NAV_UP_BUTTON_CLASS},
      .${STATUS_BAR_NAV_DOWN_BUTTON_CLASS} {
        flex: 0 0 auto;
        width: ${px(22)};
        min-width: ${px(22)};
        height: ${px(22)};
        border: 1px solid rgba(255, 255, 255, 0.28);
        background: rgba(255, 255, 255, 0.08);
        color: #f5f7fa;
        font-size: ${px(10)};
        font-weight: 700;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        cursor: pointer;
        pointer-events: auto;
        touch-action: manipulation;
        transition: transform 120ms ease, background-color 120ms ease, box-shadow 180ms ease, border-color 120ms ease;
      }

      .${STATUS_BAR_NAV_UP_BUTTON_CLASS}:hover,
      .${STATUS_BAR_NAV_DOWN_BUTTON_CLASS}:hover {
        background: rgba(255, 255, 255, 0.16);
      }

      .${STATUS_BAR_NAV_UP_BUTTON_CLASS}.${STATUS_BAR_NAV_PRESSING_CLASS},
      .${STATUS_BAR_NAV_DOWN_BUTTON_CLASS}.${STATUS_BAR_NAV_PRESSING_CLASS} {
        transform: scale(0.92);
        background: rgba(255, 255, 255, 0.24);
        border-color: rgba(154, 199, 255, 0.8);
        box-shadow:
          0 0 0 1px var(--SmartThemeEmColor, #9ac7ff),
          0 0 8px rgba(154, 199, 255, 0.35);
      }

      .${STATUS_BAR_NAV_UP_BUTTON_CLASS}:active,
      .${STATUS_BAR_NAV_DOWN_BUTTON_CLASS}:active {
        background: rgba(255, 255, 255, 0.24);
      }

      .${SETTINGS_PANEL_CLASS} {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 280px;
        max-width: min(100%, 560px);
        box-sizing: border-box;
        color: var(--SmartThemeBodyColor, inherit);
      }

      .${SETTINGS_ROW_CLASS} {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .${SETTINGS_ROW_CLASS}.${SETTINGS_CHECKBOX_ROW_CLASS} {
        align-items: flex-start;
      }

      .${SETTINGS_ROW_CLASS} > label {
        font-weight: 600;
        color: var(--SmartThemeBodyColor, inherit);
      }

      .${SETTINGS_ROW_CLASS} input[type='checkbox'] {
        width: 18px;
        height: 18px;
        margin: 0;
        flex: 0 0 auto;
        accent-color: var(--SmartThemeEmColor, #9ac7ff);
        cursor: pointer;
      }

      .${SETTINGS_ROW_CLASS} input[type='number'],
      .${SETTINGS_ROW_CLASS} input[type='text'] {
        width: 120px;
        height: 34px;
        padding: 4px 10px;
        border-radius: 8px;
        border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
        background: var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92));
        color: var(--SmartThemeBodyColor, #f5f7fa);
        caret-color: var(--SmartThemeBodyColor, #f5f7fa);
        font-size: 16px;
        font-weight: 600;
        line-height: 1.2;
        text-align: left;
        box-sizing: border-box;
      }

      .${SETTINGS_ROW_CLASS} input[type='number']::placeholder,
      .${SETTINGS_ROW_CLASS} input[type='text']::placeholder {
        color: var(--SmartThemeQuoteColor, rgba(245, 247, 250, 0.55));
      }

      .${SETTINGS_ROW_CLASS} input[type='number']:focus,
      .${SETTINGS_ROW_CLASS} input[type='text']:focus {
        outline: none;
        border-color: var(--SmartThemeEmColor, rgba(126, 180, 255, 0.9));
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--SmartThemeEmColor, #7eb4ff) 24%, transparent);
      }

      .${SETTINGS_STEPPER_CLASS} {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .${SETTINGS_STEPPER_CLASS} > button {
        min-width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
        background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08));
        color: var(--SmartThemeBodyColor, inherit);
        cursor: pointer;
      }

      .${SETTINGS_STEPPER_CLASS} > button:hover {
        background: color-mix(in srgb, var(--SmartThemeEmColor, #7eb4ff) 16%, var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08)));
      }

      @media (max-width: 768px), (pointer: coarse) {
        .${STATUS_BAR_CLASS} {
          gap: ${px(10)};
          min-height: ${px(40)};
          max-width: calc(100vw - ${px(16)});
          padding: ${px(8)} ${px(14)};
          font-size: ${px(14)};
        }

        .${STATUS_BAR_CLASS}.${STATUS_BAR_COLLAPSED_CLASS} {
          min-width: ${px(42)};
          min-height: ${px(42)};
          padding: ${px(6)};
          gap: ${px(6)};
        }

        .${STATUS_BAR_CLASS}.${STATUS_BAR_VERTICAL_CLASS} {
          width: min(${px(180)}, calc(100vw - ${px(16)}));
          gap: ${px(8)};
          padding: ${px(10)};
        }

        .${STATUS_BAR_CLASS}.${STATUS_BAR_VERTICAL_CLASS}.${STATUS_BAR_SIMPLE_MODE_CLASS} {
          min-width: ${px(48)};
          min-height: ${px(48)};
          padding: ${px(8)};
        }

        .${STATUS_BAR_TOGGLE_BUTTON_CLASS},
        .${STATUS_BAR_NAV_UP_BUTTON_CLASS},
        .${STATUS_BAR_NAV_DOWN_BUTTON_CLASS} {
          width: ${px(38)};
          min-width: ${px(38)};
          height: ${px(38)};
          font-size: ${px(15)};
        }

        .${STATUS_BAR_SETTINGS_BUTTON_CLASS} {
          min-height: ${px(38)};
          padding: ${px(6)} ${px(14)};
          font-size: ${px(13)};
        }

        .${STATUS_BAR_CLASS}.${STATUS_BAR_SIMPLE_MODE_CLASS} .${STATUS_BAR_SETTINGS_BUTTON_CLASS} {
          width: ${px(38)};
          min-width: ${px(38)};
          height: ${px(38)};
          padding: 0;
          font-size: ${px(15)};
        }

        .${STATUS_BAR_DOTS_CLASS} {
          gap: ${px(8)};
        }

        .${STATUS_BAR_DOT_CLASS} {
          width: ${px(10)};
          height: ${px(10)};
        }

        .${SETTINGS_PANEL_CLASS} {
          width: min(92vw, 360px);
          min-width: 0;
          max-width: calc(100vw - 16px);
          gap: 12px;
        }

        .${SETTINGS_ROW_CLASS} {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: flex-start;
          width: 100%;
          gap: 8px 10px;
        }

        .${SETTINGS_ROW_CLASS} > label {
          grid-column: 1;
          min-width: 0;
          font-size: 14px;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .${SETTINGS_ROW_CLASS} input[type='checkbox'] {
          grid-column: 2;
          justify-self: end;
          align-self: center;
          width: 24px;
          height: 24px;
          margin-top: 2px;
        }

        .${SETTINGS_ROW_CLASS} > span,
        .${SETTINGS_ROW_CLASS} > .${SETTINGS_STEPPER_CLASS},
        .${SETTINGS_ROW_CLASS} input[type='number'],
        .${SETTINGS_ROW_CLASS} input[type='text'] {
          grid-column: 1 / -1;
          width: 100%;
          min-width: 0;
        }

        .${SETTINGS_ROW_CLASS}.${SETTINGS_CHECKBOX_ROW_CLASS} {
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 12px;
        }

        .${SETTINGS_ROW_CLASS}.${SETTINGS_CHECKBOX_ROW_CLASS} > label {
          order: 2;
          flex: 1 1 auto;
        }

        .${SETTINGS_ROW_CLASS}.${SETTINGS_CHECKBOX_ROW_CLASS} input[type='checkbox'] {
          order: 1;
          grid-column: auto;
          justify-self: auto;
          align-self: flex-start;
          margin: 2px 0 0 2px;
        }

        .${SETTINGS_STEPPER_CLASS} {
          width: 100%;
          justify-content: flex-start;
          gap: 10px;
        }

        .${SETTINGS_ROW_CLASS} input[type='number'],
        .${SETTINGS_ROW_CLASS} input[type='text'] {
          min-height: 40px;
          font-size: 16px;
        }

        .${SETTINGS_STEPPER_CLASS} > button {
          min-width: 40px;
          height: 40px;
          font-size: 18px;
        }

        .${SETTINGS_STEPPER_CLASS} > span {
          min-width: 36px;
          font-size: 16px;
          line-height: 40px;
        }
      }
    `;

    const existing = hostDocument.getElementById(STATUS_BAR_STYLE_ID);
    if (existing) {
      if (existing.textContent !== cssText) {
        existing.textContent = cssText;
      }
      return true;
    }

    const style = hostDocument.createElement('style');
    style.id = STATUS_BAR_STYLE_ID;
    style.textContent = cssText;

    const target = hostDocument.head || hostDocument.body;
    if (!target) return false;
    target.appendChild(style);
    return true;
  }

  function removeStatusBarStyle() {
    const hostDocument = getHostDocument();
    if (!hostDocument) return;
    const style = hostDocument.getElementById(STATUS_BAR_STYLE_ID);
    if (style) {
      style.remove();
    }
  }

  function removeParallelStatusBar() {
    const hostDocument = getHostDocument();
    if (!hostDocument) return false;
    clearStatusBarDragState();
    const bar = hostDocument.querySelector(`.${STATUS_BAR_CLASS}`);
    if (!bar) return false;
    bar.remove();
    return true;
  }

  function removeAllParallelStatusBars() {
    const hostDocument = getHostDocument();
    if (!hostDocument) return;
    clearStatusBarDragState();
    const bars = hostDocument.querySelectorAll(`.${STATUS_BAR_CLASS}`);
    bars.forEach(bar => bar.remove());
  }

  function getTemporarySuspendCount() {
    return temporarySuspensions.size;
  }

  function isTemporarilySuspended() {
    return getTemporarySuspendCount() > 0;
  }

  function isEffectivelyEnabled() {
    return Boolean(config.enabled && !isTemporarilySuspended());
  }

  function buildRuntimeEnabledStateLabel(options = {}) {
    const persistentEnabled = Object.prototype.hasOwnProperty.call(options, 'persistentEnabled')
      ? Boolean(options.persistentEnabled)
      : Boolean(config.enabled);
    const temporarySuspended = Object.prototype.hasOwnProperty.call(options, 'temporarySuspended')
      ? Boolean(options.temporarySuspended)
      : isTemporarilySuspended();

    if (!persistentEnabled && temporarySuspended) {
      return '已永久禁用（临时挂起中）';
    }
    if (!persistentEnabled) {
      return '已永久禁用';
    }
    if (temporarySuspended) {
      return '已被 DeepThink 临时挂起';
    }
    return '已启用';
  }

  function createTemporarySuspendTicket() {
    temporarySuspendSeq += 1;
    return `gps_suspend_${Date.now().toString(36)}_${temporarySuspendSeq.toString(36)}`;
  }

  function buildIdleStatusText() {
    const enabledState = buildRuntimeEnabledStateLabel();
    const retryCount = getConfiguredRetryCount();
    const retryDelayMs = getConfiguredRetryDelayMs();
    const minReplyTokens = getConfiguredMinReplyTokens();
    return `并发补全 ${enabledState} · 重试 ${retryCount} 次 · 延迟 ${retryDelayMs}ms · 最小 ${minReplyTokens} token`;
  }

  function isStatusBarSimpleMode() {
    return Boolean(config?.status_bar_simple_mode);
  }

  function isStatusBarVertical() {
    return Boolean(config?.status_bar_vertical);
  }

  function createDotStateArray(state, count) {
    const size = Math.max(0, Math.floor(Number(count) || 0));
    return Array.from({ length: size }, () => state);
  }

  function getRetryStatusStats() {
    let total = 0;
    let foreground = 0;
    retryStatusEntries.forEach((entry) => {
      total += 1;
      const scope = String(entry?.scope || '');
      if (scope.startsWith('前台')) {
        foreground += 1;
      }
    });
    return {
      total,
      foreground,
      parallel: Math.max(0, total - foreground),
    };
  }

  function resolveForegroundDotState(job, foregroundRetryingCount) {
    if (foregroundRetryingCount > 0) return 'retrying';
    if (!job || job.aborted) return isEffectivelyEnabled() ? 'idle' : 'disabled';
    if (job.foregroundStopped) return 'failed';
    if (!job.foregroundEnded) return 'running';
    if (!job.foregroundValidationDone) return 'running';
    return 'success';
  }

  function buildStatusDotStates(progress, job) {
    const retryStats = getRetryStatusStats();
    const retryingCount = retryStats.total;
    const liveJob = job && !job.aborted && !isJobTerminal(job) ? job : null;
    if (liveJob) {
      const total = Math.max(0, Math.floor(Number(progress?.total) || Number(liveJob.extraCount) || 0));
      const foregroundState = resolveForegroundDotState(liveJob, retryStats.foreground);
      if (total > 0) {
        const success = Math.max(0, Math.min(total, Math.floor(Number(progress?.success) || 0)));
        const failed = Math.max(0, Math.min(total - success, Math.floor(Number(progress?.failed) || 0)));
        const completed = Math.max(
          0,
          Math.min(total, Math.floor(Number(progress?.completed) || success + failed)),
        );
        const inflight = Math.max(0, total - completed);
        const retrying = Math.max(0, Math.min(inflight, retryStats.parallel));
        const running = Math.max(0, inflight - retrying);
        return [
          foregroundState,
          ...createDotStateArray('success', success),
          ...createDotStateArray('failed', failed),
          ...createDotStateArray('retrying', retrying),
          ...createDotStateArray('running', running),
        ];
      }
      return [foregroundState];
    }

    if (retryingCount > 0) {
      return createDotStateArray('retrying', retryingCount);
    }
    if (!isEffectivelyEnabled()) {
      return ['disabled'];
    }
    return ['idle'];
  }

  function renderStatusBarDots(container, states) {
    if (!isDomElement(container)) return;
    const hostDocument = getHostDocument();
    if (!hostDocument) return;
    const normalizedStates = Array.isArray(states)
      ? states.filter(state => typeof state === 'string' && state)
      : [];
    const limitedStates = normalizedStates.slice(0, 24);
    const nextStates = limitedStates.length > 0 ? limitedStates : ['idle'];
    container.replaceChildren(
      ...nextStates.map((state) => {
        const dot = hostDocument.createElement('span');
        dot.className = STATUS_BAR_DOT_CLASS;
        dot.dataset.state = state;
        return dot;
      }),
    );
  }

  function resolvePopupApi() {
    const context = getContext();
    const hostWindow = getHostWindow();
    const candidates = [
      context,
      hostWindow?.SillyTavern,
      window.SillyTavern,
      hostWindow,
      window,
    ].filter(Boolean);

    let popupFn = null;
    let popupType = null;
    let popupResult = null;

    for (const candidate of candidates) {
      if (!popupFn && typeof candidate.callGenericPopup === 'function') {
        popupFn = candidate.callGenericPopup.bind(candidate);
      }
      if (!popupType && candidate.POPUP_TYPE) {
        popupType = candidate.POPUP_TYPE;
      }
      if (!popupResult && candidate.POPUP_RESULT) {
        popupResult = candidate.POPUP_RESULT;
      }
    }

    if (!popupFn && typeof callGenericPopup === 'function') {
      popupFn = callGenericPopup;
    }
    if (!popupType && typeof POPUP_TYPE !== 'undefined') {
      popupType = POPUP_TYPE;
    }
    if (!popupResult && typeof POPUP_RESULT !== 'undefined') {
      popupResult = POPUP_RESULT;
    }

    return { popupFn, popupType, popupResult };
  }

  function openFallbackConfirmDialog(contentNode, options = {}) {
    return new Promise((resolve) => {
      const hostDocument = getHostDocument();
      const hostWindow = getHostWindow();
      if (!hostDocument || !hostDocument.body) {
        resolve(false);
        return;
      }

      const overlay = hostDocument.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.left = '0';
      overlay.style.top = '0';
      overlay.style.right = '0';
      overlay.style.bottom = '0';
      overlay.style.background = 'rgba(0, 0, 0, 0.5)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.zIndex = '2147483647';

      const panel = hostDocument.createElement('div');
      panel.style.minWidth = '320px';
      panel.style.maxWidth = '90vw';
      panel.style.maxHeight = '85vh';
      panel.style.overflowY = 'auto';
      panel.style.padding = '14px';
      panel.style.borderRadius = '10px';
      panel.style.border = '1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.28))';
      panel.style.background = 'var(--SmartThemeBlurTintColor, rgba(20,24,32,0.96))';
      panel.style.color = 'var(--SmartThemeBodyColor, #f5f7fa)';
      panel.style.boxShadow = '0 12px 32px rgba(0,0,0,0.45)';

      const buttonRow = hostDocument.createElement('div');
      buttonRow.style.display = 'flex';
      buttonRow.style.justifyContent = 'flex-end';
      buttonRow.style.gap = '10px';
      buttonRow.style.marginTop = '12px';

      const cancelButton = hostDocument.createElement('button');
      cancelButton.type = 'button';
      cancelButton.textContent = options.cancelText || '取消';
      cancelButton.style.minWidth = '70px';
      cancelButton.style.height = '34px';
      cancelButton.style.borderRadius = '8px';
      cancelButton.style.border = '1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.28))';
      cancelButton.style.background = 'transparent';
      cancelButton.style.color = 'inherit';
      cancelButton.style.cursor = 'pointer';

      const okButton = hostDocument.createElement('button');
      okButton.type = 'button';
      okButton.textContent = options.okText || '确定';
      okButton.style.minWidth = '70px';
      okButton.style.height = '34px';
      okButton.style.borderRadius = '8px';
      okButton.style.border = '1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.28))';
      okButton.style.background = 'var(--SmartThemeEmColor, #7eb4ff)';
      okButton.style.color = '#111';
      okButton.style.fontWeight = '700';
      okButton.style.cursor = 'pointer';

      buttonRow.append(cancelButton, okButton);
      panel.append(contentNode, buttonRow);
      overlay.appendChild(panel);
      hostDocument.body.appendChild(overlay);

      let closed = false;
      const cleanup = () => {
        if (closed) return;
        closed = true;
        overlay.remove();
        hostWindow.removeEventListener('keydown', onKeyDown, true);
      };

      const closeWith = (value) => {
        cleanup();
        resolve(value);
      };

      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeWith(false);
        }
      };

      cancelButton.addEventListener('click', () => closeWith(false));
      okButton.addEventListener('click', () => closeWith(true));
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          closeWith(false);
        }
      });
      hostWindow.addEventListener('keydown', onKeyDown, true);
    });
  }

  function isPopupAffirmative(result, popupResult) {
    if (result === true) return true;
    if (typeof result === 'number' && Number.isFinite(result)) {
      if (popupResult && Number(result) === Number(popupResult.AFFIRMATIVE)) return true;
      if (Number(result) === 1) return true;
    }
    if (typeof result === 'string' && result.trim().toLowerCase() === 'true') return true;
    return false;
  }

  function closeActivePopupForNode(node) {
    const context = getContext();
    const hostWindow = getHostWindow();
    const hostDocument = node?.ownerDocument || getHostDocument();
    const candidates = [
      context,
      hostWindow?.SillyTavern,
      window.SillyTavern,
      hostWindow,
      window,
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (typeof candidate.closePopup === 'function') {
        try {
          candidate.closePopup();
          return true;
        } catch (error) {
          warn('调用 closePopup 关闭弹窗失败，将尝试备用关闭方式:', error);
        }
      }
    }

    const popupCancelButton = hostDocument?.querySelector?.('#dialogue_popup_cancel');
    if (popupCancelButton && typeof popupCancelButton.click === 'function') {
      popupCancelButton.click();
      return true;
    }

    let current = node?.parentElement || null;
    while (current) {
      const buttons = Array.from(current.querySelectorAll('button'));
      const cancelButton = buttons.find(button => String(button?.textContent || '').trim() === '取消');
      if (cancelButton && typeof cancelButton.click === 'function') {
        cancelButton.click();
        return true;
      }
      current = current.parentElement;
    }

    return false;
  }

  async function openSettingsPopup() {
    if (isSettingsPopupOpening) return;
    isSettingsPopupOpening = true;
    try {
      const { popupFn, popupType, popupResult } = resolvePopupApi();

      const hostDocument = getHostDocument();
      const panel = hostDocument.createElement('div');
      panel.className = SETTINGS_PANEL_CLASS;

      const title = hostDocument.createElement('div');
      title.textContent = '并发补全设置';
      title.style.fontWeight = '700';
      panel.appendChild(title);

      const persistentSwitchRow = hostDocument.createElement('div');
      persistentSwitchRow.className = `${SETTINGS_ROW_CLASS} ${SETTINGS_CHECKBOX_ROW_CLASS}`;
      const persistentSwitchLabel = hostDocument.createElement('label');
      persistentSwitchLabel.textContent = '用户永久开关';
      persistentSwitchLabel.style.fontWeight = '700';
      const persistentSwitchCheckbox = hostDocument.createElement('input');
      persistentSwitchCheckbox.type = 'checkbox';
      persistentSwitchCheckbox.checked = Boolean(config.enabled);
      persistentSwitchRow.append(persistentSwitchLabel, persistentSwitchCheckbox);
      panel.appendChild(persistentSwitchRow);

      const runtimeStatusRow = hostDocument.createElement('div');
      runtimeStatusRow.className = SETTINGS_ROW_CLASS;
      const runtimeStatusLabel = hostDocument.createElement('label');
      runtimeStatusLabel.textContent = '当前运行状态';
      const runtimeStatusValue = hostDocument.createElement('span');
      const statusSnapshot = status();
      runtimeStatusValue.textContent = buildRuntimeEnabledStateLabel({
        persistentEnabled: statusSnapshot.persistent_enabled,
        temporarySuspended: statusSnapshot.temporary_suspended,
      });
      runtimeStatusValue.style.fontWeight = '700';
      runtimeStatusValue.style.color = statusSnapshot.temporary_suspended
        ? 'var(--SmartThemeEmColor, #9ac7ff)'
        : statusSnapshot.persistent_enabled
          ? 'var(--SmartThemeBodyColor, #f5f7fa)'
          : 'var(--SmartThemeQuoteColor, #94a3b8)';
      runtimeStatusRow.append(runtimeStatusLabel, runtimeStatusValue);
      panel.appendChild(runtimeStatusRow);

      const runtimeStatusHint = hostDocument.createElement('div');
      runtimeStatusHint.textContent = statusSnapshot.temporary_suspended
        ? '临时挂起期间仍可修改永久开关；挂起解除后会按你保存的永久开关生效。'
        : '永久开关决定默认行为；临时挂起只影响任务运行期间的即时状态。';
      runtimeStatusHint.style.opacity = '0.82';
      runtimeStatusHint.style.fontSize = '12px';
      panel.appendChild(runtimeStatusHint);

      const retryRow = hostDocument.createElement('div');
      retryRow.className = SETTINGS_ROW_CLASS;
      const retryLabel = hostDocument.createElement('label');
      retryLabel.textContent = '重试次数';
      const retryStepper = hostDocument.createElement('div');
      retryStepper.className = SETTINGS_STEPPER_CLASS;
      const retryDec = hostDocument.createElement('button');
      retryDec.type = 'button';
      retryDec.textContent = '-';
      const retryValue = hostDocument.createElement('span');
      retryValue.textContent = String(getConfiguredRetryCount());
      retryValue.style.minWidth = '30px';
      retryValue.style.textAlign = 'center';
      const retryInc = hostDocument.createElement('button');
      retryInc.type = 'button';
      retryInc.textContent = '+';
      retryStepper.append(retryDec, retryValue, retryInc);
      retryRow.append(retryLabel, retryStepper);
      panel.appendChild(retryRow);

      const delayRow = hostDocument.createElement('div');
      delayRow.className = SETTINGS_ROW_CLASS;
      const delayLabel = hostDocument.createElement('label');
      delayLabel.textContent = '重试延迟(ms)';
      const delayInput = hostDocument.createElement('input');
      delayInput.type = 'number';
      delayInput.min = '0';
      delayInput.max = String(MAX_RETRY_DELAY_MS);
      delayInput.step = '100';
      delayInput.value = String(getConfiguredRetryDelayMs());
      delayRow.append(delayLabel, delayInput);
      panel.appendChild(delayRow);

      const minTokenRow = hostDocument.createElement('div');
      minTokenRow.className = SETTINGS_ROW_CLASS;
      const minTokenLabel = hostDocument.createElement('label');
      minTokenLabel.textContent = '最小回复长度(token)';
      const minTokenInput = hostDocument.createElement('input');
      minTokenInput.type = 'number';
      minTokenInput.min = '0';
      minTokenInput.max = String(MAX_MIN_REPLY_TOKENS);
      minTokenInput.step = '1';
      minTokenInput.value = String(getConfiguredMinReplyTokens());
      minTokenRow.append(minTokenLabel, minTokenInput);
      panel.appendChild(minTokenRow);

      const parallelTemperatureRow = hostDocument.createElement('div');
      parallelTemperatureRow.className = SETTINGS_ROW_CLASS;
      const parallelTemperatureLabel = hostDocument.createElement('label');
      parallelTemperatureLabel.textContent = '并发温度（支持 , ， 、 | 分隔）';
      parallelTemperatureLabel.style.fontWeight = '700';
      parallelTemperatureLabel.style.fontSize = '13px';
      parallelTemperatureLabel.style.color = 'var(--SmartThemeEmColor, #9ac7ff)';
      const parallelTemperatureInput = hostDocument.createElement('input');
      parallelTemperatureInput.type = 'text';
      parallelTemperatureInput.placeholder = '例如：0.7,1.0、1.3|1.5（留空沿用前台温度）';
      parallelTemperatureInput.style.fontSize = '13px';
      parallelTemperatureInput.style.fontWeight = '600';
      parallelTemperatureInput.style.width = '220px';
      parallelTemperatureInput.style.color = 'var(--SmartThemeBodyColor, #f5f7fa)';
      parallelTemperatureInput.style.background = 'var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92))';
      parallelTemperatureInput.style.borderColor = 'var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28))';
      parallelTemperatureInput.value = formatParallelTemperatures(getConfiguredParallelTemperatures());
      parallelTemperatureRow.append(parallelTemperatureLabel, parallelTemperatureInput);
      panel.appendChild(parallelTemperatureRow);

      const hint = hostDocument.createElement('div');
      hint.textContent = '说明：最小回复长度为 0 时表示关闭长度重试。';
      hint.style.opacity = '0.8';
      hint.style.fontSize = '12px';
      panel.appendChild(hint);

      const temperatureHint = hostDocument.createElement('div');
      temperatureHint.textContent = '并发温度支持 , ， 、 | 分隔，超出 0~2 会自动限制。';
      temperatureHint.style.opacity = '0.92';
      temperatureHint.style.fontSize = '13px';
      temperatureHint.style.fontWeight = '600';
      temperatureHint.style.color = 'var(--SmartThemeEmColor, #9ac7ff)';
      panel.appendChild(temperatureHint);

      const moduleTitle = hostDocument.createElement('div');
      moduleTitle.textContent = '功能模块';
      moduleTitle.style.fontWeight = '700';
      moduleTitle.style.marginTop = '10px';
      panel.appendChild(moduleTitle);

      const swipeRow = hostDocument.createElement('div');
      swipeRow.className = `${SETTINGS_ROW_CLASS} ${SETTINGS_CHECKBOX_ROW_CLASS}`;
      const swipeLabel = hostDocument.createElement('label');
      swipeLabel.textContent = '旧楼层 Swipe';
      const swipeCheckbox = hostDocument.createElement('input');
      swipeCheckbox.type = 'checkbox';
      swipeCheckbox.checked = Boolean(config.old_floor_swipe_enabled);
      swipeRow.append(swipeLabel, swipeCheckbox);
      panel.appendChild(swipeRow);

      const auctionRow = hostDocument.createElement('div');
      auctionRow.className = `${SETTINGS_ROW_CLASS} ${SETTINGS_CHECKBOX_ROW_CLASS}`;
      const auctionLabel = hostDocument.createElement('label');
      auctionLabel.textContent = '竞标模式（有一个完成就停）';
      auctionLabel.style.fontWeight = '700';
      auctionLabel.style.color = 'var(--SmartThemeBodyColor, #f5f7fa)';
      const auctionCheckbox = hostDocument.createElement('input');
      auctionCheckbox.type = 'checkbox';
      auctionCheckbox.checked = isAuctionModeEnabled();
      auctionRow.append(auctionLabel, auctionCheckbox);
      panel.appendChild(auctionRow);

      const silentRow = hostDocument.createElement('div');
      silentRow.className = `${SETTINGS_ROW_CLASS} ${SETTINGS_CHECKBOX_ROW_CLASS}`;
      const silentLabel = hostDocument.createElement('label');
      silentLabel.textContent = '静默模式（不弹提示）';
      silentLabel.style.fontWeight = '700';
      silentLabel.style.color = 'var(--SmartThemeBodyColor, #f5f7fa)';
      const silentCheckbox = hostDocument.createElement('input');
      silentCheckbox.type = 'checkbox';
      silentCheckbox.checked = isSilentModeEnabled();
      silentRow.append(silentLabel, silentCheckbox);
      panel.appendChild(silentRow);

      const wbRow = hostDocument.createElement('div');
      wbRow.className = `${SETTINGS_ROW_CLASS} ${SETTINGS_CHECKBOX_ROW_CLASS}`;
      const wbLabel = hostDocument.createElement('label');
      wbLabel.textContent = '世界书快捷切换';
      const wbCheckbox = hostDocument.createElement('input');
      wbCheckbox.type = 'checkbox';
      wbCheckbox.checked = Boolean(config.worldbook_switcher_enabled);
      wbRow.append(wbLabel, wbCheckbox);
      panel.appendChild(wbRow);

      const actionTitle = hostDocument.createElement('div');
      actionTitle.textContent = '附加操作';
      actionTitle.style.fontWeight = '700';
      actionTitle.style.marginTop = '10px';
      actionTitle.style.color = 'var(--SmartThemeEmColor, #9ac7ff)';
      panel.appendChild(actionTitle);

      const aiFloorActionRow = hostDocument.createElement('div');
      aiFloorActionRow.className = SETTINGS_ROW_CLASS;
      const aiFloorActionLabel = hostDocument.createElement('label');
      aiFloorActionLabel.textContent = '空 AI 楼层';
      aiFloorActionLabel.style.fontWeight = '700';
      aiFloorActionLabel.style.color = 'var(--SmartThemeBodyColor, #f5f7fa)';
      const aiFloorActionButton = hostDocument.createElement('button');
      aiFloorActionButton.type = 'button';
      aiFloorActionButton.textContent = '添加 AI 楼层';
      aiFloorActionButton.style.minWidth = '122px';
      aiFloorActionButton.style.height = '34px';
      aiFloorActionButton.style.padding = '0 14px';
      aiFloorActionButton.style.borderRadius = '8px';
      aiFloorActionButton.style.border = '1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28))';
      aiFloorActionButton.style.background = 'var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92))';
      aiFloorActionButton.style.color = 'var(--SmartThemeBodyColor, #f5f7fa)';
      aiFloorActionButton.style.fontWeight = '700';
      aiFloorActionButton.style.cursor = 'pointer';
      aiFloorActionButton.style.transition = 'background-color 120ms ease, border-color 120ms ease, box-shadow 180ms ease, transform 120ms ease';
      aiFloorActionButton.setAttribute('aria-label', '添加 AI 楼层');
      aiFloorActionRow.append(aiFloorActionLabel, aiFloorActionButton);
      panel.appendChild(aiFloorActionRow);

      const aiFloorActionHint = hostDocument.createElement('div');
      aiFloorActionHint.textContent = '点击后在当前聊天末尾追加一条空 assistant 楼层，不会保存任何设置。';
      aiFloorActionHint.style.opacity = '0.82';
      aiFloorActionHint.style.fontSize = '12px';
      aiFloorActionHint.style.color = 'var(--SmartThemeBodyColor, #f5f7fa)';
      panel.appendChild(aiFloorActionHint);

      let isAddingEmptyAiFloor = false;
      const syncAiFloorActionButtonStyle = ({ busy = false, highlighted = false } = {}) => {
        if (busy) {
          aiFloorActionButton.style.background = 'rgba(154, 199, 255, 0.16)';
          aiFloorActionButton.style.borderColor = 'var(--SmartThemeEmColor, #9ac7ff)';
          aiFloorActionButton.style.boxShadow = '0 0 0 1px rgba(154, 199, 255, 0.35)';
          aiFloorActionButton.style.transform = 'none';
          return;
        }

        aiFloorActionButton.style.background = highlighted
          ? 'rgba(154, 199, 255, 0.18)'
          : 'var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92))';
        aiFloorActionButton.style.borderColor = highlighted
          ? 'var(--SmartThemeEmColor, #9ac7ff)'
          : 'var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28))';
        aiFloorActionButton.style.boxShadow = highlighted
          ? '0 0 0 1px var(--SmartThemeEmColor, #9ac7ff), 0 0 8px rgba(154, 199, 255, 0.35)'
          : 'none';
        aiFloorActionButton.style.transform = highlighted ? 'translateY(-1px)' : 'none';
      };
      const setAiFloorActionBusy = (busy) => {
        isAddingEmptyAiFloor = busy;
        aiFloorActionButton.disabled = busy;
        aiFloorActionButton.style.cursor = busy ? 'wait' : 'pointer';
        aiFloorActionButton.textContent = busy ? '添加中...' : '添加 AI 楼层';
        syncAiFloorActionButtonStyle({ busy, highlighted: false });
      };
      syncAiFloorActionButtonStyle();
      aiFloorActionButton.addEventListener('mouseenter', () => {
        if (!isAddingEmptyAiFloor) syncAiFloorActionButtonStyle({ highlighted: true });
      });
      aiFloorActionButton.addEventListener('mouseleave', () => {
        if (!isAddingEmptyAiFloor) syncAiFloorActionButtonStyle();
      });
      aiFloorActionButton.addEventListener('focus', () => {
        if (!isAddingEmptyAiFloor) syncAiFloorActionButtonStyle({ highlighted: true });
      });
      aiFloorActionButton.addEventListener('blur', () => {
        if (!isAddingEmptyAiFloor) syncAiFloorActionButtonStyle();
      });
      aiFloorActionButton.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isAddingEmptyAiFloor) return;

        setAiFloorActionBusy(true);
        try {
          const created = await createEmptyAssistantMessageAtEnd();
          if (!created?.appended || !Number.isFinite(Number(created.messageId))) {
            throw new Error('空 AI 楼层创建失败');
          }

          successToast('已添加空 AI 楼层');
          const popupClosed = closeActivePopupForNode(aiFloorActionButton);
          if (!popupClosed) {
            setAiFloorActionBusy(false);
            warningToast('空 AI 楼层已创建，请手动关闭设置弹窗');
          }
        } catch (error) {
          warn('添加空 AI 楼层失败:', error);
          errorToast(`添加 AI 楼层失败：${error?.message || 'unknown error'}`);
          setAiFloorActionBusy(false);
        }
      });

      const statusBarOpacityRow = hostDocument.createElement('div');
      statusBarOpacityRow.className = SETTINGS_ROW_CLASS;
      const statusBarOpacityLabel = hostDocument.createElement('label');
      statusBarOpacityLabel.textContent = '状态条透明度(%)';
      const statusBarOpacityInput = hostDocument.createElement('input');
      statusBarOpacityInput.type = 'number';
      statusBarOpacityInput.min = String(MIN_STATUS_BAR_OPACITY_PERCENT);
      statusBarOpacityInput.max = String(MAX_STATUS_BAR_OPACITY_PERCENT);
      statusBarOpacityInput.step = '5';
      statusBarOpacityInput.value = String(getConfiguredStatusBarOpacityPercent());
      statusBarOpacityRow.append(statusBarOpacityLabel, statusBarOpacityInput);
      panel.appendChild(statusBarOpacityRow);

      const statusBarScaleRow = hostDocument.createElement('div');
      statusBarScaleRow.className = SETTINGS_ROW_CLASS;
      const statusBarScaleLabel = hostDocument.createElement('label');
      statusBarScaleLabel.textContent = '状态条大小(%)';
      const statusBarScaleInput = hostDocument.createElement('input');
      statusBarScaleInput.type = 'number';
      statusBarScaleInput.min = String(MIN_STATUS_BAR_SCALE_PERCENT);
      statusBarScaleInput.max = String(MAX_STATUS_BAR_SCALE_PERCENT);
      statusBarScaleInput.step = '5';
      statusBarScaleInput.value = String(getConfiguredStatusBarScalePercent());
      statusBarScaleRow.append(statusBarScaleLabel, statusBarScaleInput);
      panel.appendChild(statusBarScaleRow);

      const statusBarSimpleRow = hostDocument.createElement('div');
      statusBarSimpleRow.className = `${SETTINGS_ROW_CLASS} ${SETTINGS_CHECKBOX_ROW_CLASS}`;
      const statusBarSimpleLabel = hostDocument.createElement('label');
      statusBarSimpleLabel.textContent = '状态栏简易模式（仅圆点）';
      const statusBarSimpleCheckbox = hostDocument.createElement('input');
      statusBarSimpleCheckbox.type = 'checkbox';
      statusBarSimpleCheckbox.checked = isStatusBarSimpleMode();
      statusBarSimpleRow.append(statusBarSimpleLabel, statusBarSimpleCheckbox);
      panel.appendChild(statusBarSimpleRow);

      const statusBarVerticalRow = hostDocument.createElement('div');
      statusBarVerticalRow.className = `${SETTINGS_ROW_CLASS} ${SETTINGS_CHECKBOX_ROW_CLASS}`;
      const statusBarVerticalLabel = hostDocument.createElement('label');
      statusBarVerticalLabel.textContent = '状态栏竖版模式（侧边堆叠）';
      const statusBarVerticalCheckbox = hostDocument.createElement('input');
      statusBarVerticalCheckbox.type = 'checkbox';
      statusBarVerticalCheckbox.checked = isStatusBarVertical();
      statusBarVerticalRow.append(statusBarVerticalLabel, statusBarVerticalCheckbox);
      panel.appendChild(statusBarVerticalRow);

      const adjustRetryValue = (delta) => {
        const current = clampRetryCount(Number(retryValue.textContent) || 0);
        const next = clampRetryCount(current + delta);
        retryValue.textContent = String(next);
      };
      retryDec.addEventListener('click', () => adjustRetryValue(-1));
      retryInc.addEventListener('click', () => adjustRetryValue(1));

      let result = false;
      if (popupFn) {
        const confirmType = popupType?.CONFIRM ?? popupType?.confirm ?? popupType ?? 'confirm';
        result = await popupFn(panel, confirmType, '', {
          okButton: '保存',
          cancelButton: '取消',
          wider: true,
          leftAlign: true,
          allowVerticalScrolling: true,
        });
      } else {
        warningToast('未检测到酒馆弹窗 API，使用备用设置弹窗');
        result = await openFallbackConfirmDialog(panel, {
          okText: '保存',
          cancelText: '取消',
        });
      }
      if (!isPopupAffirmative(result, popupResult)) {
        return;
      }

      const nextRetryCount = clampRetryCount(Number(retryValue.textContent));
      const nextRetryDelayMs = clampRetryDelayMs(Number(delayInput.value));
      const nextMinReplyTokens = clampMinReplyTokens(Number(minTokenInput.value));
      const parsedParallelTemperatures = parseParallelTemperaturesInput(parallelTemperatureInput.value);
      if (!parsedParallelTemperatures.ok) {
        errorToast(`并发温度配置无效：${parsedParallelTemperatures.error}`);
        return;
      }
      const nextParallelTemperatures = parsedParallelTemperatures.values;
      const nextPersistentEnabled = Boolean(persistentSwitchCheckbox.checked);
      const nextOldFloorSwipeEnabled = Boolean(swipeCheckbox.checked);
      const nextAuctionModeEnabled = Boolean(auctionCheckbox.checked);
      const nextSilentModeEnabled = Boolean(silentCheckbox.checked);
      const nextWorldbookSwitcherEnabled = Boolean(wbCheckbox.checked);
      const nextStatusBarOpacityPercent = clampStatusBarOpacityPercent(Number(statusBarOpacityInput.value));
      const nextStatusBarScalePercent = clampStatusBarScalePercent(Number(statusBarScaleInput.value));
      const nextStatusBarSimpleMode = Boolean(statusBarSimpleCheckbox.checked);
      const nextStatusBarVertical = Boolean(statusBarVerticalCheckbox.checked);
      const moduleSwitchChanged = nextOldFloorSwipeEnabled !== Boolean(config.old_floor_swipe_enabled)
        || nextWorldbookSwitcherEnabled !== Boolean(config.worldbook_switcher_enabled);

      config = normalizeConfig({
        ...config,
        enabled: nextPersistentEnabled,
        retry_count: nextRetryCount,
        retry_delay_ms: nextRetryDelayMs,
        min_reply_tokens: nextMinReplyTokens,
        auction_mode_enabled: nextAuctionModeEnabled,
        silent_mode_enabled: nextSilentModeEnabled,
        parallel_temperatures: nextParallelTemperatures,
        status_bar_opacity_percent: nextStatusBarOpacityPercent,
        status_bar_scale_percent: nextStatusBarScalePercent,
        status_bar_simple_mode: nextStatusBarSimpleMode,
        status_bar_vertical: nextStatusBarVertical,
        old_floor_swipe_enabled: nextOldFloorSwipeEnabled,
        worldbook_switcher_enabled: nextWorldbookSwitcherEnabled,
      });
      const configSaved = await saveConfig();
      if (!configSaved) {
        errorToast('配置保存失败，已取消重载');
        return;
      }
      if (!nextPersistentEnabled) {
        abortActiveJob('插件已永久禁用');
      }
      refreshStatusBarForRetryState();

      if (moduleSwitchChanged) {
        infoToast('模块开关已更新，正在重载页面...');
        const hostWindow = getHostWindow();
        if (hostWindow && hostWindow.location && typeof hostWindow.location.reload === 'function') {
          hostWindow.location.reload();
          return;
        }
        window.location.reload();
        return;
      }

      successToast('并发设置已保存');
    } catch (error) {
      warn('打开设置弹窗失败:', error);
      errorToast('设置弹窗打开失败');
    } finally {
      isSettingsPopupOpening = false;
    }
  }

  function onStatusBarSettingsButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();
    void openSettingsPopup();
  }

  function onStatusBarSettingsButtonPointerDown(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    void openSettingsPopup();
  }

  function isStatusBarCollapsed() {
    return Boolean(config?.status_bar_collapsed);
  }

  function isStatusBarWorking(job = null) {
    const targetJob = job || activeJob;
    if (!targetJob) return false;
    if (targetJob.foregroundStopped) return false;
    return !targetJob.aborted && !isJobTerminal(targetJob);
  }

  function applyStatusBarCollapsedState(bar, collapsed) {
    if (!isDomElement(bar)) return;
    const textNode = bar.querySelector(`.${STATUS_BAR_TEXT_CLASS}`);
    const dotsNode = bar.querySelector(`.${STATUS_BAR_DOTS_CLASS}`);
    const settingsButton = bar.querySelector(`.${STATUS_BAR_SETTINGS_BUTTON_CLASS}`);
    bar.classList.toggle(STATUS_BAR_COLLAPSED_CLASS, collapsed);

    if (collapsed) {
      bar.style.minWidth = 'max-content';
      bar.style.maxWidth = 'calc(100% - 20px)';
      bar.style.width = 'auto';
      bar.style.padding = '3px 6px';
      bar.style.gap = '4px';
      bar.style.justifyContent = 'center';
      if (isDomElement(textNode)) textNode.style.display = 'none';
      if (isDomElement(dotsNode)) dotsNode.style.display = 'none';
      if (isDomElement(settingsButton)) settingsButton.style.display = 'none';
      return;
    }

    bar.style.minWidth = '';
    bar.style.maxWidth = '';
    bar.style.width = '';
    bar.style.padding = '';
    bar.style.gap = '';
    bar.style.justifyContent = '';
    if (isDomElement(textNode)) textNode.style.display = '';
    if (isDomElement(dotsNode)) dotsNode.style.display = '';
    if (isDomElement(settingsButton)) settingsButton.style.display = '';
  }

  function shouldSkipDuplicateStatusBarToggle() {
    const now = Date.now();
    if (now - lastStatusBarToggleAt < 220) {
      return true;
    }
    lastStatusBarToggleAt = now;
    return false;
  }

  function resolveStatusBarFromEvent(event) {
    const target = getEventTargetElement(event);
    if (!isDomElement(target) || typeof target.closest !== 'function') return null;
    const bar = target.closest(`.${STATUS_BAR_CLASS}`);
    return isDomElement(bar) ? bar : null;
  }

  function toggleStatusBarCollapsed(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (Date.now() < statusBarIgnoreToggleUntil) return;
    if (shouldSkipDuplicateStatusBarToggle()) return;

    const nextCollapsed = !isStatusBarCollapsed();
    config = normalizeConfig({
      ...config,
      status_bar_collapsed: nextCollapsed,
    });
    const bar = resolveStatusBarFromEvent(event);
    if (isDomElement(bar)) {
      applyStatusBarCollapsedState(bar, nextCollapsed);
    }
    saveConfig();
    refreshStatusBarForRetryState();
  }

  function onStatusBarToggleButtonClick(event) {
    toggleStatusBarCollapsed(event);
  }

  function onStatusBarToggleButtonTouchEnd(event) {
    onStatusBarToggleButtonClick(event);
  }

  function onStatusBarToggleButtonPointerUp(event) {
    onStatusBarToggleButtonClick(event);
  }

  function onStatusBarContainerClick(event) {
    if (!isStatusBarCollapsed()) return;
    if (eventPathContainsStatusBarControl(event)) return;
    toggleStatusBarCollapsed(event);
  }

  function normalizeStatusBarPosition(position) {
    if (!position || typeof position !== 'object') return null;
    const left = Number(position.left);
    const top = Number(position.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { left: Math.round(left), top: Math.round(top) };
  }

  function normalizeStatusBarPositionStore(position) {
    const legacyPoint = normalizeStatusBarPosition(position);
    if (legacyPoint) {
      return {
        horizontal: legacyPoint,
        vertical: null,
      };
    }
    const raw = position && typeof position === 'object' ? position : {};
    return {
      horizontal: normalizeStatusBarPosition(raw.horizontal),
      vertical: normalizeStatusBarPosition(raw.vertical),
    };
  }

  function loadStatusBarPositionFromLocalStorage() {
    const storage = getHostLocalStorage();
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      const raw = storage.getItem(STATUS_BAR_POSITION_STORAGE_KEY);
      const parsed = parseStoredConfigCandidate(raw);
      const normalized = normalizeStatusBarPositionStore(parsed);
      return normalized.horizontal || normalized.vertical ? normalized : null;
    } catch {
      return null;
    }
  }

  function saveStatusBarPositionToLocalStorage(positionStore) {
    const storage = getHostLocalStorage();
    if (!storage || typeof storage.setItem !== 'function') return false;
    try {
      const normalized = normalizeStatusBarPositionStore(positionStore);
      storage.setItem(STATUS_BAR_POSITION_STORAGE_KEY, JSON.stringify(normalized));
      return true;
    } catch {
      return false;
    }
  }

  function getStatusBarLayoutKey() {
    return isStatusBarVertical() ? 'vertical' : 'horizontal';
  }

  function getSavedStatusBarPosition(layoutKey = getStatusBarLayoutKey()) {
    const store = normalizeStatusBarPositionStore(config?.status_bar_position);
    return normalizeStatusBarPosition(store?.[layoutKey]);
  }

  function isDomElement(node) {
    return Boolean(node && typeof node === 'object' && node.nodeType === 1);
  }

  function getEventTargetElement(event) {
    const target = event?.target;
    if (isDomElement(target)) return target;
    const parent = target && typeof target === 'object' ? target.parentElement : null;
    return isDomElement(parent) ? parent : null;
  }

  function eventPathContainsStatusBarControl(event) {
    if (!event || typeof event.composedPath !== 'function') return false;
    const path = event.composedPath();
    if (!Array.isArray(path)) return false;
    for (const node of path) {
      if (!isDomElement(node)) continue;
      if (node.tagName === 'BUTTON') return true;
      if (node.classList?.contains(STATUS_BAR_SETTINGS_BUTTON_CLASS)) return true;
      if (node.classList?.contains(STATUS_BAR_TOGGLE_BUTTON_CLASS)) return true;
      if (node.classList?.contains(STATUS_BAR_NAV_UP_BUTTON_CLASS)) return true;
      if (node.classList?.contains(STATUS_BAR_NAV_DOWN_BUTTON_CLASS)) return true;
    }
    return false;
  }

  function getNavigableMessageItems() {
    const hostDocument = getHostDocument();
    if (!hostDocument) return [];
    const chatContainer = hostDocument.querySelector('#chat');
    if (!chatContainer) return [];

    const nodes = Array.from(chatContainer.querySelectorAll('.mes[mesid]'));
    if (!nodes.length) return [];

    const itemMap = new Map();
    for (const node of nodes) {
      const rawMesId = node.getAttribute('mesid');
      const numericMesId = Number(rawMesId);
      if (!Number.isFinite(numericMesId)) continue;
      const messageId = Math.floor(numericMesId);
      if (messageId < 0) continue;
      const rect = node.getBoundingClientRect();
      if (rect.height <= 0 && rect.width <= 0) continue;
      if (!itemMap.has(messageId)) {
        itemMap.set(messageId, { el: node, id: messageId });
      }
    }

    return Array.from(itemMap.values()).sort((a, b) => a.id - b.id);
  }

  function getCurrentVisibleMessageIndex(items) {
    if (!Array.isArray(items) || items.length === 0) return -1;
    const hostDocument = getHostDocument();
    const chatContainer = hostDocument?.querySelector('#chat');
    if (!chatContainer) return -1;

    const containerRect = chatContainer.getBoundingClientRect();
    const viewportMid = containerRect.top + containerRect.height / 2;
    let closestIndex = -1;
    let closestDistance = Infinity;
    for (let i = 0; i < items.length; i++) {
      const mesRect = items[i].el.getBoundingClientRect();
      const mesMid = mesRect.top + mesRect.height / 2;
      const distance = Math.abs(mesMid - viewportMid);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }
    return closestIndex;
  }

  function resolveCurrentNavigableIndex(items, visibleIndex) {
    const cursorIndex = findMessageIndexById(items, navCursorMessageId);
    const useRecentCursor = cursorIndex >= 0 && (Date.now() - navCursorUpdatedAt <= 4000);
    if (useRecentCursor) {
      return cursorIndex;
    }
    if (visibleIndex >= 0) {
      return visibleIndex;
    }
    return cursorIndex;
  }

  function isSuccessfulSlashResult(result) {
    if (result == null) return false;
    if (typeof result !== 'object') return true;
    if (result.isError) return false;
    if (result.isAborted) return false;
    return true;
  }

  function findMessageIndexById(items, messageId) {
    if (!Array.isArray(items) || items.length === 0) return -1;
    if (!Number.isFinite(Number(messageId))) return -1;
    const wantedId = Math.floor(Number(messageId));
    for (let i = 0; i < items.length; i++) {
      if (items[i].id === wantedId) {
        return i;
      }
    }
    return -1;
  }

  async function jumpToFloor(targetId) {
    const command = `/chat-jump ${targetId}`;

    if (typeof triggerSlash === 'function') {
      try {
        await triggerSlash(command);
        return true;
      } catch (error) {
        warn('triggerSlash 跳转失败:', error);
      }
    }

    try {
      const hostWindow = getHostWindow();
      const context = getContext();
      const stContext = hostWindow?.SillyTavern?.getContext?.() || context;
      if (stContext && typeof stContext.executeSlashCommandsWithOptions === 'function') {
        const result = await stContext.executeSlashCommandsWithOptions(command);
        return isSuccessfulSlashResult(result);
      }
    } catch (error) {
      warn('executeSlashCommandsWithOptions 跳转失败:', error);
    }

    return false;
  }

  async function jumpToFloorStart(targetId) {
    const normalizedTargetId = normalizeMessageId(targetId);
    if (normalizedTargetId === null) return false;

    await sleep(80);

    let jumped = false;
    try {
      jumped = await jumpToFloor(normalizedTargetId);
    } catch (error) {
      warn('跳转到楼层开头失败:', error);
    }

    if (jumped) {
      return true;
    }

    const items = getNavigableMessageItems();
    const targetIndex = findMessageIndexById(items, normalizedTargetId);
    const target = targetIndex >= 0 ? items[targetIndex] : null;
    if (target?.el && typeof target.el.scrollIntoView === 'function') {
      target.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }

    return false;
  }

  async function navigateFloor(direction) {
    const items = getNavigableMessageItems();
    if (!items.length) return;

    const visibleIndex = getCurrentVisibleMessageIndex(items);
    const currentIndex = resolveCurrentNavigableIndex(items, visibleIndex);
    if (currentIndex < 0) return;

    let targetIndex;
    if (direction === 'up') {
      targetIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
    } else {
      targetIndex = currentIndex >= items.length - 1 ? items.length - 1 : currentIndex + 1;
    }

    if (targetIndex === currentIndex) return;

    const target = items[targetIndex];
    if (!target) return;
    navCursorMessageId = target.id;
    navCursorUpdatedAt = Date.now();

    let jumped = false;
    try {
      jumped = await jumpToFloor(target.id);
    } catch (err) {
      warn('楼层导航失败:', err);
    }

    if (!jumped && target.el && typeof target.el.scrollIntoView === 'function') {
      target.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function shouldSkipDuplicateNavAction(direction, eventType) {
    const now = Date.now();
    const key = `${direction}:${eventType}`;
    if (
      eventType === 'click'
      && now - lastNavActionAt < 320
      && (
        lastNavActionKey === `${direction}:pointerup`
        || lastNavActionKey === `${direction}:touchend`
      )
    ) {
      return true;
    }
    if (key === lastNavActionKey && now - lastNavActionAt < 120) {
      return true;
    }
    lastNavActionAt = now;
    lastNavActionKey = key;
    return false;
  }

  function resolveNavButtonFromEvent(event) {
    const currentTarget = event?.currentTarget;
    if (isDomElement(currentTarget)) return currentTarget;
    const target = getEventTargetElement(event);
    if (!isDomElement(target) || typeof target.closest !== 'function') return null;
    const button = target.closest(`.${STATUS_BAR_NAV_UP_BUTTON_CLASS}, .${STATUS_BAR_NAV_DOWN_BUTTON_CLASS}`);
    return isDomElement(button) ? button : null;
  }

  function clearNavPressFeedback(button) {
    if (!isDomElement(button)) return;
    const timer = navPressFeedbackTimers.get(button);
    if (timer) {
      clearTimeout(timer);
      navPressFeedbackTimers.delete(button);
    }
    button.classList.remove(STATUS_BAR_NAV_PRESSING_CLASS);
  }

  function triggerNavPressFeedback(button) {
    if (!isDomElement(button)) return;
    clearNavPressFeedback(button);
    // Force reflow so rapid clicks can replay the feedback animation.
    void button.offsetWidth;
    button.classList.add(STATUS_BAR_NAV_PRESSING_CLASS);
    const timer = setTimeout(() => {
      button.classList.remove(STATUS_BAR_NAV_PRESSING_CLASS);
      navPressFeedbackTimers.delete(button);
    }, 160);
    navPressFeedbackTimers.set(button, timer);
  }

  function onNavUpButtonClick(event) {
    const eventType = event?.type || 'click';
    event.stopPropagation();
    event.preventDefault();
    triggerNavPressFeedback(resolveNavButtonFromEvent(event));
    if (shouldSkipDuplicateNavAction('up', eventType)) return;
    void navigateFloor('up');
  }

  function onNavUpButtonPointerUp(event) {
    onNavUpButtonClick(event);
  }

  function onNavUpButtonTouchEnd(event) {
    onNavUpButtonClick(event);
  }

  function onNavDownButtonClick(event) {
    const eventType = event?.type || 'click';
    event.stopPropagation();
    event.preventDefault();
    triggerNavPressFeedback(resolveNavButtonFromEvent(event));
    if (shouldSkipDuplicateNavAction('down', eventType)) return;
    void navigateFloor('down');
  }

  function onNavDownButtonPointerUp(event) {
    onNavDownButtonClick(event);
  }

  function onNavDownButtonTouchEnd(event) {
    onNavDownButtonClick(event);
  }

  function onNavButtonPointerDown(event) {
    triggerNavPressFeedback(resolveNavButtonFromEvent(event));
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
  }

  function unbindStatusBarDragDocEvents(doc) {
    if (!doc || typeof doc.removeEventListener !== 'function') return;
    doc.removeEventListener('pointermove', onStatusBarPointerMove);
    doc.removeEventListener('pointerup', finalizeStatusBarDrag);
    doc.removeEventListener('pointercancel', finalizeStatusBarDrag);
  }

  function clearStatusBarDragState() {
    const dragState = statusBarDragState;
    if (!dragState) return;

    statusBarDragState = null;
    unbindStatusBarDragDocEvents(dragState.doc);

    const bar = dragState.bar;
    if (!isDomElement(bar)) return;
    bar.classList.remove(STATUS_BAR_DRAGGING_CLASS);
    try {
      if (typeof bar.releasePointerCapture === 'function') {
        bar.releasePointerCapture(dragState.pointerId);
      }
    } catch {
      // ignore
    }
  }

  function applyDefaultStatusBarPosition(bar) {
    if (!bar) return;
    const hostWindow = getHostWindow();
    if (!hostWindow) return;

    const rect = bar.getBoundingClientRect();
    const chat = getChatContainer();
    const gap = 8;
    const vertical = isStatusBarVertical();

    if (chat && typeof chat.getBoundingClientRect === 'function') {
      const chatRect = chat.getBoundingClientRect();
      if (vertical) {
        const preferredLeft = chatRect.right + gap;
        const left = preferredLeft + rect.width <= hostWindow.innerWidth
          ? preferredLeft
          : (chatRect.right - rect.width - 6);
        const top = chatRect.top + (chatRect.height - rect.height) / 2;
        setStatusBarPosition(bar, left, top);
        return;
      }
      const left = chatRect.left + (chatRect.width - rect.width) / 2;
      const topBelow = chatRect.bottom + gap;
      const hasSpaceBelow = topBelow + rect.height <= hostWindow.innerHeight;
      const top = hasSpaceBelow ? topBelow : (chatRect.bottom - rect.height - 6);
      setStatusBarPosition(bar, left, top);
      return;
    }

    if (vertical) {
      const fallbackLeft = hostWindow.innerWidth - rect.width - 6;
      const fallbackTop = (hostWindow.innerHeight - rect.height) / 2;
      setStatusBarPosition(bar, fallbackLeft, fallbackTop);
      return;
    }

    const fallbackLeft = (hostWindow.innerWidth - rect.width) / 2;
    const fallbackTop = hostWindow.innerHeight - rect.height - 6;
    setStatusBarPosition(bar, fallbackLeft, fallbackTop);
  }

  function setStatusBarPosition(bar, left, top, options = {}) {
    if (!bar) return null;
    const hostWindow = getHostWindow();
    if (!hostWindow || !Number.isFinite(left) || !Number.isFinite(top)) return null;

    const rect = bar.getBoundingClientRect();
    const maxLeft = Math.max(0, Math.floor(hostWindow.innerWidth - rect.width));
    const maxTop = Math.max(0, Math.floor(hostWindow.innerHeight - rect.height));
    const clampedLeft = Math.min(maxLeft, Math.max(0, Math.round(left)));
    const clampedTop = Math.min(maxTop, Math.max(0, Math.round(top)));

    bar.style.left = `${clampedLeft}px`;
    bar.style.top = `${clampedTop}px`;
    bar.style.bottom = 'auto';
    bar.style.transform = 'none';

    if (options.persist) {
      const layoutKey = getStatusBarLayoutKey();
      const nextPositionStore = {
        ...normalizeStatusBarPositionStore(config?.status_bar_position),
        [layoutKey]: { left: clampedLeft, top: clampedTop },
      };
      config = normalizeConfig({
        ...config,
        status_bar_position: nextPositionStore,
      });
      saveStatusBarPositionToLocalStorage(nextPositionStore);
      saveConfig();
    }
    return { left: clampedLeft, top: clampedTop };
  }

  function applySavedStatusBarPosition(bar) {
    const saved = getSavedStatusBarPosition();
    if (!saved) {
      return false;
    }

    const next = setStatusBarPosition(bar, saved.left, saved.top);
    if (!next) {
      return false;
    }
    // 这里只做显示层面的夹取，不回写存储。
    // 移动端键盘弹起会临时压缩视口，如果在这里持久化，
    // 底部状态栏会被错误保存到中间位置。
    return true;
  }

  function onStatusBarPointerDown(event) {
    const bar = event.currentTarget;
    if (!isDomElement(bar)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (eventPathContainsStatusBarControl(event)) return;
    const target = getEventTargetElement(event);
    if (
      isDomElement(target)
      && typeof target.closest === 'function'
      && (
        target.tagName === 'BUTTON'
        || target.closest('button')
        || target.closest(`.${STATUS_BAR_SETTINGS_BUTTON_CLASS}, .${STATUS_BAR_TOGGLE_BUTTON_CLASS}`)
      )
    ) {
      return;
    }

    clearStatusBarDragState();

    const doc = bar.ownerDocument || getHostDocument();
    if (!doc || typeof doc.addEventListener !== 'function') return;

    const rect = bar.getBoundingClientRect();
    setStatusBarPosition(bar, rect.left, rect.top);
    statusBarDragState = {
      bar,
      doc,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    };

    bar.classList.add(STATUS_BAR_DRAGGING_CLASS);
    try {
      if (typeof bar.setPointerCapture === 'function') {
        bar.setPointerCapture(event.pointerId);
      }
    } catch {
      // ignore
    }
    doc.addEventListener('pointermove', onStatusBarPointerMove, { passive: false });
    doc.addEventListener('pointerup', finalizeStatusBarDrag);
    doc.addEventListener('pointercancel', finalizeStatusBarDrag);
    event.preventDefault();
  }

  function onStatusBarPointerMove(event) {
    const dragState = statusBarDragState;
    if (!dragState) return;
    if (dragState.pointerId !== event.pointerId) return;
    const bar = dragState.bar;
    if (!isDomElement(bar)) return;

    const left = event.clientX - dragState.offsetX;
    const top = event.clientY - dragState.offsetY;
    setStatusBarPosition(bar, left, top);

    if (!dragState.moved) {
      const movedX = Math.abs(event.clientX - dragState.startClientX);
      const movedY = Math.abs(event.clientY - dragState.startClientY);
      if (movedX > 2 || movedY > 2) {
        dragState.moved = true;
      }
    }
    event.preventDefault();
  }

  function finalizeStatusBarDrag(event) {
    const dragState = statusBarDragState;
    if (!dragState) return;
    if (event && dragState.pointerId !== event.pointerId) return;

    const bar = dragState.bar;
    const shouldPersist = Boolean(dragState.moved);
    if (shouldPersist) {
      statusBarIgnoreToggleUntil = Date.now() + 320;
    }
    clearStatusBarDragState();
    if (!shouldPersist || !isDomElement(bar)) return;

    const rect = bar.getBoundingClientRect();
    setStatusBarPosition(bar, rect.left, rect.top, { persist: true });
  }

  function ensureStatusBarElement() {
    const hostDocument = getHostDocument();
    if (!hostDocument) return null;
    const body = hostDocument.body;
    if (!body) return null;

    const bars = Array.from(hostDocument.querySelectorAll(`.${STATUS_BAR_CLASS}`));
    if (bars.length > 1) {
      bars.slice(1).forEach((node) => node.remove());
    }

    let bar = bars[0] || null;
    if (!bar) {
      bar = hostDocument.createElement('div');
      bar.className = STATUS_BAR_CLASS;
    }

    bar.removeEventListener('pointerdown', onStatusBarPointerDown);
    bar.addEventListener('pointerdown', onStatusBarPointerDown);
    bar.removeEventListener('click', onStatusBarContainerClick);
    bar.addEventListener('click', onStatusBarContainerClick);

    let toggleButton = bar.querySelector(`.${STATUS_BAR_TOGGLE_BUTTON_CLASS}`);
    if (!toggleButton) {
      toggleButton = hostDocument.createElement('button');
      toggleButton.textContent = '✦';
    }
    toggleButton.type = 'button';
    toggleButton.className = STATUS_BAR_TOGGLE_BUTTON_CLASS;
    toggleButton.setAttribute('aria-label', '最小化状态栏');
    toggleButton.removeEventListener('click', onStatusBarToggleButtonClick);
    toggleButton.addEventListener('click', onStatusBarToggleButtonClick);
    toggleButton.removeEventListener('pointerup', onStatusBarToggleButtonPointerUp);
    toggleButton.addEventListener('pointerup', onStatusBarToggleButtonPointerUp);
    toggleButton.removeEventListener('touchend', onStatusBarToggleButtonTouchEnd);
    toggleButton.addEventListener('touchend', onStatusBarToggleButtonTouchEnd, { passive: false });

    let textNode = bar.querySelector(`.${STATUS_BAR_TEXT_CLASS}`);
    if (!textNode) {
      textNode = hostDocument.createElement('span');
      textNode.className = STATUS_BAR_TEXT_CLASS;
    }

    let dotsNode = bar.querySelector(`.${STATUS_BAR_DOTS_CLASS}`);
    if (!dotsNode) {
      dotsNode = hostDocument.createElement('span');
      dotsNode.className = STATUS_BAR_DOTS_CLASS;
    }

    let settingsButton = bar.querySelector(`.${STATUS_BAR_SETTINGS_BUTTON_CLASS}`);
    if (!settingsButton) {
      settingsButton = hostDocument.createElement('button');
    }
    settingsButton.type = 'button';
    settingsButton.className = STATUS_BAR_SETTINGS_BUTTON_CLASS;
    settingsButton.textContent = '设置';
    settingsButton.style.pointerEvents = 'auto';
    settingsButton.style.touchAction = 'manipulation';
    settingsButton.removeEventListener('pointerdown', onStatusBarSettingsButtonPointerDown);
    settingsButton.addEventListener('pointerdown', onStatusBarSettingsButtonPointerDown);
    settingsButton.removeEventListener('click', onStatusBarSettingsButtonClick);
    settingsButton.addEventListener('click', onStatusBarSettingsButtonClick);

    let navUpButton = bar.querySelector(`.${STATUS_BAR_NAV_UP_BUTTON_CLASS}`);
    if (!navUpButton) {
      navUpButton = hostDocument.createElement('button');
    }
    navUpButton.type = 'button';
    navUpButton.className = STATUS_BAR_NAV_UP_BUTTON_CLASS;
    navUpButton.textContent = '▲';
    navUpButton.title = '上一楼层';
    navUpButton.setAttribute('aria-label', '上一楼层');
    navUpButton.removeEventListener('pointerdown', onNavButtonPointerDown);
    navUpButton.addEventListener('pointerdown', onNavButtonPointerDown);
    navUpButton.removeEventListener('click', onNavUpButtonClick);
    navUpButton.addEventListener('click', onNavUpButtonClick);
    navUpButton.removeEventListener('pointerup', onNavUpButtonPointerUp);
    navUpButton.addEventListener('pointerup', onNavUpButtonPointerUp);
    navUpButton.removeEventListener('touchend', onNavUpButtonTouchEnd);
    navUpButton.addEventListener('touchend', onNavUpButtonTouchEnd, { passive: false });

    let navDownButton = bar.querySelector(`.${STATUS_BAR_NAV_DOWN_BUTTON_CLASS}`);
    if (!navDownButton) {
      navDownButton = hostDocument.createElement('button');
    }
    navDownButton.type = 'button';
    navDownButton.className = STATUS_BAR_NAV_DOWN_BUTTON_CLASS;
    navDownButton.textContent = '▼';
    navDownButton.title = '下一楼层';
    navDownButton.setAttribute('aria-label', '下一楼层');
    navDownButton.removeEventListener('pointerdown', onNavButtonPointerDown);
    navDownButton.addEventListener('pointerdown', onNavButtonPointerDown);
    navDownButton.removeEventListener('click', onNavDownButtonClick);
    navDownButton.addEventListener('click', onNavDownButtonClick);
    navDownButton.removeEventListener('pointerup', onNavDownButtonPointerUp);
    navDownButton.addEventListener('pointerup', onNavDownButtonPointerUp);
    navDownButton.removeEventListener('touchend', onNavDownButtonTouchEnd);
    navDownButton.addEventListener('touchend', onNavDownButtonTouchEnd, { passive: false });

    const desiredChildren = [toggleButton, dotsNode, textNode, navUpButton, navDownButton, settingsButton];
    const currentChildren = Array.from(bar.children);
    const needsReplaceChildren = currentChildren.length !== desiredChildren.length
      || desiredChildren.some((node, index) => currentChildren[index] !== node);

    if (needsReplaceChildren) {
      bar.replaceChildren(...desiredChildren);
    }

    if (bar.parentElement !== body) {
      body.appendChild(bar);
    }
    return bar;
  }

  function renderParallelStatusBar(text, options = {}) {
    if (!ensureStatusBarStyle()) {
      warn('并发状态栏样式注入失败，已跳过本次状态显示');
      return false;
    }

    const bar = ensureStatusBarElement();
    if (!bar) {
      warn('找不到 body，无法渲染并发状态栏');
      return false;
    }

    const toggleButton = bar.querySelector(`.${STATUS_BAR_TOGGLE_BUTTON_CLASS}`);
    const dotsNode = bar.querySelector(`.${STATUS_BAR_DOTS_CLASS}`);
    const textNode = bar.querySelector(`.${STATUS_BAR_TEXT_CLASS}`) || bar;
    const settingsButton = bar.querySelector(`.${STATUS_BAR_SETTINGS_BUTTON_CLASS}`);
    const simpleMode = isStatusBarSimpleMode();
    const verticalMode = isStatusBarVertical();
    bar.classList.toggle(STATUS_BAR_SIMPLE_MODE_CLASS, simpleMode);
    bar.classList.toggle(STATUS_BAR_VERTICAL_CLASS, verticalMode);
    const isCollapsed = isStatusBarCollapsed();
    const isWorking = isStatusBarWorking(options.job);
    bar.classList.toggle(STATUS_BAR_WORKING_CLASS, isWorking);
    applyStatusBarCollapsedState(bar, isCollapsed);
    if (toggleButton) {
      if (isCollapsed && isWorking) {
        const hasSpinner = Boolean(toggleButton.querySelector('.gemini-parallel-status-spinner'));
        if (!hasSpinner) {
          toggleButton.innerHTML = '<i class="fa-solid fa-spinner gemini-parallel-status-spinner" aria-hidden="true"></i>';
        }
      } else {
        const hasOnlyDefaultIcon = toggleButton.textContent === '✦' && !toggleButton.querySelector('i');
        if (!hasOnlyDefaultIcon) {
          toggleButton.textContent = '✦';
        }
      }
      const actionText = isCollapsed
        ? (isWorking ? '工作中（点击展开）' : '展开状态栏')
        : '最小化为图标';
      toggleButton.title = actionText;
      toggleButton.setAttribute('aria-label', actionText);
    }
    if (settingsButton) {
      settingsButton.title = '打开设置';
      settingsButton.textContent = simpleMode ? '⚙' : '设置';
      settingsButton.setAttribute('aria-label', '打开设置');
    }
    const normalizedText = String(text || '').trim();
    const nextText = normalizedText || buildIdleStatusText();
    if (textNode.textContent !== nextText) {
      textNode.textContent = nextText;
    }
    renderStatusBarDots(
      dotsNode,
      buildStatusDotStates(options.progress, options.job),
    );
    if (!statusBarDragState) {
      const appliedSavedPosition = applySavedStatusBarPosition(bar);
      if (!appliedSavedPosition) {
        applyDefaultStatusBarPosition(bar);
      }
    }
    return true;
  }

  function createRetryStatusKey(prefix = 'retry') {
    retryStatusKeySeq += 1;
    return `${prefix}-${retryStatusKeySeq}`;
  }

  function getLatestRetryStatusEntry() {
    let latest = null;
    retryStatusEntries.forEach((entry) => {
      if (!latest || Number(entry.seq) > Number(latest.seq)) {
        latest = entry;
      }
    });
    return latest;
  }

  function buildRetryStatusText() {
    if (retryStatusEntries.size === 0) return '';
    const latest = getLatestRetryStatusEntry();
    if (!latest) return '';

    const attempt = Number(latest.attempt) || 0;
    const maxRetries = Number(latest.maxRetries) || getConfiguredRetryCount();
    const reason = String(latest.reason || '429').trim() || '429';
    const scope = String(latest.scope || '请求');
    const concurrentCount = retryStatusEntries.size;
    const concurrentSuffix = concurrentCount > 1 ? ` · 并行 ${concurrentCount}` : '';
    return `${reason}重试 ${attempt}/${maxRetries} · ${scope}${concurrentSuffix}`;
  }

  function refreshStatusBarForRetryState() {
    if (activeJob && !isJobTerminal(activeJob) && !activeJob.aborted) {
      syncJobStatusBar(activeJob);
      return;
    }

    const retryText = buildRetryStatusText();
    if (retryText) {
      renderParallelStatusBar(retryText);
    } else {
      renderParallelStatusBar(buildIdleStatusText());
    }
  }

  function setRetryStatusEntry(key, entry) {
    if (!key || !entry || typeof entry !== 'object') return;
    retryStatusSeq += 1;
    retryStatusEntries.set(key, {
      ...entry,
      seq: retryStatusSeq,
    });
    refreshStatusBarForRetryState();
  }

  function clearRetryStatusEntry(key) {
    if (!key) return;
    const removed = retryStatusEntries.delete(key);
    if (removed) {
      refreshStatusBarForRetryState();
    }
  }

  function buildParallelStatusText(progress) {
    const completed = Number(progress?.completed) || 0;
    const total = Number(progress?.total) || 0;
    const success = Number(progress?.success) || 0;
    const failed = Number(progress?.failed) || 0;
    const baseText = `并发补全 进行中 ${completed}/${total} · 成功 ${success} · 失败 ${failed}`;
    const retryText = buildRetryStatusText();
    return retryText ? `${baseText} · ${retryText}` : baseText;
  }

  function updateParallelStatusBar(job, progress) {
    if (!job) return false;
    const text = buildParallelStatusText(progress);
    return renderParallelStatusBar(text, { job, progress });
  }

  function removeJobStatusBar() {
    return renderParallelStatusBar(buildIdleStatusText());
  }

  function syncJobStatusBar(job) {
    if (!job || job.aborted) return false;
    const progress = job.progress || {
      completed: 0,
      total: job.extraCount,
      success: 0,
      failed: 0,
    };
    return updateParallelStatusBar(job, progress);
  }

  function stopStatusBarTracker() {
    if (statusTrackTimer) {
      clearInterval(statusTrackTimer);
      statusTrackTimer = null;
    }
  }

  function startStatusBarTracker(job) {
    stopStatusBarTracker();
    if (!job) return;

    syncJobStatusBar(job);
    statusTrackTimer = setInterval(() => {
      if (!activeJob || activeJob.id !== job.id || job.aborted) {
        stopStatusBarTracker();
        return;
      }
      syncJobStatusBar(job);
    }, 120);
  }

  function setJobPhase(job, phase) {
    if (!job) return;
    const previousPhase = job.phase;
    job.phase = phase;
    job.state = phase;
    debug('任务阶段变更', {
      jobId: job.id,
      from: previousPhase,
      to: phase,
      generationType: job.generationType,
    });
  }

  function isJobTerminal(job) {
    if (!job) return true;
    return job.phase === JOB_PHASES.done
      || job.phase === JOB_PHASES.aborted
      || job.phase === JOB_PHASES.superseded;
  }

  function abortJobControllers(job) {
    if (!job || !Array.isArray(job.controllers)) return;
    for (const controller of job.controllers) {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }
  }

  function abortActiveJob(reason) {
    const job = activeJob;
    abortForegroundValidation(reason || 'abortActiveJob');
    if (!job) {
      debug('请求中止任务，但当前无 activeJob', { reason });
      stopStatusBarTracker();
      refreshStatusBarForRetryState();
      return;
    }

    if (isJobTerminal(job)) {
      debug('请求中止任务，但任务已结束', { reason, job: summarizeJob(job) });
      clearActiveJobIfMatch(job);
      return;
    }

    debug('中止并发任务', { reason, job: summarizeJob(job) });
    job.aborted = true;
    job.abortReason = String(reason || 'aborted');
    setJobPhase(job, JOB_PHASES.aborted);
    abortJobControllers(job);
    clearActiveJobIfMatch(job);
  }

  function supersedeActiveJob(reason) {
    const job = activeJob;
    abortForegroundValidation(reason || 'supersedeActiveJob');
    if (!job || isJobTerminal(job)) {
      debug('请求废弃任务，但无可废弃任务', { reason, hasJob: Boolean(job) });
      return false;
    }

    debug('废弃并发任务', { reason, job: summarizeJob(job) });
    job.superseded = true;
    job.supersededReason = String(reason || '会话已进入下一轮');
    job.aborted = true;
    setJobPhase(job, JOB_PHASES.superseded);
    abortJobControllers(job);
    warningToast(`并发结果已丢弃：${job.supersededReason}`);
    clearActiveJobIfMatch(job);
    return true;
  }

  function getContext() {
    const hostWindow = getHostWindow();
    try {
      if (hostWindow.SillyTavern && typeof hostWindow.SillyTavern.getContext === 'function') {
        return hostWindow.SillyTavern.getContext();
      }
      if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
        return window.SillyTavern.getContext();
      }
      return hostWindow.SillyTavern || window.SillyTavern || {};
    } catch {
      return {};
    }
  }

  function clampParallelCap(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_CONFIG.max_parallel_cap;
    return Math.max(1, Math.min(10, Math.floor(num)));
  }

  function clampRetryCount(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_CONFIG.retry_count;
    return Math.max(0, Math.min(MAX_RETRY_COUNT, Math.floor(num)));
  }

  function clampRetryDelayMs(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_CONFIG.retry_delay_ms;
    return Math.max(0, Math.min(MAX_RETRY_DELAY_MS, Math.floor(num)));
  }

  function clampMinReplyTokens(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_CONFIG.min_reply_tokens;
    return Math.max(0, Math.min(MAX_MIN_REPLY_TOKENS, Math.floor(num)));
  }

  function clampStatusBarOpacityPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_STATUS_BAR_OPACITY_PERCENT;
    return Math.max(MIN_STATUS_BAR_OPACITY_PERCENT, Math.min(MAX_STATUS_BAR_OPACITY_PERCENT, Math.round(num)));
  }

  function clampStatusBarScalePercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_STATUS_BAR_SCALE_PERCENT;
    return Math.max(MIN_STATUS_BAR_SCALE_PERCENT, Math.min(MAX_STATUS_BAR_SCALE_PERCENT, Math.round(num)));
  }

  function clampTemperature(value, fallback = DEFAULT_PARALLEL_TEMPERATURE) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return Math.max(MIN_TEMPERATURE, Math.min(MAX_TEMPERATURE, num));
    }

    const fallbackNum = Number(fallback);
    if (Number.isFinite(fallbackNum)) {
      return Math.max(MIN_TEMPERATURE, Math.min(MAX_TEMPERATURE, fallbackNum));
    }

    return DEFAULT_PARALLEL_TEMPERATURE;
  }

  function normalizeParallelTemperatures(rawValue) {
    if (!Array.isArray(rawValue)) {
      return [];
    }

    const result = [];
    for (const item of rawValue) {
      const num = Number(item);
      if (!Number.isFinite(num)) continue;
      result.push(clampTemperature(num));
    }
    return result;
  }

  function getConfiguredParallelTemperatures() {
    return normalizeParallelTemperatures(config?.parallel_temperatures ?? DEFAULT_CONFIG.parallel_temperatures);
  }

  function formatParallelTemperatures(values) {
    return normalizeParallelTemperatures(values)
      .map(item => String(item))
      .join(', ');
  }

  function parseParallelTemperaturesInput(rawInput) {
    const raw = String(rawInput ?? '').trim();
    if (!raw) {
      return { ok: true, values: [] };
    }

    const normalized = raw.replace(/[，、|]/g, ',');
    const tokens = normalized.split(',').map(item => item.trim());
    const values = [];

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (!token) {
        return { ok: false, error: `第 ${i + 1} 项为空，请删除多余逗号` };
      }
      const num = Number(token);
      if (!Number.isFinite(num)) {
        return { ok: false, error: `第 ${i + 1} 项不是数字：${token}` };
      }
      values.push(clampTemperature(num));
    }

    return { ok: true, values };
  }

  function getPayloadTemperature(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const candidates = [];
    if (Object.prototype.hasOwnProperty.call(payload, 'temperature')) {
      candidates.push(payload.temperature);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'temprature')) {
      candidates.push(payload.temprature);
    }

    for (const candidate of candidates) {
      const num = Number(candidate);
      if (Number.isFinite(num)) {
        return clampTemperature(num);
      }
    }

    return null;
  }

  function resolveParallelRequestTemperature(job, index) {
    const configuredTemps = getConfiguredParallelTemperatures();
    const configuredTemperature = configuredTemps[index - 1];
    if (Number.isFinite(configuredTemperature)) {
      return clampTemperature(configuredTemperature);
    }

    const foregroundTemperature = getPayloadTemperature(job?.basePayload);
    if (Number.isFinite(foregroundTemperature)) {
      return clampTemperature(foregroundTemperature);
    }

    return DEFAULT_PARALLEL_TEMPERATURE;
  }

  function getConfiguredRetryCount() {
    return clampRetryCount(config?.retry_count ?? DEFAULT_429_RETRIES);
  }

  function getConfiguredRetryDelayMs() {
    return clampRetryDelayMs(config?.retry_delay_ms ?? DEFAULT_429_RETRY_DELAY_MS);
  }

  function getConfiguredMinReplyTokens() {
    return clampMinReplyTokens(config?.min_reply_tokens ?? DEFAULT_MIN_REPLY_TOKENS);
  }

  function getConfiguredStatusBarOpacityPercent() {
    return clampStatusBarOpacityPercent(
      config?.status_bar_opacity_percent ?? DEFAULT_STATUS_BAR_OPACITY_PERCENT,
    );
  }

  function getConfiguredStatusBarScalePercent() {
    return clampStatusBarScalePercent(
      config?.status_bar_scale_percent ?? DEFAULT_STATUS_BAR_SCALE_PERCENT,
    );
  }

  function isAuctionModeEnabled() {
    return normalizeBooleanFlag(config?.auction_mode_enabled, DEFAULT_CONFIG.auction_mode_enabled);
  }

  function isSilentModeEnabled() {
    return normalizeBooleanFlag(config?.silent_mode_enabled, DEFAULT_CONFIG.silent_mode_enabled);
  }

  function normalizeBooleanFlag(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
    }
    return fallback;
  }

  function getScriptVariableScopes() {
    const scopes = [];
    const rawScriptId = typeof getScriptId === 'function' ? getScriptId() : '';
    const scriptId = String(rawScriptId ?? '').trim();
    if (scriptId) {
      scopes.push({ type: 'script', script_id: scriptId });
    }
    scopes.push({ type: 'script' });
    return scopes;
  }

  function parseStoredConfigCandidate(rawValue) {
    if (!rawValue) return null;
    if (typeof rawValue === 'object') return rawValue;
    if (typeof rawValue !== 'string') return null;
    const text = rawValue.trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function mergeStoredConfigFragment(base, incoming) {
    const merged = isPlainObject(base) ? { ...base } : {};
    if (!isPlainObject(incoming)) return merged;

    for (const [key, value] of Object.entries(incoming)) {
      if (Array.isArray(value)) {
        merged[key] = value.slice();
        continue;
      }
      if (isPlainObject(value)) {
        const current = isPlainObject(merged[key]) ? merged[key] : {};
        merged[key] = mergeStoredConfigFragment(current, value);
        continue;
      }
      if (value !== undefined) {
        merged[key] = value;
      }
    }
    return merged;
  }

  function mergeStoredStatusBarPosition(candidates) {
    const mergedStore = {
      horizontal: null,
      vertical: null,
    };

    for (const candidate of candidates) {
      const store = normalizeStatusBarPositionStore(candidate?.status_bar_position);
      if (store.horizontal) {
        mergedStore.horizontal = store.horizontal;
      }
      if (store.vertical) {
        mergedStore.vertical = store.vertical;
      }
    }

    return mergedStore.horizontal || mergedStore.vertical ? mergedStore : null;
  }

  function normalizeWorldbookSwitcherConfig(rawConfig) {
    const raw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const defaults = DEFAULT_CONFIG.worldbook_switcher;
    const rawPanelState = raw.panelState && typeof raw.panelState === 'object' ? raw.panelState : {};
    const entryUsageStats = {};

    if (raw.entryUsageStats && typeof raw.entryUsageStats === 'object' && !Array.isArray(raw.entryUsageStats)) {
      for (const [key, value] of Object.entries(raw.entryUsageStats)) {
        if (!value || typeof value !== 'object') continue;
        const count = Number(value.count);
        const lastUsed = Number(value.lastUsed);
        entryUsageStats[key] = {
          count: Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0,
          lastUsed: Number.isFinite(lastUsed) ? Math.max(0, Math.floor(lastUsed)) : 0,
          name: typeof value.name === 'string' ? value.name : '',
          worldbook: typeof value.worldbook === 'string' ? value.worldbook : '',
          pinned: Boolean(value.pinned),
        };
      }
    }

    return {
      simpleMode: normalizeBooleanFlag(raw.simpleMode, defaults.simpleMode),
      favoriteWorldbooks: Array.isArray(raw.favoriteWorldbooks)
        ? raw.favoriteWorldbooks.filter(item => typeof item === 'string')
        : [...defaults.favoriteWorldbooks],
      currentWorldbook: typeof raw.currentWorldbook === 'string' ? raw.currentWorldbook : defaults.currentWorldbook,
      entryUsageStats,
      panelState: {
        allWorldbooks: normalizeBooleanFlag(rawPanelState.allWorldbooks, defaults.panelState.allWorldbooks),
        frequentEntries: normalizeBooleanFlag(rawPanelState.frequentEntries, defaults.panelState.frequentEntries),
      },
      pinnedWorldbooks: Array.isArray(raw.pinnedWorldbooks)
        ? raw.pinnedWorldbooks.filter(item => typeof item === 'string')
        : [...defaults.pinnedWorldbooks],
    };
  }

  function normalizeConfig(rawConfig) {
    const raw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    return {
      enabled: normalizeBooleanFlag(raw.enabled, DEFAULT_CONFIG.enabled),
      max_parallel_cap: clampParallelCap(raw.max_parallel_cap ?? DEFAULT_CONFIG.max_parallel_cap),
      retry_count: clampRetryCount(raw.retry_count ?? DEFAULT_CONFIG.retry_count),
      retry_delay_ms: clampRetryDelayMs(raw.retry_delay_ms ?? DEFAULT_CONFIG.retry_delay_ms),
      min_reply_tokens: clampMinReplyTokens(raw.min_reply_tokens ?? DEFAULT_CONFIG.min_reply_tokens),
      auction_mode_enabled: normalizeBooleanFlag(
        raw.auction_mode_enabled,
        DEFAULT_CONFIG.auction_mode_enabled,
      ),
      silent_mode_enabled: normalizeBooleanFlag(
        raw.silent_mode_enabled,
        DEFAULT_CONFIG.silent_mode_enabled,
      ),
      parallel_temperatures: normalizeParallelTemperatures(raw.parallel_temperatures ?? DEFAULT_CONFIG.parallel_temperatures),
      status_bar_position: normalizeStatusBarPositionStore(raw.status_bar_position ?? DEFAULT_CONFIG.status_bar_position),
      status_bar_collapsed: normalizeBooleanFlag(raw.status_bar_collapsed, DEFAULT_CONFIG.status_bar_collapsed),
      status_bar_simple_mode: normalizeBooleanFlag(raw.status_bar_simple_mode, DEFAULT_CONFIG.status_bar_simple_mode),
      status_bar_vertical: normalizeBooleanFlag(raw.status_bar_vertical, DEFAULT_CONFIG.status_bar_vertical),
      status_bar_opacity_percent: clampStatusBarOpacityPercent(
        raw.status_bar_opacity_percent ?? DEFAULT_CONFIG.status_bar_opacity_percent,
      ),
      status_bar_scale_percent: clampStatusBarScalePercent(
        raw.status_bar_scale_percent ?? DEFAULT_CONFIG.status_bar_scale_percent,
      ),
      old_floor_swipe_enabled: normalizeBooleanFlag(raw.old_floor_swipe_enabled, DEFAULT_CONFIG.old_floor_swipe_enabled),
      worldbook_switcher_enabled: normalizeBooleanFlag(
        raw.worldbook_switcher_enabled,
        DEFAULT_CONFIG.worldbook_switcher_enabled,
      ),
      worldbook_switcher: normalizeWorldbookSwitcherConfig(raw.worldbook_switcher),
    };
  }

  function loadConfig() {
    try {
      if (typeof getVariables !== 'function') {
        return normalizeConfig(undefined);
      }
      const candidates = [];
      const scopes = [...getScriptVariableScopes()].reverse();
      for (const scope of scopes) {
        const vars = getVariables(scope);
        const parsed = parseStoredConfigCandidate(vars?.[CONFIG_KEY]);
        if (parsed) {
          candidates.push(parsed);
        }
      }
      const localStatusBarPosition = loadStatusBarPositionFromLocalStorage();
      if (!candidates.length && !localStatusBarPosition) {
        return normalizeConfig(undefined);
      }

      const merged = candidates.reduce((acc, candidate) => mergeStoredConfigFragment(acc, candidate), {});
      const statusBarPositionCandidates = [...candidates];
      if (localStatusBarPosition) {
        statusBarPositionCandidates.push({ status_bar_position: localStatusBarPosition });
      }
      const mergedStatusBarPosition = mergeStoredStatusBarPosition(statusBarPositionCandidates);
      if (mergedStatusBarPosition) {
        merged.status_bar_position = mergedStatusBarPosition;
      }
      return normalizeConfig(merged);
    } catch (error) {
      warn('读取脚本变量失败，使用默认配置:', error);
      return normalizeConfig(undefined);
    }
  }

  function reloadConfigFromStorage(options = {}) {
    config = loadConfig();
    if (config?.status_bar_position) {
      saveStatusBarPositionToLocalStorage(config.status_bar_position);
    }
    if (options.refreshStatusBar !== false) {
      refreshStatusBarForRetryState();
    }
    return config;
  }

  async function saveConfig() {
    try {
      if (typeof insertOrAssignVariables !== 'function') return false;
      let saved = false;
      for (const scope of getScriptVariableScopes()) {
        const result = insertOrAssignVariables({ [CONFIG_KEY]: config }, scope);
        if (result && typeof result.then === 'function') {
          await result;
        }
        saved = true;
      }
      return saved;
    } catch (error) {
      warn('保存脚本变量失败:', error);
      return false;
    }
  }

  function getCurrentSource() {
    const context = getContext();
    const source = context?.chatCompletionSettings?.chat_completion_source
      || context?.chatCompletionSettings?.chat_comletion_source
      || '';
    return typeof source === 'string' ? source : '';
  }

  function isGroupChat() {
    const context = getContext();
    return Boolean(context?.groupId);
  }

  function getNValueFromUi() {
    const input = getHostDocument().querySelector('#n_openai');
    if (!input) return 1;
    const raw = Number(input.value ?? input.getAttribute('value') ?? 1);
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, Math.floor(raw));
  }

  function getDesiredN(generateData, options = {}) {
    const allowUiFallback = options.allowUiFallback !== false;
    let wanted = Number(generateData?.n);
    if ((!Number.isFinite(wanted) || wanted < 1) && allowUiFallback) {
      wanted = getNValueFromUi();
    }
    if (!Number.isFinite(wanted) || wanted < 1) {
      return 1;
    }

    wanted = Math.max(1, Math.floor(wanted));
    const cap = clampParallelCap(config.max_parallel_cap);

    if (wanted > cap) {
      warningToast(`并发上限为 ${cap}，已从 ${wanted} 限制到 ${cap}`);
      wanted = cap;
    }

    return wanted;
  }

  function getSourceFromGenerateData(generateData) {
    const source = generateData?.chat_completion_source
      || generateData?.chat_comletion_source
      || generateData?.source
      || '';
    return typeof source === 'string' ? source : '';
  }

  function deepClone(value) {
    try {
      if (typeof structuredClone === 'function') {
        return structuredClone(value);
      }
    } catch {
      // fallback below
    }

    return JSON.parse(JSON.stringify(value));
  }

  function patchNOpenAiVisibility() {
    const input = getHostDocument().querySelector('#n_openai');
    if (!input) return false;

    const block = input.closest('.range-block');
    if (!block) return false;

    const current = String(block.getAttribute('data-source') || '');
    const parts = current.split(',').map(x => x.trim()).filter(Boolean);
    const sourceSet = new Set(parts);
    for (const source of PARALLEL_SOURCES) {
      sourceSet.add(source);
    }
    const next = Array.from(sourceSet).join(',');

    if (next !== current) {
      block.setAttribute('data-source', next);
      log('已更新 n_openai 的 data-source:', next);
    }

    return true;
  }

  function getCurrentSourceFromUi() {
    const hostDocument = getHostDocument();
    const sourceSelect = hostDocument.querySelector('#chat_completion_source');
    if (!sourceSelect) return '';
    const value = sourceSelect.value;
    return typeof value === 'string' ? value : '';
  }

  function applyDataSourceVisibility() {
    const hostWindow = getHostWindow();
    const hostDocument = getHostDocument();
    const source = getCurrentSourceFromUi() || getCurrentSource();
    if (!source) return;

    if (hostWindow.$ && typeof hostWindow.$ === 'function') {
      hostWindow.$('[data-source]', hostDocument).each(function () {
        const $el = hostWindow.$(this);
        const mode = $el.data('source-mode');
        const rawSources = String($el.attr('data-source') || '');
        const validSources = rawSources.split(',').map(x => x.trim()).filter(Boolean);
        const matchesSource = validSources.includes(source);
        const shouldShow = mode !== 'except' ? matchesSource : !matchesSource;
        $el.toggle(shouldShow);
      });
      return;
    }

    const all = hostDocument.querySelectorAll('[data-source]');
    all.forEach((el) => {
      const mode = el.getAttribute('data-source-mode');
      const rawSources = String(el.getAttribute('data-source') || '');
      const validSources = rawSources.split(',').map(x => x.trim()).filter(Boolean);
      const matchesSource = validSources.includes(source);
      const shouldShow = mode !== 'except' ? matchesSource : !matchesSource;
      if (shouldShow) {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });
  }

  function scheduleUiPatch() {
    if (patchTimer) {
      clearTimeout(patchTimer);
    }
    patchTimer = setTimeout(() => {
      patchTimer = null;
      patchNOpenAiVisibility();
      applyDataSourceVisibility();
      refreshStatusBarForRetryState();
    }, 60);
  }

  function onAppReady() {
    reloadConfigFromStorage({ refreshStatusBar: false });
    scheduleUiPatch();
  }

  function isPlainSlashCommand(text) {
    return String(text || '').trimStart().startsWith('/');
  }

  function hasPendingAttachment() {
    const hostDocument = getHostDocument();
    const selectors = [
      '#send_form .file-preview',
      '#send_form .file_attachment',
      '#send_form .media_attachment',
      '#send_form .mes_file_container .file',
    ];
    return selectors.some(selector => hostDocument.querySelector(selector));
  }

  function shouldInterceptNormalSend() {
    if (!isEffectivelyEnabled()) return false;
    if (isGroupChat()) return false;

    const source = getCurrentSource();
    if (!PARALLEL_SOURCES.has(source)) return false;

    const wanted = getDesiredN(null, { allowUiFallback: true });
    if (wanted <= 1) return false;

    const textarea = getHostDocument().querySelector('#send_textarea');
    if (!textarea) return false;

    const text = String(textarea.value ?? '');
    if (!text.trim()) return false;
    if (isPlainSlashCommand(text)) return false;
    if (hasPendingAttachment()) return false;

    return true;
  }

  async function interceptNormalSend() {
    if (manualSendLock) return;
    manualSendLock = true;

    try {
      const hostWindow = getHostWindow();
      const textarea = getHostDocument().querySelector('#send_textarea');
      if (!textarea) return;

      const text = String(textarea.value ?? '');
      if (!text.trim()) return;

      if (typeof triggerSlash !== 'function') {
        throw new Error('triggerSlash 不可用');
      }

      await triggerSlash(`/send raw=true ${JSON.stringify(text)}`);
      textarea.value = '';
      textarea.dispatchEvent(new hostWindow.Event('input', { bubbles: true }));
      textarea.dispatchEvent(new hostWindow.Event('change', { bubbles: true }));
      await triggerSlash('/trigger');
    } catch (error) {
      warn('普通发送接管失败，已放弃本次接管:', error);
      errorToast('普通发送接管失败，请重试一次');
    } finally {
      manualSendLock = false;
    }
  }

  function onSendButtonCapture(event) {
    if (!shouldInterceptNormalSend()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void interceptNormalSend();
  }

  function onTextareaKeydownCapture(event) {
    if (event.key !== 'Enter' && event.key !== 'NumpadEnter') return;
    if (event.shiftKey) return;
    if (!shouldInterceptNormalSend()) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void interceptNormalSend();
  }

  function bindNormalSendInterceptors() {
    const hostDocument = getHostDocument();
    const sendButton = hostDocument.querySelector('#send_but');
    if (sendButton) {
      sendButton.addEventListener('click', onSendButtonCapture, true);
      domCleanups.push(() => sendButton.removeEventListener('click', onSendButtonCapture, true));
    }

    const textarea = hostDocument.querySelector('#send_textarea');
    if (textarea) {
      textarea.addEventListener('keydown', onTextareaKeydownCapture, true);
      domCleanups.push(() => textarea.removeEventListener('keydown', onTextareaKeydownCapture, true));
    }
  }

  function scheduleDomRebind() {
    if (domBindTimer) {
      clearTimeout(domBindTimer);
    }
    domBindTimer = setTimeout(() => {
      domBindTimer = null;
      cleanupDomListeners();
      bindNormalSendInterceptors();
    }, 80);
  }

  function getRequestHeaders() {
    const context = getContext();
    if (context && typeof context.getRequestHeaders === 'function') {
      return context.getRequestHeaders();
    }
    return { 'Content-Type': 'application/json' };
  }

  function resolveRequestMethod(input, init) {
    if (typeof init?.method === 'string' && init.method) {
      return init.method.toUpperCase();
    }
    if (typeof Request !== 'undefined' && input instanceof Request && typeof input.method === 'string') {
      return input.method.toUpperCase();
    }
    return 'GET';
  }

  function resolveRequestUrl(input) {
    if (typeof input === 'string') return input;
    if (typeof URL !== 'undefined' && input instanceof URL) return input.toString();
    if (input && typeof input.url === 'string') return input.url;
    return '';
  }

  function isGenerateApiRequest(input, init) {
    if (init && init[FETCH_RETRY_SKIP_FLAG] === true) {
      return false;
    }

    const method = resolveRequestMethod(input, init);
    if (method !== 'POST') {
      return false;
    }

    const rawUrl = resolveRequestUrl(input);
    if (!rawUrl) {
      return false;
    }

    try {
      const parsed = new URL(rawUrl, window.location.origin);
      return parsed.pathname === GENERATE_API_PATH;
    } catch {
      return rawUrl === GENERATE_API_PATH;
    }
  }

  function createFetchRequestFactory(input, init) {
    if (typeof Request === 'undefined') {
      return null;
    }

    try {
      const baseRequest = new Request(input, init);
      return {
        signal: baseRequest.signal,
        next: () => baseRequest.clone(),
      };
    } catch (error) {
      debug('构造可重试请求失败，回退为单次请求', {
        message: error?.message || String(error),
      });
      return null;
    }
  }

  function parseJsonSafely(text) {
    if (typeof text !== 'string' || !text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function isRateLimitErrorPayload(payload) {
    if (!payload || typeof payload !== 'object') return false;

    const nodes = [payload, payload.error].filter(node => node && typeof node === 'object');
    for (const node of nodes) {
      const code = Number(node.code);
      if (Number.isFinite(code) && code === 429) return true;

      const status = String(node.status || '').trim().toUpperCase();
      if (status === 'RESOURCE_EXHAUSTED' || status === 'TOO_MANY_REQUESTS') return true;

      const message = String(node.message || '');
      if (/resource exhausted/i.test(message)) return true;
      if (/\b429\b/.test(message) && /try again later/i.test(message)) return true;
    }

    return false;
  }

  function isRateLimitedResponse(status, errorPayload, errorText = '') {
    if (Number(status) === 429) return true;
    if (isRateLimitErrorPayload(errorPayload)) return true;

    const text = String(errorText || '');
    if (/resource exhausted/i.test(text)) return true;
    if (/\b429\b/.test(text) && /try again later/i.test(text)) return true;
    return false;
  }

  async function fetchGenerateWith429Retry(fetchImpl, input, init, meta = null) {
    const retryStatusKey = createRetryStatusKey('foreground-retry');
    const retryScope = String(meta?.scope || '').trim() ? `前台(${meta.scope})` : '前台';
    const requestFactory = createFetchRequestFactory(input, init);
    if (!requestFactory) {
      return fetchImpl(input, init);
    }

    try {
      const maxRetries = getConfiguredRetryCount();
      const retryDelayMs = getConfiguredRetryDelayMs();
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        if (requestFactory.signal?.aborted) {
          throw createAbortError('请求已中止');
        }

        const response = await fetchImpl(requestFactory.next());
        let errorText = '';
        let errorPayload = null;
        if (!response.ok) {
          try {
            errorText = await response.clone().text();
            errorPayload = parseJsonSafely(errorText);
          } catch {
            // ignore
          }
        }

        const isRateLimited = isRateLimitedResponse(response.status, errorPayload, errorText);
        if (!isRateLimited) {
          return response;
        }

        if (attempt >= maxRetries) {
          return response;
        }

        setRetryStatusEntry(retryStatusKey, {
          reason: '429',
          scope: retryScope,
          attempt: attempt + 1,
          maxRetries,
        });
        debug('前台生成请求命中限流，自动重试', {
          scope: meta?.scope || 'unknown',
          httpStatus: response.status,
          retry: attempt + 1,
          maxRetries,
          retryDelayMs,
        });

        try {
          if (response.body && typeof response.body.cancel === 'function') {
            await response.body.cancel();
          }
        } catch {
          // ignore
        }

        await sleepWithAbort(retryDelayMs, requestFactory.signal);
      }
    } finally {
      clearRetryStatusEntry(retryStatusKey);
    }

    return fetchImpl(requestFactory.next());
  }

  function patchWindowFetchFor429Retry(targetWindow, scope) {
    if (!targetWindow || typeof targetWindow.fetch !== 'function') return;
    if (targetWindow[FETCH_PATCH_MARKER]) return;

    const originalFetch = targetWindow.fetch.bind(targetWindow);
    const patchedFetch = async (input, init) => {
      if (!isGenerateApiRequest(input, init)) {
        return originalFetch(input, init);
      }
      return fetchGenerateWith429Retry(originalFetch, input, init, { scope });
    };

    targetWindow.fetch = patchedFetch;
    targetWindow[FETCH_PATCH_MARKER] = true;
    fetchPatchCleanups.push(() => {
      if (targetWindow.fetch === patchedFetch) {
        targetWindow.fetch = originalFetch;
      }
      delete targetWindow[FETCH_PATCH_MARKER];
    });
  }

  function installGenerateFetchRetryPatch() {
    patchWindowFetchFor429Retry(window, 'iframe');
    const hostWindow = getHostWindow();
    if (hostWindow && hostWindow !== window) {
      patchWindowFetchFor429Retry(hostWindow, 'host');
    }
  }

  function cleanupGenerateFetchRetryPatch() {
    while (fetchPatchCleanups.length > 0) {
      const cleanup = fetchPatchCleanups.pop();
      try {
        cleanup();
      } catch {
        // ignore
      }
    }
  }

  function extractTextFromContent(content) {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map(part => {
          if (typeof part === 'string') return part;
          if (part && typeof part.text === 'string') return part.text;
          return '';
        })
        .join('');
    }
    return '';
  }

  function extractResponseText(data) {
    const choice = data?.choices?.[0];
    const messageText = extractTextFromContent(choice?.message?.content);
    if (messageText) return messageText;
    if (typeof choice?.text === 'string') return choice.text;
    if (typeof data?.text === 'string') return data.text;
    return '';
  }

  async function countTextTokens(text) {
    const normalized = String(text || '');
    if (!normalized) return 0;
    const context = getContext();

    try {
      if (context && typeof context.getTokenCountAsync === 'function') {
        const count = await context.getTokenCountAsync(normalized);
        if (Number.isFinite(count)) return Math.max(0, Math.floor(count));
      }
    } catch (error) {
      debug('getTokenCountAsync(context) 失败，回退估算 token 数', { message: error?.message || String(error) });
    }

    try {
      if (typeof getTokenCountAsync === 'function') {
        const count = await getTokenCountAsync(normalized);
        if (Number.isFinite(count)) return Math.max(0, Math.floor(count));
      }
    } catch (error) {
      debug('getTokenCountAsync(global) 失败，回退估算 token 数', { message: error?.message || String(error) });
    }

    return Math.max(1, Math.ceil(normalized.length / 4));
  }

  function buildSingleRequestPayload(basePayload, options = {}) {
    const payload = deepClone(basePayload || {});
    payload.stream = false;
    payload.n = 1;
    const generationId = String(options.generationId || '').trim();
    if (generationId) {
      payload.generation_id = generationId;
    }

    const overrideTemperature = Number(options.temperatureOverride);
    if (Number.isFinite(overrideTemperature)) {
      const nextTemperature = clampTemperature(overrideTemperature);
      const hasTemperature = Object.prototype.hasOwnProperty.call(payload, 'temperature');
      const hasTemprature = Object.prototype.hasOwnProperty.call(payload, 'temprature');

      if (hasTemperature || !hasTemprature) {
        payload.temperature = nextTemperature;
      }
      if (hasTemprature) {
        payload.temprature = nextTemperature;
      }
      if (!hasTemperature && hasTemprature) {
        payload.temperature = nextTemperature;
      }
    }

    return payload;
  }

  async function requestSingleCompletionWithRetry(options = {}) {
    const requestName = String(options.requestName || '请求');
    const retryScope = String(options.retryScope || requestName);
    const payload = buildSingleRequestPayload(options.payload, options.payloadOptions);
    const signal = options.signal;
    const maxRetries = getConfiguredRetryCount();
    const retryDelayMs = getConfiguredRetryDelayMs();
    const minReplyTokens = Number.isFinite(Number(options.minReplyTokens))
      ? Math.max(0, Math.floor(Number(options.minReplyTokens)))
      : getConfiguredMinReplyTokens();
    const retryStatusKey = createRetryStatusKey(`retry-${retryScope}`);

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        if (signal?.aborted) {
          throw createAbortError(`${requestName} 已中止`);
        }

        let response;
        beginInternalGenerateRequest();
        try {
          response = await fetch(GENERATE_API_PATH, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(payload),
            signal,
            [FETCH_RETRY_SKIP_FLAG]: true,
          });
        } finally {
          endInternalGenerateRequest();
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          const errorPayload = parseJsonSafely(errorText);
          const isRateLimited = isRateLimitedResponse(response.status, errorPayload, errorText);
          debug('请求返回 HTTP 非 2xx', {
            requestName,
            retryScope,
            status: response.status,
            attempt: attempt + 1,
            maxRetries,
            rateLimited: isRateLimited,
          });

          if (isRateLimited && attempt < maxRetries) {
            setRetryStatusEntry(retryStatusKey, {
              reason: '429',
              scope: retryScope,
              attempt: attempt + 1,
              maxRetries,
            });
            await sleepWithAbort(retryDelayMs, signal);
            continue;
          }

          if (isRateLimited) {
            throw new Error(`${requestName} 失败: 限流（HTTP ${response.status}，已重试 ${maxRetries} 次） ${errorText}`);
          }

          throw new Error(`${requestName} 失败: HTTP ${response.status} ${errorText}`);
        }

        const data = await response.json();
        if (data?.error) {
          throw new Error(`${requestName} 失败: ${data.error?.message || 'unknown error'}`);
        }

        const text = extractResponseText(data).trim();
        const tokenCount = await countTextTokens(text);
        if (!text) {
          if (minReplyTokens > 0 && attempt < maxRetries) {
            setRetryStatusEntry(retryStatusKey, {
              reason: '长度不足',
              scope: retryScope,
              attempt: attempt + 1,
              maxRetries,
            });
            await sleepWithAbort(retryDelayMs, signal);
            continue;
          }
          throw new Error(`${requestName} 失败: 返回为空`);
        }

        if (minReplyTokens > 0 && tokenCount < minReplyTokens) {
          if (attempt < maxRetries) {
            setRetryStatusEntry(retryStatusKey, {
              reason: '长度不足',
              scope: retryScope,
              attempt: attempt + 1,
              maxRetries,
            });
            debug('请求命中最小长度限制，准备重试', {
              requestName,
              retryScope,
              tokenCount,
              minReplyTokens,
              retry: attempt + 1,
              maxRetries,
              retryDelayMs,
            });
            await sleepWithAbort(retryDelayMs, signal);
            continue;
          }

          throw new Error(`${requestName} 失败: 长度不足（${tokenCount} token，最小 ${minReplyTokens}，已重试 ${maxRetries} 次）`);
        }

        return {
          text,
          tokenCount,
          attempts: attempt + 1,
        };
      }
    } finally {
      clearRetryStatusEntry(retryStatusKey);
    }

    throw new Error(`${requestName} 失败: 已重试 ${maxRetries} 次`);
  }

  async function runOneParallelRequest(job, index) {
    const requestTemperature = resolveParallelRequestTemperature(job, index);
    const source = job?.basePayload?.chat_completion_source || job?.basePayload?.chat_comletion_source;
    const startedAt = Date.now();
    const requestGenerationId = `gemini_parallel_${job?.id || 'job'}_${index}_${startedAt}`;
    debug('并发子请求开始', {
      jobId: job?.id,
      index,
      model: job?.basePayload?.model,
      source,
      temperature: requestTemperature,
      generationId: requestGenerationId,
    });

    const controller = new AbortController();
    job.controllers.push(controller);
    if (!Array.isArray(job.parallelRequestIds)) {
      job.parallelRequestIds = [];
    }
    if (!job.parallelRequestIds.includes(requestGenerationId)) {
      job.parallelRequestIds.push(requestGenerationId);
    }
    const result = await requestSingleCompletionWithRetry({
      payload: job.basePayload,
      payloadOptions: {
        temperatureOverride: requestTemperature,
        generationId: requestGenerationId,
      },
      signal: controller.signal,
      requestName: `请求 #${index}`,
      retryScope: `并发#${index}`,
      minReplyTokens: getConfiguredMinReplyTokens(),
    });
    debug('并发子请求成功', {
      jobId: job?.id,
      index,
      elapsedMs: Date.now() - startedAt,
      textLength: result.text.length,
      tokenCount: result.tokenCount,
      attempts: result.attempts,
      temperature: requestTemperature,
    });
    return result.text;
  }

  function readMessageById(messageId, assistantOnly = true) {
    if (typeof getChatMessages !== 'function') {
      return null;
    }

    const numericId = Number(messageId);
    if (!Number.isFinite(numericId) || numericId < 0) {
      return null;
    }

    const queryId = Math.floor(numericId);
    const baseOptions = {
      hide_state: 'all',
      include_swipes: true,
    };

    if (assistantOnly) {
      const assistantMessages = getChatMessages(queryId, {
        role: 'assistant',
        hide_state: 'all',
        include_swipes: true,
      });

      if (assistantMessages && assistantMessages.length > 0) {
        return assistantMessages[0];
      }
    }

    const allMessages = getChatMessages(queryId, baseOptions);
    if (!allMessages || allMessages.length === 0) {
      return null;
    }

    if (!assistantOnly) {
      return allMessages[0];
    }

    return allMessages.find(item => item && item.role === 'assistant') || null;
  }

  function readLatestAssistantMessage() {
    if (typeof getChatMessages !== 'function') {
      return null;
    }

    const assistantMessages = getChatMessages(-1, {
      role: 'assistant',
      hide_state: 'all',
      include_swipes: true,
    });

    if (assistantMessages && assistantMessages.length > 0) {
      return assistantMessages[assistantMessages.length - 1];
    }

    const latestMessages = getChatMessages(-1, {
      hide_state: 'all',
      include_swipes: true,
    });

    if (!latestMessages || latestMessages.length === 0) {
      return null;
    }

    const latest = latestMessages[latestMessages.length - 1];
    if (latest && latest.role === 'assistant') {
      return latest;
    }

    return null;
  }

  function readLatestMessage() {
    if (typeof getChatMessages !== 'function') {
      return null;
    }

    const latestMessages = getChatMessages(-1, {
      hide_state: 'all',
      include_swipes: true,
    });

    if (!latestMessages || latestMessages.length === 0) {
      return null;
    }

    return latestMessages[latestMessages.length - 1] || null;
  }

  function regexFromStringLikeTavern(input) {
    if (typeof input !== 'string' || !input) {
      return null;
    }

    try {
      const matched = input.match(/(\/?)(.+)\1([a-z]*)/i);
      if (!matched) {
        return new RegExp(input);
      }

      if (matched[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(matched[3])) {
        return RegExp(input);
      }

      return new RegExp(matched[2], matched[3]);
    } catch {
      return null;
    }
  }

  function resolveMessageRegexDepth(messageId) {
    const normalizedId = normalizeMessageId(messageId);
    if (normalizedId === null || typeof getChatMessages !== 'function') {
      return null;
    }

    let lastMessageId = normalizedId;
    if (typeof getLastMessageId === 'function') {
      const rawLastId = Number(getLastMessageId());
      if (Number.isFinite(rawLastId) && rawLastId >= 0) {
        lastMessageId = Math.floor(rawLastId);
      }
    }

    try {
      const messages = getChatMessages(`0-${lastMessageId}`, {
        hide_state: 'all',
      });
      if (!Array.isArray(messages) || messages.length === 0) {
        return null;
      }

      const usableMessages = messages.filter(item => item && item.role !== 'system');
      const targetIndex = usableMessages.findIndex(item => Number(item?.message_id) === normalizedId);
      if (targetIndex === -1) {
        return null;
      }

      return usableMessages.length - targetIndex - 1;
    } catch (error) {
      warn('计算消息正则深度失败:', error);
      return null;
    }
  }

  function getEnabledTavernRegexesInOrder() {
    if (typeof getTavernRegexes !== 'function') {
      return [];
    }

    try {
      const globalRegexes = getTavernRegexes({
        scope: 'global',
        enable_state: 'enabled',
      }) || [];
      const canUseCharacterRegexes = typeof isCharacterTavernRegexesEnabled !== 'function'
        ? true
        : isCharacterTavernRegexesEnabled();
      const characterRegexes = canUseCharacterRegexes
        ? (getTavernRegexes({
            scope: 'character',
            enable_state: 'enabled',
          }) || [])
        : [];

      return [...globalRegexes, ...characterRegexes];
    } catch (error) {
      warn('获取酒馆正则失败:', error);
      return [];
    }
  }

  function shouldApplyTavernRegex(regex, { depth = null } = {}) {
    if (!regex || regex.enabled === false) {
      return false;
    }

    if (regex.source && regex.source.ai_output === false) {
      return false;
    }

    if (regex.destination && regex.destination.display === false) {
      return false;
    }

    if (typeof depth === 'number') {
      const minDepth = Number(regex.min_depth);
      if (regex.min_depth !== null && Number.isFinite(minDepth) && minDepth >= -1 && depth < minDepth) {
        return false;
      }

      const maxDepth = Number(regex.max_depth);
      if (regex.max_depth !== null && Number.isFinite(maxDepth) && maxDepth >= 0 && depth > maxDepth) {
        return false;
      }
    }

    return true;
  }

  function applyTavernAiOutputRegexes(text, { messageId = null, depth = null } = {}) {
    const input = String(text ?? '');
    if (!input) {
      return input;
    }

    if (typeof getTavernRegexes !== 'function') {
      warn('getTavernRegexes 不可用，跳过正则处理');
      return input;
    }

    const resolvedDepth = typeof depth === 'number' && Number.isFinite(depth)
      ? Math.max(0, Math.floor(depth))
      : resolveMessageRegexDepth(messageId);

    try {
      const regexes = getEnabledTavernRegexesInOrder();
      if (!Array.isArray(regexes) || regexes.length === 0) {
        return input;
      }

      let result = input;
      for (const regex of regexes) {
        if (!shouldApplyTavernRegex(regex, { depth: resolvedDepth })) {
          continue;
        }

        try {
          const pattern = regexFromStringLikeTavern(String(regex.find_regex || ''));
          if (!pattern) {
            warn(`正则 "${regex.script_name || regex.id || 'unknown'}" 编译失败，已跳过`);
            continue;
          }

          const replacement = String(regex.replace_string ?? '').replace(/{{match}}/gi, '$&');
          result = result.replace(pattern, replacement);
        } catch (error) {
          warn(`正则 "${regex.script_name || regex.id || 'unknown'}" 应用失败:`, error);
        }
      }

      return result;
    } catch (error) {
      warn('正则处理失败:', error);
      return input;
    }
  }

  function normalizeMessageId(value) {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return null;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return null;
    }
    return Math.floor(numeric);
  }

  function resolveTargetMessageId(rawEndedValue) {
    const candidateIds = [];
    const baseId = normalizeMessageId(rawEndedValue);

    if (baseId !== null) {
      candidateIds.push(baseId - 1);
      candidateIds.push(baseId);
    }

    const seen = new Set();
    for (const candidateId of candidateIds) {
      if (!Number.isFinite(candidateId) || candidateId < 0) {
        continue;
      }
      if (seen.has(candidateId)) {
        continue;
      }
      seen.add(candidateId);

      const message = readMessageById(candidateId, true);
      if (message && Number.isFinite(Number(message.message_id))) {
        return Number(message.message_id);
      }
    }

    return null;
  }

  function sanitizeGeneratedTexts(texts) {
    if (!Array.isArray(texts)) return [];
    return texts
      .map(item => String(item || '').trim())
      .filter(Boolean);
  }

  async function appendSwipes(messageId, newSwipes, options = {}) {
    if (!Array.isArray(newSwipes) || newSwipes.length === 0) {
      return { appended: false, messageId: null, swipeId: null };
    }
    debug('准备追加 swipes', {
      messageId,
      inputCount: Array.isArray(newSwipes) ? newSwipes.length : 0,
      activateNewest: Boolean(options?.activateNewest),
    });

    if (typeof getChatMessages !== 'function' || typeof setChatMessages !== 'function') {
      throw new Error('getChatMessages/setChatMessages 不可用');
    }

    const message = readMessageById(messageId, true) || readMessageById(messageId, false);
    if (!message) {
      warn('找不到目标楼层，已跳过 swipe 追加:', { messageId });
      return { appended: false, messageId: null, swipeId: null };
    }

    const existing = Array.isArray(message.swipes) && message.swipes.length > 0
      ? message.swipes.slice()
      : [String(message.message || '')];
    const targetMessageId = Number(message.message_id);

    if (!Number.isFinite(targetMessageId) || targetMessageId < 0) {
      warn('目标楼层 message_id 非法，已跳过 swipe 追加:', { messageId, targetMessageId });
      return { appended: false, messageId: null, swipeId: null };
    }

    const sanitizedNewSwipes = sanitizeGeneratedTexts(newSwipes)
      .map(text => applyTavernAiOutputRegexes(text, { messageId: targetMessageId }))
      .map(text => String(text || '').trim())
      .filter(Boolean);

    if (sanitizedNewSwipes.length === 0) {
      debug('追加 swipes 已跳过，清洗后为空', { messageId });
      return { appended: false, messageId: targetMessageId, swipeId: null };
    }

    const merged = existing.concat(sanitizedNewSwipes);
    const rawSwipeId = Number(message.swipe_id);
    const swipeId = Number.isFinite(rawSwipeId) ? Math.max(0, Math.floor(rawSwipeId)) : 0;
    const clampedSwipeId = options?.activateNewest
      ? Math.max(0, merged.length - 1)
      : Math.min(swipeId, Math.max(0, merged.length - 1));

    await setChatMessages(
      [{ message_id: targetMessageId, swipes: merged, swipe_id: clampedSwipeId }],
      { refresh: 'affected' },
    );

    debug('追加 swipes 完成', {
      messageId: targetMessageId,
      beforeCount: existing.length,
      addedCount: sanitizedNewSwipes.length,
      afterCount: merged.length,
      swipeId: clampedSwipeId,
    });

    return {
      appended: true,
      messageId: targetMessageId,
      swipeId: clampedSwipeId,
    };
  }

  function resolveWriteTarget(job) {
    if (!job) return null;

    const latestMessage = readLatestMessage();
    const latestMessageId = Number(latestMessage?.message_id);
    const latestIsUser = Boolean(latestMessage && latestMessage.role === 'user' && Number.isFinite(latestMessageId));

    const eventMessageId = normalizeMessageId(job.targetMessageIdFromEvent);
    if (eventMessageId !== null) {
      const eventMessage = readMessageById(eventMessageId, true);
      if (
        eventMessage
        && Number.isFinite(Number(eventMessage.message_id))
        && (!latestIsUser || eventMessageId >= latestMessageId)
      ) {
        debug('目标楼层命中: MESSAGE_RECEIVED', {
          jobId: job.id,
          messageId: Number(eventMessage.message_id),
          latestIsUser,
          latestMessageId,
        });
        return {
          mode: 'append_assistant',
          messageId: Number(eventMessage.message_id),
          source: 'message_received',
        };
      }
    }

    const endedMessageId = resolveTargetMessageId(job.generationEndedValue);
    if (
      Number.isFinite(endedMessageId)
      && endedMessageId >= 0
      && (!latestIsUser || endedMessageId >= latestMessageId)
    ) {
      debug('目标楼层命中: GENERATION_ENDED', {
        jobId: job.id,
        messageId: endedMessageId,
        latestIsUser,
        latestMessageId,
      });
      return {
        mode: 'append_assistant',
        messageId: endedMessageId,
        source: 'generation_ended',
      };
    }

    if (latestMessage && Number.isFinite(Number(latestMessage.message_id))) {
      const latestMessageNumericId = Number(latestMessage.message_id);
      if (latestMessage.role === 'assistant') {
        debug('目标楼层命中: 最新楼层 assistant', {
          jobId: job.id,
          messageId: latestMessageNumericId,
        });
        return {
          mode: 'append_assistant',
          messageId: latestMessageNumericId,
          source: 'latest_message_assistant',
        };
      }

      if (latestMessage.role === 'user') {
        debug('目标楼层命中: 最新楼层 user，需新建 assistant', {
          jobId: job.id,
          userMessageId: latestMessageNumericId,
        });
        return {
          mode: 'create_after_user',
          userMessageId: latestMessageNumericId,
          source: 'latest_message_user',
        };
      }
    }

    const latestAssistant = readLatestAssistantMessage();
    if (latestAssistant && Number.isFinite(Number(latestAssistant.message_id))) {
      debug('目标楼层命中: 最新 assistant 兜底', {
        jobId: job.id,
        messageId: Number(latestAssistant.message_id),
      });
      return {
        mode: 'append_assistant',
        messageId: Number(latestAssistant.message_id),
        source: 'latest_assistant_fallback',
      };
    }

    debug('目标楼层解析失败', {
      jobId: job.id,
      latestMessageRole: latestMessage?.role || null,
      latestMessageId: Number.isFinite(latestMessageId) ? latestMessageId : null,
      targetMessageIdFromEvent: job.targetMessageIdFromEvent,
      generationEndedValue: job.generationEndedValue,
    });
    return null;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function createAbortError(message) {
    try {
      return new DOMException(message, 'AbortError');
    } catch {
      const error = new Error(message);
      error.name = 'AbortError';
      return error;
    }
  }

  function sleepWithAbort(ms, signal) {
    if (!signal) {
      return sleep(ms);
    }

    if (signal.aborted) {
      throw createAbortError('等待重试时任务已中止');
    }

    return new Promise((resolve, reject) => {
      let timer = null;

      const onAbort = () => {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        signal.removeEventListener('abort', onAbort);
        reject(createAbortError('等待重试时任务已中止'));
      };

      timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  function createForegroundSession(generationSeq) {
    return {
      generationSeq: Number(generationSeq) || 0,
      payloadSnapshot: null,
      stopped: false,
      awaitingGenerationId: true,
      foregroundGenerationId: '',
      startedAt: Date.now(),
      validationPromise: null,
      validationController: null,
    };
  }

  function abortForegroundValidation(reason = 'foreground aborted') {
    const session = activeForegroundSession;
    if (!session) return;
    session.stopped = true;
    session.awaitingGenerationId = false;
    if (session.validationController) {
      try {
        session.validationController.abort();
      } catch {
        // ignore
      }
      session.validationController = null;
    }
    debug('前台最小长度校验已中断', {
      generationSeq: session.generationSeq,
      reason,
    });
  }

  function beginForegroundSession(generationSeq) {
    if (activeForegroundSession && activeForegroundSession.generationSeq !== generationSeq) {
      abortForegroundValidation('新一轮生成已开始');
    }
    activeForegroundSession = createForegroundSession(generationSeq);
    return activeForegroundSession;
  }

  function isForegroundValidationRunning() {
    const session = activeForegroundSession;
    return Boolean(session && session.validationController && !session.stopped);
  }

  function beginInternalGenerateRequest() {
    internalGenerateRequestInFlight += 1;
  }

  function endInternalGenerateRequest() {
    internalGenerateRequestInFlight = Math.max(0, internalGenerateRequestInFlight - 1);
  }

  function hasInternalGenerateRequestInFlight() {
    return internalGenerateRequestInFlight > 0;
  }

  function getOrCreateForegroundSession() {
    if (!activeForegroundSession || activeForegroundSession.generationSeq !== generationSequence) {
      activeForegroundSession = createForegroundSession(generationSequence);
    }
    return activeForegroundSession;
  }

  function updateForegroundPayloadSnapshot(generateData) {
    const session = getOrCreateForegroundSession();
    session.payloadSnapshot = deepClone(generateData || {});
    session.stopped = false;
    session.awaitingGenerationId = true;
    session.foregroundGenerationId = '';
    session.startedAt = Date.now();
    return session;
  }

  function isAuctionJob(job) {
    return Boolean(job?.auctionEnabled);
  }

  function clearAuctionFinalizeRetry(job) {
    if (!job) return;
    if (job.auctionFinalizeRetryTimer) {
      clearTimeout(job.auctionFinalizeRetryTimer);
    }
    job.auctionFinalizeRetryTimer = null;
    job.auctionFinalizeRetryAt = 0;
  }

  function scheduleAuctionFinalizeRetry(job, delayMs) {
    if (!job || isJobTerminal(job) || job.superseded) {
      return;
    }

    const nextDelay = Math.max(60, Math.ceil(Number(delayMs) || 0));
    const nextAt = Date.now() + nextDelay;
    if (
      job.auctionFinalizeRetryTimer
      && Number.isFinite(Number(job.auctionFinalizeRetryAt))
      && Math.abs(Number(job.auctionFinalizeRetryAt) - nextAt) <= 24
    ) {
      return;
    }

    clearAuctionFinalizeRetry(job);
    job.auctionFinalizeRetryAt = nextAt;
    job.auctionFinalizeRetryTimer = setTimeout(() => {
      clearAuctionFinalizeRetry(job);
      if (!activeJob || activeJob.id !== job.id || isJobTerminal(job) || job.superseded) {
        return;
      }
      void tryFinalizeJob(job);
    }, nextDelay);
  }

  function getAuctionForegroundSettleGraceMs(job) {
    return job?.foregroundStopRequested
      ? AUCTION_FOREGROUND_SETTLE_GRACE_MS
      : AUCTION_FOREGROUND_UNCERTAIN_SETTLE_GRACE_MS;
  }

  function hasForegroundSettlementSignal(job) {
    return Boolean(job?.foregroundEnded || job?.foregroundStopped);
  }

  function getAuctionForegroundSettleWaitMs(job, target, targetMessageId = null) {
    if (!isAuctionJob(job) || job?.winnerSource !== 'background') {
      return 0;
    }
    if (!target || target.mode !== 'create_after_user') {
      return 0;
    }
    if (normalizeMessageId(targetMessageId) !== null) {
      return 0;
    }

    if (!hasForegroundSettlementSignal(job)) {
      return getAuctionForegroundSettleGraceMs(job);
    }

    const settledAt = Number(job.foregroundSettledAt) || Number(job.auctionSettledAt) || 0;
    if (settledAt <= 0) {
      return getAuctionForegroundSettleGraceMs(job);
    }

    const graceMs = getAuctionForegroundSettleGraceMs(job);
    const elapsedMs = Date.now() - settledAt;
    return Math.max(0, graceMs - elapsedMs);
  }

  function rememberForegroundGenerationId(generationId) {
    const job = activeJob;
    const session = activeForegroundSession;
    if (!isAuctionJob(job) || !session || session.stopped || !session.awaitingGenerationId) {
      return false;
    }

    const normalizedGenerationId = String(generationId || '').trim();
    if (!normalizedGenerationId) {
      return false;
    }

    session.foregroundGenerationId = normalizedGenerationId;
    session.awaitingGenerationId = false;
    debug('已记录前台 generation_id', {
      jobId: job?.id,
      generationSeq: session.generationSeq,
      generationId: normalizedGenerationId,
    });
    return true;
  }

  function stopForegroundGenerationForAuction(job, reason = '竞标模式已选出赢家') {
    if (!isAuctionJob(job) || isJobTerminal(job)) {
      return false;
    }

    const session = activeForegroundSession;
    let stopped = false;
    const generationId = String(session?.foregroundGenerationId || '').trim();

    if (generationId && typeof stopGenerationById === 'function') {
      try {
        stopped = Boolean(stopGenerationById(generationId));
      } catch (error) {
        warn('stopGenerationById 调用失败:', error);
      }
    }

    if (!stopped && activeJob && activeJob.id === job.id && typeof stopAllGeneration === 'function') {
      try {
        stopped = Boolean(stopAllGeneration());
      } catch (error) {
        warn('stopAllGeneration 调用失败:', error);
      }
    }

    if (stopped) {
      job.foregroundStopRequested = true;
      debug('已请求停止前台生成', {
        jobId: job.id,
        reason,
        generationId: generationId || null,
      });
    }

    return stopped;
  }

  function stopParallelRequestGenerations(job, reason = '停止后台并发子请求', options = {}) {
    if (!job || isJobTerminal(job)) {
      return false;
    }

    const ids = Array.isArray(job.parallelRequestIds) ? job.parallelRequestIds : [];
    let stopped = false;

    if (typeof stopGenerationById === 'function') {
      for (const requestId of ids) {
        const normalizedId = String(requestId || '').trim();
        if (!normalizedId) continue;
        try {
          stopped = Boolean(stopGenerationById(normalizedId)) || stopped;
        } catch (error) {
          warn('stopGenerationById(后台并发) 调用失败:', error);
        }
      }
    }

    if (
      !stopped
      && options?.fallbackStopAll
      && activeJob
      && activeJob.id === job.id
      && typeof stopAllGeneration === 'function'
    ) {
      try {
        stopped = Boolean(stopAllGeneration()) || stopped;
      } catch (error) {
        warn('stopAllGeneration(后台并发) 调用失败:', error);
      }
    }

    if (stopped) {
      debug('已请求停止后台并发子请求', {
        jobId: job.id,
        reason,
        requestCount: ids.length,
      });
    }

    return stopped;
  }

  function resolveEndedAssistantMessageId(rawEndedValue) {
    const resolvedId = resolveTargetMessageId(rawEndedValue);
    if (Number.isFinite(resolvedId) && resolvedId >= 0) {
      return resolvedId;
    }

    const baseId = normalizeMessageId(rawEndedValue);
    if (baseId === null) return null;
    const candidates = [baseId, baseId - 1];
    for (const candidate of candidates) {
      if (!Number.isFinite(candidate) || candidate < 0) continue;
      const message = readMessageById(candidate, true);
      if (message && Number.isFinite(Number(message.message_id))) {
        return Number(message.message_id);
      }
    }
    return null;
  }

  function getMessageTextForValidation(messageId) {
    const message = readMessageById(messageId, true) || readMessageById(messageId, false);
    if (!message) return '';

    if (Array.isArray(message.swipes) && message.swipes.length > 0) {
      const rawSwipeId = Number(message.swipe_id);
      const swipeId = Number.isFinite(rawSwipeId) ? Math.max(0, Math.floor(rawSwipeId)) : 0;
      const clampedSwipeId = Math.min(swipeId, Math.max(0, message.swipes.length - 1));
      const currentSwipeText = String(message.swipes[clampedSwipeId] || '').trim();
      if (currentSwipeText) {
        return currentSwipeText;
      }
    }

    return String(message.message || '').trim();
  }

  async function replaceAssistantMessageText(messageId, text) {
    if (typeof setChatMessages !== 'function') {
      throw new Error('setChatMessages 不可用');
    }

    const message = readMessageById(messageId, true) || readMessageById(messageId, false);
    if (!message || !Number.isFinite(Number(message.message_id))) {
      throw new Error(`目标楼层不存在: ${messageId}`);
    }

    const targetMessageId = Number(message.message_id);
    const normalizedText = String(text || '').trim();
    const processedText = applyTavernAiOutputRegexes(normalizedText, { messageId: targetMessageId }).trim();
    if (!processedText) {
      throw new Error('写入文本为空');
    }
    const patch = {
      message_id: targetMessageId,
      message: processedText,
    };

    if (Array.isArray(message.swipes) && message.swipes.length > 0) {
      const rawSwipeId = Number(message.swipe_id);
      const swipeId = Number.isFinite(rawSwipeId) ? Math.max(0, Math.floor(rawSwipeId)) : 0;
      const clampedSwipeId = Math.min(swipeId, Math.max(0, message.swipes.length - 1));
      const nextSwipes = message.swipes.slice();
      nextSwipes[clampedSwipeId] = processedText;
      patch.swipes = nextSwipes;
      patch.swipe_id = clampedSwipeId;
    }

    await setChatMessages([patch], { refresh: 'affected' });
    return true;
  }

  function shouldValidateForegroundMinReplyTokens() {
    return getConfiguredMinReplyTokens() > 0;
  }

  function markForegroundValidationDoneForJob(job, passed = null) {
    if (!job) return;
    job.foregroundValidationDone = true;
    if (passed !== null) {
      job.foregroundValidationPassed = Boolean(passed);
    }
  }

  function runForegroundMinTokenValidation(messageId, job = null) {
    if (!shouldValidateForegroundMinReplyTokens()) {
      markForegroundValidationDoneForJob(job, true);
      return null;
    }

    const session = getOrCreateForegroundSession();
    if (!session || session.stopped) {
      markForegroundValidationDoneForJob(job, false);
      return null;
    }
    if (!session.payloadSnapshot || typeof session.payloadSnapshot !== 'object') {
      debug('前台最小长度校验跳过：缺少生成参数快照', { generationSeq: session?.generationSeq });
      markForegroundValidationDoneForJob(job, false);
      return null;
    }

    const targetMessageId = Number(messageId);
    if (!Number.isFinite(targetMessageId) || targetMessageId < 0) {
      debug('前台最小长度校验跳过：message_id 无效', { messageId });
      markForegroundValidationDoneForJob(job, false);
      return null;
    }

    if (session.validationPromise) {
      return session.validationPromise;
    }

    const controller = new AbortController();
    session.validationController = controller;

    const runner = (async () => {
      let validationPassed = false;
      try {
        const minReplyTokens = getConfiguredMinReplyTokens();
        const currentText = getMessageTextForValidation(targetMessageId);
        const currentTokenCount = await countTextTokens(currentText);
        if (currentTokenCount >= minReplyTokens) {
          validationPassed = true;
          debug('前台回复已满足最小长度，无需补请求', {
            messageId: targetMessageId,
            tokenCount: currentTokenCount,
            minReplyTokens,
          });
          return { replaced: false, tokenCount: currentTokenCount };
        }

        debug('前台回复未达最小长度，开始补请求', {
          messageId: targetMessageId,
          tokenCount: currentTokenCount,
          minReplyTokens,
        });

        const result = await requestSingleCompletionWithRetry({
          payload: session.payloadSnapshot,
          signal: controller.signal,
          requestName: '前台补请求',
          retryScope: '前台',
          minReplyTokens,
        });

        await replaceAssistantMessageText(targetMessageId, result.text);
        validationPassed = true;
        debug('前台补请求完成并已覆盖楼层文本', {
          messageId: targetMessageId,
          tokenCount: result.tokenCount,
          attempts: result.attempts,
        });
        return { replaced: true, tokenCount: result.tokenCount };
      } catch (error) {
        if (error?.name !== 'AbortError') {
          warn('前台最小长度校验失败:', error);
          warningToast(`前台最小长度重试失败：${error?.message || 'unknown error'}`);
        } else {
          debug('前台最小长度校验被中断', {
            messageId: targetMessageId,
            generationSeq: session.generationSeq,
          });
        }
        return null;
      } finally {
        session.validationController = null;
        session.validationPromise = null;
        markForegroundValidationDoneForJob(job, validationPassed);
        refreshStatusBarForRetryState();
        if (job && activeJob && activeJob.id === job.id && !isJobTerminal(job)) {
          void tryFinalizeJob(job);
        }
      }
    })();

    session.validationPromise = runner;
    return runner;
  }

  async function findCreatedAssistantMessageId(jobId, minExclusiveId) {
    if (typeof getLastMessageId !== 'function') {
      return null;
    }

    const minId = Number.isFinite(Number(minExclusiveId))
      ? Math.floor(Number(minExclusiveId))
      : -1;

    for (let attempt = 0; attempt < 6; attempt++) {
      const rawLastId = Number(getLastMessageId());
      if (Number.isFinite(rawLastId) && rawLastId >= 0) {
        const lastId = Math.floor(rawLastId);
        for (let messageId = lastId; messageId > minId && messageId >= 0; messageId--) {
          const message = readMessageById(messageId, false);
          if (!message || message.role !== 'assistant') continue;

          const markerId = Number(message?.extra?.__gemini_parallel_job_id);
          if (markerId === Number(jobId)) {
            return Number(message.message_id);
          }
        }
      }
      await sleep(80);
    }

    return null;
  }

  async function waitForLatestAssistantMessageIdAfter(minExclusiveId) {
    if (typeof getLastMessageId !== 'function') {
      return null;
    }

    const minId = Number.isFinite(Number(minExclusiveId))
      ? Math.floor(Number(minExclusiveId))
      : -1;

    for (let attempt = 0; attempt < 6; attempt++) {
      const rawLastId = Number(getLastMessageId());
      if (Number.isFinite(rawLastId) && rawLastId > minId) {
        const lastId = Math.floor(rawLastId);
        const message = readMessageById(lastId, false);
        if (message && message.role === 'assistant' && Number.isFinite(Number(message.message_id))) {
          return Number(message.message_id);
        }
      }
      await sleep(80);
    }

    return null;
  }

  async function createEmptyAssistantMessageAtEnd() {
    if (typeof createChatMessages !== 'function') {
      throw new Error('createChatMessages 不可用');
    }

    const beforeLastMessageId = typeof getLastMessageId === 'function'
      ? Number(getLastMessageId())
      : null;

    await createChatMessages(
      [
        {
          role: 'assistant',
          message: '',
        },
      ],
      { refresh: 'affected' },
    );

    const createdMessageId = await waitForLatestAssistantMessageIdAfter(beforeLastMessageId);
    if (!Number.isFinite(createdMessageId) || createdMessageId < 0) {
      warn('空 AI 楼层创建后定位失败');
      return { appended: false, messageId: null };
    }

    try {
      await jumpToFloorStart(createdMessageId);
    } catch (error) {
      warn('空 AI 楼层创建后自动跳转失败:', error);
    }

    return { appended: true, messageId: createdMessageId };
  }

  async function createAssistantMessageWithSwipes(job, newSwipes) {
    if (typeof createChatMessages !== 'function' || typeof setChatMessages !== 'function') {
      throw new Error('createChatMessages/setChatMessages 不可用');
    }

    const sanitized = sanitizeGeneratedTexts(newSwipes)
      .map(text => applyTavernAiOutputRegexes(text, { depth: 0 }))
      .map(text => String(text || '').trim())
      .filter(Boolean);
    if (sanitized.length === 0) {
      debug('新建 assistant 已跳过，清洗后无可写入文本', { jobId: job?.id });
      return { appended: false, messageId: null };
    }

    const firstText = sanitized[0];
    const restTexts = sanitized.slice(1);
    const beforeLastMessageId = typeof getLastMessageId === 'function'
      ? Number(getLastMessageId())
      : null;

    await createChatMessages(
      [
        {
          role: 'assistant',
          message: firstText,
          extra: { __gemini_parallel_job_id: job.id },
        },
      ],
      { refresh: 'affected' },
    );
    debug('已创建 assistant 楼层（待定位 message_id）', {
      jobId: job?.id,
      firstTextLength: firstText.length,
      extraSwipeCount: restTexts.length,
      beforeLastMessageId,
    });

    const createdMessageId = await findCreatedAssistantMessageId(job.id, beforeLastMessageId);
    if (!Number.isFinite(createdMessageId) || createdMessageId < 0) {
      warn('并发结果已生成，但新建 assistant 楼层定位失败');
      return { appended: false, messageId: null };
    }

    if (restTexts.length > 0) {
      await setChatMessages(
        [
          {
            message_id: createdMessageId,
            swipes: [firstText].concat(restTexts),
            swipe_id: 0,
          },
        ],
        { refresh: 'affected' },
      );
      debug('新建 assistant 的 swipes 写入完成', {
        jobId: job?.id,
        messageId: createdMessageId,
        swipeCount: restTexts.length + 1,
      });
    }

    debug('新建 assistant 完成', {
      jobId: job?.id,
      messageId: createdMessageId,
      wroteSwipes: restTexts.length > 0,
    });

    try {
      await jumpToFloorStart(createdMessageId);
    } catch (error) {
      warn('新楼层创建后自动跳转失败:', error);
    }

    return { appended: true, messageId: createdMessageId };
  }

  function hasAuctionWinner(job) {
    return isAuctionJob(job) && typeof job.winnerSource === 'string' && job.winnerSource.length > 0;
  }

  function claimAuctionWinner(job, source, text, options = {}) {
    if (!isAuctionJob(job) || !job || isJobTerminal(job) || job.superseded || hasAuctionWinner(job)) {
      return false;
    }

    const normalizedSource = source === 'foreground' ? 'foreground' : 'background';
    const normalizedText = String(text || '').trim();
    if (!normalizedText) {
      return false;
    }

    job.winnerSource = normalizedSource;
    job.winnerText = normalizedText;
    job.winnerMessageId = normalizeMessageId(options.messageId);
    job.winnerSwipeId = Number.isFinite(Number(options.swipeId)) ? Number(options.swipeId) : null;
    job.auctionSettledAt = Date.now();
    job.winnerWriteDone = normalizedSource === 'foreground';

    if (job.winnerMessageId !== null) {
      job.messageId = job.winnerMessageId;
      job.targetMessageId = job.winnerMessageId;
    }

      debug('竞标模式已选出赢家', {
        jobId: job.id,
        source: normalizedSource,
        messageId: job.winnerMessageId,
        textLength: normalizedText.length,
      });

    abortJobControllers(job);
    stopParallelRequestGenerations(job, `竞标模式赢家已产生(${normalizedSource})`, {
      fallbackStopAll: normalizedSource === 'background',
    });
    if (normalizedSource === 'background') {
      abortForegroundValidation('竞标模式后台候选已胜出');
      stopForegroundGenerationForAuction(job, '竞标模式后台候选已胜出');
      job.foregroundValidationDone = true;
      job.foregroundValidationPassed = false;
    }

    return true;
  }

  function tryClaimBackgroundAuctionWinner(job, text, options = {}) {
    return claimAuctionWinner(job, 'background', text, options);
  }

  function tryClaimForegroundAuctionWinner(job) {
    if (!isAuctionJob(job) || !job || hasAuctionWinner(job)) {
      return false;
    }
    if (job.foregroundStopped) {
      return false;
    }
    if (!job.foregroundEnded || !job.foregroundValidationDone) {
      return false;
    }
    if (shouldValidateForegroundMinReplyTokens() && !job.foregroundValidationPassed) {
      return false;
    }

    let targetMessageId = normalizeMessageId(job.targetMessageIdFromEvent) ?? normalizeMessageId(job.targetMessageId);
    if (targetMessageId === null) {
      const resolvedTarget = resolveWriteTarget(job);
      if (resolvedTarget) {
        job.writeTarget = resolvedTarget;
      }
      if (resolvedTarget?.mode === 'append_assistant') {
        targetMessageId = normalizeMessageId(resolvedTarget.messageId);
      }
    }

    if (targetMessageId === null) {
      return false;
    }

    const currentText = String(getMessageTextForValidation(targetMessageId) || '').trim();
    if (!currentText) {
      return false;
    }

    return claimAuctionWinner(job, 'foreground', currentText, { messageId: targetMessageId });
  }

  async function finalizeAuctionWinner(job) {
    if (!hasAuctionWinner(job)) {
      return { settled: false, written: false, pending: true };
    }

    if (job.winnerSource === 'foreground') {
      return {
        settled: true,
        written: true,
        messageId: normalizeMessageId(job.winnerMessageId),
        swipeId: Number.isFinite(Number(job.winnerSwipeId)) ? Number(job.winnerSwipeId) : null,
      };
    }

    if (job.winnerWriteDone) {
      return {
        settled: true,
        written: true,
        messageId: normalizeMessageId(job.winnerMessageId),
        swipeId: Number.isFinite(Number(job.winnerSwipeId)) ? Number(job.winnerSwipeId) : null,
      };
    }

    const winnerText = String(job.winnerText || '').trim();
    if (!winnerText) {
      return { settled: true, written: false, pending: false };
    }

    let target = job.writeTarget || null;
    if (!target) {
      target = resolveWriteTarget(job);
      if (target) {
        job.writeTarget = target;
      }
    }

    if (!target) {
      return { settled: false, written: false, pending: true };
    }

    const preferredTargetMessageId = target.mode === 'append_assistant'
      ? normalizeMessageId(target.messageId)
      : null;
    const targetMessageId = preferredTargetMessageId
      ?? normalizeMessageId(job.targetMessageIdFromEvent)
      ?? normalizeMessageId(job.targetMessageId);
    const settleWaitMs = getAuctionForegroundSettleWaitMs(job, target, targetMessageId);
    if (settleWaitMs > 0) {
      debug('竞标模式等待前台楼层结算，暂缓创建新楼层', {
        jobId: job.id,
        waitMs: settleWaitMs,
        target,
        targetMessageId,
        foregroundEnded: Boolean(job.foregroundEnded),
        foregroundStopped: Boolean(job.foregroundStopped),
        foregroundStopRequested: Boolean(job.foregroundStopRequested),
        foregroundSettledAt: Number(job.foregroundSettledAt) || 0,
      });
      return {
        settled: false,
        written: false,
        pending: true,
        retryAfterMs: settleWaitMs,
      };
    }

    setJobPhase(job, JOB_PHASES.writing);

    let writeResult = { appended: false, messageId: null, swipeId: null };

    if (targetMessageId !== null) {
      writeResult = await appendSwipes(targetMessageId, [winnerText], { activateNewest: true });
    } else if (target.mode === 'create_after_user') {
      const created = await createAssistantMessageWithSwipes(job, [winnerText]);
      writeResult = {
        appended: Boolean(created?.appended),
        messageId: normalizeMessageId(created?.messageId),
        swipeId: created?.appended ? 0 : null,
      };
    }

    if (writeResult.messageId !== null) {
      job.messageId = writeResult.messageId;
      job.targetMessageId = writeResult.messageId;
      job.winnerMessageId = writeResult.messageId;
    }
    if (writeResult.swipeId !== null) {
      job.winnerSwipeId = writeResult.swipeId;
    }

    job.winnerWriteDone = Boolean(writeResult.appended);
    return {
      settled: true,
      written: Boolean(writeResult.appended),
      messageId: writeResult.messageId,
      swipeId: writeResult.swipeId,
      pending: false,
    };
  }

  async function executeParallelJob(job) {
    const total = Math.max(0, Number(job.extraCount) || 0);
    const progress = job.progress && typeof job.progress === 'object'
      ? job.progress
      : { completed: 0, total, success: 0, failed: 0 };
    job.progress = progress;
    progress.total = total;
    progress.completed = Number(progress.completed) || 0;
    progress.success = Number(progress.success) || 0;
    progress.failed = Number(progress.failed) || 0;
    job.bufferedTexts = Array.isArray(job.bufferedTexts) ? job.bufferedTexts : [];
    job.flushedCount = Number(job.flushedCount) || 0;
    job.writtenCount = Number(job.writtenCount) || 0;
    job.writeFailedCount = Number(job.writeFailedCount) || 0;

    try {
      debug('并发任务开始执行', {
        job: summarizeJob(job),
      });
      setJobPhase(job, JOB_PHASES.prefetching);
      updateParallelStatusBar(job, progress);

      const tasks = [];
      for (let i = 0; i < total; i++) {
        const task = runOneParallelRequest(job, i + 1)
          .then((text) => {
            const normalized = String(text || '').trim();
            if (normalized) {
              progress.success += 1;
              const claimed = tryClaimBackgroundAuctionWinner(job, normalized, {
                index: i + 1,
              });
              if (!isAuctionJob(job)) {
                job.bufferedTexts.push(normalized);
                debug('并发子请求结果入队', {
                  jobId: job.id,
                  index: i + 1,
                  bufferedCount: job.bufferedTexts.length,
                  flushedCount: Number(job.flushedCount) || 0,
                });
              } else if (claimed) {
                debug('并发子请求在竞标模式中胜出', {
                  jobId: job.id,
                  index: i + 1,
                });
              }
              void tryFinalizeJob(job);
            }
            return normalized;
          })
          .catch((error) => {
            progress.failed += 1;
            if (error?.name !== 'AbortError') {
              warn(error);
            }
            throw error;
          })
          .finally(() => {
            progress.completed += 1;
            updateParallelStatusBar(job, progress);
          });
        tasks.push(task);
      }

      await Promise.allSettled(tasks);
      if (job.aborted || job.superseded || isJobTerminal(job)) {
        debug('并发任务执行结束但已中止/废弃，跳过写入', { job: summarizeJob(job) });
        return;
      }

      job.parallelCompleted = true;
      debug('并发任务请求阶段完成', {
        jobId: job.id,
        successCount: Number(progress.success) || 0,
        failedCount: Number(progress.failed) || 0,
        completed: Number(progress.completed) || 0,
        total: Number(progress.total) || 0,
        bufferedCount: job.bufferedTexts.length,
        flushedCount: Number(job.flushedCount) || 0,
      });
      setJobPhase(job, JOB_PHASES.waiting_target);
      await tryFinalizeJob(job);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        debug('并发任务执行抛错', {
          jobId: job?.id,
          message: error?.message || String(error),
        });
        throw error;
      }
      debug('并发任务执行被 AbortError 终止', { jobId: job?.id });
    }
  }

  async function tryFinalizeJob(job) {
    if (!job) {
      debug('tryFinalizeJob 跳过: job 为空');
      return;
    }
    if (!activeJob || activeJob.id !== job.id) {
      debug('tryFinalizeJob 跳过: 非 activeJob', {
        jobId: job.id,
        activeJobId: activeJob?.id || null,
      });
      return;
    }
    if (job.finalizing) {
      debug('tryFinalizeJob 跳过: 正在 finalizing', { jobId: job.id });
      return;
    }
    if (isJobTerminal(job)) {
      debug('tryFinalizeJob 跳过: 任务已终态', { job: summarizeJob(job) });
      return;
    }
    if (job.superseded) {
      debug('tryFinalizeJob 跳过: 任务已 superseded', { job: summarizeJob(job) });
      return;
    }

    if (isAuctionJob(job) && !hasAuctionWinner(job)) {
      tryClaimForegroundAuctionWinner(job);
    }

    if (!hasAuctionWinner(job)) {
      if (!job.foregroundEnded && !job.foregroundStopped) {
        debug('tryFinalizeJob 等待前台结束/停止', { jobId: job.id });
        setJobPhase(job, JOB_PHASES.waiting_target);
        return;
      }

      if (!job.foregroundValidationDone) {
        debug('tryFinalizeJob 等待前台最小长度校验完成', { jobId: job.id });
        setJobPhase(job, JOB_PHASES.waiting_target);
        return;
      }
    }

    job.finalizing = true;
    debug('tryFinalizeJob 开始写入阶段', { job: summarizeJob(job) });

    try {
      if (!activeJob || activeJob.id !== job.id || isJobTerminal(job) || job.superseded) {
        debug('tryFinalizeJob 写入前二次校验未通过', {
          jobId: job.id,
          activeJobId: activeJob?.id || null,
          terminal: isJobTerminal(job),
          superseded: Boolean(job.superseded),
        });
        return;
      }

      if (isAuctionJob(job)) {
        if (!hasAuctionWinner(job)) {
          tryClaimForegroundAuctionWinner(job);
        }

        if (!hasAuctionWinner(job)) {
          if (job.parallelCompleted) {
            const successCount = Number(job.progress?.success) || 0;
            const failedCount = Number(job.progress?.failed) || 0;
            if (successCount > 0) {
              warningToast(`竞标模式未写入赢家，保留当前前台回复（成功 ${successCount} / 目标 ${job.extraCount}）`);
            } else if (failedCount > 0) {
              warningToast(`竞标模式失败：成功 0 / 目标 ${job.extraCount}`);
            }
            setJobPhase(job, JOB_PHASES.done);
          } else {
            setJobPhase(job, JOB_PHASES.waiting_target);
          }
          return;
        }

        const auctionResult = await finalizeAuctionWinner(job);
        if (auctionResult.pending) {
          if (Number.isFinite(Number(auctionResult.retryAfterMs)) && Number(auctionResult.retryAfterMs) > 0) {
            scheduleAuctionFinalizeRetry(job, Number(auctionResult.retryAfterMs));
          }
          setJobPhase(job, JOB_PHASES.waiting_target);
          return;
        }

        clearAuctionFinalizeRetry(job);
        if (job.winnerSource === 'foreground') {
          successToast('竞标模式完成：保留前台最快回复');
        } else if (auctionResult.written) {
          successToast('竞标模式完成：已切换到最快候选');
        } else {
          warningToast('竞标模式已选出赢家，但写入失败，已保留当前楼层');
        }
        setJobPhase(job, JOB_PHASES.done);
        return;
      }

      const bufferedTexts = Array.isArray(job.bufferedTexts) ? job.bufferedTexts : [];
      const currentFlushed = Number(job.flushedCount) || 0;
      if (currentFlushed > bufferedTexts.length) {
        job.flushedCount = bufferedTexts.length;
      }

      const hasPendingWrites = (Number(job.flushedCount) || 0) < bufferedTexts.length;
      if (hasPendingWrites) {
        let target = job.writeTarget || null;
        if (!target) {
          target = resolveWriteTarget(job);
          if (target) {
            job.writeTarget = target;
          }
        }

        if (!target) {
          debug('tryFinalizeJob 无法确定目标楼层', { job: summarizeJob(job) });
          if (job.parallelCompleted) {
            if (!job.targetResolveFailedWarned) {
              job.targetResolveFailedWarned = true;
              warningToast(`并发结果已生成，但未能定位目标楼层（成功 ${Number(job.progress?.success) || 0} / ${job.extraCount}）`);
            }
            setJobPhase(job, JOB_PHASES.done);
          } else {
            setJobPhase(job, JOB_PHASES.waiting_target);
          }
          return;
        }

        debug('tryFinalizeJob 目标楼层已确定', { jobId: job.id, target });
        setJobPhase(job, JOB_PHASES.writing);

        while ((Number(job.flushedCount) || 0) < bufferedTexts.length) {
          const writeIndex = Number(job.flushedCount) || 0;
          const nextText = String(bufferedTexts[writeIndex] || '').trim();
          job.flushedCount = writeIndex + 1;

          if (!nextText) {
            debug('tryFinalizeJob 跳过空文本写入', { jobId: job.id, writeIndex });
            continue;
          }

          let appended = false;
          const preferredTargetMessageId = target.mode === 'append_assistant'
            ? normalizeMessageId(target.messageId)
            : null;
          let targetMessageId = preferredTargetMessageId ?? normalizeMessageId(job.targetMessageId);

          if (targetMessageId !== null) {
            const appendResult = await appendSwipes(targetMessageId, [nextText]);
            appended = Boolean(appendResult?.appended);
            targetMessageId = normalizeMessageId(appendResult?.messageId) ?? targetMessageId;
          } else if (target.mode === 'append_assistant') {
            debug('tryFinalizeJob 跳过写入：append_assistant 目标 message_id 无效', {
              jobId: job.id,
              target,
              writeIndex,
            });
            appended = false;
          } else if (target.mode === 'create_after_user') {
            const created = await createAssistantMessageWithSwipes(job, [nextText]);
            appended = Boolean(created?.appended);
            targetMessageId = normalizeMessageId(created?.messageId);
          }

          if (targetMessageId !== null) {
            job.messageId = targetMessageId;
            job.targetMessageId = targetMessageId;
          }

          if (appended) {
            job.writtenCount = (Number(job.writtenCount) || 0) + 1;
            debug('tryFinalizeJob 增量写入成功', {
              jobId: job.id,
              writeIndex,
              targetMessageId: job.targetMessageId,
              writtenCount: Number(job.writtenCount) || 0,
              totalBuffered: bufferedTexts.length,
            });
          } else {
            job.writeFailedCount = (Number(job.writeFailedCount) || 0) + 1;
            debug('tryFinalizeJob 增量写入失败', {
              jobId: job.id,
              writeIndex,
              target,
              writeFailedCount: Number(job.writeFailedCount) || 0,
            });
          }
        }
      }

      if (!job.parallelCompleted) {
        setJobPhase(job, JOB_PHASES.waiting_target);
        return;
      }

      const successCount = Number(job.progress?.success) || 0;
      const failedCount = Number(job.progress?.failed) || 0;
      const writtenCount = Number(job.writtenCount) || 0;
      const writeFailedCount = Number(job.writeFailedCount) || 0;

      if (writtenCount > 0) {
        if (failedCount > 0 || writeFailedCount > 0 || writtenCount < successCount) {
          warningToast(`并发补全完成：已写入 ${writtenCount} / 成功 ${successCount} / 目标 ${job.extraCount}`);
        } else {
          successToast(`并发补全完成：新增 ${writtenCount} 个候选`);
        }
      } else if (successCount > 0) {
        warningToast(`并发结果已生成，但未能写入候选（成功 ${successCount} / ${job.extraCount}）`);
      } else if (failedCount > 0) {
        warningToast(`并发补全失败：成功 0 / 目标 ${job.extraCount}`);
      }

      setJobPhase(job, JOB_PHASES.done);
    } catch (error) {
      debug('tryFinalizeJob 捕获异常', {
        jobId: job.id,
        message: error?.message || String(error),
      });
      if (error?.name !== 'AbortError') {
        warn('并发补全写入失败:', error);
        errorToast('并发补全失败，已保留首条原生回复');
      }
      setJobPhase(job, JOB_PHASES.done);
    } finally {
      debug('tryFinalizeJob 结束', { job: summarizeJob(job) });
      job.finalizing = false;
      if (isJobTerminal(job)) {
        clearActiveJobIfMatch(job);
      }
    }
  }

  function clearActiveJobIfMatch(job) {
    if (activeJob && job && activeJob.id === job.id) {
      debug('清理 activeJob', { job: summarizeJob(job) });
      clearAuctionFinalizeRetry(job);
      stopStatusBarTracker();
      removeJobStatusBar(job);
      activeJob = null;
      refreshStatusBarForRetryState();
    }
  }

  function shouldArmParallelJob(options = {}) {
    const generationType = typeof options.generationType === 'string'
      ? options.generationType
      : lastGenerationType;
    const source = typeof options.source === 'string' ? options.source : '';
    const desiredN = Number(options.desiredN);

    if (!isEffectivelyEnabled()) return false;
    if (isGroupChat()) return false;
    if (!ALLOWED_TYPES.has(generationType)) return false;
    if (!PARALLEL_SOURCES.has(source)) return false;
    if (!Number.isFinite(desiredN) || desiredN <= 1) return false;

    return true;
  }

  function onGenerationStarted(type) {
    const normalizedType = typeof type === 'string' ? type : 'normal';
    debug('收到 GENERATION_STARTED', {
      type: normalizedType,
      generationSequenceBefore: generationSequence,
      activeJob: summarizeJob(activeJob),
    });

    if (normalizedType === 'normal' && isForegroundValidationRunning()) {
      debug('忽略前台最小长度补请求触发的 GENERATION_STARTED', {
        generationSequence,
        activeJob: summarizeJob(activeJob),
      });
      return;
    }

    if (normalizedType === 'normal' && hasInternalGenerateRequestInFlight()) {
      debug('忽略脚本内部并发请求触发的 GENERATION_STARTED', {
        generationSequence,
        inFlight: internalGenerateRequestInFlight,
        activeJob: summarizeJob(activeJob),
      });
      return;
    }

    foregroundGenerationRunning = true;
    lastGenerationType = normalizedType;

    generationSequence += 1;
    beginForegroundSession(generationSequence);
    markLatestPairedSwipeForegroundPending(true);

    if (
      activeJob
      && !isJobTerminal(activeJob)
      && Number(activeJob.startedAtGenerationSeq) < generationSequence
    ) {
      supersedeActiveJob('会话已进入下一轮（新一轮生成已开始）');
    }
  }

  function onIframeGenerationStarted(generationId) {
    debug('收到 iframe GENERATION_STARTED', {
      generationId,
      activeJob: summarizeJob(activeJob),
    });
    rememberForegroundGenerationId(generationId);
  }

  function onChatCompletionSettingsReady(generateData) {
    const generationType = ALLOWED_TYPES.has(lastGenerationType) ? lastGenerationType : 'normal';
    const source = getSourceFromGenerateData(generateData) || getCurrentSource();
    const allowUiFallback = true;
    const desiredN = getDesiredN(generateData, { allowUiFallback });

    debug('收到 CHAT_COMPLETION_SETTINGS_READY', {
      hasActiveJob: Boolean(activeJob),
      activeJobTerminal: isJobTerminal(activeJob),
      n: Number(generateData?.n),
      source,
      generationType,
      desiredN,
      allowUiFallback,
    });

    try {
      if (hasInternalGenerateRequestInFlight()) {
        debug('跳过本次并发初始化：内部静默生成请求', {
          n: Number(generateData?.n),
          source,
          generationType,
          inFlight: internalGenerateRequestInFlight,
        });
        return;
      }

      if (activeJob && !isJobTerminal(activeJob)) {
        debug('跳过本次并发初始化：已有进行中任务', { activeJob: summarizeJob(activeJob) });
        return;
      }

      if (!shouldArmParallelJob({ generationType, source, desiredN })) {
        if (
          isEffectivelyEnabled()
          && generateData
          && typeof generateData === 'object'
        ) {
          const foregroundSession = updateForegroundPayloadSnapshot(generateData);
          debug('前台生成参数快照已更新（用于成对分支/前台校验）', {
            generationSeq: foregroundSession?.generationSeq,
            hasPayload: Boolean(foregroundSession?.payloadSnapshot),
            desiredN,
            source,
          });
        }

        debug('跳过本次并发初始化：未满足触发条件', {
          generationType,
          source,
          desiredN,
          allowUiFallback,
          enabled: config.enabled,
          effectiveEnabled: isEffectivelyEnabled(),
          groupChat: isGroupChat(),
        });
        return;
      }

      if (
        FORCE_SINGLE_FOREGROUND_SOURCES.has(source)
        && desiredN > 1
        && generateData
        && typeof generateData === 'object'
      ) {
        const originalN = Number(generateData.n);
        generateData.n = 1;
        debug('前台请求已强制改为 n=1，改由脚本并发补齐', {
          source,
          originalN,
          desiredN,
        });
      }

      const foregroundSession = updateForegroundPayloadSnapshot(generateData);
      debug('前台生成参数快照已更新', {
        generationSeq: foregroundSession?.generationSeq,
        hasPayload: Boolean(foregroundSession?.payloadSnapshot),
      });

      const job = {
        id: ++jobCounter,
        state: JOB_PHASES.armed,
        phase: JOB_PHASES.armed,
        source,
        generationType,
        targetN: desiredN,
        extraCount: desiredN - 1,
        basePayload: deepClone(generateData),
        controllers: [],
        aborted: false,
        messageId: null,
        targetMessageId: null,
        targetMessageIdFromEvent: null,
        generationEndedValue: null,
        bufferedTexts: [],
        parallelRequestIds: [],
        flushedCount: 0,
        writtenCount: 0,
        writeFailedCount: 0,
        writeTarget: null,
        targetResolveFailedWarned: false,
        parallelCompleted: false,
        foregroundEnded: false,
        foregroundStopped: false,
        foregroundValidationDone: !shouldValidateForegroundMinReplyTokens(),
        foregroundValidationPassed: !shouldValidateForegroundMinReplyTokens(),
        foregroundStopRequested: false,
        foregroundSettledAt: 0,
        auctionEnabled: isAuctionModeEnabled(),
        winnerSource: '',
        winnerText: '',
        winnerMessageId: null,
        winnerSwipeId: null,
        winnerWriteDone: false,
        auctionSettledAt: 0,
        auctionFinalizeRetryTimer: null,
        auctionFinalizeRetryAt: 0,
        superseded: false,
        supersededReason: '',
        startedAtGenerationSeq: generationSequence,
        finalizing: false,
        progress: {
          completed: 0,
          total: desiredN - 1,
          success: 0,
          failed: 0,
        },
        createdAt: Date.now(),
      };

      activeJob = job;
      startStatusBarTracker(job);
      log(`并发任务已就绪 #${job.id}`, {
        source: job.source,
        type: job.generationType,
        n: job.targetN,
        extra: job.extraCount,
      });
      debug('并发任务初始化完成', { job: summarizeJob(job) });

      void (async () => {
        try {
          await executeParallelJob(job);
        } catch (error) {
          if (error?.name !== 'AbortError') {
            warn('并发补全执行失败:', error);
            errorToast('并发补全失败，已保留首条原生回复');
          }
          if (activeJob && activeJob.id === job.id) {
            setJobPhase(job, JOB_PHASES.done);
            clearActiveJobIfMatch(job);
          }
        }
      })();
    } catch (error) {
      warn('初始化并发任务失败:', error);
    }
  }

  function onGenerationStopped() {
    const job = activeJob;
    debug('收到 GENERATION_STOPPED', { activeJob: summarizeJob(job) });
    if (hasInternalGenerateRequestInFlight() && !foregroundGenerationRunning) {
      debug('忽略脚本内部静默请求触发的 GENERATION_STOPPED', {
        inFlight: internalGenerateRequestInFlight,
      });
      return;
    }
    foregroundGenerationRunning = false;
    abortForegroundValidation('收到 GENERATION_STOPPED');
    if (activeForegroundSession) {
      activeForegroundSession.awaitingGenerationId = false;
    }
    markLatestPairedSwipeForegroundPending(false);

    if (!job) {
      stopStatusBarTracker();
      refreshStatusBarForRetryState();
      scheduleOldFloorSwipeScan();
      return;
    }
    if (isJobTerminal(job)) return;

    job.foregroundStopped = true;
    if (!(Number(job.foregroundSettledAt) > 0)) {
      job.foregroundSettledAt = Date.now();
    }
    job.foregroundValidationDone = true;
    job.foregroundValidationPassed = false;
    refreshStatusBarForRetryState();
    scheduleOldFloorSwipeScan();
    void tryFinalizeJob(job);
  }

  function onGenerationEnded(messageId) {
    const job = activeJob;
    debug('收到 GENERATION_ENDED', { messageId, activeJob: summarizeJob(job) });
    if (hasInternalGenerateRequestInFlight() && !foregroundGenerationRunning) {
      debug('忽略脚本内部静默请求触发的 GENERATION_ENDED', {
        messageId,
        inFlight: internalGenerateRequestInFlight,
      });
      return;
    }
    const targetMessageId = resolveEndedAssistantMessageId(messageId);
    foregroundGenerationRunning = false;
    if (activeForegroundSession) {
      activeForegroundSession.awaitingGenerationId = false;
    }
    markLatestPairedSwipeForegroundPending(false, Number.isFinite(targetMessageId) ? targetMessageId : null);

    if (job && !isJobTerminal(job)) {
      job.foregroundEnded = true;
      if (!(Number(job.foregroundSettledAt) > 0)) {
        job.foregroundSettledAt = Date.now();
      }
      job.generationEndedValue = messageId;
      job.foregroundValidationDone = !shouldValidateForegroundMinReplyTokens();
      job.foregroundValidationPassed = !shouldValidateForegroundMinReplyTokens();

      if (Number.isFinite(targetMessageId) && targetMessageId >= 0) {
        job.targetMessageIdFromEvent = targetMessageId;
        debug('GENERATION_ENDED 提供了可用目标 message_id', {
          jobId: job.id,
          resolvedMessageId: targetMessageId,
        });
      }
    }

    if (Number.isFinite(targetMessageId) && targetMessageId >= 0) {
      const validationPromise = runForegroundMinTokenValidation(targetMessageId, job && !isJobTerminal(job) ? job : null);
      if (!validationPromise && job && !isJobTerminal(job)) {
        job.foregroundValidationDone = true;
        job.foregroundValidationPassed = !shouldValidateForegroundMinReplyTokens();
      }
    } else if (shouldValidateForegroundMinReplyTokens()) {
      debug('前台最小长度校验跳过：未解析到目标楼层', { endedMessageId: messageId });
      if (job && !isJobTerminal(job)) {
        job.foregroundValidationDone = true;
        job.foregroundValidationPassed = false;
      }
    }

    if (Number.isFinite(targetMessageId) && targetMessageId >= 0) {
      void persistLatestPairedSwipePayloadSnapshot(targetMessageId)
        .catch(error => warn('持久化最近消息分支快照失败:', error));
    }

    if (job && !isJobTerminal(job)) {
      void tryFinalizeJob(job);
    }
    scheduleOldFloorSwipeScan();
  }

  function onMessageReceived(messageId) {
    const job = activeJob;
    debug('收到 MESSAGE_RECEIVED', { messageId, activeJob: summarizeJob(job) });
    if (!job || isJobTerminal(job)) return;

    const message = readMessageById(messageId, true);
    if (message && Number.isFinite(Number(message.message_id))) {
      job.targetMessageIdFromEvent = Number(message.message_id);
      job.targetMessageId = Number(message.message_id);
      job.writeTarget = {
        mode: 'append_assistant',
        messageId: Number(message.message_id),
        source: 'message_received',
      };
      debug('MESSAGE_RECEIVED 绑定目标楼层成功', {
        jobId: job.id,
        messageId: Number(message.message_id),
      });
    }

    void tryFinalizeJob(job);
  }

  function onMessageSent() {
    const job = activeJob;
    debug('收到 MESSAGE_SENT', { activeJob: summarizeJob(job) });
    abortForegroundValidation('用户已发送新消息');
    if (!job || isJobTerminal(job)) return;
    supersedeActiveJob('会话已进入下一轮（用户已发送新消息）');
  }

  function bindEvent(eventType, listener) {
    if (typeof eventOn !== 'function') return;
    const ret = eventOn(eventType, listener);
    if (ret && typeof ret.stop === 'function') {
      eventStops.push(ret.stop);
    }
  }

  function createPairedSwipePairId() {
    pairedSwipePairSeq += 1;
    return `paired_swipe_pair_${Date.now()}_${pairedSwipePairSeq}`;
  }

  function createPairedSwipeBranchId(pairId) {
    pairedSwipeBranchSeq += 1;
    return `${pairId}_branch_${Date.now()}_${pairedSwipeBranchSeq}`;
  }

  function getCurrentSwipeIndex(message) {
    const rawSwipeId = Number(message?.swipe_id);
    if (!Number.isFinite(rawSwipeId)) return 0;
    return Math.max(0, Math.floor(rawSwipeId));
  }

  function getMessageSwipeTexts(message) {
    if (Array.isArray(message?.swipes) && message.swipes.length > 0) {
      return message.swipes.map(item => String(item ?? ''));
    }
    return [String(message?.message ?? '')];
  }

  function getMessageActiveText(message) {
    const swipeTexts = getMessageSwipeTexts(message);
    const maxIndex = Math.max(0, swipeTexts.length - 1);
    const swipeIndex = Math.min(getCurrentSwipeIndex(message), maxIndex);
    return String(swipeTexts[swipeIndex] ?? message?.message ?? '');
  }

  function buildPairedBranchHistoryPromptsBefore(userMessageId) {
    if (typeof getChatMessages !== 'function') {
      return [];
    }

    const numericMessageId = Number(userMessageId);
    if (!Number.isFinite(numericMessageId) || numericMessageId <= 0) {
      return [];
    }

    const historyMessages = getChatMessages(`0-${Math.floor(numericMessageId) - 1}`, {
      hide_state: 'all',
      include_swipes: true,
    });
    if (!Array.isArray(historyMessages) || historyMessages.length === 0) {
      return [];
    }

    return historyMessages
      .filter(message => message && message.role && message.role !== 'system')
      .map(message => ({
        role: message.role,
        content: getMessageActiveText(message),
      }));
  }

  function normalizePairedSwipeStatuses(rawStatuses) {
    const normalized = {};
    if (!rawStatuses || typeof rawStatuses !== 'object' || Array.isArray(rawStatuses)) {
      return normalized;
    }

    for (const [branchId, status] of Object.entries(rawStatuses)) {
      const normalizedBranchId = String(branchId || '').trim();
      if (!normalizedBranchId) continue;
      if (status === 'pending' || status === 'done' || status === 'error') {
        normalized[normalizedBranchId] = status;
      }
    }

    return normalized;
  }

  function readPairedSwipeMeta(message) {
    const rawMeta = message?.extra?.[PAIRED_SWIPE_META_KEY];
    if (!rawMeta || typeof rawMeta !== 'object' || Array.isArray(rawMeta)) {
      return null;
    }

    const pairId = String(rawMeta.pairId || '').trim();
    const role = rawMeta.role === 'assistant' ? 'assistant' : (rawMeta.role === 'user' ? 'user' : '');
    const counterpartMessageId = normalizeMessageId(rawMeta.counterpartMessageId);
    const branchIds = Array.isArray(rawMeta.branchIds)
      ? rawMeta.branchIds.map(item => String(item || '').trim()).filter(Boolean)
      : [];

    if (!pairId || !role || counterpartMessageId === null || branchIds.length === 0) {
      return null;
    }

    return {
      pairId,
      role,
      counterpartMessageId,
      branchIds,
    };
  }

  function cloneExtra(extra) {
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) {
      return {};
    }
    return deepClone(extra);
  }

  function normalizePairedSwipePayloadSnapshot(rawPayload) {
    const payload = deepClone(rawPayload || null);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }
    if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
      return null;
    }
    return payload;
  }

  function readPairedSwipePayloadSnapshot(userMessage = null, assistantMessage = null) {
    const assistantPayload = normalizePairedSwipePayloadSnapshot(assistantMessage?.extra?.[PAIRED_SWIPE_PAYLOAD_KEY]);
    if (assistantPayload) {
      return assistantPayload;
    }

    const userPayload = normalizePairedSwipePayloadSnapshot(userMessage?.extra?.[PAIRED_SWIPE_PAYLOAD_KEY]);
    if (userPayload) {
      return userPayload;
    }

    const userMeta = readPairedSwipeMeta(userMessage);
    const assistantMeta = readPairedSwipeMeta(assistantMessage);
    const pairId = String(userMeta?.pairId || assistantMeta?.pairId || '').trim();
    if (!pairId) {
      return null;
    }

    const runtimeState = pairedSwipeStates.get(pairId);
    return normalizePairedSwipePayloadSnapshot(runtimeState?.basePayloadSnapshot);
  }

  function buildPairedSwipeMeta(state, role) {
    return {
      pairId: state.pairId,
      role,
      counterpartMessageId: role === 'user' ? state.assistantMessageId : state.userMessageId,
      branchIds: state.branchIds.slice(),
    };
  }

  function buildPairedSwipeExtra(message, state, role, statuses = null) {
    const nextExtra = cloneExtra(message?.extra);
    nextExtra[PAIRED_SWIPE_META_KEY] = buildPairedSwipeMeta(state, role);
    if (role === 'assistant') {
      nextExtra[PAIRED_SWIPE_STATUS_KEY] = normalizePairedSwipeStatuses(statuses ?? state.statusByBranchId);
      const payloadSnapshot = normalizePairedSwipePayloadSnapshot(state.basePayloadSnapshot);
      if (payloadSnapshot) {
        nextExtra[PAIRED_SWIPE_PAYLOAD_KEY] = payloadSnapshot;
      }
    }
    return nextExtra;
  }

  function capturePairedSwipeBasePayloadSnapshot() {
    return normalizePairedSwipePayloadSnapshot(activeForegroundSession?.payloadSnapshot || activeJob?.basePayload || null);
  }

  function resolvePairedSwipeBasePayloadSnapshot(userMessage = null, assistantMessage = null) {
    return (
      capturePairedSwipeBasePayloadSnapshot()
      || readPairedSwipePayloadSnapshot(userMessage, assistantMessage)
      || null
    );
  }

  function findLatestUserAssistantPair() {
    if (typeof getLastMessageId !== 'function' || typeof getChatMessages !== 'function') {
      return null;
    }

    const rawLastId = Number(getLastMessageId());
    if (!Number.isFinite(rawLastId) || rawLastId < 0) {
      return null;
    }

    const lastId = Math.floor(rawLastId);
    const messages = getChatMessages(`0-${lastId}`, {
      hide_state: 'all',
      include_swipes: true,
    });
    if (!Array.isArray(messages) || messages.length === 0) {
      return null;
    }

    let assistantMessage = null;
    let userMessage = null;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!message || message.role === 'system') {
        continue;
      }

      if (!assistantMessage && message.role === 'assistant') {
        assistantMessage = message;
        continue;
      }

      if (assistantMessage && message.role === 'user') {
        userMessage = message;
        break;
      }
    }

    if (!userMessage || !assistantMessage) {
      return null;
    }

    return {
      userMessage,
      assistantMessage,
    };
  }

  function isLatestPairedSwipeTarget(userMessageId, assistantMessageId) {
    const latestPair = findLatestUserAssistantPair();
    if (!latestPair) return false;
    return Number(latestPair.userMessage?.message_id) === Number(userMessageId)
      && Number(latestPair.assistantMessage?.message_id) === Number(assistantMessageId);
  }

  function syncPairedSwipeStateSnapshot(state, userMessage, assistantMessage) {
    state.userMessageId = Number(userMessage.message_id);
    state.assistantMessageId = Number(assistantMessage.message_id);
    state.branchIds = Array.isArray(state.branchIds) ? state.branchIds.slice() : [];

    const userSwipes = getMessageSwipeTexts(userMessage);
    const assistantSwipes = getMessageSwipeTexts(assistantMessage);
    const branchCount = Math.max(userSwipes.length, assistantSwipes.length, state.branchIds.length, 1);

    while (state.branchIds.length < branchCount) {
      state.branchIds.push(createPairedSwipeBranchId(state.pairId));
    }

    const assistantStatuses = normalizePairedSwipeStatuses(assistantMessage?.extra?.[PAIRED_SWIPE_STATUS_KEY]);
    state.statusByBranchId = {
      ...state.statusByBranchId,
      ...assistantStatuses,
    };

    for (const branchId of state.branchIds) {
      if (!state.statusByBranchId[branchId]) {
        state.statusByBranchId[branchId] = 'done';
      }
    }

    const maxSwipeIndex = Math.max(0, branchCount - 1);
    state.activeBranchIndex = Math.min(
      Math.max(getCurrentSwipeIndex(assistantMessage), getCurrentSwipeIndex(userMessage)),
      maxSwipeIndex,
    );
    pairedSwipeStates.set(state.pairId, state);
    return state;
  }

  function getOrCreatePairedSwipeStateFromMessages(userMessage, assistantMessage, options = {}) {
    if (!userMessage || !assistantMessage) return null;
    if (userMessage.role !== 'user' || assistantMessage.role !== 'assistant') return null;

    const userMeta = readPairedSwipeMeta(userMessage);
    const assistantMeta = readPairedSwipeMeta(assistantMessage);
    let pairId = '';
    let branchIds = [];

    if (
      userMeta
      && assistantMeta
      && userMeta.pairId === assistantMeta.pairId
      && userMeta.counterpartMessageId === Number(assistantMessage.message_id)
      && assistantMeta.counterpartMessageId === Number(userMessage.message_id)
    ) {
      pairId = userMeta.pairId;
      branchIds = userMeta.branchIds.slice();
    } else {
      for (const state of pairedSwipeStates.values()) {
        if (
          Number(state.userMessageId) === Number(userMessage.message_id)
          && Number(state.assistantMessageId) === Number(assistantMessage.message_id)
        ) {
          pairId = state.pairId;
          branchIds = state.branchIds.slice();
          break;
        }
      }
    }

    if (!pairId && !options.create) {
      return null;
    }

    if (!pairId) {
      pairId = createPairedSwipePairId();
      branchIds = [createPairedSwipeBranchId(pairId)];
    }

    const existingState = pairedSwipeStates.get(pairId);
    const nextState = existingState || {
      pairId,
      userMessageId: Number(userMessage.message_id),
      assistantMessageId: Number(assistantMessage.message_id),
      branchIds: branchIds.slice(),
      statusByBranchId: {},
      basePayloadSnapshot: null,
      foregroundPending: false,
      activeBranchIndex: 0,
    };

    if (!existingState) {
      nextState.branchIds = branchIds.slice();
      nextState.statusByBranchId = {};
    }

    if (!nextState.basePayloadSnapshot && options.basePayloadSnapshot) {
      nextState.basePayloadSnapshot = deepClone(options.basePayloadSnapshot);
    }
    if (!nextState.basePayloadSnapshot) {
      nextState.basePayloadSnapshot = resolvePairedSwipeBasePayloadSnapshot(userMessage, assistantMessage);
    }
    if (typeof options.foregroundPending === 'boolean') {
      nextState.foregroundPending = options.foregroundPending;
    }

    return syncPairedSwipeStateSnapshot(nextState, userMessage, assistantMessage);
  }

  function getPairedSwipeStateByMessageId(messageId) {
    const message = readMessageById(messageId, false);
    if (!message) return null;

    const meta = readPairedSwipeMeta(message);
    if (!meta) return null;

    const counterpart = readMessageById(meta.counterpartMessageId, false);
    if (!counterpart) return null;

    const userMessage = message.role === 'user' ? message : counterpart;
    const assistantMessage = message.role === 'assistant' ? message : counterpart;
    if (userMessage.role !== 'user' || assistantMessage.role !== 'assistant') {
      return null;
    }

    return reconcilePairedSwipeForegroundState(
      getOrCreatePairedSwipeStateFromMessages(userMessage, assistantMessage, { create: false }),
    );
  }

  function reconcilePairedSwipeForegroundState(state) {
    if (!state) {
      return null;
    }

    const isLatestPair = isLatestPairedSwipeTarget(state.userMessageId, state.assistantMessageId);
    const shouldForegroundBePending = Boolean(isLatestPair && foregroundGenerationRunning);
    let changed = false;

    if (state.foregroundPending !== shouldForegroundBePending) {
      state.foregroundPending = shouldForegroundBePending;
      changed = true;
    }

    const firstBranchId = state.branchIds[0];
    if (firstBranchId) {
      const currentStatus = state.statusByBranchId[firstBranchId];
      const nextStatus = shouldForegroundBePending
        ? 'pending'
        : currentStatus === 'pending'
          ? 'done'
          : currentStatus;
      if (nextStatus && nextStatus !== currentStatus) {
        state.statusByBranchId[firstBranchId] = nextStatus;
        changed = true;
      }
    }

    if (changed) {
      pairedSwipeStates.set(state.pairId, state);
    }

    return state;
  }

  function clearPairedSwipeComposerState() {
    pairedSwipeComposerUserMessageId = null;
    pairedSwipeComposerDraft = '';
  }

  function clearPairedSwipeRuntimeState(options = {}) {
    if (options.abortJobs !== false) {
      for (const job of pairedSwipeJobs.values()) {
        try {
          job.controller?.abort();
        } catch {
          // ignore
        }
      }
    }
    pairedSwipeJobs.clear();
    pairedSwipeStates.clear();
    pairedSwipeSyncLocks.clear();
    clearPairedSwipeComposerState();
  }

  function cancelActiveParallelSupplementOnly(reason = '进入成对分支模式') {
    const job = activeJob;
    if (!job || isJobTerminal(job)) {
      return false;
    }

    debug('进入成对分支模式，终止旧并发补全写入', {
      reason,
      job: summarizeJob(job),
    });
    job.superseded = true;
    job.supersededReason = String(reason || '成对分支模式已接管');
    job.aborted = true;
    setJobPhase(job, JOB_PHASES.superseded);
    abortJobControllers(job);
    clearActiveJobIfMatch(job);
    return true;
  }

  async function writePairedSwipeMessages(state, options = {}) {
    const userMessage = readMessageById(state.userMessageId, false);
    const assistantMessage = readMessageById(state.assistantMessageId, false);
    if (!userMessage || !assistantMessage) {
      throw new Error('成对 Swipe 楼层不存在，无法写入');
    }

    const userSwipes = Array.isArray(options.userSwipes)
      ? options.userSwipes.map(item => String(item ?? ''))
      : getMessageSwipeTexts(userMessage);
    const assistantSwipes = Array.isArray(options.assistantSwipes)
      ? options.assistantSwipes.map(item => String(item ?? ''))
      : getMessageSwipeTexts(assistantMessage);
    const nextBranchIds = Array.isArray(options.branchIds)
      ? options.branchIds.map(item => String(item || '').trim()).filter(Boolean)
      : state.branchIds.slice();
    const targetCount = Math.max(userSwipes.length, assistantSwipes.length, nextBranchIds.length, 1);

    while (nextBranchIds.length < targetCount) {
      nextBranchIds.push(createPairedSwipeBranchId(state.pairId));
    }
    while (userSwipes.length < targetCount) {
      userSwipes.push('');
    }
    while (assistantSwipes.length < targetCount) {
      assistantSwipes.push('');
    }

    const currentUserSwipeId = Math.min(getCurrentSwipeIndex(userMessage), Math.max(0, targetCount - 1));
    const currentAssistantSwipeId = Math.min(getCurrentSwipeIndex(assistantMessage), Math.max(0, targetCount - 1));
    const nextUserSwipeId = Number.isFinite(Number(options.userSwipeId))
      ? Math.min(Math.max(0, Math.floor(Number(options.userSwipeId))), Math.max(0, targetCount - 1))
      : currentUserSwipeId;
    const nextAssistantSwipeId = Number.isFinite(Number(options.assistantSwipeId))
      ? Math.min(Math.max(0, Math.floor(Number(options.assistantSwipeId))), Math.max(0, targetCount - 1))
      : currentAssistantSwipeId;

    state.branchIds = nextBranchIds.slice();
    state.activeBranchIndex = Math.min(nextAssistantSwipeId, Math.max(0, targetCount - 1));
    state.statusByBranchId = normalizePairedSwipeStatuses(options.statuses ?? state.statusByBranchId);
    for (const branchId of state.branchIds) {
      if (!state.statusByBranchId[branchId]) {
        state.statusByBranchId[branchId] = 'done';
      }
    }

    await setChatMessages(
      [
        {
          message_id: Number(userMessage.message_id),
          swipes: userSwipes,
          swipe_id: nextUserSwipeId,
          extra: buildPairedSwipeExtra(userMessage, state, 'user'),
        },
        {
          message_id: Number(assistantMessage.message_id),
          swipes: assistantSwipes,
          swipe_id: nextAssistantSwipeId,
          extra: buildPairedSwipeExtra(assistantMessage, state, 'assistant', state.statusByBranchId),
        },
      ],
      { refresh: 'affected' },
    );

    pairedSwipeStates.set(state.pairId, state);
    scheduleOldFloorSwipeScan();
    return state;
  }

  async function ensurePairedSwipeModeForLatestUser(userMessageId) {
    const latestPair = findLatestUserAssistantPair();
    if (!latestPair) {
      throw new Error('未找到当前最后一对 user/assistant 楼层');
    }

    const latestUserId = Number(latestPair.userMessage.message_id);
    const latestAssistantId = Number(latestPair.assistantMessage.message_id);
    if (latestUserId !== Number(userMessageId)) {
      throw new Error('只允许对当前最后一对楼层新增并行分支');
    }

    const existingState = getOrCreatePairedSwipeStateFromMessages(
      latestPair.userMessage,
      latestPair.assistantMessage,
      { create: false },
    );
    if (existingState) {
      if (!existingState.basePayloadSnapshot) {
        existingState.basePayloadSnapshot = resolvePairedSwipeBasePayloadSnapshot(
          latestPair.userMessage,
          latestPair.assistantMessage,
        );
      }
      pairedSwipeStates.set(existingState.pairId, existingState);
      return existingState;
    }

    const basePayloadSnapshot = resolvePairedSwipeBasePayloadSnapshot(
      latestPair.userMessage,
      latestPair.assistantMessage,
    );

    const pairId = createPairedSwipePairId();
    const branchId = createPairedSwipeBranchId(pairId);
    const nextState = {
      pairId,
      userMessageId: latestUserId,
      assistantMessageId: latestAssistantId,
      branchIds: [branchId],
      statusByBranchId: {
        [branchId]: foregroundGenerationRunning ? 'pending' : 'done',
      },
      basePayloadSnapshot,
      foregroundPending: Boolean(foregroundGenerationRunning),
      activeBranchIndex: Math.min(
        getCurrentSwipeIndex(latestPair.userMessage),
        getCurrentSwipeIndex(latestPair.assistantMessage),
      ),
    };

    await writePairedSwipeMessages(nextState, {
      userSwipes: getMessageSwipeTexts(latestPair.userMessage),
      assistantSwipes: getMessageSwipeTexts(latestPair.assistantMessage),
      userSwipeId: getCurrentSwipeIndex(latestPair.userMessage),
      assistantSwipeId: getCurrentSwipeIndex(latestPair.assistantMessage),
      statuses: nextState.statusByBranchId,
    });

    cancelActiveParallelSupplementOnly('成对分支模式已接管当前消息对');
    return nextState;
  }

  function replaceSendingMessageTextContent(content, nextText) {
    if (Array.isArray(content)) {
      let replaced = false;
      const nextContent = [];
      for (const item of content) {
        if (item?.type === 'text') {
          if (!replaced) {
            nextContent.push({ ...item, text: nextText });
            replaced = true;
          }
          continue;
        }
        nextContent.push(deepClone(item));
      }
      if (!replaced) {
        nextContent.unshift({ type: 'text', text: nextText });
      }
      return nextContent;
    }
    return nextText;
  }

  function buildPairedBranchPayload(basePayloadSnapshot, userText, branchId) {
    const payload = deepClone(basePayloadSnapshot || {});
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.messages) || payload.messages.length === 0) {
      throw new Error('并行分支缺少可用的 messages 上下文');
    }

    let targetUserIndex = -1;
    for (let index = payload.messages.length - 1; index >= 0; index -= 1) {
      if (payload.messages[index]?.role === 'user') {
        targetUserIndex = index;
        break;
      }
    }

    if (targetUserIndex < 0) {
      throw new Error('并行分支未找到最后一条 user prompt');
    }

    payload.stream = false;
    payload.n = 1;
    payload.generation_id = `paired_swipe_${branchId}_${Date.now()}`;
    payload.messages[targetUserIndex] = {
      ...payload.messages[targetUserIndex],
      content: replaceSendingMessageTextContent(payload.messages[targetUserIndex].content, userText),
    };
    return payload;
  }

  async function updatePairedSwipeBranchResult(pairId, branchId, swipeIndex, text, options = {}) {
    const state = pairedSwipeStates.get(pairId);
    if (!state) return false;

    const assistantMessage = readMessageById(state.assistantMessageId, false);
    if (!assistantMessage) return false;

    const assistantSwipes = getMessageSwipeTexts(assistantMessage);
    while (assistantSwipes.length <= swipeIndex) {
      assistantSwipes.push('');
    }

    const processedText = options.error
      ? `分支生成失败：${String(text || 'unknown error')}`
      : applyTavernAiOutputRegexes(String(text || '').trim(), { messageId: state.assistantMessageId }).trim();

    assistantSwipes[swipeIndex] = processedText || (options.error ? '分支生成失败：返回为空' : PAIRED_SWIPE_PENDING_TEXT);
    state.statusByBranchId = normalizePairedSwipeStatuses(state.statusByBranchId);
    state.statusByBranchId[branchId] = options.error ? 'error' : 'done';

    await writePairedSwipeMessages(state, {
      assistantSwipes,
      statuses: state.statusByBranchId,
    });

    return true;
  }

  async function runPairedSwipeBranchJob(pairId, branchId, swipeIndex, userText) {
    const state = pairedSwipeStates.get(pairId);
    if (!state) {
      throw new Error('并行分支状态不存在');
    }
    if (typeof generate !== 'function') {
      throw new Error('酒馆 generate API 不可用，无法创建并行分支');
    }

    const controller = new AbortController();
    const generationId = `paired_swipe_${branchId}_${Date.now()}`;
    const job = {
      pairId,
      branchId,
      swipeIndex,
      controller,
      userText,
      generationId,
    };
    pairedSwipeJobs.set(branchId, job);

    try {
      const historyPrompts = buildPairedBranchHistoryPromptsBefore(state.userMessageId);
      const abortHandler = () => {
        try {
          if (typeof stopGenerationById === 'function') {
            stopGenerationById(generationId);
          }
        } catch {
          // ignore
        }
      };

      controller.signal.addEventListener('abort', abortHandler, { once: true });
      try {
        beginInternalGenerateRequest();
        const resultText = await generate({
          generation_id: generationId,
          user_input: String(userText || ''),
          should_stream: false,
          should_silence: true,
          max_chat_history: 'all',
          overrides: {
            chat_history: {
              with_depth_entries: true,
              prompts: historyPrompts,
            },
          },
        });
        await updatePairedSwipeBranchResult(pairId, branchId, swipeIndex, resultText, { error: false });
      } finally {
        endInternalGenerateRequest();
        controller.signal.removeEventListener('abort', abortHandler);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        warn('并行分支生成失败:', error);
        await updatePairedSwipeBranchResult(pairId, branchId, swipeIndex, error?.message || String(error), { error: true });
      }
    } finally {
      pairedSwipeJobs.delete(branchId);
      scheduleOldFloorSwipeScan();
    }
  }

  async function createPairedSwipeBranch(userMessageId, rawText) {
    const nextText = String(rawText || '').trim();
    if (!nextText) {
      throw new Error('请输入新的分支内容');
    }

    const state = await ensurePairedSwipeModeForLatestUser(userMessageId);
    const userMessage = readMessageById(state.userMessageId, false);
    const assistantMessage = readMessageById(state.assistantMessageId, false);
    if (!userMessage || !assistantMessage) {
      throw new Error('成对 Swipe 楼层不存在');
    }

    const userSwipes = getMessageSwipeTexts(userMessage);
    const assistantSwipes = getMessageSwipeTexts(assistantMessage);
    const nextBranchId = createPairedSwipeBranchId(state.pairId);
    const nextSwipeIndex = userSwipes.length;

    userSwipes.push(nextText);
    assistantSwipes.push(PAIRED_SWIPE_PENDING_TEXT);
    state.branchIds = state.branchIds.concat(nextBranchId);
    state.statusByBranchId = normalizePairedSwipeStatuses(state.statusByBranchId);
    state.statusByBranchId[nextBranchId] = 'pending';

    const keepCurrentSelection = Boolean(state.foregroundPending);
    await writePairedSwipeMessages(state, {
      branchIds: state.branchIds,
      userSwipes,
      assistantSwipes,
      userSwipeId: keepCurrentSelection ? getCurrentSwipeIndex(userMessage) : nextSwipeIndex,
      assistantSwipeId: keepCurrentSelection ? getCurrentSwipeIndex(assistantMessage) : nextSwipeIndex,
      statuses: state.statusByBranchId,
    });

    clearPairedSwipeComposerState();
    void runPairedSwipeBranchJob(state.pairId, nextBranchId, nextSwipeIndex, nextText);
    return {
      pairId: state.pairId,
      branchId: nextBranchId,
      swipeIndex: nextSwipeIndex,
    };
  }

  function getPairedSwipeStatusSummary(state) {
    const statuses = normalizePairedSwipeStatuses(state?.statusByBranchId);
    let pending = 0;
    let error = 0;
    for (const status of Object.values(statuses)) {
      if (status === 'pending') pending += 1;
      if (status === 'error') error += 1;
    }
    return { pending, error };
  }

  function canAppendPairedSwipeBranch(userMessageId) {
    const pairedState = getPairedSwipeStateByMessageId(userMessageId);
    if (pairedState) {
      return isLatestPairedSwipeTarget(pairedState.userMessageId, pairedState.assistantMessageId);
    }

    const latestPair = findLatestUserAssistantPair();
    if (!latestPair) return false;
    return Number(latestPair.userMessage?.message_id) === Number(userMessageId);
  }

  async function persistLatestPairedSwipePayloadSnapshot(assistantMessageId = null) {
    const latestPair = findLatestUserAssistantPair();
    if (!latestPair) {
      return false;
    }

    const latestAssistantId = Number(latestPair.assistantMessage?.message_id);
    if (assistantMessageId !== null && latestAssistantId !== Number(assistantMessageId)) {
      return false;
    }

    const payloadSnapshot = resolvePairedSwipeBasePayloadSnapshot(
      latestPair.userMessage,
      latestPair.assistantMessage,
    );
    if (!payloadSnapshot) {
      return false;
    }

    const nextAssistantExtra = cloneExtra(latestPair.assistantMessage?.extra);
    nextAssistantExtra[PAIRED_SWIPE_PAYLOAD_KEY] = payloadSnapshot;
    await setChatMessages(
      [{ message_id: latestAssistantId, extra: nextAssistantExtra }],
      { refresh: 'affected' },
    );

    const pairedState = getOrCreatePairedSwipeStateFromMessages(
      latestPair.userMessage,
      latestPair.assistantMessage,
      { create: false },
    );
    if (pairedState) {
      pairedState.basePayloadSnapshot = payloadSnapshot;
      pairedSwipeStates.set(pairedState.pairId, pairedState);
    }

    return true;
  }

  async function syncPairedSwipeIndex(messageId, nextSwipeIndex) {
    const state = getPairedSwipeStateByMessageId(messageId);
    if (!state || state.foregroundPending) {
      return false;
    }

    const syncKey = state.pairId;
    if (pairedSwipeSyncLocks.has(syncKey)) {
      return false;
    }

    const userMessage = readMessageById(state.userMessageId, false);
    const assistantMessage = readMessageById(state.assistantMessageId, false);
    if (!userMessage || !assistantMessage) return false;

    const branchCount = Math.max(
      getMessageSwipeTexts(userMessage).length,
      getMessageSwipeTexts(assistantMessage).length,
      state.branchIds.length,
      1,
    );
    const clampedSwipeIndex = Math.min(Math.max(0, Math.floor(Number(nextSwipeIndex) || 0)), Math.max(0, branchCount - 1));

    pairedSwipeSyncLocks.add(syncKey);
    try {
      await setChatMessages(
        [
          { message_id: state.userMessageId, swipe_id: clampedSwipeIndex },
          { message_id: state.assistantMessageId, swipe_id: clampedSwipeIndex },
        ],
        { refresh: 'affected' },
      );
      state.activeBranchIndex = clampedSwipeIndex;
      pairedSwipeStates.set(state.pairId, state);
      scheduleOldFloorSwipeScan();
      return true;
    } finally {
      pairedSwipeSyncLocks.delete(syncKey);
    }
  }

  function markLatestPairedSwipeForegroundPending(pending, assistantMessageId = null) {
    for (const state of pairedSwipeStates.values()) {
      if (assistantMessageId !== null && Number(state.assistantMessageId) !== Number(assistantMessageId)) {
        continue;
      }
      if (assistantMessageId === null && !isLatestPairedSwipeTarget(state.userMessageId, state.assistantMessageId)) {
        continue;
      }
      state.foregroundPending = Boolean(pending);
      const firstBranchId = state.branchIds[0];
      if (firstBranchId) {
        state.statusByBranchId[firstBranchId] = pending
          ? 'pending'
          : state.statusByBranchId[firstBranchId] === 'error'
            ? 'error'
            : 'done';
      }
      pairedSwipeStates.set(state.pairId, state);
    }
  }

  async function onPairedSwipeMessageSwiped(messageId) {
    const state = getPairedSwipeStateByMessageId(messageId);
    if (!state || state.foregroundPending) {
      return;
    }

    const sourceMessage = readMessageById(messageId, false);
    if (!sourceMessage) return;
    await syncPairedSwipeIndex(messageId, getCurrentSwipeIndex(sourceMessage));
  }

  // =====================================================================
  //  第3部分：旧楼层 Swipe 模块
  // =====================================================================
  const oldFloorSwipeModule = (() => {
    const SWIPE_TAG = '[SWIPE]';
    const STYLE_ID = 'old-floor-swipe-custom-styles';
    const STREAM_UPDATE_INTERVAL = 100;
    let initialized = false;
    let isGenerating = false;
    let currentStreamingMessageId = null;
    let lastStreamUpdateTime = 0;
    let pendingStreamText = '';
    let streamUpdateTimer = null;
    let scanTimer = null;
    let streamHandlerBound = false;

    function getDoc() {
      return getHostDocument();
    }

    function logSwipe(...args) {
      console.log(SWIPE_TAG, ...args);
    }

    function warnSwipe(...args) {
      console.warn(SWIPE_TAG, ...args);
    }

    function errorSwipe(...args) {
      console.error(SWIPE_TAG, ...args);
    }

    function ensureStyles() {
      const doc = getDoc();
      if (!doc) return false;
      if (doc.getElementById(STYLE_ID)) return true;

      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        .old-floor-swipe-container {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
          padding: 4px 0;
        }
        .old-floor-swipe-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 4px;
          background: rgba(255,255,255,0.1);
          color: var(--SmartThemeBodyColor, #fff);
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.2);
          font-size: 14px;
          transition: all 0.2s;
        }
        .old-floor-swipe-btn:hover {
          background: rgba(255,255,255,0.2);
          border-color: rgba(255,255,255,0.4);
        }
        .old-floor-swipe-btn:active {
          transform: scale(0.95);
        }
        .old-floor-swipe-btn.is-disabled {
          opacity: 0.45;
          cursor: not-allowed;
          pointer-events: none;
        }
        .old-floor-swipe-counter {
          font-size: 12px;
          color: var(--SmartThemeQuoteColor, #888);
          min-width: 30px;
          text-align: center;
        }
        .old-floor-swipe-btn.is-loading {
          pointer-events: none;
          opacity: 0.7;
        }
        .old-floor-swipe-btn.is-loading i {
          animation: old-floor-swipe-spin 1s linear infinite;
        }
        @keyframes old-floor-swipe-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .${PAIRED_SWIPE_USER_CONTAINER_CLASS} {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
          padding: 4px 0;
        }
        .${PAIRED_SWIPE_BRANCH_BUTTON_CLASS},
        .${PAIRED_SWIPE_COMPOSER_CONFIRM_CLASS},
        .${PAIRED_SWIPE_COMPOSER_CANCEL_CLASS} {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 30px;
          padding: 4px 12px;
          border-radius: 6px;
          border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
          background: var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92));
          color: var(--SmartThemeBodyColor, #f5f7fa);
          font-size: 12px;
          line-height: 1.3;
          cursor: pointer;
          transition: background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
        }
        .${PAIRED_SWIPE_BRANCH_BUTTON_CLASS}:hover,
        .${PAIRED_SWIPE_COMPOSER_CONFIRM_CLASS}:hover,
        .${PAIRED_SWIPE_COMPOSER_CANCEL_CLASS}:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: var(--SmartThemeEmColor, #9ac7ff);
        }
        .${PAIRED_SWIPE_STATUS_TEXT_CLASS} {
          font-size: 12px;
          color: var(--SmartThemeBodyColor, #f5f7fa);
          opacity: 0.88;
        }
        .${PAIRED_SWIPE_STATUS_TEXT_CLASS}.${PAIRED_SWIPE_PLACEHOLDER_CLASS} {
          color: var(--SmartThemeEmColor, #9ac7ff);
        }
        .${PAIRED_SWIPE_STATUS_TEXT_CLASS}.${PAIRED_SWIPE_ERROR_CLASS} {
          color: #ff9d9d;
        }
        .${PAIRED_SWIPE_COMPOSER_CLASS} {
          display: none;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          margin-top: 8px;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
          background: var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92));
          box-sizing: border-box;
        }
        .${PAIRED_SWIPE_COMPOSER_CLASS}.${PAIRED_SWIPE_COMPOSER_OPEN_CLASS} {
          display: flex;
        }
        .${PAIRED_SWIPE_COMPOSER_TEXTAREA_CLASS} {
          width: 100%;
          min-height: 88px;
          resize: vertical;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
          background: rgba(12, 15, 22, 0.88);
          color: var(--SmartThemeBodyColor, #f5f7fa);
          box-sizing: border-box;
          outline: none;
        }
        .${PAIRED_SWIPE_COMPOSER_TEXTAREA_CLASS}::placeholder {
          color: rgba(245, 247, 250, 0.62);
        }
        .${PAIRED_SWIPE_COMPOSER_TEXTAREA_CLASS}:focus {
          border-color: var(--SmartThemeEmColor, #9ac7ff);
          box-shadow: 0 0 0 1px var(--SmartThemeEmColor, #9ac7ff), 0 0 10px rgba(154, 199, 255, 0.28);
        }
        .${PAIRED_SWIPE_COMPOSER_ACTIONS_CLASS} {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .${PAIRED_SWIPE_COMPOSER_FEEDBACK_CLASS} {
          min-height: 18px;
          font-size: 12px;
          color: var(--SmartThemeBodyColor, #f5f7fa);
          opacity: 0.88;
        }
        .${PAIRED_SWIPE_COMPOSER_FEEDBACK_CLASS}.${PAIRED_SWIPE_ERROR_CLASS} {
          color: #ff9d9d;
        }
      `;
      (doc.head || doc.body)?.appendChild(style);
      return true;
    }

    function removeStyles() {
      const doc = getDoc();
      const style = doc?.getElementById(STYLE_ID);
      if (style) style.remove();
    }

    function removeButtons() {
      const doc = getDoc();
      if (!doc) return;
      doc.querySelectorAll(`.old-floor-swipe-container, .${PAIRED_SWIPE_USER_CONTAINER_CLASS}, .${PAIRED_SWIPE_COMPOSER_CLASS}`)
        .forEach(node => node.remove());
    }

    function updateStreamingMessage(streamedText) {
      if (currentStreamingMessageId === null) return;
      if (typeof setChatMessages !== 'function') return;
      try {
        setChatMessages([{ message_id: currentStreamingMessageId, message: streamedText }], {
          refresh: 'affected',
        });
      } catch (error) {
        errorSwipe('更新消息失败:', error);
      }
    }

    function flushStreamUpdate() {
      if (streamUpdateTimer) {
        clearTimeout(streamUpdateTimer);
        streamUpdateTimer = null;
      }
      if (pendingStreamText && currentStreamingMessageId !== null) {
        updateStreamingMessage(pendingStreamText);
      }
      pendingStreamText = '';
      lastStreamUpdateTime = 0;
    }

    function onStreamTokenReceived(text) {
      try {
        if (currentStreamingMessageId === null) return;
        if (typeof setChatMessages !== 'function') return;

        const streamedText = (text || '').toString();
        pendingStreamText = streamedText;
        const now = Date.now();
        const timeSinceLastUpdate = now - lastStreamUpdateTime;

        if (timeSinceLastUpdate >= STREAM_UPDATE_INTERVAL) {
          updateStreamingMessage(streamedText);
          lastStreamUpdateTime = now;
          if (streamUpdateTimer) {
            clearTimeout(streamUpdateTimer);
            streamUpdateTimer = null;
          }
          return;
        }

        if (!streamUpdateTimer) {
          streamUpdateTimer = setTimeout(() => {
            if (pendingStreamText && currentStreamingMessageId !== null) {
              updateStreamingMessage(pendingStreamText);
              lastStreamUpdateTime = Date.now();
            }
            streamUpdateTimer = null;
          }, STREAM_UPDATE_INTERVAL - timeSinceLastUpdate);
        }
      } catch (error) {
        errorSwipe('流式处理失败:', error);
      }
    }

    function bindEvents() {
      if (streamHandlerBound) return;
      if (typeof iframe_events === 'undefined' || !iframe_events.STREAM_TOKEN_RECEIVED_FULLY) {
        debug('旧楼层 Swipe: STREAM_TOKEN_RECEIVED_FULLY 不可用，跳过流式绑定');
        return;
      }
      bindEvent(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, onStreamTokenReceived);
      streamHandlerBound = true;
      logSwipe('全局流式 handler 已注册');
    }

    function applyEnabledRegexes(text, { messageId = null, depth = null } = {}) {
      return applyTavernAiOutputRegexes(text, { messageId, depth });
    }

    function setSwipeButtonDisabled(button, disabled) {
      if (!button) return;
      button.classList.toggle('is-disabled', Boolean(disabled));
      button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }

    function getPairedSwipeStatusDescriptor(messageId) {
      const state = getPairedSwipeStateByMessageId(messageId);
      if (!state) {
        return {
          text: foregroundGenerationRunning && canAppendPairedSwipeBranch(messageId)
            ? '主分支生成中，可新增并行分支'
            : '可新增并行分支',
          isError: false,
          isPending: foregroundGenerationRunning && canAppendPairedSwipeBranch(messageId),
        };
      }

      const summary = getPairedSwipeStatusSummary(state);
      if (state.foregroundPending && summary.pending > 1) {
        return {
          text: `主分支生成中，另有 ${summary.pending - 1} 个分支生成中`,
          isError: false,
          isPending: true,
        };
      }
      if (state.foregroundPending) {
        return {
          text: '主分支生成中',
          isError: false,
          isPending: true,
        };
      }
      if (summary.pending > 0) {
        return {
          text: `${summary.pending} 个分支生成中`,
          isError: false,
          isPending: true,
        };
      }
      if (summary.error > 0) {
        return {
          text: `${summary.error} 个分支失败`,
          isError: true,
          isPending: false,
        };
      }

      return {
        text: `共 ${Math.max(1, state.branchIds.length)} 个分支`,
        isError: false,
        isPending: false,
      };
    }

    function createPairedSwipeComposer(messageId, updateUI) {
      const doc = getDoc();
      if (!doc) return null;

      const composer = doc.createElement('div');
      composer.className = `${PAIRED_SWIPE_COMPOSER_CLASS} ${PAIRED_SWIPE_COMPOSER_OPEN_CLASS}`;

      const textarea = doc.createElement('textarea');
      textarea.className = PAIRED_SWIPE_COMPOSER_TEXTAREA_CLASS;
      textarea.placeholder = '输入新的并行分支内容';
      textarea.value = pairedSwipeComposerUserMessageId === messageId ? pairedSwipeComposerDraft : '';
      textarea.addEventListener('input', () => {
        pairedSwipeComposerUserMessageId = messageId;
        pairedSwipeComposerDraft = textarea.value;
      });

      const actions = doc.createElement('div');
      actions.className = PAIRED_SWIPE_COMPOSER_ACTIONS_CLASS;

      const confirmButton = doc.createElement('button');
      confirmButton.type = 'button';
      confirmButton.className = PAIRED_SWIPE_COMPOSER_CONFIRM_CLASS;
      confirmButton.textContent = '开始并行生成';

      const cancelButton = doc.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = PAIRED_SWIPE_COMPOSER_CANCEL_CLASS;
      cancelButton.textContent = '取消';

      const feedback = doc.createElement('div');
      feedback.className = PAIRED_SWIPE_COMPOSER_FEEDBACK_CLASS;

      confirmButton.addEventListener('click', async () => {
        confirmButton.disabled = true;
        cancelButton.disabled = true;
        feedback.textContent = '正在创建分支...';
        feedback.classList.remove(PAIRED_SWIPE_ERROR_CLASS);
        try {
          await createPairedSwipeBranch(messageId, textarea.value);
          if (typeof updateUI === 'function') {
            updateUI();
          }
        } catch (error) {
          feedback.textContent = error?.message || '创建分支失败';
          feedback.classList.add(PAIRED_SWIPE_ERROR_CLASS);
          confirmButton.disabled = false;
          cancelButton.disabled = false;
          return;
        }
        scheduleScan();
      });

      cancelButton.addEventListener('click', () => {
        clearPairedSwipeComposerState();
        scheduleScan();
      });

      actions.append(confirmButton, cancelButton);
      composer.append(textarea, actions, feedback);
      return composer;
    }

    function addUserPairControlsToMessage(mesElement) {
      const messageId = parseInt(mesElement?.getAttribute('mesid') || '', 10);
      if (!Number.isFinite(messageId)) return;
      if (mesElement.getAttribute('is_user') !== 'true') return;

      const mesBlock = mesElement.querySelector('.mes_block');
      if (!mesBlock) return;

      const pairedState = getPairedSwipeStateByMessageId(messageId);
      const canAppendBranch = canAppendPairedSwipeBranch(messageId);
      const shouldShowComposer = pairedSwipeComposerUserMessageId === messageId;
      const existingControls = mesBlock.querySelector(`.${PAIRED_SWIPE_USER_CONTAINER_CLASS}`);
      const existingComposer = mesBlock.querySelector(`.${PAIRED_SWIPE_COMPOSER_CLASS}`);
      const preserveComposer = Boolean(existingComposer && shouldShowComposer);
      if (!preserveComposer) {
        existingComposer?.remove();
      }

      if (!pairedState && !canAppendBranch) {
        existingControls?.remove();
        return;
      }

      const doc = getDoc();
      if (!doc) return;
      const userMessage = readMessageById(messageId, false);
      if (!userMessage) return;

      const swipeTexts = getMessageSwipeTexts(userMessage);
      const swipeCount = Math.max(
        swipeTexts.length,
        pairedState?.branchIds?.length || 1,
      );
      const currentSwipeId = Math.min(getCurrentSwipeIndex(userMessage), Math.max(0, swipeCount - 1));
      const isNewControls = !existingControls;
      const controls = existingControls || doc.createElement('div');
      controls.className = PAIRED_SWIPE_USER_CONTAINER_CLASS;
      controls.setAttribute('data-message-id', String(messageId));

      const getOrCreateControl = (role, tagName, className = '') => {
        let node = controls.querySelector(`[data-role="${role}"]`);
        if (!node) {
          node = doc.createElement(tagName);
          node.setAttribute('data-role', role);
        }
        if (node.className !== className) {
          node.className = className;
        }
        return node;
      };

      const leftBtn = getOrCreateControl('paired-left', 'div', 'old-floor-swipe-btn');
      const leftBtnHtml = '<i class="fa-solid fa-chevron-left"></i>';
      if (leftBtn.innerHTML !== leftBtnHtml) {
        leftBtn.innerHTML = leftBtnHtml;
      }
      leftBtn.title = '上一分支';

      const counter = getOrCreateControl('paired-counter', 'span', 'old-floor-swipe-counter');
      const counterText = `${currentSwipeId + 1}/${Math.max(1, swipeCount)}`;
      if (counter.textContent !== counterText) {
        counter.textContent = counterText;
      }

      const rightBtn = getOrCreateControl('paired-right', 'div', 'old-floor-swipe-btn');
      const rightBtnHtml = '<i class="fa-solid fa-chevron-right"></i>';
      if (rightBtn.innerHTML !== rightBtnHtml) {
        rightBtn.innerHTML = rightBtnHtml;
      }
      rightBtn.title = '下一分支';

      const statusText = getOrCreateControl('paired-status', 'span', PAIRED_SWIPE_STATUS_TEXT_CLASS);
      const statusDescriptor = getPairedSwipeStatusDescriptor(messageId);
      if (statusText.textContent !== statusDescriptor.text) {
        statusText.textContent = statusDescriptor.text;
      }
      statusText.classList.toggle(PAIRED_SWIPE_PLACEHOLDER_CLASS, statusDescriptor.isPending);
      statusText.classList.toggle(PAIRED_SWIPE_ERROR_CLASS, statusDescriptor.isError);

      const disableSwipeButtons = !pairedState || pairedState.foregroundPending || swipeCount <= 1;
      setSwipeButtonDisabled(leftBtn, disableSwipeButtons || currentSwipeId <= 0);
      setSwipeButtonDisabled(rightBtn, disableSwipeButtons || currentSwipeId >= swipeCount - 1);

      // Store current swipe state on the controls element so click handlers
      // always read fresh values instead of stale closure captures.
      controls.__pairedSwipeState = {
        messageId,
        currentSwipeId,
        disableSwipeButtons,
        swipeCount,
      };

      if (!leftBtn.__pairedBound) {
        leftBtn.__pairedBound = true;
        leftBtn.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          const s = controls.__pairedSwipeState;
          if (!s || s.disableSwipeButtons || s.currentSwipeId <= 0) return;
          void syncPairedSwipeIndex(s.messageId, s.currentSwipeId - 1);
        });
      }

      if (!rightBtn.__pairedBound) {
        rightBtn.__pairedBound = true;
        rightBtn.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          const s = controls.__pairedSwipeState;
          if (!s || s.disableSwipeButtons || s.currentSwipeId >= s.swipeCount - 1) return;
          void syncPairedSwipeIndex(s.messageId, s.currentSwipeId + 1);
        });
      }

      let branchButton = controls.querySelector(`[data-role="paired-branch-button"]`);
      if (canAppendBranch) {
        if (!branchButton) {
          branchButton = doc.createElement('button');
          branchButton.setAttribute('data-role', 'paired-branch-button');
          branchButton.type = 'button';
          branchButton.className = PAIRED_SWIPE_BRANCH_BUTTON_CLASS;
          branchButton.textContent = '并行分支';
          branchButton.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
              event.stopImmediatePropagation();
            }
            const mid = Number(branchButton.getAttribute('data-message-id'));
            if (Number.isFinite(mid)) {
              togglePairedSwipeComposer(mid);
            }
          });
        }
        branchButton.setAttribute('data-message-id', String(messageId));
      } else if (branchButton) {
        branchButton.remove();
        branchButton = null;
      }

      // Ensure all children are properly parented in the expected order.
      // Use a lightweight check: only call append when children are missing
      // or out of order, to avoid triggering unnecessary MutationObserver callbacks.
      const expectedChildren = [leftBtn, counter, rightBtn, statusText];
      if (branchButton) {
        expectedChildren.push(branchButton);
      }
      const currentChildren = Array.from(controls.children);
      const needsReorder = expectedChildren.length !== currentChildren.length
        || expectedChildren.some((child, i) => currentChildren[i] !== child);
      if (needsReorder) {
        controls.append(...expectedChildren);
      }
      const focusComposerTextarea = (composerNode) => {
        const textarea = composerNode?.querySelector?.(`.${PAIRED_SWIPE_COMPOSER_TEXTAREA_CLASS}`);
        if (!textarea || typeof textarea.focus !== 'function') {
          return;
        }
        setTimeout(() => {
          textarea.focus();
          if (typeof textarea.setSelectionRange === 'function') {
            const textLength = String(textarea.value || '').length;
            textarea.setSelectionRange(textLength, textLength);
          }
        }, 0);
      };

      if (!existingControls) {
        mesBlock.appendChild(controls);
      }

      if (!preserveComposer && shouldShowComposer) {
        const composer = createPairedSwipeComposer(messageId, () => scheduleScan());
        if (composer) {
          mesBlock.appendChild(composer);
          if (pairedSwipeComposerUserMessageId === messageId) {
            focusComposerTextarea(composer);
          }
        }
      }
    }

    async function swipeLeft(messageId, updateUI) {
      if (isGenerating) return;
      const pairedState = getPairedSwipeStateByMessageId(messageId);
      if (pairedState) {
        const message = readMessageById(messageId, false);
        if (!message) return;
        const currentSwipeId = getCurrentSwipeIndex(message);
        if (currentSwipeId > 0) {
          await syncPairedSwipeIndex(messageId, currentSwipeId - 1);
          if (typeof updateUI === 'function') setTimeout(updateUI, 100);
        }
        return;
      }
      try {
        const msgs = getChatMessages(messageId, { include_swipes: true });
        if (!msgs || msgs.length === 0) return;
        const msg = msgs[0];
        if (msg.swipe_id > 0) {
          await setChatMessages([{ message_id: messageId, swipe_id: msg.swipe_id - 1 }], {
            refresh: 'affected',
          });
          if (typeof updateUI === 'function') setTimeout(updateUI, 100);
        }
      } catch (error) {
        errorSwipe('左切换失败:', error);
      }
    }

    async function swipeRight(messageId, updateUI, rightBtn) {
      if (isGenerating) return;
      const pairedState = getPairedSwipeStateByMessageId(messageId);
      if (pairedState) {
        const message = readMessageById(messageId, false);
        if (!message) return;
        const swipeCount = Math.max(
          getMessageSwipeTexts(message).length,
          pairedState.branchIds.length,
          1,
        );
        const currentSwipeId = getCurrentSwipeIndex(message);
        if (currentSwipeId < swipeCount - 1) {
          await syncPairedSwipeIndex(messageId, currentSwipeId + 1);
          if (typeof updateUI === 'function') setTimeout(updateUI, 100);
        }
        return;
      }
      try {
        const msgs = getChatMessages(messageId, { include_swipes: true });
        if (!msgs || msgs.length === 0) return;
        const msg = msgs[0];
        if (msg.swipe_id < msg.swipes.length - 1) {
          await setChatMessages([{ message_id: messageId, swipe_id: msg.swipe_id + 1 }], {
            refresh: 'affected',
          });
          if (typeof updateUI === 'function') setTimeout(updateUI, 100);
        } else {
          if (rightBtn) {
            rightBtn.classList.add('is-loading');
            rightBtn.innerHTML = '<i class="fa-solid fa-spinner"></i>';
          }
          try {
            await generateNewSwipe(messageId, updateUI);
          } finally {
            if (rightBtn) {
              rightBtn.classList.remove('is-loading');
              rightBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            }
          }
        }
      } catch (error) {
        errorSwipe('右切换失败:', error);
      }
    }

    async function generateNewSwipe(messageId, updateUI) {
      isGenerating = true;
      try {
        const msgs = getChatMessages(messageId, { include_swipes: true });
        if (!msgs || msgs.length === 0) {
          throw new Error('未找到目标楼层');
        }
        const msg = msgs[0];
        const oldSwipes = Array.isArray(msg.swipes) ? msg.swipes : [];
        const newSwipes = [...oldSwipes, ''];
        const newSwipeId = newSwipes.length - 1;
        await setChatMessages([{
          message_id: messageId,
          swipes: newSwipes,
          swipe_id: newSwipeId,
        }], { refresh: 'affected' });

        currentStreamingMessageId = messageId;
        bindEvents();

        let chatPrompts = [];
        if (messageId > 0) {
          const historyMsgs = getChatMessages(`0-${messageId - 1}`);
          chatPrompts = historyMsgs.map(message => ({
            role: message.role,
            content: message.message,
          }));
        }

        const result = await generate({
          should_stream: true,
          overrides: {
            chat_history: {
              with_depth_entries: true,
              prompts: chatPrompts,
            },
          },
        });

        flushStreamUpdate();
        if (result) {
          const processedResult = applyEnabledRegexes(result, { messageId });
          const updatedMsgs = getChatMessages(messageId, { include_swipes: true });
          if (updatedMsgs && updatedMsgs.length > 0) {
            const updatedSwipes = Array.isArray(updatedMsgs[0].swipes) ? [...updatedMsgs[0].swipes] : [];
            updatedSwipes[newSwipeId] = processedResult;
            await setChatMessages([{
              message_id: messageId,
              swipes: updatedSwipes,
              swipe_id: newSwipeId,
            }], { refresh: 'affected' });
          }
        }

        if (typeof updateUI === 'function') setTimeout(updateUI, 100);
      } catch (error) {
        errorSwipe('生成失败:', error);
      } finally {
        isGenerating = false;
        currentStreamingMessageId = null;
      }
    }

    function addSwipeButtonsToMessage(mesElement) {
      const messageId = parseInt(mesElement?.getAttribute('mesid') || '', 10);
      if (!Number.isFinite(messageId)) return;
      if (mesElement.getAttribute('is_user') === 'true') return;
      if (mesElement.classList.contains('last_mes')) return;
      if (mesElement.querySelector('.old-floor-swipe-container')) return;
      const pairedState = getPairedSwipeStateByMessageId(messageId);

      let swipeInfo = { current: 1, total: 1 };
      try {
        const msgs = getChatMessages(messageId, { include_swipes: true });
        if (msgs && msgs.length > 0) {
          const msg = msgs[0];
          const swipes = Array.isArray(msg.swipes) ? msg.swipes : [''];
          const swipeId = Number.isFinite(Number(msg.swipe_id)) ? Number(msg.swipe_id) : 0;
          swipeInfo = { current: swipeId + 1, total: Math.max(1, swipes.length) };
        }
      } catch {
        // ignore
      }

      const doc = getDoc();
      if (!doc) return;
      const container = doc.createElement('div');
      container.className = 'old-floor-swipe-container';

      const leftBtn = doc.createElement('div');
      leftBtn.className = 'old-floor-swipe-btn';
      leftBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
      leftBtn.title = '上一个回复';

      const counter = doc.createElement('span');
      counter.className = 'old-floor-swipe-counter';
      counter.textContent = `${swipeInfo.current}/${swipeInfo.total}`;

      const rightBtn = doc.createElement('div');
      rightBtn.className = 'old-floor-swipe-btn';
      rightBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
      rightBtn.title = pairedState ? '下一个分支' : '下一个回复 / 生成新回复';

      const updateUI = () => {
        try {
          const msgs = getChatMessages(messageId, { include_swipes: true });
          if (msgs && msgs.length > 0) {
            const msg = msgs[0];
            const swipes = Array.isArray(msg.swipes) ? msg.swipes : [''];
            const swipeId = Number.isFinite(Number(msg.swipe_id)) ? Number(msg.swipe_id) : 0;
            counter.textContent = `${swipeId + 1}/${Math.max(1, swipes.length)}`;
          }
        } catch {
          // ignore
        }
      };

      leftBtn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        void swipeLeft(messageId, updateUI);
      });

      rightBtn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        void swipeRight(messageId, updateUI, rightBtn);
      });

      container.append(leftBtn, counter, rightBtn);
      const mesBlock = mesElement.querySelector('.mes_block');
      if (mesBlock) {
        mesBlock.appendChild(container);
      }
    }

    function scanAndAddButtons() {
      if (!initialized) return;
      const doc = getDoc();
      if (!doc) return;
      doc.querySelectorAll('.mes').forEach((mesElement) => {
        addSwipeButtonsToMessage(mesElement);
        addUserPairControlsToMessage(mesElement);
      });
    }

    function scheduleScan() {
      if (!initialized) return;
      if (scanTimer) return;
      scanTimer = setTimeout(() => {
        scanTimer = null;
        scanAndAddButtons();
      }, 50);
    }

    function togglePairedSwipeComposer(messageId) {
      const doc = getDoc();
      const mesElement = doc?.querySelector(`.mes[mesid="${messageId}"]`);
      const mesBlock = mesElement?.querySelector('.mes_block');
      if (!mesBlock) {
        return false;
      }

      const existingComposer = mesBlock.querySelector(`.${PAIRED_SWIPE_COMPOSER_CLASS}`);
      if (pairedSwipeComposerUserMessageId === messageId && existingComposer) {
        clearPairedSwipeComposerState();
        existingComposer.remove();
        scheduleScan();
        return true;
      }

      pairedSwipeComposerUserMessageId = messageId;
      doc.querySelectorAll(`.${PAIRED_SWIPE_COMPOSER_CLASS}`).forEach(node => node.remove());

      const composer = createPairedSwipeComposer(messageId, () => scheduleScan());
      if (!composer) {
        scheduleScan();
        return false;
      }

      mesBlock.appendChild(composer);
      const textarea = composer.querySelector(`.${PAIRED_SWIPE_COMPOSER_TEXTAREA_CLASS}`);
      if (textarea && typeof textarea.focus === 'function') {
        setTimeout(() => {
          textarea.focus();
          if (typeof textarea.setSelectionRange === 'function') {
            const textLength = String(textarea.value || '').length;
            textarea.setSelectionRange(textLength, textLength);
          }
        }, 0);
      }

      scheduleScan();
      return true;
    }

    function init() {
      if (initialized) return;
      initialized = true;
      ensureStyles();
      bindEvents();
      scanAndAddButtons();
      logSwipe('旧楼层 Swipe 模块已初始化');
    }

    function destroy() {
      initialized = false;
      isGenerating = false;
      currentStreamingMessageId = null;
      streamHandlerBound = false;
      flushStreamUpdate();
      if (scanTimer) {
        clearTimeout(scanTimer);
        scanTimer = null;
      }
      removeButtons();
      removeStyles();
    }

    return {
      init,
      destroy,
      bindEvents,
      scheduleScan,
    };
  })();

  function initOldFloorSwipe() {
    oldFloorSwipeModule.init();
  }

  function destroyOldFloorSwipe() {
    oldFloorSwipeModule.destroy();
  }

  function bindOldFloorSwipeEvents() {
    oldFloorSwipeModule.bindEvents();
  }

  function scheduleOldFloorSwipeScan() {
    oldFloorSwipeModule.scheduleScan();
  }

  // =====================================================================
  //  第4部分：世界书快捷切换模块
  // =====================================================================
  const worldbookSwitcherModule = (() => {
  console.log('[WorldbookSwitcher] 插件开始执行...');
  const SCRIPT_ID = 'worldbook-switcher-plugin';
  const LEGACY_CONFIG_KEY = 'worldbook_switcher_config';

  // 获取父页面的document和jQuery（脚本运行在iframe中）
  const parentDoc = getHostDocument();
  const $ = getHostWindow().$;

  let worldbookInitialized = false;
  let worldbookDestroyed = false;
  let worldbookLegacyConfigMigrated = false;
  let worldbookSetupRetryTimer = null;
  let worldbookNativeIcon = null;
  let worldbookNativeIconClickHandler = null;
  let worldbookPanelObserver = null;
  const worldbookTimeoutHandles = new Set();

  function scheduleWorldbookTimeout(callback, delay) {
    const timer = setTimeout(() => {
      worldbookTimeoutHandles.delete(timer);
      callback();
    }, delay);
    worldbookTimeoutHandles.add(timer);
    return timer;
  }

  function clearWorldbookTimeouts() {
    for (const timer of worldbookTimeoutHandles) {
      clearTimeout(timer);
    }
    worldbookTimeoutHandles.clear();
  }


  // =============================================================================
  // 配置管理
  // =============================================================================
  function getWorldbookSwitcherConfig() {
    return normalizeWorldbookSwitcherConfig(config?.worldbook_switcher);
  }

  function saveWorldbookSwitcherConfig(nextConfig) {
    config = normalizeConfig({
      ...config,
      worldbook_switcher: normalizeWorldbookSwitcherConfig(nextConfig),
    });
    saveConfig();
  }

  function migrateLegacyWorldbookConfigIfNeeded() {
    if (worldbookLegacyConfigMigrated) return;
    worldbookLegacyConfigMigrated = true;

    let storage = null;
    try {
      storage = getHostWindow()?.localStorage || window.localStorage;
    } catch {
      storage = null;
    }
    if (!storage || typeof storage.getItem !== 'function') return;

    let legacyRaw = '';
    try {
      legacyRaw = storage.getItem(LEGACY_CONFIG_KEY) || '';
    } catch (error) {
      console.warn('[WorldbookSwitcher] 读取旧 localStorage 配置失败:', error);
      return;
    }
    if (!legacyRaw) return;

    try {
      const legacyConfig = JSON.parse(legacyRaw);
      const current = normalizeWorldbookSwitcherConfig(config?.worldbook_switcher);
      const merged = normalizeWorldbookSwitcherConfig({
        ...current,
        ...legacyConfig,
        panelState: {
          ...current.panelState,
          ...(legacyConfig?.panelState || {}),
        },
      });
      config = normalizeConfig({
        ...config,
        worldbook_switcher: merged,
      });
      saveConfig();
      storage.removeItem(LEGACY_CONFIG_KEY);
      console.log('[WorldbookSwitcher] 已迁移旧 localStorage 配置到脚本变量');
    } catch (error) {
      console.warn('[WorldbookSwitcher] 迁移旧配置失败:', error);
    }
  }

  // =============================================================================
  // 工具函数
  // =============================================================================
  function truncateText(text, maxChars = 20) {
    if (!text) return '';
    let count = 0;
    let result = '';
    for (const char of text) {
      const charWidth = /[\u4e00-\u9fa5]/.test(char) ? 2 : 1;
      if (count + charWidth > maxChars * 2) {
        return result + '...';
      }
      count += charWidth;
      result += char;
    }
    return result;
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = parentDoc.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 检测是否为移动端
  function isMobileDevice() {
    return getHostWindow().innerWidth < 768;
  }

  // =============================================================================
  // 世界书API封装
  // =============================================================================
  async function getAllWorldbooks() {
    try {
      if (typeof getWorldbookNames === 'function') {
        return getWorldbookNames();
      }
    } catch (e) {
      console.error('[WorldbookSwitcher] 获取世界书列表失败:', e);
    }
    return [];
  }

  async function getGlobalWorldbooks() {
    try {
      if (typeof getGlobalWorldbookNames === 'function') {
        const result = getGlobalWorldbookNames();
        console.log('[WorldbookSwitcher] 获取全局世界书:', result);
        return Array.isArray(result) ? result : [];
      }
    } catch (e) {
      console.error('[WorldbookSwitcher] 获取全局世界书失败:', e);
    }
    return [];
  }

  async function getWorldbookEntries(worldbookName) {
    try {
      if (typeof getWorldbook === 'function') {
        return await getWorldbook(worldbookName);
      }
    } catch (e) {
      console.error('[WorldbookSwitcher] 获取世界书条目失败:', e);
    }
    return [];
  }

  async function updateWorldbookEntries(worldbookName, entries) {
    try {
      if (typeof replaceWorldbook === 'function') {
        await replaceWorldbook(worldbookName, entries, { render: 'immediate' });
        return true;
      }
    } catch (e) {
      console.error('[WorldbookSwitcher] 更新世界书条目失败:', e);
    }
    return false;
  }

  // 记录条目使用统计
  function recordEntryUsage(worldbookName, uid, entryName) {
    const config = getWorldbookSwitcherConfig();
    const key = `${worldbookName}:${uid}`;
    if (!config.entryUsageStats[key]) {
      config.entryUsageStats[key] = { count: 0, lastUsed: 0, name: '', worldbook: worldbookName };
    }
    config.entryUsageStats[key].count++;
    config.entryUsageStats[key].lastUsed = Date.now();
    config.entryUsageStats[key].name = entryName || config.entryUsageStats[key].name;
    config.entryUsageStats[key].worldbook = worldbookName;
    saveWorldbookSwitcherConfig(config);
  }

  // 获取常用条目列表（置顶优先，然后按使用次数排序）
  function getFrequentEntries(limit = 30) {
    const config = getWorldbookSwitcherConfig();
    const entries = Object.entries(config.entryUsageStats)
      .map(([key, data]) => {
        const [worldbook, uid] = key.split(':');
        return { key, worldbook, uid: parseInt(uid), pinned: data.pinned || false, ...data };
      })
      .sort((a, b) => {
        // 置顶的排在前面
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // 同级别按使用次数排序
        return b.count - a.count;
      })
      .slice(0, limit);
    return entries;
  }

  // 置顶条目
  function pinEntry(worldbookName, uid) {
    const config = getWorldbookSwitcherConfig();
    const key = `${worldbookName}:${uid}`;
    if (config.entryUsageStats[key]) {
      config.entryUsageStats[key].pinned = true;
      saveWorldbookSwitcherConfig(config);
    }
  }

  // 取消置顶
  function unpinEntry(worldbookName, uid) {
    const config = getWorldbookSwitcherConfig();
    const key = `${worldbookName}:${uid}`;
    if (config.entryUsageStats[key]) {
      config.entryUsageStats[key].pinned = false;
      saveWorldbookSwitcherConfig(config);
    }
  }

  // 从历史中移除
  function removeFromHistory(worldbookName, uid) {
    const config = getWorldbookSwitcherConfig();
    const key = `${worldbookName}:${uid}`;
    delete config.entryUsageStats[key];
    saveWorldbookSwitcherConfig(config);
  }

  // =============================================================================
  // 状态管理
  // =============================================================================
  let currentState = {
    selectedWorldbook: '',
    entries: [],
    isIntercepting: true, // 是否拦截原生图标点击
    mobileActiveTab: 1,
    mobileDetailContext: null,
    fullscreenEditorContext: null,
  };

  const ENTRY_STRATEGY_OPTIONS = [
    { value: 'constant', label: '常量（蓝灯）', icon: 'fa-solid fa-circle', color: '#60A5FA' },
    { value: 'selective', label: '关键词触发（绿灯）', icon: 'fa-solid fa-circle', color: '#6EE7B7' },
    { value: 'vectorized', label: '向量化', icon: 'fa-solid fa-link', color: '#C084FC' },
  ];

  const ENTRY_POSITION_OPTIONS = [
    { value: 'before_character_definition', label: '角色定义前' },
    { value: 'after_character_definition', label: '角色定义后' },
    { value: 'before_example_messages', label: '示例消息前' },
    { value: 'after_example_messages', label: '示例消息后' },
    { value: 'before_author_note', label: '作者注释前' },
    { value: 'after_author_note', label: '作者注释后' },
    { value: 'at_depth', label: '指定深度' },
    { value: 'outlet', label: 'Outlet' },
  ];

  function escapeAttr(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function buildDataAttrs(data) {
    return Object.entries(data || {})
      .map(([key, value]) => `data-${key}="${escapeAttr(value)}"`)
      .join(' ');
  }

  function getEntryDisplayName(entry, maxChars = 15) {
    return entry?.name || truncateText(entry?.content, maxChars) || '(无标题)';
  }

  function renderEntryStrategyButtons(selectedValue) {
    return ENTRY_STRATEGY_OPTIONS
      .map(option => {
        const isActive = option.value === selectedValue;
        return `
          <button
            type="button"
            class="wb-entry-detail-strategy-btn"
            data-value="${option.value}"
            data-active="${isActive ? 'true' : 'false'}"
            aria-pressed="${isActive ? 'true' : 'false'}"
            title="${escapeAttr(option.label)}"
            style="--wb-strategy-color: ${option.color};"
          >
            <i class="${option.icon}"></i>
          </button>
        `;
      })
      .join('');
  }

  function renderToggleSwitch({ className, checked, dataAttrs, activeColor = '#10B981' }) {
    return `
      <label style="
        position: relative;
        display: inline-block;
        width: 32px;
        height: 18px;
        flex-shrink: 0;
        cursor: pointer;
      ">
        <input type="checkbox" class="${className}" ${buildDataAttrs(dataAttrs)}
          ${checked ? 'checked' : ''}
          style="position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; z-index: 1;">
        <span style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: ${checked ? activeColor : '#6B7280'};
          transition: 0.3s;
          border-radius: 18px;
          pointer-events: none;
        "></span>
        <span style="
          position: absolute;
          height: 14px;
          width: 14px;
          left: ${checked ? '16px' : '2px'};
          bottom: 2px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
          pointer-events: none;
        "></span>
      </label>
    `;
  }

  function renderEntryDetailButton(themeColors, worldbookName, uid, { compact = false } = {}) {
    return `
      <button class="wb-entry-detail-btn" ${buildDataAttrs({ worldbook: worldbookName, uid })} title="查看详情" style="
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        flex-shrink: 0;
        padding: ${compact ? '2px 6px' : '4px 8px'};
        border-radius: 4px;
        border: 1px solid ${themeColors.border};
        background: rgba(139, 92, 246, 0.18);
        color: ${themeColors.text};
        cursor: pointer;
        font-size: ${compact ? '0.72em' : '0.75em'};
        line-height: 1;
      ">
        <i class="fa-solid fa-eye"></i>${compact ? '' : '<span>详情</span>'}
      </button>
    `;
  }

  function renderCurrentWorldbookEntry(entry, themeColors, { variant = 'desktop', worldbookName }) {
    const rowClass = variant === 'desktop' ? 'wb-simple-entry' : 'wb-mobile-entry';
    const toggleClass = variant === 'desktop' ? 'wb-simple-toggle' : 'wb-mobile-entry-toggle';
    const displayName = getEntryDisplayName(entry);
    return `
      <div class="${rowClass}" data-uid="${entry.uid}" style="
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8em;
        ${!entry.enabled ? 'opacity: 0.5;' : ''}
        transition: background 0.15s;
      " onmouseover="this.style.background='rgba(139,92,246,0.15)'" onmouseout="this.style.background='transparent'">
        ${renderToggleSwitch({
          className: toggleClass,
          checked: entry.enabled,
          dataAttrs: { uid: entry.uid },
        })}
        <span class="wb-entry-name" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHtml(displayName)}
        </span>
        ${renderEntryDetailButton(themeColors, worldbookName, entry.uid, { compact: variant !== 'desktop' })}
      </div>
    `;
  }

  function renderCurrentWorldbookEntries(entries, themeColors, { variant = 'desktop', worldbookName }) {
    if (!entries.length) {
      return `<div style="text-align: center; padding: 20px; color: ${themeColors.secondaryText}; font-size: 0.85em;">暂无条目</div>`;
    }
    return entries
      .map(entry => renderCurrentWorldbookEntry(entry, themeColors, { variant, worldbookName }))
      .join('');
  }

  async function getFrequentEntriesWithState(limit = 30) {
    const frequentEntries = getFrequentEntries(limit);
    const entriesWithState = [];
    for (const frequentEntry of frequentEntries) {
      try {
        const wbEntries = await getWorldbookEntries(frequentEntry.worldbook);
        const wbEntry = wbEntries.find(e => e.uid === frequentEntry.uid);
        if (!wbEntry) continue;
        entriesWithState.push({ ...frequentEntry, ...wbEntry, enabled: wbEntry.enabled });
      } catch (error) {
        console.warn('[WorldbookSwitcher] 获取常用条目状态失败:', frequentEntry.worldbook, frequentEntry.uid, error);
      }
    }
    return entriesWithState;
  }

  function renderFrequentEntry(entry, themeColors, { variant = 'desktop' } = {}) {
    const rowClass = variant === 'desktop' ? 'wb-frequent-entry' : 'wb-mobile-frequent';
    const toggleClass = variant === 'desktop' ? 'wb-frequent-toggle' : 'wb-mobile-frequent-toggle';
    const pinClass = variant === 'desktop' ? 'wb-frequent-pin' : 'wb-mobile-frequent-pin';
    const removeClass = variant === 'desktop' ? 'wb-frequent-remove' : 'wb-mobile-frequent-remove';
    return `
      <div class="${rowClass}" ${buildDataAttrs({ worldbook: entry.worldbook, uid: entry.uid })} style="
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 4px;
        ${variant === 'desktop' ? 'cursor: pointer;' : ''}
        font-size: 0.8em;
        ${!entry.enabled ? 'opacity: 0.5;' : ''}
        transition: background 0.15s;
      " onmouseover="this.style.background='rgba(245,158,11,0.15)'" onmouseout="this.style.background='transparent'">
        ${renderToggleSwitch({
          className: toggleClass,
          checked: entry.enabled,
          dataAttrs: { worldbook: entry.worldbook, uid: entry.uid },
        })}
        <div style="flex: 1; overflow: hidden; min-width: 0;">
          <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${entry.pinned ? '<i class="fa-solid fa-thumbtack" style="color: #F59E0B; margin-right: 4px; font-size: 0.8em;"></i>' : ''}${escapeHtml(entry.name || '(无标题)')}
          </div>
          <div style="font-size: 0.75em; color: ${themeColors.secondaryText}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(entry.worldbook)}
          </div>
        </div>
        <div style="display: flex; gap: 4px; flex-shrink: 0;">
          <button class="${pinClass}" ${buildDataAttrs({ worldbook: entry.worldbook, uid: entry.uid, pinned: entry.pinned })} title="${entry.pinned ? '取消置顶' : '置顶'}" style="
            background: ${entry.pinned ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'transparent'};
            color: ${entry.pinned ? 'white' : themeColors.secondaryText};
            border: ${entry.pinned ? 'none' : '1px solid ' + themeColors.border};
            border-radius: 4px;
            padding: 2px 6px;
            cursor: pointer;
            font-size: 0.7em;
          ">
            <i class="fa-solid fa-thumbtack"></i>
          </button>
          ${renderEntryDetailButton(themeColors, entry.worldbook, entry.uid, { compact: true })}
          <button class="${removeClass}" ${buildDataAttrs({ worldbook: entry.worldbook, uid: entry.uid })} title="从历史移除" style="
            background: transparent;
            color: ${themeColors.secondaryText};
            border: 1px solid ${themeColors.border};
            border-radius: 4px;
            padding: 2px 6px;
            cursor: pointer;
            font-size: 0.7em;
          ">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  function renderFrequentEntries(entries, themeColors, { variant = 'desktop' } = {}) {
    if (!entries.length) {
      return variant === 'desktop'
        ? `<div style="text-align: center; padding: 20px; color: ${themeColors.secondaryText}; font-size: 0.85em;">暂无使用记录<br><span style="font-size: 0.8em;">开关条目后会在此显示</span></div>`
        : `<div style="text-align: center; padding: 20px; color: ${themeColors.secondaryText}; font-size: 0.85em;">暂无使用记录</div>`;
    }
    return entries.map(entry => renderFrequentEntry(entry, themeColors, { variant })).join('');
  }

  function resolveEntryDetailContainer(containerOrSelector) {
    if (containerOrSelector?.jquery) {
      return containerOrSelector.first();
    }
    if (typeof containerOrSelector === 'string' && containerOrSelector) {
      return $(containerOrSelector, parentDoc).first();
    }
    return $();
  }

  function updateEntryDetailDepthState(containerOrSelector) {
    const $container = resolveEntryDetailContainer(containerOrSelector);
    if (!$container.length) return;
    const positionType = String($container.find('.wb-entry-detail-position-select').val() || '');
    const isAtDepth = positionType === 'at_depth';
    $container.find('.wb-entry-detail-depth-row').toggle(isAtDepth);
    $container.find('.wb-entry-detail-depth-input').prop('disabled', !isAtDepth);
  }

  function updateEntryDetailStrategyState(containerOrSelector, nextStrategyType) {
    const $container = resolveEntryDetailContainer(containerOrSelector);
    if (!$container.length) return;
    const strategyType = String(nextStrategyType || $container.find('.wb-entry-detail-strategy-input').val() || 'constant');
    $container.find('.wb-entry-detail-strategy-input').val(strategyType);
    $container.find('.wb-entry-detail-strategy-btn').each(function() {
      const isActive = $(this).attr('data-value') === strategyType;
      $(this)
        .attr('data-active', isActive ? 'true' : 'false')
        .attr('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function setEntryDetailFeedback(containerOrSelector, message, isError = false) {
    const $container = resolveEntryDetailContainer(containerOrSelector);
    if (!$container.length) return;
    const $feedback = $container.find('.wb-entry-detail-feedback');
    if (!$feedback.length) return;
    if (!isError) {
      $feedback.text('').hide();
      return;
    }
    $feedback
      .text(message || '')
      .css('color', '#FCA5A5')
      .toggle(Boolean(message));
  }

  function closeEntryDetailPanel() {
    $('#wb-entry-detail-panel', parentDoc).remove();
  }

  function removeFrequentEntriesPanel({ repositionDetail = true } = {}) {
    $('#wb-frequent-entries-panel', parentDoc).remove();
    if (repositionDetail) {
      repositionEntryDetailPanel();
    }
  }

  function closeDesktopMenuPanels() {
    $('#worldbook-switcher-simple-menu', parentDoc).remove();
    $('#wb-all-worldbooks-panel', parentDoc).remove();
    removeFrequentEntriesPanel({ repositionDetail: false });
    closeEntryDetailPanel();
  }

  async function refreshCurrentWorldbookViews(worldbookName) {
    if (worldbookName === currentState.selectedWorldbook) {
      currentState.entries = await getWorldbookEntries(worldbookName);
      const themeColors = getThemeColors();
      if ($('#wb-simple-entries', parentDoc).length) {
        $('#wb-simple-entries', parentDoc).html(
          renderCurrentWorldbookEntries(currentState.entries, themeColors, {
            variant: 'desktop',
            worldbookName,
          }),
        );
      }
      if ($('#wb-mobile-entries-list', parentDoc).length) {
        $('#wb-mobile-entries-list', parentDoc).html(
          renderCurrentWorldbookEntries(currentState.entries, themeColors, {
            variant: 'mobile',
            worldbookName,
          }),
        );
      }
    }
  }

  async function refreshFrequentEntryViews() {
    const themeColors = getThemeColors();
    const entriesWithState = await getFrequentEntriesWithState();
    if ($('#wb-frequent-entries-list', parentDoc).length) {
      $('#wb-frequent-entries-list', parentDoc).html(
        renderFrequentEntries(entriesWithState, themeColors, { variant: 'desktop' }),
      );
    }
    if ($('#wb-mobile-frequent-list', parentDoc).length) {
      $('#wb-mobile-frequent-list', parentDoc).html(
        renderFrequentEntries(entriesWithState, themeColors, { variant: 'mobile' }),
      );
    }
  }

  function getEntryDetailAnchorRect() {
    const $frequentPanel = $('#wb-frequent-entries-panel', parentDoc);
    if ($frequentPanel.length) return $frequentPanel[0].getBoundingClientRect();
    const $simpleMenu = $('#worldbook-switcher-simple-menu', parentDoc);
    if ($simpleMenu.length) return $simpleMenu[0].getBoundingClientRect();
    return null;
  }

  function getEntryDetailPanelLayout() {
    const anchorRect = getEntryDetailAnchorRect();
    const viewportWidth = parentDoc.defaultView?.innerWidth || window.innerWidth || 1280;
    const width = 340;
    const top = anchorRect?.top ?? 100;
    const height = Math.max(340, Math.round(anchorRect?.height ?? 400));
    const preferredLeft = (anchorRect?.right ?? 100) + 10;
    const maxLeft = Math.max(8, viewportWidth - width - 8);
    return { top, left: Math.min(preferredLeft, maxLeft), width, height };
  }

  function repositionEntryDetailPanel() {
    const $panel = $('#wb-entry-detail-panel', parentDoc);
    if (!$panel.length) return;
    const layout = getEntryDetailPanelLayout();
    $panel.css({
      top: `${layout.top}px`,
      left: `${layout.left}px`,
      width: `${layout.width}px`,
      height: `${layout.height}px`,
      maxHeight: `${layout.height}px`,
    });
  }

  async function getEntryDetailPayload(worldbookName, uid) {
    const targetUid = parseInt(uid, 10);
    const entries =
      worldbookName === currentState.selectedWorldbook && currentState.entries.length
        ? currentState.entries
        : await getWorldbookEntries(worldbookName);
    const entry = entries.find(item => item.uid === targetUid);
    if (!entry) {
      console.error('[WorldbookSwitcher] 未找到条目详情:', worldbookName, targetUid);
      return null;
    }
    return { entry, targetUid };
  }

  async function refreshOpenEntryDetailContexts(worldbookName, targetUid) {
    const $panel = $('#wb-entry-detail-panel', parentDoc);
    if (
      $panel.length &&
      String($panel.data('worldbook') || '') === worldbookName &&
      parseInt($panel.data('uid'), 10) === targetUid
    ) {
      await openEntryDetailModal(worldbookName, targetUid);
    }

    if (
      currentState.mobileDetailContext &&
      currentState.mobileDetailContext.worldbookName === worldbookName &&
      currentState.mobileDetailContext.uid === targetUid &&
      $('#wb-mobile-detail-view', parentDoc).length
    ) {
      await openMobileEntryDetailView(worldbookName, targetUid);
    }
  }

  function resolveFullscreenEditorContainer(containerOrSelector) {
    if (containerOrSelector?.jquery) return containerOrSelector.first();
    if (typeof containerOrSelector === 'string' && containerOrSelector) {
      return $(containerOrSelector, parentDoc).first();
    }
    return $();
  }

  function getFullscreenEditorTextarea(containerOrSelector) {
    return resolveFullscreenEditorContainer(containerOrSelector).find('.wb-entry-editor-textarea').get(0) || null;
  }

  function setFullscreenEditorFeedback(containerOrSelector, message, isError = false) {
    const $container = resolveFullscreenEditorContainer(containerOrSelector);
    if (!$container.length) return;
    const $feedback = $container.find('.wb-entry-editor-feedback');
    if (!$feedback.length) return;
    if (!message) {
      $feedback.text('').hide();
      return;
    }
    $feedback
      .text(message)
      .css('color', isError ? '#FCA5A5' : 'var(--wb-editor-em, #9ac7ff)')
      .show();
  }

  function updateFullscreenEditorDirtyState(containerOrSelector) {
    const $container = resolveFullscreenEditorContainer(containerOrSelector);
    if (!$container.length) return false;
    const textarea = getFullscreenEditorTextarea($container);
    if (!textarea) return false;
    const initialContent = String($container.data('initialContent') ?? '');
    const isDirty = textarea.value !== initialContent;
    $container.data('dirty', isDirty);
    $container.find('.wb-entry-editor-save').prop('disabled', !isDirty);
    return isDirty;
  }

  function applyFullscreenEditorValue(containerOrSelector, nextValue, selectionStart, selectionEnd) {
    const textarea = getFullscreenEditorTextarea(containerOrSelector);
    if (!textarea) return false;
    textarea.value = nextValue;
    textarea.focus();
    if (Number.isInteger(selectionStart) && Number.isInteger(selectionEnd)) {
      textarea.setSelectionRange(selectionStart, selectionEnd);
    }
    const EventCtor = parentDoc.defaultView?.Event || Event;
    textarea.dispatchEvent(new EventCtor('input', { bubbles: true }));
    return true;
  }

  function replaceFullscreenEditorRange(containerOrSelector, start, end, replacement, selectionStart, selectionEnd) {
    const textarea = getFullscreenEditorTextarea(containerOrSelector);
    if (!textarea) return false;
    const value = textarea.value;
    const nextValue = value.slice(0, start) + replacement + value.slice(end);
    return applyFullscreenEditorValue(containerOrSelector, nextValue, selectionStart, selectionEnd);
  }

  function wrapFullscreenEditorSelection(containerOrSelector, prefix, suffix, placeholder = '') {
    const textarea = getFullscreenEditorTextarea(containerOrSelector);
    if (!textarea) return false;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    const content = selected || placeholder;
    const replacement = `${prefix}${content}${suffix}`;
    const nextStart = start + prefix.length;
    const nextEnd = nextStart + content.length;
    return replaceFullscreenEditorRange(containerOrSelector, start, end, replacement, nextStart, nextEnd);
  }

  function prefixFullscreenEditorLines(containerOrSelector, transformer) {
    const textarea = getFullscreenEditorTextarea(containerOrSelector);
    if (!textarea) return false;
    const value = textarea.value;
    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;
    if (start === end) {
      start = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      end = value.indexOf('\n', end);
      if (end === -1) end = value.length;
    }
    const segment = value.slice(start, end);
    const replacement = segment
      .split('\n')
      .map((line, index) => transformer(line, index))
      .join('\n');
    return replaceFullscreenEditorRange(containerOrSelector, start, end, replacement, start, start + replacement.length);
  }

  function insertFullscreenTagTemplate(containerOrSelector, { multiline = false } = {}) {
    const textarea = getFullscreenEditorTextarea(containerOrSelector);
    if (!textarea) return false;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    const replacement = multiline
      ? `<tag>${selected ? `\n${selected}\n` : '\n\n'}</tag>`
      : `<tag>${selected || ''}</tag>`;
    const tagStart = start + 1;
    const tagEnd = tagStart + 3;
    return replaceFullscreenEditorRange(containerOrSelector, start, end, replacement, tagStart, tagEnd);
  }

  function runEditorExecCommand(textarea, command) {
    if (!textarea) return false;
    textarea.focus();
    try {
      return Boolean(parentDoc.execCommand && parentDoc.execCommand(command));
    } catch {
      return false;
    }
  }

  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function isValidAngleTagName(text) {
    return /^[A-Za-z][\w:-]*$/.test(String(text || '').trim());
  }

  function maskProtectedMarkdown(text) {
    return String(text || '')
      .replace(/```[\s\S]*?```/g, match => ' '.repeat(match.length))
      .replace(/`[^`\n]*`/g, match => ' '.repeat(match.length));
  }

  function getAngleTagTokens(text, { skipProtected = false } = {}) {
    const source = skipProtected ? maskProtectedMarkdown(text) : text;
    const regex = /<\/?([A-Za-z][\w:-]*)(?:\s[^<>]*?)?\s*\/?>/g;
    const tokens = [];
    let match = null;
    while ((match = regex.exec(source))) {
      const full = String(text).slice(match.index, regex.lastIndex);
      tokens.push({
        full,
        name: match[1],
        start: match.index,
        end: regex.lastIndex,
        isClosing: full.startsWith('</'),
        isSelfClosing: /\/\s*>$/.test(full),
      });
    }
    return tokens;
  }

  function autoCloseAngleTags(text) {
    const tokens = getAngleTagTokens(text, { skipProtected: true });
    const parts = [];
    const stack = [];
    let cursor = 0;
    let inserted = 0;

    for (const token of tokens) {
      parts.push(text.slice(cursor, token.start));
      cursor = token.end;

      if (token.isSelfClosing) {
        parts.push(token.full);
        continue;
      }
      if (!token.isClosing) {
        parts.push(token.full);
        stack.push(token.name);
        continue;
      }
      if (!stack.length) {
        parts.push(token.full);
        continue;
      }
      if (stack[stack.length - 1] === token.name) {
        parts.push(token.full);
        stack.pop();
        continue;
      }
      const matchIndex = stack.lastIndexOf(token.name);
      if (matchIndex === -1) {
        parts.push(token.full);
        continue;
      }
      while (stack.length - 1 > matchIndex) {
        parts.push(`</${stack.pop()}>`);
        inserted += 1;
      }
      parts.push(token.full);
      stack.pop();
    }

    parts.push(text.slice(cursor));
    while (stack.length) {
      parts.push(`</${stack.pop()}>`);
      inserted += 1;
    }
    return { text: parts.join(''), inserted };
  }

  function extractPairedAngleTagNames(text) {
    const stack = [];
    const found = new Set();
    for (const token of getAngleTagTokens(text, { skipProtected: true })) {
      if (token.isSelfClosing) continue;
      if (!token.isClosing) {
        stack.push(token.name);
        continue;
      }
      const matchIndex = stack.lastIndexOf(token.name);
      if (matchIndex === -1) continue;
      found.add(token.name);
      stack.length = matchIndex;
    }
    return Array.from(found);
  }

  function renamePairedAngleTags(text, oldTagName, newTagName) {
    if (!isValidAngleTagName(oldTagName) || !isValidAngleTagName(newTagName) || oldTagName === newTagName) {
      return { text, changed: false };
    }
    const tokens = getAngleTagTokens(text, { skipProtected: true });
    const openStartRegex = new RegExp(`^<\\s*${escapeRegExp(oldTagName)}(?=(\\s|>))`);
    let changed = false;
    const parts = [];
    let cursor = 0;

    for (const token of tokens) {
      parts.push(text.slice(cursor, token.start));
      cursor = token.end;

      if (token.name !== oldTagName || token.isSelfClosing) {
        parts.push(token.full);
        continue;
      }

      if (token.isClosing) {
        changed = true;
        parts.push(`</${newTagName}>`);
        continue;
      }

      if (openStartRegex.test(token.full)) {
        changed = true;
        parts.push(token.full.replace(openStartRegex, `<${newTagName}`));
      } else {
        parts.push(token.full);
      }
    }

    parts.push(text.slice(cursor));
    return { text: parts.join(''), changed };
  }

  function renderFullscreenToolbarButton(action, label, icon = '') {
    return `
      <button type="button" class="wb-entry-editor-tool-btn" data-action="${action}" title="${escapeAttr(label)}">
        ${icon ? `<i class="${icon}"></i>` : `<span>${escapeHtml(label)}</span>`}
      </button>
    `;
  }

  function renderFullscreenEditorView(entry, worldbookName, themeColors, sourceMode = 'desktop') {
    const entryTitle = getEntryDisplayName(entry, 60);
    const shellStyle = sourceMode === 'mobile'
      ? `width: 100vw; height: 100dvh; min-height: 100dvh; display: flex; flex-direction: column; background: ${themeColors.background};`
      : 'width: 100%; height: 100%; min-height: 100dvh; display: flex; flex-direction: column; background: var(--wb-editor-bg);';
    return `
      <style>
        #wb-entry-fullscreen-editor {
          --wb-editor-bg: var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.96));
          --wb-editor-text: var(--SmartThemeBodyColor, #f5f7fa);
          --wb-editor-em: var(--SmartThemeEmColor, #9ac7ff);
          --wb-editor-border: var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
          --wb-editor-input-bg: ${themeColors.inputBg};
          --wb-editor-input-text: ${themeColors.inputText};
          --wb-editor-muted: ${themeColors.secondaryText};
          position: fixed; inset: 0; z-index: 10030; background: rgba(9, 11, 16, 0.72); backdrop-filter: blur(6px); color: var(--wb-editor-text);
        }
        #wb-entry-fullscreen-editor .wb-entry-editor-shell { width: 100%; height: 100%; min-height: 100dvh; display: flex; flex-direction: column; background: var(--wb-editor-bg); }
        #wb-entry-fullscreen-editor .wb-entry-editor-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px 12px; border-bottom: 1px solid var(--wb-editor-border); }
        #wb-entry-fullscreen-editor .wb-entry-editor-meta { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 4px; }
        #wb-entry-fullscreen-editor .wb-entry-editor-title { font-size: 1.05em; font-weight: 700; color: var(--wb-editor-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        #wb-entry-fullscreen-editor .wb-entry-editor-subtitle { font-size: 0.82em; color: var(--wb-editor-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        #wb-entry-fullscreen-editor .wb-entry-editor-actions { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; }
        #wb-entry-fullscreen-editor .wb-entry-editor-action-btn,
        #wb-entry-fullscreen-editor .wb-entry-editor-dialog-btn { height: 38px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--wb-editor-border); background: transparent; color: var(--wb-editor-text); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
        #wb-entry-fullscreen-editor .wb-entry-editor-action-btn--primary,
        #wb-entry-fullscreen-editor .wb-entry-editor-dialog-btn--primary { background: rgba(59, 130, 246, 0.28); border-color: rgba(96, 165, 250, 0.7); color: #f8fbff; }
        #wb-entry-fullscreen-editor .wb-entry-editor-action-btn:disabled { opacity: 0.45; cursor: default; }
        #wb-entry-fullscreen-editor .wb-entry-editor-action-btn:focus-visible,
        #wb-entry-fullscreen-editor .wb-entry-editor-tool-btn:focus-visible,
        #wb-entry-fullscreen-editor .wb-entry-editor-dialog-btn:focus-visible,
        #wb-entry-fullscreen-editor .wb-entry-editor-dialog-input:focus,
        #wb-entry-fullscreen-editor .wb-entry-editor-dialog-select:focus,
        #wb-entry-fullscreen-editor .wb-entry-editor-textarea:focus { outline: none; border-color: var(--wb-editor-em); box-shadow: 0 0 0 3px rgba(154, 199, 255, 0.22); }
        #wb-entry-fullscreen-editor .wb-entry-editor-toolbar { display: flex; flex-wrap: wrap; gap: 10px; padding: 12px 18px; border-bottom: 1px solid var(--wb-editor-border); }
        #wb-entry-fullscreen-editor .wb-entry-editor-toolbar-group { display: inline-flex; flex-wrap: wrap; gap: 6px; padding: 6px; border-radius: 12px; border: 1px solid var(--wb-editor-border); background: rgba(15, 23, 42, 0.22); }
        #wb-entry-fullscreen-editor .wb-entry-editor-tool-btn { min-width: 34px; height: 34px; padding: 0 10px; border-radius: 9px; border: 1px solid transparent; background: transparent; color: var(--wb-editor-text); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.88em; }
        #wb-entry-fullscreen-editor .wb-entry-editor-tool-btn:hover,
        #wb-entry-fullscreen-editor .wb-entry-editor-action-btn:hover,
        #wb-entry-fullscreen-editor .wb-entry-editor-dialog-btn:hover { background: rgba(255, 255, 255, 0.08); }
        #wb-entry-fullscreen-editor .wb-entry-editor-body { flex: 1 1 auto; min-height: 0; padding: 16px 18px 12px; display: flex; }
        #wb-entry-fullscreen-editor .wb-entry-editor-textarea { width: 100%; height: 100%; min-height: 0; resize: none; box-sizing: border-box; padding: 16px 18px; border-radius: 14px; border: 1px solid var(--wb-editor-border); background: var(--wb-editor-input-bg); color: var(--wb-editor-input-text); font-size: 1em; line-height: 1.65; }
        #wb-entry-fullscreen-editor .wb-entry-editor-textarea::placeholder,
        #wb-entry-fullscreen-editor .wb-entry-editor-dialog-input::placeholder { color: rgba(245, 247, 250, 0.66); }
        #wb-entry-fullscreen-editor .wb-entry-editor-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 18px 14px; }
        #wb-entry-fullscreen-editor .wb-entry-editor-feedback { min-height: 20px; font-size: 0.84em; color: var(--wb-editor-em); display: none; }
        #wb-entry-fullscreen-editor .wb-entry-editor-dialog-backdrop { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(6, 8, 12, 0.52); padding: 20px; }
        #wb-entry-fullscreen-editor .wb-entry-editor-dialog { width: min(420px, 100%); display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 14px; border: 1px solid var(--wb-editor-border); background: var(--wb-editor-bg); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35); }
        #wb-entry-fullscreen-editor .wb-entry-editor-dialog-title { font-size: 0.96em; font-weight: 700; color: var(--wb-editor-text); }
        #wb-entry-fullscreen-editor .wb-entry-editor-dialog-select,
        #wb-entry-fullscreen-editor .wb-entry-editor-dialog-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--wb-editor-border); background: var(--wb-editor-input-bg); color: var(--wb-editor-input-text); }
        #wb-entry-fullscreen-editor .wb-entry-editor-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
        #wb-entry-fullscreen-editor[data-mode="mobile"] {
          background: ${themeColors.background};
          backdrop-filter: none;
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-shell {
          min-height: 100dvh;
          background: ${themeColors.background};
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-header {
          position: sticky;
          top: 0;
          z-index: 2;
          gap: 10px;
          padding: calc(10px + env(safe-area-inset-top, 0px)) 12px 10px;
          background: var(--wb-editor-bg);
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-subtitle {
          display: none;
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-actions {
          gap: 6px;
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-action-btn {
          width: 38px;
          min-width: 38px;
          padding: 0;
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-action-btn span {
          display: none;
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-toolbar {
          position: sticky;
          top: calc(58px + env(safe-area-inset-top, 0px));
          z-index: 2;
          flex-wrap: nowrap;
          overflow-x: auto;
          overflow-y: hidden;
          gap: 8px;
          padding: 10px 12px;
          background: var(--wb-editor-bg);
          -webkit-overflow-scrolling: touch;
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-toolbar-group {
          flex-wrap: nowrap;
          flex: 0 0 auto;
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-tool-btn {
          min-width: 34px;
          height: 34px;
          padding: 0 9px;
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-body {
          padding: 10px 12px 8px;
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-textarea {
          padding: 14px;
          border-radius: 12px;
          font-size: 0.96em;
          line-height: 1.55;
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-footer {
          padding: 0 12px calc(12px + env(safe-area-inset-bottom, 0px));
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-dialog-backdrop {
          padding: 12px;
        }
        #wb-entry-fullscreen-editor[data-mode="mobile"] .wb-entry-editor-dialog {
          width: 100%;
          max-width: none;
        }
      </style>
      <div class="wb-entry-editor-shell" style="${shellStyle}">
        <div class="wb-entry-editor-header">
          <div class="wb-entry-editor-meta"><div class="wb-entry-editor-title">${escapeHtml(entryTitle)}</div><div class="wb-entry-editor-subtitle">${escapeHtml(worldbookName)}</div></div>
          <div class="wb-entry-editor-actions">
            <button type="button" class="wb-entry-editor-action-btn wb-entry-editor-save wb-entry-editor-action-btn--primary" disabled><i class="fa-solid fa-floppy-disk"></i><span>保存</span></button>
            <button type="button" class="wb-entry-editor-action-btn wb-entry-editor-close"><i class="fa-solid fa-times"></i><span>关闭</span></button>
          </div>
        </div>
        <div class="wb-entry-editor-toolbar">
          <div class="wb-entry-editor-toolbar-group">
            ${renderFullscreenToolbarButton('undo', '撤销', 'fa-solid fa-rotate-left')}
            ${renderFullscreenToolbarButton('redo', '重做', 'fa-solid fa-rotate-right')}
            ${renderFullscreenToolbarButton('copy', '复制', 'fa-solid fa-copy')}
            ${renderFullscreenToolbarButton('cut', '剪切', 'fa-solid fa-scissors')}
            ${renderFullscreenToolbarButton('select-all', '全选', 'fa-solid fa-i-cursor')}
            ${renderFullscreenToolbarButton('find', '查找', 'fa-solid fa-magnifying-glass')}
            ${renderFullscreenToolbarButton('remove-blank-lines', '去空行', 'fa-solid fa-filter-circle-xmark')}
          </div>
          <div class="wb-entry-editor-toolbar-group">
            ${renderFullscreenToolbarButton('heading', '标题', 'fa-solid fa-heading')}
            ${renderFullscreenToolbarButton('bold', '加粗', 'fa-solid fa-bold')}
            ${renderFullscreenToolbarButton('italic', '斜体', 'fa-solid fa-italic')}
            ${renderFullscreenToolbarButton('unordered-list', '无序列表', 'fa-solid fa-list-ul')}
            ${renderFullscreenToolbarButton('ordered-list', '有序列表', 'fa-solid fa-list-ol')}
            ${renderFullscreenToolbarButton('quote', '引用', 'fa-solid fa-quote-left')}
            ${renderFullscreenToolbarButton('inline-code', '行内代码', 'fa-solid fa-code')}
            ${renderFullscreenToolbarButton('code-block', '代码块', 'fa-solid fa-file-code')}
            ${renderFullscreenToolbarButton('horizontal-rule', '分隔线', 'fa-solid fa-minus')}
            ${renderFullscreenToolbarButton('link', '链接', 'fa-solid fa-link')}
          </div>
          <div class="wb-entry-editor-toolbar-group">
            ${renderFullscreenToolbarButton('tag-inline', '<>')}
            ${renderFullscreenToolbarButton('tag-block', '</>')}
            ${renderFullscreenToolbarButton('auto-close-tags', '自动闭合', 'fa-solid fa-wand-magic-sparkles')}
            ${renderFullscreenToolbarButton('rename-tags', '标签改名', 'fa-solid fa-i-cursor')}
          </div>
        </div>
        <div class="wb-entry-editor-body"><textarea class="wb-entry-editor-textarea" spellcheck="false">${escapeHtml(entry.content || '')}</textarea></div>
        <div class="wb-entry-editor-footer"><div class="wb-entry-editor-feedback"></div></div>
        <div class="wb-entry-editor-dialog-backdrop">
          <div class="wb-entry-editor-dialog">
            <div class="wb-entry-editor-dialog-title">标签改名</div>
            <select class="wb-entry-editor-dialog-select"></select>
            <input class="wb-entry-editor-dialog-input" type="text" placeholder="输入新的标签名">
            <div class="wb-entry-editor-dialog-actions">
              <button type="button" class="wb-entry-editor-dialog-btn wb-entry-editor-dialog-cancel">取消</button>
              <button type="button" class="wb-entry-editor-dialog-btn wb-entry-editor-dialog-btn--primary wb-entry-editor-dialog-confirm">应用</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function showTagRenameDialog(containerOrSelector, tagNames) {
    const $container = resolveFullscreenEditorContainer(containerOrSelector);
    if (!$container.length) return;
    const optionsHtml = tagNames
      .map(name => `<option value="${escapeAttr(name)}">&lt;${escapeHtml(name)}&gt;&lt;/${escapeHtml(name)}&gt;</option>`)
      .join('');
    $container.find('.wb-entry-editor-dialog-select').html(optionsHtml);
    $container.find('.wb-entry-editor-dialog-input').val('');
    $container.find('.wb-entry-editor-dialog-backdrop').css('display', 'flex');
    window.setTimeout(() => $container.find('.wb-entry-editor-dialog-input').trigger('focus'), 0);
  }

  function hideTagRenameDialog(containerOrSelector) {
    resolveFullscreenEditorContainer(containerOrSelector).find('.wb-entry-editor-dialog-backdrop').hide();
  }

  function closeFullscreenEntryEditor({ force = false } = {}) {
    const $editor = $('#wb-entry-fullscreen-editor', parentDoc);
    if (!$editor.length) return true;
    const isDirty = Boolean($editor.data('dirty'));
    const view = parentDoc.defaultView || window;
    if (!force && isDirty && !view.confirm('正文内容尚未保存，确定关闭吗？')) {
      return false;
    }
    const fullscreenContext = currentState.fullscreenEditorContext;
    if (fullscreenContext?.sourceMode === 'mobile') {
      $('#worldbook-switcher-mobile-menu', parentDoc).remove();
      $(parentDoc).off('.wbmobilemenu');
    }
    $editor.remove();
    currentState.fullscreenEditorContext = null;
    if (fullscreenContext?.sourceMode === 'mobile') {
      void (async () => {
        await showMobileMenu(fullscreenContext.restoreTab ?? 1);
        await openMobileEntryDetailView(fullscreenContext.worldbookName, fullscreenContext.uid);
      })();
    }
    return true;
  }

  async function openFullscreenEntryEditor(worldbookName, uid, sourceMode = 'desktop') {
    const targetUid = parseInt(uid, 10);
    const effectiveSourceMode =
      sourceMode === 'mobile' ||
      Boolean(currentState.mobileDetailContext) ||
      $('#wb-mobile-detail-view', parentDoc).is(':visible') ||
      $('#worldbook-switcher-mobile-menu', parentDoc).length
        ? 'mobile'
        : 'desktop';
    console.log('[WorldbookSwitcher][FS_ENTER]', {
      worldbookName,
      uid: targetUid,
      sourceMode,
      effectiveSourceMode,
      mobileDetailContext: currentState.mobileDetailContext,
      mobileDetailVisible: $('#wb-mobile-detail-view', parentDoc).is(':visible'),
      mobileMenuCount: $('#worldbook-switcher-mobile-menu', parentDoc).length,
    });
    const $existing = $('#wb-entry-fullscreen-editor', parentDoc);
    if ($existing.length) {
      const sameEntry =
        String($existing.data('worldbook') || '') === worldbookName &&
        parseInt($existing.data('uid'), 10) === targetUid;
      if (sameEntry) {
        getFullscreenEditorTextarea($existing)?.focus();
        return;
      }
      if (!closeFullscreenEntryEditor()) return;
    }

    const payload = await getEntryDetailPayload(worldbookName, targetUid);
    if (!payload) return;
    const themeColors = getThemeColors();
    const outerStyle = effectiveSourceMode === 'mobile'
      ? `position: relative; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; background: ${themeColors.background}; color: ${themeColors.text}; overflow: hidden;`
      : 'position: fixed; inset: 0; z-index: 10030; background: rgba(9, 11, 16, 0.72); backdrop-filter: blur(6px); color: var(--wb-editor-text);';
    const editorHtml = `
      <div id="wb-entry-fullscreen-editor" ${buildDataAttrs({ worldbook: worldbookName, uid: targetUid, mode: effectiveSourceMode })} style="${outerStyle}">
        ${renderFullscreenEditorView(payload.entry, worldbookName, themeColors, effectiveSourceMode)}
      </div>
    `;

    let $editor;
    if (effectiveSourceMode === 'mobile') {
      const $mobileMenu = $('#worldbook-switcher-mobile-menu', parentDoc);
      console.log('[WorldbookSwitcher][FS_MOBILE_BRANCH]', {
        hasMobileMenu: $mobileMenu.length > 0,
      });
      const mobileHostStyle = `
        position: fixed;
        inset: 0;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100vw;
        height: 100dvh;
        max-width: none;
        max-height: none;
        z-index: 2147483647;
        margin: 0;
        padding: 0;
        border: none;
        border-radius: 0;
        box-shadow: none;
        background: ${themeColors.background};
        display: flex;
        flex-direction: column;
        color: ${themeColors.text};
        overflow: hidden;
      `.replace(/\s+/g, ' ').trim();
      if ($mobileMenu.length) {
        $mobileMenu.attr('style', mobileHostStyle).html(editorHtml);
      } else {
        $('body', parentDoc).append(`
          <div id="worldbook-switcher-mobile-menu" style="${mobileHostStyle}">
            ${editorHtml}
          </div>
        `);
      }
      $editor = $('#wb-entry-fullscreen-editor', parentDoc);
    } else {
      $('body', parentDoc).append(editorHtml);
      $editor = $('#wb-entry-fullscreen-editor', parentDoc);
    }
    console.log('[WorldbookSwitcher][FS_CREATED]', {
      editorCount: $('#wb-entry-fullscreen-editor', parentDoc).length,
      effectiveSourceMode,
    });
    $editor.data('initialContent', String(payload.entry.content || ''));
    $editor.data('dirty', false);
    currentState.fullscreenEditorContext = {
      worldbookName,
      uid: targetUid,
      initialContent: String(payload.entry.content || ''),
      sourceMode: effectiveSourceMode,
      restoreTab: effectiveSourceMode === 'mobile'
        ? (currentState.mobileDetailContext?.tab ?? currentState.mobileActiveTab ?? 1)
        : null,
    };
    bindFullscreenEntryEditor($editor, { worldbookName, targetUid, onClose: closeFullscreenEntryEditor });
    getFullscreenEditorTextarea($editor)?.focus();
  }

  async function handleFullscreenEditorToolbarAction($container, action) {
    const textarea = getFullscreenEditorTextarea($container);
    if (!textarea) return;

    if (action === 'undo' || action === 'redo') {
      if (!runEditorExecCommand(textarea, action)) {
        setFullscreenEditorFeedback($container, `${action === 'undo' ? '撤销' : '重做'}当前不可用`, true);
      }
      return;
    }

    if (action === 'copy' || action === 'cut') {
      const commandWorked = runEditorExecCommand(textarea, action);
      if (commandWorked) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = textarea.value.slice(start, end);
      if (!selectedText) {
        setFullscreenEditorFeedback($container, `请先选择要${action === 'copy' ? '复制' : '剪切'}的内容`, true);
        return;
      }
      try {
        await (navigator.clipboard?.writeText?.(selectedText) ?? Promise.reject(new Error('clipboard unavailable')));
        if (action === 'cut') {
          replaceFullscreenEditorRange($container, start, end, '', start, start);
        }
        setFullscreenEditorFeedback($container, `已${action === 'copy' ? '复制' : '剪切'}选中文本`);
      } catch {
        setFullscreenEditorFeedback($container, `${action === 'copy' ? '复制' : '剪切'}失败，请检查浏览器权限`, true);
      }
      return;
    }

    if (action === 'select-all') {
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
      return;
    }

    if (action === 'find') {
      const view = parentDoc.defaultView || window;
      const keyword = view.prompt('查找内容', textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) || '');
      if (!keyword) return;
      let matchIndex = textarea.value.indexOf(keyword, textarea.selectionEnd);
      if (matchIndex === -1) matchIndex = textarea.value.indexOf(keyword);
      if (matchIndex === -1) {
        setFullscreenEditorFeedback($container, '未找到匹配内容', true);
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(matchIndex, matchIndex + keyword.length);
      return;
    }

    if (action === 'remove-blank-lines') {
      applyFullscreenEditorValue(
        $container,
        textarea.value.split(/\r?\n/).filter(line => line.trim() !== '').join('\n'),
        0,
        0,
      );
      setFullscreenEditorFeedback($container, '已移除空行');
      return;
    }

    const lineActions = {
      heading: line => `# ${String(line).replace(/^#+\s*/, '')}`,
      'unordered-list': line => (line.trim() ? `- ${line.replace(/^[-*+]\s+/, '')}` : '- '),
      'ordered-list': (line, index) => `${index + 1}. ${line.replace(/^\d+\.\s+/, '')}`,
      quote: line => `> ${line.replace(/^>\s?/, '')}`,
    };
    if (lineActions[action]) {
      prefixFullscreenEditorLines($container, lineActions[action]);
      return;
    }

    const wrapActions = {
      bold: ['**', '**', '文本'],
      italic: ['*', '*', '文本'],
      'inline-code': ['`', '`', 'code'],
    };
    if (wrapActions[action]) {
      wrapFullscreenEditorSelection($container, ...wrapActions[action]);
      return;
    }

    if (action === 'code-block') {
      const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
      const replacement = `\`\`\`\n${selected || ''}\n\`\`\``;
      const start = textarea.selectionStart;
      replaceFullscreenEditorRange($container, start, textarea.selectionEnd, replacement, start + 4, start + 4 + selected.length);
      return;
    }

    if (action === 'horizontal-rule') {
      const start = textarea.selectionStart;
      replaceFullscreenEditorRange($container, start, textarea.selectionEnd, '\n---\n', start + 5, start + 5);
      return;
    }

    if (action === 'link') {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end) || '文本';
      const replacement = `[${selected}](url)`;
      const urlStart = start + replacement.length - 4;
      replaceFullscreenEditorRange($container, start, end, replacement, urlStart, urlStart + 3);
      return;
    }

    if (action === 'tag-inline' || action === 'tag-block') {
      insertFullscreenTagTemplate($container, { multiline: action === 'tag-block' });
      return;
    }

    if (action === 'auto-close-tags') {
      const { text, inserted } = autoCloseAngleTags(textarea.value);
      if (!inserted || text === textarea.value) {
        setFullscreenEditorFeedback($container, '未发现可补全标签');
        return;
      }
      applyFullscreenEditorValue($container, text, textarea.selectionStart, textarea.selectionEnd);
      setFullscreenEditorFeedback($container, `已补全 ${inserted} 处标签`);
      return;
    }

    if (action === 'rename-tags') {
      const tagNames = extractPairedAngleTagNames(textarea.value);
      if (!tagNames.length) {
        setFullscreenEditorFeedback($container, '未找到可改名标签', true);
        return;
      }
      showTagRenameDialog($container, tagNames);
    }
  }

  function bindFullscreenEntryEditor($container, { worldbookName, targetUid, onClose }) {
    if (!$container.length) return;
    $container.off('.wbentryeditor');

    const saveContent = async () => {
      if ($container.data('saving')) return;
      const textarea = getFullscreenEditorTextarea($container);
      if (!textarea) return;
      const nextContent = textarea.value;
      const initialContent = String($container.data('initialContent') ?? '');
      if (nextContent === initialContent) {
        setFullscreenEditorFeedback($container, '当前没有需要保存的改动');
        return;
      }

      $container.data('saving', true);
      $container.find('.wb-entry-editor-save').prop('disabled', true);
      setFullscreenEditorFeedback($container, '保存中...');
      try {
        const latestEntries = await getWorldbookEntries(worldbookName);
        const targetEntry = latestEntries.find(item => item.uid === targetUid);
        if (!targetEntry) {
          setFullscreenEditorFeedback($container, '条目不存在或已被移除', true);
          return;
        }
        targetEntry.content = nextContent;
        const updated = await updateWorldbookEntries(worldbookName, latestEntries);
        if (!updated) {
          setFullscreenEditorFeedback($container, '保存失败，请稍后重试', true);
          return;
        }
        if (worldbookName === currentState.selectedWorldbook) {
          currentState.entries = latestEntries;
        }
        $container.data('initialContent', nextContent);
        if (currentState.fullscreenEditorContext) {
          currentState.fullscreenEditorContext.initialContent = nextContent;
        }
        updateFullscreenEditorDirtyState($container);
        await refreshCurrentWorldbookViews(worldbookName);
        await refreshFrequentEntryViews();
        await refreshOpenEntryDetailContexts(worldbookName, targetUid);
        setFullscreenEditorFeedback($container, '正文已保存');
      } catch (error) {
        console.error('[WorldbookSwitcher] 保存条目正文失败:', error);
        setFullscreenEditorFeedback($container, '保存失败，请检查控制台日志', true);
      } finally {
        $container.removeData('saving');
        updateFullscreenEditorDirtyState($container);
      }
    };

    $container.on('input.wbentryeditor', '.wb-entry-editor-textarea', function() {
      updateFullscreenEditorDirtyState($container);
      setFullscreenEditorFeedback($container, '');
    });
    $container.on('click.wbentryeditor', '.wb-entry-editor-close', function(e) { e.stopPropagation(); onClose?.(); });
    $container.on('click.wbentryeditor', '.wb-entry-editor-save', function(e) { e.stopPropagation(); void saveContent(); });
    $container.on('click.wbentryeditor', '.wb-entry-editor-tool-btn', function(e) {
      e.stopPropagation();
      void handleFullscreenEditorToolbarAction($container, String($(this).data('action') || ''));
    });
    $container.on('click.wbentryeditor', '.wb-entry-editor-dialog-cancel', function(e) { e.stopPropagation(); hideTagRenameDialog($container); });
    $container.on('click.wbentryeditor', '.wb-entry-editor-dialog-confirm', function(e) {
      e.stopPropagation();
      const oldTagName = String($container.find('.wb-entry-editor-dialog-select').val() || '').trim();
      const newTagName = String($container.find('.wb-entry-editor-dialog-input').val() || '').trim();
      if (!isValidAngleTagName(newTagName)) {
        setFullscreenEditorFeedback($container, '请输入有效的标签名', true);
        return;
      }
      const textarea = getFullscreenEditorTextarea($container);
      if (!textarea) return;
      const { text, changed } = renamePairedAngleTags(textarea.value, oldTagName, newTagName);
      if (!changed) {
        setFullscreenEditorFeedback($container, '未找到可改写的标签结构', true);
        return;
      }
      applyFullscreenEditorValue($container, text, textarea.selectionStart, textarea.selectionEnd);
      hideTagRenameDialog($container);
      setFullscreenEditorFeedback($container, `已将 <${oldTagName}></${oldTagName}> 改为 <${newTagName}></${newTagName}>`);
    });
    $container.on('keydown.wbentryeditor', '.wb-entry-editor-dialog-input', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        $container.find('.wb-entry-editor-dialog-confirm').trigger('click');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideTagRenameDialog($container);
      }
    });
    $container.on('click.wbentryeditor', '.wb-entry-editor-dialog-backdrop', function(e) {
      if (e.target === this) hideTagRenameDialog($container);
    });
    $container.on('keydown.wbentryeditor', function(e) {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 's') {
        e.preventDefault();
        void saveContent();
      } else if (e.key === 'Escape' && !$(e.target).closest('.wb-entry-editor-dialog').length) {
        e.preventDefault();
        onClose?.();
      }
    });
  }

  function renderEntryDetailView(entry, worldbookName, themeColors, { mode = 'desktop' } = {}) {
    const strategyType = entry.strategy?.type || 'constant';
    const positionType = entry.position?.type || 'before_character_definition';
    const depthValue = Number.isFinite(entry.position?.depth) ? entry.position.depth : 0;
    const containerSelector = mode === 'desktop' ? '#wb-entry-detail-panel' : '#wb-mobile-detail-view';
    const entryTitle = getEntryDisplayName(entry, 30);
    return `
      <style>
        ${containerSelector} {
          --wb-detail-text: var(--SmartThemeBodyColor, #f5f7fa);
          --wb-detail-em: var(--SmartThemeEmColor, #9ac7ff);
          --wb-detail-bg: var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92));
          --wb-detail-border: var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
          --wb-detail-input-bg: ${themeColors.inputBg};
          --wb-detail-input-text: ${themeColors.inputText};
          --wb-detail-muted: ${themeColors.secondaryText};
        }
        ${containerSelector} .wb-entry-detail-shell {
          height: 100%;
          display: flex;
          flex-direction: column;
          min-height: 0;
          background: ${mode === 'desktop' ? 'var(--wb-detail-bg)' : 'transparent'};
          color: var(--wb-detail-text);
          border: ${mode === 'desktop' ? '1px solid var(--wb-detail-border)' : 'none'};
          border-radius: ${mode === 'desktop' ? '10px' : '0'};
          box-shadow: ${mode === 'desktop' ? '0 8px 24px rgba(0, 0, 0, 0.35)' : 'none'};
          overflow: hidden;
        }
        ${containerSelector} .wb-entry-detail-body {
          flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px;
        }
        ${containerSelector} .wb-entry-detail-content {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        ${containerSelector} .wb-entry-detail-label {
          display: block; margin-bottom: 6px; color: var(--wb-detail-text); font-size: 0.84em; font-weight: 600;
        }
        ${containerSelector} .wb-entry-detail-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
        }
        ${containerSelector} .wb-entry-detail-heading .wb-entry-detail-label {
          margin-bottom: 0;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        ${containerSelector} .wb-entry-detail-heading-actions {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        ${containerSelector} .wb-entry-detail-title-action {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          border: 1px solid var(--wb-detail-border);
          background: transparent;
          color: var(--wb-detail-text);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        ${containerSelector} .wb-entry-detail-title-action:focus-visible {
          outline: none;
          border-color: var(--wb-detail-em);
          box-shadow: 0 0 0 3px rgba(154, 199, 255, 0.22);
        }
        ${containerSelector} .wb-entry-detail-input {
          width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--wb-detail-border);
          background: var(--wb-detail-input-bg); color: var(--wb-detail-input-text); font-size: 0.9em; outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        ${containerSelector} .wb-entry-detail-input::placeholder { color: rgba(245, 247, 250, 0.66); }
        ${containerSelector} .wb-entry-detail-input:focus { border-color: var(--wb-detail-em); box-shadow: 0 0 0 3px rgba(154, 199, 255, 0.22); }
        ${containerSelector} .wb-entry-detail-input--compact { height: 40px; padding: 8px 12px; }
        ${containerSelector} textarea.wb-entry-detail-input { flex: 1 1 auto; min-height: ${mode === 'desktop' ? '220px' : '160px'}; height: 100%; resize: none; line-height: 1.55; }
        ${containerSelector} .wb-entry-detail-toolbar { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; }
        ${containerSelector} .wb-entry-detail-field { min-width: 0; display: flex; align-items: center; gap: 8px; }
        ${containerSelector} .wb-entry-detail-inline-label { flex-shrink: 0; color: var(--wb-detail-text); font-size: 0.78em; font-weight: 600; white-space: nowrap; }
        ${containerSelector} .wb-entry-detail-field--depth { justify-content: flex-end; }
        ${containerSelector} .wb-entry-detail-field--depth .wb-entry-detail-input { width: 72px; text-align: center; }
        ${containerSelector} .wb-entry-detail-strategy-group {
          display: inline-flex; align-items: center; gap: 6px; padding: 4px; border-radius: 12px;
          border: 1px solid var(--wb-detail-border); background: rgba(15, 23, 42, 0.22);
        }
        ${containerSelector} .wb-entry-detail-strategy-btn {
          width: 32px; height: 32px; border-radius: 9px; border: 1px solid transparent; background: transparent;
          color: rgba(245, 247, 250, 0.72); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
        }
        ${containerSelector} .wb-entry-detail-strategy-btn[data-active='true'] {
          color: var(--wb-strategy-color); border-color: var(--wb-strategy-color); background: rgba(255, 255, 255, 0.08);
        }
        ${containerSelector} .wb-entry-detail-strategy-btn:focus-visible {
          outline: none; border-color: var(--wb-detail-em); box-shadow: 0 0 0 3px rgba(154, 199, 255, 0.22);
        }
        ${containerSelector} .wb-entry-detail-feedback { min-height: 18px; font-size: 0.82em; display: none; }
      </style>
      <div class="wb-entry-detail-shell">
        <div class="wb-entry-detail-body">
          <div class="wb-entry-detail-content">
            <div class="wb-entry-detail-heading">
              <label class="wb-entry-detail-label">${escapeHtml(entryTitle)}</label>
              <div class="wb-entry-detail-heading-actions">
                <button class="wb-entry-detail-title-action wb-entry-detail-expand" title="大窗口">
                  <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
                </button>
                <button class="wb-entry-detail-title-action wb-entry-detail-${mode === 'desktop' ? 'close' : 'back'}" title="${mode === 'desktop' ? '关闭' : '返回'}">
                  <i class="fa-solid fa-${mode === 'desktop' ? 'times' : 'arrow-left'}"></i>
                </button>
              </div>
            </div>
            <textarea class="wb-entry-detail-input" readonly spellcheck="false">${escapeHtml(entry.content || '')}</textarea>
          </div>
          <div class="wb-entry-detail-toolbar">
            <div class="wb-entry-detail-field">
              <input class="wb-entry-detail-strategy-input" type="hidden" value="${escapeAttr(strategyType)}">
              <div class="wb-entry-detail-strategy-group" role="group" aria-label="触发策略">${renderEntryStrategyButtons(strategyType)}</div>
            </div>
            <div class="wb-entry-detail-field">
              <select class="wb-entry-detail-input wb-entry-detail-input--compact wb-entry-detail-position-select" title="插入位置">
                ${ENTRY_POSITION_OPTIONS.map(option => `<option value="${option.value}" ${option.value === positionType ? 'selected' : ''}>${option.label}</option>`).join('')}
              </select>
            </div>
            <div class="wb-entry-detail-field wb-entry-detail-field--depth wb-entry-detail-depth-row" style="display: none;">
              <input class="wb-entry-detail-input wb-entry-detail-input--compact wb-entry-detail-depth-input" type="number" step="1" inputmode="numeric" title="深度" value="${escapeAttr(depthValue)}">
            </div>
          </div>
          <div class="wb-entry-detail-feedback"></div>
        </div>
      </div>
    `;
  }

  function bindEntryDetailEditor($container, { worldbookName, targetUid, mode = 'desktop', onClose }) {
    if (!$container.length) return;
    $container.off('.wbentrydetail');
    updateEntryDetailStrategyState($container);
    updateEntryDetailDepthState($container);

    const persistChanges = async () => {
      if ($container.data('wbEntryDetailSaving')) {
        $container.data('wbEntryDetailPending', true);
        return;
      }

      const nextStrategyType = String($container.find('.wb-entry-detail-strategy-input').val() || '');
      const nextPositionType = String($container.find('.wb-entry-detail-position-select').val() || '');
      const nextDepthRaw = String($container.find('.wb-entry-detail-depth-input').val() || '').trim();

      if (nextPositionType === 'at_depth') {
        const nextDepth = Number.parseInt(nextDepthRaw, 10);
        if (!Number.isInteger(nextDepth)) {
          setEntryDetailFeedback($container, '请输入有效的深度值。', true);
          return;
        }
      }

      $container.data('wbEntryDetailSaving', true);
      try {
        setEntryDetailFeedback($container, '保存中...');
        const latestEntries = await getWorldbookEntries(worldbookName);
        const targetEntry = latestEntries.find(item => item.uid === targetUid);
        if (!targetEntry) {
          setEntryDetailFeedback($container, '条目不存在或已被移除。', true);
          return;
        }

        targetEntry.strategy = { ...(targetEntry.strategy || {}), type: nextStrategyType };
        targetEntry.position = { ...(targetEntry.position || {}), type: nextPositionType };
        if (nextPositionType === 'at_depth') {
          targetEntry.position.depth = Number.parseInt(nextDepthRaw, 10);
        }

        const updated = await updateWorldbookEntries(worldbookName, latestEntries);
        if (!updated) {
          setEntryDetailFeedback($container, '保存失败，请稍后重试。', true);
          return;
        }

        if (worldbookName === currentState.selectedWorldbook) {
          currentState.entries = latestEntries;
        }
        await refreshCurrentWorldbookViews(worldbookName);
        await refreshFrequentEntryViews();
        setEntryDetailFeedback($container, mode === 'mobile' ? '已自动保存，返回列表后可继续切换其它条目。' : '已自动保存。');
      } catch (error) {
        console.error('[WorldbookSwitcher] 保存条目详情失败:', error);
        setEntryDetailFeedback($container, '保存失败，请检查控制台日志。', true);
      } finally {
        $container.removeData('wbEntryDetailSaving');
        const shouldPersistAgain = Boolean($container.data('wbEntryDetailPending'));
        $container.removeData('wbEntryDetailPending');
        if (shouldPersistAgain) {
          void persistChanges();
        }
      }
    };

    $container.on('click.wbentrydetail', '.wb-entry-detail-close, .wb-entry-detail-cancel, .wb-entry-detail-back', function(e) {
      e.stopPropagation();
      onClose?.();
    });
    $container.on('click.wbentrydetail touchend.wbentrydetail', '.wb-entry-detail-expand', function(e) {
      if (e.type === 'touchend') {
        e.preventDefault();
      }
      e.stopPropagation();
      console.log('[WorldbookSwitcher][EXPAND_CLICK]', {
        worldbookName,
        targetUid,
        mode,
        eventType: e.type,
      });
      void openFullscreenEntryEditor(worldbookName, targetUid, mode);
    });
    $container.on('click.wbentrydetail', '.wb-entry-detail-strategy-btn', function(e) {
      e.stopPropagation();
      updateEntryDetailStrategyState($container, $(this).attr('data-value'));
      void persistChanges();
    });
    $container.on('change.wbentrydetail', '.wb-entry-detail-position-select', function() {
      updateEntryDetailDepthState($container);
      void persistChanges();
    });
    $container.on('change.wbentrydetail', '.wb-entry-detail-depth-input', function() {
      void persistChanges();
    });
    $container.on('keydown.wbentrydetail', '.wb-entry-detail-depth-input', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        $(this).trigger('change');
        $(this).blur();
      }
    });
  }

  function closeMobileEntryDetailView() {
    const restoreTab = currentState.mobileDetailContext?.tab ?? currentState.mobileActiveTab ?? 1;
    currentState.mobileDetailContext = null;
    $('#wb-mobile-detail-view', parentDoc).hide().empty();
    $('#wb-mobile-panel-0, #wb-mobile-panel-1, #wb-mobile-panel-2', parentDoc).hide();
    $(`#wb-mobile-panel-${restoreTab}`, parentDoc).css('display', 'flex');
    currentState.mobileActiveTab = restoreTab;
  }

  async function openMobileEntryDetailView(worldbookName, uid) {
    const payload = await getEntryDetailPayload(worldbookName, uid);
    if (!payload) return;
    const { entry, targetUid } = payload;
    const $detailView = $('#wb-mobile-detail-view', parentDoc);
    if (!$detailView.length) return;

    currentState.mobileDetailContext = {
      tab: currentState.mobileActiveTab ?? 1,
      worldbookName,
      uid: targetUid,
    };

    const themeColors = getThemeColors();
    $('#wb-mobile-panel-0, #wb-mobile-panel-1, #wb-mobile-panel-2', parentDoc).hide();
    $detailView.html(renderEntryDetailView(entry, worldbookName, themeColors, { mode: 'mobile' })).css('display', 'flex');
    bindEntryDetailEditor($detailView, {
      worldbookName,
      targetUid,
      mode: 'mobile',
      onClose: closeMobileEntryDetailView,
    });
  }

  async function openEntryDetailModal(worldbookName, uid) {
    const payload = await getEntryDetailPayload(worldbookName, uid);
    if (!payload) return;
    const { entry, targetUid } = payload;
    const themeColors = getThemeColors();
    const layout = getEntryDetailPanelLayout();
    const panelHtml = `
      <div id="wb-entry-detail-panel" ${buildDataAttrs({ worldbook: worldbookName, uid: targetUid })} style="
        position: fixed;
        top: ${layout.top}px;
        left: ${layout.left}px;
        z-index: 10002;
        width: ${layout.width}px;
        height: ${layout.height}px;
        max-height: ${layout.height}px;
        color: ${themeColors.text};
        animation: slideInRight 0.2s ease-out;
      ">
        <style>
          @keyframes slideInRight {
            from { transform: translateX(20px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        </style>
        ${renderEntryDetailView(entry, worldbookName, themeColors, { mode: 'desktop' })}
      </div>
    `;

    const $existingPanel = $('#wb-entry-detail-panel', parentDoc);
    if ($existingPanel.length) {
      $existingPanel.replaceWith(panelHtml);
    } else {
      $('body', parentDoc).append(panelHtml);
    }

    const $panel = $('#wb-entry-detail-panel', parentDoc);
    bindEntryDetailEditor($panel, {
      worldbookName,
      targetUid,
      mode: 'desktop',
      onClose: closeEntryDetailPanel,
    });
    repositionEntryDetailPanel();
  }

  // =============================================================================
  // 主题颜色自适应工具函数
  // =============================================================================
  
  // 将颜色转换为不透明版本
  function makeColorOpaque(color) {
    if (!color) return null;
    
    // 解析 rgba/rgb 格式
    if (color.startsWith('rgba')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
      if (match) {
        return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
      }
    }
    return color; // 其他格式直接返回
  }
  
  function getThemeColors() {
    // 从父页面获取计算后的CSS变量值
    const computedStyle = parent.getComputedStyle(parentDoc.documentElement);
    
    // 获取主题相关颜色
    const chatTintColor = computedStyle.getPropertyValue('--SmartThemeChatTintColor').trim() || 
                          computedStyle.getPropertyValue('--SmartThemeBlurTintColor').trim();
    const bodyColor = computedStyle.getPropertyValue('--SmartThemeBodyColor').trim();
    const borderColor = computedStyle.getPropertyValue('--SmartThemeBorderColor').trim() || '#333';
    
    // 尝试解析背景色并计算亮度
    let bgColor = chatTintColor || 'rgba(26, 26, 46, 1)'; // 默认深色
    let textColor = bodyColor || '#fff';
    
    // 计算背景亮度来决定文字颜色
    const isLightTheme = isColorLight(bgColor);
    
    // 将背景色转换为不透明版本
    const opaqueBgColor = makeColorOpaque(bgColor) || (isLightTheme ? 'rgb(255, 255, 255)' : 'rgb(26, 26, 46)');
    
    return {
      background: opaqueBgColor,
      text: isLightTheme ? 'rgba(0, 0, 0, 0.89)' : 'rgba(255, 255, 255, 0.95)',
      secondaryText: isLightTheme ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.7)',
      border: borderColor,
      inputBg: isLightTheme ? 'rgb(245, 245, 245)' : 'rgb(42, 42, 62)',
      inputText: isLightTheme ? 'rgba(0, 0, 0, 0.89)' : 'rgba(255, 255, 255, 0.95)',
      hoverBg: isLightTheme ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.25)',
      isLight: isLightTheme
    };
  }

  function isColorLight(color) {
    // 解析颜色并计算亮度
    let r, g, b, a = 1;
    
    if (color.startsWith('rgba')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
        a = match[4] ? parseFloat(match[4]) : 1;
      }
    } else if (color.startsWith('rgb')) {
      const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      }
    } else if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
    }
    
    if (r === undefined) return false; // 默认深色主题
    
    // 考虑透明度 - 如果背景是半透明的白色，也应该被认为是浅色
    // 计算相对亮度 (YIQ公式)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // 如果亮度高于128，认为是浅色主题
    return brightness > 128;
  }

  // =============================================================================
  // 显示简易模式菜单（从原生图标下方弹出）
  // =============================================================================
  async function showSimpleMenu() {
    try {
      // 移动端使用滑动切换模式
      if (isMobileDevice()) {
        return showMobileMenu();
      }
      
      // 如果已存在，先移除所有面板并保存状态
      const $existingMenu = $('#worldbook-switcher-simple-menu', parentDoc);
      if ($existingMenu.length) {
        const wasVisible = $existingMenu.is(':visible');
        // 保存面板状态 - 保持当前状态用于记忆
        // (面板关闭时不重置状态，让用户下次打开时恢复)
        closeDesktopMenuPanels();
        $(parentDoc).off('.wbsimplemenu');
        if (wasVisible) {
          return;
        }
      }

      const config = getWorldbookSwitcherConfig();
      
      // 获取自适应主题颜色
      const themeColors = getThemeColors();

      // 获取原生世界信息图标的位置（在父页面中）
      const $wiIcon = $('#WIDrawerIcon', parentDoc);
      if (!$wiIcon.length) {
        console.error('[WorldbookSwitcher] 未找到原生世界信息图标');
        return;
      }

      const iconRect = $wiIcon[0].getBoundingClientRect();

    // 每次打开菜单都获取最新的世界书状态
    console.log('[WorldbookSwitcher] 正在获取最新世界书状态...');
    const allWorldbooks = await getAllWorldbooks();
    const globalWbs = await getGlobalWorldbooks();
    console.log('[WorldbookSwitcher] 所有世界书:', allWorldbooks);
    console.log('[WorldbookSwitcher] 已启用的世界书:', globalWbs);

    // 如果没有选中的世界书，或当前选中的不在已启用列表中，使用第一个全局世界书
    if (!currentState.selectedWorldbook || !globalWbs.includes(currentState.selectedWorldbook)) {
      currentState.selectedWorldbook = globalWbs[0] || '';
    }

    // 加载条目
    let entries = [];
    if (currentState.selectedWorldbook) {
      entries = await getWorldbookEntries(currentState.selectedWorldbook);
      currentState.entries = entries;
    }

    // 显示所有条目
    const displayEntries = entries;

    // 计算菜单位置（图标下方）
    const menuTop = iconRect.bottom + 8;
    const menuLeft = Math.max(10, iconRect.left - 100); // 向左偏移一些，确保不超出屏幕

    // 生成世界书选项HTML（只显示已启用的世界书）
    const worldbookOptionsHtml = globalWbs.map(wb => `
      <option value="${escapeHtml(wb)}" ${currentState.selectedWorldbook === wb ? 'selected' : ''}>
        ${escapeHtml(wb)}
      </option>
    `).join('');

    const menuHtml = `
      <div id="worldbook-switcher-simple-menu" style="
        position: fixed;
        top: ${menuTop}px;
        left: ${menuLeft}px;
        z-index: 10000;
        background: ${themeColors.background};
        border: 1px solid ${themeColors.border};
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,${themeColors.isLight ? '0.15' : '0.6'});
        min-width: 280px;
        max-width: 320px;
        height: min(520px, calc(100vh - 24px));
        min-height: min(520px, calc(100vh - 24px));
        max-height: min(520px, calc(100vh - 24px));
        display: flex;
        flex-direction: column;
        color: ${themeColors.text};
      ">
        <!-- 标题栏 -->
        <div style="
          padding: 10px 12px;
          border-bottom: 1px solid ${themeColors.border};
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          gap: 8px;
        ">
          <!-- 左侧：全部世界书按钮 -->
          <button id="wb-all-worldbooks-btn" title="全部世界书" style="
            background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 0.75em;
            display: flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
          ">
            <i class="fa-solid fa-book"></i>
          </button>
          <select id="wb-worldbook-selector" style="
            flex: 1;
            padding: 4px 8px;
            border: 1px solid ${themeColors.border};
            border-radius: 4px;
            background: ${themeColors.inputBg};
            color: ${themeColors.inputText};
            font-size: 0.8em;
            cursor: pointer;
            min-width: 0;
          ">
            ${globalWbs.length === 0 ? '<option value="">无已启用的世界书</option>' : worldbookOptionsHtml}
          </select>
          <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
            <!-- 常用条目历史按钮 -->
            <button id="wb-frequent-entries-btn" title="常用条目历史" style="
              background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
              color: white;
              border: none;
              border-radius: 4px;
              padding: 4px 8px;
              cursor: pointer;
              font-size: 0.75em;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <i class="fa-solid fa-star"></i>
            </button>
            <!-- 切换到完整模式按钮 -->
            <button id="wb-switch-to-full-btn" title="切换到完整模式（使用原生界面）" style="
              background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
              color: white;
              border: none;
              border-radius: 4px;
              padding: 4px 8px;
              cursor: pointer;
              font-size: 0.75em;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <i class="fa-solid fa-expand"></i> 完整
            </button>
            <button id="wb-simple-close-btn" title="关闭" style="
              background: none;
              border: none;
              color: ${themeColors.text};
              cursor: pointer;
              padding: 4px;
              font-size: 14px;
            ">
              <i class="fa-solid fa-times"></i>
            </button>
          </div>
        </div>

        <!-- 条目列表 -->
        <div id="wb-simple-entries" style="
          flex: 1;
          overflow-y: auto;
          padding: 6px;
        ">
          ${renderCurrentWorldbookEntries(displayEntries, themeColors, {
            variant: 'desktop',
            worldbookName: currentState.selectedWorldbook,
          })}
        </div>
        <!-- 搜索框 -->
        <div style="padding: 6px; border-top: 1px solid ${themeColors.border}; flex-shrink: 0;">
          <input type="text" id="wb-simple-search-entries" placeholder="搜索条目..." style="
            width: 100%; padding: 6px 10px; border: 1px solid ${themeColors.border}; border-radius: 4px;
            background: ${themeColors.inputBg}; color: ${themeColors.inputText}; font-size: 0.8em; box-sizing: border-box;
          ">
        </div>
      </div>
    `;

    $('body', parentDoc).append(menuHtml);

    // 绑定事件
    $('#wb-simple-close-btn', parentDoc).on('click', function(e) {
      e.stopPropagation();
      // 关闭所有面板（不重置状态，保持记忆功能）
      closeDesktopMenuPanels();
      $(parentDoc).off('.wbsimplemenu');
    });

    // 切换到完整模式按钮
    $('#wb-switch-to-full-btn', parentDoc).on('click', function(e) {
      e.stopPropagation();

      // 更新配置为完整模式
      const config = getWorldbookSwitcherConfig();
      config.simpleMode = false;
      saveWorldbookSwitcherConfig(config);

      // 更新拦截状态
      currentState.isIntercepting = false;

      // 关闭所有面板
      closeDesktopMenuPanels();
      $(parentDoc).off('.wbsimplemenu');

      // 触发原生图标点击，打开原生界面
      const $wiIcon = $('#WIDrawerIcon', parentDoc);
      if ($wiIcon.length) {
        $wiIcon[0].click();
      }

    });

    // 世界书选择器变化事件
    $('#wb-worldbook-selector', parentDoc).on('change', async function(e) {
      e.stopPropagation();
      const selectedWb = $(this).val();
      if (selectedWb && selectedWb !== currentState.selectedWorldbook) {
        currentState.selectedWorldbook = selectedWb;

        // 重新加载条目
        const entries = await getWorldbookEntries(selectedWb);
        currentState.entries = entries;

        // 获取自适应主题颜色
        const themeColors = getThemeColors();

        // 更新条目列表UI
        const $entriesContainer = $('#wb-simple-entries', parentDoc);
        if (entries.length === 0) {
          $entriesContainer.html(`<div style="text-align: center; padding: 20px; color: ${themeColors.secondaryText}; font-size: 0.85em;">暂无条目</div>`);
        } else {
          $entriesContainer.html(
            renderCurrentWorldbookEntries(entries, themeColors, {
              variant: 'desktop',
              worldbookName: currentState.selectedWorldbook,
            }),
          );
        }
      }
    });

    // 条目开关切换
    $('#worldbook-switcher-simple-menu', parentDoc).on('click', '.wb-simple-toggle', async function(e) {
      e.stopPropagation();
      const $checkbox = $(this);
      const uid = parseInt($checkbox.data('uid'));
      const enabled = $checkbox.is(':checked');

      console.log('[WorldbookSwitcher] 简易模式条目开关切换:', uid, enabled);

      const entry = currentState.entries.find(e => e.uid === uid);
      if (entry) {
        entry.enabled = enabled;
        await updateWorldbookEntries(currentState.selectedWorldbook, currentState.entries);

        // 记录使用统计
        recordEntryUsage(currentState.selectedWorldbook, uid, entry.name || truncateText(entry.content, 15));

        // 更新UI
        const $entryDiv = $checkbox.closest('.wb-simple-entry');
        $entryDiv.css('opacity', enabled ? '1' : '0.5');
        $checkbox.siblings('span').first().css('background-color', enabled ? '#10B981' : '#6B7280');
        $checkbox.siblings('span').last().css('left', enabled ? '16px' : '2px');

      }
    });

    $('#worldbook-switcher-simple-menu', parentDoc).on('click', '.wb-entry-detail-btn', function(e) {
      e.stopPropagation();
      const worldbookName = String($(this).data('worldbook') || currentState.selectedWorldbook || '');
      const uid = parseInt($(this).data('uid'));
      if (worldbookName && Number.isInteger(uid)) {
        void openEntryDetailModal(worldbookName, uid);
      }
    });

    // 全部世界书按钮点击事件
    $('#wb-all-worldbooks-btn', parentDoc).on('click', function(e) {
      e.stopPropagation();
      showAllWorldbooksPanel();
    });

    // 常用条目历史按钮点击事件
    $('#wb-frequent-entries-btn', parentDoc).on('click', function(e) {
      e.stopPropagation();
      showFrequentEntriesPanel();
    });

    // 根据保存的面板状态自动打开面板
    const panelConfig = getWorldbookSwitcherConfig();
    if (panelConfig.panelState && panelConfig.panelState.allWorldbooks) {
      scheduleWorldbookTimeout(() => showAllWorldbooksPanel(), 50);
    }
    if (panelConfig.panelState && panelConfig.panelState.frequentEntries) {
      scheduleWorldbookTimeout(() => showFrequentEntriesPanel(), 50);
    }

    // 搜索功能 - 简易菜单条目
    $('#wb-simple-search-entries', parentDoc).on('input', function() {
      const keyword = $(this).val().toLowerCase().trim();
      $('#wb-simple-entries .wb-simple-entry', parentDoc).each(function() {
        const name = $(this).find('.wb-entry-name').text().toLowerCase();
        $(this).toggle(name.includes(keyword));
      });
    });

    // 点击外部关闭
      scheduleWorldbookTimeout(() => {
        $(parentDoc).on('click.wbsimplemenu', function(e) {
          if (!$(e.target).closest('#worldbook-switcher-simple-menu, #WIDrawerIcon, #wb-all-worldbooks-panel, #wb-frequent-entries-panel, #wb-entry-detail-panel, #wb-entry-fullscreen-editor').length) {
            // 不重置面板状态，保持记忆功能
            closeDesktopMenuPanels();
            $(parentDoc).off('.wbsimplemenu');
          }
        });
      }, 100);
    } catch (error) {
      console.error('[WorldbookSwitcher] showSimpleMenu 执行失败:', error);
    }
  }

  // =============================================================================
  // 显示全部世界书面板（左侧滑出）
  // =============================================================================
  async function showAllWorldbooksPanel() {
    // 如果已存在，先移除并保存状态为关闭
    if ($('#wb-all-worldbooks-panel', parentDoc).length) {
      $('#wb-all-worldbooks-panel', parentDoc).remove();
      const config = getWorldbookSwitcherConfig();
      config.panelState = config.panelState || {};
      config.panelState.allWorldbooks = false;
      saveWorldbookSwitcherConfig(config);
      return;
    }

    // 保存状态为打开
    const config = getWorldbookSwitcherConfig();
    config.panelState = config.panelState || {};
    config.panelState.allWorldbooks = true;
    saveWorldbookSwitcherConfig(config);

    const themeColors = getThemeColors();
    
    // 每次打开面板都获取最新状态
    console.log('[WorldbookSwitcher] 左侧面板: 正在获取最新世界书状态...');
    const allWorldbooks = await getAllWorldbooks();
    const globalWbs = await getGlobalWorldbooks();
    console.log('[WorldbookSwitcher] 左侧面板: 所有世界书:', allWorldbooks);
    console.log('[WorldbookSwitcher] 左侧面板: 已启用的世界书:', globalWbs);

    // 获取简易菜单的位置作为参考
    const $simpleMenu = $('#worldbook-switcher-simple-menu', parentDoc);
    const menuRect = $simpleMenu.length ? $simpleMenu[0].getBoundingClientRect() : { top: 100, left: 300, height: 400 };

    // 对世界书列表排序 - 置顶的排在前面
    const sortedWorldbooks = [...allWorldbooks].sort((a, b) => {
      const aPinned = config.pinnedWorldbooks && config.pinnedWorldbooks.includes(a);
      const bPinned = config.pinnedWorldbooks && config.pinnedWorldbooks.includes(b);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

    const panelHtml = `
      <div id="wb-all-worldbooks-panel" style="
        position: fixed;
        top: ${menuRect.top}px;
        left: ${menuRect.left - 260}px;
        z-index: 10001;
        background: ${themeColors.background};
        border: 1px solid ${themeColors.border};
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,${themeColors.isLight ? '0.15' : '0.6'});
        width: 250px;
        height: ${menuRect.height}px;
        display: flex;
        flex-direction: column;
        color: ${themeColors.text};
        animation: slideInLeft 0.2s ease-out;
      ">
        <style>
          @keyframes slideInLeft {
            from { transform: translateX(-20px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        </style>
        <!-- 标题栏 -->
        <div style="
          padding: 10px 12px;
          border-bottom: 1px solid ${themeColors.border};
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        ">
          <span style="font-weight: 600; font-size: 0.9em;">
            <i class="fa-solid fa-book" style="margin-right: 6px;"></i>全部世界书
          </span>
          <button id="wb-all-worldbooks-close" title="关闭" style="
            background: none;
            border: none;
            color: ${themeColors.text};
            cursor: pointer;
            padding: 4px;
            font-size: 14px;
          ">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <!-- 世界书列表 -->
        <div id="wb-all-worldbooks-list" style="
          flex: 1;
          overflow-y: auto;
          padding: 6px;
        ">
          ${sortedWorldbooks.length === 0 ?
            `<div style="text-align: center; padding: 20px; color: ${themeColors.secondaryText}; font-size: 0.85em;">暂无世界书</div>` :
            sortedWorldbooks.map(wb => {
              const isEnabled = globalWbs.includes(wb);
              const isPinned = config.pinnedWorldbooks && config.pinnedWorldbooks.includes(wb);
              return `
                <div class="wb-worldbook-item" data-name="${escapeHtml(wb)}" style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  padding: 6px 8px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 0.8em;
                  ${!isEnabled ? 'opacity: 0.5;' : ''}
                  transition: background 0.15s;
                " onmouseover="this.style.background='rgba(59,130,246,0.15)'" onmouseout="this.style.background='transparent'">
                  <label style="
                    position: relative;
                    display: inline-block;
                    width: 32px;
                    height: 18px;
                    flex-shrink: 0;
                    cursor: pointer;
                  ">
                    <input type="checkbox" class="wb-worldbook-toggle" data-name="${escapeHtml(wb)}"
                      ${isEnabled ? 'checked' : ''}
                      style="position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; z-index: 1;">
                    <span style="
                      position: absolute;
                      top: 0;
                      left: 0;
                      right: 0;
                      bottom: 0;
                      background-color: ${isEnabled ? '#3B82F6' : '#6B7280'};
                      transition: 0.3s;
                      border-radius: 18px;
                      pointer-events: none;
                    "></span>
                    <span style="
                      position: absolute;
                      height: 14px;
                      width: 14px;
                      left: ${isEnabled ? '16px' : '2px'};
                      bottom: 2px;
                      background-color: white;
                      transition: 0.3s;
                      border-radius: 50%;
                      pointer-events: none;
                    "></span>
                  </label>
                  <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${isPinned ? '<i class="fa-solid fa-thumbtack" style="color: #3B82F6; margin-right: 4px; font-size: 0.8em;"></i>' : ''}${escapeHtml(wb)}
                  </span>
                  <button class="wb-worldbook-pin" data-name="${escapeHtml(wb)}" data-pinned="${isPinned}" title="${isPinned ? '取消置顶' : '置顶'}" style="
                    background: ${isPinned ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' : 'transparent'};
                    color: ${isPinned ? 'white' : themeColors.secondaryText};
                    border: ${isPinned ? 'none' : '1px solid ' + themeColors.border};
                    border-radius: 4px;
                    padding: 2px 6px;
                    cursor: pointer;
                    font-size: 0.7em;
                    flex-shrink: 0;
                  ">
                    <i class="fa-solid fa-thumbtack"></i>
                  </button>
                </div>
              `;
            }).join('')
          }
        </div>
        <!-- 搜索框 -->
        <div style="padding: 6px; border-top: 1px solid ${themeColors.border}; flex-shrink: 0;">
          <input type="text" id="wb-desktop-search-worldbooks" placeholder="搜索世界书..." style="
            width: 100%; padding: 6px 10px; border: 1px solid ${themeColors.border}; border-radius: 4px;
            background: ${themeColors.inputBg}; color: ${themeColors.inputText}; font-size: 0.8em; box-sizing: border-box;
          ">
        </div>
      </div>
    `;

    $('body', parentDoc).append(panelHtml);

    // 关闭按钮
    $('#wb-all-worldbooks-close', parentDoc).on('click', function(e) {
      e.stopPropagation();
      const config = getWorldbookSwitcherConfig();
      config.panelState = config.panelState || {};
      config.panelState.allWorldbooks = false;
      saveWorldbookSwitcherConfig(config);
      $('#wb-all-worldbooks-panel', parentDoc).remove();
    });

    // 世界书开关切换
    $('#wb-all-worldbooks-panel', parentDoc).on('click', '.wb-worldbook-toggle', async function(e) {
      e.stopPropagation();
      const $checkbox = $(this);
      const wbName = $checkbox.data('name');
      const enabled = $checkbox.is(':checked');

      console.log('[WorldbookSwitcher] 世界书开关切换:', wbName, enabled);

      // 使用 rebindGlobalWorldbooks API 切换世界书
      try {
        const currentGlobalWbs = await getGlobalWorldbooks();
        let newGlobalWbs;
        
        if (enabled) {
          // 启用世界书 - 添加到列表
          if (!currentGlobalWbs.includes(wbName)) {
            newGlobalWbs = [...currentGlobalWbs, wbName];
          } else {
            newGlobalWbs = currentGlobalWbs;
          }
        } else {
          // 禁用世界书 - 从列表移除
          newGlobalWbs = currentGlobalWbs.filter(wb => wb !== wbName);
        }
        
        // 调用API重新绑定
        console.log('[WorldbookSwitcher] 正在绑定新的世界书列表:', newGlobalWbs);
        if (typeof rebindGlobalWorldbooks === 'function') {
          await rebindGlobalWorldbooks(newGlobalWbs);
        }

        // 更新UI
        const $itemDiv = $checkbox.closest('.wb-worldbook-item');
        $itemDiv.css('opacity', enabled ? '1' : '0.5');
        $checkbox.siblings('span').first().css('background-color', enabled ? '#3B82F6' : '#6B7280');
        $checkbox.siblings('span').last().css('left', enabled ? '16px' : '2px');

        // 轮询检测3次，等待API状态同步
        let latestGlobalWbs = [];
        for (let i = 0; i < 3; i++) {
          await new Promise(resolve => scheduleWorldbookTimeout(resolve, 200));
          latestGlobalWbs = await getGlobalWorldbooks();
          console.log(`[WorldbookSwitcher] 第${i + 1}次检测，当前全局世界书:`, latestGlobalWbs);
          
          // 检查状态是否符合预期
          const hasWorldbook = latestGlobalWbs.includes(wbName);
          if ((enabled && hasWorldbook) || (!enabled && !hasWorldbook)) {
            console.log('[WorldbookSwitcher] 状态已同步');
            break;
          }
        }

        // 刷新简易菜单的世界书选择器
        const $selector = $('#wb-worldbook-selector', parentDoc);
        if ($selector.length) {
          const currentValue = $selector.val();
          $selector.html(latestGlobalWbs.length === 0 ?
            '<option value="">无已启用的世界书</option>' :
            latestGlobalWbs.map(wb => `
              <option value="${escapeHtml(wb)}" ${currentValue === wb ? 'selected' : ''}>
                ${escapeHtml(wb)}
              </option>
            `).join('')
          );
        }

      } catch (err) {
        console.error('[WorldbookSwitcher] 切换世界书失败:', err);
      }
    });

    // 世界书置顶按钮
    $('#wb-all-worldbooks-panel', parentDoc).on('click', '.wb-worldbook-pin', function(e) {
      e.stopPropagation();
      const $btn = $(this);
      const wbName = $btn.data('name');
      const isPinned = $btn.data('pinned') === true || $btn.data('pinned') === 'true';
      const config = getWorldbookSwitcherConfig();
      if (!config.pinnedWorldbooks) config.pinnedWorldbooks = [];
      if (isPinned) {
        config.pinnedWorldbooks = config.pinnedWorldbooks.filter(wb => wb !== wbName);
      } else if (!config.pinnedWorldbooks.includes(wbName)) {
        config.pinnedWorldbooks.push(wbName);
      }
      saveWorldbookSwitcherConfig(config);
      // 刷新面板
      $('#wb-all-worldbooks-panel', parentDoc).remove();
      showAllWorldbooksPanel();
    });

    // 世界书搜索功能
    $('#wb-desktop-search-worldbooks', parentDoc).on('input', function() {
      const keyword = $(this).val().toLowerCase().trim();
      $('#wb-all-worldbooks-list .wb-worldbook-item', parentDoc).each(function() {
        const name = $(this).data('name').toLowerCase();
        $(this).toggle(name.includes(keyword));
      });
    });
  }

  // =============================================================================
  // 显示常用条目历史面板（右侧滑出）
  // =============================================================================
  async function showFrequentEntriesPanel() {
    // 如果已存在，先移除并保存状态为关闭
    if ($('#wb-frequent-entries-panel', parentDoc).length) {
      removeFrequentEntriesPanel();
      const config = getWorldbookSwitcherConfig();
      config.panelState = config.panelState || {};
      config.panelState.frequentEntries = false;
      saveWorldbookSwitcherConfig(config);
      return;
    }

    // 保存状态为打开
    const config = getWorldbookSwitcherConfig();
    config.panelState = config.panelState || {};
    config.panelState.frequentEntries = true;
    saveWorldbookSwitcherConfig(config);

    const themeColors = getThemeColors();
    const entriesWithState = await getFrequentEntriesWithState(30);

    // 获取简易菜单的位置作为参考
    const $simpleMenu = $('#worldbook-switcher-simple-menu', parentDoc);
    const menuRect = $simpleMenu.length ? $simpleMenu[0].getBoundingClientRect() : { top: 100, right: 100, height: 400 };

    const panelHtml = `
      <div id="wb-frequent-entries-panel" style="
        position: fixed;
        top: ${menuRect.top}px;
        left: ${menuRect.right + 10}px;
        z-index: 10001;
        background: ${themeColors.background};
        border: 1px solid ${themeColors.border};
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,${themeColors.isLight ? '0.15' : '0.6'});
        width: 280px;
        height: ${menuRect.height}px;
        display: flex;
        flex-direction: column;
        color: ${themeColors.text};
        animation: slideInRight 0.2s ease-out;
      ">
        <style>
          @keyframes slideInRight {
            from { transform: translateX(20px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        </style>
        <!-- 标题栏 -->
        <div style="
          padding: 10px 12px;
          border-bottom: 1px solid ${themeColors.border};
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        ">
          <span style="font-weight: 600; font-size: 0.9em;">
            <i class="fa-solid fa-star" style="margin-right: 6px; color: #F59E0B;"></i>常用条目
          </span>
          <button id="wb-frequent-entries-close" title="关闭" style="
            background: none;
            border: none;
            color: ${themeColors.text};
            cursor: pointer;
            padding: 4px;
            font-size: 14px;
          ">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <!-- 条目列表 -->
        <div id="wb-frequent-entries-list" style="
          flex: 1;
          overflow-y: auto;
          padding: 6px;
        ">
          ${renderFrequentEntries(entriesWithState, themeColors, { variant: 'desktop' })}
        </div>
        <!-- 搜索框 -->
        <div style="padding: 6px; border-top: 1px solid ${themeColors.border}; flex-shrink: 0;">
          <input type="text" id="wb-desktop-search-frequent" placeholder="搜索常用条目..." style="
            width: 100%; padding: 6px 10px; border: 1px solid ${themeColors.border}; border-radius: 4px;
            background: ${themeColors.inputBg}; color: ${themeColors.inputText}; font-size: 0.8em; box-sizing: border-box;
          ">
        </div>
      </div>
    `;

    $('body', parentDoc).append(panelHtml);
    repositionEntryDetailPanel();

    // 关闭按钮
    $('#wb-frequent-entries-close', parentDoc).on('click', function(e) {
      e.stopPropagation();
      const config = getWorldbookSwitcherConfig();
      config.panelState = config.panelState || {};
      config.panelState.frequentEntries = false;
      saveWorldbookSwitcherConfig(config);
      removeFrequentEntriesPanel();
    });

    // 条目开关切换
    $('#wb-frequent-entries-panel', parentDoc).on('click', '.wb-frequent-toggle', async function(e) {
      e.stopPropagation();
      const $checkbox = $(this);
      const worldbook = $checkbox.data('worldbook');
      const uid = parseInt($checkbox.data('uid'));
      const enabled = $checkbox.is(':checked');

      console.log('[WorldbookSwitcher] 常用条目切换:', worldbook, uid, enabled);

      try {
        // 获取该世界书的条目
        const entries = await getWorldbookEntries(worldbook);
        const entry = entries.find(e => e.uid === uid);
        
        if (entry) {
          // 设置状态
          entry.enabled = enabled;
          await updateWorldbookEntries(worldbook, entries);

          // 记录使用
          recordEntryUsage(worldbook, uid, entry.name || truncateText(entry.content, 15));

          // 更新UI
          const $entryDiv = $checkbox.closest('.wb-frequent-entry');
          $entryDiv.css('opacity', enabled ? '1' : '0.5');
          $checkbox.siblings('span').first().css('background-color', enabled ? '#10B981' : '#6B7280');
          $checkbox.siblings('span').last().css('left', enabled ? '16px' : '2px');

          // 如果当前简易菜单显示的是这个世界书，也更新其UI
          if (currentState.selectedWorldbook === worldbook) {
            const $toggle = $(`.wb-simple-toggle[data-uid="${uid}"]`, parentDoc);
            if ($toggle.length) {
              $toggle.prop('checked', enabled);
              $toggle.closest('.wb-simple-entry').css('opacity', enabled ? '1' : '0.5');
              $toggle.siblings('span').first().css('background-color', enabled ? '#10B981' : '#6B7280');
              $toggle.siblings('span').last().css('left', enabled ? '16px' : '2px');
            }
          }
        }
      } catch (err) {
        console.error('[WorldbookSwitcher] 切换常用条目失败:', err);
      }
    });

    $('#wb-frequent-entries-panel', parentDoc).on('click', '.wb-entry-detail-btn', function(e) {
      e.stopPropagation();
      const worldbookName = String($(this).data('worldbook') || '');
      const uid = parseInt($(this).data('uid'));
      if (worldbookName && Number.isInteger(uid)) {
        void openEntryDetailModal(worldbookName, uid);
      }
    });

    // 置顶按钮点击
    $('#wb-frequent-entries-panel', parentDoc).on('click', '.wb-frequent-pin', async function(e) {
      e.stopPropagation();
      const $btn = $(this);
      const worldbook = $btn.data('worldbook');
      const uid = parseInt($btn.data('uid'));
      const isPinned = $btn.data('pinned') === true || $btn.data('pinned') === 'true';

      console.log('[WorldbookSwitcher] 置顶操作:', worldbook, uid, '当前状态:', isPinned);

      if (isPinned) {
        unpinEntry(worldbook, uid);
      } else {
        pinEntry(worldbook, uid);
      }

      // 刷新面板
      removeFrequentEntriesPanel({ repositionDetail: false });
      await showFrequentEntriesPanel();
    });

    // 移除按钮点击
    $('#wb-frequent-entries-panel', parentDoc).on('click', '.wb-frequent-remove', function(e) {
      e.stopPropagation();
      const $btn = $(this);
      const worldbook = $btn.data('worldbook');
      const uid = parseInt($btn.data('uid'));

      console.log('[WorldbookSwitcher] 从历史移除:', worldbook, uid);

      removeFromHistory(worldbook, uid);

      // 移除该条目DOM
      $btn.closest('.wb-frequent-entry').fadeOut(200, function() {
        $(this).remove();
        // 如果没有条目了，显示空提示
        if ($('#wb-frequent-entries-list .wb-frequent-entry', parentDoc).length === 0) {
          const themeColors = getThemeColors();
          $('#wb-frequent-entries-list', parentDoc).html(
            `<div style="text-align: center; padding: 20px; color: ${themeColors.secondaryText}; font-size: 0.85em;">暂无使用记录<br><span style="font-size: 0.8em;">开关条目后会在此显示</span></div>`
          );
        }
      });
    });

    // 常用条目搜索功能
    $('#wb-desktop-search-frequent', parentDoc).on('input', function() {
      const keyword = $(this).val().toLowerCase().trim();
      $('#wb-frequent-entries-list .wb-frequent-entry', parentDoc).each(function() {
        const name = $(this).find('div > div').first().text().toLowerCase();
        const worldbook = $(this).data('worldbook').toLowerCase();
        $(this).toggle(name.includes(keyword) || worldbook.includes(keyword));
      });
    });
  }

  // =============================================================================
  // 移动端滑动切换菜单 - 使用原来菜单的定位方式
  // =============================================================================
  async function showMobileMenu(initialTab = 1) {
    try {
      // 如果已存在，先移除
      const $existingMobileMenu = $('#worldbook-switcher-mobile-menu', parentDoc);
      if ($existingMobileMenu.length) {
        const wasVisible = $existingMobileMenu.is(':visible');
        $('#worldbook-switcher-mobile-menu', parentDoc).remove();
        $(parentDoc).off('.wbmobilemenu');
        if (wasVisible) {
          return;
        }
      }

      const config = getWorldbookSwitcherConfig();
      const themeColors = getThemeColors();
    
    // 获取原生世界信息图标的位置（和原来中间菜单一样）
    const $wiIcon = $('#WIDrawerIcon', parentDoc);
    if (!$wiIcon.length) {
      console.error('[WorldbookSwitcher] 未找到原生世界信息图标');
      return;
    }
    const iconRect = $wiIcon[0].getBoundingClientRect();
    const menuTop = iconRect.bottom + 8;
    const menuLeft = Math.max(10, iconRect.left - 100);
    
    // 获取数据
    const allWorldbooks = await getAllWorldbooks();
    const globalWbs = await getGlobalWorldbooks();
    
    if (!currentState.selectedWorldbook || !globalWbs.includes(currentState.selectedWorldbook)) {
      currentState.selectedWorldbook = globalWbs[0] || '';
    }
    currentState.mobileActiveTab = initialTab;
    currentState.mobileDetailContext = null;
    
    let entries = [];
    if (currentState.selectedWorldbook) {
      entries = await getWorldbookEntries(currentState.selectedWorldbook);
      currentState.entries = entries;
    }

    const entriesWithState = await getFrequentEntriesWithState(30);

    // 对世界书列表排序 - 置顶的排在前面
    const sortedWorldbooks = [...allWorldbooks].sort((a, b) => {
      const aPinned = config.pinnedWorldbooks && config.pinnedWorldbooks.includes(a);
      const bPinned = config.pinnedWorldbooks && config.pinnedWorldbooks.includes(b);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

    // 生成世界书选项HTML
    const worldbookOptionsHtml = globalWbs.map(wb => `
      <option value="${escapeHtml(wb)}" ${currentState.selectedWorldbook === wb ? 'selected' : ''}>
        ${escapeHtml(wb)}
      </option>
    `).join('');

    // 使用和原来中间菜单一样的样式
    const menuHtml = `
      <div id="worldbook-switcher-mobile-menu" style="
        position: fixed;
        top: ${menuTop}px;
        left: ${menuLeft}px;
        z-index: 10000;
        background: ${themeColors.background};
        border: 1px solid ${themeColors.border};
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,${themeColors.isLight ? '0.15' : '0.6'});
        width: 300px;
        height: 400px;
        display: flex;
        flex-direction: column;
        color: ${themeColors.text};
      ">
        <!-- 顶部标签栏 -->
        <div style="
          padding: 6px;
          border-bottom: 1px solid ${themeColors.border};
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        ">
          <button class="wb-mobile-tab" data-tab="0" style="
            flex: 1; padding: 4px 6px; border: 1px solid ${themeColors.border}; border-radius: 4px;
            background: transparent; color: ${themeColors.text}; cursor: pointer; font-size: 0.7em;
          "><i class="fa-solid fa-book"></i> 世界书</button>
          <button class="wb-mobile-tab active" data-tab="1" style="
            flex: 1; padding: 4px 6px; border: 1px solid transparent; border-radius: 4px;
            background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); color: white; cursor: pointer; font-size: 0.7em;
          "><i class="fa-solid fa-list"></i> 条目</button>
          <button class="wb-mobile-tab" data-tab="2" style="
            flex: 1; padding: 4px 6px; border: 1px solid ${themeColors.border}; border-radius: 4px;
            background: transparent; color: ${themeColors.text}; cursor: pointer; font-size: 0.7em;
          "><i class="fa-solid fa-star"></i> 常用</button>
          <button id="wb-mobile-switch-full" title="切换到完整模式" style="
            padding: 4px 6px; background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 0.65em;
          "><i class="fa-solid fa-expand"></i></button>
          <button id="wb-mobile-close" style="
            padding: 4px 6px; background: none; border: none; color: ${themeColors.text}; cursor: pointer;
          "><i class="fa-solid fa-times"></i></button>
        </div>

        <!-- 面板0: 全部世界书 -->
        <div id="wb-mobile-panel-0" style="display: none; flex-direction: column; flex: 1; overflow: hidden;">
          <div id="wb-mobile-worldbooks-list" style="flex: 1; overflow-y: auto; padding: 6px;">
            ${sortedWorldbooks.map(wb => {
              const isEnabled = globalWbs.includes(wb);
              const isPinned = config.pinnedWorldbooks && config.pinnedWorldbooks.includes(wb);
              return `<div class="wb-mobile-worldbook" data-name="${escapeHtml(wb)}" style="
                display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 4px; font-size: 0.8em;
                ${!isEnabled ? 'opacity: 0.5;' : ''} transition: background 0.15s;
              " onmouseover="this.style.background='rgba(59,130,246,0.15)'" onmouseout="this.style.background='transparent'">
                <label style="position: relative; display: inline-block; width: 32px; height: 18px; flex-shrink: 0; cursor: pointer;">
                  <input type="checkbox" class="wb-mobile-worldbook-toggle" data-name="${escapeHtml(wb)}" ${isEnabled ? 'checked' : ''} style="position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; z-index: 1;">
                  <span style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isEnabled ? '#3B82F6' : '#6B7280'}; transition: 0.3s; border-radius: 18px; pointer-events: none;"></span>
                  <span style="position: absolute; height: 14px; width: 14px; left: ${isEnabled ? '16px' : '2px'}; bottom: 2px; background-color: white; transition: 0.3s; border-radius: 50%; pointer-events: none;"></span>
                </label>
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${isPinned ? '<i class="fa-solid fa-thumbtack" style="color: #3B82F6; margin-right: 4px; font-size: 0.8em;"></i>' : ''}${escapeHtml(wb)}
                </span>
                <button class="wb-mobile-worldbook-pin" data-name="${escapeHtml(wb)}" data-pinned="${isPinned}" title="${isPinned ? '取消置顶' : '置顶'}" style="
                  background: ${isPinned ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' : 'transparent'};
                  color: ${isPinned ? 'white' : themeColors.secondaryText};
                  border: ${isPinned ? 'none' : '1px solid ' + themeColors.border};
                  border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 0.7em;
                "><i class="fa-solid fa-thumbtack"></i></button>
              </div>`;
            }).join('') || `<div style="text-align: center; padding: 20px; color: ${themeColors.secondaryText}; font-size: 0.85em;">暂无世界书</div>`}
          </div>
          <div style="padding: 6px; border-top: 1px solid ${themeColors.border}; flex-shrink: 0;">
            <input type="text" id="wb-mobile-search-worldbooks" placeholder="搜索世界书..." style="
              width: 100%; padding: 6px 10px; border: 1px solid ${themeColors.border}; border-radius: 4px;
              background: ${themeColors.inputBg}; color: ${themeColors.inputText}; font-size: 0.8em; box-sizing: border-box;
            ">
          </div>
        </div>

        <!-- 面板1: 条目列表 (默认显示) -->
        <div id="wb-mobile-panel-1" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
          <div style="padding: 6px; flex-shrink: 0;">
            <select id="wb-mobile-worldbook-selector" style="
              width: 100%; padding: 4px 8px; border: 1px solid ${themeColors.border}; border-radius: 4px;
              background: ${themeColors.inputBg}; color: ${themeColors.inputText}; font-size: 0.8em; cursor: pointer;
            ">
              ${globalWbs.length === 0 ? '<option value="">无已启用的世界书</option>' : worldbookOptionsHtml}
            </select>
          </div>
          <div id="wb-mobile-entries-list" style="flex: 1; overflow-y: auto; padding: 0 6px 6px;">
            ${renderCurrentWorldbookEntries(entries, themeColors, {
              variant: 'mobile',
              worldbookName: currentState.selectedWorldbook,
            })}
          </div>
          <div style="padding: 6px; border-top: 1px solid ${themeColors.border}; flex-shrink: 0;">
            <input type="text" id="wb-mobile-search-entries" placeholder="搜索条目..." style="
              width: 100%; padding: 6px 10px; border: 1px solid ${themeColors.border}; border-radius: 4px;
              background: ${themeColors.inputBg}; color: ${themeColors.inputText}; font-size: 0.8em; box-sizing: border-box;
            ">
          </div>
        </div>

        <!-- 面板2: 常用条目 -->
        <div id="wb-mobile-panel-2" style="display: none; flex-direction: column; flex: 1; overflow: hidden;">
          <div id="wb-mobile-frequent-list" style="flex: 1; overflow-y: auto; padding: 6px;">
            ${renderFrequentEntries(entriesWithState, themeColors, { variant: 'mobile' })}
          </div>
          <div style="padding: 6px; border-top: 1px solid ${themeColors.border}; flex-shrink: 0;">
            <input type="text" id="wb-mobile-search-frequent" placeholder="搜索常用条目..." style="
              width: 100%; padding: 6px 10px; border: 1px solid ${themeColors.border}; border-radius: 4px;
              background: ${themeColors.inputBg}; color: ${themeColors.inputText}; font-size: 0.8em; box-sizing: border-box;
            ">
          </div>
        </div>
        <div id="wb-mobile-detail-view" style="display: none; flex: 1; overflow: hidden;"></div>
      </div>
    `;

    $('body', parentDoc).append(menuHtml);

    // 根据初始标签页设置显示状态
    if (initialTab !== 1) {
      const themeColors = getThemeColors();
      // 更新标签样式
      $('.wb-mobile-tab', parentDoc).each(function() {
        const tabNum = parseInt($(this).data('tab'));
        if (tabNum === initialTab) {
          $(this).css({
            'background': 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
            'color': 'white',
            'border': '1px solid transparent'
          });
        } else {
          $(this).css({
            'background': 'transparent',
            'color': themeColors.text,
            'border': `1px solid ${themeColors.border}`
          });
        }
      });
      // 切换面板显示
      $('#wb-mobile-panel-0, #wb-mobile-panel-1, #wb-mobile-panel-2, #wb-mobile-detail-view', parentDoc).hide();
      $(`#wb-mobile-panel-${initialTab}`, parentDoc).css('display', 'flex');
    }

    // 标签切换 - 使用显示/隐藏方式而不是滑动
    $('#worldbook-switcher-mobile-menu .wb-mobile-tab', parentDoc).on('click', function() {
      const tab = parseInt($(this).data('tab'));
      const themeColors = getThemeColors();
      currentState.mobileDetailContext = null;
      currentState.mobileActiveTab = tab;
      
      // 更新标签样式
      $('.wb-mobile-tab', parentDoc).each(function() {
        $(this).css({
          'background': 'transparent',
          'color': themeColors.text,
          'border': `1px solid ${themeColors.border}`
        });
      });
      $(this).css({
        'background': 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
        'color': 'white',
        'border': '1px solid transparent'
      });
      
      // 切换面板显示
      $('#wb-mobile-detail-view', parentDoc).hide().empty();
      $('#wb-mobile-panel-0, #wb-mobile-panel-1, #wb-mobile-panel-2', parentDoc).hide();
      $(`#wb-mobile-panel-${tab}`, parentDoc).css('display', 'flex');
    });

    // 关闭按钮
    $('#wb-mobile-close', parentDoc).on('click', function() {
      $('#worldbook-switcher-mobile-menu', parentDoc).remove();
      $(parentDoc).off('.wbmobilemenu');
    });

    // 世界书开关
    $('#worldbook-switcher-mobile-menu', parentDoc).on('click', '.wb-mobile-worldbook-toggle', async function(e) {
      e.stopPropagation();
      const wbName = $(this).data('name');
      const enabled = $(this).is(':checked');
      try {
        const currentGlobalWbs = await getGlobalWorldbooks();
        const newGlobalWbs = enabled ? [...currentGlobalWbs, wbName].filter((v, i, a) => a.indexOf(v) === i) : currentGlobalWbs.filter(wb => wb !== wbName);
        if (typeof rebindGlobalWorldbooks === 'function') await rebindGlobalWorldbooks(newGlobalWbs);
        
        // 更新UI
        const $item = $(this).closest('.wb-mobile-worldbook');
        $item.css('opacity', enabled ? '1' : '0.5');
        $(this).siblings('span').first().css('background-color', enabled ? '#3B82F6' : '#6B7280');
        $(this).siblings('span').last().css('left', enabled ? '16px' : '2px');

        // 轮询检测，等待API状态同步
        let latestGlobalWbs = [];
        for (let i = 0; i < 3; i++) {
          await new Promise(resolve => scheduleWorldbookTimeout(resolve, 200));
          latestGlobalWbs = await getGlobalWorldbooks();
          const hasWorldbook = latestGlobalWbs.includes(wbName);
          if ((enabled && hasWorldbook) || (!enabled && !hasWorldbook)) break;
        }

        // 更新条目面板的世界书选择器
        const $selector = $('#wb-mobile-worldbook-selector', parentDoc);
        if ($selector.length) {
          const currentValue = $selector.val();
          $selector.html(latestGlobalWbs.length === 0 ?
            '<option value="">无已启用的世界书</option>' :
            latestGlobalWbs.map(wb => `
              <option value="${escapeHtml(wb)}" ${currentValue === wb ? 'selected' : ''}>
                ${escapeHtml(wb)}
              </option>
            `).join('')
          );
          // 如果当前选中的世界书被禁用了，自动选择第一个
          if (!latestGlobalWbs.includes(currentValue) && latestGlobalWbs.length > 0) {
            $selector.val(latestGlobalWbs[0]);
            $selector.trigger('change');
          }
        }
      } catch (err) { console.error('[WorldbookSwitcher] 切换世界书失败:', err); }
    });

    // 世界书选择器变化
    $('#wb-mobile-worldbook-selector', parentDoc).on('change', async function() {
      const selectedWb = $(this).val();
      if (selectedWb && selectedWb !== currentState.selectedWorldbook) {
        currentState.selectedWorldbook = selectedWb;
        const newEntries = await getWorldbookEntries(selectedWb);
        currentState.entries = newEntries;
        const themeColors = getThemeColors();
        $('#wb-mobile-entries-list', parentDoc).html(
          renderCurrentWorldbookEntries(newEntries, themeColors, {
            variant: 'mobile',
            worldbookName: currentState.selectedWorldbook,
          }),
        );
      }
    });

    // 条目开关
    $('#worldbook-switcher-mobile-menu', parentDoc).on('click', '.wb-mobile-entry-toggle', async function(e) {
      e.stopPropagation();
      const uid = parseInt($(this).data('uid'));
      const enabled = $(this).is(':checked');
      const entry = currentState.entries.find(e => e.uid === uid);
      if (entry) {
        entry.enabled = enabled;
        await updateWorldbookEntries(currentState.selectedWorldbook, currentState.entries);
        recordEntryUsage(currentState.selectedWorldbook, uid, entry.name || truncateText(entry.content, 15));
        const $item = $(this).closest('.wb-mobile-entry');
        $item.css('opacity', enabled ? '1' : '0.5');
        $(this).siblings('span').first().css('background-color', enabled ? '#10B981' : '#6B7280');
        $(this).siblings('span').last().css('left', enabled ? '16px' : '2px');
      }
    });

    $('#worldbook-switcher-mobile-menu', parentDoc).on('click', '.wb-entry-detail-btn', function(e) {
      e.stopPropagation();
      const worldbookName = String($(this).data('worldbook') || currentState.selectedWorldbook || '');
      const uid = parseInt($(this).data('uid'));
      if (worldbookName && Number.isInteger(uid)) {
        void openMobileEntryDetailView(worldbookName, uid);
      }
    });

    // 常用条目开关
    $('#worldbook-switcher-mobile-menu', parentDoc).on('click', '.wb-mobile-frequent-toggle', async function(e) {
      e.stopPropagation();
      const worldbook = $(this).data('worldbook');
      const uid = parseInt($(this).data('uid'));
      const enabled = $(this).is(':checked');
      try {
        const entries = await getWorldbookEntries(worldbook);
        const entry = entries.find(e => e.uid === uid);
        if (entry) {
          entry.enabled = enabled;
          await updateWorldbookEntries(worldbook, entries);
          recordEntryUsage(worldbook, uid, entry.name || truncateText(entry.content, 15));
          const $item = $(this).closest('.wb-mobile-frequent');
          $item.css('opacity', enabled ? '1' : '0.5');
          $(this).siblings('span').first().css('background-color', enabled ? '#10B981' : '#6B7280');
          $(this).siblings('span').last().css('left', enabled ? '16px' : '2px');
        }
      } catch (err) { console.error('[WorldbookSwitcher] 切换常用条目失败:', err); }
    });

    // 切换到完整模式按钮
    $('#wb-mobile-switch-full', parentDoc).on('click', function(e) {
      e.stopPropagation();
      const config = getWorldbookSwitcherConfig();
      config.simpleMode = false;
      saveWorldbookSwitcherConfig(config);
      currentState.isIntercepting = false;
      $('#worldbook-switcher-mobile-menu', parentDoc).remove();
      $(parentDoc).off('.wbmobilemenu');
      const $wiIcon = $('#WIDrawerIcon', parentDoc);
      if ($wiIcon.length) $wiIcon[0].click();
    });

    // 世界书置顶按钮
    $('#worldbook-switcher-mobile-menu', parentDoc).on('click', '.wb-mobile-worldbook-pin', function(e) {
      e.stopPropagation();
      const $btn = $(this);
      const wbName = $btn.data('name');
      const isPinned = $btn.data('pinned') === true || $btn.data('pinned') === 'true';
      const config = getWorldbookSwitcherConfig();
      if (!config.pinnedWorldbooks) config.pinnedWorldbooks = [];
      if (isPinned) {
        config.pinnedWorldbooks = config.pinnedWorldbooks.filter(wb => wb !== wbName);
      } else if (!config.pinnedWorldbooks.includes(wbName)) {
        config.pinnedWorldbooks.push(wbName);
      }
      saveWorldbookSwitcherConfig(config);
      // 刷新面板 - 保持在世界书面板(0)
      $('#worldbook-switcher-mobile-menu', parentDoc).remove();
      $(parentDoc).off('.wbmobilemenu');
      showMobileMenu(0);
    });

    // 常用条目置顶按钮
    $('#worldbook-switcher-mobile-menu', parentDoc).on('click', '.wb-mobile-frequent-pin', function(e) {
      e.stopPropagation();
      const $btn = $(this);
      const worldbook = $btn.data('worldbook');
      const uid = parseInt($btn.data('uid'));
      const isPinned = $btn.data('pinned') === true || $btn.data('pinned') === 'true';
      if (isPinned) {
        unpinEntry(worldbook, uid);
      } else {
        pinEntry(worldbook, uid);
      }
      // 刷新面板 - 保持在常用面板(2)
      $('#worldbook-switcher-mobile-menu', parentDoc).remove();
      $(parentDoc).off('.wbmobilemenu');
      showMobileMenu(2);
    });

    // 常用条目移除按钮
    $('#worldbook-switcher-mobile-menu', parentDoc).on('click', '.wb-mobile-frequent-remove', function(e) {
      e.stopPropagation();
      const $btn = $(this);
      const worldbook = $btn.data('worldbook');
      const uid = parseInt($btn.data('uid'));
      removeFromHistory(worldbook, uid);
      $btn.closest('.wb-mobile-frequent').fadeOut(200, function() {
        $(this).remove();
        if ($('#wb-mobile-frequent-list .wb-mobile-frequent', parentDoc).length === 0) {
          const themeColors = getThemeColors();
          $('#wb-mobile-frequent-list', parentDoc).html(
            `<div style="text-align: center; padding: 20px; color: ${themeColors.secondaryText}; font-size: 0.85em;">暂无使用记录</div>`
          );
        }
      });
    });

    // 搜索功能 - 世界书
    $('#wb-mobile-search-worldbooks', parentDoc).on('input', function() {
      const keyword = $(this).val().toLowerCase().trim();
      $('#wb-mobile-worldbooks-list .wb-mobile-worldbook', parentDoc).each(function() {
        const name = $(this).data('name').toLowerCase();
        $(this).toggle(name.includes(keyword));
      });
    });

    // 搜索功能 - 条目
    $('#wb-mobile-search-entries', parentDoc).on('input', function() {
      const keyword = $(this).val().toLowerCase().trim();
      $('#wb-mobile-entries-list .wb-mobile-entry', parentDoc).each(function() {
        const name = $(this).find('.wb-entry-name').text().toLowerCase();
        $(this).toggle(name.includes(keyword));
      });
    });

    // 搜索功能 - 常用条目
    $('#wb-mobile-search-frequent', parentDoc).on('input', function() {
      const keyword = $(this).val().toLowerCase().trim();
      $('#wb-mobile-frequent-list .wb-mobile-frequent', parentDoc).each(function() {
        const name = $(this).find('div > div').first().text().toLowerCase();
        const worldbook = $(this).data('worldbook').toLowerCase();
        $(this).toggle(name.includes(keyword) || worldbook.includes(keyword));
      });
    });

    // 点击外部关闭
      scheduleWorldbookTimeout(() => {
        $(parentDoc).on('click.wbmobilemenu', function(e) {
          if (!$(e.target).closest('#worldbook-switcher-mobile-menu, #WIDrawerIcon, #wb-entry-fullscreen-editor').length) {
            $('#worldbook-switcher-mobile-menu', parentDoc).remove();
            $(parentDoc).off('.wbmobilemenu');
          }
        });
      }, 100);
    } catch (error) {
      console.error('[WorldbookSwitcher] showMobileMenu 执行失败:', error);
    }
  }

  // =============================================================================
  // 在原生世界信息面板标题栏注入切换按钮
  // =============================================================================
  function injectSwitchButtonToNativePanel() {
    // 检查按钮是否已存在
    if ($('#wb-native-switch-btn', parentDoc).length) {
      return;
    }

    // 查找原生面板的标题栏
    const $headerContainer = $('#WorldInfo .flex-container.alignitemscenter.gap10px', parentDoc).first();
    if (!$headerContainer.length) {
      console.log('[WorldbookSwitcher] 未找到原生面板标题栏');
      return;
    }

    // 创建切换按钮
    const switchBtnHtml = `
      <button id="wb-native-switch-btn" title="切换到简易模式" style="
        background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 4px 10px;
        cursor: pointer;
        font-size: 0.8em;
        display: flex;
        align-items: center;
        gap: 4px;
        margin-left: auto;
      ">
        <i class="fa-solid fa-compress"></i> 简易
      </button>
    `;

    // 添加到标题栏右侧
    $headerContainer.append(switchBtnHtml);

    // 绑定点击事件
    $('#wb-native-switch-btn', parentDoc).on('click', function(e) {
      e.stopPropagation();

      // 更新配置为简易模式
      const config = getWorldbookSwitcherConfig();
      config.simpleMode = true;
      saveWorldbookSwitcherConfig(config);

      // 更新拦截状态
      currentState.isIntercepting = true;

      // 先关闭原生面板（直接移除openDrawer类）
      const $worldInfo = $('#WorldInfo', parentDoc);
      $worldInfo.removeClass('openDrawer');

      // 然后打开简易菜单
      showSimpleMenu();

    });

    console.log('[WorldbookSwitcher] 已在原生面板标题栏注入切换按钮');
  }

  // =============================================================================
  // 监听原生世界信息图标点击
  // =============================================================================
  function setupNativeIconInterception() {
    if (worldbookDestroyed) return;

    const wiIcon = parentDoc.getElementById('WIDrawerIcon');
    if (!wiIcon) {
      console.log('[WorldbookSwitcher] 未找到原生世界信息图标，稍后重试...');
      worldbookSetupRetryTimer = scheduleWorldbookTimeout(() => {
        worldbookSetupRetryTimer = null;
        setupNativeIconInterception();
      }, 1000);
      return;
    }

    const config = getWorldbookSwitcherConfig();
    currentState.isIntercepting = config.simpleMode;

    console.log('[WorldbookSwitcher] 找到原生世界信息图标，设置拦截监听，当前模式:', config.simpleMode ? '简易' : '完整');

    if (worldbookNativeIcon && worldbookNativeIconClickHandler) {
      worldbookNativeIcon.removeEventListener('click', worldbookNativeIconClickHandler, true);
    }

    worldbookNativeIcon = wiIcon;
    worldbookNativeIconClickHandler = function(e) {
      if (currentState.isIntercepting) {
        console.log('[WorldbookSwitcher] 拦截原生图标点击，显示简易菜单');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        showSimpleMenu();
        return false;
      }
      console.log('[WorldbookSwitcher] 不拦截，允许原生事件');
      return true;
    };
    worldbookNativeIcon.addEventListener('click', worldbookNativeIconClickHandler, true);

    if (worldbookPanelObserver) {
      worldbookPanelObserver.disconnect();
      worldbookPanelObserver = null;
    }

    const worldInfoPanel = parentDoc.getElementById('WorldInfo');
    if (worldInfoPanel) {
      worldbookPanelObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const $worldInfo = $('#WorldInfo', parentDoc);
            if ($worldInfo.hasClass('openDrawer')) {
              scheduleWorldbookTimeout(injectSwitchButtonToNativePanel, 100);
            }
          }
        });
      });

      worldbookPanelObserver.observe(worldInfoPanel, { attributes: true });
      console.log('[WorldbookSwitcher] 已设置原生面板监听');
    }
  }

  // =============================================================================
  // 初始化
  // =============================================================================
  function init() {
    if (worldbookInitialized) return;
    if (!parentDoc || typeof parentDoc.getElementById !== 'function') {
      console.warn('[WorldbookSwitcher] parentDoc 不可用，初始化取消');
      return;
    }
    if (typeof $ !== 'function') {
      console.warn('[WorldbookSwitcher] jQuery 不可用，初始化取消');
      return;
    }

    worldbookDestroyed = false;
    worldbookInitialized = true;
    migrateLegacyWorldbookConfigIfNeeded();

    console.log('[WorldbookSwitcher] 初始化...');
    setupNativeIconInterception();

    window.WorldbookSwitcher = {
      openSimpleMenu: showSimpleMenu,
      setIntercepting: (value) => {
        currentState.isIntercepting = Boolean(value);
        const config = getWorldbookSwitcherConfig();
        config.simpleMode = Boolean(value);
        saveWorldbookSwitcherConfig(config);
      },
      isIntercepting: () => currentState.isIntercepting,
    };

    console.log('[WorldbookSwitcher] 插件已初始化 v2.0');
  }

  function destroy() {
    worldbookDestroyed = true;

    clearWorldbookTimeouts();
    if (worldbookSetupRetryTimer) {
      clearTimeout(worldbookSetupRetryTimer);
      worldbookSetupRetryTimer = null;
    }

    if (worldbookPanelObserver) {
      worldbookPanelObserver.disconnect();
      worldbookPanelObserver = null;
    }

    if (worldbookNativeIcon && worldbookNativeIconClickHandler) {
      worldbookNativeIcon.removeEventListener('click', worldbookNativeIconClickHandler, true);
    }
    worldbookNativeIcon = null;
    worldbookNativeIconClickHandler = null;

    if (typeof $ === 'function') {
      $(parentDoc).off('.wbmenu');
      $(parentDoc).off('.wbmobilemenu');
      $('#worldbook-switcher-menu', parentDoc).remove();
      $('#worldbook-switcher-mobile-menu', parentDoc).remove();
      $('#wb-native-switch-btn', parentDoc).off('click').remove();
    }

    if (window.WorldbookSwitcher) {
      delete window.WorldbookSwitcher;
    }

    worldbookInitialized = false;
  }

  return { init, destroy };
  })();

  function initWorldbookSwitcher() {
    worldbookSwitcherModule.init();
  }

  function destroyWorldbookSwitcher() {
    worldbookSwitcherModule.destroy();
  }

  function bindTavernEvents() {
    if (typeof tavern_events === 'undefined') {
      warn('tavern_events 不可用，无法完成初始化');
      return;
    }

    bindEvent(tavern_events.APP_READY, onAppReady);
    bindEvent(tavern_events.CHATCOMPLETION_SOURCE_CHANGED, scheduleUiPatch);
    bindEvent(tavern_events.OAI_PRESET_CHANGED_AFTER, scheduleUiPatch);
    bindEvent(tavern_events.GENERATION_STARTED, onGenerationStarted);
    bindEvent(tavern_events.MESSAGE_SENT, onMessageSent);
    bindEvent(tavern_events.MESSAGE_RECEIVED, onMessageReceived);
    bindEvent(tavern_events.MESSAGE_SWIPED, onPairedSwipeMessageSwiped);
    bindEvent(tavern_events.CHAT_COMPLETION_SETTINGS_READY, onChatCompletionSettingsReady);
    bindEvent(tavern_events.GENERATION_STOPPED, onGenerationStopped);
    bindEvent(tavern_events.GENERATION_ENDED, onGenerationEnded);
    bindEvent(tavern_events.CHAT_CHANGED, () => clearPairedSwipeRuntimeState());

    if (typeof iframe_events !== 'undefined' && iframe_events.GENERATION_STARTED) {
      bindEvent(iframe_events.GENERATION_STARTED, onIframeGenerationStarted);
    }

    if (config.old_floor_swipe_enabled) {
      bindOldFloorSwipeEvents();
    }
    const boundEvents = [
      'APP_READY',
      'CHATCOMPLETION_SOURCE_CHANGED',
      'OAI_PRESET_CHANGED_AFTER',
      'GENERATION_STARTED',
      'MESSAGE_SENT',
      'MESSAGE_RECEIVED',
      'MESSAGE_SWIPED',
      'CHAT_COMPLETION_SETTINGS_READY',
      'GENERATION_STOPPED',
      'GENERATION_ENDED',
      'CHAT_CHANGED',
    ];

    if (typeof iframe_events !== 'undefined' && iframe_events.GENERATION_STARTED) {
      boundEvents.push('IFRAME_GENERATION_STARTED');
    }

    if (config.old_floor_swipe_enabled && typeof iframe_events !== 'undefined' && iframe_events.STREAM_TOKEN_RECEIVED_FULLY) {
      boundEvents.push('STREAM_TOKEN_RECEIVED_FULLY');
    }

    debug('事件绑定完成', { events: boundEvents });
  }

  function startMutationObserver() {
    const hostWindow = getHostWindow();
    const hostDocument = getHostDocument();
    const Observer = hostWindow.MutationObserver || window.MutationObserver;
    if (!Observer || mutationObserver) return;
    if (!hostDocument || !hostDocument.body) return;

    mutationObserver = new Observer(() => {
      scheduleUiPatch();
      scheduleDomRebind();
      if (config.old_floor_swipe_enabled) {
        scheduleOldFloorSwipeScan();
      }
    });

    mutationObserver.observe(hostDocument.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-source'],
    });
  }

  function cleanupDomListeners() {
    while (domCleanups.length > 0) {
      const fn = domCleanups.pop();
      try {
        fn();
      } catch {
        // ignore
      }
    }
  }

  function status() {
    const source = getCurrentSource();
    const n = getNValueFromUi();
    const bufferedCount = Array.isArray(activeJob?.bufferedTexts)
      ? activeJob.bufferedTexts.length
      : 0;
    const persistentEnabled = Boolean(config.enabled);
    const temporarySuspended = isTemporarilySuspended();
    const effectiveEnabled = Boolean(persistentEnabled && !temporarySuspended);

    return {
      enabled: persistentEnabled,
      persistent_enabled: persistentEnabled,
      effective_enabled: effectiveEnabled,
      temporary_suspended: temporarySuspended,
      temporary_suspend_count: getTemporarySuspendCount(),
      max_parallel_cap: config.max_parallel_cap,
      retry_count: getConfiguredRetryCount(),
      retry_delay_ms: getConfiguredRetryDelayMs(),
      min_reply_tokens: getConfiguredMinReplyTokens(),
      auction_mode_enabled: isAuctionModeEnabled(),
      silent_mode_enabled: isSilentModeEnabled(),
      parallel_temperatures: getConfiguredParallelTemperatures(),
      status_bar_simple_mode: Boolean(config.status_bar_simple_mode),
      status_bar_vertical: Boolean(config.status_bar_vertical),
      status_bar_opacity_percent: getConfiguredStatusBarOpacityPercent(),
      status_bar_scale_percent: getConfiguredStatusBarScalePercent(),
      old_floor_swipe_enabled: Boolean(config.old_floor_swipe_enabled),
      worldbook_switcher_enabled: Boolean(config.worldbook_switcher_enabled),
      current_source: source,
      current_n: n,
      group_chat: isGroupChat(),
      last_generation_type: lastGenerationType,
      active_job: activeJob
        ? {
            id: activeJob.id,
            state: activeJob.state,
            phase: activeJob.phase,
            source: activeJob.source,
            generationType: activeJob.generationType,
            targetN: activeJob.targetN,
            extraCount: activeJob.extraCount,
            messageId: activeJob.targetMessageId ?? activeJob.messageId ?? null,
            target_message_id: activeJob.targetMessageId ?? activeJob.messageId ?? null,
            foreground_stopped: Boolean(activeJob.foregroundStopped),
            foreground_ended: Boolean(activeJob.foregroundEnded),
            superseded: Boolean(activeJob.superseded),
            auction_enabled: Boolean(activeJob.auctionEnabled),
            winner_source: activeJob.winnerSource || null,
            buffered_count: bufferedCount,
            aborted: activeJob.aborted,
          }
        : null,
    };
  }

  function suspend(reason = '外部任务请求临时挂起 Gemini 并发补全') {
    const ticket = createTemporarySuspendTicket();
    temporarySuspensions.set(ticket, {
      reason: String(reason || '').trim(),
      createdAt: new Date().toISOString(),
    });

    const hadRunningJob = Boolean(activeJob && !isJobTerminal(activeJob));
    if (hadRunningJob) {
      abortActiveJob(String(reason || '插件已临时挂起'));
    }
    refreshStatusBarForRetryState();
    debug('已登记临时挂起', {
      ticket,
      temporarySuspendCount: getTemporarySuspendCount(),
      persistentEnabled: Boolean(config.enabled),
    });
    return {
      ticket,
      ...status(),
    };
  }

  function resume(ticket) {
    const normalizedTicket = String(ticket || '').trim();
    if (!normalizedTicket) {
      return status();
    }
    temporarySuspensions.delete(normalizedTicket);
    refreshStatusBarForRetryState();
    debug('已恢复临时挂起', {
      ticket: normalizedTicket,
      temporarySuspendCount: getTemporarySuspendCount(),
      persistentEnabled: Boolean(config.enabled),
    });
    return status();
  }

  function enable() {
    config.enabled = true;
    saveConfig();
    refreshStatusBarForRetryState();
    successToast('已启用 Gemini 并发补全');
    return status();
  }

  function disable() {
    config.enabled = false;
    saveConfig();
    abortActiveJob('插件已禁用');
    refreshStatusBarForRetryState();
    warningToast('已禁用 Gemini 并发补全');
    return status();
  }

  function abort(reason = '手动中止当前并发任务') {
    const job = activeJob;
    const hadRunningJob = Boolean(job && !isJobTerminal(job));
    abortActiveJob(reason);
    refreshStatusBarForRetryState();
    if (hadRunningJob) {
      warningToast('已中止当前 Gemini 并发任务');
    }
    return status();
  }

  function forcePatchUi() {
    return patchNOpenAiVisibility();
  }

  function exposeDebugApi() {
    const api = {
      status,
      enable,
      disable,
      suspend,
      resume,
      abort,
      forcePatchUi,
      openSettings: () => openSettingsPopup(),
    };
    const hostWindow = getHostWindow();
    if (hostWindow && typeof hostWindow === 'object') {
      hostWindow.GeminiParallelSwipe = api;
    }
    window.GeminiParallelSwipe = api;
    if (typeof globalThis === 'object' && globalThis) {
      globalThis.GeminiParallelSwipe = api;
    }
  }

  function runSafe(label, fn) {
    try {
      return fn();
    } catch (error) {
      warn(`${label} 失败:`, error);
      return undefined;
    }
  }

  function destroy() {
    runSafe('中止并发任务', () => abortActiveJob('脚本实例销毁'));
    runSafe('中止前台校验', () => abortForegroundValidation('脚本实例销毁'));
    activeForegroundSession = null;
    foregroundGenerationRunning = false;
    runSafe('清理成对分支状态', () => clearPairedSwipeRuntimeState());
    runSafe('移除状态栏', () => removeAllParallelStatusBars());
    runSafe('清理前台重试补丁', () => cleanupGenerateFetchRetryPatch());

    runSafe('清理旧楼层 Swipe', () => destroyOldFloorSwipe());
    runSafe('清理 worldbook switcher', () => destroyWorldbookSwitcher());

    while (eventStops.length > 0) {
      const stop = eventStops.pop();
      try {
        stop();
      } catch {
        // ignore
      }
    }

    cleanupDomListeners();

    if (patchTimer) {
      clearTimeout(patchTimer);
      patchTimer = null;
    }
    if (domBindTimer) {
      clearTimeout(domBindTimer);
      domBindTimer = null;
    }

    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    const hostWindow = getHostWindow();
    if (hostWindow && hostWindow.GeminiParallelSwipe) {
      delete hostWindow.GeminiParallelSwipe;
    }
    if (window.GeminiParallelSwipe) {
      delete window.GeminiParallelSwipe;
    }
    if (typeof globalThis === 'object' && globalThis.GeminiParallelSwipe) {
      delete globalThis.GeminiParallelSwipe;
    }

    runSafe('移除状态栏样式', () => removeStatusBarStyle());
  }

  function init() {
    runSafe('reload config', () => reloadConfigFromStorage({ refreshStatusBar: false }));
    // 先暴露 API，避免任何后续模块异常导致调试入口缺失
    exposeDebugApi();
    runSafe('安装前台重试补丁', () => installGenerateFetchRetryPatch());

    if (config.old_floor_swipe_enabled) {
      runSafe('初始化旧楼层 Swipe', () => initOldFloorSwipe());
    }
    if (config.worldbook_switcher_enabled) {
      runSafe('初始化 worldbook switcher', () => initWorldbookSwitcher());
    }

    runSafe('绑定 DOM 事件', () => scheduleDomRebind());
    runSafe('绑定酒馆事件', () => bindTavernEvents());
    runSafe('启动 MutationObserver', () => startMutationObserver());
    runSafe('调度 UI 补丁', () => scheduleUiPatch());

    if (config.old_floor_swipe_enabled) {
      runSafe('调度旧楼层扫描', () => scheduleOldFloorSwipeScan());
    }
    runSafe('刷新状态栏', () => refreshStatusBarForRetryState());
    debug('调试日志开关状态', { enabled: isDebugEnabled(), flagKey: DEBUG_FLAG_KEY });
    log('初始化完成', status());
  }

  globalObj[instanceKey] = { destroy };

  if (typeof $ === 'function') {
    $(init);
  } else {
    setTimeout(init, 0);
  }

  window.addEventListener('pagehide', () => {
    destroy();
  });
})();
