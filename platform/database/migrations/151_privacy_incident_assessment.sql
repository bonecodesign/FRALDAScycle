ALTER TABLE operational_incidents
  DROP CONSTRAINT operational_incidents_domain_check;
ALTER TABLE operational_incidents
  ADD CONSTRAINT operational_incidents_domain_check
  CHECK (domain IN ('global','marketplace','payments','refunds','payouts','logistics','donations','premium','privacy'));

ALTER TABLE operational_incident_events
  DROP CONSTRAINT operational_incident_events_action_check;
ALTER TABLE operational_incident_events
  ADD CONSTRAINT operational_incident_events_action_check
  CHECK (action IN ('created','claimed','released','contained','monitoring','resolved','reopened','note','risk_assessed','communication_decision'));

COMMENT ON TABLE operational_incident_events IS
  'Internal incident timeline. Privacy metadata must remain classified/minimal and must not copy personal or child profile data.';
