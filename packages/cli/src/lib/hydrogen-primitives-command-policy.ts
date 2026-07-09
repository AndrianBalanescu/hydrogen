import {createRequire} from 'node:module';

import {outputNewline} from '@shopify/cli-kit/node/output';
import {joinPath} from '@shopify/cli-kit/node/path';
import {renderError} from '@shopify/cli-kit/node/ui';

export type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  hydrogen?: {
    type?: unknown;
  };
};

type UnsupportedCommandMessage = {
  body: string;
  nextSteps: string[];
};

type CommandPolicyResult =
  | {action: 'continue'}
  | {action: 'exit'; status: number};

export const IGNORED_HYDROGEN_PRIMITIVES_COMMANDS = new Set(['hydrogen:init']);

export const SUPPORTED_HYDROGEN_PRIMITIVES_COMMANDS = new Set([
  'hydrogen:customer-account:push',
  'hydrogen:customer-account-push',
  'hydrogen:deploy',
  'hydrogen:env:list',
  'hydrogen:env:pull',
  'hydrogen:env:push',
  'hydrogen:link',
  'hydrogen:list',
  'hydrogen:login',
  'hydrogen:logout',
  'hydrogen:unlink',
]);

export const UNSUPPORTED_HYDROGEN_PRIMITIVES_COMMANDS: Record<
  string,
  UnsupportedCommandMessage
> = {
  'hydrogen:build': {
    body: 'This version of Hydrogen does not manage your framework build pipeline.',
    nextSteps: ["Run your framework's build script instead."],
  },
  'hydrogen:check': {
    body: "The route diagnostics are tied to Hydrogen classic's Remix route conventions.",
    nextSteps: ["Use your framework's routing tools instead."],
  },
  'hydrogen:codegen': {
    body: 'The codegen workflow is tied to Hydrogen classic projects.',
    nextSteps: ["Use your app's GraphQL tooling instead."],
  },
  'hydrogen:dev': {
    body: 'This version of Hydrogen does not manage your framework dev server.',
    nextSteps: ["Run your app's dev script directly."],
  },
  'hydrogen:debug:cpu': {
    body: "The CPU profiler is tied to Hydrogen classic's Oxygen worker runtime.",
    nextSteps: ['Use your framework or runtime profiling tools instead.'],
  },
  'hydrogen:g': {
    body: "Route generation is tied to Hydrogen classic's route structure.",
    nextSteps: ["Create routes with your framework's routing tools instead."],
  },
  'hydrogen:generate:route': {
    body: "Route generation is tied to Hydrogen classic's route structure.",
    nextSteps: ["Create routes with your framework's routing tools instead."],
  },
  'hydrogen:generate:routes': {
    body: "Route generation is tied to Hydrogen classic's route structure.",
    nextSteps: ["Create routes with your framework's routing tools instead."],
  },
  'hydrogen:preview': {
    body: 'This version of Hydrogen does not manage your framework preview server.',
    nextSteps: ["Run your framework's preview script instead."],
  },
  'hydrogen:setup': {
    body: "Project setup is tied to Hydrogen classic's route structure.",
    nextSteps: ["Use your framework's setup flow instead."],
  },
  'hydrogen:setup:css': {
    body: "CSS setup is tied to Hydrogen classic's app structure.",
    nextSteps: ["Use your framework's CSS setup flow instead."],
  },
  'hydrogen:setup:markets': {
    body: "Markets setup is tied to Hydrogen classic's route structure.",
    nextSteps: ["Use your framework's routing tools instead."],
  },
  'hydrogen:setup:vite': {
    body: 'This version of Hydrogen does not use the Hydrogen classic Remix compiler. The Vite migration is only for Hydrogen classic projects.',
    nextSteps: ["Use your framework's migration path instead."],
  },
  'hydrogen:shortcut': {
    body: 'The CLI shortcut is tied to Hydrogen classic CLI workflows.',
    nextSteps: ["Use your app's package scripts instead."],
  },
  'hydrogen:upgrade': {
    body: 'The upgrade command is tied to Hydrogen classic migrations.',
    nextSteps: ['Update @shopify/hydrogen with your package manager instead.'],
  },
};

export async function applyHydrogenPrimitivesCommandPolicy({
  id,
  projectPath,
}: {
  id?: string;
  projectPath: string;
}): Promise<CommandPolicyResult> {
  if (
    !id ||
    !isHydrogenProject(projectPath) ||
    !isHydrogenPrimitivesProject(projectPath)
  ) {
    return {action: 'continue'};
  }

  if (SUPPORTED_HYDROGEN_PRIMITIVES_COMMANDS.has(id)) {
    return {action: 'continue'};
  }

  const unsupportedMessage = UNSUPPORTED_HYDROGEN_PRIMITIVES_COMMANDS[id];
  if (!unsupportedMessage) {
    return {action: 'continue'};
  }

  outputNewline();
  renderError({
    headline: `\`shopify ${id.replace(/:/g, ' ')}\` is not supported by this version of Hydrogen`,
    body: unsupportedMessage.body,
    nextSteps: unsupportedMessage.nextSteps,
  });

  return {action: 'exit', status: 1};
}

export function isHydrogenPrimitivesProject(projectPath: string) {
  try {
    const require = createRequire(joinPath(projectPath, 'package.json'));
    const hydrogenPackageJson = require('@shopify/hydrogen/package.json');

    return hydrogenPackageJson?.hydrogen?.type === 'primitives';
  } catch {
    return false;
  }
}

export function isHydrogenProject(projectPath: string) {
  try {
    const require = createRequire(import.meta.url);
    const projectPackageJson = require(joinPath(projectPath, 'package.json'));

    return [
      projectPackageJson?.dependencies,
      projectPackageJson?.devDependencies,
      projectPackageJson?.peerDependencies,
    ].some((dependencies) => !!dependencies?.['@shopify/hydrogen']);
  } catch {
    return false;
  }
}
