(function(){
'use strict';
const CLIENT='c8fa7767d217448e8c1badb65498c466';
const REDIRECT='https://hirschi-web.github.io/padel/spotify-callback.html';
const SCOPES='streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state';
const STORE='padel_spotify_oauth_v1';
const read=()=>{try{return JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{return null}};
const save=x=>sessionStorage.setItem(STORE,JSON.stringify(x));
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
async function login(){
 const verifier=b64(crypto.getRandomValues(new Uint8Array(64)));
 const challenge=b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
 const state=b64(crypto.getRandomValues(new Uint8Array(24)));
 sessionStorage.setItem('padel_spotify_pending',JSON.stringify({verifier,state,returnUrl:location.href}));
 const p=new URLSearchParams({client_id:CLIENT,response_type:'code',redirect_uri:REDIRECT,scope:SCOPES,code_challenge_method:'S256',code_challenge:challenge,state});
 location.assign('https://accounts.spotify.com/authorize?'+p);
}
async function exchange(code,state){
 const pending=JSON.parse(sessionStorage.getItem('padel_spotify_pending')||'null');
 if(!pending||pending.state!==state)throw Error('Spotify Anmeldung: Sicherheitsprüfung fehlgeschlagen.');
 const res=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:REDIRECT,client_id:CLIENT,code_verifier:pending.verifier})});
 const x=await res.json();if(!res.ok)throw Error(x.error_description||x.error||'Token konnte nicht geladen werden');
 save({access:x.access_token,refresh:x.refresh_token,expires:Date.now()+x.expires_in*1000});
 sessionStorage.removeItem('padel_spotify_pending');
 location.replace(pending.returnUrl);
}
let refreshPromise=null;
async function token(){
 let x=read();if(!x)return null;
 if(x.expires>Date.now()+60000)return x.access;
 if(!x.refresh)return null;
 if(!refreshPromise)refreshPromise=(async()=>{
 const res=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:x.refresh,client_id:CLIENT})});
 const y=await res.json();if(!res.ok)throw Error(y.error_description||y.error||'Spotify Token abgelaufen');
 x={access:y.access_token,refresh:y.refresh_token||x.refresh,expires:Date.now()+y.expires_in*1000};save(x);return x.access;
 })().finally(()=>{refreshPromise=null});
 return refreshPromise;
}
async function api(method,path,body){
 const t=await token();if(!t)throw Error('Bitte zuerst mit Spotify verbinden.');
 const r=await fetch('https://api.spotify.com/v1/'+path,{method,headers:{Authorization:'Bearer '+t,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok){const e=await r.text();throw Error('Spotify '+r.status+': '+e.slice(0,180))}
 return r.status===204?null:r.json();
}
window.padelSpotifyAuth={login,exchange,token,api,connected:()=>!!read()};
})();