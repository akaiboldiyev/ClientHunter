import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Bot,
  Send,
  Sparkles,
  ExternalLink,
  Clock,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Copy,
  Check,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Building2,
  MapPin,
  Calendar,
  ThumbsDown,
  Info
} from 'lucide-react';
import { BusinessLead, ConversationStatus, ConversationMessage } from '../types';

interface CommunicationPanelProps {
  leads: BusinessLead[];
  onLeadsUpdated: () => void;
  onNavigateToAutomation?: () => void;
}

type CommFilterType =
  | 'needs_attention'
  | 'has_reply'
  | 'interested'
  | 'discussing_terms'
  | 'awaiting_reply'
  | 'unverified'
  | 'refused'
  | 'all';

const STATUS_METAS: Record<ConversationStatus, { label: string; color: string; border: string }> = {
  awaiting_reply: { label: 'Ожидает ответа', color: 'text-cyan-300 bg-cyan-500/10', border: 'border-cyan-500/30' },
  has_reply: { label: 'Ответ получен', color: 'text-blue-300 bg-blue-500/10', border: 'border-blue-500/30' },
  needs_reply: { label: 'Нужен мой ответ', color: 'text-amber-300 bg-amber-500/10', border: 'border-amber-500/30' },
  interested: { label: 'Заинтересован', color: 'text-emerald-300 bg-emerald-500/10', border: 'border-emerald-500/30' },
  discussing_terms: { label: 'Обсуждение условий', color: 'text-purple-300 bg-purple-500/10', border: 'border-purple-500/30' },
  refused: { label: 'Отказ', color: 'text-rose-300 bg-rose-500/10', border: 'border-rose-500/30' },
  completed: { label: 'Завершено', color: 'text-slate-300 bg-slate-500/10', border: 'border-slate-500/30' },
  unverified: { label: 'Не проверено', color: 'text-slate-400 bg-slate-800/60', border: 'border-slate-700' }
};

