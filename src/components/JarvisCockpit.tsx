import React, { useEffect, useState } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  Clock,
  ShieldCheck,
  Activity,
  RefreshCw,
  Search,
  ExternalLink
} from 'lucide-react';
import { BusinessLead } from '../types';

interface JarvisCockpitProps {
  leads: BusinessLead[];
  onNavigate: (mode: 'leads' | 'automation' | 'communication') => void;
  onRefreshLeads: () => void;
}

interface DiagnosticsData {
  total: number;
  needQualification: number;
  prepared: number;
  approved: number;
  confirmedSent: number;
  actualRepliesReceived: number;
  needsAttention: number;
  interested: number;
  refused: number;
  unverifiedLegacy: number;
}

export function JarvisCockpit({ leads, onNavigate, onRefreshLeads }: JarvisCockpitProps) {
  const [diag, setDiag] = useState<DiagnosticsData>({
    total: leads.length,
    needQualification: 0,
    prepared: 0,
    approved: 0,
    confirmedSent: 0,
    actualRepliesReceived: 0,
    needsAttention: 0,
    interested: 0,
    refused: 0,
    unverifiedLegacy: 0
  });

  const [ollamaInfo, setOllamaInfo] = useState<{
    available: boolean;
    model: string;
    host?: string;
    pingMs?: number;
    error?: string;
  }>({
    available: false,
    model: 'qwen3:14b'
  });

  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch('/api/leads/diagnostics');
      if (res.ok) {
        const data = await res.json();
        setDiag(data);
      }
    } catch {
      // Fallback local calc
      calculateLocalDiagnostics();
    }
  };

  const calculateLocalDiagnostics = () => {
    const total = leads.length;
    const needQualification = leads.filter(l => l.status === 'new' && !l.customPitch).length;
    const prepared = leads.filter(l => (l.status === 'prepared' || Boolean(l.customPitch)) && l.status !== 'approved' && l.status !== 'contacted' && l.status !== 'lost').length;
    const approved = leads.filter(l => l.status === 'approved' && !l.whatsappSentAt).length;
    const confirmedSent = leads.filter(l => Boolean(l.whatsappSentAt) || (l.status === 'contacted' && Array.isArray(l.conversationHistory) && l.conversationHistory.length > 0)).length;
    const actualRepliesReceived = leads.filter(l => Array.isArray(l.conversationHistory) && l.conversationHistory.some(m => m.sender === 'client')).length;
    const needsAttention = leads.filter(l => l.conversationStatus === 'needs_reply' || l.conversationStatus === 'has_reply').length;
    const interested = leads.filter(l => l.conversationStatus === 'interested' || l.conversationStatus === 'discussing_terms' || l.status === 'negotiation').length;
    const refused = leads.filter(l => l.status === 'lost' || l.conversationStatus === 'refused' || l.isRefused).length;
    const unverifiedLegacy = leads.filter(l => l.status === 'contacted' && !l.whatsappSentAt && (!Array.isArray(l.conversationHistory) || l.conversationHistory.length === 0)).length;

    setDiag({
      total,
      needQualification,
      prepared,
      approved,
      confirmedSent,
      actualRepliesReceived,
      needsAttention,
      interested,
      refused,
      unverifiedLegacy
    });
  };

  const checkOllama = async () => {
    try {
      const res = await fetch('/api/jarvis/status');
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setOllamaInfo({
          available: false,
          model: 'qwen3:14b',
          error: 'Сервер вернул HTML вместо JSON. Убедитесь, что запущен backend (npm run dev).'
        });
        return;
      }
      const data = await res.json();
      setOllamaInfo({
        available: Boolean(data.available),
        model: data.model || 'qwen3:14b',
        host: data.host,
        pingMs: data.pingMs,
        error: data.error
      });
    } catch (e: any) {
      setOllamaInfo({
        available: false,
        model: 'qwen3:14b',
        error: `Сетевая ошибка: ${e.message}`
      });
    }
  };

  const runLivePing = async () => {
    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await fetch('/api/jarvis/ping', { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Эндпоинт вернул не-JSON ответ. Перезапустите сервер.');
      }
      const data = await res.json();
      if (res.ok && data.ok) {
        setPingResult(`Отклик: ${data.latencyMs}мс | Ответ: «${data.reply}» | Модель: ${data.model}`);
        await checkOllama();
      } else {
        setPingResult(`Ошибка: ${data.error || 'Сбой проверки'}`);
      }
    } catch (e: any) {
      setPingResult(`Ошибка: ${e.message}`);
    } finally {
      setIsPinging(false);
      setTimeout(() => setPingResult(null), 7000);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    checkOllama();
  }, [leads.length]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cockpit Top Banner */}
      <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/25 border border-blue-400/40 text-blue-300 shadow-lg shadow-blue-950/60">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Рабочее место Jarvis
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full border font-semibold bg-emerald-500/15 border-emerald-500/30 text-emerald-300">
                  Воронка активных продаж
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Единый рабочий процесс: квалификация целевых лидов из 2GIS, подготовка индивидуальных предложений и переговорная поддержка на базе локальной модели Ollama Qwen3:14b.
              </p>
            </div>
          </div>

          {/* Ollama Health Badge */}
          <div className="flex items-center gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <div className="text-right">
              <div className="text-[11px] text-slate-400">Нейросеть Jarvis</div>
              <div className="text-xs font-semibold text-white flex items-center gap-1.5 justify-end">
                <span className={`w-2 h-2 rounded-full ${ollamaInfo.available ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                <span>{ollamaInfo.available ? `Qwen3:14b (${ollamaInfo.pingMs ?? '<10'}мс)` : 'Ollama недоступна'}</span>
              </div>
            </div>
            <button
              onClick={runLivePing}
              disabled={isPinging}
              className="ui-button-secondary px-2.5 py-1.5 text-xs text-blue-300 hover:text-white"
              title="Проверить живой отклик модели"
            >
              {isPinging ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Тест'}
            </button>
          </div>
        </div>

        {pingResult && (
          <div className="mt-3 text-xs bg-slate-900/90 border border-blue-500/30 text-blue-200 px-3 py-1.5 rounded-lg animate-fade-in flex items-center justify-between">
            <span>{pingResult}</span>
            <span className="text-[10px] text-slate-400 font-mono">127.0.0.1:11434</span>
          </div>
        )}
      </div>

      {/* Honest Data Disclaimer for Legacy Contacted Leads */}
      {diag.unverifiedLegacy > 0 && (
        <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/10 text-xs text-amber-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-100">Статус существующей базы ({diag.unverifiedLegacy} контактов): </span>
              <span className="text-amber-200/90 leading-relaxed">
                В базе есть {diag.unverifiedLegacy} контактов со старым статусом «contacted», у которых не зафиксирована фактическая дата отправки и нет истории сообщений. Они вынесены в фильтр <strong>«Не проверено»</strong> и не считаются ответившими клиентами, пока вы не введёте их ответ.
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('communication')}
            className="shrink-0 text-[11px] underline font-semibold text-amber-300 hover:text-white"
          >
            Открыть список
          </button>
        </div>
      )}

      {/* Sales Pipeline Funnel (Core KPI) */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          Воронка рабочего процесса продаж
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* Stage 1: Found */}
          <button
            onClick={() => onNavigate('leads')}
            className="bg-slate-950/70 hover:bg-slate-900 p-3 rounded-xl border border-slate-800 text-left transition group"
          >
            <div className="text-[11px] text-slate-400 group-hover:text-blue-300">Найдено в базе</div>
            <div className="text-xl font-bold text-white tabular-nums mt-0.5">{diag.total}</div>
            <div className="text-[10px] text-slate-500 mt-1">2GIS лиды</div>
          </button>

          {/* Stage 2: Need Qualification */}
          <button
            onClick={() => onNavigate('automation')}
            className="bg-slate-950/70 hover:bg-slate-900 p-3 rounded-xl border border-slate-800 text-left transition group"
          >
            <div className="text-[11px] text-cyan-400 group-hover:text-cyan-300">Квалифицировать</div>
            <div className="text-xl font-bold text-cyan-300 tabular-nums mt-0.5">{diag.needQualification}</div>
            <div className="text-[10px] text-slate-500 mt-1">новые контакты</div>
          </button>

          {/* Stage 3: Prepared Offers */}
          <button
            onClick={() => onNavigate('automation')}
            className="bg-slate-950/70 hover:bg-slate-900 p-3 rounded-xl border border-slate-800 text-left transition group"
          >
            <div className="text-[11px] text-blue-400 group-hover:text-blue-300">Подготовлено</div>
            <div className="text-xl font-bold text-blue-300 tabular-nums mt-0.5">{diag.prepared}</div>
            <div className="text-[10px] text-slate-500 mt-1">готовые питчи</div>
          </button>

          {/* Stage 4: Approved */}
          <button
            onClick={() => onNavigate('automation')}
            className="bg-slate-950/70 hover:bg-slate-900 p-3 rounded-xl border border-slate-800 text-left transition group"
          >
            <div className="text-[11px] text-indigo-400 group-hover:text-indigo-300">Одобрено к отправке</div>
            <div className="text-xl font-bold text-indigo-300 tabular-nums mt-0.5">{diag.approved}</div>
            <div className="text-[10px] text-slate-500 mt-1">очередь WA</div>
          </button>

          {/* Stage 5: Truly Sent */}
          <button
            onClick={() => onNavigate('communication')}
            className="bg-slate-950/70 hover:bg-slate-900 p-3 rounded-xl border border-slate-800 text-left transition group"
          >
            <div className="text-[11px] text-emerald-400 group-hover:text-emerald-300">Отправлено</div>
            <div className="text-xl font-bold text-emerald-300 tabular-nums mt-0.5">{diag.confirmedSent}</div>
            <div className="text-[10px] text-slate-500 mt-1">подтверждено</div>
          </button>

          {/* Stage 6: Replies Received */}
          <button
            onClick={() => onNavigate('communication')}
            className="bg-slate-950/70 hover:bg-slate-900 p-3 rounded-xl border border-slate-800 text-left transition group"
          >
            <div className="text-[11px] text-amber-400 group-hover:text-amber-300">Есть ответ клиента</div>
            <div className="text-xl font-bold text-amber-300 tabular-nums mt-0.5">{diag.actualRepliesReceived}</div>
            <div className="text-[10px] text-slate-500 mt-1">входящие сообщ.</div>
          </button>

          {/* Stage 7: Interested */}
          <button
            onClick={() => onNavigate('communication')}
            className="bg-slate-950/70 hover:bg-slate-900 p-3 rounded-xl border border-slate-800 text-left transition group"
          >
            <div className="text-[11px] text-purple-400 group-hover:text-purple-300">Заинтересованы</div>
            <div className="text-xl font-bold text-purple-300 tabular-nums mt-0.5">{diag.interested}</div>
            <div className="text-[10px] text-slate-500 mt-1">обсуждение</div>
          </button>

          {/* Stage 8: Refused */}
          <button
            onClick={() => onNavigate('communication')}
            className="bg-slate-950/70 hover:bg-slate-900 p-3 rounded-xl border border-slate-800 text-left transition group"
          >
            <div className="text-[11px] text-rose-400 group-hover:text-rose-300">Отказы</div>
            <div className="text-xl font-bold text-rose-400 tabular-nums mt-0.5">{diag.refused}</div>
            <div className="text-[10px] text-slate-500 mt-1">исключены</div>
          </button>
        </div>
      </div>

      {/* Immediate Next Actions (Action Center) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Action 1: Campaign Queue */}
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between hover:border-blue-500/40 transition shadow-lg">
          <div>
            <div className="flex items-center justify-between text-xs text-blue-400 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Шаг 1-3: Кампания
              </span>
              <span className="bg-blue-500/15 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full">
                {diag.prepared + diag.approved} готовы
              </span>
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">
              Подготовка и отправка предложений
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Квалифицируйте организации по проверенным признакам (без сайта, активный спрос в 2GIS), одобряйте честные питчи и отправляйте в WhatsApp с ручным подтверждением.
            </p>
          </div>

          <button
            onClick={() => onNavigate('automation')}
            className="mt-4 ui-button w-full py-2.5 text-xs bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 font-semibold shadow-md"
          >
            <span>Перейти к кампании</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Action 2: Active Negotiations */}
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between hover:border-indigo-500/40 transition shadow-lg">
          <div>
            <div className="flex items-center justify-between text-xs text-indigo-400 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" /> Шаг 4: Переговоры
              </span>
              <span className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full">
                {diag.actualRepliesReceived} диалогов с ответом
              </span>
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">
              Очередь переговоров с Jarvis
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Работайте только с теми, кто действительно ответил. Скопируйте сообщение клиента — Jarvis проанализирует контекст, выделит вопросы и подскажет следующий шаг.
            </p>
          </div>

          <button
            onClick={() => onNavigate('communication')}
            className="mt-4 ui-button w-full py-2.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2 font-semibold shadow-md"
          >
            <span>Открыть переговоры</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Action 3: Leads Database & Search */}
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between hover:border-cyan-500/40 transition shadow-lg">
          <div>
            <div className="flex items-center justify-between text-xs text-cyan-400 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <Search className="w-4 h-4" /> Источник: 2GIS
              </span>
              <span className="bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded-full">
                {diag.total} контактов
              </span>
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">
              База лидов и парсер 2GIS
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Поиск компаний в 2GIS без сайта и с подтверждённым WhatsApp по городам и категориям. Табличный просмотр, фильтрация и экспорт в Excel/CSV.
            </p>
          </div>

          <button
            onClick={() => onNavigate('leads')}
            className="mt-4 ui-button-secondary w-full py-2.5 text-xs text-slate-200 hover:text-white flex items-center justify-center gap-2 font-semibold"
          >
            <span>Открыть базу лидов</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
