-- FC-322: human-triaged support priority and accountable first-human-response clock.
-- No outbound dispatch, operational pause, payment action or automatic incident creation.
ALTER TABLE public.support_tickets
 ADD COLUMN priority text NOT NULL DEFAULT 'normal'
   CHECK (priority IN ('critical','high','normal','low')),
 ADD COLUMN priority_classified_at timestamptz,
 ADD COLUMN priority_classified_by uuid REFERENCES public.users(id),
 ADD COLUMN first_response_due_at timestamptz,
 ADD COLUMN first_response_at timestamptz,
 ADD CONSTRAINT support_priority_classification_complete_check
 CHECK (
  (priority_classified_at IS NULL AND priority_classified_by IS NULL AND first_response_due_at IS NULL)
  OR
  (priority_classified_at IS NOT NULL AND priority_classified_by IS NOT NULL AND first_response_due_at IS NOT NULL)
 );

CREATE INDEX support_tickets_first_response_attention_idx
 ON public.support_tickets(first_response_due_at,priority,id)
 WHERE first_response_at IS NULL AND status <> 'resolved' AND priority_classified_at IS NOT NULL;

COMMENT ON COLUMN public.support_tickets.priority IS
 'Triage by authorized support operator; default normal remains UNCLASSIFIED until priority_classified_at is set.';
COMMENT ON COLUMN public.support_tickets.first_response_due_at IS
 'First qualified HUMAN response target from original ticket creation time, not a resolution deadline.';
