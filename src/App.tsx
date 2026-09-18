import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Flame,
  LogOut,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  TrendingUp,
  Utensils,
  Search,
  X,
} from "lucide-react";
import "./App.css";

type Ingredient = {
  id: number;
  dbId?: string;
  name: string;
  brand: string;
  pack: number;
  unit: "g" | "ml" | "unid";
  price: number;
  category: "insumo" | "embalagem";
};
type RecipeLine = {
  id: number;
  dbId?: string;
  ingredientId?: string;
  ingredient: string;
  quantity: number;
  type: "g" | "ml" | "unidade_cebola" | "unidade_azeitona";
};
type Pizza = {
  id: number;
  dbId?: string;
  name: string;
  lines: RecipeLine[];
  salePrice: number;
  competitors: [number | null, number | null, number | null];
  category: "pizza" | "massa";
  doughSize: "broto" | "grande";
  doughRecipe: string;
  massYield: number;
};
type Dough = {
  flour: number;
  water: number;
  yeast: number;
  salt: number;
  oil: number;
  yield: number;
};
type Gas = {
  price: number;
  weight: number;
  consumption: number;
  minutes: number;
  pizzas: number;
};
type MenuCategory = "Pizza" | "Esfiha" | "Bebida" | "Outro";
type MenuItem = {
  id: number;
  dbId?: string;
  nome_comercial: string;
  ficha_tecnica_ref: string;
  descricao: string;
  categoria: MenuCategory;
  tamanho: string;
  imagem_url: string;
  preco_venda: number;
  disponivel: boolean;
  destaque: boolean;
  ordem_exibicao: number;
  observacoes_internas: string;
  created_at?: string;
  updated_at?: string;
};

const menuCategoryOptions: MenuCategory[] = ["Pizza", "Esfiha", "Bebida", "Outro"];
const getMarginTone = (percentage: number) =>
  percentage > 0.55 ? "good" : percentage >= 0.45 ? "warn" : "bad";
const getMenuMarginSummary = (
  item: Pick<MenuItem, "ficha_tecnica_ref" | "preco_venda">,
  pizzas: Pizza[],
  totalCost: (pizza: Pizza) => number,
) => {
  const recipe = pizzas.find((pizza) => pizza.name === item.ficha_tecnica_ref);
  const cost = recipe ? totalCost(recipe) : 0;
  const salePrice = Number(item.preco_venda ?? 0);
  const margin = salePrice - cost;
  const percentage = salePrice > 0 ? margin / salePrice : 0;
  return { cost, margin, percentage, tone: getMarginTone(percentage) };
};

const gasStorageKey = "della-nonna-gas";
const defaultGas: Gas = {
  price: 115,
  weight: 13,
  consumption: 0.7,
  minutes: 180,
  pizzas: 60,
};

const readStoredGas = (): { gas: Gas; gasIncluded: boolean } | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(gasStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{ gas: Partial<Gas>; gasIncluded: boolean }>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      gas: {
        price: Number(parsed.gas?.price ?? defaultGas.price),
        weight: Number(parsed.gas?.weight ?? defaultGas.weight),
        consumption: Number(parsed.gas?.consumption ?? defaultGas.consumption),
        minutes: Number(parsed.gas?.minutes ?? defaultGas.minutes),
        pizzas: Number(parsed.gas?.pizzas ?? defaultGas.pizzas),
      },
      gasIncluded: Boolean(parsed.gasIncluded),
    };
  } catch {
    return null;
  }
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const initialIngredients: Ingredient[] = [
  
];
const initialPizzas: Pizza[] = [
  
];
const money = (value: number | null | undefined) =>
  value == null || Number.isNaN(value)
    ? "sem dado"
    : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const unitMoney = (value: number | null | undefined) =>
  value == null || Number.isNaN(value)
    ? "sem dado"
    : value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 4,
        maximumFractionDigits: 6,
      });
const parseNumber = (value: string) => Number(value.replace(",", ".")) || 0;
const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(de|da|do|das|dos)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const findIngredientByName = (ingredients: Ingredient[], name: string) => {
  const normalizedName = normalizeName(name);
  const exactMatches = ingredients.filter(
    (ingredient) => normalizeName(ingredient.name) === normalizedName,
  );
  const exact = exactMatches
    .sort((left, right) => Number(right.price > 0) - Number(left.price > 0) || right.price - left.price)
    .at(0);
  if (exact) return exact;
  const requestedTokens = normalizedName.split(" ").filter(Boolean);
  return ingredients
    .filter((ingredient) => {
    const ingredientTokens = normalizeName(ingredient.name).split(" ");
    return requestedTokens.every((token) => ingredientTokens.includes(token));
    })
    .sort((left, right) => Number(right.price > 0) - Number(left.price > 0) || right.price - left.price)
    .at(0);
};

const saveIngredientToSupabase = async (item: Ingredient) => {
  if (!supabase) return item.dbId;
  const payload = {
    nome: item.name,
    marca_obs: item.brand || null,
    qtd_embalagem: item.pack,
    unidade: item.unit,
    preco_pago: item.price,
    categoria: item.category,
  };
  if (item.dbId) {
    await supabase.from("insumos").update(payload).eq("id", item.dbId);
    return item.dbId;
  }
  const { data } = await supabase
    .from("insumos")
    .upsert(payload, { onConflict: "nome,categoria" })
    .select("id")
    .single();
  return data?.id as string | undefined;
};

const pricingSaveQueues = new Map<string, Promise<string | undefined>>();
const pricingSaveTimers = new Map<number, ReturnType<typeof setTimeout>>();

const savePricingToSupabase = async (pizza: Pizza) => {
  if (!supabase) return pizza.dbId;
  const queueKey = pizza.dbId ?? pizza.name;
  const previous = pricingSaveQueues.get(queueKey) ?? Promise.resolve();
  const next = previous.then(async () => {
    const payload = {
      pizza_nome: pizza.name,
      categoria: pizza.category,
      tamanho_massa: pizza.doughSize,
      massa_utilizada: pizza.doughRecipe || null,
      rendimento_massa: pizza.massYield,
      preco_venda: pizza.salePrice,
      concorrente_massa_arretada: pizza.competitors[0],
      concorrente_dantas: pizza.competitors[1],
      concorrente_farini: pizza.competitors[2],
    };
    const pricingResponse = pizza.dbId
      ? await supabase.from("precificacao").update(payload).eq("id", pizza.dbId).select("id").single()
      : await supabase.from("precificacao").insert(payload).select("id").single();
    const pricing = pricingResponse.data;
    if (pricingResponse.error) throw pricingResponse.error;
    const pizzaId = (pricing?.id ?? pizza.dbId) as string | undefined;
    if (pizzaId) {
      await supabase.from("fichas_tecnicas").delete().eq("pizza_id", pizzaId);
    } else {
      await supabase.from("fichas_tecnicas").delete().eq("pizza_nome", pizza.name);
    }
    if (pizza.lines.length)
      await supabase.from("fichas_tecnicas").insert(
        pizza.lines.map((line, index) => ({
          pizza_id: pizzaId ?? null,
          pizza_nome: pizza.name,
          ingrediente_nome: line.ingredient,
          ingrediente_id: line.ingredientId || null,
          quantidade: line.quantity,
          tipo: line.type,
          ordem: index,
        })),
      );
    return pricing?.id as string | undefined;
  });
  pricingSaveQueues.set(queueKey, next);
  const dbId = await next.finally(() => {
    if (pricingSaveQueues.get(queueKey) === next) pricingSaveQueues.delete(queueKey);
  });
  return dbId;
};

const saveMenuItemToSupabase = async (item: MenuItem) => {
  if (!supabase) return item.dbId;
  const payload = {
    nome_comercial: item.nome_comercial,
    ficha_tecnica_ref: item.ficha_tecnica_ref,
    descricao: item.descricao || null,
    categoria: item.categoria,
    tamanho: item.tamanho || null,
    imagem_url: item.imagem_url || null,
    preco_venda: item.preco_venda,
    disponivel: item.disponivel,
    destaque: item.destaque,
    ordem_exibicao: item.ordem_exibicao,
    observacoes_internas: item.observacoes_internas || null,
  };
  if (item.dbId) {
    const { error } = await supabase.from("cardapio_itens").update(payload).eq("id", item.dbId);
    if (error) throw error;
    return item.dbId;
  }
  const { data, error } = await supabase.from("cardapio_itens").insert(payload).select("id").single();
  if (error) throw error;
  return data?.id as string | undefined;
};

