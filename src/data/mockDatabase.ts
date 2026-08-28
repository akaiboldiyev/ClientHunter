import { BusinessLead, SearchQuery } from '../types';

export const POPULAR_CITIES = [
  'Актау',
  'Алматы',
  'Астана',
  'Шымкент',
  'Караганда',
  'Актобе',
  'Ташкент',
  'Бишкек',
  'Москва',
  'Санкт-Петербург',
  'Dubai',
  'New York',
  'London'
];

export const POPULAR_CATEGORIES = [
  'стоматология',
  'автосервис',
  'салон красоты',
  'ресторан',
  'ремонт квартир',
  'юристы',
  'фитнес клуб',
  'косметология',
  'кондитерская',
  'нотариус',
  'клининг',
  'детский центр',
  'медицинский центр',
  'барбершоп'
];

export const INITIAL_LEADS: BusinessLead[] = [
  {
    id: 'lead-1',
    name: 'Стоматология "Дент-Люкс"',
    phone: '+7 7292 51-40-20',
    address: 'г. Актау, 14-й микрорайон, д. 34',
    website: '',
    rating: 4.8,
    reviews: 42,
    maps_url: 'https://maps.google.com/?cid=12345678910',
    city: 'Актау',
    category: 'стоматология',
    source: 'google_maps',
    scrapedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    hasWebsite: false,
    leadQuality: 'hot',
    status: 'new',
    notes: 'Высокий рейтинг, 42 отзыва, но сайта нет вообще! Отличный кандидат на лендинг с онлайн-записью.'
  },
  {
    id: 'lead-2',
    name: 'Автокомплекс "Master Auto"',
    phone: '+7 701 555 89 12',
    address: 'г. Актау, Промзона 3, стр. 12',
    website: '',
    rating: 4.6,
    reviews: 28,
    maps_url: 'https://maps.google.com/?cid=12345678911',
    city: 'Актау',
    category: 'автосервис',
    source: 'google_maps',
    scrapedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    hasWebsite: false,
    leadQuality: 'hot',
    status: 'contacted',
    notes: 'Позвонили 28 авг. Менеджер попросил выслать КП в WhatsApp.'
  },
  {
    id: 'lead-3',
    name: 'Студия красоты "Aura Beauty"',
    phone: '+7 777 234 11 99',
    address: 'г. Актау, 7-й микрорайон, д. 19/1',
    website: '',
    rating: 4.9,
    reviews: 86,
    maps_url: 'https://maps.google.com/?cid=12345678912',
    city: 'Актау',
    category: 'салон красоты',
    source: '2gis',
    scrapedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    hasWebsite: false,
    leadQuality: 'hot',
    status: 'meeting',
    notes: 'Назначена встреча на пятницу 15:00. Хотят онлайн-бронирование мастеров и каталог услуг.'
  },
  {
    id: 'lead-4',
    name: 'Центр ремонта "МастерОк"',
    phone: '+7 7292 42-10-88',
    address: 'г. Актау, 28-й микрорайон, 18',
    website: '',
    rating: 4.4,
    reviews: 19,
    maps_url: 'https://maps.google.com/?cid=12345678913',
    city: 'Актау',
    category: 'ремонт квартир',
    source: 'google_maps',
    scrapedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    hasWebsite: false,
    leadQuality: 'warm',
    status: 'new',
    notes: 'Нужен калькулятор сметы и галерея выполненных объектов.'
  },
  {
    id: 'lead-5',
    name: 'Ресторан "Каспийский Бриз"',
    phone: '+7 7292 30-15-15',
    address: 'г. Актау, Набережная 1-й микрорайон',
    website: 'https://caspianbreeze.example.kz',
    rating: 4.7,
    reviews: 140,
    maps_url: 'https://maps.google.com/?cid=12345678914',
    city: 'Актау',
    category: 'ресторан',
    source: 'google_maps',
    scrapedAt: new Date(Date.now() - 3600000 * 7).toISOString(),
    hasWebsite: true,
    leadQuality: 'cold',
    status: 'new',
    notes: 'Сайт уже есть, но устаревший.'
  },
  {
    id: 'lead-6',
    name: 'Адвокатский кабинет Садыкова',
    phone: '+7 702 444 19 80',
    address: 'г. Актау, 11-й микрорайон, БЦ "Орда", оф. 402',
    website: '',
    rating: 5.0,
    reviews: 15,
    maps_url: 'https://maps.google.com/?cid=12345678915',
    city: 'Актау',
    category: 'юристы',
    source: 'google_maps',
    scrapedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    hasWebsite: false,
    leadQuality: 'hot',
    status: 'negotiation',
    notes: 'Согласны на сайт-визитку с формой консультации. Ждем согласования договора.'
  },
  {
    id: 'lead-7',
    name: 'Фитнес-клуб "Iron Body"',
    phone: '+7 775 889 00 22',
    address: 'г. Актау, 17-й микрорайон, ТРК "Хазар"',
    website: '',
    rating: 4.5,
    reviews: 64,
    maps_url: 'https://maps.google.com/?cid=12345678916',
    city: 'Актау',
    category: 'фитнес клуб',
    source: 'google_maps',
    scrapedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    hasWebsite: false,
    leadQuality: 'hot',
    status: 'new',
    notes: 'Инстаграм активный, но сайта нет. Теряют заявки на абонементы.'
  }
];

