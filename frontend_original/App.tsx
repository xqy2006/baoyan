import React, { useState } from 'react';
import { Login } from './components/Login';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ReviewerDashboard } from './components/ReviewerDashboard';
import { ApplicationForm } from './components/ApplicationForm';
import { ApplicationList } from './components/ApplicationList';
import { ApplicationReview } from './components/ApplicationReview';
import { ActivityManagement } from './components/ActivityManagement';
import { DataImport } from './components/DataImport';
import { SystemSettings } from './components/SystemSettings';
import { Navigation } from './components/Navigation';

// 模拟用户数据
export interface User {
  id: string;
  name: string;
  role: 'student' | 'reviewer' | 'admin';
  email: string;
  department?: string; // 系别，用于权限控制
}

// 厦门大学推免申请数据
export interface Application {
  id: string;
  studentId: string;
  studentName: string;
  activityId: string;
  activityName: string;
  status: 'pending' | 'system_reviewing' | 'system_approved' | 'system_rejected' | 'admin_reviewing' | 'approved' | 'rejected';
  submittedAt: string;
  systemReviewedAt?: string;
  adminReviewedAt?: string;
  systemReviewComment?: string;
  adminReviewComment?: string;
  
  // 基本信息
  basicInfo: {
    name: string;
    studentId: string;
    gender: '男' | '女';
    department: string; // 系别
    major: string; // 专业
    gpa: number;
    academicRanking: number; // 学业成绩排名
    totalStudents: number; // 专业总人数
  };
  
  // 外语成绩
  languageScores: {
    cet4Score?: number;
    cet6Score?: number;
    toeflScore?: number;
    ieltsScore?: number;
    greScore?: number;
    otherLanguage?: string;
    otherScore?: number;
  };
  
  // 学术专长成绩
  academicAchievements: {
    publications: Array<{
      title: string;
      type: 'A类' | 'B类' | 'C类' | '高水平中文' | '信息通信工程';
      authors: string;
      authorRank: number;
      totalAuthors: number;
      journal: string;
      publishYear: number;
      score: number;
    }>;
    patents: Array<{
      title: string;
      patentNumber: string;
      authorRank: number;
      grantYear: number;
      score: number;
    }>;
    competitions: Array<{
      name: string;
      level: 'A+类' | 'A类' | 'A-类';
      award: '国家级一等奖及以上' | '国家级二等奖' | '国家级三等奖' | '省级一等奖及以上' | '省级二等奖';
      year: number;
      isTeam: boolean;
      teamRank?: number;
      totalTeamMembers?: number;
      score: number;
    }>;
    innovationProjects: Array<{
      name: string;
      level: '国家级' | '省级' | '校级';
      role: '组长' | '成员';
      status: '已结项' | '进行中';
      year: number;
      score: number;
    }>;
    totalAcademicScore: number; // 学术专长总分
  };
  
  // 综合表现成绩
  comprehensivePerformance: {
    volunteerService: {
      hours: number;
      awards: Array<{
        name: string;
        level: '国家级' | '省级' | '校级';
        type: '个人' | '团队';
        role?: '队长' | '队员';
        year: number;
        score: number;
      }>;
      totalScore: number;
    };
    socialWork: Array<{
      position: string;
      duration: string;
      score: number;
      year: number;
    }>;
    honors: Array<{
      title: string;
      level: '国家级' | '省级' | '校级';
      year: number;
      score: number;
    }>;
    sportsCompetitions: Array<{
      name: string;
      level: string;
      award: string;
      year: number;
      score: number;
    }>;
    militaryService?: {
      duration: string;
      score: number;
    };
    internationalOrganization?: {
      organization: string;
      duration: string;
      score: number;
    };
    totalPerformanceScore: number; // 综合表现总分
  };
  
  // 计算得分
  calculatedScores: {
    academicScore: number; // 学业综合成绩 (80%)
    academicAchievementScore: number; // 学术专长成绩 (15%)
    performanceScore: number; // 综合表现成绩 (5%)
    totalScore: number; // 推免综合成绩
  };
  
  // 个人陈述
  personalStatement: string;
  
  // 特殊学术专长申请
  specialAcademicTalent?: {
    isApplying: boolean;
    professorRecommendations: Array<{
      professorName: string;
      title: string;
      department: string;
    }>;
    supportingMaterials: string;
    defensePassed?: boolean;
    defenseScore?: number;
  };
  
