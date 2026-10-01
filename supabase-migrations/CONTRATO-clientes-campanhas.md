# Contrato: Clientes (etiquetas, listas, atribuição) + Campanhas WhatsApp

Migração: `2026-10-01_clientes_campanhas.sql` (só aditiva; ainda NÃO aplicada).
Projeto Supabase: `zcvqpgrbvnqwnegsrlnk` (PG 17).

---

## 1. Tabelas e colunas

Todas têm RLS ligada. `tenant_id` tem default `current_tenant_id()` nas tabelas que o
front escreve: **não envie `tenant_id`** (se enviar um diferente do seu, o RLS recusa).

### `labels` — qualquer usuário do tenant (select/insert/update/delete)
| coluna | tipo | regra |
|---|---|---|
| id | uuid | default |
| tenant_id | uuid | default do usuário |
| nome | text | 1–40 caracteres; único por tenant sem diferenciar maiúsculas (`lower(nome)`) |
| cor | text | `cinza` (default), `vermelho`, `laranja`, `amarelo`, `verde`, `azul`, `roxo`, `rosa` |
| created_at | timestamptz | default |

Nome repetido → erro Postgres `23505` (unique_violation) no índice `labels_tenant_nome_uidx`.

### `contact_labels` — qualquer usuário do tenant (select/insert/delete; sem update)
`contact_id uuid`, `label_id uuid`, `tenant_id uuid`, `created_at`. PK `(contact_id, label_id)`.
Contato e etiqueta precisam ser do mesmo tenant (FK composta) → senão `23503`.

### `conversations.assigned_user_id` (coluna nova, nullable)
Qualquer usuário do tenant pode atribuir/desatribuir (mesma policy atual de `conversations`).
O usuário precisa ser do mesmo tenant (FK composta `conversations_assigned_user_fk`) → senão `23503`.
Se o usuário for apagado, a coluna volta a `null` automaticamente.

### `contact_lists` — qualquer usuário do tenant (select/insert/update/delete)
`id`, `tenant_id`, `nome` (1–80), `descricao` (≤ 500, opcional), `created_at`.

### `contact_list_members` — qualquer usuário do tenant (select/insert/delete; sem update)
`list_id`, `contact_id`, `tenant_id`, `created_at`. PK `(list_id, contact_id)`. Mesmo tenant obrigatório (FK composta).

### `campaigns` — só DONO (select/insert/update; delete só em `rascunho`/`cancelada`/`concluida`)
| coluna | tipo | quem escreve |
|---|---|---|
| id | uuid | default |
| tenant_id | uuid | default |
| nome | text (1–120) | front, a qualquer momento |
| canal | text, `'whatsapp'` | front (só rascunho) |
| template_nome | text, `^[a-z0-9_]+$` | front (só rascunho); obrigatório para iniciar |
| template_idioma | text, default `pt_BR` | front (só rascunho) |
| usa_nome | bool, default false | front (só rascunho). true = template tem `{{1}}` = primeiro nome |
| mensagem_previa | text (≤ 1024) | front (só rascunho). Só para exibir; NÃO é enviada |
| audiencia | jsonb | front (só rascunho). Ver formato abaixo |
| status | text | **só RPC** |
| agendada_para | timestamptz | front em `rascunho`/`agendada`/`pausada` |
| consentimento_confirmado_em | timestamptz | front grava qualquer valor não-nulo; o banco troca por `now()` |
| consentimento_por | uuid | **banco** (= usuário logado) |
| total, enviados, falhas, ignorados | int | **só RPC** |
| pausa_motivo | `manual` \| `muitas_falhas` \| null | **só RPC** |
| iniciada_em, concluida_em | timestamptz | **só RPC** |
| created_by | uuid | **banco** (= usuário logado) |
| created_at, updated_at | timestamptz | **banco** |

Formato de `audiencia` (validado por CHECK; formato errado → `23514`):
```json
{"tipo": "todos"}
{"tipo": "lista",    "ids": ["<uuid>", "..."]}     // 1 a 50 ids
{"tipo": "etiqueta", "ids": ["<uuid>", "..."]}     // 1 a 50 ids; contato com QUALQUER uma
{"tipo": "segmento", "segmento": "inativos_60d" | "novos_30d" | "aniversariantes_mes"}
```
Chaves extras são proibidas. Os ids são conferidos contra o tenant em `campanha_preparar`.

