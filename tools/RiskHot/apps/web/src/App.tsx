import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Outlet, useParams, useRouterState } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Database,
  FileText,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  ApiError,
  asData,
  formatTime,
  get,
  post,
  rowTitle,
  str,
  type Contracts,
  type Data,
  type Domain,
  type Json,
  type RecordRow,
  type RiskItem,
  type Session,
} from './api';
import {
  Badge,
  DataDetails,
  Empty,
  ErrorPanel,
  Id,
  JsonBlock,
  Loading,
  Modal,
  PageHeading,
  SnapshotSummary,
} from './components';
import { CommandForm, type CommandIntent } from './CommandForm';
import { label } from './labels';

interface Workspace {
  session: Session;
  contracts: Contracts;
  act: (intent: CommandIntent) => void;
  inspect: (domain: Domain, row: RecordRow) => void;
}
const WorkspaceContext = createContext<Workspace | null>(null);
export const useWorkspace = () => {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('研究工作区尚未初始化');
  return value;
};
const navigation: { path: string; label: string; icon: LucideIcon; group: string }[] = [
  { path: '/', label: '风险总览', icon: LayoutDashboard, group: '研究' },
  { path: '/information', label: '信息与事件', icon: BookOpen, group: '研究' },
  { path: '/risks', label: '风险目录', icon: CircleDot, group: '研究' },
  { path: '/analysis', label: '观察分析', icon: FlaskConical, group: '研究' },
  { path: '/reports', label: '研究报告', icon: FileText, group: '研究' },
  { path: '/reviews', label: '复核中心', icon: ClipboardCheck, group: '管理' },
  { path: '/config', label: '配置中心', icon: SlidersHorizontal, group: '管理' },
  { path: '/operations', label: '运行中心', icon: Activity, group: '管理' },
  { path: '/accounts', label: '账号与权限', icon: Users, group: '管理' },
];

function AuthScreen({ setup, onSuccess }: { setup: boolean; onSuccess: (session: Session) => void }) {
  const [name, setName] = useState(''),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      const session = await post<Session>(setup ? '/auth/setup' : '/auth/login', {
        ...(setup ? { name } : {}),
        username,
        password,
      });
      setPassword('');
      onSuccess(session);
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="auth-screen">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-symbol">
            <Activity size={25} />
          </span>
          <strong>
            RiskHot<span>RESEARCH TERMINAL</span>
          </strong>
        </div>
        <div className="auth-intro">
          <span className="eyebrow">EVIDENCE → INSIGHT → CONTINUITY</span>
          <h1>
            看见风险，
            <br />
            也看清依据。
          </h1>
          <p>
            连接可信信息、风险机制与持续观察。
            <br />
            每一份判断，都有一条可以回溯的证据链。
          </p>
          <div className="auth-line">
            <span>01 / 信息</span>
            <i />
            <span>02 / 识别</span>
            <i />
            <span>03 / 态势</span>
          </div>
        </div>
        <span className="auth-footer">独立判断 · 时间边界 · 持续研究</span>
      </section>
      <section className="auth-form-side">
        <form onSubmit={(event) => void submit(event)} className="auth-form">
          <div className="eyebrow">PRIVATE WORKSPACE</div>
          <h2>{setup ? '建立研究工作区' : '欢迎回到研究现场'}</h2>
          <p>
            {setup ? '创建首位管理员。初始账号同时具有研究和业务审核权限。' : '登录后继续观察、核验与研究。'}
          </p>
          {setup && (
            <label>
              显示名称
              <input
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </label>
          )}
          <label>
            登录名
            <input
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus={!setup}
            />
          </label>
          <label>
            密码
            <input
              name="password"
              type="password"
              autoComplete={setup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={setup ? 12 : undefined}
              required
            />
            {setup && <small>至少 12 位，使用仅属于你的安全密码。</small>}
          </label>
          {error !== undefined && <ErrorPanel error={error} />}
          <button type="submit" className="button primary" disabled={pending}>
            {pending ? <LoaderCircle size={16} className="spin" /> : <ArrowRight size={16} />}
            {pending ? '正在连接…' : setup ? '创建并进入工作区' : '进入工作区'}
          </button>
          <div className="auth-security">
            <ShieldCheck size={14} />
            授权访问 · 独立会话 · 操作留痕
          </div>
        </form>
      </section>
    </div>
  );
}

