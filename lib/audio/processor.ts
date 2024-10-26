// /lib/audio/processor.ts

export type AudioChunk = {
    blob: Blob;
    start: number;
    end: number;
  };
  
  export type ProcessedAudio = {
    chunks: Blob[];
    fileName: string;
    fileType: string;
    totalSize: number;
  };
  
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB max total file size
  const MAX_CHUNK_SIZE = 20 * 1024 * 1024; // 20MB chunk size
  const GROQ_SIZE_LIMIT = 25 * 1024 * 1024; // 25MB Groq limit
  
  export async function processAudioFile(file: File): Promise<ProcessedAudio> {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }
  
    // If file is under Groq limit, return it as a single chunk
    if (file.size <= GROQ_SIZE_LIMIT) {
      return {
        chunks: [file],
        fileName: file.name,
        fileType: file.type,
        totalSize: file.size,
      };
    }
  
    // For larger files, split into chunks
    const chunks: Blob[] = [];
    const buffer = await file.arrayBuffer();
    let offset = 0;
  
    while (offset < buffer.byteLength) {
      const chunkSize = Math.min(MAX_CHUNK_SIZE, buffer.byteLength - offset);
      const chunk = buffer.slice(offset, offset + chunkSize);
      chunks.push(new Blob([chunk], { type: file.type }));
      offset += chunkSize;
    }
  
    return {
      chunks,
      fileName: file.name,
      fileType: file.type,
      totalSize: file.size,
    };
  }