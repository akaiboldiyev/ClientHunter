import React from 'react';
import { Target, Sparkles, Download, FileSpreadsheet, Plus, RefreshCw } from 'lucide-react';
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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-900 tracking-tight">LeadScout</span>
              <span className="text-xs px-2 py-0.5 font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full">
                ClientHunter
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Парсер и поиск клиентов без сайта на Google Maps & 2GIS
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="reset-demo-btn"
            onClick={onResetToDemo}
            title="Восстановить исходные данные"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors text-xs flex items-center gap-1.5 border border-slate-200"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden md:inline">Демо-база</span>
          </button>

          <button
            id="add-manual-lead-btn"
            onClick={onOpenAddModal}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Добавить лид</span>
          </button>

          {/* Export dropdown / direct buttons */}
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg p-1">
            <button
              id="export-excel-btn"
              onClick={() => exportToExcel(leads, `leads_without_website_${Date.now()}.xlsx`)}
              disabled={leads.length === 0}
              className="px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 rounded transition-colors flex items-center gap-1.5"
              title="Экспорт в Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Excel ({withoutWebCount})</span>
            </button>
            <button
              id="export-csv-btn"
              onClick={() => exportToCSV(leads, `leads_${Date.now()}.csv`)}
              disabled={leads.length === 0}
              className="px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 rounded transition-colors"
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
