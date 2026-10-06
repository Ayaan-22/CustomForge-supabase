import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({event:null,order:null,lookupError:null,updateError:null,noWrite:false,filters:[],updates:[],construct:vi.fn()}));
vi.mock('stripe',()=>({default:class {webhooks={constructEvent:()=>{state.construct();return state.event}}}}));
vi.mock('../../middleware/logger.js',()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn()}}));
vi.mock('../../config/db.js',()=>{const db={from:()=>{let writing=false;const q={select:()=>q,eq:(...args)=>{state.filters.push(args);return q},maybeSingle:async()=>({data:writing?(state.updateError||state.noWrite?null:{id:state.order.id}):state.order,error:writing?state.updateError:state.lookupError}),update:data=>{writing=true;state.updates.push(data);return q},then:resolve=>Promise.resolve({error:state.updateError}).then(resolve)};return q}};return {getServiceClient:()=>db,getSupabaseClient:()=>db}});
import {handleWebhook} from '../../controllers/paymentController.js';
const run=()=>new Promise((resolve,reject)=>handleWebhook({headers:{'stripe-signature':'signed'},body:Buffer.from('{}'),ip:'127.0.0.1'}, {json:resolve,status(){return this}},reject));
beforeEach(()=>{state.updates=[];state.noWrite=false;state.filters=[];state.lookupError=null;state.updateError=null;state.construct.mockClear();state.order={id:'order',status:'pending',is_paid:false,total_price:10,user_id:'user',payment_method:'stripe',updated_at:'2026-10-04T00:00:00Z',payment_result:{stripeCustomerId:'cus_user',transaction_id:'pi'}};state.event={id:'event',created:1,type:'payment_intent.succeeded',data:{object:{id:'pi',currency:'usd',metadata:{orderId:'order',userId:'user'},customer:'cus_user',payment_intent:'pi',amount_received:1000}}}});
describe('authoritative Stripe webhook settlement',()=>{
 it('accepts a freshly signed retry of an old event and persists settlement',async()=>{expect(await run()).toEqual({received:true});expect(state.construct).toHaveBeenCalledOnce();expect(state.updates[0]).toMatchObject({is_paid:true,status:'paid'})});
 it('returns retryable failure when the database lookup fails',async()=>{state.lookupError={message:'unavailable'};await expect(run()).rejects.toMatchObject({statusCode:503})});
 it('does not acknowledge a failed settlement write',async()=>{state.updateError={message:'unavailable'};await expect(run()).rejects.toMatchObject({statusCode:503})});
 it('does not write an already settled payment twice',async()=>{state.order.is_paid=true;await run();expect(state.updates).toHaveLength(0)});
 it('rejects currency mismatch before writing',async()=>{state.event.data.object.currency='eur';await expect(run()).rejects.toMatchObject({statusCode:503});expect(state.updates).toHaveLength(0)});
 it('does not mark a partial refund as fully refunded',async()=>{state.event.type='charge.refunded';state.event.data.object.amount_refunded=100;state.order.status='paid';state.order.is_paid=true;await run();expect(state.updates[0]).toMatchObject({status:'paid',payment_result:{refund:{amount:1}}})});
});


describe('payment event consistency',()=>{
 it('rejects one cent underpayment',async()=>{state.event.data.object.amount_received=999;await expect(run()).rejects.toMatchObject({statusCode:503});expect(state.updates).toHaveLength(0)});
 it('rejects a second payment for an already settled order',async()=>{state.order.is_paid=true;state.event.data.object.id='pi_other';await expect(run()).rejects.toMatchObject({statusCode:503})});
 it('rejects mismatched customer metadata',async()=>{state.event.data.object.customer='cus_other';await expect(run()).rejects.toMatchObject({statusCode:503});expect(state.updates).toHaveLength(0)});
 it('rejects refund against a different payment',async()=>{state.order.is_paid=true;state.event.type='charge.refunded';state.event.data.object.payment_intent='pi_other';state.event.data.object.amount_refunded=100;await expect(run()).rejects.toMatchObject({statusCode:503})});
 it('does not regress a cumulative refund on out-of-order delivery',async()=>{state.order.is_paid=true;state.order.payment_result.refund={amount:5};state.event.type='charge.refunded';state.event.data.object.amount_refunded=100;await run();expect(state.updates).toHaveLength(0)});
});

it('retries a settlement that loses the order version race',async()=>{state.noWrite=true;await expect(run()).rejects.toMatchObject({statusCode:503});expect(state.filters).toContainEqual(['updated_at',state.order.updated_at])});
