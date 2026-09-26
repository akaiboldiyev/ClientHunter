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
    <div role="dialog" aria-modal="true" aria-labelledby="add-lead-title" className="ui-modal-shell animate-fade-in">
      <div className="ui-modal-panel max-w-lg">
        <div className="ui-modal-header">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300"><Building2 className="h-5 w-5" /></span>
            <h3 id="add-lead-title" className="text-base font-bold text-white">Добавить лид вручную</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="ui-icon-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200 shadow-sm sm:mx-6">{formError}</p>}

        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-5 text-sm sm:p-6">
          <div>
            <label htmlFor="manual-lead-name" className="ui-label">
              Название компании *
            </label>
            <input
              id="manual-lead-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Салон 'Элеганс'"
              required
              className="ui-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="manual-lead-phone" className="ui-label">
                Телефон
              </label>
              <input
                id="manual-lead-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (701) 000-00-00"
                className="ui-input"
              />
            </div>
            <div>
              <label htmlFor="manual-lead-city" className="ui-label">
                Город
              </label>
              <input
                id="manual-lead-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="ui-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="manual-lead-category" className="ui-label">
                Категория
              </label>
              <input
                id="manual-lead-category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="стоматология, автосервис..."
                className="ui-input"
              />
            </div>
            <div>
              <label htmlFor="manual-lead-website" className="ui-label">
                Веб-сайт (пусто если нет)
              </label>
              <input
                id="manual-lead-website"
                type="text"
                inputMode="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className="ui-input"
                aria-describedby={formError ? 'manual-lead-website-error' : undefined}
              />
              {formError && <p id="manual-lead-website-error" role="alert" className="mt-1.5 text-xs font-medium text-rose-700">{formError}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="manual-lead-address" className="ui-label">
              Адрес
            </label>
            <input
              id="manual-lead-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Адрес или микрорайон..."
              className="ui-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="manual-lead-rating" className="ui-label">
                Рейтинг на картах
              </label>
              <input
                id="manual-lead-rating"
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={rating}
                onChange={(e) => setRating(parseFloat(e.target.value) || 0)}
                className="ui-input"
              />
            </div>
            <div>
              <label htmlFor="manual-lead-reviews" className="ui-label">
                Отзывы
              </label>
              <input
                id="manual-lead-reviews"
                type="number"
                min="0"
                value={reviews}
                onChange={(e) => setReviews(parseInt(e.target.value, 10) || 0)}
                className="ui-input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="manual-lead-notes" className="ui-label">
              Заметки
            </label>
            <textarea
              id="manual-lead-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Комментарий или статус..."
              className="ui-input min-h-20 resize-y text-sm"
            />
          </div>

          <div className="sticky bottom-0 -mx-5 flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/95 px-5 pt-4 pb-1 backdrop-blur sm:-mx-6 sm:px-6">
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
