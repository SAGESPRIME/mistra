#!/bin/bash
# Initialisation de la base de données Mistra
# Usage : ./scripts/init-db.sh

set -e

echo "=== Mistra — Initialisation base de données ==="

# Attendre que PostgreSQL soit prêt
echo "Attente de PostgreSQL..."
until docker compose exec db pg_isready -U mistra > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL est prêt."

# Exécuter le schéma
echo "Création du schéma..."
docker compose exec -T db psql -U mistra -d mistra < scripts/schema.sql

echo "=== Base de données initialisée ==="
echo ""
echo "Données de test créées :"
echo "  Cabinet : Cabinet Test"
echo "  Client  : Boulangerie Dupont"
echo "  Dossier : Exercice 2025"
echo "  Périodes: Janvier à Juin 2025"
