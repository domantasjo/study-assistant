import OpenAI from 'openai';

interface DocumentChunk {
  id: string;
  text: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  metadata: {
    pageNumber?: number;
    section?: string;
    wordCount: number;
  };
}

interface RetrievalResult {
  chunks: DocumentChunk[];
  relevantText: string;
}

interface PineconeMatch {
  id: string;
  metadata?: {
    text?: string;
    documentId?: string;
    documentName?: string;
    chunkIndex?: number;
    wordCount?: number;
  };
}

interface PineconeQueryResponse {
  matches?: PineconeMatch[];
}

let openaiClient: OpenAI | null = null;
let pineconeReady = false;
const CHAT_MODEL = 'gpt-4.1';

const PINECONE_INDEX_NAME = 'neda';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

const getIpcRenderer = () => {
  if (typeof window === 'undefined') return null;
  const anyWindow = window as Window & { require?: (module: string) => any };
  return anyWindow.require ? anyWindow.require('electron').ipcRenderer : null;
};

export const isElectronAvailable = () => Boolean(getIpcRenderer());

const invokePinecone = async <T,>(channel: string, payload?: unknown): Promise<T> => {
  const ipcRenderer = getIpcRenderer();
  if (!ipcRenderer) {
    throw new Error('Pinecone galima naudoti tik Electron aplinkoje.');
  }
  return ipcRenderer.invoke(channel, payload);
};

export const initializePinecone = async (apiKey: string) => {
  if (!apiKey) {
    throw new Error('Pinecone API key is required');
  }
  await invokePinecone('pinecone:init', apiKey);
  pineconeReady = true;
};

export const initializeOpenAI = (apiKey: string) => {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }
  openaiClient = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
};

const ensurePineconeReady = () => {
  if (!pineconeReady) {
    throw new Error('Pinecone client not initialized. Please set your Pinecone API key.');
  }
};

export const getOpenAI = () => {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized. Please set your OpenAI API key.');
  }
  return openaiClient;
};

// Chunk text into smaller pieces
export const chunkText = (text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] => {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    
    if (end === text.length) break;
    start = end - overlap;
  }
  
  return chunks;
};

// Create embeddings for text chunks
export const createEmbeddings = async (texts: string[]): Promise<number[][]> => {
  const openai = getOpenAI();
  
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  
  return response.data.map(item => item.embedding);
};

// Store document chunks in Pinecone
export const storeDocumentChunks = async (
  documentId: string,
  documentName: string,
  documentText: string,
  onProgress?: (progress: number) => void
): Promise<void> => {
  ensurePineconeReady();
  
  // Chunk the document
  onProgress?.(10);
  const textChunks = chunkText(documentText);
  
  // Create embeddings
  onProgress?.(30);
  const embeddings = await createEmbeddings(textChunks);
  
  // Prepare vectors for upsert
  onProgress?.(70);
  const vectors = textChunks.map((chunk, i) => ({
    id: `${documentId}-chunk-${i}`,
    values: embeddings[i],
    metadata: {
      documentId,
      documentName,
      chunkIndex: i,
      text: chunk,
      wordCount: chunk.split(' ').length,
    }
  }));
  
  // Batch upsert vectors (Pinecone recommends batches of 100)
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await invokePinecone('pinecone:upsert', {
      indexName: PINECONE_INDEX_NAME,
      records: batch,
    });
  }
  
  onProgress?.(100);
};

// Retrieve relevant chunks for a query
export const retrieveRelevantChunks = async (
  query: string,
  documentId?: string,
  topK: number = 5
): Promise<RetrievalResult> => {
  if (!pineconeReady) return { chunks: [], relevantText: '' };
  
  // Create embedding for the query
  const queryEmbedding = await createEmbeddings([query]);
  
  // Build filter if specific document requested
  const filter = documentId ? { documentId: { $eq: documentId } } : {};
  
  // Search for similar chunks
  const searchResponse = await invokePinecone<PineconeQueryResponse>('pinecone:query', {
    indexName: PINECONE_INDEX_NAME,
    vector: queryEmbedding[0],
    topK,
    filter,
  });
  
  // Extract and format results
  const chunks: DocumentChunk[] = searchResponse.matches?.map((match, index) => ({
    id: match.id,
    text: match.metadata?.text as string || '',
    documentId: match.metadata?.documentId as string || '',
    documentName: match.metadata?.documentName as string || '',
    chunkIndex: match.metadata?.chunkIndex as number || index,
    metadata: {
      wordCount: match.metadata?.wordCount as number || 0,
    }
  })) || [];
  
  // Combine relevant text
  const relevantText = chunks.map(chunk => chunk.text).join('\n\n');
  
  return { chunks, relevantText };
};

