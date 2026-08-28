import React from 'react';
import { Target, GlobeX, Flame, PhoneCall, Trophy, Star } from 'lucide-react';
import { BusinessLead } from '../types';

interface StatsBarProps {
  leads: BusinessLead[];
}

export const StatsBar: React.FC<StatsBarProps> = ({ leads }) => {
  const total = leads.length;
  const noWebsite = leads.filter(l => !l.hasWebsite).length;
  const hotLeads = leads.filter(l => l.leadQuality === 'hot' && !l.hasWebsite).length;
  const withPhone = leads.filter(l => l.phone && l.phone.trim().length > 0).length;
  const wonDeals = leads.filter(l => l.status === 'won').length;
  const avgRating = total > 0 
    ? (leads.reduce((acc, l) => acc + (l.rating || 0), 0) / total).toFixed(1)
    : '0.0';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {/* Total Leads */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-medium">Всего в базе</span>
          <Target className="w-4 h-4 text-blue-500" />
        </div>
        <div className="text-xl font-bold text-slate-900">{total}</div>
        <p className="text-[11px] text-slate-500 mt-0.5">компаний</p>
      </div>

      {/* Without Website (The Core Target!) */}
      <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/80 shadow-2xs">
        <div className="flex items-center justify-between text-amber-800 mb-1">
          <span className="text-xs font-semibold">БЕЗ САЙТА</span>
          <GlobeX className="w-4 h-4 text-amber-600" />
        </div>
        <div className="text-xl font-bold text-amber-900">{noWebsite}</div>
        <p className="text-[11px] text-amber-700/80 mt-0.5">
          {total > 0 ? `${Math.round((noWebsite / total) * 100)}% от общего числа` : '0%'}
        </p>
      </div>

      {/* Hot Leads */}
      <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200/80 shadow-2xs">
        <div className="flex items-center justify-between text-rose-800 mb-1">
          <span className="text-xs font-semibold">Горячие лиды</span>
          <Flame className="w-4 h-4 text-rose-600" />
        </div>
        <div className="text-xl font-bold text-rose-900">{hotLeads}</div>
        <p className="text-[11px] text-rose-700/80 mt-0.5">Высокий рейтинг + отзывы</p>
      </div>

      {/* Phones Available */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-medium">С телефоном</span>
          <PhoneCall className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-xl font-bold text-slate-900">{withPhone}</div>
        <p className="text-[11px] text-slate-500 mt-0.5">Готовы к звонку / WA</p>
      </div>

      {/* Average Rating */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-medium">Средний рейтинг</span>
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
        </div>
        <div className="text-xl font-bold text-slate-900">{avgRating} ★</div>
        <p className="text-[11px] text-slate-500 mt-0.5">Оценка клиентов</p>
      </div>

      {/* Won Deals */}
      <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200/80 shadow-2xs">
        <div className="flex items-center justify-between text-emerald-800 mb-1">
          <span className="text-xs font-semibold">Закрытые сделки</span>
          <Trophy className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-xl font-bold text-emerald-900">{wonDeals}</div>
        <p className="text-[11px] text-emerald-700/80 mt-0.5">Успешные продажи</p>
      </div>
    </div>
  );
};
