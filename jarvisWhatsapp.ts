import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { analyzeClientMessage } from './jarvisOllama.js';
import { listLeads, updateLead } from './persistence.js';

const runtimeDir = path.join(process.cwd(), 'runtime');
const statePath = path.join(runtimeDir, 'jarvis-whatsapp.json');
const profileDir = path.join(runtimeDir, 'whatsapp-profile');
const senderLockPath = path.join(runtimeDir, 'whatsapp-sender.lock');
const MAX_EVENTS = 100;
export const DEFAULT_AUTOMATION_INTERVAL_SEC = 5;
export const MIN_AUTOMATION_INTERVAL_SEC = 1;
export const MAX_AUTOMATION_INTERVAL_SEC = 3600;

export type WhatsAppBrowserStatus = 'disconnected' | 'checking' | 'ready' | 'needs_login' | 'error';
export type JarvisEventType = 'info' | 'incoming' | 'draft' | 'sent' | 'escalated' | 'error';

export type JarvisEvent = {
  id: string;
  createdAt: string;
  type: JarvisEventType;
  leadId?: string;
  leadName?: string;
  summary: string;
};

export type JarvisRuntime = {
  browser: {
    status: WhatsAppBrowserStatus;
    lastChangeAt?: string;
    lastError?: string;
    title?: string;
  };
  autoProcessing: boolean;
  sendEnabled: boolean;
  testMode: boolean;
  automationIntervalSec: number;
  testPreparation?: {
    phone: string;
    name: string;
    text: string;
    preparedAt: string;
  };
  lastIncomingCheckAt?: string;
  lastIncomingCount: number;
  lastIncomingSkipped: number;
  events: JarvisEvent[];
};

type BrowserMessage = {
  messageId: string;
  leadId: string;
  chatId: string;
  text: string;
  timestamp: string;
};

type StoredLead = any;

export function parseAutomationInterval(value: unknown): number | undefined {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : NaN;
  if (!Number.isSafeInteger(numeric) || numeric < MIN_AUTOMATION_INTERVAL_SEC || numeric > MAX_AUTOMATION_INTERVAL_SEC) return undefined;
  return numeric;
}

export function normalizeAutomationInterval(value: unknown): number {
  return parseAutomationInterval(value) ?? DEFAULT_AUTOMATION_INTERVAL_SEC;
}

type AdapterResponse = {
  requestId?: string;
  ok: boolean;
  status?: WhatsAppBrowserStatus;
  error?: string;
  [key: string]: any;
};

class WhatsAppAdapterTimeoutError extends Error {
  readonly code = 'WHATSAPP_ADAPTER_TIMEOUT';

  constructor() {
    super('Локальный адаптер WhatsApp Web не ответил вовремя; результат отправки неопределён.');
    this.name = 'WhatsAppAdapterTimeoutError';
  }
}

class WhatsAppAdapter {
  private child?: ChildProcessWithoutNullStreams;
  private pending = new Map<string, { resolve: (value: AdapterResponse) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();

  private start(): ChildProcessWithoutNullStreams {
    if (this.child && this.child.exitCode === null) return this.child;
    const python = process.env.PYTHON_BIN?.trim() || 'python';
    const child = spawn(python, ['scripts/whatsapp_web.py', '--server', profileDir], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      try {
        const response = JSON.parse(line) as AdapterResponse;
        const pending = response.requestId ? this.pending.get(response.requestId) : undefined;
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(response.requestId!);
        pending.resolve(response);
      } catch {
        // The adapter protocol is JSONL; diagnostics remain on stderr.
      }
    });
    child.on('error', (error) => this.rejectAll(error instanceof Error ? error : new Error(String(error))));
    child.on('exit', (code, signal) => {
      this.child = undefined;
      this.rejectAll(new Error(`Локальный адаптер WhatsApp Web завершился (${code ?? signal ?? 'unknown'}).`));
    });
    child.stderr.on('data', (chunk) => {
      console.error(`[whatsapp-adapter] ${String(chunk).trim()}`);
    });
    this.child = child;
    return child;
  }

  private rejectAll(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  request(payload: Record<string, unknown>, timeout: number): Promise<AdapterResponse> {
    const child = this.start();
    const requestId = `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        // A timed-out Playwright request may still be inside a browser action.
        // Kill that adapter and fail closed so automation cannot move to the
        // next lead or retry an operation whose delivery is unknown.
        this.stop();
        reject(new WhatsAppAdapterTimeoutError());
      }, timeout);
      this.pending.set(requestId, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ ...payload, requestId })}\n`, (error) => {
        if (!error) return;
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(error);
      });
    });
  }

  stop() {
    if (!this.child || this.child.exitCode !== null) return;
    this.child.kill();
    this.child = undefined;
  }
}

const whatsappAdapter = new WhatsAppAdapter();

const defaultRuntime = (): JarvisRuntime => ({
  browser: { status: 'disconnected' },
  autoProcessing: false,
  sendEnabled: false,
  testMode: true,
  automationIntervalSec: DEFAULT_AUTOMATION_INTERVAL_SEC,
  lastIncomingCount: 0,
  lastIncomingSkipped: 0,
  events: []
});

