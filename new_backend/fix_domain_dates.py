#!/usr/bin/env python3
"""
Script pour corriger les dates des domaines existants
"""

import os
import sys
from sqlalchemy import text
from datetime import datetime

# Ajouter le chemin du projet
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import engine

def fix_domain_dates():
    """Corriger les dates des domaines existants"""
    print("🔧 Correction des dates des domaines existants...")
    
    try:
        with engine.connect() as conn:
            # Vérifier les domaines avec updated_at NULL
            result = conn.execute(text("""
                SELECT id, domain_name, created_at, updated_at 
                FROM domains 
                WHERE updated_at IS NULL
            """))
            
            domains_to_fix = result.fetchall()
            print(f"📊 Domaines à corriger: {len(domains_to_fix)}")
            
            if domains_to_fix:
                for domain in domains_to_fix:
                    print(f"  - {domain.domain_name} (ID: {domain.id})")
                
                # Corriger les domaines
                conn.execute(text("""
                    UPDATE domains 
                    SET updated_at = created_at 
                    WHERE updated_at IS NULL
                """))
                conn.commit()
                print("✅ Dates corrigées avec succès")
            else:
                print("✅ Aucun domaine à corriger")
            
            # Vérifier le résultat
            result = conn.execute(text("""
                SELECT COUNT(*) as total_domains,
                       COUNT(updated_at) as domains_with_updated_at
                FROM domains
            """))
            
            stats = result.fetchone()
            print(f"📊 Statistiques:")
            print(f"  - Total domaines: {stats.total_domains}")
            print(f"  - Domaines avec updated_at: {stats.domains_with_updated_at}")
            
            return True
            
    except Exception as e:
        print(f"❌ Erreur lors de la correction: {e}")
        return False

def test_domain_retrieval():
    """Tester la récupération des domaines"""
    print("\n🧪 Test de récupération des domaines...")
    
    try:
        with engine.connect() as conn:
            # Récupérer tous les domaines
            result = conn.execute(text("""
                SELECT id, domain_name, created_at, updated_at 
                FROM domains 
                ORDER BY created_at DESC
            """))
            
            domains = result.fetchall()
            print(f"📊 Domaines trouvés: {len(domains)}")
            
            for domain in domains[:5]:  # Afficher les 5 premiers
                print(f"  - {domain.domain_name}: created={domain.created_at}, updated={domain.updated_at}")
            
            return True
            
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
        return False

def main():
    """Fonction principale"""
    print("🚀 Correction des dates des domaines")
    print("=" * 50)
    
    # Corriger les dates
    success = fix_domain_dates()
    
    if success:
        # Tester la récupération
        test_success = test_domain_retrieval()
        
        if test_success:
            print("\n✅ Toutes les corrections sont terminées!")
            print("🎉 Les endpoints de domain authentication devraient maintenant fonctionner")
        else:
            print("\n❌ Il y a eu des problèmes lors des tests")
    else:
        print("\n❌ Impossible de corriger les dates")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 
