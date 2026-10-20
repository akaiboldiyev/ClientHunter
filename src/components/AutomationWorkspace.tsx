import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BusinessLead } from '../types';

type Runtime = {
  autoProcessing: boolean;
  automationIntervalSec?: number;
  browser?: { status?: string; lastError?: string };
};

interface AutomationWorkspaceProps {
  leads: BusinessLead[];
  onRefreshLeads: () => void;
}

export function AutomationWorkspace({ leads, onRefreshLeads }: AutomationWorkspaceProps) {
  const [runtime, setRuntime] = useState<Runtime>({ autoProcessing: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intervalInput, setIntervalInput] = useState('5');
  const intervalInitialized = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/jarvis/runtime');
      if (!response.ok) throw new Error('Не удалось получить состояние Automation.');
      const nextRuntime = await response.json() as Runtime;
      setRuntime(nextRuntime);
      if (!intervalInitialized.current) {
        setIntervalInput(String(nextRuntime.automationIntervalSec ?? 5));
        intervalInitialized.current = true;
      }
    } catch (requestError: any) {
      setError(requestError.message || 'Automation недоступна.');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
      onRefreshLeads();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onRefreshLeads, refresh]);

  const run = async (path: string, body?: Record<string, unknown>) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Automation: ошибка ${response.status}.`);
    if (data.runtime) setRuntime(data.runtime as Runtime);
  };

  const parseInterval = (value: string): number | null => {
    if (!/^\d+$/.test(value.trim())) return null;
    const seconds = Number(value.trim());
    return Number.isSafeInteger(seconds) && seconds >= 1 && seconds <= 3600 ? seconds : null;
  };

  const persistInterval = async (value: string): Promise<number | null> => {
    const seconds = parseInterval(value);
    if (seconds === null) {
      setError('Интервал должен быть целым числом от 1 до 3600 секунд.');
      return null;
    }
    try {
      await run('/api/jarvis/auto/interval', { seconds });
      setIntervalInput(String(seconds));
      setError(null);
      return seconds;
    } catch (requestError: any) {
      setError(requestError.message || 'Не удалось сохранить интервал.');
      return null;
    }
  };

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (runtime.autoProcessing) {
        await run('/api/jarvis/auto/stop');
      } else {
        const seconds = await persistInterval(intervalInput);
        if (seconds === null) return;
        await run('/api/jarvis/auto/start', { intervalSec: seconds });
      }
      await refresh();
      onRefreshLeads();
    } catch (requestError: any) {
      setError(requestError.message || 'Не удалось изменить состояние Automation.');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const sent = leads.filter(lead => Boolean(lead.whatsappSentAt)).length;
  const queuedPhones = new Set<string>();
  const queued = leads.filter(lead => {
    const rawPhone = lead.phones?.find(phone => phone.normalized)?.normalized || lead.phone;
    const digits = String(rawPhone || '').replace(/\D/g, '');
    const phone = /^8\d{10}$/.test(digits) ? `7${digits.slice(1)}` : digits;
    const hasPriorInitialSend = (Array.isArray(lead.conversationHistory) ? lead.conversationHistory : []).some(message =>
      (message.sender === 'jarvis' || message.sender === 'user') && !message.inReplyTo &&
      ['sent', 'delivered', 'read'].includes(message.delivery || '')
    );
    const eligible = Boolean(
      lead.customPitch?.trim() &&
      lead.whatsappStatus === 'available' &&
      phone.length >= 8 && phone.length <= 15 &&
      ['prepared', 'approved'].includes(lead.status) &&
      !lead.whatsappSentAt &&
      !lead.whatsappSendAttemptAt &&
      !hasPriorInitialSend &&
      !lead.isRefused &&
      !lead.jarvisManualControl &&
      lead.jarvisStatus !== 'error'
    );
    if (!eligible || queuedPhones.has(phone)) return false;
    queuedPhones.add(phone);
    return true;
  }).length;

  return (
    <section aria-labelledby="automation-title" className="flex min-h-[50vh] flex-col items-center justify-center gap-5 py-12">
      <h1 id="automation-title" className="text-3xl font-bold tracking-tight text-white">Automation</h1>
      <div className="flex flex-wrap items-end justify-center gap-3">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy}
          className={`min-h-12 min-w-44 rounded-xl px-8 py-3 text-base font-bold text-white shadow-lg transition focus:outline-none focus:ring-2 focus:ring-blue-400/70 disabled:cursor-wait disabled:opacity-60 ${runtime.autoProcessing ? 'bg-rose-700 hover:bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-500'}`}
        >
          {busy ? 'Подождите…' : runtime.autoProcessing ? 'Остановить' : 'Запустить'}
        </button>
        <label className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
          <span>Интервал между лидами (сек.)</span>
          <input
            type="number"
            min={1}
            max={3600}
            step={1}
            inputMode="numeric"
            value={intervalInput}
            onChange={(event) => setIntervalInput(event.target.value)}
            onBlur={() => void persistInterval(intervalInput)}
            aria-label="Интервал между лидами в секундах"
            className="w-20 rounded-lg border border-slate-500 bg-slate-950 px-2 py-1.5 text-center text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50"
          />
        </label>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-slate-300">
        {error || `В очереди ${queued} подготовленных лидов с доступным WhatsApp · отправлено ${sent} из ${leads.length}.`}
      </p>
    </section>
  );
}