const scoreChunkAgainstQuery = (query: string, chunk: string): number => {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2);

  const queryTokens = normalize(query);
  const chunkTokens = normalize(chunk);
  if (queryTokens.length === 0 || chunkTokens.length === 0) return 0;

  const chunkSet = new Set(chunkTokens);
  let matches = 0;
  queryTokens.forEach((token) => {
    if (chunkSet.has(token)) matches += 1;
  });

  return matches / queryTokens.length;
};

const fallbackRetrieveFromDocumentText = (
  query: string,
  documentId: string,
  documentText: string,
  topK: number = 5
): RetrievalResult => {
  const rawChunks = chunkText(documentText, 1100, 180);

  const scored = rawChunks
    .map((text, index) => ({ text, index, score: scoreChunkAgainstQuery(query, text) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const chunks: DocumentChunk[] = scored.map((item) => ({
    id: `${documentId}-local-${item.index}`,
    text: item.text,
    documentId,
    documentName: '',
    chunkIndex: item.index,
    metadata: {
      wordCount: item.text.split(/\s+/).filter(Boolean).length,
    },
  }));

  return {
    chunks,
    relevantText: chunks.map((chunk) => chunk.text).join('\n\n'),
  };
};

// Delete document chunks from Pinecone
export const deleteDocumentChunks = async (documentId: string): Promise<void> => {
  ensurePineconeReady();
  await invokePinecone('pinecone:deleteMany', {
    indexName: PINECONE_INDEX_NAME,
    filter: { documentId: { $eq: documentId } }
  });
};

// Chat with RAG-enhanced context
export const chatWithRAG = async (
  query: string,
  documentId: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  documentText?: string
): Promise<string> => {
  const openai = getOpenAI();

  // 1) Prefer document-scoped vector retrieval.
  let retrieval = await retrieveRelevantChunks(query, documentId, 6);

  // 2) Retry without filter to recover from stale/missing metadata filters.
  if (!retrieval.relevantText.trim()) {
    retrieval = await retrieveRelevantChunks(query, undefined, 6);
  }

  // 3) Fallback to local lexical retrieval from current document text.
  if (!retrieval.relevantText.trim() && documentText) {
    retrieval = fallbackRetrieveFromDocumentText(query, documentId, documentText, 6);
  }

  const { relevantText } = retrieval;
  
  if (!relevantText.trim()) {
    return 'Atsiprašau, nepavyko rasti atitinkamos informacijos dokumente.';
  }
  
  // Build conversation context
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are a helpful study assistant. Answer questions based ONLY on the following relevant context from the document. If the answer is not in the provided context, say so politely. Be friendly, encouraging, and helpful.

Relevant context from the document:
${relevantText}

Guidelines:
- Answer in Lithuanian if the question is in Lithuanian
- Be concise but thorough
- Provide examples when helpful 
- If information is not in the context, acknowledge that explicitly`
    },
    ...chatHistory.slice(-8).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    {
      role: 'user' as const,
      content: query
    }
  ];
  
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 1000,
  });
  
  return response.choices[0]?.message?.content || 'Atsiprašau, negaliu atsakyti į šį klausimą.';
};

// Check if Pinecone index exists and create if needed
export const setupPineconeIndex = async (): Promise<void> => {
  ensurePineconeReady();
  await invokePinecone('pinecone:setup-index', {
    indexName: PINECONE_INDEX_NAME,
    dimension: EMBEDDING_DIMENSION,
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: 'aws',
        region: 'us-east-1'
      }
    }
  });
};