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
    <section aria-label="Сводка по лидам" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-6">
      {/* Total Leads */}
      <div className="ui-panel p-4">
        <div className="flex items-center justify-between text-slate-500 mb-3">
          <span className="text-xs font-semibold">Всего в базе</span>
          <Target className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-slate-950">{total}</div>
        <p className="text-[11px] text-slate-500 mt-0.5">компаний</p>
      </div>

      {/* Without Website (The Core Target!) */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm shadow-amber-950/[0.03]">
        <div className="flex items-center justify-between text-amber-800 mb-3">
          <span className="text-xs font-bold tracking-wide">БЕЗ САЙТА</span>
          <GlobeX className="w-4 h-4 text-amber-600" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-amber-950">{noWebsite}</div>
        <p className="text-[11px] text-amber-700/80 mt-0.5">
          {total > 0 ? `${Math.round((noWebsite / total) * 100)}% от общего числа` : '0%'}
        </p>
      </div>

      {/* Hot Leads */}
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm shadow-rose-950/[0.03]">
        <div className="flex items-center justify-between text-rose-800 mb-3">
          <span className="text-xs font-semibold">Горячие лиды</span>
          <Flame className="w-4 h-4 text-rose-600" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-rose-950">{hotLeads}</div>
        <p className="text-[11px] text-rose-700/80 mt-0.5">Высокий рейтинг + отзывы</p>
      </div>

      {/* Phones Available */}
      <div className="ui-panel p-4">
        <div className="flex items-center justify-between text-slate-500 mb-3">
          <span className="text-xs font-medium">С телефоном</span>
          <PhoneCall className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-slate-950">{withPhone}</div>
        <p className="text-[11px] text-slate-500 mt-0.5">Готовы к звонку / WA</p>
      </div>

      {/* Average Rating */}
      <div className="ui-panel p-4">
        <div className="flex items-center justify-between text-slate-500 mb-3">
          <span className="text-xs font-medium">Средний рейтинг</span>
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-slate-950">{avgRating} <span className="text-base text-amber-500">★</span></div>
        <p className="text-[11px] text-slate-500 mt-0.5">Оценка клиентов</p>
      </div>

      {/* Won Deals */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm shadow-emerald-950/[0.03]">
        <div className="flex items-center justify-between text-emerald-800 mb-3">
          <span className="text-xs font-semibold">Закрытые сделки</span>
          <Trophy className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-emerald-950">{wonDeals}</div>
        <p className="text-[11px] text-emerald-700/80 mt-0.5">Успешные продажи</p>
      </div>
    </section>
  );
};
