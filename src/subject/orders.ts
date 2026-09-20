/**
 * 題材: 注文登録API（AIが書いた想定の実装）
 *
 * POST /orders
 * Idempotency-Key: <依頼ID>   ← 省略可
 * { "productId": "A", "qty": 1 }
 *
 * 守りたいこと: 通信の再送で勝手に2件登録されるのは困る。
 *               でも、意図して2件注文するのは許したい。
 */

export type OrderRequest = { productId: string; qty: number };

export type OrderResult =
  | { status: 201; orderId: string }
  | { status: 200; orderId: string }
  | { status: 409; error: string };

type StoredKey = { fingerprint: string; result: OrderResult };

export class OrderStore {
  private orders: Array<{ id: string; productId: string; qty: number }> = [];
  private keys = new Map<string, StoredKey>();

  create(body: OrderRequest, idempotencyKey?: string): OrderResult {
    const fingerprint = JSON.stringify(body);

    if (idempotencyKey !== undefined) {
      const seen = this.keys.get(idempotencyKey);
      if (seen) {
        if (seen.fingerprint !== fingerprint) {
          return { status: 409, error: "Idempotency-Key reused with a different payload" };
        }
        // 同じ依頼の再送: 最初の結果をそのまま返す
        return { status: 200, orderId: seen.result.status === 409 ? "" : seen.result.orderId };
      }
    }

    const id = `ord_${this.orders.length + 1}`;
    this.orders.push({ id, ...body });
    const result: OrderResult = { status: 201, orderId: id };
    if (idempotencyKey !== undefined) this.keys.set(idempotencyKey, { fingerprint, result });
    return result;
  }

  count(): number {
    return this.orders.length;
  }
}
