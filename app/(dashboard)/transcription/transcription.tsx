'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, Play, Pause } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';
import { processTranscription } from '@/app/(dashboard)/actions';
import { Transcription as TranscriptionType } from '@/lib/db/schema';

// Submit Button Component
function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <Button
      type="submit"
      className="w-full"
      disabled={pending}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        'Transcribe'
      )}
    </Button>
  );
}

type TranscriptionState = {
  error?: string;
  success?: string;
  transcription?: TranscriptionType;
};

export function Transcription({ history }: { history: TranscriptionType[] }) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedTranscription, setSelectedTranscription] = useState<TranscriptionType | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Use useFormState for form handling
  const [state, formAction] = useFormState<TranscriptionState, FormData>(
    processTranscription,
    { error: '', success: '' }
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
      // Create URL for audio playback
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      if (audioRef.current) {
        audioRef.current.src = url;
      }
    }
  };

  const handleTranscriptionSelect = (transcription: TranscriptionType) => {
    setSelectedTranscription(transcription);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const getCurrentSegment = () => {
    const currentTranscription = selectedTranscription || state.transcription;
    if (!currentTranscription?.segments) return null;
    return currentTranscription.segments.find(
      (segment) => currentTime >= segment.start && currentTime <= segment.end
    );
  };

  // Cleanup function for audio URL
  const cleanup = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  // Clean up audio URL when component unmounts
  useEffect(() => {
    return cleanup;
  }, []);

  const currentTranscription = selectedTranscription || state.transcription;

  return (
    <div className="flex-1 p-4 lg:p-8 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Upload Audio</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={async (formData: FormData) => {
              if (audioFile) {
                formData.set('file', audioFile);
                await formAction(formData);
              }
            }} className="space-y-4">
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4">
                <input
                  type="file"
                  name="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="audio-upload"
                />
                <label
                  htmlFor="audio-upload"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <Upload className="h-8 w-8 text-gray-400" />
                  <span className="mt-2 text-sm text-gray-500">
                    {audioFile ? audioFile.name : 'Click to upload audio file'}
                  </span>
                </label>
              </div>
              <SubmitButton />
              {state.error && (
                <p className="text-red-500 text-sm mt-2">{state.error}</p>
              )}
              {state.success && (
                <p className="text-green-500 text-sm mt-2">{state.success}</p>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Previous Transcriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((transcription) => (
                <Button
                  key={transcription.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleTranscriptionSelect(transcription)}
                >
                  {transcription.fileName}
                  <span className="ml-2 text-xs text-gray-500">
                    {new Date(transcription.createdAt).toLocaleDateString()}
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {currentTranscription && (
        <Card>
          <CardHeader>
            <CardTitle>Transcription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Button 
                  onClick={togglePlayPause}
                  disabled={!audioUrl && !selectedTranscription}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <div className="flex-1 h-1 bg-gray-200 rounded">
                  <div
                    className="h-full bg-orange-500 rounded"
                    style={{
                      width: `${(currentTime / (currentTranscription.duration || 0)) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm text-gray-500">
                  {formatTime(currentTime)} / {formatTime(currentTranscription.duration)}
                </span>
              </div>
              <div className="prose max-w-none">
                {currentTranscription.segments?.map((segment, index) => (
                  <span
                    key={index}
                    className={`${
                      getCurrentSegment()?.start === segment.start
                        ? 'bg-orange-200'
                        : ''
                    } cursor-pointer hover:bg-gray-100 transition-colors`}
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = segment.start;
                      }
                    }}
                  >
                    {segment.text}{' '}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
        controls={false}
      />
    </div>
  );
}

// Helper function to format time
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}