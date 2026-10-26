const {test}=require('node:test'),assert=require('node:assert/strict'),{WebSocket}=require('ws'),crypto=require('node:crypto');
test('voice signaling stays inside room and enforces sessions, moderation and reconnection',async()=>{
process.env.PORT=String(42000+Math.floor(Math.random()*5000));process.env.TURN_URLS='turn:relay.example.test:3478,turns:relay.example.test:5349';process.env.TURN_SECRET='test-only-secret';const {server,wss}=require('../server');const clients=[];
try{if(!server.listening)await new Promise(r=>server.once('listening',r));
async function connect(){const ws=new WebSocket('ws://127.0.0.1:'+process.env.PORT);const c={ws,messages:[],send(m){ws.send(JSON.stringify(m))},async wait(fn){for(let n=0;n<200;n++){const i=this.messages.findIndex(fn);if(i>=0)return this.messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,5))}throw Error('Timeout '+fn)}};clients.push(c);ws.on('message',d=>c.messages.push(JSON.parse(d)));await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});return c}
async function enter(type,code){const c=await connect();c.send({type,name:'Test',code,clientId:crypto.randomUUID()});c.joined=await c.wait(m=>m.type==='joined');c.state=await c.wait(m=>m.type==='state');c.id=c.state.me;return c}
const a=await enter('create'),b=await enter('join',a.joined.code),observer=await enter('join',a.joined.code),outsider=await enter('create');
async function voice(c){c.send({type:'voiceJoin'});const joined=await c.wait(m=>m.type==='voiceJoined');c.session=joined.session;return joined}
const aj=await voice(a),bj=await voice(b);await voice(outsider);assert.ok(aj.relayConfigured);const turn=aj.iceServers[1];assert.ok(turn.username.endsWith(':'+a.id));assert.equal(turn.credential,crypto.createHmac('sha1','test-only-secret').update(turn.username).digest('base64'));assert.doesNotMatch(JSON.stringify(aj),/test-only-secret/);
const state=await b.wait(m=>m.type==='state'&&m.players.find(p=>p.id===b.id)?.voice.joined);assert.ok(state.players.find(p=>p.id===b.id).voice.muted);
const signal={description:{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'}};
a.send({type:'voiceSignal',session:a.session,target:b.id,targetSession:b.session,signal,from:'spoof'});const forwarded=await b.wait(m=>m.type==='voiceSignal');assert.equal(forwarded.from,a.id);assert.deepEqual(forwarded.signal,signal);assert.equal(forwarded.targetSession,b.session);
const pause=()=>new Promise(r=>setTimeout(r,40));for(const c of clients)c.messages.length=0;
a.send({type:'voiceSignal',session:a.session,target:outsider.id,targetSession:outsider.session,signal});a.send({type:'voiceSignal',session:'obsolete',target:b.id,targetSession:b.session,signal});a.send({type:'voiceSignal',session:a.session,target:b.id,targetSession:b.session,signal:{description:{type:'offer',sdp:'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n'}}});observer.send({type:'voiceSignal',session:a.session,target:b.id,targetSession:b.session,signal});await pause();for(const c of [b,observer,outsider])assert.ok(!c.messages.some(m=>m.type==='voiceSignal'));
b.send({type:'voiceBlock',target:a.id,blocked:true});await b.wait(m=>m.type==='error');b.send({type:'voiceMute',session:b.session,muted:false});await a.wait(m=>m.type==='state'&&m.players.find(p=>p.id===b.id)?.voice.muted===false);
a.send({type:'voiceBlock',target:b.id,blocked:true});await b.wait(m=>m.type==='voiceBlocked');b.send({type:'voiceJoin'});await b.wait(m=>m.type==='voiceError');
a.send({type:'voiceBlock',target:b.id,blocked:false});await b.wait(m=>m.type==='state'&&m.players.find(p=>p.id===b.id)?.voice.blocked===false);const old=b.session;await voice(b);assert.notEqual(b.session,old);
const resumed=await connect();resumed.send({type:'resume',code:b.joined.code,token:b.joined.token});await resumed.wait(m=>m.type==='joined');const rs=await resumed.wait(m=>m.type==='state');assert.equal(rs.players.find(p=>p.id===b.id).voice.joined,false);resumed.id=b.id;await voice(resumed);assert.notEqual(resumed.session,b.session);
a.send({type:'voiceLeave',session:a.session});await resumed.wait(m=>m.type==='state'&&m.players.find(p=>p.id===a.id)?.voice.joined===false);
assert.equal((await fetch('http://127.0.0.1:'+process.env.PORT+'/voice.js')).status,200);
}finally{for(const c of clients)c.ws.terminate();wss.close();await new Promise(r=>server.close(r))}
});
