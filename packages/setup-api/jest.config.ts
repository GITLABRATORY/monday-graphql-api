import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  verbose: true,
  testEnvironment: 'node',
  preset: 'ts-jest',
  clearMocks: true,
  // Mock ESM modules from package-manager-detector since Jest can't parse them
  moduleNameMapper: {
    '^package-manager-detector/detect$': '<rootDir>/tests/__mocks__/package-manager-detector/detect.ts',
    '^package-manager-detector/commands$': '<rootDir>/tests/__mocks__/package-manager-detector/commands.ts',
  },
};

export default config;
