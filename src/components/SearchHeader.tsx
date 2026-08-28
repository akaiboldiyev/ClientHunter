import React, { useState } from 'react';
import { Search, MapPin, Tag, Sparkles, SlidersHorizontal, Loader2, Compass, Layers, CheckCircle2 } from 'lucide-react';
import { SearchQuery, ScrapingProgress } from '../types';
import { POPULAR_CITIES, POPULAR_CATEGORIES } from '../data/mockDatabase';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || !category.trim() || progress.isScraping) return;

    onStartScraping({
      city: city.trim(),
      category: category.trim(),
      source,
      onlyWithoutWebsite,
      minRating: 0,
      hasPhoneOnly: false,
      limit
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-600" />
            Поиск и парсинг компаний без сайта
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Укажите город и сферу бизнеса для автоматического поиска горячих лидов на Google Maps и 2GIS
          </p>
        </div>

        {/* Source Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold self-start md:self-auto">
          <button
            type="button"
            onClick={() => setSource('google_maps')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              source === 'google_maps'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Google Maps
          </button>
          <button
            type="button"
            onClick={() => setSource('2gis')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              source === '2gis'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2GIS
          </button>
          <button
            type="button"
            onClick={() => setSource('both')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              source === 'both'
                ? 'bg-white text-purple-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Оба источника
          </button>
        </div>
      </div>

      {/* Main Search Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* City */}
          <div className="sm:col-span-4 relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Category */}
          <div className="sm:col-span-5 relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="sm:col-span-3 flex items-end">
            <button
              id="start-scrape-btn"
              type="submit"
              disabled={progress.isScraping || !city.trim() || !category.trim()}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm rounded-xl shadow-sm shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
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
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-slate-500">
          <span className="font-medium mr-1">Быстрый выбор:</span>
          {POPULAR_CATEGORIES.slice(0, 7).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded-lg border transition-colors ${
                category.toLowerCase() === cat.toLowerCase()
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-blue-600 font-semibold hover:underline ml-auto flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {showAdvanced ? 'Скрыть параметры' : 'Параметры парсинга'}
          </button>
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/70 p-3.5 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <input
                id="only-without-website-checkbox"
                type="checkbox"
                checked={onlyWithoutWebsite}
                onChange={(e) => setOnlyWithoutWebsite(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="only-without-website-checkbox" className="font-semibold text-slate-700 cursor-pointer">
                Фильтровать: только без сайтов (100% лиды)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="limit-select" className="font-semibold text-slate-700 whitespace-nowrap">
                Количество результатов:
              </label>
              <select
                id="limit-select"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-800"
              >
                <option value={10}>10 организаций</option>
                <option value={15}>15 организаций</option>
                <option value={25}>25 организаций</option>
                <option value={50}>50 организаций</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Автоматическое определение дубликатов по названию и телефону</span>
            </div>
          </div>
        )}
      </form>

      {/* Live Scraping Progress Bar & Animation */}
      {progress.isScraping && (
        <div className="mt-5 p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>{progress.statusMessage}</span>
            </div>
            <span className="font-mono text-blue-700">{progress.progress}%</span>
          </div>

          {/* Progress track */}
          <div className="w-full bg-blue-200/60 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300 ease-out"
              style={{ width: `${progress.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-blue-700">
            <span>Запрос: <strong className="text-blue-950">{progress.currentQuery}</strong></span>
            <span>Найдено без сайта: <strong className="text-blue-950">{progress.withoutWebsiteCount}</strong> из {progress.foundCount}</span>
          </div>
        </div>
      )}
    </div>
  );
};