Regras do trigger para escrita DIRETA (`supabase.from('campaigns')`):
- INSERT: sempre nasce `rascunho`, contadores 0, `created_by = auth.uid()`.
- UPDATE em status/contadores/autoria/datas de sistema → erro `campo controlado pelo sistema não pode ser alterado diretamente`.
- Mudar conteúdo fora de rascunho → `só é possível editar o conteúdo da campanha em rascunho`.
- Mudar `agendada_para` em enviando/concluida/cancelada → `não é possível mudar o agendamento com a campanha em <status>`.
- Mudar `audiencia` **zera** `total`, `ignorados` e o consentimento → é preciso chamar `campanha_preparar` e confirmar o consentimento de novo.
- Consentimento só pode ser marcado/desmarcado em `rascunho` ou `pausada` → senão `consentimento só pode ser alterado com a campanha em rascunho ou pausada`.

Para confirmar o consentimento (checkbox explícito do dono, texto sugerido: "Confirmo que estes contatos aceitaram receber mensagens do meu negócio no WhatsApp"):
```ts
await supabase.from('campaigns').update({ consentimento_confirmado_em: new Date().toISOString() }).eq('id', id)
```

### `campaign_recipients` — DONO só LÊ (escrita só por RPC)
`id`, `campaign_id`, `tenant_id`, `contact_id`, `nome`, `telefone` (snapshot só dígitos com DDI),
`status` (`pendente`|`enviando`|`enviado`|`falhou`|`ignorado`), `erro`, `tentativas`,
`enviando_desde`, `enviado_em`, `wa_message_id`, `created_at`. Único `(campaign_id, contact_id)`.

Valores de `erro` gerados pelo banco: `sem_aceite`, `telefone_invalido`, `telefone_duplicado`,
`campanha_cancelada`, `interrompido_sem_confirmacao`, `erro_desconhecido`; demais vêm da Meta via rota.

---

## 2. Estados e transições de `campaigns.status`

```
rascunho ──iniciar──► enviando ──(lote/registrar: nada pendente)──► concluida
    │          └─(agendada_para futura)─► agendada ──(lote, quando vence)──► enviando
    │                                        │
enviando/agendada ──pausar──► pausada ──iniciar──► enviando | agendada | concluida (se nada pendente)
enviando ──(disjuntor: falhas ≥ 10 e falhas > enviados)──► pausada (pausa_motivo = 'muitas_falhas')
rascunho/agendada/enviando/pausada ──cancelar──► cancelada
```
`concluida` e `cancelada` são finais. `campanha_preparar` só em `rascunho`/`agendada`
(se uma `agendada` ficar com 0 destinatários, volta para `rascunho`).

---

## 3. RPCs

Erros são exceções Postgres (`P0001`); no supabase-js chegam em `error.message` com o texto exato abaixo.

### 3a. `campanha_preparar(p_campaign_id uuid) → jsonb` — DONO (authenticated)
Resolve o público no servidor, apaga e recria os destinatários (idempotente).
Exclui: `aceita_mensagem_automatica = false`; telefone com menos de 10 ou mais de 13 dígitos
(o banco remove `+`, espaços etc.; número com 10–11 dígitos ganha `55` na frente);
telefone repetido (fica o contato mais antigo). Os excluídos são gravados como `ignorado` com o motivo.
```json
{"total": 120, "ignorados_sem_aceite": 3, "ignorados_telefone_invalido": 2, "ignorados_duplicados": 1, "status": "rascunho"}
```
Segmentos:
- `inativos_60d`: já teve agendamento `concluido` ou pagamento, nenhum dos dois nos últimos 60 dias, **e sem agendamento futuro `agendado`**.
- `novos_30d`: `contacts.created_at` nos últimos 30 dias.
- `aniversariantes_mes`: mês de `data_nascimento` = mês atual em America/Sao_Paulo.

Erros: `not allowed` · `campanha não encontrada` (inexistente OU de outro tenant) ·
`campanha não pode ser preparada no status <status>` · `audiência contém lista inválida` · `audiência contém etiqueta inválida`.

### 3b. `campanha_iniciar(p_campaign_id uuid) → jsonb` — DONO
Aceita `rascunho` (início) e `pausada` (retomada).
```json
{"status": "enviando" | "agendada" | "concluida", "pendentes": 117, "agendada_para": null, "automacoes_pausadas_ate": null}
```
Se `automacoes_pausadas_ate` vier no futuro, avise: "o envio começa quando a pausa de qualidade do número acabar".
Erros: `not allowed` · `campanha não encontrada` · `campanha não pode ser iniciada no status <status>` ·
`defina o modelo (template) aprovado pela Meta antes de iniciar` ·
`confirme que os contatos aceitaram receber mensagens antes de iniciar` ·
`nenhum destinatário elegível: prepare a campanha antes de iniciar` ·
`WhatsApp não está conectado (status ativo) para este negócio`.

