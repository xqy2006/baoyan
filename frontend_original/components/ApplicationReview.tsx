import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Application, User } from '../App';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  FileText, 
  User as UserIcon, 
  Award, 
  Download,
  Eye,
  AlertTriangle,
  Calculator
} from 'lucide-react';

interface ApplicationReviewProps {
  application: Application;
  user: User;
  onBack: () => void;
}

export const ApplicationReview: React.FC<ApplicationReviewProps> = ({
  application,
  user,
  onBack
}) => {
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async () => {
    setIsSubmitting(true);
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Approved application:', application.id, 'Comment:', reviewComment);
    setIsSubmitting(false);
    onBack();
  };

  const handleReject = async () => {
    if (!reviewComment.trim()) {
      alert('请填写拒绝理由');
      return;
    }
    setIsSubmitting(true);
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Rejected application:', application.id, 'Comment:', reviewComment);
    setIsSubmitting(false);
    onBack();
  };

  const calculateScoreBreakdown = () => {
    // 根据保研条例计算详细得分
    const academic = application.calculatedScores.academicScore * 0.8;
    const academicAchievement = Math.min(application.academicAchievements.totalAcademicScore, 15);
    const performance = Math.min(application.comprehensivePerformance.totalPerformanceScore, 5);
    const total = academic + academicAchievement + performance;
    
    return {
      academic,
      academicAchievement,
      performance,
      total
    };
  };

  const scores = calculateScoreBreakdown();

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'system_approved': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'system_rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* 头部信息 */}
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg">申请审核详情</h1>
          <p className="text-sm text-gray-600">{application.activityName}</p>
        </div>
        <Badge className={getStatusColor(application.status)}>
          {application.status === 'system_approved' ? '待管理员审核' : 
           application.status === 'approved' ? '已通过' : 
           application.status === 'rejected' ? '已拒绝' : '审核中'}
        </Badge>
      </div>

      {/* 学生基本信息概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserIcon className="w-5 h-5" />
            <span>申请人信息</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">姓名：</span>
              <span>{application.basicInfo.name}</span>
            </div>
            <div>
              <span className="text-gray-600">学号：</span>
              <span>{application.basicInfo.studentId}</span>
            </div>
            <div>
              <span className="text-gray-600">系别：</span>
              <span>{application.basicInfo.department}</span>
            </div>
            <div>
              <span className="text-gray-600">专业：</span>
              <span>{application.basicInfo.major}</span>
            </div>
            <div>
              <span className="text-gray-600">GPA：</span>
              <span className="text-blue-600">{application.basicInfo.gpa}</span>
            </div>
            <div>
              <span className="text-gray-600">学业排名：</span>
              <span className="text-blue-600">
                {application.basicInfo.academicRanking}/{application.basicInfo.totalStudents}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 系统审核结果 */}
      {application.systemReviewComment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5" />
              <span>系统审核结果</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">{application.systemReviewComment}</p>
              <p className="text-xs text-blue-600 mt-1">
                审核时间：{application.systemReviewedAt}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 详细信息选项卡 */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="scores" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="scores">成绩计算</TabsTrigger>
              <TabsTrigger value="language">外语成绩</TabsTrigger>
              <TabsTrigger value="academic">学术专长</TabsTrigger>
              <TabsTrigger value="comprehensive">综合表现</TabsTrigger>
              <TabsTrigger value="files">材料证明</TabsTrigger>
            </TabsList>

            {/* 成绩计算 */}
            <TabsContent value="scores" className="p-4 space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <Calculator className="w-5 h-5" />
                <h3 className="text-lg">推免综合成绩计算</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span>学业综合成绩 (80%)</span>
                  <div className="text-right">
                    <p className="text-lg">{application.calculatedScores.academicScore.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">
                      加权后：{scores.academic.toFixed(2)}
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span>学术专长成绩 (15%)</span>
                  <div className="text-right">
                    <p className="text-lg text-blue-600">{scores.academicAchievement.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">
                      原始分：{application.academicAchievements.totalAcademicScore.toFixed(2)}
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span>综合表现成绩 (5%)</span>
                  <div className="text-right">
                    <p className="text-lg text-green-600">{scores.performance.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">
                      原始分：{application.comprehensivePerformance.totalPerformanceScore.toFixed(2)}
                    </p>
                  </div>
                </div>
                
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                    <span className="text-lg">推免综合成绩</span>
                    <span className="text-2xl text-blue-600">{scores.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {application.specialAcademicTalent?.isApplying && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    <span className="text-semibold">特殊学术专长申请：</span>
                    {application.specialAcademicTalent.defensePassed ? '已通过答辩' : '待答辩'}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* 外语成绩 */}
            <TabsContent value="language" className="p-4 space-y-4">
              <div className="space-y-3">
                {application.languageScores.cet4Score && (
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span>英语四级成绩</span>
                    <span className={
                      application.languageScores.cet4Score >= 500 ? 'text-green-600' : 'text-red-600'
                    }>
                      {application.languageScores.cet4Score}分
                      {application.languageScores.cet4Score >= 500 && ' ✓'}
                    </span>
                  </div>
                )}
                
                {application.languageScores.cet6Score && (
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span>英语六级成绩</span>
                    <span className={
                      application.languageScores.cet6Score >= 425 ? 'text-green-600' : 'text-red-600'
                    }>
                      {application.languageScores.cet6Score}分
                      {application.languageScores.cet6Score >= 425 && ' ✓'}
                    </span>
                  </div>
                )}
                
                {application.languageScores.toeflScore && (
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span>TOEFL成绩</span>
                    <span className={
                      application.languageScores.toeflScore >= 90 ? 'text-green-600' : 'text-red-600'
                    }>
                      {application.languageScores.toeflScore}分
                      {application.languageScores.toeflScore >= 90 && ' ✓'}
                    </span>
                  </div>
                )}
                
                {application.languageScores.ieltsScore && (
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span>IELTS成绩</span>
                    <span className={
                      application.languageScores.ieltsScore >= 6.0 ? 'text-green-600' : 'text-red-600'
                    }>
                      {application.languageScores.ieltsScore}分
                      {application.languageScores.ieltsScore >= 6.0 && ' ✓'}
                    </span>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 学术专长 */}
            <TabsContent value="academic" className="p-4 space-y-4">
              {/* 论文发表 */}
              {application.academicAchievements.publications.length > 0 && (
                <div>
                  <h4 className="text-sm mb-3">论文发表</h4>
                  {application.academicAchievements.publications.map((pub, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded mb-2">
                      <h5 className="text-sm">{pub.title}</h5>
                      <p className="text-xs text-gray-600 mt-1">
                        {pub.journal} ({pub.publishYear}) - {pub.type}类
                      </p>
                      <p className="text-xs text-gray-600">
                        作者排名：第{pub.authorRank}作者（共{pub.totalAuthors}人）
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        系统计算加分：{pub.score}分
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* 学科竞赛 */}
              {application.academicAchievements.competitions.length > 0 && (
                <div>
                  <h4 className="text-sm mb-3">学科竞赛</h4>
                  {application.academicAchievements.competitions.map((comp, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded mb-2">
                      <h5 className="text-sm">{comp.name}</h5>
                      <p className="text-xs text-gray-600 mt-1">
                        {comp.level} - {comp.award} ({comp.year}年)
                      </p>
                      {comp.isTeam && (
                        <p className="text-xs text-gray-600">
                          团队竞赛，排名第{comp.teamRank}（共{comp.totalTeamMembers}人）
                        </p>
                      )}
                      <p className="text-xs text-blue-600 mt-1">
                        系统计算加分：{comp.score}分
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* 专利 */}
              {application.academicAchievements.patents.length > 0 && (
                <div>
                  <h4 className="text-sm mb-3">专利授权</h4>
                  {application.academicAchievements.patents.map((patent, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded mb-2">
                      <h5 className="text-sm">{patent.title}</h5>
                      <p className="text-xs text-gray-600 mt-1">
                        专利号：{patent.patentNumber}
                      </p>
                      <p className="text-xs text-gray-600">
                        授权年份：{patent.grantYear}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        系统计算加分：{patent.score}分
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 综合表现 */}
            <TabsContent value="comprehensive" className="p-4 space-y-4">
              {/* 志愿服务 */}
              <div>
                <h4 className="text-sm mb-3">志愿服务</h4>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-sm">
                    志愿服务时长：{application.comprehensivePerformance.volunteerService.hours}小时
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    加分：{application.comprehensivePerformance.volunteerService.totalScore}分
                  </p>
                </div>
              </div>

              {/* 社会工作 */}
              {application.comprehensivePerformance.socialWork.length > 0 && (
                <div>
                  <h4 className="text-sm mb-3">社会工作</h4>
                  {application.comprehensivePerformance.socialWork.map((work, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded mb-2">
                      <p className="text-sm">{work.position}</p>
                      <p className="text-xs text-gray-600">任职时长：{work.duration}</p>
                      <p className="text-xs text-blue-600 mt-1">加分：{work.score}分</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 荣誉称号 */}
              {application.comprehensivePerformance.honors.length > 0 && (
                <div>
                  <h4 className="text-sm mb-3">荣誉称号</h4>
                  {application.comprehensivePerformance.honors.map((honor, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded mb-2">
                      <p className="text-sm">{honor.title}</p>
                      <p className="text-xs text-gray-600">{honor.level} ({honor.year}年)</p>
                      <p className="text-xs text-blue-600 mt-1">加分：{honor.score}分</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 材料证明 */}
            <TabsContent value="files" className="p-4 space-y-4">
              {/* 外语成绩证明 */}
              <div>
                <h4 className="text-sm mb-3">外语成绩证明</h4>
                {application.uploadedFiles.languageCertificates.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded mb-2">
                    <div>
                      <p className="text-sm">{file.type} 成绩单</p>
                      <p className="text-xs text-gray-500">上传时间：{file.uploadDate}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        <Eye className="w-3 h-3 mr-1" />
                        查看
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="w-3 h-3 mr-1" />
                        下载
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 学术材料证明 */}
              <div>
                <h4 className="text-sm mb-3">学术材料证明</h4>
                {application.uploadedFiles.academicDocuments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded mb-2">
                    <div>
                      <p className="text-sm">{file.title}</p>
                      <p className="text-xs text-gray-500">
                        类型：{file.type} | 上传时间：{file.uploadDate}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        <Eye className="w-3 h-3 mr-1" />
                        查看
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="w-3 h-3 mr-1" />
                        下载
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 成绩单 */}
              <div>
                <h4 className="text-sm mb-3">成绩单</h4>
                {application.uploadedFiles.transcripts.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded mb-2">
                    <div>
                      <p className="text-sm">官方成绩单</p>
                      <p className="text-xs text-gray-500">上传时间：{file.uploadDate}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        <Eye className="w-3 h-3 mr-1" />
                        查看
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="w-3 h-3 mr-1" />
                        下载
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 个人陈述 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>个人陈述</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-4 rounded max-h-40 overflow-y-auto">
            <p className="text-sm leading-relaxed">{application.personalStatement}</p>
          </div>
        </CardContent>
      </Card>

      {/* 审核操作 */}
      {user.role === 'admin' && application.status === 'system_approved' && (
        <Card>
          <CardHeader>
            <CardTitle>管理员审核</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm mb-2 block">审核意见</label>
              <Textarea
                placeholder="请输入详细的审核意见..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
              />
            </div>
            
            <div className="flex space-x-3">
              <Button 
                onClick={handleApprove}
                disabled={isSubmitting}
                className="flex-1"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {isSubmitting ? '处理中...' : '通过申请'}
              </Button>
              <Button 
                onClick={handleReject}
                disabled={isSubmitting}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="w-4 h-4 mr-2" />
                {isSubmitting ? '处理中...' : '拒绝申请'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};