function readRuntime(): JarvisRuntime {
  try {
    const parsed = JSON.parse(readFileSync(statePath, 'utf8')) as Partial<JarvisRuntime>;
    return {
      ...defaultRuntime(),
      ...parsed,
      browser: { ...defaultRuntime().browser, ...(parsed.browser ?? {}) },
      automationIntervalSec: normalizeAutomationInterval(parsed.automationIntervalSec),
      events: Array.isArray(parsed.events) ? parsed.events.slice(0, MAX_EVENTS) : []
    };
  } catch {
    return defaultRuntime();
  }
}

function writeRuntime(runtime: JarvisRuntime): JarvisRuntime {
  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(runtime, null, 2), 'utf8');
  return runtime;
}

function addEvent(event: Omit<JarvisEvent, 'id' | 'createdAt'>): JarvisEvent {
  const runtime = readRuntime();
  const saved: JarvisEvent = { id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), ...event };
  writeRuntime({ ...runtime, events: [saved, ...runtime.events].slice(0, MAX_EVENTS) });
  return saved;
}

async function runBrowser(payload: Record<string, unknown>, timeout = 45_000): Promise<any> {
  let result: AdapterResponse;
  try {
    result = await whatsappAdapter.request(payload, timeout);
  } catch (error: any) {
    if (error?.code === 'WHATSAPP_ADAPTER_TIMEOUT') {
      throw Object.assign(error, { browserResult: { status: 'error', error: error.message } });
    }
    throw error;
  }
  if (!result.ok) throw Object.assign(new Error(result.error || 'WhatsApp Web недоступен.'), { browserResult: result });
  return result;
}

let browserQueue: Promise<unknown> = Promise.resolve();
let automationWaitAbortController: AbortController | undefined;
let autonomousCycleInFlight = false;
let senderLockOwned = false;
let releaseSenderLockWhenIdle = false;

function isProcessRunning(pid: unknown): boolean {
  if (!Number.isSafeInteger(pid) || Number(pid) <= 0) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (error: any) {
    return error?.code === 'EPERM';
  }
}

function acquireSenderLock(): boolean {
  if (senderLockOwned) return true;
  mkdirSync(runtimeDir, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const descriptor = openSync(senderLockPath, 'wx');
      writeFileSync(descriptor, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }), 'utf8');
      closeSync(descriptor);
      senderLockOwned = true;
      return true;
    } catch (error: any) {
      if (error?.code !== 'EEXIST') return false;
      try {
        const owner = JSON.parse(readFileSync(senderLockPath, 'utf8')) as { pid?: number };
        if (isProcessRunning(owner.pid)) return false;
        unlinkSync(senderLockPath);
      } catch {
        // A lock from a crashed process can be incomplete. Treat it as stale;
        // the exclusive open on the next iteration remains the final guard.
        try { unlinkSync(senderLockPath); } catch { return false; }
      }
    }
  }
  return false;
}

function releaseSenderLock(): void {
  releaseSenderLockWhenIdle = false;
  if (!senderLockOwned) return;
  try {
    const owner = JSON.parse(readFileSync(senderLockPath, 'utf8')) as { pid?: number };
    if (owner.pid === process.pid) unlinkSync(senderLockPath);
  } catch {
    // The lock may already have been removed after an abnormal termination.
  }
  senderLockOwned = false;
}

function releaseSenderLockWhenSafe(): void {
  if (autonomousCycleInFlight) {
    releaseSenderLockWhenIdle = true;
    return;
  }
  releaseSenderLock();
}

process.once('exit', releaseSenderLock);

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const next = browserQueue.then(operation, operation);
  browserQueue = next.then(() => undefined, () => undefined);
  return next;
}

function setBrowserState(patch: Partial<JarvisRuntime['browser']>): JarvisRuntime {
  const runtime = readRuntime();
  return writeRuntime({ ...runtime, browser: { ...runtime.browser, ...patch } });
}

export function getJarvisRuntime(): JarvisRuntime {
  return readRuntime();
}

/**
 * A server restart must never resume outreach from a persisted JSON state.
 * The user has to press Start again after every ClientHunter restart.
 */
export function initializeWhatsAppRuntimeForServerStart(): JarvisRuntime {
  const previous = readRuntime();
  const runtime = writeRuntime({
    ...previous,
    autoProcessing: false,
    sendEnabled: false,
    testMode: true,
    browser: {
      ...previous.browser,
      status: 'disconnected',
      lastChangeAt: new Date().toISOString(),
      lastError: undefined
    },
    testPreparation: undefined
  });
  if (previous.autoProcessing || previous.sendEnabled) {
    addEvent({ type: 'info', summary: 'После перезапуска ClientHunter автоотправка не возобновляется. Нажмите «Запустить», когда будете готовы.' });
  }
  return runtime;
}

export function setAutoProcessing(enabled: boolean): JarvisRuntime {
  if (enabled && !acquireSenderLock()) {
    throw new Error('Другой экземпляр ClientHunter уже выполняет отправку WhatsApp. Остановите его перед новым запуском.');
  }
  if (!enabled) {
    automationWaitAbortController?.abort();
    automationWaitAbortController = undefined;
    releaseSenderLockWhenSafe();
  }
  const runtime = writeRuntime({ ...readRuntime(), autoProcessing: enabled });
  addEvent({ type: 'info', summary: enabled ? 'Автономный цикл Jarvis включён: первичные контакты и входящие обрабатываются в фоне.' : 'Автономный цикл Jarvis остановлен.' });
  if (enabled) void runAutonomousCycle();
  return runtime;
}

