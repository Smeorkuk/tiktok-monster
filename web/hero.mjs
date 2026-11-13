export const defaultHeroImages=[
 {url:'assets/hero-ben.webp',alt:'Говорящий Бен',fit:'cover'},
 {url:'assets/hero-shark.webp',alt:'Тралалеро Тралала',fit:'cover'},
 {url:'assets/hero-gator.webp',alt:'Бомбардиро Крокодило',fit:'cover'},
 {url:'assets/2022-001.webp',alt:'Хагги Вагги',fit:'contain'},
 {url:'assets/2022-004.webp',alt:'Мудрое таинственное дерево',fit:'contain'},
 {url:'assets/2024-005.webp',alt:'Мистер Фреш',fit:'contain'}
];
export function pickHeroImages(images,previous=[],rng=Math.random){
 const unique=[...new Map((Array.isArray(images)?images:[]).filter(x=>x?.url).map(x=>[x.url,x])).values()];const pool=unique.length>=3?unique:defaultHeroImages;
 const shuffled=[...pool];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 const chosen=shuffled.slice(0,3),previousSet=new Set(previous);
 if(pool.length>3&&chosen.every(x=>previousSet.has(x.url))){const rest=pool.filter(x=>!chosen.some(y=>y.url===x.url));chosen[2]=rest[Math.min(rest.length-1,Math.floor(rng()*rest.length))];}
 if(chosen.every((x,i)=>x.url===previous[i]))chosen.push(chosen.shift());
 return chosen.map(x=>({...x}));
}
export function heroForVisit(images){let previous=[];try{previous=JSON.parse(localStorage.getItem('tt-hero-previous-v1')||'[]');if(!Array.isArray(previous))previous=[];}catch{}const chosen=pickHeroImages(images,previous);try{localStorage.setItem('tt-hero-previous-v1',JSON.stringify(chosen.map(x=>x.url)));}catch{}return chosen;}
const heroEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderHeroArt(images){const slots=[['ben',160,160],['shark',260,230],['gator',190,160]];return `<div class="hero-art" aria-hidden="true"><div class="art-ring"></div>${slots.map(([name,w,h],i)=>`<div class="sticker ${name}">${images[i]?`<img src="${heroEsc(images[i].url)}" alt="" width="${w}" height="${h}" style="object-fit:${images[i].fit==='contain'?'contain':'cover'}">`:'<span class="hero-placeholder">Выбери картинку</span>'}</div>`).join('')}<div class="art-label">ЭТОТ ТЫ ТОЧНО ЗНАЕШЬ?</div><div class="art-label small">СКРОЛЛ НЕ ПРОШЁЛ ДАРОМ</div><div class="art-spark">✳</div><div class="hero-number">6—7</div></div>`;}
