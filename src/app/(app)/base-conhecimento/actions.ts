"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extrairEntradasConhecimento } from "@/lib/extracao-conhecimento";
import { transcreverAudio } from "@/lib/transcricao";

// 8MB é generoso pra um PDF de catálogo ou planilha de preços comum, sem
// deixar um upload gigante travar a function na Vercel.
const TAMANHO_MAX = 8 * 1024 * 1024;

export async function criarEntrada(formData: FormData) {
  const conteudo = String(formData.get("conteudo") ?? "").trim();
  if (!conteudo) return;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) return;

  await supabase.from("knowledge_base").insert({
    tenant_id: perfil.tenant_id,
    tipo: "texto",
    conteudo,
  });

  revalidatePath("/base-conhecimento");
}

export async function removerEntrada(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("knowledge_base").delete().eq("id", id);

  revalidatePath("/base-conhecimento");
}

export async function editarEntrada(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const conteudo = String(formData.get("conteudo") ?? "").trim();
  if (!id || !conteudo) return;

  const supabase = await createClient();
  await supabase.from("knowledge_base").update({ conteudo }).eq("id", id);

  revalidatePath("/base-conhecimento");
}

export type ExtracaoState = { entradas: string[]; erro: string | null };

export async function processarArquivo(
  _prevState: ExtracaoState,
  formData: FormData,
): Promise<ExtracaoState> {
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { entradas: [], erro: "Selecione um arquivo." };
  }
  if (arquivo.size > TAMANHO_MAX) {
    return { entradas: [], erro: "Arquivo grande demais (máx. 8MB)." };
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const nome = arquivo.name.toLowerCase();
  const ehPdf = arquivo.type === "application/pdf" || nome.endsWith(".pdf");
  const ehDocx =
    arquivo.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    nome.endsWith(".docx");
  const ehDocAntigo = nome.endsWith(".doc") && !ehDocx;

  if (ehDocAntigo) {
    return {
      entradas: [],
      erro:
        "Arquivo .doc (Word antigo) não é suportado — salva como .docx ou PDF no Word (Arquivo > Salvar como) e sobe de novo.",
    };
  }

  try {
    let texto: string | undefined;
    if (ehDocx) {
      const mammoth = await import("mammoth");
      const resultado = await mammoth.extractRawText({ buffer });
      texto = resultado.value;
    }

    const entradas = ehPdf
      ? await extrairEntradasConhecimento({
          documentoBase64: buffer.toString("base64"),
          documentoMediaType: "application/pdf",
        })
      : await extrairEntradasConhecimento({
          texto: texto ?? buffer.toString("utf-8"),
        });

    if (entradas.length === 0) {
      return {
        entradas: [],
        erro: "Não encontrei fatos claros nesse arquivo — tenta outro ou cole o texto direto acima.",
      };
    }
    return { entradas, erro: null };
  } catch (err) {
    return {
      entradas: [],
      erro: err instanceof Error ? err.message : "Falha ao processar o arquivo.",
    };
  }
}

export async function processarAudio(
  _prevState: ExtracaoState,
  formData: FormData,
): Promise<ExtracaoState> {
  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return { entradas: [], erro: "Grave um áudio antes de enviar." };
  }
  if (audio.size > TAMANHO_MAX) {
    return { entradas: [], erro: "Áudio grande demais." };
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const mimeType = audio.type || "audio/webm";

  const transcricao = await transcreverAudio(buffer.toString("base64"), mimeType);
  if (!transcricao) {
    return {
      entradas: [],
      erro:
        "Não consegui transcrever esse áudio — a transcrição por voz ainda não está configurada nesse negócio. Fale com a gente.",
    };
  }

  try {
    const entradas = await extrairEntradasConhecimento({ texto: transcricao });
    if (entradas.length === 0) {
      return {
        entradas: [],
        erro: `Transcrevi, mas não encontrei fatos claros: "${transcricao}"`,
      };
    }
    return { entradas, erro: null };
  } catch (err) {
    return {
      entradas: [],
      erro: err instanceof Error ? err.message : "Falha ao interpretar o áudio.",
    };
  }
}

export async function salvarEntradas(formData: FormData) {
  const tipo = String(formData.get("tipo") ?? "texto");
  const entradas = formData
    .getAll("entrada")
    .map((e) => String(e).trim())
    .filter(Boolean);
  if (entradas.length === 0) return;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) return;

  await supabase.from("knowledge_base").insert(
    entradas.map((conteudo) => ({
      tenant_id: perfil.tenant_id,
      tipo,
      conteudo,
    })),
  );

  revalidatePath("/base-conhecimento");
}
