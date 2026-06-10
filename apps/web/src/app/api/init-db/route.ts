import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cabinets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID NOT NULL REFERENCES cabinets(id),
  nom TEXT NOT NULL,
  siret TEXT,
  regime_tva TEXT DEFAULT 'reel',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  exercice TEXT NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS periodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID NOT NULL REFERENCES dossiers(id),
  mois TEXT NOT NULL,
  cloture BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id),
  dossier_id UUID REFERENCES dossiers(id),
  periode_id UUID REFERENCES periodes(id),
  fichier_url TEXT NOT NULL,
  fichier_nom TEXT NOT NULL,
  fichier_type TEXT NOT NULL CHECK (fichier_type IN ('pdf','jpeg','png','webp')),
  source TEXT NOT NULL DEFAULT 'upload',
  type_document TEXT CHECK (type_document IN (
    'FACTURE_FOURNISSEUR','FACTURE_CLIENT','NOTE_DE_FRAIS','RELEVE_BANCAIRE'
  )),
  ocr_texte TEXT,
  ocr_confidence DECIMAL(3,2),
  ocr_pages INTEGER,
  date_piece DATE,
  date_echeance DATE,
  tiers_nom TEXT,
  tiers_siret TEXT,
  numero_piece TEXT,
  description TEXT,
  montant_ht BIGINT,
  montant_tva BIGINT,
  montant_ttc BIGINT,
  taux_tva INTEGER,
  iban TEXT,
  solde_initial BIGINT,
  solde_final BIGINT,
  statut TEXT NOT NULL DEFAULT 'RECU'
    CHECK (statut IN ('RECU','TRAITEMENT','PRET','ANOMALIE')),
  controle_code TEXT,
  controle_message TEXT,
  warnings JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pieces_cabinet_statut ON pieces(cabinet_id, statut);
CREATE INDEX IF NOT EXISTS idx_pieces_dossier ON pieces(dossier_id);
CREATE INDEX IF NOT EXISTS idx_pieces_doublon ON pieces(dossier_id, tiers_nom, numero_piece, montant_ttc, date_piece);
CREATE INDEX IF NOT EXISTS idx_pieces_client ON pieces(client_id);

INSERT INTO cabinets (id, nom) VALUES ('00000000-0000-0000-0000-000000000001', 'Cabinet Test')
  ON CONFLICT DO NOTHING;

INSERT INTO clients (id, cabinet_id, nom, siret, regime_tva) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Boulangerie Dupont', '12345678901234', 'reel')
  ON CONFLICT DO NOTHING;

INSERT INTO dossiers (id, client_id, exercice, date_debut, date_fin) VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '2025', '2025-01-01', '2025-12-31')
  ON CONFLICT DO NOTHING;

INSERT INTO periodes (id, dossier_id, mois) VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '2025-01'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '2025-02'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '2025-03'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '2025-04'),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', '2025-05'),
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', '2025-06')
  ON CONFLICT DO NOTHING;
`;

export async function POST() {
  try {
    await pool.query(SCHEMA);

    const tables = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    const clients = await pool.query("SELECT nom FROM clients");

    return NextResponse.json({
      ok: true,
      tables: tables.rows.map((r: { tablename: string }) => r.tablename),
      clients: clients.rows.map((r: { nom: string }) => r.nom),
    });
  } catch (error) {
    console.error("Init DB error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
