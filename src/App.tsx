import React, { useState, useEffect, useMemo } from 'react';
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
import { INITIAL_LEADS, generateScrapedLeads } from './data/mockDatabase';

const STORAGE_KEY = 'leadscout_leads_data_v1';

export function App() {
  // Leads state
  const [leads, setLeads] = useState<BusinessLead[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load leads from localStorage:', e);
    }
    return INITIAL_LEADS;
  });

  // Save leads to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    } catch (e) {
      console.error('Failed to save leads to localStorage:', e);
    }
  }, [leads]);

  // Selected leads for batch actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // View mode
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Filter state
  const [filter, setFilter] = useState<LeadFilter>({
    search: '',
    websiteFilter: 'all',
    phoneOnly: false,
    minRating: 0,
    quality: 'all',
    status: 'all',
    category: '',
    city: '',
    sortBy: 'relevance'
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

  // Handle start scraping simulation (matches python main.py steps)
  const handleStartScraping = (query: SearchQuery) => {
    if (progress.isScraping) return;

    const queryStr = `${query.city} ${query.category}`;
    setProgress({
      isScraping: true,
      stage: 'initializing',
      progress: 10,
      currentQuery: queryStr,
      foundCount: 0,
      withoutWebsiteCount: 0,
      statusMessage: `Инициализация браузера и открытие ${query.source === '2gis' ? '2GIS' : 'Google Maps'}...`
    });

    // Step 1: Consent & Search
    setTimeout(() => {
      setProgress(prev => ({
        ...prev,
        stage: 'searching',
        progress: 30,
        statusMessage: `Прохождение cookie consent и ввод поискового запроса: "${queryStr}"...`
      }));
    }, 900);

    // Step 2: Feed scrolling & parsing
    setTimeout(() => {
      setProgress(prev => ({
        ...prev,
        stage: 'parsing_places' as any,
        progress: 60,
        statusMessage: `Прокрутка ленты результатов и извлечение карточек организаций...`
      }));
    }, 1800);

    // Step 3: Contact extraction & website verification
    setTimeout(() => {
      setProgress(prev => ({
        ...prev,
        stage: 'detecting_websites' as any,
        progress: 85,
        statusMessage: `Проверка наличия веб-сайтов и извлечение телефонов из панелей...`
      }));
    }, 2700);

    // Step 4: Complete & add leads (deduplicated like in main.py)
    setTimeout(() => {
      const generated = generateScrapedLeads(query);
      const noWebCount = generated.filter(l => !l.hasWebsite).length;

      setLeads(prevLeads => {
        // Deduplicate against existing by name + phone
        const existingKeys = new Set(prevLeads.map(l => `${l.name.toLowerCase().trim()}|${(l.phone || '').trim()}`));
        const fresh = generated.filter(g => !existingKeys.has(`${g.name.toLowerCase().trim()}|${(g.phone || '').trim()}`));
        return [...fresh, ...prevLeads];
      });

      setProgress({
        isScraping: false,
        stage: 'completed',
        progress: 100,
        currentQuery: queryStr,
        foundCount: generated.length,
        withoutWebsiteCount: noWebCount,
        statusMessage: `Парсинг успешно завершен! Найдено ${generated.length} компаний, из них без сайта: ${noWebCount}.`
      });
    }, 3500);
  };

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

        // Quality
        if (filter.quality !== 'all' && lead.leadQuality !== filter.quality) return false;

        // Status
        if (filter.status !== 'all' && lead.status !== filter.status) return false;

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
  const handleUpdateStatus = (leadId: string, status: BusinessLead['status']) => {
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, status } : l)));
  };

  const handleUpdateLead = (updated: BusinessLead) => {
    setLeads(prev => prev.map(l => (l.id === updated.id ? updated : l)));
  };

  const handleDeleteLead = (leadId: string) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
    setSelectedIds(prev => prev.filter(id => id !== leadId));
  };

  const handleAddManualLead = (newLead: BusinessLead) => {
    setLeads(prev => [newLead, ...prev]);
  };

  const handleResetToDemo = () => {
    if (confirm('Сбросить базу к исходным демонстрационным лидам?')) {
      setLeads(INITIAL_LEADS);
      setSelectedIds([]);
    }
  };

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredLeads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLeads.map(l => l.id));
    }
  };

  const handleBatchDelete = () => {
    if (confirm(`Удалить выбранные ${selectedIds.length} компаний?`)) {
      setLeads(prev => prev.filter(l => !selectedIds.includes(l.id)));
      setSelectedIds([]);
    }
  };

  const handleBatchStatusChange = (statusStr: string) => {
    const status = statusStr as BusinessLead['status'];
    setLeads(prev =>
      prev.map(l => (selectedIds.includes(l.id) ? { ...l, status } : l))
    );
    setSelectedIds([]);
  };

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-900 flex flex-col">
      {/* Top Navigation */}
      <Navbar
        leads={leads}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onResetToDemo={handleResetToDemo}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Global Statistics */}
        <StatsBar leads={leads} />

        {/* Lead Finder & Scraper Header Form */}
        <SearchHeader
          onStartScraping={handleStartScraping}
          progress={progress}
        />

        {/* Filter and Control Bar */}
        <FilterBar
          filter={filter}
          onChangeFilter={setFilter}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          selectedCount={selectedIds.length}
          totalFilteredCount={filteredLeads.length}
          onBatchDelete={handleBatchDelete}
          onBatchStatusChange={handleBatchStatusChange}
        />

        {/* Lead Table or Card Grid */}
        {viewMode === 'table' ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      </main>

      {/* Outreach Pitch Script Modal */}
      <OutreachPitchModal
        lead={pitchLead}
        isOpen={Boolean(pitchLead)}
        onClose={() => setPitchLead(null)}
        onUpdateNotes={(id, notes) => {
          setLeads(prev => prev.map(l => (l.id === id ? { ...l, notes } : l)));
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