export function setSendEnabled(enabled: boolean): JarvisRuntime {
  const runtime = writeRuntime({ ...readRuntime(), sendEnabled: enabled, testMode: !enabled });
  addEvent({ type: 'info', summary: enabled ? 'Автоматическая отправка включена.' : 'Тестовый режим: реальные ответы не отправляются.' });
  return runtime;
}

export function setAutomationInterval(value: unknown): JarvisRuntime {
  const intervalSec = parseAutomationInterval(value);
  if (intervalSec === undefined) throw new Error('Интервал должен быть целым числом от 1 до 3600 секунд.');
  return writeRuntime({ ...readRuntime(), automationIntervalSec: intervalSec });
}

export function waitForAutomationInterval(intervalSec: number, signal?: AbortSignal): Promise<boolean> {
  const delayMs = normalizeAutomationInterval(intervalSec) * 1000;
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (completed: boolean) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      resolve(completed);
    };
    const timer = setTimeout(() => finish(true), delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      finish(false);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function connectWhatsApp(): Promise<JarvisRuntime> {
  setBrowserState({ status: 'checking', lastError: undefined });
  try {
    let result: any;
    for (let attempt = 0; attempt < 5; attempt++) {
      result = await serialized(() => runBrowser({ action: 'status' }));
      if (result.status !== 'loading') break;
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    const runtime = setBrowserState({ status: result.status, title: result.title, lastChangeAt: new Date().toISOString(), lastError: undefined });
    addEvent({ type: 'info', summary: result.status === 'ready' ? 'WhatsApp Web подключён через локальный браузер.' : 'Открыто локальное окно WhatsApp Web. Требуется вход по QR-коду.' });
    return runtime;
  } catch (error: any) {
    const browserResult = error.browserResult;
    return setBrowserState({ status: browserResult?.status === 'needs_login' ? 'needs_login' : 'error', lastChangeAt: new Date().toISOString(), lastError: error.message || 'Не удалось открыть WhatsApp Web.' });
  }
}

export function disconnectWhatsApp(): JarvisRuntime {
  whatsappAdapter.stop();
  automationWaitAbortController?.abort();
  automationWaitAbortController = undefined;
  releaseSenderLockWhenSafe();
  const runtime = writeRuntime({ ...readRuntime(), autoProcessing: false, sendEnabled: false, testMode: true, browser: { ...readRuntime().browser, status: 'disconnected', lastChangeAt: new Date().toISOString() } });
  addEvent({ type: 'info', summary: 'Локальная автоматизация WhatsApp остановлена.' });
  return runtime;
}

export async function sendTestMessage(chatName: string, text: string): Promise<{ messageId: string; sentAt: string }> {
  const cleanText = repairUtf8Mojibake(text.trim());
  try {
    const result = await serialized(async () => {
      if (chatName.trim().toLowerCase() === 'вы' || chatName.trim().toLowerCase() === 'you') {
        await runBrowser({ action: 'debug-click-you' }, 30_000);
        return runBrowser({ action: 'send-current-test', text: cleanText }, 60_000);
      }
      return runBrowser({ action: 'send-test', name: chatName, text: cleanText }, 60_000);
    });
    setBrowserState({ status: 'ready', lastChangeAt: new Date().toISOString(), lastError: undefined });
    addEvent({ type: 'sent', summary: `Jarvis отправил проверочное сообщение в выбранный чат «${chatName}» через обычный WhatsApp Web.` });
    return { messageId: result.messageId, sentAt: result.sentAt };
  } catch (error: any) {
    const browserResult = error.browserResult;
    const status = browserResult?.status === 'needs_login' ? 'needs_login' : 'error';
    const saved = setBrowserState({ status, lastChangeAt: new Date().toISOString(), lastError: error.message || 'Тестовое сообщение не отправлено.' });
    addEvent({ type: 'error', summary: saved.browser.lastError || 'Тестовое сообщение не отправлено.' });
    throw error;
  }
}

export async function debugWhatsApp(): Promise<any> {
  return serialized(() => runBrowser({ action: 'debug-current' }, 20_000));
}

export async function debugOpenWhatsApp(chatName: string): Promise<any> {
  return serialized(() => runBrowser({ action: 'debug-open', name: chatName }, 30_000));
}

export async function clearWhatsAppSearch(): Promise<any> {
  return serialized(() => runBrowser({ action: 'clear-search' }, 30_000));
}

export async function debugClickYou(): Promise<any> {
  const result = await serialized(() => runBrowser({ action: 'debug-click-you' }, 30_000));
  if (result.status === 'ready') setBrowserState({ status: 'ready', lastChangeAt: new Date().toISOString(), lastError: undefined });
  return result;
}

function normalizedPhone(lead: StoredLead): string {
  const raw = String(lead.phones?.find((phone: any) => phone.normalized)?.normalized || lead.phone || '');
  const digits = raw.replace(/\D/g, '');
  if (/^8\d{10}$/.test(digits)) return `7${digits.slice(1)}`;
  if (/^7\d{10}$/.test(digits)) return digits;
  return digits;
}

function repairUtf8Mojibake(value: string): string {
  if (!/[РС][\u0080-\u00bf]/.test(value)) return value;
  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8');
    return repaired.includes('\uFFFD') ? value : repaired;
  } catch {
    return value;
  }
}

function sentHistory(lead: StoredLead): any[] {
  return (Array.isArray(lead.conversationHistory) ? lead.conversationHistory : []).filter((message: any) =>
    (message.sender === 'user' || message.sender === 'jarvis') && message.delivery !== 'draft' && message.delivery !== 'not_sent'
  );
}

function knownMessageIds(lead: StoredLead): string[] {
  return (Array.isArray(lead.conversationHistory) ? lead.conversationHistory : [])
    .map((message: any) => message.whatsappId)
    .filter(Boolean);
}

function incomingFingerprint(message: Pick<BrowserMessage, 'chatId' | 'timestamp' | 'text'>): string {
  return `${message.chatId}|${message.timestamp}|${message.text.trim()}`;
}

function findIncoming(lead: StoredLead, message: BrowserMessage): boolean {
  const history = Array.isArray(lead.conversationHistory) ? lead.conversationHistory : [];
  return history.some((item: any) => item.whatsappId === message.messageId || incomingFingerprint({ chatId: message.chatId, timestamp: item.timestamp, text: item.text }) === incomingFingerprint(message));
}

function appendIncoming(lead: StoredLead, message: BrowserMessage): StoredLead | undefined {
  if (findIncoming(lead, message)) return lead;
  const history = Array.isArray(lead.conversationHistory) ? [...lead.conversationHistory] : [];
  history.push({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: 'client',
    text: message.text,
    timestamp: message.timestamp,
    whatsappId: message.messageId,
    chatId: message.chatId,
    delivery: 'received'
  });
  return updateLead(lead.id, {
    conversationHistory: history,
    lastClientMessage: message.text,
    lastClientMessageAt: message.timestamp,
    conversationStatus: 'needs_reply',
    followUpStatus: 'paused',
    followUpDueAt: undefined,
    followUpPauseReason: 'client_replied',
    nextRecommendedAction: 'Новый входящий ответ найден. Проверьте анализ Jarvis.'
  });
}

function existingJarvisReply(lead: StoredLead, inboundId: string): any | undefined {
  return (Array.isArray(lead.conversationHistory) ? lead.conversationHistory : []).find((message: any) => message.sender === 'jarvis' && message.inReplyTo === inboundId);
}

function appendJarvisMessage(lead: StoredLead, message: any): StoredLead | undefined {
  const history = Array.isArray(lead.conversationHistory) ? [...lead.conversationHistory, message] : [message];
  return updateLead(lead.id, { conversationHistory: history });
}

/**
 * Send the prepared first message for a CRM lead through the same local
 * WhatsApp Web adapter used by Jarvis replies. The CRM is updated only after
 * the adapter confirms that WhatsApp accepted the message.
 */
const initialSendsInFlight = new Set<string>();

export async function sendInitialMessage(leadId: string, textOverride?: string): Promise<{ lead: StoredLead; messageId: string; sentAt: string }> {
  if (initialSendsInFlight.size > 0) throw new Error('Уже выполняется отправка WhatsApp. Дождитесь её завершения.');
  initialSendsInFlight.add(leadId);
  try {
    return await sendInitialMessageOnce(leadId, textOverride, false);
  } finally {
    initialSendsInFlight.delete(leadId);
  }
}

async function sendQueuedInitialMessage(leadId: string): Promise<{ lead: StoredLead; messageId: string; sentAt: string }> {
  if (initialSendsInFlight.size > 0) throw new Error('Уже выполняется отправка WhatsApp. Дождитесь её завершения.');
  initialSendsInFlight.add(leadId);
  try {
    return await sendInitialMessageOnce(leadId, undefined, true);
  } finally {
    initialSendsInFlight.delete(leadId);
  }
}

async function sendInitialMessageOnce(leadId: string, textOverride: string | undefined, fromAutonomousQueue: boolean): Promise<{ lead: StoredLead; messageId: string; sentAt: string }> {
  if (getJarvisRuntime().autoProcessing && !fromAutonomousQueue) {
    throw new Error('Идёт автоматическая очередь. Отдельная отправка остановлена, чтобы сохранить выбранный интервал.');
  }
  const lead = listLeads().find((item: any) => item.id === leadId);
  if (!lead) throw new Error('Лид не найден.');
  if (lead.whatsappSendAttemptAt) throw new Error('Для этого лида уже начиналась отправка с неопределённым результатом. Повтор заблокирован во избежание дубликата; сначала сверьте чат WhatsApp и CRM.');
  if (!isInitialOutreachCandidate(lead)) throw new Error('Лид не готов к отправке: нужны доступный номер WhatsApp, customPitch и статус prepared/approved; уже отправленные, закрытые и взятые вручную лиды исключены.');
  if (lead.whatsappSentAt) throw new Error('Первичное сообщение для этого лида уже зафиксировано как отправленное.');

  const phone = normalizedPhone(lead);
  if (phone.length < 8) throw new Error('У лида нет корректного нормализованного номера WhatsApp.');
  const text = repairUtf8Mojibake(String(textOverride || lead.customPitch || '').trim());
  if (!text) throw new Error('У лида нет подготовленного персонального сообщения.');

  const existingHistory = Array.isArray(lead.conversationHistory) ? lead.conversationHistory : [];
  const duplicate = existingHistory.find((message: any) =>
    (message.sender === 'jarvis' || message.sender === 'user') &&
    !message.inReplyTo &&
    (message.delivery === 'sent' || message.delivery === 'delivered' || message.delivery === 'read')
  );
  if (duplicate) throw new Error('В истории уже есть отправленное первичное сообщение для этого лида.');

  try {
    const sendStartedAt = new Date().toISOString();
    const reserved = updateLead(lead.id, { whatsappSendAttemptAt: sendStartedAt, jarvisStatus: 'sending', jarvisLastError: undefined });
    if (!reserved) throw new Error('Не удалось сохранить отметку попытки отправки в CRM; сообщение не отправлено.');
    const result = await serialized(() => runBrowser({ action: 'send', phone, name: lead.name, text }, 60_000));
    if (typeof result.messageId !== 'string' || !result.messageId.trim() || typeof result.sentAt !== 'string' || !result.sentAt.trim()) {
      throw Object.assign(new Error('WhatsApp Web не вернул однозначное подтверждение отправки.'), { browserResult: { status: 'error' } });
    }
    const sentAt = String(result.sentAt || new Date().toISOString());
    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: 'jarvis',
      text,
      timestamp: sentAt,
      sendStartedAt,
      sendConfirmedAt: sentAt,
      whatsappId: result.messageId,
      chatId: phone,
      delivery: result.deliveryStatus === 'read' ? 'read' : result.deliveryStatus === 'delivered' ? 'delivered' : 'sent',
      whatsappDeliveryStatus: result.deliveryStatus || 'sent',
      category: 'initial-outreach'
    };
    const updated = updateLead(lead.id, {
      whatsappSentAt: sentAt,
      status: 'contacted',
      conversationStatus: 'awaiting_reply',
      conversationHistory: [...existingHistory, message],
      followUpStatus: 'active',
      followUpStep: 0,
      jarvisStatus: 'replied',
      jarvisLastError: undefined,
      nextRecommendedAction: 'Ожидайте ответ клиента в WhatsApp.'
    });
    if (!updated) throw new Error('Сообщение отправлено, но CRM не смогла сохранить факт отправки.');
    setBrowserState({ status: 'ready', lastChangeAt: new Date().toISOString(), lastError: undefined });
    addEvent({ type: 'sent', leadId: lead.id, leadName: lead.name, summary: `Сообщение для ${lead.name} появилось в исходящих WhatsApp Web; CRM обновлена. Отправка начата ${sendStartedAt}, подтверждена ${sentAt}. Это подтверждение отправки, не доставки.` });
    return { lead: updated, messageId: result.messageId, sentAt };
  } catch (error: any) {
    const browserResult = error.browserResult;
    const safeToSkip = browserResult?.safeToSkip === true && browserResult?.status === 'ready';
    if (lead.whatsappSendAttemptAt || listLeads().find((item: any) => item.id === lead.id)?.whatsappSendAttemptAt) {
      updateLead(lead.id, safeToSkip
        ? { whatsappSendAttemptAt: undefined, jarvisStatus: 'error', jarvisLastError: error.message || 'Чат недоступен; отправка не начиналась.' }
        : { jarvisStatus: 'send_uncertain', jarvisLastError: error.message || 'Результат отправки не подтверждён; повтор заблокирован.' });
    }
    setBrowserState({
      status: safeToSkip ? 'ready' : browserResult?.status === 'needs_login' ? 'needs_login' : browserResult ? 'error' : readRuntime().browser.status,
      lastChangeAt: new Date().toISOString(),
      lastError: safeToSkip ? undefined : error.message || 'Jarvis не смог отправить первичное сообщение через WhatsApp Web.'
    });
    addEvent({ type: 'error', leadId: lead.id, leadName: lead.name, summary: `Jarvis не отправил сообщение ${lead.name}: ${error.message || 'ошибка WhatsApp Web'}.` });
    throw error;
  }
}

