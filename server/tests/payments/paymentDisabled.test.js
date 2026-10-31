import {describe,it,expect,vi} from 'vitest';
vi.mock('../../config/db.js',()=>({getServiceClient:()=>({}),getSupabaseClient:()=>{throw new Error('Disabled flow must not access database')}}));
vi.mock('../../middleware/logger.js',()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn()}}));
import {processPayment,createPaymentIntent,createOrderCod,createPayPalOrder,capturePayPalOrder,processRefund,savePaymentMethod,removePaymentMethod} from '../../controllers/paymentController.js';
describe('unsupported payment operations fail closed',()=>{
  it.each([processPayment,createPaymentIntent,createOrderCod,createPayPalOrder,capturePayPalOrder,processRefund,savePaymentMethod,removePaymentMethod])('%s cannot report a payment or change stored cards',async handler=>{
    const json=vi.fn();
    await expect(new Promise((resolve,reject)=>handler({user:{id:'owner'},body:{}},{json},reject))).rejects.toMatchObject({statusCode:503});
    expect(json).not.toHaveBeenCalled();
  });
});
