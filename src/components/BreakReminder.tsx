import React from 'react';
import { motion } from 'framer-motion';
import { Coffee, Heart, X } from 'lucide-react';

interface BreakReminderProps {
  onClose: () => void;
}

const BreakReminder: React.FC<BreakReminderProps> = ({ onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-pink-100"
      >
        {/* Decorative header */}
        <div
          className="p-8 text-center relative"
          style={{background: 'var(--grad-vivid)'}}
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-colors focus-ring"
            aria-label="Uždaryti priminimą"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 mb-6 shadow-lg"
          >
            <Coffee className="w-9 h-9 text-white" />
          </motion.div>
          <h2 className="text-3xl font-serif font-bold text-white mb-2">
            Laikas pertraukėlei! ☕
          </h2>
          <p className="text-pink-100 text-sm font-medium opacity-90">
            Valandą intensyviai mokaisi
          </p>
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-pink-100 rounded-full">
              <Heart className="w-8 h-8 text-pink-500" fill="currentColor" />
            </div>
          </div>
          <p className="text-xl text-gray-800 mb-4 leading-relaxed font-semibold">
            Mano meile, jau valandą mokaisi! 📚
          </p>
          <p className="text-gray-600 mb-8 leading-relaxed text-[16px]">
            Padaryk trumpą pertraukėlę, atsigerk vandens, 
            pasivaikščiok, ir grįžk su nauja energija! 💪
          </p>
          <p className="text-pink-600 italic font-semibold mb-8">
            Labai didžiuojuosi tavimi! ❤️
          </p>

          <button
            onClick={onClose}
            className="btn-primary w-full text-base rounded-2xl font-bold focus-ring"
            style={{minHeight: '48px'}}
          >
            Supratau, meilutė! 💕
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default BreakReminder;
