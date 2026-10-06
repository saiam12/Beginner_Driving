import {connectCourses} from './connected-course.js';
self.onmessage=({data})=>{
 try{self.postMessage({courses:connectCourses(data.features,data.center,data.range,data.mode)});}
 catch(error){self.postMessage({error:error.message});}
};
