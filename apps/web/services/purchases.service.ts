import api from "@/lib/api";
import type {
  CreditCardPurchase,
  PurchaseListResponse,
  CreatePurchaseDto,
  UpdatePurchaseDto,
} from "@/types/api";

export async function listPurchases(
  walletId: string,
  cardId: string
): Promise<CreditCardPurchase[]> {
  const response = await api.get<PurchaseListResponse>(
    `/wallets/${walletId}/cards/${cardId}/purchases`
  );
  return response.data.purchases;
}

export async function cancelPurchase(
  walletId: string,
  cardId: string,
  purchaseId: string
): Promise<CreditCardPurchase> {
  const response = await api.delete<CreditCardPurchase>(
    `/wallets/${walletId}/cards/${cardId}/purchases/${purchaseId}`
  );
  return response.data;
}

export async function createPurchase(
  walletId: string,
  cardId: string,
  dto: CreatePurchaseDto
): Promise<CreditCardPurchase> {
  const response = await api.post<CreditCardPurchase>(
    `/wallets/${walletId}/cards/${cardId}/purchases`,
    dto
  );
  return response.data;
}

export async function updatePurchase(
  walletId: string,
  cardId: string,
  purchaseId: string,
  dto: UpdatePurchaseDto
): Promise<CreditCardPurchase> {
  const response = await api.patch<CreditCardPurchase>(
    `/wallets/${walletId}/cards/${cardId}/purchases/${purchaseId}`,
    dto
  );
  return response.data;
}

export async function cancelInstallment(
  walletId: string,
  cardId: string,
  purchaseId: string,
  installmentId: string
): Promise<CreditCardPurchase> {
  const response = await api.post<CreditCardPurchase>(
    `/wallets/${walletId}/cards/${cardId}/purchases/${purchaseId}/installments/${installmentId}/cancel`
  );
  return response.data;
}
