import React, { useEffect, useState } from 'react';
import { X, Save, Phone, MapPin, Globe, Star, MessageSquare, ExternalLink, Trash2 } from 'lucide-react';
import { BusinessLead } from '../types';

interface LeadDetailModalProps {
  lead: BusinessLead | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveLead: (updatedLead: BusinessLead) => void;
  onDeleteLead: (leadId: string) => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  isOpen,
  onClose,
  onSaveLead,
  onDeleteLead
}) => {
  const [formData, setFormData] = useState<BusinessLead | null>(lead ? { ...lead } : null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setFormData(lead ? { ...lead } : null);
    setFormError('');
  }, [lead]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    if (!formData.name.trim()) {
      setFormError('Укажите название компании.');
      return;
    }
    if (formData.website.trim() && !isHttpUrl(formData.website.trim())) {
      setFormError('Укажите корректный адрес сайта, начинающийся с http:// или https://.');
      return;
    }
    onSaveLead(formData);
    onClose();
  };

  if (!isOpen || !lead || !formData) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="lead-detail-title" className="ui-modal-shell animate-fade-in">
      <div className="ui-modal-panel max-w-xl">
        <div className="ui-modal-header">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><MessageSquare className="h-5 w-5" /></span>
            <h3 id="lead-detail-title" className="text-base font-bold text-slate-950">Карточка лида и CRM заметки</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="ui-icon-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 shadow-sm sm:mx-6">{formError}</p>}

        <form onSubmit={handleSave} className="flex-1 space-y-5 overflow-y-auto p-5 text-sm sm:p-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Название организации
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Телефон
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+7 (xxx) xxx-xx-xx"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Статус в CRM
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
              >
                <option value="new">🆕 Новый лид</option>
                <option value="contacted">📞 Связались</option>
                <option value="meeting">🤝 Встреча назначена</option>
                <option value="negotiation">💼 Переговоры по цене</option>
                <option value="won">🏆 Сделка выиграна</option>
                <option value="lost">❌ Отказ / Архив</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Адрес
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Веб-сайт (оставьте пустым если нет)
              </label>
              <input
                type="text"
                value={formData.website}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    website: e.target.value,
                    hasWebsite: Boolean(e.target.value.trim())
                  })
                }
                placeholder="https://..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Приоритет лида
              </label>
              <select
                value={formData.leadQuality}
                onChange={(e) => setFormData({ ...formData, leadQuality: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
              >
                <option value="hot">🔥 Горячий (высокий интерес)</option>
                <option value="warm">⚡ Теплый</option>
                <option value="cold">❄ Холодный</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Рейтинг на картах
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Количество отзывов
              </label>
              <input
                type="number"
                min="0"
                value={formData.reviews}
                onChange={(e) => setFormData({ ...formData, reviews: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              История звонков и заметки (CRM)
            </label>
            <textarea
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Результаты последнего звонка, договоренности, бюджет клиента..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
            />
          </div>

          <div className="sticky bottom-0 -mx-5 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 pt-4 pb-1 backdrop-blur sm:-mx-6 sm:px-6">
            <button
              type="button"
              onClick={() => {
                if (confirm('Вы уверены, что хотите удалить этот лид?')) {
                  onDeleteLead(lead.id);
                  onClose();
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>Удалить лид</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
              className="ui-button-secondary px-4 py-2 text-xs"
              >
                Отмена
              </button>
              <button
                type="submit"
              className="ui-button-primary px-4 py-2 text-xs"
              >
                <Save className="w-4 h-4" />
                <span>Сохранить</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
