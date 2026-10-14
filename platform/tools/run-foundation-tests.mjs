import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {isMainModule} from '../packages/contracts/main-module.js';

export async function foundationTestFiles(directory=new URL('../tests/',import.meta.url)){
 const files=await readdir(directory);
 return files.filter(name=>name.endsWith('.test.mjs')&&name!=='postgres-beta.test.mjs').sort().map(name=>new URL(name,directory));
}

export async function runFoundationTests(){
 const files=await foundationTestFiles();
 const child=spawn(process.execPath,['--test','--test-concurrency=1',...files.map(url=>url.pathname)],{stdio:'inherit'});
 return new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>signal?reject(new Error(`Foundation tests interrupted by ${signal}`)):resolve(code??1));});
}

if(isMainModule(import.meta.url))process.exitCode=await runFoundationTests();
