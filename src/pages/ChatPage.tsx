import React, { useState, useRef, useEffect, CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  MessageCircle, 
  Send, 
  Loader2, 
  Trash2, 
  User,
  Sparkles,
  Heart
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { chatWithRAG, initializeOpenAI, initializePinecone, isElectronAvailable } from '../utils/rag';

const ChatPage: React.FC = () => {
  const { 
    currentDocument, 
    chatHistory, 
    addChatMessage, 
    clearChatHistory,
    apiKey,
    pineconeApiKey
  } = useApp();
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const bubblePadding: CSSProperties = {
    paddingInline: '28px',
    paddingBlock: '22px',
  };

  const renderMarkdown = (content: string, role: 'user' | 'assistant') => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0 whitespace-pre-wrap wrap-anywhere leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={role === 'user' ? 'underline text-pink-100' : 'underline text-pink-600'}
          >
            {children}
          </a>
        ),
        code: ({ className, children }) => {
          const isCodeBlock = Boolean(className?.includes('language-'));
          if (isCodeBlock) {
            return (
              <code className="block w-full whitespace-pre-wrap wrap-anywhere rounded-lg bg-black/20 px-3 py-2 text-sm">
                {children}
              </code>
            );
          }

          return (
            <code className={role === 'user' ? 'rounded bg-white/20 px-1.5 py-0.5 text-sm' : 'rounded bg-pink-50 px-1.5 py-0.5 text-sm'}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="mb-3 mt-2 overflow-x-auto last:mb-0">{children}</pre>,
        blockquote: ({ children }) => (
          <blockquote className={role === 'user' ? 'mb-3 border-l-4 border-pink-200 pl-3 italic opacity-90 last:mb-0' : 'mb-3 border-l-4 border-pink-300 pl-3 italic text-gray-700 last:mb-0'}>
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    const nextHeight = Math.min(inputRef.current.scrollHeight, 160);
    inputRef.current.style.height = `${Math.max(nextHeight, 48)}px`;
  }, [input]);

  const handleSend = async (overrideInput?: string) => {
    const nextInput = overrideInput ?? input;
    if (!nextInput.trim() || !currentDocument || isLoading) return;

    const userMessage = nextInput.trim();
    setInput('');
    
    // Add user message
    addChatMessage({ role: 'user', content: userMessage });
    
    setIsLoading(true);

    try {
      if (!apiKey) {
        addChatMessage({
          role: 'assistant',
          content: 'Prašau įvesti OpenAI API raktą nustatymuose.'
        });
        return;
      }

      // Initialize clients
      initializeOpenAI(apiKey);
      if (pineconeApiKey && isElectronAvailable()) {
        await initializePinecone(pineconeApiKey);
        // Index already exists from the upload step — no need to recreate it here
      }
      
      const response = await chatWithRAG(
        userMessage,
        currentDocument.id,
        chatHistory,
        currentDocument.text
      );
      
      // Add assistant message
      addChatMessage({ role: 'assistant', content: response });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Chat error:', msg);
      addChatMessage({ 
        role: 'assistant', 
        content: `Atsiprašau, įvyko klaida: ${msg}` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    'Kokios yra pagrindinės šio dokumento temos?',
    'Ar galėtum paaiškinti svarbiausias sąvokas?',
    'Kokia yra šio teksto santrauka?',
    'Ką turėčiau žinoti prieš egzaminą?',
  ];

  if (!currentDocument) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="empty-state"
        >
          <div className="empty-state-icon">
            <MessageCircle className="w-9 h-9" style={{color: 'var(--fuchsia-400)'}} />
          </div>
          <p className="empty-state-title">Pirmiausia įkelk dokumentą</p>
          <p className="empty-state-desc">Tada galėsi klausinėti apie jo turinį</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b bg-white/60 backdrop-blur-sm"
        style={{borderColor: 'rgba(244,114,182,0.15)', boxShadow: '0 2px 16px rgba(236,72,153,0.07)'}}
      >
        <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="page-hero">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="section-title font-serif gradient-text">
                Klausk knygos
              </h1>
              <motion.div
                animate={{ rotate: [0, 15, -10, 15, 0], scale: [1, 1.2, 1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
              >
                <Sparkles className="w-5 h-5" style={{color: 'var(--fuchsia-400)'}} />
              </motion.div>
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-2 min-w-0">
              <MessageCircle className="w-4 h-4" style={{color: 'var(--pink-400)'}} />
              <span className="truncate">Kalbėkis apie: {currentDocument.name}</span>
            </p>
          </div>
          {chatHistory.length > 0 && (
            <button
              onClick={clearChatHistory}
              className="btn-ghost btn-sm"
            >
              <Trash2 className="w-4 h-4" />
              Išvalyti pokalbį
            </button>
          )}
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 w-full overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="w-full space-y-6">
          {/* Welcome message if no chat history */}
          {chatHistory.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="py-8 w-full flex flex-col items-center text-center"
            >
              <motion.div
                className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-5 shadow-lg"
                style={{background: 'linear-gradient(135deg, var(--pink-200) 0%, var(--fuchsia-300) 50%, var(--purple-300) 100%)'}}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Sparkles className="w-11 h-11 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold gradient-text mb-2 text-center">
                Sveika! 🌸
              </h2>
              <p className="text-gray-500 text-center mb-7 max-w-2xl leading-relaxed w-full">
                Aš esu tavo studijų padėjėjas. Klausk manęs bet ko apie įkeltą dokumentą - padėsiu suprasti ir išmokti!
              </p>

              {/* Suggested questions */}
              <div className="space-y-2 w-full">
                <p className="text-sm text-gray-400 mb-3 text-center">Pabandyk paklausti:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestedQuestions.map((question, index) => (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.07, type: 'spring', stiffness: 300, damping: 24 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleSend(question)}
                      className="btn-secondary btn-sm"
                      style={{borderColor: 'rgba(217,70,239,0.25)', color: 'var(--purple-600)'}}
                    >
                      {question}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Chat messages */}
          <AnimatePresence>
            {chatHistory.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={{ delay: index * 0.03, type: 'spring', stiffness: 300, damping: 24 }}
                className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm"
                    style={{
                      flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--pink-400) 0%, var(--fuchsia-500) 55%, var(--purple-600) 100%)'
                    }}
                  >
                    <Heart className="w-5 h-5 text-white" fill="currentColor" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] rounded-2xl ${
                    message.role === 'user'
                      ? 'text-white rounded-br-none'
                      : 'rounded-bl-none shadow-sm'
                  }`}
                  style={message.role === 'user'
                    ? { ...bubblePadding, background: 'linear-gradient(135deg, var(--pink-500) 0%, var(--fuchsia-500) 55%, var(--purple-600) 100%)', boxShadow: 'var(--shadow-vibrant)' }
                    : { ...bubblePadding, background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(192,132,252,0.25)', color: '#374151', boxShadow: '0 2px 10px rgba(139,92,246,0.08)' }
                  }
                >
                  {renderMarkdown(message.content, message.role)}
                </div>

                {message.role === 'user' && (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm"
                    style={{ flexShrink: 0, background: 'linear-gradient(135deg, var(--pink-100) 0%, var(--purple-100) 100%)' }}
                  >
                    <User className="w-5 h-5" style={{color: 'var(--fuchsia-500)'}} />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="flex gap-4"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm"
                style={{
                  flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--pink-400) 0%, var(--fuchsia-500) 55%, var(--purple-600) 100%)'
                }}
              >
                <Heart className="w-5 h-5 text-white" fill="currentColor" />
              </div>
              <div
                className="rounded-2xl rounded-bl-none shadow-sm"
                style={{
                  ...bubblePadding,
                  background: 'rgba(255,255,255,0.92)',
                  border: '1px solid rgba(192,132,252,0.25)'
                }}
              >
                <div className="whitespace-pre-wrap wrap-anywhere leading-relaxed loading-dots">
                  <span style={{background: 'var(--pink-400)'}} />
                  <span style={{background: 'var(--fuchsia-400)'}} />
                  <span style={{background: 'var(--purple-400)'}} />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-t bg-white/85 backdrop-blur-md" style={{borderColor: 'rgba(244,114,182,0.15)', boxShadow: '0 -2px 16px rgba(236,72,153,0.06)'}}>
        <div className="w-full">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Užduok klausimą apie dokumentą..."
                rows={1}
                className="chat-textarea"
                style={{
                  minHeight: '48px',
                  maxHeight: '160px',
                }}
              />
              <motion.button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="absolute right-3 bottom-3 btn-primary btn-icon"
                whileHover={!isLoading && input.trim() ? { scale: 1.1 } : {}}
                whileTap={!isLoading && input.trim() ? { scale: 0.93 } : {}}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </motion.button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Paspausk Enter norėdama siųsti, arba Shift+Enter naujai eilutei
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
