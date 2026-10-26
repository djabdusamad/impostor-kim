const {test,expect}=require('@playwright/test');
test('online civilian win reflects actual votes and supports replay',async({browser})=>{
 const contexts=await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()]);
 const pages=await Promise.all(contexts.map(c=>c.newPage()));const names=['Host','Wade','SSS'];
 try{
  const host=pages[0];await host.goto('http://127.0.0.1:3187/online.html');await expect(host.locator('#status')).toContainText('ONLAYN');await host.locator('#create-room-choice').click();await host.locator('#name').fill(names[0]);await host.locator('#name-continue').click();await expect(host.locator('.waiting-card')).toBeVisible();const code=await host.locator('.code').getAttribute('data-code');
  for(let i=1;i<3;i++){const p=pages[i];await p.goto('http://127.0.0.1:3187/online.html');await expect(p.locator('#status')).toContainText('ONLAYN');await p.locator('#join-with-code').click();await p.locator('#code').fill(code);await p.locator('#code').press('Enter');await expect(p.locator('#name')).toBeVisible();await p.locator('#name').fill(names[i]);await p.locator('#name-continue').click();await expect(p.locator('.waiting-card')).toBeVisible()}
  await expect(host.locator('.lobby-player-list .player')).toHaveCount(3);await host.getByRole('button',{name:'O‘yinni boshlash',exact:true}).click();const roles=[];
  for(const p of pages){await p.waitForFunction(()=>role!==null);roles.push(await p.evaluate(()=>({id:room.me,impostor:role.impostor,name:room.players.find(p=>p.id===room.me).name})))}const impostor=roles.find(r=>r.impostor);
  await host.getByRole('button',{name:'MUHOKAMANI BOSHLASH →',exact:true}).click();await host.getByRole('button',{name:'OVOZ BERISH →',exact:true}).click();
  for(let i=0;i<3;i++){const p=pages[i];await p.waitForFunction(()=>room?.phase==='voting');const target=roles[i].id===impostor.id?roles.find(r=>r.id!==impostor.id):impostor;await p.getByRole('button',{name:target.name,exact:true}).click();await p.getByRole('button',{name:'OVOZNI TASDIQLASH',exact:true}).click()}
  for(const p of pages){await expect(p.locator('#victory-title')).toHaveText('Oddiy o‘yinchilar yutdi!');await expect(p.locator('.victory-word strong')).not.toHaveText('');await expect(p.locator('.reveal-player')).toHaveCount(3);await expect(p.locator('.reveal-player.eliminated .reveal-badge.impostor')).toHaveCount(1);await expect(p.locator('.reveal-badge.host')).toHaveCount(1);await expect(p.locator('.reveal-badge.you')).toHaveCount(1);await expect(p.locator('.top')).not.toBeVisible();await expect(p.locator('.victory-footer button')).toHaveText('Bosh sahifaga qaytish')}
  await host.locator('.victory-secondary').click();for(const p of pages)await expect(p.locator('.waiting-card')).toBeVisible();
 }finally{await Promise.all(contexts.map(c=>c.close()))}
});
test('offline civilian victory returns to settings',async({page})=>{
 await page.goto('http://127.0.0.1:3187/index.html');await page.evaluate(()=>{state.names=['Aziz','Wade','SSS'];state.round={word:'Osh',impostors:[1]};state.votes=[1,0,1];state.screen='result';render()});await expect(page.locator('.victory-hero')).toBeVisible();await expect(page.locator('.victory-word strong')).toHaveText('Osh');await expect(page.locator('.reveal-player')).toHaveCount(3);await expect(page.locator('.reveal-player.eliminated')).toContainText('Wade');await page.locator('.victory-footer button').click();await expect(page.getByRole('button',{name:/Mavzular/})).toBeVisible();await expect(page.locator('.victory-hero')).toHaveCount(0);
});
