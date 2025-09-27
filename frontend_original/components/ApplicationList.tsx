import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { User, Application } from '../App';
import { Eye, CheckCircle, XCircle, Clock, Calendar, FileText, Award, AlertTriangle, User as UserIcon } from 'lucide-react';

interface ApplicationListProps {
  user: User;
  onReview?: (application: Application) => void;
}

// 模拟厦门大学推免申请数据
const mockStudentApplications: Application[] = [
  {
    id: '1',
    studentId: '37220222203675',
    studentName: '张同学',
    activityId: '1',
    activityName: '厦门大学信息学院2025年推免生招生',
    status: 'approved',
    submittedAt: '2025-09-15',
    systemReviewedAt: '2025-09-16',
    adminReviewedAt: '2025-09-18',
    systemReviewComment: '外语成绩达标，学术专长显著，材料完整',
    adminReviewComment: '综合表现优秀，学术能力突出，推荐录取',
    
    basicInfo: {
      name: '张同学',
      studentId: '37220222203675',
      gender: '男',
      department: '计算机科学与技术系',
      major: '计算机科学与技术',
      gpa: 3.85,
      academicRanking: 6,
      totalStudents: 123
    },
    
    languageScores: {
      cet4Score: 566,
      cet6Score: 590
    },
    
    academicAchievements: {
      publications: [
        {
          title: 'Training-Free Hierarchical Scene Understanding for Gaussian Splatting with Superpoint Graphs',
          type: 'A类',
          authors: '张同学, 导师等',
          authorRank: 3,
          totalAuthors: 6,
          journal: 'ACM Multimedia 2025',
          publishYear: 2025,
          score: 0.45
        }
      ],
      patents: [],
      competitions: [
        {
          name: 'ACM-ICPC国际大学生程序设计竞赛（南京站）',
          level: 'A+类',
          award: '国家级三等奖',
          year: 2022,
          isTeam: true,
          teamRank: 1,
          totalTeamMembers: 3,
          score: 1.35
        }
      ],
      innovationProjects: [],
      totalAcademicScore: 12.4
    },
    
    comprehensivePerformance: {
      volunteerService: {
        hours: 0,
        awards: [],
        totalScore: 0
      },
      socialWork: [],
      honors: [
        {
          title: '三好学生',
          level: '校级',
          year: 2024,
          score: 0.2
        }
      ],
      sportsCompetitions: [],
      totalPerformanceScore: 0.4
    },
    
    calculatedScores: {
      academicScore: 87.86,
      academicAchievementScore: 12.4,
      performanceScore: 0.4,
      totalScore: 87.86
    },
    
    personalStatement: '我对计算机科学与技术领域有浓厚的兴趣，特别是在计算机图形学和机器学习方面...',
    
    uploadedFiles: {
      languageCertificates: [
        { type: 'CET4', fileName: 'CET4_566分_张同学.pdf', uploadDate: '2025-09-10' },
        { type: 'CET6', fileName: 'CET6_590分_张同学.pdf', uploadDate: '2025-09-10' }
      ],
      academicDocuments: [
        { type: 'PUBLICATION', title: 'ACM Multimedia 2025论文录用通知', fileName: 'ACM_MM_2025_acceptance.pdf', uploadDate: '2025-09-12' },
        { type: 'COMPETITION', title: 'ICPC南京站铜奖证书', fileName: 'ICPC_2022_bronze.pdf', uploadDate: '2025-09-12' }
      ],
      transcripts: [
        { fileName: '本科成绩单_张同学.pdf', uploadDate: '2025-09-10' }
      ],
      recommendationLetters: []
    }
  },
  
  {
    id: '2',
    studentId: '37220222203675',
    studentName: '张同学',
    activityId: '2',
    activityName: '厦门大学信息学院2025年专业型硕士推免招生',
    status: 'system_approved',
    submittedAt: '2025-09-20',
    systemReviewedAt: '2025-09-21',
    systemReviewComment: '基本条件符合要求，外语成绩达标，等待管理员审核',
    
    basicInfo: {
      name: '张同学',
      studentId: '37220222203675',
      gender: '男',
      department: '计算机科学与技术系',
      major: '计算机科学与技术',
      gpa: 3.85,
      academicRanking: 6,
      totalStudents: 123
    },
    
    languageScores: {
      cet4Score: 566,
      cet6Score: 590
    },
    
    academicAchievements: {
      publications: [],
      patents: [],
      competitions: [],
      innovationProjects: [],
      totalAcademicScore: 0
    },
    
    comprehensivePerformance: {
      volunteerService: {
        hours: 150,
        awards: [],
        totalScore: 0
      },
      socialWork: [],
      honors: [],
      sportsCompetitions: [],
      totalPerformanceScore: 0
    },
    
    calculatedScores: {
      academicScore: 87.86,
      academicAchievementScore: 0,
      performanceScore: 0,
      totalScore: 70.29
    },
    
    personalStatement: '我希望在软件工程领域继续深造，专注于大型软件系统的设计和开发...',
    
    uploadedFiles: {
      languageCertificates: [
        { type: 'CET4', fileName: 'CET4_566分_张同学.pdf', uploadDate: '2025-09-18' },
        { type: 'CET6', fileName: 'CET6_590分_张同学.pdf', uploadDate: '2025-09-18' }
      ],
      academicDocuments: [],
      transcripts: [
        { fileName: '本科成绩单_张同学.pdf', uploadDate: '2025-09-18' }
      ],
      recommendationLetters: []
    }
  }
];

