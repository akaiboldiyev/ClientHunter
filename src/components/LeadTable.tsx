import React from 'react';
import { 
  Phone, 
  MapPin, 
  ExternalLink, 
  Star, 
  GlobeX, 
  Globe, 
  MessageSquare, 
  Sparkles, 
  MoreHorizontal, 
  Trash2, 
  Check, 
  AlertCircle,
  Flame,
  Send
} from 'lucide-react';
import { BusinessLead } from '../types';

interface LeadTableProps {
  leads: BusinessLead[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenPitch: (lead: BusinessLead) => void;
  onOpenDetail: (lead: BusinessLead) => void;
  onChangeStatus: (leadId: string, status: BusinessLead['status']) => void;
  onDeleteLead: (leadId: string) => void;
}

export const LeadTable: React.FC<LeadTableProps> = ({
  leads,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpenPitch,
  onOpenDetail,
  onChangeStatus,
  onDeleteLead
}) => {
  const isAllSelected = leads.length > 0 && selectedIds.length === leads.length;

  if (leads.length === 0) {
    return (
      <div className="ui-panel p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/10 text-indigo-300">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="mb-1 text-base font-bold text-white">Компании не найдены</h3>
        <p className="mx-auto max-w-md text-sm leading-6 text-slate-400">
          По текущим фильтрам нет подходящих организаций. Попробуйте изменить параметры поиска или запустить парсинг нового города.
        </p>
      </div>
    );
  }

  return (
    <div className="ui-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="select-none border-b bg-[var(--surface-2)] text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              <th className="py-3.5 pl-4 pr-2 w-10">
                <input
                  type="checkbox"
                  aria-label="Выбрать все отображаемые лиды"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
              </th>
              <th className="px-3 py-3.5 min-w-[185px]">Организация</th>
              <th className="px-3 py-3.5 min-w-[125px]">Телефон</th>
              <th className="px-3 py-3.5 min-w-[120px]">Статус сайта</th>
              <th className="px-3 py-3.5 min-w-[105px]">Рейтинг / Отзывы</th>
              <th className="px-3 py-3.5 min-w-[120px]">Статус CRM</th>
              <th className="min-w-[130px] px-3 py-3.5 pr-4 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y font-normal text-slate-200">
            {leads.map((lead) => {
              const isSelected = selectedIds.includes(lead.id);
              const cleanPhone = (lead.phone || '').replace(/[^\d+]/g, '');

              return (
                <tr
                  key={lead.id}
                  className={`h-[72px] transition-colors hover:bg-white/[0.035] ${
                    isSelected ? 'bg-blue-500/10' : ''
                  }`}
                >
                  {/* Select Checkbox */}
                  <td className="py-3 pl-4 pr-2">
                    <input
                      type="checkbox"
                      aria-label={`Выбрать ${lead.name}`}
                      checked={isSelected}
                      onChange={() => onToggleSelect(lead.id)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                  </td>

                  {/* Name & Address */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenDetail(lead)}
                          className="text-left text-sm font-bold leading-5 text-slate-50 transition-colors hover:text-blue-300"
                        >
                          {lead.name}
                        </button>
                        {lead.leadQuality === 'hot' && !lead.hasWebsite && (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800" title="Горячий лид: отличный рейтинг, много отзывов, но нет сайта!">
                            <Flame className="w-3 h-3 text-rose-600 fill-rose-600" />
                            HOT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="flex max-w-[185px] items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{lead.address || `${lead.city}, ${lead.category}`}</span>
                        </span>
                        {lead.maps_url && (
                          <a
                            href={lead.maps_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-800 shrink-0 inline-flex items-center gap-0.5"
                            title="Открыть на картах"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="py-3 px-3">
                    {lead.phone ? (
                      <div className="flex items-center gap-1.5">
                        {lead.whatsappStatus === 'available' && <a
                          href={`tel:${cleanPhone}`}
                          className="font-medium text-slate-200 hover:text-blue-300 transition-colors"
                        >
                          {lead.phone}
                        </a>}
                        <a
                          href={`https://wa.me/${cleanPhone.replace('+', '')}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Написать ${lead.name} в WhatsApp`}
                          className="ui-icon-button min-h-9 min-w-9 rounded-lg p-1 text-emerald-400 hover:bg-emerald-500/10"
                          title="Написать в WhatsApp"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic text-xs">Не указан</span>
                    )}
                  </td>

                  {/* Website Detection Badge */}
                  <td className="py-3 px-3">
                    {!lead.hasWebsite ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-100">
                        <GlobeX className="w-3.5 h-3.5 text-amber-300" />
                        <span>НЕТ САЙТА</span>
                      </span>
                    ) : (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-[140px] items-center gap-1.5 truncate rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
                      >
                        <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{lead.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                      </a>
                    )}
                  </td>

                  {/* Rating & Reviews */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 font-bold text-slate-100">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span>{lead.rating || 0}</span>
                      </div>
                      <span className="text-slate-400 text-xs">
                        ({lead.reviews || 0} отз.)
                      </span>
                    </div>
                  </td>

                  {/* CRM Status */}
                  <td className="py-3 px-3">
                    <select
                      value={lead.status}
                      aria-label={`Статус CRM: ${lead.name}`}
                      onChange={(e) => onChangeStatus(lead.id, e.target.value as any)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none transition-colors ${getStatusStyle(
                        lead.status
                      )}`}
                    >
                      <option value="new">Новый</option>
                      <option value="contacted">Связались</option>
                      <option value="meeting">Встреча</option>
                      <option value="negotiation">Переговоры</option>
                      <option value="won">Выиграно</option>
                      <option value="lost">Отказ</option>
                    </select>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 text-right pr-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Outreach Pitch Generator Button */}
                      <button
                      onClick={() => onOpenPitch(lead)}
                        className="flex min-h-9 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700"
                        title="Сгенерировать готовое КП и скрипт для WhatsApp/Звонка"
                      >
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>Скрипт</span>
                      </button>

                      {/* Detail modal button */}
                      <button
                      onClick={() => onOpenDetail(lead)}
                        aria-label={`Открыть заметки: ${lead.name}`}
                        className="ui-icon-button min-h-9 min-w-9 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                        title="Подробная информация и заметки"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      {/* Delete button */}
                      <button
                      onClick={() => onDeleteLead(lead.id)}
                        aria-label={`Удалить лид: ${lead.name}`}
                        className="ui-icon-button min-h-9 min-w-9 rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
                        title="Удалить лид"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function getStatusStyle(status: BusinessLead['status']): string {
  switch (status) {
    case 'new':
      return 'bg-blue-500/15 text-blue-200 border-blue-400/35';
    case 'contacted':
      return 'bg-amber-500/15 text-amber-200 border-amber-400/35';
    case 'meeting':
      return 'bg-violet-500/15 text-violet-200 border-violet-400/35';
    case 'negotiation':
      return 'bg-indigo-500/15 text-indigo-200 border-indigo-400/35';
    case 'won':
      return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/35';
    case 'lost':
      return 'bg-slate-800 text-slate-300 border-slate-600';
    default:
      return 'bg-slate-800 text-slate-200 border-slate-700';
  }
}
