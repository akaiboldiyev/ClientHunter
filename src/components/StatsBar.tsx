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

  const metrics = [
    { label: 'В базе', value: total, icon: Target, tone: 'text-blue-300' },
    { label: 'Без сайта', value: noWebsite, icon: GlobeX, tone: 'text-amber-300' },
    { label: 'Горячие', value: hotLeads, icon: Flame, tone: 'text-rose-300' },
    { label: 'С телефоном', value: withPhone, icon: PhoneCall, tone: 'text-emerald-300' },
    { label: 'Средний рейтинг', value: avgRating, icon: Star, tone: 'text-amber-300' },
    { label: 'Сделки', value: wonDeals, icon: Trophy, tone: 'text-emerald-300' },
  ];

  return (
    <section aria-label="Сводка по лидам" className="mb-6 overflow-hidden rounded-3xl bg-slate-950 px-5 py-5 text-white shadow-[0_18px_45px_rgb(15_23_42/0.18)] sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Оперативная сводка</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Пульс вашей лидогенерации</h1>
        </div>
        <p className="max-w-sm text-xs leading-5 text-slate-400">Приоритет — компании без сайта с высокой готовностью к контакту.</p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="min-w-0 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-400">
              <span>{label}</span><Icon className={`h-4 w-4 ${tone}`} />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-white">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
