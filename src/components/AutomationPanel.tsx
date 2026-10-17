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
import { FOLLOW_UP_DAYS, getFollowUpMessage } from '../utils/followUpSequence';

interface AutomationPanelProps {
  leads: BusinessLead[];
  onLeadsUpdated: () => void;
  onNavigateToCommunication?: () => void;
}

type CampaignSubTab = 'qualification' | 'review' | 'sending' | 'followups';

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
  const [followUpDrafts, setFollowUpDrafts] = useState<Record<string, string>>({});
  const [openedFollowUpIds, setOpenedFollowUpIds] = useState<Record<string, boolean>>({});
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUpBusyId, setFollowUpBusyId] = useState<string | null>(null);
  const [snoozeDays, setSnoozeDays] = useState<Record<string, number>>({});
  const [optInConfirmed, setOptInConfirmed] = useState<Record<string, boolean>>({});
  const [optInSource, setOptInSource] = useState<Record<string, string>>({});
  const [optInEvidence, setOptInEvidence] = useState<Record<string, string>>({});
  const [optInBusyId, setOptInBusyId] = useState<string | null>(null);
  const [optInError, setOptInError] = useState<string | null>(null);

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
  const followUpQueue = leads
    .filter(l => l.followUpStatus === 'active' && l.followUpDueAt && !l.isRefused)
    .sort((a, b) => String(a.followUpDueAt).localeCompare(String(b.followUpDueAt)));

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

  const openFollowUpInWhatsApp = async (lead: BusinessLead) => {
    const text = followUpDrafts[lead.id] ?? getFollowUpMessage(lead);
    const phone = lead.phone.replace(/\D/g, '');
    if (!phone || !text.trim()) return;
    setFollowUpError(null);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    setOpenedFollowUpIds(prev => ({ ...prev, [lead.id]: true }));
  };

  const confirmFollowUpSent = async (lead: BusinessLead) => {
    const text = (followUpDrafts[lead.id] ?? getFollowUpMessage(lead)).trim();
    if (!openedFollowUpIds[lead.id]) return;
    if (lead.followUpStep === 4 && text.includes('[добавьте')) {
      setFollowUpError('Добавьте реальный новый повод в черновик перед отправкой.');
      return;
    }
    setFollowUpBusyId(lead.id);
    setFollowUpError(null);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(lead.id)}/followup/confirm-sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      setOpenedFollowUpIds(prev => ({ ...prev, [lead.id]: false }));
      onLeadsUpdated();
    } catch (error: any) {
      setFollowUpError(error.message || 'Не удалось сохранить отправку.');
    } finally {
      setFollowUpBusyId(null);
    }
  };

  const snoozeFollowUp = async (lead: BusinessLead) => {
    setFollowUpBusyId(lead.id);
    setFollowUpError(null);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(lead.id)}/followup/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: snoozeDays[lead.id] || 7 })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      onLeadsUpdated();
    } catch (error: any) {
      setFollowUpError(error.message || 'Не удалось перенести напоминание.');
    } finally {
      setFollowUpBusyId(null);
    }
  };

  const stopFollowUp = async (lead: BusinessLead) => {
    setFollowUpBusyId(lead.id);
    setFollowUpError(null);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(lead.id)}/followup/stop`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      onLeadsUpdated();
    } catch (error: any) {
      setFollowUpError(error.message || 'Не удалось остановить цепочку.');
    } finally {
      setFollowUpBusyId(null);
    }
  };

  const recordWhatsAppOptIn = async (lead: BusinessLead) => {
    if (!optInConfirmed[lead.id] || !optInEvidence[lead.id]?.trim()) return;
    setOptInBusyId(lead.id);
    setOptInError(null);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(lead.id)}/whatsapp-opt-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed: true,
          source: optInSource[lead.id] || 'website_form',
          evidence: optInEvidence[lead.id].trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      onLeadsUpdated();
    } catch (error: any) {
      setOptInError(error.message || 'Не удалось сохранить согласие.');
    } finally {
      setOptInBusyId(null);
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
          <button
            onClick={() => setCurrentTab('followups')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              currentTab === 'followups' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Follow-up ({followUpQueue.length})</span>
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
              <span className="font-semibold text-blue-100">Локальный путь: </span>
              <span>после фиксации подтверждённого opt-in проверьте черновик, откройте чат WhatsApp в браузере, отправьте сообщение вручную и подтвердите отправку здесь. Найденные в 2GIS номера без согласия остаются вне рассылки.</span>
            </div>
          </div>
          {optInError && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{optInError}</div>}

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
                      {lead.whatsappOptInAt ? (
                        <p className="mt-2 text-xs text-emerald-200">Согласие WhatsApp записано: {lead.whatsappOptInSource} · {new Date(lead.whatsappOptInAt).toLocaleDateString('ru-RU')}</p>
                      ) : (
                        <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 space-y-2">
                          <p className="text-xs leading-relaxed text-amber-100">Автоотправка заблокирована, пока клиент явно не согласился получать сообщения в WhatsApp. Найденный в 2GIS номер не считается согласием.</p>
                          <label className="flex items-start gap-2 text-xs text-slate-200">
                            <input type="checkbox" checked={Boolean(optInConfirmed[lead.id])} onChange={event => setOptInConfirmed(prev => ({ ...prev, [lead.id]: event.target.checked }))} className="mt-0.5 accent-emerald-500" />
                            Я подтвердил, что этот клиент согласился получать мои сообщения в WhatsApp
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <label className="sr-only" htmlFor={`optin-source-${lead.id}`}>Источник согласия</label>
                            <select id={`optin-source-${lead.id}`} value={optInSource[lead.id] || 'website_form'} onChange={event => setOptInSource(prev => ({ ...prev, [lead.id]: event.target.value }))} className="min-h-10 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200">
                              <option value="website_form">Форма на сайте</option>
                              <option value="inbound_whatsapp">Клиент сам написал</option>
                              <option value="in_person">Лично</option>
                              <option value="referral">Рекомендация с подтверждённым согласием</option>
                              <option value="other">Другой подтверждённый источник</option>
                            </select>
                            <label className="sr-only" htmlFor={`optin-evidence-${lead.id}`}>Подтверждение согласия</label>
                            <input id={`optin-evidence-${lead.id}`} value={optInEvidence[lead.id] || ''} onChange={event => setOptInEvidence(prev => ({ ...prev, [lead.id]: event.target.value }))} placeholder="Где и когда дано согласие" className="min-h-10 min-w-56 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-100 placeholder:text-slate-500" />
                            <button type="button" disabled={!optInConfirmed[lead.id] || !optInEvidence[lead.id]?.trim() || optInBusyId === lead.id} onClick={() => void recordWhatsAppOptIn(lead)} className="ui-button min-h-10 px-3 py-2 text-xs bg-emerald-700 text-white disabled:opacity-40">
                              {optInBusyId === lead.id ? 'Сохраняю…' : 'Записать согласие'}
                            </button>
                          </div>
                        </div>
                      )}
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

      {currentTab === 'followups' && (
        <div className="mt-4 space-y-4 animate-fade-in">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
            Это очередь напоминаний, а не авторассылка. В назначенный день проверьте черновик, откройте WhatsApp, отправьте сообщение вручную и подтвердите отправку здесь. Любой ответ клиента ставит цепочку на паузу.
          </div>
          {followUpError && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{followUpError}</div>}
          {followUpQueue.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-8 text-center text-xs text-slate-400">
              Активных напоминаний пока нет. Первое появится через 2 дня после подтверждённой отправки.
            </div>
          ) : followUpQueue.map(lead => {
            const step = lead.followUpStep ?? 0;
            const message = followUpDrafts[lead.id] ?? getFollowUpMessage(lead, step);
            const dueDate = lead.followUpDueAt ? new Date(lead.followUpDueAt) : null;
            const isDue = dueDate ? dueDate.getTime() <= Date.now() : false;
            const needsNewReason = step === 4 && message.includes('[добавьте');
            const isBusy = followUpBusyId === lead.id;
            return (
              <article key={lead.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{lead.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-400">Касание {step + 1} из 5 · день {FOLLOW_UP_DAYS[step] ?? '—'} · {lead.phone}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${isDue ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-slate-700 text-slate-300'}`}>
                    {dueDate ? `${isDue ? 'Напоминание' : 'Запланировано'}: ${dueDate.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Дата не задана'}
                  </span>
                </div>
                <label className="block text-xs font-medium text-slate-300" htmlFor={`followup-${lead.id}`}>Черновик для проверки</label>
                <textarea
                  id={`followup-${lead.id}`}
                  value={message}
                  onChange={event => setFollowUpDrafts(prev => ({ ...prev, [lead.id]: event.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm leading-relaxed text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                {needsNewReason && <p className="text-xs text-amber-200">Последнее касание требует нового реального повода. Заполните его выше; выдуманные проекты и дефицит не добавляйте.</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={!lead.phone || isBusy || needsNewReason || !isDue} onClick={() => void openFollowUpInWhatsApp(lead)} className="ui-button min-h-10 px-3 py-2 text-xs bg-emerald-600 text-white disabled:opacity-40">
                    {openedFollowUpIds[lead.id] ? 'Открыть WhatsApp снова' : 'Открыть WhatsApp'}
                  </button>
                  <button type="button" disabled={!openedFollowUpIds[lead.id] || isBusy || needsNewReason} onClick={() => void confirmFollowUpSent(lead)} className="ui-button-secondary min-h-10 px-3 py-2 text-xs disabled:opacity-40">
                    {isBusy ? 'Сохраняю…' : 'Подтвердить отправку'}
                  </button>
                  <select aria-label={`Перенести напоминание для ${lead.name}`} value={snoozeDays[lead.id] || 7} onChange={event => setSnoozeDays(prev => ({ ...prev, [lead.id]: Number(event.target.value) }))} className="min-h-10 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200">
                    {[1, 3, 7, 14].map(days => <option key={days} value={days}>Через {days} дн.</option>)}
                  </select>
                  <button type="button" disabled={isBusy} onClick={() => void snoozeFollowUp(lead)} className="ui-button-secondary min-h-10 px-3 py-2 text-xs disabled:opacity-40">Перенести</button>
                  <button type="button" disabled={isBusy} onClick={() => void stopFollowUp(lead)} className="ui-button-secondary min-h-10 px-3 py-2 text-xs text-rose-200 disabled:opacity-40">Остановить</button>
                  {onNavigateToCommunication && <button type="button" onClick={onNavigateToCommunication} className="ui-button-secondary min-h-10 px-3 py-2 text-xs">Открыть Communication</button>}
                </div>
                {openedFollowUpIds[lead.id] && <p className="text-xs text-blue-200">Отправьте сообщение в открывшемся чате, затем вернитесь сюда и нажмите «Подтвердить отправку».</p>}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
