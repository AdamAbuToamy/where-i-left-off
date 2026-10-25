/** Decode numeric HTML references only as *text*. Never inject as HTML.
 * Some provider responses persisted names such as "&#x627;يه" instead of "ايه".
 * Leave named entities (&lt;, &amp;, etc.) untouched and do not mutate saved data.
 */
export function plainNumericText(value:string):string {
 return value.replace(/&#(?:x([0-9a-fA-F]{1,6})|([0-9]{1,7}));/g,(matched,hex:string|undefined,decimal:string|undefined)=>{
  const point=Number.parseInt(hex||decimal,hex?16:10);
  return Number.isInteger(point)&&point>0&&point<=0x10ffff&&!(point>=0xd800&&point<=0xdfff)?String.fromCodePoint(point):matched;
 });
}
export function comparableRecordName(value:string):string {
 return plainNumericText(value).normalize('NFKC').replace(/[\u064b-\u065f]/g,'').replace(/[أإآٱ]/g,'ا').trim().replace(/\s+/g,' ').toLocaleLowerCase();
}
