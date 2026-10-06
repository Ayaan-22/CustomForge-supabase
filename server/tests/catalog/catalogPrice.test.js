import {describe,it,expect} from 'vitest';
import {catalogPrice,createProduct} from '../../models/Product.js';
describe('authoritative catalog prices',()=>{
  it('derives currency-rounded discount pricing',()=>expect(catalogPrice(19.99,15)).toBe(16.99));
  it.each([[-1,0],[100,-1],[100,101],[NaN,0],[100,Infinity]])('rejects invalid price %s / discount %s',(price,discount)=>expect(()=>catalogPrice(price,discount)).toThrow());
  it('ignores a supplied final price when inserting',async()=>{
    let inserted;
    const db={from:()=>({insert:rows=>{inserted=rows[0];return {select:()=>({single:async()=>({data:{id:'product',...inserted}})})}}})};
    await createProduct({name:'Product',originalPrice:100,discountPercentage:20,finalPrice:1,stock:0},db);
    expect(inserted.final_price).toBe(80);expect(inserted.availability).toBe('Out of Stock');
  });
});
