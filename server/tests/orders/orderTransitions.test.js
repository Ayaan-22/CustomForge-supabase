import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({order:null,filters:[],updates:[],rpc:vi.fn()}));
vi.mock('../../middleware/logger.js',()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn()}}));
vi.mock('../../config/db.js',()=>{
  const db={rpc:state.rpc,from:()=>{
    let writing=false;
    const q={select:()=>q,update:value=>{writing=true;state.updates.push(value);return q},eq:(...args)=>{state.filters.push(args);return q},
      single:async()=>({data:writing?{...state.order,...state.updates.at(-1)}:state.order,error:null}),maybeSingle:async()=>({data:state.order,error:null})};return q;
  }};return {getServiceClient:()=>db,getSupabaseClient:()=>db};
});
import {updateOrderStatus,updateOrderToDelivered,markOrderAsPaid,processReturn} from '../../controllers/adminController.js';
import {cancelOrder} from '../../controllers/orderController.js';
const id='10000000-0000-4000-8000-000000000001';
const run=(handler,body={})=>new Promise((resolve,reject)=>handler({user:{id:'owner',role:'admin'},params:{id},query:{},body},{json:resolve,status(){return this}},reject));
beforeEach(()=>{state.order={id,status:'pending',payment_method:'stripe',is_paid:false,updated_at:'2026-10-04T00:00:00Z',return_status:'none'};state.filters=[];state.updates=[];state.rpc.mockReset()});
describe('order and payment state transitions',()=>{
  it.each(['paid','refunded','cancelled','returned'])('cannot set %s using the generic status route',async status=>{
    await expect(run(updateOrderStatus,{status})).rejects.toMatchObject({statusCode:409});expect(state.updates).toHaveLength(0);
  });
  it('does not fulfill an unpaid card order',async()=>{await expect(run(updateOrderStatus,{status:'processing'})).rejects.toMatchObject({statusCode:409})});
  it('does not reopen a cancelled order',async()=>{state.order.status='cancelled';state.order.payment_method='cod';await expect(run(updateOrderStatus,{status:'pending'})).rejects.toMatchObject({statusCode:409})});
  it('compares status and version when advancing a COD order',async()=>{state.order.payment_method='cod';await run(updateOrderStatus,{status:'processing'});expect(state.filters).toContainEqual(['status','pending']);expect(state.filters).toContainEqual(['updated_at',state.order.updated_at])});
  it('does not deliver a refunded order',async()=>{state.order.is_paid=true;state.order.status='refunded';await expect(run(updateOrderToDelivered)).rejects.toMatchObject({statusCode:400})});
  it('preserves shipped status when recording COD collection',async()=>{state.order.payment_method='cod';state.order.status='shipped';await run(markOrderAsPaid);expect(state.updates[0]).toMatchObject({is_paid:true,status:'shipped'});expect(state.filters).toContainEqual(['is_paid',false]);expect(state.filters).toContainEqual(['payment_method','cod'])});
  it('cannot declare a return completed without reconciliation',async()=>{await expect(run(processReturn,{returnStatus:'completed'})).rejects.toMatchObject({statusCode:503});expect(state.updates).toHaveLength(0)});
  it('cannot approve a return that was not requested',async()=>{await expect(run(processReturn,{returnStatus:'approved'})).rejects.toMatchObject({statusCode:409})});
  it('cancels only through the atomic owner RPC',async()=>{state.rpc.mockResolvedValue({data:{id,status:'cancelled'}});await run(cancelOrder);expect(state.rpc).toHaveBeenCalledWith('cancel_unpaid_order',{p_order_id:id});expect(state.updates).toHaveLength(0)});
  it('does not report cancellation when the migration is unavailable',async()=>{state.rpc.mockResolvedValue({error:{code:'PGRST202'}});await expect(run(cancelOrder)).rejects.toMatchObject({statusCode:503})});
});
