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
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filter,
  onChangeFilter,
  viewMode,
  onChangeViewMode,
  selectedCount,
  totalFilteredCount,
  onBatchDelete,
  onBatchStatusChange
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 shadow-2xs space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="leads-filter-search"
            type="text"
            value={filter.search}
            onChange={(e) => onChangeFilter({ ...filter, search: e.target.value })}
            placeholder="Поиск по названию, телефону, адресу, категории..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Quick Website Filter Tabs */}
        <div className="flex max-w-full overflow-x-auto items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => onChangeFilter({ ...filter, websiteFilter: 'all' })}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filter.websiteFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Все компании
          </button>
          <button
            type="button"
            onClick={() => onChangeFilter({ ...filter, websiteFilter: 'without_website' })}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              filter.websiteFilter === 'without_website'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'text-amber-700 hover:text-amber-900'
            }`}
          >
            <span>🔥 Без сайта</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeFilter({ ...filter, websiteFilter: 'with_website' })}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filter.websiteFilter === 'with_website'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            С сайтом
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-slate-50 shrink-0">
          <button
            id="view-table-btn"
            type="button"
            onClick={() => onChangeViewMode('table')}
            title="Таблица"
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'table' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            id="view-cards-btn"
            type="button"
            onClick={() => onChangeViewMode('cards')}
            title="Карточки"
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'cards' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Secondary filter & sort controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Статус:</span>
            <select
              id="filter-status-select"
              value={filter.status}
              onChange={(e) => onChangeFilter({ ...filter, status: e.target.value as any })}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium"
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
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Приоритет:</span>
            <select
              id="filter-quality-select"
              value={filter.quality}
              onChange={(e) => onChangeFilter({ ...filter, quality: e.target.value as any })}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium"
            >
              <option value="all">Любой</option>
              <option value="hot">🔥 Горячий</option>
              <option value="warm">⚡ Теплый</option>
              <option value="cold">❄ Холодный</option>
            </select>
          </div>

          {/* Phone only checkbox */}
          <label className="flex items-center gap-1.5 text-slate-600 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={filter.phoneOnly}
              onChange={(e) => onChangeFilter({ ...filter, phoneOnly: e.target.checked })}
              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300"
            />
            <span>Только с телефоном</span>
          </label>
        </div>

        {/* Sort By */}
        <div className="flex items-center gap-1.5 ml-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500 font-medium">Сортировка:</span>
          <select
            id="filter-sort-select"
            value={filter.sortBy}
            onChange={(e) => onChangeFilter({ ...filter, sortBy: e.target.value as any })}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium"
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
        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-blue-900">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <span>Выбрано: {selectedCount} из {totalFilteredCount}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-blue-800 font-medium">Установить статус:</span>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onBatchStatusChange(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="bg-white border border-blue-300 rounded px-2 py-1 text-xs font-semibold text-slate-800"
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
    </div>
  );
};
