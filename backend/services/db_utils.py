"""Utilitários de acesso ao Supabase."""


class _NoRow:
    data = None


def maybe_one(query):
    """Executa query.maybe_single() sem quebrar quando não há linha.

    No supabase-py 2.x, maybe_single().execute() devolve None em vez de uma
    resposta com data=None quando nada casa. Todo acesso a .data depois disso
    estourava AttributeError — por exemplo em get_plan_status para qualquer
    usuário sem linha em user_plans, abortando o pipeline logo no início.
    """
    resp = query.maybe_single().execute()
    return resp if resp is not None else _NoRow()
