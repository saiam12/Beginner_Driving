import {exploreCourseCandidates} from './connected-course.js';
import {classifyCourseCandidates} from './course-overlap.js';
self.onmessage=({data})=>{
 try{
  const courses=exploreCourseCandidates(data.features,data.center,data.range,data.mode,data.options);
  self.postMessage({courses,courseSelection:classifyCourseCandidates(courses)});
 }
 catch(error){self.postMessage({error:error.message});}
};
