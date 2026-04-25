import api from "@/lib/api";
import type {
  Fatura,
  FaturaListResponse,
  FaturaStatus,
  PayFaturaDto,
  UpdateFaturaCategoryDto,
} from "@/types/api";

export interface PayFaturaResponse {
  faturaId: string;
  transactionId: string;
  amountCents: number;
  bankAccountId: string;
  paidAt: string;
}

export async function listFaturas(
  walletId: string,
  cardId: string,
  status?: FaturaStatus
): Promise<Fatura[]> {
  const params = status ? { status } : undefined;
  const response = await api.get<FaturaListResponse>(
    `/wallets/${walletId}/cards/${cardId}/faturas`,
    { params }
  );
  return response.data.faturas;
}

export async function getFatura(
  walletId: string,
  cardId: string,
  faturaId: string
): Promise<Fatura> {
  const response = await api.get<Fatura>(
    `/wallets/${walletId}/cards/${cardId}/faturas/${faturaId}`
  );
  return response.data;
}

export async function payFatura(
  walletId: string,
  cardId: string,
  faturaId: string,
  dto: PayFaturaDto
): Promise<PayFaturaResponse> {
  const response = await api.post<PayFaturaResponse>(
    `/wallets/${walletId}/cards/${cardId}/faturas/${faturaId}/pay`,
    dto
  );
  return response.data;
}

export async function unpayFatura(
  walletId: string,
  cardId: string,
  faturaId: string
): Promise<void> {
  await api.post(
    `/wallets/${walletId}/cards/${cardId}/faturas/${faturaId}/unpay`,
    {}
  );
}

export async function updateFaturaCategory(
  walletId: string,
  cardId: string,
  faturaId: string,
  dto: UpdateFaturaCategoryDto
): Promise<Fatura> {
  const response = await api.patch<Fatura>(
    `/wallets/${walletId}/cards/${cardId}/faturas/${faturaId}/category`,
    dto
  );
  return response.data;
}