const CONTROLLED_TEST_PHONE = '77787152085';
const CONTROLLED_TEST_NAME = 'ВЫ';

function normalizeTestPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (/^8\d{10}$/.test(digits)) return `7${digits.slice(1)}`;
  return digits;
}

function assertControlledTestContact(phone: string, name: string): string {
  const normalized = normalizeTestPhone(phone);
  if (normalized !== CONTROLLED_TEST_PHONE || name.trim().toLocaleLowerCase() !== CONTROLLED_TEST_NAME.toLocaleLowerCase()) {
    throw new Error(`Тест разрешён только для контрольного контакта «${CONTROLLED_TEST_NAME}» (${CONTROLLED_TEST_PHONE}).`);
  }
  if (listLeads().some((lead: any) => normalizedPhone(lead) === normalized)) {
    throw new Error('Контрольный тестовый номер найден среди CRM-лидов и не может использоваться как отдельный тестовый контакт.');
  }
  return normalized;
}

export async function prepareControlledTestCycle(text: string): Promise<any> {
  const cleanText = repairUtf8Mojibake(text.trim());
  if (!cleanText) throw new Error('Укажите текст тестового сообщения.');
  const phone = assertControlledTestContact(CONTROLLED_TEST_PHONE, CONTROLLED_TEST_NAME);
  const result = await serialized(() => runBrowser({ action: 'prepare-test', phone, name: CONTROLLED_TEST_NAME, text: cleanText }, 60_000));
  const preparedAt = new Date().toISOString();
  writeRuntime({
    ...readRuntime(),
    autoProcessing: false,
    sendEnabled: false,
    testMode: true,
    testPreparation: { phone, name: CONTROLLED_TEST_NAME, text: cleanText, preparedAt }
  });
  setBrowserState({ status: 'ready', lastChangeAt: preparedAt, lastError: undefined });
  addEvent({ type: 'info', summary: `Тестовый контакт ${CONTROLLED_TEST_NAME} проверен: чат открыт, текст подготовлен без отправки.` });
  return { ...result, phone, name: CONTROLLED_TEST_NAME, text: cleanText, preparedAt, crmRecorded: false };
}

