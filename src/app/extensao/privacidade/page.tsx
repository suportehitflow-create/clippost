// Política de privacidade da extensão do Clipost (exigida pela Chrome Web Store). Página pública.

export const metadata = { title: 'Privacidade da extensão — Clipost' }

export default function PrivacidadeExtensao() {
  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-300 px-4 py-12">
      <article className="max-w-2xl mx-auto space-y-6 text-sm leading-relaxed">
        <h1 className="text-2xl font-black text-white">Política de privacidade — Extensão do Clipost</h1>
        <p className="text-xs text-zinc-500">Atualizada em 28 de setembro de 2026</p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">O que a extensão faz</h2>
          <p>A extensão “Clipost — Importar do Instagram” permite que o site do Clipost liste os posts de um perfil do Instagram usando a sessão do Instagram que já está aberta no seu navegador. Ela só é acionada quando você busca um perfil no Clipost.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Quais dados ela acessa</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Informações públicas do perfil buscado e dos seus posts (legenda, data, números de visualizações, curtidas e comentários, e os links das mídias).</li>
            <li>Esses dados são entregues apenas à página do Clipost aberta no seu navegador, para você escolher o que baixar.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">O que ela NÃO faz</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Não lê, guarda nem envia sua senha, seus cookies ou o token da sua sessão do Instagram.</li>
            <li>Não publica, curte, comenta nem segue nada em seu nome.</li>
            <li>Não coleta histórico de navegação nem dados de outros sites.</li>
            <li>Não vende nem compartilha dados com terceiros.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Armazenamento</h2>
          <p>A extensão guarda temporariamente, no próprio navegador, a última lista de posts montada (apagada assim que o Clipost a recebe ou após 3 horas). Nada é guardado em servidores pela extensão.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Contato</h2>
          <p>Dúvidas: suportehitflow@gmail.com</p>
        </section>
      </article>
    </main>
  )
}
