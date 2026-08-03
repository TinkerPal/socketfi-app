// @ts-nocheck
export default class EventService {
  id = 0;
  listeners = new Map();

  sub(callback) {
    this.id += 1;

    const listenId = this.id;

    this.listeners.set(listenId, callback);

    return () => this.unsub(listenId);
  }

  unsub(id) {
    this.listeners.delete(id);
  }

  trigger(event) {
    this.listeners.forEach((callback) => {
      console.log("triggered");
      callback(event);
    });
  }
}
