// Idempotency-Key 값. 보안용이 아니라 "같은 요청을 다시 보냈다"를 서버에 알리는 용도다.
// 네트워크 오류로 다시 보낼 때는 새로 만들지 않고 같은 값을 쓴다.
export function createRequestKey() {
  const random = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random()}-${random()}`;
}
