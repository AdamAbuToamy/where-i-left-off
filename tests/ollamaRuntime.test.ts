import {describe,it,expect} from 'vitest';
import {OllamaAcceptanceProvider} from '../scripts/lib/ollamaAcceptance.mjs';
import {runAcceptanceCase} from './fixtures/assistant/runCase.mjs';
import {acceptanceCases} from './fixtures/assistant/corpus.mjs';
describe('Ollama runtime diagnostics',()=>{
 it('reports a missing runner without exposing raw server details',async()=>{
  const provider=new OllamaAcceptanceProvider({model:'qwen3:4b',fetcher:async()=>new Response(JSON.stringify({error:{message:'llama-server binary not found (private filesystem path)'}}),{status:500})});
  const result=await runAcceptanceCase(acceptanceCases.find(c=>c.id==='compound-card-ar'),provider);
  expect(result.trace[0].localError).toBe('ollama-runner-missing');
  expect(result.trace[0].providerFailure.status).toBe(500);
  expect(JSON.stringify(result)).not.toContain('private filesystem path');
 });
 it('preserves HTTP status when an unknown error body is not JSON',async()=>{
  const provider=new OllamaAcceptanceProvider({fetcher:async()=>new Response('sensitive server detail',{status:503})});
  await expect(provider.run({messages:[]})).rejects.toMatchObject({message:'ollama-http-503',status:503});
 });
});