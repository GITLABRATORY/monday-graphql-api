import { RequestMiddleware, Variables } from 'graphql-request/build/esm/types';

interface FileEntry {
  path: string;
  file: File | Blob;
}

/**
 * Checks if a value is a File or Blob
 */
const isFile = (value: unknown): value is File | Blob => {
  return (typeof File !== 'undefined' && value instanceof File) || (typeof Blob !== 'undefined' && value instanceof Blob);
};

/**
 * Checks if variables contain any File or Blob objects
 */
const hasFiles = (variables: Variables | undefined): boolean => {
  if (!variables) {
    return false;
  }

  const check = (value: unknown): boolean => {
    if (isFile(value)) {
      return true;
    }
    if (Array.isArray(value)) {
      return value.some(check);
    }
    if (value !== null && typeof value === 'object') {
      return Object.values(value).some(check);
    }
    return false;
  };

  return check(variables);
};

/**
 * Recursively extracts files from variables and returns the cleaned variables
 * along with file mappings for the multipart request spec.
 *
 * @param variables - The original variables object
 * @param path - Current path in the object (for building variable paths)
 * @returns Object with cleaned variables (files replaced with null) and file mappings
 */
const extractFiles = (
  variables: Variables,
  path = 'variables'
): { cleanedVariables: Variables; files: FileEntry[] } => {
  const files: FileEntry[] = [];

  const processValue = (value: unknown, currentPath: string): unknown => {
    if (isFile(value)) {
      files.push({ path: currentPath, file: value });
      return null; // Replace file with null per the GraphQL multipart request specification
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => processValue(item, `${currentPath}.${index}`));
    }

    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = processValue(val, `${currentPath}.${key}`);
      }
      return result;
    }

    return value;
  };

  const cleanedVariables = processValue(variables, path) as Variables;
  return { cleanedVariables, files };
};

/**
 * Creates a FormData object for GraphQL multipart file upload requests
 * following the GraphQL multipart request specification.
 */
const createMultipartFormData = (query: string, variables: Variables, files: FileEntry[]): FormData => {
  const formData = new FormData();

  // Add query and variables as separate fields
  formData.append('query', query);
  formData.append('variables', JSON.stringify(variables));

  // Build the map: { "0": ["variables.file"], "1": ["variables.files.0"] }
  const map: Record<string, string[]> = {};
  files.forEach((entry, index) => {
    map[String(index)] = [entry.path];
  });
  formData.append('map', JSON.stringify(map));

  // Add files with their index as the key
  files.forEach((entry, index) => {
    formData.append(String(index), entry.file);
  });

  return formData;
};

/**
 * Creates a request middleware that automatically handles file uploads
 * by converting requests to multipart/form-data when files are detected in variables.
 *
 * This middleware intercepts the request before it's sent, checks for File/Blob objects
 * in the variables, and if found, converts the request body to FormData following
 * the GraphQL multipart request specification.
 *
 * @param existingMiddleware - Optional existing middleware to chain with
 * @returns A RequestMiddleware function that handles file uploads
 */
export const createFileUploadMiddleware = (existingMiddleware?: RequestMiddleware): RequestMiddleware => {
  return async (request) => {
    // First, apply any existing middleware
    const processedRequest = existingMiddleware ? await existingMiddleware(request) : request;

    const { variables, body } = processedRequest;

    // Check if variables contain files (using original variables, not the stringified body)
    if (variables && hasFiles(variables)) {
      // Parse the body to get the query string
      let query: string;
      if (typeof body === 'string') {
        try {
          const parsed = JSON.parse(body);
          query = parsed.query;
        } catch {
          // If we can't parse the body, return the request as-is
          return processedRequest;
        }
      } else {
        // Body is not a string (shouldn't happen in normal GraphQL flow)
        return processedRequest;
      }

      // Extract files and create FormData
      const { cleanedVariables, files } = extractFiles(variables);
      const formData = createMultipartFormData(query, cleanedVariables, files);

      // Remove Content-Type header to let the browser set it with the correct boundary
      const headers = { ...(processedRequest.headers as Record<string, string>) };
      delete headers['Content-Type'];
      delete headers['content-type'];

      return {
        ...processedRequest,
        body: formData,
        headers,
      };
    }
    return processedRequest;
  };
};
