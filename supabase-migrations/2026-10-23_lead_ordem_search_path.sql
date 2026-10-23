-- Check final de 23/10/2026: fixa o search_path da função lead_ordem (alerta function_search_path_mutable do advisor).
-- (Aplicada em produção pelo MCP; este arquivo é o registro.)
alter function public.lead_ordem(text) set search_path = public;
