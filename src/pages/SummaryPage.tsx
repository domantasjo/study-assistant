import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  ChevronDown,
  Loader2,
  RefreshCw,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { generateSummary } from '../utils/openai';

const SummaryPage: React.FC = () => {
  const {
    currentDocument,
    sections,
    setSections,
    apiKey,
    pineconeApiKey,
    isProcessing,
    setIsProcessing
  } = useApp();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const explicitBoxPadding = {
    paddingInline: '28px',
    paddingBlock: '22px',
  };

  useEffect(() => {
    // Auto-generate summary if document is loaded and no sections exist
    if (currentDocument && sections.length === 0 && apiKey && !isProcessing) {
      handleGenerateSummary();
    }
  }, [currentDocument?.id]);

  const handleGenerateSummary = async () => {
    if (!currentDocument || !apiKey) return;

    setIsProcessing(true);
    setError(null);

    try {
      const newSections = await generateSummary(
        apiKey,
        currentDocument.text,
        currentDocument.id,
        pineconeApiKey
      );
      setSections(newSections);
      // Expand first section by default
      if (newSections.length > 0) {
        setExpandedSections([newSections[0].title]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
      console.error('Summary generation error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSection = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

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
            <BookOpen className="w-9 h-9" style={{color: 'var(--fuchsia-400)'}} />
          </div>
          <p className="empty-state-title">Pirmiausia įkelk dokumentą</p>
          <p className="empty-state-desc">Santrauka bus sugeneruota automatiškai</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-content-narrow space-y-6 sm:space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="page-hero"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="section-title font-serif gradient-text mb-2">
                Dokumento santrauka
              </h1>
              <p className="text-gray-500 text-sm sm:text-base truncate">
                {currentDocument.name} • {currentDocument.pageCount} psl.
              </p>
            </div>
            <button
              onClick={handleGenerateSummary}
              disabled={isProcessing}
              className="btn-primary flex items-center gap-2"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Generuoti iš naujo
            </button>
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="alert-error"
          >
            <AlertCircle className="w-5 h-5 text-red-500" style={{flexShrink: 0}} />
            <p>{error}</p>
          </motion.div>
        )}

        {/* Loading state */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 min-h-64"
          >
            <div className="relative">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{background: 'linear-gradient(135deg, var(--pink-100) 0%, var(--purple-100) 100%)'}}
              >
                <Loader2 className="w-10 h-10 animate-spin" style={{color: 'var(--fuchsia-500)'}} />
              </div>
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{border: '2px solid var(--pink-300)'}}
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <p className="mt-6 text-lg font-semibold text-gray-700">Analizuojamas dokumentas...</p>
            <p className="text-sm text-gray-400 mt-1">Tai gali užtrukti kelias sekundes</p>
          </motion.div>
        )}

        {/* Sections */}
        {!isProcessing && sections.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {sections.map((section, index) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, type: 'spring', stiffness: 300, damping: 24 }}
                className="card-flat overflow-hidden"
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between hover:bg-pink-50/50 transition-colors gap-3 focus-ring rounded-t-2xl"
                  style={explicitBoxPadding}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                      style={{ background: 'var(--grad-vivid)' }}
                    >
                      {index + 1}
                    </div>
                    <h2 className="text-base sm:text-lg font-semibold text-gray-800 text-left">
                      {section.title}
                    </h2>
                  </div>
                  <motion.div
                    animate={{ rotate: expandedSections.includes(section.title) ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </motion.div>
                </button>

                {/* Section Content */}
                <AnimatePresence>
                  {expandedSections.includes(section.title) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-7" style={{ paddingInline: '28px', paddingBottom: '32px' }}>
                        {/* Summary */}
                        <div
                          className="rounded-xl"
                          style={{
                            ...explicitBoxPadding,
                            background: 'linear-gradient(135deg, var(--pink-50) 0%, var(--purple-100) 50%, var(--pink-50) 100%)'
                          }}
                        >
                          <div className="flex items-center gap-2 mb-3" style={{color: 'var(--fuchsia-600)'}}>
                            <Sparkles className="w-4 h-4" />
                            <span className="font-semibold text-sm">Santrauka</span>
                          </div>
                          <p className="text-gray-700 leading-8 whitespace-pre-line">
                            {section.summary}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Empty state */}
        {!isProcessing && sections.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="empty-state"
          >
            <div className="empty-state-icon">
              <BookOpen className="w-9 h-9" style={{color: 'var(--fuchsia-400)'}} />
            </div>
            <p className="empty-state-title mb-4">Nėra sugeneruotos santraukos</p>
            <button
              onClick={handleGenerateSummary}
              className="btn-primary"
            >
              Generuoti santrauką
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SummaryPage;
