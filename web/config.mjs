export const apiBase='https://gxmabyarcqjgamojojbd.supabase.co/functions/v1/quiz-api';
export const adminUrl='./admin/';
const ACCOUNT='tt-account-session-v1';
export function setAccountToken(token){if(token)localStorage.setItem(ACCOUNT,token);else localStorage.removeItem(ACCOUNT);}
const ADMIN='tt-admin-session';
export function setAdminToken(token){if(token)sessionStorage.setItem(ADMIN,token);else sessionStorage.removeItem(ADMIN);}
export function apiFetch(path,options={}){let accountToken;try{accountToken=localStorage.getItem(ACCOUNT);}catch{}let token;try{token=localStorage.getItem('tt-player-token');if(!/^[a-f0-9-]{36}$/.test(token||'')){token=crypto.randomUUID();localStorage.setItem('tt-player-token',token);}}catch{}return fetch(apiBase+path,{...options,credentials:'omit',headers:{...options.headers,...(token?{'X-Player-Token':token}:{}),...(accountToken?{'X-Account-Token':accountToken}:{})}});}
export function adminFetch(path,options={}){let token;try{token=sessionStorage.getItem(ADMIN);}catch{}return apiFetch(path,{...options,headers:{...options.headers,...(token?{Authorization:'Bearer '+token}:{})}});}
