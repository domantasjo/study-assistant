import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Key, Save, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface SettingsModalProps {
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { apiKey, setApiKey, pineconeApiKey, setPineconeApiKey, documents } = useApp();
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [tempPineconeApiKey, setTempPineconeApiKey] = useState(pineconeApiKey);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showPineconeKey, setShowPineconeKey] = useState(false);

  const handleSave = () => {
    setApiKey(tempApiKey);
    setPineconeApiKey(tempPineconeApiKey);
    onClose();
  };

  const handleClearData = () => {
    if (window.confirm('Ar tikrai norite ištrinti visus programos duomenis ir API raktus?')) {
      localStorage.removeItem('neda-documents');
      localStorage.removeItem('neda-break-reminder-shown');
      localStorage.removeItem('neda-openai-key');
      localStorage.removeItem('neda-pinecone-key');
      localStorage.removeItem('neda-has-seen-greeting');
      documents.forEach((doc) => {
        localStorage.removeItem(`neda-sections-${doc.id}`);
        localStorage.removeItem(`neda-flashcards-${doc.id}`);
        localStorage.removeItem(`neda-chat-${doc.id}`);
      });
      window.location.reload();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-pink-100 flex flex-col"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-pink-100/60 bg-pink-50/30">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif font-bold gradient-text flex items-center gap-3">
              <div className="p-2 bg-pink-100 rounded-2xl">
                <Key className="w-6 h-6 text-pink-500" />
              </div>
              Nustatymai
            </h2>
            <button
              onClick={onClose}
              className="btn-ghost btn-icon"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* OpenAI API Key Section */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Key className="w-4 h-4 text-pink-500" />
              OpenAI API Raktas
            </label>
            <div className="relative">
              <input
                type={showOpenAIKey ? 'text' : 'password'}
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-3 pr-12 rounded-xl border border-pink-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-pink-100 rounded-lg transition-colors"
              >
                {showOpenAIKey ? (
                  <EyeOff className="w-5 h-5 text-gray-400" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Reikalingas AI funkcijoms (pokalbiai, santraukos, kortelės)
            </p>
          </div>

          {/* Pinecone API Key Section */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <div
                className="w-4 h-4 rounded"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)' }}
              ></div>
              Pinecone API Raktas
            </label>
            <div className="relative">
              <input
                type={showPineconeKey ? 'text' : 'password'}
                value={tempPineconeApiKey}
                onChange={(e) => setTempPineconeApiKey(e.target.value)}
                placeholder="pc-..."
                className="w-full px-4 py-3 pr-12 rounded-xl border border-pink-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPineconeKey(!showPineconeKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-pink-100 rounded-lg transition-colors"
              >
                {showPineconeKey ? (
                  <EyeOff className="w-5 h-5 text-gray-400" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Reikalingas pažangiai dokumentų paieškai (RAG)
            </p>
          </div>

          {/* Stats */}
          <div
            className="bg-pink-50 rounded-xl"
            style={{ paddingInline: '28px', paddingBlock: '22px' }}
          >
            <h3 className="font-medium text-gray-700 mb-2">Statistika</h3>
            <div className="text-sm text-gray-600">
              <p>Įkeltų dokumentų: {documents.length}</p>
            </div>
          </div>

          {/* Clear Data */}
          <div className="border-t border-pink-100 pt-6">
            <button
              onClick={handleClearData}
              className="btn-danger w-full justify-start"
            >
              <Trash2 className="w-5 h-5" />
              Ištrinti visus duomenis
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-pink-100/60 bg-gray-50/50 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Atšaukti
          </button>
          <button
            onClick={handleSave}
            className="btn-primary">
            <Save className="w-4 h-4" />
            Išsaugoti
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SettingsModal;
