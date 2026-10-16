import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalize = (s: string) => s.trim().toLocaleLowerCase("pt-BR");
const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "O serviço ainda não está configurado." }, 500);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const body = await req.json();
    if (body.action === "create") {
      const organizerKey = String(body.organizer_key || "");
      const people = body.participants;
      if (organizerKey.length < 12) return json({ error: "A chave do organizador precisa ter pelo menos 12 caracteres." }, 400);
      if (!Array.isArray(people) || people.length < 3 || people.length > 10) {
        return json({ error: "O sorteio precisa ter de 3 a 10 participantes." }, 400);
      }
      const names = people.map((p: any) => String(p.name || "").trim());
      if (names.some((n: string) => !n || n.length > 80)) return json({ error: "Confira os nomes: eles não podem estar vazios nem ter mais de 80 caracteres." }, 400);
      const normalized = names.map(normalize);
      if (new Set(normalized).size !== names.length) return json({ error: "Os nomes precisam ser únicos." }, 400);
      if (people.some((p: any) => String(p.pin || "").length < 6 || !String(p.assigned_name || "").trim())) {
        return json({ error: "Dados de participantes inválidos." }, 400);
      }
      const targets = people.map((p: any) => String(p.assigned_name).trim());
      if (targets.some((t: string) => !names.includes(t))) return json({ error: "O sorteio contém um nome que não está na lista." }, 400);
      if (new Set(targets).size !== names.length) return json({ error: "Cada pessoa deve ser sorteada exatamente uma vez." }, 400);
      if (people.some((p: any) => String(p.name).trim() === String(p.assigned_name).trim())) {
        return json({ error: "Ninguém pode tirar a si mesmo." }, 400);
      }

      const { data: existing } = await db.from("secret_draws").select("id").eq("id", 1).maybeSingle();
      if (existing) return json({ error: "Já existe um sorteio criado. Para proteger os resultados, não é permitido substituí-lo por esta página." }, 409);

      const organizerHash = await sha256(organizerKey);
      const { error: drawError } = await db.from("secret_draws").insert({ id: 1, organizer_key_hash: organizerHash });
      if (drawError) return json({ error: "Não foi possível criar o sorteio. Talvez ele já tenha sido criado." }, 409);

      const rows = await Promise.all(people.map(async (p: any) => ({
        name: String(p.name).trim(),
        name_normalized: normalize(String(p.name)),
        pin_hash: await sha256(String(p.pin)),
        assigned_name: String(p.assigned_name).trim(),
      })));
      const { error: insertError } = await db.from("secret_participants").insert(rows);
      if (insertError) {
        await db.from("secret_draws").delete().eq("id", 1);
        return json({ error: "Não foi possível salvar os participantes. Confira a configuração do banco." }, 500);
      }
      return json({ ok: true, codes: people.map((p: any) => ({ name: String(p.name).trim(), pin: String(p.pin) })) });
    }

    if (body.action === "reveal") {
      const name = String(body.name || "").trim();
      const pin = String(body.pin || "").trim();
      if (!name || !pin) return json({ error: "Informe o nome e o código pessoal." }, 400);
      const pinHash = await sha256(pin);
      const { data: person, error } = await db
        .from("secret_participants")
        .select("name, pin_hash, assigned_name")
        .eq("name_normalized", normalize(name))
        .maybeSingle();
      if (error || !person || person.pin_hash !== pinHash) {
        return json({ error: "Nome ou código incorreto. Confira os dados e tente novamente." }, 401);
      }
      return json({ assigned_name: person.assigned_name });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (_e) {
    return json({ error: "Ocorreu um erro inesperado. Tente novamente." }, 500);
  }
});
