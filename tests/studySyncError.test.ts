import {expect,it} from 'vitest';import {studySyncError} from '../src/university/studyRepository';import {translateStudyText} from '../src/university/studyLocaleContext';
it('distinguishes Firebase permission, session, quota and network failures without exposing arbitrary server text',()=>{
 for(const code of ['permission-denied','unauthenticated','resource-exhausted','unavailable']){const text=studySyncError({code});expect(text).toContain(code);expect(translateStudyText(text,'en')).not.toMatch(/[\u0600-\u06ff]/);expect(translateStudyText(text,'he')).not.toMatch(/[\u0600-\u06ff]/);}
 expect(studySyncError({code:'unknown',message:'secret-token'})).not.toContain('secret-token');
});
