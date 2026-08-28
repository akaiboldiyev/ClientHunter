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
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-4 text-blue-600">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Компании не найдены</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          По текущим фильтрам нет подходящих организаций. Попробуйте изменить параметры поиска или запустить парсинг нового города.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-xs select-none">
              <th className="py-3.5 pl-4 pr-2 w-10">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
              </th>
              <th className="py-3.5 px-3 min-w-[220px]">Организация</th>
              <th className="py-3.5 px-3 min-w-[150px]">Телефон</th>
              <th className="py-3.5 px-3 min-w-[130px]">Статус сайта</th>
              <th className="py-3.5 px-3 min-w-[120px]">Рейтинг / Отзывы</th>
              <th className="py-3.5 px-3 min-w-[140px]">Статус CRM</th>
              <th className="py-3.5 px-3 text-right pr-4 min-w-[160px]">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
            {leads.map((lead) => {
              const isSelected = selectedIds.includes(lead.id);
              const cleanPhone = (lead.phone || '').replace(/[^\d+]/g, '');

              return (
                <tr
                  key={lead.id}
                  className={`hover:bg-blue-50/30 transition-colors ${
                    isSelected ? 'bg-blue-50/60' : ''
                  }`}
                >
                  {/* Select Checkbox */}
                  <td className="py-3 pl-4 pr-2">
                    <input
                      type="checkbox"
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
                          className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-left text-sm"
                        >
                          {lead.name}
                        </button>
                        {lead.leadQuality === 'hot' && !lead.hasWebsite && (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded flex items-center gap-0.5 shrink-0" title="Горячий лид: отличный рейтинг, много отзывов, но нет сайта!">
                            <Flame className="w-3 h-3 text-rose-600 fill-rose-600" />
                            HOT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 text-xs">
                        <span className="flex items-center gap-1 truncate max-w-[240px]">
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
                        <a
                          href={`tel:${cleanPhone}`}
                          className="font-medium text-slate-800 hover:text-blue-600 transition-colors"
                        >
                          {lead.phone}
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
                      <span className="text-slate-400 italic text-xs">Не указан</span>
                    )}
                  </td>

                  {/* Website Detection Badge */}
                  <td className="py-3 px-3">
                    {!lead.hasWebsite ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300/80">
                        <GlobeX className="w-3.5 h-3.5 text-amber-700" />
                        <span>НЕТ САЙТА</span>
                      </span>
                    ) : (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors truncate max-w-[140px]"
                      >
                        <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{lead.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                      </a>
                    )}
                  </td>

                  {/* Rating & Reviews */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 font-bold text-slate-900">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span>{lead.rating || 0}</span>
                      </div>
                      <span className="text-slate-500 text-xs">
                        ({lead.reviews || 0} отз.)
                      </span>
                    </div>
                  </td>

                  {/* CRM Status */}
                  <td className="py-3 px-3">
                    <select
                      value={lead.status}
                      onChange={(e) => onChangeStatus(lead.id, e.target.value as any)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none transition-colors ${getStatusStyle(
                        lead.status
                      )}`}
                    >
                      <option value="new">🆕 Новый</option>
                      <option value="contacted">📞 Связались</option>
                      <option value="meeting">🤝 Встреча</option>
                      <option value="negotiation">💼 Переговоры</option>
                      <option value="won">🏆 Выиграно</option>
                      <option value="lost">❌ Отказ</option>
                    </select>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 text-right pr-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Outreach Pitch Generator Button */}
                      <button
                        onClick={() => onOpenPitch(lead)}
                        className="px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition-all"
                        title="Сгенерировать готовое КП и скрипт для WhatsApp/Звонка"
                      >
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>Скрипт</span>
                      </button>

                      {/* Detail modal button */}
                      <button
                        onClick={() => onOpenDetail(lead)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Подробная информация и заметки"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => onDeleteLead(lead.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'contacted':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'meeting':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'negotiation':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'won':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    case 'lost':
      return 'bg-slate-100 text-slate-600 border-slate-300';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}
