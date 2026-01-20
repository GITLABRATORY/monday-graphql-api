import nock from 'nock';
import { ApiClient } from '../lib/api-client';
import { MONDAY_API_ENDPOINT } from '../lib/constants';

describe('ApiClient timeout integration', () => {
  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    // Cancel any pending requests
    nock.abortPendingRequests();
    // Clean mock interceptors
    nock.cleanAll();
  });

  afterAll(() => {
    // Restore http module to original implementation (affected by importing nock)
    nock.restore();
    // Re-enable real network connections
    nock.enableNetConnect();
  });

  describe('request method', () => {
    it('should abort request when timeout is exceeded', async () => {
      nock(MONDAY_API_ENDPOINT)
        .post('')
        .delay(2000)
        .reply(200, { data: { users: [] } });

      const apiClient = new ApiClient({ token: 'test-token' });
      const query = '{ users { id } }';

      await expect(apiClient.request(query, undefined, { timeout: 100 })).rejects.toThrow('The user aborted a request.');
    });

    it('should complete successfully when response arrives before timeout', async () => {
      nock(MONDAY_API_ENDPOINT)
        .post('')
        .delay(50)
        .reply(200, { data: { users: [{ id: '1' }] } });

      const apiClient = new ApiClient({ token: 'test-token' });
      const query = '{ users { id } }';

      const result = await apiClient.request(query, undefined, { timeout: 500 });
      expect(result).toEqual({ users: [{ id: '1' }] });
    });

    it('should work without timeout option', async () => {
      nock(MONDAY_API_ENDPOINT)
        .post('')
        .reply(200, { data: { users: [{ id: '1', name: 'John' }] } });

      const apiClient = new ApiClient({ token: 'test-token' });
      const query = '{ users { id name } }';

      const result = await apiClient.request(query);
      expect(result).toEqual({ users: [{ id: '1', name: 'John' }] });
    });
  });

  describe('rawRequest method', () => {
    it('should abort rawRequest when timeout is exceeded', async () => {
      nock(MONDAY_API_ENDPOINT)
        .post('')
        .delay(2000)
        .reply(200, { data: { users: [] } });

      const apiClient = new ApiClient({ token: 'test-token' });
      const query = '{ users { id } }';

      await expect(apiClient.rawRequest(query, undefined, { timeout: 100 })).rejects.toThrow('The user aborted a request.');
    });

    it('should complete rawRequest successfully when response arrives before timeout', async () => {
      nock(MONDAY_API_ENDPOINT)
        .post('')
        .delay(50)
        .reply(200, { data: { users: [{ id: '1' }] } });

      const apiClient = new ApiClient({ token: 'test-token' });
      const query = '{ users { id } }';

      const result = await apiClient.rawRequest(query, undefined, { timeout: 500 });
      expect(result.data).toEqual({ users: [{ id: '1' }] });
    });
  });
});
