import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Heart, Sparkles, Gift } from 'lucide-react';

interface BirthdayGreetingProps {
  onContinue: () => void;
}

interface Confetti {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
}

const BirthdayGreeting: React.FC<BirthdayGreetingProps> = ({ onContinue }) => {
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [showMessage, setShowMessage] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!reduceMotion) {
      // Generate confetti
      const colors = ['#F472B6', '#EC4899', '#DB2777', '#FB7185', '#FDA4AF', '#FECDD3', '#FFB6C1', '#FF69B4'];
      const newConfetti: Confetti[] = [];

      for (let i = 0; i < 100; i++) {
        newConfetti.push({
          id: i,
          x: Math.random() * 100,
          color: colors[Math.floor(Math.random() * colors.length)],
          delay: Math.random() * 3,
          duration: 3 + Math.random() * 3,
        });
      }

      setConfetti(newConfetti);
    }
    
    // Show message after a brief delay
    setTimeout(() => setShowMessage(true), 500);
    setTimeout(() => setShowButton(true), 3000);
  }, [reduceMotion]);

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden" 
      style={{background: 'linear-gradient(135deg, var(--pink-50) 0%, var(--rose-50) 50%, #fff8f9 100%)'}}
    >
      {/* Confetti */}
      {!reduceMotion && confetti.map((c) => (
        <motion.div
          key={c.id}
          className="confetti"
          initial={{ x: `${c.x}vw`, y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: 720, opacity: 0 }}
          transition={{ duration: c.duration, delay: c.delay, ease: 'linear' }}
          style={{
            left: `${c.x}%`,
            backgroundColor: c.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            width: Math.random() > 0.5 ? '10px' : '8px',
            height: Math.random() > 0.5 ? '10px' : '8px',
          }}
        />
      ))}

      {/* Floating hearts background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(reduceMotion ? 6 : 20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight,
              scale: 0.5 + Math.random() * 0.5,
              opacity: 0.3
            }}
            animate={reduceMotion ? undefined : {
              y: [null, Math.random() * -50, null],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={reduceMotion ? undefined : {
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
          >
            <Heart 
              className="text-pink-300" 
              size={20 + Math.random() * 20} 
              fill="currentColor"
            />
          </motion.div>
        ))}
      </div>

      {/* Main content */}
      <AnimatePresence>
        {showMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="relative z-10 text-center px-8 max-w-3xl"
          >
            {/* Gift icon */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mb-6"
            >
              <div 
                className="inline-flex items-center justify-center w-20 h-20 rounded-full shadow-xl pulse-glow"
                style={{background: 'linear-gradient(135deg, var(--pink-400) 0%, var(--rose-500) 100%)'}}
              >
                <Gift className="w-10 h-10 text-white" />
              </div>
            </motion.div>

            {/* Sparkle decoration */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex justify-center gap-4 mb-4"
            >
              <Sparkles className="w-6 h-6 text-pink-400" />
              <Sparkles className="w-6 h-6 text-rose-400" />
              <Sparkles className="w-6 h-6 text-pink-400" />
            </motion.div>

            {/* Main greeting */}
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="font-serif text-5xl md:text-6xl font-bold gradient-text mb-6"
            >
              Su 20-uoju Gimtadieniu, Neda! 🎂
            </motion.h1>

            {/* Heart decoration */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1, type: 'spring', stiffness: 200 }}
              className="flex justify-center mb-8"
            >
              <Heart className="w-12 h-12 text-rose-500 floating-heart" fill="currentColor" />
            </motion.div>

            {/* Message */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="glass rounded-3xl p-8 shadow-xl"
            >
              <p className="text-xl md:text-2xl text-gray-700 leading-relaxed mb-6 font-light">
                Mano meile,
              </p>
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-6">
                Ši programa yra mano dovana tau – sukurta su meile ir rūpesčiu, 
                kad padėtų tau studijose ir primintų, kaip labai tave myliu.
              </p>
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-6">
                Tu esi nepakartojama, protinga ir nuostabi. 
                Kiekvieną dieną su tavimi yra dovana, ir aš esu be galo laimingas galėdamas būti šalia tavęs.
              </p>
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-4">
                Tegul šie metai būna kupini laimės, tikslų pasiekimo ir mažiau gulėjimo lovoj susirietus.
              </p>
              <p className="text-xl md:text-2xl text-gray-700 font-medium mt-6">
                Su meile, visada tavo ❤️
              </p>
            </motion.div>

            {/* Continue button */}
            <AnimatePresence>
              {showButton && (
                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  onClick={onContinue}
                  className="mt-10 btn-primary text-lg px-10 py-4 rounded-full inline-flex items-center gap-3 group"
                >
                  <span>Koks tu nuostabus</span>
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    →
                  </motion.span>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BirthdayGreeting;
