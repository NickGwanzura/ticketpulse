import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock=vi.hoisted(()=>({select:vi.fn(),withLock:vi.fn(),initiate:vi.fn(),existing:null as unknown,questions:[] as unknown[]}))
vi.mock('@/db',()=>({db:{select:mock.select}}))
vi.mock('@/lib/delivery',()=>({deliverTicketForPaidOrder:vi.fn()}))
vi.mock('@/lib/order-expiry',()=>({cancelUnpaidOrderAndReleaseInventory:vi.fn()}))
vi.mock('@/lib/analytics',()=>({trackEvent:vi.fn()}))
vi.mock('@/lib/whatsapp',()=>({sendAdminAlert:vi.fn()}))
vi.mock('@/lib/payment-alerts',()=>({alertTransactionFailed:vi.fn(),alertPaymentAnomaly:vi.fn()}))
vi.mock('@/lib/velocity/idempotency',()=>({withLock:mock.withLock,lockOrderMutation:vi.fn()}))
vi.mock('@/lib/rate-limit',()=>({checkoutLimiter:{checkRequest:vi.fn().mockResolvedValue({allowed:true})},checkoutSubmitLimiter:{checkRequest:vi.fn().mockResolvedValue({allowed:true})}}))
vi.mock('@/services/velocity',()=>({getConfig:vi.fn(),initiateTransaction:mock.initiate,createSalesOrder:vi.fn(),getAuthType:vi.fn(),getDefaultCustomerId:vi.fn(),pollTransaction:vi.fn(),getTransactionRedirectUrl:vi.fn(),extractHostedSessionId:vi.fn()}))
vi.mock('@/lib/tickets',()=>({signTicketPayload:()=> 'a'.repeat(64),generateOrderAccessUrl:()=> 'https://example.test/orders/link'}))
vi.mock('@/lib/ticket-availability',()=>({getTierAvailability:async()=>new Map([['11111111-1111-4111-8111-111111111111',{usedQuantity:0,availableQuantity:100}]])}))
import { POST } from '@/app/api/checkout/velocity/route'
import { CheckoutBody, checkoutFingerprint } from '@/lib/checkout-contract'
import { events, ticketTiers, ticketQuestions, orders } from '@/db/schema'
const id='11111111-1111-4111-8111-111111111111',eventId='22222222-2222-4222-8222-222222222222'
const input={email:'buyer@example.com',name:'Buyer',phone:'0771234567',paymentMethod:'velocity-ecocash',eventSlug:'event',items:[{kind:'ticket',tierId:id,quantity:1}],checkoutRequestId:id,expectedAmount:20,expectedCurrency:'USD'}
const send=(body:unknown)=>POST(new Request('https://example.test/api/checkout/velocity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}))
beforeEach(()=>{
 vi.clearAllMocks();mock.existing=null;mock.questions=[]
 mock.select.mockImplementation(()=>({from:(table:unknown)=>{
  const rows=table===events?[{id:eventId,slug:'event',status:'published',startsAt:new Date('2099-01-01')}]:table===ticketTiers?[{id,eventId,name:'General',price:'20.00',currency:'USD',totalQuantity:100,soldQuantity:0,earlyBirdQuantity:null}]:table===ticketQuestions?mock.questions:table===orders?(mock.existing?[mock.existing]:[]):[]
  const query={where:()=>query,orderBy:()=>query,limit:()=>Promise.resolve(rows),then:(resolve:(x:unknown)=>unknown)=>Promise.resolve(rows).then(resolve)};return query
 }}))
})
describe('actual checkout handler',()=>{
 it('quotes the current price without creating an order or starting payment',async()=>{
  const response=await send({...input,quoteOnly:true});expect(response.status).toBe(200)
  expect((await response.json()).quote).toMatchObject({amount:20,currency:'USD',normalizedPhone:'+263771234567'})
  expect(mock.withLock).not.toHaveBeenCalled();expect(mock.initiate).not.toHaveBeenCalled()
 })
 it('rejects an unreviewed changed amount before payment',async()=>{
  const response=await send({...input,expectedAmount:10});expect(response.status).toBe(409)
  expect((await response.json()).code).toBe('price_changed');expect(mock.initiate).not.toHaveBeenCalled()
 })
 it('rejects duplicate cart lines before reservation',async()=>{
  const response=await send({...input,items:[...input.items,...input.items]});expect(response.status).toBe(400);expect(mock.withLock).not.toHaveBeenCalled()
 })
 it('requires attendee answers before creating a payment',async()=>{
  mock.questions=[{id,question:'Attendee name',required:true}]
  expect((await send(input)).status).toBe(400);expect(mock.withLock).not.toHaveBeenCalled()
 })
 it('resumes an old unresolved request without creating another transaction',async()=>{
  mock.existing={id,eventId,guestEmail:input.email,status:'pending',paymentMethod:'velocity-ecocash',totalAmount:'20.00',currency:'USD',createdAt:new Date('2020-01-01'),metadata:{checkoutRequestId:id,checkoutFingerprint:checkoutFingerprint(CheckoutBody.parse(input),eventId,20,'USD'),velocity:{transactionTrace:'existing-trace',salesOrderTrace:'sales-trace'}}}
  const response=await send(input);expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({orderId:id,resumed:true,accessSignature:'a'.repeat(64),transactionTrace:'existing-trace'})
  expect(mock.withLock).not.toHaveBeenCalled();expect(mock.initiate).not.toHaveBeenCalled()
 })
 it('retains a secure recovery link while an existing request is initializing',async()=>{
  mock.existing={id,eventId,guestEmail:input.email,status:'pending',metadata:{checkoutRequestId:id,checkoutFingerprint:checkoutFingerprint(CheckoutBody.parse(input),eventId,20,'USD')}}
  const response=await send(input);expect(response.status).toBe(409);expect(await response.json()).toMatchObject({orderId:id,recoverable:true,accessSignature:'a'.repeat(64)});expect(mock.initiate).not.toHaveBeenCalled()
 })
})
