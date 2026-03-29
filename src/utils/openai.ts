import OpenAI from 'openai';
import {
  initializeOpenAI as initializeRagOpenAI,
  initializePinecone,
  isElectronAvailable,
  retrieveRelevantChunks,
  setupPineconeIndex,
} from './rag';

let openaiClient: OpenAI | null = null;
const QUALITY_MODEL = 'gpt-4.1';
const FAST_MODEL = 'gpt-4.1-mini';

export const initializeOpenAI = (apiKey: string) => {
  openaiClient = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
};

export const getOpenAI = () => {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized. Please set your API key.');
  }
  return openaiClient;
};

export interface Section {
  title: string;
  summary: string;
  keyPoints: string[];
  concepts: string[];
}

export const generateSummary = async (
  apiKey: string,
  documentText: string,
  documentId?: string,
  pineconeApiKey?: string
): Promise<Section[]> => {
  return generateSummaryWithRAG(apiKey, documentText, documentId, pineconeApiKey);
};

const parseJsonArray = <T,>(raw: string, fallback: T): T => {
  try {
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean) as T;
  } catch {
    return fallback;
  }
};

export const generateSummaryWithRAG = async (
  apiKey: string,
  documentText: string,
  documentId?: string,
  pineconeApiKey?: string
): Promise<Section[]> => {
  initializeOpenAI(apiKey);
  const client = getOpenAI();

  const canUseRag = Boolean(documentId && pineconeApiKey && isElectronAvailable());
  if (canUseRag) {
    initializeRagOpenAI(apiKey);
    await initializePinecone(pineconeApiKey as string);
    await setupPineconeIndex();
  }

  const maxLength = 15000;
  const truncatedText = documentText.length > maxLength
    ? documentText.substring(0, maxLength) + '...'
    : documentText;

  const topicsResponse = await client.chat.completions.create({
    model: QUALITY_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an academic assistant.

Identify the main document topics strictly from the provided text.
- Return 4 to 8 topic titles.
- Titles must be specific and grounded in the text.
- Do not invent topics that are not present.

Respond ONLY with valid JSON in this format:
[
  { "title": "Topic 1" },
  { "title": "Topic 2" }
]`,
      },
      {
        role: 'user',
        content: `Extract topic titles from this document:\n\n${truncatedText}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 700,
  });

  const topicsRaw = topicsResponse.choices[0]?.message?.content || '[]';
  const topicItems = parseJsonArray<Array<{ title?: string }>>(topicsRaw, []);
  const topicTitles = topicItems
    .map((item) => (item.title || '').trim())
    .filter(Boolean)
    .slice(0, 8);

  const titles = topicTitles.length > 0 ? topicTitles : ['Dokumento apžvalga'];
  const sections: Section[] = [];

  for (const title of titles) {
    let groundedContext = '';

    if (canUseRag) {
      const retrievalQueries = [
        title,
        `Paaiškink temą: ${title}`,
        `${title} pagrindinės idėjos ir detalės`,
      ];

      const allChunks: Array<{ id: string; text: string }> = [];
      for (const query of retrievalQueries) {
        const retrieval = await retrieveRelevantChunks(query, documentId, 6);
        retrieval.chunks.forEach((chunk) => {
          allChunks.push({ id: chunk.id, text: chunk.text });
        });
      }

      const unique = new Map<string, string>();
      allChunks.forEach((chunk) => {
        if (chunk.text.trim() && !unique.has(chunk.id)) {
          unique.set(chunk.id, chunk.text);
        }
      });

      groundedContext = Array.from(unique.values()).join('\n\n').slice(0, 16000);
    }

    if (!groundedContext.trim()) {
      groundedContext = truncatedText;
    }

    const sectionResponse = await client.chat.completions.create({
      model: QUALITY_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a precise study assistant.

Write an extensive topic summary in Lithuanian, based ONLY on the provided context.
Rules:
- Do not invent facts.
- If some detail is missing in context, say that the context is limited.
- Produce a long-form summary of 3 to 5 paragraphs (roughly 180-320 words).
- Focus on explaining the topic clearly and accurately.

Return plain text only.`,
        },
        {
          role: 'user',
          content: `Tema: ${title}\n\nKontekstas:\n${groundedContext}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 900,
    });

    const summaryText = sectionResponse.choices[0]?.message?.content?.trim() || '';

    sections.push({
      title,
      summary: summaryText,
      keyPoints: [],
      concepts: [],
    });
  }

  return sections;
};

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  options?: string[];
  topic?: string;
}

