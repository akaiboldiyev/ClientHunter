import { listLeads } from './persistence.js';

export async function getOllamaHost(): Promise<string> {
  const hosts = [process.env.OLLAMA_HOST, 'http://127.0.0.1:11434', 'http://localhost:11434'].filter(Boolean) as string[];
  for (const host of hosts) {
    try {
      const check = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(1500) });
      if (check.ok) return host;
    } catch {
      // try next
    }
  }
  return 'http://127.0.0.1:11434';
}

export async function listOllamaModels(host: string): Promise<string[]> {
  const response = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`Ollama вернул код ${response.status}`);
  const data: any = await response.json();
  return (data.models || []).map((m: any) => String(m.name || m.model || '')).filter(Boolean);
}

export function pickOllamaModel(models: string[]): string | undefined {
  return models.find((name) => name.includes('qwen3:14b'))
    || models.find((name) => /qwen3/i.test(name))
    || models.find((name) => /qwen/i.test(name))
    || models[0];
}

export async function resolveOllamaModel(host?: string): Promise<{ host: string; model: string; models: string[] }> {
  const resolvedHost = host || await getOllamaHost();
  const models = await listOllamaModels(resolvedHost);
  const model = pickOllamaModel(models);
  if (!model) throw new Error('На Ollama не установлено ни одной локальной модели.');
  return { host: resolvedHost, model, models };
}

export type JarvisAnalysis = {
  category: string;
  intent: string;
  keyPoints: string;
  recommendedAction: string;
  proposedReply: string;
  status: 'interested' | 'discussing_terms' | 'refused' | 'needs_reply' | 'completed' | 'awaiting_reply';
  isRefusal: boolean;
  needsHuman: boolean;
};

const SYSTEM_PROMPT = `Ты — Джарвис, профессиональный локальный B2B переговорщик. Ты отвечаешь клиентам в WhatsApp от лица менеджера, который предлагает веб-разработку и маркетинг.

ЖЁСТКИЕ ПРАВИЛА:
1. Отвечай на языке клиента. Пиши кратко, естественно, профессионально — как живой человек в деловой переписке. 1–4 предложения.
2. Не выдумывай факты: выполненные проекты, кейсы, характеристики бизнеса клиента, договор, гарантии, скидки и обещания. Используй только подтверждённые сведения из истории и контекста владельца.
2а. Описывай услуги только словами, прямо подтверждёнными первоначальным предложением в истории. Не перечисляй SEO, рекламу, продвижение, дизайн или другие услуги, если их нет в предложении. Если клиент спрашивает о составе, задай уточняющий вопрос или попроси менеджера ответить.
3. Если клиент заинтересован — уточни потребность и предложи следующий логичный шаг: обсудить задачу или показать концепт, только если он действительно подготовлен/есть ссылка в истории. Без давления и ложной срочности.
4. Владелец подтвердил такие цены и условия: полный сайт с анимациями, заявками в WhatsApp и подключением к Google — 180 000 ₸; одностраничный сайт под ключ — 90 000 ₸; простая сайт-визитка — 45 000 ₸; предоплата 50%, остаток после запуска. Если спрашивают цену или предоплату, можешь назвать только эти условия и предложить выбрать подходящий вариант. Не обещай неописанные функции для среднего/базового тарифа, сроки, скидки или иные условия. Если вопрос требует конкретики, которой нет в контексте, needsHuman=true.
4а. Не утверждай, что Instagram не приводит клиентов из Google, что у бизнеса есть конкретные проблемы/результаты, или что уже подготовлено превью, если это не подтверждено. Не выдумывай примеры проектов и дефицит («последнее место»).
5. Если отказ или просьба больше не писать — isRefusal=true, status="refused", proposedReply пустой, needsHuman=false.
6. Если сообщение неоднозначное, рискованное или требует решения человека — needsHuman=true, не предлагай обещаний. Любой текст — только черновик для проверки человеком, не отправляй сам.
7. Не повторяй одно и то же, не манипулируй.

Верни СТРОГО валидный JSON без markdown:
{
  "category": "проявил интерес" | "запросил цену" | "запросил примеры работ" | "попросил объяснить предложение" | "сомневается" | "попросил связаться позже" | "отказался" | "сообщение неясное" | "требуется вмешательство человека",
  "intent": "краткое описание намерения клиента",
  "keyPoints": "вопросы, потребности или возражения",
  "recommendedAction": "следующий шаг для менеджера",
  "proposedReply": "готовый краткий текст ответа либо пустая строка если отвечать нельзя",
  "status": "interested" | "discussing_terms" | "refused" | "needs_reply" | "completed" | "awaiting_reply",
  "isRefusal": false,
  "needsHuman": false
}`;

export async function analyzeClientMessage(params: {
  leadId?: string;
  clientMessage: string;
  context?: string;
}): Promise<JarvisAnalysis> {
  const { host, model } = await resolveOllamaModel();
  const lead = params.leadId ? listLeads().find((item) => item.id === params.leadId) : null;
  const history = Array.isArray(lead?.conversationHistory) ? lead.conversationHistory : [];
  const recentHistory = history.slice(-12);
  const lastHistoryMessage = recentHistory[recentHistory.length - 1];
  if (lastHistoryMessage?.sender === 'client' && lastHistoryMessage.text?.trim() === params.clientMessage.trim()) {
    recentHistory.pop();
  }
  const historyText = recentHistory.map((msg: any) => {
    const who = msg.sender === 'client' ? 'Клиент' : msg.sender === 'jarvis' ? 'Jarvis' : 'Менеджер';
    return `${who}: ${msg.text}`;
  }).join('\n');

  const companyContext = lead
    ? `Компания: "${lead.name}", Сфера: "${lead.category}", Город: "${lead.city || 'Актау'}", Рейтинг: ${lead.rating || 0}★, Сайт: ${lead.hasWebsite ? 'есть' : 'нет'}.
Первоначальное предложение: "${lead.customPitch || 'не указано'}".
История переписки:
${historyText || 'пока только первоначальное предложение'}`
    : 'Контекст: Веб-разработка и маркетинг для B2B клиентов.';

  const userPrompt = `${companyContext}
Дополнительный контекст: ${params.context || 'нет'}
Новое сообщение от клиента:
"${params.clientMessage.trim()}"`;

  const response = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    }),
    signal: AbortSignal.timeout(60_000)
  });

  if (!response.ok) {
    throw new Error(`Ollama вернула статус ${response.status} (модель ${model})`);
  }

  const data: any = await response.json();
  const rawContent = data.message?.content || '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    const cleaned = rawContent.replace(/```(?:json)?/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  const isRefusal = Boolean(parsed.isRefusal || parsed.category === 'отказался' || parsed.status === 'refused');
  const needsHuman = Boolean(parsed.needsHuman) && !isRefusal;
  const status = (['interested', 'discussing_terms', 'refused', 'needs_reply', 'completed', 'awaiting_reply'].includes(parsed.status)
    ? parsed.status
    : (isRefusal ? 'refused' : 'needs_reply')) as JarvisAnalysis['status'];

  return {
    category: parsed.category || 'сообщение неясное',
    intent: parsed.intent || 'Ответ клиента в мессенджере',
    keyPoints: parsed.keyPoints || 'Вопрос или реакция клиента',
    recommendedAction: parsed.recommendedAction || 'Проверить сообщение и отправить ответ',
    proposedReply: String(parsed.proposedReply || '').trim(),
    status: isRefusal ? 'refused' : status,
    isRefusal,
    needsHuman: needsHuman || (!isRefusal && !String(parsed.proposedReply || '').trim())
  };
}
