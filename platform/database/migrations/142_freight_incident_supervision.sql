-- Link to the existing internal incident console, without creating a customer support ticket.
CREATE TABLE freight_incident_supervision (
  freight_settlement_plan_id uuid PRIMARY KEY REFERENCES freight_settlement_plans(id),
  operational_incident_id uuid NOT NULL UNIQUE REFERENCES operational_incidents(id),
  linked_by uuid NOT NULL REFERENCES users(id),
  linked_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE freight_incident_supervision IS
  'Explicit link to existing supervised incident workflow. No financial execution authority.';
