import {describe, it, expect} from 'vitest';
import {validatePaymentMetadata, publicPaymentMetadata} from '../../utils/paymentMetadata.js';
describe('legacy payment metadata', () => {
  it.each([{cardNumber:'4242424242424242'}, {cvv:'123'}, {cvc:'123'}])('rejects raw card details', body => {
    expect(() => validatePaymentMetadata(body)).toThrow();
  });
  it('accepts display-only last four digits', () => {
    expect(() => validatePaymentMetadata({cardNumber:'4242'})).not.toThrow();
  });
  it('never returns old full card numbers or verification codes', () => {
    expect(publicPaymentMetadata({id:'method',card_number:'4242 4242 4242 4242',cvv:'123',cvc:'321'})).toEqual({id:'method',card_number:'4242'});
  });
});
