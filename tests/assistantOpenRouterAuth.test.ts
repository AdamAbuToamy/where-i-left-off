// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {finishRouterConnection,routerConnected,routerKey,disconnectRouter} from '../src/assistant/openRouterAuth';
beforeEach(()=>{localStorage.clear();sessionStorage.clear();history.replaceState(null,'','/');});afterEach(()=>vi.unstubAllGlobals());
it('exchanges a valid PKCE callback automatically and isolates each website account',async()=>{
 sessionStorage.setItem('wilo-openrouter-flow:alice',JSON.stringify({state:'state',verifier:'verifier',createdAt:Date.now(),returnHash:'#/personal'}));history.replaceState(null,'','/?wilo_openrouter=1&code=code&state=state');
 const fetch=vi.fn(async(_url,init)=>{expect(JSON.parse(init.body)).toEqual({code:'code',code_verifier:'verifier',code_challenge_method:'S256'});return Response.json({key:'sk-or-synthetic-for-test'});});vi.stubGlobal('fetch',fetch);
 expect(await finishRouterConnection('alice')).toBe(true);expect(routerConnected('alice')).toBe(true);expect(routerConnected('bob')).toBe(false);expect(()=>routerKey('bob')).toThrow('assistant-connect-required');expect(location.search).toBe('');expect(location.hash).toBe('#/personal');disconnectRouter('alice');expect(routerConnected('alice')).toBe(false);
});
it('does not exchange a key for wrong state, expired flow or different account',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);sessionStorage.setItem('wilo-openrouter-flow:alice',JSON.stringify({state:'correct',verifier:'verifier',createdAt:Date.now()-600001}));history.replaceState(null,'','/?wilo_openrouter=1&code=code&state=wrong');
 await expect(finishRouterConnection('alice')).rejects.toThrow('assistant-connect-invalid');expect(fetch).not.toHaveBeenCalled();expect(routerConnected('alice')).toBe(false);
});