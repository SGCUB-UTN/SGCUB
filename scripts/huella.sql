WITH tablas AS (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'django\_q\_%'
      AND tablename NOT LIKE 'token\_blacklist\_%'
      AND tablename <> 'django_session'
),
huellas AS (
    SELECT tablename, query_to_xml(
        format('SELECT count(*) AS filas, md5(coalesce(string_agg(t::text, %L ORDER BY t::text), %L)) AS huella FROM public.%I t', '|', '', tablename),
        false, true, ''
    ) AS resultado
    FROM tablas
)
SELECT tablename
    || ' ' || (xpath('/row/filas/text()', resultado))[1]::text
    || ' ' || (xpath('/row/huella/text()', resultado))[1]::text
FROM huellas
ORDER BY tablename;
