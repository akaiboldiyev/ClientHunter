import React, { useState } from 'react';
import { Search, Loader2, Compass, Square } from 'lucide-react';
import { LeadFilter, SearchQuery, ScrapingProgress } from '../types';
import { TARGET_CATEGORIES } from '../data/categories';
import { SpotlightSurface } from './ui/SpotlightSurface';

interface SearchHeaderProps { onStartScraping: (query: SearchQuery) => void; onStopScraping: () => void; progress: ScrapingProgress; filter: LeadFilter; }

export const SearchHeader: React.FC<SearchHeaderProps> = ({ onStartScraping, onStopScraping, progress, filter }) => {
  const source = '2gis' as const;
  const [formError, setFormError] = useState('');
  const categories = filter.categories ?? (filter.category ? [filter.category] : []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!filter.city.trim() || !categories.length) {
      setFormError('Укажите город и хотя бы одну категорию в левой панели.');
      return;
    }
    setFormError('');
    onStartScraping({
      city: filter.city.trim(),
      categories,
      source,
      onlyWithoutWebsite: true,
      minRating: 0,
      hasPhoneOnly: false,
      limit: 50
    });
  };

  const cta = categories.length === TARGET_CATEGORIES.length ? 'Найти во всех категориях' : categories.length > 1 ? `Найти в ${categories.length} категориях` : 'Найти компании';

  return <SpotlightSurface as="section" aria-labelledby="search-heading" tone="electric" className="mb-6 rounded-2xl border bg-[var(--surface-1)] shadow-[var(--shadow-panel)]">
    <form onSubmit={submit} className="p-5 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#435cff,#2385ff)] text-white shadow-[0_8px_24px_rgb(43_99_255/28%)]">
            <Compass className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-blue-300">Новая выборка</p>
            <h2 id="search-heading" className="mt-0.5 text-xl font-semibold tracking-tight text-white">Поиск компаний 2GIS</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Параметры города и категории — в панели слева.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {formError && <p role="alert" className="text-xs font-medium text-rose-300 mr-2">{formError}</p>}
          {progress.isScraping ?
            <button type="button" onClick={onStopScraping} className="ui-button-secondary shrink-0"><Square className="h-4 w-4" />Остановить поиск</button> :
            <button id="start-scrape-btn" type="submit" className="ui-button-primary shrink-0"><Search className="h-4 w-4" />{cta}</button>
          }
        </div>
      </div>

      {(progress.isScraping || progress.stage === 'completed') && <div role="status" aria-live="polite" aria-atomic="true" className="mt-4 rounded-xl border border-blue-400/25 bg-blue-500/10 p-4"><div className="mb-2 flex items-center justify-between gap-3 text-xs text-blue-100"><span className="flex items-center gap-2">{progress.isScraping && <Loader2 className="h-4 w-4 animate-spin" />}{progress.statusMessage}</span><span className="tabular-nums">{progress.progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#10182a]"><div className="h-full bg-[var(--primary)] transition-all duration-300" style={{ width: `${progress.progress}%` }} /></div>{progress.completedCategories?.length ? <p className="mt-3 text-xs text-slate-300">Завершены: {progress.completedCategories.join(', ')}</p> : null}{progress.failedCategories?.length ? <p className="mt-1 text-xs text-rose-200">Не удалось получить: {progress.failedCategories.join(', ')}</p> : null}{!progress.isScraping && progress.rawCount !== undefined ? <p className="mt-3 text-xs text-slate-200">Найдено {progress.rawCount}; после удаления дублей: {progress.deduplicatedCount}; без сайта: {progress.withoutWebsiteCount}; с телефоном: {progress.phoneCount}; с мобильным: {progress.mobileCount}; WhatsApp подтверждён: {progress.confirmedWhatsAppCount}.</p> : null}</div>}
    </form>
  </SpotlightSurface>;
};
