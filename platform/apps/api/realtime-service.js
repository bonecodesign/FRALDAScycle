function writeEvent(response, event) {
  response.write(`id: ${event.id}\n`);
  response.write(`event: ${event.event_type}\n`);
  response.write(`data: ${JSON.stringify({
    id: String(event.id),
    type: event.event_type,
    source: event.source,
    entityType: event.entity_type,
    entityId: event.entity_id,
    payload: event.payload,
    occurredAt: event.occurred_at,
  })}\n\n`);
}

export function createRealtimeService(repository, {
  pollIntervalMs = 1_000,
  heartbeatIntervalMs = 15_000,
} = {}) {
  return Object.freeze({
    open(response, { afterId = 0, headers = {} } = {}) {
      let cursor = Number.isSafeInteger(Number(afterId)) && Number(afterId) >= 0 ? Number(afterId) : 0;
      let closed = false;
      let polling = false;
      response.writeHead(200, {
        ...headers,
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      response.write("retry: 3000\n\n");

      const poll = async () => {
        if (closed || polling) return;
        polling = true;
        try {
          const items = await repository.listAfter({ afterId: cursor, limit: 100 });
          for (const event of items) {
            writeEvent(response, event);
            cursor = Number(event.id);
          }
        } catch {
          response.write(`event: stream.error\ndata: {"code":"realtime_temporarily_unavailable"}\n\n`);
        } finally {
          polling = false;
        }
      };
      void poll();
      const pollTimer = setInterval(poll, pollIntervalMs);
      const heartbeatTimer = setInterval(() => {
        if (!closed) response.write(`: heartbeat ${Date.now()}\n\n`);
      }, heartbeatIntervalMs);
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
      };
      response.once("close", close);
      response.once("error", close);
      return close;
    },
  });
}
