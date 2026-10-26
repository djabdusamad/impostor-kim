const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
function game(total=7){
 let hub,tick;
 class Socket extends EventEmitter{constructor(){super();this.readyState=1;this.messages=[]}send(raw){this.messages.push(JSON.parse(raw))}close(){this.readyState=3;this.emit('close')}request(m){this.emit('message',JSON.stringify(m))}take(type){return this.messages.filter(m=>m.type===type).at(-1)}}
 class Hub extends EventEmitter{constructor(){super();hub=this}}
 const ctx={require:n=>n==='http'?{createServer:()=>({listen(){}})}:n==='ws'?{WebSocketServer:Hub,WebSocket:{OPEN:1}}:n.startsWith('./')?require(path.join(__dirname,'..',n)):require(n),__dirname:path.join(__dirname,'..'),process:{env:{}},console:{log(){}},module:{exports:{}},setInterval(fn){tick=fn;return{unref(){}}},Date};
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
 resumed.request({type:'voiceJoin'});assert.ok(resumed.take('voiceError'));resumed.request({type:'chatSend',text:'secret',nonce:'dead'});assert.ok(resumed.take('chatError'));
 for(const c of g.alive())c.request({type:'vote',target:id(c===civilian?g.alive().find(x=>x!==c):civilian)});
 assert.equal(room.phase,'discussion');assert.equal(room.cycle,3);assert.equal(room.eliminated.length,2);
 host.request({type:'voteStart'});const active=g.alive();for(let i=0;i<active.length;i++)active[i].request({type:'vote',target:id(active[(i+1)%active.length])});assert.equal(room.phase,'discussion');assert.equal(room.cycle,4);assert.equal(room.lastVote.target,null);assert.equal(room.eliminated.length,2);
 g.eliminate(imps[1]);assert.equal(room.phase,'results');assert.equal(room.results.caught,true);assert.equal(room.results.word,word);assert.equal(room.eliminated.length,3);
 host.request({type:'reset'});assert.equal(room.phase,'lobby');assert.equal(room.eliminated.length,0);assert.equal(room.lastVote,null);assert.equal(room.cycle,1);
});
test('impostors win at parity; empty vote restarts without eliminating anyone',()=>{
 const g=game(5),{host,room}=g;host.request({type:'voteStart'});host.request({type:'reveal'});assert.equal(room.phase,'discussion');assert.equal(room.cycle,2);assert.equal(room.eliminated.length,0);
 g.eliminate(g.players.find(c=>!c.take('role').impostor));assert.equal(room.phase,'results');assert.equal(room.results.caught,false);
});
