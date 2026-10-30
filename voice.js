/* Optional audio-only room chat. No capture starts until the player chooses Join. */
class RoomVoice {
  constructor({getRoom,send,escape}) {
    this.getRoom=getRoom;this.send=send;this.esc=escape;this.peers=new Map();
    this.stream=null;this.session=null;this.listening=false;this.wanted=false;this.busy=false;this.muted=true;
    this.open=true;this.generation=0;this.messageText='';this.iceServers=[];this.relay=false;
    this.audioContext=null;this.meters=new Map();this.interval=null;this.playBlocked=false;
    this.boundPageHide=()=>this.leave(true);
    window.addEventListener('pagehide',this.boundPageHide);
  }
  state(room) {
    if(!room){if(this.stream||this.busy)this.leave(false);return}
    const me=room.players.find(p=>p.id===room.me);
    if(me?.eliminated&&['roles','discussion','voting','guessing'].includes(room.phase)&&(this.stream||this.busy||this.wanted)&&!this.listening){this.leave(false);this.messageText='Siz chiqarilgansiz. Suhbatni faqat tinglashingiz mumkin.'}
    if(me?.voice?.blocked&&(this.stream||this.busy||this.wanted)){
      this.leave(false);this.messageText='Boshlovchi ovozingizni bloklagan.';
    }
    if(this.session&&me?.voice?.session!==this.session){
      // A replaced socket or obsolete voice session must not keep sending audio.
      this.leave(false);this.messageText='Ovozli sessiya tugadi. Qayta qo‘shiling.';
    }
    if(this.session&&this.stream){
      const active=room.players.filter(p=>p.id!==room.me&&p.connected&&p.voice?.joined&&!p.voice.blocked&&!(this.listening&&p.voice.listening));
      for(const [id,peer] of this.peers){if(!active.some(p=>p.id===id&&p.voice.session===peer.session))this.drop(id)}
      for(const p of active){if(!this.peers.has(p.id))this.createPeer(p)}
    }
    this.render();
    if(this.wanted&&!this.stream&&!this.busy&&!me?.voice?.blocked)this.join(true);
  }
  async join(reconnecting=false) {
    const room=this.getRoom(),me=room?.players.find(p=>p.id===room.me);const listening=!!me?.eliminated&&['roles','discussion','voting','guessing'].includes(room?.phase);
    if(!room||this.busy||this.stream||me?.voice?.blocked)return;
    if(!listening&&!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==='undefined'){
      this.messageText='Bu brauzer ovozli suhbatni qo‘llamaydi. HTTPS orqali zamonaviy brauzerdan kiring.';this.render();return;
    }
    this.wanted=true;this.busy=true;this.muted=true;this.listening=listening;this.messageText=reconnecting?'Ovozli suhbatga qayta ulanmoqda…':'Mikrofonga ruxsat bering. Ulanishda mikrofon o‘chiq bo‘ladi.';
    const generation=++this.generation;this.render();
    try {
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(AudioCtx){this.audioContext=new AudioCtx();this.audioContext.resume().catch(()=>{})}
      const stream=listening?new MediaStream():await navigator.mediaDevices.getUserMedia({video:false,audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      if(generation!==this.generation||!this.getRoom()||this.getRoom().code!==room.code){stream.getTracks().forEach(t=>t.stop());return}
      this.stream=stream;stream.getAudioTracks().forEach(track=>{track.enabled=false;track.onended=()=>{if(this.stream===stream){this.leave(true);this.messageText='Mikrofon uzildi. Qurilmani tekshirib, qayta qo‘shiling.';this.render()}}});
      this.addMeter(room.me,stream);this.send({type:'voiceJoin'});
      this.joinTimeout=setTimeout(()=>{if(!this.session&&generation===this.generation){this.leave(true);this.messageText='Ovozli suhbatga ulanish amalga oshmadi. Qayta urinib ko‘ring.';this.render()}},12000);
    } catch(e) {
      if(generation!==this.generation)return;
      this.leave(false);this.messageText=e.name==='NotAllowedError'?'Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat berib, qayta urinib ko‘ring.':e.name==='NotFoundError'?'Mikrofon topilmadi. Uni ulang va qayta urinib ko‘ring.':'Mikrofonni ochib bo‘lmadi. Boshqa ilova undan foydalanmayotganini tekshiring.';
    } finally {this.render()}
  }
  message(m) {
    if(m.type==='voiceJoined'){
      if(!this.stream||!this.wanted){this.send({type:'voiceLeave',session:m.session});return}
      clearTimeout(this.joinTimeout);this.session=m.session;this.listening=!!m.listening;this.busy=false;this.iceServers=m.iceServers||[];this.relay=!!m.relayConfigured;
      this.messageText=this.listening?'Suhbatni tinglayapsiz. Mikrofoningiz ulanmagan.':'Ulandingiz. Gapirish uchun mikrofonni yoqing.';this.render();return;
    }
    if(m.type==='voiceBlocked'||m.type==='voiceError'){this.leave(false);this.messageText=m.message;this.render();return}
    if(m.type==='voiceSignal')this.receive(m);
  }
  createPeer(player) {
    const room=this.getRoom();if(!this.stream||!this.session||!room||this.listening&&player.voice.listening)return null;
    const pc=new RTCPeerConnection({iceServers:this.iceServers});
    const peer={id:player.id,session:player.voice.session,pc,offerer:!this.listening&&(player.voice.listening||room.me<player.id),chain:Promise.resolve(),candidates:[],attempts:0,failed:false,audio:null};
    this.peers.set(player.id,peer);
    if(this.listening)pc.addTransceiver('audio',{direction:'recvonly'});else if(player.voice.listening){for(const track of this.stream.getAudioTracks())pc.addTransceiver(track,{direction:'sendonly',streams:[this.stream]})}else this.stream.getAudioTracks().forEach(track=>pc.addTrack(track,this.stream));
    pc.onicecandidate=event=>{if(this.peers.get(peer.id)!==peer)return;this.signal(peer,{candidate:event.candidate?{candidate:event.candidate.candidate,sdpMid:event.candidate.sdpMid,sdpMLineIndex:event.candidate.sdpMLineIndex}:null})};
    pc.ontrack=event=>{
      if(event.track.kind!=='audio'||this.peers.get(peer.id)!==peer||this.getRoom()?.players.find(p=>p.id===peer.id)?.voice?.listening)return;
      const stream=event.streams[0]||new MediaStream([event.track]);
      if(!peer.audio){peer.audio=document.createElement('audio');peer.audio.autoplay=true;peer.audio.setAttribute('playsinline','');document.querySelector('#voice-audio').appendChild(peer.audio)}
      peer.audio.srcObject=stream;peer.audio.play().catch(()=>{this.playBlocked=true;this.render()});this.addMeter(peer.id,stream);
    };
    // Exactly one deterministic offerer per pair avoids offer glare, including ICE restarts.
    pc.onnegotiationneeded=()=>{if(peer.offerer)this.offer(peer)};
    pc.onconnectionstatechange=()=>{
      if(this.peers.get(peer.id)!==peer)return;
      if(pc.connectionState==='connected'){peer.failed=false;clearTimeout(peer.retryTimer);this.render()}
      if(pc.connectionState==='failed'){peer.failed=true;this.restart(peer);this.render()}
      if(pc.connectionState==='disconnected'){
        clearTimeout(peer.retryTimer);peer.retryTimer=setTimeout(()=>{if(this.peers.get(peer.id)===peer&&pc.connectionState==='disconnected'){peer.failed=true;this.restart(peer);this.render()}},5000);
      }
    };
    peer.connectTimer=setTimeout(()=>{if(this.peers.get(peer.id)===peer&&pc.connectionState!=='connected'){peer.failed=true;this.restart(peer);this.render()}},20000);
    return peer;
  }
  queue(peer,fn) {
    peer.chain=peer.chain.then(async()=>{if(this.peers.get(peer.id)===peer)await fn()}).catch(()=>{if(this.peers.get(peer.id)===peer){peer.failed=true;this.render()}});
    return peer.chain;
  }
  offer(peer) {
    return this.queue(peer,async()=>{if(peer.pc.signalingState!=='stable')return;await peer.pc.setLocalDescription(await peer.pc.createOffer());this.signal(peer,{description:{type:peer.pc.localDescription.type,sdp:peer.pc.localDescription.sdp}})});
  }
  signal(peer,signal) {
    if(this.session&&this.peers.get(peer.id)===peer)this.send({type:'voiceSignal',target:peer.id,session:this.session,targetSession:peer.session,signal});
  }
  receive(m) {
    const room=this.getRoom();if(!room||!this.stream||m.targetSession!==this.session)return;
    const player=room.players.find(p=>p.id===m.from&&p.voice?.joined&&p.voice.session===m.session&&!p.voice.blocked);
    if(!player)return;
    const peer=this.peers.get(player.id)||this.createPeer(player);if(!peer||peer.session!==m.session)return;
    this.queue(peer,async()=>{
      const signal=m.signal||{};
      if(signal.restart){if(peer.offerer)this.restart(peer);return}
      if(signal.description){
        const d=signal.description;
        if(d.type==='offer'&&peer.offerer||d.type==='answer'&&!peer.offerer)return;
        if(/^m=(video|application) /m.test(d.sdp)||!/^m=audio /m.test(d.sdp))return;
        await peer.pc.setRemoteDescription(d);
        for(const candidate of peer.candidates)await peer.pc.addIceCandidate(candidate);peer.candidates=[];
        if(d.type==='offer'){await peer.pc.setLocalDescription(await peer.pc.createAnswer());this.signal(peer,{description:{type:peer.pc.localDescription.type,sdp:peer.pc.localDescription.sdp}})}
      } else if(Object.hasOwn(signal,'candidate')) {
        if(peer.pc.remoteDescription)await peer.pc.addIceCandidate(signal.candidate);else if(peer.candidates.length<100)peer.candidates.push(signal.candidate);
      }
    });
  }
  restart(peer) {
    if(peer.attempts>=2||this.peers.get(peer.id)!==peer)return;peer.attempts++;
    if(peer.offerer){if(peer.pc.restartIce)peer.pc.restartIce()}else this.signal(peer,{restart:true});
  }
  toggleMute() {
    if(!this.stream||!this.session||this.listening)return;this.muted=!this.muted;this.audioContext?.resume().catch(()=>{});
    this.stream.getAudioTracks().forEach(t=>t.enabled=!this.muted);
    this.send({type:'voiceMute',session:this.session,muted:this.muted});this.render();
  }
  async enablePlayback() {
    this.playBlocked=false;await this.audioContext?.resume().catch(()=>{});
    for(const peer of this.peers.values()){if(peer.audio)await peer.audio.play().catch(()=>{this.playBlocked=true})}this.render();
  }
  drop(id) {
    const peer=this.peers.get(id);if(!peer)return;this.peers.delete(id);
    clearTimeout(peer.retryTimer);clearTimeout(peer.connectTimer);peer.pc.onconnectionstatechange=null;peer.pc.onicecandidate=null;peer.pc.ontrack=null;peer.pc.onnegotiationneeded=null;peer.pc.close();
    if(peer.audio){peer.audio.pause();peer.audio.srcObject=null;peer.audio.remove()}
    this.removeMeter(id);
  }
  leave(notify=true,preserveIntent=false) {
    const session=this.session;if(notify&&session)this.send({type:'voiceLeave',session});
    this.generation++;this.busy=false;this.session=null;if(!preserveIntent)this.wanted=false;
    clearTimeout(this.joinTimeout);for(const id of [...this.peers.keys()])this.drop(id);
    if(this.stream){const stream=this.stream;this.stream=null;stream.getTracks().forEach(t=>{t.onended=null;t.stop()})}
    for(const id of [...this.meters.keys()])this.removeMeter(id);
    clearInterval(this.interval);this.interval=null;this.audioContext?.close().catch(()=>{});this.audioContext=null;this.playBlocked=false;this.muted=true;this.render();
  }
  disconnected() {
    const wanted=this.wanted;this.leave(false,true);this.wanted=wanted;
    this.messageText=wanted?'Aloqa uzildi. Internet qaytganda ovozli suhbatga qayta ulanadi; mikrofon o‘chiq bo‘ladi.':'';this.render();
  }
  reconnect() {this.leave(true);this.join()}
  addMeter(id,stream) {
    this.removeMeter(id);if(!this.audioContext)return;
    try{const source=this.audioContext.createMediaStreamSource(stream),analyser=this.audioContext.createAnalyser();analyser.fftSize=512;source.connect(analyser);this.meters.set(id,{source,analyser,data:new Uint8Array(analyser.fftSize)});
      if(!this.interval)this.interval=setInterval(()=>this.updateMeters(),200);
    }catch{}
  }
  removeMeter(id) {const meter=this.meters.get(id);if(meter){try{meter.source.disconnect()}catch{}this.meters.delete(id)}}
  updateMeters() {
    const room=this.getRoom();if(!room)return;
    for(const [id,meter] of this.meters){meter.analyser.getByteTimeDomainData(meter.data);let sum=0;for(const v of meter.data)sum+=((v-128)/128)**2;const active=Math.sqrt(sum/meter.data.length)>.025&&!(id===room.me&&this.muted);const row=document.querySelector('[data-voice-id="'+id+'"]');row?.classList.toggle('speaking',active)}
  }
  block(id,blocked) {this.send({type:'voiceBlock',target:id,blocked})}
  render() {
    const panel=document.querySelector('#voice-panel'),room=this.getRoom();if(!panel||!room)return;
    const me=room.players.find(p=>p.id===room.me),esc=this.esc,watching=me?.eliminated&&['roles','discussion','voting','guessing'].includes(room.phase);
    const active=room.players.filter(p=>p.voice?.joined||p.voice?.blocked);
    const supported=(watching||!!navigator.mediaDevices?.getUserMedia)&&typeof RTCPeerConnection!=='undefined';
    panel.innerHTML=`<button type="button" class="comms-heading" id="voice-toggle" aria-expanded="${this.open}" aria-controls="voice-body"><span class="comms-icon voice-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg></span><strong>Ovozli suhbat</strong><span class="comms-count">${active.filter(p=>p.voice?.joined).length} kishi</span><span class="comms-chevron" aria-hidden="true">${this.open?'⌃':'⌄'}</span></button><div id="voice-body" ${this.open?'':'hidden'}><p class="voice-message" role="status">${!supported?'Bu brauzer ovozli suhbatni qo‘llamaydi.':me?.voice?.blocked?'Boshlovchi ovozingizni bloklagan.':esc(this.messageText)}</p><div class="voice-actions">${this.stream&&this.session?`${this.listening?'<span class="help">Faqat tinglash</span>':`<button class="btn ${this.muted?'':'danger'}" id="voice-mute" aria-pressed="${!this.muted}">${this.muted?'Mikrofonni yoqish':'Mikrofonni o‘chirish'}</button>`}<button class="btn light" id="voice-leave">Chiqish</button>`:this.busy?'<button class="btn light" id="voice-leave">Bekor qilish</button>':`<button class="btn" id="voice-join" ${!supported||me?.voice?.blocked?'disabled':''}>${watching?'Suhbatni tinglash':'Ovozli suhbatga qo‘shilish'}</button>`}${this.listening&&!watching?'<button class="btn light" id="voice-retry">Mikrofon bilan qayta ulanish</button>':''}${this.playBlocked?'<button class="btn light" id="voice-play">Ovozni eshitishga ruxsat</button>':''}${[...this.peers.values()].some(p=>p.failed)?'<button class="btn light" id="voice-retry">Ovozni qayta ulash</button>':''}</div>${active.map(p=>{const peer=this.peers.get(p.id);return `<div class="voice-person" data-voice-id="${p.id}"><span class="voice-dot" aria-hidden="true"></span><span class="name">${esc(p.name)}${p.id===room.me?' (siz)':''}</span><span class="voice-status">${p.voice.blocked?'Bloklangan':p.voice.listening?'Faqat tinglash':p.voice.muted?'Mikrofon o‘chiq':p.id===room.me?'Mikrofon yoqilgan':!this.session?'Ovozda':peer?.pc.connectionState==='connected'?'Ulangan':peer?.failed?'Ulanmadi':'Ulanmoqda…'}</span>${room.host&&p.id!==room.me?`<button data-voice-block="${p.id}" data-blocked="${p.voice.blocked?'false':'true'}">${p.voice.blocked?'Ruxsat berish':'Ovozini bloklash'}</button>`:''}</div>`}).join('')}</div>`;
    const bind=(id,fn)=>{const el=document.querySelector(id);if(el)el.onclick=fn};
    bind('#voice-toggle',()=>{this.open=!this.open;this.render();document.querySelector('#voice-toggle')?.focus({preventScroll:true})});bind('#voice-join',()=>this.join());bind('#voice-leave',()=>{this.leave();this.messageText='Ovozli suhbatdan chiqdingiz.';this.render()});bind('#voice-mute',()=>this.toggleMute());bind('#voice-play',()=>this.enablePlayback());bind('#voice-retry',()=>this.reconnect());
    panel.querySelectorAll('[data-voice-block]').forEach(el=>el.onclick=()=>this.block(el.dataset.voiceBlock,el.dataset.blocked==='true'));
  }
}
