import {
  matchesTarget,
  planFaults,
  type FaultRule,
  type PlanContext,
} from './fault-planner.js';

describe('matchesTarget', () => {
  it('matches any path when the target has no path', () => {
    expect(matchesTarget({ tool: 'todos' }, 'todos', '/todos/1')).toBe(true);
  });

  it('does not match a different tool', () => {
    expect(matchesTarget({ tool: 'todos' }, 'email', '/inbox')).toBe(false);
  });

  it('matches an exact path', () => {
    const target = { tool: 'todos', path: '/todos/1' };
    expect(matchesTarget(target, 'todos', '/todos/1')).toBe(true);
  });

  it('does not match a different exact path', () => {
    const target = { tool: 'todos', path: '/todos/1' };
    expect(matchesTarget(target, 'todos', '/todos/2')).toBe(false);
  });

  it('matches a path that starts with a prefix ending in *', () => {
    const target = { tool: 'todos', path: '/todos*' };
    expect(matchesTarget(target, 'todos', '/todos/7')).toBe(true);
  });

  it('does not match a path outside the prefix', () => {
    const target = { tool: 'todos', path: '/todos*' };
    expect(matchesTarget(target, 'todos', '/users/1')).toBe(false);
  });
});

const slowTodos: FaultRule = {
  id: 'slow-todos',
  type: 'latency',
  target: { tool: 'todos' },
  probability: 1,
  config: { delayMs: 2000 },
};

const request: PlanContext = {
  toolSlug: 'todos',
  path: '/todos/1',
  seed: 42,
  sequence: 1,
};

function countHits(rule: FaultRule, seed: number, count: number): number {
  let hits = 0;
  for (let sequence = 1; sequence <= count; sequence++) {
    if (planFaults([rule], { ...request, seed, sequence }).length > 0) {
      hits++;
    }
  }
  return hits;
}

describe('planFaults', () => {
  it('plans a matching rule with probability 1', () => {
    expect(planFaults([slowTodos], request)).toEqual([
      { ruleId: 'slow-todos', type: 'latency', config: { delayMs: 2000 } },
    ]);
  });

  it('never plans a rule with probability 0', () => {
    expect(countHits({ ...slowTodos, probability: 0 }, 42, 100)).toBe(0);
  });

  it('skips a rule for another tool', () => {
    const emailRule = { ...slowTodos, target: { tool: 'email' } };

    expect(planFaults([emailRule], request)).toEqual([]);
  });

  it('gives the same answer for the same seed and request', () => {
    const halfTime = { ...slowTodos, probability: 0.5 };
    const first = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (sequence) => planFaults([halfTime], { ...request, sequence }).length,
    );
    const second = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (sequence) => planFaults([halfTime], { ...request, sequence }).length,
    );

    expect(second).toEqual(first);
  });

  it('hits roughly as often as the probability says', () => {
    const hits = countHits({ ...slowTodos, probability: 0.3 }, 42, 1000);

    expect(hits).toBeGreaterThan(250);
    expect(hits).toBeLessThan(350);
  });

  it('hits different requests with a different seed', () => {
    const halfTime = { ...slowTodos, probability: 0.5 };
    const pattern = (seed: number) =>
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
        .map(
          (sequence) =>
            planFaults([halfTime], { ...request, seed, sequence }).length,
        )
        .join('');

    expect(pattern(7)).not.toBe(pattern(42));
  });
});
