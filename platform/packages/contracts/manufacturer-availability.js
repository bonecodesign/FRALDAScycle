const URL_PATTERN=/^https:\/\/[^\s]{1,500}$/;
const STATES=new Set(['available','unavailable','unknown']);
export function normalizeManufacturerAvailability(input){
  const sourceUrl=String(input?.sourceUrl??'').trim(),productKey=String(input?.productKey??'').trim(),state=String(input?.state??'');
  if(!URL_PATTERN.test(sourceUrl)||!/^[A-Za-z0-9._-]{3,80}$/.test(productKey)||!STATES.has(state))throw Object.assign(new Error('invalid_manufacturer_availability'),{code:'invalid_manufacturer_availability'});
  const checkedAt=new Date(input?.checkedAt??'');if(!Number.isFinite(checkedAt.getTime()))throw Object.assign(new Error('invalid_manufacturer_availability'),{code:'invalid_manufacturer_availability'});
  return Object.freeze({sourceUrl,productKey,state,checkedAt:checkedAt.toISOString(),compatibilityAuthority:'manufacturer_catalog'});
}
