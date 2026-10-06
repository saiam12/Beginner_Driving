import {defineConfig,loadEnv} from 'vite';
import {createRecommendationHandler} from './api/recommend-courses.js';
export default defineConfig(({mode})=>({
 esbuild:{jsx:'automatic'},
 plugins:[{name:'local-course-recommendation',configureServer(server){
  const handler=createRecommendationHandler({env:()=>({...loadEnv(mode,process.cwd(),''),...process.env})});
  server.middlewares.use('/api/recommend-courses',(req,res)=>handler(req,res));
 }}]
}));
