import {randomUUID} from 'node:crypto';
import {recommendWithGemini} from './gemini-recommendation.js';

const MODELS=new Set(['gemini-3.5-flash','gemini-3.6-flash','gemini-3.7-flash']);
// Warm instances retry failed finish records before making a new reservation.
// Apps Script's ten-minute lease releases reservations after a cold restart.
const pending=new Map();
const poolError=()=>Object.assign(new Error('공유 키 풀에 연결하지 못했습니다. 기본 후보를 유지합니다.'),{status:503});
export function poolConfiguration(env) {
 let url;try{url=new URL(env.GEMINI_POOL_URL);}catch{throw poolError();}
 if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)||url.search||url.hash||url.username||url.password||!env.GEMINI_POOL_TOKEN?.trim()||!env.GEMINI_POOL_USER?.trim())throw poolError();
 const raw=env.GEMINI_API_KEYS?.trim()||'';
 if(!raw.startsWith('{')||!raw.endsWith('}'))throw poolError();
 const keys=new Map();
 for(const entry of raw.slice(1,-1).split(',')){
  if(!entry.trim())continue;
  const separator=entry.indexOf(':'),label=entry.slice(0,separator).trim(),key=entry.slice(separator+1).trim();
  if(separator<1||!/^[^{}:,\s]+$/.test(label)||!key||keys.has(label))throw poolError();
  keys.set(label,key);
 }
 const models=(env.GEMINI_MODELS||'gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash').split(',').map(v=>v.trim());
 if(!keys.size||!models.length||models.some(model=>!MODELS.has(model))||new Set(models).size!==models.length)throw poolError();
 return {url:url.href,token:env.GEMINI_POOL_TOKEN.trim(),user:env.GEMINI_POOL_USER.trim(),keys,models};
}
export function isGeminiConfigured(env) {
 if(env.GEMINI_POOL_MODE==='sheets'){try{poolConfiguration(env);return true;}catch{return false;}}
 return (!env.GEMINI_POOL_MODE||env.GEMINI_POOL_MODE==='single')&&Boolean(env.GEMINI_API_KEY?.trim());
}
async function postPool(config,action,payload,fetchImpl,signal,timeoutMs) {
 // Re-send the same request ID: acquire and finish are idempotent in Apps Script.
 for(let attempt=0;attempt<2;attempt++){
  if(signal?.aborted)throw poolError();
  try{
   const response=await fetchImpl(config.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token:config.token,user:config.user,...payload}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs)});
   if(!response.ok)throw poolError();
   const result=await response.json();
   if(result?.ok!==true)throw poolError();
   return result;
  }catch{if(attempt===1||signal?.aborted)throw poolError();}
 }
}
export async function recommendWithConfiguredGemini(body,{config=process.env,fetchImpl=fetch,signal,recommend=recommendWithGemini,poolTimeoutMs=15000}={}) {
 if(config.GEMINI_POOL_MODE!=='sheets'){
  if(config.GEMINI_POOL_MODE&&config.GEMINI_POOL_MODE!=='single')throw poolError();
  return recommend(body,{apiKey:config.GEMINI_API_KEY,model:config.GEMINI_MODEL||undefined,fetchImpl,signal});
 }
 const pool=poolConfiguration(config),scope=`${pool.url}|${pool.user}`;
 signal=signal?AbortSignal.any([signal,AbortSignal.timeout(70000)]):AbortSignal.timeout(70000);
 const post=(action,payload,requestSignal)=>postPool(pool,action,payload,fetchImpl,requestSignal,poolTimeoutMs);
 for(const [id,record] of pending){
  if(record.scope!==scope)continue;
  await post('finish',record.payload,signal);pending.delete(id);
 }
 const excluded=new Set();
 for(let attempt=0;attempt<3;attempt++){
  const candidates=[...pool.keys.keys()].flatMap(key_label=>pool.models.map(model=>({key_label,model}))).filter(c=>!excluded.has(`${c.key_label}|${c.model}`));
  const request_id=randomUUID(),result=await post('acquire',{request_id,candidates},signal),selected=result.selected;
  if(!selected)throw Object.assign(new Error('공유 키 풀에 사용 가능한 키가 없습니다. 잠시 후 다시 시도해주세요.'),{status:429});
  if(!candidates.some(c=>c.key_label===selected.key_label&&c.model===selected.model)||!new RegExp(`^${request_id}:[0-9]+$`).test(selected.request_id))throw poolError();
  let outcome,usage,error;
  try{
   outcome=await recommend(body,{apiKey:pool.keys.get(selected.key_label),model:selected.model,fetchImpl,signal,onUsage:value=>{usage=value;}});
  }catch(cause){error=cause;}
  const count=name=>Number.isInteger(usage?.[name])&&usage[name]>=0?usage[name]:null;
  const payload={request_id:selected.request_id,status:usage?'성공':error?.code?'실패':'결과 미확인',error_code:error?.code||null,input_tokens:count('promptTokenCount'),output_tokens:count('candidatesTokenCount'),total_tokens:count('totalTokenCount')};
  if(error?.code===429||error?.code===503){payload.limit=error.dailyQuota?'일일':'일시';payload.retry_seconds=error.retrySeconds||60;}
  pending.set(selected.request_id,{scope,payload});
  // Finish survives browser cancellation; no course data or secrets enter the log.
  await post('finish',payload);pending.delete(selected.request_id);
  if(!error)return outcome;
  if(![429,503].includes(error.code)||signal?.aborted||attempt===2)throw error;
  if(error.code===503)for(const label of pool.keys.keys())excluded.add(`${label}|${selected.model}`);
  else excluded.add(`${selected.key_label}|${selected.model}`);
 }
}
