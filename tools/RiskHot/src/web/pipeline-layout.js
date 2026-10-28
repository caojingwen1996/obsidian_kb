import {esc} from './pipeline-state.js';
let f01LayoutObserver;
export function observeF01Layout(){
 if(!globalThis.ResizeObserver)return;
 f01LayoutObserver?.disconnect();
 const diagrams=[...document.querySelectorAll('.f01-topology')];
 if(!diagrams.length)return;
 const markupByDiagram=new WeakMap();
 // Measure after wrapping and disclosure changes so arrows meet the actual endpoints.
 const draw=diagram=>{
  if(!diagram.isConnected||!diagram.getBoundingClientRect().width)return;
  const base=diagram.getBoundingClientRect(),svg=diagram.querySelector('.f01-wires');
  const box=el=>{const r=el.getBoundingClientRect();return {x:r.left-base.left,y:r.top-base.top,w:r.width,h:r.height};};
  const paths=[];
  const laneTargets=[...new Set([...diagram.querySelectorAll('.f01-direct')].map(branch=>branch.dataset.f01To))];
  const laneFor=id=>base.width-4-Math.max(0,laneTargets.indexOf(id))*8;
  const path=(d,x,y,direction,kind,key)=>{
   const tip=direction==='down'?`M${x-4},${y-5}L${x},${y}L${x+4},${y-5}`:direction==='left'?`M${x+5},${y-4}L${x},${y}L${x+5},${y+4}`:`M${x-5},${y-4}L${x},${y}L${x-5},${y+4}`;
   paths.push(`<g data-f01-line="${esc(key)}" class="${kind}"><path d="${d}"/><path class="f01-arrow" d="${tip}"/></g>`);
  };
  diagram.querySelectorAll('.f01-main-edge').forEach(edge=>{
   const [from,to]=edge.dataset.flowEdge.split(':');
   const a=box(diagram.querySelector(`[data-node="${from}"]`)),b=box(diagram.querySelector(`[data-node="${to}"]`));
   const x=a.x+a.w/2,y=b.y;
   path(`M${x},${a.y+a.h}V${y}`,x,y,'down','',edge.dataset.flowEdge);
  });
  diagram.querySelectorAll('.f01-branch').forEach(branch=>{
   const a=box(diagram.querySelector(`[data-node="${branch.dataset.f01From}"]`));
   const key=branch.dataset.f01From+':'+branch.dataset.f01To;
   if(branch.classList.contains('f01-direct')){
    const label=box(branch),target=box(diagram.querySelector(`[data-node="${branch.dataset.f01To}"]`));
    const rail=a.x+a.w+(label.x-a.x-a.w)/2,outY=label.y+label.h-4;
    // Separate bypass lanes from the shared hold lane; all terminate at real nodes.
    const lane=laneFor(branch.dataset.f01To);
    if(!diagram.querySelector(`[data-node="${branch.dataset.f01To}"]`).closest('.f01-main')){
     const x=target.x+target.w,y=target.y+target.h/2;
     path(`M${a.x+a.w},${a.y+a.h/2}H${rail}V${outY}H${lane}V${y}H${x}`,x,y,'left','',key);
    }else{
     const x=target.x+target.w/2,y=target.y;
     path(`M${a.x+a.w},${a.y+a.h/2}H${rail}V${outY}H${lane}V${y-12}H${x}V${y}`,x,y,'down','',key);
    }
   }else{
    const b=box(branch.querySelector('.f01-destination'));
    const x=b.x,y=b.y+b.h/2,rail=a.x+a.w+(b.x-a.x-a.w)/2;
    path(`M${a.x+a.w},${a.y+a.h/2}H${rail}V${y}H${x}`,x,y,'right','',key);
   }
   branch.querySelectorAll('.f01-return,.f01-continuation').forEach(edge=>{
    const [from,to]=edge.dataset.flowEdge.split(':');
    const start=box(diagram.querySelector(`[data-node="${from}"]`)),end=box(diagram.querySelector(`[data-node="${to}"]`)),label=box(edge);
    if(edge.classList.contains('f01-continuation')){
     const x=end.x+end.w/2,y=end.y,lane=laneFor(to),bottom=label.y+label.h+8;
     path(`M${start.x+start.w/2},${start.y+start.h}V${bottom}H${lane}V${y-12}H${x}V${y}`,x,y,'down','',edge.dataset.flowEdge);
     return;
    }
    const x=end.x,y=end.y+end.h/2,lane=end.x-8,bottom=label.y+label.h;
    path(`M${start.x+start.w/2},${start.y+start.h}V${bottom}H${lane}V${y}H${x}`,x,y,'right','f01-recovery-line',edge.dataset.flowEdge);
   });
  });
  const viewBox=`0 0 ${base.width} ${base.height}`,markup=paths.join('');
  if(svg.getAttribute('viewBox')!==viewBox)svg.setAttribute('viewBox',viewBox);
  if(markupByDiagram.get(diagram)!==markup){svg.innerHTML=markup;markupByDiagram.set(diagram,markup);}
 };
 f01LayoutObserver=new ResizeObserver(()=>diagrams.forEach(draw));
 diagrams.forEach(diagram=>{
  f01LayoutObserver.observe(diagram);
  diagram.querySelectorAll('.f01-step,.f01-branch,.f01-destination,.f01-main > .node').forEach(el=>f01LayoutObserver.observe(el));
  draw(diagram);
 });
}
export function disconnectLayout(){f01LayoutObserver?.disconnect();}
