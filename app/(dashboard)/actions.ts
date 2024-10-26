'use server';

import { z } from 'zod';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { processAudioFile } from '@/lib/audio/processor';
import { transcribeAudio, combineTranscriptions } from '@/lib/audio/groq';
import { saveTranscription } from '@/lib/db/queries';
import { getUserWithTeam } from '@/lib/db/queries';

// Constants for file validation
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',        // .mp3
  'audio/wav',         // .wav
  'audio/mp4',         // .mp4
  'audio/x-m4a',       // .m4a
  'audio/mpeg',        // .mpga
  'audio/webm',        // .webm
  'audio/x-aiff',      // .aiff
  'audio/aac',         // .aac
  'audio/ogg',         // .ogg
] as const;

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// Validation schema
const transcriptionSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => ALLOWED_AUDIO_TYPES.includes(file.type as any),
    {
      message: 'Invalid file type. Please upload a supported audio file (MP3, WAV, MP4, M4A, etc.).',
    }
  ).refine(
    (file) => file.size <= MAX_FILE_SIZE,
    {
      message: `File size too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    }
  ),
});

// Response type
export type TranscriptionActionResponse = {
  error?: string;
  success?: string;
  transcription?: any;
  progress?: number;
};

// Main transcription action
export const processTranscription = validatedActionWithUser(
  transcriptionSchema,
  async (data, _, user): Promise<TranscriptionActionResponse> => {
    try {
      // Verify user team membership
      const userWithTeam = await getUserWithTeam(user.id);
      if (!userWithTeam?.teamId) {
        return { error: 'User is not part of a team' };
      }

      // Process the audio file into chunks if needed
      const processedAudio = await processAudioFile(data.file);

      // Track progress
      let completedChunks = 0;
      const totalChunks = processedAudio.chunks.length;

      // Process each chunk
      const transcriptionResults = [];
      const errors = [];

      for (let i = 0; i < totalChunks; i++) {
        try {
          const chunk = processedAudio.chunks[i];
          const chunkName = `chunk_${i}_${processedAudio.fileName}`;
          
          const result = await transcribeAudio(chunk, chunkName);
          transcriptionResults.push(result);
          completedChunks++;

        } catch (error) {
          console.error(`Error processing chunk ${i}:`, error);
          errors.push(`Failed to transcribe segment ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Check if we have any successful transcriptions
      if (transcriptionResults.length === 0) {
        throw new Error('Failed to transcribe any part of the audio file');
      }

      // Combine the results
      const combinedTranscription = combineTranscriptions(transcriptionResults);

      // Calculate total duration from segments
      const duration = combinedTranscription.segments.length > 0
        ? Math.max(...combinedTranscription.segments.map(s => s.end))
        : 0;

      // Prepare transcription data
      const transcriptionData = {
        teamId: userWithTeam.teamId,
        userId: user.id,
        fileName: processedAudio.fileName,
        originalText: combinedTranscription.text,
        segments: combinedTranscription.segments.map(segment => ({
          ...segment,
          start: Number(segment.start.toFixed(3)),
          end: Number(segment.end.toFixed(3)),
        })),
        duration: Math.round(duration),
        language: combinedTranscription.language,
        fileType: processedAudio.fileType,
        fileSize: processedAudio.totalSize,
        status: errors.length > 0 ? 'partial' : 'complete',
        errorLog: errors.length > 0 ? errors.join('\n') : null,
      };

      // Save to database
      const transcription = await saveTranscription(transcriptionData);

      // Return response with warnings if any chunks failed
      return {
        success: errors.length > 0 
          ? 'Transcription completed with some errors'
          : 'Transcription completed successfully',
        transcription,
        ...(errors.length > 0 && { error: errors.join('\n') }),
      };

    } catch (error) {
      console.error('Transcription processing error:', error);
      return {
        error: error instanceof Error
          ? error.message
          : 'Failed to process transcription. Please try again.',
      };
    }
  }
);

// Get transcription status
export const getTranscriptionStatus = validatedActionWithUser(
  z.object({ transcriptionId: z.number() }),
  async (data, _, user) => {
    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' };
    }

    try {
      // Implement your status checking logic here
      return {
        success: 'Status retrieved successfully',
        // Add your status data here
      };
    } catch (error) {
      console.error('Get status error:', error);
      return {
        error: 'Failed to retrieve transcription status',
      };
    }
  }
);

// Delete transcription
export const deleteTranscription = validatedActionWithUser(
  z.object({ transcriptionId: z.number() }),
  async (data, _, user) => {
    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' };
    }

    try {
      // Implement your deletion logic here
      return {
        success: 'Transcription deleted successfully',
      };
    } catch (error) {
      console.error('Delete transcription error:', error);
      return {
        error: 'Failed to delete transcription',
      };
    }
  }
);

// Update transcription metadata
export const updateTranscription = validatedActionWithUser(
  z.object({
    transcriptionId: z.number(),
    metadata: z.object({
      name: z.string().optional(),
      notes: z.string().optional(),
    }),
  }),
  async (data, _, user) => {
    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' };
    }

    try {
      // Implement your update logic here
      return {
        success: 'Transcription updated successfully',
      };
    } catch (error) {
      console.error('Update transcription error:', error);
      return {
        error: 'Failed to update transcription',
      };
    }
  }
);
