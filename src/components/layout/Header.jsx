import React, {useRef} from 'react';
import { CarFront, Search, ArrowUpRight, X } from 'lucide-react';
export default function Header({query,setQuery,onSearch,onHome,onGuide,onClear,error}) {
 const input=useRef(null);
 return <header className="header"><button className="brand" onClick={onHome}><span className="brand-icon"><CarFront size={25}/></span><span>차근차근<small>나에게 맞는 첫 드라이브</small></span></button><form className="search" noValidate onSubmit={e=>{e.preventDefault();if(!e.nativeEvent.isComposing)onSearch(query);}}><Search size={20}/><input ref={input} aria-label="지역 검색" aria-invalid={!!error} aria-describedby={error?'search-error':undefined} placeholder="지역을 검색하세요 (예: 서울, 부산)" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.nativeEvent.isComposing||e.keyCode===229))e.preventDefault();}}/>{query&&<button className="search-clear" type="button" aria-label="검색어 지우기" title="검색어 지우기" onClick={()=>{onClear();input.current?.focus();}}><X size={17}/></button>}<button type="submit">검색</button></form><div className="header-right"><span className="demo-dot"/> 예시 데이터</div><button className="guide-trigger" onClick={onGuide}>이용 안내 <ArrowUpRight size={15}/></button></header>;
}

