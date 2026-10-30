export function codeReviewRequirement(config,files){
 if(config?.schemaVersion!==1||config.contributorLevel!==2||config.defaultReviewerLevel!==4||config.sensitiveReviewerLevel!==5||config.directMergeAllowed!==false||!Array.isArray(config.sensitivePrefixes)||!config.sensitivePrefixes.length)throw new Error('Invalid code governance configuration');
 if(!Array.isArray(files)||!files.length||files.some(file=>typeof file!=='string'||!file.trim()||file.startsWith('/')||file.includes('..')))throw new Error('Changed repository files are required');
 const sensitive=files.filter(file=>config.sensitivePrefixes.some(prefix=>file.startsWith(prefix)));
 return Object.freeze({contributorLevel:2,directMergeAllowed:false,minimumReviewerLevel:sensitive.length?5:4,sensitive:Object.freeze(sensitive),requiresFounderApproval:sensitive.length>0});
}
