// Test mode: add ?dev=1 to the address. It uses a separate IndexedDB database and
// separate localStorage keys, so testing never touches real data.
const search = typeof location !== 'undefined' ? location.search : '';
export const DEV = /[?&]dev=1\b/.test(search);
export const DB_NAME = DEV ? 'multiplication-trainer-test' : 'multiplication-trainer';
export const lsKey = (k) => (DEV ? 'mt-test.' : 'mt.') + k;