// 管理员查看的所有申请
const mockAllApplications: Application[] = [
  ...mockStudentApplications,
  {
    id: '3',
    studentId: '37220222203659',
    studentName: '李嘉乐',
    activityId: '3',
    activityName: '厦门大学信息学院2025年直博生招生',
    status: 'system_approved',
    submittedAt: '2025-09-21',
    systemReviewedAt: '2025-09-22',
    systemReviewComment: '特殊学术专长通过认定，发表多篇高水平论文',
    
    basicInfo: {
      name: '李嘉乐',
      studentId: '37220222203659',
      gender: '男',
      department: '人工智能系',
      major: '人工智能',
      gpa: 3.70,
      academicRanking: 16,
      totalStudents: 106
    },
    
    languageScores: {
      cet4Score: 524,
      cet6Score: 452
    },
    
    academicAchievements: {
      publications: [
        {
          title: 'MIHBench: Benchmarking and Mitigating Multi-Image Hallucinations in Multimodal Large Language Models',
          type: 'A类',
          authors: '李嘉乐, 等',
          authorRank: 1,
          totalAuthors: 8,
          journal: 'CCF-A',
          publishYear: 2025,
          score: 8.0
        }
      ],
      patents: [],
      competitions: [],
      innovationProjects: [],
      totalAcademicScore: 15.0
    },
    
    comprehensivePerformance: {
      volunteerService: {
        hours: 295,
        awards: [],
        totalScore: 1.0
      },
      socialWork: [
        {
          position: '22级智能一班班长',
          duration: '两年',
          score: 2.0,
          year: 2024
        }
      ],
      honors: [
        {
          title: '三好学生',
          level: '校级',
          year: 2025,
          score: 0.2
        }
      ],
      sportsCompetitions: [],
      totalPerformanceScore: 3.3
    },
    
    calculatedScores: {
      academicScore: 86.52,
      academicAchievementScore: 15.0,
      performanceScore: 3.3,
      totalScore: 86.52
    },
    
    personalStatement: '我专注于多模态大模型的研究，已发表多篇相关论文...',
    
    specialAcademicTalent: {
      isApplying: true,
      professorRecommendations: [
        { professorName: '王教授', title: '教授', department: '人工智能系' },
        { professorName: '李教授', title: '教授', department: '人工智能系' },
        { professorName: '陈教授', title: '教授', department: '计算机科学与技术系' }
      ],
      supportingMaterials: '发表CCF-A类论文作为第一作者',
      defensePassed: true,
      defenseScore: 15.0
    },
    
    uploadedFiles: {
      languageCertificates: [
        { type: 'CET4', fileName: 'CET4_524分_李嘉乐.pdf', uploadDate: '2025-09-19' },
        { type: 'CET6', fileName: 'CET6_452分_李嘉乐.pdf', uploadDate: '2025-09-19' }
      ],
      academicDocuments: [
        { type: 'PUBLICATION', title: 'CCF-A类论文录用证明', fileName: 'MIHBench_acceptance.pdf', uploadDate: '2025-09-19' },
        { type: 'HONOR', title: '三好学生证书', fileName: '三好学生_2025_李嘉乐.pdf', uploadDate: '2025-09-19' },
        { type: 'VOLUNTEER', title: '志愿服务证明', fileName: '志愿服务295小时_李嘉乐.pdf', uploadDate: '2025-09-19' }
      ],
      transcripts: [
        { fileName: '本科成绩单_李嘉乐.pdf', uploadDate: '2025-09-19' }
      ],
      recommendationLetters: [
        { professorName: '王教授', fileName: '推荐信_王教授_李嘉乐.pdf', uploadDate: '2025-09-19' },
        { professorName: '李教授', fileName: '推荐信_李教授_李嘉乐.pdf', uploadDate: '2025-09-19' },
        { professorName: '陈教授', fileName: '推荐信_陈教授_李嘉乐.pdf', uploadDate: '2025-09-19' }
      ]
    }
  }
];

