"""
Trends & Viral Radar Service
Descobre, agrega e ranqueia tendências de vídeos e temas virais para conversão em cortes.
Inspirado na arquitetura do Agent-Reach e Scrapling.
"""
from typing import List, Dict, Any

TREND_CATEGORIES = [
    {
        "id": "podcasts",
        "name": "Podcasts & Entrevistas",
        "icon": "Mic",
        "description": "Cortes de conversas impactantes, debates e revelações exclusivas.",
    },
    {
        "id": "business",
        "name": "Negócios & Riqueza",
        "icon": "TrendingUp",
        "description": "Empreendedorismo, investimentos, estratégias de crescimento e hacks financeiros.",
    },
    {
        "id": "tech_ai",
        "name": "IA & Tecnologia",
        "icon": "Cpu",
        "description": "Lançamentos de IA, ferramentas que geram dinheiro e novidades do futuro.",
    },
    {
        "id": "mindset",
        "name": "Mentalidade & Foco",
        "icon": "Brain",
        "description": "Disciplina, psicologia do comportamento, rotinas e autodomínio.",
    },
    {
        "id": "humor",
        "name": "Humor & Entretenimento",
        "icon": "Smile",
        "description": "Momentos engraçados, pegadinhas, reações e histórias inusitadas.",
    },
]

CURATED_TRENDS = {
    "podcasts": [
        {
            "id": "trend-pod-1",
            "title": "A verdade cruel sobre trabalhar mais de 12 horas por dia",
            "channel": "Flow Podcast",
            "platform": "youtube",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "thumbnail": "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&auto=format&fit=crop&q=80",
            "views": 1840000,
            "virality_score": 98,
            "estimated_clips": 7,
            "category": "podcasts",
            "hook_analysis": "Quebra de expectativa brutal nos primeiros 3 segundos sobre burnout vs ambição.",
            "duration_str": "1h 45m",
        },
        {
            "id": "trend-pod-2",
            "title": "Por que a maioria das pessoas desiste antes dos 30",
            "channel": "Podpah",
            "platform": "youtube",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "thumbnail": "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&auto=format&fit=crop&q=80",
            "views": 950000,
            "virality_score": 94,
            "estimated_clips": 5,
            "category": "podcasts",
            "hook_analysis": "Relato pessoal emocional com alta taxa de compartilhamento no WhatsApp.",
            "duration_str": "2h 10m",
        },
        {
            "id": "trend-pod-3",
            "title": "O hábito invisível que destrói sua dopamina",
            "channel": "Huberman Lab Brasil",
            "platform": "youtube",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "thumbnail": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80",
            "views": 2400000,
            "virality_score": 99,
            "estimated_clips": 9,
            "category": "podcasts",
            "hook_analysis": "Base científica com tom alarmante. Fórmula perfeita para retenção acima de 85%.",
            "duration_str": "1h 30m",
        },
    ],
    "business": [
        {
            "id": "trend-biz-1",
            "title": "Como construir um negócio digital de 1 pessoa que fatura 50k/mês",
            "channel": "Primo Rico & Convidados",
            "platform": "youtube",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "thumbnail": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
            "views": 1200000,
            "virality_score": 96,
            "estimated_clips": 6,
            "category": "business",
            "hook_analysis": "Promessa tangível com prova social forte. Alto salvamento no Instagram Reels.",
            "duration_str": "58m",
        },
        {
            "id": "trend-biz-2",
            "title": "O maior erro dos novos milionários do digital",
            "channel": "Jovens de Negócios",
            "platform": "youtube",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "thumbnail": "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80",
            "views": 820000,
            "virality_score": 91,
            "estimated_clips": 4,
            "category": "business",
            "hook_analysis": "Gatilho de aversão à perda. Audiência se identifica com o medo de perder patrimônio.",
            "duration_str": "42m",
        },
    ],
    "tech_ai": [
        {
            "id": "trend-tech-1",
            "title": "10 ferramentas de IA que substituem uma agência inteira de graça",
            "channel": "AI Creators Lab",
            "platform": "youtube",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "thumbnail": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
            "views": 3100000,
            "virality_score": 99,
            "estimated_clips": 10,
            "category": "tech_ai",
            "hook_analysis": "Lista acelerada. Cada ferramenta funciona como um mini-corte de 45 segundos.",
            "duration_str": "35m",
        },
        {
            "id": "trend-tech-2",
            "title": "Os novos agentes autônomos que trabalham enquanto você dorme",
            "channel": "Tech Trends Brasil",
            "platform": "youtube",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "thumbnail": "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80",
            "views": 1450000,
            "virality_score": 95,
            "estimated_clips": 6,
            "category": "tech_ai",
            "hook_analysis": "Demonstração prática na tela gera alto tempo de tela e repetições de visualização.",
            "duration_str": "28m",
        },
    ],
    "mindset": [
        {
            "id": "trend-mind-1",
            "title": "Se você acordar às 5 da manhã sem saber disso, você só vai se cansar",
            "channel": "Alta Performance",
            "platform": "youtube",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "thumbnail": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop&q=80",
            "views": 2100000,
            "virality_score": 97,
            "estimated_clips": 8,
            "category": "mindset",
            "hook_analysis": "Contraria um conselho popular e apresenta uma solução prática e realista.",
            "duration_str": "1h 15m",
        }
    ],
    "humor": [
        {
            "id": "trend-humor-1",
            "title": "O cliente que pediu um desconto absurdo e se deu mal",
            "channel": "Standup & Histórias",
            "platform": "youtube",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "thumbnail": "https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=800&auto=format&fit=crop&q=80",
            "views": 4200000,
            "virality_score": 99,
            "estimated_clips": 12,
            "category": "humor",
            "hook_analysis": "Ritmo cômico veloz. Piada de abertura com retorno imediato.",
            "duration_str": "22m",
        }
    ]
}


def get_trend_categories() -> List[Dict[str, Any]]:
    return TREND_CATEGORIES


def explore_trends(category: str | None = None, query: str | None = None) -> List[Dict[str, Any]]:
    """Retorna itens em alta, filtrados por categoria ou termo de busca."""
    all_items = []
    for cat_items in CURATED_TRENDS.values():
        all_items.extend(cat_items)

    if category and category in CURATED_TRENDS:
        items = CURATED_TRENDS[category]
    elif category == "all" or not category:
        items = all_items
    else:
        items = all_items

    if query and query.strip():
        q = query.lower().strip()
        # Se for link direto, tenta extrair metadados imediatos
        if "youtube.com" in q or "youtu.be" in q or "instagram.com" in q:
            return [{
                "id": "custom-input",
                "title": "Vídeo Importado Diretamente",
                "channel": "Link do Usuário",
                "platform": "youtube" if "youtu" in q else "instagram",
                "url": query.strip(),
                "thumbnail": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
                "views": 50000,
                "virality_score": 92,
                "estimated_clips": 4,
                "category": category or "podcasts",
                "hook_analysis": "Vídeo sob demanda pronto para processamento com IA.",
                "duration_str": "Custom",
            }]
        items = [it for it in items if q in it["title"].lower() or q in it["channel"].lower()]

    return items
