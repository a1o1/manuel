// Stub implementation for iOS - uses mocks only
import { QueryService } from '../interfaces';

export class RealQueryService implements QueryService {
  async submitQuery(query: string, includeHistory?: boolean) {
    throw new Error('Use mock mode for iOS development');
  }

  async submitVoiceQuery(audioData: string, includeHistory?: boolean) {
    throw new Error('Use mock mode for iOS development');
  }
}
