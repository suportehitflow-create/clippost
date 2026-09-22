"""Utilitários de acesso ao Supabase."""


class _NoRow:
    data = None


def maybe_one(query):
    """Executa query.maybe_single() sem quebrar quando não há linha.

    Algumas versões do postgrest-py lançam APIError com code '204' quando
    nenhuma linha é encontrada, em vez de retornar None. Capturamos ambos.
    """
    try:
        resp = query.maybe_single().execute()
        return resp if resp is not None else _NoRow()
    except Exception as e:
        code = getattr(e, 'code', None) or ''
        if str(code) == '204' or "'204'" in str(e) or '"204"' in str(e):
            return _NoRow()
        raise