### 3e. `campanha_pausar(p_campaign_id uuid) → jsonb` — DONO
`{"status": "pausada", "em_envio_agora": 4}` — `em_envio_agora` = mensagens já entregues a um lote em andamento (podem ainda sair).
Erros: `not allowed` · `campanha não encontrada` · `campanha não pode ser pausada no status <status>`.

### 3e. `campanha_cancelar(p_campaign_id uuid) → jsonb` — DONO
Pendentes viram `ignorado` (`campanha_cancelada`).
`{"status": "cancelada", "ignorados_cancelamento": 80, "em_envio_agora": 4}`
Erros: `not allowed` · `campanha não encontrada` · `campanha não pode ser cancelada no status <status>`.

### 3c. `campanha_proximo_lote(p_secret text, p_limite int default 25) → jsonb` — SERVIDOR (segredo)
**Nunca chamar do navegador e nunca devolver o resultado ao navegador: contém `access_token`.**
Chamar com cliente criado com a ANON KEY sem sessão de usuário (igual a `api/cron/pos-venda`);
`authenticated` não tem EXECUTE.
```json
{
  "itens": [
    {"recipient_id": "uuid", "campaign_id": "uuid", "tenant_id": "uuid",
     "nome": "Maria Souza", "primeiro_nome": "Maria", "telefone": "5511999998888",
     "template_nome": "promo_outubro", "template_idioma": "pt_BR", "usa_nome": true,
     "phone_number_id": "123", "access_token": "EAAG..."}
  ],
  "restantes": 230
}
```
Garantias: `p_limite` limitado a 1–40; teto de **250 envios por tenant em 24h** (enviados + em envio);
só tenants com WhatsApp `ativo`, sem `automacoes_pausadas_ate` no futuro e sem `acesso_bloqueado`;
opt-out reconferido na hora; agendadas vencidas viram `enviando`; destinatários presos em `enviando`
há mais de 15 min voltam a `pendente` (até 2 tentativas; depois `falhou` / `interrompido_sem_confirmacao`).
`restantes` conta pendentes de TODOS os tenants (inclui os barrados pelo teto) → **pare quando `itens` vier vazio**, não quando `restantes` = 0.
Erro: `not allowed` (segredo errado).

### 3d. `campanha_registrar_envio(p_secret text, p_recipient_id uuid, p_ok boolean, p_wa_message_id text default null, p_erro text default null) → jsonb` — SERVIDOR
Chame **logo após cada envio**, um por destinatário.
```json
{"ok": true, "ja_registrado": false, "status": "enviado" | "falhou", "campanha_status": "enviando" | "concluida" | "pausada" | "cancelada"}
{"ok": true, "ja_registrado": true, "status": "<status atual>"}      // repetição: não conta de novo
{"ok": false, "motivo": "destinatario_nao_encontrado"}               // ex.: contato apagado (LGPD)
```
`p_ok = true` sempre vence (se a mensagem saiu, corrige `falhou`/`ignorado`/`pendente` para `enviado` e ajusta contadores).
Erros: `not allowed` · `p_ok é obrigatório`.

---

## 4. Rota de envio (para o front implementar)

`POST /api/campanhas/processar` (sob demanda) e chamada extra dentro do cron diário `api/cron/pos-venda`:
```
usuário logado E role dono (checar via supabase server client) — ou Bearer CRON_SECRET no cron
cliente = createClient(URL, ANON_KEY)  // sem sessão
até ~45s (maxDuration 60):
  { itens } = rpc('campanha_proximo_lote', { p_secret, p_limite: 25 })
  se itens vazio: parar
  para cada item:
     components = item.usa_nome ? [{ type:'body', parameters:[{ type:'text', text: item.primeiro_nome ?? 'cliente' }]}] : []
     enviar template (item.template_nome, item.template_idioma, components)
     ok  → rpc('campanha_registrar_envio', { p_secret, p_recipient_id, p_ok: true, p_wa_message_id: resp.messages[0].id })
     erro→ rpc('campanha_registrar_envio', { ..., p_ok: false, p_erro: mensagem })
           se erro de token/conta (código 190, 131031 etc.): também record_whatsapp_send_failure
responder ao navegador SÓ contagens { enviados, falhas } — nunca `itens`.
```
- `sendWhatsAppTemplate` atual não aceita `components` e usa `en_US` por padrão: precisa de um parâmetro novo e passar `template_idioma`.
- O template com `{{1}}` exige parâmetro não vazio (por isso o fallback `'cliente'`).
- Se a rota cair: os itens do lote ficam `enviando`; depois de 15 min voltam a `pendente` e serão reenviados (ver riscos).

