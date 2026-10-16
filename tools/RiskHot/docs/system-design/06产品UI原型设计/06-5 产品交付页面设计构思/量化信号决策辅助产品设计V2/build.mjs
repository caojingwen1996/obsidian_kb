import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=path.dirname(fileURLToPath(import.meta.url));
const css=readFileSync(path.join(dir,'signal.css'),'utf8');
const js=readFileSync(path.join(dir,'signal.js'),'utf8');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>量化信号决策辅助产品设计 · RiskHot</title><style>${css}</style></head><body><a class="skip" href="#main">跳到主要内容</a><header class="topbar"><div class="topinner"><a class="brand" href="#overview">Risk<span>Hot</span></a><nav aria-label="主导航"><a data-nav="overview" href="#overview">风险速览</a><a data-nav="reports" href="#reports/week">观察报告</a></nav><span class="demo">虚构演示 · 非实时监测</span></div></header><main id="main" class="wrap" tabindex="-1"></main><div id="announcement" role="status" aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)"></div><noscript><p>此交互原型需要启用 JavaScript 才能展示信号。请在浏览器中启用后重新打开。</p></noscript><script>${js}</script></body></html>`;
writeFileSync(path.join(dir,'../量化信号决策辅助产品设计V2.html'),html,'utf8');
console.log('已生成独立离线 HTML');
