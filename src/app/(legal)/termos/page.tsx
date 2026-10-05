import type { Metadata } from 'next'
import DocumentoLegal, { CONTATO } from '@/components/legal/DocumentoLegal'

export const metadata: Metadata = { title: 'Termos de Uso — Clipost' }

export default function TermosPage() {
  return (
    <DocumentoLegal titulo="Termos de Uso" atualizado="04/10/2026">
      <p>
        O Clipost é uma ferramenta que transforma vídeos longos em cortes curtos na vertical (9:16), com legendas e
        títulos sugeridos por inteligência artificial. Ao criar uma conta ou usar o serviço, você concorda com estes termos.
      </p>

      <h2>1. Versão de teste</h2>
      <p>
        O serviço está em fase de teste. Pode ficar indisponível, mudar ou ter limites alterados sem aviso, e não há
        garantia de que um vídeo específico consiga ser processado. Não use o Clipost como único lugar onde guarda
        um conteúdo importante.
      </p>

      <h2>2. Sua conta</h2>
      <ul>
        <li>Informe dados verdadeiros e mantenha sua senha em segredo; você responde pelo que é feito na sua conta.</li>
        <li>Cada pessoa deve usar uma conta. O plano gratuito permite 3 cortes por mês.</li>
        <li>Para proteger o serviço, há limites de vídeos em processamento ao mesmo tempo e por hora.</li>
      </ul>

      <h2>3. Conteúdo e direitos autorais</h2>
      <p>
        Você só deve enviar ou colar links de vídeos que são seus ou que você tem autorização para usar e editar.
        Você é o único responsável por ter esses direitos e por como publica os cortes gerados. O Clipost não
        verifica a titularidade dos vídeos e não substitui a autorização do autor original.
      </p>

      <h2>4. O que não é permitido</h2>
      <ul>
        <li>Usar o serviço com conteúdo ilegal, que viole direitos de terceiros, ou que exponha menores.</li>
        <li>Tentar burlar limites, acessar dados de outras pessoas, sobrecarregar ou atacar o serviço.</li>
        <li>Automatizar o uso em massa, revender ou oferecer o acesso a terceiros sem um acordo por escrito.</li>
      </ul>
      <p>Podemos suspender ou excluir contas que descumprirem estes termos.</p>

      <h2>5. Armazenamento</h2>
      <p>
        Os cortes gerados ficam guardados por até 15 dias, salvo os que você agendar para publicação. Depois disso podem
        ser apagados automaticamente. Baixe o que quiser manter.
      </p>

      <h2>6. Inteligência artificial</h2>
      <p>
        Títulos, escolha dos trechos e legendas são gerados por IA e podem conter erros. Revise antes de publicar.
      </p>

      <h2>7. Responsabilidade</h2>
      <p>
        O serviço é oferecido como está. Na medida permitida pela lei, não nos responsabilizamos por perdas
        decorrentes de indisponibilidade, de erros do conteúdo gerado ou do uso que você faz dos cortes.
      </p>

      <h2>8. Alterações e contato</h2>
      <p>
        Podemos atualizar estes termos; a data no topo mostra a versão em vigor. Dúvidas, pedidos de remoção de
        conteúdo ou questões de direitos autorais: {CONTATO}.
      </p>
    </DocumentoLegal>
  )
}
