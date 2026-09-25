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
    <section aria-label="Сводка по лидам" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {/* Total Leads */}
      <div className="ui-panel p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="mb-3 flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold">Всего в базе</span>
          <Target className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-slate-950 tabular-nums">{total}</div>
        <p className="mt-0.5 text-[11px] text-slate-500">компаний</p>
      </div>

      {/* Without Website (The Core Target!) */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/70 p-4 shadow-sm shadow-amber-950/[0.03] transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="mb-3 flex items-center justify-between text-amber-800">
          <span className="text-xs font-bold tracking-wide">БЕЗ САЙТА</span>
          <GlobeX className="w-4 h-4 text-amber-600" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-amber-950 tabular-nums">{noWebsite}</div>
        <p className="mt-0.5 text-[11px] text-amber-700/80">
          {total > 0 ? `${Math.round((noWebsite / total) * 100)}% от общего числа` : '0%'}
        </p>
      </div>

      {/* Hot Leads */}
      <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50/70 p-4 shadow-sm shadow-rose-950/[0.03] transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="mb-3 flex items-center justify-between text-rose-800">
          <span className="text-xs font-semibold">Горячие лиды</span>
          <Flame className="w-4 h-4 text-rose-600" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-rose-950 tabular-nums">{hotLeads}</div>
        <p className="mt-0.5 text-[11px] text-rose-700/80">Высокий рейтинг + отзывы</p>
      </div>

      {/* Phones Available */}
      <div className="ui-panel p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="mb-3 flex items-center justify-between text-slate-500">
          <span className="text-xs font-medium">С телефоном</span>
          <PhoneCall className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-slate-950 tabular-nums">{withPhone}</div>
        <p className="mt-0.5 text-[11px] text-slate-500">Готовы к звонку / WA</p>
      </div>

      {/* Average Rating */}
      <div className="ui-panel p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="mb-3 flex items-center justify-between text-slate-500">
          <span className="text-xs font-medium">Средний рейтинг</span>
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-slate-950 tabular-nums">{avgRating} <span className="text-base text-amber-500">★</span></div>
        <p className="mt-0.5 text-[11px] text-slate-500">Оценка клиентов</p>
      </div>

      {/* Won Deals */}
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/70 p-4 shadow-sm shadow-emerald-950/[0.03] transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="mb-3 flex items-center justify-between text-emerald-800">
          <span className="text-xs font-semibold">Закрытые сделки</span>
          <Trophy className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-emerald-950 tabular-nums">{wonDeals}</div>
        <p className="mt-0.5 text-[11px] text-emerald-700/80">Успешные продажи</p>
      </div>
    </section>
  );
};
