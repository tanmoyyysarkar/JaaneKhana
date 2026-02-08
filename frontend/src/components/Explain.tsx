import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useExplain } from '@/context/ExplainContext';
import { genChat } from 'dev-ai-sdk';

const ai = new genChat({
  google: {
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  },
});

export default function ExplainModal(){
  const { isOpen, closeExplain } = useExplain();
  const [text, setText] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchExplanation = async () => {
      setLoading(true);
      setText(null);
      setError(null);
      
      try {
        const result = await ai.generate({
          google: {
            model: 'gemini-2.5-flash',
            system: 'you are a website assistant bot that reads the html content of a website and then gives proper easily, short, brief details of the site to people who are lazy and do not have time to read the contents of the site, much like tldr, just add text no symbols and all',
            prompt: `${document.body.outerHTML}`
          }
        });
        setText(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchExplanation();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Page Explanation</h2>
          <button
            onClick={closeExplain}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Analyzing page...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-semibold">Error</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          )}

          {text && !loading && (
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                {String(text.data || text)}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex justify-end">
          <button
            onClick={closeExplain}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
