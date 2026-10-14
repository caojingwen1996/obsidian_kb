import type { ReactNode } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { ArrowUpRight, ChevronRight, Info } from 'lucide-react';
import type { Collection, ManagementDefinition } from './management';

export function ManagementPage({
  section,
  definition,
  renderAction,
  renderCollection,
}: {
  section: string;
  definition: ManagementDefinition;
  renderAction: (collection: Collection) => ReactNode;
  renderCollection: (collection: Collection) => ReactNode;
}) {
  const { view } = useSearch({ strict: false }) as { view?: string };
  const selected = definition.collections.find((item) => item.kind === view) ?? definition.collections[0]!;
  const groups = [...new Set(definition.collections.map((item) => item.group))];
  return (
    <div className={`management-page management-${section}`}>
      <header className="management-heading">
        <div>
          <span className="eyebrow">{definition.eyebrow}</span>
          <h1>{definition.title}</h1>
          <p>{definition.description}</p>
        </div>
        <div className="management-question">{definition.question}</div>
      </header>
      <nav className="management-switcher" aria-label="管理工作区">
        {[
          ['config', '配置中心', '分类与接入'],
          ['strategies', '策略中心', '评估与分析'],
          ['reference', '基础资料', '对象与指标'],
          ['data', '数据管理', '实际观测值'],
        ].map(([key, title, caption]) => (
          <Link key={key} to={`/${key}`} search={{}} aria-current={section === key ? 'page' : undefined}>
            <strong>{title}</strong>
            <span>{caption}</span>
            <ArrowUpRight size={14} />
          </Link>
        ))}
      </nav>
      <div className="management-layout">
        <nav className="management-catalog" aria-label={`${definition.title}目录`}>
          {groups.map((group) => (
            <div className="management-group" key={group}>
              <h2>{group}</h2>
              <div>
                {definition.collections
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <Link
                      key={item.kind}
                      to={`/${section}`}
                      search={{ view: item.kind }}
                      aria-current={selected.kind === item.kind ? 'page' : undefined}
                    >
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.summary}</small>
                      </span>
                      <ChevronRight size={15} />
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </nav>
        <section className="management-workspace" aria-label={`${selected.title}工作区`}>
          <div className="management-section-heading">
            <div>
              <span className="eyebrow">{selected.group}</span>
              <h2>{selected.title}</h2>
              <p>{selected.description}</p>
            </div>
            {renderAction(selected)}
          </div>
          {renderCollection(selected)}
          <p className="management-note">
            <Info size={16} />
            <span>{definition.note}</span>
          </p>
        </section>
      </div>
    </div>
  );
}
