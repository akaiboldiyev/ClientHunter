import { BusinessLead } from '../types';

export const FOLLOW_UP_DAYS = [2, 5, 9, 14, 44] as const;

const FOLLOW_UP_MESSAGES = [
  (lead: BusinessLead) => `Здравствуйте! Если удобнее, могу записать короткое видео с разбором идеи сайта для «${lead.name}». Показать?`,
  (lead: BusinessLead) => `Здравствуйте! Если идея сайта для «${lead.name}» ещё актуальна, могу подготовить и показать мини-превью первого экрана. Хотите посмотреть?`,
  () => 'Здравствуйте! Подскажите, пожалуйста: идея сайта пока неактуальна или вы ещё рассматриваете её? Любой ответ подойдёт — не хочу отвлекать лишними сообщениями.',
  () => 'Здравствуйте! Закрою пока этот диалог, чтобы не отвлекать. Если захотите вернуться к идее сайта, просто напишите — буду рад помочь.',
  (lead: BusinessLead) => `Здравствуйте! Возвращаюсь с новым поводом по «${lead.name}»: [добавьте актуальный проект, пример или новую идею перед отправкой]. Если вам интересно, могу показать.`
];

export function getFollowUpMessage(lead: BusinessLead, step = lead.followUpStep ?? 0): string {
  const createMessage = FOLLOW_UP_MESSAGES[step];
  return createMessage ? createMessage(lead) : '';
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function nextFollowUpDueAt(now: string, sentStep: number): string | undefined {
  const nextStep = sentStep + 1;
  if (nextStep >= FOLLOW_UP_DAYS.length) return undefined;
  return addDays(now, FOLLOW_UP_DAYS[nextStep] - FOLLOW_UP_DAYS[sentStep]);
}
