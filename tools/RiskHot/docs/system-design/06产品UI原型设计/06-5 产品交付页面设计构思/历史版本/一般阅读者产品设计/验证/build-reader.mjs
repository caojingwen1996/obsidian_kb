import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const folder=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const entry=path.join(folder,'RiskHot_产品层交互原型.html');
const [html,css,data,js]=await Promise.all([
  readFile(entry,'utf8'),
  readFile(path.join(folder,'原型资源/reader.css'),'utf8'),
  readFile(path.join(folder,'原型资源/演示数据.js'),'utf8'),
  readFile(path.join(folder,'原型资源/reader.js'),'utf8')
]);
const scripts=[data,js];
let index=0;
const next=html.replace(/<style>[\s\S]*?<\/style>/,()=>`<style>\n${css}\n</style>`)
  .replace(/<script>[\s\S]*?<\/script>/g,()=>`<script>\n${scripts[index++].replace(/<\/script/gi,'<\\/script')}\n</script>`);
if(index!==2) throw new Error('原型入口应有两个内嵌脚本，未覆盖文件。');
await writeFile(entry,next,'utf8');
console.log('独立 HTML 已与原型资源同步。');
