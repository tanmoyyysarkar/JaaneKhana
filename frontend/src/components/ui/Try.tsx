import { useState, useRef, useEffect } from 'react';
import { CloudUpload, File, X, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UserProfile {
  conditions: string[];
  allergies: string[];
  diet: string;
  goal: string;
}

interface Option {
  label: string;
  value: string;
}

interface ProfileOptions {
  conditions: Option[];
  allergies: Option[];
  diets: Option[];
  goals: Option[];
}

export default function DragDropDemo() {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Profile options from backend
  const [profileOptions, setProfileOptions] = useState<ProfileOptions>({
    conditions: [],
    allergies: [],
    diets: [],
    goals: [],
  });

  // Profile state
  const [profile, setProfile] = useState<UserProfile>({
    conditions: [],
    allergies: [],
    diet: '',
    goal: '',
  });

  // Fetch profile options from backend on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/profile/options');
        if (response.ok) {
          const data = await response.json();
          setProfileOptions(data);
        }
      } catch (error) {
        console.error('Failed to fetch profile options:', error);
      }
    };
    fetchOptions();
  }, []);

  const toggleCondition = (value: string) => {
    setProfile(prev => ({
      ...prev,
      conditions: prev.conditions.includes(value)
        ? prev.conditions.filter(c => c !== value)
        : [...prev.conditions, value]
    }));
  };

  const toggleAllergy = (value: string) => {
    setProfile(prev => ({
      ...prev,
      allergies: prev.allergies.includes(value)
        ? prev.allergies.filter(a => a !== value)
        : [...prev.allergies, value]
    }));
  };

  const handleDrag = (e: React.DragEvent) => { e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (fileList: FileList) => {
    const newFiles = Array.from(fileList);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const handleSubmitAnalysis = async () => {
    console.log('handleSubmitAnalysis called');
    console.log('Files array:', files);
    console.log('Files length:', files.length);
    console.log('Profile:', profile);

    if (files.length === 0) {
      alert("Please upload at least one file!");
      return;
    }

    setLoading(true);

    try {
      console.log('First file:', files[0]);

      // Create FormData and append the first image
      const formData = new FormData();
      formData.append('imagePath', files[0]);
      formData.append('profile', JSON.stringify(profile));

      // Log FormData contents
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(key, value);
      }

      // Send POST request to backend
      const response = await fetch('http://localhost:3000/api/gemini/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Console log the analysis result
      console.log("Analysis Result:", result);

      // Handle the new response format { analysis: "..." }
      const analysisText = result.analysis || result;
      setAnalysisResult(analysisText);

      // Fetch TTS audio for the analysis result
      try {
        const text = typeof analysisText === 'string'
          ? analysisText
          : JSON.stringify(analysisText, null, 2);

        const ttsResp = await fetch('http://localhost:3000/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (ttsResp.ok) {
          const ttsData = await ttsResp.json();
          if (ttsData?.url) {
            setAudioUrl(ttsData.url);
            if (!audioRef.current) {
              audioRef.current = new Audio(ttsData.url);
            } else {
              audioRef.current.src = ttsData.url;
            }
          }
        }
      } catch (ttsError) {
        console.error('TTS fetch failed:', ttsError);
      }

    } catch (error) {
      console.error("Error during analysis:", error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to analyze image'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-black text-center">Upload Food Label</h2>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left side - Upload Box */}
        <div className="flex-1">
          <div
            className={`relative flex flex-col items-center justify-center w-full min-h-[300px] p-8 border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out ${dragActive
              ? "border-green-500 bg-black scale-[1.01]"
              : "border-gray-300 bg-[#f4fde3] hover:bg-[#edfecd]"
              }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleChange}
              accept="image/*,application/pdf"
            />

            <div className="flex flex-col items-center text-center space-y-4 pointer-events-none">
              <div className={`p-4 rounded-full transition-colors ${dragActive ? 'bg-green-300' : 'bg-white shadow-sm'}`}>
                <CloudUpload
                  className={`w-12 h-12 ${dragActive ? 'text-blue-600' : 'text-gray-400'}`}
                />
          </div>

          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-700">
              Drag & Drop files here
            </p>
            <p className="text-sm text-gray-500">
              or
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={(e) => {
              // We need to prevent the drag events from firing on the button click if they propagate
              // but pointer-events-none on parent wrapper handles simple cases.
              // However, the button needs pointer-events-auto.
              // Best structure: The overlay handles drag, content is z-indexed or structured cleanly.
              // Here we just proxy the click.
              // Since the parent div listens to click? No, parent listens to drag.
              // We need to make sure the Button is clickable.
              e.stopPropagation(); // Stop propagation to avoid any parent click handlers if they existed
              onButtonClick();
            }}
            className="pointer-events-auto border-blue-200 text-blue-600 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-300 px-8"
          >
            Browse Files
          </Button>

          <p className="text-xs text-gray-400 mt-4">
            Supported formats: PDF, JPG, PNG
          </p>
        </div>
      </div>
        </div>

        {/* Right side - Profile Menu */}
        <div className="w-full md:w-72 bg-white border border-gray-200 rounded-xl p-4 space-y-4 h-fit">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Your Profile</h3>
          
          {/* Health Conditions */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Health Conditions</label>
            <div className="flex flex-wrap gap-2">
              {profileOptions.conditions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleCondition(opt.value)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    profile.conditions.includes(opt.value)
                      ? 'bg-lime-500 text-white border-lime-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-lime-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Allergies */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Allergies</label>
            <div className="flex flex-wrap gap-2">
              {profileOptions.allergies.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleAllergy(opt.value)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    profile.allergies.includes(opt.value)
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-red-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Diet */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Diet</label>
            <div className="flex flex-wrap gap-2">
              {profileOptions.diets.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProfile(prev => ({ ...prev, diet: opt.value }))}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    profile.diet === opt.value
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Goal</label>
            <div className="flex flex-wrap gap-2">
              {profileOptions.goals.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProfile(prev => ({ ...prev, goal: opt.value }))}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    profile.goal === opt.value
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-8 space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Selected Files</h3>
          <div className="grid gap-3">
            {files.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="group flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="p-2 bg-blue-50 rounded-md">
                    <File className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-gray-700 truncate max-w-[200px] sm:max-w-xs">{file.name}</span>
                    <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                <button
                  onClick={() => removeFile(idx)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <Button
              onClick={handleSubmitAnalysis}
              disabled={loading}
              className="bg-blue-900 hover:bg-blue-800 text-white px-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Analyzing..." : "Submit Analysis"}
            </Button>
          </div>

          {/* Analysis Result Section */}
          {analysisResult && (
            <div className="mt-6 p-6 bg-white border border-blue-200 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <h3 className="text-lg font-semibold text-blue-900">Analysis Result</h3>
                {audioUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-200 text-blue-900 hover:bg-blue-50 flex items-center gap-2"
                    onClick={() => {
                      audioRef.current?.play();
                    }}
                  >
                    <Volume2 className="w-4 h-4" />
                    Play Audio
                  </Button>
                )}
                <audio ref={(el) => { if (el) audioRef.current = el; }} style={{ display: 'none' }} />
              </div>

              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap text-sm text-gray-700 font-sans bg-gray-50 p-4 rounded-lg">
                  {typeof analysisResult === 'string' ? analysisResult : JSON.stringify(analysisResult, null, 2)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
