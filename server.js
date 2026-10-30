const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=process.env.PORT||3000,root=__dirname,rooms=new Map();const store=require('./room-store.js').createStore(process.env.ROOM_STORE_FILE,process.env),{verifyTelegram}=require('./telegram-auth.js');
const {WORDS,WORD_PICTURES}=require('./words.js');const RoundRules=require('./round-rules.js'),{getHint}=require('./hints.js');const activePlayer=(room,p)=>!p.left&&!(room.eliminated||[]).includes(p.id);const liveGame=room=>['roles','discussion','voting','guessing'].includes(room.phase);
const server=http.createServer((req,res)=>{let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{return res.writeHead(400).end()};if(url==='/telegram-config'){const botUsername=(process.env.TELEGRAM_BOT_USERNAME||'').replace(/^@/,'');res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({botUsername:/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(botUsername)?botUsername:''}))}if(url==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('OK')}if(url==='/')url='/index.html';const allowed=new Set(['/index.html','/online.html','/sw.js','/manifest.webmanifest','/icon.svg','/voice.js','/chat.js','/categories.js','/category-ui.js','/words.js','/results-ui.js','/results.css','/app-update.js','/telegram.js','/telegram.css','/round-rules.js','/hints.js','/ux.js','/ux.css']);if(!allowed.has(url)&&!Object.values(WORD_PICTURES).includes(url))return res.writeHead(404).end('Not found');fs.readFile(path.join(root,url),(err,data)=>{if(err)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':url.endsWith('.html')?'text/html; charset=utf-8':url.endsWith('.css')?'text/css; charset=utf-8':url.endsWith('.js')?'application/javascript':url.endsWith('.svg')?'image/svg+xml':'application/json','Cache-Control':url==='/sw.js'?'no-store':'no-cache'}).end(data)})});
const wss=new WebSocketServer({server,maxPayload:32768});const send=(ws,msg)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg))};const random=n=>crypto.randomInt(n);const code=()=>crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();


function voiceIceServers(id){
 const servers=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];
 const urls=(process.env.TURN_URLS||'').split(',').map(x=>x.trim()).filter(x=>/^turns?:[^\s]+$/.test(x));
 if(urls.length&&process.env.TURN_SECRET){const username=(Math.floor(Date.now()/1000)+86400)+':'+id;servers.push({urls,username,credential:crypto.createHmac('sha1',process.env.TURN_SECRET).update(username).digest('base64')})}
 return servers
}
function cleanVoiceSignal(signal,listening=false){
 if(!signal||typeof signal!=='object'||Array.isArray(signal))return null;
 if(signal.restart===true)return {restart:true};
 if(signal.description){const d=signal.description;if(!['offer','answer'].includes(d.type)||typeof d.sdp!=='string'||d.sdp.length>24000||!/^m=audio /m.test(d.sdp)||/^m=(video|application) /m.test(d.sdp))return null;if(listening){const media=d.sdp.split(/(?=^m=)/m).filter(x=>/^m=audio /m.test(x));if(media.some(x=>!/^a=(recvonly|inactive)\r?$/m.test(x)||/^a=(sendrecv|sendonly)\r?$/m.test(x)))return null}return {description:{type:d.type,sdp:d.sdp}}}
 if(Object.hasOwn(signal,'candidate')){const c=signal.candidate;if(c===null)return {candidate:null};if(!c||typeof c.candidate!=='string'||c.candidate.length>2048||!(c.sdpMid===null||typeof c.sdpMid==='string'&&c.sdpMid.length<64)||!(c.sdpMLineIndex===null||Number.isInteger(c.sdpMLineIndex)&&c.sdpMLineIndex>=0&&c.sdpMLineIndex<8))return null;return {candidate:{candidate:c.candidate,sdpMid:c.sdpMid,sdpMLineIndex:c.sdpMLineIndex}}}
 return null
}


