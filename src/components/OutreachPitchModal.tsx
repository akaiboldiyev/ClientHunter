import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Send, Sparkles, MessageCircle, PhoneCall, Mail, Share2 } from 'lucide-react';
import { BusinessLead } from '../types';
import { generatePitchTemplates, PitchTemplate } from '../utils/pitchGenerator';

interface OutreachPitchModalProps {
  lead: BusinessLead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateNotes: (leadId: string, notes: string) => void;
}

export const OutreachPitchModal: React.FC<OutreachPitchModalProps> = ({
  lead,
  isOpen,
  onClose,
  onUpdateNotes
}) => {
  const templates = lead ? generatePitchTemplates(lead) : [];
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTemplateId(templates[0]?.id ?? '');
    setCopiedId(null);
    setCopyError(null);
  }, [lead?.id]);

  const activeTemplate = templates.find((template) => template.id === selectedTemplateId) || templates[0];
  const cleanPhone = (lead?.phone || '').replace(/[^\d+]/g, '');

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setCopyError(null);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopyError('Не удалось скопировать текст. Выделите его и скопируйте вручную.');
    }
  };

  const handleOpenWhatsApp = () => {
    if (!activeTemplate || !cleanPhone.replace(/\D/g, '')) return;
    const text = encodeURIComponent(activeTemplate.text);
    const url = `https://wa.me/${cleanPhone.replace('+', '')}?text=${text}`;
    window.open(url, '_blank');
  };

  if (!isOpen || !lead || !activeTemplate) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pitch-title" className="ui-modal-shell animate-fade-in">
      <div className="ui-modal-panel max-w-2xl">
        {/* Header */}
        <div className="ui-modal-header">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/15 text-blue-200">
              <Sparkles className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 id="pitch-title" className="text-balance text-base font-bold text-white">
                Скрипты продаж для {lead.name}
              </h3>
              <p className="text-xs text-slate-400">
                {lead.city} • {lead.category} • {lead.rating}★ ({lead.reviews} отзывов)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="ui-icon-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Channel Tabs */}
        <div className="grid grid-cols-2 gap-1.5 border-b border-slate-800 bg-slate-900/80 p-3 text-xs font-semibold sm:flex sm:flex-wrap sm:items-center">
          {templates.map((tpl) => {
            const isActive = tpl.id === selectedTemplateId;
            return (
              <button
                key={tpl.id}
                onClick={() => setSelectedTemplateId(tpl.id)}
                className={`min-h-9 rounded-lg px-3 py-1.5 flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-500/15 text-blue-100 shadow-2xs ring-1 ring-blue-400/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tpl.channel === 'whatsapp' && <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />}
                {tpl.channel === 'call' && <PhoneCall className="w-3.5 h-3.5 text-blue-600" />}
                {tpl.channel === 'instagram_dm' && <Share2 className="w-3.5 h-3.5 text-pink-600" />}
                {tpl.channel === 'email' && <Mail className="w-3.5 h-3.5 text-purple-600" />}
                <span>{tpl.channel === 'whatsapp' ? 'WhatsApp / TG' : tpl.channel === 'call' ? 'Звонок' : tpl.channel === 'instagram_dm' ? 'Instagram' : 'Email'}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          {copyError && <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{copyError}</p>}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {activeTemplate.title}
            </span>

            <button
              onClick={() => handleCopy(activeTemplate.text, activeTemplate.id)}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
            >
              {copiedId === activeTemplate.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Скопировано!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Копировать</span>
                </>
              )}
            </button>
          </div>

          <div className="break-words whitespace-pre-wrap rounded-2xl border border-slate-700 bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-200 sm:text-sm">
            {activeTemplate.text}
          </div>

          {/* Quick tips */}
          <div className="space-y-1 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            <p className="font-semibold">💡 Совет по первому контакту:</p>
            <p className="text-amber-200/90">
              Всегда делайте акцент на их высоком рейтинге ({lead.rating}★ на картах) — это растапливает лед. Покажите, что потеря клиентов из-за отсутствия сайта решается за 2-3 дня.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-400">
            Телефон для связи: <strong className="text-slate-100">{lead.phone || 'Не указан'}</strong>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {cleanPhone.replace(/\D/g, '') && (
              <button
                onClick={handleOpenWhatsApp}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-600/25 transition hover:bg-emerald-700"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Открыть в WhatsApp с текстом</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="ui-button-secondary px-4 py-2 text-xs"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