---

## 5. Limites (constantes no SQL)
| constante | valor | onde |
|---|---|---|
| teto por tenant | 250 / 24h | `c_teto_24h` em `campanha_proximo_lote` |
| lote máximo | 40 | `c_limite_max` |
| preso em enviando | 15 min | `c_preso` |
| tentativas antes de desistir | 2 | `c_max_tentativas` |
| disjuntor | 10 falhas e falhas > enviados | `c_falhas_para_pausar` em `campanha_registrar_envio` |
| ids na audiência | 1–50 | `campaign_audiencia_valida` |

---

## 6. Checklist de segurança (verificado no desenho)

| item | como está garantido |
|---|---|
| Isolamento nas tabelas | RLS em todas; `using` + `with check` com `tenant_id = current_tenant_id()`; FKs compostas `(x_id, tenant_id)` impedem ligar objetos de tenants diferentes mesmo com ids válidos de outro tenant. |
| Isolamento nas RPCs do dono | tenant vem de `current_tenant_id()` (servidor), nunca de parâmetro; campanha buscada com `tenant_id = v_tenant`; ids de outro tenant → `campanha não encontrada` (mesmo erro de inexistente: sem oráculo). Listas/etiquetas da audiência conferidas contra o tenant. |
| Profissional → dono | `current_app_role()` lê `users.role` no servidor; profissional não tem policy de UPDATE em `users` (só `users_manage_owner`, dono). Campanhas: RLS + checagem nas RPCs. |
| Funções com segredo | `check_webhook_secret` é a 1ª instrução; EXECUTE só para `anon`/`service_role`; `authenticated` (navegador logado) recebe `permission denied`. |
| access_token | só sai de `campanha_proximo_lote` (segredo). Nenhuma tabela nova guarda token; RPCs do dono não devolvem token. |
| SQL injection | nenhum `EXECUTE`/SQL dinâmico; tudo parametrizado; `search_path` fixo em `public`. |
| Envio duplicado (corrida) | `pg_advisory_xact_lock` serializa lotes; `FOR UPDATE SKIP LOCKED` em campanhas e destinatários; destinatário só sai do lote em `pendente`→`enviando` na mesma transação; `unique(campaign_id, contact_id)` + dedupe por telefone. |
| Deadlock | ordem de trava única: campanha → destinatário em todas as funções. |
| Rota cai no meio | itens ficam `enviando`; não contam no teto após 15 min; voltam a `pendente` (máx. 2 tentativas), depois `falhou`. Confirmação tardia (`p_ok=true`) corrige o estado. |
| Escrita direta burlando regras | trigger bloqueia status/contadores/autoria e força consentimento = `now()` + `auth.uid()`; `campaign_recipients` sem INSERT/UPDATE/DELETE para `authenticated`. |
| TRUNCATE/anon | revogados nas tabelas novas. |

---

## 7. Roteiro de TESTES SQL (nada é gravado: tudo termina em `rollback`)

Rodar no SQL Editor (usuário `postgres`). Cada bloco é independente. Resultado esperado em `NOTICE`.
Pré-requisito: a migração aplicada (ou cole a migração sem o `commit` no início do bloco para testar antes de aplicar).

