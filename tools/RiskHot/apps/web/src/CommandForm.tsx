import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Code2, FileDown, LoaderCircle, ShieldCheck } from 'lucide-react';
import {
  asData,
  execute,
  get,
  rowTitle,
  str,
  type Contracts,
  type Data,
  type Domain,
  type Json,
  type RecordRow,
  type Schema,
  type Session,
} from './api';
import { ErrorPanel, JsonBlock, Modal } from './components';
import { dataFields, enumFor, initialInput, sampleFor } from './form-schema';
import { label } from './labels';

export interface CommandIntent {
  name: string;
  title?: string;
  record?: RecordRow;
  domain?: Domain;
  defaults?: Data;
}
interface FieldProps {
  name: string;
  schema: Schema;
  value: Json | undefined;
  required?: boolean;
  onChange: (value: Json | undefined) => void;
  choices?: RecordRow[];
  error?: string;
  sample?: unknown;
  onInvalid: (message: string) => void;
}

function JsonEditor({
  name,
  value,
  onChange,
  sample,
  onInvalid,
}: Pick<FieldProps, 'name' | 'value' | 'onChange' | 'sample' | 'onInvalid'>) {
  const [raw, setRaw] = useState(value === undefined ? '' : JSON.stringify(value, null, 2));
  const [error, setError] = useState('');
  const lastValid = useRef(value);
  useEffect(() => {
    if (value !== lastValid.current) {
      lastValid.current = value;
      setRaw(value === undefined ? '' : JSON.stringify(value, null, 2));
      setError('');
      onInvalid('');
    }
  }, [value]);
  const change = (text: string) => {
    setRaw(text);
    try {
      const parsed = text.trim() ? (JSON.parse(text) as Json) : undefined;
      lastValid.current = parsed;
      onChange(parsed);
      setError('');
      onInvalid('');
    } catch {
      const message = 'JSON 格式有误，请检查引号、括号和逗号。';
      setError(message);
      onInvalid(message);
    }
  };
  return (
    <div className="json-editor">
      <div className="editor-toolbar">
        <span>
          <Code2 size={13} />
          JSON · 结构化内容
        </span>
        {sample !== undefined && (
          <button type="button" onClick={() => change(JSON.stringify(sample, null, 2))}>
            载入结构样例
          </button>
        )}
      </div>
      <textarea
        aria-label={name}
        value={raw}
        onChange={(event) => change(event.target.value)}
        spellCheck={false}
        rows={8}
        className={error ? 'invalid' : ''}
      />
      {error && <small className="field-error">{error}</small>}
      <small>样例仅用于说明结构；提交前请替换成已核验内容与实际引用。</small>
    </div>
  );
}

