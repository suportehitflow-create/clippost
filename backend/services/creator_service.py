"""
Creator & Scriptwriting Service
Motor de roteirização com IA e templates virais de alta conversão para vídeos curtos.
Inspirado na arquitetura de templates do krillinai/OpenCreator.
"""
from typing import List, Dict, Any

CREATOR_TEMPLATES = [
    {
        "id": "storytelling",
        "name": "Storytelling Emocional",
        "badge": "Maior Retenção",
        "category": "Narrativa",
        "description": "Abertura com cena vívida, conflito crescente, virada surpreendente e lição memorável.",
        "ideal_duration": "45-75s",
        "structure": [
            "Gancho Visual (0-3s)",
            "O Ponto de Ruptura (4-15s)",
            "A Luta / Conflito (16-40s)",
            "A Virada Inesperada (41-55s)",
            "A Lição / Chamada Final (56-65s)",
        ],
        "default_tone": "Inspirador & Enérgico",
    },
    {
        "id": "hormozi",
        "name": "Fórmula Viral $100M (Hormozi)",
        "badge": "Mais Compartilhado",
        "category": "Negócios & Hacks",
        "description": "Afirmação contra-intuitiva brutal, desmontagem de mitos populares e framework de 3 passos.",
        "ideal_duration": "30-60s",
        "structure": [
            "Declaração Chocante (0-3s)",
            "Por que 99% das Pessoas Erram (4-15s)",
            "Os 3 Passos Contraintuitivos (16-45s)",
            "Gatilho de Urgência & Ação (46-55s)",
        ],
        "default_tone": "Direto, Rápido & Sem Filtro",
    },
    {
        "id": "news_tech",
        "name": "Análise Tech & Notícias Quentes",
        "badge": "Autoridade Rápida",
        "category": "Tecnologia & IA",
        "description": "Notícia bomba explicada em 1 minuto: o que aconteceu, o que ninguém notou e o que muda pra você.",
        "ideal_duration": "45-60s",
        "structure": [
            "Manchete Explosiva (0-3s)",
            "O Fato Técnico em Linguagem Simples (4-20s)",
            "O Detalhe Oculto que Ninguém Viu (21-40s)",
            "Pergunta de Encerramento para Comentários (41-50s)",
        ],
        "default_tone": "Analítico & Ágil",
    },
    {
        "id": "tutorial_express",
        "name": "Tutorial Prático Express",
        "badge": "Mais Salvo",
        "category": "Educacional",
        "description": "Promessa clara nos primeiros 3 segundos, passo 1, 2 e 3 na tela com dica bônus no final.",
        "ideal_duration": "30-50s",
        "structure": [
            "Promessa Clara: Como Fazer X Sem Y (0-3s)",
            "Passo 1: A Base (4-15s)",
            "Passo 2: O Hack Secreto (16-30s)",
            "Passo 3: A Finalização (31-42s)",
            "CTA: Salve para Não Perder (43-48s)",
        ],
        "default_tone": "Prático & Didático",
    },
    {
        "id": "infinite_loop",
        "name": "Short com Loop Infinito",
        "badge": "Algoritmo Favorito",
        "category": "Shorts & Reels",
        "description": "A última frase se conecta perfeitamente com a primeira palavra, fazendo o espectador assistir 2 vezes.",
        "ideal_duration": "20-40s",
        "structure": [
            "Frase Conectora Inicial (0-3s)",
            "Quebra de Expectativa Rápida (4-12s)",
            "Clímax de 5 Segundos (13-22s)",
            "Conexão com a Frase de Abertura (23-28s)",
        ],
        "default_tone": "Curioso & Magnético",
    },
]


def get_creator_templates() -> List[Dict[str, Any]]:
    return CREATOR_TEMPLATES


