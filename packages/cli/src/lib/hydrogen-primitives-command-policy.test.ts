import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {COMMANDS} from '../index.js';
import {
  applyHydrogenPrimitivesCommandPolicy,
  IGNORED_HYDROGEN_PRIMITIVES_COMMANDS,
  isHydrogenPrimitivesProject,
  isHydrogenProject,
  SUPPORTED_HYDROGEN_PRIMITIVES_COMMANDS,
  UNSUPPORTED_HYDROGEN_PRIMITIVES_COMMANDS,
} from './hydrogen-primitives-command-policy.js';

describe('Hydrogen primitives command policy', () => {
  const outputMock = mockAndCaptureOutput();
  let projectPath: string;

  beforeEach(() => {
    outputMock.clear();
    projectPath = mkdtempSync(join(tmpdir(), 'hydrogen-primitives-policy-'));
  });

  afterEach(() => {
    rmSync(projectPath, {force: true, recursive: true});
  });

  it('detects Hydrogen primitives from @shopify/hydrogen package type metadata', () => {
    writeProjectPackageJson({
      dependencies: {'@shopify/hydrogen': 'workspace:*'},
    });
    writeHydrogenPackageJson({hydrogen: {type: 'primitives'}});

    expect(isHydrogenPrimitivesProject(projectPath)).toBe(true);
  });

  it('keeps classic behavior when package type metadata is missing', async () => {
    writeProjectPackageJson({dependencies: {'@shopify/hydrogen': '2026.1.0'}});
    writeHydrogenPackageJson({});

    expect(isHydrogenProject(projectPath)).toBe(true);
    expect(isHydrogenPrimitivesProject(projectPath)).toBe(false);

    const result = await applyHydrogenPrimitivesCommandPolicy({
      id: 'hydrogen:setup:vite',
      projectPath,
    });

    expect(result).toEqual({action: 'continue'});
    expect(outputMock.output()).toBe('');
  });

  it('continues when command id is missing', async () => {
    writeProjectPackageJson({
      dependencies: {'@shopify/hydrogen': 'workspace:*'},
    });
    writeHydrogenPackageJson({hydrogen: {type: 'primitives'}});

    const result = await applyHydrogenPrimitivesCommandPolicy({projectPath});

    expect(result).toEqual({action: 'continue'});
    expect(outputMock.output()).toBe('');
  });

  it('continues for ignored commands', async () => {
    writeProjectPackageJson({
      dependencies: {'@shopify/hydrogen': 'workspace:*'},
    });
    writeHydrogenPackageJson({hydrogen: {type: 'primitives'}});

    const result = await applyHydrogenPrimitivesCommandPolicy({
      id: 'hydrogen:init',
      projectPath,
    });

    expect(result).toEqual({action: 'continue'});
    expect(outputMock.output()).toBe('');
  });

  it('does not identify projects from hoisted @shopify/hydrogen packages alone', async () => {
    const workspacePath = mkdtempSync(
      join(tmpdir(), 'hydrogen-primitives-policy-workspace-'),
    );
    const nestedProjectPath = join(workspacePath, 'packages', 'not-hydrogen');

    mkdirSync(nestedProjectPath, {recursive: true});
    writeJson(join(nestedProjectPath, 'package.json'), {name: 'not-hydrogen'});
    writeHydrogenPackageJson(
      {hydrogen: {type: 'primitives'}},
      join(workspacePath, 'node_modules', '@shopify', 'hydrogen'),
    );

    try {
      expect(isHydrogenProject(nestedProjectPath)).toBe(false);

      const result = await applyHydrogenPrimitivesCommandPolicy({
        id: 'hydrogen:setup:vite',
        projectPath: nestedProjectPath,
      });

      expect(result).toEqual({action: 'continue'});
      expect(outputMock.output()).toBe('');
    } finally {
      rmSync(workspacePath, {force: true, recursive: true});
    }
  });

  it('allows Shopify integration commands for Hydrogen primitives projects', async () => {
    writeProjectPackageJson({
      dependencies: {'@shopify/hydrogen': 'workspace:*'},
    });
    writeHydrogenPackageJson({hydrogen: {type: 'primitives'}});

    const result = await applyHydrogenPrimitivesCommandPolicy({
      id: 'hydrogen:env:pull',
      projectPath,
    });

    expect(result).toEqual({action: 'continue'});
    expect(outputMock.output()).toBe('');
  });

  it('blocks classic-only commands for Hydrogen primitives projects', async () => {
    writeProjectPackageJson({
      dependencies: {'@shopify/hydrogen': 'workspace:*'},
    });
    writeHydrogenPackageJson({hydrogen: {type: 'primitives'}});

    const result = await applyHydrogenPrimitivesCommandPolicy({
      id: 'hydrogen:setup:vite',
      projectPath,
    });

    expect(result).toEqual({action: 'exit', status: 1});
    expect(outputMock.output()).toContain(
      '`shopify hydrogen setup vite` is not supported by this version of Hydrogen',
    );
    expect(outputMock.output()).toContain(
      "Use your framework's migration path instead.",
    );
  });

  it('blocks Hydrogen dev for Hydrogen primitives projects', async () => {
    writeProjectPackageJson({
      dependencies: {'@shopify/hydrogen': 'workspace:*'},
      scripts: {dev: 'react-router dev'},
    });
    writeHydrogenPackageJson({hydrogen: {type: 'primitives'}});

    const result = await applyHydrogenPrimitivesCommandPolicy({
      id: 'hydrogen:dev',
      projectPath,
    });

    expect(result).toEqual({action: 'exit', status: 1});
    expect(outputMock.output()).toContain(
      '`shopify hydrogen dev` is not supported by this version of Hydrogen',
    );
    expect(outputMock.output()).toContain(
      "Run your app's dev script directly.",
    );
  });

  it('blocks classic Hydrogen CPU profiling for Hydrogen primitives projects', async () => {
    writeProjectPackageJson({
      dependencies: {'@shopify/hydrogen': 'workspace:*'},
    });
    writeHydrogenPackageJson({hydrogen: {type: 'primitives'}});

    const result = await applyHydrogenPrimitivesCommandPolicy({
      id: 'hydrogen:debug:cpu',
      projectPath,
    });

    expect(result).toEqual({action: 'exit', status: 1});
    expect(outputMock.output()).toContain(
      '`shopify hydrogen debug cpu` is not supported by this version of Hydrogen',
    );
    expect(outputMock.output()).toContain(
      'Use your framework or runtime profiling tools instead.',
    );
  });

  it('categorizes every registered Hydrogen command', () => {
    const categorizedCommandIds = new Set([
      ...SUPPORTED_HYDROGEN_PRIMITIVES_COMMANDS,
      ...Object.keys(UNSUPPORTED_HYDROGEN_PRIMITIVES_COMMANDS),
      ...IGNORED_HYDROGEN_PRIMITIVES_COMMANDS,
    ]);

    const uncategorizedCommandIds = Object.keys(COMMANDS)
      .filter((id) => id.startsWith('hydrogen:'))
      .filter((id) => !categorizedCommandIds.has(id));

    expect(uncategorizedCommandIds).toEqual([]);
  });

  function writeProjectPackageJson(packageJson: Record<string, unknown>) {
    writeJson(join(projectPath, 'package.json'), packageJson);
  }

  function writeHydrogenPackageJson(
    packageJson: Record<string, unknown>,
    hydrogenPackagePath = join(
      projectPath,
      'node_modules',
      '@shopify',
      'hydrogen',
    ),
  ) {
    mkdirSync(hydrogenPackagePath, {recursive: true});
    writeJson(join(hydrogenPackagePath, 'package.json'), {
      name: '@shopify/hydrogen',
      exports: {'./package.json': './package.json'},
      ...packageJson,
    });
  }

  function writeJson(path: string, data: Record<string, unknown>) {
    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  }
});
