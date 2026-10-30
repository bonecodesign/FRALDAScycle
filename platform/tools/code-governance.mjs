import {readFile} from 'node:fs/promises';
import {isMainModule} from '../packages/contracts/main-module.js';
import {codeReviewRequirement} from '../packages/contracts/code-governance.js';
export async function loadCodeGovernance(){return JSON.parse(await readFile(new URL('../config/code-governance.v1.json',import.meta.url),'utf8'));}
if(isMainModule(import.meta.url)){
 const files=process.argv.slice(2);const result=codeReviewRequirement(await loadCodeGovernance(),files.length?files:['platform/docs/repository-access-governance.md']);console.log(JSON.stringify(result,null,2));
}
