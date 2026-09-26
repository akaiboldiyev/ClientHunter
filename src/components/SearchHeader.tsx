import React, { useState } from 'react';
import { Search, MapPin, Tag, SlidersHorizontal, Loader2, Compass, CheckCircle2 } from 'lucide-react';
import { SearchQuery, ScrapingProgress } from '../types';
import { POPULAR_CITIES, POPULAR_CATEGORIES } from '../data/mockDatabase';
import { SpotlightSurface } from './ui/SpotlightSurface';

interface SearchHeaderProps {
  onStartScraping: (query: SearchQuery) => void;
  progress: ScrapingProgress;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  onStartScraping,
  progress
}) => {
  const [city, setCity] = useState('Актау');
  const [category, setCategory] = useState('стоматология');
  const [source, setSource] = useState<'google_maps' | '2gis' | 'both'>('google_maps');
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(true);
  const [limit, setLimit] = useState(15);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCity = city.trim();
    const normalizedCategory = category.trim();
    if (progress.isScraping) return;
    if (!normalizedCity || !normalizedCategory) {
      setFormError('Укажите город и категорию для поиска.');
      return;
    }
    if (normalizedCity.length > 80 || normalizedCategory.length > 80) {
      setFormError('Город и категория должны быть не длиннее 80 символов.');
      return;
    }
    setFormError('');

    onStartScraping({
      city: normalizedCity,
      category: normalizedCategory,
      source,
      onlyWithoutWebsite,
      minRating: 0,
      hasPhoneOnly: false,
      limit
    });
  };

  return (
    <SpotlightSurface as="section" aria-labelledby="search-heading" tone="electric" className="mb-6 overflow-hidden rounded-[2rem] border border-slate-700/90 bg-slate-950 shadow-[0_24px_70px_rgb(2_6_23/0.40)]">
      <div className="flex flex-col justify-between gap-4 bg-slate-950 px-5 py-5 sm:px-6 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">Новая выборка</p>
          <h2 id="search-heading" className="mt-1 flex items-center gap-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-white"><Compass className="h-5 w-5" /></span>
            Найдите компании без сайта
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Настройте источник и сегмент — результат появится в рабочей базе ниже.
          </p>
        </div>

        {/* Source Switcher */}
        <div className="flex max-w-full self-start overflow-x-auto rounded-xl border border-white/10 bg-white/10 p-1 text-xs font-semibold lg:self-auto">
          <button
            type="button"
            onClick={() => setSource('google_maps')}
            className={`whitespace-nowrap rounded-lg px-3 py-2 transition-all ${
              source === 'google_maps'
                ? 'bg-blue-400/15 text-blue-100 shadow-sm ring-1 ring-blue-300/30'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            Google Maps
          </button>
          <button
            type="button"
            onClick={() => setSource('2gis')}
            className={`whitespace-nowrap rounded-lg px-3 py-2 transition-all ${
              source === '2gis'
                ? 'bg-emerald-400/15 text-emerald-100 shadow-sm ring-1 ring-emerald-300/30'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            2GIS
          </button>
          <button
            type="button"
            onClick={() => setSource('both')}
            className={`whitespace-nowrap rounded-lg px-3 py-2 transition-all ${
              source === 'both'
                ? 'bg-violet-400/15 text-violet-100 shadow-sm ring-1 ring-violet-300/30'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            Оба источника
          </button>
        </div>
      </div>

      {/* Main Search Form */}
      <form onSubmit={handleSubmit} className="space-y-4 border-t border-white/10 bg-slate-950/70 p-5 sm:p-6">
        {formError && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200">{formError}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          {/* City */}
          <div className="sm:col-span-4 relative">
            <label htmlFor="search-city-input" className="ui-label">
              Город поиска
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="search-city-input"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Например: Актау, Алматы..."
                required
                className="ui-input pl-10"
              />
            </div>
          </div>

          {/* Category */}
          <div className="sm:col-span-5 relative">
            <label htmlFor="search-category-input" className="ui-label">
              Категория / Сфера деятельности
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="search-category-input"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Например: стоматология, автосервис..."
                required
                className="ui-input pl-10"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="sm:col-span-3 flex items-end">
            <button
              id="start-scrape-btn"
              type="submit"
              disabled={progress.isScraping || !city.trim() || !category.trim()}
              className="ui-button-primary w-full"
            >
              {progress.isScraping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Парсинг...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Найти клиентов</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
          <span className="mr-1 font-semibold text-slate-300">Быстрый выбор:</span>
          {POPULAR_CATEGORIES.slice(0, 7).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-lg border px-2.5 py-1.5 font-medium transition-colors ${
                category.toLowerCase() === cat.toLowerCase()
                  ? 'border-blue-400/50 bg-blue-500/15 text-blue-200'
                  : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
            className="ml-auto flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 font-semibold text-blue-300 hover:bg-blue-500/10"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {showAdvanced ? 'Скрыть параметры' : 'Параметры парсинга'}
          </button>
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-xs sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <input
                id="only-without-website-checkbox"
                type="checkbox"
                checked={onlyWithoutWebsite}
                onChange={(e) => setOnlyWithoutWebsite(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="only-without-website-checkbox" className="font-semibold text-slate-200 cursor-pointer">
                Фильтровать: только без сайтов (100% лиды)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="limit-select" className="font-semibold text-slate-200 whitespace-nowrap">
                Количество результатов:
              </label>
              <select
                id="limit-select"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-medium text-slate-100"
              >
                <option value={10}>10 организаций</option>
                <option value={15}>15 организаций</option>
                <option value={25}>25 организаций</option>
                <option value={50}>50 организаций</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Автоматическое определение дубликатов по названию и телефону</span>
            </div>
          </div>
        )}
      </form>

      {/* Live Scraping Progress Bar & Animation */}
      {progress.isScraping && (
        <div className="mt-5 space-y-3 rounded-xl border border-blue-400/30 bg-blue-500/10 p-4 animate-fade-in">
          <div className="flex items-start justify-between gap-3 text-xs font-semibold text-blue-100">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
              <span>{progress.statusMessage}</span>
            </div>
            <span className="font-mono text-blue-300">{progress.progress}%</span>
          </div>

          {/* Progress track */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-blue-600 transition-all duration-300 ease-out"
              style={{ width: `${progress.progress}%` }}
            />
          </div>

          <div className="flex flex-col gap-1 text-[11px] text-blue-200 sm:flex-row sm:items-center sm:justify-between">
            <span>Запрос: <strong className="text-white">{progress.currentQuery}</strong></span>
            <span>Найдено без сайта: <strong className="text-white">{progress.withoutWebsiteCount}</strong> из {progress.foundCount}</span>
          </div>
        </div>
      )}

      {progress.stage === 'completed' && !progress.isScraping && (
        <div role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-100">
          {progress.statusMessage}
        </div>
      )}
    </SpotlightSurface>
  );
};
