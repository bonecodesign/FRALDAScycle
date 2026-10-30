const HTTPS=/^https:\/\/[^\s]{1,500}$/;
const ORIGINS=new Set(['fixed_config','manual','discovered']);
export function classifyManufacturerSource(input){
  const sourceUrl=String(input?.sourceUrl??'').trim(),origin=String(input?.origin??'');
  if(!HTTPS.test(sourceUrl)||!ORIGINS.has(origin))throw Object.assign(new Error('invalid_manufacturer_source'),{code:'invalid_manufacturer_source'});
  const approved=input?.approved===true,reviewStatus=String(input?.reviewStatus??'pending');
  if(!['pending','approved','rejected'].includes(reviewStatus))throw Object.assign(new Error('invalid_manufacturer_source'),{code:'invalid_manufacturer_source'});
  if(origin==='discovered'&&approved)throw Object.assign(new Error('discovered_source_requires_review'),{code:'discovered_source_requires_review'});
  return Object.freeze({sourceUrl,origin,approved:approved&&reviewStatus==='approved',reviewStatus});
}
