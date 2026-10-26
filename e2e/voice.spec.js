const {test,expect}=require('@playwright/test');
test('two browsers exchange audio, display speech, mute, reconnect and enforce host blocks',async({browser})=>{
 const contexts=await Promise.all([browser.newContext({permissions:['microphone']}),browser.newContext({permissions:['microphone']})]);const [host,guest]=await Promise.all(contexts.map(c=>c.newPage()));const errors=[];for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));
 try{
 await host.goto('http://127.0.0.1:3187/online.html');await expect(host.locator('#status')).toContainText('ONLAYN');await host.locator('#create-room-choice').click();await host.locator('#name').fill('Host');await host.getByRole('button',{name:'XONA YARATISH'}).click();await expect(host.locator('.code')).toBeVisible();const code=(await host.locator('.code').innerText()).trim();
 await guest.goto('http://127.0.0.1:3187/online.html');await expect(guest.locator('#status')).toContainText('ONLAYN');await guest.locator('#join-with-code').click();await guest.locator('#name').fill('Guest');await guest.locator('#code').fill(code);await guest.getByRole('button',{name:'QO‘SHILISH',exact:false}).click();await expect(guest.locator('.code')).toBeVisible();
 for(const p of [host,guest]){await p.getByRole('button',{name:'Ovozli suhbatga qo‘shilish'}).click();await expect(p.locator('#voice-mute')).toBeVisible();expect(await p.evaluate(()=>voice.stream.getAudioTracks()[0].enabled)).toBe(false)}
 await expect.poll(()=>host.evaluate(()=>[...voice.peers.values()].map(p=>p.pc.connectionState)),{timeout:30000}).toEqual(['connected']);await expect.poll(()=>guest.evaluate(()=>[...voice.peers.values()].map(p=>p.pc.connectionState)),{timeout:30000}).toEqual(['connected']);
 await host.locator('#voice-mute').click();await guest.locator('#voice-mute').click();
 async function received(page){return page.evaluate(async()=>{let bytes=0;for(const p of voice.peers.values())for(const stat of (await p.pc.getStats()).values())if(stat.type==='inbound-rtp'&&stat.kind==='audio')bytes+=stat.bytesReceived||0;return bytes})}
 await expect.poll(()=>received(host),{timeout:15000}).toBeGreaterThan(0);await expect.poll(()=>received(guest),{timeout:15000}).toBeGreaterThan(0);
 await expect(host.locator('.voice-person.speaking').filter({hasText:'Guest'})).toBeVisible({timeout:15000});
 await guest.locator('#voice-mute').click();expect(await guest.evaluate(()=>voice.stream.getAudioTracks()[0].enabled)).toBe(false);
 const oldSession=await guest.evaluate(()=>voice.session);await guest.evaluate(()=>ws.close());await expect.poll(()=>guest.evaluate(()=>voice.session),{timeout:20000}).not.toBe(oldSession);await expect(guest.locator('#voice-mute')).toBeVisible({timeout:20000});expect(await guest.evaluate(()=>voice.stream.getAudioTracks()[0].enabled)).toBe(false);
 await expect.poll(()=>guest.evaluate(()=>[...voice.peers.values()].map(p=>p.pc.connectionState)),{timeout:30000}).toEqual(['connected']);
 await host.locator('.voice-person').filter({hasText:'Guest'}).getByRole('button',{name:'Ovozini bloklash'}).click();await expect(guest.locator('#voice-join')).toBeDisabled();expect(await guest.evaluate(()=>voice.stream)).toBe(null);await expect.poll(()=>host.evaluate(()=>voice.peers.size)).toBe(0);
 await host.locator('.voice-person').filter({hasText:'Guest'}).getByRole('button',{name:'Ruxsat berish'}).click();await expect(guest.locator('#voice-join')).toBeEnabled();await guest.locator('#voice-join').click();await expect(guest.locator('#voice-mute')).toBeVisible();
 await guest.locator('#voice-leave').click();expect(await guest.evaluate(()=>voice.stream)).toBe(null);await host.locator('#voice-leave').click();expect(await host.evaluate(()=>voice.stream)).toBe(null);expect(errors).toEqual([]);
 }finally{await Promise.all(contexts.map(c=>c.close()))}
});
