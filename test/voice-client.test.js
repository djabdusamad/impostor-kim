const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup(getMedia){
 const messages=[],tracks=[],pcs=[];let room={code:'ABC123',me:'a',host:true,players:[{id:'a',name:'A',connected:true,voice:{joined:false,blocked:false}},{id:'b',name:'B',connected:true,voice:{joined:true,blocked:false,session:'remote'}}]};
 const track={kind:'audio',enabled:true,stopped:false,stop(){this.stopped=true}};tracks.push(track);const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
 class PC{constructor(){this.signalingState='stable';this.connectionState='new';this.remoteDescription=null;this.closed=false;this.candidates=[];pcs.push(this)}addTrack(){}async createOffer(){return{type:'offer',sdp:'v=0\r\nm=audio 9 RTP/AVP 0\r\n'}}async createAnswer(){return{type:'answer',sdp:'v=0\r\nm=audio 9 RTP/AVP 0\r\n'}}async setLocalDescription(d){this.localDescription=d;this.signalingState=d.type==='offer'?'have-local-offer':'stable'}async setRemoteDescription(d){this.remoteDescription=d;this.signalingState=d.type==='offer'?'have-remote-offer':'stable'}async addIceCandidate(c){this.candidates.push(c)}restartIce(){this.restarted=true}close(){this.closed=true}}
 const ctx={window:{addEventListener(){}},document:{querySelector(){return null}},navigator:{mediaDevices:{getUserMedia:getMedia||(()=>Promise.resolve(stream))}},RTCPeerConnection:PC,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},console,Uint8Array};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../voice.js'),'utf8')+'\nthis.Voice=RoomVoice;',ctx);
 const voice=new ctx.Voice({getRoom:()=>room,send:m=>messages.push(m),escape:s=>s});const ack=()=>{voice.message({type:'voiceJoined',session:'local',iceServers:[]});room.players[0].voice={joined:true,muted:true,session:'local'};voice.state(room)};
 return {voice,messages,track,stream,ack,room,pcs,setRoom:r=>room=r}
}
test('microphone starts muted; room session, negotiation, mute and cleanup lifecycle',async()=>{
 const t=setup();await t.voice.join();assert.equal(t.track.enabled,false);assert.equal(t.messages.at(-1).type,'voiceJoin');t.ack();const peer=t.voice.peers.get('b');assert.ok(peer);
 await t.voice.offer(peer);assert.equal(t.messages.at(-1).signal.description.type,'offer');
 t.voice.receive({type:'voiceSignal',from:'b',session:'remote',targetSession:'local',signal:{candidate:{candidate:'candidate:test',sdpMid:'0',sdpMLineIndex:0}}});await peer.chain;assert.equal(peer.candidates.length,1);
 t.voice.receive({from:'b',session:'remote',targetSession:'local',signal:{description:{type:'answer',sdp:'v=0\r\nm=audio 9 RTP/AVP 0\r\n'}}});await peer.chain;assert.equal(peer.candidates.length,0);assert.equal(peer.pc.candidates.length,1);
 t.voice.toggleMute();assert.equal(t.track.enabled,true);assert.equal(t.messages.at(-1).muted,false);t.voice.toggleMute();assert.equal(t.track.enabled,false);
 t.voice.disconnected();assert.equal(t.track.stopped,true);assert.ok(peer.pc.closed);assert.equal(t.voice.session,null);assert.equal(t.voice.wanted,true);assert.equal(t.voice.peers.size,0);
 t.voice.leave(false);assert.equal(t.voice.wanted,false);
});
test('permission denial, canceled permission request and late acknowledgements do not capture',async()=>{
 const denied=setup(()=>Promise.reject(Object.assign(new Error(),{name:'NotAllowedError'})));await denied.voice.join();assert.equal(denied.voice.wanted,false);assert.match(denied.voice.messageText,/ruxsat/);
 let resolve;const pending=setup(()=>new Promise(r=>resolve=r));const request=pending.voice.join();pending.voice.leave(false);resolve(pending.stream);await request;assert.ok(pending.track.stopped);assert.equal(pending.voice.stream,null);assert.equal(pending.messages.length,0);
 pending.voice.message({type:'voiceJoined',session:'late'});assert.equal(pending.messages.at(-1).type,'voiceLeave');
});
test('blocking and player departure close voice; stale signaling cannot create peers',async()=>{
 const t=setup();await t.voice.join();t.ack();const pc=t.pcs[0];t.room.players[1].voice={joined:false};t.voice.state(t.room);assert.ok(pc.closed);assert.equal(t.voice.peers.size,0);
 t.voice.receive({from:'b',session:'remote',targetSession:'local',signal:{restart:true}});assert.equal(t.voice.peers.size,0);
 t.room.players[0].voice={blocked:true,joined:false};t.voice.state(t.room);assert.ok(t.track.stopped);assert.equal(t.voice.wanted,false);assert.equal(t.voice.session,null);
 const count=t.messages.length;await t.voice.join();assert.equal(t.messages.length,count);
});
