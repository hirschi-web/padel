-- Isolated score store for the twelve-player Gold/Silver format.
CREATE TABLE public.padel_liga_events (
    id text PRIMARY KEY,
    key_hash text NOT NULL,
    config jsonb NOT NULL,
    state jsonb NOT NULL DEFAULT '{"scores":{}, "rev":0}'::jsonb
);
ALTER TABLE public.padel_liga_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.padel_liga_events FROM PUBLIC, anonymous, authenticated;

CREATE FUNCTION public.padel_liga_read(event_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT config || jsonb_build_object('state',state)
  FROM public.padel_liga_events WHERE id = event_id;
$$;

CREATE FUNCTION public.padel_liga_write(event_id text, edit_key text, slot integer,
                                         points jsonb, previous jsonb, seen_rev integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
    snapshot jsonb;
    current_value jsonb;
    qualifying_count integer;
BEGIN
    SELECT state INTO snapshot FROM public.padel_liga_events
    WHERE id = event_id AND key_hash = encode(public.digest(edit_key, 'sha256'), 'hex')
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bearbeiten-Link ungültig.'; END IF;
    IF slot IS NULL OR slot NOT BETWEEN -1 AND 17 THEN RAISE EXCEPTION 'Ungültiges Match.'; END IF;
    IF slot = -1 THEN
        IF snapshot ? 'qualification' THEN RETURN snapshot; END IF;
        IF seen_rev IS DISTINCT FROM (snapshot->>'rev')::integer THEN
            RAISE EXCEPTION 'Neue Ergebnisse vorhanden. Bitte Stand aktualisieren.';
        END IF;
    ELSE
        IF slot >= 12 AND NOT snapshot ? 'qualification' THEN
            RAISE EXCEPTION 'Liga noch nicht gestartet.';
        END IF;
        IF jsonb_typeof(points) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Zwei Ergebnisse erforderlich.'; END IF;
        IF jsonb_array_length(points) <> 2 OR NOT (points->0)::text ~ '^[0-9]{1,2}$'
           OR NOT (points->1)::text ~ '^[0-9]{1,2}$' THEN RAISE EXCEPTION 'Punkte müssen zwischen 0 und 99 liegen.'; END IF;
        current_value := snapshot->'scores'->(slot::text);
        IF current_value = points THEN RETURN snapshot; END IF;
        IF current_value IS DISTINCT FROM nullif(previous,'null'::jsonb) THEN
            RAISE EXCEPTION 'Dieses Ergebnis wurde inzwischen geändert. Bitte Stand aktualisieren.';
        END IF;
        snapshot := jsonb_set(snapshot, ARRAY['scores',slot::text], points);
    END IF;
    IF NOT snapshot ? 'qualification' THEN
        SELECT count(*) INTO qualifying_count FROM jsonb_object_keys(snapshot->'scores') k WHERE k::int < 12;
        IF qualifying_count=12 OR slot=-1 THEN
            snapshot := snapshot || jsonb_build_object('qualification',snapshot->'scores');
        END IF;
    END IF;
    snapshot := jsonb_set(snapshot,'{rev}',to_jsonb((snapshot->>'rev')::integer + 1));
    UPDATE public.padel_liga_events SET state=snapshot WHERE id=event_id;
    RETURN snapshot;
END;
$$;
REVOKE ALL ON FUNCTION public.padel_liga_read(text),public.padel_liga_write(text,text,integer,jsonb,jsonb,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.padel_liga_read(text),public.padel_liga_write(text,text,integer,jsonb,jsonb,integer) TO anonymous, authenticated;
