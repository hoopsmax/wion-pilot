import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DraftAnswer } from './answer.ts';
import type { CheckResult } from './check.ts';

/** Everything `wion review` needs to know about a proposal, next to its .feature file. */
export interface ProposalMeta {
  feature: string;
  title: string;
  provider: string;
  model: string;
  topic: string | undefined;
  /** The base of the code change, when drafted with --diff. */
  diffBase: string | undefined;
  createdAt: string;
  check: CheckResult;
  missingSteps: DraftAnswer['missingSteps'];
}

export interface SavedProposal {
  featureFile: string;
  /** True when an earlier, unreviewed proposal for the same feature was replaced. */
  replaced: boolean;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Writes <feature>.feature and <feature>.json; a newer draft of a feature replaces the older one. */
export async function saveProposal(
  folder: string,
  featureText: string,
  meta: ProposalMeta,
): Promise<SavedProposal> {
  await mkdir(folder, { recursive: true });
  const featureFile = join(folder, `${meta.feature}.feature`);
  const replaced = await exists(featureFile);
  await writeFile(featureFile, featureText);
  await writeFile(join(folder, `${meta.feature}.json`), `${JSON.stringify(meta, null, 2)}\n`);
  return { featureFile, replaced };
}

export interface Proposal {
  meta: ProposalMeta;
  featureText: string;
}

/** All proposals in the folder, oldest first; an empty list when there is no folder yet. */
export async function listProposals(folder: string): Promise<Proposal[]> {
  if (!(await exists(folder))) return [];
  const names = (await readdir(folder)).filter((name) => name.endsWith('.json')).sort();
  const proposals = await Promise.all(
    names.map(async (name): Promise<Proposal> => {
      const meta = JSON.parse(await readFile(join(folder, name), 'utf8')) as ProposalMeta;
      const featureText = await readFile(join(folder, `${meta.feature}.feature`), 'utf8');
      return { meta, featureText };
    }),
  );
  return proposals.sort((a, b) => a.meta.createdAt.localeCompare(b.meta.createdAt));
}
