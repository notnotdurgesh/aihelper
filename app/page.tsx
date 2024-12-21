'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Home() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [permissionState, setPermissionState] = useState<string>('prompt');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Check permission status on component mount
  useEffect(() => {
    checkCameraPermission();
  }, []);

  // Add effect to handle video stream
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
        setError('Failed to start video stream');
      });
    }
  }, [stream]);

  const checkCameraPermission = async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setPermissionState(permission.state);
      
      // Listen for permission changes
      permission.addEventListener('change', () => {
        setPermissionState(permission.state);
      });
    } catch (err) {
      console.log('Permission API not supported');
    }
  };

  const startCamera = async () => {
    try {
      setError('');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser doesn\'t support camera access');
      }

      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      // Remove the manual video setup since it's handled in the useEffect
      await checkCameraPermission();
      
    } catch (err) {
      if (err instanceof Error) {
        switch (err.name) {
          case 'NotAllowedError':
            setError('Camera access denied. Please enable camera access in your browser settings and try again.');
            break;
          case 'NotFoundError':
            setError('No camera found on your device.');
            break;
          case 'NotReadableError':
            setError('Camera is already in use by another application.');
            break;
          default:
            setError(`Failed to access camera: ${err.message}`);
        }
      } else {
        setError('An unexpected error occurred while accessing the camera.');
      }
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  // Rest of the code remains the same...
  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;

    try {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        throw new Error('Video stream not ready');
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      context.drawImage(video, 0, 0);
      
      setIsLoading(true);
      setAnalysis('');
      setError('');
      
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze image');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const text = decoder.decode(value);
          setAnalysis(prev => prev + text);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze image';
      setError(`${errorMessage}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">
        Interview Appearance Analyzer
      </h1>
      
      <div className="space-y-4 md:space-y-6">
        {error && (
          <Alert variant="destructive" className="animate-in fade-in">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {permissionState === 'denied' && (
          <Alert variant="destructive">
            <AlertDescription>
              Camera access is blocked. Please update your browser settings to allow camera access, then refresh the page.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row justify-center gap-3 mb-4 md:mb-6">
          {!stream ? (
            <button
              onClick={startCamera}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center justify-center space-x-2 w-full sm:w-auto"
            >
              <Camera className="w-5 h-5" />
              <span>Start Camera</span>
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 w-full sm:w-auto"
            >
              Stop Camera
            </button>
          )}
          
          {stream && (
            <button
              onClick={takePhoto}
              disabled={isLoading}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {isLoading ? 'Analyzing...' : 'Take Photo'}
            </button>
          )}
        </div>

        <div className="flex flex-col items-center space-y-4">
          {stream && (
            <div className="relative w-full max-w-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg shadow-lg bg-black"
              />
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {analysis && (
          <div className="mt-6 p-4 bg-white rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-3">Analysis:</h2>
            <div className="whitespace-pre-wrap">{analysis}</div>
          </div>
        )}
      </div>
    </main>
  );
}