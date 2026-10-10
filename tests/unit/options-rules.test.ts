import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultState } from '../../src/core/defaults';
import type { AppState, ProxyProfile, Rule } from '../../src/core/types';
import { resolveTarget } from '../../src/core/rule-matcher';
import { validateRule } from '../../src/core/schema';
import { getState, setState, updateState } from '../../src/shared/storage';
import { installChromeMock, type ChromeMockController } from '../setup/chrome-mock';

describe('Options: Rules Management (Task 13)', () => {
  let mockCtrl: ChromeMockController;

  const profileA: ProxyProfile = {
    id: 'p-a',
    name: 'Proxy A',
    color: '#2563eb',
    scheme: 'http',
    host: 'proxy-a.net',
    port: 8080,
    bypassList: [],
  };

  const profileB: ProxyProfile = {
    id: 'p-b',
    name: 'Proxy B',
    color: '#10b981',
    scheme: 'http',
    host: 'proxy-b.net',
    port: 8080,
    bypassList: [],
  };

  beforeEach(() => {
    mockCtrl = installChromeMock();
    mockCtrl.reset();
  });

  describe('Rule ordering and priority in resolution', () => {
    it('rule order determines resolution priority (first match wins)', async () => {
      // Rule 0: *.corp.internal -> Proxy A
      const wildcardRule: Rule = {
        id: 'r-wildcard',
        enabled: true,
        matchType: 'wildcard',
        pattern: '*.corp.internal',
        target: { type: 'profile', profileId: profileA.id },
      };

      // Rule 1: api.corp.internal -> Direct
      const specificRule: Rule = {
        id: 'r-specific',
        enabled: true,
        matchType: 'domain',
        pattern: 'api.corp.internal',
        target: { type: 'direct' },
      };

      // Setup 1: Specific rule first, wildcard second
      const stateSpecificFirst: AppState = {
        ...createDefaultState(),
        mode: { kind: 'auto', defaultTarget: { type: 'direct' } },
        profiles: [profileA, profileB],
        rules: [specificRule, wildcardRule],
      };
      await setState(stateSpecificFirst);

      let res = resolveTarget(stateSpecificFirst, 'api.corp.internal');
      expect(res.target).toEqual({ type: 'direct' });
      expect(res.ruleId).toBe('r-specific');

      // Setup 2: Swap priority - Wildcard first, specific second
      await updateState((prev) => {
        const copy = [...prev.rules];
        const temp = copy[0];
        copy[0] = copy[1];
        copy[1] = temp;
        return { ...prev, rules: copy };
      });

      const stateWildcardFirst = await getState();
      res = resolveTarget(stateWildcardFirst, 'api.corp.internal');
      // Now wildcard rule matches first!
      expect(res.target).toEqual({ type: 'profile', profileId: profileA.id });
      expect(res.ruleId).toBe('r-wildcard');
    });

    it('moving rules up and down swaps indices accurately', async () => {
      const r1: Rule = {
        id: 'r-1',
        enabled: true,
        matchType: 'domain',
        pattern: 'one.com',
        target: { type: 'direct' },
      };
      const r2: Rule = {
        id: 'r-2',
        enabled: true,
        matchType: 'domain',
        pattern: 'two.com',
        target: { type: 'direct' },
      };
      const r3: Rule = {
        id: 'r-3',
        enabled: true,
        matchType: 'domain',
        pattern: 'three.com',
        target: { type: 'direct' },
      };

      await setState({
        ...createDefaultState(),
        rules: [r1, r2, r3],
      });

      // Move index 1 (r2) UP to index 0
      await updateState((prev) => {
        const copy = [...prev.rules];
        const temp = copy[1];
        copy[1] = copy[0];
        copy[0] = temp;
        return { ...prev, rules: copy };
      });

      let state = await getState();
      expect(state.rules.map((r) => r.id)).toEqual(['r-2', 'r-1', 'r-3']);

      // Move index 0 (r2) DOWN to index 1
      await updateState((prev) => {
        const copy = [...prev.rules];
        const temp = copy[0];
        copy[0] = copy[1];
        copy[1] = temp;
        return { ...prev, rules: copy };
      });

      state = await getState();
      expect(state.rules.map((r) => r.id)).toEqual(['r-1', 'r-2', 'r-3']);
    });
  });

  describe('Batch Import logic', () => {
    it('creates multiple domain rules while skipping duplicates and empty lines', async () => {
      const existing: Rule = {
        id: 'r-existing',
        enabled: true,
        matchType: 'domain',
        pattern: 'github.com',
        target: { type: 'direct' },
      };

      await setState({
        ...createDefaultState(),
        profiles: [profileA],
        rules: [existing],
      });

      const batchRaw = `
        https://gitlab.com/repo/sub
        GITHUB.COM
        
        bitbucket.org:443
        gitlab.com
      `;

      const lines = batchRaw
        .split('\n')
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean);

      const existingSet = new Set(
        (await getState()).rules
          .filter((r) => r.matchType === 'domain')
          .map((r) => r.pattern.toLowerCase())
      );

      const newRules: Rule[] = [];
      let added = 0;
      let skipped = 0;

      for (const raw of lines) {
        let domain = raw;
        try {
          if (domain.includes('://')) {
            domain = new URL(domain).hostname;
          } else if (domain.includes('/')) {
            domain = domain.split('/')[0];
          } else if (domain.includes(':')) {
            domain = domain.split(':')[0];
          }
        } catch {}

        domain = domain.trim();
        if (!domain || existingSet.has(domain)) {
          skipped++;
          continue;
        }

        existingSet.add(domain);
        newRules.push({
          id: `batch-${added}`,
          enabled: true,
          matchType: 'domain',
          pattern: domain,
          target: { type: 'profile', profileId: profileA.id },
        });
        added++;
      }

      await updateState((prev) => ({
        ...prev,
        rules: [...newRules, ...prev.rules],
      }));

      expect(added).toBe(2); // gitlab.com, bitbucket.org
      expect(skipped).toBe(2); // GITHUB.COM (duplicate of github.com), gitlab.com (duplicate of 1st)

      const finalState = await getState();
      expect(finalState.rules).toHaveLength(3);
      expect(finalState.rules[0].pattern).toBe('gitlab.com');
      expect(finalState.rules[1].pattern).toBe('bitbucket.org');
      expect(finalState.rules[2].pattern).toBe('github.com');
    });
  });

  describe('Delete and Undo behavior', () => {
    it('restores deleted rule at its original index when undo is triggered', async () => {
      const r1: Rule = { id: 'r-1', enabled: true, matchType: 'domain', pattern: '1.com', target: { type: 'direct' } };
      const r2: Rule = { id: 'r-2', enabled: true, matchType: 'domain', pattern: '2.com', target: { type: 'direct' } };
      const r3: Rule = { id: 'r-3', enabled: true, matchType: 'domain', pattern: '3.com', target: { type: 'direct' } };

      await setState({
        ...createDefaultState(),
        rules: [r1, r2, r3],
      });

      // Delete index 1 (r2)
      const deletedIndex = 1;
      const deletedRule = (await getState()).rules[deletedIndex];

      await updateState((prev) => ({
        ...prev,
        rules: prev.rules.filter((_, i) => i !== deletedIndex),
      }));

      let state = await getState();
      expect(state.rules.map((r) => r.id)).toEqual(['r-1', 'r-3']);

      // Undo: re-insert deletedRule at deletedIndex
      await updateState((prev) => {
        const copy = [...prev.rules];
        copy.splice(deletedIndex, 0, deletedRule);
        return { ...prev, rules: copy };
      });

      state = await getState();
      expect(state.rules.map((r) => r.id)).toEqual(['r-1', 'r-2', 'r-3']);
      expect(state.rules[1].pattern).toBe('2.com');
    });
  });

  describe('Rule validation & Orphan detection', () => {
    it('validates rule pattern syntax for regex and IP-CIDR', () => {
      const validCidr: Rule = {
        id: 'r-cidr',
        enabled: true,
        matchType: 'ip-cidr',
        pattern: '172.16.0.0/12',
        target: { type: 'direct' },
      };
      expect(validateRule(validCidr).ok).toBe(true);

      const invalidCidr: Rule = {
        id: 'r-bad-cidr',
        enabled: true,
        matchType: 'ip-cidr',
        pattern: '999.1.1.1/33',
        target: { type: 'direct' },
      };
      expect(validateRule(invalidCidr).ok).toBe(false);

      const invalidRegex: Rule = {
        id: 'r-bad-regex',
        enabled: true,
        matchType: 'regex',
        pattern: '[unclosed',
        target: { type: 'direct' },
      };
      expect(validateRule(invalidRegex).ok).toBe(false);
    });

    it('identifies orphan rules when target profile is missing', () => {
      const orphanRule: Rule = {
        id: 'r-orphan',
        enabled: true,
        matchType: 'domain',
        pattern: 'orphan.example.com',
        target: { type: 'profile', profileId: 'deleted-profile-id' },
      };

      const profiles = [profileA];
      const target = orphanRule.target;
      const isOrphan =
        target.type === 'profile' &&
        !profiles.some((p) => p.id === target.profileId);

      expect(isOrphan).toBe(true);
    });
  });
});
