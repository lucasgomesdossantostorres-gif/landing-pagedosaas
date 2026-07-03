import { createClient } from "@supabase/supabase-js";

const SOURCE_TABLE = "tabela_final_consolidada";
const TARGET_TABLE = "questions";

const SOURCE_PAGE_SIZE = 500;
const TARGET_BATCH_SIZE = 200;

const DEFAULT_MAXIMUM_SCORE = 10;
const DEFAULT_STATUS = "draft";

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(
      `A variável ${name} não está configurada no .env.local.`,
    );
  }

  return value.trim();
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized === "" ? null : normalized;
}

function normalizeYear(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const year = Number(value);

  return Number.isInteger(year) ? year : null;
}

function buildTitle(row) {
  const examName =
    normalizeText(row.titulo_arquivo_prova) ??
    "Prova discursiva";

  return `${examName} — Questão ${row.id}`;
}

function mapRow(row) {
  return {
    external_id: `scraping:${row.id}`,

    title: buildTitle(row),

    statement: normalizeText(
      row.questao_limpa,
    ),

    reference_answer: normalizeText(
      row.gabarito_limpo,
    ),

    examining_board: normalizeText(
      row.orgao,
    ),

    exam_name: normalizeText(
      row.titulo_arquivo_prova,
    ),

    exam_year: normalizeYear(
      row.ano,
    ),

    subject: null,
    topic: null,

    maximum_score: DEFAULT_MAXIMUM_SCORE,

    status: DEFAULT_STATUS,
  };
}

function validateRow(row) {
  const errors = [];

  if (!row.external_id) {
    errors.push("external_id ausente");
  }

  if (!row.title) {
    errors.push("title ausente");
  }

  if (!row.statement) {
    errors.push("statement ausente");
  }

  if (!row.reference_answer) {
    errors.push("reference_answer ausente");
  }

  if (!row.examining_board) {
    errors.push("examining_board ausente");
  }

  if (!row.exam_name) {
    errors.push("exam_name ausente");
  }

  if (!row.exam_year) {
    errors.push("exam_year ausente");
  }

  return errors;
}

async function readAllRows(sourceClient) {
  const allRows = [];

  let from = 0;

  while (true) {
    const to =
      from + SOURCE_PAGE_SIZE - 1;

    const { data, error } =
      await sourceClient
        .from(SOURCE_TABLE)
        .select(
          `
          id,
          orgao,
          ano,
          titulo_arquivo_prova,
          questao_limpa,
          gabarito_limpo
          `,
        )
        .order("id", {
          ascending: true,
        })
        .range(from, to);

    if (error) {
      throw new Error(
        `Erro ao ler a tabela ${SOURCE_TABLE}: ${error.message}`,
      );
    }

    const page = data ?? [];

    allRows.push(...page);

    console.log(
      `Leitura: ${allRows.length} registro(s) carregado(s).`,
    );

    if (
      page.length <
      SOURCE_PAGE_SIZE
    ) {
      break;
    }

    from += SOURCE_PAGE_SIZE;
  }

  return allRows;
}

async function upsertRows(
  targetClient,
  rows,
) {
  let processed = 0;

  for (
    let index = 0;
    index < rows.length;
    index += TARGET_BATCH_SIZE
  ) {
    const batch = rows.slice(
      index,
      index + TARGET_BATCH_SIZE,
    );

    const { error } =
      await targetClient
        .from(TARGET_TABLE)
        .upsert(batch, {
          onConflict: "external_id",
          ignoreDuplicates: false,
        });

    if (error) {
      throw new Error(
        `Erro ao gravar o lote iniciado no registro ${
          index + 1
        }: ${error.message}`,
      );
    }

    processed += batch.length;

    console.log(
      `Gravação: ${processed}/${rows.length} questão(ões).`,
    );
  }
}

async function main() {
  const sourceUrl = getRequiredEnv(
    "SCRAPING_SUPABASE_URL",
  );

  const sourceKey = getRequiredEnv(
    "SCRAPING_SUPABASE_SERVICE_ROLE_KEY",
  );

  const targetUrl = getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
  );

  const targetKey = getRequiredEnv(
    "SUPABASE_SECRET_KEY",
  );

  const dryRun =
    String(
      process.env.QUESTIONS_SYNC_DRY_RUN,
    )
      .trim()
      .toLowerCase() === "true";

  const sourceClient = createClient(
    sourceUrl,
    sourceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const targetClient = createClient(
    targetUrl,
    targetKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  console.log("");
  console.log(
    "Sincronização de questões",
  );
  console.log(
    `Origem: ${SOURCE_TABLE}`,
  );
  console.log(
    `Destino: ${TARGET_TABLE}`,
  );
  console.log(
    `Modo de teste: ${
      dryRun ? "SIM" : "NÃO"
    }`,
  );
  console.log("");

  const sourceRows =
    await readAllRows(sourceClient);

  const validRows = [];
  const invalidRows = [];

  for (const sourceRow of sourceRows) {
    const mappedRow =
      mapRow(sourceRow);

    const errors =
      validateRow(mappedRow);

    if (errors.length > 0) {
      invalidRows.push({
        source_id: sourceRow.id,
        errors: errors.join("; "),
      });
    } else {
      validRows.push(mappedRow);
    }
  }

  console.log("");
  console.log(
    `Total lido: ${sourceRows.length}`,
  );
  console.log(
    `Válidos: ${validRows.length}`,
  );
  console.log(
    `Ignorados: ${invalidRows.length}`,
  );

  if (invalidRows.length > 0) {
    console.log("");
    console.log(
      "Primeiros registros ignorados:",
    );

    console.table(
      invalidRows.slice(0, 20),
    );
  }

  if (dryRun) {
    console.log("");
    console.log(
      "Modo de teste concluído.",
    );
    console.log(
      "Nenhum dado foi gravado no projeto do aplicativo.",
    );
    console.log("");
    console.log(
      "Primeiro registro convertido:",
    );

    console.dir(
      validRows[0] ?? null,
      {
        depth: null,
      },
    );

    return;
  }

  if (validRows.length === 0) {
    throw new Error(
      "Nenhuma questão válida foi encontrada.",
    );
  }

  await upsertRows(
    targetClient,
    validRows,
  );

  console.log("");
  console.log(
    "Sincronização concluída com sucesso.",
  );
  console.log(
    `${validRows.length} questão(ões) inserida(s) ou atualizada(s).`,
  );
  console.log(
    `Status aplicado: ${DEFAULT_STATUS}.`,
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "FALHA NA SINCRONIZAÇÃO",
  );

  console.error(
    error instanceof Error
      ? error.message
      : String(error),
  );

  process.exitCode = 1;
});