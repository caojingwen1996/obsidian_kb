import graph from './pipeline-data.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

export const state = {
  view: 'panorama', selected: '', version: '', node: '', nodeConfig: false,
  nodeRoutingKey: '', nodeTaskKey: '', nodeTaskTab: 'definition', taskTab: 'definition',
  panoramaLayer: 'L0', panoramaLayersCollapsed: [],
  panoramaCollapsed: graph.system.stages.flatMap(stage => stage.modules?.map(module => module.code) ?? []),
  checks: null,
};
