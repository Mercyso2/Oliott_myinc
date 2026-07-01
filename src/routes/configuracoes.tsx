import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArchiveRestore, PlusCircle, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState, LoadingState } from "@/components/social-components";
import { useAuth } from "@/lib/auth";
import {
  DEFAULT_MYINC_BRAND_MEMORY,
  brandProfileRepository,
  brandRepository,
  ensureEditableMyincBrand,
} from "@/lib/repositories/brand-repository";
import { logRepository } from "@/lib/repositories/log-repository";
import { libraryRepository, mediaRepository } from "@/lib/repositories/media-repository";
import { uploadStorageObject } from "@/lib/supabase/client";
import type { LibraryItemRow, MediaAssetRow } from "@/lib/supabase/types";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Memória da Marca — MYINC" }] }),
  component: Configuracoes,
});

type MemoryFields = Record<string, string>;

const fieldGroups = {
  principal: [
    "name",
    "public_name",
    "site",
    "instagram",
    "facebook",
    "whatsapp",
    "commercial_email",
    "region",
    "niche",
    "segment",
    "primary_audience",
    "secondary_audience",
    "persona",
    "problems_solved",
    "benefits",
    "differentiators",
    "products",
    "services",
    "average_ticket",
    "objections",
    "guarantees",
    "social_proof",
    "cases",
    "testimonials",
    "faq",
  ],
  verbal: [
    "tone",
    "communication_style",
    "preferred_words",
    "forbidden_words",
    "usual_phrases",
    "never_use_phrases",
    "forbidden_phrases",
    "forbidden_promises",
    "allowed_technical_terms",
    "avoided_technical_terms",
  ],
  visual: [
    "primary_palette",
    "secondary_palette",
    "forbidden_colors",
    "brand_fonts",
    "preferred_visual_style",
    "forbidden_visual_style",
    "preferred_images",
    "avoided_images",
    "logo_rules",
    "composition_rules",
    "image_text_rules",
    "approved_references",
    "bad_references",
    "mantra",
  ],
};

const labels: Record<string, string> = {
  name: "Nome da empresa",
  public_name: "Nome público",
  site: "Site",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  commercial_email: "E-mail comercial",
  region: "Região de atuação",
  niche: "Nicho",
  segment: "Segmento",
  primary_audience: "Público-alvo principal",
  secondary_audience: "Público-alvo secundário",
  persona: "Persona",
  problems_solved: "Problemas que resolve",
  benefits: "Benefícios",
  differentiators: "Diferenciais",
  products: "Produtos",
  services: "Serviços",
  average_ticket: "Ticket médio",
  objections: "Objeções comuns",
  guarantees: "Garantias e segurança",
  social_proof: "Provas sociais",
  cases: "Cases",
  testimonials: "Depoimentos",
  faq: "Perguntas frequentes",
  tone: "Tom de voz",
  communication_style: "Estilo de comunicação",
  preferred_words: "Palavras preferidas",
  forbidden_words: "Palavras proibidas",
  usual_phrases: "Frases usuais",
  never_use_phrases: "Frases que nunca deve usar",
  forbidden_phrases: "Frases proibidas",
  forbidden_promises: "Promessas proibidas",
  allowed_technical_terms: "Termos técnicos permitidos",
  avoided_technical_terms: "Termos técnicos evitados",
  primary_palette: "Paleta principal",
  secondary_palette: "Paleta secundária",
  forbidden_colors: "Cores proibidas",
  brand_fonts: "Fontes",
  preferred_visual_style: "Estilo visual preferido",
  forbidden_visual_style: "Estilo visual proibido",
  preferred_images: "Imagens preferidas",
  avoided_images: "Imagens evitadas",
  logo_rules: "Regras de logo",
  composition_rules: "Regras de composição",
  image_text_rules: "Regras de texto em imagem",
  approved_references: "Referências boas",
  bad_references: "Referências ruins",
  mantra: "Mantra obrigatório da marca",
};

const profileKeys = [...fieldGroups.principal, ...fieldGroups.verbal, ...fieldGroups.visual].filter(
  (key) => !["name", "public_name"].includes(key),
);

const longTextKeys = new Set([
  "primary_audience",
  "secondary_audience",
  "persona",
  "problems_solved",
  "benefits",
  "differentiators",
  "products",
  "services",
  "objections",
  "guarantees",
  "social_proof",
  "cases",
  "testimonials",
  "faq",
  "tone",
  "communication_style",
  "preferred_words",
  "forbidden_words",
  "usual_phrases",
  "never_use_phrases",
  "forbidden_phrases",
  "forbidden_promises",
  "allowed_technical_terms",
  "avoided_technical_terms",
  "preferred_visual_style",
  "forbidden_visual_style",
  "preferred_images",
  "avoided_images",
  "logo_rules",
  "composition_rules",
  "image_text_rules",
  "approved_references",
  "bad_references",
  "mantra",
]);

