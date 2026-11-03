(function () {
    "use strict";

    const activeConnections = new Map();

    function claimsFromToken(token) {
        try {
            const payload = token.split(".")[1]
                .replace(/-/g, "+")
                .replace(/_/g, "/");
            const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
            return JSON.parse(decodeURIComponent(Array.from(atob(padded), char =>
                `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")));
        } catch {
            return null;
        }
    }

    function accountIdFromToken(token) {
        const claims = claimsFromToken(token);
        return claims?.sub ? String(claims.sub) : "";
    }

    function connect(options) {
        if (!window.SockJS || !window.StompJs?.Client) {
            console.error("[Order realtime] Chưa tải được SockJS/STOMP client.");
            return { disconnect() {} };
        }

        const connectionKey = options.connectionKey || "orders";
        if (activeConnections.has(connectionKey)) {
            return activeConnections.get(connectionKey);
        }

        let stopped = false;
        let connectedOnce = false;
        let tokenExpiryTimer = null;
        const seenEvents = new Set();
        const client = new window.StompJs.Client({
            webSocketFactory: () => new window.SockJS(`${options.apiOrigin}/ws`),
            reconnectDelay: 5000,
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            debug: () => {}
        });

        client.beforeConnect = () => {
            const token = options.getToken();
            const expiration = Number(claimsFromToken(token || "")?.exp) * 1000;
            if (!token || !Number.isFinite(expiration) || expiration <= Date.now()) {
                client.reconnectDelay = 0;
                options.onAuthError?.();
                throw new Error("Access token WebSocket không tồn tại hoặc đã hết hạn.");
            }
            client.connectHeaders = { Authorization: `Bearer ${token}` };
        };

        client.onConnect = () => {
            window.clearTimeout(tokenExpiryTimer);
            const expiration = Number(claimsFromToken(options.getToken() || "")?.exp) * 1000;
            tokenExpiryTimer = window.setTimeout(async () => {
                if (stopped) return;
                await client.deactivate();
                const nextExpiration = Number(claimsFromToken(options.getToken() || "")?.exp) * 1000;
                if (!Number.isFinite(nextExpiration) || nextExpiration <= Date.now()) {
                    options.onAuthError?.();
                    return;
                }
                client.activate();
            }, Math.max(0, expiration - Date.now() + 250));

            const reconnect = connectedOnce;
            connectedOnce = true;
            console.info("[Order realtime] STOMP connected", { reconnect });
            options.destinations().forEach(destination => {
                console.info("[Order realtime] Subscribing", { destination });
                client.subscribe(destination, message => {
                    try {
                        const event = JSON.parse(message.body);
                        console.info("[Order realtime] MESSAGE received", {
                            destination,
                            type: event?.type,
                            orderId: event?.orderId
                        });
                        const eventKey = [event.type, event.orderId, event.status, event.changedAt].join(":");
                        if (seenEvents.has(eventKey)) return;
                        seenEvents.add(eventKey);
                        window.setTimeout(() => seenEvents.delete(eventKey), 60000);
                        options.onEvent(event);
                    } catch (error) {
                        console.error("[Order realtime] Payload không hợp lệ:", error);
                    }
                });
            });
            options.onConnected?.(reconnect);
        };

        client.onStompError = frame => {
            const detail = `${frame.headers?.message || ""} ${frame.body || ""}`;
            if (/access token|authentication|credentials|denied/i.test(detail)) {
                client.reconnectDelay = 0;
                options.onAuthError?.();
            }
        };

        client.onWebSocketClose = () => {
            if (!stopped && !options.getToken()) {
                client.reconnectDelay = 0;
                options.onAuthError?.();
            }
        };

        client.activate();

        const disconnect = () => {
            if (stopped) return;
            stopped = true;
            window.clearTimeout(tokenExpiryTimer);
            client.reconnectDelay = 0;
            client.deactivate();
            activeConnections.delete(connectionKey);
        };
        window.addEventListener("beforeunload", disconnect, { once: true });
        const connection = { disconnect };
        activeConnections.set(connectionKey, connection);
        return connection;
    }

    window.FCA_ORDER_REALTIME = { connect, accountIdFromToken };
})();
