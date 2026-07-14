const chart = echarts.init(document.getElementById('index-chart'), null, {
  renderer: 'svg',
});
const statusNode = document.getElementById('status');
const errorPanel = document.getElementById('error-panel');
const errorMessage = document.getElementById('error-message');
const retryButton = document.getElementById('retry-button');
const accessibleList = document.getElementById('risk-point-list');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function riskSize(value) {
  return Math.max(10, Math.min(28, 8 + Math.sqrt(value[2]) * 5));
}

function chartOption(payload) {
  const visibleRange = {
    startValue: payload.range.start,
    endValue: payload.status.as_of,
  };
  return {
    backgroundColor: 'transparent',
    animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    grid: { left: 66, right: 30, top: 28, bottom: 76 },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#090b0d',
      borderColor: '#e6e8eb',
      textStyle: { color: '#f4f6f8' },
      formatter(params) {
        if (params.seriesName === '风险提示') {
          const value = params.value;
          const reason = escapeHtml(value[4] || '未填写').replaceAll(
            '\n',
            '<br>',
          );
          return [
            `风险日期：${escapeHtml(value[3])}`,
            `当日累计次数：${escapeHtml(value[2])}`,
            `风险原因：${reason}`,
            `对齐行情日：${escapeHtml(value[0])}`,
            `上证收盘：${escapeHtml(value[1])}`,
          ].join('<br>');
        }
        return `${escapeHtml(params.value[0])}<br>上证收盘：${escapeHtml(params.value[1])}`;
      },
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#87909c' } },
      axisLabel: { color: '#c6cbd2' },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      name: '收盘点位',
      nameTextStyle: { color: '#87909c' },
      axisLabel: { color: '#c6cbd2' },
      splitLine: { lineStyle: { color: '#343a40', type: 'dashed' } },
    },
    dataZoom: [
      { type: 'inside', filterMode: 'filter', ...visibleRange },
      {
        type: 'slider',
        bottom: 20,
        height: 18,
        filterMode: 'filter',
        borderColor: '#87909c',
        textStyle: { color: '#c6cbd2' },
        ...visibleRange,
      },
    ],
    series: [
      {
        name: '上证指数',
        type: 'line',
        showSymbol: false,
        sampling: 'lttb',
        data: payload.index_series.map((row) => [row.date, row.close]),
        lineStyle: { width: 1.2, color: '#8792a3' },
        itemStyle: { color: '#8792a3' },
      },
      {
        name: '风险提示',
        type: 'scatter',
        z: 5,
        data: payload.risk_points.map((point) => [
          point.market_date,
          point.close,
          point.count,
          point.risk_date,
          point.reason,
        ]),
        symbolSize: riskSize,
        itemStyle: {
          color: '#ff2028',
          borderColor: '#ffd4d6',
          borderWidth: 1,
        },
      },
    ],
  };
}

function buildAccessibleRiskList(points) {
  accessibleList.replaceChildren();
  points.forEach((point, dataIndex) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${point.risk_date}，累计 ${point.count} 次，${point.reason || '未填写原因'}`;
    button.addEventListener('focus', () => {
      chart.dispatchAction({ type: 'showTip', seriesIndex: 1, dataIndex });
    });
    button.addEventListener('blur', () => {
      chart.dispatchAction({ type: 'hideTip' });
    });
    accessibleList.appendChild(button);
  });
}

function showError(error) {
  const details = Array.isArray(error.details)
    ? error.details.map((item) => {
        if (item.row && item.column) {
          return `第 ${item.row} 行 / ${item.column}：${String(item.value ?? '')}`;
        }
        if (Array.isArray(item.errors)) {
          return item.errors.join('；');
        }
        return JSON.stringify(item);
      })
    : [];
  errorMessage.textContent = [error.message || '数据加载失败', ...details].join(
    '\n',
  );
  errorPanel.hidden = false;
  chart.clear();
  statusNode.textContent = '';
}

async function loadDashboard() {
  errorPanel.hidden = true;
  statusNode.textContent = '正在读取 Excel 并更新上证指数…';
  try {
    const response = await fetch('/api/dashboard', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) {
      throw (
        payload.error || {
          message: `请求失败：HTTP ${response.status}`,
          details: [],
        }
      );
    }
    chart.setOption(chartOption(payload), true);
    buildAccessibleRiskList(payload.risk_points);
    const sourceLabel =
      payload.status.market_source === 'live' ? '实时数据' : '缓存数据';
    const warningText = payload.status.warnings.length
      ? ` · ${payload.status.warnings.join('；')}`
      : '';
    statusNode.textContent = `${sourceLabel} · 行情截至 ${payload.status.as_of} · 更新于 ${payload.status.updated_at}${warningText}`;
  } catch (error) {
    showError(error);
  }
}

retryButton.addEventListener('click', loadDashboard);
window.addEventListener('resize', () => chart.resize());
loadDashboard();
