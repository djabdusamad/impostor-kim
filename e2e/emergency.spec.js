const {test,expect}=require('@playwright/test');
test('emergency button confirms, is host-only and keeps the room for replay',async({browser})=>{
 const contexts=await Promise.all(Array.from({length:3},()=>browser.newContext())),pages=await Promise.all(contexts.map(c=>c.newPage()));try{
 const host=pages[0];await host.goto('/online.html');await host.locator('#create-room-choice').click();await host.locator('#create-settings-continue').click();await host.locator('#name').fill('Host');await host.locator('#name-continue').click();if(await host.evaluate(()=>entryIntent==='create'&&!!entryName.trim())){await host.locator('#lobby-settings').waitFor();await host.locator('#lobby-settings').evaluate(el=>el.open=true);}const code=await host.locator('.code').getAttribute('data-code');
 for(let i=1;i<3;i++){await pages[i].goto('/online.html?room='+code);await pages[i].locator('#name').fill('Guest'+i);await pages[i].locator('#name-continue').click();await expect(pages[i].locator('.waiting-card')).toBeVisible()}
 await host.getByRole('button',{name:'O‘yinni boshlash',exact:true}).click();await expect(host.locator('#emergency-end')).toBeVisible();await expect(pages[1].locator('#emergency-end')).toHaveCount(0);
 host.once('dialog',d=>d.dismiss());await host.locator('#emergency-end').click();expect(await host.evaluate(()=>room.phase)).toBe('roles');
 host.once('dialog',d=>d.accept());await host.locator('#emergency-end').click();for(const p of pages){await expect(p.locator('.waiting-card')).toBeVisible();expect(await p.evaluate(()=>role)).toBeNull();expect(await p.evaluate(()=>room.players.length)).toBe(3)}
 await pages[1].reload();await expect(pages[1].locator('.waiting-card')).toBeVisible();await host.getByRole('button',{name:'O‘yinni boshlash',exact:true}).click();for(const p of pages)await p.waitForFunction(()=>room.phase==='roles'&&role!==null);
 }finally{await Promise.all(contexts.map(c=>c.close()))}
});
test('offline emergency button cancels timers and keeps players',async({page})=>{await page.goto('/index.html');await page.evaluate(()=>{state.names=['A','B','C'];startLocal();state.screen='discuss';state.running=true;render()});page.once('dialog',d=>d.accept());await page.locator('#emergency-end').click();expect(await page.evaluate(()=>({screen:state.screen,round:state.round,running:state.running,names:state.names}))).toEqual({screen:'setup',round:null,running:false,names:['A','B','C']});await expect(page.locator('#emergency-end')).toHaveCount(0)});