### 7.1 Isolamento entre tenants (dono do tenant A tentando tocar o tenant B)
```sql
begin;
-- ids de teste (postgres enxerga tudo)
select set_config('t.a', (select tenant_id::text from users where role='dono' order by created_at limit 1), true);
select set_config('t.b', (select tenant_id::text from users where role='dono' and tenant_id <> current_setting('t.a')::uuid order by created_at limit 1), true);
select set_config('t.dono_a', (select id::text from users where role='dono' and tenant_id = current_setting('t.a')::uuid limit 1), true);
select set_config('t.user_b', (select id::text from users where tenant_id = current_setting('t.b')::uuid limit 1), true);
select set_config('t.contato_a', (select id::text from contacts where tenant_id = current_setting('t.a')::uuid limit 1), true);
select set_config('t.conversa_a', coalesce((select id::text from conversations where tenant_id = current_setting('t.a')::uuid limit 1), ''), true);

insert into labels (id, tenant_id, nome) values
  ('00000000-0000-0000-0000-0000000000aa', current_setting('t.a')::uuid, 'teste A'),
  ('00000000-0000-0000-0000-0000000000bb', current_setting('t.b')::uuid, 'teste B');
insert into campaigns (id, tenant_id, nome) values
  ('00000000-0000-0000-0000-0000000000cb', current_setting('t.b')::uuid, 'campanha B');

-- vira o dono do tenant A
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('t.dono_a'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
begin
  if (select count(*) from labels where id = '00000000-0000-0000-0000-0000000000bb') <> 0 then
    raise exception 'FALHOU: viu etiqueta de B'; end if;
  if (select count(*) from campaigns where id = '00000000-0000-0000-0000-0000000000cb') <> 0 then
    raise exception 'FALHOU: viu campanha de B'; end if;
  raise notice 'OK: select isolado';

  begin  -- contato A + etiqueta B
    insert into contact_labels (contact_id, label_id)
    values (current_setting('t.contato_a')::uuid, '00000000-0000-0000-0000-0000000000bb');
    raise exception 'FALHOU: ligou etiqueta de B';
  exception when foreign_key_violation then raise notice 'OK: FK composta bloqueou etiqueta de B';
  end;

  begin  -- forjar tenant_id = B
    insert into labels (tenant_id, nome) values (current_setting('t.b')::uuid, 'invasao');
    raise exception 'FALHOU: inseriu no tenant B';
  exception when insufficient_privilege then raise notice 'OK: RLS with check bloqueou';
  end;

  if current_setting('t.conversa_a') <> '' then
    begin  -- atribuir conversa A a usuário de B
      update conversations set assigned_user_id = current_setting('t.user_b')::uuid
       where id = current_setting('t.conversa_a')::uuid;
      raise exception 'FALHOU: atribuiu a usuário de B';
    exception when foreign_key_violation then raise notice 'OK: atribuição cross-tenant bloqueada';
    end;
  end if;

  begin  -- RPC com id de campanha de B
    perform campanha_preparar('00000000-0000-0000-0000-0000000000cb');
    raise exception 'FALHOU: preparou campanha de B';
  exception when raise_exception then
    if sqlerrm = 'campanha não encontrada' then raise notice 'OK: RPC não acha campanha de B';
    else raise; end if;
  end;

  begin  -- função de serviço sem ser anon/service_role
    perform campanha_proximo_lote('qualquer', 5);
    raise exception 'FALHOU: authenticated executou proximo_lote';
  exception when insufficient_privilege then raise notice 'OK: authenticated sem EXECUTE no lote';
  end;
end $$;
rollback;
```

### 7.2 Profissional não age como dono + trava de campos
```sql
begin;
select set_config('t.a', (select tenant_id::text from users where role='dono' order by created_at limit 1), true);
select set_config('t.prof', (select id::text from users where role='profissional' and tenant_id = current_setting('t.a')::uuid limit 1), true);
select set_config('t.dono', (select id::text from users where role='dono' and tenant_id = current_setting('t.a')::uuid limit 1), true);
insert into campaigns (id, tenant_id, nome) values
  ('00000000-0000-0000-0000-0000000000ca', current_setting('t.a')::uuid, 'campanha A');

-- como PROFISSIONAL
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.prof'), 'role','authenticated')::text, true);
set local role authenticated;
do $$
begin
  if (select count(*) from campaigns) <> 0 then raise exception 'FALHOU: profissional viu campanhas'; end if;
  raise notice 'OK: profissional não vê campanhas';
  begin
    perform campanha_iniciar('00000000-0000-0000-0000-0000000000ca');
    raise exception 'FALHOU';
  exception when raise_exception then
    if sqlerrm = 'not allowed' then raise notice 'OK: iniciar recusado'; else raise; end if;
  end;
  begin
    update users set role = 'dono' where id = auth.uid();
    if found then raise exception 'FALHOU: virou dono'; end if;
    raise notice 'OK: não consegue se promover (0 linhas)';
  end;
  -- etiquetas: profissional PODE
  insert into labels (nome) values ('vip teste');
  raise notice 'OK: profissional cria etiqueta';
end $$;
reset role;

-- como DONO: trava de campos e consentimento forjado
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.dono'), 'role','authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    update campaigns set status = 'enviando' where id = '00000000-0000-0000-0000-0000000000ca';
    raise exception 'FALHOU: mudou status direto';
  exception when raise_exception then
    if sqlerrm like 'campo controlado%' then raise notice 'OK: status protegido'; else raise; end if;
  end;
  update campaigns set consentimento_confirmado_em = '2000-01-01', consentimento_por = gen_random_uuid()
   where id = '00000000-0000-0000-0000-0000000000ca';
  if exists (select 1 from campaigns where id = '00000000-0000-0000-0000-0000000000ca'
              and (consentimento_confirmado_em < now() - interval '1 minute' or consentimento_por <> auth.uid())) then
    raise exception 'FALHOU: consentimento forjado'; end if;
  raise notice 'OK: consentimento = now() e auth.uid()';
  begin
    update campaigns set audiencia = '{"tipo":"lista","ids":["x"]}' where id = '00000000-0000-0000-0000-0000000000ca';
    raise exception 'FALHOU: audiência inválida aceita';
  exception when check_violation then raise notice 'OK: audiência validada';
  end;
end $$;
rollback;
```

