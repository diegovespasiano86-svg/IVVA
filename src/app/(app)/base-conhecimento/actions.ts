"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extrairEntradasConhecimento } from "@/lib/extracao-conhecimento";
import { transcreverAudio } from "@/lib/transcricao";

// 8MB é generoso pra um PDF de catálogo ou planilha de preços comum, sem
// deixar um upload gigante travar a function na Vercel.
const TAMANHO_MAX = 8 * 1024 * 1024;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function obterTenantId(supabase: SupabaseServerClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  return perfil?.tenant_id ?? null;
}

export async function criarEntrada(formData: FormData) {
  const conteudo = String(formData.get("conteudo") ?? "").trim();
  if (!conteudo) return;

  const supabase = await createClient();
  const tenantId = await obterTenantId(supabase);
  if (!tenantId) return;

  await supabase.from("knowledge_base").insert({
    tenant_id: tenantId,
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

// Apaga o arquivo enviado (do Storage e do registro) — não mexe nos itens
// da base de conhecimento já salvos a partir dele, pra não sumir com algo
// que o dono já revisou e aprovou.
export async function removerArquivo(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();

  const { data: arquivo } = await supabase
    .from("knowledge_files")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (arquivo?.storage_path) {
    await supabase.storage.from("base-conhecimento").remove([arquivo.storage_path]);
  }

  await supabase.from("knowledge_files").delete().eq("id", id);

  revalidatePath("/base-conhecimento");
}

export type ExtracaoState = {
  entradas: string[];
  erro: string | null;
  aviso: string | null;
  arquivoId: string | null;
};

export async function processarArquivo(
  _prevState: ExtracaoState,
  formData: FormData,
): Promise<ExtracaoState> {
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { entradas: [], erro: "Selecione um arquivo.", aviso: null, arquivoId: null };
  }
  if (arquivo.size > TAMANHO_MAX) {
    return {
      entradas: [],
      erro: "Arquivo grande demais (máx. 8MB).",
      aviso: null,
      arquivoId: null,
    };
  }

  const supabase = await createClient();
  const tenantId = await obterTenantId(supabase);
  if (!tenantId) {
    return {
      entradas: [],
      erro: "Sessão expirada — recarregue a página.",
      aviso: null,
      arquivoId: null,
    };
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const nome = arquivo.name.toLowerCase();
  const ehPdf = arquivo.type === "application/pdf" || nome.endsWith(".pdf");
  const ehDocx =
    arquivo.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    nome.endsWith(".docx");
  const ehDocAntigo = nome.endsWith(".doc") && !ehDocx;

  // Sempre sobe o arquivo original pro Storage primeiro — assim ele fica
  // visível na lista mesmo se a extração falhar ou não achar nada, e o
  // dono consegue ver o que foi enviado e apagar/reenviar se precisar.
  const storagePath = `${tenantId}/${crypto.randomUUID()}-${arquivo.name}`;
  await supabase.storage
    .from("base-conhecimento")
    .upload(storagePath, buffer, { contentType: arquivo.type || "application/octet-stream" });

  async function registrarArquivo(
    status: "processado" | "sem_fatos" | "erro",
    erro: string | null,
  ): Promise<string | null> {
    const { data } = await supabase
      .from("knowledge_files")
      .insert({
        tenant_id: tenantId,
        nome_arquivo: arquivo instanceof File ? arquivo.name : "arquivo",
        storage_path: storagePath,
        tamanho_bytes: arquivo instanceof File ? arquivo.size : 0,
        status,
        erro,
      })
      .select("id")
      .single();
    return data?.id ?? null;
  }

  if (ehDocAntigo) {
    const erro =
      "Arquivo .doc (Word antigo) não é suportado — salva como .docx ou PDF no Word (Arquivo > Salvar como) e sobe de novo.";
    const arquivoId = await registrarArquivo("erro", erro);
    revalidatePath("/base-conhecimento");
    return { entradas: [], erro, aviso: null, arquivoId };
  }

  try {
    let texto: string | undefined;
    if (ehDocx) {
      const mammoth = await import("mammoth");
      const resultado = await mammoth.extractRawText({ buffer });
      texto = resultado.value;
    }

    const { entradas, truncado } = ehPdf
      ? await extrairEntradasConhecimento({
          documentoBase64: buffer.toString("base64"),
          documentoMediaType: "application/pdf",
        })
      : await extrairEntradasConhecimento({
          texto: texto ?? buffer.toString("utf-8"),
        });

    if (entradas.length === 0) {
      const erro = truncado
        ? "Esse arquivo é grande demais pra IA processar de uma vez — tenta dividir em partes menores ou colar o texto direto acima."
        : "Não encontrei fatos claros nesse arquivo — tenta outro ou cole o texto direto acima.";
      const arquivoId = await registrarArquivo("sem_fatos", erro);
      revalidatePath("/base-conhecimento");
      return { entradas: [], erro, aviso: null, arquivoId };
    }

    const aviso = truncado
      ? "Arquivo grande — a IA parou no meio. Estes são os fatos que ela conseguiu extrair antes de cortar; revise e considere subir o restante do conteúdo separado."
      : null;
    const arquivoId = await registrarArquivo("processado", null);
    revalidatePath("/base-conhecimento");
    return { entradas, erro: null, aviso, arquivoId };
  } catch (err) {
    const erro = err instanceof Error ? err.message : "Falha ao processar o arquivo.";
    const arquivoId = await registrarArquivo("erro", erro);
    revalidatePath("/base-conhecimento");
    return { entradas: [], erro, aviso: null, arquivoId };
  }
}

export async function processarAudio(
  _prevState: ExtracaoState,
  formData: FormData,
): Promise<ExtracaoState> {
  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return { entradas: [], erro: "Grave um áudio antes de enviar.", aviso: null, arquivoId: null };
  }
  if (audio.size > TAMANHO_MAX) {
    return { entradas: [], erro: "Áudio grande demais.", aviso: null, arquivoId: null };
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const mimeType = audio.type || "audio/webm";

  const transcricao = await transcreverAudio(buffer.toString("base64"), mimeType);
  if (!transcricao) {
    return {
      entradas: [],
      erro:
        "Não consegui transcrever esse áudio — a transcrição por voz ainda não está configurada nesse negócio. Fale com a gente.",
      aviso: null,
      arquivoId: null,
    };
  }

  try {
    const { entradas, truncado } = await extrairEntradasConhecimento({ texto: transcricao });
    if (entradas.length === 0) {
      return {
        entradas: [],
        erro: `Transcrevi, mas não encontrei fatos claros: "${transcricao}"`,
        aviso: null,
        arquivoId: null,
      };
    }
    return {
      entradas,
      erro: null,
      aviso: truncado
        ? "O áudio era longo e a IA parou no meio — revise, alguns trechos podem ter ficado de fora."
        : null,
      arquivoId: null,
    };
  } catch (err) {
    return {
      entradas: [],
      erro: err instanceof Error ? err.message : "Falha ao interpretar o áudio.",
      aviso: null,
      arquivoId: null,
    };
  }
}

export async function salvarEntradas(formData: FormData) {
  const tipo = String(formData.get("tipo") ?? "texto");
  const arquivoId = String(formData.get("arquivo_id") ?? "").trim() || null;
  const entradas = formData
    .getAll("entrada")
    .map((e) => String(e).trim())
    .filter(Boolean);
  if (entradas.length === 0) return;

  const supabase = await createClient();
  const tenantId = await obterTenantId(supabase);
  if (!tenantId) return;

  await supabase.from("knowledge_base").insert(
    entradas.map((conteudo) => ({
      tenant_id: tenantId,
      tipo,
      conteudo,
    })),
  );

  if (arquivoId) {
    await supabase
      .from("knowledge_files")
      .update({ entradas_geradas: entradas.length })
      .eq("id", arquivoId);
  }

  revalidatePath("/base-conhecimento");
}
