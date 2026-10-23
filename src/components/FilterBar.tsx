import React from 'react';
import { Search, MapPin, Tag, LayoutGrid, LayoutList, Trash2, CheckSquare, SlidersHorizontal } from 'lucide-react';
import { LeadFilter } from '../types';
import { QUICK_CATEGORIES, TARGET_CATEGORIES } from '../data/categories';

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

export const FilterBar: React.FC<FilterBarProps> = ({ filter, onChangeFilter, viewMode, onChangeViewMode, selectedCount, totalFilteredCount, onBatchDelete, onBatchStatusChange, layout = 'horizontal' }) => {
  const set = (patch: Partial<LeadFilter>) => onChangeFilter({ ...filter, ...patch });
  const isSidebar = layout === 'sidebar';
  const reset = () => onChangeFilter({ search: '', websiteFilter: 'without_website', phoneOnly: true, minRating: 0, quality: 'all', status: 'all', category: '', categories: [], city: '', sortBy: 'relevance', source: 'all', contact: 'all' });
  const selectedCategories = filter.categories ?? (filter.category ? [filter.category] : []);
  const toggleCategory = (category: string) => set({ categories: selectedCategories.includes(category) ? selectedCategories.filter((item) => item !== category) : [...selectedCategories, category], category: '' });
  const categorySummary = selectedCategories.length === TARGET_CATEGORIES.length ? 'Все категории' : selectedCategories.length > 1 ? `${selectedCategories[0]} +${selectedCategories.length - 1}` : selectedCategories[0] ?? 'Выберите категории';
  return (
    <section aria-label="Поиск и фильтры" className={`ui-panel space-y-5 p-5 ${isSidebar ? 'xl:sticky xl:top-[88px]' : ''}`}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.14em] text-blue-300">Поиск и фильтры</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Рабочий сегмент</h2>
      </div>

      <div className="relative">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input id="leads-filter-search" type="search" value={filter.search} onChange={(e) => set({ search: e.target.value })} placeholder="Название, телефон, услуга..." aria-label="Поиск по базе лидов" className="ui-input pl-10" />
      </div>

      <div className="grid grid-cols-3 rounded-xl border bg-[var(--surface-3)] p-1 text-xs font-medium">
        {([['all', 'Все'], ['without_website', 'Без сайта'], ['with_website', 'С сайтом']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => set({ websiteFilter: value })} className={`rounded-lg px-2 py-2 transition ${filter.websiteFilter === value ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'}`}>{label}</button>)}
      </div>

      <div className="space-y-3 border-t pt-5">
        <div>
          <label htmlFor="filter-city-input" className="ui-label">Город / регион</label>
          <div className="relative"><MapPin aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input id="filter-city-input" value={filter.city} onChange={(e) => set({ city: e.target.value })} placeholder="Например: Актау" className="ui-input pl-10" /></div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2"><label className="ui-label">Категории</label><span className="text-[11px] text-[var(--text-muted)]">{selectedCategories.length}/{TARGET_CATEGORIES.length}</span></div>
          <div className="relative mt-1 rounded-xl border bg-[var(--surface-3)] p-3"><Tag aria-hidden="true" className="absolute left-3 top-4 h-4 w-4 text-slate-500" /><p className="min-h-5 pl-6 text-sm text-slate-100">{categorySummary}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => set({ categories: [...TARGET_CATEGORIES], category: '' })} className="rounded-lg bg-blue-500/15 px-2.5 py-1.5 text-xs font-medium text-blue-100 hover:bg-blue-500/25">Выбрать все</button><button type="button" onClick={() => set({ categories: [], category: '' })} className="rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-white/5 hover:text-white">Очистить</button></div><div className="mt-3 max-h-44 space-y-1 overflow-auto pr-1">{TARGET_CATEGORIES.map((category) => <label key={category} className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs text-slate-200 hover:bg-white/5"><input type="checkbox" checked={selectedCategories.includes(category)} onChange={() => toggleCategory(category)} className="h-4 w-4 rounded border-slate-600 bg-[var(--surface-3)] text-[var(--primary)]" />{category}</label>)}</div></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_CATEGORIES.map((category) => <button key={category} type="button" onClick={() => toggleCategory(category)} aria-pressed={selectedCategories.includes(category)} className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${selectedCategories.includes(category) ? 'border-blue-400/40 bg-blue-500/15 text-blue-100' : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-slate-500 hover:text-white'}`}>{category}</button>)}
        </div>
      </div>

      <div className="space-y-3 border-t pt-5">
        <div><label htmlFor="filter-status-select" className="ui-label">Статус</label><select id="filter-status-select" value={filter.status} onChange={(e) => set({ status: e.target.value as LeadFilter['status'] })} className="ui-input"><option value="all">Все статусы</option><option value="new">Новые</option><option value="contacted">Связались</option><option value="meeting">Встреча</option><option value="negotiation">Переговоры</option><option value="won">Выиграно</option><option value="lost">Отказ</option></select></div>
        <div><label htmlFor="filter-quality-select" className="ui-label">Приоритет</label><select id="filter-quality-select" value={filter.quality} onChange={(e) => set({ quality: e.target.value as LeadFilter['quality'] })} className="ui-input"><option value="all">Любой</option><option value="hot">Горячий</option><option value="warm">Теплый</option><option value="cold">Холодный</option></select></div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={filter.phoneOnly} onChange={(e) => set({ phoneOnly: e.target.checked })} className="h-4 w-4 rounded border-slate-600 bg-[var(--surface-3)] text-[var(--primary)]" /> Только с телефоном</label>
        <div><label htmlFor="filter-contact-select" className="ui-label">Контакт</label><select id="filter-contact-select" value={filter.contact ?? 'all'} onChange={(e) => set({ contact: e.target.value as LeadFilter['contact'] })} className="ui-input"><option value="all">Любой</option><option value="mobile">Есть мобильный</option><option value="phone">Есть телефон</option><option value="whatsapp_available">WhatsApp подтверждён</option><option value="whatsapp_unknown">WhatsApp неизвестен</option></select></div>
      </div>

      <div className="space-y-2 border-t pt-5">
        <label htmlFor="filter-sort-select" className="ui-label"><SlidersHorizontal aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />Сортировка</label>
        <select id="filter-sort-select" value={filter.sortBy} onChange={(e) => set({ sortBy: e.target.value as LeadFilter['sortBy'] })} className="ui-input"><option value="relevance">По релевантности</option><option value="rating_desc">По рейтингу</option><option value="reviews_desc">По отзывам</option><option value="name_asc">По алфавиту</option><option value="date_desc">По дате</option></select>
      </div>

      <div className="flex items-center gap-1 rounded-xl border bg-[var(--surface-3)] p-1">
        <button id="view-cards-btn" type="button" onClick={() => onChangeViewMode('cards')} aria-label="Карточки" className={`flex min-h-10 flex-1 items-center justify-center rounded-lg ${viewMode === 'cards' ? 'bg-[var(--primary-soft)] text-blue-200' : 'text-slate-400 hover:text-white'}`}><LayoutGrid className="h-4 w-4" /></button>
        <button id="view-table-btn" type="button" onClick={() => onChangeViewMode('table')} aria-label="Таблица" className={`flex min-h-10 flex-1 items-center justify-center rounded-lg ${viewMode === 'table' ? 'bg-[var(--primary-soft)] text-blue-200' : 'text-slate-400 hover:text-white'}`}><LayoutList className="h-4 w-4" /></button>
      </div>

      {selectedCount > 0 && <div className="space-y-3 rounded-xl border border-blue-400/25 bg-blue-500/10 p-3 text-xs"><div className="flex items-center gap-2 font-semibold text-blue-100"><CheckSquare className="h-4 w-4" />Выбрано: {selectedCount} из {totalFilteredCount}</div><select onChange={(e) => { if (e.target.value) { onBatchStatusChange(e.target.value); e.target.value = ''; } }} defaultValue="" className="ui-input min-h-9 text-xs"><option value="" disabled>Установить статус...</option><option value="contacted">Связались</option><option value="meeting">Встреча</option><option value="negotiation">Переговоры</option><option value="won">Выиграно</option><option value="lost">Отказ</option></select><button onClick={onBatchDelete} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"><Trash2 className="h-4 w-4" />Удалить выбранные</button></div>}
      <button type="button" onClick={reset} className="w-full py-1 text-xs font-medium text-[var(--text-muted)] hover:text-white">Сбросить фильтры</button>
    </section>
  );
};
