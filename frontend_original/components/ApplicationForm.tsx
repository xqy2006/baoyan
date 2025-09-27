import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Activity, User } from '../App';
import { ArrowLeft, Plus, Trash2, User as UserIcon, Award, FileText, BookOpen, Trophy, Upload, AlertTriangle } from 'lucide-react';

interface ApplicationFormProps {
  activity: Activity;
  user: User;
  onSubmit: () => void;
  onCancel: () => void;
}

export const ApplicationForm: React.FC<ApplicationFormProps> = ({
  activity,
  user,
  onSubmit,
  onCancel
}) => {
  // 系统预录入的基本信息（模拟从教务系统获取）
  const [basicInfo, setBasicInfo] = useState({
    name: user.name,
    studentId: '37220222203675', // 系统预录入
    gender: '男' as '男' | '女',
    department: '计算机科学与技术系', // 系统预录入
    major: '计算机科学与技术', // 系统预录入
    gpa: '3.85', // 系统预录入
    academicRanking: '6', // 系统预录入
    totalStudents: '123' // 系统预录入
  });

  // 外语成绩
  const [languageScores, setLanguageScores] = useState({
    cet4Score: '',
    cet6Score: '',
    toeflScore: '',
    ieltsScore: '',
    greScore: '',
    otherLanguage: '',
    otherScore: ''
  });

  // 学术专长
  const [publications, setPublications] = useState([{ 
    title: '', type: 'A类' as const, authors: '', authorRank: 1, totalAuthors: 1, journal: '', publishYear: 2024, proofFile: null as File | null 
  }]);
  
  const [competitions, setCompetitions] = useState([{ 
    name: '', level: 'A+类' as const, award: '国家级一等奖及以上' as const, year: 2024, isTeam: false, teamRank: 1, totalTeamMembers: 1, proofFile: null as File | null 
  }]);
  
  const [patents, setPatents] = useState([{ 
    title: '', patentNumber: '', authorRank: 1, grantYear: 2024, proofFile: null as File | null 
  }]);

  const [innovationProjects, setInnovationProjects] = useState([{
    name: '', level: '国家级' as const, role: '组长' as const, status: '已结项' as const, year: 2024, proofFile: null as File | null
  }]);

  // 综合表现
  const [volunteerHours, setVolunteerHours] = useState('');
  const [volunteerAwards, setVolunteerAwards] = useState([{
    name: '', level: '国家级' as const, type: '个人' as const, role: '队长' as const, year: 2024, proofFile: null as File | null
  }]);

  const [socialWork, setSocialWork] = useState([{
    position: '', duration: '', year: 2024
  }]);

  const [honors, setHonors] = useState([{
    title: '', level: '国家级' as const, year: 2024, proofFile: null as File | null
  }]);

  // 文件上传
  const [languageCertificates, setLanguageCertificates] = useState<{[key: string]: File | null}>({
    cet4: null,
    cet6: null,
    toefl: null,
    ielts: null,
    gre: null
  });

  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [volunteerProofFile, setVolunteerProofFile] = useState<File | null>(null);

  // 特殊学术专长申请
  const [isSpecialTalent, setIsSpecialTalent] = useState(false);
  const [professors, setProfessors] = useState([
    { name: '', title: '', department: '' }
  ]);

  const [personalStatement, setPersonalStatement] = useState('');

  // 自动计算加分
  const [calculatedScores, setCalculatedScores] = useState({
    academicAchievement: 0,
    comprehensivePerformance: 0
  });

  // 根据保研条例自动计算加分
  useEffect(() => {
    let academicScore = 0;
    let performanceScore = 0;

    // 计算论文加分
    publications.forEach(pub => {
      if (pub.title && pub.type && pub.authorRank && pub.totalAuthors) {
        let baseScore = 0;
        switch (pub.type) {
          case 'A类': baseScore = 10; break;
          case 'B类': baseScore = 6; break;
          case 'C类': baseScore = 1; break;
          case '高水平中文': baseScore = 6; break;
          case '信息通信工程': baseScore = 10; break;
        }
        
        // 计算作者排名加分比例
        let authorRatio = 0;
        if (pub.authorRank === 1) {
          authorRatio = pub.totalAuthors <= 2 ? 1.0 : 0.8; // 第一作者
        } else if (pub.authorRank === 2) {
          authorRatio = 0.2; // 第二作者
        }
        
        academicScore += baseScore * authorRatio;
      }
    });

    // 计算竞赛加分
    competitions.forEach(comp => {
      if (comp.name && comp.level && comp.award) {
        let baseScore = 0;
        
        // 根据保研条例计算竞赛加分
        if (comp.level === 'A+类') {
          switch (comp.award) {
            case '国家级一等奖及以上': baseScore = 30; break;
            case '国家级二等奖': baseScore = 15; break;
            case '国家级三等奖': baseScore = 10; break;
            case '省级一等奖及以上': baseScore = 5; break;
            case '省级二等奖': baseScore = 2; break;
          }
        } else if (comp.level === 'A类') {
          switch (comp.award) {
            case '国家级一等奖及以上': baseScore = 15; break;
            case '国家级二等奖': baseScore = 10; break;
            case '国家级三等奖': baseScore = 5; break;
            case '省级一等奖及以上': baseScore = 2; break;
            case '省级二等奖': baseScore = 1; break;
          }
        } else if (comp.level === 'A-类') {
          switch (comp.award) {
            case '国家级一等奖及以上': baseScore = 10; break;
            case '国家级二等奖': baseScore = 5; break;
            case '国家级三等奖': baseScore = 2; break;
            case '省级一等奖及以上': baseScore = 1; break;
            case '省级二等奖': baseScore = 0.5; break;
          }
        }
        
        // 团体项目加分计算
        if (comp.isTeam && comp.totalTeamMembers > 1) {
          if (comp.totalTeamMembers === 2) {
            baseScore = baseScore / 3;
          } else if (comp.totalTeamMembers <= 5) {
            baseScore = baseScore / comp.totalTeamMembers;
          } else {
            baseScore = baseScore / 5; // 超过5人只取前5名
          }
        } else if (!comp.isTeam) {
          baseScore = baseScore / 3; // 个人项目
        }
        
        academicScore += baseScore;
      }
    });

    // 专利加分
    patents.forEach(patent => {
      if (patent.title && patent.patentNumber) {
        let score = 2;
        if (patent.authorRank === 1) score *= 0.8; // 第一作者
        academicScore += score;
      }
    });

    // 创新项目加分
    innovationProjects.forEach(project => {
      if (project.name && project.status === '已结项') {
        let score = 0;
        switch (project.level) {
          case '国家级': score = project.role === '组长' ? 1 : 0.3; break;
          case '省级': score = project.role === '组长' ? 0.5 : 0.2; break;
          case '校级': score = project.role === '组长' ? 0.1 : 0.05; break;
        }
        academicScore += score;
      }
    });

    // 限制学术专长最高15分
    academicScore = Math.min(academicScore, 15);

    // 计算志愿服务加分
    const hours = parseInt(volunteerHours) || 0;
    if (hours >= 200) {
      performanceScore += Math.min(1 + (hours - 200) * 0.025, 1); // 最多1分
    }

    // 荣誉称号加分
    honors.forEach(honor => {
      if (honor.title && honor.level) {
        let score = 0;
        switch (honor.level) {
          case '国家级': score = 2; break;
          case '省级': score = 1; break;
          case '校级': score = 0.2; break;
        }
        performanceScore += score;
      }
    });

    // 社会工作加分（简化计算）
    socialWork.forEach(work => {
      if (work.position && work.duration) {
        performanceScore += 0.5; // 简化加分
      }
    });

    // 限制综合表现最高5分
    performanceScore = Math.min(performanceScore, 5);

    setCalculatedScores({
      academicAchievement: academicScore,
      comprehensivePerformance: performanceScore
    });
  }, [publications, competitions, patents, innovationProjects, volunteerHours, honors, socialWork]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 检查必需的证明文件
    const hasLanguageProof = Object.values(languageCertificates).some(file => file !== null);
    if (!hasLanguageProof) {
      alert('请上传外语成绩证明');
      return;
    }
    
    if (!transcriptFile) {
      alert('请上传成绩单');
      return;
    }
    
    // 检查学术材料的证明文件
    const hasAcademicMaterials = publications.some(p => p.title) || 
                                competitions.some(c => c.name) || 
                                patents.some(p => p.title);
    
    if (hasAcademicMaterials) {
      const hasAcademicProofs = publications.some(p => p.title && p.proofFile) || 
                               competitions.some(c => c.name && c.proofFile) || 
                               patents.some(p => p.title && p.proofFile);
      
      if (!hasAcademicProofs) {
        alert('请为学术成果上传相应的证明材料');
        return;
      }
    }
    
    onSubmit();
  };

  const handleFileUpload = (file: File | null, category: string, index?: number) => {
    // 这里应该实现文件上传逻辑
    console.log('Uploading file:', file, 'Category:', category, 'Index:', index);
  };

  const addPublication = () => {
    setPublications([...publications, { 
      title: '', type: 'A类', authors: '', authorRank: 1, totalAuthors: 1, journal: '', publishYear: 2024, proofFile: null 
    }]);
  };

  const removePublication = (index: number) => {
    setPublications(publications.filter((_, i) => i !== index));
  };

  const addCompetition = () => {
    setCompetitions([...competitions, { 
      name: '', level: 'A+类', award: '国家级一等奖及以上', year: 2024, isTeam: false, teamRank: 1, totalTeamMembers: 1, proofFile: null 
    }]);
  };

  const removeCompetition = (index: number) => {
    setCompetitions(competitions.filter((_, i) => i !== index));
  };

  const addProfessor = () => {
    setProfessors([...professors, { name: '', title: '', department: '' }]);
  };

  const removeProfessor = (index: number) => {
    setProfessors(professors.filter((_, i) => i !== index));
  };

  return (
    <div className="p-4 space-y-6">
      {/* 头部信息 */}
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg">厦���大学信息学院推免申请</h1>
          <p className="text-sm text-gray-600">{activity.name}</p>
        </div>
      </div>

      {/* 实时加分显示 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">学术专长加分</p>
              <p className="text-xl text-blue-600">{calculatedScores.academicAchievement.toFixed(2)}/15</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">综合表现加分</p>
              <p className="text-xl text-green-600">{calculatedScores.comprehensivePerformance.toFixed(2)}/5</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">预估加分总计</p>
              <p className="text-xl">{(calculatedScores.academicAchievement + calculatedScores.comprehensivePerformance).toFixed(2)}/20</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="language">外语成绩</TabsTrigger>
            <TabsTrigger value="academic">学术专长</TabsTrigger>
            <TabsTrigger value="comprehensive">综合表现</TabsTrigger>
            <TabsTrigger value="statement">个人陈述</TabsTrigger>
          </TabsList>

          {/* 基本信息 */}
          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <UserIcon className="w-5 h-5" />
                  <span>基本信息（系统预录入）</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    以下信息已从教务系统自动获取，如有错误请联系教务处
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>姓名</Label>
                    <Input value={basicInfo.name} disabled />
                  </div>
                  <div>
                    <Label>学号</Label>
                    <Input value={basicInfo.studentId} disabled />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>系别</Label>
                    <Input value={basicInfo.department} disabled />
                  </div>
                  <div>
                    <Label>专业</Label>
                    <Input value={basicInfo.major} disabled />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>GPA</Label>
                    <Input value={basicInfo.gpa} disabled />
                  </div>
                  <div>
                    <Label>学业成绩排名</Label>
                    <Input value={basicInfo.academicRanking} disabled />
                  </div>
                  <div>
                    <Label>专业总人数</Label>
                    <Input value={basicInfo.totalStudents} disabled />
                  </div>
                </div>

                <div>
                  <Label htmlFor="gender">性别 *</Label>
                  <Select value={basicInfo.gender} onValueChange={(value: '男' | '女') => setBasicInfo({...basicInfo, gender: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="男">男</SelectItem>
                      <SelectItem value="女">女</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 成绩单上传 */}
                <div>
                  <Label>成绩单 *</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setTranscriptFile(file);
                        handleFileUpload(file, 'transcript');
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      请上传教务处盖章的官方成绩单（PDF、JPG、PNG格式）
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 外语成绩 */}
          <TabsContent value="language" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>外语成绩及证明材料</CardTitle>
                <p className="text-sm text-gray-600">
                  需满足以下条件之一：CET4≥500分 或 CET6≥425分 或 TOEFL≥90分 或 IELTS≥6.0分
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* CET4 */}
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div>
                      <Label htmlFor="cet4">英语四级成绩</Label>
                      <Input
                        id="cet4"
                        type="number"
                        value={languageScores.cet4Score}
                        onChange={(e) => setLanguageScores({...languageScores, cet4Score: e.target.value})}
                        placeholder="如：566"
                      />
                    </div>
                    <div>
                      <Label>CET4成绩单 *</Label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setLanguageCertificates({...languageCertificates, cet4: file});
                          handleFileUpload(file, 'language', 0);
                        }}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                  </div>
                </div>

                {/* CET6 */}
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div>
                      <Label htmlFor="cet6">英语六级成绩</Label>
                      <Input
                        id="cet6"
                        type="number"
                        value={languageScores.cet6Score}
                        onChange={(e) => setLanguageScores({...languageScores, cet6Score: e.target.value})}
                        placeholder="如：590"
                      />
                    </div>
                    <div>
                      <Label>CET6成绩单</Label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setLanguageCertificates({...languageCertificates, cet6: file});
                          handleFileUpload(file, 'language', 1);
                        }}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                  </div>
                </div>

                {/* TOEFL */}
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div>
                      <Label htmlFor="toefl">TOEFL成绩</Label>
                      <Input
                        id="toefl"
                        type="number"
                        value={languageScores.toeflScore}
                        onChange={(e) => setLanguageScores({...languageScores, toeflScore: e.target.value})}
                        placeholder="如：90"
                      />
                    </div>
                    <div>
                      <Label>TOEFL成绩单</Label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setLanguageCertificates({...languageCertificates, toefl: file});
                          handleFileUpload(file, 'language', 2);
                        }}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                  </div>
                </div>

                {/* IELTS */}
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div>
                      <Label htmlFor="ielts">IELTS成绩</Label>
                      <Input
                        id="ielts"
                        type="number"
                        step="0.5"
                        value={languageScores.ieltsScore}
                        onChange={(e) => setLanguageScores({...languageScores, ieltsScore: e.target.value})}
                        placeholder="如：6.5"
                      />
                    </div>
                    <div>
                      <Label>IELTS成绩单</Label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setLanguageCertificates({...languageCertificates, ielts: file});
                          handleFileUpload(file, 'language', 3);
                        }}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                    <p className="text-sm text-red-800">
                      外语成绩证明应当于推免当年8月31日前获得，请确保上传的证明材料在有效期内
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 学术专长 */}
          <TabsContent value="academic" className="space-y-6">
            {/* 论文发表 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5" />
                    <span>论文发表</span>
                  </span>
                  <Button type="button" size="sm" onClick={addPublication}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {publications.map((pub, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm">论文 {index + 1}</h4>
                        {publications.length > 1 && (
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="destructive"
                            onClick={() => removePublication(index)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      
                      <div>
                        <Label>论文标题</Label>
                        <Input
                          value={pub.title}
                          onChange={(e) => {
                            const newPubs = [...publications];
                            newPubs[index].title = e.target.value;
                            setPublications(newPubs);
                          }}
                          placeholder="请输入论文标题"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>期刊/会议类型</Label>
                          <Select 
                            value={pub.type} 
                            onValueChange={(value: any) => {
                              const newPubs = [...publications];
                              newPubs[index].type = value;
                              setPublications(newPubs);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A类">A类 (CCF-A类)</SelectItem>
                              <SelectItem value="B类">B类 (CCF-B类)</SelectItem>
                              <SelectItem value="C类">C类 (CCF-C类)</SelectItem>
                              <SelectItem value="高水平中文">高水平中文期刊</SelectItem>
                              <SelectItem value="信息通信工程">信息与通信工程期刊</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>发表年份</Label>
                          <Input
                            type="number"
                            value={pub.publishYear}
                            onChange={(e) => {
                              const newPubs = [...publications];
                              newPubs[index].publishYear = parseInt(e.target.value);
                              setPublications(newPubs);
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>作者排名</Label>
                          <Input
                            type="number"
                            value={pub.authorRank}
                            onChange={(e) => {
                              const newPubs = [...publications];
                              newPubs[index].authorRank = parseInt(e.target.value);
                              setPublications(newPubs);
                            }}
                          />
                        </div>
                        <div>
                          <Label>总作者数</Label>
                          <Input
                            type="number"
                            value={pub.totalAuthors}
                            onChange={(e) => {
                              const newPubs = [...publications];
                              newPubs[index].totalAuthors = parseInt(e.target.value);
                              setPublications(newPubs);
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>论文证明材料 *</Label>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            const newPubs = [...publications];
                            newPubs[index].proofFile = file;
                            setPublications(newPubs);
                            handleFileUpload(file, 'publication', index);
                          }}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          请上传论文录用通知书或发表证明
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>

            {/* 学科竞赛 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <Trophy className="w-5 h-5" />
                    <span>学科竞赛</span>
                  </span>
                  <Button type="button" size="sm" onClick={addCompetition}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {competitions.map((comp, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm">竞赛 {index + 1}</h4>
                        {competitions.length > 1 && (
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="destructive"
                            onClick={() => removeCompetition(index)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>

                      <div>
                        <Label>竞赛名称</Label>
                        <Input
                          value={comp.name}
                          onChange={(e) => {
                            const newComps = [...competitions];
                            newComps[index].name = e.target.value;
                            setCompetitions(newComps);
                          }}
                          placeholder="如：全国大学生数学建模竞赛"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>竞赛级别</Label>
                          <Select 
                            value={comp.level} 
                            onValueChange={(value: any) => {
                              const newComps = [...competitions];
                              newComps[index].level = value;
                              setCompetitions(newComps);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A+类">A+类竞赛</SelectItem>
                              <SelectItem value="A类">A类竞赛</SelectItem>
                              <SelectItem value="A-类">A-类竞赛</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>获奖等级</Label>
                          <Select 
                            value={comp.award} 
                            onValueChange={(value: any) => {
                              const newComps = [...competitions];
                              newComps[index].award = value;
                              setCompetitions(newComps);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="国家级一等奖及以上">国家级一等奖及以上</SelectItem>
                              <SelectItem value="国家级二等奖">国家级二等奖</SelectItem>
                              <SelectItem value="国家级三等奖">国家级三等奖</SelectItem>
                              <SelectItem value="省级一等奖及以上">省级一等奖及以上</SelectItem>
                              <SelectItem value="省级二等奖">省级二等奖</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>获奖年份</Label>
                          <Input
                            type="number"
                            value={comp.year}
                            onChange={(e) => {
                              const newComps = [...competitions];
                              newComps[index].year = parseInt(e.target.value);
                              setCompetitions(newComps);
                            }}
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={comp.isTeam}
                            onCheckedChange={(checked) => {
                              const newComps = [...competitions];
                              newComps[index].isTeam = checked as boolean;
                              setCompetitions(newComps);
                            }}
                          />
                          <Label>团体竞赛</Label>
                        </div>
                      </div>

                      {comp.isTeam && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>团队排名</Label>
                            <Input
                              type="number"
                              value={comp.teamRank}
                              onChange={(e) => {
                                const newComps = [...competitions];
                                newComps[index].teamRank = parseInt(e.target.value);
                                setCompetitions(newComps);
                              }}
                            />
                          </div>
                          <div>
                            <Label>团队总人数</Label>
                            <Input
                              type="number"
                              value={comp.totalTeamMembers}
                              onChange={(e) => {
                                const newComps = [...competitions];
                                newComps[index].totalTeamMembers = parseInt(e.target.value);
                                setCompetitions(newComps);
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <Label>获奖证书 *</Label>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            const newComps = [...competitions];
                            newComps[index].proofFile = file;
                            setCompetitions(newComps);
                            handleFileUpload(file, 'competition', index);
                          }}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          请上传获奖证书或官方证明
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>

            {/* 特殊学术专长申请 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Award className="w-5 h-5" />
                  <span>特殊学术专长申请</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={isSpecialTalent}
                    onCheckedChange={setIsSpecialTalent}
                  />
                  <Label>
                    申请特殊学术专长推免（需有3名教授推荐且满足相应条件）
                  </Label>
                </div>

                {isSpecialTalent && (
                  <div className="space-y-4">
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        特殊学术专长条件：以第一作者发表A/B类高水平论文或获A+、A类竞赛国家一等奖及以上
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>推荐教授信息（需3名）</Label>
                        <Button type="button" size="sm" onClick={addProfessor}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      {professors.map((prof, index) => (
                        <Card key={index} className="p-3 mb-3">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm">教授 {index + 1}</h5>
                              {professors.length > 1 && (
                                <Button 
                                  type="button" 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => removeProfessor(index)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label>教授姓名</Label>
                                <Input
                                  value={prof.name}
                                  onChange={(e) => {
                                    const newProfs = [...professors];
                                    newProfs[index].name = e.target.value;
                                    setProfessors(newProfs);
                                  }}
                                  placeholder="请输入教授姓名"
                                />
                              </div>
                              <div>
                                <Label>职称</Label>
                                <Input
                                  value={prof.title}
                                  onChange={(e) => {
                                    const newProfs = [...professors];
                                    newProfs[index].title = e.target.value;
                                    setProfessors(newProfs);
                                  }}
                                  placeholder="如：教授"
                                />
                              </div>
                              <div>
                                <Label>所在系</Label>
                                <Input
                                  value={prof.department}
                                  onChange={(e) => {
                                    const newProfs = [...professors];
                                    newProfs[index].department = e.target.value;
                                    setProfessors(newProfs);
                                  }}
                                  placeholder="请输入系别"
                                />
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 综合表现 */}
          <TabsContent value="comprehensive" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Award className="w-5 h-5" />
                  <span>综合表现</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 志愿服务 */}
                <div>
                  <Label htmlFor="volunteerHours">志愿服务时长（小时）</Label>
                  <Input
                    id="volunteerHours"
                    type="number"
                    value={volunteerHours}
                    onChange={(e) => setVolunteerHours(e.target.value)}
                    placeholder="如：295"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    达到200小时以上可加分，每增加2小时增加0.05分
                  </p>
                  
                  {parseInt(volunteerHours) >= 200 && (
                    <div className="mt-2">
                      <Label>志愿服务证明材料</Label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setVolunteerProofFile(file);
                          handleFileUpload(file, 'volunteer');
                        }}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        请上传志愿服务工时统计表或相关证明
                      </p>
                    </div>
                  )}
                </div>

                {/* 社会工作 */}
                <div>
                  <Label>社会工作经历</Label>
                  {socialWork.map((work, index) => (
                    <div key={index} className="grid grid-cols-3 gap-3 mt-2">
                      <Input
                        value={work.position}
                        onChange={(e) => {
                          const newWork = [...socialWork];
                          newWork[index].position = e.target.value;
                          setSocialWork(newWork);
                        }}
                        placeholder="职务（如：班长）"
                      />
                      <Input
                        value={work.duration}
                        onChange={(e) => {
                          const newWork = [...socialWork];
                          newWork[index].duration = e.target.value;
                          setSocialWork(newWork);
                        }}
                        placeholder="任职时长（如：两年）"
                      />
                      <Input
                        type="number"
                        value={work.year}
                        onChange={(e) => {
                          const newWork = [...socialWork];
                          newWork[index].year = parseInt(e.target.value);
                          setSocialWork(newWork);
                        }}
                        placeholder="年份"
                      />
                    </div>
                  ))}
                </div>

                {/* 荣誉称号 */}
                <div>
                  <Label>荣誉称号</Label>
                  {honors.map((honor, index) => (
                    <div key={index} className="space-y-2 mt-2">
                      <div className="grid grid-cols-3 gap-3">
                        <Input
                          value={honor.title}
                          onChange={(e) => {
                            const newHonors = [...honors];
                            newHonors[index].title = e.target.value;
                            setHonors(newHonors);
                          }}
                          placeholder="荣誉称号（如：三好学生）"
                        />
                        <Select 
                          value={honor.level} 
                          onValueChange={(value: any) => {
                            const newHonors = [...honors];
                            newHonors[index].level = value;
                            setHonors(newHonors);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="国家级">国家级</SelectItem>
                            <SelectItem value="省级">省级</SelectItem>
                            <SelectItem value="校级">校级</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={honor.year}
                          onChange={(e) => {
                            const newHonors = [...honors];
                            newHonors[index].year = parseInt(e.target.value);
                            setHonors(newHonors);
                          }}
                          placeholder="获得年份"
                        />
                      </div>
                      
                      {honor.title && (
                        <div>
                          <Label>荣誉称号证书</Label>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              const newHonors = [...honors];
                              newHonors[index].proofFile = file;
                              setHonors(newHonors);
                              handleFileUpload(file, 'honor', index);
                            }}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 个人陈述 */}
          <TabsContent value="statement" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>个人陈述</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="personalStatement">
                    请详细描述您的学术背景、研究兴趣、未来规划以及申请推免的原因
                  </Label>
                  <Textarea
                    id="personalStatement"
                    value={personalStatement}
                    onChange={(e) => setPersonalStatement(e.target.value)}
                    placeholder="请在此详细说明您申请推免的原因、学术背景、研究兴趣以及未来的学术规划..."
                    rows={8}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    建议800-1500字，请详细说明您的学术经历和研究规划
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 提交按钮 */}
        <div className="space-y-3 pt-6">
          <Button type="submit" className="w-full">
            提交申请
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={onCancel}>
            保存草稿
          </Button>
          <div className="text-xs text-gray-500 text-center">
            提交后将进入系统初审，请确保所有信息准确无误且上传了必要的证明材料
          </div>
        </div>
      </form>
    </div>
  );
};