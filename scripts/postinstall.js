var fs = require('fs');
var path = require('path');

// RN 0.53 has a test fixture with "name": "react-native-vector-icons"
// that hijacks Haste module resolution. Rename it to prevent conflicts.
var fixturePkg = path.join(
  __dirname, '..', 'node_modules', 'react-native',
  'local-cli', 'core', '__fixtures__', 'files', 'package.json'
);
if (fs.existsSync(fixturePkg)) {
  fs.renameSync(fixturePkg, fixturePkg + '.bak');
  console.log('Renamed RN fixture package.json to prevent Haste conflict');
}