  // 上传的证明材料
  uploadedFiles: {
    languageCertificates: Array<{
      type: 'CET4' | 'CET6' | 'TOEFL' | 'IELTS' | 'GRE' | 'OTHER';
      fileName: string;
      uploadDate: string;
    }>;
    academicDocuments: Array<{
      type: 'PUBLICATION' | 'COMPETITION' | 'PATENT' | 'HONOR' | 'VOLUNTEER' | 'INNOVATION';
      title: string;
      fileName: string;
      uploadDate: string;
    }>;
    transcripts: Array<{
      fileName: string;
      uploadDate: string;
    }>;
    recommendationLetters: Array<{
      professorName: string;
      fileName: string;
      uploadDate: string;
    }>;
  };
}

// 厦门大学推免项目数据
export interface Activity {
  id: string;
  name: string;
  department: string; // 系别
  type: '学术型硕士' | '专业型硕士' | '直博';
  startTime: string; // 开始时间
  deadline: string; // 结束时间
  description: string;
  isActive: boolean; // 是否激活
  maxApplications?: number; // 最大申请人数
  // 移除自编的requirements，使用条例中的通用要求
}

// 系统设置
export interface SystemSettings {
  currentAcademicYear: string; // 当前学年
  applicationPeriod: {
    start: string;
    end: string;
  };
  systemMaintenanceMode: boolean; // 系统维护模式
}

// 学生基本信息（用于导入）
export interface StudentBasicInfo {
  studentId: string;
  name: string;
  department: string;
  major: string;
  gpa: number;
  academicRanking: number;
  totalStudents: number;
  email?: string;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'applications' | 'apply' | 'review' | 'activities' | 'import' | 'settings'>('dashboard');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);

  // 模拟登录函数
  const handleLogin = (email: string, password: string) => {
    // 模拟用户验证
    if (email.includes('admin')) {
      setCurrentUser({
        id: '1',
        name: '系统管理员',
        role: 'admin',
        email: email,
        department: '信息学院'
      });
    } else if (email.includes('reviewer')) {
      setCurrentUser({
        id: '3',
        name: '审核老师',
        role: 'reviewer',
        email: email,
        department: '计算机科学系'
      });
    } else {
      setCurrentUser({
        id: '2',
        name: '张同学',
        role: 'student',
        email: email,
        department: '计算机科学系'
      });
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('dashboard');
  };

  const handleApplyToActivity = (activity: Activity) => {
    setSelectedActivity(activity);
    setCurrentView('apply');
  };

  const handleApplicationSubmit = () => {
    setCurrentView('applications');
    setSelectedActivity(null);
  };

  const handleReviewApplication = (application: Application) => {
    setSelectedApplication(application);
    setCurrentView('review');
  };

  const handleBackFromReview = () => {
    setSelectedApplication(null);
    setCurrentView('applications');
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation 
        user={currentUser} 
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
      />
      
      <main className="pb-16">
        {currentView === 'dashboard' && (
          currentUser.role === 'student' ? (
            <StudentDashboard onApply={handleApplyToActivity} />
          ) : currentUser.role === 'reviewer' ? (
            <ReviewerDashboard />
          ) : (
            <AdminDashboard />
          )
        )}
        
        {currentView === 'activities' && currentUser.role === 'admin' && (
          <ActivityManagement />
        )}
        
        {currentView === 'import' && currentUser.role === 'admin' && (
          <DataImport />
        )}
        
        {currentView === 'settings' && currentUser.role === 'admin' && (
          <SystemSettings />
        )}
        
        {currentView === 'applications' && (
          <ApplicationList user={currentUser} onReview={handleReviewApplication} />
        )}
        
        {currentView === 'review' && selectedApplication && (
          <ApplicationReview 
            application={selectedApplication}
            user={currentUser}
            onBack={handleBackFromReview}
          />
        )}
        
        {currentView === 'apply' && selectedActivity && (
          <ApplicationForm 
            activity={selectedActivity}
            user={currentUser}
            onSubmit={handleApplicationSubmit}
            onCancel={() => setCurrentView('dashboard')}
          />
        )}
      </main>
    </div>
  );
};

export default App;