#!/usr/bin/env node

import * as shell from 'shelljs';
import * as fs from 'fs';
import { detect } from 'package-manager-detector/detect';
import { resolveCommand } from 'package-manager-detector/commands';

const GRAPHQL_REQUEST = 'graphql-request@6.1.0';
const GRAPHQL = 'graphql@16.8.2';

type DetectResult = Awaited<ReturnType<typeof detect>>;

let cachedPm: DetectResult | undefined;

const detectPackageManager = async (): Promise<DetectResult> => {
  if (cachedPm !== undefined) {
    return cachedPm;
  }
  cachedPm = await detect();
  return cachedPm;
};

const getRunScriptCommand = (pm: DetectResult | null, scriptName: string): string => {
  if (!pm) {
    return `npm run ${scriptName}`;
  }
  const runCmd = resolveCommand(pm.agent, 'run', [scriptName]);
  if (!runCmd) {
    return `npm run ${scriptName}`;
  }
  return `${runCmd.command} ${runCmd.args.join(' ')}`;
};

const getInstallCommands = async (): Promise<string[]> => {
  const pm = await detectPackageManager();

  if (!pm) {
    console.warn('Could not detect package manager, falling back to npm');
    return [
      `npm install ${GRAPHQL_REQUEST} ${GRAPHQL}`,
      'npm install --save-dev @graphql-codegen/cli@^5.0.5 @graphql-codegen/client-preset@^4.8.0',
    ];
  }

  console.log(`Detected package manager: ${pm.agent}`);

  // Install production dependencies
  const prodCmd = resolveCommand(pm.agent, 'add', [GRAPHQL_REQUEST, GRAPHQL]);
  if (!prodCmd) {
    throw new Error(`Could not resolve add command for ${pm.agent}`);
  }
  const prodCommand = `${prodCmd.command} ${prodCmd.args.join(' ')}`;

  // Install dev dependencies
  const devCmd = resolveCommand(pm.agent, 'add', [
    '-D',
    '@graphql-codegen/cli@^5.0.5',
    '@graphql-codegen/client-preset@^4.8.0',
  ]);
  if (!devCmd) {
    throw new Error(`Could not resolve add command for ${pm.agent}`);
  }
  const devCommand = `${devCmd.command} ${devCmd.args.join(' ')}`;

  return [prodCommand, devCommand];
};

export const installPackages = async () => {
  const installCommands = await getInstallCommands();

  for (const command of installCommands) {
    console.log(`Executing: ${command}`);
    if (shell.exec(command).code !== 0) {
      console.error(`Error executing command: ${command}`);
      shell.exit(1);
    }
  }

  console.log('Packages installed');
};

export const createFiles = () => {
  const codegenConfig = `overwrite: true
schema: 'src/schema.graphql'
documents: 'src/**/*.graphql.ts'
ignoreNoDocuments: true
generates:
  src/generated/graphql/:
    presetConfig:
      fragmentMasking: false
    preset: client
    hooks:
      afterOneFileWrite:
        - node -e "const fs = require('fs'); fs.writeFileSync('src/generated/graphql/index.ts', '/* eslint-disable */\\nexport * from \\'./gql\\';');"`;

  fs.writeFileSync('codegen.yml', codegenConfig);

  console.log('Codegen config created');

  fs.writeFileSync('graphql.config.yml', 'schema: src/schema.graphql');
  console.log('created graphql.config.yml');

  shell.mkdir('-p', 'src');

  console.log('Created src folder');

  const queriesContent = `
import { gql } from "graphql-request";

export const exampleQuery = gql\`
  query GetBoards($ids: [ID!]) {
    boards(ids: $ids) {
      id
      name
    }
  }
\`;

export const exampleMutation = gql\`
  mutation CreateItem($boardId: ID!, $groupId: String!, $itemName: String!) {
    create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName) {
      id
      name
    }
  }
\`;
`;

  fs.writeFileSync('src/queries.graphql.ts', queriesContent);
  console.log('created src/queries.graphql.ts');

  const scriptContent = `#!/bin/bash
  curl "https://api.monday.com/v2/get_schema?format=sdl&version=current" -o src/schema.graphql
  `.trim();

  fs.writeFileSync('fetch-schema.sh', scriptContent, { mode: 0o755 });
  console.log('Fetch schema script created');
};

export const updatePackageJsonScripts = async () => {
  const packageJsonPath = './package.json';
  if (!fs.existsSync(packageJsonPath)) {
    console.error('package.json not found!');
    return;
  }

  const pm = await detectPackageManager();

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts['fetch:schema'] = 'bash fetch-schema.sh';
  packageJson.scripts['codegen'] = 'graphql-codegen';
  packageJson.scripts['fetch:generate'] =
    `${getRunScriptCommand(pm, 'fetch:schema')} && ${getRunScriptCommand(pm, 'codegen')}`;

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('Updated package.json with new scripts');
};

export const setupGraphQL = async () => {
  await installPackages();
  createFiles();
  await updatePackageJsonScripts();
  const pm = await detectPackageManager();
  console.log(
    `Setup complete! run \`${getRunScriptCommand(pm, 'fetch:generate')}\` to fetch the schema and generate types`,
  );
};

// Check if running directly from CLI and not imported
if (require.main === module) {
  setupGraphQL().catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}
