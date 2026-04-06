/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.family.dashboard',
  productName: 'Family Dashboard',
  directories: {
    output: 'dist'
  },
  files: [
    'out/**/*',
    'package.json'
  ],
  extraResources: [
    {
      from: 'config/',
      to: 'config/',
      filter: ['**/*']
    },
    {
      from: 'assets/fallback-photos/',
      to: 'assets/fallback-photos/',
      filter: ['**/*']
    }
  ],
  win: {
    target: 'nsis',
    icon: 'assets/icon.ico'
  },
  nsis: {
    oneClick: true,
    perMachine: true
  },
  asar: true,
  asarUnpack: [
    '**/*.node'
  ]
}
