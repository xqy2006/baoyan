import React from 'react';
import ReactDOM from 'react-dom';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { buildNav } from './config/navigation';
import { useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { StudentDashboard } from './components/StudentDashboard';
import { ReviewerDashboard } from './components/ReviewerDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ActivityManagement } from './components/ActivityManagement';
import { DataImport } from './components/DataImport';
import { SystemSettings } from './components/SystemSettings';
import { ApplicationList } from './components/ApplicationList';
import { ApplicationReview } from './components/ApplicationReview';
import { ApplicationForm } from './components/ApplicationForm';
import { Account } from './components/Account';
import { NotFound } from './components/NotFound';
import { NotificationHistory } from './components/NotificationHistory';
import { User } from './context/AuthContext';
import { Button } from './components/ui/button';
import { useDeviceType } from './components/hooks/useDeviceType';

// Public domain model re-exports for other components
export type { User } from './context/AuthContext';
export interface Activity { id:string; name:string; department:string; type:any; startTime:string; deadline:string; description:string; isActive:boolean; maxApplications?:number; }
export interface Application {
  id: string;
  activityName: string;
  status: 'pending'|'system_reviewing'|'system_approved'|'system_rejected'|'admin_reviewing'|'approved'|'rejected'|'cancelled';
  basicInfo: any;
  languageScores: any;
  academicAchievements: { publications:any[]; patents:any[]; competitions:any[]; innovationProjects:any[]; totalAcademicScore:number; };
  comprehensivePerformance: { volunteerService:any; socialWork:any[]; honors:any[]; sports?:any[]; internship?:string; militaryYears?:number; totalPerformanceScore:number; };
  calculatedScores: { academicScore:number; academicAchievementScore?:number; performanceScore:number; totalScore:number; };
  calculatedRaw?: { specRaw:number; perfRaw:number; academicConvertedScore?:number; academicRankScore?:number; academicGpaScore?:number; academicBaseUsed?:number; internshipScore?:number; militaryScore?:number };
  personalStatement: string;
  uploadedFiles: { languageCertificates:any[]; academicDocuments:any[]; transcripts:any[]; recommendationLetters?:any[]; };
  specialAcademicTalent?: { isApplying:boolean; description?:string; achievements?:string; defensePassed?:boolean; professors?:Array<{name:string; title?:string; department?:string}> };
  systemReviewComment?: string;
  adminReviewComment?: string;
  systemReviewedAt?: string;
  adminReviewedAt?: string;
  studentId?: string;
  studentName?: string;
  submittedAt?: string;
}

const RequireAuth: React.FC<{roles?:Array<User['role']>}> = ({ roles, children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">加载中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// Simple layout (header + side nav)
const Shell: React.FC<{children:React.ReactNode}> = ({ children }) => {
  const { user, refreshing } = useAuth();
  const device = useDeviceType();
  const navigate = useNavigate();
  const location = useLocation();
  const mobileNavRef = React.useRef<HTMLElement>(null);
  const [navHeight, setNavHeight] = React.useState(0);

  React.useEffect(()=>{
    if (mobileNavRef.current) {
      setNavHeight(mobileNavRef.current.offsetHeight);
    }
  }, [device]); // Re-calculate on device change

  React.useEffect(()=>{ console.log('[device]', device); },[device]);
  if (!user) return null;
  const navItems = buildNav(user);
  const isActive = (p:string) => location.pathname === p;

  const DesktopNavButton: React.FC<{path:string; label:string; Icon:React.ComponentType<{className?:string}>;}> = ({path,label,Icon}) => {
    const active = isActive(path);
    return (
      <button
        onClick={()=>navigate(path)}
        aria-current={active? 'page':undefined}
        className={`flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${active? 'bg-blue-600 text-white shadow-sm':'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
      >
        <span>{label}</span>
      </button>
    );
  };

  const MobileNavButton: React.FC<{path:string; label:string; Icon:React.ComponentType<{className?:string}>;}> = ({path,label,Icon}) => {
    const active = isActive(path);
    return (
      <button
        onClick={()=>navigate(path)}
        aria-current={active? 'page':undefined}
        className={`flex flex-col items-center justify-center h-12 px-2 min-w-0 flex-1 rounded transition-colors ${active? 'text-blue-600 bg-blue-50':'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="text-xs leading-tight mt-1 truncate w-full">{label}</span>
      </button>
    );
  };

  // Render conditionally based on device type for better control
  if (device === 'mobile') {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        {/* 主内容区 */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden p-3"
          style={{ paddingBottom: navHeight + 16 }}
          role="main"
        >
          <div className="max-w-full mx-auto">
            {children}
          </div>
        </main>

        {/* 移动端底部导航 */}
        <nav
          ref={mobileNavRef}
          className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50"
          aria-label="Bottom Navigation"
        >
          <div className="flex items-stretch h-14 px-1">
            {navItems.map(n=> <MobileNavButton key={n.path} path={n.path} label={n.label(user)} Icon={n.icon} />)}
          </div>
        </nav>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 桌面端顶部导航 */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900 cursor-pointer" onClick={() => navigate('/')}>
                  保研小助手
                </h1>
              </div>
              <span className="text-sm text-gray-600">
                {user.name || user.username}
              </span>
              <div className="text-xs text-gray-400">
                © {new Date().getFullYear()} xqy
              </div>
            </div>
            <nav className="flex space-x-2" aria-label="Main Navigation">
              {navItems.map(n=> <DesktopNavButton key={n.path} path={n.path} label={n.label(user)} Icon={n.icon} />)}
            </nav>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main
        className="flex-1 overflow-y-auto px-4 py-4"
        role="main"
      >
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-6">
          {children}
        </div>
      </main>
    </div>
  );
};

// Wrapper: Review page loads application by id then renders ApplicationReview
const ReviewPage: React.FC = () => {
  const { id } = useParams();
  const { user, fetchWithAuth } = useAuth();
  const [application, setApplication] = React.useState<Application | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  React.useEffect(()=>{(async()=>{
    try {
      const res = await fetchWithAuth(`/api/applications/${id}`, { credentials:'include' });
      if(!res.ok) throw new Error('加载失败');
      const data = await res.json();
      const content = data.content? JSON.parse(data.content):{};
      const mapStatus: Record<string, Application['status']> = { DRAFT:'pending', SYSTEM_REVIEWING:'system_reviewing', SYSTEM_APPROVED:'system_approved', SYSTEM_REJECTED:'system_rejected', ADMIN_REVIEWING:'admin_reviewing', APPROVED:'approved', REJECTED:'rejected', CANCELLED:'cancelled' };
      const academicScore = (typeof data.academicScore === 'number')? data.academicScore : (content.calculatedScores?.academicScore||0);
      const achievementScore = (typeof data.achievementScore === 'number')? data.achievementScore : (content.calculatedScores?.academicAchievementScore||0);
      const performanceScore = (typeof data.performanceScore === 'number')? data.performanceScore : (content.calculatedScores?.performanceScore||0);
      const totalScore = (typeof data.totalScore === 'number')? data.totalScore : (content.calculatedScores?.totalScore|| (academicScore + achievementScore + performanceScore));
      setApplication({
        id: String(data.id),
        activityName: data.activityName || '活动',
        status: mapStatus[data.status] || 'pending',
        basicInfo: content.basicInfo || { name:'-', studentId:'-', gender:'男', department:'-', major:'-', gpa:0, academicRanking:0, totalStudents:0 },
        languageScores: content.languageScores || {},
        academicAchievements: content.academicAchievements || { publications:[], patents:[], competitions:[], innovationProjects:[], totalAcademicScore:0 },
        comprehensivePerformance: content.comprehensivePerformance || { volunteerService:{hours:0,totalScore:0}, socialWork:[], honors:[], totalPerformanceScore:0 },
        calculatedScores: { academicScore, academicAchievementScore:achievementScore, performanceScore, totalScore },
        calculatedRaw: content.calculatedRaw,
        personalStatement: content.personalStatement || '',
        uploadedFiles: content.uploadedFiles || { languageCertificates:[], academicDocuments:[], transcripts:[], recommendationLetters:[] },
        specialAcademicTalent: content.specialAcademicTalent || undefined,
        systemReviewComment: data.systemReviewComment,
        adminReviewComment: data.adminReviewComment,
        systemReviewedAt: data.systemReviewedAt,
        adminReviewedAt: data.adminReviewedAt
      });
    } catch(e:any){ setError(e.message);} finally{ setLoading(false);} })();},[id, fetchWithAuth]);
  if (loading) return <div className="p-4 text-sm text-gray-500">加载中...</div>;
  if (error || !application) return <div className="p-4 text-sm text-red-600">{error||'未找到申请'}</div>;
  return <ApplicationReview application={application} user={user!} onBack={()=>window.history.back()} />;
};

// Wrapper: Apply page loads activity by id
const ApplyPage: React.FC = () => {
  const { activityId } = useParams();
  const { user, fetchWithAuth } = useAuth();
  const [activity, setActivity] = React.useState<Activity | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const navigate = useNavigate();
  React.useEffect(()=>{(async()=>{
    try {
      const res = await fetchWithAuth(`/api/activities/${activityId}`, { credentials:'include' });
      if(!res.ok) throw new Error('加载失败');
      const data = await res.json();
      setActivity({ id:String(data.id), name:data.name, department:data.department, type:data.type, startTime:data.startTime||'', deadline:data.deadline||'', description:data.description, isActive:data.active??data.isActive, maxApplications:data.maxApplications });
    } catch(e:any){ setError(e.message);} finally { setLoading(false);} })();},[activityId, fetchWithAuth]);
  if (loading) return <div className="p-4 text-sm text-gray-500">加载中...</div>;
  if (error || !activity) return <div className="p-4 text-sm text-red-600">{error||'活动不存在'}</div>;
  return <ApplicationForm activity={activity} user={user!} onSubmit={()=>navigate('/applications')} onCancel={()=>navigate('/')} />;
};

const DashboardSwitch: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  if (user.role==='STUDENT') return <StudentDashboard onApply={(a)=>navigate(`/apply/${a.id}`)} />;
  if (user.role==='REVIEWER') return <ReviewerDashboard />;
  return <AdminDashboard />;
};

const App: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <Routes>
      <Route path="/login" element={user? <Navigate to="/" replace/>:<Login/>} />
      <Route path="/" element={<RequireAuth><Shell><DashboardSwitch/></Shell></RequireAuth>} />
      <Route path="/applications" element={<RequireAuth><Shell><ApplicationList user={user as any} onReview={(app)=>navigate(`/review/${app.id}`)} /></Shell></RequireAuth>} />
      <Route path="/review/:id" element={<RequireAuth roles={['ADMIN','REVIEWER','STUDENT']}><Shell><ReviewPage/></Shell></RequireAuth>} />
      <Route path="/apply/:activityId" element={<RequireAuth roles={['STUDENT']}><Shell><ApplyPage/></Shell></RequireAuth>} />
      <Route path="/activities" element={<RequireAuth roles={['ADMIN']}><Shell><ActivityManagement/></Shell></RequireAuth>} />
      <Route path="/import" element={<RequireAuth roles={['ADMIN']}><Shell><DataImport role={user?.role||'STUDENT'} /></Shell></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth roles={['ADMIN']}><Shell><SystemSettings/></Shell></RequireAuth>} />
      <Route path="/account" element={<RequireAuth><Shell><Account role={user?.role||'STUDENT'} /></Shell></RequireAuth>} />
      <Route path="/messages" element={<RequireAuth><Shell><NotificationHistory /></Shell></RequireAuth>} />
      <Route path="*" element={user ? <Shell><NotFound /></Shell> : <NotFound />} />
    </Routes>
  );
};

export default App;
