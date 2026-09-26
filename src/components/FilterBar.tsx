import React from 'react';
import { Search, Filter, ArrowUpDown, LayoutGrid, LayoutList, Trash2, CheckSquare } from 'lucide-react';
import { LeadFilter } from '../types';

interface FilterBarProps {
  filter: LeadFilter;
  onChangeFilter: (newFilter: LeadFilter) => void;
  viewMode: 'table' | 'cards';
  onChangeViewMode: (mode: 'table' | 'cards') => void;
  selectedCount: number;
  totalFilteredCount: number;
  onBatchDelete: () => void;
  onBatchStatusChange: (status: string) => void;
  layout?: 'sidebar' | 'horizontal';
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filter,
  onChangeFilter,
  viewMode,
  onChangeViewMode,
  selectedCount,
  totalFilteredCount,
  onBatchDelete,
  onBatchStatusChange,
  layout = 'horizontal'
}) => {
  const isSidebar = layout === 'sidebar';
  return (
    <section aria-label="Фильтры лидов" className={`ui-panel mb-5 space-y-4 p-4 sm:p-5 ${isSidebar ? 'xl:sticky xl:top-24 xl:mb-0' : ''}`}>
      <div className={`flex flex-col gap-3 ${isSidebar ? '' : 'xl:flex-row xl:items-center'}`}>
        {isSidebar && <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">Фильтры</p><h2 className="mt-1 text-lg font-bold text-white">Сегментируйте базу</h2></div>}
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="leads-filter-search"
            type="text"
            value={filter.search}
            onChange={(e) => onChangeFilter({ ...filter, search: e.target.value })}
            placeholder="Поиск по названию, телефону, адресу, категории..."
          aria-label="Поиск по лидам"
          className="ui-input py-2.5 pl-10 text-sm"
          />
        </div>

        {/* Quick Website Filter Tabs */}
        <div className={`max-w-full rounded-xl border border-slate-700 bg-slate-900/80 p-1 text-xs font-semibold shrink-0 ${isSidebar ? 'grid grid-cols-3' : 'flex items-center overflow-x-auto'}`}>
          <button
            type="button"
            onClick={() => onChangeFilter({ ...filter, websiteFilter: 'all' })}
            className={`whitespace-nowrap rounded-lg px-3 py-2 transition-colors ${
              filter.websiteFilter === 'all'
                ? 'bg-slate-700 text-white shadow-sm ring-1 ring-slate-600/70'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Все компании
          </button>
          <button
            type="button"
            onClick={() => onChangeFilter({ ...filter, websiteFilter: 'without_website' })}
            className={`flex whitespace-nowrap items-center gap-1.5 rounded-lg px-3 py-2 transition-colors ${
              filter.websiteFilter === 'without_website'
                ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/25'
                : 'text-amber-300 hover:text-amber-100'
            }`}
          >
            <span>🔥 Без сайта</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeFilter({ ...filter, websiteFilter: 'with_website' })}
            className={`whitespace-nowrap rounded-lg px-3 py-2 transition-colors ${
              filter.websiteFilter === 'with_website'
                ? 'bg-slate-700 text-white shadow-2xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            С сайтом
          </button>
        </div>

        {/* View Toggle */}
        <div className={`hidden shrink-0 items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/80 p-1 lg:flex ${isSidebar ? 'self-start' : ''}`}>
          <button
            id="view-table-btn"
            type="button"
            onClick={() => onChangeViewMode('table')}
            title="Таблица"
            aria-label="Табличный вид"
            className={`rounded-lg p-2 transition-colors ${
              viewMode === 'table' ? 'bg-slate-700 text-blue-300 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            id="view-cards-btn"
            type="button"
            onClick={() => onChangeViewMode('cards')}
            title="Карточки"
            aria-label="Карточки"
            className={`rounded-lg p-2 transition-colors ${
              viewMode === 'cards' ? 'bg-slate-700 text-blue-300 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Secondary filter & sort controls */}
      <div className={`flex flex-wrap gap-3 border-t border-slate-800 pt-4 text-xs ${isSidebar ? 'flex-col items-stretch' : 'items-center justify-between'}`}>
        <div className={`flex flex-wrap gap-3 ${isSidebar ? 'flex-col' : 'items-center'}`}>
          {/* Status filter */}
          <div className={`flex gap-1.5 ${isSidebar ? 'flex-col' : 'items-center'}`}>
            <span className="text-slate-400 font-medium">Статус:</span>
            <select
              id="filter-status-select"
              value={filter.status}
              onChange={(e) => onChangeFilter({ ...filter, status: e.target.value as any })}
              aria-label="Статус лида"
              className="min-h-10 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-slate-200 font-medium"
            >
              <option value="all">Все статусы</option>
              <option value="new">Новые</option>
              <option value="contacted">Связались</option>
              <option value="meeting">Встреча</option>
              <option value="negotiation">Переговоры</option>
              <option value="won">Выиграно</option>
              <option value="lost">Отказ</option>
            </select>
          </div>

          {/* Lead Quality */}
          <div className={`flex gap-1.5 ${isSidebar ? 'flex-col' : 'items-center'}`}>
            <span className="text-slate-400 font-medium">Приоритет:</span>
            <select
              id="filter-quality-select"
              value={filter.quality}
              onChange={(e) => onChangeFilter({ ...filter, quality: e.target.value as any })}
              aria-label="Приоритет лида"
              className="min-h-10 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-slate-200 font-medium"
            >
              <option value="all">Любой</option>
              <option value="hot">🔥 Горячий</option>
              <option value="warm">⚡ Теплый</option>
              <option value="cold">❄ Холодный</option>
            </select>
          </div>

          {/* Phone only checkbox */}
          <label className="flex items-center gap-2 rounded-lg px-1 py-2 text-slate-300 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={filter.phoneOnly}
              onChange={(e) => onChangeFilter({ ...filter, phoneOnly: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            <span>Только с телефоном</span>
          </label>
        </div>

        {/* Sort By */}
        <div className={`flex gap-1.5 ${isSidebar ? 'flex-col' : 'items-center xl:ml-auto'}`}>
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 font-medium">Сортировка:</span>
          <select
            id="filter-sort-select"
            value={filter.sortBy}
            onChange={(e) => onChangeFilter({ ...filter, sortBy: e.target.value as any })}
            className="min-h-10 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-slate-200 font-medium"
          >
            <option value="relevance">По релевантности</option>
            <option value="rating_desc">По рейтингу (высокий сначала)</option>
            <option value="reviews_desc">По числу отзывов (много сначала)</option>
            <option value="name_asc">По алфавиту (А-Я)</option>
            <option value="date_desc">По дате добавления</option>
          </select>
        </div>
      </div>

      {/* Batch Actions Bar (when items selected) */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-indigo-100">
            <CheckSquare className="h-4 w-4 text-indigo-300" />
            <span>Выбрано: {selectedCount} из {totalFilteredCount}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-blue-200 font-medium">Установить статус:</span>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onBatchStatusChange(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="rounded border border-blue-400/40 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-100"
            >
              <option value="" disabled>Изменить статус...</option>
              <option value="contacted">Связались</option>
              <option value="meeting">Встреча</option>
              <option value="negotiation">Переговоры</option>
              <option value="won">Выиграно (Сделка)</option>
              <option value="lost">Отказ</option>
            </select>

            <button
              onClick={onBatchDelete}
              className="px-2.5 py-1 text-rose-700 hover:bg-rose-100 bg-rose-50 border border-rose-200 rounded font-semibold flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Удалить выбранные</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
