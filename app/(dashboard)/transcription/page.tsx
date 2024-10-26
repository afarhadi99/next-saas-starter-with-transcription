import { Transcription } from './transcription';
import { getTranscriptionHistory } from '@/lib/db/queries';

export default async function TranscriptionPage() {
  const history = await getTranscriptionHistory();
  
  return <Transcription history={history} />;
}