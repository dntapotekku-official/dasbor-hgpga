export function emit_socket_event(event, payload) {
  globalThis.io?.emit(event, payload);
}