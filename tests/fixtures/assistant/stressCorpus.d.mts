import type {AssistantAcceptanceCase} from './corpus.mjs';
export declare const STRESS_CASES_PER_LANGUAGE: number;
export declare const STRESS_TOTAL: number;
export declare function buildStressCorpus(count?: number): (AssistantAcceptanceCase & {sourceId:string;variation:number})[];
