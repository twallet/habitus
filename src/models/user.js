export class User {
  // Instance variables (private fields)
  #id;
  #name;

  // Static class variable (shared across all instances)
  static #nextId = 1;

  // Static constant (read-only)
  static get MAX_NAME_LENGTH() {
    return 30;
  }

  constructor(name) {
    this.#name = User.#validateName(name);
    this.#id = User.#nextId++;
  }

  get id() {
    return this.#id;
  }

  get name() {
    return this.#name;
  }

  static #validateName(name) {
    if (typeof name !== "string") {
      throw new TypeError("Player name must be a string");
    }

    if (name.length > User.MAX_NAME_LENGTH) {
      throw new TypeError(
        `Player name must be smaller than ${User.MAX_NAME_LENGTH} characters`
      );
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new TypeError("Player name must not be empty");
    }

    return trimmedName;
  }
}
