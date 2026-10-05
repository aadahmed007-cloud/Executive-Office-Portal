import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 3: Repository Context (ctx: UserContext) AST Guard', () => {
  it('enforces that every interface method (except public helpers) strictly requires ctx: UserContext', () => {
    const filePath = path.resolve('src/data/contracts/index.ts');
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract everything inside each interface to avoid scanning outer declarations
    const interfaceRegex = /export\s+interface\s+(I[A-Za-z]+Repository)\s*\{([\s\S]*?)\}/g;
    let match;
    let checkedMethodsCount = 0;

    const publicHelpers = ['getByUsername', 'getNextSerial', 'getNextCode'];

    while ((match = interfaceRegex.exec(content)) !== null) {
      const interfaceName = match[1];
      const interfaceBody = match[2];

      const methodRegex = /([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*:\s*Promise\s*<[\s\S]*?>\s*;/g;
      let methodMatch;

      while ((methodMatch = methodRegex.exec(interfaceBody)) !== null) {
        const methodName = methodMatch[1].trim();
        const paramsText = methodMatch[2].trim();

        if (publicHelpers.includes(methodName)) {
          continue;
        }

        checkedMethodsCount++;

        const hasCtxParam = paramsText.includes('ctx: UserContext') || paramsText.includes('ctx : UserContext');
        if (!hasCtxParam) {
          expect.fail(`Interface Method "${methodName}" in "${interfaceName}" is missing required "ctx: UserContext" parameter. Parameters found: (${paramsText})`);
        }

        if (paramsText.includes('ctx?')) {
          expect.fail(`Interface Method "${methodName}" in "${interfaceName}" declares "ctx" as optional.`);
        }

        if (paramsText.includes('UserContext | undefined') || paramsText.includes('UserContext|undefined')) {
          expect.fail(`Interface Method "${methodName}" in "${interfaceName}" allows undefined in UserContext.`);
        }
      }
    }

    expect(checkedMethodsCount).toBeGreaterThan(30);
  });

  it('enforces that every implementation method (except public helpers) strictly requires ctx: UserContext', () => {
    const filePaths = [
      path.resolve('src/data/sqlite/repositories.ts'),
      path.resolve('src/data/api/apiRepositories.ts')
    ];

    const publicHelpers = ['getByUsername', 'getNextSerial', 'getNextCode', 'isCtx', 'parseGetAllArgs', 'apiRequest', 'parseApiResponse', 'computeAuditEntryHash', 'toUserContext'];
    let checkedMethodsCount = 0;

    for (const filePath of filePaths) {
      const content = fs.readFileSync(filePath, 'utf8');

      // Scan for any "async methodName(params)" pattern
      const methodRegex = /async\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g;
      let methodMatch;

      while ((methodMatch = methodRegex.exec(content)) !== null) {
        const methodName = methodMatch[1].trim();
        const paramsText = methodMatch[2].trim();

        if (publicHelpers.includes(methodName)) {
          continue;
        }

        checkedMethodsCount++;

        const hasCtxParam = paramsText.includes('ctx: UserContext') || paramsText.includes('ctx : UserContext');
        if (!hasCtxParam) {
          expect.fail(`Implementation Method "${methodName}" in file "${path.basename(filePath)}" is missing required "ctx: UserContext" parameter. Parameters found: (${paramsText})`);
        }

        if (paramsText.includes('ctx?')) {
          expect.fail(`Implementation Method "${methodName}" in file "${path.basename(filePath)}" declares "ctx" as optional.`);
        }

        if (paramsText.includes('UserContext | undefined') || paramsText.includes('UserContext|undefined')) {
          expect.fail(`Implementation Method "${methodName}" in file "${path.basename(filePath)}" allows undefined context.`);
        }
      }
    }

    expect(checkedMethodsCount).toBeGreaterThan(60);
  });
});
