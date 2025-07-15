// Configuration pour le build de production
module.exports = {
  // Désactiver la génération de source maps
  generateSourceMap: false,
  
  // Ignorer les avertissements ESLint
  ignoreWarnings: [
    /eslint/,
    /@humanwhocodes/,
    /@babel\/plugin-proposal/,
  ],
  
  // Configuration pour optimiser le build
  optimization: {
    minimize: true,
    splitChunks: {
      chunks: 'all',
    },
  },
}; 
