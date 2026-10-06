import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({order:null,updates:[],writeError:null,create:vi.fn(),retrieve:vi.fn(),customer:vi.fn()}));
vi.mock('stripe',()=>({default:class{customers={retrieve:state.customer};checkout={sessions:{create:state.create,retrieve:state.retrieve}}}}));
vi.mock('../../middleware/logger.js',()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn()}}));
vi.mock('../../config/db.js',()=>{const db={from:table=>{let writing=false;const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:writing?(state.writeError?null:{id}):table==='orders'?state.order:{id:'user',stripe_customer_id:'cus_existing'},error:writing?state.writeError:null}),update:value=>{writing=true;state.updates.push(value);return q},then:resolve=>Promise.resolve({error:state.writeError}).then(resolve)};return q}};return {getServiceClient:()=>db,getSupabaseClient:()=>db}});
import {createStripeSession} from '../../controllers/paymentController.js';
const id='10000000-0000-4000-8000-000000000001';
const run=()=>new Promise((resolve,reject)=>createStripeSession({body:{orderId:id},user:{id:'user',role:'user'}},{json:resolve,status(){return this}},reject));
beforeEach(()=>{process.env.CLIENT_URL='http://localhost:3100';state.customer.mockReset().mockResolvedValue({id:'cus_existing',metadata:{userId:'user'}});state.order={id,user_id:'user',status:'pending',total_price:25,is_paid:false,payment_method:'stripe',updated_at:'2026-10-04T00:00:00Z'};state.updates=[];state.writeError=null;state.create.mockReset().mockResolvedValue({id:'cs_new',url:'https://checkout.stripe.com/session'});state.retrieve.mockReset()});
describe('Stripe checkout retry contract',()=>{
 it('uses a stable provider key and forwards webhook metadata',async()=>{await run();const [body,options]=state.create.mock.calls[0];expect(body.payment_intent_data.metadata).toEqual({orderId:id,userId:'user'});expect(options.idempotencyKey).toBe('checkout-'+id+'-initial');expect(state.updates[0].payment_result.checkoutSessionId).toBe('cs_new')});
 it('reuses an open checkout instead of creating a second charge opportunity',async()=>{state.order.payment_result={checkoutSessionId:'cs_open'};state.retrieve.mockResolvedValue({metadata:{orderId:id,userId:'user'},amount_total:2500,currency:'usd',customer:'cus_existing',id:'cs_open',status:'open',url:'https://checkout.stripe.com/open'});expect((await run()).sessionId).toBe('cs_open');expect(state.create).not.toHaveBeenCalled()});
 it('blocks retry while a completed checkout awaits the webhook',async()=>{state.order.payment_result={checkoutSessionId:'cs_done'};state.retrieve.mockResolvedValue({metadata:{orderId:id,userId:'user'},amount_total:2500,currency:'usd',customer:'cus_existing',status:'complete'});await expect(run()).rejects.toMatchObject({statusCode:409});expect(state.create).not.toHaveBeenCalled()});
 it('allows an expired session to start a new deterministic generation',async()=>{state.order.payment_result={checkoutSessionId:'cs_expired'};state.retrieve.mockResolvedValue({status:'expired'});await run();expect(state.create.mock.calls[0][1].idempotencyKey).toBe('checkout-'+id+'-cs_expired')});
 it('fails clearly when persistence is unavailable',async()=>{state.writeError={message:'unavailable'};await expect(run()).rejects.toMatchObject({statusCode:503})});
 it('checks ownership before talking to Stripe',async()=>{state.order.user_id='someone-else';await expect(run()).rejects.toMatchObject({statusCode:403});expect(state.create).not.toHaveBeenCalled()});
});

describe('Stripe input and account boundaries',()=>{
 it('rejects another customers provider account',async()=>{state.customer.mockResolvedValue({metadata:{userId:'other'}});await expect(run()).rejects.toMatchObject({statusCode:409});expect(state.create).not.toHaveBeenCalled()});
 it('rejects insecure public redirect configuration',async()=>{process.env.CLIENT_URL='http://example.com';await expect(run()).rejects.toMatchObject({statusCode:503})});
 it('rejects switching a COD order to Stripe',async()=>{state.order.payment_method='cod';await expect(run()).rejects.toMatchObject({statusCode:409})});
 it.each([0,-1,10000.01,NaN])('rejects invalid amount %s',async amount=>{state.order.total_price=amount;await expect(run()).rejects.toMatchObject({statusCode:400});expect(state.create).not.toHaveBeenCalled()});
});
