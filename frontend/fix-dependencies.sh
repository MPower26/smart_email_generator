#!/bin/bash

echo "🧹 Nettoyage des dépendances..."

# Supprimer node_modules et package-lock.json
rm -rf node_modules
rm -f package-lock.json

# Installer les nouvelles dépendances Babel
npm install --save-dev @babel/plugin-transform-private-methods@^7.23.3
npm install --save-dev @babel/plugin-transform-optional-chaining@^7.23.4
npm install --save-dev @babel/plugin-transform-nullish-coalescing-operator@^7.23.4
npm install --save-dev @babel/plugin-transform-numeric-separator@^7.23.4
npm install --save-dev @babel/plugin-transform-class-properties@^7.23.3
npm install --save-dev @babel/plugin-transform-private-property-in-object@^7.23.4

# Installer toutes les dépendances
npm install

# Corriger les vulnérabilités automatiquement
npm audit fix

echo "✅ Dépendances nettoyées et mises à jour !"
echo "🚀 Vous pouvez maintenant faire: npm run build" 
