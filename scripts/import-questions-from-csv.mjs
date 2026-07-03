import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const projectRoot = path.resolve(currentDirectory, "..");

const csvPath = path.join(
  projectRoot,
  "data",
  "tabela_final_consolidada.csv",
);

const batchSize = 200;

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `A variável ${name} não está configurada no .env.local.`,
    );
  }

  return value;
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  return text === "" ? null : text;
}

function cleanYear(value) {
  const year = Number(String(value ?? "").trim());

  return Number.isInteger(year) ? year : null;
}

function detectDelimiter(content) {
  const firstLine = content.split(/\r?\n/)[0] ?? "";

  const commaCount = firstLine.split(",").length - 1;
  const semicolonCount = firstLine.split(";").length - 1;
  const tabCount = firstLine.split("\t").length - 1;

  if (
    semicolonCount >= commaCount &&
    semicolonCount >= tabCount
  ) {
    return ";";
  }

  if (
    tabCount >= commaCount &&
    tabCount >= semicolonCount
  ) {
    return "\t";
  }

  return ",";
}

function mapQuestion(row) {
  const sourceId = cleanText(row.id);

  const examName =
    cleanText(row.titulo_arquivo_prova) ??
    "Prova discursiva";

  return {
    external_id: sourceId
      ? `scraping:${sourceId}`
      : null,

    title: `${examName} — Questão ${sourceId ?? "sem ID"}`,

    statement: cleanText(row.questao_limpa),

    reference_answer: cleanText(
      row.gabarito_limpo,
    ),

    examining_board: cleanText(row.orgao),

    exam_name: examName,

    exam_year: cleanYear(row.ano),

    subject: null,

    topic: null,

    maximum_score: 10,

    status: "draft",
  };
}

function validateQuestion(question) {
  const errors = [];

  if (!question.external_id) {
    errors.push("ID ausente");
  }

  if (!question.statement) {
    errors.push("enunciado ausente");
  }

  if (!question.reference_answer) {
    errors.push("gabarito ausente");
  }

  if (!question.examining_board) {
    errors.push("órgão ausente");
  }

  if (!question.exam_name) {
    errors.push("nome da prova ausente");
  }

  if (!question.exam_year) {
    errors.push("ano ausente ou inválido");
  }

  return errors;
}

function readCsv() {
  if (!fs.existsSync(csvPath)) {
    throw new Error(
      `O arquivo CSV não foi encontrado em: ${csvPath}`,
    );
  }

  const content = fs.readFileSync(csvPath, "utf8");

  const delimiter = detectDelimiter(content);

  console.log(
    `Separador detectado: ${
      delimiter === "\t" ? "TAB" : delimiter
    }`,
  );

  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
    delimiter,
    relax_quotes: true,
    relax_column_count: true,
  });

  return rows;
}

async function saveBatches(supabase, questions) {
  for (
    let index = 0;
    index < questions.length;
    index += batchSize
  ) {
    const batch = questions.slice(
      index,
      index + batchSize,
    );

    const { error } = await supabase
      .from("questions")
      .upsert(batch, {
        onConflict: "external_id",
        ignoreDuplicates: false,
      });

    if (error) {
      throw new Error(
        `Erro no lote iniciado no registro ${
          index + 1
        }: ${error.message}`,
      );
    }

    console.log(
      `Gravados: ${Math.min(
        index + batch.length,
        questions.length,
      )}/${questions.length}`,
    );
  }
}

async function main() {
  const dryRun =
    process.env.QUESTIONS_IMPORT_DRY_RUN ===
    "true";

  console.log("");
  console.log("IMPORTAÇÃO DE QUESTÕES");
  console.log(`Arquivo: ${csvPath}`);
  console.log(
    `Modo de teste: ${dryRun ? "SIM" : "NÃO"}`,
  );
  console.log("");

  const csvRows = readCsv();

  const validQuestions = [];
  const invalidQuestions = [];

  for (const row of csvRows) {
    const question = mapQuestion(row);
    const errors = validateQuestion(question);

    if (errors.length > 0) {
      invalidQuestions.push({
        id: row.id ?? "sem ID",
        errors: errors.join("; "),
      });
    } else {
      validQuestions.push(question);
    }
  }

  console.log("");
  console.log(
    `Total no CSV: ${csvRows.length}`,
  );
  console.log(
    `Questões válidas: ${validQuestions.length}`,
  );
  console.log(
    `Questões ignoradas: ${invalidQuestions.length}`,
  );

  if (invalidQuestions.length > 0) {
    console.log("");
    console.log(
      "Primeiros registros ignorados:",
    );

    console.table(
      invalidQuestions.slice(0, 20),
    );
  }

  console.log("");
  console.log(
    "Primeira questão convertida:",
  );

  console.dir(validQuestions[0] ?? null, {
    depth: null,
  });

  if (dryRun) {
    console.log("");
    console.log(
      "TESTE CONCLUÍDO.",
    );
    console.log(
      "Nenhum dado foi gravado no Supabase.",
    );
    return;
  }

  const supabaseUrl = requiredEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
  );

  const supabaseSecretKey = requiredEnv(
    "SUPABASE_SECRET_KEY",
  );

  const supabase = createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  await saveBatches(
    supabase,
    validQuestions,
  );

  console.log("");
  console.log(
    "IMPORTAÇÃO CONCLUÍDA COM SUCESSO.",
  );

  console.log(
    `${validQuestions.length} questão(ões) inserida(s) ou atualizada(s).`,
  );
}

main().catch((error) => {
  console.error("");
  console.error("FALHA NA IMPORTAÇÃO");

  console.error(
    error instanceof Error
      ? error.message
      : String(error),
  );

  process.exitCode = 1;
});