import { BusinessLead, OpportunityAnalysis } from '../types';

/**
 * Calculates priority score (0-100) and structured opportunity analysis based strictly
 * on verified facts in the database without inventing flaws or fake data.
 */
export function analyzeLeadOpportunity(lead: BusinessLead): OpportunityAnalysis {
  let score = 30; // base baseline for any business contact
  const whySelected: string[] = [];
  const dataQualityNotes: string[] = [];

  // Fact 1: Website presence
  if (!lead.hasWebsite) {
    score += 35;
    whySelected.push('В карточке 2GIS подтверждено отсутствие официального сайта.');
  } else {
    dataQualityNotes.push(`Сайт уже указан: ${lead.website}`);
  }

  // Fact 2: WhatsApp readiness
  if (lead.whatsappStatus === 'available') {
    score += 20;
    whySelected.push('Подтверждённый прямой канал WhatsApp на мобильном номере.');
  } else if (lead.phones?.some((p) => p.type === 'mobile')) {
    score += 10;
    whySelected.push('Есть мобильный телефон, доступность WhatsApp требует проверки.');
  } else {
    dataQualityNotes.push('Только городской номер или тип телефона не определён.');
  }

  // Fact 3: Customer demand & 2GIS visibility
  const reviews = Number(lead.reviews || 0);
  const rating = Number(lead.rating || 0);

  if (reviews >= 10 && rating >= 4.0) {
    score += 15;
    whySelected.push(`Высокий поисковый интерес в 2GIS: ${reviews} отзывов, оценка ${rating}★.`);
  } else if (reviews > 0) {
    score += 5;
    whySelected.push(`Присутствует на картах: ${reviews} отзывов.`);
  } else {
    dataQualityNotes.push('Мало отзывов на картах для оценки пользовательского спроса.');
  }

  // Normalize score
  const finalScore = Math.min(100, Math.max(10, score));
  const priorityLevel: 'high' | 'medium' | 'low' =
    finalScore >= 75 ? 'high' : finalScore >= 50 ? 'medium' : 'low';

  // Realistic problem hypothesis without false claims
  let potentialProblem = '';
  if (!lead.hasWebsite) {
    potentialProblem = `Клиенты находят компанию «${lead.name}» в поиске 2GIS, но не могут быстро изучить перечень услуг, цены или оставить онлайн-заявку без звонка.`;
  } else {
    potentialProblem = `Компания уже имеет сайт, требуется проверить его мобильную адаптивность и удобство связи.`;
  }

  // Realistic recommended offer
  let recommendedPitchType = '';
  if (!lead.hasWebsite) {
    recommendedPitchType = 'Лаконичный сайт-визитка с мобильной адаптацией, структурой услуг и прямой кнопкой связи в WhatsApp.';
  } else {
    recommendedPitchType = 'Аудит конверсии текущего сайта или настройка посадочной страницы под конкретную услугу.';
  }

  // Honest, brief, realistic draft message (NO fake flattery, NO invented sender name, NO guarantees)
  const name = lead.name || 'Коллеги';
  const city = lead.city ? ` в г. ${lead.city}` : '';
  const category = lead.category ? ` по направлению «${lead.category}»` : '';

  let draftMessage = '';
  if (!lead.hasWebsite) {
    draftMessage = `Здравствуйте! Пишу по поводу компании «${name}»${city}.
Обратил внимание, что в 2GIS у вас активная карточка${category}, но официальный сайт не указан.
Я занимаюсь разработкой аккуратных сайтов-визиток для локального бизнеса — чтобы клиентам было удобно смотреть услуги, цены и сразу писать вам в WhatsApp.
Могу подготовить для вас краткий черновой концепт страницы. Будет интересно взглянуть?`;
  } else {
    draftMessage = `Здравствуйте! Пишу по поводу компании «${name}»${city}.
Увидел вашу карточку в 2GIS. Занимаюсь веб-разработкой и оптимизацией сайтов для удобства клиентов.
Хотел уточнить, актуальна ли для вас сейчас модернизация сайта или настройка удобной формы заявок в WhatsApp?`;
  }

  return {
    priorityScore: finalScore,
    priorityLevel,
    whySelected: whySelected.length > 0 ? whySelected : ['Контакт получен из проверенной базы 2GIS.'],
    potentialProblem,
    recommendedPitchType,
    draftMessage: (lead.customPitch && lead.customPitch.trim()) ? lead.customPitch.trim() : draftMessage.trim(),
    dataQualityNotes: dataQualityNotes.length > 0 ? dataQualityNotes : undefined
  };
}

/**
 * Filter leads by segmentation criteria
 */
export interface LeadSegmentCriteria {
  city?: string;
  category?: string;
  onlyWithoutWebsite?: boolean;
  whatsappOnly?: boolean;
  minRating?: number;
  priorityLevel?: 'all' | 'high' | 'medium' | 'low';
}

export function filterLeadsBySegment(leads: BusinessLead[], criteria: LeadSegmentCriteria): BusinessLead[] {
  return leads.filter((lead) => {
    if (criteria.city && criteria.city !== 'all') {
      if (!lead.city || lead.city.toLowerCase() !== criteria.city.toLowerCase()) return false;
    }
    if (criteria.category && criteria.category !== 'all') {
      if (!lead.category || !lead.category.toLowerCase().includes(criteria.category.toLowerCase())) return false;
    }
    if (criteria.onlyWithoutWebsite && lead.hasWebsite) {
      return false;
    }
    if (criteria.whatsappOnly && lead.whatsappStatus !== 'available') {
      return false;
    }
    if (criteria.minRating && lead.rating < criteria.minRating) {
      return false;
    }
    if (criteria.priorityLevel && criteria.priorityLevel !== 'all') {
      const analysis = analyzeLeadOpportunity(lead);
      if (analysis.priorityLevel !== criteria.priorityLevel) return false;
    }
    return true;
  });
}
