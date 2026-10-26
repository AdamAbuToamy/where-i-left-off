import {emptyUniversity} from './state';
import type {UniversityState} from './state';

export class UniversityStore {
    private readonly key: string;
    constructor(uid: string, project: string) { this.key = `wilo-university-v1/${project}/${uid}`; }
    load(): UniversityState {
        const journal = this.loadSync() as {state?: UniversityState}|null;
        if (journal?.state) return journal.state;
        const raw = localStorage.getItem(this.key);
        if (!raw)
            return emptyUniversity();
        const r = JSON.parse(raw);
        if (r.version !== 1 || !Array.isArray(r.courses) || !Array.isArray(r.tasks) || !Array.isArray(r.lessons))
            throw new Error('تعذر قراءة بيانات الجامعة؛ صدّر نسخة قبل المتابعة');
        return r as UniversityState;
    }
    loadSync(): unknown { const value=localStorage.getItem(this.key+"/sync"); return value?JSON.parse(value):null; }
    saveSync(value: unknown) { localStorage.setItem(this.key+"/sync",JSON.stringify(value)); }
    save(state: UniversityState) { localStorage.setItem(this.key, JSON.stringify(state)); if(typeof window!=="undefined")window.dispatchEvent(new Event("university-data-changed")); }
}