export function CommunicationPanel({ leads, onLeadsUpdated, onNavigateToAutomation }: CommunicationPanelProps) {
  // All eligible contacts for communication mode:
  // confirmed sent OR marked contacted in database
  const allContacts = leads.filter(l => Boolean(l.whatsappSentAt) || l.status === 'contacted' || Boolean(l.conversationStatus));

  const [activeFilter, setActiveFilter] = useState<CommFilterType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Ollama connection & diagnostic state
  const [ollamaState, setOllamaState] = useState<{
    available: boolean;
    model: string;
    host?: string;
    pingMs?: number;
    error?: string;
  }>({
    available: false,
    model: 'qwen3:14b'
  });
  const [isCheckingOllama, setIsCheckingOllama] = useState<boolean>(false);
  const [isPingingOllama, setIsPingingOllama] = useState<boolean>(false);
  const [pingMessage, setPingMessage] = useState<string | null>(null);

  // Jarvis Analysis state
  const [clientInputText, setClientInputText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    category: string;
    intent: string;
    keyPoints: string;
    recommendedAction: string;
    proposedReply: string;
    status: ConversationStatus;
    isRefusal: boolean;
  } | null>(null);

  const [editableReplyText, setEditableReplyText] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isSavingReply, setIsSavingReply] = useState<boolean>(false);

  // Diagnostics check for Ollama
  const checkOllama = async () => {
    setIsCheckingOllama(true);
    try {
      const res = await fetch('/api/jarvis/status');
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setOllamaState({
          available: false,
          model: 'qwen3:14b',
          error: 'Сервер вернул HTML вместо JSON. Убедитесь, что запущен backend (npm run dev).'
        });
        return;
      }
      const data = await res.json();
      setOllamaState({
        available: Boolean(data.available),
        model: data.model || 'qwen3:14b',
        host: data.host,
        pingMs: data.pingMs,
        error: data.error
      });
    } catch (e: any) {
      setOllamaState({
        available: false,
        model: 'qwen3:14b',
        error: `Сетевая ошибка: ${e.message}`
      });
    } finally {
      setIsCheckingOllama(false);
    }
  };

  const runOllamaPing = async () => {
    setIsPingingOllama(true);
    setPingMessage(null);
    try {
      const res = await fetch('/api/jarvis/ping', { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Эндпоинт вернул не-JSON ответ. Перезапустите сервер.');
      }
      const data = await res.json();
      if (res.ok && data.ok) {
        setPingMessage(`Успешный отклик за ${data.latencyMs}мс | Ответ: «${data.reply}» | Модель: ${data.model}`);
        await checkOllama();
      } else {
        setPingMessage(`Ошибка: ${data.error || 'Сбой пинга'}`);
      }
    } catch (e: any) {
      setPingMessage(`Ошибка соединения: ${e.message}`);
    } finally {
      setIsPingingOllama(false);
      setTimeout(() => setPingMessage(null), 6000);
    }
  };

  useEffect(() => {
    checkOllama();
  }, []);

  // Filter contacts by active queue
  const filteredContacts = allContacts.filter(lead => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = lead.name.toLowerCase().includes(q);
      const matchPhone = (lead.phone || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone) return false;
    }

    const hasClientMessages = Array.isArray(lead.conversationHistory) && lead.conversationHistory.some(m => m.sender === 'client');
    const isLegacyUnverified = lead.status === 'contacted' && !lead.whatsappSentAt && (!Array.isArray(lead.conversationHistory) || lead.conversationHistory.length === 0);
    const status = lead.conversationStatus || (isLegacyUnverified ? 'unverified' : 'awaiting_reply');

    if (activeFilter === 'all') return true;
    if (activeFilter === 'needs_attention') {
      return status === 'needs_reply' || (hasClientMessages && status !== 'refused' && status !== 'completed');
    }
    if (activeFilter === 'has_reply') {
      return hasClientMessages || status === 'has_reply';
    }
    if (activeFilter === 'interested') {
      return status === 'interested';
    }
    if (activeFilter === 'discussing_terms') {
      return status === 'discussing_terms';
    }
    if (activeFilter === 'awaiting_reply') {
      return status === 'awaiting_reply' && !isLegacyUnverified;
    }
    if (activeFilter === 'unverified') {
      return isLegacyUnverified || status === 'unverified';
    }
    if (activeFilter === 'refused') {
      return status === 'refused' || lead.isRefused || lead.status === 'lost';
    }
    return true;
  });

  // Select default contact
  useEffect(() => {
    if (filteredContacts.length > 0) {
      if (!selectedLeadId || !filteredContacts.some(l => l.id === selectedLeadId)) {
        setSelectedLeadId(filteredContacts[0].id);
      }
    } else {
      setSelectedLeadId(null);
    }
  }, [filteredContacts.length, selectedLeadId]);

  const activeContact = allContacts.find(l => l.id === selectedLeadId) || filteredContacts[0] || null;

  // Reset analysis when switching contact
  useEffect(() => {
    setClientInputText('');
    setAnalysisResult(null);
    setEditableReplyText('');
    setAnalysisError(null);
    setIsCopied(false);
  }, [activeContact?.id]);

  // Request Jarvis Analysis
  const handleAnalyzeClientMessage = async () => {
    if (!clientInputText.trim() || !activeContact) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const res = await fetch('/api/jarvis/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: activeContact.id,
          clientMessage: clientInputText.trim()
        })
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Сервер вернул HTML вместо JSON. Перезапустите backend.');
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `Ошибка ${res.status}`);
      }

      const data = await res.json();
      setAnalysisResult(data.analysis);
      setEditableReplyText(data.analysis.proposedReply || '');
    } catch (e: any) {
      setAnalysisError(e.message || 'Ошибка связи с локальной Ollama.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Copy reply to clipboard and open WhatsApp
  const handleCopyAndOpenWhatsApp = async () => {
    if (!activeContact) return;
    const textToCopy = editableReplyText || analysisResult?.proposedReply || '';
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      } catch {
        // Fallback
      }
    }
    const cleanPhone = activeContact.phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textToCopy)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Confirm reply sent and record in history
  const handleConfirmReplySent = async () => {
    if (!activeContact) return;
    setIsSavingReply(true);
    try {
      // 1. Record incoming message from client if typed
      if (clientInputText.trim()) {
        await fetch(`/api/leads/${encodeURIComponent(activeContact.id)}/conversation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              sender: 'client',
              text: clientInputText.trim(),
              category: analysisResult?.category,
              intent: analysisResult?.intent
            },
            status: analysisResult?.status || 'needs_reply',
            recommendedAction: analysisResult?.recommendedAction
          })
        });
      }

      // 2. Record outgoing user reply
      const replyText = editableReplyText || analysisResult?.proposedReply || '';
      if (replyText.trim()) {
        await fetch(`/api/leads/${encodeURIComponent(activeContact.id)}/conversation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              sender: 'user',
              text: replyText.trim()
            },
            status: analysisResult?.isRefusal ? 'refused' : 'awaiting_reply',
            recommendedAction: analysisResult?.isRefusal ? 'Отказ зафиксирован' : 'Ожидайте ответ клиента в WhatsApp',
            isRefusal: analysisResult?.isRefusal
          })
        });
      }

      setClientInputText('');
      setAnalysisResult(null);
      setEditableReplyText('');
      onLeadsUpdated();
    } catch {
      console.error('Failed to confirm reply sent');
    } finally {
      setIsSavingReply(false);
    }
  };

  // Record client refusal
  const handleRecordRefusal = async () => {
    if (!activeContact) return;
    if (!confirm(`Зафиксировать отказ компании «${activeContact.name}» и исключить её из дальнейших предложений?`)) {
      return;
    }
    try {
      await fetch(`/api/leads/${encodeURIComponent(activeContact.id)}/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clientInputText.trim() ? {
            sender: 'client',
            text: clientInputText.trim(),
            category: 'отказался'
          } : undefined,
          status: 'refused',
          isRefusal: true,
          recommendedAction: 'Клиент отказался. Исключён из дальнейших предложений.'
        })
      });
      setClientInputText('');
      setAnalysisResult(null);
      setEditableReplyText('');
      onLeadsUpdated();
    } catch {
      console.error('Failed to record refusal');
    }
  };

  // Manual status change
  const handleManualStatusChange = async (newStatus: ConversationStatus) => {
    if (!activeContact) return;
    try {
      await fetch(`/api/leads/${encodeURIComponent(activeContact.id)}/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          isRefusal: newStatus === 'refused'
        })
      });
      onLeadsUpdated();
    } catch {
      console.error('Failed to update status');
    }
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return 'Не зафиксировано';
    try {
      const d = new Date(iso);
      return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  // Queue counts
  const needsAttentionCount = allContacts.filter(l => l.conversationStatus === 'needs_reply' || (Array.isArray(l.conversationHistory) && l.conversationHistory.some(m => m.sender === 'client') && l.conversationStatus !== 'refused')).length;
  const hasReplyCount = allContacts.filter(l => Array.isArray(l.conversationHistory) && l.conversationHistory.some(m => m.sender === 'client')).length;
  const interestedCount = allContacts.filter(l => l.conversationStatus === 'interested').length;
  const termsCount = allContacts.filter(l => l.conversationStatus === 'discussing_terms').length;
  const unverifiedCount = allContacts.filter(l => l.status === 'contacted' && !l.whatsappSentAt && (!Array.isArray(l.conversationHistory) || l.conversationHistory.length === 0)).length;
  const refusedCount = allContacts.filter(l => l.status === 'lost' || l.conversationStatus === 'refused' || l.isRefused).length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 mb-6 shadow-xl backdrop-blur-sm">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>Рабочая очередь переговоров</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full border bg-indigo-500/15 border-indigo-500/30 text-indigo-300 font-semibold">
              Режим B: Communication
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ведение диалогов с клиентами, которые реально ответили, анализ возражений и подбор аргументов с Jarvis
          </p>
        </div>

        {/* Ollama Status & Diagnostic Actions */}
        <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 px-2">
            <span className={`w-2 h-2 rounded-full ${ollamaState.available ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="text-slate-200 font-semibold">
              {ollamaState.available ? `Ollama Qwen3:14b (${ollamaState.pingMs ?? '<10'}мс)` : 'Ollama недоступна'}
            </span>
          </div>

          <button
            onClick={checkOllama}
            disabled={isCheckingOllama}
            className="ui-button-secondary px-2.5 py-1 text-[11px]"
            title="Проверить состояние сервиса"
          >
            {isCheckingOllama ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Проверить'}
          </button>

          <button
            onClick={runOllamaPing}
            disabled={isPingingOllama}
            className="ui-button-secondary px-2.5 py-1 text-[11px] text-blue-300"
            title="Выполнить реальный тестовый запрос к модели"
          >
            {isPingingOllama ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Тест'}
          </button>
        </div>
      </div>

      {/* Ping result or connection error banner */}
      {pingMessage && (
        <div className="mt-3 p-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-xs text-blue-200 animate-fade-in flex items-center justify-between">
          <span>{pingMessage}</span>
          <span className="text-[10px] text-slate-400 font-mono">127.0.0.1:11434</span>
        </div>
      )}

      {/* Honest WhatsApp Reading Disclaimer */}
      <div className="my-3.5 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-slate-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-slate-400 leading-relaxed">
          <strong>Честный принцип работы:</strong> Прямого автоматического перехвата входящих сообщений WhatsApp без сторонних платных шлюзов нет. Вы открываете WhatsApp, вставляете сюда текст ответа клиента, а локальный Jarvis (Qwen3:14b) моментально раскладывает его по структуре (намерение, вопросы, возражения) и предлагает взвешенный ответ.
        </p>
      </div>

      {/* Operational Queue Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-semibold mb-4">
        <button
          onClick={() => setActiveFilter('needs_attention')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
            activeFilter === 'needs_attention'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-amber-300 hover:bg-slate-900'
          }`}
        >
          <span>Требуют внимания ({needsAttentionCount})</span>
        </button>

        <button
          onClick={() => setActiveFilter('has_reply')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
            activeFilter === 'has_reply'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Ответ получен ({hasReplyCount})</span>
        </button>

        <button
          onClick={() => setActiveFilter('interested')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
            activeFilter === 'interested'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-emerald-300 hover:bg-slate-900'
          }`}
        >
          <span>Заинтересованы ({interestedCount})</span>
        </button>

        <button
          onClick={() => setActiveFilter('discussing_terms')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
            activeFilter === 'discussing_terms'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-purple-300 hover:bg-slate-900'
          }`}
        >
          <span>Условия ({termsCount})</span>
        </button>

        <button
          onClick={() => setActiveFilter('awaiting_reply')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
            activeFilter === 'awaiting_reply'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Ожидают ответа</span>
        </button>

        <button
          onClick={() => setActiveFilter('unverified')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
            activeFilter === 'unverified'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          title="39 контактов из старой базы без зафиксированных ответов"
        >
          <span>Не проверено ({unverifiedCount})</span>
        </button>

        <button
          onClick={() => setActiveFilter('refused')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
            activeFilter === 'refused'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-rose-400 hover:bg-slate-900'
          }`}
        >
          <span>Отказы ({refusedCount})</span>
        </button>

        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
            activeFilter === 'all'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Все ({allContacts.length})</span>
        </button>
      </div>

      {allContacts.length === 0 ? (
        <div className="p-10 text-center bg-slate-950/40 rounded-xl border border-slate-800">
          <Clock className="w-10 h-10 text-blue-400 mx-auto mb-2 opacity-80" />
          <h3 className="text-base font-bold text-white">В очереди переговоров пока нет подтверждённых контактов</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
            Отправьте первичные сообщения в режиме Automation и подтвердите факт отправки.
          </p>
          {onNavigateToAutomation && (
            <button
              onClick={onNavigateToAutomation}
              className="ui-button px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white inline-flex items-center gap-2 font-semibold shadow-md"
            >
              <span>Перейти в режим Automation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Negotiation Queue List */}
          <div className="lg:col-span-5 bg-slate-950/70 rounded-xl border border-slate-800 p-3 flex flex-col">
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по компании или телефону..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="max-h-[560px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  В этой выборке контакты отсутствуют.
                </div>
              ) : (
                filteredContacts.map((lead) => {
                  const isSelected = lead.id === activeContact?.id;
                  const isLegacy = lead.status === 'contacted' && !lead.whatsappSentAt && (!Array.isArray(lead.conversationHistory) || lead.conversationHistory.length === 0);
                  const currentStatus = lead.conversationStatus || (isLegacy ? 'unverified' : 'awaiting_reply');
                  const meta = STATUS_METAS[currentStatus] || STATUS_METAS.unverified;

                  return (
                    <button
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-indigo-600/15 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20'
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">{lead.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">{lead.phone}</div>
                        </div>
                        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border ${meta.color} ${meta.border}`}>
                          {meta.label}
                        </span>
                      </div>

                      {lead.lastClientMessage && (
                        <div className="mt-2 text-[11px] text-slate-200 bg-slate-950/80 p-1.5 rounded border border-slate-800 truncate">
                          <span className="text-blue-400 font-semibold">Ответ: </span>
                          {lead.lastClientMessage}
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-800/60">
                        <span className="truncate max-w-[210px]">
                          Действие: {lead.nextRecommendedAction || (isLegacy ? 'Проверить диалог в WA' : 'Ожидать ответ')}
                        </span>
                        <span className="shrink-0 font-mono">
                          {formatDateTime(lead.whatsappSentAt || lead.updatedAt)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Conversation Workspace (Focus Area) */}
          {activeContact && (
            <div className="lg:col-span-7 bg-slate-950/85 rounded-xl border border-slate-800 p-4 flex flex-col justify-between">
              <div>
                {/* Contact Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{activeContact.name}</span>
                      {activeContact.isRefused && (
                        <span className="text-[11px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded">
                          ОТКАЗ (Исключён)
                        </span>
                      )}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                      <span className="font-mono text-indigo-300 font-semibold">{activeContact.phone}</span>
                      <span>•</span>
                      <span>{activeContact.city}</span>
                      <span>•</span>
                      <span>{activeContact.category}</span>
                      <span>•</span>
                      <span className="text-slate-400">
                        Первичная отправка: {formatDateTime(activeContact.whatsappSentAt)}
                      </span>
                    </div>
                  </div>

                  {/* WhatsApp Direct Link and Manual Status Selector */}
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://wa.me/${activeContact.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ui-button-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                      title="Открыть чат в WhatsApp"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Чат WA</span>
                    </a>

                    <select
                      value={activeContact.conversationStatus || (activeContact.status === 'contacted' && !activeContact.whatsappSentAt ? 'unverified' : 'awaiting_reply')}
                      onChange={(e) => handleManualStatusChange(e.target.value as ConversationStatus)}
                      className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="needs_reply">Нужен мой ответ</option>
                      <option value="has_reply">Ответ получен</option>
                      <option value="interested">Заинтересован</option>
                      <option value="discussing_terms">Обсуждение условий</option>
                      <option value="awaiting_reply">Ожидает ответа</option>
                      <option value="refused">Отказ</option>
                      <option value="completed">Завершено</option>
                      <option value="unverified">Не проверено</option>
                    </select>
                  </div>
                </div>

                {/* Chronological Message History */}
                <div className="mt-3">
                  <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>История сообщений</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {activeContact.conversationHistory?.length || 1} сообщ.
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2 p-2.5 rounded-lg border border-slate-800 bg-slate-900/50 custom-scrollbar">
                    {activeContact.conversationHistory && activeContact.conversationHistory.length > 0 ? (
                      activeContact.conversationHistory.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-2.5 rounded-lg text-xs leading-relaxed max-w-[85%] ${
                            msg.sender === 'client'
                              ? 'bg-slate-800 text-slate-200 border border-slate-700 mr-auto'
                              : 'bg-indigo-600/20 text-indigo-100 border border-indigo-500/30 ml-auto'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 mb-1">
                            <span className="font-semibold text-slate-300">
                              {msg.sender === 'client' ? activeContact.name : 'Я (WhatsApp)'}
                            </span>
                            <span>{formatDateTime(msg.timestamp)}</span>
                          </div>
                          <div className="whitespace-pre-wrap">{msg.text}</div>
                        </div>
                      ))
                    ) : (
                      <div className="p-2.5 rounded-lg text-xs leading-relaxed bg-indigo-600/20 text-indigo-100 border border-indigo-500/30 ml-auto max-w-[85%]">
                        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 mb-1">
                          <span className="font-semibold text-indigo-200">Первичное обращение</span>
                          <span>{formatDateTime(activeContact.whatsappSentAt)}</span>
                        </div>
                        <div className="whitespace-pre-wrap">{activeContact.customPitch || 'Сообщение отправлено.'}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Input Area: Paste Client Message */}
                <div className="mt-3.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                      Получен ответ от клиента в WhatsApp (скопируйте сюда):
                    </span>
                  </label>

                  <textarea
                    value={clientInputText}
                    onChange={(e) => setClientInputText(e.target.value)}
                    rows={3}
                    placeholder="Вставьте ответ клиента (например: «Сколько стоит сделать такой сайт?» или «Пришлите ваши примеры»)..."
                    className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 custom-scrollbar"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAnalyzeClientMessage}
                        disabled={isAnalyzing || !clientInputText.trim()}
                        className="ui-button px-3.5 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 font-semibold disabled:opacity-40 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isAnalyzing ? 'Jarvis анализирует...' : 'Анализировать с Jarvis'}</span>
                      </button>

                      <button
                        onClick={handleRecordRefusal}
                        className="ui-button-secondary px-3 py-1.5 text-xs text-rose-300 hover:text-rose-200 border-rose-500/30 hover:bg-rose-500/10 flex items-center gap-1"
                        title="Клиент отказался — исключить из дальнейших предложений"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Зафиксировать отказ</span>
                      </button>
                    </div>

                    {analysisError && (
                      <span className="text-xs text-rose-400 font-medium animate-fade-in flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{analysisError}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Jarvis Structured Negotiation Card */}
                {analysisResult && (
                  <div className="mt-3.5 p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-950/40 animate-fade-in space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-indigo-500/20">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-bold text-white">Вывод Jarvis:</span>
                        <span className="text-xs font-semibold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                          {analysisResult.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-300">
                        Намерение: <strong>{analysisResult.intent}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold mb-0.5">Вопросы и возражения:</div>
                        <div className="text-slate-200">{analysisResult.keyPoints}</div>
                      </div>
                      <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold mb-0.5">Рекомендуемое действие:</div>
                        <div className="text-indigo-200 font-medium">{analysisResult.recommendedAction}</div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Черновик ответа для WhatsApp (отредактируйте при необходимости):
                      </label>
                      <textarea
                        value={editableReplyText}
                        onChange={(e) => setEditableReplyText(e.target.value)}
                        rows={3}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-500/20">
                      <button
                        onClick={handleCopyAndOpenWhatsApp}
                        className="ui-button px-3.5 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 font-semibold"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'Скопировано в буфер! Открываем WA' : 'Скопировать и открыть WhatsApp'}</span>
                      </button>

                      <button
                        onClick={handleConfirmReplySent}
                        disabled={isSavingReply}
                        className="ui-button px-3.5 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 font-semibold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{isSavingReply ? 'Сохранение...' : 'Подтвердить отправку ответа'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
