type MessagePayload = {
  id: string;
  orderId: string;
  sender: "CUSTOMER" | "ADMIN";
  body: string;
  createdAt: string;
};

type Listener = (payload: MessagePayload) => void;

const listeners = new Map<string, Set<Listener>>();

export const chatBus = {
  subscribe(orderId: string, listener: Listener) {
    const set = listeners.get(orderId) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(orderId, set);

    return () => {
      const current = listeners.get(orderId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        listeners.delete(orderId);
      }
    };
  },
  publish(orderId: string, payload: MessagePayload) {
    const set = listeners.get(orderId);
    if (!set) return;
    set.forEach((listener) => listener(payload));
  },
};

export type { MessagePayload };
