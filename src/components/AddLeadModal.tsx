import React, { useEffect, useState } from 'react';
import { X, Plus, Building2 } from 'lucide-react';
import { BusinessLead } from '../types';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLead: (lead: BusinessLead) => void;
}

export const AddLeadModal: React.FC<AddLeadModalProps> = ({
  isOpen,
  onClose,
  onAddLead
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [city, setCity] = useState('Актау');
  const [category, setCategory] = useState('стоматология');
  const [rating, setRating] = useState(4.8);
  const [reviews, setReviews] = useState(15);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setPhone('');
    setAddress('');
    setWebsite('');
    setCity('Актау');
    setCategory('стоматология');
    setRating(4.8);
    setReviews(15);
    setNotes('');
    setFormError('');
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Укажите название компании.');
      return;
    }

    const normalizedWebsite = website.trim();
    if (normalizedWebsite && !isHttpUrl(normalizedWebsite)) {
      setFormError('Укажите корректный адрес сайта, начинающийся с http:// или https://.');
      return;
    }

    const hasWeb = Boolean(normalizedWebsite);

    const newLead: BusinessLead = {
      id: `manual-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      website: normalizedWebsite,
      city: city.trim() || 'Актау',
      category: category.trim() || 'бизнес',
      rating: rating || 0,
      reviews: reviews || 0,
      maps_url: `https://www.google.com/maps/search/${encodeURIComponent(name + ' ' + city)}`,
      source: 'manual',
      scrapedAt: new Date().toISOString(),
      hasWebsite: hasWeb,
      leadQuality: !hasWeb && rating >= 4.5 ? 'hot' : 'warm',
      status: 'new',
      notes: notes.trim()
    };

    onAddLead(newLead);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="add-lead-title" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Building2 className="h-5 w-5" /></span>
            <h3 id="add-lead-title" className="text-base font-bold text-slate-950">Добавить лид вручную</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="ui-icon-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-5 text-sm sm:p-6">
          {formError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">{formError}</p>}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Название компании *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Салон 'Элеганс'"
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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (701) 000-00-00"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Город
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Категория
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="стоматология, автосервис..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Веб-сайт (пусто если нет)
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Адрес
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Адрес или микрорайон..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
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
                value={rating}
                onChange={(e) => setRating(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Отзывы
              </label>
              <input
                type="number"
                min="0"
                value={reviews}
                onChange={(e) => setReviews(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Заметки
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Комментарий или статус..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
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
              <Plus className="w-4 h-4" />
              <span>Добавить лид</span>
            </button>
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
