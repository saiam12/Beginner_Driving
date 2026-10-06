import {validateRecommendationInput,recommendationSchema,validateRecommendationOutput,allowedEvidence} from '../src/lib/course-recommendation.js';

export const DEFAULT_GEMINI_MODEL='gemini-3.8-flash';
export const SYSTEM_INSTRUCTION=`한국의 초보운전자 연습 코스 후보를 사용자 조건에 맞게 비교한다.
제공된 후보를 모두 한 번씩 순위에 포함한다. 경로, 도로명, 거리, 데이터를 만들어내지 않는다.
선택한 연습 목표와 좌회전/유턴/좁은 도로 회피 선호를 우선하고 선호 차로 비율을 고려한다.
gentle은 짧고 회전이 적은 코스, right는 좌회전·유턴 부담이 적으면서 우회전을 연습할 수 있는 코스, junctions는 회전 경험을 포함하는 코스다.
횟수와 km당 빈도를 함께 비교한다. 차로 수만으로 쉬움이나 안전을 단정하지 않는다. cost는 기존 탐색의 보조 기준이며 사용자 적합도나 안전 점수가 아니다.
교통량·사고는 comparable 항목이 true일 때만 비교한다. null/누락은 0이나 안전을 뜻하지 않는다.
회전은 geometry 기반 추정이며 실제 회전 허용과 현장 통제는 검증되지 않았다. 안전 보장이나 실제 교통 상태를 추측하지 않는다.
응답은 지정 JSON으로만 반환하고 근거는 허용된 evidenceKeys에서 고른다. 추천 순위는 사용자 선호를 반영하되 자료가 비슷하면 낮은 cost를 보조 기준으로 쓴다.`;

export async function recommendWithGemini(body,{apiKey,model=DEFAULT_GEMINI_MODEL,fetchImpl=fetch,signal,timeoutMs=20000,onUsage}={}) {
 const input=validateRecommendationInput(body);
 if(!apiKey?.trim())throw Object.assign(new Error('AI 추천이 아직 연결되지 않았습니다. 기본 후보를 이용해주세요.'),{status:503,code:'AI_NOT_CONFIGURED'});
 if(!/^gemini-[a-zA-Z0-9.-]+$/.test(model))throw Object.assign(new Error('AI 모델 설정을 확인해주세요.'),{status:503});
 const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
 if(signal?.aborted)controller.abort();
 const timer=setTimeout(cancel,timeoutMs);
 try{
  const payload={...input,allowedEvidence:allowedEvidence(input),comparable:{traffic:allowedEvidence(input).includes('traffic'),accidents:allowedEvidence(input).includes('accidents')}};
  const response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
   method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},signal:controller.signal,
   body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM_INSTRUCTION}]},contents:[{role:'user',parts:[{text:JSON.stringify(payload)}]}],generationConfig:{temperature:0.2,maxOutputTokens:4096,responseFormat:{text:{mimeType:'APPLICATION_JSON',schema:recommendationSchema(input)}}}})
  });
  if(!response.ok){
   let details;try{details=await response.json();}catch{}
   const violations=details?.error?.details?.flatMap(item=>item.violations||[])||[];
   const dailyQuota=violations.some(item=>/per.?day|daily/i.test(item.quotaId||''));
   const retry=Number.parseFloat(details?.error?.details?.find(item=>item.retryDelay)?.retryDelay);
   throw Object.assign(new Error(response.status===429?'AI 추천 요청이 많습니다. 잠시 후 다시 시도해주세요.':'AI 추천에 연결하지 못했습니다. 기본 후보를 유지합니다.'),{status:response.status===429?429:502,code:response.status,dailyQuota,retrySeconds:Number.isFinite(retry)?Math.min(86400,Math.max(1,Math.ceil(retry))):60});
  }
  const result=await response.json(),candidate=result.candidates?.[0];
  onUsage?.(result.usageMetadata||{});
  if(candidate?.finishReason!=='STOP')throw new Error('AI 응답을 완료하지 못했습니다. 기본 후보를 유지합니다.');
  const text=candidate.content?.parts?.filter(part=>!part.thought&&typeof part.text==='string').map(part=>part.text).join('');
  let output;try{output=JSON.parse(text);}catch{throw new Error('AI 응답 형식을 확인할 수 없습니다. 기본 후보를 유지합니다.');}
  return {...validateRecommendationOutput(output,input),model};
 }catch(error){
  if(controller.signal.aborted)throw Object.assign(new Error('AI 추천 응답이 지연되고 있습니다. 다시 시도해주세요.'),{status:504});
  if(error.status)throw error;
  throw Object.assign(new Error('AI 추천 결과를 검증하지 못했습니다. 기본 후보를 유지합니다.'),{status:502});
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