interface GenerateFlashcardsOptions {
  count?: number;
  documentId?: string;
  pineconeApiKey?: string;
  sections?: Section[];
}

const distributeCountAcrossTopics = (topicCount: number, totalCount: number): number[] => {
  if (topicCount <= 0) return [];
  const base = Math.floor(totalCount / topicCount);
  const remainder = totalCount % topicCount;
  return Array.from({ length: topicCount }, (_, i) => base + (i < remainder ? 1 : 0));
};

const GENERIC_QUESTION_PATTERNS = [
  /pagrindin[eė]\s+tema/i,
  /kokia\s+yra\s+knygos/i,
  /apie\s+.*\s+pagrindin[eė]/i,
  /^kas\s+yra\s+šis\s+tekstas/i,
  /^what\s+is\s+the\s+main\s+topic/i,
];

const isLowQualityCard = (question: string, answer: string, topic: string): boolean => {
  const q = question.trim();
  const a = answer.trim();
  const topicNorm = topic.trim().toLowerCase();
  const qNorm = q.toLowerCase();
  const aNorm = a.toLowerCase();

  if (!q || q.length < 24) return true;
  if (GENERIC_QUESTION_PATTERNS.some((pattern) => pattern.test(q))) return true;

  // Reject cards where the question asks for "topic/theme" and answer is basically the topic title.
  const asksTheme = /tema|topic|about|apie/i.test(qNorm);
  const answerMirrorsTopic = topicNorm && (aNorm.includes(topicNorm) || topicNorm.includes(aNorm));
  if (asksTheme && answerMirrorsTopic) return true;

  return false;
};

const normalizeCard = (card: Partial<Flashcard>, topic: string, index: number): Flashcard | null => {
  const question = (card.question || '').trim();
  const answer = (card.answer || '').trim();
  const options = Array.isArray(card.options)
    ? card.options
      .map((opt) => String(opt).trim())
      .filter((opt) => opt && opt.toLowerCase() !== answer.toLowerCase())
    : [];

  if (!question || !answer || options.length < 3) {
    return null;
  }

  if (isLowQualityCard(question, answer, topic)) {
    return null;
  }

  const finalOptions = options.slice(0, 3);
  const allChoices = [answer, ...finalOptions];
  const lengths = allChoices.map((item) => item.length || 1);
  const longest = Math.max(...lengths);
  const shortest = Math.min(...lengths);

  // Avoid highly imbalanced option length, which makes correct answers obvious.
  if (shortest > 0 && longest / shortest > 2.4) {
    return null;
  }

  return {
    id: `card-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    question,
    answer,
    options: finalOptions,
    topic,
  };
};

export const generateFlashcards = async (
  apiKey: string,
  documentText: string,
  options: GenerateFlashcardsOptions = {}
): Promise<Flashcard[]> => {
  initializeOpenAI(apiKey);
  const client = getOpenAI();

  const {
    count = 24,
    documentId,
    pineconeApiKey,
    sections = [],
  } = options;

  const canUseRag = Boolean(documentId && pineconeApiKey && isElectronAvailable());
  if (canUseRag) {
    initializeRagOpenAI(apiKey);
    await initializePinecone(pineconeApiKey as string);
    await setupPineconeIndex();
  }

  const maxLength = 15000;
  const truncatedText = documentText.length > maxLength
    ? documentText.substring(0, maxLength) + '...'
    : documentText;

  const topicSeed = sections
    .map((section) => ({ title: section.title.trim(), summary: section.summary.trim() }))
    .filter((section) => section.title);

  const topicTitles = topicSeed.length > 0
    ? topicSeed.map((section) => section.title)
    : ['Pagrindinės sąvokos', 'Svarbūs faktai', 'Taikymas ir pavyzdžiai', 'Dažnos klaidos'];

  const cardsPerTopic = distributeCountAcrossTopics(
    topicTitles.length,
    Math.max(count, topicTitles.length * 4)
  );

  const uniqueByQuestion = new Map<string, Flashcard>();

  for (let i = 0; i < topicTitles.length; i += 1) {
    const topic = topicTitles[i];
    const requestedCount = Math.max(3, cardsPerTopic[i] || 3);

    let context = '';
    const sectionSummary = topicSeed.find((section) => section.title === topic)?.summary || '';

    if (canUseRag) {
      const retrievalQueries = [
        `${topic} pagrindinės sąvokos`,
        `${topic} svarbūs faktai`,
        `${topic} pavyzdžiai`,
      ];

      const chunkTexts: string[] = [];
      for (const query of retrievalQueries) {
        const retrieval = await retrieveRelevantChunks(query, documentId, 8);
        retrieval.chunks.forEach((chunk) => {
          if (chunk.text.trim()) {
            chunkTexts.push(chunk.text.trim());
          }
        });
      }

      context = Array.from(new Set(chunkTexts)).join('\n\n').slice(0, 17000);
    }

    if (!context.trim()) {
      context = `${sectionSummary}\n\n${truncatedText}`.slice(0, 17000);
    }

    const response = await client.chat.completions.create({
      model: QUALITY_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an expert study coach.

Create high-quality Lithuanian flashcards for one topic.
Rules:
- Generate EXACTLY ${requestedCount} cards.
- Stay strictly grounded in the provided context.
- Questions must be specific and non-trivial.
- For each card return: question, answer, options (exactly 3 distractors).
- Distractors must be plausible and in the same domain as the answer.
- Avoid giveaway patterns: do NOT make the correct answer consistently longest, most detailed, or only specific option.
- Keep all 4 answer choices in similar style and roughly similar length.
- Avoid generic questions like "Kokia yra pagrindinė tema?" or "Apie ką ši knyga?".
- Prefer concept understanding, comparison, cause-effect, or application questions over title/theme recall.
- Avoid "all of the above" / "none of the above".
- Keep answers and distractors concise (ideally up to ~12 words each).

Return ONLY valid JSON array in this shape:
[
  {
    "question": "...",
    "answer": "...",
    "options": ["...", "...", "..."]
  }
]`,
        },
        {
          role: 'user',
          content: `Tema: ${topic}\n\nKontekstas:\n${context}`,
        },
      ],
      temperature: 0.45,
      max_tokens: 3200,
    });

    const raw = response.choices[0]?.message?.content || '[]';
    const parsed = parseJsonArray<Array<Partial<Flashcard>>>(raw, []);

    parsed.forEach((rawCard, idx) => {
      const normalized = normalizeCard(rawCard, topic, i * 100 + idx);
      if (!normalized) return;

      const key = normalized.question.toLowerCase();
      if (!uniqueByQuestion.has(key)) {
        uniqueByQuestion.set(key, normalized);
      }
    });
  }

  return Array.from(uniqueByQuestion.values()).slice(0, count);
};

