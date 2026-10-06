import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {createRecommendationHandler} from '../api/recommend-courses.js';
import {poolConfiguration,isGeminiConfigured,recommendWithConfiguredGemini} from '../server/gemini-key-pool.js';
const config={GEMINI_POOL_MODE:'sheets',GEMINI_POOL_URL:'https://script.google.com/macros/s/test/exec',GEMINI_POOL_TOKEN:'secret-token',GEMINI_POOL_USER:'test-driving',GEMINI_API_KEYS:'{acct1:secret-key1,acct2:secret-key2}',GEMINI_MODELS:'gemini-3.5-flash,gemini-3.7-flash'};
assert.equal(poolConfiguration(config).keys.size,2);
assert.equal(isGeminiConfigured(config),true);
assert.equal(isGeminiConfigured({...config,GEMINI_POOL_TOKEN:''}),false);
assert.throws(()=>poolConfiguration({...config,GEMINI_MODELS:'gemini-3.8-flash'}));
assert.throws(()=>poolConfiguration({...config,GEMINI_POOL_URL:'https://example.com/exec'}));
assert.throws(()=>poolConfiguration({...config,GEMINI_API_KEYS:'{a:x,a:y}'}));
let calls=[],failAcquire=false,failFinish=false,empty=false,invalid=false;
const fetchImpl=async(_,options)=>{
 const payload=JSON.parse(options.body);calls.push(payload);
 if(payload.action==='acquire'){
  if(failAcquire){failAcquire=false;throw new Error('response lost');}
  if(empty)return Response.json({ok:true,selected:null,terminal:true});
  const choice=payload.candidates.at(-1);
  return Response.json({ok:true,selected:{...choice,key_label:invalid?'unoffered':choice.key_label,request_id:payload.request_id+':1'}});
 }
 if(failFinish)throw new Error('finish lost');
 return Response.json({ok:true});
};
let geminiCalls=0;
const recommend=async(_,options)=>{
 geminiCalls++;assert(options.apiKey.startsWith('secret-key'));assert(!options.apiKey.includes('token'));
 options.onUsage({promptTokenCount:10,candidatesTokenCount:3,totalTokenCount:13});
 return {source:'gemini',model:options.model};
};
failAcquire=true;
const result=await recommendWithConfiguredGemini({}, {config,fetchImpl,recommend});
assert.equal(result.model,'gemini-3.7-flash');assert.equal(geminiCalls,1);
assert.equal(calls[0].request_id,calls[1].request_id);
assert.equal(calls.at(-1).status,'성공');assert.equal(calls.at(-1).total_tokens,13);
assert(!JSON.stringify(calls.map(({token,...p})=>p)).includes('secret-key'));
calls=[];let attempts=0;
await recommendWithConfiguredGemini({}, {config,fetchImpl,recommend:async(_,options)=>{
 if(!attempts++)throw Object.assign(new Error('quota'),{status:429,code:429,dailyQuota:true});
 return recommend({},options);
}});
assert.equal(attempts,2);assert.equal(calls[1].limit,'일일');assert.equal(calls[1].error_code,429);
assert.equal(calls[2].candidates.length,3);assert.notEqual(calls[0].request_id,calls[2].request_id);
calls=[];attempts=0;
await recommendWithConfiguredGemini({}, {config,fetchImpl,recommend:async(_,options)=>{
 if(!attempts++)throw Object.assign(new Error('unavailable'),{status:502,code:503});
 return recommend({},options);
}});
assert.equal(calls[1].limit,'일시');assert.equal(calls[2].candidates.length,2);
assert(calls[2].candidates.every(c=>c.model==='gemini-3.5-flash'));
calls=[];empty=true;
await assert.rejects(()=>recommendWithConfiguredGemini({}, {config,fetchImpl,recommend}),e=>e.status===429);assert.equal(calls.length,1);empty=false;
invalid=true;await assert.rejects(()=>recommendWithConfiguredGemini({}, {config,fetchImpl,recommend}),e=>e.status===503);invalid=false;
calls=[];failFinish=true;
await assert.rejects(()=>recommendWithConfiguredGemini({}, {config,fetchImpl,recommend}),e=>e.status===503);
const pendingId=calls[1].request_id;failFinish=false;calls=[];
await recommendWithConfiguredGemini({}, {config,fetchImpl,recommend});
assert.equal(calls[0].action,'finish');assert.equal(calls[0].request_id,pendingId);assert.equal(calls[1].action,'acquire');
calls=[];const cancel=new AbortController();
await assert.rejects(()=>recommendWithConfiguredGemini({}, {config,fetchImpl,signal:cancel.signal,recommend:async()=>{cancel.abort();throw new Error('cancelled');}}));
assert.equal(calls.at(-1).action,'finish');assert.equal(calls.at(-1).status,'결과 미확인');
let fallbacks=0;
await assert.rejects(()=>recommendWithConfiguredGemini({}, {config,fetchImpl:async()=>{throw new Error('secret raw');},recommend:async()=>{fallbacks++;}}),e=>e.status===503&&!e.message.includes('secret'));
assert.equal(fallbacks,0);
const missing={coverage:0,score:null,period:null};
const body={profile:{goal:'gentle',avoid:[]},range:{min:5,max:10},preferredLanes:[3],candidates:[{id:'candidate_1',distanceKm:5.5,mode:'loop',cost:6000,preferredLaneRatio:.8,narrowRoadRatio:0,turns:{straight:5,right:2,left:0,uturn:0},traffic:missing,accidents:missing}]};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>String(url).startsWith('https://script.google.com/')?fetchImpl(url,options):Response.json({usageMetadata:{promptTokenCount:10,candidatesTokenCount:3,totalTokenCount:13},candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({ranking:[{candidateId:'candidate_1',evidenceKeys:['distance']}]})}]}}]});
try{
 const req=Readable.from([]);req.method='POST';req.headers={host:'localhost','content-type':'application/json'};req.socket={remoteAddress:'pool-integration'};req.body=body;
 const res=new EventEmitter();res.setHeader=()=>{};res.end=text=>{res.body=JSON.parse(text);res.emit('close');};
 await createRecommendationHandler({env:()=>config})(req,res);
 assert.equal(res.statusCode,200);assert.equal(res.body.source,'gemini');assert.equal(res.body.recommendedCandidateId,'candidate_1');assert(!JSON.stringify(res.body).includes('secret'));
}finally{globalThis.fetch=originalFetch;}
console.log('PASS: shared pool configuration, server-only credentials, idempotent acquire, usage finish, quota switching, exhaustion, invalid selection, pending finish retry, cancellation and no fallback');
console.log('PASS: default recommendation API handler → shared pool → Gemini → validated browser response');
