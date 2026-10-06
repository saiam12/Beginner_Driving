import {validateRecommendationInput,recommendationSchema,validateRecommendationOutput,allowedEvidence} from '../src/lib/course-recommendation.js';

export const DEFAULT_GEMINI_MODEL='gemini-3.8-flash';
export const SYSTEM_INSTRUCTION=`한국의 초보운전자 연습 코스 후보를 사용자 조건에 맞게 비교한다.
제공된 후보를 모두 한 번씩 순위에 포함한다. 경로, 도로명, 거리, 데이터를 만들어내지 않는다.
profile.goals는 동시에 선택할 수 있는 조건 목록이다. 선택한 모든 조건과 선호 차로 비율을 함께 고려한다.
right/left/uturn은 각각 우회전/좌회전/유턴 연습 목표이고 junctions는 교차로 연습, narrow는 1차로 좁은 도로 연습 목표다.
선택한 목표 요소가 실제로 포함된 후보를 우선한다. 여러 목표를 선택하면 충족한 목표 종류가 많은 후보를 우선하고, 횟수가 무조건 많을수록 좋다고 판단하지 않는다. junctionCount는 도로 그래프의 인접 도로가 3개 이상인 노드 통과 횟수이며 신호 교차로 여부는 알 수 없다.
목표가 비어 있으면 기본 도로 비용과 실제 거리·회전 부담을 기준으로 비교한다.
희망 난이도와 후보 difficulty를 고려한다. 난이도는 현재 후보의 총 cost 최솟값·최댓값을 3등분한 상대 구분이며 중간값은 두 값의 산술 평균이다. 실제 안전도나 검증된 운전 난이도가 아니다. 전체 선택에서는 쉬움·보통·어려움 후보를 모두 비교하며 기존 후보 ID를 유지한다.
difficultyFallback=true는 해당 난이도 후보 부족으로 높은 비용 후보를 보충한 경우다. 실제 difficulty를 낮춰 설명하지 않는다. 사용자 목표가 비슷하면 요청 난이도의 정규 후보를 우선한다.
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
