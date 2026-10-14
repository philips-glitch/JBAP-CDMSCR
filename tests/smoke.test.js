const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('every screen returns rows with unique ids', () => {
  const P = load();
  for (const [id, scr] of Object.entries(P.byId)) {
    const rows = scr.rows();
    assert.ok(Array.isArray(rows), id);
    assert.strictEqual(new Set(rows.map(r => r.id)).size, rows.length, `${id} has duplicate ids`);
  }
});
