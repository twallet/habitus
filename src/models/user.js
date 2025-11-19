export class User {
  #id;
  #name;

  constructor(name) {
    this.#name = User.#validateName(name);
  }

  get id() {
    return this.#id;
  }

  get name() {
    return this.#name;
  }

  /**
   * Validates card value and game definition.
   * @param {number} value - The card value to validate.
   * @param {Object} game - The game definition to validate.
   * @throws {Error} If validation fails.
   * @private
   */
  static #validateName(name) {
    if (typeof name !== "string") {
      throw new TypeError("Player name must be a string");
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new TypeError("Player name must not be empty");
    }

    return trimmedName;
  }
}
