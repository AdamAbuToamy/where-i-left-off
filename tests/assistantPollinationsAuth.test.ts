// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
const sdk=vi.hoisted(()=>({authorize:vi.fn()}));vi.mock('@pollinations/sdk',()=>({authorizeDevice:sdk.authorize}));
import {connectPollinations,pollinationsKey,pollinationsConnected,disconnectPollinations} from '../src/assistant/pollinationsAuth';
beforeEach(()=>{sessionStorage.clear();vi.resetAllMocks();});afterEach(()=>vi.unstubAllGlobals());
it('opens the consent window from the click and activates only the signed-in Wilo account after approval',async()=>{
 const close=vi.fn(),popup={closed:false,location:{href:''},close};const open=vi.fn(()=>popup);vi.stubGlobal('open',open);
 sdk.authorize.mockImplementation(async options=>{expect(open).toHaveBeenCalledTimes(1);expect(options.clientId.startsWith('pk_')).toBe(true);expect(options.scope).toBe('generate');return {verificationUri:'https://enter.pollinations.ai/device?user_code=TEST',poll:async()=>'sk_synthetic'};});
 await connectPollinations('alice');expect(popup.location.href).toContain('/device?user_code=TEST');expect(close).toHaveBeenCalledTimes(1);expect(pollinationsKey('alice')).toBe('sk_synthetic');expect(pollinationsConnected('bob')).toBe(false);expect(()=>pollinationsKey('bob')).toThrow('assistant-connect-required');disconnectPollinations('alice');expect(pollinationsConnected('alice')).toBe(false);
});
it('does not start authorization when the browser blocks the window',async()=>{
 vi.stubGlobal('open',()=>null);await expect(connectPollinations('alice')).rejects.toThrow('assistant-popup-blocked');expect(sdk.authorize).not.toHaveBeenCalled();expect(pollinationsConnected('alice')).toBe(false);
});