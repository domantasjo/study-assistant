import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer ?? null;

interface Document {
  id: string;
  name: string;
  text: string;
  pageCount: number;
  uploadedAt: Date;
  hasEmbeddings?: boolean;
  embeddingProgress?: number;
}

interface Section {
  title: string;
  summary: string;
  keyPoints: string[];
  concepts: string[];
}

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  options?: string[];
  topic?: string;
  learned: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AppState {
  documents: Document[];
  currentDocument: Document | null;
  sections: Section[];
  flashcards: Flashcard[];
  chatHistory: ChatMessage[];
  apiKey: string;
  pineconeApiKey: string;
  isProcessing: boolean;
  breakReminderShown: boolean;
  sessionStartTime: Date | null;
  showSettings: boolean;
}

interface AppContextType extends AppState {
  setCurrentDocument: (doc: Document | null) => void;
  addDocument: (doc: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  setSections: (sections: Section[]) => void;
  setFlashcards: (cards: Flashcard[]) => void;
  updateFlashcard: (id: string, updates: Partial<Flashcard>) => void;
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChatHistory: () => void;
  setApiKey: (key: string) => void;
  setPineconeApiKey: (key: string) => void;
  setIsProcessing: (processing: boolean) => void;
  setBreakReminderShown: (shown: boolean) => void;
  setShowSettings: (shown: boolean) => void;
  startSession: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [state, setState] = useState<AppState>({
    documents: [],
    currentDocument: null,
    sections: [],
    flashcards: [],
    chatHistory: [],
    apiKey: '',
    pineconeApiKey: '',
    isProcessing: false,
    breakReminderShown: false,
    sessionStartTime: null,
    showSettings: false,
  });

  // Load saved data on mount
  useEffect(() => {
    const savedDocuments = localStorage.getItem('neda-documents');
    const savedBreakReminder = localStorage.getItem('neda-break-reminder-shown');

    if (savedDocuments) {
      try {
        const docs = JSON.parse(savedDocuments);
        setState(prev => ({ ...prev, documents: docs }));
      } catch (e) {
        console.error('Failed to parse saved documents');
      }
    }
    if (savedBreakReminder) {
      setState(prev => ({ ...prev, breakReminderShown: true }));
    }

    // Load API keys securely from Electron main process
    if (ipcRenderer) {
      ipcRenderer.invoke('keys:get').then((keys: { openaiKey: string; pineconeKey: string }) => {
        // Migrate from old localStorage storage if keys.json is empty
        const legacyOpenAI = localStorage.getItem('neda-openai-key') || '';
        const legacyPinecone = localStorage.getItem('neda-pinecone-key') || '';
        const openaiKey = keys.openaiKey || legacyOpenAI;
        const pineconeKey = keys.pineconeKey || legacyPinecone;
        setState(prev => ({ ...prev, apiKey: openaiKey, pineconeApiKey: pineconeKey }));
        setKeysLoaded(true);
      });
    } else {
      // Non-Electron environment (dev browser preview) — use env vars or localStorage
      const legacyOpenAI = localStorage.getItem('neda-openai-key') || import.meta.env.VITE_OPENAI_API_KEY || '';
      const legacyPinecone = localStorage.getItem('neda-pinecone-key') || import.meta.env.VITE_PINECONE_API_KEY || '';
      setState(prev => ({ ...prev, apiKey: legacyOpenAI, pineconeApiKey: legacyPinecone }));
      setKeysLoaded(true);
    }
  }, []);

  // Save documents when they change
  useEffect(() => {
    if (state.documents.length > 0) {
      localStorage.setItem('neda-documents', JSON.stringify(state.documents));
    }
  }, [state.documents]);

  useEffect(() => {
    if (!state.currentDocument) return;
    localStorage.setItem(
      `neda-sections-${state.currentDocument.id}`,
      JSON.stringify(state.sections)
    );
  }, [state.sections, state.currentDocument?.id]);

  useEffect(() => {
    if (!state.currentDocument) return;
    localStorage.setItem(
      `neda-flashcards-${state.currentDocument.id}`,
      JSON.stringify(state.flashcards)
    );
  }, [state.flashcards, state.currentDocument?.id]);

  useEffect(() => {
    if (!state.currentDocument) return;
    localStorage.setItem(
      `neda-chat-${state.currentDocument.id}`,
      JSON.stringify(state.chatHistory)
    );
  }, [state.chatHistory, state.currentDocument?.id]);

  useEffect(() => {
    if (!keysLoaded) return;
    if (ipcRenderer) {
      ipcRenderer.invoke('keys:set', {
        openaiKey: state.apiKey,
        pineconeKey: state.pineconeApiKey,
      });
    }
  }, [state.apiKey, state.pineconeApiKey, keysLoaded]);

  const setCurrentDocument = (doc: Document | null) => {
    if (!doc) {
      setState(prev => ({ ...prev, currentDocument: null, sections: [], flashcards: [], chatHistory: [] }));
      return;
    }

    const safeParse = <T,>(value: string | null, fallback: T): T => {
      if (!value) return fallback;
      try {
        return JSON.parse(value) as T;
      } catch (error) {
        console.error('Failed to parse stored data', error);
        return fallback;
      }
    };

    const storedSections = safeParse<Section[]>(
      localStorage.getItem(`neda-sections-${doc.id}`),
      []
    );
    const storedFlashcards = safeParse<Flashcard[]>(
      localStorage.getItem(`neda-flashcards-${doc.id}`),
      []
    );
    const storedChat = safeParse<ChatMessage[]>(
      localStorage.getItem(`neda-chat-${doc.id}`),
      []
    );

    setState(prev => ({
      ...prev,
      currentDocument: doc,
      sections: storedSections,
      flashcards: storedFlashcards,
      chatHistory: storedChat
    }));
  };

  const addDocument = (doc: Document) => {
    setState(prev => ({ 
      ...prev, 
      documents: [...prev.documents, doc],
      currentDocument: doc 
    }));
  };

  const updateDocument = (id: string, updates: Partial<Document>) => {
    setState(prev => ({
      ...prev,
      documents: prev.documents.map(doc => 
        doc.id === id ? { ...doc, ...updates } : doc
      ),
      currentDocument: prev.currentDocument?.id === id 
        ? { ...prev.currentDocument, ...updates } 
        : prev.currentDocument
    }));
  };

  const setSections = (sections: Section[]) => {
    setState(prev => ({ ...prev, sections }));
  };

  const setFlashcards = (cards: Flashcard[]) => {
    setState(prev => ({ ...prev, flashcards: cards }));
  };

  const updateFlashcard = (id: string, updates: Partial<Flashcard>) => {
    setState(prev => ({
      ...prev,
      flashcards: prev.flashcards.map(card =>
        card.id === id ? { ...card, ...updates } : card
      ),
    }));
  };

  const addChatMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    setState(prev => ({
      ...prev,
      chatHistory: [...prev.chatHistory, newMessage],
    }));
  };

  const clearChatHistory = () => {
    setState(prev => ({ ...prev, chatHistory: [] }));
  };

  const setApiKey = (key: string) => {
    setState(prev => ({ ...prev, apiKey: key }));
  };

  const setPineconeApiKey = (key: string) => {
    setState(prev => ({ ...prev, pineconeApiKey: key }));
  };

  const setIsProcessing = (processing: boolean) => {
    setState(prev => ({ ...prev, isProcessing: processing }));
  };

  const setBreakReminderShown = (shown: boolean) => {
    setState(prev => ({ ...prev, breakReminderShown: shown }));
    if (shown) {
      localStorage.setItem('neda-break-reminder-shown', 'true');
    }
  };

  const setShowSettings = (shown: boolean) => {
    setState(prev => ({ ...prev, showSettings: shown }));
  };

  const startSession = () => {
    setState(prev => ({ ...prev, sessionStartTime: new Date() }));
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        setCurrentDocument,
        addDocument,
        updateDocument,
        setSections,
        setFlashcards,
        updateFlashcard,
        addChatMessage,
        clearChatHistory,
        setApiKey,
        setPineconeApiKey,
        setIsProcessing,
        setBreakReminderShown,
        setShowSettings,
        startSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
