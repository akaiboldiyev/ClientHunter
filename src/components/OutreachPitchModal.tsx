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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                Скрипты продаж для {lead.name}
              </h3>
              <p className="text-xs text-slate-500">
                {lead.city} • {lead.category} • {lead.rating}★ ({lead.reviews} отзывов)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Channel Tabs */}
        <div className="flex items-center gap-2 p-3 bg-slate-100/70 border-b border-slate-200 overflow-x-auto text-xs font-semibold">
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
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
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
        <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-50/50">
          <div className="text-xs text-slate-500">
            Телефон для связи: <strong className="text-slate-800">{lead.phone || 'Не указан'}</strong>
          </div>

          <div className="flex items-center gap-2">
            {cleanPhone.replace(/\D/g, '') && (
              <button
                onClick={handleOpenWhatsApp}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Открыть в WhatsApp с текстом</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
