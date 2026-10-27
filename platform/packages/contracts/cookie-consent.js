export const COOKIE_POLICY_VERSION='FC-CONSENT-1';
export const COOKIE_PREFERENCE_KEY='fraldacycle.cookie-preferences';
const clean=value=>Object.freeze({necessary:true,analytics:value?.analytics===true,marketing:value?.marketing===true,policyVersion:COOKIE_POLICY_VERSION});
export function parseLocalCookiePreference(raw){try{const value=JSON.parse(String(raw??''));return value?.policyVersion===COOKIE_POLICY_VERSION?clean(value):null;}catch{return null;}}
export function resolveCookiePreference({authenticated=false,account=null,local=null}={}){if(authenticated&&account?.policyVersion===COOKIE_POLICY_VERSION)return Object.freeze({...clean(account),source:'account'});const parsed=typeof local==='string'?parseLocalCookiePreference(local):local?.policyVersion===COOKIE_POLICY_VERSION?clean(local):null;return Object.freeze({...clean(parsed),source:parsed?'device':'default'});}
export function cookieCategoryAllowed(preference,category){if(category==='necessary')return true;if(!['analytics','marketing'].includes(category))return false;return preference?.[category]===true;}
