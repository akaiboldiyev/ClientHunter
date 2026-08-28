import React from 'react';
import { 
  Phone, 
  MapPin, 
  ExternalLink, 
  Star, 
  GlobeX, 
  Globe, 
  Sparkles, 
  MessageSquare, 
  Trash2, 
  Flame, 
  Send 
} from 'lucide-react';
import { BusinessLead } from '../types';

interface LeadCardProps {
  lead: BusinessLead;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onOpenPitch: (lead: BusinessLead) => void;
  onOpenDetail: (lead: BusinessLead) => void;
  onChangeStatus: (leadId: string, status: BusinessLead['status']) => void;
  onDeleteLead: (leadId: string) => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  isSelected,
  onToggleSelect,
  onOpenPitch,
  onOpenDetail,
  onChangeStatus,
  onDeleteLead
}) => {
  const cleanPhone = (lead.phone || '').replace(/[^\d+]/g, '');

  return (
    <div
      className={`bg-white rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all relative ${
        isSelected
          ? 'border-blue-500 shadow-md ring-1 ring-blue-500/30'
          : 'border-slate-200 shadow-2xs hover:shadow-sm'
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(lead.id)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-0.5"
            />
            <h3
              onClick={() => onOpenDetail(lead)}
              className="font-bold text-slate-900 text-base hover:text-blue-600 cursor-pointer transition-colors leading-tight"
            >
              {lead.name}
            </h3>
          </div>

          {lead.leadQuality === 'hot' && !lead.hasWebsite && (
            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[11px] font-bold rounded-md flex items-center gap-1 shrink-0">
              <Flame className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
              HOT
            </span>
          )}
        </div>

        {/* Website status badge & City */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {!lead.hasWebsite ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              <GlobeX className="w-3.5 h-3.5 text-amber-700" />
              <span>НЕТ САЙТА</span>
            </span>
          ) : (
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors truncate max-w-[180px]"
            >
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              <span className="truncate">{lead.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
            </a>
          )}

          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium">
            {lead.city} • {lead.category}
          </span>
        </div>

        {/* Address & Maps */}
        <div className="space-y-1.5 text-xs text-slate-600 mb-4">
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{lead.address || 'Адрес не указан'}</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1 font-bold text-slate-800">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>{lead.rating || 0}</span>
              <span className="text-slate-400 font-normal">({lead.reviews || 0} отзывов)</span>
            </div>

            {lead.maps_url && (
              <a
                href={lead.maps_url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1"
              >
                <span>Карты</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Notes preview if exists */}
        {lead.notes && (
          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 italic mb-4 line-clamp-2">
            "{lead.notes}"
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
        {/* Phone & WhatsApp Quick Connect */}
        <div className="flex items-center justify-between gap-2">
          {lead.phone ? (
            <div className="flex items-center gap-2">
              <a
                href={`tel:${cleanPhone}`}
                className="text-xs font-bold text-slate-800 hover:text-blue-600 flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lead.phone}</span>
              </a>
              <a
                href={`https://wa.me/${cleanPhone.replace('+', '')}`}
                target="_blank"
                rel="noreferrer"
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                title="Написать в WhatsApp"
              >
                <Send className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">Телефон не указан</span>
          )}

          {/* Status Dropdown */}
          <select
            value={lead.status}
            onChange={(e) => onChangeStatus(lead.id, e.target.value as any)}
            className="text-xs font-semibold px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-700"
          >
            <option value="new">🆕 Новый</option>
            <option value="contacted">📞 Связались</option>
            <option value="meeting">🤝 Встреча</option>
            <option value="negotiation">💼 Переговоры</option>
            <option value="won">🏆 Выиграно</option>
            <option value="lost">❌ Отказ</option>
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenPitch(lead)}
            className="flex-1 py-1.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Готовое КП / Скрипт</span>
          </button>

          <button
            onClick={() => onOpenDetail(lead)}
            className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title="Заметки"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDeleteLead(lead.id)}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
