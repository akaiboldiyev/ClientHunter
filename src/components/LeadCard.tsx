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
  const initials = lead.name.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();

  return (
    <div
      className={`ui-panel relative flex min-h-[326px] flex-col justify-between p-4 transition-all duration-200 ${
        isSelected
          ? 'border-blue-400/70 shadow-[0_12px_36px_rgb(43_99_255/20%)] ring-1 ring-blue-400/30'
          : 'hover:-translate-y-0.5 hover:border-slate-600 hover:shadow-[var(--shadow-panel)]'
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(lead.id)}
              className="mt-1 h-4 w-4 rounded border-slate-500 bg-[var(--surface-3)] text-blue-500"
            />
            <div className="flex min-w-0 gap-2.5"><span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(145deg,#16284b,#0d1830)] text-xs font-bold text-blue-200 ring-1 ring-white/10">{initials}</span><button type="button" onClick={() => onOpenDetail(lead)} className="text-left text-[15px] font-semibold leading-5 text-white transition-colors hover:text-blue-300">{lead.name}</button></div>
          </div>

          {lead.leadQuality === 'hot' && !lead.hasWebsite && (
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-800">
              <Flame className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
              HOT
            </span>
          )}
        </div>

        {/* Website status badge & City */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {!lead.hasWebsite ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
              <GlobeX className="w-3.5 h-3.5 text-amber-300" />
              <span>НЕТ САЙТА</span>
            </span>
          ) : (
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
            className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
            >
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              <span className="truncate">{lead.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
            </a>
          )}

          <span className="rounded-md bg-[var(--surface-3)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
            {lead.city} • {lead.category}
          </span>
        </div>

        {/* Address & Maps */}
        <div className="mb-4 space-y-1.5 text-xs text-[var(--text-secondary)]">
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{lead.address || 'Адрес не указан'}</span>
          </div>

            <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1 font-bold text-slate-100">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>{lead.rating || 0}</span>
              <span className="font-normal text-slate-400">({lead.reviews || 0} отзывов)</span>
            </div>

            {lead.maps_url && (
              <a
                href={lead.maps_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-medium text-blue-300 hover:text-blue-200"
              >
                <span>Карты</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Notes preview if exists */}
        {lead.notes && (
          <div className="mb-4 rounded-xl bg-[#070d1a] p-2.5 text-xs italic leading-[1.45] text-[var(--text-secondary)] line-clamp-2">
            "{lead.notes}"
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="flex flex-col gap-2.5 border-t pt-3">
        {/* Phone & WhatsApp Quick Connect */}
        <div className="flex items-center justify-between gap-2">
          {lead.phone ? (
            <div className="flex items-center gap-2">
              <a
                href={`tel:${cleanPhone}`}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-100 hover:text-blue-300"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lead.phone}</span>
              </a>
              {lead.whatsappStatus === 'available' && <a
                href={`https://wa.me/${cleanPhone.replace('+', '')}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Написать ${lead.name} в WhatsApp`}
                className="ui-icon-button min-h-9 min-w-9 rounded-lg p-1 text-emerald-400 hover:bg-emerald-500/10"
                title="Написать в WhatsApp"
              >
                <Send className="w-3.5 h-3.5" />
              </a>}
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">Телефон не указан</span>
          )}

          {/* Status Dropdown */}
          <select
            value={lead.status}
            onChange={(e) => onChangeStatus(lead.id, e.target.value as any)}
            aria-label={`Статус CRM: ${lead.name}`}
            className="min-h-9 rounded-lg border bg-[var(--surface-3)] px-2 py-1 text-xs font-semibold text-slate-200"
          >
            <option value="new">Новый</option>
            <option value="contacted">Связались</option>
            <option value="meeting">Встреча</option>
            <option value="negotiation">Переговоры</option>
            <option value="won">Выиграно</option>
            <option value="lost">Отказ</option>
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenPitch(lead)}
          className="ui-button-primary flex flex-1 px-3 py-2 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Готовое КП / Скрипт</span>
          </button>

          <button
            onClick={() => onOpenDetail(lead)}
            aria-label={`Открыть заметки: ${lead.name}`}
            className="ui-icon-button min-h-10 min-w-10 rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
            title="Заметки"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDeleteLead(lead.id)}
            aria-label={`Удалить лид: ${lead.name}`}
            className="ui-icon-button min-h-10 min-w-10 rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
