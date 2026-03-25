import type { GameEvent, GameEventListener } from '../types';

type EventType = GameEvent['type'];

export class EventBus {
  private listeners: Map<EventType, Set<GameEventListener>> = new Map();
  private allListeners: Set<GameEventListener> = new Set();

  on(eventType: EventType, listener: GameEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => this.off(eventType, listener);
  }

  onAny(listener: GameEventListener): () => void {
    this.allListeners.add(listener);
    return () => this.allListeners.delete(listener);
  }

  off(eventType: EventType, listener: GameEventListener): void {
    this.listeners.get(eventType)?.delete(listener);
  }

  emit(event: GameEvent): void {
    this.listeners.get(event.type)?.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // Silently handle listener errors
      }
    });

    this.allListeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // Silently handle listener errors
      }
    });
  }

  clear(): void {
    this.listeners.clear();
    this.allListeners.clear();
  }
}

export const eventBus = new EventBus();
