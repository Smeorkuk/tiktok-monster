export const apiBase='';
export const adminUrl=apiBase+'/admin';
export function apiFetch(path,options={}){let token;try{token=localStorage.getItem('tt-player-token');if(!/^[a-f0-9-]{36}$/.test(token||'')){token=crypto.randomUUID();localStorage.setItem('tt-player-token',token);}}catch{}return fetch(apiBase+path,{...options,headers:{...options.headers,...(token?{'X-Player-Token':token}:{})}});}
