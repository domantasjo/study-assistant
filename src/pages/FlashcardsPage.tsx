import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  RotateCcw,
  Lightbulb,
  AlertCircle,
  Keyboard,
  List,
  CheckCircle,
  XCircle,
  Send
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { generateFlashcards, validateAnswer, type Flashcard as GeneratedFlashcard } from '../utils/openai';

type StudyMode = 'multiple-choice' | 'typed';

interface FlashcardState {
  answered: boolean;
  correct: boolean | null;
  selectedOption: string | null;
  typedAnswer: string;
  explanation: string;
}

const FlashcardsPage: React.FC = () => {
  const {
    currentDocument,
    flashcards,
    setFlashcards,
    sections,
    apiKey,
    pineconeApiKey,
    isProcessing,
    setIsProcessing
  } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [studyMode, setStudyMode] = useState<StudyMode>('multiple-choice');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [cardStates, setCardStates] = useState<Map<string, FlashcardState>>(new Map());
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const explicitBoxPadding = {
    paddingInline: '28px',
    paddingBlock: '22px',
  };

  const topics = Array.from(new Set(flashcards.map((card) => card.topic).filter(Boolean))) as string[];
  const displayedFlashcards = topicFilter === 'all'
    ? flashcards
    : flashcards.filter((card) => card.topic === topicFilter);

  const currentCard = displayedFlashcards[currentIndex];
  const currentState = currentCard ? cardStates.get(currentCard.id) : undefined;

  // Calculate progress
  const answeredCount = displayedFlashcards.filter((card) => cardStates.get(card.id)?.answered).length;
  const correctCount = displayedFlashcards.filter((card) => cardStates.get(card.id)?.correct === true).length;

  useEffect(() => {
    // Auto-generate flashcards if document is loaded and no cards exist
    if (currentDocument && flashcards.length === 0 && apiKey && !isProcessing) {
      handleGenerateFlashcards();
    }
  }, [currentDocument?.id]);

  useEffect(() => {
    if (currentIndex >= displayedFlashcards.length) {
      setCurrentIndex(0);
    }
  }, [displayedFlashcards.length, currentIndex]);

  const handleGenerateFlashcards = async () => {
    if (!currentDocument || !apiKey) return;

    setIsProcessing(true);
    setError(null);
    setCardStates(new Map());
    setCurrentIndex(0);
    setTopicFilter('all');

    try {
      const targetCount = Math.max(24, Math.min(48, Math.max(sections.length, 4) * 6));
      const newCards = await generateFlashcards(apiKey, currentDocument.text, {
        count: targetCount,
        documentId: currentDocument.id,
        pineconeApiKey,
        sections,
      });
      setFlashcards(newCards.map((card: GeneratedFlashcard) => ({ ...card, learned: false })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards');
      console.error('Flashcard generation error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMultipleChoiceAnswer = (option: string) => {
    if (!currentCard || currentState?.answered) return;

    const isCorrect = option === currentCard.answer;

    setCardStates(prev => new Map(prev).set(currentCard.id, {
      answered: true,
      correct: isCorrect,
      selectedOption: option,
      typedAnswer: '',
      explanation: isCorrect ? 'Puiku! Teisingas atsakymas!' : `Deja, neteisingai. Teisingas atsakymas: ${currentCard.answer}`,
    }));
  };

  const handleTypedAnswer = async () => {
    if (!currentCard || !currentState?.typedAnswer.trim() || isValidating) return;

    setIsValidating(true);

    try {
      const result = await validateAnswer(
        apiKey,
        currentCard.question,
        currentCard.answer,
        currentState.typedAnswer
      );

      setCardStates(prev => new Map(prev).set(currentCard.id, {
        ...currentState,
        answered: true,
        correct: result.isCorrect,
        explanation: result.explanation,
      }));
    } catch (err) {
      console.error('Validation error:', err);
      // Fallback to simple comparison
      const isCorrect = currentState.typedAnswer.toLowerCase().trim() === currentCard.answer.toLowerCase().trim();
      setCardStates(prev => new Map(prev).set(currentCard.id, {
        ...currentState,
        answered: true,
        correct: isCorrect,
        explanation: isCorrect ? 'Puiku!' : `Teisingas atsakymas: ${currentCard.answer}`,
      }));
    } finally {
      setIsValidating(false);
    }
  };

  const handleTypedInputChange = (value: string) => {
    if (!currentCard) return;

    setCardStates(prev => new Map(prev).set(currentCard.id, {
      answered: false,
      correct: null,
      selectedOption: null,
      typedAnswer: value,
      explanation: '',
    }));
  };

  const goToNext = () => {
    if (currentIndex < displayedFlashcards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowAnswer(false);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setFlashcards(shuffled);
    setCurrentIndex(0);
    setCardStates(new Map());
  };

  const handleReset = () => {
    setCardStates(new Map());
    setCurrentIndex(0);
  };

  // Shuffle options for multiple choice
  const getShuffledOptions = () => {
    if (!currentCard?.options) return [currentCard?.answer || ''];
    const allOptions = [currentCard.answer, ...currentCard.options];
    return allOptions.sort(() => Math.random() - 0.5);
  };

  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);

  useEffect(() => {
    if (currentCard && !currentState?.answered) {
      setShuffledOptions(getShuffledOptions());
    }
  }, [currentIndex, currentCard?.id]);

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
            <Brain className="w-9 h-9" style={{color: 'var(--fuchsia-400)'}} />
          </div>
          <p className="empty-state-title">Pirmiausia įkelk dokumentą</p>
          <p className="empty-state-desc">Mokymosi kortelės bus sukurtos automatiškai</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-content-focus space-y-6 sm:space-y-8">
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
                Mokymosi kortelės
              </h1>
              <p className="text-gray-500 text-sm sm:text-base">
                {flashcards.length > 0
                  ? `${answeredCount} / ${displayedFlashcards.length} atsakyta \u2022 ${correctCount} teisingai`
                  : 'Generuok korteles ir pradek mokytis!'
                }
              </p>
            </div>
            <button
              onClick={handleGenerateFlashcards}
              disabled={isProcessing}
              className="btn-primary flex items-center gap-2"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Naujos korteles
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
            <p className="mt-6 text-lg font-semibold text-gray-700">Kuriamos mokymosi korteles...</p>
            <p className="text-sm text-gray-400 mt-1">Tai gali užtrukti kelias sekundes</p>
          </motion.div>
        )}

        {/* Flashcards */}
        {!isProcessing && flashcards.length > 0 && displayedFlashcards.length > 0 && (
          <div className="space-y-5">
            {/* Study mode toggle */}
            <div className="flex items-center justify-center gap-2 surface rounded-xl" style={explicitBoxPadding}>
              <button
                onClick={() => setStudyMode('multiple-choice')}
                className={`btn-sm flex items-center gap-2 ${
                  studyMode === 'multiple-choice'
                    ? 'btn-primary'
                    : 'btn-ghost'
                }`}
              >
                <List className="w-4 h-4" />
                Pasirinkimas
              </button>
              <button
                onClick={() => setStudyMode('typed')}
                className={`btn-sm flex items-center gap-2 ${
                  studyMode === 'typed'
                    ? 'btn-primary'
                    : 'btn-ghost'
                }`}
              >
                <Keyboard className="w-4 h-4" />
                Rašyti atsakymą
              </button>
            </div>

            {topics.length > 0 && (
              <div className="surface rounded-xl" style={explicitBoxPadding}>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Temos</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setTopicFilter('all');
                      setCurrentIndex(0);
                    }}
                    className={`btn-sm ${topicFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    Visos ({flashcards.length})
                  </button>
                  {topics.map((topic) => {
                    const topicCount = flashcards.filter((card) => card.topic === topic).length;
                    return (
                      <button
                        key={topic}
                        onClick={() => {
                          setTopicFilter(topic);
                          setCurrentIndex(0);
                        }}
                        className={`btn-sm ${topicFilter === topic ? 'btn-primary' : 'btn-ghost'}`}
                        title={topic}
                      >
                        {topic} ({topicCount})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className="progress-track">
              <motion.div
                className="progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${displayedFlashcards.length ? ((currentIndex + 1) / displayedFlashcards.length) * 100 : 0}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Main card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentCard?.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className="card-flat overflow-hidden"
                style={{boxShadow: 'var(--shadow-medium)'}}
              >
                {/* Card number */}
                <div
                  className="border-b flex items-center justify-between gap-2"
                  style={{
                    ...explicitBoxPadding,
                    background: 'linear-gradient(135deg, var(--pink-50) 0%, var(--purple-100) 100%)',
                    borderColor: 'rgba(244,114,182,0.15)'
                  }}
                >
                  <span className="text-sm font-semibold" style={{color: 'var(--fuchsia-600)'}}>
                    Kortele {currentIndex + 1} iš {displayedFlashcards.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleShuffle}
                      className="btn-ghost btn-icon btn-sm focus-ring"
                      title="Sumaišyti"
                    >
                      <Shuffle className="w-4 h-4" style={{color: 'var(--pink-500)'}} />
                    </button>
                    <button
                      onClick={handleReset}
                      className="btn-ghost btn-icon btn-sm focus-ring"
                      title="Pradėti iš naujo"
                    >
                      <RotateCcw className="w-4 h-4" style={{color: 'var(--pink-500)'}} />
                    </button>
                  </div>
                </div>

                {/* Question */}
                <div style={explicitBoxPadding}>
                  <div className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ flexShrink: 0, background: 'linear-gradient(135deg, var(--pink-100) 0%, var(--purple-100) 100%)' }}
                    >
                      <Lightbulb className="w-5 h-5" style={{color: 'var(--fuchsia-500)'}} />
                    </div>
                    <h2 className="text-lg sm:text-xl font-medium text-gray-800 leading-relaxed">
                      {currentCard?.question}
                    </h2>
                  </div>

                  {currentCard?.topic && (
                    <div
                      className="mb-5 inline-flex items-center rounded-full text-xs font-semibold"
                      style={{
                        paddingInline: '28px',
                        paddingBlock: '22px',
                        background: 'var(--purple-100)',
                        color: 'var(--purple-700)'
                      }}
                    >
                      Tema: {currentCard.topic}
                    </div>
                  )}

                  {/* Multiple choice mode */}
                  {studyMode === 'multiple-choice' && (
                    <div className="space-y-3">
                      {shuffledOptions.map((option, index) => {
                        const isSelected = currentState?.selectedOption === option;
                        const isCorrectAnswer = option === currentCard?.answer;
                        const isAnswered = currentState?.answered;

                        let buttonStyle = 'border-pink-200 hover:border-pink-300 hover:bg-pink-50/60';
                        if (isAnswered) {
                          if (isCorrectAnswer) {
                            buttonStyle = 'border-green-400 bg-green-50';
                          } else if (isSelected && !isCorrectAnswer) {
                            buttonStyle = 'border-red-400 bg-red-50';
                          } else {
                            buttonStyle = 'border-gray-200 opacity-60';
                          }
                        }

                        return (
                          <motion.button
                            key={index}
                            whileHover={!isAnswered ? { scale: 1.01 } : {}}
                            whileTap={!isAnswered ? { scale: 0.99 } : {}}
                            onClick={() => handleMultipleChoiceAnswer(option)}
                            disabled={isAnswered}
                            className={`w-full text-left rounded-xl border-2 transition-all flex items-center gap-3 focus-ring ${buttonStyle}`}
                            style={explicitBoxPadding}
                          >
                            <span
                              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                              style={{
                                background: isAnswered && isCorrectAnswer ? '#dcfce7' : isAnswered && isSelected && !isCorrectAnswer ? '#fef2f2' : 'var(--pink-100)',
                                color: isAnswered && isCorrectAnswer ? '#15803d' : isAnswered && isSelected && !isCorrectAnswer ? '#dc2626' : 'var(--pink-600)',
                                flexShrink: 0
                              }}
                            >
                              {String.fromCharCode(65 + index)}
                            </span>
                            <span className="flex-1 text-gray-700">{option}</span>
                            {isAnswered && isCorrectAnswer && (
                              <CheckCircle className="w-5 h-5 text-green-500" style={{flexShrink: 0}} />
                            )}
                            {isAnswered && isSelected && !isCorrectAnswer && (
                              <XCircle className="w-5 h-5 text-red-500" style={{flexShrink: 0}} />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}

                  {/* Typed answer mode */}
                  {studyMode === 'typed' && (
                    <div className="space-y-4">
                      <div className="relative">
                        <input
                          type="text"
                          value={currentState?.typedAnswer || ''}
                          onChange={(e) => handleTypedInputChange(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTypedAnswer()}
                          placeholder="Įrašyk savo atsakymą..."
                          disabled={currentState?.answered}
                          className={`w-full rounded-xl border-2 outline-none transition-all focus-ring ${
                            currentState?.answered
                              ? currentState.correct
                                ? 'border-green-400 bg-green-50'
                                : 'border-red-400 bg-red-50'
                              : 'border-pink-200 focus:border-pink-400 focus:shadow-[0_0_0_3px_rgba(244,114,182,0.1)]'
                          }`}
                          style={{
                            ...explicitBoxPadding,
                            paddingRight: '48px'
                          }}
                        />
                        {!currentState?.answered && (
                          <button
                            onClick={handleTypedAnswer}
                            disabled={!currentState?.typedAnswer?.trim() || isValidating}
                            className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary btn-icon btn-sm"
                          >
                            {isValidating ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Show correct answer button */}
                      {!currentState?.answered && (
                        <button
                          onClick={() => setShowAnswer(!showAnswer)}
                          className="btn-ghost btn-sm"
                        >
                          {showAnswer ? 'Slėpti atsakymą' : 'Rodyti atsakymą'}
                        </button>
                      )}

                      {showAnswer && !currentState?.answered && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-xl"
                          style={{
                            ...explicitBoxPadding,
                            background: 'linear-gradient(135deg, var(--pink-50) 0%, var(--purple-100) 100%)'
                          }}
                        >
                          <p className="text-sm font-semibold mb-1" style={{color: 'var(--fuchsia-600)'}}>Teisingas atsakymas:</p>
                          <p className="text-gray-700">{currentCard?.answer}</p>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Feedback */}
                  {currentState?.answered && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-6 rounded-xl flex items-start gap-3 ${
                        currentState.correct
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-red-50 border border-red-200'
                      }`}
                      style={explicitBoxPadding}
                    >
                      {currentState.correct ? (
                        <CheckCircle className="w-5 h-5 text-green-500" style={{ flexShrink: 0 }} />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" style={{ flexShrink: 0 }} />
                      )}
                      <div>
                        <p className={`font-semibold ${currentState.correct ? 'text-green-700' : 'text-red-700'}`}>
                          {currentState.correct ? 'Teisingai!' : 'Neteisingai'}
                        </p>
                        <p className={`text-sm mt-1 ${currentState.correct ? 'text-green-600' : 'text-red-600'}`}>
                          {currentState.explanation}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Navigation */}
                <div
                  className="border-t flex items-center justify-between"
                  style={{
                    ...explicitBoxPadding,
                    background: 'linear-gradient(135deg, var(--pink-50) 0%, rgba(243,232,255,0.4) 100%)',
                    borderColor: 'rgba(244,114,182,0.15)'
                  }}
                >
                  <button
                    onClick={goToPrev}
                    disabled={currentIndex === 0}
                    className="btn-secondary flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Ankstesnė
                  </button>
                  <button
                    onClick={goToNext}
                    disabled={currentIndex === displayedFlashcards.length - 1}
                    className="btn-primary flex items-center gap-1"
                  >
                    Kita
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Card indicator dots */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap py-2">
              {displayedFlashcards.map((card, index) => {
                const state = cardStates.get(card.id);
                let dotColor = 'bg-pink-200';
                if (state?.answered) {
                  dotColor = state.correct ? 'bg-green-400' : 'bg-red-400';
                }
                if (index === currentIndex) {
                  dotColor = state?.answered
                    ? (state.correct ? 'bg-green-500 ring-2 ring-green-300' : 'bg-red-500 ring-2 ring-red-300')
                    : 'bg-pink-500 ring-2 ring-pink-300';
                }

                return (
                  <button
                    key={card.id}
                    onClick={() => {
                      setCurrentIndex(index);
                      setShowAnswer(false);
                    }}
                    className={`w-3.5 h-3.5 rounded-full transition-all focus-ring ${dotColor}`}
                    style={{minWidth: '14px', minHeight: '14px'}}
                    aria-label={`Eiti į ${index + 1} kortelę`}
                    title={`Kortele ${index + 1}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {!isProcessing && flashcards.length > 0 && displayedFlashcards.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="empty-state"
          >
            <div className="empty-state-icon">
              <Brain className="w-9 h-9" style={{color: 'var(--fuchsia-400)'}} />
            </div>
            <p className="empty-state-title">Šiai temai kortelių nėra</p>
            <button
              onClick={() => setTopicFilter('all')}
              className="btn-primary mt-4"
            >
              Rodyti visas korteles
            </button>
          </motion.div>
        )}

        {/* Empty state */}
        {!isProcessing && flashcards.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="empty-state"
          >
            <div className="empty-state-icon">
              <Brain className="w-9 h-9" style={{color: 'var(--fuchsia-400)'}} />
            </div>
            <p className="empty-state-title mb-4">Nėra sukurtų mokymosi kortelių</p>
            <button
              onClick={handleGenerateFlashcards}
              className="btn-primary"
            >
              Generuoti korteles
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default FlashcardsPage;
