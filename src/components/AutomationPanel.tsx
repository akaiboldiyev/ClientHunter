import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Filter,
  Check,
  Edit3,
  ThumbsUp,
  SkipForward,
  MessageCircle,
  Clock,
  Send,
  Sliders,
  ShieldCheck,
  Building2,
  Phone,
  MapPin,
  Star
} from 'lucide-react';
import { BusinessLead } from '../types';
import { analyzeLeadOpportunity, filterLeadsBySegment, LeadSegmentCriteria } from '../utils/leadScoring';

interface AutomationPanelProps {
  leads: BusinessLead[];
  onLeadsUpdated: () => void;
  onNavigateToCommunication?: () => void;
}

type CampaignSubTab = 'qualification' | 'review' | 'sending';

export function AutomationPanel({ leads, onLeadsUpdated, onNavigateToCommunication }: AutomationPanelProps) {
  const [currentTab, setCurrentTab] = useState<CampaignSubTab>('qualification');

  // Segmentation criteria
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState<boolean>(true);
  const [whatsappOnly, setWhatsappOnly] = useState<boolean>(true);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Active lead in review / work
  const [activeReviewLeadId, setActiveReviewLeadId] = useState<string | null>(null);
  const [editingPitchText, setEditingPitchText] = useState<string>('');
  const [isSavedNotice, setIsSavedNotice] = useState<boolean>(false);

  // Sending state
  const [openedChatIds, setOpenedChatIds] = useState<Record<string, boolean>>({});
  const [confirmingLeadId, setConfirmingLeadId] = useState<string | null>(null);

  // Available unique categories & cities
  const uniqueCategories = Array.from(new Set(leads.map(l => l.category).filter(Boolean))).sort();
  const uniqueCities = Array.from(new Set(leads.map(l => l.city).filter(Boolean))).sort();

  // Filtered segment leads (excluding already contacted or lost)
  const segmentLeads = filterLeadsBySegment(
    leads.filter(l => l.status !== 'contacted' && l.status !== 'lost'),
    {
      category: selectedCategory,
      city: selectedCity,
      onlyWithoutWebsite,
      whatsappOnly,
      priorityLevel: priorityFilter
    }
  );

  // Approved leads waiting for WhatsApp sending
  const approvedQueue = leads.filter(l =>
    (l.status === 'approved' || l.status === 'prepared' || Boolean(l.customPitch)) &&
    l.whatsappStatus === 'available' &&
    !l.whatsappSentAt &&
    l.status !== 'contacted' &&
    l.status !== 'lost'
  );

  // Active lead for Step B (Review)
  const activeLead = leads.find(l => l.id === activeReviewLeadId) || segmentLeads[0] || null;
  const leadAnalysis = activeLead ? analyzeLeadOpportunity(activeLead) : null;

  useEffect(() => {
    if (activeLead && leadAnalysis) {
      setEditingPitchText(leadAnalysis.draftMessage);
      setIsSavedNotice(false);
    }
  }, [activeLead?.id]);

  // Select lead for review and go to Step B
  const handleSelectForReview = (lead: BusinessLead) => {
    setActiveReviewLeadId(lead.id);
    const analysis = analyzeLeadOpportunity(lead);
    setEditingPitchText(analysis.draftMessage);
    setCurrentTab('review');
  };

  // Step B Action: Approve Lead
  const handleApprovePitch = async (leadId: string) => {
    try {
      await fetch(`/api/leads/${encodeURIComponent(leadId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPitch: editingPitchText })
      });
      onLeadsUpdated();

      // Find next lead in segment
      const currentIndex = segmentLeads.findIndex(l => l.id === leadId);
      const nextLead = segmentLeads[currentIndex + 1];
      if (nextLead) {
        setActiveReviewLeadId(nextLead.id);
      } else {
        // If all reviewed, switch to sending queue
        setCurrentTab('sending');
      }
    } catch {
      console.error('Failed to approve lead pitch');
    }
  };

  // Step B Action: Save edited pitch text
  const handleSaveEditedPitch = async (leadId: string) => {
    try {
      await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPitch: editingPitchText })
      });
      setIsSavedNotice(true);
      onLeadsUpdated();
      setTimeout(() => setIsSavedNotice(false), 2000);
    } catch {
      console.error('Failed to save edited pitch');
    }
  };

  // Step B Action: Skip lead
  const handleSkipLead = (leadId: string) => {
    const currentIndex = segmentLeads.findIndex(l => l.id === leadId);
    const nextLead = segmentLeads[currentIndex + 1] || segmentLeads[0];
    if (nextLead && nextLead.id !== leadId) {
      setActiveReviewLeadId(nextLead.id);
    }
  };

  // Step C Action 1: Open WhatsApp
  const handleOpenWhatsApp = (lead: BusinessLead) => {
    const cleanPhone = lead.phone.replace(/\D/g, '');
    const pitch = lead.customPitch || editingPitchText || '';
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(pitch)}`;

    setOpenedChatIds(prev => ({ ...prev, [lead.id]: true }));
    void fetch(`/api/leads/${encodeURIComponent(lead.id)}/open-whatsapp`, { method: 'POST' });

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Step C Action 2: Confirm sending
  const handleConfirmSent = async (leadId: string) => {
    setConfirmingLeadId(leadId);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/confirm-sent`, {
        method: 'POST'
      });
      if (res.ok) {
        setOpenedChatIds(prev => {
          const next = { ...prev };
          delete next[leadId];
          return next;
        });
        onLeadsUpdated();
      }
    } catch {
      console.error('Failed to confirm sent');
    } finally {
      setConfirmingLeadId(null);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 mb-6 shadow-xl backdrop-blur-sm">
      {/* Workflow Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>Кампания первичных продаж</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full border bg-blue-500/15 border-blue-500/30 text-blue-300 font-semibold">
              Режим A: Automation
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Структурированный процесс: отбор сегмента ➔ оценка возможности ➔ согласование питча ➔ отправка в WhatsApp
          </p>
        </div>

        {/* Sub-Tabs: 3-Step Process */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setCurrentTab('qualification')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              currentTab === 'qualification'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Шаг A: Квалификация ({segmentLeads.length})</span>
          </button>

          <button
            onClick={() => setCurrentTab('review')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              currentTab === 'review'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Шаг B: Разбор предложения</span>
          </button>

          <button
            onClick={() => setCurrentTab('sending')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              currentTab === 'sending'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Шаг C: Отправка WA ({approvedQueue.length})</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: LEAD QUALIFICATION & SEGMENTATION (Шаг A)
         ========================================================================= */}
      {currentTab === 'qualification' && (
        <div className="mt-4 space-y-4 animate-fade-in">
          {/* Segment Filter Controls */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Сфера деятельности</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Все категории ({leads.length})</option>
                {uniqueCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Город</label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Все города</option>
                {uniqueCities.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Приоритет (скоринг)</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Все приоритеты</option>
                <option value="high">Высокий (Score &ge; 75%)</option>
                <option value="medium">Средний (50-74%)</option>
                <option value="low">Базовый (&lt; 50%)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-5">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyWithoutWebsite}
                  onChange={(e) => setOnlyWithoutWebsite(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                />
                <span>Только без сайта (2GIS)</span>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-5">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappOnly}
                  onChange={(e) => setWhatsappOnly(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                />
                <span>Подтверждённый WhatsApp</span>
              </label>
            </div>
          </div>

          {/* Qualified Leads Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Лиды в выбранном сегменте: <strong className="text-white">{segmentLeads.length}</strong></span>
              <span>Оценка приоритета рассчитывается строго по проверяемым фактам</span>
            </div>

            {segmentLeads.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
                По выбранным критериям лиды не найдены. Смягчите фильтры.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {segmentLeads.slice(0, 30).map((lead) => {
                  const opp = analyzeLeadOpportunity(lead);
                  const priorityColor =
                    opp.priorityLevel === 'high' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                    opp.priorityLevel === 'medium' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                    'text-slate-400 bg-slate-800 border-slate-700';

                  return (
                    <div
                      key={lead.id}
                      className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between transition"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="text-xs font-bold text-white truncate">{lead.name}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${priorityColor}`}>
                            {opp.priorityScore}%
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-2">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{lead.city} • {lead.category}</span>
                        </div>

                        {/* Verified facts pill list */}
                        <div className="space-y-1 my-2">
                          {opp.whySelected.slice(0, 2).map((fact, i) => (
                            <div key={i} className="text-[10px] text-slate-300 flex items-start gap-1 bg-slate-900/80 px-2 py-1 rounded border border-slate-800/80">
                              <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{fact}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400">{lead.phone}</span>
                        <button
                          onClick={() => handleSelectForReview(lead)}
                          className="ui-button px-2.5 py-1 text-[11px] bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1"
                        >
                          <span>Разбор</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: OPPORTUNITY REVIEW & PITCH APPROVAL (Шаг B)
         ========================================================================= */}
      {currentTab === 'review' && (
        <div className="mt-4 animate-fade-in">
          {!activeLead || !leadAnalysis ? (
            <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
              Выберите компанию для разбора на Шаге A.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Organization Facts & Opportunity Breakdown */}
              <div className="lg:col-span-5 space-y-3 bg-slate-950/70 rounded-xl border border-slate-800 p-4">
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-white">{activeLead.name}</h3>
                    <div className="text-xs text-slate-400 mt-0.5 font-mono">{activeLead.phone}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{activeLead.city} • {activeLead.category}</div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-blue-500/15 border-blue-500/30 text-blue-300">
                    Приоритет: {leadAnalysis.priorityScore}%
                  </span>
                </div>

                {/* 1. Why Selected */}
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    1. Почему выбран этот лид (подтверждённые факты)
                  </div>
                  <ul className="space-y-1 text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    {leadAnalysis.whySelected.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 2. Potential Problem */}
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    2. Потенциальная проблема для проверки
                  </div>
                  <div className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                    {leadAnalysis.potentialProblem}
                  </div>
                </div>

                {/* 3. Recommended Offer */}
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    3. Рекомендуемое предложение
                  </div>
                  <div className="text-xs text-purple-200 bg-purple-950/30 p-2.5 rounded-lg border border-purple-500/30 leading-relaxed">
                    {leadAnalysis.recommendedPitchType}
                  </div>
                </div>
              </div>

              {/* Right Column: Draft Message & Approval Actions */}
              <div className="lg:col-span-7 bg-slate-950/80 rounded-xl border border-slate-800 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                      4. Черновик первого обращения (без лести и выдуманных кейсов)
                    </label>
                    {isSavedNotice && (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                        <Check className="w-3 h-3" /> Сохранено
                      </span>
                    )}
                  </div>

                  <textarea
                    value={editingPitchText}
                    onChange={(e) => setEditingPitchText(e.target.value)}
                    rows={7}
                    className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                    placeholder="Текст сообщения..."
                  />

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 mb-4">
                    <span>Вы можете отредактировать текст перед одобрением</span>
                    <span>{editingPitchText.length} символов</span>
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1">
                    <div className="font-semibold text-slate-300">Стандарты обращения:</div>
                    <div>• Никаких стандартных фраз «Поздравляем с рейтингом»</div>
                    <div>• Не утверждать, что сайт гарантированно поднимет продажи</div>
                    <div>• Честно предложить ознакомиться с концептом страницы для удобства клиентов</div>
                  </div>
                </div>

                {/* 5. Action Buttons */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveEditedPitch(activeLead.id)}
                      className="ui-button-secondary px-3 py-2 text-xs"
                    >
                      Сохранить текст
                    </button>
                    <button
                      onClick={() => handleSkipLead(activeLead.id)}
                      className="ui-button-secondary px-3 py-2 text-xs flex items-center gap-1 text-slate-400 hover:text-white"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>Пропустить</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleApprovePitch(activeLead.id)}
                    className="ui-button px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 font-bold shadow-md shadow-emerald-950/40"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>5. Одобрить предложение</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: WHATSAPP SENDING QUEUE (Шаг C)
         ========================================================================= */}
      {currentTab === 'sending' && (
        <div className="mt-4 animate-fade-in space-y-4">
          <div className="p-3.5 rounded-xl border border-blue-500/25 bg-blue-500/10 text-xs text-blue-200 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-100">Правило отправки WhatsApp: </span>
              <span>Открытие ссылки подставляет текст в диалог, но само по себе <strong>не является отправкой</strong>. Нажмите «1. Открыть WhatsApp», отправьте сообщение в чате, вернитесь сюда и нажмите «2. Подтвердить отправку».</span>
            </div>
          </div>

          {approvedQueue.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
              В очереди отправки нет контактов. Одобрите предложения на Шаге B.
            </div>
          ) : (
            <div className="space-y-3">
              {approvedQueue.map((lead, idx) => {
                const isOpened = Boolean(openedChatIds[lead.id]);
                const isConfirming = confirmingLeadId === lead.id;

                return (
                  <div
                    key={lead.id}
                    className="bg-slate-950/80 rounded-xl border border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500">{idx + 1}.</span>
                        <h4 className="text-sm font-bold text-white truncate">{lead.name}</h4>
                        <span className="text-xs text-slate-400 font-mono">{lead.phone}</span>
                        {lead.status === 'approved' && (
                          <span className="text-[10px] px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 font-semibold">
                            Одобрено
                          </span>
                        )}
                        {isOpened && (
                          <span className="text-[10px] px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/15 text-amber-300 font-semibold">
                            Чат открыт
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-1 line-clamp-2 bg-slate-900/70 p-2 rounded border border-slate-800/80">
                        {lead.customPitch || 'Сообщение готово к отправке'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenWhatsApp(lead)}
                        className="ui-button px-3.5 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 font-semibold"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>1. Открыть WA</span>
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </button>

                      <button
                        onClick={() => handleConfirmSent(lead.id)}
                        disabled={isConfirming}
                        className={`ui-button px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 ${
                          isOpened
                            ? 'bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-400 shadow-md animate-pulse'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>2. Подтвердить отправку</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
