import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Pill, 
  User, 
  Calendar, 
  Activity,
  ChevronRight,
  Download,
  History,
  Trash2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { processPrescriptionImage, PrescriptionResult } from './services/gemini';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PrescriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedFiles, setSavedFiles] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load results from localStorage on mount
  useEffect(() => {
    const savedResult = localStorage.getItem('lastPrescriptionResult');
    if (savedResult) {
      try {
        setResult(JSON.parse(savedResult));
      } catch (err) {
        console.error('Failed to load saved result:', err);
      }
    }
    // Load saved files list
    loadSavedFiles();
  }, []);

  const loadSavedFiles = async () => {
    try {
      const response = await fetch('/api/results');
      const data = await response.json();
      setSavedFiles(data.results || []);
    } catch (err) {
      console.error('Failed to load saved files:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (file: File) => {
    setFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
      setError(null);
      // Don't clear result here - keep showing previous result if exists
    };
    reader.readAsDataURL(file);
  };

  const downloadFile = (filename: string) => {
    // Create a link to download the file
    window.location.href = `/api/results/${filename}`;
  };

  const clearCurrentResult = () => {
    setResult(null);
    localStorage.removeItem('lastPrescriptionResult');
    setSaveMessage(null);
    setImage(null);
    setFile(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleProcess = async () => {
    if (!image || !file) return;

    setLoading(true);
    setError(null);
    setSaveMessage(null);
    try {
      const data = await processPrescriptionImage(image, file.type);
      setResult(data);
      
      // Save to localStorage as backup
      localStorage.setItem('lastPrescriptionResult', JSON.stringify(data));
      localStorage.setItem('lastPrescriptionTimestamp', new Date().toISOString());
      
      // Save to backend database
      await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });

      // Save as JSON file
      const saveResponse = await fetch('/api/save-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: data }),
      });

      if (saveResponse.ok) {
        const saveData = await saveResponse.json();
        setSaveMessage(`✓ Result saved to: ${saveData.filename}`);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to process prescription. Please try a clearer image.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!result) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(16, 185, 129); // Emerald-600
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('RxScan AI - Prescription Report', 20, 25);

    // Metadata
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Doctor: ${result.metadata.doctor_name || 'N/A'}`, 20, 55);
    doc.text(`Date: ${result.metadata.prescription_date || 'N/A'}`, 20, 62);
    doc.text(`Confidence: ${Math.round(result.confidence * 100)}%`, 20, 69);

    // Medications Table
    const tableData = result.medications.map(med => [
      med.name,
      med.dosage,
      med.frequency,
      med.duration,
      med.instructions
    ]);

    autoTable(doc, {
      startY: 80,
      head: [['Medication', 'Dosage', 'Frequency', 'Duration', 'Instructions']],
      body: tableData,
      headStyles: { fillColor: [16, 185, 129] },
      alternateRowStyles: { fillColor: [245, 245, 244] },
      margin: { top: 80 },
    });

    // Footer
    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by RxScan AI. For clinical decision support only.', 20, finalY + 20);

    doc.save(`Prescription_${result.metadata.prescription_date || 'Report'}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#141414] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Pill className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">RxScan AI</span>
          </div>
         
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Upload & Preview */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Prescription Processor</h1>
              <p className="text-neutral-500">Upload a photo of your prescription to extract medication details automatically.</p>
            </div>

            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative aspect-[3/4] rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden
                ${image ? 'border-emerald-500 bg-white' : 'border-neutral-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/30'}
              `}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*"
              />
              
              {image ? (
                <img src={image} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                    <Upload className="text-emerald-600 w-8 h-8" />
                  </div>
                  <p className="font-semibold">Click or drag image here</p>
                  <p className="text-sm text-neutral-400 mt-1">Supports JPG, PNG, PDF</p>
                </div>
              )}
            </div>

            <button
              disabled={!image || loading}
              onClick={handleProcess}
              className={`
                w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all
                ${!image || loading 
                  ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' 
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-[0.98]'}
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Activity className="w-6 h-6" />
                  Analyze Prescription
                </>
              )}
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3 text-red-700"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </motion.div>
            )}

            {saveMessage && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-3 text-emerald-700"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0 flex-shrink-0" />
                <p className="text-sm">{saveMessage}</p>
              </motion.div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Summary Card */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 className="w-6 h-6" />
                        <span className="font-bold text-lg">Analysis Complete</span>
                      </div>
                      <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
                        {Math.round(result.confidence * 100)}% Confidence
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-neutral-400 text-xs font-bold uppercase tracking-wider">
                          <User className="w-3 h-3" />
                          Doctor
                        </div>
                        <p className="font-semibold">{result.metadata.doctor_name || 'Not detected'}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-neutral-400 text-xs font-bold uppercase tracking-wider">
                          <Calendar className="w-3 h-3" />
                          Date
                        </div>
                        <p className="font-semibold">{result.metadata.prescription_date || 'Not detected'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Medications List */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Pill className="w-5 h-5 text-emerald-600" />
                      Medications Detected ({result.medications.length})
                    </h3>
                    
                    {result.medications.map((med, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-black/5 hover:border-emerald-200 transition-all group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-bold text-xl text-emerald-900">{med.name}</h4>
                            <p className="text-emerald-600 font-medium">{med.dosage}</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                            <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-emerald-500" />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="p-3 bg-neutral-50 rounded-xl">
                            <span className="text-neutral-400 block text-[10px] font-bold uppercase tracking-widest mb-1">Frequency</span>
                            <span className="font-semibold">{med.frequency}</span>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded-xl">
                            <span className="text-neutral-400 block text-[10px] font-bold uppercase tracking-widest mb-1">Duration</span>
                            <span className="font-semibold">{med.duration}</span>
                          </div>
                        </div>

                        {med.instructions && (
                          <div className="mt-4 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                            <span className="text-emerald-700/60 block text-[10px] font-bold uppercase tracking-widest mb-1">Instructions</span>
                            <p className="text-emerald-800 text-sm italic">"{med.instructions}"</p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={handleExportPDF}
                      className="flex-1 py-4 border-2 border-black rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black hover:text-white transition-all"
                    >
                      <Download className="w-5 h-5" />
                      Export as PDF
                    </button>
                    <button 
                      onClick={clearCurrentResult}
                      className="flex-1 py-4 border-2 border-red-200 text-red-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-all"
                    >
                      <X className="w-5 h-5" />
                      Clear
                    </button>
                  </div>

                  <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full py-3 bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:from-emerald-100 hover:to-emerald-200 transition-all"
                  >
                    <History className="w-5 h-5" />
                    View History ({savedFiles.length})
                  </button>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-neutral-200 rounded-3xl bg-white/50">
                  <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
                    <FileText className="text-neutral-300 w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-neutral-400">No Analysis Yet</h3>
                  <p className="text-neutral-400 max-w-xs mt-2">Upload and process a prescription to see the structured results here.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHistory(false)}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white border-b border-neutral-200 p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="w-6 h-6 text-emerald-600" />
                  <h2 className="text-2xl font-bold">Saved Results</h2>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-3">
                {savedFiles.length === 0 ? (
                  <div className="text-center py-12 text-neutral-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No saved results yet</p>
                  </div>
                ) : (
                  savedFiles.map((filename) => (
                    <motion.div
                      key={filename}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all group"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-emerald-900">{filename}</p>
                        <p className="text-xs text-emerald-600 mt-1">
                          {new Date(filename.match(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/) || '').toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => downloadFile(filename)}
                        className="p-3 bg-white border border-emerald-300 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>

              <div className="sticky bottom-0 bg-neutral-50 border-t border-neutral-200 p-6 flex gap-3">
                <button
                  onClick={() => loadSavedFiles()}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                >
                  Refresh List
                </button>
                <button
                  onClick={() => setShowHistory(false)}
                  className="flex-1 py-3 bg-neutral-200 text-neutral-700 rounded-xl font-bold hover:bg-neutral-300 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-black/5 text-center text-neutral-400 text-sm">
        <p>© 2026 RxScan AI. For clinical decision support only. Always verify with a pharmacist.</p>
      </footer>
    </div>
  );
}
