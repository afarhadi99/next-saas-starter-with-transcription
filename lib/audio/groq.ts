// /lib/audio/groq.ts

import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export type TranscriptionSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

export type TranscriptionResponse = {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
};

// Convert Blob to File
function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type });
}

export async function transcribeAudio(
  audioBlob: Blob,
  filename: string = 'audio-chunk.mp3'
): Promise<TranscriptionResponse> {
  try {
    const audioFile = blobToFile(audioBlob, filename);

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'distil-whisper-large-v3-en',
      response_format: 'verbose_json',
    });

    return transcription as TranscriptionResponse;
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Unknown transcription error'
    );
  }
}

export function combineTranscriptions(
  transcriptions: TranscriptionResponse[]
): TranscriptionResponse {
  if (transcriptions.length === 0) {
    throw new Error('No transcriptions to combine');
  }

  if (transcriptions.length === 1) {
    return transcriptions[0];
  }

  let combinedText = '';
  let combinedSegments: TranscriptionSegment[] = [];
  let timeOffset = 0;

  transcriptions.forEach((transcription, index) => {
    // Add spacing between chunks in the combined text
    if (index > 0) {
      combinedText += ' ';
    }
    combinedText += transcription.text;

    // Adjust segment timings
    const adjustedSegments = transcription.segments.map(segment => ({
      ...segment,
      start: segment.start + timeOffset,
      end: segment.end + timeOffset,
    }));

    combinedSegments.push(...adjustedSegments);

    // Update time offset for next chunk
    if (transcription.segments.length > 0) {
      timeOffset = transcription.segments[transcription.segments.length - 1].end;
    }
  });

  return {
    text: combinedText.trim(),
    segments: combinedSegments,
    language: transcriptions[0].language,
  };
}