### 7.3 Preparar (resolve público, opt-out, idempotência)
```sql
begin;
select set_config('t.a', (select tenant_id::text from users where role='dono' order by created_at limit 1), true);
select set_config('t.dono', (select id::text from users where role='dono' and tenant_id = current_setting('t.a')::uuid limit 1), true);
-- marca 1 contato como opt-out (desfeito no rollback)
update contacts set aceita_mensagem_automatica = false
 where id = (select id from contacts where tenant_id = current_setting('t.a')::uuid order by created_at limit 1);
insert into campaigns (id, tenant_id, nome, template_nome) values
  ('00000000-0000-0000-0000-0000000000ca', current_setting('t.a')::uuid, 'teste', 'teste_template');

select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.dono'), 'role','authenticated')::text, true);
set local role authenticated;
select campanha_preparar('00000000-0000-0000-0000-0000000000ca');   -- 1ª vez
select campanha_preparar('00000000-0000-0000-0000-0000000000ca');   -- 2ª: mesmos números
select status, erro, count(*) from campaign_recipients
 where campaign_id = '00000000-0000-0000-0000-0000000000ca' group by 1,2;  -- 1 'ignorado/sem_aceite'
select campanha_iniciar('00000000-0000-0000-0000-0000000000ca');   -- espera erro de consentimento
rollback;
```

### 7.4 Segredo e lote (como servidor)
```sql
begin;
set local role anon;
do $$ begin
  begin perform campanha_proximo_lote('errado', 5); raise exception 'FALHOU';
  exception when raise_exception then
    if sqlerrm = 'not allowed' then raise notice 'OK: segredo errado recusado'; else raise; end if;
  end;
  begin perform campanha_registrar_envio('errado', gen_random_uuid(), true); raise exception 'FALHOU';
  exception when raise_exception then
    if sqlerrm = 'not allowed' then raise notice 'OK: registrar recusado'; else raise; end if;
  end;
end $$;
rollback;

-- privilégios (sem transação, só leitura)
select p, r, has_function_privilege(r, p, 'execute')
  from unnest(array['campanha_preparar(uuid)','campanha_iniciar(uuid)','campanha_pausar(uuid)','campanha_cancelar(uuid)',
                    'campanha_proximo_lote(text,integer)','campanha_registrar_envio(text,uuid,boolean,text,text)']) p,
       unnest(array['anon','authenticated','service_role']) r order by 1,2;
-- esperado: dono-RPCs só authenticated/service_role; lote/registrar só anon/service_role
```
Para testar o lote com dados sem expor o token na tela, rode como `postgres` dentro de `begin … rollback`
e mostre só o tamanho: `select jsonb_array_length(campanha_proximo_lote((select value from internal_secrets where key='whatsapp_webhook'), 5)->'itens');`

### 7.5 Corrida (manual, duas abas do SQL Editor)
Aba 1: `begin; select jsonb_array_length(campanha_proximo_lote(<segredo>, 40)->'itens');` (não dê commit).
Aba 2: a mesma chamada → fica esperando a trava; após `rollback` na aba 1, a aba 2 recebe o lote.
Com `commit` na aba 1, a aba 2 recebe só os próximos (nenhum `recipient_id` repetido). Termine com `rollback` nas duas.
