import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, Loader2, CheckCircle, AlertCircle, Book, Heart, Database } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { storeDocumentChunks, initializeOpenAI, initializePinecone, setupPineconeIndex, isElectronAvailable } from '../utils/rag';

// Electron IPC for file operations
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

interface UploadPageProps {
  onNavigate: (page: 'upload' | 'summary' | 'flashcards' | 'chat') => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ onNavigate }) => {
  const {
    addDocument,
    updateDocument,
    apiKey,
    pineconeApiKey,
    currentDocument,
    documents,
    setCurrentDocument
  } = useApp();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [embeddingProgress, setEmbeddingProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<'parsing' | 'embedding' | 'complete'>('parsing');
  const [error, setError] = useState<string | null>(null);

  const explicitBoxPadding = {
    paddingInline: '28px',
    paddingBlock: '22px',
  };

  const processFile = async (filePath: string) => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(10);
    setEmbeddingProgress(0);
    setCurrentStep('parsing');

    try {
      // Simulate progress for PDF parsing
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      let result;

      if (ipcRenderer) {
        // Electron environment
        result = await ipcRenderer.invoke('read-pdf', filePath);
      } else {
        // Browser environment (for development)
        // Mock data for testing
        await new Promise(resolve => setTimeout(resolve, 2000));
        result = {
          success: true,
          text: 'This is a mock PDF content for testing purposes. It contains various legal concepts including Administrative Law, Constitutional Law, Criminal Law, and Civil Law. Administrative law governs the activities of administrative agencies of government. Constitutional law is a body of law which defines the relationship between different branches of government. Criminal law is the body of law that relates to crime. Civil law deals with behavior that constitutes an injury to an individual or other private party. This content is long enough to create meaningful embeddings for testing RAG functionality.',
          numPages: 42,
          fileName: 'Test Document.pdf',
        };
      }

      clearInterval(progressInterval);

      if (result.success) {
        setUploadProgress(100);

        const newDoc = {
          id: Date.now().toString(),
          name: result.fileName,
          text: result.text,
          pageCount: result.numPages,
          uploadedAt: new Date(),
          hasEmbeddings: false,
          embeddingProgress: 0,
        };

        // Add document first
        addDocument(newDoc);

        // Create enhanced features
        setCurrentStep('embedding');
        setEmbeddingProgress(0);

        try {
          if (!apiKey || !pineconeApiKey) {
            setError('Pažangi paieška šiuo metu nepasiekiama. Dokumentas išsaugotas ir galima naudoti pagrindines funkcijas.');
            updateDocument(newDoc.id, {
              hasEmbeddings: false,
              embeddingProgress: 0
            });
          } else if (!isElectronAvailable()) {
            setError('Pažangi paieška veikia tik programėlėje. Galima naudoti pagrindines funkcijas.');
            updateDocument(newDoc.id, {
              hasEmbeddings: false,
              embeddingProgress: 0
            });
          } else {
            initializeOpenAI(apiKey);
            await initializePinecone(pineconeApiKey);

            await setupPineconeIndex();

            await storeDocumentChunks(
              newDoc.id,
              newDoc.name,
              newDoc.text,
              (progress) => setEmbeddingProgress(progress)
            );

            updateDocument(newDoc.id, {
              hasEmbeddings: true,
              embeddingProgress: 100
            });
          }
        } catch (embeddingError) {
          console.error('Error creating enhanced features:', embeddingError);
          updateDocument(newDoc.id, {
            hasEmbeddings: false,
            embeddingProgress: 0
          });
        }

        setCurrentStep('complete');

        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          setEmbeddingProgress(0);
        }, 1000);
      } else {
        throw new Error(result.error || 'Failed to process PDF');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsUploading(false);
      setUploadProgress(0);
      setEmbeddingProgress(0);
    }
  };

  const handleSelectFile = async () => {
    if (!ipcRenderer) {
      // Development mode - simulate file selection
      processFile('/mock/path/document.pdf');
      return;
    }

    const filePath = await ipcRenderer.invoke('select-pdf');
    if (filePath) {
      processFile(filePath);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-content space-y-7 sm:space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="page-hero"
        >
          <h1 className="section-title font-serif gradient-text mb-2">Įkelti dokumentą</h1>
          <p className="text-gray-500 text-sm sm:text-base max-w-2xl">
            Pasirink PDF dokumentą, kurį nori studijuoti.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 24 }}
          className={`
            surface relative text-center min-h-75 sm:min-h-85 px-6 sm:px-10 py-8
            flex items-center justify-center transition-all duration-300
            ${isUploading ? 'pointer-events-none' : 'cursor-pointer'}
          `}
          style={{
            border: '2px dashed rgba(244, 114, 182, 0.35)',
          }}
          whileHover={!isUploading ? {
            borderColor: 'rgba(217, 70, 239, 0.6)',
            boxShadow: '0 0 0 4px rgba(232, 121, 249, 0.12)',
          } : {}}
          onClick={!isUploading ? handleSelectFile : undefined}
          onKeyDown={(event) => {
            if (isUploading) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleSelectFile();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Pasirinkti PDF failą"
        >
          {isUploading ? (
            <div className="w-full max-w-md mx-auto space-y-5">
              <div
                className="inline-flex items-center justify-center w-20 h-20 rounded-full shadow-md"
                style={{background: 'linear-gradient(135deg, var(--pink-100) 0%, var(--purple-100) 100%)'}}
              >
                {currentStep === 'embedding' ? (
                  <Database className="w-10 h-10 animate-pulse" style={{color: 'var(--purple-500)'}} />
                ) : currentStep === 'complete' ? (
                  <CheckCircle className="w-10 h-10 text-green-500" />
                ) : (
                  <Loader2 className="w-10 h-10 animate-spin" style={{color: 'var(--fuchsia-500)'}} />
                )}
              </div>

              <div>
                <p className="text-xl font-semibold text-gray-800 mb-1">
                  {currentStep === 'parsing' && 'Apdorojamas dokumentas...'}
                  {currentStep === 'embedding' && 'Paruošiama išmani paieška...'}
                  {currentStep === 'complete' && 'Baigta'}
                </p>
                <p className="text-sm text-gray-500">
                  {currentStep === 'parsing' && 'Išgaunamas tekstas iš PDF'}
                  {currentStep === 'embedding' && 'Tai užtruks kelias sekundes'}
                  {currentStep === 'complete' && 'Dokumentas paruoštas naudojimui'}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>PDF apdorojimas</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="progress-track">
                    <motion.div
                      className="progress-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                </div>

                {(currentStep === 'embedding' || currentStep === 'complete') && (
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Paieška</span>
                      <span>{embeddingProgress}%</span>
                    </div>
                    <div className="progress-track">
                      <motion.div
                        className="progress-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${embeddingProgress}%` }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto flex flex-col items-center">
              <motion.div
                className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-6 shadow-lg"
                style={{background: 'linear-gradient(135deg, var(--pink-100) 0%, var(--purple-100) 100%)'}}
                whileHover={{ scale: 1.08, rotate: 4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              >
                <Upload className="w-12 h-12" style={{color: 'var(--fuchsia-500)'}} />
              </motion.div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                Pasirink PDF failą
              </p>
              <p className="text-gray-500 mb-7">Palaikomi tik PDF formatai</p>
              <motion.button
                className="btn-primary min-h-11.5 px-8 text-base"
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              >
                Pasirinkti PDF failą
              </motion.button>
            </div>
          )}

          {uploadProgress === 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-white/92 rounded-2xl"
            >
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-3">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <p className="text-base font-semibold text-gray-800">Sėkmingai įkelta</p>
              </div>
            </motion.div>
          )}
        </motion.div>

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

        {currentDocument && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 24 }}
            className="space-y-4"
          >
            <h2 className="section-title font-serif gradient-text">Dabartinis dokumentas</h2>
            <div
              className="card"
              style={{
                ...explicitBoxPadding,
                borderLeftWidth: '4px',
                borderLeftColor: 'var(--pink-400)'
              }}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center shrink-0">
                    <Book className="w-6 h-6 text-pink-500" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{currentDocument.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {currentDocument.pageCount} puslapiai • {currentDocument.text.length.toLocaleString()} simbolių
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <button onClick={() => onNavigate('summary')} className="btn-secondary btn-sm">Santrauka</button>
                  <button onClick={() => onNavigate('flashcards')} className="btn-secondary btn-sm">Kortelės</button>
                  <button onClick={() => onNavigate('chat')} className="btn-secondary btn-sm">Pokalbis</button>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {documents.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 24 }}
            className="space-y-4"
          >
            <h2 className="section-title font-serif gradient-text flex items-center gap-2">
              <Heart className="w-5 h-5" style={{color: 'var(--pink-500)'}} />
              Tavo biblioteka
            </h2>

            <div className="grid gap-4 sm:gap-5">
              {documents.map((doc) => (
                <motion.div
                  key={doc.id}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  onClick={() => setCurrentDocument(doc)}
                  className={`
                    card cursor-pointer
                    ${currentDocument?.id === doc.id ? 'border-pink-300 ring-2 ring-pink-100' : ''}
                  `}
                  style={currentDocument?.id === doc.id
                    ? { ...explicitBoxPadding, borderLeftColor: 'var(--fuchsia-400)', borderLeftWidth: '4px' }
                    : { ...explicitBoxPadding, borderLeftWidth: '4px', borderLeftColor: 'rgba(244,114,182,0.25)' }
                  }
                >
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center shrink-0">
                      <Book className="w-5 h-5 text-pink-500" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 text-lg truncate">{doc.name}</h3>
                          <p className="text-sm text-gray-600">{doc.pageCount} puslapiai • {Math.round(doc.text.length / 1000)}k žodžių</p>
                          <p className="text-xs text-gray-400 mt-1">Įkelta: {new Date(doc.uploadedAt).toLocaleDateString('lt-LT')}</p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {doc.hasEmbeddings && (
                            <span className="badge badge-green">
                              Išmani paieška
                            </span>
                          )}
                          {currentDocument?.id === doc.id && (
                            <span className="badge badge-vibrant">Aktyvus</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentDocument(doc);
                            onNavigate('summary');
                          }}
                          className="btn-secondary btn-sm"
                        >
                          Santrauka
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentDocument(doc);
                            onNavigate('flashcards');
                          }}
                          className="btn-secondary btn-sm"
                        >
                          Kortelės
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentDocument(doc);
                            onNavigate('chat');
                          }}
                          className="btn-secondary btn-sm"
                        >
                          Pokalbis
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div
              className="blob-bg rounded-2xl"
              style={{
                ...explicitBoxPadding,
                background: 'linear-gradient(135deg, var(--purple-100) 0%, rgba(232,121,249,0.15) 50%, var(--violet-300) 100%)',
                border: '1px solid rgba(192, 132, 252, 0.3)',
                boxShadow: 'var(--shadow-purple)'
              }}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl" style={{background: 'linear-gradient(135deg, var(--purple-200) 0%, var(--fuchsia-300) 100%)'}}>
                  <Database className="w-5 h-5" style={{color: 'var(--purple-700)'}} />
                </div>
                <div>
                  <h4 className="font-bold mb-1" style={{color: 'var(--purple-700)'}}>Išmani paieška</h4>
                  <p className="text-sm leading-relaxed" style={{color: 'var(--purple-600)'}}>
                    Dokumentai su ženkliuku "Išmani paieška" suteikia tikslesnius ir gilesnius atsakymus pokalbiuose.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
};

export default UploadPage;
