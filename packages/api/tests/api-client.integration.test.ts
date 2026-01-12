import nock from 'nock';
import { ApiClient } from '../lib/api-client';

describe('ApiClient timeout integration', () => {
  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.restore();
    nock.enableNetConnect();
  });

  describe('request method', () => {
    it('should abort request when timeout is exceeded', async () => {
      nock('https://api.monday.com')
        .post('/v2')
        .delay(2000)
        .reply(200, { data: { users: [] } });

      const apiClient = new ApiClient({ token: 'test-token' });
      const query = '{ users { id } }';

      await expect(apiClient.request(query, undefined, { timeout: 100 })).rejects.toThrow('The user aborted a request.');
    });

    it('should complete successfully when response arrives before timeout', async () => {
      nock('https://api.monday.com')
        .post('/v2')
        .delay(50)
        .reply(200, { data: { users: [{ id: '1' }] } });

      const apiClient = new ApiClient({ token: 'test-token' });
      const query = '{ users { id } }';

      const result = await apiClient.request(query, undefined, { timeout: 500 });
      expect(result).toEqual({ users: [{ id: '1' }] });
    });

    it('should work without timeout option', async () => {
      nock('https://api.monday.com')
        .post('/v2')
        .reply(200, { data: { users: [{ id: '1', name: 'John' }] } });

      const apiClient = new ApiClient({ token: 'test-token' });
      const query = '{ users { id name } }';

      const result = await apiClient.request(query);
      expect(result).toEqual({ users: [{ id: '1', name: 'John' }] });
    });
  });

  describe('rawRequest method', () => {
    it('should abort rawRequest when timeout is exceeded', async () => {
      nock('https://api.monday.com')
        .post('/v2')
        .delay(2000)
        .reply(200, { data: { users: [] } });

      const apiClient = new ApiClient({ token: 'test-token' });
      const query = '{ users { id } }';

      await expect(apiClient.rawRequest(query, undefined, { timeout: 100 })).rejects.toThrow('The user aborted a request.');
    });

    it('should complete rawRequest successfully when response arrives before timeout', async () => {
      nock('https://api.monday.com')
        .post('/v2')
        .delay(50)
        .reply(200, { data: { users: [{ id: '1' }] } });

      const apiClient = new ApiClient({ token: 'test-token' });
      const query = '{ users { id } }';

      const result = await apiClient.rawRequest(query, undefined, { timeout: 500 });
      expect(result.data).toEqual({ users: [{ id: '1' }] });
    });
  });
});