function normalizeFields(raw: Record<string, unknown>): MemoryFields {
  const normalized: MemoryFields = { ...DEFAULT_MYINC_BRAND_MEMORY };
  for (const key of ["name", "public_name", ...profileKeys]) {
    const value = raw[key];
    normalized[key] = value == null ? normalized[key] ?? "" : String(value);
  }
  return normalized;
}

function Configuracoes() {
  const { session, profile } = useAuth();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [brandId, setBrandId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [fields, setFields] = useState<MemoryFields>(() => ({ ...DEFAULT_MYINC_BRAND_MEMORY }));
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [creatingBrand, setCreatingBrand] = useState(false);

  const brandReady = Boolean(brandId && profileId);

  const hydrateMemory = useCallback(
    async (showToast = false) => {
      if (!session) return null;
      const result = await ensureEditableMyincBrand(session.access_token, profile?.brand_id);
      setBrandId(result.brand.id);
      setProfileId(result.profile.id);
      setFields(
        normalizeFields({
          ...result.profile,
          name: result.brand.name,
          public_name: result.brand.public_name ?? result.brand.name,
        }),
      );
      if (showToast || result.created) {
        toast.success(result.created ? "Marca MYINC criada e liberada para edição." : "Memória da marca recarregada.");
      }
      return result;
    },
    [profile?.brand_id, session],
  );

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      await hydrateMemory(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar/criar memória da marca.");
      setFields((current) => ({ ...DEFAULT_MYINC_BRAND_MEMORY, ...current }));
    } finally {
      setLoading(false);
    }
  }, [hydrateMemory, session]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!brandReady || !session || !Object.keys(fields).length) return;
    const timer = window.setTimeout(() => void save(true), 1200);
    return () => window.clearTimeout(timer);
  }, [fields, brandReady, session]);

  async function createOrRestoreBrand() {
    if (!session) return;
    setCreatingBrand(true);
    setError("");
    try {
      await hydrateMemory(true);
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar/restaurar marca MYINC.");
    } finally {
      setCreatingBrand(false);
    }
  }

  async function ensureBrandBeforeAction() {
    if (brandId && profileId) return { brandId, profileId };
    const result = await hydrateMemory(true);
    if (!result) throw new Error("Sessão não encontrada para criar a marca.");
    return { brandId: result.brand.id, profileId: result.profile.id };
  }

  async function save(auto = false) {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const ready = await ensureBrandBeforeAction();
      await brandRepository.update(session.access_token, ready.brandId, {
        name: fields.name || "MYINC",
        public_name: fields.public_name || fields.name || "MYINC",
        status: "active",
      } as never);

      const payload = Object.fromEntries(profileKeys.map((key) => [key, fields[key] ?? ""]));
      await brandProfileRepository.update(session.access_token, ready.profileId, payload as never);

      await logRepository.create(session.access_token, {
        brand_id: ready.brandId,
        module: "memoria",
        type: "brand",
        status: "sucesso",
        friendly_message: auto
          ? "Auto-save da memória da marca concluído."
          : "Memória da marca salva.",
        technical_detail: "brands/brand_profiles atualizado pela tela editável",
      } as never);
      setSaved(true);
      if (!auto) toast.success("Memória salva no Supabase.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar memória.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!session) return;
    setLogoUploading(true);
    setError("");
    try {
      const ready = await ensureBrandBeforeAction();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const storagePath = `${ready.brandId}/logos/${crypto.randomUUID()}-${safeName}`;
      const uploaded = await uploadStorageObject(
        "brand-assets",
        storagePath,
        session.access_token,
        file,
      );
      const asset = await mediaRepository.create(session.access_token, {
        brand_id: ready.brandId,
        name: file.name,
        media_type: "Logo",
        url: uploaded.publicUrl,
        preview_url: uploaded.publicUrl,
        status: "ativo",
        tags: ["logo", "myinc", "marca"],
        notes: "Logo enviada pela tela Memória da Marca.",
        origin: "upload-logo",
        ai_allowed: true,
        storage_bucket: "brand-assets",
        storage_path: storagePath,
        asset_role: "Logo",
        usage_context: "marca",
      } as Partial<MediaAssetRow>);
      await libraryRepository.create(session.access_token, {
        brand_id: ready.brandId,
        media_asset_id: asset.id,
        name: file.name,
        item_type: "Logo",
        url: uploaded.publicUrl,
        status: "referência aprovada",
        tags: ["logo", "marca", "myinc"],
        notes: "Logo oficial aprovada para orientar composição visual da IA.",
        format: "Todos",
        ai_usage_rule:
          "Usar como referência de marca, composição, respiro e contraste. Não distorcer a logo.",
        ai_allowed: true,
        asset_role: "Logo",
        usage_context: "identidade visual",
      } as Partial<LibraryItemRow>);
      await logRepository.create(session.access_token, {
        brand_id: ready.brandId,
        module: "memoria",
        type: "logo",
        status: "sucesso",
        friendly_message: "Logo enviada e aprovada para a IA.",
        technical_detail: storagePath,
      } as never);
      toast.success("Logo enviada, salva e liberada como referência da IA.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar logo.");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  function updateField(key: string, value: string) {
    setSaved(false);
    setFields((current) => ({ ...current, [key]: value }));
  }

  function renderFields(keys: string[]) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {keys.map((key) => (
          <label key={key} className="space-y-2">
            <span className="text-sm font-semibold">{labels[key] ?? key}</span>
            {longTextKeys.has(key) || (fields[key] ?? "").length > 90 ? (
              <Textarea
                value={fields[key] ?? ""}
                onChange={(event) => updateField(key, event.target.value)}
                className="min-h-28 resize-y"
                placeholder="Escreva aqui a regra real da marca..."
              />
            ) : (
              <Input
                value={fields[key] ?? ""}
                onChange={(event) => updateField(key, event.target.value)}
                placeholder="Digite aqui..."
              />
            )}
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <PageHeader
        title="Memória da Marca"
        description="Dados reais persistidos no Supabase e usados pelos prompts do Cérebro IA. Esta tela agora cria a marca automaticamente se o banco estiver vazio."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={loading || creatingBrand || !session}
              onClick={() => void createOrRestoreBrand()}
            >
              <PlusCircle className="h-4 w-4" />
              Criar/restaurar MYINC
            </Button>
            <Button
              className="rounded-full bg-gradient-primary text-primary-foreground"
              disabled={loading || creatingBrand || !session}
              onClick={() => void save(false)}
            >
              <Save className="h-4 w-4" />
              Salvar agora
            </Button>
            <Button variant="outline" className="rounded-full" disabled>
              <ArchiveRestore className="h-4 w-4" />
              Restaurar arquivados
            </Button>
          </div>
        }
      />

      {loading ? <LoadingState label="Sincronizando memória da marca..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!brandReady && !loading ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Banco sem marca ativa detectada. Você já pode editar os campos abaixo e clicar em
          <b> Salvar agora</b>; a marca MYINC será criada automaticamente.
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-3 text-sm text-success">
          Salvo no Supabase e liberado para o Cérebro IA.
        </div>
      ) : null}

      <div className="rounded-3xl border border-border bg-sidebar p-6 text-sidebar-foreground shadow-elevated">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sidebar-primary">
          Base de conhecimento da IA
        </p>
        <h2 className="mt-2 text-2xl font-bold">
          A IA só cria como a marca quando entende a marca profundamente.
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-sidebar-foreground/65">
          Edite livremente. O planejamento, o Cérebro IA e o motor local usam estes dados para montar prompts premium.
        </p>
      </div>

      <Tabs defaultValue="principal" className="space-y-5">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted p-1">
          <TabsTrigger value="principal">Informações principais</TabsTrigger>
          <TabsTrigger value="verbal">Identidade verbal</TabsTrigger>
          <TabsTrigger value="visual">Identidade visual</TabsTrigger>
          <TabsTrigger value="logos">Logos e uploads</TabsTrigger>
        </TabsList>
        <TabsContent value="principal">{renderFields(fieldGroups.principal)}</TabsContent>
        <TabsContent value="verbal">{renderFields(fieldGroups.verbal)}</TabsContent>
        <TabsContent value="visual">{renderFields(fieldGroups.visual)}</TabsContent>
        <TabsContent value="logos">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) =>
                event.target.files?.[0] && void uploadLogo(event.target.files[0])
              }
            />
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-bold">Logos oficiais e uploads da marca</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Envie logos branca, escura, horizontal, vertical ou símbolo. Elas entram na Biblioteca como referência aprovada para o Cérebro IA.
                </p>
              </div>
              <Button
                className="rounded-full bg-gradient-primary text-primary-foreground"
                disabled={logoUploading || loading || !session}
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {logoUploading ? "Enviando..." : "Enviar logo oficial"}
              </Button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                Logo enviada vira item de Biblioteca.
              </div>
              <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                Status: referência aprovada para IA.
              </div>
              <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                A IA usa a logo como referência, mas não deve inventar ou distorcer a marca.
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
