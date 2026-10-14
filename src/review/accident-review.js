import './accident-review.css';
import {loadNaverMaps} from '../lib/naverMaps';

const $=id=>document.getElementById(id);
const colors=['#1766c8','#b96b00','#7a39a5','#007c68','#bb3764','#4c5a6d'];
const fields=['사고유형','사고유형_세부','가해운전자_차종','피해운전자_차종','도로형태','법규위반'];
const key='daegu2024-review-distance-policy';
let data=[],list=[],pos=0,decisions={},map,maps,overlays=[],provider='',satellite=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wgs=(c,p)=>{const x=c.x+p[0],y=c.y+p[1];return [Math.atan(Math.sinh(y/6378137))*180/Math.PI,x/6378137*180/Math.PI]};
const current=()=>data[list[pos]];
const reviewIndices=()=>data.map((_,i)=>i).filter(i=>Number(data[i].nearest_distance_m)<=15&&decisions[data[i].accident_id]?.decision!=='해당 링크 없음');
const candidates=c=>c.roads.filter(r=>r.candidate).sort((a,b)=>a.d-b.d||Number(a.id)-Number(b.id));
try{decisions=JSON.parse(localStorage.getItem(key)||'{}')}catch{$('error').textContent='브라우저 임시 저장을 사용할 수 없습니다. CSV로 자주 저장해주세요.'}
function store(decision,group='',advance=true,expectedId=current()?.accident_id){
 const c=current();if(!c||c.accident_id!==expectedId)return;
 if(decision!=='해당 링크 없음'&&Number(c.nearest_distance_m)>15){$('error').textContent='최근접 링크가 15m를 초과해 링크 없음으로 처리된 사고입니다.';return}
 decisions[c.accident_id]={decision,selected_link_or_group:group,note:$('note').value};
 try{localStorage.setItem(key,JSON.stringify(decisions))}catch{$('error').textContent='임시 저장에 실패했습니다. CSV를 내려받아 보관해주세요.'}
 if(advance){
  if(decision==='해당 링크 없음'||$('filter').value==='pending'){
   list=reviewIndices().filter(i=>$('filter').value!=='pending'||!decisions[data[i].accident_id]);
   pos=Math.min(pos,Math.max(0,list.length-1));
  }else if(pos<list.length-1){pos++}
 }
 render();
}
function refresh(){list=reviewIndices().filter(i=>$('filter').value!=='pending'||!decisions[data[i].accident_id]);pos=0;render()}
function nearestPoint(r){let best;for(const line of r.lines)for(let j=0;j<line.length-1;j++){const a=line[j],b=line[j+1],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/(dx*dx+dy*dy||1))),p=[a[0]+t*dx,a[1]+t*dy],d=p[0]**2+p[1]**2;if(!best||d<best.d)best={p,d}}return best?.p||r.lines[0][0]}
function draw(c){
 if(!map||!c)return;
 overlays.forEach(o=>provider==='naver'?o.setMap(null):o.remove());overlays=[];
 const cs=candidates(c),groups=[...new Set(cs.map(r=>r.group))];
 for(const r of c.roads){const color=r.candidate?colors[groups.indexOf(r.group)%colors.length]:'#778799';
  for(const line of r.lines){const coords=line.map(p=>wgs(c,p));
   if(provider==='naver'){const poly=new maps.Polyline({map,path:coords.map(p=>new maps.LatLng(...p)),strokeColor:color,strokeWeight:r.candidate?5:1.5,strokeOpacity:r.candidate?.85:.35,clickable:r.candidate&&r.d<=15,zIndex:r.candidate?20:1});if(r.candidate&&r.d<=15)maps.Event.addListener(poly,'click',()=>store('선택',r.group,true,c.accident_id));overlays.push(poly)}
   else{const poly=maps.polyline(coords,{color,weight:r.candidate?5:1,opacity:r.candidate?.85:.35}).addTo(map);if(r.candidate&&r.d<=15)poly.on('click',()=>store('선택',r.group,true,c.accident_id));overlays.push(poly)}
  }
 }
 cs.forEach((r,i)=>{const color=colors[groups.indexOf(r.group)%colors.length],at=wgs(c,nearestPoint(r));const html=`<button class="review-link-label" style="color:${color};border-color:${color}" aria-label="후보 ${i+1} 링크 ${esc(r.id)} ${r.d>15?'15m 초과':'선택'}" ${r.d>15?'disabled':''}>${i+1} · ${esc(r.id)}</button>`;
  if(provider==='naver'){const marker=new maps.Marker({map,position:new maps.LatLng(...at),icon:{content:html,anchor:new maps.Point(i%2?125:-8,(Math.floor(i/2)%3)*30-12)},zIndex:30});if(r.d<=15)maps.Event.addListener(marker,'click',()=>store('선택',r.group,true,c.accident_id));overlays.push(marker)}
  else{const marker=maps.marker(at,{icon:maps.divIcon({html,className:'',iconAnchor:[0,(i%3)*20]})}).addTo(map);if(r.d<=15)marker.on('click',()=>store('선택',r.group,true,c.accident_id));overlays.push(marker)}
 });
 const center=[c.latitude,c.longitude];
 if(provider==='naver'){overlays.push(new maps.Marker({map,position:new maps.LatLng(...center),icon:{content:'<span class="review-accident-pin">사고 지점</span>',anchor:new maps.Point(38,18)},zIndex:100}));map.setCenter(new maps.LatLng(...center));map.setZoom(19)}
 else{overlays.push(maps.marker(center,{icon:maps.divIcon({html:'<span class="review-accident-pin">사고 지점</span>',className:'',iconAnchor:[38,18]})}).addTo(map));map.setView(center,19)}
}
function render(){
 const c=current();$('prev').disabled=!c||pos===0;$('next').disabled=!c||pos===list.length-1;
 $('progress').textContent=`검토 대상 ${reviewIndices().length.toLocaleString()}건 · 현재 ${list.length?pos+1:0}/${list.length.toLocaleString()} · 링크 없음으로 제외 ${data.filter(c=>decisions[c.accident_id]?.decision==='해당 링크 없음').length.toLocaleString()}건`;
 ['unmapped','hold','saveNote','note','recenter'].forEach(id=>$(id).disabled=!c);
 if(!c){history.replaceState(null,'',location.pathname);$('summary').textContent='검토할 사고가 없습니다. 해당 링크 없음으로 처리된 사고는 목록에서 제외했습니다.';$('roadlist').replaceChildren();$('saved').textContent='';$('note').value='';overlays.forEach(o=>provider==='naver'?o.setMap(null):o.remove());overlays=[];return}
 history.replaceState(null,'',`${location.pathname}?accident=${encodeURIComponent(c.accident_id)}`);
 const saved=decisions[c.accident_id];$('note').value=saved?.note||'';$('saved').textContent=saved?`내 판단: ${saved.decision} ${saved.selected_link_or_group}`:'아직 판단하지 않았습니다.';
 $('hold').disabled=Number(c.nearest_distance_m)>15;
 $('hold').title=Number(c.nearest_distance_m)>15?'15m 초과 사고는 링크 없음으로 처리합니다.':'';
 $('summary').innerHTML=`<h2>사고 ${esc(c.accident_id)}</h2><p>TAAS 구분번호 ${esc(c.taas_display_id)}<br>${esc(c.district)} · ${esc(c.route_name||'도로명 미제공')}<br>최근접 후보 ${esc(c.nearest_distance_m)}m · ${Number(c.nearest_distance_m)>15?'15m 초과로 링크 없음':'15m 이내'}</p><table>${fields.map(k=>`<tr><th>${esc(k.replaceAll('_',' '))}</th><td>${esc(c.details[k]||'미제공')}</td></tr>`).join('')}</table>`;
 const cs=candidates(c);$('roadlist').innerHTML='<table><thead><tr><th>후보 링크 / 도로명</th><th>거리</th><th>판단</th></tr></thead><tbody>'+cs.map((r,i)=>`<tr><td><strong>${i+1}. ${esc(r.id)}</strong><br>${esc(r.name==='nan'?'도로명 없음':r.name)}</td><td>${r.d.toFixed(1)}m</td><td><button data-group="${esc(r.group)}" ${r.d>15?'disabled title="15m 초과"':''}>${r.d>15?'15m 초과':'이 구간'}</button></td></tr>`).join('')+'</tbody></table>';
 $('roadlist').querySelectorAll('button').forEach(b=>b.onclick=()=>store('선택',b.dataset.group,true,c.accident_id));draw(c);
}
async function connect(){
 $('retry').disabled=true;$('map-status').textContent='네이버 지도를 연결하는 중입니다.';
 try{
  const id=import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim();if(!id)throw Error('등록된 네이버 지도 설정이 없습니다.');
  maps=await loadNaverMaps(id);provider='naver';map=new maps.Map($('map'),{center:new maps.LatLng(35.87,128.6),zoom:19,zoomControl:true,mapTypeControl:true,scaleControl:true});
  $('map-status').textContent='네이버 상세지도';$('layers').disabled=false;
 }catch{
  const L=await import('leaflet');await import('leaflet/dist/leaflet.css');maps=L.default;provider='osm';map=maps.map($('map')).setView([35.87,128.6],19);
  maps.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  $('map-status').textContent='상세지도 · 네이버 연결 실패로 OpenStreetMap 표시';$('layers').disabled=true;
 }finally{$('retry').disabled=false}
 draw(current());
}
$('prev').onclick=()=>{if(pos>0)pos--;render()};$('next').onclick=()=>{if(pos<list.length-1)pos++;render()};$('filter').onchange=refresh;
$('find').onclick=()=>{const q=$('jump').value.trim(),i=data.findIndex(c=>c.accident_id===q||c.taas_display_id===q);if(i<0){$('error').textContent='보류 목록에 해당 번호가 없습니다.';return}if(!reviewIndices().includes(i)){$('error').textContent='해당 사고는 링크 없음으로 처리되어 검토 목록에서 제외되었습니다.';return}$('error').textContent='';$('filter').value='all';list=reviewIndices();pos=list.indexOf(i);render()};
$('jump').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)$('find').click()};$('clear').onclick=()=>{$('jump').value='';$('error').textContent='';$('jump').focus()};
$('hold').onclick=()=>store('보류');$('unmapped').onclick=()=>store('해당 링크 없음');$('saveNote').onclick=()=>{const s=decisions[current()?.accident_id];store(s?.decision||'보류',s?.selected_link_or_group||'',false)};
$('recenter').onclick=()=>draw(current());$('layers').onclick=()=>{if(provider!=='naver')return;satellite=!satellite;map.setMapTypeId(satellite?maps.MapTypeId.HYBRID:maps.MapTypeId.NORMAL);$('layers').textContent=satellite?'일반지도 보기':'위성지도 보기'};
$('retry').onclick=()=>location.reload();
$('download').onclick=()=>{const cell=s=>'"'+String(s??'').replace(/"/g,'""')+'"',rows=[['accident_id','decision','selected_link_or_group','review_note']];for(const c of data){const s=decisions[c.accident_id];if(s)rows.push([c.accident_id,s.decision,s.selected_link_or_group,s.note])}const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='daegu-2024-held-review.csv';a.click();URL.revokeObjectURL(url)};
try{const response=await fetch('/outputs/daegu-accident-matching-2024-distance-policy/held-review-data.json');if(!response.ok)throw Error();data=await response.json();
 for(const c of data)if(Number(c.nearest_distance_m)>15){const previous=decisions[c.accident_id];decisions[c.accident_id]={...previous,decision:'해당 링크 없음',selected_link_or_group:'',note:previous?.note?.startsWith('사용자 지정: 10m 초과')?'사용자 지정: 15m 초과는 링크 없음':previous?.note||'사용자 지정: 15m 초과는 링크 없음',previous_selected_link_or_group:previous?.selected_link_or_group||previous?.previous_selected_link_or_group||'',rule:'nearest-over-15m'}}
 try{localStorage.setItem(key,JSON.stringify(decisions))}catch{$('error').textContent='임시 저장에 실패했습니다. CSV를 내려받아 보관해주세요.'}
 list=reviewIndices();const requested=new URLSearchParams(location.search).get('accident');const at=data.findIndex(c=>c.accident_id===requested);if(list.includes(at))pos=list.indexOf(at);render();await connect()}catch{$('progress').textContent='사고 자료를 불러오지 못했습니다.';$('error').textContent='연결을 확인하고 새로고침해주세요.'}