export function generateScrapedLeads(query: SearchQuery): BusinessLead[] {
  const city = query.city.trim() || 'Актау';
  const category = query.category.trim() || 'бизнес';
  
  const count = query.limit || 15;
  const leads: BusinessLead[] = [];

  const nameTemplates = [
    `${capitalize(category)} "Элит"`,
    `${capitalize(category)} "${city} Про"`,
    `Центр "${capitalize(category)}"`,
    `Студия "${city} Prime"`,
    `Сервис "${capitalize(category)} Экспресс"`,
    `${capitalize(category)} "Престиж"`,
    `Мастерская "${capitalize(category)} 24/7"`,
    `${capitalize(category)} "Авангард"`,
    `Дом ${category} "${city}"`,
    `Компания "${capitalize(category)} Плюс"`,
    `VIP ${capitalize(category)}`,
    `${capitalize(category)} "Гарант"`,
    `Профессиональный ${category} "${city}"`,
    `${capitalize(category)} "Комфорт"`,
    `Первая ${category} "${city}"`
  ];

  const streets = [
    'пр-т Азаттык',
    'ул. Достык',
    'микрорайон 12',
    'ул. Сарыарка',
    'микрорайон 26',
    'пр-т Назарбаева',
    'ул. Кабанбай батыра',
    'микрорайон 14',
    'ул. Абая',
    'микрорайон 4',
    'ул. Толе би',
    'ул. Гоголя'
  ];

  for (let i = 0; i < count; i++) {
    const hasWebsite = query.onlyWithoutWebsite ? false : Math.random() < 0.25;
    const baseName = nameTemplates[i % nameTemplates.length];
    const suffix = i >= nameTemplates.length ? ` #${Math.floor(i / nameTemplates.length) + 1}` : '';
    const name = `${baseName}${suffix}`;
    
    const street = streets[i % streets.length];
    const bld = Math.floor(Math.random() * 80) + 1;
    const address = `г. ${city}, ${street}, д. ${bld}`;
    
    const phonePrefix = '+7 (7' + (Math.floor(Math.random() * 80) + 10) + ') ';
    const phoneBody = `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 90) + 10}`;
    const phone = phonePrefix + phoneBody;

    const rating = Number((3.8 + Math.random() * 1.2).toFixed(1));
    const reviews = Math.floor(Math.random() * 90) + 5;
    const website = hasWebsite ? `https://${slugify(name)}.kz` : '';
    
    let leadQuality: 'hot' | 'warm' | 'cold' = 'warm';
    if (!hasWebsite && reviews > 20 && rating >= 4.5) {
      leadQuality = 'hot';
    } else if (!hasWebsite) {
      leadQuality = 'warm';
    } else {
      leadQuality = 'cold';
    }

    leads.push({
      id: `scraped-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      phone,
      address,
      website,
      rating,
      reviews,
      maps_url: `https://www.google.com/maps/search/${encodeURIComponent(name + ' ' + city)}`,
      city,
      category,
      source: query.source === '2gis' ? '2gis' : 'google_maps',
      scrapedAt: new Date().toISOString(),
      hasWebsite,
      leadQuality,
      status: 'new',
      notes: !hasWebsite 
        ? `Найдено через парсинг ${query.source === '2gis' ? '2GIS' : 'Google Maps'}. Сайта нет, рейтинг ${rating} (${reviews} отзывов).`
        : `Имеется действующий веб-сайт.`
    });
  }

  return leads;
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'business';
}
