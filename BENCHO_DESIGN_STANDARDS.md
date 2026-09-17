# ⚡ Diretrizes Oficiais Bencho (bencho.dev) para o Clippost

Este documento estabelece o **padrão estético, comportamental e funcional** do Clippost, derivado das melhores práticas e blocos interativos do **bencho.dev**. Todos os novos módulos, telas e refatorações devem seguir estritamente estas definições.

---

## 1. Identidade Visual e Atmosfera (Dark Tactile Glass)

| Propriedade | Padrão Oficial | Código / Classe Tailwind |
| :--- | :--- | :--- |
| **Fundo da Aplicação** | Preto Profundo / Dark Neutro | `#090a0f` (`bg-zinc-950`) |
| **Superfície / Cards** | Vidro Fumê Translúcido | `bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08]` |
| **Degradê de Marca (Unificado)** | **Electric Indigo & Cyber Violet** | `bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600` |
| **Sombra de Ação (Glow)** | Iluminação Indigo Suave | `shadow-lg shadow-indigo-500/25` ou `shadow-[0_0_24px_rgba(99,102,241,0.3)]` |
| **Bordas em Repouso** | Linhas finas quase invisíveis | `border border-white/[0.08]` |
| **Bordas em Hover/Foco** | Realce índigo sutil | `hover:border-indigo-500/50 focus:border-indigo-500` |

---

## 2. Componentes e Funções Extraídas do Bencho.dev

### A. Alças de Proporção 8-Pontos (Transform Artboard)
- **4 Cantos:** Pílulas circulares brancas com borda índigo (`border-2 border-indigo-500`) para escala proporcional suave.
- **Linha Superior e Inferior:** Pílulas horizontais brancas (`cursor-ns-resize`) para alterar a **proporção vertical**.
- **Laterais (Esquerda e Direita):** Pílulas verticais brancas (`cursor-ew-resize`) para alterar a **proporção horizontal**.

### B. Controles Numéricos com Travas Rígidas (Sem Sliders Soltos)
- **Regra:** Nunca utilizar sliders analógicos soltos para atributos sensíveis (como tamanhos de fonte).
- **Padrão:** Stepper tátil com botões `[-]` e `[+]`, campo numérico com digitação livre restrita (ex: `min={11} max={18}`) e grade de botões de clique rápido (`11` a `18`).

### C. Abas em Pílula (Segmented Pill Controls)
- Controles com cantos arredondados (`rounded-xl`), onde a opção ativa ganha o degradê oficial (`bg-gradient-to-r from-indigo-600 to-purple-600 text-white`) com escala suave.

### D. Mockups com Proporção Estrita (Sem Vazamentos)
- Todo canvas ou frame de smartphone/reels deve respeitar rigorosamente a proporção matemática do formato (ex: **9:16 Reels = 1080 × 1920 px**).
- O chassi do aparelho deve usar `overflow-hidden` e raio de curvatura compatível com a tela para evitar qualquer vazamento de bordas.

### E. Micro-interações e Feedback Físico
- Todos os botões e seletores clicáveis devem ter resposta tátil de clique (`active:scale-95`).
- Transições de estado devem usar curvas de amortecimento naturais (`transition-all duration-150 ease-out`).

---

## 3. Checklist de Implementação para Futuras Telas
- [ ] O botão primário usa o degradê unificado `from-indigo-600 via-indigo-500 to-purple-600`?
- [ ] O fundo segue a escala dark `#090a0f` sem tons cinzas genéricos ou lavados?
- [ ] Sliders foram substituídos por seletores diretos com limites bem definidos?
- [ ] O layout possui feedback visual ao passar o mouse e ao clicar (`hover`, `active:scale-95`)?
- [ ] O viewport e os mockups de vídeo estão restritos às proporções nativas sem distorção (`object-cover`)?
