// 竞赛项目库配置 - 基于厦门大学信息学院2025年保研条例

export interface CompetitionItem {
  id: string;
  name: string;
  level: 'A+类' | 'A类' | 'A-类';
  organizer: string;
  category?: string;
  keywords?: string[];
}

export const COMPETITION_DATABASE: CompetitionItem[] = [
  // ========== A+类竞赛 ==========
  {
    id: 'comp_001',
    name: '中国国际大学生创新大赛',
    level: 'A+类',
    organizer: '教育部等单位',
    category: '创新创业',
    keywords: ['互联网+', '创新', '创业']
  },
  {
    id: 'comp_002',
    name: '"挑战杯"全国大学生课外学术科技作品竞赛',
    level: 'A+类',
    organizer: '共青团中央、中国科协、教育部和全国学联',
    category: '科技创新',
    keywords: ['挑战杯', '学术', '科技']
  },
  {
    id: 'comp_003',
    name: '"挑战杯"中国大学生创业计划大赛',
    level: 'A+类',
    organizer: '共青团中央、中国科协、教育部和全国学联',
    category: '创业计划',
    keywords: ['挑战杯', '创业']
  },
  {
    id: 'comp_004',
    name: 'ICPC国际大学生程序设计竞赛',
    level: 'A+类',
    organizer: 'ICPC基金会',
    category: '程序设计',
    keywords: ['ICPC', 'ACM', '编程', '算法']
  },
  {
    id: 'comp_005',
    name: 'CCPC中国大学生程序设计竞赛',
    level: 'A+类',
    organizer: '中国大学生程序设计竞赛组委会',
    category: '程序设计',
    keywords: ['CCPC', '编程', '算法']
  },
  {
    id: 'comp_006',
    name: '全国大学生电子设计竞赛',
    level: 'A+类',
    organizer: '教育部高等教育司和信息产业部人事司',
    category: '电子设计',
    keywords: ['电子', '硬件', '设计']
  },
  {
    id: 'comp_007',
    name: '全国大学生电子设计竞赛（邀请赛）',
    level: 'A+类',
    organizer: '教育部高等教育司和信息产业部人事司',
    category: '电子设计',
    keywords: ['电子', '硬件', '设计', '邀请赛']
  },

  // ========== A类竞赛 ==========
  {
    id: 'comp_101',
    name: '全国大学生软件创新大赛',
    level: 'A类',
    organizer: '示范性软件学院联盟',
    category: '软件开发',
    keywords: ['软件', '创新', '开发']
  },
  {
    id: 'comp_102',
    name: '全国大学生信息安全竞赛',
    level: 'A类',
    organizer: '信息安全类专业教学指导委员会、中国互联网发展基金会',
    category: '信息安全',
    keywords: ['安全', '网络安全', 'CTF']
  },
  {
    id: 'comp_103',
    name: '全国大学生嵌入式芯片与系统设计竞赛',
    level: 'A类',
    organizer: '中国电子学会、东南大学和南京市江北新区管理委员会',
    category: '嵌入式系统',
    keywords: ['嵌入式', '芯片', '单片机']
  },
  {
    id: 'comp_104',
    name: '中国机器人及人工智能大赛',
    level: 'A类',
    organizer: '中国人工智能学会、教育部高等学校计算机课程教学指导委员会',
    category: '人工智能',
    keywords: ['AI', '人工智能', '机器人']
  },
  {
    id: 'comp_105',
    name: '全国大学生计算机系统能力大赛',
    level: 'A类',
    organizer: '全国高校计算机教育研究会',
    category: '计算机系统',
    keywords: ['计算机系统', '编译', '操作系统']
  },
  {
    id: 'comp_106',
    name: 'CCF CCSP大学生计算机系统与程序设计竞赛',
    level: 'A类',
    organizer: '中国计算机学会',
    category: '程序设计',
    keywords: ['CCF', 'CCSP', '系统']
  },
  {
    id: 'comp_107',
    name: '全国大学生数学建模竞赛',
    level: 'A类',
    organizer: '中国工业与应用数学学会(CSIAM)',
    category: '数学建模',
    keywords: ['数学', '建模', '数模']
  },
  {
    id: 'comp_108',
    name: '全国大学生创新创业训练计划年会展示',
    level: 'A类',
    organizer: '教育部、科技部、人力资源社会保障部等',
    category: '创新创业',
    keywords: ['大创', '创新训练']
  },
  {
    id: 'comp_109',
    name: '"网信柏鹭杯"全国大学生网络空间安全精英赛',
    level: 'A类',
    organizer: '厦门市委网信办、厦门大学信息学院',
    category: '网络安全',
    keywords: ['网络安全', '网信', 'CTF']
  },
  {
    id: 'comp_110',
    name: '海峡两岸信息服务创新大赛暨福建省计算机软件设计大赛',
    level: 'A类',
    organizer: '福建省经济和信息化委员会等',
    category: '软件设计',
    keywords: ['软件', '海峡', '福建']
  },
  {
    id: 'comp_111',
    name: '福建省大学生人工智能创意赛',
    level: 'A类',
    organizer: '福建省教育厅',
    category: '人工智能',
    keywords: ['AI', '人工智能', '福建']
  },
  {
    id: 'comp_112',
    name: '福建省大学生程序设计竞赛',
    level: 'A类',
    organizer: '福建省计算机学会',
    category: '程序设计',
    keywords: ['编程', '算法', '福建']
  },

  // ========== A-类竞赛 ==========
  {
    id: 'comp_201',
    name: '中国大学生计算机设计大赛',
    level: 'A-类',
    organizer: '教育部高等学校计算机类专业教学指导委员会等',
    category: '计算机设计',
    keywords: ['设计', 'UI', '多媒体']
  },
  {
    id: 'comp_202',
    name: '中国高校计算机大赛-大数据挑战赛',
    level: 'A-类',
    organizer: '教育部高等学校计算机类专业教学指导委员会等',
    category: '大数据',
    keywords: ['大数据', '数据分析']
  },
  {
    id: 'comp_203',
    name: '中国高校计算机大赛-团体程序设计天梯赛',
    level: 'A-类',
    organizer: '教育部高等学校计算机类专业教学指导委员会等',
    category: '程序设计',
    keywords: ['天梯赛', '编程', '团队']
  },
  {
    id: 'comp_204',
    name: '中国高校计算机大赛-移动应用创新赛',
    level: 'A-类',
    organizer: '教育部高等学校计算机类专业教学指导委员会等',
    category: '移动应用',
    keywords: ['移动', 'APP', '应用']
  },
  {
    id: 'comp_205',
    name: '中国高校计算机大赛-网络技术挑战赛',
    level: 'A-类',
    organizer: '教育部高等学校计算机类专业教学指导委员会等',
    category: '网络技术',
    keywords: ['网络', '通信']
  },
  {
    id: 'comp_206',
    name: '中国高校计算机大赛-人工智能创意赛',
    level: 'A-类',
    organizer: '教育部高等学校计算机类专业教学指导委员会等',
    category: '人工智能',
    keywords: ['AI', '人工智能', '创意']
  },
  {
    id: 'comp_207',
    name: '蓝桥杯全国软件和信息技术专业人才大赛',
    level: 'A-类',
    organizer: '中华人民共和国工业和信息化部人才交流中心',
    category: '软件开发',
    keywords: ['蓝桥杯', '编程', '算法']
  },
  {
    id: 'comp_208',
    name: '中美青年创客大赛',
    level: 'A-类',
    organizer: '教育部留学服务中心、清华大学、英特尔公司',
    category: '创客',
    keywords: ['创客', '硬件', '创新']
  },
  {
    id: 'comp_209',
    name: '华为ICT大赛',
    level: 'A-类',
    organizer: '华为公司',
    category: 'ICT技术',
    keywords: ['华为', 'ICT', '网络', '云计算']
  },
  {
    id: 'comp_210',
    name: 'RoboCom机器人开发者大赛（睿抗机器人开发者大赛RAICOM）',
    level: 'A-类',
    organizer: '中国机器人及人工智能大赛组委会',
    category: '机器人',
    keywords: ['机器人', 'RoboCom', 'RAICOM']
  },
  {
    id: 'comp_211',
    name: 'CCF CSP计算机软件能力认证',
    level: 'A-类',
    organizer: '中国计算机学会',
    category: '能力认证',
    keywords: ['CSP', '认证', '编程']
  }
];

// 辅助函数：搜索竞赛
export function searchCompetitions(query: string): CompetitionItem[] {
  if (!query || query.trim() === '') {
    return COMPETITION_DATABASE;
  }

  const lowerQuery = query.toLowerCase().trim();

  return COMPETITION_DATABASE.filter(comp => {
    // 在名称中搜索
    if (comp.name.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // 在关键词中搜索
    if (comp.keywords?.some(keyword => keyword.toLowerCase().includes(lowerQuery))) {
      return true;
    }

    // 在组织者中搜索
    if (comp.organizer.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    return false;
  });
}

// 按级别分组
export function getCompetitionsByLevel(level: 'A+类' | 'A类' | 'A-类'): CompetitionItem[] {
  return COMPETITION_DATABASE.filter(comp => comp.level === level);
}