function localDate(value: Json | undefined) {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function Field({ name, schema, value, required, onChange, choices, error, sample, onInvalid }: FieldProps) {
  const id = useId(),
    title = schema.title ?? label(name),
    type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  const nullable = Array.isArray(schema.type) && schema.type.includes('null');
  if (type === 'boolean')
    return (
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{title}</span>
      </label>
    );
  if (name === 'roles')
    return (
      <fieldset className="role-selector">
        <legend>
          {title} <span>*</span>
        </legend>
        {['reader', 'researcher', 'reviewer', 'admin'].map((role) => (
          <label key={role}>
            <input
              type="checkbox"
              checked={Array.isArray(value) && value.includes(role)}
              onChange={(event) => {
                const before = Array.isArray(value) ? value : [];
                onChange(event.target.checked ? [...before, role] : before.filter((x) => x !== role));
              }}
            />
            {label(role)}
          </label>
        ))}
      </fieldset>
    );
  const long = [
    'content',
    'summary',
    'definition',
    'reason',
    'mechanism_summary',
    'scope_boundary',
    'quote',
    'explanation',
    'boundary',
    'confirmation_criteria',
    'calibration_evidence',
  ].includes(name);
  return (
    <div className={`form-field ${long || type === 'object' || type === 'array' ? 'full' : ''}`}>
      <label htmlFor={id}>
        {title}
        {required && <span className="required"> *</span>}
      </label>
      {type === 'array' || type === 'object' ? (
        <JsonEditor name={title} value={value} onChange={onChange} sample={sample} onInvalid={onInvalid} />
      ) : schema.enum ? (
        <select
          id={id}
          value={value === undefined ? '' : String(value)}
          required={required}
          onChange={(event) => onChange(event.target.value || undefined)}
        >
          <option value="">请选择{title}</option>
          {schema.enum.map((option) => (
            <option key={option} value={option}>
              {label(option)}
            </option>
          ))}
        </select>
      ) : schema.format === 'date-time' ? (
        <>
          <input
            id={id}
            type="datetime-local"
            value={localDate(value)}
            required={required && !nullable}
            disabled={value === null}
            onChange={(event) =>
              onChange(event.target.value ? new Date(event.target.value).toISOString() : undefined)
            }
          />
          {nullable && (
            <label className="inline-check">
              <input
                type="checkbox"
                checked={value === null}
                onChange={(event) => onChange(event.target.checked ? null : new Date().toISOString())}
              />
              原始发布时间未知
            </label>
          )}
          <small>按浏览器本地时区填写；研究记录以北京时间展示。</small>
        </>
      ) : long ? (
        <textarea
          id={id}
          value={typeof value === 'string' ? value : ''}
          required={required}
          rows={name === 'content' ? 9 : 3}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      ) : (
        <>
          <input
            id={id}
            type={
              name === 'password' ? 'password' : type === 'integer' || type === 'number' ? 'number' : 'text'
            }
            autoComplete={name === 'password' ? 'new-password' : 'off'}
            min={schema.minimum}
            minLength={name === 'password' ? 12 : schema.minLength}
            value={typeof value === 'string' || typeof value === 'number' ? value : ''}
            required={required}
            list={choices?.length ? `${id}-options` : undefined}
            onChange={(event) =>
              onChange(
                event.target.value === ''
                  ? undefined
                  : type === 'integer' || type === 'number'
                    ? Number(event.target.value)
                    : event.target.value,
              )
            }
          />
          {choices?.length ? (
            <>
              <datalist id={`${id}-options`}>
                {choices.map((row) => (
                  <option key={row.id} value={name === 'dimension_code' ? str(row.data.code) : row.id}>
                    {rowTitle(row)} · {label(row.status)}
                  </option>
                ))}
              </datalist>
              <small>可选择已有记录，或填写其完整 ID。</small>
            </>
          ) : null}
        </>
      )}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

const collectionQueries: [Domain, string][] = [
  ['reference', 'target'],
  ['reference', 'variable'],
  ['reference', 'dimension'],
  ['reference', 'risk_source'],
  ['reference', 'rule'],
  ['information', 'source'],
  ['information', 'information'],
  ['information', 'event'],
  ['registry', 'risk'],
  ['analysis', 'snapshot'],
  ['operations', 'task'],
  ['observations', 'indicator'],
];
const choiceMap: Record<string, string> = {
  source_id: 'source',
  information_id: 'information',
  event_id: 'event',
  risk_id: 'risk',
  observation_target_id: 'target',
  target_id: 'target',
  variable_id: 'variable',
  dimension_code: 'dimension',
  comparison_snapshot_id: 'snapshot',
  task_id: 'task',
  rule_id: 'rule',
  indicator_id: 'indicator',
};

export function CommandForm({
  intent,
  contracts,
  session,
  onClose,
}: {
  intent: CommandIntent;
  contracts: Contracts;
  session: Session;
  onClose: () => void;
}) {
  const schema = contracts[intent.name];
  const [input, setInput] = useState<Data>(() =>
    schema ? initialInput(intent.name, schema, intent.record, intent.defaults) : {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [templateError, setTemplateError] = useState<unknown>();
  const [templateLoading, setTemplateLoading] = useState(false);
  const [receipt, setReceipt] = useState<Json>();
  const key = useRef({ payload: '', id: crypto.randomUUID() });
  const cache = useQueryClient();
  const reads = useQueries({
    queries: collectionQueries.map(([domain, kind]) => ({
      queryKey: ['records', domain, kind],
      queryFn: () => get<{ items: RecordRow[] }>(`/data/${domain}/${kind}`),
      staleTime: 15_000,
      retry: false,
    })),
  });
  const lists: Record<string, RecordRow[]> = Object.fromEntries(
    collectionQueries.map(([, kind], n) => [kind, reads[n]?.data?.items ?? []]),
  );
  const mutation = useMutation({
    mutationFn: (payload: Data) => {
      const encoded = JSON.stringify(payload);
      if (key.current.payload !== encoded) key.current = { payload: encoded, id: crypto.randomUUID() };
      return execute(intent.name, payload, session.csrf, key.current.id);
    },
    onSuccess: async (result) => {
      setReceipt(result);
      setDirty(false);
      await cache.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== 'session' && query.queryKey[0] !== 'auth-status',
      });
    },
  });
  if (!schema)
    return (
      <Modal title="操作暂不可用" onClose={onClose}>
        <div className="modal-body">
          <p>未读取到该操作的服务端契约，请刷新后重试。</p>
        </div>
      </Modal>
    );
  const can = schema['x-roles']?.some((role) => session.user.roles.includes(role)) ?? false;
  const nestedFields = dataFields(intent.name, str(input.kind, ''), str(asData(input.data).category, ''));
  const fixedKind = intent.name === 'reference.save' && Boolean(intent.record || intent.defaults?.kind);
  const title = intent.title ?? schema.title ?? intent.name;
  const set = (field: string, value: Json | undefined, nested = false) => {
    setDirty(true);
    setReceipt(undefined);
    mutation.reset();
    const changingRuleCategory = nested && input.kind === 'rule' && field === 'category';
    if (changingRuleCategory || (!nested && field === 'kind')) setErrors({});
    setInput((previous) => {
      const target = nested ? { ...asData(previous.data) } : { ...previous };
      if (value === undefined) delete target[field];
      else target[field] = value;
      if (changingRuleCategory) {
        for (const key of ['weights', 'levels', 'confirmation_criteria', 'calibration_evidence', 'max_hours'])
          delete target[key];
      }
      if (!nested && field === 'kind') target.data = {};
      return nested ? { ...previous, data: target } : target;
    });
  };
  const field = (name: string, definition: Schema, required: boolean, nested = false) => {
    const code = `${nested ? 'data.' : ''}${name}`;
    return (
      <Field
        key={code}
        name={name}
        schema={{
          ...definition,
          enum: definition.enum ?? (!nested ? enumFor(intent.name, name) : undefined),
        }}
        value={nested ? asData(input.data)[name] : input[name]}
        required={required}
        onChange={(value) => set(name, value, nested)}
        choices={lists[choiceMap[name] ?? '']}
        error={errors[code]}
        onInvalid={(message) => setErrors((previous) => ({ ...previous, [code]: message }))}
        sample={
          definition.type === 'object' || definition.type === 'array'
            ? sampleFor(intent.name, name, lists)
            : undefined
        }
      />
    );
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mutation.isPending || Object.values(errors).some(Boolean) || templateLoading || !can) return;
    mutation.mutate(input);
  };
  const loadTemplate = async () => {
    setTemplateError(undefined);
    setTemplateLoading(true);
    try {
      const result = await get<{ data: Data }>(
        `/tasks/${encodeURIComponent(str(input.task_id, ''))}/template`,
      );
      set('data', result.data);
    } catch (error) {
      setTemplateError(error);
    } finally {
      setTemplateLoading(false);
    }
  };
  const formal = /approve|admit|publish|withdraw|tracking|disable|source_status/.test(intent.name);
  return (
    <Modal title={title} eyebrow="RESEARCH ACTION / 业务操作" onClose={onClose} wide dirty={dirty}>
      <form onSubmit={submit}>
        <div className="modal-body">
          {intent.record && (
            <div className="operation-context">
              <span>操作对象</span>
              <strong>{rowTitle(intent.record)}</strong>
              <code>
                v{intent.record.version} · {intent.record.id.slice(0, 8)}
              </code>
            </div>
          )}
          {fixedKind && !intent.record && (
            <div className="operation-context">
              <span>创建类型</span>
              <strong>{label(str(input.kind))}</strong>
              <span>保存后进入草稿，核验后批准</span>
            </div>
          )}
          {formal && (
            <div className="notice">
              <ShieldCheck size={18} />
              <p>本操作将改变正式业务状态。请核对对象、版本和依据，并填写可追溯的操作理由。</p>
            </div>
          )}
          {!can && <p className="error-panel">当前账号没有此操作权限。</p>}
          {receipt !== undefined ? (
            <div className="receipt">
              <CheckCircle2 size={35} />
              <h3>操作已保存</h3>
              <p>受理不等于分析完成或正式批准。请在对应记录中继续查看处理状态。</p>
              <JsonBlock value={receipt} title="查看服务端回执与记录 ID" />
            </div>
          ) : (
            <fieldset className="command-fieldset" disabled={templateLoading || mutation.isPending}>
              <div className="form-grid">
                {Object.entries(schema.properties ?? {})
                  .filter(
                    ([name]) =>
                      name !== 'data' &&
                      !(fixedKind && name === 'kind') &&
                      !(
                        (intent.record || intent.name === 'reference.save') &&
                        ['id', 'expected_version'].includes(name)
                      ),
                  )
                  .map(([name, definition]) =>
                    field(name, definition, schema.required?.includes(name) ?? false),
                  )}
              </div>
              {schema.properties?.data && (
                <section className="form-section">
                  <div className="section-title">
                    <h3>{nestedFields ? '业务内容' : '结构化研究内容'}</h3>
                    {intent.name === 'analysis.draft' && (
                      <button
                        type="button"
                        className="button secondary small"
                        disabled={!input.task_id || templateLoading}
                        onClick={() => void loadTemplate()}
                      >
                        {templateLoading ? (
                          <LoaderCircle size={14} className="spin" />
                        ) : (
                          <FileDown size={14} />
                        )}
                        加载本轮分析模板
                      </button>
                    )}
                  </div>
                  {nestedFields ? (
                    <div className="form-grid">
                      {Object.entries(nestedFields.properties).map(([name, definition]) =>
                        field(name, definition, nestedFields.required.includes(name), true),
                      )}
                    </div>
                  ) : (
                    field('data', schema.properties.data, schema.required?.includes('data') ?? false)
                  )}
                  {intent.name === 'analysis.draft' && (
                    <p className="field-hint">
                      先载入任务的实际变量、比较基准和阶段结构。完成研究后逐项标记阶段；保留待判断不等于省略分析。
                    </p>
                  )}
                </section>
              )}
              {templateError !== undefined && <ErrorPanel error={templateError} />}
              {mutation.error && <ErrorPanel error={mutation.error} />}
            </fieldset>
          )}
        </div>
        <div className="modal-footer">
          <span className="muted">
            <ShieldCheck size={14} />
            权限和版本由服务端校验
          </span>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              if (!dirty || window.confirm('尚未保存，确定关闭吗？')) onClose();
            }}
          >
            {receipt !== undefined ? '完成' : '取消'}
          </button>
          {receipt === undefined && (
            <button
              type="submit"
              className="button primary"
              disabled={!can || templateLoading || mutation.isPending || Object.values(errors).some(Boolean)}
            >
              {mutation.isPending ? <LoaderCircle size={15} className="spin" /> : <ArrowRight size={15} />}
              {mutation.isPending ? '正在提交…' : title}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
