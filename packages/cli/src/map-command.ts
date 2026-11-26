import { join } from 'node:path';
import { crawl, writeMap } from '../../core/src/map/crawler.ts';
import { loadConfig, type Environment } from '../../core/src/shared/config.ts';
import { DEFAULT_CONFIG, type MapArgs } from './args.ts';
import { assertReachable } from './reachable.ts';

export async function runMap(
  args: MapArgs,
  env: Environment,
  log: (line: string) => void,
): Promise<void> {
  const config = await loadConfig(args.configPath ?? DEFAULT_CONFIG, {
    required: args.configPath !== undefined,
    env,
  });
  await assertReachable(args.startUrl);
  const signIn = config.map?.signIn;
  const chromiumPath = env['PW_CHROMIUM_PATH'];
  log(`Mapping ${args.startUrl}${signIn ? `, signing in at ${signIn.url}` : ''}…`);
  const map = await crawl({
    startUrl: args.startUrl,
    outDir: args.outDir,
    maxPages: args.maxPages,
    maxDepth: args.maxDepth,
    allowedDomains: args.allowedDomains,
    log,
    ...(signIn ? { signIn } : {}),
    ...(chromiumPath ? { chromiumPath } : {}),
  });
  await writeMap(map, args.outDir);
  log(`${String(map.screens.length)} screens, ${String(map.skipped.length)} links not followed.`);
  log(`Map: ${join(args.outDir, 'app-map.json')}`);
  log(`Viewer: ${join(args.outDir, 'index.html')}`);
}