export async function sendPreparedControlledTestCycle(): Promise<any> {
  const preparation = readRuntime().testPreparation;
  if (!preparation) throw new Error('Сначала подготовьте тестовый контакт без отправки.');
  const phone = assertControlledTestContact(preparation.phone, preparation.name);
  setAutoProcessing(false);
  setSendEnabled(false);
  try {
    const result = await serialized(() => runBrowser({ action: 'send', phone, name: preparation.name, text: preparation.text }, 60_000));
    const intervalSec = readRuntime().automationIntervalSec;
    const controller = new AbortController();
    automationWaitAbortController = controller;
    const waited = await waitForAutomationInterval(intervalSec, controller.signal);
    if (automationWaitAbortController === controller) automationWaitAbortController = undefined;
    writeRuntime({ ...readRuntime(), autoProcessing: false, sendEnabled: false, testMode: true, testPreparation: undefined });
    addEvent({ type: 'sent', summary: `Контрольное сообщение для ${preparation.name} подтверждено WhatsApp Web; тестовый цикл остановлен после паузы ${intervalSec} сек.` });
    return { ...result, phone, name: preparation.name, text: preparation.text, intervalSec, waited, crmRecorded: false };
  } catch (error: any) {
    writeRuntime({ ...readRuntime(), autoProcessing: false, sendEnabled: false, testMode: true });
    addEvent({ type: 'error', summary: `Контрольный тест не завершён: ${error.message || 'ошибка WhatsApp Web'}.` });
    throw error;
  }
}

