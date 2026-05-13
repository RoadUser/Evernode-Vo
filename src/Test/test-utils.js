module.exports = {
  assertEqual: function(a, b, msg) { if (a !== b) throw new Error(msg || (`Assertion failed ${a} !== ${b}`)); },
  assertTrue: function(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed: expected true'); },
  assertFalse: function(cond, msg) { if (cond) throw new Error(msg || 'Assertion failed: expected false'); },
  assertSuccessResponse: function(res) { if (!res || !res.success) throw new Error('Expected success response'); },
  assertErrorResponse: function(res) { if (!res || !res.error) throw new Error('Expected error response'); }
};
