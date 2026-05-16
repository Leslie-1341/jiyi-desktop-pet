module.exports = {
  packagerConfig: {
    name: 'Desktop Pet',
    executableName: 'Desktop Pet',
    appBundleId: 'com.desktoppet.app',
    icon: 'src/main/assets/appIcon',
    asar: true,
    extraResource: ['src/main/assets/petTrayTemplate.png'],
    ignore: [
      /^\/node_modules($|\/)/,
      /^\/debug($|\/)/,
      /^\/design_refs($|\/)/,
      /^\/scripts($|\/)/,
      /^\/src($|\/)/,
      /^\/index\.html$/,
      /^\/vite\.config\.ts$/,
      /^\/tsconfig.*\.json$/,
      /^\/README\.md$/
    ]
  },
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    }
  ]
};
