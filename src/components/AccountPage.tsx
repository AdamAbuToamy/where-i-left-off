import { lazy, Suspense } from 'react';
import type { User } from 'firebase/auth';
import type { Language } from '../translations';
import type { PageName } from '../lib/navigation';
import { isAdmin } from '../lib/admin';
import { db } from '../lib/firebase';
import { cloudText } from '../cloudTranslations';
import { pushText } from '../pushText';
import LoadingScreen from './LoadingScreen';
import Workspace from './Workspace';
import GroupSpaces from './GroupSpaces';
import ContinueNow from './ContinueNow';
import LibraryPage from './LibraryPage';
import AnalyticsPage from './AnalyticsPage';
import NotificationSettings from './NotificationSettings';
import ProfileSettings from './ProfileSettings';
import AdminDashboard from './AdminDashboard';
const UniversityPage=lazy(()=>import('../university/UniversityPage'));
type Props={page:PageName;groupId:string;user:User;language:Language;installed:boolean;profileVersion:number};
/** A single route outlet: changing pages unmounts the previous screen and its listeners. */
export default function AccountPage({page,groupId,user,language,installed,profileVersion}:Props){
 switch(page){
  case 'personal':case 'groups':return <GroupSpaces key={`${user.uid}/${page}/${groupId}`} user={user} language={language} page={page} groupId={groupId} profileVersion={profileVersion}>{(group,members)=><Workspace key={`${user.uid}/${group?.id||'personal'}`} user={user} language={language} group={group} members={members}/>}</GroupSpaces>;
  case 'resume':return <ContinueNow user={user} language={language}/>;
  case 'library':return <LibraryPage user={user} language={language}/>;
  case 'university':return <Suspense fallback={<LoadingScreen language={language} status={cloudText[language].loading} />}><UniversityPage user={user}/></Suspense>;
  case 'analytics':return <AnalyticsPage user={user} language={language}/>;
  case 'notifications':return installed?<NotificationSettings user={user} language={language}/>:<p>{pushText[language].notInstalled}</p>;
  case 'settings':return <ProfileSettings user={user} language={language}/>;
  case 'logs':case 'admin':return isAdmin(user.email,user.emailVerified)?<AdminDashboard db={db!} language={language} user={user}/>:<p role="alert">{cloudText[language].signIn}</p>;
  default:return null;
 }
}
