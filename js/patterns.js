// Pattern detectors. Each takes (a, b) and is order-independent.
const tens = (n) => Math.floor(n / 10);
const units = (n) => n % 10;

export const PATTERNS = [
  { id: 'square', label: 'Squares', example: '37×37', test: (a, b) => a === b },
  { id: 'equidistant', label: 'Equally far from a multiple of 10', example: '47×53', test: (a, b) => a !== b && (a + b) % 20 === 0 },
  { id: 'same-tens-units-10', label: 'Same tens, units add to 10', example: '43×47', test: (a, b) => tens(a) === tens(b) && units(a) + units(b) === 10 },
  { id: 'times-11', label: '×11', example: '11×64', test: (a, b) => a === 11 || b === 11 },
  { id: 'one-single-digit', label: 'One single-digit number', example: '7×64', test: (a, b) => (a < 10) !== (b < 10) },
];

export function patternsOf(a, b) {
  return PATTERNS.filter((p) => p.test(a, b)).map((p) => p.id);
}
