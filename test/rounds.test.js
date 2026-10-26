const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
function game(total=7,{env={},verify=null}={}){
 let hub,tick;
 class Socket extends EventEmitter{constructor(){super();this.readyState=1;this.messages=[]}send(raw){this.messages.push(JSON.parse(raw))}close(){this.readyState=3;this.emit('close')}request(m){this.emit('message',JSON.stringify(m))}take(type){return this.messages.filter(m=>m.type===type).at(-1)}}
 class Hub extends EventEmitter{constructor(){super();hub=this}}
 const ctx={require:n=>n==='./telegram-auth.js'&&verify?{verifyTelegram:verify}:n==='http'?{createServer:()=>({listen(){}})}:n==='ws'?{WebSocketServer:Hub,WebSocket:{OPEN:1}}:n.startsWith('./')?require(path.join(__dirname,'..',n)):require(n),__dirname:path.join(__dirname,'..'),process:{env},console:{log(){}},module:{exports:{}},setInterval(fn){tick=fn;return{unref(){}}},Date};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server.js'),'utf8'),ctx);
 const connect=()=>{const c=new Socket();hub.emit('connection',c,{});return c},host=connect();host.request({type:'create',name:'Host',clientId:require('crypto').randomUUID()});const code=host.take('joined').code,players=[host];
 for(let i=1;i<total;i++){const c=connect();c.request({type:'join',code,name:'P'+i,clientId:require('crypto').randomUUID()});players.push(c)}
 host.request({type:'settings',category:'Tasodifiy',impostors:2,minutes:7,timed:true,hints:false,knowEachOther:false});host.request({type:'start'});
 const room=ctx.module.exports.rooms.get(code),id=c=>c.take('state').me;
 const alive=()=>players.filter(c=>!room.eliminated.includes(id(c)));
 const eliminate=target=>{host.request({type:'voteStart'});for(const c of alive())c.request({type:'vote',target:id(c===target?alive().find(x=>x!==c):target)})};
 return {host,players,room,id,alive,eliminate,connect,code,tick:()=>tick()};
}
test('two impostors: repeated votes, timer reset, spectator authority, privacy, reconnect and final win',()=>{
 const g=game(),{host,room,id}=g,imps=g.players.filter(c=>c.take('role').impostor).sort((a,b)=>(a===host)-(b===host));
 host.request({type:'discuss'});room.deadline=Date.now()-1;g.tick();assert.equal(room.phase,'voting');
 const word=room.word;g.eliminate(imps[0]);assert.equal(room.phase,'discussion');assert.equal(room.cycle,2);assert.equal(room.eliminated.length,1);assert.equal(room.votes.size,0);assert.equal(room.word,word);assert.ok(Math.abs(room.deadline-Date.now()-420000)<1000);
 assert.equal(host.take('state').results,undefined);assert.equal(host.take('state').word,undefined);assert.equal(host.take('state').impostors,undefined);assert.equal(host.take('state').lastVote.impostor,true);
 const dead=imps[0],token=dead.take('joined').token,resumed=g.connect();resumed.request({type:'resume',code:g.code,token});assert.equal(resumed.take('state').players.find(p=>p.id===id(dead)).eliminated,true);assert.equal(resumed.take('role').word,null);assert.equal(resumed.take('role').partners.length,0);
 host.request({type:'voteStart'});resumed.request({type:'vote',target:id(imps[1])});assert.equal(room.votes.size,0);
 const civilian=g.alive().find(c=>!c.take('role').impostor);civilian.request({type:'vote',target:id(dead)});assert.equal(room.votes.size,0);
 resumed.request({type:'voiceJoin'});assert.equal(resumed.take('voiceJoined').listening,true);resumed.request({type:'chatSend',text:'secret',nonce:'dead'});assert.ok(resumed.take('chatError'));
 for(const c of g.alive())c.request({type:'vote',target:id(c===civilian?g.alive().find(x=>x!==c):civilian)});
 assert.equal(room.phase,'discussion');assert.equal(room.cycle,3);assert.equal(room.eliminated.length,2);
 host.request({type:'voteStart'});const active=g.alive();for(let i=0;i<active.length;i++)active[i].request({type:'vote',target:id(active[(i+1)%active.length])});assert.equal(room.phase,'discussion');assert.equal(room.cycle,4);assert.equal(room.lastVote.target,null);assert.equal(room.eliminated.length,2);
 g.eliminate(imps[1]);assert.equal(room.phase,'results');assert.equal(room.results.caught,true);assert.equal(room.results.word,word);assert.equal(room.eliminated.length,3);
 host.request({type:'reset'});assert.equal(room.phase,'lobby');assert.equal(room.eliminated.length,0);assert.equal(room.lastVote,null);assert.equal(room.cycle,1);
});
test('impostors win at parity; empty vote restarts without eliminating anyone',()=>{
 const g=game(5),{host,room}=g;host.request({type:'voteStart'});host.request({type:'reveal'});assert.equal(room.phase,'voting');room.deadline=Date.now()-1;g.tick();assert.equal(room.phase,'discussion');assert.equal(room.cycle,2);assert.equal(room.eliminated.length,0);
 g.eliminate(g.players.find(c=>!c.take('role').impostor));assert.equal(room.phase,'results');assert.equal(room.results.caught,false);
});
test('voting deadline, abstention, majority quorum and no premature host finish',()=>{
 const g=game(),{host,room}=g;host.request({type:'voteStart'});assert.ok(Math.abs(room.deadline-Date.now()-45000)<1000);host.request({type:'reveal'});assert.equal(room.phase,'voting');assert.ok(host.take('error'));
 const target=g.players.find(c=>c!==host);host.request({type:'vote',target:g.id(target)});room.deadline=Date.now()-1;g.tick();assert.equal(room.phase,'discussion');assert.equal(room.eliminated.length,0);assert.equal(room.lastVote.quorum,false);
 host.request({type:'voteStart'});for(const c of g.alive())c.request({type:'vote',target:null});assert.equal(room.phase,'discussion');assert.equal(room.eliminated.length,0);
});
test('host fails over after grace; leaving players and spectators never reset the game',()=>{
 const g=game(),{room,host}=g;host.close();const hostPlayer=room.players.find(p=>p.id===g.id(host));hostPlayer.disconnectedAt=Date.now()-31000;g.tick();assert.notEqual(room.host,hostPlayer.id);const newHost=g.players.find(p=>g.id(p)===room.host);assert.equal(newHost.take('state').host,true);const returning=g.connect();returning.request({type:'resume',code:g.code,token:host.take('joined').token});assert.equal(returning.take('state').host,false);returning.request({type:'voteStart'});assert.ok(returning.take('error'));
 const civilian=g.players.find(c=>c!==host&&c!==newHost&&!c.take('role').impostor);civilian.request({type:'leave'});assert.notEqual(room.phase,'lobby');assert.equal(room.word!==null,true);assert.equal(room.players.find(p=>p.id===g.id(civilian)).left,true);
 const spectator=room.players.find(p=>!p.left&&p.id!==room.host);room.eliminated.push(spectator.id);const before=room.phase;g.players.find(c=>g.id(c)===spectator.id).request({type:'leave'});assert.equal(room.phase,before);
});
test('final impostor gets one timed guess; other players cannot guess or see the word',()=>{
 for(const correct of [true,false]){const g=game(5),{room,host}=g;room.settings.finalGuess=true;const imps=g.players.filter(c=>c.take('role').impostor);g.eliminate(imps[0]);g.eliminate(imps[1]);assert.equal(room.phase,'guessing');assert.equal(host.take('state').results,undefined);assert.equal(host.take('state').word,undefined);
 const other=g.players.find(c=>c!==imps[1]);other.request({type:'guess',word:room.word});assert.equal(room.phase,'guessing');imps[1].request({type:'guess',word:correct?room.word.toUpperCase():'wrong answer'});assert.equal(room.phase,'results');assert.equal(room.results.caught,!correct)}
 const g=game(5);g.room.settings.finalGuess=true;for(const imp of g.players.filter(c=>c.take('role').impostor))g.eliminate(imp);g.room.deadline=Date.now()-1;g.tick();assert.equal(g.room.results.caught,true);
});
test('listener cannot unmute or negotiate sending audio; verified-only rooms block anonymous rejoin',()=>{
 const g=game(5),{room,host}=g,imp=g.players.find(c=>c!==host&&c.take('role').impostor);g.eliminate(imp);imp.request({type:'voiceJoin'});const joined=imp.take('voiceJoined'),p=room.players.find(p=>p.id===g.id(imp));assert.equal(joined.listening,true);imp.request({type:'voiceMute',session:joined.session,muted:false});assert.equal(p.voice.muted,true);
 host.request({type:'voiceJoin'});const target=host.take('voiceJoined');let before=host.messages.length;imp.request({type:'voiceSignal',session:joined.session,target:g.id(host),targetSession:target.session,signal:{description:{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=sendrecv\r\n'}}});assert.equal(host.messages.length,before);imp.request({type:'voiceSignal',session:joined.session,target:g.id(host),targetSession:target.session,signal:{description:{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=recvonly\r\n'}}});assert.equal(host.take('voiceSignal').from,p.id);
 const verified=game(5,{env:{TELEGRAM_BOT_ID:'8853819117'},verify:raw=>raw==='signed-user'?{id:'123'}:null});verified.room.phase='lobby';verified.room.settings.verifiedOnly=true;const guest=verified.connect();guest.request({type:'join',code:verified.code,name:'Guest',clientId:require('crypto').randomUUID()});assert.ok(guest.take('error'));guest.request({type:'join',code:verified.code,name:'Verified',clientId:require('crypto').randomUUID(),telegramInit:'signed-user'});assert.ok(guest.take('joined'));verified.host.request({type:'kick',target:guest.take('state').me});assert.ok(guest.take('kicked'));const again=verified.connect();again.request({type:'join',code:verified.code,name:'Renamed',clientId:require('crypto').randomUUID(),telegramInit:'signed-user'});assert.ok(again.take('kicked'));const fake=verified.connect();fake.request({type:'join',code:verified.code,name:'Fake',clientId:require('crypto').randomUUID(),telegramInit:'fake'});assert.ok(fake.take('error'));
});