export function AppShell() {
  const cache = useQueryClient(),
    path = useRouterState({ select: (state) => state.location.pathname });
  const [intent, setIntent] = useState<CommandIntent>(),
    [selected, setSelected] = useState<{ domain: Domain; row: RecordRow }>(),
    [menu, setMenu] = useState(false),
    [logoutError, setLogoutError] = useState<unknown>();
  const session = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        return await get<Session>('/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
  const status = useQuery({
    queryKey: ['auth-status'],
    queryFn: () => get<{ initialized: boolean }>('/auth/status'),
    enabled: session.data === null,
    retry: false,
  });
  const contracts = useQuery({
    queryKey: ['contracts'],
    queryFn: () => get<Contracts>('/contracts'),
    enabled: !!session.data,
    retry: false,
    staleTime: 300_000,
  });
  useEffect(() => {
    setMenu(false);
  }, [path]);
  if (session.isPending) return <Loading text="正在连接研究工作区…" />;
  if (session.error)
    return (
      <div className="connection-error">
        <ErrorPanel error={session.error} retry={() => void session.refetch()} />
      </div>
    );
  if (!session.data) {
    if (status.error) return <ErrorPanel error={status.error} retry={() => void status.refetch()} />;
    if (!status.data) return <Loading />;
    return (
      <AuthScreen
        setup={!status.data.initialized}
        onSuccess={(s) => {
          void cache.cancelQueries();
          cache.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
          cache.setQueryData(['session'], s);
        }}
      />
    );
  }
  const current = session.data;
  const logout = async () => {
    try {
      await post('/auth/logout', {}, { 'X-CSRF-Token': current.csrf });
      await cache.cancelQueries();
      cache.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
      cache.setQueryData(['session'], null);
    } catch (e) {
      setLogoutError(e);
    }
  };
  return (
    <WorkspaceContext
      value={{
        session: current,
        contracts: contracts.data ?? {},
        act: setIntent,
        inspect: (domain, row) => setSelected({ domain, row }),
      }}
    >
      <div className="app-shell">
        {menu && <button className="nav-scrim" aria-label="关闭导航" onClick={() => setMenu(false)} />}
        <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
          <Link to="/" className="brand">
            <span className="brand-symbol">
              <Activity size={24} />
            </span>
            <strong>
              RiskHot<span>RESEARCH TERMINAL</span>
            </strong>
          </Link>
          <div className="workspace-label">
            <i />
            宏观风险研究工作区
          </div>
          <nav aria-label="主导航">
            {['研究', '管理'].map((group) => (
              <div className="nav-group" key={group}>
                <div className="nav-caption">
                  {group} / {group === '研究' ? 'RESEARCH' : 'CONTROL'}
                </div>
                {navigation
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const Icon = item.icon,
                      active = item.path === '/' ? path === '/' : path.startsWith(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`nav-link ${active ? 'active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon size={18} strokeWidth={1.6} />
                        <span>{item.label}</span>
                        {active && <span className="nav-marker" />}
                      </Link>
                    );
                  })}
              </div>
            ))}
          </nav>
          <div className="sidebar-note">
            <ShieldCheck size={19} />
            <p>
              判断有据，版本可溯。<span>未知，不等于没有风险。</span>
            </p>
          </div>
          <div className="sidebar-user">
            <span className="avatar">{current.user.name.slice(0, 1)}</span>
            <div>
              <strong>{current.user.name}</strong>
              <small>{current.user.roles.map(label).join(' / ')}</small>
            </div>
            <button
              className="icon-button"
              aria-label="退出登录"
              title="退出登录"
              onClick={() => void logout()}
            >
              <LogOut size={16} />
            </button>
          </div>
        </aside>
        <div className="workspace-main">
          <header className="topbar">
            <button className="icon-button mobile-menu" aria-label="展开导航" onClick={() => setMenu(true)}>
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              工作区
              <ChevronRight size={13} />
              <strong>{navigation.find((item) => item.path === path)?.label ?? '风险详情'}</strong>
            </div>
            <div className="topbar-right">
              <span className="time-caption">
                <Clock3 size={13} />
                北京时间 ·{' '}
                {new Intl.DateTimeFormat('zh-CN', {
                  timeZone: 'Asia/Shanghai',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                }).format(new Date())}
              </span>
              <span className="private-tag">
                <ShieldCheck size={13} />
                授权研究环境
              </span>
            </div>
          </header>
          <main id="main-content">
            {logoutError !== undefined && <ErrorPanel error={logoutError} />}
            {contracts.error && <ErrorPanel error={contracts.error} retry={() => void contracts.refetch()} />}
            <Outlet />
          </main>
          <footer className="workspace-footer">
            <span>
              RISK<span className="accent">HOT</span> / 从信息到判断
            </span>
            <span>所有判断均以其证据截止时间为准。</span>
          </footer>
        </div>
        {selected && (
          <RecordDrawer
            domain={selected.domain}
            original={selected.row}
            onClose={() => setSelected(undefined)}
          />
        )}
        {intent && (
          <CommandForm
            key={`${intent.name}:${intent.record?.id ?? 'new'}`}
            intent={intent}
            contracts={contracts.data ?? {}}
            session={current}
            onClose={() => setIntent(undefined)}
          />
        )}
      </div>
    </WorkspaceContext>
  );
}

export function CommandButton({
  name,
  title,
  icon = true,
  record,
  defaults,
  className = 'button primary',
  domain,
}: {
  name: string;
  title?: string;
  icon?: boolean;
  record?: RecordRow;
  defaults?: Data;
  className?: string;
  domain?: Domain;
}) {
  const { contracts, session, act } = useWorkspace(),
    schema = contracts[name];
  if (!schema || !schema['x-roles']?.some((role) => session.user.roles.includes(role))) return null;
  return (
    <button className={className} onClick={() => act({ name, record, defaults, domain })}>
      {icon && <Plus size={15} />}
      {title ?? schema.title}
    </button>
  );
}

interface DashboardData {
  risk_count: number;
  active_count: number;
  pending_reviews: number;
  failed_tasks: number;
  report_count: number;
  recent_risks: (RecordRow | RiskItem)[];
}
export function Dashboard() {
  const { inspect } = useWorkspace();
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => get<DashboardData>('/dashboard'),
    refetchInterval: 30_000,
  });
  const data = query.data;
  return (
    <>
      <PageHeading
        index="01"
        title="风险总览"
        description="在信息变化中，保留判断的尺度。"
        actions={<CommandButton name="information.ingest" title="录入新资料" />}
      />
      <div className="overview-banner">
        <div>
          <div className="eyebrow">CONTINUOUS OBSERVATION</div>
          <h2>
            从一条线索，
            <br />
            到一份有依据的判断。
          </h2>
          <p>可信信息 → 风险识别 → 态势观察 → 研究产品</p>
        </div>
        <div className="banner-caption">
          <span className="orbit-marker">
            <CircleDot size={44} strokeWidth={0.8} />
          </span>
          <strong>持续观察</strong>
          <span>保持证据与结论的连接</span>
        </div>
      </div>
      {query.error ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : query.isPending ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="metric-strip">
              {[
                { name: '已纳管风险', count: data.risk_count, note: '稳定身份，持续追踪', icon: CircleDot },
                { name: '跟踪中', count: data.active_count, note: '观察与重点跟踪', icon: Activity },
                { name: '待复核', count: data.pending_reviews, note: '需要业务判断', icon: ClipboardCheck },
                { name: '已编制报告', count: data.report_count, note: '研究成果与版本', icon: FileText },
              ].map((metric, index) => (
                <div className="metric" key={metric.name}>
                  <div>
                    <span>{metric.name}</span>
                    <metric.icon size={17} />
                  </div>
                  <strong>{metric.count.toString().padStart(2, '0')}</strong>
                  <small>
                    <span className="metric-index">0{index + 1}</span>
                    {metric.note}
                  </small>
                </div>
              ))}
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">MONITORED RISKS</span>
                    <h2>最近纳管</h2>
                  </div>
                  <Link to="/risks" className="text-link">
                    全部风险
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
                {data.recent_risks.length ? (
                  <div className="recent-risks">
                    {data.recent_risks.map((item, n) => {
                      const r = item as RecordRow,
                        d = r.data ?? (item as Data);
                      return (
                        <Link key={item.id} to={`/risks/${item.id}`} className="recent-risk">
                          <span className="row-number">{String(n + 1).padStart(2, '0')}</span>
                          <div>
                            <strong>{str(d.name)}</strong>
                            <p>{str(d.definition, '等待完善风险定义')}</p>
                            <span className="mini-meta">{formatTime(d.admitted_at ?? r.created_at)}</span>
                          </div>
                          <Badge value={str(d.tracking_status, 'observing')} />
                          <ArrowUpRight size={17} />
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <Empty
                    title="研究目录等待第一条风险"
                    description="从信息与事件开始，先形成完整候选，再由审核员确认纳管。"
                    action={
                      <Link to="/information" className="text-link">
                        进入信息工作台
                        <ArrowRight size={15} />
                      </Link>
                    }
                  />
                )}
              </section>
              <aside className="dashboard-side">
                <section className="panel attention-panel">
                  <div className="panel-heading">
                    <h2>待处理事项</h2>
                    <Bell size={17} />
                  </div>
                  <Link to="/reviews" className="attention-row">
                    <span className="attention-icon">
                      <ClipboardCheck size={18} />
                    </span>
                    <div>
                      <strong>业务复核</strong>
                      <small>核验依据、确认正式结果</small>
                    </div>
                    <b>{data.pending_reviews}</b>
                    <ChevronRight size={15} />
                  </Link>
                  <Link to="/operations" className="attention-row">
                    <span className={`attention-icon ${data.failed_tasks ? 'danger' : ''}`}>
                      <Activity size={18} />
                    </span>
                    <div>
                      <strong>运行异常</strong>
                      <small>定位失败阶段与恢复路径</small>
                    </div>
                    <b>{data.failed_tasks}</b>
                    <ChevronRight size={15} />
                  </Link>
                </section>
                <section className="research-note">
                  <span className="eyebrow">RESEARCH DISCIPLINE</span>
                  <h3>
                    先确认“何时可知”，
                    <br />
                    再回答“意味着什么”。
                  </h3>
                  <p>尚未评估、证据不足与技术失败分别表达。没有新信息，不能被当作风险维持的证据。</p>
                  <div className="note-rule" />
                  <span>数据查询于 {formatTime(new Date(query.dataUpdatedAt).toISOString(), true)}</span>
                </section>
              </aside>
            </div>
          </>
        )
      )}
    </>
  );
}

interface Collection {
  domain: Domain;
  kind: string;
  title: string;
  command?: string;
  commandTitle?: string;
  defaults?: Data;
}
interface SectionDefinition {
  index: string;
  title: string;
  description: string;
  collections: Collection[];
}
const sections: Record<string, SectionDefinition> = {
  information: {
    index: '02',
    title: '信息与事件',
    description: '保留原文，辨别增量，建立可验证的宏观事件。',
    collections: [
      {
        domain: 'information',
        kind: 'information',
        title: '原始资料',
        command: 'information.ingest',
        commandTitle: '录入原文',
      },
      { domain: 'information', kind: 'event', title: '宏观事件', command: 'information.event' },
      { domain: 'information', kind: 'event_update', title: '事件增量' },
      { domain: 'information', kind: 'source', title: '可信信源', command: 'information.source' },
      { domain: 'information', kind: 'rating', title: '金融意义', command: 'information.rate' },
      { domain: 'information', kind: 'grouping', title: '归组复核' },
    ],
  },
  analysis: {
    index: '04',
    title: '观察分析',
    description: '冻结证据边界，分清当前状态与相对变化。',
    collections: [
      { domain: 'operations', kind: 'task', title: '研究任务', command: 'analysis.start' },
      { domain: 'analysis', kind: 'snapshot', title: '分析快照', command: 'analysis.draft' },
      { domain: 'registry', kind: 'candidate', title: '风险候选', command: 'registry.candidate' },
      { domain: 'analysis', kind: 'feedback', title: '观察反馈', command: 'analysis.feedback' },
    ],
  },
  reports: {
    index: '05',
    title: '研究报告',
    description: '按周期组织已核验判断，保留发布与修订轨迹。',
    collections: [
      {
        domain: 'publication',
        kind: 'report',
        title: '周期报告',
        command: 'publication.generate',
        commandTitle: '编制报告',
      },
    ],
  },
  config: {
    index: '07',
    title: '配置中心',
    description: '共同的语言、明确的边界、版本化的研究规则。',
    collections: [
      ...[
        'target',
        'variable',
        'risk_source',
        'dimension',
        'rule',
        'prompt',
        'model',
        'market',
        'variable_candidate',
      ].map((kind) => ({
        domain: 'reference' as Domain,
        kind,
        title: label(kind),
        command: 'reference.save',
        defaults: { kind },
      })),
      { domain: 'observations', kind: 'indicator', title: '指标', command: 'observations.indicator' },
      { domain: 'observations', kind: 'mapping', title: '变量映射', command: 'observations.mapping' },
      { domain: 'observations', kind: 'value', title: '观测数据', command: 'observations.import' },
    ],
  },
  operations: {
    index: '08',
    title: '运行中心',
    description: '查看真实执行阶段，区分技术重试与有意重算。',
    collections: [
      { domain: 'operations', kind: 'task', title: '全部任务' },
      { domain: 'operations', kind: 'schedule', title: '运行计划', command: 'operations.schedule' },
      { domain: 'operations', kind: 'issue', title: '异常事项' },
      { domain: 'operations', kind: 'review_assignment', title: '待办分派', command: 'operations.assign' },
      { domain: 'operations', kind: 'review_decision', title: '复核记录' },
      { domain: 'operations', kind: 'feedback_decision', title: '反馈处理' },
    ],
  },
  accounts: {
    index: '09',
    title: '账号与权限',
    description: '研究、审核与运行权限分别授予，关键操作保留实际身份。',
    collections: [
      {
        domain: 'identity',
        kind: 'user',
        title: '用户账号',
        command: 'identity.user',
        commandTitle: '新建账号',
      },
    ],
  },
};

function useStoredString(key: string, fallback = '') {
  const [value, setValue] = useState(() => sessionStorage.getItem(key) ?? fallback);
  return [
    value,
    (next: string) => {
      sessionStorage.setItem(key, next);
      setValue(next);
    },
  ] as const;
}

export function SectionPage() {
  const { section } = useParams({ strict: false }) as { section: string };
  return section === 'risks' ? (
    <RiskCatalogue />
  ) : section === 'reviews' ? (
    <Reviews />
  ) : sections[section] ? (
    <CollectionPage key={section} section={section} definition={sections[section]!} />
  ) : (
    <Empty
      title="页面不存在"
      description="请从左侧导航进入已有工作台。"
      action={
        <Link to="/" className="text-link">
          返回总览
        </Link>
      }
    />
  );
}

function CollectionPage({ section, definition }: { section: string; definition: SectionDefinition }) {
  const [tab, setTab] = useStoredString(`${section}:tab`, definition.collections[0]!.kind);
  const collection = definition.collections.find((item) => item.kind === tab) ?? definition.collections[0]!;
  return (
    <>
      <PageHeading
        index={definition.index}
        title={definition.title}
        description={definition.description}
        actions={
          collection.command && (
            <CommandButton
              name={collection.command}
              title={collection.commandTitle}
              defaults={collection.defaults}
            />
          )
        }
      />
      <div className="tabs" role="tablist" aria-label="记录类型">
        {definition.collections.map((item) => (
          <button
            key={item.kind}
            role="tab"
            aria-selected={item.kind === collection.kind}
            className={item.kind === collection.kind ? 'active' : ''}
            onClick={() => setTab(item.kind)}
          >
            {item.title}
          </button>
        ))}
      </div>
      <RecordCollection key={`${section}:${collection.kind}`} collection={collection} />
    </>
  );
}

function RecordCollection({ collection }: { collection: Collection }) {
  const { inspect } = useWorkspace();
  const [search, setSearch] = useStoredString(`filter:${collection.domain}:${collection.kind}`),
    [status, setStatus] = useStoredString(`status:${collection.domain}:${collection.kind}`),
    [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ['records', collection.domain, collection.kind],
    queryFn: () =>
      get<{ items: RecordRow[]; total: number }>(`/data/${collection.domain}/${collection.kind}`),
    refetchInterval: collection.kind === 'task' ? 8_000 : false,
  });
  const items = query.data?.items ?? [],
    statuses = [...new Set(items.map((row) => row.status))];
  const filtered = items.filter(
    (row) =>
      (!status || row.status === status) &&
      (!search ||
        JSON.stringify(row.data).toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
        row.id.includes(search)),
  );
  const pageCount = Math.ceil(filtered.length / 15),
    safePage = Math.min(page, Math.max(pageCount - 1, 0)),
    visible = filtered.slice(safePage * 15, (safePage + 1) * 15);
  return (
    <section className="panel collection-panel">
      <div className="list-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="搜索记录"
            placeholder={`搜索${collection.title}、关键词或 ID…`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
          {search && (
            <button aria-label="清除搜索" className="icon-button" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <div className="filter-field">
          <ListFilter size={15} />
          <select
            aria-label="状态筛选"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
          >
            <option value="">全部状态</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </div>
        <button className="icon-button" aria-label="刷新记录" onClick={() => void query.refetch()}>
          <RefreshCw size={16} className={query.isFetching ? 'spin' : ''} />
        </button>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : visible.length ? (
        <>
          <div className="table-scroll">
            <table className="record-table">
              <thead>
                <tr>
                  <th>研究记录 / RECORD</th>
                  <th>状态</th>
                  <th>版本</th>
                  <th>更新于（北京时间）</th>
                  <th>
                    <span className="sr-only">操作</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button className="record-title" onClick={() => inspect(collection.domain, row)}>
                        {rowTitle(row)}
                      </button>
                      <p>{recordDescription(row)}</p>
                      <Id value={row.id} />
                    </td>
                    <td>
                      <Badge value={row.status} />
                      {row.kind === 'risk' && <Badge value={str(row.data.tracking_status)} />}
                    </td>
                    <td>
                      <span className="version-label">v{row.version}</span>
                    </td>
                    <td className="date-cell">
                      {formatTime(row.updated_at)}
                      {row.data.snapshot_time && <small>判断截止 {formatTime(row.data.snapshot_time)}</small>}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`查看${rowTitle(row)}`}
                        onClick={() => inspect(collection.domain, row)}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="list-footer">
            <span>
              匹配 {filtered.length} 条 / 已载入 {items.length} 条
              {query.data?.total !== undefined && ` · 共 ${query.data.total} 条`}
              <span className="separator">·</span>
              {formatTime(new Date(query.dataUpdatedAt).toISOString(), true)} 更新
            </span>
            <div className="pagination">
              <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                上一页
              </button>
              <span>
                {safePage + 1} / {pageCount}
              </span>
              <button disabled={safePage + 1 >= pageCount} onClick={() => setPage(safePage + 1)}>
                下一页
              </button>
            </div>
          </div>
        </>
      ) : (
        <Empty
          title={search || status ? '没有匹配的记录' : `暂无${collection.title}`}
          description={
            search || status
              ? '调整关键词或状态筛选，查看其他记录。'
              : '保存的真实业务记录将在这里展示；暂无记录不会被解释为没有风险。'
          }
          action={
            search || status ? (
              <button
                className="text-link"
                onClick={() => {
                  setSearch('');
                  setStatus('');
                }}
              >
                清除筛选
              </button>
            ) : collection.command ? (
              <CommandButton
                name={collection.command}
                title={collection.commandTitle}
                defaults={collection.defaults}
                className="button secondary"
              />
            ) : undefined
          }
        />
      )}
    </section>
  );
}
function recordDescription(row: RecordRow) {
  const d = row.data;
  if (row.kind === 'task')
    return `${label(str(d.type))} · ${label(str(d.stage))}${d.error_message ? ` · ${str(d.error_message)}` : ''}`;
  if (row.kind === 'report')
    return `${label(str(d.type))} · ${formatTime(d.period_start)} — ${formatTime(d.period_end)}`;
  return str(
    d.summary ?? d.definition ?? d.scope ?? d.explanation ?? d.url ?? d.username ?? d.observed_state,
    '查看详情、依据与历史版本',
  ).slice(0, 130);
}

function RiskCatalogue() {
  const [search, setSearch] = useStoredString('risks:search'),
    [mode, setMode] = useStoredString('risks:mode', 'latest'),
    [tracking, setTracking] = useStoredString('risks:tracking');
  const query = useQuery({
    queryKey: ['risks', mode],
    queryFn: () => get<{ items: RiskItem[] }>(`/risks?sort=${mode}`),
  });
  const items = (query.data?.items ?? []).filter(
    (risk) =>
      (!search || `${risk.name} ${risk.definition}`.includes(search)) &&
      (!tracking || risk.tracking_status === tracking),
  );
  return (
    <>
      <PageHeading
        index="03"
        title="风险目录"
        description="以稳定定义连接历史，以明确时点理解当前。"
        actions={<CommandButton name="registry.candidate" title="录入风险候选" />}
      />
      <div className="tabs" role="tablist" aria-label="风险列表">
        <button
          role="tab"
          aria-selected={mode === 'latest'}
          className={mode === 'latest' ? 'active' : ''}
          onClick={() => setMode('latest')}
        >
          最新风险
        </button>
        <button
          role="tab"
          aria-selected={mode === 'severity'}
          className={mode === 'severity' ? 'active' : ''}
          onClick={() => setMode('severity')}
        >
          严重程度
        </button>
        <button
          role="tab"
          aria-selected={mode === 'all'}
          className={mode === 'all' ? 'active' : ''}
          onClick={() => setMode('all')}
        >
          完整目录
        </button>
      </div>
      <section className="panel">
        <div className="list-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="搜索风险"
              placeholder="搜索风险名称、定义…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="filter-field">
            <ListFilter size={15} />
            <select
              aria-label="跟踪状态筛选"
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
            >
              <option value="">全部跟踪状态</option>
              {['observing', 'monitoring', 'paused', 'closed'].map((value) => (
                <option value={value} key={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </div>
          <button className="icon-button" aria-label="刷新风险目录" onClick={() => void query.refetch()}>
            <RefreshCw size={16} />
          </button>
        </div>
        {mode === 'severity' && (
          <div className="inline-note">等级未明确或规则不可比的风险单独标注，不默认归为低风险。</div>
        )}
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : !items.length ? (
          <Empty
            title="暂无匹配的风险"
            description="已完成同一性复核并正式纳管的风险将在这里出现。"
            action={
              <Link to="/analysis" className="text-link">
                查看候选与分析
                <ArrowRight size={15} />
              </Link>
            }
          />
        ) : (
          <div className="risk-catalogue">
            {items.map((risk, n) => (
              <Link key={risk.id} to={`/risks/${risk.id}`} className="risk-catalogue-row">
                <span className="row-number">{String(n + 1).padStart(2, '0')}</span>
                <div className="risk-catalogue-title">
                  <div>
                    <strong>{risk.name}</strong>
                    <Badge value={str(risk.tracking_status, 'observing')} />
                  </div>
                  <p>{str(risk.definition)}</p>
                  <div className="mini-meta">
                    {str(risk.market, '未分类')}
                    <span>·</span>
                    {risk.snapshot
                      ? `判断截止 ${formatTime(asData(asData(risk.snapshot).data ?? risk.snapshot).snapshot_time)}`
                      : '尚无正式分析快照'}
                  </div>
                </div>
                <div className="risk-state">
                  <SnapshotSummary value={risk.snapshot} />
                  {risk.unranked_reason && <small>{risk.unranked_reason}</small>}
                </div>
                <ArrowUpRight size={18} />
              </Link>
            ))}
          </div>
        )}
        <div className="list-footer">
          <span>当前显示 {items.length} 项风险</span>
          <span>数据含义以详情中的截止时间与版本为准</span>
        </div>
      </section>
    </>
  );
}

export function RiskDetailPage() {
  const { riskId } = useParams({ strict: false }) as { riskId: string },
    { inspect } = useWorkspace();
  const query = useQuery({
    queryKey: ['risk-detail', riskId],
    queryFn: () =>
      get<{ risk: RecordRow; snapshots: RecordRow[]; relations: Data[]; events: RecordRow[] }>(
        `/risks/${encodeURIComponent(riskId)}`,
      ),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  const { risk, snapshots, events, relations } = query.data!,
    latest = snapshots
      .filter((x) => x.status === 'approved')
      .sort((a, b) => str(b.data.snapshot_time).localeCompare(str(a.data.snapshot_time)))[0];
  return (
    <>
      <Link to="/risks" className="back-link">
        <ArrowLeft size={15} />
        返回风险目录
      </Link>
      <PageHeading
        index="RISK PROFILE"
        title={rowTitle(risk)}
        description={str(risk.data.definition)}
        actions={<CommandButton name="analysis.start" record={risk} title="发起本轮观察" />}
      />
      <div className="risk-profile-meta">
        <Badge value={str(risk.data.tracking_status)} />
        <Id value={risk.id} />
        <span>定义版本 {str(risk.data.definition_version)}</span>
        <span>纳管于 {formatTime(risk.data.admitted_at)}</span>
        <button className="text-link" onClick={() => inspect('registry', risk)}>
          配置与管理
          <Settings2 size={14} />
        </button>
      </div>
      <div className="risk-detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">CURRENT SITUATION</span>
              <h2>当前状态</h2>
            </div>
            {latest && <span className="mini-meta">截至 {formatTime(latest.data.snapshot_time)}</span>}
          </div>
          {latest ? (
            <>
              <div className="four-dimensions">
                {[
                  ['当前等级', latest.data.risk_level ?? 'undetermined'],
                  ['风险阶段', latest.data.risk_stage],
                  ['影响范围', latest.data.affected_scope],
                  ['持续性展望', latest.data.persistence_outlook],
                ].map(([name, value]) => (
                  <div key={String(name)}>
                    <span>{String(name)}</span>
                    <strong>
                      {Array.isArray(value)
                        ? value.map((x) => str(x)).join('、') || '待判断'
                        : label(str(value))}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="panel-content">
                <h3 className="subheading">依据与限制</h3>
                <DataDetails data={asData(latest.data.status_summary)} />
                <h3 className="subheading">相对历史的变化</h3>
                <DataDetails data={asData(latest.data.change)} />
                <button className="button secondary" onClick={() => inspect('analysis', latest)}>
                  查看完整分析与证据
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <Empty title="尚未评估" description="需要形成并批准本轮观察结果；暂不提供风险等级与方向判断。" />
          )}
        </section>
        <aside className="panel">
          <div className="panel-heading">
            <h2>定义与观察边界</h2>
            <CircleDot size={17} />
          </div>
          <div className="panel-content">
            <DataDetails
              data={{
                scope_boundary: risk.data.scope_boundary ?? null,
                damage_targets: risk.data.damage_targets ?? [],
                mechanism_summary: risk.data.mechanism_summary ?? null,
              }}
            />
            <h3 className="subheading">关键变量</h3>
            <DataDetails data={{ key_variables: risk.data.key_variables ?? [] }} />
          </div>
        </aside>
      </div>
      <section className="panel timeline-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">EVIDENCE & TIMELINE</span>
            <h2>观察时间线</h2>
          </div>
          <span className="mini-meta">
            {snapshots.length} 次分析 · {relations.length} 条事件关联
          </span>
        </div>
        {!snapshots.length && !events.length ? (
          <Empty title="尚无时间线记录" description="关联事件与观察结果会在这里保留各自的版本。" />
        ) : (
          <div className="timeline">
            {[
              ...snapshots.map((row) => ({
                row,
                domain: 'analysis' as Domain,
                time: str(row.data.snapshot_time, row.created_at),
              })),
              ...events.map((row) => ({ row, domain: 'information' as Domain, time: row.updated_at })),
            ]
              .sort((a, b) => b.time.localeCompare(a.time))
              .map(({ row, domain, time }) => (
                <div className="timeline-item" key={row.id}>
                  <span className="timeline-dot" />
                  <time>{formatTime(time)}</time>
                  <button onClick={() => inspect(domain, row)}>
                    <strong>{row.kind === 'snapshot' ? '风险态势观察' : rowTitle(row)}</strong>
                    <p>
                      {row.kind === 'snapshot'
                        ? `${label(str(row.data.risk_stage))} · ${label(str(asData(row.data.change).trend))}`
                        : recordDescription(row)}
                    </p>
                  </button>
                  <Badge value={row.status} />
                  <span className="version-label">v{row.version}</span>
                </div>
              ))}
          </div>
        )}
      </section>
    </>
  );
}

function Reviews() {
  const { inspect } = useWorkspace();
  const query = useQuery({
    queryKey: ['reviews'],
    queryFn: () => get<{ items: { domain: Domain; record: RecordRow }[] }>('/reviews'),
    refetchInterval: 15_000,
  });
  return (
    <>
      <PageHeading
        index="06"
        title="复核中心"
        description="把建议变成正式判断之前，再看一遍证据与边界。"
        actions={<CommandButton name="operations.assign" title="认领或分派" />}
      />
      <div className="review-notice">
        <ShieldCheck size={21} />
        <div>
          <strong>批准是明确的业务动作</strong>
          <p>打开记录核验对象、证据和版本；模型建议不会自动取得审核人的权限。</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>等待复核</h2>
          <span className="count-pill">{query.data?.items.length ?? '—'}</span>
          <button className="icon-button" aria-label="刷新待办" onClick={() => void query.refetch()}>
            <RefreshCw size={16} />
          </button>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : query.data?.items.length ? (
          <div className="review-list">
            {query.data.items.map(({ domain, record }) => (
              <button key={record.id} className="review-row" onClick={() => inspect(domain, record)}>
                <span className="review-kind">{label(record.kind)}</span>
                <div>
                  <strong>{rowTitle(record)}</strong>
                  <p>{recordDescription(record)}</p>
                  <span className="mini-meta">
                    {formatTime(record.updated_at)} · v{record.version}
                  </span>
                </div>
                <Badge value={record.status} />
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title="当前没有待复核记录"
            description="新的配置草稿、风险候选和分析结果提交后，会在这里汇集。"
          />
        )}
      </section>
    </>
  );
}

function rowActions(domain: Domain, row: RecordRow): { name: string; title?: string; defaults?: Data }[] {
  if (domain === 'reference')
    return [
      ...(row.status === 'draft'
        ? [
            { name: 'reference.save', title: '编辑配置' },
            { name: row.kind === 'variable_candidate' ? 'reference.resolve_variable' : 'reference.approve' },
          ]
        : []),
      ...(row.status === 'approved' ? [{ name: 'reference.disable' }] : []),
    ];
  if (row.kind === 'source')
    return [
      { name: 'information.source_status' },
      { name: 'information.ingest', defaults: { source_id: row.id } },
    ];
  if (row.kind === 'information')
    return [
      { name: 'information.extract' },
      {
        name: 'information.event',
        defaults: {
          data: {
            information_id: row.id,
            title: row.data.title ?? '',
            status: 'announced',
            increment_type: 'NEW_EVENT',
          },
        },
      },
    ];
  if (row.kind === 'event')
    return [
      { name: 'registry.identify' },
      { name: 'registry.candidate', defaults: { data: { event_id: row.id } } },
      { name: 'information.correct' },
      { name: 'information.rate' },
      { name: 'information.grouping' },
    ];
  if (row.kind === 'candidate' && row.status === 'draft')
    return [{ name: 'registry.match' }, { name: 'registry.admit' }];
  if (row.kind === 'risk')
    return [
      { name: 'analysis.start' },
      { name: 'registry.relate' },
      { name: 'registry.revise' },
      { name: 'registry.tracking' },
      { name: 'analysis.feedback' },
    ];
  if (row.kind === 'task')
    return [
      ...(row.data.type === 'analysis' && !['completed', 'cancelled'].includes(row.status)
        ? [{ name: 'analysis.draft', defaults: { task_id: row.id } }]
        : []),
      ...(row.data.type === 'identify'
        ? [
            {
              name: 'registry.candidate',
              defaults: {
                task_id: row.id,
                data: asData(asData(row.data.proposal).data ?? row.data.proposal),
              },
            },
          ]
        : []),
      ...(row.data.type === 'extract'
        ? [
            {
              name: 'information.event',
              defaults: {
                task_id: row.id,
                data: asData(asData(row.data.proposal).data ?? row.data.proposal),
              },
            },
          ]
        : []),
      ...(row.status === 'failed' ? [{ name: 'operations.retry' }] : []),
      ...(!['completed', 'cancelled'].includes(row.status) ? [{ name: 'operations.cancel' }] : []),
      { name: 'operations.recompute' },
    ];
  if (row.kind === 'snapshot')
    return row.status === 'draft'
      ? [{ name: 'analysis.draft', title: '编辑研究草稿' }, { name: 'analysis.submit' }]
      : row.status === 'submitted'
        ? [{ name: 'analysis.approve' }]
        : [
            { name: 'analysis.revise' },
            ...(row.status === 'approved' ? [{ name: 'analysis.withdraw' }] : []),
          ];
  if (row.kind === 'report')
    return row.status === 'draft'
      ? [{ name: 'publication.edit' }, { name: 'publication.submit' }]
      : row.status === 'submitted'
        ? [{ name: 'publication.publish' }]
        : [
            { name: 'publication.revise' },
            ...(row.status === 'published' ? [{ name: 'publication.withdraw' }] : []),
          ];
  if (row.kind === 'schedule')
    return [
      ...(row.status === 'disabled' ? [{ name: 'operations.schedule', title: '编辑运行计划' }] : []),
      { name: 'operations.schedule_status', title: row.status === 'enabled' ? '暂停计划' : '启用计划' },
      ...(row.status === 'enabled' ? [{ name: 'operations.schedule_run' }] : []),
    ];
  if (row.kind === 'issue') return [{ name: 'operations.issue' }];
  if (row.kind === 'feedback') return [{ name: 'operations.feedback' }];
  if (row.kind === 'user') return [{ name: 'identity.user', title: '编辑账号与权限' }];
  return [];
}

function RecordDrawer({
  domain,
  original,
  onClose,
}: {
  domain: Domain;
  original: RecordRow;
  onClose: () => void;
}) {
  const { inspect } = useWorkspace();
  const [tab, setTab] = useState('details');
  const query = useQuery({
    queryKey: ['record', domain, original.id],
    queryFn: () => get<RecordRow>(`/record/${domain}/${original.id}`),
    initialData: original,
    staleTime: 0,
    refetchInterval: original.kind === 'task' ? 5_000 : false,
  });
  const history = useQuery({
    queryKey: ['history', domain, original.id],
    queryFn: () => get<{ items: RecordRow[] }>(`/history/${domain}/${original.id}`),
    enabled: tab === 'history',
  });
  const row = query.data,
    actions = rowActions(domain, row),
    taskInput = asData(row.data.input);
  return (
    <Modal title={rowTitle(row)} eyebrow={`${label(row.kind)} / v${row.version}`} onClose={onClose} drawer>
      <div className="drawer-body">
        <div className="drawer-meta">
          <Badge value={row.status} />
          <Id value={row.id} />
          <span>{formatTime(row.updated_at)}</span>
        </div>
        <div className="record-actions">
          {actions.map((action) => (
            <CommandButton
              key={action.name}
              name={action.name}
              title={action.title}
              record={row}
              defaults={action.defaults}
              domain={domain}
              className="button secondary small"
              icon={false}
            />
          ))}
          {row.kind === 'risk' && (
            <Link to={`/risks/${row.id}`} className="button secondary small" onClick={onClose}>
              风险详情
              <ArrowUpRight size={14} />
            </Link>
          )}
          {['draft', 'submitted', 'pending'].includes(row.status) && domain !== 'identity' && (
            <CommandButton
              name="operations.review"
              title="退回／驳回"
              defaults={{
                data: { domain, object_id: row.id, expected_version: row.version, decision: 'return' },
              }}
              className="button ghost small"
              icon={false}
            />
          )}
        </div>
        {query.error && <ErrorPanel error={query.error} retry={() => void query.refetch()} />}
        {row.kind === 'task' && (
          <div className="task-state">
            <span className="eyebrow">EXECUTION STATUS</span>
            <h3>{label(str(row.data.stage, row.status))}</h3>
            <p>
              {str(
                row.data.error_message ?? row.data.limitation,
                row.status === 'awaiting_input'
                  ? '当前任务等待人工补充研究内容，请从上方操作继续。'
                  : '任务可以在离开页面后持续执行。请以实际状态为准。',
              )}
            </p>
            <div className="progress-track">
              <i
                style={{
                  width: `${Math.max(0, Math.min(100, typeof row.data.progress === 'number' ? row.data.progress : 0))}%`,
                }}
              />
            </div>
            {taskInput.snapshot_time && <small>本轮证据截止：{formatTime(taskInput.snapshot_time)}</small>}
          </div>
        )}
        {row.kind === 'report' && row.status === 'published' && (
          <div className="export-buttons">
            <a
              className="button secondary small"
              href={`/api/v1/reports/${row.id}/export?format=markdown`}
              download
            >
              <ArrowDownToLine size={14} />
              Markdown
            </a>
            <a
              className="button secondary small"
              href={`/api/v1/reports/${row.id}/export?format=html`}
              download
            >
              <ArrowDownToLine size={14} />
              可打印 HTML
            </a>
          </div>
        )}
        {row.status === 'withdrawn' && (
          <div className="notice warning">
            <p>该版本已撤回。请以有效的后续修订为准；历史内容不代表当前正式判断。</p>
          </div>
        )}
        <div className="tabs compact" role="tablist" aria-label="记录详情">
          <button
            role="tab"
            aria-selected={tab === 'details'}
            onClick={() => setTab('details')}
            className={tab === 'details' ? 'active' : ''}
          >
            内容与依据
          </button>
          <button
            role="tab"
            aria-selected={tab === 'history'}
            onClick={() => setTab('history')}
            className={tab === 'history' ? 'active' : ''}
          >
            版本历史
          </button>
          <button
            role="tab"
            aria-selected={tab === 'raw'}
            onClick={() => setTab('raw')}
            className={tab === 'raw' ? 'active' : ''}
          >
            完整结构
          </button>
        </div>
        {tab === 'details' ? (
          <DataDetails data={row.data} />
        ) : tab === 'raw' ? (
          <pre className="raw-record">{JSON.stringify(row, null, 2)}</pre>
        ) : history.isPending ? (
          <Loading />
        ) : history.error ? (
          <ErrorPanel error={history.error} />
        ) : (
          <div className="version-history">
            {history.data?.items.map((version) => (
              <details key={`${version.id}:${version.version}`}>
                <summary>
                  <span>版本 {version.version}</span>
                  <Badge value={version.status} />
                  <time>{formatTime(version.updated_at)}</time>
                </summary>
                <DataDetails data={version.data} />
              </details>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
