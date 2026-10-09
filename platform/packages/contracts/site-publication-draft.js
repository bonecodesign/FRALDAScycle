const draftKey='fc.sitePublishDraft';
const fields=['type','category','title','brand','model','size','quantity','condition','openPackageAttested','price','delivery','location','expiry','institutionId','institutionName'];
export function readSitePublicationDraft(storage){
  try{
    const value=JSON.parse(storage.getItem(draftKey));
    if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1)return null;
    const data={};
    for(const field of fields){const item=value.data?.[field];if(field==='openPackageAttested'?typeof item==='boolean':typeof item==='string'||['institutionId','institutionName'].includes(field)&&item===null)data[field]=item}
    const mediaKey=typeof value.mediaKey==='string'&&/^listings\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._/-]+$/.test(value.mediaKey)&&!value.mediaKey.includes('..')?value.mediaKey:null;
    const step=Number.isInteger(value.step)&&value.step>=1&&value.step<=8?value.step:1;
    return {data,mediaKey,step};
  }catch{return null}
}
export function saveSitePublicationDraft(storage,{data,mediaKey=null,step=1}){
  const saved={};for(const field of fields)if(Object.hasOwn(data,field))saved[field]=data[field];
  storage.setItem(draftKey,JSON.stringify({version:1,data:saved,mediaKey,step}));
}
export function clearSitePublicationDraft(storage){storage.removeItem(draftKey)}
