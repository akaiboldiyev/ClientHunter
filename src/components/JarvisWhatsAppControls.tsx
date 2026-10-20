import React, { useEffect, useState } from 'react';
import { AlertCircle, Bot, CheckCircle2, PauseCircle, Play, RefreshCw, Shield, Smartphone, Square } from 'lucide-react';

type Runtime = {
  browser: { status: 'disconnected' | 'checking' | 'ready' | 'needs_login' | 'error'; lastError?: string; lastChangeAt?: string };
  autoProcessing: boolean;
  sendEnabled: boolean;
  testMode: boolean;
  lastIncomingCheckAt?: string;
  lastIncomingCount: number;
  lastIncomingSkipped: number;
  events: Array<{ id: string; createdAt: string; type: string; leadName?: string; summary: string }>;
};

const STATUS_LABEL: Record<Runtime['browser']['status'], string> = {
  disconnected: 'Не подключён',
  checking: 'Проверяю…',
  ready: 'WhatsApp Web подключён',
  needs_login: 'Нужен QR-вход',
  error: 'Ошибка'
};

function formatDate(value?: string): string {
  if (!value) return 'ещё не выполнялась';
  return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function JarvisWhatsAppControls({ onChanged }: { onChanged: () => void }) {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const response = await fetch('/api/jarvis/runtime');
      if (!response.ok) throw new Error('Не удалось получить состояние WhatsApp Web.');
      setRuntime(await response.json());
      setError(null);
    } catch (requestError: any) {
      setError(requestError.message || 'Сервер недоступен.');
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 6000);
    return () => window.clearInterval(timer);
  }, []);

  const post = async (path: string, body?: Record<string, unknown>, label = path) => {
    setBusy(label);
    setError(null);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`);
      if (data.runtime) setRuntime(data.runtime);
      onChanged();
      await refresh();
    } catch (requestError: any) {
      setError(requestError.message || 'Операция не выполнена.');
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const browserStatus = runtime?.browser.status || 'disconnected';
  const ready = browserStatus === 'ready';

  return (
    <div className="my-3.5 space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Smartphone className="h-4 w-4 text-emerald-400" />
            Автономный Jarvis через обычный WhatsApp Web
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            В фоне очередь отправляет сохранённые customPitch подготовленных лидов с явной отметкой WhatsApp, выдерживает интервал и останавливается при неопределённой отправке.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <span className={`h-2.5 w-2.5 rounded-full ${ready ? 'bg-emerald-400 animate-pulse' : browserStatus === 'needs_login' ? 'bg-amber-400' : 'bg-slate-500'}`} />
          {STATUS_LABEL[browserStatus]}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={Boolean(busy) || ready} onClick={() => void post('/api/jarvis/whatsapp/connect', undefined, 'connect')} className="ui-button min-h-10 px-3 py-2 text-xs bg-emerald-700 text-white disabled:opacity-40">
          {browserStatus === 'needs_login' ? 'Открыть QR-вход' : 'Подключить WhatsApp Web'}
        </button>
        <button type="button" disabled={Boolean(busy) || !ready} onClick={() => void post('/api/jarvis/incoming/check', undefined, 'check')} className="ui-button-secondary min-h-10 px-3 py-2 text-xs inline-flex items-center gap-1.5 disabled:opacity-40">
          {busy === 'check' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Проверить входящие
        </button>
        <button type="button" disabled={Boolean(busy) || !ready || runtime?.autoProcessing} onClick={() => void post('/api/jarvis/auto/start', undefined, 'start')} className="ui-button min-h-10 px-3 py-2 text-xs bg-indigo-700 text-white disabled:opacity-40 inline-flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5" />
          {runtime?.autoProcessing ? 'Автономный цикл включён' : 'Включить автономный цикл'}
        </button>
        <button type="button" disabled={Boolean(busy) || !runtime?.autoProcessing} onClick={() => void post('/api/jarvis/auto/stop', undefined, 'stop')} className="ui-button min-h-10 px-3 py-2 text-xs bg-rose-700 text-white disabled:opacity-40 inline-flex items-center gap-1.5">
          <Square className="h-3.5 w-3.5" /> STOP
        </button>
        <button type="button" disabled={Boolean(busy) || !ready} onClick={() => void post('/api/jarvis/auto/send-mode', { enabled: !runtime?.sendEnabled }, 'send-mode')} className={`ui-button-secondary min-h-10 px-3 py-2 text-xs inline-flex items-center gap-1.5 disabled:opacity-40 ${runtime?.sendEnabled ? 'border-rose-500/40 text-rose-200' : 'border-amber-500/40 text-amber-200'}`}>
          <Shield className="h-3.5 w-3.5" />
          {runtime?.sendEnabled ? 'Автоотправка ON' : 'Тестовый режим ON'}
        </button>
        <button type="button" onClick={() => void refresh()} className="ui-button-secondary min-h-10 min-w-10 px-2.5 py-1.5 text-xs" aria-label="Обновить состояние WhatsApp Web">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
        <span className={`rounded border px-2 py-0.5 ${runtime?.autoProcessing ? 'border-indigo-500/40 text-indigo-200' : 'border-slate-700'}`}>Автономный цикл: {runtime?.autoProcessing ? 'ON' : 'OFF'}</span>
        <span className={`rounded border px-2 py-0.5 ${runtime?.sendEnabled ? 'border-rose-500/40 text-rose-200' : 'border-amber-500/40 text-amber-200'}`}>{runtime?.sendEnabled ? 'Реальная отправка разрешена' : 'Тест: ответы не отправляются'}</span>
        <span className="rounded border border-slate-700 px-2 py-0.5">Последняя проверка: {formatDate(runtime?.lastIncomingCheckAt)}</span>
        {runtime && <span className="rounded border border-slate-700 px-2 py-0.5">Найдено: {runtime.lastIncomingCount} · пропущено: {runtime.lastIncomingSkipped}</span>}
      </div>

      {browserStatus === 'needs_login' && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-100">В локальном окне браузера подтвердите вход WhatsApp Web по QR-коду. Jarvis не решает QR-коды автоматически.</p>}
      {error && <div role="alert" className="flex items-center gap-1.5 text-xs text-rose-300"><AlertCircle className="h-3.5 w-3.5" />{error}</div>}
      {runtime?.browser.lastError && <div className="text-xs text-rose-300">{runtime.browser.lastError}</div>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-200"><Bot className="h-3.5 w-3.5 text-blue-400" />Журнал Jarvis</div>
          <div className="max-h-32 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
            {(runtime?.events || []).slice(0, 12).map(event => <div key={event.id} className="text-[11px] text-slate-300"><span className="text-slate-500">{formatDate(event.createdAt)} · </span>{event.summary}</div>)}
            {!runtime?.events?.length && <p className="text-[11px] text-slate-500">Журнал пока пуст.</p>}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-[11px] leading-relaxed text-slate-400">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-200"><PauseCircle className="h-3.5 w-3.5 text-slate-400" />Безопасные остановки</div>
          <p>Отказ, неоднозначность, запрос индивидуальных условий и ручной контроль блокируют автоответ. Входящие и ответы сохраняются в истории CRM без повторной отправки одного ответа.</p>
          {runtime?.events?.some(event => event.type === 'sent') && <p className="mt-1 flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Есть зафиксированные отправки через WhatsApp Web.</p>}
        </div>
      </div>
    </div>
  );
}
