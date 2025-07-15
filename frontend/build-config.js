// Configuration pour optimiser le build et éviter les erreurs
module.exports = {
  // Ignorer les avertissements Babel
  ignoreWarnings: [
    /Failed to parse source map/,
    /@babel\/plugin-proposal-class-properties/,
    /@babel\/plugin-proposal-numeric-separator/,
  ],
  
  // Configuration pour le build de production
  webpack: {
    configure: (webpackConfig) => {
      // Ignorer les avertissements de source map
      webpackConfig.ignoreWarnings = [
        /Failed to parse source map/,
        /@babel\/plugin-proposal-class-properties/,
        /@babel\/plugin-proposal-numeric-separator/,
      ];
      
      return webpackConfig;
    },
  },
}; 
