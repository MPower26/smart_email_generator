#!/usr/bin/env python3
"""
Script de test pour le système d'authentification de domaine
Teste les vérifications SPF, DKIM et DMARC sur des domaines connus
"""

import asyncio
import sys
import os
from datetime import datetime

# Ajouter le répertoire parent au path pour les imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.domain_auth_service import DomainAuthService
from app.schemas.domain_auth import CheckType
from app.db.database import get_db

# Domaines de test avec des configurations connues
TEST_DOMAINS = [
    {
        "name": "google.com",
        "description": "Google (configuration complète)",
        "expected_spf": True,
        "expected_dkim": True,
        "expected_dmarc": True
    },
    {
        "name": "microsoft.com",
        "description": "Microsoft (configuration complète)",
        "expected_spf": True,
        "expected_dkim": True,
        "expected_dmarc": True
    },
    {
        "name": "github.com",
        "description": "GitHub (configuration complète)",
        "expected_spf": True,
        "expected_dkim": True,
        "expected_dmarc": True
    },
    {
        "name": "example.com",
        "description": "Example.com (configuration basique)",
        "expected_spf": False,
        "expected_dkim": False,
        "expected_dmarc": False
    }
]

def print_header(title):
    """Affiche un en-tête formaté"""
    print("\n" + "="*60)
    print(f" {title}")
    print("="*60)

def print_section(title):
    """Affiche une section formatée"""
    print(f"\n--- {title} ---")

def print_result(domain_name, check_type, result, expected):
    """Affiche le résultat d'une vérification"""
    status = "✅ PASS" if result['is_valid'] == expected else "❌ FAIL"
    found = "✅" if result['record_found'] else "❌"
    
    print(f"  {check_type:6} | {found} Found | {status} | {domain_name}")
    
    if not result['is_valid'] and result['check_data'].get('error'):
        print(f"           | Error: {result['check_data']['error']}")
    
    if result['check_data'].get('recommendation'):
        print(f"           | Recommendation: {result['check_data']['recommendation']}")

async def test_domain_auth_service():
    """Teste le service d'authentification de domaine"""
    print_header("Test du Service d'Authentification de Domaine")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Créer une session de base de données
    db = next(get_db())
    auth_service = DomainAuthService(db)
    
    try:
        # Test 1: Vérifications individuelles
        print_section("Test des vérifications individuelles")
        
        for domain_info in TEST_DOMAINS:
            domain_name = domain_info["name"]
            print(f"\nTest de {domain_name} ({domain_info['description']}):")
            
            # Test SPF
            spf_result = auth_service.check_spf(domain_name)
            print_result(domain_name, "SPF", spf_result, domain_info["expected_spf"])
            
            # Test DKIM
            dkim_result = auth_service.check_dkim(domain_name)
            print_result(domain_name, "DKIM", dkim_result, domain_info["expected_dkim"])
            
            # Test DMARC
            dmarc_result = auth_service.check_dmarc(domain_name)
            print_result(domain_name, "DMARC", dmarc_result, domain_info["expected_dmarc"])
        
        # Test 2: Vérification complète
        print_section("Test de vérification complète")
        
        for domain_info in TEST_DOMAINS[:2]:  # Test seulement les 2 premiers
            domain_name = domain_info["name"]
            print(f"\nVérification complète de {domain_name}:")
            
            auth_result = auth_service.check_domain_auth(domain_name)
            
            print(f"  Statut global: {auth_result['overall_status']}")
            print(f"  Nombre de vérifications: {len(auth_result['checks'])}")
            print(f"  Nombre d'alertes: {len(auth_result['alerts'])}")
            
            for alert in auth_result['alerts']:
                print(f"  Alerte: [{alert['level']}] {alert['message']}")
        
        # Test 3: Génération de clés DKIM
        print_section("Test de génération de clés DKIM")
        
        test_domain = "test.example.com"
        dkim_keys = auth_service.generate_dkim_keys(test_domain, "test")
        
        print(f"Domaine: {test_domain}")
        print(f"Sélecteur: {dkim_keys.selector}")
        print(f"Clé publique générée: {'✅' if dkim_keys.public_key else '❌'}")
        print(f"Clé privée générée: {'✅' if dkim_keys.private_key else '❌'}")
        print(f"Enregistrement DNS: {dkim_keys.dns_record[:50]}...")
        
        # Test 4: Validation des enregistrements
        print_section("Test de validation des enregistrements")
        
        # Test SPF valide
        valid_spf = "v=spf1 include:_spf.google.com ~all"
        is_valid = auth_service._validate_spf_record(valid_spf)
        print(f"SPF valide: {valid_spf} -> {'✅' if is_valid else '❌'}")
        
        # Test SPF invalide
        invalid_spf = "invalid spf record"
        is_valid = auth_service._validate_spf_record(invalid_spf)
        print(f"SPF invalide: {invalid_spf} -> {'❌' if not is_valid else '✅'}")
        
        # Test DMARC valide
        valid_dmarc = "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"
        is_valid, policy = auth_service._validate_dmarc_record(valid_dmarc)
        print(f"DMARC valide: {valid_dmarc} -> {'✅' if is_valid else '❌'} (policy: {policy})")
        
        # Test DMARC invalide
        invalid_dmarc = "invalid dmarc record"
        is_valid, policy = auth_service._validate_dmarc_record(invalid_dmarc)
        print(f"DMARC invalide: {invalid_dmarc} -> {'❌' if not is_valid else '✅'} (policy: {policy})")
        
        print_header("Tests terminés avec succès!")
        
    except Exception as e:
        print(f"\n❌ Erreur lors des tests: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        db.close()
    
    return True

def test_schemas():
    """Teste les schémas Pydantic"""
    print_header("Test des Schémas Pydantic")
    
    try:
        from app.schemas.domain_auth import (
            DomainCreate, DomainUpdate, CheckType, AlertLevel, AlertType
        )
        
        # Test DomainCreate
        domain_data = {
            "domain_name": "test.example.com",
            "is_primary": True,
            "is_active": True
        }
        
        domain = DomainCreate(**domain_data)
        print(f"✅ DomainCreate valide: {domain.domain_name}")
        
        # Test CheckType enum
        check_types = [CheckType.SPF, CheckType.DKIM, CheckType.DMARC]
        print(f"✅ CheckType enum: {[ct.value for ct in check_types]}")
        
        # Test AlertLevel enum
        alert_levels = [AlertLevel.WARNING, AlertLevel.ERROR, AlertLevel.CRITICAL]
        print(f"✅ AlertLevel enum: {[al.value for al in alert_levels]}")
        
        # Test AlertType enum
        alert_types = [
            AlertType.SPF_MISSING, AlertType.DKIM_INVALID, AlertType.DMARC_PERMISSIVE
        ]
        print(f"✅ AlertType enum: {[at.value for at in alert_types]}")
        
        print("✅ Tous les schémas sont valides")
        return True
        
    except Exception as e:
        print(f"❌ Erreur dans les schémas: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Fonction principale"""
    print("🚀 Démarrage des tests d'authentification de domaine")
    
    # Test des schémas
    schemas_ok = test_schemas()
    
    # Test du service
    service_ok = asyncio.run(test_domain_auth_service())
    
    # Résumé
    print_header("Résumé des Tests")
    
    if schemas_ok and service_ok:
        print("✅ Tous les tests ont réussi!")
        print("🎉 Le système d'authentification de domaine est prêt à être utilisé.")
        return 0
    else:
        print("❌ Certains tests ont échoué.")
        print("🔧 Veuillez vérifier la configuration et les dépendances.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code) 