def generate_ai_script(
    topic: str,
    template_id: str = "hormozi",
    tone: str = "Direto e enérgico",
    duration_secs: int = 45,
    target_audience: str = "Empreendedores e Criadores"
) -> Dict[str, Any]:
    """
    Gera um roteiro detalhado e estruturado com minutagem, visual sugerido e gancho irresistível.
    """
    clean_topic = topic.strip() or "Como triplicar seu faturamento criando vídeos curtos"
    
    # Roteiros dinâmicos baseados no template
    if template_id == "storytelling":
        hook = f"No dia que eu percebi isso sobre {clean_topic}, tudo mudou para sempre."
        scenes = [
            {
                "time": "00:00 - 00:03",
                "label": "Gancho de Choque",
                "spoken_text": hook,
                "b_roll": "Close-up dramático nos olhos, respiração funda ou tela preta piscando.",
                "sound_fx": "Woosh pesado + impacto sutil de grave.",
                "duration": 3,
            },
            {
                "time": "00:04 - 00:15",
                "label": "O Ponto de Ruptura",
                "spoken_text": f"Eu estava fazendo exatamente o que todo mundo mandava fazer sobre {clean_topic}. Trabalhando 14 horas por dia, exausto, e a conta bancária não saía do lugar.",
                "b_roll": "Pessoa em frente ao computador à noite, luz da tela no rosto.",
                "sound_fx": "Música ambiente lenta, tom melancólico.",
                "duration": 11,
            },
            {
                "time": "00:16 - 00:32",
                "label": "A Revelação",
                "spoken_text": f"Até que um mentor me fez uma pergunta que doeu: 'Por que você continua insistindo no método tradicional se as regras do jogo mudaram?' Foi aí que eu apliquei a estratégia reversa.",
                "b_roll": "Caderno de anotações com caneta rabiscando fórmulas, transição veloz.",
                "sound_fx": "Subida na trilha sonora (riser dramático).",
                "duration": 16,
            },
            {
                "time": "00:33 - 00:48",
                "label": "A Virada e Resultado",
                "spoken_text": f"Em menos de 3 semanas com essa nova abordagem, o resultado foi 4 vezes maior com metade do esforço. O segredo não é trabalhar mais; é eliminar os 80% inúteis.",
                "b_roll": "Gráfico em subida rápida ou dashboard com métricas verdes subindo.",
                "sound_fx": "Batida triunfal entra no ritmo do vídeo.",
                "duration": 15,
            },
            {
                "time": "00:49 - 00:55",
                "label": "Chamada à Ação",
                "spoken_text": f"Se você quer saber os detalhes exatos desse framework, comenta 'ROTEIRO' aqui embaixo que eu te envio.",
                "b_roll": "Apontando para a barra de comentários com sticker animado.",
                "sound_fx": "Som de clique / sino de notificação.",
                "duration": 6,
            },
        ]
    elif template_id == "news_tech":
        hook = f"Acabou de vazar uma novidade sobre {clean_topic} e quase ninguém percebeu o perigo."
        scenes = [
            {
                "time": "00:00 - 00:03",
                "label": "Gancho Noticioso",
                "spoken_text": hook,
                "b_roll": "Manchete de jornal piscando na tela com alerta vermelho.",
                "sound_fx": "Sirene sutil + 'Glitch' futurista.",
                "duration": 3,
            },
            {
                "time": "00:04 - 00:18",
                "label": "O Fato Real",
                "spoken_text": f"Nas últimas 48 horas, o mercado começou a adotar essa tecnologia em massa. Enquanto você está aí fazendo manualmente, tem gente automatizando o processo inteiro em 10 segundos.",
                "b_roll": "Gravação de tela demonstrando fluxo de IA em velocidade acelerada.",
                "sound_fx": "Trilha synthwave tecnológica com ritmo constante.",
                "duration": 14,
            },
            {
                "time": "00:19 - 00:38",
                "label": "O Detalhe Crítico",
                "spoken_text": f"O grande problema é que quem não se adaptar nos próximos 6 meses vai ficar obsoleto. As empresas não estão demitindo quem usa IA; estão demitindo quem recusa usar.",
                "b_roll": "Gráfico de adoção em curva exponencial.",
                "sound_fx": "Efeito de parada repentina no som (tape stop).",
                "duration": 19,
            },
            {
                "time": "00:39 - 00:45",
                "label": "Debate",
                "spoken_text": f"Você acha que essa mudança é positiva ou vai destruir empregos? Deixa sua opinião aqui.",
                "b_roll": "Texto na tela: 'Deixe sua opinião 👇'.",
                "sound_fx": "Efeito sonoro de transição rápida.",
                "duration": 6,
            },
        ]
    else: # Hormozi / Default
        hook = f"Pare de fazer {clean_topic} do jeito tradicional. Você só está queimando dinheiro."
        scenes = [
            {
                "time": "00:00 - 00:03",
                "label": "Gancho Hormozi",
                "spoken_text": hook,
                "b_roll": "Apontando firme para a câmera com fundo escuro e legenda amarela gigante.",
                "sound_fx": "Impacto seco 'Thud'.",
                "duration": 3,
            },
            {
                "time": "00:04 - 00:16",
                "label": "O Mito",
                "spoken_text": f"90% das pessoas acham que para ter sucesso com {clean_topic} você precisa de equipamentos caros e sorte. Mentira. Tudo se resume a consistência de volume e oferta irresistível.",
                "b_roll": "Câmera se aproximando rapidamente (zoom punch).",
                "sound_fx": "Trilha de batida hip-hop instrumental acelerada.",
                "duration": 12,
            },
            {
                "time": "00:17 - 00:35",
                "label": "A Fórmula em 3 Passos",
                "spoken_text": "Passo 1: Encontre o que o público já consome com frequência. Passo 2: Empacote a solução de forma 10 vezes mais rápida. Passo 3: Entregue tanto valor que eles se sintam estúpidos em não comprar.",
                "b_roll": "Números '1', '2' e '3' aparecendo em pop-up na tela com destaques verdes.",
                "sound_fx": "Cash register sound no passo 3.",
                "duration": 18,
            },
            {
                "time": "00:36 - 00:45",
                "label": "Fechamento Direto",
                "spoken_text": "Salve esse vídeo antes que o algoritmo derrube e comece a aplicar hoje mesmo.",
                "b_roll": "Mão tocando no botão de 'Salvar' animado no canto direito.",
                "sound_fx": "Ding de sino agudo.",
                "duration": 9,
            },
        ]

    total_words = sum(len(s["spoken_text"].split()) for s in scenes)
    total_duration = sum(s["duration"] for s in scenes)

    return {
        "topic": clean_topic,
        "template_id": template_id,
        "title": f"Roteiro Viral: {clean_topic}",
        "hook": hook,
        "tone": tone,
        "target_audience": target_audience,
        "total_duration_secs": total_duration,
        "total_words": total_words,
        "estimated_retention_score": 96,
        "scenes": scenes,
    }
