// Question generation: numbers 1–99 excluding multiples of 10.
export const ALLOWED = Array.from({ length: 99 }, (_, i) => i + 1).filter((n) => n % 10 !== 0);

export const isAllowed = (n) => Number.isInteger(n) && n >= 1 && n <= 99 && n % 10 !== 0;

// a×b and b×a are the same question.
export const pairKey = (a, b) => (a <= b ? `${a}x${b}` : `${b}x${a}`);

export function randomNumber(rng = Math.random) {
  return ALLOWED[Math.floor(rng() * ALLOWED.length)];
}

export function randomPair(rng = Math.random) {
  return { a: randomNumber(rng), b: randomNumber(rng) };
}

/**
 * Creates a generator. `weakSource` (optional) returns a pair from the weak-spot pool
 * or null; when given, about half of the questions come from it.
 */
export function createGenerator({ rng = Math.random, weakSource = null, weakShare = 0.5 } = {}) {
  let lastKey = null;
  return {
    next() {
      for (let tries = 0; tries < 50; tries++) {
        let pair = null;
        if (weakSource && rng() < weakShare) pair = weakSource(rng);
        if (!pair || !isAllowed(pair.a) || !isAllowed(pair.b)) pair = randomPair(rng);
        const key = pairKey(pair.a, pair.b);
        if (key !== lastKey) { lastKey = key; return { ...pair, weak: !!pair.weak }; }
      }
      // Practically unreachable; force a different pair deterministically.
      let pair = randomPair(rng);
      while (pairKey(pair.a, pair.b) === lastKey) pair = { a: pair.a, b: ALLOWED[(ALLOWED.indexOf(pair.b) + 1) % ALLOWED.length] };
      lastKey = pairKey(pair.a, pair.b);
      return pair;
    },
    reset() { lastKey = null; },
  };
}
