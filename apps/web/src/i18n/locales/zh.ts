export const zh = {
  app: {
    name: "EnvForge",
    subtitle: "Linux 环境重建与迁移平台"
  },
  nav: {
    groups: {
      workspace: "工作区",
      flow: "流程",
      governance: "治理"
    },
    pages: {
      dashboard: "总览",
      migrate: "迁移",
      build: "构建",
      catalog: "能力管理",
      plans: "计划",
      reports: "报告"
    },
    descriptions: {
      dashboard: "资源状态、最近计划、待审队列、通知",
      migrate: "源主机、快照、分析与迁移候选",
      build: "选择已认证能力，生成重建计划，进入审查和执行门禁",
      plans: "计划中心、配方、排程、漂移、外发通知、报告",
      reports: "迁移 / 重建 / 修复报告",
      catalog: "管理员能力规则工作台：规则治理、认证升级、用户建议、软件支持映射、用户与队列"
    }
  },
  pipeline: {
    flow: "流程",
    connect: "连接",
    snapshot: "快照",
    build: "构建",
    review: "审查",
    apply: "执行",
    report: "报告"
  },
  shell: {
    search: "搜索能力、配置和迁移规则",
    home: "返回首页",
    more: "更多",
    account: "账号",
    profileSecurity: "个人资料与安全",
    inbox: "站内信",
    noMessages: "暂无站内信。",
    loadingInbox: "正在加载站内信...",
    markRead: "标为已读",
    delete: "删除",
    close: "关闭",
    console: "控制台",
    logout: "退出登录",
    signIn: "登录",
    register: "注册",
    language: "中文 / English",
    themeLight: "浅色模式",
    themeDark: "深色模式"
  },
  public: {
    nav: {
      workflow: "核心流程",
      matrix: "优势",
      safety: "安全门禁",
      docs: "文档",
      quickstart: "快速开始"
    },
    kicker: "从源环境证据到可审计重建",
    headline: "EnvForge 让 Linux 迁移和重建可验证、可回滚、可治理",
    intro: "连接源 Linux 主机，只读采集环境证据，再基于「完整迁移认证」能力重建——每一处变更都经过风险审查与审批门禁，可回滚，并留存完整审计记录。",
    getStarted: "开始使用",
    openConsole: "进入控制台",
    viewQuickstart: "查看快速开始",
    productPreview: "产品界面预览",
    standardsLayer: "版本化标准层",
    overview: "概览",
    ruleRegistry: "规则库",
    standards: "标准",
    active: "生效",
    draft: "草稿",
    certifiedV1: "完整迁移认证 v1",
    certifiedV2: "完整迁移认证 v2",
    requirementDraft: "需求草稿",
    workflowTitle: "迁移 → 构建 → 审查 → 执行 → 验证 → 报告",
    matrixTitle: "一个工作台，从源主机到可审计的重建",
    safetyTitle: "默认安全，可审计",
    quickstartTitle: "登录后进入控制台开始工作",
    quickstartBody: "连接源主机，采集主机快照，选择已认证能力，审查计划，然后再执行。",
    points: { verifiable: "可验证", reversible: "可回滚", governed: "可治理" },
    metrics: {
      certified: ["105", "已认证能力"],
      standard: ["13 项", "完整迁移标准"],
      readonly: ["只读", "源主机采集"],
      rollback: ["一键", "回滚"]
    },
    previewTitle: "重建计划",
    previewRisk: "风险：低",
    previewGate: "执行门禁：待审批",
    certifiedTag: "已认证",
    pillarsTitle: "为什么选择 EnvForge",
    workflow: {
      migrate: ["迁移", "采集源环境", "连接 Linux 主机，生成只读主机快照，保留迁移证据。"],
      build: ["构建", "选择已认证能力", "普通用户只看到已通过完整迁移认证的能力。"],
      review: ["审查", "审查风险和冲突", "计划进入风险确认、冲突处理和审批门禁。"],
      apply: ["执行", "受控执行", "真实变更必须经过执行门禁并记录审计。"],
      verify: ["验证", "验证结果", "执行后运行验证，失败项可转为修复计划。"],
      report: ["报告", "沉淀报告", "输出迁移、重建、修复报告，供复盘和审计。"]
    },
    matrix: {
      migrate: ["迁移", "连接、采集、上传快照。"],
      build: ["构建", "生成仅包含已认证能力的重建计划。"],
      plans: ["计划", "审查、执行、验证、回滚。"],
      reports: ["报告", "报告证据与审计出口。"],
      admin: ["能力管理", "管理员维护规则、标准、队列。"],
      docs: ["文档", "公共文档和快速开始。"]
    },
    pillars: {
      verifiable: ["可验证", "证据驱动的 dry-run 计划，执行前先看清每一步动作和受影响文件。"],
      reversible: ["可回滚", "主机快照、一键回滚，失败项可自动转为修复计划。"],
      governed: ["可治理", "每一次真实变更都有审批门禁、完整审计与基于角色的权限。"],
      certified: ["已认证", "用户只能基于「完整迁移认证」能力构建——13 项检查，绝不走捷径。"]
    },
    safety: {
      anonymous: "源主机采集严格只读——EnvForge 不会改动被检查的主机。",
      tokens: "安装脚本必须登录后生成短期令牌，默认脱敏，点击显示后才展示。",
      destructive: "所有删除、发布、回滚、真实执行动作必须二次确认并写入审计日志。"
    }
  },
  auth: {
    titleLogin: "登录 EnvForge",
    titleRegister: "注册账号",
    titleTwoFactor: "双因子认证",
    name: "姓名",
    email: "邮箱",
    password: "密码",
    codeEmail: "邮箱验证码",
    codeTotp: "TOTP 或恢复码",
    forgotPassword: "忘记密码",
    haveAccount: "已有账号",
    createAccount: "注册新账号",
    working: "处理中...",
    verify: "完成注册",
    enterEmail: "请先输入邮箱。",
    enterTwoFactor: "请输入双因子认证代码。",
    verificationSent: "验证码已发送，请输入验证码完成注册。",
    passwordResetDone: "密码已重置，请登录。",
    passwordTooShort: "密码至少需要 8 个字符。"
  },
  fields: {
    filter: "筛选",
    connectTitle: "连接源 Linux 主机",
    connectHint: "连接成功后只读采集主机快照，并将结果作为环境分析证据。",
    runScan: "采集主机快照",
    upload: "保存环境快照",
    selected: "已选择",
    software: "能力证据",
    configs: "主机分析检查",
    addToVm: "加入计划",
    guest: "访客",
    locked: "连接后显示",
    connection: "连接状态",
    connected: "已连接",
    disconnected: "未连接",
    connectBtn: "连接并采集",
    privacyNote: "源机器采集默认只读；所有目标机器变更都必须进入环境计划。",
    installCommand: "计划动作",
    packageAlias: "包名与别名偏好",
    agentUrl: "Agent URL（可选）",
    agentProbe: "探测真实数据",
    agentOnline: "SSH 在线",
    agentOffline: "SSH 离线",
    probing: "采集中...",
    realData: "实时数据"
  }
} as const;
