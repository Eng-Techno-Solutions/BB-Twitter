var fs = require('fs');
var path = require('path');

var pkgPath = path.join(__dirname, '..', 'node_modules', 'react-native-svg', 'package.json');
if (fs.existsSync(pkgPath)) {
  var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg['react-native'] !== pkg.main) {
    pkg['react-native'] = pkg.main;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('Patched react-native-svg: react-native field -> ' + pkg.main);
  }
}
