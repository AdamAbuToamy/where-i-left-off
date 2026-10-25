import type { User } from 'firebase/auth';
import { backgrounds, themes } from '../lib/theme';

type PublicUser = Pick<User, 'uid' | 'displayName' | 'email' | 'emailVerified'>;
const pages = new Set(['personal','resume','university','groups','settings','notifications','library','analytics','logs','support']);
const colorVariables = {primary:'--site-primary',background:'--site-bg',surface:'--site-surface',text:'--site-text',accent:'--site-accent'};

/** Read only the signed-in account's public identity and the actual interface.
 * Never spread/stringify a Firebase User or enumerate browser storage.
 */
export function assistantAccountContext(user: PublicUser | null, uid: string) {
 if (!user || user.uid !== uid) throw new Error('account-changed');
 const displayName = typeof user.displayName === 'string' ? user.displayName.trim().slice(0,100) : '';
 const email = typeof user.email === 'string' ? user.email.slice(0,320) : '';
 const route = typeof location === 'undefined' ? '' : location.hash.replace(/^#\//,'').split(/[/?]/)[0];
 const colors: Record<string,string> = {};
 if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
  const computed = getComputedStyle(document.documentElement);
  for (const [key,variable] of Object.entries(colorVariables)) {
   const value = computed.getPropertyValue(variable).trim();
   if (value && value.length <= 64 && /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([0-9.,% /+-]+\))$/i.test(value)) colors[key] = value;
  }
 }
 return {
  profile: {displayName},
  account: {email,emailVerified:user.emailVerified === true,nameAvailable:!!displayName},
  site: {page:pages.has(route) ? route : 'personal',availableThemes:[...themes],availableBackgrounds:[...backgrounds],colors},
 };
}
