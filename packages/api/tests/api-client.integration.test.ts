import { MockAgent } from 'undici';
import { ApiClient } from '../lib/api-client';
import { MONDAY_API_ENDPOINT } from '../lib/constants';

const MONDAY_API_SUFFIX = '/v2';
const MONDAY_API_ORIGIN = MONDAY_API_ENDPOINT.replace(MONDAY_API_SUFFIX, '');

describe('ApiClient timeout integration', () => {
  let mockAgent: MockAgent;

  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
  });

  afterEach(async () => {
    await mockAgent.close();
  });

  // Helper to create ApiClient with mocked fetch
  const createMockedApiClient = () => {
    const mockedFetch = ((input: any, init: any) => {
      return fetch(input, { ...init, dispatcher: mockAgent });
    }) as typeof fetch;
    return new ApiClient({
      token: 'test-token',
      requestConfig: { fetch: mockedFetch },
    });
  };

  const jsonHeaders = { 'content-type': 'application/json' };

  describe('request method', () => {
    it('should abort request when timeout is exceeded', async () => {
      const mockPool = mockAgent.get(MONDAY_API_ORIGIN);
      mockPool
        .intercept({ path: MONDAY_API_SUFFIX, method: 'POST' })
        .reply(200, { data: { users: [] } }, { headers: jsonHeaders })
        .delay(2000);

      const apiClient = createMockedApiClient();
      const query = '{ users { id } }';

      await expect(apiClient.request(query, undefined, { timeout: 100 })).rejects.toThrow('This operation was aborted');
    });

    it('should complete successfully when response arrives before timeout', async () => {
      const mockPool = mockAgent.get(MONDAY_API_ORIGIN);
      mockPool
        .intercept({ path: MONDAY_API_SUFFIX, method: 'POST' })
        .reply(200, { data: { users: [{ id: '1' }] } }, { headers: jsonHeaders });

      const apiClient = createMockedApiClient();
      const query = '{ users { id } }';

      const result = await apiClient.request(query, undefined, { timeout: 500 });
      expect(result).toEqual({ users: [{ id: '1' }] });
    });

    it('should work without timeout option', async () => {
      const mockPool = mockAgent.get(MONDAY_API_ORIGIN);
      mockPool
        .intercept({ path: MONDAY_API_SUFFIX, method: 'POST' })
        .reply(200, { data: { users: [{ id: '1', name: 'John' }] } }, { headers: jsonHeaders });

      const apiClient = createMockedApiClient();
      const query = '{ users { id name } }';

      const result = await apiClient.request(query);
      expect(result).toEqual({ users: [{ id: '1', name: 'John' }] });
    });
  });

  describe('rawRequest method', () => {
    it('should abort rawRequest when timeout is exceeded', async () => {
      const mockPool = mockAgent.get(MONDAY_API_ORIGIN);
      mockPool
        .intercept({ path: MONDAY_API_SUFFIX, method: 'POST' })
        .reply(200, { data: { users: [] } }, { headers: jsonHeaders })
        .delay(2000);

      const apiClient = createMockedApiClient();
      const query = '{ users { id } }';

      await expect(apiClient.rawRequest(query, undefined, { timeout: 100 })).rejects.toThrow('This operation was aborted');
    });

    it('should complete rawRequest successfully when response arrives before timeout', async () => {
      const mockPool = mockAgent.get(MONDAY_API_ORIGIN);
      mockPool
        .intercept({ path: MONDAY_API_SUFFIX, method: 'POST' })
        .reply(200, { data: { users: [{ id: '1' }] } }, { headers: jsonHeaders });

      const apiClient = createMockedApiClient();
      const query = '{ users { id } }';

      const result = await apiClient.rawRequest(query, undefined, { timeout: 500 });
      expect(result.data).toEqual({ users: [{ id: '1' }] });
    });
  });
});

