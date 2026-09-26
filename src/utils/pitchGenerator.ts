import { BusinessLead } from '../types';

export interface PitchTemplate {
  id: string;
  title: string;
  channel: 'whatsapp' | 'call' | 'email' | 'instagram_dm';
  text: string;
}

export function generatePitchTemplates(lead: BusinessLead): PitchTemplate[] {
  const category = lead.category || 'бизнес';
  const name = lead.name || 'Компания';
  const city = lead.city || 'города';
  const proof = lead.rating ? `Рейтинг на картах: ${lead.rating}★${lead.reviews ? `, ${lead.reviews} отзывов` : ''}.` : '';
  const websiteObservation = lead.hasWebsite ? 'В карточке компании указан сайт.' : 'В карточке компании не указан официальный сайт.';

  return [
    { id: 'whatsapp-direct', title: 'Сообщение в мессенджер', channel: 'whatsapp', text: `Здравствуйте, ${name}!

Меня зовут [Ваше имя]. Я занимаюсь веб-разработкой для компаний в сфере "${category}" в ${city}.

${proof}
${websiteObservation} Могу показать, как могла бы выглядеть понятная страница с услугами и способом связи.

Будет ли интересно посмотреть пример концепта?` },
    { id: 'call-script', title: 'Скрипт холодного звонка', channel: 'call', text: `— Добрый день! Это ${name}?
— (Ответ)
— Подскажите, пожалуйста, с кем можно поговорить по поводу сайта и онлайн-присутствия?
— (Перевод на руководителя)
— Здравствуйте! Меня зовут [Ваше имя]. Нашёл вашу компанию на картах. ${websiteObservation} Мы делаем понятные сайты для сферы "${category}" в ${city}.
— Хотел предложить показать пример структуры. В какой канал связи удобнее отправить?` },
    { id: 'instagram-dm', title: 'Сообщение в соцсети', channel: 'instagram_dm', text: `Приветствуем команду ${name}!
${proof}

${websiteObservation} Мы специализируемся на разработке мобильных сайтов для ${category}.

Можем показать пример структуры сайта для вашей компании в ${city}. Скинуть ссылку в директ?` },
    { id: 'email-pitch', title: 'Деловое коммерческое предложение', channel: 'email', text: `Тема: Предложение для ${name} (${city})

Уважаемый руководитель ${name},

Мы нашли вашу компанию в карточках организаций ${city} по направлению "${category}". ${proof}

${websiteObservation} Предлагаем обсудить, нужна ли вам отдельная страница с услугами и контактами.

Что мы предлагаем разработать:
1. Адаптивный сайт с услугами и прайсом
2. Удобные способы связи для клиентов
3. Базовую оптимизацию под локальный поиск

Готовы созвониться в удобное для вас время или выслать примеры реализованных проектов.` }
  ];
}
