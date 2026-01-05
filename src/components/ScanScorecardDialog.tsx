import { useState, useRef } from "react";
import { Camera, Upload, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ScannedCourseData {
  courseName: string | null;
  city: string | null;
  stateOrCountry: string | null;
  isUSA: boolean;
  countryCode: string | null;
  holes: Array<{
    holeNumber: number;
    par: number;
    distance: number | null;
    strokeIndex: number | null;
  }>;
}

interface ScanScorecardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (data: ScannedCourseData) => void;
}

export function ScanScorecardDialog({ isOpen, onClose, onScanComplete }: ScanScorecardDialogProps) {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await scanImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera access denied",
        description: "Please allow camera access to take a photo",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(base64);
      stopCamera();
      scanImage(base64);
    }
  };

  const scanImage = async (imageBase64: string) => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('scan-scorecard', {
        body: { imageBase64 }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Scan failed",
          description: data.error,
          variant: "destructive"
        });
        return;
      }

      onScanComplete(data);
      handleClose();
    } catch (error: any) {
      console.error("Error scanning scorecard:", error);
      toast({
        title: "Error scanning scorecard",
        description: error.message || "Please try again with a clearer image",
        variant: "destructive"
      });
    } finally {
      setScanning(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Scan Scorecard
          </DialogTitle>
        </DialogHeader>

        {scanning ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyzing scorecard...</p>
          </div>
        ) : showCamera ? (
          <div className="space-y-4">
            <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                onClick={stopCamera}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <Button onClick={capturePhoto} className="w-full" size="lg">
              <Camera className="w-5 h-5 mr-2" />
              Take Photo
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Take a photo of a golf scorecard to automatically extract course information
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-primary" />
                <span>Upload Photo</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={startCamera}
              >
                <Camera className="w-8 h-8 text-primary" />
                <span>Take Photo</span>
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