async function processIncoming(lead: StoredLead, incoming: BrowserMessage, sendEnabled: boolean): Promise<void> {
  const current = listLeads().find((item: any) => item.id === lead.id) || lead;
  if (current.jarvisManualControl || current.isRefused || current.status === 'lost') return;
  const previous = existingJarvisReply(current, incoming.messageId);
  if (previous?.delivery === 'sent' || previous?.delivery === 'pending' || previous?.delivery === 'failed' || previous?.delivery === 'not_sent') return;

  let response = previous;
  if (!response) {
    let analysis;
    try {
      analysis = await analyzeClientMessage({ leadId: current.id, clientMessage: incoming.text, context: 'Входящее сообщение получено через локальную сессию WhatsApp Web.' });
    } catch (error: any) {
      updateLead(current.id, { jarvisStatus: 'error', jarvisLastError: error.message || 'Локальная Ollama не вернула анализ входящего.' });
      addEvent({ type: 'error', leadId: current.id, leadName: current.name, summary: `Не удалось проанализировать входящий ответ от ${current.name}: ${error.message || 'ошибка Ollama'}.` });
      return;
    }
    const requiresHuman = analysis.isRefusal || analysis.needsHuman || analysis.status === 'discussing_terms' || /цен|стоим|срок|договор|скид|индивидуал/i.test(`${analysis.category} ${analysis.intent} ${analysis.recommendedAction}`);
    const delivery = requiresHuman ? 'not_sent' : sendEnabled ? 'pending' : 'draft';
    response = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: 'jarvis',
      text: analysis.proposedReply || analysis.recommendedAction,
      timestamp: new Date().toISOString(),
      category: analysis.category,
      intent: analysis.intent,
      recommendedAction: analysis.recommendedAction,
      delivery,
      inReplyTo: incoming.messageId
    };
    const updated = appendJarvisMessage(current, response);
    if (!updated) return;
    const summary = requiresHuman ? `Нужна ручная проверка ответа для ${current.name}.` : sendEnabled ? `Jarvis готовит ответ для ${current.name}.` : `Черновик ответа для ${current.name} создан в тестовом режиме.`;
    addEvent({ type: requiresHuman ? 'escalated' : 'draft', leadId: current.id, leadName: current.name, summary });
    if (requiresHuman || !sendEnabled) {
      updateLead(current.id, { conversationStatus: analysis.isRefusal ? 'refused' : 'needs_reply', isRefused: analysis.isRefusal || current.isRefused, jarvisStatus: analysis.isRefusal ? 'refused' : 'needs_human' });
      return;
    }
  }

  try {
    const result = await serialized(() => runBrowser({ action: 'send', phone: normalizedPhone(current), name: current.name, text: response.text }, 60_000));
    const latest = listLeads().find((item: any) => item.id === current.id) || current;
    const history = Array.isArray(latest.conversationHistory) ? latest.conversationHistory.map((item: any) => item.id === response.id ? { ...item, delivery: 'sent', whatsappId: result.messageId, timestamp: result.sentAt } : item) : [];
    updateLead(current.id, { conversationHistory: history, conversationStatus: 'awaiting_reply', jarvisStatus: 'replied', jarvisLastError: undefined, nextRecommendedAction: 'Ответ Jarvis отправлен через WhatsApp Web.' });
    addEvent({ type: 'sent', leadId: current.id, leadName: current.name, summary: `Ответ Jarvis отправлен ${current.name} через WhatsApp Web.` });
  } catch (error: any) {
    const latest = listLeads().find((item: any) => item.id === current.id) || current;
    const history = Array.isArray(latest.conversationHistory) ? latest.conversationHistory.map((item: any) => item.id === response.id ? { ...item, delivery: 'failed', error: error.message || 'Не удалось отправить через WhatsApp Web.' } : item) : [];
    updateLead(current.id, { conversationHistory: history, conversationStatus: 'needs_reply', jarvisStatus: 'error', jarvisLastError: error.message || 'Не удалось отправить через WhatsApp Web.', nextRecommendedAction: 'Проверьте WhatsApp Web и отправьте ответ вручную.' });
    addEvent({ type: 'error', leadId: current.id, leadName: current.name, summary: `Ошибка отправки ответа для ${current.name}: ${error.message || 'неизвестная ошибка'}` });
  }
}

