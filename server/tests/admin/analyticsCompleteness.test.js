import {describe, expect, it} from 'vitest';
import {requireCompleteAnalytics} from '../../utils/analyticsCompleteness.js';

describe('analytics query completeness', () => {
  it('rejects successful but truncated PostgREST results before totals are returned', () => {
    expect(() => requireCompleteAnalytics([{id:'one'}],1001,null)).toThrow(expect.objectContaining({statusCode:503}));
  });
  it('rejects missing counts rather than assuming a sample is the full dataset', () => {
    expect(() => requireCompleteAnalytics([],null,null)).toThrow(expect.objectContaining({statusCode:503}));
  });
  it('accepts full and empty datasets, and preserves upstream database errors', () => {
    expect(() => requireCompleteAnalytics([{id:'one'}],1,null)).not.toThrow();
    expect(() => requireCompleteAnalytics([],0,null)).not.toThrow();
    expect(() => requireCompleteAnalytics(null,null,{message:'unavailable'})).not.toThrow();
  });
});
