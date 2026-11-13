export const apiBase='https://gxmabyarcqjgamojojbd.supabase.co/functions/v1/quiz-api';
export const adminUrl='./admin/';
// Authentication is held in HttpOnly cookies. Clear obsolete browser-readable tokens.
for(const [storage,key] of [['localStorage','tt-account-session-v1'],['sessionStorage','tt-admin-session']]){try{globalThis[storage].removeItem(key);}catch{}}
export function setAccountToken(){}
export function setAdminToken(){}
export function apiFetch(path,options={}){return fetch(apiBase+path,{...options,credentials:'include',headers:{...options.headers,'X-Session-Mode':'cookie'}});}
export const adminFetch=apiFetch;