function initialOutreachCandidates(): StoredLead[] {
  return selectAutonomousOutreachCandidates(listLeads());
}

/** A prepared, WhatsApp-capable lead with no confirmed or uncertain prior outreach. */
export function isInitialOutreachCandidate(lead: StoredLead): boolean {
  const rawPhone = String(lead.phones?.find((phone: any) => phone.normalized)?.normalized || lead.phone || '');
  const phone = rawPhone.replace(/\D/g, '');
  const hasInitialSendInHistory = (Array.isArray(lead.conversationHistory) ? lead.conversationHistory : []).some((message: any) =>
    (message.sender === 'jarvis' || message.sender === 'user') &&
    !message.inReplyTo &&
    (message.delivery === 'sent' || message.delivery === 'delivered' || message.delivery === 'read')
  );
  return Boolean(
    lead.customPitch?.trim() &&
    lead.whatsappStatus === 'available' &&
    phone.length >= 8 && phone.length <= 15 &&
    !lead.whatsappSentAt &&
    !lead.whatsappSendAttemptAt &&
    !hasInitialSendInHistory &&
    !lead.isRefused &&
    !lead.jarvisManualControl &&
    lead.jarvisStatus !== 'error' &&
    (lead.status === 'approved' || lead.status === 'prepared')
  );
}

/** Prepared and approved leads enter FIFO autonomous outreach. */
export function isAutonomousOutreachCandidate(lead: StoredLead): boolean {
  return (lead.status === 'approved' || lead.status === 'prepared') && isInitialOutreachCandidate(lead);
}

/** Stable FIFO order with one contact per normalized phone number. */
export function selectAutonomousOutreachCandidates(leads: StoredLead[]): StoredLead[] {
  const sorted = leads
    .filter(isAutonomousOutreachCandidate)
    .sort((left: any, right: any) => String(left.updatedAt || '').localeCompare(String(right.updatedAt || '')));
  const seenPhones = new Set<string>();
  return sorted.filter((lead: any) => {
    const phone = normalizedPhone(lead);
    if (seenPhones.has(phone)) return false;
    seenPhones.add(phone);
    return true;
  });
}

function haltAutonomousQueue(summary: string, type: JarvisEventType = 'error'): void {
  automationWaitAbortController?.abort();
  automationWaitAbortController = undefined;
  const runtime = readRuntime();
  writeRuntime({ ...runtime, autoProcessing: false, sendEnabled: false, testMode: true });
  addEvent({ type, summary });
  releaseSenderLockWhenSafe();
}

async function processInitialOutreach(): Promise<'sent' | 'skipped' | 'blocked' | 'empty'> {
  const runtime = readRuntime();
  if (!runtime.autoProcessing || !runtime.sendEnabled) return 'blocked';
  const nextLead = initialOutreachCandidates()[0];
  if (!nextLead) return 'empty';
  try {
    await sendQueuedInitialMessage(nextLead.id);
    return 'sent';
  } catch (error: any) {
    // Browser errors are unsafe to skip: the current chat/session may be
    // unknown or the message may have been sent without confirmation.
    if (error.browserResult?.safeToSkip === true && error.browserResult?.status === 'ready') return 'skipped';
    if (error.browserResult || readRuntime().browser.status !== 'ready' || /CRM не смогла сохранить факт отправки/i.test(error.message || '')) {
      return 'blocked';
    }
    // A local validation error (for example an invalid number) is recorded on
    // this lead and can safely be skipped without marking it as sent.
    updateLead(nextLead.id, { jarvisStatus: 'error', jarvisLastError: error.message || 'Лид пропущен из-за ошибки отправки.' });
    return 'skipped';
  }
}