function attachPlayer(ws,room,p){const old=p.ws;p.voice=null;p.ws=ws;p.disconnectedAt=null;ws.player=p;ws.room=room.code;if(old&&old!==ws){send(old,{type:'sessionReplaced'});old.close()}room.updated=Date.now();send(ws,{type:'joined',code:room.code,token:p.token});publish(room);send(ws,{type:'chatHistory',code:room.code,messages:room.chat});if(['roles','discussion','voting'].includes(room.phase))send(ws,roleFor(room,p))}
function removePlayer(room,target,{ban=false}={}){
 if(ban){room.banned.add(target.clientId);if(target.telegramId)(room.bannedTelegram||=new Set()).add(target.telegramId)}
 const wasActive=activePlayer(room,target),socket=target.ws;target.left=true;target.token=null;target.voice=null;target.ws=null;
 if(socket){socket.player=null;socket.room=null;send(socket,{type:ban?'kicked':'left',code:room.code});if(ban)socket.close()}
 if(!room.players.some(p=>!p.left)){rooms.delete(room.code);store.save(rooms);return}
 if(room.host===target.id)chooseHost(room);
 if(room.phase==='lobby'){room.players=room.players.filter(p=>!p.left)}
 else if(liveGame(room)&&wasActive){
  room.eliminated=[...new Set([...(room.eliminated||[]),target.id])];room.votes.delete(target.id);
  for(const [v,t]of room.votes)if(t===target.id)room.votes.set(v,null);
  const alive=room.players.filter(p=>activePlayer(room,p)),bad=alive.filter(p=>room.impostors.includes(p.id)).length;
  if(!bad)endGame(room,true,'departure');else if(bad>=alive.length-bad)endGame(room,false,'parity');
  else if(room.phase==='voting'&&room.votes.size===alive.length)finish(room);
 }
 if(room.phase==='guessing'&&room.guesser===target.id)endGame(room,true,'guess-left');
 room.updated=Date.now();publish(room)
}
function chooseHost(room){const next=room.players.find(p=>!p.left&&p.ws?.readyState===WebSocket.OPEN&&activePlayer(room,p))||room.players.find(p=>!p.left&&p.ws?.readyState===WebSocket.OPEN)||room.players.find(p=>!p.left);if(next)room.host=next.id}
function startVoting(room){room.phase='voting';room.votes=new Map();room.deadline=Date.now()+(room.settings.votingSeconds||45)*1000;publish(room)}
function endGame(room,caught,reason){room.results={eliminated:room.eliminated||[],word:room.word,impostors:room.impostors,counts:room.voteTotals||{},caught,reason};room.phase='results';room.deadline=null;room.guesser=null}
function normalizeGuess(word){return String(word).normalize('NFKC').toLocaleLowerCase('uz').replace(/[‘’ʻʼ`]/g,"'").trim().replace(/\s+/g,' ')}
function publish(room){store.save(rooms);for(const p of room.players)send(p.ws,{type:'state',code:room.code,phase:room.phase,host:p.id===room.host,hostId:room.host,me:p.id,round:room.round,cycle:room.cycle||1,lastVote:room.lastVote||null,guesser:room.phase==='guessing'?room.guesser:null,recovery:store.status(),deadline:room.deadline,serverNow:Date.now(),players:room.players.map(x=>({id:x.id,name:x.name,isHost:x.id===room.host,left:!!x.left,verified:!!x.telegramId,eliminated:!activePlayer(room,x),connected:x.ws?.readyState===WebSocket.OPEN,voted:room.votes.has(x.id),voice:{joined:!!x.voice,muted:x.voice?.muted!==false,blocked:!!x.voiceBlocked,session:x.voice?.session||null,listening:!!x.voice?.listening}})),settings:room.settings,votesCount:room.votes.size,results:room.phase==='results'?room.results:undefined})}
function roomPhase(ws){return rooms.get(ws.room)?.phase}function error(ws,message){send(ws,{type:'error',message})}
function roleFor(room,p){const impostor=room.impostors.includes(p.id);return {type:'role',round:room.round,impostor,word:impostor?null:room.word,image:impostor?null:room.wordImage,hint:impostor&&room.settings.hints?getHint(room.word,room.category):null,partners:impostor&&room.settings.knowEachOther&&room.impostors.length>1?room.players.filter(x=>x.id!==p.id&&room.impostors.includes(x.id)).map(x=>({id:x.id,name:x.name})):[]}}
function removeConnection(ws){const p=ws.player,room=rooms.get(ws.room);if(!p||!room||p.ws!==ws)return;p.voice=null;p.ws=null;p.disconnectedAt=Date.now();room.updated=Date.now();publish(room)}
function finish(room,hostEnded=false){
 const eligible=room.players.filter(p=>activePlayer(room,p)).length,valid=[...room.votes.values()].filter(v=>v!==null);const quorum=hostEnded||valid.length>=Math.ceil(eligible/2);const outcome=RoundRules.resolve(room.players.map(p=>p.id),room.impostors,room.eliminated||[],quorum?valid:[]);
 room.voteTotals=room.voteTotals||{};for(const [id,count]of Object.entries(outcome.counts))room.voteTotals[id]=(room.voteTotals[id]||0)+count;room.eliminated=outcome.eliminated;room.lastVote={cycle:room.cycle||1,hostEnded,quorum,counts:outcome.counts,target:outcome.target,impostor:outcome.target!==null&&room.impostors.includes(outcome.target)};
 for(const x of room.players)if(!activePlayer(room,x))x.voice=null;
 if(outcome.winner){if(outcome.winner==='civilians'&&room.settings.finalGuess&&outcome.target!==null&&!room.players.find(p=>p.id===outcome.target)?.left){room.phase='guessing';room.guesser=outcome.target;room.deadline=Date.now()+20000}else endGame(room,outcome.winner==='civilians',outcome.winner==='civilians'?'caught':'parity')}
 else{room.cycle=(room.cycle||1)+1;room.votes=new Map();room.phase='discussion';room.deadline=room.settings.timed===false?null:Date.now()+room.settings.minutes*60000;}
 publish(room)
}
function reset(room){room.players=room.players.filter(p=>!p.left);room.guesser=null;room.phase='lobby';room.votes=new Map();room.word=null;room.wordImage=null;room.impostors=[];room.results=null;room.deadline=null;room.eliminated=[];room.lastVote=null;room.cycle=1;room.voteTotals={}}
wss.on('connection',(ws,req)=>{ws.alive=true;ws.on('pong',()=>{ws.alive=true});ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return error(ws,'Noto‘g‘ri xabar')};if(!m||typeof m!=='object'||Array.isArray(m))return;
if(store.status().fenced)return error(ws,'Server yangilandi. Sahifani qayta oching');if(m.telegramInit!==undefined){const identity=verifyTelegram(m.telegramInit,process.env.TELEGRAM_BOT_ID);if(!identity)return error(ws,'Telegram hisobini tasdiqlab bo‘lmadi. Ilovani Telegram ichida qayta oching');ws.telegramId=identity.id}
if(m.type==='vote'&&roomPhase(ws)==='voting'&&Date.now()>=rooms.get(ws.room).deadline){finish(rooms.get(ws.room));return}
const name=typeof m.name==='string'?m.name.trim().slice(0,24):'';
if(m.type==='checkRoom'){
 if(ws.player)return;const requestId=typeof m.requestId==='string'?m.requestId.slice(0,64):'';if(!requestId)return;
 const reject=message=>send(ws,{type:'roomCheckError',requestId,message});const now=Date.now();ws.checkTimes=(ws.checkTimes||[]).filter(x=>now-x<10000);if(ws.checkTimes.length>=10)return reject('Biroz kuting va qayta urinib ko‘ring.');ws.checkTimes.push(now);
 const c=String(m.code||'').trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(c))return reject('6 belgili xona kodini kiriting');const room=rooms.get(c);if(!room)return reject('Xona topilmadi');if(room.banned.has(m.clientId)||(ws.telegramId&&room.bannedTelegram?.has(ws.telegramId)))return reject('Siz bu xonadan chiqarilgansiz');if(room.settings.verifiedOnly&&!ws.telegramId)return reject('Bu xona uchun o‘yinni Telegram ichida oching');if(ws.telegramId&&room.players.some(p=>!p.left&&p.telegramId===ws.telegramId)){send(ws,{type:'roomChecked',requestId,code:c});return}if(room.phase!=='lobby')return reject('O‘yin boshlangan. Yangi o‘yin uchun kuting');if(room.players.length>=15)return reject('Xona to‘la');send(ws,{type:'roomChecked',requestId,code:c});return
}

if(m.type==='create'||m.type==='join'){if(typeof m.clientId!=='string'||! /^[a-f0-9-]{36}$/.test(m.clientId))return error(ws,'Brauzerni yangilang');
 if(ws.player)return error(ws,'Siz allaqachon xonadasiz');if(!name)return error(ws,'Ismingizni kiriting');let room;
 if(m.type==='create'){if(rooms.size>=50)return error(ws,'Hozir xonalar to‘la. Birozdan keyin urinib ko‘ring');let c;do{c=code()}while(rooms.has(c));room={code:c,host:null,players:[],phase:'lobby',round:0,chat:[],settings:{category:'Tasodifiy',categories:Object.keys(WORDS),impostors:1,minutes:3,timed:true,hints:false,knowEachOther:false,votingSeconds:45,finalGuess:false,verifiedOnly:!!ws.telegramId},votes:new Map(),banned:new Set(),bannedTelegram:new Set(),updated:Date.now()};rooms.set(c,room)}
 else {room=rooms.get(String(m.code||'').trim().toUpperCase());if(!room)return error(ws,'Xona topilmadi');if(room.banned.has(m.clientId)||(ws.telegramId&&room.bannedTelegram?.has(ws.telegramId)))return send(ws,{type:'kicked'});if(room.settings.verifiedOnly&&!ws.telegramId)return error(ws,'Bu xona uchun o‘yinni Telegram ichida oching');const existing=room.players.find(p=>!p.left&&(ws.telegramId?p.telegramId===ws.telegramId:p.clientId===m.clientId));if(existing){if(ws.telegramId&&existing.telegramId===ws.telegramId||typeof m.resumeToken==='string'&&existing.token===m.resumeToken){attachPlayer(ws,room,existing);return}return error(ws,'Bu brauzer xonada mavjud. Saqlangan sessiya bilan qayting yoki eski oynada xonadan chiqing.')}if(room.phase!=='lobby')return error(ws,'O‘yin boshlangan. Yangi o‘yin uchun kuting');if(room.players.length>=15)return error(ws,'Xona to‘la')}
 if(typeof m.clientId!=='string'||! /^[a-f0-9-]{36}$/.test(m.clientId))return error(ws,'Brauzerni yangilang');
 const p={id:crypto.randomUUID(),name,ws,telegramId:ws.telegramId||null,clientId:m.clientId,token:crypto.randomBytes(24).toString('hex')};ws.player=p;ws.room=room.code;room.players.push(p);if(!room.host)room.host=p.id;room.updated=Date.now();send(ws,{type:'joined',code:room.code,token:p.token});publish(room);send(ws,{type:'chatHistory',code:room.code,messages:room.chat});return
}
if(m.type==='resume'){if(ws.player)return error(ws,'Siz allaqachon xonadasiz');const room=rooms.get(String(m.code||'').toUpperCase()),p=room?.players.find(x=>!x.left&&typeof m.token==='string'&&x.token===m.token);if(p?.telegramId&&room.bannedTelegram?.has(p.telegramId))return error(ws,'Siz bu xonadan chiqarilgansiz');if(!p)return error(ws,'Sessiya tugagan. Qaytadan kiring');attachPlayer(ws,room,p);return}
const p=ws.player,room=rooms.get(ws.room);if(!p||!room||p.ws!==ws||!room.players.includes(p))return error(ws,'Avval xonaga kiring');room.updated=Date.now();
if(m.type==='leave'){removePlayer(room,p);return}
if(m.type==='transferHost'){if(p.id!==room.host)return error(ws,'Faqat boshlovchi boshqaradi');const target=room.players.find(x=>x.id===m.target);if(!target||target===p||target.left||target.ws?.readyState!==WebSocket.OPEN)return error(ws,'Ulangan boshqa o‘yinchini tanlang');room.host=target.id;publish(room);return}

if(m.type==='chatSend'){if(liveGame(room)&&!activePlayer(room,p))return send(ws,{type:'chatError',nonce:m.nonce,message:'Siz chiqarilgansiz. O‘yin tugaguncha faqat kuzating.'});
 const reject=message=>send(ws,{type:'chatError',message,nonce:typeof m.nonce==='string'?m.nonce.slice(0,64):null});
 if(typeof m.text!=='string'||m.text.length>500||typeof m.nonce!=='string'||m.nonce.length>64)return reject('Xabar ko‘pi bilan 500 belgidan iborat bo‘lsin.');
 const text=m.text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,'').trim();if(!text)return reject('Xabar yozing.');
 const existing=room.chat.find(x=>x.sender===p.id&&x.nonce===m.nonce);if(existing){send(ws,{type:'chatMessage',code:room.code,message:existing});return}const now=Date.now();p.chatTimes=(p.chatTimes||[]).filter(t=>now-t<10000);if(p.chatTimes.length>=5||p.chatTimes.length&&now-p.chatTimes.at(-1)<800)return reject('Biroz kuting, keyin yuboring.');p.chatTimes.push(now);
 const message={id:crypto.randomUUID(),sender:p.id,name:p.name,text,at:now,nonce:m.nonce};room.chat.push(message);if(room.chat.length>100)room.chat.shift();store.save(rooms);
 for(const x of room.players)send(x.ws,{type:'chatMessage',code:room.code,message});return
}
if(m.type==='chatDelete'){
 if(p.id!==room.host)return error(ws,'Faqat boshlovchi boshqaradi');const index=room.chat.findIndex(x=>x.id===m.id);if(index<0)return;room.chat.splice(index,1);store.save(rooms);for(const x of room.players)send(x.ws,{type:'chatDeleted',code:room.code,id:m.id});return
}

// Signaling is authenticated by the current room socket and a fresh voice session.
if(m.type==='voiceJoin'){if(p.voiceBlocked)return send(ws,{type:'voiceError',message:'Boshlovchi ovozingizni bloklagan.'});if(p.voice)return;const session=crypto.randomUUID();p.voice={session,muted:true,listening:liveGame(room)&&!activePlayer(room,p)};send(ws,{type:'voiceJoined',session,listening:p.voice.listening,iceServers:voiceIceServers(p.id),relayConfigured:!!process.env.TURN_URLS&&!!process.env.TURN_SECRET});publish(room);return}
if(m.type==='voiceLeave'){if(p.voice&&m.session===p.voice.session){p.voice=null;publish(room)}return}
if(m.type==='voiceMute'){if(p.voice&&m.session===p.voice.session&&typeof m.muted==='boolean'&&(!p.voice.listening||m.muted)){p.voice.muted=m.muted;publish(room)}return}
if(m.type==='voiceBlock'){if(p.id!==room.host)return error(ws,'Faqat boshlovchi boshqaradi');const target=room.players.find(x=>x.id===m.target);if(!target||target===p||typeof m.blocked!=='boolean')return;target.voiceBlocked=m.blocked;if(m.blocked){target.voice=null;send(target.ws,{type:'voiceBlocked',message:'Boshlovchi ovozingizni blokladi.'})}publish(room);return}
if(m.type==='voiceSignal'){
 if(!p.voice||p.voiceBlocked||m.session!==p.voice.session)return;
 const target=room.players.find(x=>x.id===m.target&&x.id!==p.id);
 if(!target?.voice||target.voiceBlocked||target.voice.session!==m.targetSession||target.ws?.readyState!==WebSocket.OPEN)return;
 const at=Date.now();if(!ws.voiceRate||at-ws.voiceRate.at>10000)ws.voiceRate={at,count:0};if(++ws.voiceRate.count>120)return;
 const signal=cleanVoiceSignal(m.signal,!!p.voice.listening);if(!signal)return;
 send(target.ws,{type:'voiceSignal',from:p.id,session:p.voice.session,targetSession:target.voice.session,signal});return
}

if(['settings','kick','start','discuss','voteStart','reveal','reset','endGame'].includes(m.type)&&p.id!==room.host)return error(ws,'Faqat boshlovchi boshqaradi');
if(m.type==='settings'){if(m.votingSeconds!==undefined&&(!Number.isInteger(m.votingSeconds)||m.votingSeconds<15||m.votingSeconds>180)||m.finalGuess!==undefined&&typeof m.finalGuess!=='boolean'||m.verifiedOnly!==undefined&&(typeof m.verifiedOnly!=='boolean'||m.verifiedOnly&&!p.telegramId))return error(ws,'Yangi sozlamalar noto‘g‘ri');const selected=m.categories===undefined?(m.category==='Tasodifiy'?Object.keys(WORDS):[m.category]):m.categories;if(!Array.isArray(selected)||selected.length<1||selected.length>Object.keys(WORDS).length||new Set(selected).size!==selected.length||selected.some(x=>typeof x!=='string'||!Object.hasOwn(WORDS,x)))return error(ws,'Kamida bitta mavjud mavzuni tanlang');if(room.phase!=='lobby')return error(ws,'Sozlamalar faqat kutish xonasida');if(!(m.category==='Tasodifiy'||Object.hasOwn(WORDS,m.category))||!Number.isInteger(m.impostors)||m.impostors<1||m.impostors>3||!Number.isInteger(m.minutes)||m.minutes<1||m.minutes>60||(m.timed!==undefined&&typeof m.timed!=='boolean')||typeof m.hints!=='boolean'||typeof m.knowEachOther!=='boolean')return error(ws,'Sozlamalar noto‘g‘ri: vaqt 1–60 daqiqa');room.settings={category:selected.length===1?selected[0]:'Tasodifiy',categories:selected,impostors:m.impostors,minutes:m.minutes,timed:m.timed!==false,hints:m.hints,knowEachOther:m.knowEachOther,votingSeconds:m.votingSeconds??room.settings.votingSeconds??45,finalGuess:m.finalGuess??room.settings.finalGuess??false,verifiedOnly:m.verifiedOnly??room.settings.verifiedOnly??false};publish(room)}
if(m.type==='kick'){const target=room.players.find(x=>x.id===m.target);if(!target||target===p)return error(ws,'O‘zingizni chiqarib bo‘lmaydi');removePlayer(room,target,{ban:true});return}
if(m.type==='start'){room.players=room.players.filter(p=>!p.left);if(!['lobby','results'].includes(room.phase))return;if(room.players.length<3)return error(ws,'Kamida 3 o‘yinchi kerak');if(room.settings.impostors*2>=room.players.length)return error(ws,'Oddiy o‘yinchilar impostorlardan ko‘p bo‘lishi kerak');if(room.players.some(x=>x.ws?.readyState!==WebSocket.OPEN))return error(ws,'Barcha o‘yinchilar ulangan bo‘lishi kerak');const cats=room.settings.categories;room.category=cats[random(cats.length)];const words=WORDS[room.category];room.word=words[random(words.length)];room.wordImage=WORD_PICTURES[room.word]||null;const ids=room.players.map(x=>x.id);for(let i=ids.length-1;i>0;i--){const j=random(i+1);[ids[i],ids[j]]=[ids[j],ids[i]]}room.impostors=ids.slice(0,room.settings.impostors);room.eliminated=[];room.lastVote=null;room.cycle=1;room.voteTotals={};room.votes=new Map();room.results=null;room.deadline=null;room.round++;room.phase='roles';publish(room);for(const x of room.players)send(x.ws,roleFor(room,x))}
if(m.type==='discuss'&&room.phase==='roles'){room.phase='discussion';room.deadline=room.settings.timed===false?null:Date.now()+room.settings.minutes*60000;publish(room)}
if(m.type==='voteStart'&&['roles','discussion'].includes(room.phase))startVoting(room)
if(m.type==='vote'&&room.phase==='voting'&&activePlayer(room,p)&&!room.votes.has(p.id)&&(m.target===null||room.players.some(x=>x.id===m.target&&activePlayer(room,x))&&m.target!==p.id)){room.votes.set(p.id,m.target);if(room.votes.size===room.players.filter(x=>activePlayer(room,x)).length)finish(room);else publish(room)}
if(m.type==='reveal'&&room.phase==='voting')finish(room,true)
if(m.type==='guess'&&room.phase==='guessing'){if(Date.now()>=room.deadline){endGame(room,true,'guess-timeout');publish(room);return}if(p.id!==room.guesser||typeof m.word!=='string'||m.word.trim().length<1||m.word.length>60)return error(ws,'Bu taxminni faqat tanlangan impostor kiritadi');endGame(room,normalizeGuess(m.word)!==normalizeGuess(room.word),'guess');publish(room)}
if(m.type==='endGame'&&liveGame(room)){reset(room);publish(room);return}
if(m.type==='reset'&&room.phase==='results'){reset(room);publish(room)}
});ws.on('close',()=>removeConnection(ws))});
let lastHeartbeat=Date.now();setInterval(()=>{if(Date.now()-lastHeartbeat>=15000){lastHeartbeat=Date.now();for(const ws of wss.clients||[]){if(!ws.alive){ws.terminate();continue}ws.alive=false;ws.ping?.()}}for(const [c,r]of rooms){const now=Date.now();const host=r.players.find(p=>p.id===r.host);if(host&&!host.ws&&host.disconnectedAt&&now-host.disconnectedAt>=30000&&r.players.some(p=>!p.left&&p.ws?.readyState===WebSocket.OPEN)){chooseHost(r);publish(r)}
 if(r.phase==='discussion'&&r.deadline!==null&&now>=r.deadline)startVoting(r);
 else if(r.phase==='voting'&&now>=r.deadline)finish(r);
 else if(r.phase==='guessing'&&now>=r.deadline){endGame(r,true,'guess-timeout');publish(r)}
 if(now-r.updated>3*60*60*1000){for(const p of r.players)p.ws?.close();rooms.delete(c);store.save(rooms)}}},1000).unref();
function launch(restored){for(const [code,room]of restored)rooms.set(code,room);server.listen(PORT,'0.0.0.0',()=>console.log('IMPOSTOR KIM? listening on port '+PORT))}
const restored=store.load();if(restored&&typeof restored.then==='function')restored.then(launch).catch(()=>{console.error('Room recovery could not load; service not started');process.exitCode=1});else launch(restored);
if(typeof process.once==='function')process.once('SIGTERM',()=>{store.save(rooms);store.flush().finally(()=>{for(const client of wss.clients||[])client.close();server.close(()=>process.exit(0))})});

module.exports={server,wss,rooms,store};
