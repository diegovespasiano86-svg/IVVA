import Entrar from "./entrar";

// Chega aqui quem clicou no botão do e-mail de confirmação (cadastro sem cartão da IVVA BLACK).
export default function GratisPage() {
  return (
    <>
      {/* Antes de qualquer medição carregar: guarda a sessão do link e limpa o endereço. */}
      <script
        dangerouslySetInnerHTML={{
          __html: "if(location.hash.indexOf('access_token')>-1){window.__ivvaAuth=location.hash;history.replaceState(null,'',location.pathname)}",
        }}
      />
      <Entrar />
    </>
  );
}
