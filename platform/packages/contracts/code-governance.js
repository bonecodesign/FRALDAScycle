function safePath(path){
 return typeof path==='string'&&path.length>0&&path.trim()===path&&!path.startsWith('/')&&!path.includes('\\')&&
  !/[\u0000-\u001f\u007f]/.test(path)&&path.split('/').every(segment=>segment!==''&&segment!=='.'&&segment!=='..');
}

export function codeReviewRequirement(config,files){
 if(config?.schemaVersion!==1||config.contributorLevel!==2||config.defaultReviewerLevel!==4||config.sensitiveReviewerLevel!==5||config.directMergeAllowed!==false||
   !Array.isArray(config.sensitivePrefixes)||!config.sensitivePrefixes.length||
   new Set(config.sensitivePrefixes).size!==config.sensitivePrefixes.length||
   config.sensitivePrefixes.some(prefix=>typeof prefix!=='string'||!safePath(prefix.endsWith('/')?prefix.slice(0,-1):prefix)))throw new Error('Invalid code governance configuration');
 if(!Array.isArray(files)||!files.length||files.some(file=>!safePath(file)))throw new Error('Changed repository files are required');
 // Root-level changes must never be treated as ordinary platform work. This is
 // a review classification, not authorization to modify the immutable prototype.
 const sensitive=files.filter(file=>!file.startsWith('platform/')||
   config.sensitivePrefixes.some(prefix=>file.startsWith(prefix)));
 return Object.freeze({contributorLevel:2,directMergeAllowed:false,minimumReviewerLevel:sensitive.length?5:4,sensitive:Object.freeze(sensitive),requiresFounderApproval:sensitive.length>0});
}
