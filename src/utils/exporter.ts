import * as XLSX from 'xlsx';
import { BusinessLead } from '../types';

export function exportToExcel(leads: BusinessLead[], filename = 'results.xlsx'): void {
  const exportData = leads.map((lead, idx) => ({
    '№': idx + 1,
    'Название компании': lead.name,
    'Телефон': lead.phone || 'Не указан',
    'Адрес': lead.address || '',
    'Сайт': lead.website || 'НЕТ САЙТА (Потенциальный клиент)',
    'Рейтинг': lead.rating || 0,
    'Количество отзывов': lead.reviews || 0,
    'Город': lead.city,
    'Категория': lead.category,
    'Качество лида': lead.hasWebsite ? 'Сайт есть' : (lead.leadQuality === 'hot' ? '🔥 Горячий лид' : '⚡ Теплый лид'),
    'Статус сделки': getStatusLabel(lead.status),
    'Ссылка Google Maps': lead.maps_url,
    'Заметки': lead.notes || '',
    'Дата добавления': new Date(lead.scrapedAt).toLocaleDateString('ru-RU')
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Auto-fit column widths
  const colWidths = [
    { wch: 4 },  // №
    { wch: 30 }, // Название
    { wch: 20 }, // Телефон
    { wch: 35 }, // Адрес
    { wch: 25 }, // Сайт
    { wch: 10 }, // Рейтинг
    { wch: 18 }, // Отзывы
    { wch: 14 }, // Город
    { wch: 18 }, // Категория
    { wch: 18 }, // Качество
    { wch: 16 }, // Статус
    { wch: 40 }, // Maps URL
    { wch: 40 }, // Заметки
    { wch: 16 }  // Дата
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Лиды без сайта');

  XLSX.writeFile(workbook, filename);
}

export function exportToCSV(leads: BusinessLead[], filename = 'results.csv'): void {
  const headers = ['Название', 'Телефон', 'Адрес', 'Сайт', 'Рейтинг', 'Отзывы', 'Город', 'Категория', 'Статус', 'Maps URL', 'Заметки'];
  
  const rows = leads.map(l => [
    `"${(l.name || '').replace(/"/g, '""')}"`,
    `"${(l.phone || '').replace(/"/g, '""')}"`,
    `"${(l.address || '').replace(/"/g, '""')}"`,
    `"${(l.website || '').replace(/"/g, '""')}"`,
    l.rating || 0,
    l.reviews || 0,
    `"${(l.city || '').replace(/"/g, '""')}"`,
    `"${(l.category || '').replace(/"/g, '""')}"`,
    `"${getStatusLabel(l.status)}"`,
    `"${(l.maps_url || '').replace(/"/g, '""')}"`,
    `"${(l.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToJSON(leads: BusinessLead[], filename = 'results.json'): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(leads, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getStatusLabel(status: BusinessLead['status']): string {
  switch (status) {
    case 'new': return 'Новый';
    case 'contacted': return 'Связались';
    case 'meeting': return 'Встреча / Презентация';
    case 'negotiation': return 'Переговоры';
    case 'won': return 'Сделка закрыта (Выиграно)';
    case 'lost': return 'Отказ';
    default: return status;
  }
}
