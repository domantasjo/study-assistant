import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  BookOpen,
  Brain,
  MessageCircle,
  Menu,
  X,
  Heart,
  FileText,
  Sparkles,
  Download
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import UploadPage from '../pages/UploadPage';
import SummaryPage from '../pages/SummaryPage';
import FlashcardsPage from '../pages/FlashcardsPage';
import ChatPage from '../pages/ChatPage';
import BreakReminder from './BreakReminder';

type Page = 'upload' | 'summary' | 'flashcards' | 'chat';

const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer ?? null;

const MainApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('upload');
  const [showBreakReminder, setShowBreakReminder] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const {
    currentDocument,
    breakReminderShown,
    setBreakReminderShown,
    startSession,
    sessionStartTime
  } = useApp();

  const explicitBoxPadding = {
    paddingInline: '28px',
    paddingBlock: '22px',
  };

  // Start session timer on mount
  useEffect(() => {
    startSession();
  }, []);

  // Listen for auto-update events from main process
  useEffect(() => {
    if (!ipcRenderer) return;
    const onUpdateDownloaded = () => setUpdateReady(true);
    ipcRenderer.on('update-downloaded', onUpdateDownloaded);
    return () => ipcRenderer.removeListener('update-downloaded', onUpdateDownloaded);
  }, []);

  // Check for 1 hour usage
  useEffect(() => {
    if (breakReminderShown || !sessionStartTime) return;

    const checkInterval = setInterval(() => {
      const now = new Date();
      const elapsed = now.getTime() - sessionStartTime.getTime();
      const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

      if (elapsed >= oneHour) {
        setShowBreakReminder(true);
        setBreakReminderShown(true);
        clearInterval(checkInterval);
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [sessionStartTime, breakReminderShown, setBreakReminderShown]);

  const navItems = [
    { id: 'upload' as Page, icon: Upload, label: 'Įkelti dokumentą' },
    { id: 'summary' as Page, icon: BookOpen, label: 'Santrauka', requiresDoc: true },
    { id: 'flashcards' as Page, icon: Brain, label: 'Mokymosi kortelės', requiresDoc: true },
    { id: 'chat' as Page, icon: MessageCircle, label: 'Klausk knygos', requiresDoc: true },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'upload':
        return <UploadPage onNavigate={setCurrentPage} />;
      case 'summary':
        return <SummaryPage />;
      case 'flashcards':
        return <FlashcardsPage />;
      case 'chat':
        return <ChatPage />;
      default:
        return <UploadPage onNavigate={setCurrentPage} />;
    }
  };

  const currentPageLabel = navItems.find((item) => item.id === currentPage)?.label || '';
  const handleNavigate = (page: Page, isDisabled: boolean) => {
    if (isDisabled) return;
    setCurrentPage(page);
    setIsSidebarOpen(false);
  };

  const navContent = (
    <>
      <div className="p-6 sm:p-7 border-b border-pink-200/60">
        <div className="flex items-center justify-between lg:justify-start">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md"
              style={{background: 'linear-gradient(135deg, var(--pink-400) 0%, var(--fuchsia-500) 55%, var(--purple-600) 100%)', boxShadow: 'var(--shadow-vibrant)'}}
            >
              <Heart className="w-5 h-5 text-white" fill="currentColor" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold gradient-text mb-1">Nedai</h1>
              <p className="text-sm text-gray-500 font-medium">Studijų pagalbininkas</p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="btn-ghost btn-icon lg:hidden"
            aria-label="Uždaryti meniu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {currentDocument && (
        <div className="px-4 sm:px-5 py-4 mx-4 sm:mx-5 mt-4 sm:mt-5 rounded-2xl bg-pink-50/80 border-l-4 border border-pink-200/60 shadow-sm" style={{borderLeftColor: 'var(--fuchsia-400)'}}>
          <div className="flex items-center gap-3 text-sm">
            <FileText className="w-5 h-5 text-pink-500" style={{ flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-gray-800 truncate font-semibold text-[15px] flex-1">
                  {currentDocument.name}
                </p>
              </div>
              <p className="text-xs text-gray-500">
                {currentDocument.pageCount} psl. • {Math.round(currentDocument.text.length / 1000)}k žodžių
              </p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 p-4 sm:p-5 space-y-2.5 overflow-y-auto">
        {navItems.map((item) => {
          const isDisabled = Boolean(item.requiresDoc && !currentDocument);
          const isActive = currentPage === item.id;

          return (
            <motion.button
              key={item.id}
              whileTap={!isDisabled ? { scale: 0.985 } : {}}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              onClick={() => handleNavigate(item.id, isDisabled)}
              disabled={isDisabled}
              className={`
                sidebar-nav-item w-full
                ${isActive ? 'active' : ''}
                ${isDisabled ? 'disabled' : ''}
              `}
            >
              <item.icon className="w-5 h-5" style={{ flexShrink: 0 }} />
              <span className="font-semibold">{item.label}</span>
              {item.requiresDoc && !currentDocument && (
                <span className="ml-auto text-xs opacity-60 font-medium">Reikia PDF</span>
              )}
            </motion.button>
          );
        })}
      </nav>

      <div className="p-5 sm:p-6 text-center bg-pink-50/30 border-t border-pink-100/60">
        <div
          className="rounded-2xl flex items-center justify-center gap-2"
          style={{
            ...explicitBoxPadding,
            background: 'linear-gradient(135deg, var(--pink-50) 0%, var(--purple-100) 100%)',
            border: '1px solid rgba(244, 114, 182, 0.2)'
          }}
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -6, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3 }}
          >
            <Sparkles className="w-4 h-4" style={{color: 'var(--fuchsia-500)'}} />
          </motion.div>
          <span className="text-sm font-semibold" style={{background: 'var(--grad-vivid)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'}}>
            Sukurta su meile
          </span>
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
          >
            <Heart className="w-4 h-4" fill="currentColor" style={{color: 'var(--pink-500)'}} />
          </motion.div>
        </div>
      </div>
    </>
  );

  return (
    <div 
      className="h-screen flex overflow-hidden" 
      style={{background: 'linear-gradient(135deg, var(--pink-50) 0%, var(--rose-50) 50%, #fff8f9 100%)'}}
    >
      {/* Modals */}
      <AnimatePresence>
        {showBreakReminder && (
          <BreakReminder onClose={() => setShowBreakReminder(false)} />
        )}
      </AnimatePresence>

      {/* Update banner */}
      <AnimatePresence>
        {updateReady && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium text-white"
            style={{ background: 'linear-gradient(90deg, var(--fuchsia-500) 0%, var(--purple-600) 100%)' }}
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Naujas atnaujinimas paruoštas!</span>
            <button
              onClick={() => ipcRenderer?.invoke('install-update')}
              className="ml-2 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors font-semibold"
            >
              Paleisti iš naujo
            </button>
            <button
              onClick={() => setUpdateReady(false)}
              className="ml-1 p-1 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Uždaryti"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="hidden lg:flex w-72 glass border-r border-pink-200/60 flex-col shadow-lg overflow-hidden"
      >
        {navContent}
      </motion.aside>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="relative h-full w-[88vw] max-w-[288px] glass border-r border-pink-200/60 flex flex-col shadow-xl overflow-hidden"
            >
              {navContent}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-hidden">
        <div className="lg:hidden px-4 sm:px-6 py-3 border-b border-pink-100/80 bg-white/70 backdrop-blur-md flex items-center gap-3" style={{boxShadow: '0 2px 12px rgba(236,72,153,0.08)'}}>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="btn-secondary btn-icon"
            aria-label="Atidaryti meniu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{background: 'var(--grad-vivid)'}}>
              <Heart className="w-3 h-3 text-white" fill="currentColor" />
            </div>
            <p className="font-bold truncate gradient-text">{currentPageLabel}</p>
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full min-h-0 w-full"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default MainApp;
