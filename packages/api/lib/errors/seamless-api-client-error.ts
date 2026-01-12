export class SeamlessApiClientError extends Error {
  response: { errors: any; data?: any; extensions?: any };
  type: string;

  constructor(message: string, errors: any, data?: any, extensions?: any) {
    super(message);
    this.response = { errors, data, extensions };
    this.name = this.constructor.name;
    this.type = 'SeamlessApiClientError';
  }
}
