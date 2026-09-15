"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  criarEstagio,
  excluirEstagio,
  moverEstagioOrdem,
  renomearEstagio,
} from "./actions";

type Estagio = { id: string; key: string; label: string };

export default function StageManager({ estagios }: { estagios: Estagio[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, setPendente] = useState<string | null>(null);

  async function rodar(acao: () => Promise<void>, marcador: string) {
    setPendente(marcador);
    await acao();
    router.refresh();
    setPendente(null);
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="btn border border-border bg-surface px-3.5 py-2 text-[12.5px]"
      >
        Editar fases do funil
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4"
          onClick={() => setAberto(false)}
        >
          <div
            className="card w-full max-w-[440px] px-5 py-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[16.5px] font-extrabold">
                Fases do funil
              </h2>
              <button
                onClick={() => setAberto(false)}
                className="text-[13px] text-ink-faint"
              >
                Fechar ✕
              </button>
            </div>

            <p className="mb-4 text-[12.5px] text-ink-soft">
              Renomeie, reordene ou crie novas fases. Os clientes já
              cadastrados acompanham a fase pelo nome, então renomear não
              perde o histórico.
            </p>

            <ul className="flex flex-col gap-2">
              {estagios.map((estagio, i) => (
                <li
                  key={estagio.id}
                  className="flex items-center gap-2 rounded-[10px] border border-border px-2.5 py-2"
                >
                  <div className="flex flex-col">
                    <button
                      title="Mover para cima"
                      disabled={i === 0 || pendente !== null}
                      onClick={() =>
                        rodar(async () => {
                          const fd = new FormData();
                          fd.set("stage_id", estagio.id);
                          fd.set("direcao", "up");
                          await moverEstagioOrdem(fd);
                        }, `up-${estagio.id}`)
                      }
                      className="text-[11px] text-ink-faint hover:text-ink disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      title="Mover para baixo"
                      disabled={i === estagios.length - 1 || pendente !== null}
                      onClick={() =>
                        rodar(async () => {
                          const fd = new FormData();
                          fd.set("stage_id", estagio.id);
                          fd.set("direcao", "down");
                          await moverEstagioOrdem(fd);
                        }, `down-${estagio.id}`)
                      }
                      className="text-[11px] text-ink-faint hover:text-ink disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>

                  <form
                    action={(fd) => rodar(() => renomearEstagio(fd), `ren-${estagio.id}`)}
                    className="flex flex-1 items-center gap-1.5"
                  >
                    <input type="hidden" name="stage_id" value={estagio.id} />
                    <input
                      name="label"
                      defaultValue={estagio.label}
                      className="w-full rounded-[8px] border border-border bg-surface px-2 py-1.5 text-[12.5px]"
                    />
                    <button
                      type="submit"
                      disabled={pendente !== null}
                      className="rounded-[8px] bg-surface-soft px-2 py-1.5 text-[11.5px] font-bold text-ink-soft"
                    >
                      Salvar
                    </button>
                  </form>

                  <button
                    disabled={estagios.length <= 1 || pendente !== null}
                    onClick={() => {
                      if (
                        !confirm(
                          `Excluir "${estagio.label}"? Os clientes nessa fase vão para a primeira fase da lista.`,
                        )
                      )
                        return;
                      rodar(async () => {
                        const fd = new FormData();
                        fd.set("stage_id", estagio.id);
                        await excluirEstagio(fd);
                      }, `del-${estagio.id}`);
                    }}
                    className="text-[11.5px] font-bold text-coral disabled:opacity-30"
                  >
                    Excluir
                  </button>
                </li>
              ))}
            </ul>

            <form
              action={(fd) => rodar(() => criarEstagio(fd), "novo")}
              className="mt-3 flex gap-2"
            >
              <input
                name="label"
                required
                placeholder="Nome da nova fase"
                className="flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
              />
              <button
                type="submit"
                disabled={pendente !== null}
                className="btn bg-ink px-3.5 py-2 text-[12.5px] text-white disabled:opacity-60"
              >
                + Fase
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
