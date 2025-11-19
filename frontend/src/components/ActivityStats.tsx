import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { ArrowLeft, Download, Trophy, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { exportApplicationsExcel, buildAcademicItems, buildPerformanceItems } from './utils/exportExcel';
import { Application } from '../App';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';

interface StatApplication {
  id: string;
  studentId: string;
  name: string;
  department: string;
  major: string;
  status: string;
  academicScore: number;
  achievementScore: number;
  performanceScore: number;
  totalScore: number;
  submittedAt: string;
  content: any;
}

interface ActivityInfo {
  id: string;
  name: string;
  maxApplications: number;
}

export const ActivityStats: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityInfo | null>(null);
  const [applications, setApplications] = useState<StatApplication[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load activity info
        const actRes = await fetch(`/api/activities/${id}`, { credentials: 'include' });
        if (!actRes.ok) throw new Error('加载活动信息失败');
        const actData = await actRes.json();
        setActivity({
          id: String(actData.id),
          name: actData.name,
          maxApplications: actData.maxApplications || 0
        });

        // Load applications
        const appRes = await fetch(`/api/applications/activity/${id}`, { credentials: 'include' });
        if (!appRes.ok) throw new Error('加载申请列表失败');
        const appData = await appRes.json();
        
        const mappedApps: StatApplication[] = appData.map((a: any) => {
          const content = a.content ? JSON.parse(a.content) : {};
          const calc = content.calculatedScores || {};
          return {
            id: String(a.id),
            studentId: a.userStudentId || content.basicInfo?.studentId || '-',
            name: a.userName || content.basicInfo?.name || '-',
            department: a.userDepartment || content.basicInfo?.department || '-',
            major: a.userMajor || content.basicInfo?.major || '-',
            status: a.status,
            academicScore: typeof a.academicScore === 'number' ? a.academicScore : (calc.academicScore || 0),
            achievementScore: typeof a.achievementScore === 'number' ? a.achievementScore : (calc.academicAchievementScore || 0),
            performanceScore: typeof a.performanceScore === 'number' ? a.performanceScore : (calc.performanceScore || 0),
            totalScore: typeof a.totalScore === 'number' ? a.totalScore : (calc.totalScore || 0),
            submittedAt: a.submittedAt,
            content: content
          };
        });

        // Sort by total score descending
        mappedApps.sort((a, b) => b.totalScore - a.totalScore);
        setApplications(mappedApps);
      } catch (e: any) {
        toast.error(e.message || '加载数据失败');
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id]);

  const exportExcel = () => {
    if (!activity) return;
    
    // Convert StatApplication to Application for export
    const appsToExport: Application[] = applications.map(app => ({
      id: app.id,
      activityId: activity.id,
      activityName: activity.name,
      status: 'approved', // Force status to approved to pass the filter in exportExcel, or we should modify exportExcel to not filter
      basicInfo: app.content.basicInfo,
      languageScores: app.content.languageScores,
      academicAchievements: app.content.academicAchievements,
      comprehensivePerformance: app.content.comprehensivePerformance,
      calculatedScores: app.content.calculatedScores,
      calculatedRaw: app.content.calculatedRaw,
      personalStatement: app.content.personalStatement,
      uploadedFiles: app.content.uploadedFiles,
      specialAcademicTalent: app.content.specialAcademicTalent,
      studentId: app.studentId,
      studentName: app.name,
      submittedAt: app.submittedAt
    } as Application));

    // Filter only admitted students if maxApplications is set, otherwise export all
    // Or maybe export all but mark admitted? exportExcel doesn't support marking admitted yet.
    // The user asked for "export final recommended list", which implies only admitted ones.
    // But let's export all sorted by score, as the user might want to see the ranking.
    // However, exportExcel logic is complex and designed for "approved" students.
    // Let's filter for approved students only as per original logic, but sorted by score.
    
    const approvedApps = appsToExport.filter((_, index) => {
       // If we want to export the "Proposed Admission List", we should export top N students who are approved.
       // But the user might want to see everyone.
       // Let's export everyone in the list (which is already sorted by score)
       // We set status='approved' above to bypass the check in exportExcel if we want to export everyone.
       // But wait, exportExcel checks `a.status==='approved'`.
       // If we want to export exactly the "Proposed Admission List", we should filter by `isAdmitted`.
       const isAdmitted = activity.maxApplications > 0 ? index < activity.maxApplications : true;
       // Also check if the application status is actually approved in the system
       const isActuallyApproved = applications[index].status === 'APPROVED';
       return isAdmitted && isActuallyApproved;
    });

    if (approvedApps.length === 0) {
      toast.error('没有符合拟录取条件的申请（需状态为通过且在名额范围内）');
      return;
    }

    exportApplicationsExcel(approvedApps, `${activity.name}_保研名单.xlsx`);
  };

  if (loading) return <div className="p-8 text-center">加载中...</div>;
  if (!activity) return <div className="p-8 text-center text-red-600">活动不存在</div>;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/activities')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{activity.name} - 保研统计</h1>
            <p className="text-gray-500">
              共 {applications.length} 人申请
              {activity.maxApplications > 0 && `，拟录取前 ${activity.maxApplications} 人`}
            </p>
          </div>
        </div>
        <Button onClick={exportExcel} className="gap-2">
          <Download className="h-4 w-4" /> 导出名单
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>申请排名名单</CardTitle>
          <CardDescription>按综合成绩降序排列</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">排名</TableHead>
                <TableHead>学号</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>专业</TableHead>
                <TableHead className="text-right">学业成绩</TableHead>
                <TableHead className="text-right">学术专长</TableHead>
                <TableHead className="text-right">综合表现</TableHead>
                <TableHead className="text-right font-bold">总分</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>拟录取</TableHead>
                <TableHead>详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app, index) => {
                const isAdmitted = activity.maxApplications > 0 && index < activity.maxApplications && app.status === 'APPROVED';
                
                // Convert to Application type for helper functions
                const appForHelpers = {
                  basicInfo: app.content.basicInfo,
                  languageScores: app.content.languageScores,
                  academicAchievements: app.content.academicAchievements,
                  comprehensivePerformance: app.content.comprehensivePerformance,
                  calculatedScores: app.content.calculatedScores,
                  calculatedRaw: app.content.calculatedRaw,
                  studentId: app.studentId,
                  studentName: app.name
                } as Application;

                const academicItems = buildAcademicItems(appForHelpers);
                const performanceItems = buildPerformanceItems(appForHelpers);

                return (
                  <TableRow key={app.id} className={isAdmitted ? 'bg-green-50/50' : ''}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{app.studentId}</TableCell>
                    <TableCell>{app.name}</TableCell>
                    <TableCell>{app.major}</TableCell>
                    <TableCell className="text-right">{app.academicScore.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{app.achievementScore.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{app.performanceScore.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold text-lg">{app.totalScore.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{app.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {isAdmitted && (
                        <div className="flex items-center text-green-600 gap-1">
                          <Trophy className="h-4 w-4" />
                          <span className="text-xs font-bold">拟录取</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle>{app.name} - 加分详情</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="h-[60vh] pr-4">
                            <div className="space-y-6">
                              <div>
                                <h3 className="font-semibold mb-2 flex items-center justify-between">
                                  <span>学术专长 (总分: {app.achievementScore.toFixed(2)})</span>
                                  <span className="text-xs text-gray-500">满分15折算12%</span>
                                </h3>
                                {academicItems.length > 0 ? (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>项目</TableHead>
                                        <TableHead>级别/类型</TableHead>
                                        <TableHead>性质</TableHead>
                                        <TableHead className="text-right">加分</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {academicItems.map((item, i) => (
                                        <TableRow key={i}>
                                          <TableCell className="font-medium">{item.title}</TableCell>
                                          <TableCell>{item.level}</TableCell>
                                          <TableCell>{item.personal ? '个人' : `集体 (${item.teamPos})`}</TableCell>
                                          <TableCell className="text-right">{item.selfScore}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : <div className="text-sm text-gray-500 pl-2">无学术专长加分项</div>}
                              </div>

                              <div>
                                <h3 className="font-semibold mb-2 flex items-center justify-between">
                                  <span>综合表现 (总分: {app.performanceScore.toFixed(2)})</span>
                                  <span className="text-xs text-gray-500">满分5折算8%</span>
                                </h3>
                                {performanceItems.length > 0 ? (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>项目</TableHead>
                                        <TableHead>级别/类型</TableHead>
                                        <TableHead>性质</TableHead>
                                        <TableHead className="text-right">加分</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {performanceItems.map((item, i) => (
                                        <TableRow key={i}>
                                          <TableCell className="font-medium">{item.title}</TableCell>
                                          <TableCell>{item.level}</TableCell>
                                          <TableCell>{item.personal ? '个人' : `集体 (${item.teamPos})`}</TableCell>
                                          <TableCell className="text-right">{item.selfScore}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : <div className="text-sm text-gray-500 pl-2">无综合表现加分项</div>}
                              </div>
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                );
              })}
              {applications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                    暂无申请数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
