// Isolated iPad test features; no changes to the normal live page.
(function(){
'use strict';
const $=id=>document.getElementById(id);
let spotify=null, spotifyApi=null, lastPaused=false, panelOpen=false, sdkPlayer=null, sdkDevice=null, shuffle=false, repeat='off';
const auth=()=>window.padelSpotifyAuth;
const spotifyAction=async(method,path,body)=>{try{await auth().api(method,path,body);status('Spotify-Steuerung ausgeführt.')}catch(e){status(e.message)}};
function loadSdk(){if(!auth()?.connected()||sdkPlayer||document.getElementById('spotifySdkScript'))return;const sc=document.createElement('script');sc.id='spotifySdkScript';sc.src='https://sdk.scdn.co/spotify-player.js';document.body.appendChild(sc)}
window.onSpotifyWebPlaybackSDKReady=async()=>{if(!auth()?.connected())return;sdkPlayer=new Spotify.Player({name:'Padel Hirsch iPad',getOAuthToken:async cb=>cb(await auth().token()),volume:0.7});sdkPlayer.addListener('ready',({device_id})=>{sdkDevice=device_id;updateSpotifyStatus();status('Spotify-Player bereit. Premium starten tippen.')});sdkPlayer.addListener('authentication_error',({message})=>{sdkDevice=null;updateSpotifyStatus();status('Spotify Anmeldung: '+message)});sdkPlayer.addListener('initialization_error',({message})=>{sdkDevice=null;updateSpotifyStatus();status('Spotify Player: '+message)});sdkPlayer.addListener('account_error',({message})=>{sdkDevice=null;updateSpotifyStatus();status('Spotify Konto: '+message)});sdkPlayer.addListener('not_ready',()=>{sdkDevice=null;updateSpotifyStatus()});sdkPlayer.addListener('playback_error',({message})=>status(message));const ok=await sdkPlayer.connect();if(!ok)status('Spotify Web-Player konnte nicht verbunden werden.')};
async function playPremium(){try{if(!sdkDevice)throw Error('Spotify-Player noch nicht bereit.');await sdkPlayer.activateElement();await auth().api('PUT','me/player',{device_ids:[sdkDevice],play:false});await auth().api('PUT','me/player/play?device_id='+encodeURIComponent(sdkDevice),{context_uri:$('spotifyPlaylistSelect').value});status('Wiedergabe an Padel Hirsch iPad gesendet. Falls Spotify zur App wechselt, bitte Gerätestatus prüfen.')}catch(e){status(e.message)}}
function updateSpotifyStatus(){const connected=!!auth()?.connected();const el=$('spotifyConnectionState');if(el)el.textContent=!connected?'Nicht verbunden':sdkDevice?'Player bereit':'Verbunden · Player wird geladen';if($('spotifyLogin'))$('spotifyLogin').hidden=connected;if($('spotifyPlay')){$('spotifyPlay').hidden=!connected;$('spotifyPlay').disabled=!sdkDevice;$('spotifyPlay').textContent=sdkDevice?'▶ Im Web-Player starten':'Web-Player nicht bereit';}}
const status=message=>{if($('ipadAudioStatus'))$('ipadAudioStatus').textContent=message};
// The private edit URL, not the unlocked editing state, controls visibility.
const isEdit=()=>Boolean(new URLSearchParams(location.hash.replace(/^#/, '')).get('key'));
const isIpad=()=>/iPad/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function sync(){
 const allowed=isEdit()&&isIpad();
 $('ipadSwitch').hidden=!allowed;
 if(!allowed){$('ipadPanel').hidden=true;panelOpen=false;}
 else $('ipadPanel').hidden=!panelOpen;
}
function validSpotify(raw){return /^spotify:playlist:[A-Za-z0-9]+$/.test(raw)?raw:null;}
function mount(){
 if(!spotifyApi)return status('Spotify wird geladen. Bitte nochmals tippen.');
 const uri=validSpotify($('spotifyPlaylistSelect').value);
 if(!uri)return status('Bitte einen gültigen Spotify-Playlist-, Album- oder Titel-Link eingeben.');
 localStorage.setItem('padelSpotifyPlaylist', uri);
 if(spotify){spotify.loadEntity(uri);return status('Spotify-Inhalt geladen. Play im Player antippen.');}
 spotifyApi.createController($('spotifyMount'),{uri,width:'100%',height:80},controller=>{
  spotify=controller;
  controller.addListener('playback_update',e=>{if(e?.data)lastPaused=!!e.data.isPaused});
  status('Spotify bereit. Zum Starten im Player Play antippen.');
 });
}
function resume(){
 if(!spotify)return status('Spotify-Player noch nicht bereit.');
 try{spotify.resume();status('Fortsetzen angefordert. Falls iPadOS blockiert: Play im Spotify-Player tippen.');}catch{status('Fortsetzen blockiert. Bitte Play im Spotify-Player tippen.');}
}
function attemptResume(){
 if(!$('autoResumeMusic').checked||!spotify)return;
 // iOS may reject playback without a fresh user gesture.
 resume();
}
function say(text){
 const synth=window.speechSynthesis;
 if(!synth)return status('Keine Sprachausgabe verfügbar.');
 synth.cancel();
 const u=new SpeechSynthesisUtterance(text);
 const voices=synth.getVoices().filter(v=>/^de/i.test(v.lang));
 u.voice=voices.find(v=>/anna|petra|helena|katja|marlene|vicki/i.test(v.name))||voices[0]||null;
 u.lang=u.voice?.lang||'de-DE';u.rate=.94;u.pitch=1.13;
 u.onend=()=>{status('Jingle beendet.');attemptResume()};
 u.onerror=()=>status('Jingle konnte nicht abgespielt werden.');
 synth.speak(u);status('Jingle: '+text);
}
function init(){
 $('ipadSwitch').addEventListener('click',()=>{if(!isEdit())return;panelOpen=!panelOpen;sync()});
 $('ipadExit').addEventListener('click',()=>{panelOpen=false;sync()});
 $('spotifyPlaylistSelect').addEventListener('change',mount);
 $('spotifyLogin').addEventListener('click',()=>auth().login());
 $('spotifyPlay').addEventListener('click',playPremium);
 if(auth()?.connected())loadSdk();updateSpotifyStatus();
 $('spotifyShuffle').addEventListener('click',async()=>{if(!auth()?.connected()){status('Shuffle benötigt die Spotify-Anmeldung über OAuth.');return;}try{const next=!shuffle;await auth().api('PUT','me/player/shuffle?state='+next+(sdkDevice?'&device_id='+encodeURIComponent(sdkDevice):''));shuffle=next;$('spotifyShuffle').setAttribute('aria-pressed',String(shuffle));$('spotifyShuffle').textContent=shuffle?'⇄ Shuffle an':'⇄ Shuffle';status(shuffle?'Zufallswiedergabe aktiviert.':'Zufallswiedergabe deaktiviert.')}catch(e){status(e.message)}});

 const saved=localStorage.getItem('padelSpotifyPlaylist');if(saved&&[...$('spotifyPlaylistSelect').options].some(o=>o.value===saved))$('spotifyPlaylistSelect').value=saved;
 const jingles=['Halbzeit ist!','Auf geht’s, Padel Hirsch!','Starker Punkt!','Match Point!'];
 jingles.forEach(t=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.addEventListener('click',()=>say(t));$('jingleButtons').append(b)});
 const old=window.announceRound;
 if(typeof old==='function')window.announceRound=function(){old.apply(this,arguments);if(isEdit()&&panelOpen){const s=window.speechSynthesis;const check=()=>{if(s?.speaking||s?.pending){setTimeout(check,300);return;}attemptResume()};setTimeout(check,500)}};

 window.onSpotifyIframeApiReady=api=>{spotifyApi=api;mount()};
 const script=document.createElement('script');script.src='https://open.spotify.com/embed/iframe-api/v1';script.async=true;document.body.appendChild(script);
 setInterval(sync,800);sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();