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
    <div role="dialog" aria-modal="true" aria-labelledby="pitch-title" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 sm:max-h-[90vh] sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 id="pitch-title" className="flex items-center gap-2 text-base font-bold text-slate-950">
                Скрипты продаж для {lead.name}
              </h3>
              <p className="text-xs text-slate-500">
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
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 p-3 text-xs font-semibold">
          {templates.map((tpl) => {
            const isActive = tpl.id === selectedTemplateId;
            return (
              <button
                key={tpl.id}
                onClick={() => setSelectedTemplateId(tpl.id)}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
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
          {copyError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{copyError}</p>}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {activeTemplate.title}
            </span>

            <button
              onClick={() => handleCopy(activeTemplate.text, activeTemplate.id)}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
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

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {activeTemplate.text}
          </div>

          {/* Quick tips */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1">
            <p className="font-semibold">💡 Совет по первому контакту:</p>
            <p className="text-amber-800/90">
              Всегда делайте акцент на их высоком рейтинге ({lead.rating}★ на картах) — это растапливает лед. Покажите, что потеря клиентов из-за отсутствия сайта решается за 2-3 дня.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            Телефон для связи: <strong className="text-slate-800">{lead.phone || 'Не указан'}</strong>
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
