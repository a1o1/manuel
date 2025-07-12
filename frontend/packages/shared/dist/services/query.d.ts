import { QueryResponse } from '../types';
declare class QueryService {
    textQuery(query: string, includeSources?: boolean): Promise<QueryResponse>;
    voiceQuery(audioData: string, contentType: string, includeSources?: boolean): Promise<QueryResponse>;
    getQuerySuggestions(partial: string): Promise<string[]>;
}
export declare const queryService: QueryService;
export {};
//# sourceMappingURL=query.d.ts.map