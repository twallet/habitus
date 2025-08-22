// Optional for easier use.
var QUnit = QUnitGS2.QUnit;

function doGet(e) {
  QUnitGS2.init();

  /**
  * Add your test functions here.
  */
  qUnitTests();

  QUnit.start(); // Starts running tests, notice QUnit vs QUnitGS2.
  return QUnitGS2.getHtml();
}

function getResultsFromServer() {
  return QUnitGS2.getResultsFromServer();
}

function qUnitTests() {
  QUnit.module('Utils');

  QUnit.test('isValidFloat', function(assert) {
    assert.ok(Utils.isValidFloat('10'), 'Valid integer');
    assert.ok(Utils.isValidFloat('10,5'), 'Valid float with comma');
    assert.ok(Utils.isValidFloat('-5'), 'Valid negative integer');
    assert.notOk(Utils.isValidFloat('abc'), 'Invalid string');
    assert.notOk(Utils.isValidFloat('10.5'), 'Invalid float with dot');
    assert.notOk(Utils.isValidFloat('1,2,3'), 'Invalid multiple commas');
    assert.notOk(Utils.isValidFloat(''), 'Empty string');
  });

  QUnit.test('truncateString', function(assert) {
    assert.equal(Utils.truncateString('hello world', 11), 'hello world', 'String is not truncated');
    assert.equal(Utils.truncateString('hello world', 5), 'hello', 'String is truncated');
    assert.equal(Utils.truncateString('hello', 10), 'hello', 'String is shorter than max');
  });

  QUnit.test('formatDate', function(assert) {
    assert.equal(Utils.formatDate(new Date(2024, 0, 25)), '25/1/2024', 'Valid date');
    assert.equal(Utils.formatDate(null), '', 'Null date');
  });

  QUnit.test('validateHour', function(assert) {
    assert.equal(Utils.validateHour('14:30'), '14:30', 'Valid hour');
    assert.equal(Utils.validateHour('8:5'), '08:05', 'Valid hour with single digits');
    assert.equal(Utils.validateHour('25:00'), -1, 'Invalid hour');
    assert.equal(Utils.validateHour('12:60'), -1, 'Invalid minute');
    assert.equal(Utils.validateHour('abc'), -1, 'Invalid string');
  });

  QUnit.test('sort', function(assert) {
    const order = ['c', 'a', 'b'];
    const toSort = ['a', 'b', 'c', 'd'];
    const expected = ['c', 'a', 'b', 'd'];
    assert.deepEqual(Utils.sort(order, toSort), expected, 'Sorts array based on order');
  });

  QUnit.test('htmlTagsBalanceCheck', function(assert) {
    assert.expect(3); // Expecting 3 assertions
    assert.ok((() => { try { Utils.htmlTagsBalanceCheck('<b>hello</b><i>world</i>'); return true; } catch (e) { return false; } })(), 'Balanced tags');
    assert.throws(function() { Utils.htmlTagsBalanceCheck('<b>hello'); }, /Bold HTML tags unbalanced/, 'Unbalanced bold tag');
    assert.throws(function() { Utils.htmlTagsBalanceCheck('<i>hello'); }, /Italic HTML tags unbalanced/, 'Unbalanced italic tag');
  });
}
