import type { User } from 'firebase/auth';
/** Refresh authoritative account state; never infer verification from a clicked link. */
export class EmailVerification {
 private readonly user:User;
 constructor(user:User){this.user=user;}
 async refresh(){await this.user.reload();await this.user.getIdToken(true);return this.user.emailVerified;}
}
