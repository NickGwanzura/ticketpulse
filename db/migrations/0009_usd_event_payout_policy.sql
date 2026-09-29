CREATE OR REPLACE FUNCTION public.enforce_new_payout_policy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW.status = 'paid' THEN
		IF TG_OP = 'INSERT' THEN
			IF NEW.proof_reference IS NULL OR length(btrim(NEW.proof_reference)) < 3 THEN
				RAISE EXCEPTION 'Paid payouts require a provider proof reference';
			END IF;
		ELSIF (OLD.status IS DISTINCT FROM 'paid' OR NEW.proof_reference IS DISTINCT FROM OLD.proof_reference)
			AND (NEW.proof_reference IS NULL OR length(btrim(NEW.proof_reference)) < 3) THEN
			RAISE EXCEPTION 'Paid payouts require a provider proof reference';
		END IF;
	END IF;

	IF TG_OP = 'UPDATE' THEN
		IF NEW.event_id IS NOT DISTINCT FROM OLD.event_id
			AND NEW.currency IS NOT DISTINCT FROM OLD.currency
			AND NEW.method IS NOT DISTINCT FROM OLD.method THEN
			RETURN NEW;
		END IF;
	END IF;

	IF NEW.event_id IS NULL THEN
		RAISE EXCEPTION 'Every new payout must be linked to one event';
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM public.events e
		WHERE e.id = NEW.event_id AND e.organizer_id = NEW.user_id
	) THEN
		RAISE EXCEPTION 'The payout event must belong to its organiser';
	END IF;
	IF NEW.currency IS DISTINCT FROM 'USD' THEN
		RAISE EXCEPTION 'Payouts must be recorded in USD';
	END IF;
	IF NEW.method IS NULL OR NEW.method NOT IN ('ecocash', 'bank_usd') THEN
		RAISE EXCEPTION 'Payouts must use EcoCash or USD bank transfer';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS payouts_enforce_new_policy ON public.payouts;--> statement-breakpoint
CREATE TRIGGER payouts_enforce_new_policy
BEFORE INSERT OR UPDATE ON public.payouts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_new_payout_policy();
