import { readFile } from 'node:fs/promises';
import { buildArchitectureGraph, PROJECT_ROOT, SNAPSHOT_PATH } from '../../tools/architecture-network.mjs';

export function createArchitectureService({mode=process.env.NODE_ENV==='production'?'snapshot':'repository',root=PROJECT_ROOT,snapshot=SNAPSHOT_PATH}={}) {
 let previous=null;
 return {async graph(){
  const graph=mode==='repository'?await buildArchitectureGraph(root):JSON.parse(await readFile(snapshot,'utf8'));
  if(previous?.metadata.revision===graph.metadata.revision)return previous;
  graph.metadata.mode=mode;previous=graph;return graph;
 }};
}
