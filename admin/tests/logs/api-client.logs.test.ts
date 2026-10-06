import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/transport', () => ({ API_BASE: '/api/v1', request }));
import { apiClient } from '@/lib/api-client';

beforeEach(() => { request.mockReset(); });

describe('admin log response contracts', () => {
  it('keeps an empty day as a successful paginated result', async () => {
    const response = {
      status: 'success', timezone: 'Asia/Karachi',
      filters: { date: '2026-10-06' },
      pagination: { page: 1, limit: 20, total: 0, pages: 1 },
      results: 0, data: [],
    };
    request.mockResolvedValue(Response.json(response));
    expect(await apiClient.getLogs(1, 20)).toEqual(response);
  });

  it('preserves the server day and timezone alongside zero statistics', async () => {
    const data = { total: 0, byLevel: {}, byRoute: {}, errorCount: 0, averageResponseTime: 0, uniqueUsers: 0 };
    request.mockResolvedValue(Response.json({ status: 'success', date: '2026-10-06', timezone: 'Asia/Karachi', data }));
    expect(await apiClient.getLogStats()).toEqual({ ...data, date: '2026-10-06', timezone: 'Asia/Karachi' });
  });

  it.each(['getLogs', 'getLogStats'] as const)('keeps %s read failures visible', async method => {
    const error = new Error('The service is unavailable');
    request.mockRejectedValue(error);
    await expect(apiClient[method]()).rejects.toThrow('The service is unavailable');
  });
});
