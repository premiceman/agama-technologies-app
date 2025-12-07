const fs = require('fs');
const path = require('path');
const assert = require('assert');

class Suite {
  constructor(name = '', parent = null) {
    this.name = name;
    this.parent = parent;
    this.suites = [];
    this.tests = [];
    this.beforeAll = [];
    this.afterAll = [];
    this.beforeEach = [];
    this.afterEach = [];
  }
}

const rootSuite = new Suite();
const TEST_PATTERN = (process.env.TEST_PATTERN || '').trim();
let currentSuite = rootSuite;

function wrapHookRegistration(targetArray, fn) {
  targetArray.push(fn);
}

function describe(name, fn) {
  const suite = new Suite(name, currentSuite);
  currentSuite.suites.push(suite);
  const previous = currentSuite;
  currentSuite = suite;
  fn();
  currentSuite = previous;
}

describe.skip = () => {};

describe.only = (name, fn) => {
  throw new Error('describe.only is not supported in this environment.');
};

function test(name, fn) {
  currentSuite.tests.push({ name, fn });
}

test.only = (name, fn) => {
  throw new Error('test.only is not supported in this environment.');
};

test.skip = () => {};

function beforeAll(fn) {
  wrapHookRegistration(currentSuite.beforeAll, fn);
}

function afterAll(fn) {
  wrapHookRegistration(currentSuite.afterAll, fn);
}

function beforeEach(fn) {
  wrapHookRegistration(currentSuite.beforeEach, fn);
}

function afterEach(fn) {
  wrapHookRegistration(currentSuite.afterEach, fn);
}

function isPromise(value) {
  return value && typeof value.then === 'function';
}

function expectation(received) {
  const matchers = {
    toBe(expected) {
      assert.strictEqual(received, expected);
    },
    toEqual(expected) {
      assert.deepStrictEqual(received, expected);
    },
    toMatchObject(expected) {
      function match(obj, subset) {
        if (Array.isArray(subset)) {
          assert(Array.isArray(obj));
          subset.forEach((item, idx) => match(obj[idx], item));
          return;
        }
        if (subset && typeof subset === 'object') {
          Object.entries(subset).forEach(([key, value]) => {
            match(obj ? obj[key] : undefined, value);
          });
          return;
        }
        assert.strictEqual(obj, subset);
      }
      match(received, expected);
    },
    toBeDefined() {
      assert.notStrictEqual(received, undefined);
    },
    toBeTruthy() {
      assert.ok(received);
    },
    toBeCloseTo(expected, precision = 2) {
      const diff = Math.abs(Number(received) - Number(expected));
      assert.ok(diff < Math.pow(10, -precision));
    },
    toBeGreaterThan(expected) {
      assert.ok(received > expected);
    },
    toBeLessThan(expected) {
      assert.ok(received < expected);
    },
    toHaveLength(expected) {
      assert.ok(received && typeof received.length === 'number');
      assert.strictEqual(received.length, expected);
    },
    toThrow(expectedError) {
      assert.throws(received, expectedError);
    }
  };

  Object.defineProperty(matchers, 'not', {
    enumerable: false,
    value: {
      toThrow(expectedError) {
        assert.doesNotThrow(received, expectedError);
      }
    }
  });

  return matchers;
}

function expect(value) {
  return expectation(value);
}

global.describe = describe;
global.test = test;
global.beforeAll = beforeAll;
global.afterAll = afterAll;
global.beforeEach = beforeEach;
global.afterEach = afterEach;
global.expect = expect;

function collectTests(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTests(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      if (!TEST_PATTERN || entry.name.includes(TEST_PATTERN)) {
        require(fullPath);
      }
    }
  });
}

function gatherSuites(suite) {
  const suites = [];
  function traverse(current, ancestors) {
    suites.push({ suite: current, ancestors });
    current.suites.forEach(child => traverse(child, [...ancestors, current]));
  }
  traverse(suite, []);
  return suites;
}

async function runHookSequence(hooks) {
  for (const hook of hooks) {
    const result = hook();
    if (isPromise(result)) await result;
  }
}

function collectHooksFor(suiteChain, hookName) {
  const hooks = [];
  suiteChain.forEach(suite => {
    hooks.push(...suite[hookName]);
  });
  return hooks;
}

async function runSuite(suite, ancestors = []) {
  const namePath = ancestors.filter(Boolean).concat(suite.name || []).filter(Boolean).join(' › ');
  const chain = [...ancestors, suite];

  await runHookSequence(collectHooksFor(chain, 'beforeAll'));

  for (const child of suite.suites) {
    await runSuite(child, chain);
  }

  for (const testCase of suite.tests) {
    const fullName = [namePath, testCase.name].filter(Boolean).join(' › ');
    try {
      await runHookSequence(collectHooksFor(chain, 'beforeEach'));
      const result = testCase.fn();
      if (isPromise(result)) await result;
      await runHookSequence(collectHooksFor([...chain].reverse(), 'afterEach'));
      console.log(`✓ ${fullName}`);
    } catch (err) {
      console.error(`✗ ${fullName}`);
      console.error(err);
      process.exitCode = 1;
      await runHookSequence(collectHooksFor([...chain].reverse(), 'afterEach'));
    }
  }

  await runHookSequence(collectHooksFor(chain.reverse(), 'afterAll'));
}

(async () => {
  const testsDir = path.join(__dirname);
  collectTests(testsDir);
  await runSuite(rootSuite);
  if (process.exitCode) {
    process.exit(process.exitCode);
  } else {
    console.log('All tests passed');
  }
})();
