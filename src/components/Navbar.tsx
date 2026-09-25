import React from 'react';
import { Target, FileSpreadsheet, Plus, RefreshCw } from 'lucide-react';
import { BusinessLead } from '../types';
import { exportToExcel, exportToCSV } from '../utils/exporter';

interface NavbarProps {
  leads: BusinessLead[];
  onOpenAddModal: () => void;
  onResetToDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  leads,
  onOpenAddModal,
  onResetToDemo
}) => {
  const withoutWebCount = leads.filter(l => !l.hasWebsite).length;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 shadow-lg shadow-slate-950/20 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[4.5rem] max-w-[90rem] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">LeadScout</span>
              <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-[11px] font-bold text-blue-200">
                ClientHunter
              </span>
            </div>
            <p className="hidden text-xs text-slate-400 sm:block">
              Парсер и поиск клиентов без сайта на Google Maps & 2GIS
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2">
          <button
            id="reset-demo-btn"
            onClick={onResetToDemo}
            title="Восстановить исходные данные"
            aria-label="Восстановить демонстрационные данные"
            className="ui-icon-button gap-1.5 border border-white/15 bg-white/5 px-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden md:inline">Демо-база</span>
          </button>

          <button
            id="add-manual-lead-btn"
            onClick={onOpenAddModal}
            className="ui-button-secondary border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            <Plus className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Добавить лид</span>
          </button>

          {/* Export dropdown / direct buttons */}
          <div className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50/80 p-1 shadow-sm shadow-emerald-950/[0.02]">
            <button
              id="export-excel-btn"
              onClick={() => exportToExcel(leads, `leads_without_website_${Date.now()}.xlsx`)}
              disabled={leads.length === 0}
              className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
              title="Экспорт в Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Excel ({withoutWebCount})</span>
            </button>
            <button
              id="export-csv-btn"
              onClick={() => exportToCSV(leads, `leads_${Date.now()}.csv`)}
              disabled={leads.length === 0}
              className="hidden min-h-9 rounded-lg px-2 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 sm:block"
              title="Экспорт в CSV"
            >
              CSV
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
