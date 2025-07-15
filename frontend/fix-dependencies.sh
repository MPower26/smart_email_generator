#!/bin/bash

echo "🔧 Correction des dépendances et vulnérabilités npm..."

# Nettoyer le cache npm
echo "📦 Nettoyage du cache npm..."
npm cache clean --force

# Supprimer node_modules et package-lock.json
echo "🗑️ Suppression des modules existants..."
rm -rf node_modules package-lock.json

# Installer les dépendances avec audit fix
echo "📥 Installation des dépendances..."
npm install

# Corriger les vulnérabilités automatiquement
echo "🔒 Correction des vulnérabilités..."
npm audit fix

# Si il reste des vulnérabilités, essayer avec --force
echo "🔒 Correction forcée des vulnérabilités restantes..."
npm audit fix --force

# Vérifier le build
echo "🏗️ Test du build..."
npm run build

echo "✅ Correction terminée!"
echo "📋 Résumé des actions :"
echo "  - Cache npm nettoyé"
echo "  - Modules réinstallés"
echo "  - Vulnérabilités corrigées"
echo "  - Build testé" 
