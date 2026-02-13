/**
 * SRE Copilot Browser SDK - Web Vitals, errors, and request timing
 */
import { onCLS, onFCP, onFID, onLCP, onTTFB } from "web-vitals";

/** Web Vitals metric from web-vitals library */
export interface WebVitalsMetric {
  name: string;
  value: number;
  rating?: string;
  delta?: number;
  id?: string;
}

/** JS error event */
export interface ErrorEvent {
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  type?: string;
}

/** Page load timing */
export interface PageLoadEvent {
  dom_content_loaded?: number;
  load_complete?: number;
  first_paint?: number;
  first_contentful_paint?: number;
}

/** AJAX/fetch timing event */
export interface XhrEvent {
  url: string;
  method: string;
  duration_ms?: number;
  status?: number;
  success?: boolean;
}

/** Batch payload sent to collector */
export interface BrowserIngestPayload {
  app_name?: string;
  url?: string;
  web_vitals: Array<{ name: string; value: number; rating?: string; delta?: number; id?: string }>;
  errors: ErrorEvent[];
  page_load?: PageLoadEvent;
  xhr_events: XhrEvent[];
}

/** SDK configuration */
export interface SREBrowserSDKConfig {
  collectorUrl: string;
  apiKey?: string;
  appName?: string;
  sampleRate?: number;
  enabled?: boolean;
  batchInterval?: number;
}

const DEFAULT_CONFIG: Partial<SREBrowserSDKConfig> = {
  sampleRate: 1.0,
  enabled: true,
  batchInterval: 30000,
};

let config: SREBrowserSDKConfig & typeof DEFAULT_CONFIG;
let queue: BrowserIngestPayload = {
  web_vitals: [],
  errors: [],
  xhr_events: [],
};
let batchTimer: ReturnType<typeof setInterval> | null = null;
let pageLoadCollected = false;

function shouldSample(): boolean {
  if (!config.enabled) return false;
  return config.sampleRate! >= 1 || Math.random() < config.sampleRate!;
}

function getUrl(): string {
  return typeof window !== "undefined" ? window.location.href : "";
}

function collectPageLoad(): PageLoadEvent {
  if (typeof performance === "undefined" || !performance.timing) return {};

  const timing = performance.timing;
  const navStart = timing.navigationStart;

  return {
    dom_content_loaded: timing.domContentLoadedEventEnd - navStart,
    load_complete: timing.loadEventEnd - navStart,
    first_paint: undefined,
    first_contentful_paint: undefined,
  };
}

function capturePageLoad(): void {
  if (pageLoadCollected || !shouldSample()) return;
  pageLoadCollected = true;

  if (document.readyState === "complete") {
    queue.page_load = collectPageLoad();
  } else {
    window.addEventListener("load", () => {
      queue.page_load = collectPageLoad();
    });
  }

  // First Contentful Paint from Performance Observer if available
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint" && entry.startTime) {
          queue.page_load = queue.page_load || {};
          queue.page_load.first_contentful_paint = entry.startTime;
          break;
        }
      }
    });
    po.observe({ type: "paint", buffered: true });
  } catch {
    // Ignore
  }
}

function captureJsErrors(): void {
  window.onerror = (message, filename, lineno, colno, error) => {
    if (!shouldSample()) return;
    queue.errors.push({
      message: String(message),
      filename: filename ?? undefined,
      lineno: lineno ?? undefined,
      colno: colno ?? undefined,
      stack: error?.stack,
      type: "error",
    });
  };

  window.addEventListener("unhandledrejection", (event) => {
    if (!shouldSample()) return;
    queue.errors.push({
      message: event.reason?.message ?? String(event.reason),
      type: "unhandledrejection",
    });
  });
}

function captureXhr(): void {
  const origXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args: unknown[]) {
    const xhr = this;
    const start = performance.now();
    const originalOnReadyStateChange = xhr.onreadystatechange;

    xhr.addEventListener("loadend", () => {
      if (!shouldSample()) return;
      const duration = performance.now() - start;
      let url = "";
      try {
        url = (xhr as unknown as { responseURL?: string }).responseURL ?? "";
      } catch {
        // Ignore
      }
      queue.xhr_events.push({
        url,
        method: (xhr as unknown as { _method?: string })._method ?? "GET",
        duration_ms: Math.round(duration),
        status: xhr.status,
        success: xhr.status >= 200 && xhr.status < 400,
      });
      queue.xhr_events = queue.xhr_events.slice(-50);
    });

    return origXhrSend.apply(this, args as [Document | XMLHttpRequestBodyInit | null]);
  };

  const origFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const start = performance.now();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const method = (init?.method ?? (typeof input === "object" && "method" in input ? (input as Request).method : "GET")) as string;

    return origFetch.apply(this, [input, init]).then((response) => {
      if (shouldSample()) {
        const duration = performance.now() - start;
        queue.xhr_events.push({
          url,
          method,
          duration_ms: Math.round(duration),
          status: response.status,
          success: response.ok,
        });
        queue.xhr_events = queue.xhr_events.slice(-50);
      }
      return response;
    });
  };
}

function flush(): void {
  const hasData =
    queue.web_vitals.length > 0 ||
    queue.errors.length > 0 ||
    queue.page_load ||
    queue.xhr_events.length > 0;

  if (!hasData) return;

  const payload: BrowserIngestPayload = {
    app_name: config.appName,
    url: getUrl(),
    web_vitals: [...queue.web_vitals],
    errors: [...queue.errors],
    page_load: queue.page_load,
    xhr_events: [...queue.xhr_events],
  };

  queue.web_vitals = [];
  queue.errors = [];
  queue.page_load = undefined;
  queue.xhr_events = [];

  const endpoint = `${config.collectorUrl.replace(/\/$/, "")}/browser`;
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) {
    headers["X-API-Key"] = config.apiKey;
  }

  // sendBeacon does not support custom headers; use fetch when API key is required
  if (config.apiKey) {
    fetch(endpoint, {
      method: "POST",
      body,
      headers,
      keepalive: true,
    }).catch(() => {});
  } else if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, body);
  } else {
    fetch(endpoint, {
      method: "POST",
      body,
      headers,
      keepalive: true,
    }).catch(() => {});
  }
}

function setupWebVitals(): void {
  const report = (metric: { name: string; value: number; rating?: string; delta?: number; id?: string }) => {
    if (!shouldSample()) return;
    queue.web_vitals.push({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
    });
  };

  onCLS(report);
  onFCP(report);
  onFID(report);  // First Input Delay
  onLCP(report);
  onTTFB(report);
}

function scheduleFlush(): void {
  if (batchTimer) clearInterval(batchTimer);
  batchTimer = setInterval(flush, config.batchInterval ?? 30000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}

/**
 * Initialize the SRE Copilot Browser SDK.
 * Call this once when your app loads.
 */
export function init(options: SREBrowserSDKConfig): void {
  config = { ...DEFAULT_CONFIG, ...options };
  if (!config.collectorUrl) {
    console.warn("[SRE Copilot SDK] collectorUrl is required");
    return;
  }
  if (!config.enabled) return;

  queue.app_name = config.appName;
  queue.url = getUrl();

  capturePageLoad();
  captureJsErrors();
  captureXhr();
  setupWebVitals();
  scheduleFlush();
}

export default { init };
