import type { Metadata } from 'next'
import DocumentoLegal, { CONTATO } from '@/components/legal/DocumentoLegal'

export const metadata: Metadata = { title: 'Política de Privacidade — Clipost' }

export default function PrivacidadePage() {
  return (
    <DocumentoLegal titulo="Política de Privacidade" atualizado="04/10/2026">
      <p>
        Esta política explica quais dados o Clipost usa, para quê, com quem são compartilhados e quais são os seus
        direitos, conforme a Lei Geral de Proteção de Dados (LGPD).
      </p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li><strong>Conta:</strong> nome, e-mail e senha (a senha é guardada de forma criptografada, nunca em texto).</li>
        <li><strong>O que você cria:</strong> links de vídeos que você informa, os arquivos que você envia, os cortes gerados, transcrições, títulos e configurações.</li>
        <li><strong>Uso e segurança:</strong> registros técnicos (como horário e endereço IP) mantidos pelos serviços de hospedagem para proteger e operar o serviço.</li>
      </ul>

      <h2>2. Para que usamos</h2>
      <ul>
        <li>Criar sua conta, processar os vídeos e entregar os cortes.</li>
        <li>Aplicar os limites do plano e proteger o serviço contra abuso.</li>
        <li>Corrigir falhas e melhorar o produto.</li>
      </ul>

      <h2>3. Com quem compartilhamos</h2>
      <p>Só com os fornecedores necessários para o serviço funcionar (operadores):</p>
      <ul>
        <li><strong>Supabase:</strong> login e banco de dados.</li>
        <li><strong>Cloudflare:</strong> hospedagem do site e armazenamento dos vídeos e cortes.</li>
        <li><strong>Fly.io:</strong> servidor que baixa e processa os vídeos.</li>
        <li><strong>Provedores de IA</strong> (Google Gemini, Groq e OpenRouter): recebem o <em>texto da transcrição</em> do vídeo para sugerir cortes e títulos. Não enviamos seu nome nem seu e-mail.</li>
        <li>A plataforma de origem do vídeo (por exemplo, o YouTube) recebe o pedido de download do link que você informou.</li>
      </ul>
      <p>Não vendemos seus dados.</p>

      <h2>4. Por quanto tempo guardamos</h2>
      <ul>
        <li>Cortes gerados: até 15 dias, salvo os agendados para publicação.</li>
        <li>Dados da conta: até você pedir a exclusão.</li>
      </ul>

      <h2>5. Seus direitos</h2>
      <p>
        Você pode pedir confirmação de que tratamos seus dados, acesso, correção, anonimização, portabilidade,
        exclusão da conta e dos dados, e informações sobre o compartilhamento. Escreva para {CONTATO}.
      </p>

      <h2>6. Cookies</h2>
      <p>
        Usamos apenas o cookie necessário para manter você logado. Não usamos cookies de publicidade.
      </p>

      <h2>7. Segurança</h2>
      <p>
        Adotamos medidas técnicas para proteger os dados, como conexão criptografada e isolamento entre contas. Nenhum
        sistema é totalmente imune; se houver um incidente relevante, avisaremos as pessoas afetadas.
      </p>

      <h2>8. Menores de idade</h2>
      <p>O Clipost não é destinado a menores de 18 anos.</p>

      <h2>9. Alterações e contato</h2>
      <p>
        Podemos atualizar esta política; a data no topo mostra a versão em vigor. Contato do responsável: {CONTATO}.
      </p>
    </DocumentoLegal>
  )
}
