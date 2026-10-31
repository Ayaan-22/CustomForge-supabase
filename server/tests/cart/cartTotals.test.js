import { describe, expect, it, vi } from 'vitest';
vi.mock('../../config/db.js', () => ({ getSupabaseClient: vi.fn() }));
import { computeCartTotals } from '../../controllers/cartController.js';

const cart = (prices, coupon = null) => ({ coupon, items: prices.map((price, index) => ({
  quantity: 1, product: { id: String(index), name: `Item ${index}`, final_price: price, original_price: price, stock: 5, is_active: true },
})) });
const coupon = { code: 'SAVE10', discount_type: 'percentage', discount_value: 10, is_active: true, applicable_products: [], excluded_products: [] };

describe('cart preview matches checkout_cart tax and shipping', () => {
  it('shows the screenshot total before an order is created', () => {
    expect(computeCartTotals(cart([159,224.1]))).toMatchObject({ subtotal:383.1,discount:0,shipping:0,tax:38.31,total:421.41 });
  });
  it.each([
    [99.99,10,10,119.99], [100,0,10,110], [0.05,10,0.01,10.06], [0,10,0,10],
  ])('matches SQL shipping/tax rounding at subtotal %s', (price,shipping,tax,total) => {
    expect(computeCartTotals(cart([price]))).toMatchObject({shipping,tax,total});
  });
  it('normalizes joined coupon rows and applies shipping threshold after discount', () => {
    expect(computeCartTotals(cart([100],coupon))).toMatchObject({subtotal:100,discount:10,shipping:10,tax:9,total:109,couponError:null});
    expect(computeCartTotals(cart([322.2],coupon))).toMatchObject({discount:32.22,shipping:0,tax:29,total:318.98});
  });
  it('keeps the same preview for an already mapped coupon during application', () => {
    const mapped = {code:'SAVE10',discountType:'percent',discountValue:10,isActive:true};
    expect(computeCartTotals(cart([100],mapped))).toEqual(computeCartTotals(cart([100],coupon)));
  });
  it('honors minimum purchase, product exclusions and expiry', () => {
    for (const invalid of [{min_purchase:150},{excluded_products:['0']},{valid_to:'2000-01-01'}]) {
      const result=computeCartTotals(cart([100],{...coupon,...invalid}));
      expect(result.couponError).toBeTruthy();
      expect(result).toMatchObject({discount:0,tax:10,total:110});
    }
  });
  it('caps fixed discounts without dropping tax or shipping', () => {
    expect(computeCartTotals(cart([100],{...coupon,discount_type:'fixed',discount_value:200}))).toMatchObject({discount:100,shipping:10,tax:0,total:10});
  });
  it('rounds a half-cent coupon discount like PostgreSQL numeric', () => {
    expect(computeCartTotals(cart([0.15],coupon))).toMatchObject({discount:0.02,shipping:10,tax:0.01,total:10.14});
  });
  it('charges nothing for an empty cart and flags unavailable items', () => {
    expect(computeCartTotals(cart([]))).toMatchObject({subtotal:0,shipping:0,tax:0,total:0});
    expect(computeCartTotals({items:[{quantity:1,product:null}],coupon:null}).warnings).toHaveLength(1);
  });
});
