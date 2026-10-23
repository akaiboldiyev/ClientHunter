import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navbar } from './components/Navbar';
import { StatsBar } from './components/StatsBar';
import { SearchHeader } from './components/SearchHeader';
import { FilterBar } from './components/FilterBar';
import { LeadTable } from './components/LeadTable';
import { LeadCard } from './components/LeadCard';
import { OutreachPitchModal } from './components/OutreachPitchModal';
import { LeadDetailModal } from './components/LeadDetailModal';
import { AddLeadModal } from './components/AddLeadModal';
import { BusinessLead, SearchQuery, ScrapingProgress, LeadFilter } from './types';
import { hydrateLead, mergeLeads } from './utils/leadData';

export function App() {
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const searchAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch('/api/leads').then(async (response) => {
      if (!response.ok) throw new Error();
      const payload = await response.json();
      setLeads(Array.isArray(payload.leads) ? payload.leads.map(hydrateLead) : []);
    }).catch(() => setStorageNotice('Не удалось загрузить локальную базу сервера. Проверьте, что LeadScout server запущен.'));
  }, []);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    const leadIds = new Set(leads.map((lead) => lead.id));
    setSelectedIds((ids) => ids.filter((id) => leadIds.has(id)));
  }, [leads]);

  // Selected leads for batch actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // View mode
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'cards' : 'table'
  );

  // Filter state
  const [filter, setFilter] = useState<LeadFilter>({
    search: '',
    websiteFilter: 'without_website',
    phoneOnly: true,
    minRating: 0,
    quality: 'all',
    status: 'all',
    category: '',
    categories: ['стоматология'],
    city: 'Актау',
    sortBy: 'relevance',
    source: 'all',
    contact: 'all'
  });

  // Scraping progress
  const [progress, setProgress] = useState<ScrapingProgress>({
    isScraping: false,
    stage: 'idle',
    progress: 0,
    currentQuery: '',
    foundCount: 0,
    withoutWebsiteCount: 0,
    statusMessage: ''
  });

  // Modals state
  const [pitchLead, setPitchLead] = useState<BusinessLead | null>(null);
  const [detailLead, setDetailLead] = useState<BusinessLead | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleStartScraping = useCallback(async (query: SearchQuery) => {
    if (progress.isScraping) return;
    const categories = query.categories;
    const queryStr = `${query.city} • ${categories.length} категорий`;
    const controller = new AbortController();
    searchAbort.current = controller;
    setProgress({
      isScraping: true,
      stage: 'initializing',
      progress: 0,
      currentQuery: queryStr,
      foundCount: 0,
      withoutWebsiteCount: 0,
      statusMessage: `2GIS • категория 0 / ${categories.length}`,
      completedCategories: [], failedCategories: []
    });
    const results: BusinessLead[] = [];
    const completed: string[] = [];
    const failed: string[] = [];
    for (let categoryIndex = 0; categoryIndex < categories.length && !controller.signal.aborted; categoryIndex += 1) {
      const category = categories[categoryIndex];
      const remaining = query.limit - results.length;
      if (remaining <= 0) break;
      const categoriesRemaining = categories.length - categoryIndex;
      const categoryBudget = Math.ceil(remaining / categoriesRemaining);
      let processed = 0;
      let categoryTotal = 0;
      try {
        const response = await fetch('/api/search/2gis/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ city: query.city, category, limit: categoryBudget }), signal: controller.signal });
        if (!response.ok || !response.body) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || 'Ошибка 2GIS'); }
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read(); if (done) break;
          buffer += decoder.decode(value, { stream: true }); const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line);
            if (event.event === 'lead') {
              const lead = hydrateLead(event.lead); results.push(lead); processed = Number(event.openedCards ?? processed); categoryTotal = Number(event.total ?? categoryTotal);
              setLeads((previous) => mergeLeads([lead, ...previous]));
              const suitable = results.filter((item) => !item.hasWebsite && Boolean(item.phones?.length)).length;
              setProgress((current) => ({ ...current, stage: 'extracting_contacts', currentCategory: category, categoryIndex: categoryIndex + 1, totalCategories: categories.length, processedCount: results.length, totalAvailable: categoryTotal, foundCount: results.length, suitableCount: suitable, withoutWebsiteCount: results.filter((item) => !item.hasWebsite).length, progress: Math.round((results.length / query.limit) * 100), statusMessage: `${category} • найдено в 2GIS ${categoryTotal || '…'} • обработано всего ${results.length} / ${query.limit} • подходящих лидов ${suitable}` }));
            } else if (event.event === 'verification_required') throw new Error('2GIS просит пройти CAPTCHA в открытом окне. Уже обработанные лиды сохранены.');
            else if (event.event === 'error') throw new Error(event.error || 'Ошибка Playwright provider');
          }
        }
        completed.push(category);
      } catch (error) {
        if (controller.signal.aborted) break;
        failed.push(category);
      }
      const done = completed.length + failed.length;
      setProgress((current) => ({ ...current, stage: 'searching', progress: Math.round((done / categories.length) * 100), completedCategories: [...completed], failedCategories: [...failed], statusMessage: `2GIS • категория ${done} / ${categories.length} • всего лидов ${mergeLeads(results).length}` }));
    }
    if (controller.signal.aborted) {
      setProgress((current) => ({ ...current, isScraping: false, stage: 'completed', statusMessage: 'Поиск остановлен. Уже найденные результаты сохранены.' }));
      return;
    }
    const deduplicated = mergeLeads(results);
    setLeads((previous) => mergeLeads([...deduplicated, ...previous]));
    setProgress({ isScraping: false, stage: 'completed', progress: 100, currentQuery: queryStr, foundCount: deduplicated.length, rawCount: results.length, deduplicatedCount: deduplicated.length, withoutWebsiteCount: deduplicated.filter((lead) => !lead.hasWebsite).length, phoneCount: deduplicated.filter((lead) => lead.phones?.length).length, mobileCount: deduplicated.filter((lead) => lead.phones?.some((phone) => phone.type === 'mobile')).length, confirmedWhatsAppCount: deduplicated.filter((lead) => lead.whatsappStatus === 'available').length, completedCategories: completed, failedCategories: failed, statusMessage: failed.length ? 'Поиск завершён с частичными ошибками.' : 'Поиск завершён.' });
  }, [progress.isScraping]);

  const handleStopScraping = useCallback(() => searchAbort.current?.abort(), []);

  // Filtered and sorted leads
  const filteredLeads = useMemo(() => {
    return leads
      .filter(lead => {
        // Search term
        if (filter.search.trim()) {
          const q = filter.search.toLowerCase();
          const matchName = lead.name.toLowerCase().includes(q);
          const matchPhone = (lead.phone || '').toLowerCase().includes(q);
          const matchAddress = (lead.address || '').toLowerCase().includes(q);
          const matchCategory = (lead.category || '').toLowerCase().includes(q);
          const matchCity = (lead.city || '').toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchAddress && !matchCategory && !matchCity) {
            return false;
          }
        }

        // Website filter
        if (filter.websiteFilter === 'without_website' && lead.hasWebsite) return false;
        if (filter.websiteFilter === 'with_website' && !lead.hasWebsite) return false;

        // Phone only
        if (filter.phoneOnly && (!lead.phone || lead.phone.trim().length === 0)) return false;

        if (filter.minRating > 0 && lead.rating < filter.minRating) return false;
        const selectedCategories = filter.categories ?? (filter.category ? [filter.category] : []);
        if (selectedCategories.length && !selectedCategories.some((category) => lead.category.toLowerCase().includes(category.toLowerCase()))) return false;
        if (filter.city.trim() && !lead.city.toLowerCase().includes(filter.city.trim().toLowerCase())) return false;

        // Quality
        if (filter.quality !== 'all' && lead.leadQuality !== filter.quality) return false;

        // Status
        if (filter.status !== 'all' && lead.status !== filter.status) return false;
        if (filter.source === '2gis' && !lead.sources?.includes('2gis')) return false;
        if (filter.contact === 'mobile' && !lead.phones?.some((phone) => phone.type === 'mobile')) return false;
        if (filter.contact === 'phone' && !lead.phones?.length) return false;
        if (filter.contact === 'whatsapp_available' && lead.whatsappStatus !== 'available') return false;
        if (filter.contact === 'whatsapp_unknown' && lead.whatsappStatus !== 'unknown') return false;

        return true;
      })
      .sort((a, b) => {
        if (filter.sortBy === 'rating_desc') {
          return (b.rating || 0) - (a.rating || 0);
        }
        if (filter.sortBy === 'reviews_desc') {
          return (b.reviews || 0) - (a.reviews || 0);
        }
        if (filter.sortBy === 'name_asc') {
          return a.name.localeCompare(b.name, 'ru');
        }
        if (filter.sortBy === 'date_desc') {
          return new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime();
        }
        // Default relevance: hot leads without website first
        if (!a.hasWebsite && b.hasWebsite) return -1;
        if (a.hasWebsite && !b.hasWebsite) return 1;
        return (b.rating || 0) * (b.reviews || 1) - (a.rating || 0) * (a.reviews || 1);
      });
  }, [leads, filter]);

  // Lead updates
  const handleUpdateStatus = useCallback((leadId: string, status: BusinessLead['status']) => {
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, status } : l)));
    void fetch(`/api/leads/${encodeURIComponent(leadId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  }, []);

  const handleUpdateLead = (updated: BusinessLead) => {
    setLeads(prev => prev.map(l => (l.id === updated.id ? updated : l)));
    void fetch(`/api/leads/${encodeURIComponent(updated.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
  };

  const handleDeleteLead = useCallback((leadId: string) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
    setSelectedIds(prev => prev.filter(id => id !== leadId));
    setPitchLead((lead) => lead?.id === leadId ? null : lead);
    setDetailLead((lead) => lead?.id === leadId ? null : lead);
    void fetch(`/api/leads/${encodeURIComponent(leadId)}`, { method: 'DELETE' });
  }, []);

  const handleAddManualLead = (newLead: BusinessLead) => {
    setLeads(prev => [newLead, ...prev]);
    void fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newLead) });
  };

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredLeads.map((lead) => lead.id);
    const allVisibleSelected = visibleIds.every((id) => selectedIds.includes(id));

    if (allVisibleSelected) {
      setSelectedIds((ids) => ids.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((ids) => Array.from(new Set([...ids, ...visibleIds])));
    }
  };

  const handleBatchDelete = () => {
    if (confirm(`Удалить выбранные ${selectedIds.length} компаний?`)) {
      setLeads(prev => prev.filter(l => !selectedIds.includes(l.id)));
      selectedIds.forEach((id) => { void fetch(`/api/leads/${encodeURIComponent(id)}`, { method: 'DELETE' }); });
      setSelectedIds([]);
    }
  };

  const handleBatchStatusChange = (statusStr: string) => {
    const status = statusStr as BusinessLead['status'];
    setLeads(prev =>
      prev.map(l => (selectedIds.includes(l.id) ? { ...l, status } : l))
    );
    selectedIds.forEach((id) => { void fetch(`/api/leads/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); });
    setSelectedIds([]);
  };

  return (
    <div className="signal-canvas min-h-dvh text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <Navbar
        leads={leads}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-6 xl:px-8">
        {storageNotice && (
          <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <span>{storageNotice}</span>
            <button type="button" onClick={() => setStorageNotice(null)} className="font-semibold underline underline-offset-2">Закрыть</button>
          </div>
        )}
        <section aria-label="Рабочая область лидов" className="xl:grid xl:grid-cols-[18.125rem_minmax(0,1fr)] xl:items-start xl:gap-6">
          <FilterBar
            filter={filter}
            onChangeFilter={setFilter}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            selectedCount={selectedIds.length}
            totalFilteredCount={filteredLeads.length}
            onBatchDelete={handleBatchDelete}
            onBatchStatusChange={handleBatchStatusChange}
            layout="sidebar"
          />

          <div className="min-w-0">
            <StatsBar leads={leads} />
            <SearchHeader onStartScraping={handleStartScraping} onStopScraping={handleStopScraping} progress={progress} filter={filter} />
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">База лидов</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">Компании для контакта</h2>
              </div>
              <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold text-blue-100 tabular-nums">{filteredLeads.length} в выборке</span>
            </div>
        {/* Lead Table or Card Grid */}
        {viewMode === 'table' ? (
          <>
            <div className="hidden lg:block">
              <LeadTable
                leads={filteredLeads}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onOpenPitch={setPitchLead}
                onOpenDetail={setDetailLead}
                onChangeStatus={handleUpdateStatus}
                onDeleteLead={handleDeleteLead}
              />
            </div>
            <div className="lg:hidden">
              {filteredLeads.length === 0 ? (
                <LeadTable
                  leads={filteredLeads}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleSelectAll={handleToggleSelectAll}
                  onOpenPitch={setPitchLead}
                  onOpenDetail={setDetailLead}
                  onChangeStatus={handleUpdateStatus}
                  onDeleteLead={handleDeleteLead}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredLeads.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      isSelected={selectedIds.includes(lead.id)}
                      onToggleSelect={handleToggleSelect}
                      onOpenPitch={setPitchLead}
                      onOpenDetail={setDetailLead}
                      onChangeStatus={handleUpdateStatus}
                      onDeleteLead={handleDeleteLead}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          filteredLeads.length === 0 ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-12 text-center shadow-2xs">
              <h3 className="text-base font-bold text-white">Компании не найдены</h3>
              <p className="mt-1 text-sm text-slate-400">Измените параметры фильтра или запустите новый поиск.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 min-[1450px]:grid-cols-3">
              {filteredLeads.map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  isSelected={selectedIds.includes(lead.id)}
                  onToggleSelect={handleToggleSelect}
                  onOpenPitch={setPitchLead}
                  onOpenDetail={setDetailLead}
                  onChangeStatus={handleUpdateStatus}
                  onDeleteLead={handleDeleteLead}
                />
              ))}
            </div>
          )
        )}
          </div>
        </section>
      </main>

      {/* Outreach Pitch Script Modal */}
      <OutreachPitchModal
        lead={pitchLead}
        isOpen={Boolean(pitchLead)}
        onClose={() => setPitchLead(null)}
        onUpdateNotes={(id, notes) => {
          setLeads(prev => prev.map(l => (l.id === id ? { ...l, notes } : l)));
        }}
        onUpdateWhatsAppStatus={(id, whatsappStatus) => {
          setLeads(prev => prev.map(l => (l.id === id ? { ...l, whatsappStatus } : l)));
          setPitchLead((lead) => lead?.id === id ? { ...lead, whatsappStatus } : lead);
        }}
      />

      {/* Lead Detail & CRM Notes Modal */}
      <LeadDetailModal
        lead={detailLead}
        isOpen={Boolean(detailLead)}
        onClose={() => setDetailLead(null)}
        onSaveLead={handleUpdateLead}
        onDeleteLead={handleDeleteLead}
      />

      {/* Manual Add Lead Modal */}
      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddLead={handleAddManualLead}
      />
    </div>
  );
}
export default App;
