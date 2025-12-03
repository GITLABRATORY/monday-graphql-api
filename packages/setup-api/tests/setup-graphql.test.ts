import { createFiles, installPackages, updatePackageJsonScripts, _resetCache } from '../lib/index';
import * as shell from 'shelljs';
import * as fs from 'fs';
import { detect } from 'package-manager-detector/detect';
import { resolveCommand } from 'package-manager-detector/commands';

jest.mock('shelljs', () => ({
  exec: jest.fn().mockReturnValue({ code: 0 }),
  exit: jest.fn(),
  mkdir: jest.fn(),
  which: jest.fn().mockReturnValue(true),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true), // package.json exists
  readFileSync: jest.fn().mockReturnValue(JSON.stringify({})),
}));

// Mocks are provided by moduleNameMapper in jest.config.ts
const mockedDetect = detect as jest.MockedFunction<typeof detect>;
const mockedResolveCommand = resolveCommand as jest.MockedFunction<typeof resolveCommand>;

describe('setupGraphQL with npm fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetCache(); // Reset the cached package manager detection
    // Mock no package manager detected (fallback to npm)
    mockedDetect.mockResolvedValue(null);
    mockedResolveCommand.mockReturnValue(null);
  });

  it('should install the necessary packages with npm when no package manager detected', async () => {
    await installPackages();

    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('npm install graphql-request'));
    expect(shell.exec).toHaveBeenCalledWith(
      expect.stringContaining(
        'npm install --save-dev @graphql-codegen/cli@^5.0.5 @graphql-codegen/client-preset@^4.8.0',
      ),
    );
  });

  it('should create necessary files', () => {
    createFiles();
    expect(fs.writeFileSync).toHaveBeenCalledWith('codegen.yml', expect.any(String));
    expect(fs.writeFileSync).toHaveBeenCalledWith('graphql.config.yml', expect.any(String));
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('src/queries.graphql.ts'),
      expect.any(String),
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith('fetch-schema.sh', expect.any(String), {
      mode: 0o755,
    });
  });

  it('should add correct scripts to package.json with npm when no package manager detected', async () => {
    await updatePackageJsonScripts();
    const writtenContent = JSON.parse(
      (fs.writeFileSync as jest.Mock).mock.calls.find((call) => call[0] === './package.json')[1],
    );
    expect(writtenContent.scripts['fetch:schema']).toEqual('bash fetch-schema.sh');
    expect(writtenContent.scripts['codegen']).toEqual('graphql-codegen');
    expect(writtenContent.scripts['fetch:generate']).toEqual('npm run fetch:schema && npm run codegen');
  });
});

describe('setupGraphQL with pnpm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetCache(); // Reset the cached package manager detection
    // Mock pnpm detection
    mockedDetect.mockResolvedValue({ agent: 'pnpm', name: 'pnpm', version: '8.0.0' });
    mockedResolveCommand.mockImplementation((agent, cmd, args) => {
      if (cmd === 'add') {
        return { command: 'pnpm', args: ['add', ...args] };
      }
      if (cmd === 'run') {
        return { command: 'pnpm', args: ['run', ...args] };
      }
      return null;
    });
  });

  it('should install packages with pnpm', async () => {
    await installPackages();

    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('pnpm add graphql-request'));
    expect(shell.exec).toHaveBeenCalledWith(expect.stringContaining('pnpm add -D @graphql-codegen/cli'));
  });

  it('should add correct scripts with pnpm run', async () => {
    await updatePackageJsonScripts();
    const writtenContent = JSON.parse(
      (fs.writeFileSync as jest.Mock).mock.calls.find((call) => call[0] === './package.json')[1],
    );
    expect(writtenContent.scripts['fetch:generate']).toEqual('pnpm run fetch:schema && pnpm run codegen');
  });
});
