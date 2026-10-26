const {test,expect}=require('@playwright/test');
test('text delivery, safe content, preserved drafts, reconnect history and host deletion',async({browser})=>{
 const contexts=await Promise.all([browser.newContext(),browser.newContext()]);const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));const errors=[];for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
 try{
 await a.goto('http://127.0.0.1:3187/online.html');await expect(a.locator('#status')).toContainText('ONLAYN');await a.locator('#create-room-choice').click();await a.locator('#name').fill('Host');await a.getByRole('button',{name:'XONA YARATISH'}).click();await expect(a.locator('.code')).toBeVisible();const code=(await a.locator('.code').innerText()).trim();
 await b.goto('http://127.0.0.1:3187/online.html');await expect(b.locator('#status')).toContainText('ONLAYN');await b.locator('#join-with-code').click();await b.locator('#name').fill('Guest');await b.locator('#code').fill(code);await b.getByRole('button',{name:'QO‘SHILISH',exact:false}).click();await expect(b.locator('#chat-input')).toBeVisible();
 const message='<img src=x onerror=alert(1)> Salom, do‘stlar!';await b.locator('#chat-input').fill(message);await b.locator('#chat-input').press('Enter');await expect(a.locator('.chat-text')).toHaveText(message);await expect(b.locator('#chat-input')).toHaveValue('');await expect(a.locator('#chat-log img')).toHaveCount(0);await expect(b.locator('.chat-delete')).toHaveCount(0);
 await b.locator('#chat-input').fill('Hali yuborilmagan');await a.locator('#minutes').fill('12');await a.locator('#minutes').press('Tab');await expect(b.locator('#chat-input')).toHaveValue('Hali yuborilmagan');
 await b.reload();await expect(b.locator('.chat-text')).toHaveText(message);await a.getByRole('button',{name:'Xabarni o‘chirish'}).click();await expect(b.locator('.chat-text')).toHaveCount(0);await expect(a.locator('.chat-text')).toHaveCount(0);expect(errors).toEqual([]);
 }finally{await Promise.all(contexts.map(c=>c.close()))}
});
