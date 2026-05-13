(async () => {
  try {
    const { runVotingTest } = require('./TestCases/VotingTest');
    console.log('Running VotingTest...');
    await runVotingTest();
    console.log('All tests passed.');
    process.exit(0);
  } catch (e) {
    console.error('Test failed:', e);
    process.exit(1);
  }
})();
