const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('FAD Vehicle Dispatch groups For Dispatch and Return to Seller Approval', () => {
  const P = load(), a = P.byId['FAD/for-dispatch'], b = P.byId['FAD/return-approval'];
  assert.strictEqual(a.group, 'Vehicle Dispatch'); assert.strictEqual(b.group, 'Vehicle Dispatch');
  assert.ok(a.isNew && b.isNew);
  const g = P.groupOf(a).map(s => s.id); assert.deepStrictEqual(g, ['FAD/for-dispatch', 'FAD/return-approval']);
  const side = P.sideHtml('FAD/for-dispatch');
  assert.strictEqual((side.match(/Vehicle Dispatch/g) || []).length >= 1, true);
  assert.ok(!/>For Dispatch</.test(side.split('SMD')[0]), 'FAD menu shows the group, not the tab names');
  assert.match(P.pageHead(b), /Vehicle Dispatch/);
});
