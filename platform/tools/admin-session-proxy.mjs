const AUTH_METHODS={login:'POST',logout:'POST',session:'GET'};
const send=(response,status,payload,headers={})=>{response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff',...headers});response.end(JSON.stringify(payload));};
export async function handleAdminSessionProxy(request,response,{pathname,surface,production,apiOrigin,fetchImpl=fetch}){
 if(!pathname.startsWith('/admin/auth/'))return false;
 const action=pathname.slice('/admin/auth/'.length);
 if(surface!=='admin'||!AUTH_METHODS[action]){send(response,404,{error:{code:'route_not_found'}});return true;}
 if(request.method!==AUTH_METHODS[action]){send(response,405,{error:{code:'method_not_allowed'}});return true;}
 const origin=apiOrigin||(!production?'http://127.0.0.1:4200':null);
 if(!origin){send(response,503,{error:{code:'admin_api_unavailable'}});return true;}
 if(request.headers['sec-fetch-site']==='cross-site'){send(response,403,{error:{code:'forbidden'}});return true;}
 try{
  const target=new URL(origin);if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw new Error('invalid origin');
  const headers={cookie:request.headers.cookie||''};let body;
  if(request.method==='POST'){
   if(!/^application\/json(?:;|$)/i.test(request.headers['content-type']||'')){send(response,415,{error:{code:'invalid_content_type'}});return true;}
   let bytes=0;const chunks=[];for await(const chunk of request){bytes+=Buffer.byteLength(chunk);if(bytes>16384){send(response,413,{error:{code:'body_too_large'}});return true;}chunks.push(chunk);}
   body=Buffer.concat(chunks.map(c=>Buffer.from(c))).toString('utf8');JSON.parse(body);headers['content-type']='application/json';
  }
  const upstream=await fetchImpl(new URL('/v1/auth/'+action,target),{method:request.method,headers,body,redirect:'error',signal:AbortSignal.timeout(10000)});
  const payload=await upstream.json();const cookies=upstream.headers.getSetCookie();
  send(response,upstream.status,payload,cookies.length?{'set-cookie':cookies}:{});
 }catch{send(response,503,{error:{code:'admin_api_unavailable',message:'Não foi possível acessar a autenticação administrativa.'}});}
 return true;
}
