import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, Check, ChevronDown, Copy, FileSearch, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { ApiError, asData, formatTime, str, type Data, type Json } from './api';
import { label } from './labels';

export function Badge({ value }: { value: string }) {
  const tone = ['failed', 'withdrawn', 'closed', 'rejected'].includes(value)
    ? 'danger'
    : ['approved', 'active', 'published', 'completed', 'valid'].includes(value)
      ? 'good'
      : ['draft', 'submitted', 'pending', 'awaiting_input', 'awaiting_review', 'undetermined'].includes(value)
        ? 'amber'
        : 'neutral';
  return (
    <span className={`badge ${tone}`}>
      <i />
      {label(value)}
    </span>
  );
}
export function Loading({ text = '正在读取研究记录…' }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={20} className="spin" />
      {text}
    </div>
  );
}
export function ErrorPanel({ error, retry }: { error: unknown; retry?: () => void }) {
  const e = error instanceof Error ? error : new Error('读取失败');
  return (
    <div className="error-panel" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>
          {error instanceof ApiError && error.status === 403 ? '当前账号没有访问权限' : '请求尚未完成'}
        </strong>
        <p>{e.message}</p>
        {error instanceof ApiError && <code>{error.code}</code>}
      </div>
      {retry && (
        <button className="button secondary small" onClick={retry}>
          <RefreshCw size={14} />
          重新读取
        </button>
      )}
    </div>
  );
}
export function Empty({
  title = '这里还没有记录',
  description = '开始录入可信资料，建立可追溯的研究链路。',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <FileSearch size={29} strokeWidth={1.2} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
  drawer = false,
  dirty = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  drawer?: boolean;
  dirty?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => {
    if (!dirty || window.confirm('有尚未保存的编辑，确定离开吗？')) onClose();
  };
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  return (
    <dialog
      ref={ref}
      className={`${drawer ? 'drawer' : 'modal'} ${wide ? 'wide' : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-label={title}
    >
      <div className="modal-heading">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        <button className="icon-button" aria-label="关闭面板" onClick={close}>
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Id({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="id-copy"
      title={value}
      aria-label={`复制记录 ID ${value}`}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      <code>{value.slice(0, 8)}</code>
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}
export function JsonBlock({ value, title = '查看完整结构' }: { value: unknown; title?: string }) {
  return (
    <details className="json-disclosure">
      <summary>
        {title}
        <ChevronDown size={14} />
      </summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

const internal = new Set(['password_hash', 'password', 'secret', 'token', 'csrf']);
const textBlock = new Set([
  'content',
  'definition',
  'summary',
  'mechanism_summary',
  'scope_boundary',
  'interpretation',
  'change_reason',
  'next_observation',
  'quote',
  'reason',
  'approval_reason',
  'persistence_outlook',
]);
export function DataDetails({ data, depth = 0 }: { data: Data; depth?: number }) {
  return (
    <dl className={`data-details depth-${depth}`}>
      {Object.entries(data)
        .filter(([key]) => !internal.has(key))
        .map(([key, value]) => {
          const nested = value !== null && typeof value === 'object';
          if (nested && depth > 2)
            return (
              <div className="detail-line full" key={key}>
                <dt>{label(key)}</dt>
                <dd>
                  <JsonBlock value={value} />
                </dd>
              </div>
            );
          return (
            <div className={`detail-line ${nested || textBlock.has(key) ? 'full' : ''}`} key={key}>
              <dt>{label(key)}</dt>
              <dd>
                {value === null ? (
                  <span className="muted">未明确／待判断</span>
                ) : typeof value === 'boolean' ? (
                  value ? (
                    '是'
                  ) : (
                    '否'
                  )
                ) : Array.isArray(value) ? (
                  value.length ? (
                    <div className="detail-array">
                      {value.map((item, n) => (
                        <div key={n}>
                          {item && typeof item === 'object' && !Array.isArray(item) ? (
                            <DataDetails data={item} depth={depth + 1} />
                          ) : (
                            <span>{str(item)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="muted">暂无条目</span>
                  )
                ) : nested ? (
                  <DataDetails data={asData(value)} depth={depth + 1} />
                ) : /_at$|_time$|^cutoff$|^period_/.test(key) ? (
                  formatTime(value)
                ) : typeof value === 'string' ? (
                  label(value)
                ) : (
                  str(value)
                )}
              </dd>
            </div>
          );
        })}
    </dl>
  );
}
export function PageHeading({
  index,
  title,
  description,
  actions,
}: {
  index: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">
          RISK INTELLIGENCE <span>/ {index}</span>
        </div>
        <h1>
          {title}
          <span className="heading-square" />
        </h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
export function SnapshotSummary({ value }: { value: Json | undefined }) {
  const raw = asData(value),
    data = raw.data ? asData(raw.data) : raw;
  if (!Object.keys(data).length) return <span className="muted">尚未评估</span>;
  const change = asData(data.change);
  return (
    <div className="snapshot-summary">
      <span>{data.risk_level ? label(str(data.risk_level)) : '等级待判断'}</span>
      <span>{label(str(data.risk_stage, 'undetermined'))}</span>
      <span>{label(str(change.trend, 'undetermined'))}</span>
    </div>
  );
}
