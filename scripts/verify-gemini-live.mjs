import {loadEnv} from 'vite';
import {recommendWithConfiguredGemini,isGeminiConfigured} from '../server/gemini-key-pool.js';
const env={...loadEnv('development',process.cwd(),''),...process.env};
if(!isGeminiConfigured(env)){console.error('Gemini 서버 키 또는 공유 풀 설정을 확인해주세요.');process.exit(1);}
const missing={coverage:0,score:null,period:null};
const input={profile:{goal:'gentle',avoid:['left','uturn']},range:{min:5,max:10},preferredLanes:[3,4,5],candidates:[
 {id:'candidate_1',distanceKm:5.5,mode:'loop',cost:6000,preferredLaneRatio:.9,narrowRoadRatio:0,turns:{straight:10,right:3,left:0,uturn:0},traffic:missing,accidents:missing},
 {id:'candidate_2',distanceKm:7.5,mode:'loop',cost:9500,preferredLaneRatio:.5,narrowRoadRatio:.2,turns:{straight:10,right:3,left:5,uturn:1},traffic:missing,accidents:missing}
]};
try{const result=await recommendWithConfiguredGemini(input,{config:env});if(result.recommendedCandidateId!=='candidate_1')throw new Error('명확한 회피 선호 사례에서 기대 후보를 선택하지 않았습니다.');console.log(JSON.stringify({model:result.model,recommendedCandidateId:result.recommendedCandidateId,missingData:result.missingData,reasons:result.ranking[0].reasons},null,2));console.log('PASS: live Gemini response/schema, preference and missing-data gates (synthetic candidates)');}catch(error){console.error(error.message);process.exitCode=1;}
