const {test,expect}=require('@playwright/test');
test('online landing hides code until Join with code is selected',async({page})=>{
 await page.goto('http://127.0.0.1:3187/online.html');await expect(page.locator('#status')).toContainText('ONLAYN');await expect(page.locator('#code')).toHaveCount(0);await expect(page.locator('#name')).toHaveCount(0);
 await page.locator('#create-room-choice').click();await expect(page.locator('#name')).toBeVisible();await expect(page.locator('#code')).toHaveCount(0);await page.locator('#name').fill('Sardor');await page.getByRole('button',{name:'← Orqaga'}).click();await expect(page.locator('#code')).toHaveCount(0);
 await page.locator('#join-with-code').click();await expect(page.locator('#code')).toBeVisible();await expect(page.locator('#code')).toBeFocused();await expect(page.locator('#name')).toHaveValue('Sardor');await page.locator('#code').fill('ABC');await page.getByRole('button',{name:'QO‘SHILISH →',exact:true}).click();await expect(page.locator('#error')).toContainText('6 belgili');await expect(page.locator('#code')).toHaveValue('ABC');
 await page.getByRole('button',{name:'← Orqaga'}).click();await expect(page.locator('#code')).toHaveCount(0);await expect(page.locator('#join-with-code')).toBeVisible();
});