export const validateAnswer = async (
  apiKey: string,
  question: string,
  correctAnswer: string,
  userAnswer: string
): Promise<{ isCorrect: boolean; explanation: string }> => {
  initializeOpenAI(apiKey);
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: FAST_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an educator evaluating a student's answer. Compare the user's answer to the correct answer and determine if it is correct.

Consider the answer correct if:
- It captures the main concept, even if worded differently
- It includes the key information from the correct answer
- Minor spelling mistakes or variations are acceptable

Respond in JSON format:
{
  "isCorrect": true/false,
  "explanation": "Brief explanation of why the answer is correct or what was missing"
}

Be encouraging in your feedback!
Respond ONLY with valid JSON, no markdown formatting.`,
      },
      {
        role: 'user',
        content: `Question: ${question}
Correct answer: ${correctAnswer}
User's answer: ${userAnswer}

Is the user's answer correct?`,
      },
    ],
    temperature: 0.2,
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content || '{}';

  try {
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Failed to parse validation response:', content);
    return { isCorrect: false, explanation: 'Could not validate answer.' };
  }
};

export const chatWithDocument = async (
  apiKey: string,
  documentText: string,
  question: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> => {
  initializeOpenAI(apiKey);
  const client = getOpenAI();

  const maxLength = 10000;
  const truncatedText = documentText.length > maxLength
    ? documentText.substring(0, maxLength) + '...'
    : documentText;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are a helpful study assistant. You have access to the following document content and should answer questions based ONLY on this information. If the answer is not in the document, say so politely.

Be friendly, encouraging, and helpful. Explain concepts clearly and provide examples when helpful.
The person you are talking to is a girl called Neda who is studying the document for university. She is doing her best to understand the material, so be patient and supportive in your responses.

Document content:
${truncatedText}`,
    },
    ...chatHistory.slice(-10).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    {
      role: 'user' as const,
      content: question,
    },
  ];

  const response = await client.chat.completions.create({
    model: QUALITY_MODEL,
    messages,
    temperature: 0.5,
    max_tokens: 1500,
  });

  return response.choices[0]?.message?.content || 'Atsiprašau, negaliu atsakyti į šį klausimą.';
};