describe('ApiClient file upload integration', () => {
  let mockAgent: MockAgent;
  let capturedRequest: { body: any; headers: Record<string, string> } | null = null;

  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    capturedRequest = null;
  });

  afterEach(async () => {
    await mockAgent.close();
  });

  // Helper to create ApiClient with mocked fetch that captures the request
  const createMockedApiClient = () => {
    const mockedFetch = (async (input: any, init: any) => {
      // Capture the request body and headers for assertions
      capturedRequest = {
        body: init?.body,
        headers: init?.headers || {},
      };
      return fetch(input, { ...init, dispatcher: mockAgent });
    }) as typeof fetch;

    return new ApiClient({
      token: 'test-token',
      requestConfig: { fetch: mockedFetch },
    });
  };

  const jsonHeaders = { 'content-type': 'application/json' };

  describe('multipart form data conversion', () => {
    it('should convert request with single file to multipart/form-data', async () => {
      const mockPool = mockAgent.get(MONDAY_API_ORIGIN);
      mockPool
        .intercept({ path: MONDAY_API_SUFFIX, method: 'POST' })
        .reply(200, { data: { add_file_to_column: { id: '123' } } }, { headers: jsonHeaders });

      const apiClient = createMockedApiClient();
      const query = `mutation ($file: File!) { add_file_to_column(file: $file, item_id: 123, column_id: "files") { id } }`;
      const file = new Blob(['test file content'], { type: 'text/plain' });

      await apiClient.request(query, { file });

      // Verify request was converted to FormData
      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.body).toBeInstanceOf(FormData);

      const formData = capturedRequest!.body as FormData;

      // Verify FormData structure
      expect(formData.get('query')).toBe(query);

      const variables = JSON.parse(formData.get('variables') as string);
      expect(variables).toEqual({ file: null }); // File replaced with null

      const map = JSON.parse(formData.get('map') as string);
      expect(map).toEqual({ '0': ['variables.file'] });

      expect(formData.get('0')).toBeInstanceOf(Blob);
    });

    it('should convert request with multiple files in array to multipart/form-data', async () => {
      const mockPool = mockAgent.get(MONDAY_API_ORIGIN);
      mockPool
        .intercept({ path: MONDAY_API_SUFFIX, method: 'POST' })
        .reply(200, { data: { upload_files: { success: true } } }, { headers: jsonHeaders });

      const apiClient = createMockedApiClient();
      const query = `mutation ($files: [File!]!) { upload_files(files: $files) { success } }`;
      const file1 = new Blob(['file 1 content'], { type: 'text/plain' });
      const file2 = new Blob(['file 2 content'], { type: 'text/plain' });

      await apiClient.request(query, { files: [file1, file2] });

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.body).toBeInstanceOf(FormData);

      const formData = capturedRequest!.body as FormData;

      const variables = JSON.parse(formData.get('variables') as string);
      expect(variables).toEqual({ files: [null, null] }); // Files replaced with null

      const map = JSON.parse(formData.get('map') as string);
      expect(map).toEqual({
        '0': ['variables.files.0'],
        '1': ['variables.files.1'],
      });

      expect(formData.get('0')).toBeInstanceOf(Blob);
      expect(formData.get('1')).toBeInstanceOf(Blob);
    });

    it('should handle nested files in objects', async () => {
      const mockPool = mockAgent.get(MONDAY_API_ORIGIN);
      mockPool
        .intercept({ path: MONDAY_API_SUFFIX, method: 'POST' })
        .reply(200, { data: { upload: { id: '456' } } }, { headers: jsonHeaders });

      const apiClient = createMockedApiClient();
      const query = `mutation ($input: UploadInput!) { upload(input: $input) { id } }`;
      const file = new Blob(['nested file'], { type: 'application/pdf' });

      await apiClient.request(query, {
        input: {
          name: 'document',
          attachment: {
            file,
            metadata: { size: 100 },
          },
        },
      });

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.body).toBeInstanceOf(FormData);

      const formData = capturedRequest!.body as FormData;

      const variables = JSON.parse(formData.get('variables') as string);
      expect(variables).toEqual({
        input: {
          name: 'document',
          attachment: {
            file: null,
            metadata: { size: 100 },
          },
        },
      });

      const map = JSON.parse(formData.get('map') as string);
      expect(map).toEqual({ '0': ['variables.input.attachment.file'] });
    });

    it('should remove Content-Type header for multipart requests', async () => {
      const mockPool = mockAgent.get(MONDAY_API_ORIGIN);
      mockPool
        .intercept({ path: MONDAY_API_SUFFIX, method: 'POST' })
        .reply(200, { data: { upload: { id: '789' } } }, { headers: jsonHeaders });

      const apiClient = createMockedApiClient();
      const query = `mutation ($file: File!) { upload(file: $file) { id } }`;
      const file = new Blob(['content'], { type: 'text/plain' });

      await apiClient.request(query, { file });

      expect(capturedRequest).not.toBeNull();
      // Content-Type should be removed to let browser set it with boundary
      expect(capturedRequest!.headers['Content-Type']).toBeUndefined();
      expect(capturedRequest!.headers['content-type']).toBeUndefined();
    });

    it('should keep request as JSON when no files are present', async () => {
      const mockPool = mockAgent.get(MONDAY_API_ORIGIN);
      mockPool
        .intercept({ path: MONDAY_API_SUFFIX, method: 'POST' })
        .reply(200, { data: { users: [{ id: '1' }] } }, { headers: jsonHeaders });

      const apiClient = createMockedApiClient();
      const query = '{ users { id } }';

      await apiClient.request(query, { limit: 10 });

      expect(capturedRequest).not.toBeNull();
      // Should remain as string (JSON), not FormData
      expect(typeof capturedRequest!.body).toBe('string');
      expect(capturedRequest!.headers['Content-Type']).toBe('application/json');
    });

    it('should work with rawRequest method for file uploads', async () => {
      const mockPool = mockAgent.get(MONDAY_API_ORIGIN);
      mockPool
        .intercept({ path: MONDAY_API_SUFFIX, method: 'POST' })
        .reply(200, { data: { add_file_to_column: { id: '999' } } }, { headers: jsonHeaders });

      const apiClient = createMockedApiClient();
      const query = `mutation ($file: File!) { add_file_to_column(file: $file, item_id: 456, column_id: "files") { id } }`;
      const file = new Blob(['raw request file'], { type: 'image/png' });

      const result = await apiClient.rawRequest(query, { file });

      expect(result.data).toEqual({ add_file_to_column: { id: '999' } });
      expect(capturedRequest!.body).toBeInstanceOf(FormData);
    });

    it('should handle mixed files and regular variables', async () => {
      const mockPool = mockAgent.get(MONDAY_API_ORIGIN);
      mockPool
        .intercept({ path: MONDAY_API_SUFFIX, method: 'POST' })
        .reply(200, { data: { create_item: { id: '111' } } }, { headers: jsonHeaders });

      const apiClient = createMockedApiClient();
      const query = `mutation ($name: String!, $file: File!, $tags: [String!]) { create_item(name: $name, file: $file, tags: $tags) { id } }`;
      const file = new Blob(['content'], { type: 'text/plain' });

      await apiClient.request(query, {
        name: 'My Item',
        file,
        tags: ['important', 'urgent'],
      });

      expect(capturedRequest!.body).toBeInstanceOf(FormData);

      const formData = capturedRequest!.body as FormData;
      const variables = JSON.parse(formData.get('variables') as string);

      expect(variables).toEqual({
        name: 'My Item',
        file: null,
        tags: ['important', 'urgent'],
      });

      const map = JSON.parse(formData.get('map') as string);
      expect(map).toEqual({ '0': ['variables.file'] });
    });
  });
});