export const ApplicationList: React.FC<ApplicationListProps> = ({ user, onReview }) => {
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  // 根据用户角色获取相应的申请列表
  const applications = user.role === 'admin' ? mockAllApplications : mockStudentApplications;

  const getStatusInfo = (status: Application['status']) => {
    switch (status) {
      case 'pending':
        return { color: 'secondary', icon: Clock, text: '待系统审核', className: '' };
      case 'system_reviewing':
        return { color: 'default', icon: AlertTriangle, text: '系统审核中', className: '' };
      case 'system_approved':
        return { color: 'default', icon: Eye, text: '待管理员审核', className: 'bg-blue-100 text-blue-800' };
      case 'system_rejected':
        return { color: 'destructive', icon: XCircle, text: '系统审核未通过', className: '' };
      case 'admin_reviewing':
        return { color: 'default', icon: Eye, text: '管理员审核中', className: '' };
      case 'approved':
        return { color: 'default', icon: CheckCircle, text: '审核通过', className: 'bg-green-100 text-green-800' };
      case 'rejected':
        return { color: 'destructive', icon: XCircle, text: '审核未通过', className: '' };
      default:
        return { color: 'secondary', icon: Clock, text: '未知状态', className: '' };
    }
  };

  const handleApprove = (applicationId: string) => {
    console.log('Approving application:', applicationId);
    // 这里可以添加审核通过的逻辑
  };

  const handleReject = (applicationId: string) => {
    console.log('Rejecting application:', applicationId, 'Comment:', reviewComment);
    // 这里可以添加审核拒绝的逻辑
    setReviewComment('');
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg">
            {user.role === 'admin' ? '推免申请审核' : '我的推免申请'}
          </h1>
          <p className="text-sm text-gray-600">
            {user.role === 'admin' ? '厦门大学信息学院推免申请管理' : '查看您的申请状态和详细信息'}
          </p>
        </div>
        <span className="text-sm text-gray-500">
          共 {applications.length} 个申请
        </span>
      </div>

      <div className="space-y-4">
        {applications.map((application) => {
          const statusInfo = getStatusInfo(application.status);
          const StatusIcon = statusInfo.icon;

          return (
            <Card key={application.id} className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-sm">{application.activityName}</h3>
                        {application.specialAcademicTalent?.isApplying && (
                          <Badge variant="secondary" className="text-xs">特殊学术专长</Badge>
                        )}
                      </div>
                      {user.role === 'admin' && (
                        <div className="text-xs text-gray-500 mb-2">
                          <p>申请人：{application.studentName} ({application.studentId})</p>
                          <p>专业：{application.basicInfo.department} - {application.basicInfo.major}</p>
                        </div>
                      )}
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>提交于 {application.submittedAt}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <FileText className="w-3 h-3" />
                          <span>GPA: {application.basicInfo.gpa}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Award className="w-3 h-3" />
                          <span>排名: {application.basicInfo.academicRanking}/{application.basicInfo.totalStudents}</span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge 
                        variant={statusInfo.color} 
                        className={statusInfo.className}
                      >
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusInfo.text}
                      </Badge>
                      <div className="text-xs text-gray-500">
                        <p>综合成绩: {application.calculatedScores.totalScore.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* 审核进度 */}
                  <div className="text-xs">
                    <div className="flex items-center space-x-4">
                      <div className={`flex items-center space-x-1 ${
                        application.systemReviewedAt ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          application.systemReviewedAt ? 'bg-green-500' : 'bg-gray-300'
                        }`}></div>
                        <span>系统审核</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${
                        application.adminReviewedAt ? 'text-green-600' : 
                        application.systemReviewedAt ? 'text-blue-600' : 'text-gray-400'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          application.adminReviewedAt ? 'bg-green-500' : 
                          application.systemReviewedAt ? 'bg-blue-500' : 'bg-gray-300'
                        }`}></div>
                        <span>管理员审核</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${
                        application.status === 'approved' ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          application.status === 'approved' ? 'bg-green-500' : 'bg-gray-300'
                        }`}></div>
                        <span>最终确定</span>
                      </div>
                    </div>
                  </div>

                  {/* 系统审核意见 */}
                  {application.systemReviewComment && (
                    <div className="bg-blue-50 p-2 rounded text-xs">
                      <p className="text-blue-600 mb-1">系统审核意见：</p>
                      <p className="text-blue-800">{application.systemReviewComment}</p>
                    </div>
                  )}

                  {/* 管理员审核意见 */}
                  {application.adminReviewComment && (
                    <div className="bg-green-50 p-2 rounded text-xs">
                      <p className="text-green-600 mb-1">管理员审核意见：</p>
                      <p className="text-green-800">{application.adminReviewComment}</p>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    {user.role === 'admin' && onReview ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => onReview(application)}
                      >
                        审核处理
                      </Button>
                    ) : (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setSelectedApplication(application)}
                          >
                            查看详情
                          </Button>
                        </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>申请详情</DialogTitle>
                        </DialogHeader>
                        {selectedApplication && (
                          <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                              <TabsTrigger value="basic">基本信息</TabsTrigger>
                              <TabsTrigger value="academic">学术专长</TabsTrigger>
                              <TabsTrigger value="comprehensive">综合表现</TabsTrigger>
                              <TabsTrigger value="scores">成绩计算</TabsTrigger>
                            </TabsList>

                            <TabsContent value="basic" className="space-y-4">
                              <div>
                                <h4 className="text-sm mb-2">基本信息</h4>
                                <div className="text-xs space-y-1 text-gray-600">
                                  <p>姓名：{selectedApplication.basicInfo.name}</p>
                                  <p>学号：{selectedApplication.basicInfo.studentId}</p>
                                  <p>性别：{selectedApplication.basicInfo.gender}</p>
                                  <p>系别：{selectedApplication.basicInfo.department}</p>
                                  <p>专业：{selectedApplication.basicInfo.major}</p>
                                  <p>GPA：{selectedApplication.basicInfo.gpa}</p>
                                  <p>排名：{selectedApplication.basicInfo.academicRanking}/{selectedApplication.basicInfo.totalStudents}</p>
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="text-sm mb-2">外语成绩</h4>
                                <div className="text-xs space-y-1 text-gray-600">
                                  {selectedApplication.languageScores.cet4Score && (
                                    <p>英语四级：{selectedApplication.languageScores.cet4Score}分</p>
                                  )}
                                  {selectedApplication.languageScores.cet6Score && (
                                    <p>英语六级：{selectedApplication.languageScores.cet6Score}分</p>
                                  )}
                                  {selectedApplication.languageScores.toeflScore && (
                                    <p>TOEFL：{selectedApplication.languageScores.toeflScore}分</p>
                                  )}
                                  {selectedApplication.languageScores.ieltsScore && (
                                    <p>IELTS：{selectedApplication.languageScores.ieltsScore}分</p>
                                  )}
                                </div>
                              </div>
                            </TabsContent>

                            <TabsContent value="academic" className="space-y-4">
                              {/* 论文发表 */}
                              {selectedApplication.academicAchievements.publications.length > 0 && (
                                <div>
                                  <h4 className="text-sm mb-2">论文发表</h4>
                                  {selectedApplication.academicAchievements.publications.map((pub, index) => (
                                    <div key={index} className="text-xs bg-gray-50 p-2 rounded mb-2">
                                      <p className="text-semibold">{pub.title}</p>
                                      <p className="text-gray-600">
                                        {pub.journal} ({pub.publishYear}) - {pub.type}类
                                      </p>
                                      <p className="text-gray-600">
                                        作者排名：第{pub.authorRank}作者（共{pub.totalAuthors}人）
                                      </p>
                                      <p className="text-blue-600">加分：{pub.score}分</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* 学科竞赛 */}
                              {selectedApplication.academicAchievements.competitions.length > 0 && (
                                <div>
                                  <h4 className="text-sm mb-2">学科竞赛</h4>
                                  {selectedApplication.academicAchievements.competitions.map((comp, index) => (
                                    <div key={index} className="text-xs bg-gray-50 p-2 rounded mb-2">
                                      <p className="text-semibold">{comp.name}</p>
                                      <p className="text-gray-600">
                                        {comp.level} - {comp.award} ({comp.year}年)
                                      </p>
                                      {comp.isTeam && (
                                        <p className="text-gray-600">
                                          团队竞赛，第{comp.teamRank}名（共{comp.totalTeamMembers}人）
                                        </p>
                                      )}
                                      <p className="text-blue-600">加分：{comp.score}分</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* 特殊学术专长 */}
                              {selectedApplication.specialAcademicTalent?.isApplying && (
                                <div>
                                  <h4 className="text-sm mb-2">特殊学术专长申请</h4>
                                  <div className="text-xs bg-yellow-50 p-2 rounded">
                                    <p className="text-yellow-800 mb-1">推荐教授：</p>
                                    {selectedApplication.specialAcademicTalent.professorRecommendations.map((prof, index) => (
                                      <p key={index} className="text-yellow-700">
                                        {prof.professorName} ({prof.title}, {prof.department})
                                      </p>
                                    ))}
                                    <p className="text-yellow-800 mt-2">
                                      答辩状态：{selectedApplication.specialAcademicTalent.defensePassed ? '已通过' : '待答辩'}
                                    </p>
                                    {selectedApplication.specialAcademicTalent.defenseScore && (
                                      <p className="text-green-600">
                                        答辩得分：{selectedApplication.specialAcademicTalent.defenseScore}分
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </TabsContent>

                            <TabsContent value="comprehensive" className="space-y-4">
                              {/* 志愿服务 */}
                              <div>
                                <h4 className="text-sm mb-2">志愿服务</h4>
                                <div className="text-xs text-gray-600">
                                  <p>志愿服务时长：{selectedApplication.comprehensivePerformance.volunteerService.hours}小时</p>
                                  <p>志愿服务加分：{selectedApplication.comprehensivePerformance.volunteerService.totalScore}分</p>
                                </div>
                              </div>

                              {/* 社会工作 */}
                              {selectedApplication.comprehensivePerformance.socialWork.length > 0 && (
                                <div>
                                  <h4 className="text-sm mb-2">社会工作</h4>
                                  {selectedApplication.comprehensivePerformance.socialWork.map((work, index) => (
                                    <div key={index} className="text-xs bg-gray-50 p-2 rounded mb-2">
                                      <p>{work.position} - {work.duration}</p>
                                      <p className="text-blue-600">加分：{work.score}分</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* 荣誉称号 */}
                              {selectedApplication.comprehensivePerformance.honors.length > 0 && (
                                <div>
                                  <h4 className="text-sm mb-2">荣誉称号</h4>
                                  {selectedApplication.comprehensivePerformance.honors.map((honor, index) => (
                                    <div key={index} className="text-xs bg-gray-50 p-2 rounded mb-2">
                                      <p>{honor.title} ({honor.level}, {honor.year}年)</p>
                                      <p className="text-blue-600">加分：{honor.score}分</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TabsContent>

                            <TabsContent value="scores" className="space-y-4">
                              <div>
                                <h4 className="text-sm mb-2">推免综合成绩计算</h4>
                                <div className="text-xs space-y-2">
                                  <div className="flex justify-between">
                                    <span>学业综合成绩 (80%)：</span>
                                    <span>{selectedApplication.calculatedScores.academicScore.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>学术专长成绩 (15%)：</span>
                                    <span>{selectedApplication.calculatedScores.academicAchievementScore.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>综合表现成绩 (5%)：</span>
                                    <span>{selectedApplication.calculatedScores.performanceScore.toFixed(2)}</span>
                                  </div>
                                  <div className="border-t pt-2 flex justify-between text-semibold">
                                    <span>推免综合成绩：</span>
                                    <span className="text-blue-600">{selectedApplication.calculatedScores.totalScore.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm mb-2">个人陈述</h4>
                                <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                                  {selectedApplication.personalStatement}
                                </div>
                              </div>
                            </TabsContent>

                            {user.role === 'admin' && selectedApplication.status === 'system_approved' && (
                              <div className="space-y-3 mt-4">
                                <div>
                                  <h4 className="text-sm mb-2">管理员审核意见</h4>
                                  <Textarea
                                    placeholder="请输入审核意见..."
                                    value={reviewComment}
                                    onChange={(e) => setReviewComment(e.target.value)}
                                    rows={3}
                                  />
                                </div>
                                <div className="flex space-x-2">
                                  <Button 
                                    size="sm" 
                                    className="flex-1"
                                    onClick={() => handleApprove(selectedApplication.id)}
                                  >
                                    通过
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="destructive" 
                                    className="flex-1"
                                    onClick={() => handleReject(selectedApplication.id)}
                                  >
                                    拒绝
                                  </Button>
                                </div>
                              </div>
                            )}
                          </Tabs>
                        )}
                      </DialogContent>
                    </Dialog>
                    )}

                    {user.role === 'admin' && application.status === 'system_approved' && (
                      <>
                        <Button 
                          size="sm" 
                          onClick={() => handleApprove(application.id)}
                        >
                          快速通过
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleReject(application.id)}
                        >
                          快速拒绝
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {applications.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg mb-2">暂无申请记录</h3>
            <p className="text-gray-600 text-sm">
              {user.role === 'admin' ? '暂无学生申请需要审核' : '您还没有提交任何推免申请'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};