const schedulePricingSave = (pizza: Pizza) => {
  if (!supabase || !pizza.dbId) return;
  const currentTimer = pricingSaveTimers.get(pizza.id);
  if (currentTimer) clearTimeout(currentTimer);
  pricingSaveTimers.set(
    pizza.id,
    setTimeout(() => {
      pricingSaveTimers.delete(pizza.id);
      void savePricingToSupabase(pizza);
    }, 400),
  );
};

function App() {
  const [session, setSession] = useState(false);
  const [authReady, setAuthReady] = useState(!supabase);
  const [email, setEmail] = useState("admin@dellanonna.com");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeSection, setActiveSection] = useState<
    "insumos" | "fichas" | "precificacao" | "cardapio"
  >("insumos");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [pizzas, setPizzas] = useState(initialPizzas);
  const [conversion, setConversion] = useState({ cebola: 130, azeitona: 4 });
  const [dough, setDough] = useState<Dough>({
    flour: 1000,
    water: 600,
    yeast: 20,
    salt: 25,
    oil: 30,
    yield: 5,
  });
  const persistedGas = readStoredGas();
  const [gas, setGas] = useState<Gas>(() => persistedGas?.gas ?? defaultGas);
  const [gasIncluded, setGasIncluded] = useState<boolean>(() => persistedGas?.gasIncluded ?? false);
  const [saved, setSaved] = useState(false);
  const [databaseError, setDatabaseError] = useState("");
  const [hydrated, setHydrated] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(Boolean(data.session));
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(Boolean(nextSession));
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const route = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/");
    const page = route[1] || route[0];
    if (page === "cardapio") setActiveSection("cardapio");
    if (page === "precificacao") setActiveSection("precificacao");
    if (page === "fichas") setActiveSection("fichas");
    if (page === "insumos" || page === "admin") setActiveSection("insumos");
  }, []);
  useEffect(() => {
    if (!supabase || !session) return;
    setHydrated(false);
    let mounted = true;
    const hydrate = async () => {
      const [ingredientsResponse, assumptionsResponse, recipesResponse, pricingResponse, doughResponse, gasResponse, menuItemsResponse] = await Promise.all([
        supabase.from("insumos").select("*").order("created_at"),
        supabase.from("premissas_conversao").select("*"),
        supabase.from("fichas_tecnicas").select("*").order("ordem"),
        supabase.from("precificacao").select("*").order("pizza_nome"),
        supabase.from("receita_massa").select("*").order("ingrediente_nome"),
        supabase.from("gas").select("*").eq("id", true).maybeSingle(),
        supabase.from("cardapio_itens").select("*").order("ordem_exibicao"),
      ]);
      if (!mounted) return;
      const failedResponse = [ingredientsResponse, assumptionsResponse, recipesResponse, pricingResponse, doughResponse, gasResponse, menuItemsResponse].find((response) => response.error);
      if (failedResponse?.error) {
        console.error("Falha ao carregar dados do Supabase:", failedResponse.error);
        setDatabaseError(`Não foi possível carregar os dados: ${failedResponse.error.message}`);
        setHydrated(true);
        return;
      }
      setDatabaseError("");
      const ingredientRows = ingredientsResponse.data;
      const assumptionRows = assumptionsResponse.data;
      const recipeRows = recipesResponse.data;
      const pricingRows = pricingResponse.data;
      const doughRows = doughResponse.data;
      const gasRows = gasResponse.data;
      const menuRows = menuItemsResponse.data;
      if (menuRows?.length) {
        setMenuItems(
          menuRows.map((row, index) => ({
            id: index + 1,
            dbId: row.id,
            nome_comercial: row.nome_comercial,
            ficha_tecnica_ref: row.ficha_tecnica_ref,
            descricao: row.descricao ?? "",
            categoria: row.categoria ?? "Outro",
            tamanho: row.tamanho ?? "",
            imagem_url: row.imagem_url ?? "",
            preco_venda: Number(row.preco_venda ?? 0),
            disponivel: row.disponivel ?? true,
            destaque: Boolean(row.destaque),
            ordem_exibicao: Number(row.ordem_exibicao ?? index + 1),
            observacoes_internas: row.observacoes_internas ?? "",
            created_at: row.created_at,
            updated_at: row.updated_at,
          })),
        );
      }
      if (ingredientRows?.length) {
        const uniqueIngredients = new Map<string, (typeof ingredientRows)[number]>();
        ingredientRows.forEach((row) => {
          const key = `${normalizeName(row.nome)}::${row.categoria}`;
          const current = uniqueIngredients.get(key);
          if (!current || Number(row.preco_pago) > Number(current.preco_pago) || row.updated_at > current.updated_at) {
            uniqueIngredients.set(key, row);
          }
        });
        setIngredients(
          [...uniqueIngredients.values()].map((row, index) => ({
            id: index + 1,
            dbId: row.id,
            name: row.nome,
            brand: row.marca_obs ?? "",
            pack: Number(row.qtd_embalagem),
            unit: row.unidade,
            price: Number(row.preco_pago),
            category: row.categoria,
          })),
        );
      }
      if (assumptionRows?.length)
        setConversion({
          cebola: Number(
            assumptionRows.find((row) => row.item.startsWith("Cebola"))
              ?.peso_medio_g ?? 130,
          ),
          azeitona: Number(
            assumptionRows.find((row) => row.item.startsWith("Azeitona"))
              ?.peso_medio_g ?? 4,
          ),
        });
      if (gasRows) {
        setGas({
          price: Number(gasRows.preco_botijao),
          weight: Number(gasRows.peso_botijao_kg),
          consumption: Number(gasRows.consumo_kg_hora),
          minutes: Number(gasRows.tempo_turno_min),
          pizzas: Number(gasRows.pizzas_por_turno),
        });
        setGasIncluded(Boolean(gasRows.incluir_no_custo));
      }
      if (doughRows?.length) {
        const values: Dough = {
          flour: 0,
          water: 0,
          yeast: 0,
          salt: 0,
          oil: 0,
          yield: Number(doughRows[0].rendimento_pizzas),
        };
        doughRows.forEach((row) => {
          const key = row.ingrediente_nome.toLowerCase();
          if (key.includes("farinha")) values.flour = Number(row.quantidade_g);
          if (key.includes("água") || key.includes("agua"))
            values.water = Number(row.quantidade_g);
          if (key.includes("fermento")) values.yeast = Number(row.quantidade_g);
          if (key.includes("sal")) values.salt = Number(row.quantidade_g);
          if (key.includes("óleo") || key.includes("oleo"))
            values.oil = Number(row.quantidade_g);
        });
        setDough(values);
      }
      if (pricingRows?.length || recipeRows?.length) {
        const names = [
          ...new Set([
            ...(pricingRows ?? []).map((row) => row.pizza_nome),
            ...(recipeRows ?? []).map((row) => row.pizza_nome),
          ]),
        ];
        setPizzas(
          names.map((name, index) => {
            const pricing = pricingRows?.find((row) => row.pizza_nome === name);
            return {
              id: index + 1,
              dbId: pricing?.id,
              name,
              category: pricing?.categoria === "massa" ? "massa" : "pizza",
              doughSize: pricing?.tamanho_massa === "grande" ? "grande" : "broto",
              doughRecipe: pricing?.massa_utilizada ?? "",
              massYield: Number(pricing?.rendimento_massa ?? 5),
              lines: (recipeRows ?? [])
                .filter((row) =>
                  pricing?.id && row.pizza_id
                    ? row.pizza_id === pricing.id
                    : row.pizza_nome === name,
                )
                .filter((row, rowIndex, rows) =>
                  rows.findIndex(
                    (candidate) =>
                      candidate.ingrediente_nome === row.ingrediente_nome &&
                      Number(candidate.quantidade) === Number(row.quantidade) &&
                      candidate.tipo === row.tipo &&
                      candidate.ordem === row.ordem,
                  ) === rowIndex,
                )
                .map((row, lineIndex) => ({
                  id: lineIndex + 1,
                  dbId: row.id,
                  ingredient: row.ingrediente_nome,
                  ingredientId: row.ingrediente_id ?? undefined,
                  quantity: Number(row.quantidade),
                  type: row.tipo,
                })),
              salePrice: Number(pricing?.preco_venda ?? 0),
              competitors: [
                pricing?.concorrente_massa_arretada == null
                  ? null
                  : Number(pricing.concorrente_massa_arretada),
                pricing?.concorrente_dantas == null
                  ? null
                  : Number(pricing.concorrente_dantas),
                pricing?.concorrente_farini == null
                  ? null
                  : Number(pricing.concorrente_farini),
              ],
            };
          }),
        );
      }
      setHydrated(true);
    };
    hydrate();
    return () => {
      mounted = false;
    };
  }, [session]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        gasStorageKey,
        JSON.stringify({ gas, gasIncluded }),
      );
    }
  }, [gas, gasIncluded]);
  useEffect(() => {
    if (!supabase || !hydrated) return;
    void Promise.all([
      supabase.from("premissas_conversao").upsert(
        [
          { item: "Cebola (1 unidade)", peso_medio_g: conversion.cebola },
          { item: "Azeitona (1 unidade)", peso_medio_g: conversion.azeitona },
        ],
        { onConflict: "item" },
      ),
      supabase
        .from("gas")
        .upsert({
          id: true,
          preco_botijao: gas.price,
          peso_botijao_kg: gas.weight,
          consumo_kg_hora: gas.consumption,
          tempo_turno_min: gas.minutes,
          pizzas_por_turno: gas.pizzas,
          incluir_no_custo: gasIncluded,
        }),
      supabase.from("receita_massa").upsert(
        [
          {
            ingrediente_nome: "Farinha de trigo",
            quantidade_g: dough.flour,
            rendimento_pizzas: dough.yield,
          },
          {
            ingrediente_nome: "Água",
            quantidade_g: dough.water,
            rendimento_pizzas: dough.yield,
          },
          {
            ingrediente_nome: "Fermento",
            quantidade_g: dough.yeast,
            rendimento_pizzas: dough.yield,
          },
          {
            ingrediente_nome: "Sal",
            quantidade_g: dough.salt,
            rendimento_pizzas: dough.yield,
          },
          {
            ingrediente_nome: "Óleo",
            quantidade_g: dough.oil,
            rendimento_pizzas: dough.yield,
          },
        ],
        { onConflict: "ingrediente_nome" },
      ),
    ]);
  }, [conversion, dough, gas, gasIncluded, hydrated]);
  const unitPrice = (item?: Ingredient) =>
    item && item.pack > 0 ? item.price / item.pack : 0;
  const ingredientCost = (line: RecipeLine) => {
    const item = line.ingredientId
      ? ingredients.find((ingredient) => ingredient.dbId === line.ingredientId)
      : findIngredientByName(ingredients, line.ingredient);
    if (!item) return 0;
    const multiplier =
      line.type === "unidade_cebola"
        ? conversion.cebola
        : line.type === "unidade_azeitona"
          ? conversion.azeitona
          : 1;
    return line.quantity * multiplier * unitPrice(item);
  };
  const doughCost = useMemo(() => {
    const values: Record<string, number> = {
      "Farinha de trigo": dough.flour,
      Água: dough.water,
      Fermento: dough.yeast,
      Sal: dough.salt,
      Óleo: dough.oil,
    };
    return (
      Object.entries(values).reduce((total, [name, quantity]) => {
        const item = findIngredientByName(ingredients, name);
        return total + (item ? quantity * unitPrice(item) : 0);
      }, 0) / Math.max(dough.yield, 1)
    );
  }, [dough, ingredients]);
  const recipeDoughCost = (recipe: Pizza) =>
    recipe.lines.reduce((total, line) => total + ingredientCost(line), 0) /
    Math.max(recipe.massYield, 1);
  const doughRecipes = pizzas.filter((recipe) => recipe.category === "massa");
  const boxCost = ingredients
    .filter((ingredient) => ingredient.category === "embalagem")
    .reduce((total, ingredient) => total + unitPrice(ingredient), 0);
  const gasCost =
    gas.pizzas > 0
      ? ((gas.minutes / 60) * gas.consumption * (gas.price / gas.weight)) /
        gas.pizzas
      : 0;
  const totalCost = (pizza: Pizza) => {
    const selectedDough = doughRecipes.find(
      (recipe) => recipe.name === pizza.doughRecipe,
    );
    const pizzaDoughCost = selectedDough ? recipeDoughCost(selectedDough) : doughCost;
    return (
      (pizza.category === "massa" ? recipeDoughCost(pizza) : pizza.lines.reduce((total, line) => total + ingredientCost(line), 0) + pizzaDoughCost + boxCost) +
      (gasIncluded ? gasCost : 0)
    );
  };
  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };
  const updateIngredient = (
    id: number,
    key: keyof Ingredient,
    value: string,
  ) => {
    setIngredients((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const next = {
          ...item,
          [key]: ["pack", "price"].includes(key) ? parseNumber(value) : value,
        } as Ingredient;
        void saveIngredientToSupabase(next);
        return next;
      }),
    );
    flashSaved();
  };
  const updatePizza = (
    id: number,
    key: "salePrice" | "name",
    value: string,
  ) => {
    setPizzas((current) =>
      current.map((pizza) => {
        if (pizza.id !== id) return pizza;
        const next = {
          ...pizza,
          [key]: key === "salePrice" ? parseNumber(value) : value,
        };
        schedulePricingSave(next);
        return next;
      }),
    );
    flashSaved();
  };
  const addIngredient = async (details: Omit<Ingredient, "id" | "dbId">) => {
    const item: Ingredient = {
      id: Date.now(),
      ...details,
    };
    setIngredients((items) => [...items, item]);
    const dbId = await saveIngredientToSupabase(item);
    if (dbId) {
      setIngredients((items) =>
        items.map((current) => current.id === item.id ? { ...current, dbId } : current),
      );
    }
    flashSaved();
  };
  const addPackaging = async () => {
    const item: Ingredient = {
      id: Date.now(),
      name: "Nova embalagem",
      brand: "",
      pack: 1,
      unit: "unid",
      price: 0,
      category: "embalagem",
    };
    setIngredients((items) => [...items, item]);
    const dbId = await saveIngredientToSupabase(item);
    if (dbId) {
      setIngredients((items) =>
        items.map((current) => current.id === item.id ? { ...current, dbId } : current),
      );
    }
    flashSaved();
  };
  const deleteIngredient = async (ingredient: Ingredient) => {
    setIngredients((items) => items.filter((item) => item.id !== ingredient.id));
    if (supabase && ingredient.dbId) {
      await supabase.from("insumos").delete().eq("id", ingredient.dbId);
    }
    flashSaved();
  };
  const saveMenuItem = async (item: MenuItem) => {
    const dbId = await saveMenuItemToSupabase(item);
    setMenuItems((items) => {
      const existing = items.some((current) => current.id === item.id);
      if (existing) {
        return items.map((current) =>
          current.id === item.id ? { ...item, dbId: dbId ?? item.dbId } : current,
        );
      }
      return [...items, { ...item, dbId: dbId ?? item.dbId }];
    });
    flashSaved();
  };
  const deleteMenuItem = async (item: MenuItem) => {
    setMenuItems((items) => items.filter((current) => current.id !== item.id));
    if (supabase && item.dbId) {
      await supabase.from("cardapio_itens").delete().eq("id", item.dbId);
    }
    flashSaved();
  };
  const addPizza = () => {
    const pizza: Pizza = {
      id: Date.now(),
      name: "Novo sabor",
      lines: [],
      salePrice: 0,
      competitors: [null, null, null],
      category: "pizza",
      doughSize: "grande",
      doughRecipe: "",
      massYield: 5,
    };
    setPizzas((items) => [...items, pizza]);
    return pizza;
  };
  const savePizza = async (pizza: Pizza) => {
    const dbId = await savePricingToSupabase(pizza);
    if (dbId) {
      setPizzas((items) =>
        items.map((current) => current.id === pizza.id ? { ...current, dbId } : current),
      );
    }
    flashSaved();
  };
  const deletePizza = async (pizza: Pizza) => {
    setPizzas((items) => items.filter((item) => item.id !== pizza.id));
    if (supabase) {
      if (pizza.dbId) {
        await supabase.from("fichas_tecnicas").delete().eq("pizza_id", pizza.dbId);
        await supabase.from("precificacao").delete().eq("id", pizza.dbId);
      } else {
        await supabase.from("fichas_tecnicas").delete().eq("pizza_nome", pizza.name);
        await supabase.from("precificacao").delete().eq("pizza_nome", pizza.name);
      }
    }
    flashSaved();
  };
  const duplicatePizza = async (source: Pizza) => {
    const baseName = source.name.replace(/\d+$/, "");
    const usedNames = new Set(pizzas.map((pizza) => pizza.name));
    let copyNumber = 1;
    let name = `${baseName}${String(copyNumber).padStart(2, "0")}`;
    while (usedNames.has(name)) {
      copyNumber += 1;
      name = `${baseName}${String(copyNumber).padStart(2, "0")}`;
    }
    const copy: Pizza = {
      ...source,
      id: Date.now(),
      dbId: undefined,
      name,
      lines: source.lines.map((line) => ({ ...line, id: Date.now() + Math.random(), dbId: undefined })),
    };
    const dbId = await savePricingToSupabase(copy);
    setPizzas((items) => [...items, dbId ? { ...copy, dbId } : copy]);
    flashSaved();
  };
  const addLine = (pizzaId: number) =>
    setPizzas((items) =>
      items.map((pizza) =>
        pizza.id === pizzaId
          ? {
              ...pizza,
              lines: [
                ...pizza.lines,
                {
                  id: Date.now(),
                  ingredientId: ingredients.find((item) => item.category === "insumo")?.dbId,
                  ingredient: ingredients.find((item) => item.category === "insumo")?.name ?? "",
                  quantity: 0,
                  type: "g",
                },
              ],
            }
          : pizza,
      ),
    );
  const setPizzasPersisted: React.Dispatch<React.SetStateAction<Pizza[]>> = (
    updater,
  ) => {
    setPizzas((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      next.forEach((pizza) => {
        schedulePricingSave(pizza);
      });
      return next;
    });
  };
  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError("");
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setLoginError("E-mail ou senha inválidos.");
        return;
      }
    } else if (!email || !password) {
      setLoginError("Preencha e-mail e senha para entrar.");
      return;
    }
    setSession(true);
  };
  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(false);
  };
  if (!authReady)
    return <main className="login-page"><div className="login-card"><p>Restaurando sessão...</p></div></main>;
  if (!session)
    return (
      <main className="login-page">
        <div className="login-art">
          <div className="brand-mark">
            <span>DN</span>
          </div>
          <p className="eyebrow">GESTÃO INTERNA</p>
          <h1>
            O sabor começa
            <br />
            <em>na conta certa.</em>
          </h1>
          <p className="login-note">
            Custos claros para decisões mais gostosas.
          </p>
          <div className="login-stamp">
            EST. 2018 <span>•</span> RECIFE, PE
          </div>
        </div>
        <form className="login-card" onSubmit={login}>
          <div className="login-header">
            <div className="mini-logo">DN</div>
            <span>PAINEL ADMIN</span>
          </div>
          <h2>Bem-vindo de volta</h2>
          <p>Acesse a operação da Della Nonna.</p>
          <label>
            E-mail
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="admin@dellanonna.com"
            />
          </label>
          <label>
            Senha
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="••••••••"
            />
          </label>
          {loginError && <div className="error-message">{loginError}</div>}
          <button className="primary-button login-button">
            Entrar no painel <ArrowRight size={16} />
          </button>
          <small>Área restrita para administradores</small>
        </form>
      </main>
    );
  return (
    <div className={sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <aside className="sidebar">
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          <ChevronDown size={16} />
        </button>
        <div className="logo-lockup">
          <div className="brand-mark small">
            <span>DN</span>
          </div>
          <div>
            <strong>DELLA NONNA</strong>
            <span>PIZZARIA</span>
          </div>
        </div>
        <div className="sidebar-label">OPERAÇÃO</div>
        <nav>
          {(
            [
              ["insumos", "Insumos", Settings2],
              ["fichas", "Fichas técnicas", Utensils],
              ["precificacao", "Precificação", TrendingUp],
              ["cardapio", "Cardápio", Settings2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              className={activeSection === id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setActiveSection(id);
                if (typeof window !== "undefined") {
                  const path = id === "insumos" ? "/admin" : `/admin/${id}`;
                  window.history.pushState({}, "", path);
                }
              }}
            >
              <Icon size={17} />
              {label}
              {id === "precificacao" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sync-state">
            <span className="live-dot" />
            <div>
              <strong>
                {supabase ? "Dados sincronizados" : "Modo demonstração"}
              </strong>
              <small>
                {supabase
                  ? "Supabase conectado"
                  : "Configure o Supabase para persistir"}
              </small>
            </div>
          </div>
          <button className="user-row" onClick={logout}>
            <span className="avatar">AD</span>
            <span>
              <strong>Admin</strong>
              <small>Administrador</small>
            </span>
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      <main className="content">
        {databaseError && (
          <div className="database-error" role="alert">
            {databaseError} Aplique todas as migrations do Supabase e recarregue a página.
          </div>
        )}
        <header className="topbar">
          <div>
            <p className="breadcrumb">
              DASHBOARD <span>/</span>{" "}
              {activeSection === "insumos"
                ? "INSUMOS"
                : activeSection === "fichas"
                  ? "FICHAS TÉCNICAS"
                  : activeSection === "cardapio"
                    ? "CARDÁPIO"
                    : "PRECIFICAÇÃO"}
            </p>
            <h1>
              {activeSection === "insumos"
                ? "Insumos e embalagens"
                : activeSection === "fichas"
                  ? "Fichas técnicas"
                  : activeSection === "cardapio"
                    ? "Cardápio"
                    : "Precificação"}
            </h1>
          </div>
          <div className="top-actions">
            <div className="last-saved">
              {saved ? (
                <>
                  <Check size={14} /> Salvo agora
                </>
              ) : (
                "Última atualização hoje, 09:42"
              )}
            </div>
            <button className="icon-button" title="Ajuda">
              <CircleHelp size={18} />
            </button>
            <button className="user-pill" onClick={logout}>
              <span className="avatar">AD</span> Admin <ChevronDown size={14} />
            </button>
          </div>
        </header>
        {activeSection === "insumos" && (
          <IngredientsView
            ingredients={ingredients}
            conversion={conversion}
            updateIngredient={updateIngredient}
            setConversion={setConversion}
            addIngredient={addIngredient}
            addPackaging={addPackaging}
            deleteIngredient={deleteIngredient}
          />
        )}{" "}
        {activeSection === "fichas" && (
          <RecipesView
            pizzas={pizzas}
            ingredients={ingredients}
            ingredientCost={ingredientCost}
            doughCost={doughCost}
            doughRecipes={doughRecipes}
            boxCost={boxCost}
            totalCost={totalCost}
            addPizza={addPizza}
            savePizza={savePizza}
            deletePizza={deletePizza}
            duplicatePizza={duplicatePizza}
            addLine={addLine}
            setPizzas={setPizzas}
          />
        )}{" "}
        {activeSection === "precificacao" && (
          <PricingView
            pizzas={pizzas}
            totalCost={totalCost}
            updatePizza={updatePizza}
            setPizzas={setPizzasPersisted}
            gas={gas}
            setGas={setGas}
            gasCost={gasCost}
            gasIncluded={gasIncluded}
            setGasIncluded={setGasIncluded}
          />
        )}
        {activeSection === "cardapio" && (
          <MenuItemsView
            items={menuItems}
            pizzas={pizzas}
            totalCost={totalCost}
            saveItem={saveMenuItem}
            deleteItem={deleteMenuItem}
          />
        )}
      </main>
    </div>
  );
}

function IngredientsView({
  ingredients,
  conversion,
  updateIngredient,
  setConversion,
  addIngredient,
  addPackaging,
  deleteIngredient,
}: {
  ingredients: Ingredient[];
  conversion: { cebola: number; azeitona: number };
  updateIngredient: (id: number, key: keyof Ingredient, value: string) => void;
  setConversion: React.Dispatch<
    React.SetStateAction<{ cebola: number; azeitona: number }>
  >;
  addIngredient: (details: Omit<Ingredient, "id" | "dbId">) => Promise<void>;
  addPackaging: () => void;
  deleteIngredient: (ingredient: Ingredient) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isIngredientModalOpen, setIngredientModalOpen] = useState(false);
  const [ingredientDraft, setIngredientDraft] = useState({
    name: "",
    brand: "",
    pack: "1",
    unit: "g" as Ingredient["unit"],
    price: "0",
  });
  const filteredIngredients = ingredients.filter((item) => {
    if (item.category !== "insumo") return false;
    const query = searchTerm.trim().toLocaleLowerCase();
    return !query || `${item.name} ${item.brand}`.toLocaleLowerCase().includes(query);
  });
  const submitIngredient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ingredientDraft.name.trim()) return;
    await addIngredient({
      name: ingredientDraft.name.trim(),
      brand: ingredientDraft.brand.trim(),
      pack: parseNumber(ingredientDraft.pack),
      unit: ingredientDraft.unit,
      price: parseNumber(ingredientDraft.price),
      category: "insumo",
    });
    setIngredientDraft({ name: "", brand: "", pack: "1", unit: "g", price: "0" });
    setIngredientModalOpen(false);
  };
  return (
    <section className="page-section">
      <div className="section-intro">
        <div>
          <p className="eyebrow orange">BASE DE CUSTOS</p>
          <h2>O que entra na pizza</h2>
          <p className="section-description">
            Atualize os preços de compra. Todos os custos são recalculados
            automaticamente.
          </p>
        </div>
        <button className="primary-button" onClick={() => setIngredientModalOpen(true)}>
          <Plus size={16} /> Adicionar insumo
        </button>
      </div>
      <div className="table-card">
        <div className="table-toolbar">
          <div>
            <strong>Insumos cadastrados</strong>
            <span className="count-badge">
              {filteredIngredients.length} itens
            </span>
          </div>
          <label className="table-search">
            <Search size={14} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar insumo"
              aria-label="Pesquisar insumo"
            />
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Marca / observação</th>
                <th>Qtd. embalagem</th>
                <th>Unidade</th>
                <th>Preço pago</th>
                <th>Preço por unidade</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {filteredIngredients.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="ingredient-name">
                      <span
                        className={
                          item.category === "embalagem"
                            ? "ingredient-icon box"
                            : "ingredient-icon"
                        }
                      >
                        {item.category === "embalagem" ? "□" : "✦"}
                      </span>
                      <input
                        value={item.name}
                        onChange={(event) =>
                          updateIngredient(item.id, "name", event.target.value)
                        }
                      />
                    </div>
                  </td>
                  <td>
                    <input
                      className="muted-input"
                      value={item.brand}
                      onChange={(event) =>
                        updateIngredient(item.id, "brand", event.target.value)
                      }
                      placeholder="Adicionar observação"
                    />
                  </td>
                  <td>
                    <input
                      className="number-input"
                      type="number"
                      value={item.pack}
                      onChange={(event) =>
                        updateIngredient(item.id, "pack", event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={item.unit}
                      onChange={(event) =>
                        updateIngredient(item.id, "unit", event.target.value)
                      }
                    >
                      <option>g</option>
                      <option>ml</option>
                      <option>unid</option>
                    </select>
                  </td>
                  <td>
                    <div className="currency-input">
                      <span>R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.price}
                        onChange={(event) =>
                          updateIngredient(item.id, "price", event.target.value)
                        }
                      />
                    </div>
                  </td>
                  <td>
                    <strong className="unit-price">
                      {unitMoney(item.pack > 0 ? item.price / item.pack : 0)}
                    </strong>{" "}
                    <small>/{item.unit}</small>
                  </td>
                  <td>
                    <button
                      className="row-action"
                      title="Remover"
                      onClick={() => deleteIngredient(item)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {isIngredientModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIngredientModalOpen(false)}>
          <form className="ingredient-modal" onSubmit={submitIngredient} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow orange">NOVO CADASTRO</p>
                <h3>Adicionar insumo</h3>
              </div>
              <button className="modal-close" type="button" onClick={() => setIngredientModalOpen(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="ingredient-form-grid">
              <label className="form-field form-field-wide">
                Nome do insumo
                <input autoFocus required value={ingredientDraft.name} onChange={(event) => setIngredientDraft({ ...ingredientDraft, name: event.target.value })} placeholder="Ex.: Muçarela" />
              </label>
              <label className="form-field form-field-wide">
                Marca / observação
                <input value={ingredientDraft.brand} onChange={(event) => setIngredientDraft({ ...ingredientDraft, brand: event.target.value })} placeholder="Opcional" />
              </label>
              <label className="form-field">
                Qtd. da embalagem
                <input required min="0" type="number" value={ingredientDraft.pack} onChange={(event) => setIngredientDraft({ ...ingredientDraft, pack: event.target.value })} />
              </label>
              <label className="form-field">
                Unidade
                <select value={ingredientDraft.unit} onChange={(event) => setIngredientDraft({ ...ingredientDraft, unit: event.target.value as Ingredient["unit"] })}>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="unid">unid</option>
                </select>
              </label>
              <label className="form-field form-field-wide">
                Preço pago
                <div className="modal-price-input"><span>R$</span><input required min="0" step="0.01" type="number" value={ingredientDraft.price} onChange={(event) => setIngredientDraft({ ...ingredientDraft, price: event.target.value })} /></div>
              </label>
            </div>
            <div className="modal-actions">
              <button className="text-button" type="button" onClick={() => setIngredientModalOpen(false)}>Cancelar</button>
              <button className="primary-button" type="submit"><Plus size={16} /> Salvar insumo</button>
            </div>
          </form>
        </div>
      )}
      <PackagingTable
        ingredients={ingredients}
        updateIngredient={updateIngredient}
        addPackaging={addPackaging}
        deleteIngredient={deleteIngredient}
      />
      <div className="conversion-card">
        <div className="conversion-title">
          <div className="conversion-icon">≈</div>
          <div>
            <strong>Premissas de conversão</strong>
            <p>Use o peso médio para transformar unidades em gramas.</p>
          </div>
        </div>
        <div className="conversion-fields">
          <label>
            Cebola{" "}
            <div className="input-with-suffix">
              <input
                type="number"
                value={conversion.cebola}
                onChange={(event) =>
                  setConversion((value) => ({
                    ...value,
                    cebola: parseNumber(event.target.value),
                  }))
                }
              />
              <span>g / unid.</span>
            </div>
          </label>
          <label>
            Azeitona{" "}
            <div className="input-with-suffix">
              <input
                type="number"
                value={conversion.azeitona}
                onChange={(event) =>
                  setConversion((value) => ({
                    ...value,
                    azeitona: parseNumber(event.target.value),
                  }))
                }
              />
              <span>g / unid.</span>
            </div>
          </label>
        </div>
        <button className="text-button">
          <RotateCcw size={14} /> Restaurar padrão
        </button>
      </div>
    </section>
  );
}

function PackagingTable({
  ingredients,
  updateIngredient,
  addPackaging,
  deleteIngredient,
}: {
  ingredients: Ingredient[];
  updateIngredient: (id: number, key: keyof Ingredient, value: string) => void;
  addPackaging: () => void;
  deleteIngredient: (ingredient: Ingredient) => void;
}) {
  const packagings = ingredients.filter((item) => item.category === "embalagem");
  return (
    <div className="table-card packaging-card">
      <div className="table-toolbar">
        <div>
          <strong>Embalagens cadastradas</strong>
          <span className="count-badge">{packagings.length} itens</span>
        </div>
        <button className="text-button" onClick={addPackaging}>
          <Plus size={14} /> Adicionar embalagem
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Marca / obs.</th>
              <th>Qtd. do lote</th>
              <th>Unidade</th>
              <th>Preço pago</th>
              <th>Preço por unidade</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {packagings.map((item) => (
              <tr key={item.id}>
                <td><input value={item.name} onChange={(event) => updateIngredient(item.id, "name", event.target.value)} /></td>
                <td><input className="muted-input" value={item.brand} onChange={(event) => updateIngredient(item.id, "brand", event.target.value)} placeholder="Adicionar observação" /></td>
                <td><input className="number-input" type="number" value={item.pack} onChange={(event) => updateIngredient(item.id, "pack", event.target.value)} /></td>
                <td><select value={item.unit} onChange={(event) => updateIngredient(item.id, "unit", event.target.value)}><option>unid</option><option>g</option><option>ml</option></select></td>
                <td><div className="currency-input"><span>R$</span><input type="number" step="0.01" value={item.price} onChange={(event) => updateIngredient(item.id, "price", event.target.value)} /></div></td>
                <td><strong className="unit-price">{unitMoney(item.pack > 0 ? item.price / item.pack : 0)}</strong> <small>/{item.unit}</small></td>
                <td><button className="row-action" title="Remover" onClick={() => deleteIngredient(item)}><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecipesView({
  pizzas,
  ingredients,
  ingredientCost,
  doughCost,
  doughRecipes,
  boxCost,
  totalCost,
  addPizza,
  savePizza,
  deletePizza,
  duplicatePizza,
  addLine,
  setPizzas,
}: {
  pizzas: Pizza[];
  ingredients: Ingredient[];
  ingredientCost: (line: RecipeLine) => number;
  doughCost: number;
  doughRecipes: Pizza[];
  boxCost: number;
  totalCost: (pizza: Pizza) => number;
  addPizza: () => Pizza;
  savePizza: (pizza: Pizza) => Promise<void>;
  deletePizza: (pizza: Pizza) => void;
  duplicatePizza: (pizza: Pizza) => void;
  addLine: (pizzaId: number) => void;
  setPizzas: React.Dispatch<React.SetStateAction<Pizza[]>>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const startNewRecipe = () => {
    const pizza = addPizza();
    setEditingId(pizza.id);
  };
  const saveCurrentRecipe = async (pizza: Pizza) => {
    await savePizza(pizza);
    setEditingId(null);
  };
  const updateLine = (
    pizzaId: number,
    lineId: number,
    key: keyof RecipeLine,
    value: string,
  ) =>
    setPizzas((items) =>
      items.map((pizza) =>
        pizza.id === pizzaId
          ? {
              ...pizza,
              lines: pizza.lines.map((line) =>
                line.id === lineId
                  ? ({
                      ...line,
                      [key]: key === "quantity" ? parseNumber(value) : value,
                    } as RecipeLine)
                  : line,
              ),
            }
          : pizza,
      ),
    );
  const selectIngredient = (pizzaId: number, lineId: number, ingredientId: string) => {
    setPizzas((items) =>
      items.map((pizza) =>
        pizza.id === pizzaId
          ? {
              ...pizza,
              lines: pizza.lines.map((line) => {
                if (line.id !== lineId) return line;
                const ingredient = ingredients.find((item) => item.dbId === ingredientId || item.name === ingredientId);
                return ingredient
                  ? { ...line, ingredientId: ingredient.dbId, ingredient: ingredient.name }
                  : line;
              }),
            }
          : pizza,
      ),
    );
  };
  const recipeBatchCost = (recipe: Pizza) =>
    recipe.lines.reduce((total, line) => total + ingredientCost(line), 0);
  const recipeDoughCost = (recipe: Pizza) =>
    recipeBatchCost(recipe) / Math.max(recipe.massYield, 1);
  return (
    <section className="page-section">
      <div className="section-intro">
        <div>
          <p className="eyebrow orange">RECEITAS</p>
          <h2>Fichas técnicas</h2>
          <p className="section-description">
            Cada grama conta. Acompanhe o custo real de cada sabor em um só
            lugar.
          </p>
        </div>
        <button className="primary-button" onClick={startNewRecipe}>
          <Plus size={16} /> Nova receita
        </button>
      </div>
      <div className="recipe-grid">
        {pizzas.map((pizza) => {
          const isEditing = editingId === pizza.id;
          const selectedDough = doughRecipes.find(
            (recipe) => recipe.name === pizza.doughRecipe,
          );
          const pizzaDoughCost = selectedDough
            ? recipeDoughCost(selectedDough)
            : doughCost;
          return (
          <article className="recipe-card" key={pizza.id}>
            <div className="recipe-card-header">
              <div>
                <span className="recipe-kicker">
                  FICHA {String(pizza.id).padStart(2, "0")}
                </span>
                <h3>
                  <input
                    value={pizza.name}
                    disabled={!isEditing}
                    onChange={(event) =>
                      setPizzas((items) =>
                        items.map((item) =>
                          item.id === pizza.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </h3>
              </div>
              <button
                className="more-button"
                title="Duplicar receita"
                onClick={() => duplicatePizza(pizza)}
              >
                <Copy size={16} />
              </button>
              <button
                className="more-button"
                title="Remover sabor"
                onClick={() => deletePizza(pizza)}
              >
                <Trash2 size={16} />
              </button>
              {isEditing ? (
                <button
                  className="save-recipe-button"
                  title="Salvar receita"
                  onClick={() => saveCurrentRecipe(pizza)}
                >
                  <Save size={15} /> Salvar
                </button>
              ) : (
                <button
                  className="more-button"
                  title="Editar receita"
                  onClick={() => setEditingId(pizza.id)}
                >
                  <Pencil size={16} />
                </button>
              )}
            </div>
            <fieldset className="recipe-editor" disabled={!isEditing}>
            <div className="recipe-settings">
              <label>
                Categoria
                <select
                  value={pizza.category}
                  onChange={(event) =>
                    setPizzas((items) =>
                      items.map((item) =>
                        item.id === pizza.id
                          ? { ...item, category: event.target.value as Pizza["category"] }
                          : item,
                      ),
                    )
                  }
                >
                  <option value="pizza">Pizza</option>
                  <option value="massa">Massa</option>
                </select>
              </label>
              {pizza.category === "massa" ? (
                <>
                  <label>
                    Tamanho da massa
                    <select
                      value={pizza.doughSize}
                      onChange={(event) =>
                        setPizzas((items) =>
                          items.map((item) =>
                            item.id === pizza.id
                              ? { ...item, doughSize: event.target.value as Pizza["doughSize"] }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="broto">Broto / Individual · 25 cm · 4 fatias</option>
                      <option value="grande">Grande · 35 cm · 8 fatias</option>
                    </select>
                  </label>
                  <label>
                    Rendimento
                    <input
                      type="number"
                      min="1"
                      value={pizza.massYield}
                      onChange={(event) =>
                        setPizzas((items) =>
                          items.map((item) =>
                            item.id === pizza.id
                              ? { ...item, massYield: parseNumber(event.target.value) }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                </>
              ) : (
                <label>
                  Massa utilizada no custo
                  <select
                    value={pizza.doughRecipe}
                    onChange={(event) =>
                      setPizzas((items) =>
                        items.map((item) =>
                          item.id === pizza.id
                            ? { ...item, doughRecipe: event.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="">Massa padrão</option>
                    {doughRecipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.name}>{recipe.name} · {recipe.doughSize === "broto" ? "25 cm" : "35 cm"}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="recipe-lines">
              {pizza.lines.map((line) => (
                <div className="recipe-line" key={line.id}>
                  <select
                    value={line.ingredientId ?? findIngredientByName(ingredients, line.ingredient)?.dbId ?? ""}
                    onChange={(event) => selectIngredient(pizza.id, line.id, event.target.value)}
                  >
                    {ingredients
                      .filter((item) => item.category === "insumo")
                      .map((item) => (
                        <option key={item.id} value={item.dbId ?? item.name}>{item.name}</option>
                      ))}
                  </select>
                  <input
                    className="quantity"
                    type="number"
                    value={line.quantity}
                    onChange={(event) =>
                      updateLine(
                        pizza.id,
                        line.id,
                        "quantity",
                        event.target.value,
                      )
                    }
                  />
                  <select
                    className="type-select"
                    value={line.type}
                    onChange={(event) =>
                      updateLine(pizza.id, line.id, "type", event.target.value)
                    }
                  >
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="unidade_cebola">un cebola</option>
                    <option value="unidade_azeitona">un azeitona</option>
                  </select>
                  <span className="line-cost">
                    {money(ingredientCost(line))}
                  </span>
                  <button
                    className="remove-line"
                    onClick={() =>
                      setPizzas((items) =>
                        items.map((item) =>
                          item.id === pizza.id
                            ? {
                                ...item,
                                lines: item.lines.filter(
                                  (current) => current.id !== line.id,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <Minus size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button className="add-line" onClick={() => addLine(pizza.id)}>
              <Plus size={14} /> Adicionar ingrediente
            </button>
            <div className="cost-breakdown">
              {pizza.category === "massa" ? (
                <>
                  <div>
                    <span>Custo do lote de massa</span>
                    <strong>{money(recipeBatchCost(pizza))}</strong>
                  </div>
                  <div>
                    <span>Custo de massa por pizza (lote ÷ rendimento)</span>
                    <strong>{money(recipeDoughCost(pizza))}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span>Subtotal cobertura</span>
                    <strong>
                      {money(
                        pizza.lines.reduce(
                          (sum, line) => sum + ingredientCost(line),
                          0,
                        ),
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>
                      Massa rateada <CircleHelp size={12} />
                    </span>
                    <strong>{money(pizzaDoughCost)}</strong>
                  </div>
                  <div>
                    <span>Embalagem</span>
                    <strong>{money(boxCost)}</strong>
                  </div>
                </>
              )}
            </div>
            {pizza.category === "pizza" && (
              <div className="total-row">
                <span>Custo total da pizza</span>
                <strong>{money(totalCost(pizza))}</strong>
              </div>
            )}
            </fieldset>
          </article>
          );
        })}
      </div>
    </section>
  );
}

function MenuItemsView({
  items,
  pizzas,
  totalCost,
  saveItem,
  deleteItem,
}: {
  items: MenuItem[];
  pizzas: Pizza[];
  totalCost: (pizza: Pizza) => number;
  saveItem: (item: MenuItem) => Promise<void>;
  deleteItem: (item: MenuItem) => Promise<void>;
}) {
  const [categoryFilter, setCategoryFilter] = useState<"Todos" | MenuCategory>("Todos");
  const [statusFilter, setStatusFilter] = useState<"Todos" | "Disponível" | "Indisponível">("Todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState({
    id: Date.now(),
    dbId: undefined as string | undefined,
    nome_comercial: "",
    ficha_tecnica_ref: "",
    descricao: "",
    categoria: "Pizza" as MenuCategory,
    tamanho: "",
    imagem_url: "",
    preco_venda: "0",
    disponivel: true,
    destaque: false,
    ordem_exibicao: "1",
    observacoes_internas: "",
  });

  const selectedRecipe = pizzas.find((pizza) => pizza.name === draft.ficha_tecnica_ref);
  const previewCost = selectedRecipe ? totalCost(selectedRecipe) : 0;
  const previewPrice = Number(draft.preco_venda || selectedRecipe?.salePrice || 0);
  const previewMargin = previewPrice - previewCost;
  const previewPercent = previewPrice > 0 ? previewMargin / previewPrice : 0;

  const filteredItems = [...items]
    .sort((left, right) => (left.ordem_exibicao ?? 0) - (right.ordem_exibicao ?? 0))
    .filter((item) => {
      const categoryMatches = categoryFilter === "Todos" || item.categoria === categoryFilter;
      const statusMatches =
        statusFilter === "Todos" ||
        (statusFilter === "Disponível" && item.disponivel) ||
        (statusFilter === "Indisponível" && !item.disponivel);
      const term = searchTerm.trim().toLocaleLowerCase();
      const textMatches =
        !term ||
        `${item.nome_comercial} ${item.descricao} ${item.ficha_tecnica_ref}`
          .toLocaleLowerCase()
          .includes(term);
      return categoryMatches && statusMatches && textMatches;
    });

  const openNewItem = () => {
    setDraft({
      id: Date.now(),
      dbId: undefined,
      nome_comercial: "",
      ficha_tecnica_ref: "",
      descricao: "",
      categoria: "Pizza",
      tamanho: "",
      imagem_url: "",
      preco_venda: "0",
      disponivel: true,
      destaque: false,
      ordem_exibicao: String(items.length + 1),
      observacoes_internas: "",
    });
    setModalOpen(true);
  };

  const openEditItem = (item: MenuItem) => {
    setDraft({
      id: item.id,
      dbId: item.dbId,
      nome_comercial: item.nome_comercial,
      ficha_tecnica_ref: item.ficha_tecnica_ref,
      descricao: item.descricao,
      categoria: item.categoria,
      tamanho: item.tamanho,
      imagem_url: item.imagem_url,
      preco_venda: String(item.preco_venda ?? 0),
      disponivel: item.disponivel,
      destaque: item.destaque,
      ordem_exibicao: String(item.ordem_exibicao || 1),
      observacoes_internas: item.observacoes_internas,
    });
    setModalOpen(true);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !supabase) {
      if (file) {
        setDraft((current) => ({ ...current, imagem_url: URL.createObjectURL(file) }));
      }
      return;
    }
    const fileName = `cardapio/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const { error } = await supabase.storage.from("cardapio").upload(fileName, file, { upsert: true });
    if (error) {
      console.error("Falha ao enviar imagem do cardápio:", error);
      setDraft((current) => ({ ...current, imagem_url: URL.createObjectURL(file) }));
      return;
    }
    const { data } = supabase.storage.from("cardapio").getPublicUrl(fileName);
    setDraft((current) => ({ ...current, imagem_url: data.publicUrl }));
  };

  const submitItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nomeComercial = draft.nome_comercial.trim();
    const fichaRef = draft.ficha_tecnica_ref.trim();
    if (!nomeComercial || !fichaRef) return;
    const nextItem: MenuItem = {
      id: draft.id,
      dbId: draft.dbId,
      nome_comercial: nomeComercial,
      ficha_tecnica_ref: fichaRef,
      descricao: draft.descricao.trim(),
      categoria: draft.categoria,
      tamanho: draft.tamanho.trim(),
      imagem_url: draft.imagem_url,
      preco_venda: Number(draft.preco_venda || 0),
      disponivel: draft.disponivel,
      destaque: draft.destaque,
      ordem_exibicao: Number(draft.ordem_exibicao || 1),
      observacoes_internas: draft.observacoes_internas.trim(),
    };
    await saveItem(nextItem);
    setModalOpen(false);
    setDraft({
      id: Date.now(),
      dbId: undefined,
      nome_comercial: "",
      ficha_tecnica_ref: "",
      descricao: "",
      categoria: "Pizza",
      tamanho: "",
      imagem_url: "",
      preco_venda: "0",
      disponivel: true,
      destaque: false,
      ordem_exibicao: String(items.length + 1),
      observacoes_internas: "",
    });
  };

  const reorderItem = async (item: MenuItem, direction: -1 | 1) => {
    const ordered = [...items].sort((left, right) => (left.ordem_exibicao ?? 0) - (right.ordem_exibicao ?? 0));
    const index = ordered.findIndex((current) => current.id === item.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    const target = ordered[targetIndex];
    const nextItem = { ...item, ordem_exibicao: target.ordem_exibicao };
    const nextTarget = { ...target, ordem_exibicao: item.ordem_exibicao };
    await saveItem(nextItem);
    await saveItem(nextTarget);
  };

  return (
    <section className="page-section">
      <div className="section-intro">
        <div>
          <p className="eyebrow orange">COMERCIAL</p>
          <h2>Cardápio</h2>
          <p className="section-description">
            Transforme cada ficha em item do cardápio com preço, foto e status de disponibilidade.
          </p>
        </div>
        <button className="primary-button" onClick={openNewItem}>
          <Plus size={16} /> Novo item
        </button>
      </div>
      <div className="table-card menu-table-card">
        <div className="table-toolbar menu-toolbar">
          <div>
            <strong>Itens do cardápio</strong>
            <span className="count-badge">{filteredItems.length} itens</span>
          </div>
          <div className="menu-filters">
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "Todos" | MenuCategory)}>
              <option value="Todos">Todas as categorias</option>
              {menuCategoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "Todos" | "Disponível" | "Indisponível")}>
              <option value="Todos">Todos os status</option>
              <option value="Disponível">Disponível</option>
              <option value="Indisponível">Indisponível</option>
            </select>
            <label className="table-search compact-search">
              <Search size={14} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar item"
              />
            </label>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Categoria</th>
                <th>Preço</th>
                <th>Status</th>
                <th>Margem</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const summary = getMenuMarginSummary(item, pizzas, totalCost);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="menu-item-cell">
                        {item.imagem_url ? (
                          <img src={item.imagem_url} alt={item.nome_comercial} className="menu-thumb" />
                        ) : (
                          <div className="menu-thumb placeholder-thumb">DN</div>
                        )}
                        <div>
                          <strong>{item.nome_comercial}</strong>
                          <small>{item.ficha_tecnica_ref}</small>
                        </div>
                      </div>
                    </td>
                    <td>{item.categoria}</td>
                    <td>{money(item.preco_venda)}</td>
                    <td>
                      <span className={`menu-status ${item.disponivel ? "online" : "offline"}`}>
                        {item.disponivel ? "Disponível" : "Indisponível"}
                      </span>
                    </td>
                    <td>
                      <span className={`margin-pill ${summary.tone}`}>
                        {(summary.percentage * 100).toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </td>
                    <td>
                      <div className="row-actions compact-actions">
                        <button className="row-action" title="Mover para cima" onClick={() => reorderItem(item, -1)}>
                          <ChevronDown size={14} style={{ transform: "rotate(180deg)" }} />
                        </button>
                        <button className="row-action" title="Mover para baixo" onClick={() => reorderItem(item, 1)}>
                          <ChevronDown size={14} />
                        </button>
                        <button className="row-action" title="Editar" onClick={() => openEditItem(item)}>
                          <Pencil size={14} />
                        </button>
                        <button className="row-action" title="Excluir" onClick={() => void deleteItem(item)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <form className="ingredient-modal menu-modal" onSubmit={submitItem} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow orange">ITEM DO CARDÁPIO</p>
                <h3>{draft.dbId ? "Editar item" : "Novo item"}</h3>
              </div>
              <button className="modal-close" type="button" onClick={() => setModalOpen(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="menu-form-grid">
              <label className="form-field form-field-wide">
                Nome comercial
                <input
                  required
                  value={draft.nome_comercial}
                  onChange={(event) => setDraft((current) => ({ ...current, nome_comercial: event.target.value }))}
                  placeholder="Ex.: Pizza Calabresa Especial"
                />
              </label>
              <label className="form-field">
                Ficha técnica vinculada
                <select
                  required
                  value={draft.ficha_tecnica_ref}
                  onChange={(event) => setDraft((current) => ({ ...current, ficha_tecnica_ref: event.target.value }))}
                >
                  <option value="">Selecione uma ficha</option>
                  {pizzas.map((pizza) => (
                    <option key={pizza.id} value={pizza.name}>{pizza.name}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                Categoria
                <select value={draft.categoria} onChange={(event) => setDraft((current) => ({ ...current, categoria: event.target.value as MenuCategory }))}>
                  {menuCategoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                Tamanho
                <input value={draft.tamanho} onChange={(event) => setDraft((current) => ({ ...current, tamanho: event.target.value }))} placeholder="Ex.: 35 cm" />
              </label>
              <label className="form-field">
                Preço de venda
                <div className="modal-price-input">
                  <span>R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.preco_venda}
                    onChange={(event) => setDraft((current) => ({ ...current, preco_venda: event.target.value }))}
                  />
                </div>
              </label>
              <label className="form-field">
                Ordem de exibição
                <input type="number" min="1" value={draft.ordem_exibicao} onChange={(event) => setDraft((current) => ({ ...current, ordem_exibicao: event.target.value }))} />
              </label>
              <label className="form-field form-field-wide">
                Descrição
                <textarea value={draft.descricao} onChange={(event) => setDraft((current) => ({ ...current, descricao: event.target.value }))} rows={4} placeholder="Descreva o produto para o cliente" />
              </label>
              <label className="form-field form-field-wide">
                Observações internas
                <textarea value={draft.observacoes_internas} onChange={(event) => setDraft((current) => ({ ...current, observacoes_internas: event.target.value }))} rows={3} placeholder="Opcional" />
              </label>
              <div className="menu-image-panel form-field-wide">
                <div className="menu-image-box">
                  {draft.imagem_url ? (
                    <img src={draft.imagem_url} alt="Pré-visualização do item" />
                  ) : (
                    <div className="placeholder-thumb large">DN</div>
                  )}
                </div>
                <div className="menu-image-actions">
                  <label className="primary-button upload-button">
                    <Plus size={14} /> Upload de imagem
                    <input type="file" accept="image/*" onChange={handleImageUpload} />
                  </label>
                  <span className="helper-copy">ou cole a URL em um campo futuro.</span>
                </div>
              </div>
              <div className="menu-preview panel-block form-field-wide">
                <strong>Preview da ficha vinculada</strong>
                {selectedRecipe ? (
                  <>
                    <div className="preview-row">
                      <span>Custo estimado</span>
                      <strong>{money(previewCost)}</strong>
                    </div>
                    <div className="preview-row">
                      <span>Preço sugerido</span>
                      <strong>{money(selectedRecipe.salePrice)}</strong>
                    </div>
                    <div className="preview-row">
                      <span>Margem atual</span>
                      <strong>{money(previewMargin)}</strong>
                    </div>
                    <div className="preview-row">
                      <span>Margem %</span>
                      <span className={`margin-pill ${getMarginTone(previewPercent)}`}>
                        {(previewPercent * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                      </span>
                    </div>
                  </>
                ) : (
                  <p>Selecione uma ficha para visualizar custo e margem.</p>
                )}
              </div>
              <div className="menu-toggle-row form-field-wide">
                <label className="toggle-label compact-toggle">
                  <input type="checkbox" checked={draft.disponivel} onChange={(event) => setDraft((current) => ({ ...current, disponivel: event.target.checked }))} />
                  <span className="toggle" /> Disponível no cardápio
                </label>
                <label className="toggle-label compact-toggle">
                  <input type="checkbox" checked={draft.destaque} onChange={(event) => setDraft((current) => ({ ...current, destaque: event.target.checked }))} />
                  <span className="toggle" /> Destaque
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="text-button" type="button" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="primary-button" type="submit">
                <Save size={16} /> Salvar item
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function PricingView({
  pizzas,
  totalCost,
  updatePizza,
  setPizzas,
  gas,
  setGas,
  gasCost,
  gasIncluded,
  setGasIncluded,
}: {
  pizzas: Pizza[];
  totalCost: (pizza: Pizza) => number;
  updatePizza: (id: number, key: "salePrice" | "name", value: string) => void;
  setPizzas: React.Dispatch<React.SetStateAction<Pizza[]>>;
  gas: Gas;
  setGas: React.Dispatch<React.SetStateAction<Gas>>;
  gasCost: number;
  gasIncluded: boolean;
  setGasIncluded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const pizzaRecipes = pizzas.filter((pizza) => pizza.category === "pizza");
  return (
    <section className="page-section">
      <div className="section-intro">
        <div>
          <p className="eyebrow orange">ESTRATÉGIA COMERCIAL</p>
          <h2>Precificação</h2>
          <p className="section-description">
            Veja onde sua margem está saudável e como você se posiciona na
            região.
          </p>
        </div>
        <div className="legend">
          <span>
            <i className="green" /> Margem saudável
          </span>
          <span>
            <i className="yellow" /> Atenção
          </span>
          <span>
            <i className="red" /> Revisar preço
          </span>
        </div>
      </div>
      <div className="table-card pricing-card">
        <div className="table-toolbar">
          <div>
            <strong>Margem por sabor</strong>
            <span className="count-badge">{pizzaRecipes.length} sabores</span>
          </div>
          <span className="autosave">
            <Save size={14} /> Atualização automática
          </span>
        </div>
        <div className="table-scroll">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Sabor</th>
                <th>Custo total</th>
                <th>Preço de venda</th>
                <th>Margem R$</th>
                <th>Margem %</th>
                <th>Massa Arretada</th>
                <th>Dantas</th>
                <th>Farini</th>
              </tr>
            </thead>
            <tbody>
              {pizzaRecipes.map((pizza) => {
                const cost = totalCost(pizza);
                const margin = pizza.salePrice - cost;
                const percentage =
                  pizza.salePrice > 0 ? margin / pizza.salePrice : 0;
                const color =
                  percentage > 0.55
                    ? "good"
                    : percentage >= 0.45
                      ? "warn"
                      : "bad";
                return (
                  <tr key={pizza.id}>
                    <td>
                      <strong>{pizza.name}</strong>
                    </td>
                    <td>{money(cost)}</td>
                    <td>
                      <div className="currency-input sale">
                        <span>R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={pizza.salePrice}
                          onChange={(event) =>
                            updatePizza(
                              pizza.id,
                              "salePrice",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                    </td>
                    <td>
                      <strong>{money(margin)}</strong>
                    </td>
                    <td>
                      <span className={`margin-pill ${color}`}>
                        {(percentage * 100).toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </td>
                    {pizza.competitors.map((price, index) => (
                      <td key={index}>
                        <input
                          className="competitor-input"
                          placeholder="sem dado"
                          value={price ?? ""}
                          onChange={(event) =>
                            setPizzas((items) =>
                              items.map((item) =>
                                item.id === pizza.id
                                  ? {
                                      ...item,
                                      competitors: item.competitors.map(
                                        (current, currentIndex) =>
                                          currentIndex === index
                                            ? event.target.value
                                              ? parseNumber(event.target.value)
                                              : null
                                            : current,
                                      ) as Pizza["competitors"],
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="gas-card">
        <div className="gas-heading">
          <div className="gas-icon">
            <Flame size={21} />
          </div>
          <div>
            <span className="recipe-kicker">ESTIMATIVA OPERACIONAL</span>
            <h3>Custo de gás</h3>
            <p>
              Este valor é uma referência e não entra no custo total por padrão.
            </p>
          </div>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={gasIncluded}
              onChange={(event) => setGasIncluded(event.target.checked)}
            />
            <span className="toggle" /> Incluir no custo da pizza
          </label>
        </div>
        <div className="gas-grid">
          {(
            [
              ["Preço do botijão", "price", "R$"],
              ["Peso do botijão", "weight", "kg"],
              ["Consumo por hora", "consumption", "kg/h"],
              ["Tempo de turno", "minutes", "min"],
              ["Pizzas por turno", "pizzas", "pizzas"],
            ] as const
          ).map(([label, key, suffix]) => (
            <label key={key}>
              {label}
              <div className="input-with-suffix">
                <input
                  type="number"
                  step="0.1"
                  value={gas[key]}
                  onChange={(event) =>
                    setGas((value) => ({
                      ...value,
                      [key]: parseNumber(event.target.value),
                    }))
                  }
                />
                <span>{suffix}</span>
              </div>
            </label>
          ))}
          <div className="gas-result">
            <span>Custo estimado por pizza</span>
            <strong>{money(gasCost)}</strong>
            <small>
              {gasIncluded
                ? "Incluído nos custos acima"
                : "Não incluído no custo total"}
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}

export default App;
