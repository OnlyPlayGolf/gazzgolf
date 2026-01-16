import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
// Dynamic import for Tesseract to avoid blocking initial load
let createWorker: any;

// Load Tesseract dynamically
const loadTesseract = async () => {
  if (!createWorker) {
    try {
      // Import Tesseract - handle both ESM and CommonJS
      const tesseractModule = await import("tesseract.js");
      // Tesseract.js exports createWorker as a named export
      createWorker = tesseractModule.createWorker || (tesseractModule.default && tesseractModule.default.createWorker);
      
      if (!createWorker || typeof createWorker !== 'function') {
        throw new Error('createWorker not found in tesseract.js module');
      }
    } catch (error: any) {
      console.error('Failed to import tesseract.js:', error);
      throw new Error(`Failed to load Tesseract.js: ${error.message}`);
    }
  }
  return { createWorker };
};
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Camera, Upload, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TopNavBar } from "@/components/TopNavBar";

interface ParsedScorecard {
  courseName: string | null;
  scores: (number | null)[];
  rawText: string;
}

export default function ScorecardScanner() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsedData, setParsedData] = useState<ParsedScorecard | null>(null);
  const [editing, setEditing] = useState(false);
  const [manualCourseName, setManualCourseName] = useState<string>("");
  const [ocrProvider, setOcrProvider] = useState<'google' | 'tesseract'>('google');
  const [googleApiKey, setGoogleApiKey] = useState<string>("");

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setParsedData(null);
  };

  const processImageWithGoogle = async () => {
    if (!imageFile) {
      toast({
        title: "No image selected",
        description: "Please select an image first",
        variant: "destructive",
      });
      return;
    }

    if (!googleApiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your Google Cloud Vision API key. Get one at https://console.cloud.google.com/apis/credentials",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    setProgress(0);
    setParsedData(null);

    try {
      setProgress(10);
      
      // Convert image to base64
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data:image/...;base64, prefix
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      setProgress(30);

      // Call Google Cloud Vision API
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                image: {
                  content: base64Image,
                },
                features: [
                  {
                    type: 'DOCUMENT_TEXT_DETECTION',
                    maxResults: 1,
                  },
                ],
              },
            ],
          }),
        }
      );

      setProgress(70);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      setProgress(90);

      const text = data.responses?.[0]?.fullTextAnnotation?.text || '';
      
      if (!text) {
        throw new Error('No text detected in image');
      }

      setProgress(100);

      // Parse the extracted text
      const parsed = parseScorecard(text);
      if (manualCourseName) {
        parsed.courseName = manualCourseName;
      }
      setParsedData(parsed);
      
      const foundScores = parsed.scores.filter(s => s !== null).length;
      toast({
        title: "Scan complete",
        description: foundScores > 0 
          ? `Found ${foundScores} scores${parsed.courseName ? ` and course: ${parsed.courseName}` : ''}`
          : "No scores found. Try a clearer image or edit manually.",
      });
    } catch (error: any) {
      console.error('Google Vision API Error:', error);
      toast({
        title: "Scan failed",
        description: error.message || "Failed to process image with Google Vision API",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const processImage = async () => {
    if (ocrProvider === 'google') {
      return processImageWithGoogle();
    }

    // Tesseract.js implementation (existing code)
    console.log('=== processImage FUNCTION CALLED ===');
    console.log('imageFile:', imageFile);
    
    if (!imageFile) {
      console.log('No image file - showing error');
      toast({
        title: "No image selected",
        description: "Please select an image first",
        variant: "destructive",
      });
      return;
    }

    console.log('processImage called with file:', imageFile.name, imageFile.size, imageFile.type);
    setProcessing(true);
    setProgress(0);
    setParsedData(null);

    let worker: any = null;

    try {
      // Show initial progress
      setProgress(5);
      console.log('Step 1: Setting progress to 5%');
      
      // Load Tesseract dynamically
      console.log('Step 2: Loading Tesseract.js...');
      try {
        const { createWorker: createWorkerFn } = await loadTesseract();
        console.log('Step 2.5: Tesseract loaded, createWorker available:', typeof createWorkerFn);
        
        if (!createWorkerFn || typeof createWorkerFn !== 'function') {
          throw new Error('Tesseract.js failed to load. createWorker is not a function.');
        }
        
        // Create worker - this can take a moment, especially first time
        console.log('Step 3: Creating Tesseract worker...');
        
        // Add timeout warning
        const workerTimeout = setTimeout(() => {
          console.log('Worker creation taking longer than 5 seconds...');
          toast({
            title: "Loading Tesseract...",
            description: "This may take 10-30 seconds on first use. Please wait...",
            duration: 5000,
          });
        }, 5000);
        
        console.log('Step 4: Calling createWorker...');
        
        // Add a timeout to worker creation (90 seconds max for first-time download)
        const workerPromise = createWorkerFn('eng');
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Worker creation timed out after 90 seconds. This usually means the language files are downloading. Please check your internet connection and try again.')), 90000);
        });
        
        worker = await Promise.race([workerPromise, timeoutPromise]);
        console.log('Step 4: Worker created successfully');
        clearTimeout(workerTimeout);
        setProgress(20);
        // Note: In Tesseract.js v7, workers come pre-loaded, so we don't need to call load()
      } catch (loadError: any) {
        console.error('Error loading or creating Tesseract worker:', loadError);
        throw new Error(`Failed to initialize OCR: ${loadError.message || 'Unknown error'}`);
      }
      
      // Configure for better text recognition
      console.log('Setting parameters...');
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: '6', // Assume uniform block of text
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -.,()',
        });
        console.log('Parameters set successfully');
        setProgress(25);
      } catch (paramError: any) {
        console.error('Error setting parameters:', paramError);
        // Continue anyway - parameters are optional
        setProgress(25);
      }

      console.log('Starting OCR recognition...');
      console.log('Image file details:', {
        name: imageFile.name,
        size: imageFile.size,
        type: imageFile.type,
      });
      
      // Convert File to a format Tesseract can handle better
      // Try using the image preview URL if available, otherwise use the file directly
      let imageSource: File | string = imageFile;
      if (imagePreview) {
        console.log('Using image preview URL for recognition');
        imageSource = imagePreview;
      } else {
        console.log('Using File object directly for recognition');
      }
      
      // Show that we're starting recognition (in case logger doesn't fire immediately)
      setProgress(30);
      
      console.log('Calling worker.recognize with:', {
        sourceType: typeof imageSource,
        isFile: imageSource instanceof File,
        isString: typeof imageSource === 'string',
      });
      
      // In Tesseract.js v7, logger functions can't be passed directly to workers
      // Instead, we'll use a progress interval and call recognize without logger
      // Set up a progress interval to show activity
      let progressInterval: NodeJS.Timeout | null = null;
      let currentProgress = 30;
      
      // Simulate progress while recognition is happening
      progressInterval = setInterval(() => {
        if (currentProgress < 90) {
          currentProgress += 2;
          setProgress(currentProgress);
        }
      }, 500);
      
      // Add a timeout wrapper for the recognition call
      // Note: In v7, we can't pass logger function directly due to DataCloneError
      const recognitionPromise = worker.recognize(imageSource);
      
      // Add timeout for recognition (2 minutes max)
      const recognitionTimeout = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Recognition timed out after 2 minutes. The image might be too large or complex.'));
        }, 120000);
      });
      
      let recognitionResult;
      try {
        console.log('Waiting for recognition to complete...');
        recognitionResult = await Promise.race([recognitionPromise, recognitionTimeout]);
        console.log('Recognition result received:', recognitionResult);
        
        // Clear the progress interval
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
      } catch (recognizeError: any) {
        console.error('Error during recognition:', recognizeError);
        // Clear the progress interval on error
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
        throw new Error(`OCR recognition failed: ${recognizeError.message || 'Unknown error'}`);
      }
      
      const { data: { text } } = recognitionResult;

      setProgress(95);
      console.log('OCR complete, text length:', text.length);

      // Terminate worker
      await worker.terminate();
      worker = null;
      setProgress(100);

      // Parse the extracted text
      const parsed = parseScorecard(text);
      // Use manual course name if provided, otherwise use OCR result
      if (manualCourseName) {
        parsed.courseName = manualCourseName;
      }
      setParsedData(parsed);
      
      const foundScores = parsed.scores.filter(s => s !== null).length;
      toast({
        title: "Scan complete",
        description: foundScores > 0 
          ? `Found ${foundScores} scores${parsed.courseName ? ` and course: ${parsed.courseName}` : ''}`
          : "No scores found. Try a clearer image or edit manually.",
      });
    } catch (error: any) {
      console.error('OCR Error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        cause: error.cause,
      });
      
      let errorMessage = "Failed to process image.";
      let errorTitle = "Scan failed";
      
      // Provide more specific error messages
      if (error.message) {
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          errorTitle = "Scan timed out";
          errorMessage = "The scan took too long. This might be your first time using OCR - it needs to download language files (10-30 seconds). Please try again with a stable internet connection.";
        } else if (error.message.includes('Worker') || error.message.includes('worker')) {
          errorTitle = "Worker initialization failed";
          errorMessage = "Failed to initialize OCR worker. Please check your browser console (F12) and try refreshing the page.";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorTitle = "Network error";
          errorMessage = "Failed to download OCR language files. Please check your internet connection and try again.";
        } else {
          errorMessage = error.message;
        }
      } else if (error.toString) {
        errorMessage = error.toString();
      }
      
      toast({
        title: errorTitle,
        description: `${errorMessage}\n\nCheck browser console (F12) for technical details.`,
        variant: "destructive",
        duration: 15000,
      });
    } finally {
      // Make sure worker is terminated
      if (worker) {
        try {
          console.log('Terminating worker...');
          await worker.terminate();
          console.log('Worker terminated');
        } catch (e) {
          console.error('Error terminating worker:', e);
        }
      }
      setProcessing(false);
      // Keep progress at 100 if successful, reset if failed
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const parseScorecard = (text: string): ParsedScorecard => {
    console.log('=== PARSING SCORECARD ===');
    console.log('Raw OCR text:', text);
    console.log('Text length:', text.length);
    
    // Split by newlines and also by common separators
    const lines = text
      .split(/[\n\r]+/)
      .map(l => l.trim())
      .filter(l => l.length > 0);
    
    console.log('Total lines:', lines.length);
    console.log('Lines:', lines);
    
    // Try to find course name (usually in first few lines, contains letters)
    let courseName: string | null = null;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      // Course name usually has letters and is longer
      if (line.length > 5 && /[A-Za-z]/.test(line) && !/^\d+$/.test(line)) {
        // Exclude common scorecard headers
        if (!line.toLowerCase().includes('hole') && 
            !line.toLowerCase().includes('score') &&
            !line.toLowerCase().includes('par') &&
            !line.toLowerCase().includes('total') &&
            !line.toLowerCase().includes('yard') &&
            !line.toLowerCase().includes('handicap')) {
          courseName = line;
          break;
        }
      }
    }

    // Extract scores - look for patterns like:
    // "1 4", "Hole 1: 4", "1. 4", "1  4", "1\t4", table formats, etc.
    const scores: (number | null)[] = Array(18).fill(null);
    
    // More comprehensive patterns
    const patterns = [
      // Pattern 1: Simple "hole score" format (e.g., "1 4", "2 5", "10 3")
      /^(\d{1,2})[.\s\t]+(\d{1,2})$/,
      
      // Pattern 2: "Hole X: Y" or "H X: Y" format
      /(?:hole|h)[\s:]*(\d{1,2})[\s:]+(\d{1,2})/i,
      
      // Pattern 3: Table format with multiple numbers (hole, par, score, etc.)
      /(\d{1,2})[\s\t]+(\d{1,2})[\s\t]+(\d{1,2})/,
      
      // Pattern 4: "1-4" or "1/4" format
      /^(\d{1,2})[-/](\d{1,2})$/,
      
      // Pattern 5: Numbers separated by multiple spaces or tabs
      /(\d{1,2})[\s\t]{2,}(\d{1,2})/,
    ];

    // Also try to extract all numbers from lines and match them
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Try each pattern
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          let hole: number;
          let score: number;
          
          // Handle different pattern groups
          if (match.length === 3) {
            // Two groups: hole and score
            hole = parseInt(match[1]);
            score = parseInt(match[2]);
          } else if (match.length === 4) {
            // Three groups: might be hole, par, score
            hole = parseInt(match[1]);
            score = parseInt(match[3]); // Usually score is last
            // But also check if second group is score
            const score2 = parseInt(match[2]);
            if (score2 >= 1 && score2 <= 15 && (score < 1 || score > 15)) {
              score = score2;
            }
          } else {
            continue;
          }
          
          if (hole >= 1 && hole <= 18 && score >= 1 && score <= 15) {
            // Only update if not already set (first match wins)
            if (scores[hole - 1] === null) {
              scores[hole - 1] = score;
              console.log(`Found score: Hole ${hole} = ${score} (from line: "${line}")`);
            }
            break; // Move to next line after finding a match
          }
        }
      }
      
      // If no pattern matched, try extracting all numbers and see if they form hole/score pairs
      const numbers = line.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        for (let j = 0; j < numbers.length - 1; j++) {
          const num1 = parseInt(numbers[j]);
          const num2 = parseInt(numbers[j + 1]);
          
          // Check if first number is a hole (1-18) and second is a score (1-15)
          if (num1 >= 1 && num1 <= 18 && num2 >= 1 && num2 <= 15) {
            if (scores[num1 - 1] === null) {
              scores[num1 - 1] = num2;
              console.log(`Found score (number extraction): Hole ${num1} = ${num2} (from line: "${line}")`);
            }
          }
        }
      }
    }

    const foundCount = scores.filter(s => s !== null).length;
    console.log(`=== PARSING COMPLETE ===`);
    console.log(`Found ${foundCount} scores:`, scores);
    console.log(`Course name: ${courseName || 'Not found'}`);

    return {
      courseName,
      scores,
      rawText: text,
    };
  };

  const handleScoreEdit = (holeIndex: number, value: string) => {
    if (!parsedData) return;
    
    const newScores = [...parsedData.scores];
    const numValue = value === '' ? null : parseInt(value);
    if (numValue !== null && (numValue < 1 || numValue > 15)) {
      toast({
        title: "Invalid score",
        description: "Score must be between 1 and 15",
        variant: "destructive",
      });
      return;
    }
    newScores[holeIndex] = numValue;
    setParsedData({ ...parsedData, scores: newScores });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNavBar />
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Scan Scorecard</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Scorecard Photo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Select Image</Label>
              <div className="flex gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      console.log('File selected:', file.name, file.size);
                      handleImageSelect(file);
                    }
                  }}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    console.log('Choose file button clicked');
                    fileInputRef.current?.click();
                  }}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
                {imageFile && (
                  <Button
                    onClick={async () => {
                      console.log('=== SCAN BUTTON CLICKED ===');
                      console.log('Image file:', imageFile);
                      console.log('Processing state:', processing);
                      try {
                        await processImage();
                      } catch (error) {
                        console.error('Error in processImage:', error);
                      }
                    }}
                    disabled={processing}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {processing ? "Scanning..." : "Scan"}
                  </Button>
                )}
              </div>
            </div>

            {/* OCR Provider Selection */}
            <div className="space-y-2">
              <Label>OCR Provider</Label>
              <div className="flex gap-2">
                <Button
                  variant={ocrProvider === 'google' ? 'default' : 'outline'}
                  onClick={() => setOcrProvider('google')}
                  size="sm"
                  className="flex-1"
                >
                  Google Vision API
                </Button>
                <Button
                  variant={ocrProvider === 'tesseract' ? 'default' : 'outline'}
                  onClick={() => setOcrProvider('tesseract')}
                  size="sm"
                  className="flex-1"
                >
                  Tesseract.js
                </Button>
              </div>
            </div>

            {/* Google API Key Input (only show if Google is selected) */}
            {ocrProvider === 'google' && (
              <div className="space-y-2">
                <Label>Google Cloud Vision API Key</Label>
                <Input
                  type="password"
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  disabled={processing}
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Google Cloud Console
                  </a>
                  . For production, use a backend API to keep your key secure.
                </p>
              </div>
            )}

            {/* Course Name Input */}
            <div className="space-y-2">
              <Label>Course Name (Optional)</Label>
              <Input
                value={manualCourseName}
                onChange={(e) => setManualCourseName(e.target.value)}
                placeholder="Enter course name"
                disabled={processing}
              />
            </div>

            {/* Image Preview */}
            {imagePreview && (
              <div className="border rounded-lg overflow-hidden">
                <img
                  src={imagePreview}
                  alt="Scorecard preview"
                  className="w-full h-auto max-h-96 object-contain"
                />
              </div>
            )}

            {/* Processing Progress */}
            {processing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    {progress < 15 ? "Loading Tesseract..." : 
                     progress < 30 ? "Initializing OCR..." :
                     progress < 40 ? "Preparing image..." :
                     "Processing image..."}
                  </span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
                {progress < 15 && (
                  <p className="text-xs text-muted-foreground">
                    First time? This may take 10-30 seconds to download language files...
                  </p>
                )}
              </div>
            )}

            {/* Parsed Results */}
            {parsedData && (
              <div className="space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Extracted Data</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(!editing)}
                  >
                    {editing ? "Done Editing" : "Edit"}
                  </Button>
                </div>

                {/* Course Name */}
                <div className="space-y-2">
                  <Label>Course Name</Label>
                  {editing ? (
                    <Input
                      value={parsedData.courseName || manualCourseName || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setParsedData({
                          ...parsedData,
                          courseName: value || null,
                        });
                        setManualCourseName(value);
                      }}
                      placeholder="Course name"
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded">
                      {parsedData.courseName || manualCourseName || "Not found"}
                    </div>
                  )}
                </div>

                {/* Scores Grid */}
                <div className="space-y-2">
                  <Label>Scores</Label>
                  <div className="grid grid-cols-9 gap-2">
                    {parsedData.scores.map((score, index) => (
                      <div key={index} className="space-y-1">
                        <div className="text-xs text-muted-foreground text-center">
                          H{index + 1}
                        </div>
                        {editing ? (
                          <Input
                            type="number"
                            min="1"
                            max="15"
                            value={score || ''}
                            onChange={(e) => handleScoreEdit(index, e.target.value)}
                            className="h-10 text-center"
                            placeholder="-"
                          />
                        ) : (
                          <div className={`h-10 flex items-center justify-center rounded border ${
                            score ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted'
                          }`}>
                            {score || '-'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw OCR Text (for debugging) */}
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    View Raw OCR Text
                  </summary>
                  <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-auto max-h-40">
                    {parsedData.rawText}
                  </pre>
                </details>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setParsedData(null);
                      setManualCourseName("");
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                  <Button
                    onClick={() => {
                      toast({
                        title: "Feature coming soon",
                        description: "Scorecard import will be available soon",
                      });
                    }}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Import Scores
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
