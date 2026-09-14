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
    "insumos" | "fichas" | "precificacao"
  >("insumos");
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
  const [gas, setGas] = useState<Gas>({
    price: 115,
    weight: 13,
    consumption: 0.7,
    minutes: 180,
    pizzas: 60,
  });
  const [gasIncluded, setGasIncluded] = useState(false);
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
    if (!supabase || !session) return;
    setHydrated(false);
    let mounted = true;
    const hydrate = async () => {
      const [ingredientsResponse, assumptionsResponse, recipesResponse, pricingResponse, doughResponse, gasResponse] = await Promise.all([
        supabase.from("insumos").select("*").order("created_at"),
        supabase.from("premissas_conversao").select("*"),
        supabase.from("fichas_tecnicas").select("*").order("ordem"),
        supabase.from("precificacao").select("*").order("pizza_nome"),
        supabase.from("receita_massa").select("*").order("ingrediente_nome"),
        supabase.from("gas").select("*").eq("id", true).maybeSingle(),
      ]);
      if (!mounted) return;
      const failedResponse = [ingredientsResponse, assumptionsResponse, recipesResponse, pricingResponse, doughResponse, gasResponse].find((response) => response.error);
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
  const addIngredient = async () => {
    const item = {
      id: Date.now(),
      name: "Novo insumo",
      brand: "",
      pack: 1,
      unit: "g" as const,
      price: 0,
      category: "insumo" as const,
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
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              className={activeSection === id ? "nav-item active" : "nav-item"}
              onClick={() => setActiveSection(id)}
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
                  : "PRECIFICAÇÃO"}
            </p>
            <h1>
              {activeSection === "insumos"
                ? "Insumos e embalagens"
                : activeSection === "fichas"
                  ? "Fichas técnicas"
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
  addIngredient: () => void;
  addPackaging: () => void;
  deleteIngredient: (ingredient: Ingredient) => void;
}) {
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
        <button className="primary-button" onClick={addIngredient}>
          <Plus size={16} /> Adicionar insumo
        </button>
      </div>
      <div className="table-card">
        <div className="table-toolbar">
          <div>
            <strong>Insumos cadastrados</strong>
            <span className="count-badge">
              {ingredients.filter((item) => item.category === "insumo").length} itens
            </span>
          </div>
          <span className="autosave">
            <span className="live-dot" /> Salvamento automático
          </span>
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
              {ingredients
                .filter((item) => item.category === "insumo")
                .map((item) => (
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
