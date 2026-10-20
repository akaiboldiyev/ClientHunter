import React from 'react';
import { Target, Plus, Bot, MessageSquare, Sparkles } from 'lucide-react';
import { BusinessLead } from '../types';

export type AppMode = 'cockpit' | 'automation' | 'communication' | 'leads';

interface NavbarProps {
  leads: BusinessLead[];
  activeMode: AppMode;
  onChangeMode: (mode: AppMode) => void;
  onOpenAddModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  leads,
  activeMode,
  onChangeMode,
  onOpenAddModal
}) => {
  const withoutWebCount = leads.filter(l => !l.hasWebsite).length;
  const readyPhoneNumbers = new Set<string>();
  const readyAutomationCount = leads.filter(l => {
    const rawPhone = l.phones?.find(phone => phone.normalized)?.normalized || l.phone || '';
    const digits = String(rawPhone).replace(/\D/g, '');
    const phone = /^8\d{10}$/.test(digits) ? `7${digits.slice(1)}` : digits;
    const hasPriorInitialSend = (Array.isArray(l.conversationHistory) ? l.conversationHistory : []).some(message =>
      (message.sender === 'jarvis' || message.sender === 'user') && !message.inReplyTo &&
      ['sent', 'delivered', 'read'].includes(message.delivery || '')
    );
    const eligible = Boolean(
      ['prepared', 'approved'].includes(l.status) && l.whatsappStatus === 'available' &&
      Boolean(l.customPitch?.trim()) && phone.length >= 8 && phone.length <= 15 &&
      !l.whatsappSentAt && !l.whatsappSendAttemptAt && !hasPriorInitialSend &&
      !l.isRefused && !l.jarvisManualControl && l.jarvisStatus !== 'error' && !readyPhoneNumbers.has(phone)
    );
    if (eligible) readyPhoneNumbers.add(phone);
    return eligible;
  }).length;
  const communicationCount = leads.filter(l =>
    (Array.isArray(l.conversationHistory) && l.conversationHistory.some(m => m.sender === 'client')) ||
    l.conversationStatus === 'needs_reply' ||
    l.conversationStatus === 'interested'
  ).length;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 shadow-lg shadow-slate-950/20 backdrop-blur-xl">
      <div className="flex min-h-[68px] w-full flex-wrap items-center justify-between gap-2 px-4 py-2 sm:gap-3 sm:px-6 lg:px-6 xl:px-8">
        {/* Brand */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => onChangeMode('cockpit')}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white sm:text-lg">Jarvis</span>
              <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-[11px] font-bold text-blue-200">
                ClientHunter
              </span>
            </div>
            <p className="hidden text-xs text-slate-400 sm:block">
              Рабочее место B2B продаж и переговоров
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <nav aria-label="Режимы работы" className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/90 p-1 shadow-inner">
          <button
            type="button"
            onClick={() => onChangeMode('cockpit')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              activeMode === 'cockpit'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>Рабочее место</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMode('automation')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              activeMode === 'automation'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Кампания</span>
            {readyAutomationCount > 0 && (
              <span className="rounded-full border border-blue-400/30 bg-blue-500/20 px-1.5 py-0.2 text-[10px] text-blue-300">
                {readyAutomationCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onChangeMode('communication')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              activeMode === 'communication'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Переговоры</span>
            {communicationCount > 0 && (
              <span className="rounded-full border border-amber-400/40 bg-amber-500/25 px-1.5 py-0.2 text-[10px] text-amber-200 animate-pulse font-bold">
                {communicationCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onChangeMode('leads')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              activeMode === 'leads'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            <span className="hidden min-[480px]:inline">База лидов</span>
            <span className="rounded-full bg-slate-950/60 px-1.5 py-0.2 text-[10px] text-slate-300">
              {leads.length}
            </span>
          </button>
        </nav>
      </div>
    </header>
  );
};
