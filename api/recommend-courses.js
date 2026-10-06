import {recommendWithConfiguredGemini,isGeminiConfigured} from '../server/gemini-key-pool.js';
import {validateRecommendationInput} from '../src/lib/course-recommendation.js';

const MAX_BYTES=16000,requests=new Map();
let active=0;
export function createRecommendationHandler({env=()=>process.env,recommend=recommendWithConfiguredGemini,now=Date.now}={}) {
 return async function handler(req,res) {
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  const send=(status,body)=>{if(!res.destroyed){res.statusCode=status;res.end(JSON.stringify(body));}};
  if(req.method!=='POST'){res.setHeader('Allow','POST');send(405,{error:'POST 요청만 사용할 수 있습니다.'});return;}
  if(req.headers.origin){
   let host;try{host=new URL(req.headers.origin).host;}catch{send(403,{error:'허용되지 않은 요청입니다.'});return;}
   if(host!==req.headers.host){send(403,{error:'허용되지 않은 요청입니다.'});return;}
  }
  if(!req.headers['content-type']?.startsWith('application/json')){send(415,{error:'JSON 요청이 필요합니다.'});return;}
  if(Number(req.headers['content-length'])>MAX_BYTES){send(413,{error:'요청 내용이 너무 큽니다.'});return;}
  let input;
  try{
   let body=req.body;
   if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk.toString('utf8');if(Buffer.byteLength(raw)>MAX_BYTES){send(413,{error:'요청 내용이 너무 큽니다.'});return;}}body=JSON.parse(raw);}
   else {if(Buffer.byteLength(typeof body==='string'?body:JSON.stringify(body))>MAX_BYTES){send(413,{error:'요청 내용이 너무 큽니다.'});return;}if(typeof body==='string')body=JSON.parse(body);}
   input=validateRecommendationInput(body);
  }catch{send(400,{error:'코스 후보와 연습 조건을 확인해주세요.'});return;}
  const config=env();
  if(!isGeminiConfigured(config)){send(503,{code:'AI_NOT_CONFIGURED',error:'AI 추천이 아직 연결되지 않았습니다. 기본 후보를 이용해주세요.'});return;}
  // Best-effort per-instance limits; production-wide quotas belong to the host.
  const time=now();for(const [key,item] of requests)if(time-item.start>=60000)requests.delete(key);
  const ip=req.socket?.remoteAddress||'unknown',item=requests.get(ip)||{start:time,count:0};
  if(item.count>=10||active>=4||requests.size>=2000&&!requests.has(ip)){res.setHeader('Retry-After','60');send(429,{error:'추천 요청이 많습니다. 잠시 후 다시 시도해주세요.'});return;}
  item.count++;requests.set(ip,item);active++;
  const controller=new AbortController(),cancel=()=>controller.abort();res.on('close',cancel);
  try{send(200,await recommend(input,{config,apiKey:config.GEMINI_API_KEY,model:config.GEMINI_MODEL||undefined,signal:controller.signal}));}
  catch(error){send(error.status||502,{error:error.status?error.message:'AI 추천을 완료하지 못했습니다. 기본 후보를 유지합니다.'});}
  finally{active--;res.off('close',cancel);}
 };
}
export default createRecommendationHandler();
