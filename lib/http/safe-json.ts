export async function lerJsonSeguro<T>(
  response: Response,
): Promise<T> {
  const texto =
    await response.text();

  if (!texto.trim()) {
    throw new Error(
      `A API retornou uma resposta vazia (status ${response.status}).`,
    );
  }

  try {
    return JSON.parse(
      texto,
    ) as T;
  } catch {
    throw new Error(
      `A API retornou uma resposta inválida (status ${response.status}).`,
    );
  }
}
