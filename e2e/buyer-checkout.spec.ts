import { expect, test } from '@playwright/test'
const tierId='11111111-1111-4111-8111-111111111111'
const orderId='22222222-2222-4222-8222-222222222222'
const signature='a'.repeat(64)
test('buyer reviews price before requesting EcoCash and can leave safely',async({page})=>{
 const charges: Record<string,unknown>[]=[]
 await page.addInitScript(({tierId})=>{
  localStorage.setItem('tp_cart',JSON.stringify([{kind:'ticket',key:'ticket:event:'+tierId,eventSlug:'event',eventTitle:'Test event',tierId,tierName:'General',price:10,currency:'USD',qty:1,emoji:''}]))
 },{tierId})
 await page.route('**/api/analytics/track',route=>route.fulfill({json:{ok:true}}))
 await page.route('**/api/checkout/questions?*',route=>route.fulfill({json:{questions:[]}}))
 await page.route('**/api/checkout/velocity',async route=>{
  const body=route.request().postDataJSON()
  if(body.quoteOnly) return route.fulfill({json:{success:true,quote:{amount:20,currency:'USD',normalizedPhone:'+263771234567',questions:[]}}})
  charges.push(body)
  await route.fulfill({json:{success:true,orderId,accessSignature:signature,flow:'velocity-seamless',amount:20,currency:'USD',pollRequired:true}})
 })
 await page.route('**/api/checkout/velocity/status/*',route=>route.fulfill({json:{orderId,status:'pending',paid:false}}))
 await page.route('**/api/orders/*/data',route=>route.fulfill({json:{id:orderId,status:'pending',createdAt:new Date().toISOString(),items:[],totalsByCurrency:{USD:20},contact:{name:'Buyer',email:'buyer@example.com',phone:'0771234567'},payment:{method:'velocity-ecocash'}}}))
 await page.goto('/checkout')
 await page.getByLabel('Full name',{exact:true}).fill('Buyer')
 await page.getByLabel('Email for your ticket').fill('buyer@example.com')
 await page.getByLabel('EcoCash number').fill('0771234567')
 await page.getByRole('button',{name:/Review order/}).filter({visible:true}).click()
 await expect(page.getByText(/Review your payment:/)).toBeVisible()
 expect(charges).toHaveLength(0)
 await page.getByRole('button',{name:/Pay .* with EcoCash/i}).filter({visible:true}).click()
 await expect(page.getByRole('dialog',{name:'Payment confirmation'})).toBeVisible()
 expect(charges).toHaveLength(1)
 expect(charges[0]).toMatchObject({expectedAmount:20,expectedCurrency:'USD'})
 expect(charges[0].checkoutRequestId).toMatch(/^[0-9a-f-]{36}$/)
 await page.getByRole('button',{name:'View order · keep checking'}).click()
 await expect(page).toHaveURL(new RegExp('/orders/'+orderId+'\\?sig='))
 expect(charges).toHaveLength(1)
})
test('email alone cannot expose recovered orders',async({page})=>{
 await page.goto('/orders/lookup?email=buyer@example.com')
 await expect(page.getByRole('button',{name:/Email my link/})).toBeVisible()
 await expect(page.getByRole('link',{name:/View tickets/})).toHaveCount(0)
})
