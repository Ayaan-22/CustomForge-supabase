import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({filters:[],fields:'',request:null,row:null,error:null}));
vi.mock('../../config/db.js',()=>({getSupabaseClient:req=>{state.request=req;return{from:table=>{if(table!=='reviews')throw Error('wrong table');const q={select:fields=>{state.fields=fields;return q},eq:(key,value)=>{state.filters.push([key,value]);return q},order:()=>q,limit:()=>q,maybeSingle:async()=>({data:state.row,error:state.error})};return q}}}}));
vi.mock('../../middleware/logger.js',()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn()}}));
import {getOwnProductReview} from '../../controllers/reviewController.js';
const id='10000000-0000-4000-8000-000000000001';
const req={params:{id},user:{id:'owner'},query:{userId:'victim'}};
const run=()=>new Promise((resolve,reject)=>getOwnProductReview(req,{json:resolve},reject));
beforeEach(()=>{state.filters=[];state.error=null;state.row=null});
describe('private owner review read',()=>{
 it('binds the database to the request and scopes both product and authenticated owner',async()=>{await run();expect(state.request).toBe(req);expect(state.filters).toEqual([['product_id',id],['user_id','owner']]);expect(state.fields).not.toContain('report_reason')});
 it('returns pending content only through the private contract',async()=>{state.row={id:'review',product_id:id,user_id:'owner',is_active:false,comment:'Private pending review',rating:4};expect((await run()).data).toMatchObject({id:'review',productId:id,isActive:false,comment:'Private pending review'});expect((await run()).data).not.toHaveProperty('user_id')});
 it('returns null when there is no owned review',async()=>expect((await run()).data).toBeNull());
 it('propagates read errors instead of pretending the review does not exist',async()=>{state.error={message:'offline'};await expect(run()).rejects.toMatchObject({statusCode:500})});
});
