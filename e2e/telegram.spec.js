const {test,expect}=require('@playwright/test');
test('Telegram shell supports names, room links, back and normal server rooms',async({browser})=>{
 const hostContext=await browser.newContext(),guestContext=await browser.newContext();
 try {
  const host=await hostContext.newPage();await host.goto('/online.html');await expect(host.locator('#status')).toContainText('ONLAYN');
  await host.locator('#create-room-choice').click();await host.locator('#create-settings-continue').click();await host.locator('#name').fill('Boshlovchi');await host.locator('#name-continue').click();if(await host.evaluate(()=>entryIntent==='create'&&!!entryName.trim())){await host.locator('#lobby-settings').waitFor();await host.locator('#lobby-settings').evaluate(el=>el.open=true);}
  const code=await host.locator('.code').getAttribute('data-code');
  const guest=await guestContext.newPage();
  await guest.addInitScript(()=>{window.tgCalls=[];window.Telegram={WebApp:{platform:'android',initDataUnsafe:{user:{first_name:'Sardor'}},safeAreaInset:{top:12},contentSafeAreaInset:{bottom:20},BackButton:{show(){window.tgCalls.push('back-show')},hide(){},onClick(fn){window.tgBack=fn}},onEvent(){},enableClosingConfirmation(){window.tgCalls.push('confirm-close')},disableClosingConfirmation(){},setHeaderColor(){},setBackgroundColor(){},expand(){window.tgCalls.push('expand')},ready(){window.tgCalls.push('ready')},openTelegramLink(url){window.shared=url}}}});
  await guest.goto('/online.html?tgWebAppStartParam='+code);await expect(guest.locator('#name-dialog')).toBeVisible();
  await expect(guest.locator('#name')).toHaveValue('Sardor');await guest.locator('#name-continue').click();if(await guest.evaluate(()=>entryIntent==='create'&&!!entryName.trim())){await guest.locator('#lobby-settings').waitFor();await guest.locator('#lobby-settings').evaluate(el=>el.open=true);}
  await expect(guest.locator('.waiting-card')).toBeVisible();await expect(host.locator('.lobby-player-list .player')).toHaveCount(2);
  await expect(guest.getByRole('button',{name:'Telegram orqali taklif qilish'})).toHaveCount(0);await guest.evaluate(()=>shareTelegram());
  expect(await guest.evaluate(()=>window.shared)).toContain(encodeURIComponent('https://t.me/imposter_kimbot?startapp='+code));
  expect(await guest.evaluate(()=>window.tgCalls)).toEqual(expect.arrayContaining(['expand','ready','confirm-close']));
  guest.on('dialog',d=>d.accept());await guest.evaluate(()=>window.tgBack());await expect(guest.locator('#create-room-choice')).toBeVisible();await expect(host.locator('.lobby-player-list .player')).toHaveCount(1);
 } finally {await hostContext.close();await guestContext.close()}
});
test('invalid Telegram room parameters are ignored and config exposes no secrets',async({page,request})=>{
 await page.goto('/online.html?tgWebAppStartParam=%3Cscript%3E');await expect(page.locator('#code')).toHaveCount(0);
 const response=await request.get('/telegram-config');expect(response.ok()).toBeTruthy();expect(Object.keys(await response.json())).toEqual(['botUsername']);
});

test('website invitations skip code entry and expired rooms show an error',async({browser})=>{
 const a=await browser.newContext(),b=await browser.newContext();try{
 const host=await a.newPage();await host.goto('/online.html');await expect(host.locator('#status')).toContainText('ONLAYN');await host.locator('#create-room-choice').click();await host.locator('#create-settings-continue').click();await host.locator('#name').fill('Host');await host.locator('#name-continue').click();if(await host.evaluate(()=>entryIntent==='create'&&!!entryName.trim())){await host.locator('#lobby-settings').waitFor();await host.locator('#lobby-settings').evaluate(el=>el.open=true);}const code=await host.locator('.code').getAttribute('data-code');
 const guest=await b.newPage();await guest.goto('/online.html?room='+code);await expect(guest.locator('#name-dialog')).toBeVisible();await guest.locator('#name').fill('Guest');await guest.locator('#name-continue').click();if(await guest.evaluate(()=>entryIntent==='create'&&!!entryName.trim())){await guest.locator('#lobby-settings').waitFor();await guest.locator('#lobby-settings').evaluate(el=>el.open=true);}await expect(guest.locator('.waiting-card')).toBeVisible();await expect(host.locator('.lobby-player-list .player')).toHaveCount(2);
 await guest.goto('/online.html?room=ZZZZZZ');await expect(guest.locator('#error')).toContainText('Xona topilmadi');await expect(guest.locator('#name-dialog')).toHaveCount(0);
 }finally{await a.close();await b.close()}
});


