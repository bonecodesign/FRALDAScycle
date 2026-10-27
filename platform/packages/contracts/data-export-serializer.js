const FORBIDDEN_KEY=/(?:password|password_hash|token|secret|cvv|card_number|cpf_fingerprint|provider_reference|antifraud)/i;

function safe(value,path='root'){
  if(value==null||typeof value==='string'||typeof value==='number'||typeof value==='boolean')return value;
  if(value instanceof Date)return value.toISOString();
  if(Array.isArray(value))return value.map((item,index)=>safe(item,`${path}[${index}]`));
  if(typeof value!=='object')throw new Error(`Unsupported export value at ${path}`);
  const result={};for(const[key,item]of Object.entries(value)){if(FORBIDDEN_KEY.test(key))throw new Error(`Forbidden export field at ${path}.${key}`);result[key]=safe(item,`${path}.${key}`);}return result;
}

function cell(value){if(value==null)return'';const text=typeof value==='object'?JSON.stringify(value):String(value);return`"${text.replaceAll('"','""')}"`;}
function flatten(value,path='root',rows=[]){if(Array.isArray(value)){value.forEach((item,index)=>flatten(item,`${path}[${index}]`,rows));return rows;}if(value&&typeof value==='object'){Object.entries(value).forEach(([key,item])=>flatten(item,`${path}.${key}`,rows));return rows;}rows.push([path,value]);return rows;}

export function serializeDataExport(snapshot,format){const sanitized=safe(snapshot);if(format==='json')return Buffer.from(JSON.stringify(sanitized,null,2),'utf8');if(format==='csv'){const lines=['campo,valor',...flatten(sanitized).map(([path,value])=>`${cell(path)},${cell(value)}`)];return Buffer.from(lines.join('\r\n')+'\r\n','utf8');}throw new Error('Unsupported export format');}
