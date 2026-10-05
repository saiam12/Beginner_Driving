let sdkPromise;
export function loadNaverMaps(clientId) {
 if(sdkPromise) return sdkPromise;
 if(window.naver?.maps?.Map) return Promise.resolve(window.naver.maps);
 sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const fail=message=>{clearTimeout(timer);script.remove();reject(new Error(message));};
  const timer=setTimeout(()=>fail('네이버 지도 연결 시간이 초과되었습니다.'),20000);
  window.navermap_authFailure=()=>{
   fail('네이버 지도 인증에 실패했습니다. Client ID와 등록 URL을 확인해주세요.');
   window.dispatchEvent(new Event('naver-map-auth-error'));
  };
  // Use the existing image-tile appearance. A late GL upgrade can change
  // zoom semantics beneath the controller during a camera transition.
  script.src=`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
  script.async=true;
  script.onload=()=>{clearTimeout(timer);window.naver?.maps?.Map?resolve(window.naver.maps):fail('네이버 지도 SDK를 불러오지 못했습니다.');};
  script.onerror=()=>fail('네이버 지도를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.');
  document.head.appendChild(script);
 });
 sdkPromise.catch(()=>{sdkPromise=undefined;});
 return sdkPromise;
}