async function runAutonomousCycle(): Promise<void> {
  if (autonomousCycleInFlight) return;
  autonomousCycleInFlight = true;
  try {
    while (true) {
      const runtime = readRuntime();
      if (!runtime.autoProcessing || !runtime.sendEnabled) return;
      const result = await processInitialOutreach();
      if (result === 'empty') {
        haltAutonomousQueue('Automation завершена: в очереди не осталось подготовленных лидов с доступным WhatsApp.', 'info');
        return;
      }
      if (result === 'blocked') {
        haltAutonomousQueue('Automation остановлена: WhatsApp Web не подтвердил безопасную отправку. Проверьте браузер и CRM перед продолжением.');
        return;
      }
      if (result !== 'sent') continue;

      const controller = new AbortController();
      automationWaitAbortController = controller;
      const completed = await waitForAutomationInterval(readRuntime().automationIntervalSec, controller.signal);
      if (automationWaitAbortController === controller) automationWaitAbortController = undefined;
      if (!completed || !readRuntime().autoProcessing) return;
    }
  } catch (error: any) {
    // Do not move to another lead when the browser state is uncertain.
    haltAutonomousQueue(`Automation остановлена: ${error?.message || 'неизвестная ошибка WhatsApp Web'}.`);
  } finally {
    autonomousCycleInFlight = false;
    if (!readRuntime().autoProcessing || releaseSenderLockWhenIdle) releaseSenderLock();
  }
}

export async function checkIncoming(): Promise<{ runtime: JarvisRuntime; imported: number; skipped: number }> {
  const runtime = readRuntime();
  const candidates = listLeads().filter((lead: any) => Boolean(lead.whatsappSentAt) && !lead.isRefused && lead.status !== 'lost' && normalizedPhone(lead).length >= 8 && sentHistory(lead).length > 0);
  if (candidates.length === 0) {
    const saved = writeRuntime({
      ...runtime,
      browser: runtime.browser.status === 'error' ? { ...runtime.browser, status: 'disconnected', lastError: undefined } : runtime.browser,
      lastIncomingCheckAt: new Date().toISOString(),
      lastIncomingCount: 0,
      lastIncomingSkipped: 0
    });
    return { runtime: saved, imported: 0, skipped: 0 };
  }
  setBrowserState({ status: 'checking', lastError: undefined });
  try {
    const result = await serialized(() => runBrowser({
      action: 'check',
      targets: candidates.map((lead: any) => ({ leadId: lead.id, name: lead.name, phone: normalizedPhone(lead), sentAt: lead.whatsappSentAt, knownMessageIds: knownMessageIds(lead) }))
    }, 90_000));
    let imported = 0;
    for (const message of (result.messages ?? []) as BrowserMessage[]) {
      const lead = listLeads().find((item: any) => item.id === message.leadId);
      if (!lead) continue;
      const updated = appendIncoming(lead, message);
      if (!updated) continue;
      imported++;
      addEvent({ type: 'incoming', leadId: lead.id, leadName: lead.name, summary: `Новый входящий ответ от ${lead.name} сохранён.` });
      // Importing inbound messages is deliberately non-generative: the
      // autonomous sender never requires Ollama or another AI service.
    }
    const saved = writeRuntime({ ...readRuntime(), browser: { status: 'ready', lastChangeAt: new Date().toISOString(), lastError: undefined }, lastIncomingCheckAt: new Date().toISOString(), lastIncomingCount: imported, lastIncomingSkipped: (result.skippedLeadIds ?? []).length });
    return { runtime: saved, imported, skipped: (result.skippedLeadIds ?? []).length };
  } catch (error: any) {
    const browserResult = error.browserResult;
    const saved = writeRuntime({ ...readRuntime(), browser: { status: browserResult?.status === 'needs_login' ? 'needs_login' : 'error', lastChangeAt: new Date().toISOString(), lastError: error.message || 'Проверка входящих не удалась.' } });
    addEvent({ type: 'error', summary: saved.browser.lastError || 'Проверка входящих не удалась.' });
    return { runtime: saved, imported: 0, skipped: candidates.length };
  }
}

export function takeOverLead(leadId: string): StoredLead | undefined {
  const lead = listLeads().find((item: any) => item.id === leadId);
  if (!lead) return undefined;
  const updated = updateLead(leadId, { jarvisManualControl: true, jarvisStatus: 'human_control', conversationStatus: lead.conversationStatus === 'refused' ? 'refused' : 'needs_reply', nextRecommendedAction: 'Разговор под ручным контролем. Jarvis не отвечает автоматически.' });
  addEvent({ type: 'info', leadId, leadName: lead.name, summary: `Диалог с ${lead.name} взят под ручной контроль.` });
  return updated;
}

export function resumeLead(leadId: string): StoredLead | undefined {
  const lead = listLeads().find((item: any) => item.id === leadId);
  if (!lead) return undefined;
  if (lead.isRefused || lead.status === 'lost') throw new Error('Клиент в отказе и не может быть возвращён в автообработку.');
  const updated = updateLead(leadId, { jarvisManualControl: false, jarvisStatus: 'idle', nextRecommendedAction: 'Jarvis снова может обрабатывать новые входящие.' });
  addEvent({ type: 'info', leadId, leadName: lead.name, summary: `Автообработка для ${lead.name} возобновлена.` });
  return updated;
}

